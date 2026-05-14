// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/// @notice Single prediction market with parimutuel share accounting.
/// Pricing: price[i] = poolBalances[i] / totalPool
/// TODO: upgrade to LMSR for v2
///
/// Bounty mechanics:
///   When resolve() is called, the resolver earns BOUNTY_BPS (0.5%) of the total
///   pool, capped at MAX_BOUNTY (1 MON). The bounty is paid from the pool BEFORE
///   claim() payouts, reducing the effective pool proportionally across all
///   participants. This incentivises permissionless resolution with no keeper bot.
///
/// Creator deposit:
///   User-created markets require a CREATION_DEPOSIT (set by the factory) sent to
///   this contract at construction. It is refunded to creator on successful resolve().
///   Admin/demo markets pass creator = address(0) and deposit = 0.
///
/// isDemo:
///   If isDemo == true, the block.timestamp >= resolveTime time-lock is skipped so
///   the market can be resolved at any point. The Pyth VAA window is anchored to
///   block.timestamp instead of resolveTime, so a live price update always validates.
contract PredictionMarket is ReentrancyGuard {
    // ─── Types ────────────────────────────────────────────────────────────────

    enum ResolutionType {
        ABOVE_THRESHOLD,
        BELOW_THRESHOLD,
        CLOSEST_TO
    }

    // ─── Constants ────────────────────────────────────────────────────────────

    /// @dev 0.5 % of pool paid to resolver.
    uint16 public constant BOUNTY_BPS = 50;
    /// @dev Resolver bounty cap — prevents over-rewarding on large pools.
    uint256 public constant MAX_BOUNTY = 1 ether;

    // ─── Immutable market parameters ─────────────────────────────────────────

    IPyth public immutable pyth;
    address public immutable creator;   // address(0) for admin/demo markets
    uint256 public immutable creationDeposit; // 0 for admin/demo markets
    bool public immutable isDemo;       // if true, resolve() skips the time-lock

    string public question;
    string[] public outcomes;
    uint256 public closeTime;
    uint256 public resolveTime;
    bytes32 public pythPriceFeedId;
    /// One element for binary markets; N elements for CLOSEST_TO (band midpoints).
    /// All values normalised to Pyth expo = -8 (USD × 1e8).
    int64[] public thresholds;
    ResolutionType public resolutionType;

    // ─── Mutable state ────────────────────────────────────────────────────────

    uint256[] public poolBalances;
    mapping(address => uint256[]) public userShares;

    /// -1 until resolved; then 0..N-1.
    int8 public winningOutcome = -1;

    /// Bounty paid to the resolver on resolution; subtracted from effective pool
    /// in claim() payouts so that total claimable == totalPool - resolverBounty.
    uint256 public resolverBounty;

    // ─── Events ───────────────────────────────────────────────────────────────

    event SharesBought(address indexed buyer, uint8 outcomeIndex, uint256 amount);
    event Resolved(uint8 indexed winningOutcome, address indexed resolver, uint256 bounty);
    event Claimed(address indexed user, uint256 payout);

    // ─── Constructor ──────────────────────────────────────────────────────────

    /// @param _pyth            Pyth oracle contract address.
    /// @param _question        Market question string.
    /// @param _outcomes        Outcome label strings (2–8).
    /// @param _closeTime       Unix timestamp after which buy() is disabled.
    /// @param _resolveTime     Unix timestamp after which resolve() is callable
    ///                         (ignored when isDemo == true).
    /// @param _pythPriceFeedId Pyth price feed ID to query on resolution.
    /// @param _thresholds      Threshold(s) in USD × 1e8 (expo = -8).
    /// @param _resolutionType  How the winner is determined.
    /// @param _creator         Address to refund the creation deposit; address(0) = no refund.
    /// @param _isDemo          If true, time-lock is bypassed and Pyth window uses block.timestamp.
    /// @param _creationDeposit Amount of MON locked in this contract, refunded on resolve.
    constructor(
        address _pyth,
        string memory _question,
        string[] memory _outcomes,
        uint256 _closeTime,
        uint256 _resolveTime,
        bytes32 _pythPriceFeedId,
        int64[] memory _thresholds,
        ResolutionType _resolutionType,
        address _creator,
        bool _isDemo,
        uint256 _creationDeposit
    ) payable {
        require(_outcomes.length >= 2, "Need >= 2 outcomes");
        require(_closeTime < _resolveTime, "closeTime must precede resolveTime");
        if (_resolutionType == ResolutionType.CLOSEST_TO) {
            require(_thresholds.length == _outcomes.length, "CLOSEST_TO needs N thresholds");
        } else {
            require(_thresholds.length == 1, "Binary needs 1 threshold");
        }

        pyth             = IPyth(_pyth);
        creator          = _creator;
        isDemo           = _isDemo;
        creationDeposit  = _creationDeposit;
        question         = _question;
        outcomes         = _outcomes;
        closeTime        = _closeTime;
        resolveTime      = _resolveTime;
        pythPriceFeedId  = _pythPriceFeedId;
        thresholds       = _thresholds;
        resolutionType   = _resolutionType;
        poolBalances     = new uint256[](_outcomes.length);
    }

    // ─── Trading ──────────────────────────────────────────────────────────────

    function buy(uint8 outcomeIndex) external payable {
        require(block.timestamp < closeTime, "Trading closed");
        require(outcomeIndex < outcomes.length, "Invalid outcome");
        require(msg.value > 0, "Amount must be > 0");

        if (userShares[msg.sender].length == 0) {
            userShares[msg.sender] = new uint256[](outcomes.length);
        }

        poolBalances[outcomeIndex] += msg.value;
        userShares[msg.sender][outcomeIndex] += msg.value;

        emit SharesBought(msg.sender, outcomeIndex, msg.value);
    }

    // ─── Resolution ───────────────────────────────────────────────────────────

    /// @notice Anyone can resolve this market.
    ///
    /// For regular markets: callable only after resolveTime.
    /// For demo markets (isDemo == true): callable at any time; the Pyth VAA window
    /// is anchored to block.timestamp so a fresh price update is always valid.
    ///
    /// On successful resolution:
    ///   1. Resolver earns a bounty (0.5% of pool, max 1 MON).
    ///   2. Creator receives their creation deposit back.
    ///   3. winningOutcome is set; winners may call claim().
    function resolve(bytes[] calldata pythUpdateData) external payable nonReentrant {
        if (!isDemo) {
            require(block.timestamp >= resolveTime, "Too early to resolve");
        }
        require(winningOutcome == -1, "Already resolved");

        uint256 fee = pyth.getUpdateFee(pythUpdateData);
        require(msg.value >= fee, "Insufficient Pyth fee");

        bytes32[] memory feedIds = new bytes32[](1);
        feedIds[0] = pythPriceFeedId;

        // Demo markets use block.timestamp as the VAA window anchor so a live
        // price update (publishTime ≈ now) is always within the acceptable range.
        uint64 refTime = isDemo ? uint64(block.timestamp) : uint64(resolveTime);

        uint64 windowStart = refTime >= 60 ? refTime - 60 : 0;
        PythStructs.PriceFeed[] memory feeds = pyth.parsePriceFeedUpdates{value: fee}(
            pythUpdateData,
            feedIds,
            windowStart,
            refTime + 3600
        );

        int64 rawPrice = feeds[0].price.price;
        int32 expo     = feeds[0].price.expo;
        int64 normalizedPrice = _normalizePrice(rawPrice, expo);

        int8 winner;
        if (resolutionType == ResolutionType.ABOVE_THRESHOLD) {
            winner = normalizedPrice >= thresholds[0] ? int8(0) : int8(1);
        } else if (resolutionType == ResolutionType.BELOW_THRESHOLD) {
            winner = normalizedPrice < thresholds[0] ? int8(0) : int8(1);
        } else {
            winner = _findClosest(normalizedPrice);
        }

        winningOutcome = winner;

        // ── Compute and pay resolver bounty ──────────────────────────────────
        uint256 total = _totalPool();
        uint256 bounty = (total * BOUNTY_BPS) / 10_000;
        if (bounty > MAX_BOUNTY) bounty = MAX_BOUNTY;
        if (bounty > total)     bounty = total; // safety: empty or tiny pool

        resolverBounty = bounty;

        if (bounty > 0) {
            (bool ok,) = payable(msg.sender).call{value: bounty}("");
            require(ok, "Bounty transfer failed");
        }

        // ── Refund creation deposit to creator ───────────────────────────────
        if (creator != address(0) && creationDeposit > 0) {
            (bool ok2,) = payable(creator).call{value: creationDeposit}("");
            require(ok2, "Deposit refund failed");
        }

        emit Resolved(uint8(uint8(winner)), msg.sender, bounty);

        // ── Refund surplus Pyth fee ───────────────────────────────────────────
        if (msg.value > fee) {
            (bool ok3,) = payable(msg.sender).call{value: msg.value - fee}("");
            require(ok3, "Fee refund failed");
        }
    }

    // ─── Claiming ─────────────────────────────────────────────────────────────

    /// @notice Winners claim their proportional share of the pool minus the resolver bounty.
    ///
    /// Payout formula (CEI pattern):
    ///   effectivePool = totalPool - resolverBounty
    ///   payout = userWinShares * effectivePool / winningPoolBalance
    ///
    /// The bounty reduction is proportional: winners and losers each contribute
    /// BOUNTY_BPS / 10_000 of their pool to the resolver reward.
    function claim() external nonReentrant {
        require(winningOutcome >= 0, "Not resolved yet");
        uint8 winner = uint8(uint8(winningOutcome));

        require(userShares[msg.sender].length > 0, "No positions");
        uint256 userWinShares = userShares[msg.sender][winner];
        require(userWinShares > 0, "No winning shares");

        uint256 effectiveTotal = _totalPool() - resolverBounty;
        require(poolBalances[winner] > 0, "Empty winning pool");

        uint256 payout = (userWinShares * effectiveTotal) / poolBalances[winner];

        // Zero before transfer — CEI pattern + reentrancy guard
        userShares[msg.sender][winner] = 0;

        (bool ok,) = payable(msg.sender).call{value: payout}("");
        require(ok, "Transfer failed");

        emit Claimed(msg.sender, payout);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Returns each outcome's implied probability as a fraction of 1e18.
    function getPrices() external view returns (uint256[] memory prices) {
        uint256 total = _totalPool();
        prices = new uint256[](outcomes.length);
        if (total == 0) {
            uint256 equal = 1e18 / outcomes.length;
            for (uint256 i = 0; i < outcomes.length; i++) {
                prices[i] = equal;
            }
        } else {
            for (uint256 i = 0; i < outcomes.length; i++) {
                prices[i] = (poolBalances[i] * 1e18) / total;
            }
        }
    }

    function getUserPosition(address user) external view returns (uint256[] memory) {
        if (userShares[user].length == 0) {
            return new uint256[](outcomes.length);
        }
        return userShares[user];
    }

    function getOutcomes() external view returns (string[] memory) {
        return outcomes;
    }

    function getPoolBalances() external view returns (uint256[] memory) {
        return poolBalances;
    }

    function timeRemaining() external view returns (uint256) {
        if (block.timestamp >= closeTime) return 0;
        return closeTime - block.timestamp;
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    function _totalPool() internal view returns (uint256 total) {
        for (uint256 i = 0; i < poolBalances.length; i++) {
            total += poolBalances[i];
        }
    }

    /// @dev Converts a Pyth price to a fixed-point int64 with expo = -8 (USD × 1e8).
    function _normalizePrice(int64 price, int32 expo) internal pure returns (int64) {
        int32 diff = expo - (-8); // target expo is -8
        if (diff == 0) return price;
        if (diff > 0) {
            return price * int64(int256(10 ** uint32(diff)));
        } else {
            return price / int64(int256(10 ** uint32(-diff)));
        }
    }

    /// @dev Returns the outcome index whose threshold is numerically closest to `price`.
    function _findClosest(int64 price) internal view returns (int8 winner) {
        int64 minDiff = type(int64).max;
        for (uint8 i = 0; i < thresholds.length; i++) {
            int64 diff = price - thresholds[i];
            if (diff < 0) diff = -diff;
            if (diff < minDiff) {
                minDiff = diff;
                winner = int8(i);
            }
        }
    }
}
