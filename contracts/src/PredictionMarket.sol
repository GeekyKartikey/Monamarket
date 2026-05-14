// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/// @notice Single prediction market with parimutuel share accounting.
/// Pricing: price[i] = poolBalances[i] / totalPool  (constant-product approximation)
/// TODO: upgrade to LMSR for v2
contract PredictionMarket is ReentrancyGuard {
    enum ResolutionType {
        ABOVE_THRESHOLD,
        BELOW_THRESHOLD,
        CLOSEST_TO
    }

    IPyth public immutable pyth;

    string public question;
    string[] public outcomes;
    uint256 public closeTime;
    uint256 public resolveTime;
    bytes32 public pythPriceFeedId;
    /// One element for binary markets, N elements for CLOSEST_TO (band midpoints).
    /// All values normalized to Pyth expo = -8 (i.e. USD × 1e8).
    int64[] public thresholds;
    ResolutionType public resolutionType;

    uint256[] public poolBalances;
    mapping(address => uint256[]) public userShares;

    /// -1 until resolved; then 0..N-1
    int8 public winningOutcome = -1;

    event SharesBought(address indexed buyer, uint8 outcomeIndex, uint256 amount);
    event MarketResolved(int8 winningOutcome, int64 resolvedPrice);
    event Claimed(address indexed user, uint256 payout);

    constructor(
        address _pyth,
        string memory _question,
        string[] memory _outcomes,
        uint256 _closeTime,
        uint256 _resolveTime,
        bytes32 _pythPriceFeedId,
        int64[] memory _thresholds,
        ResolutionType _resolutionType
    ) {
        require(_outcomes.length >= 2, "Need >= 2 outcomes");
        require(_closeTime < _resolveTime, "closeTime must precede resolveTime");
        if (_resolutionType == ResolutionType.CLOSEST_TO) {
            require(_thresholds.length == _outcomes.length, "CLOSEST_TO needs N thresholds");
        } else {
            require(_thresholds.length == 1, "Binary needs 1 threshold");
        }

        pyth = IPyth(_pyth);
        question = _question;
        outcomes = _outcomes;
        closeTime = _closeTime;
        resolveTime = _resolveTime;
        pythPriceFeedId = _pythPriceFeedId;
        thresholds = _thresholds;
        resolutionType = _resolutionType;
        poolBalances = new uint256[](_outcomes.length);
    }

    // ─────────────────────────────────────────────────────────────────
    // Trading
    // ─────────────────────────────────────────────────────────────────

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

    // ─────────────────────────────────────────────────────────────────
    // Resolution
    // ─────────────────────────────────────────────────────────────────

    /// @notice Anyone can resolve after resolveTime by supplying a Pyth VAA
    ///         published within [resolveTime - 60s, resolveTime + 3600s].
    function resolve(bytes[] calldata pythUpdateData) external payable nonReentrant {
        require(block.timestamp >= resolveTime, "Too early to resolve");
        require(winningOutcome == -1, "Already resolved");

        uint256 fee = pyth.getUpdateFee(pythUpdateData);
        require(msg.value >= fee, "Insufficient Pyth fee");

        bytes32[] memory feedIds = new bytes32[](1);
        feedIds[0] = pythPriceFeedId;

        PythStructs.PriceFeed[] memory feeds = pyth.parsePriceFeedUpdates{value: fee}(
            pythUpdateData,
            feedIds,
            uint64(resolveTime - 60),
            uint64(resolveTime + 3600)
        );

        int64 rawPrice = feeds[0].price.price;
        int32 expo = feeds[0].price.expo;
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
        emit MarketResolved(winner, normalizedPrice);

        // Refund surplus ETH/MON
        if (msg.value > fee) {
            (bool ok, ) = payable(msg.sender).call{value: msg.value - fee}("");
            require(ok, "Refund failed");
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Claiming
    // ─────────────────────────────────────────────────────────────────

    function claim() external nonReentrant {
        require(winningOutcome >= 0, "Not resolved yet");
        uint8 winner = uint8(uint8(winningOutcome));

        require(userShares[msg.sender].length > 0, "No positions");
        uint256 userWinShares = userShares[msg.sender][winner];
        require(userWinShares > 0, "No winning shares");

        uint256 total = _totalPool();
        require(poolBalances[winner] > 0, "Empty winning pool");

        uint256 payout = (userWinShares * total) / poolBalances[winner];

        // Zero before transfer — reentrancy guard + CEI pattern
        userShares[msg.sender][winner] = 0;

        (bool ok, ) = payable(msg.sender).call{value: payout}("");
        require(ok, "Transfer failed");

        emit Claimed(msg.sender, payout);
    }

    // ─────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────

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

    // ─────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────

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
