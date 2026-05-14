// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PredictionMarket.sol";

/// @notice Factory for PredictionMarket instances.
///
/// Feed allowlist:
///   Only price feeds registered via addFeed() can be used in createMarket().
///   Each feed entry stores the Pyth contract address to use (main vs beta).
///   This replaces the old per-market pythOverride approach.
///
/// Public market creation:
///   Anyone can call createMarket() by sending CREATION_DEPOSIT (0.1 MON).
///   The deposit is forwarded to the market and refunded to the creator on
///   successful resolve(). Admin/demo markets created via createDemoMarket()
///   or createAdminMarket() pass deposit = 0 and creator = address(0).
contract MarketFactory is Ownable {
    // ─── Constants ────────────────────────────────────────────────────────────

    /// @dev Refundable deposit required for public market creation.
    uint256 public constant CREATION_DEPOSIT = 0.1 ether;

    // ─── Types ────────────────────────────────────────────────────────────────

    struct FeedInfo {
        bool supported;
        string name;        // e.g. "BTC/USD"
        address pythContract; // which Pyth instance to use for this feed
    }

    // ─── State ────────────────────────────────────────────────────────────────

    address public immutable defaultPyth;
    address[] public markets;

    /// Allowlisted price feeds: feedId → FeedInfo
    mapping(bytes32 => FeedInfo) public feeds;
    bytes32[] public feedIds; // enumerable list for the UI

    /// Creator → markets they created (user-generated only)
    mapping(address => address[]) private _creatorMarkets;

    // ─── Events ───────────────────────────────────────────────────────────────

    event MarketCreated(
        address indexed market,
        address indexed creator,
        string question,
        bool isDemo
    );
    event FeedAdded(bytes32 indexed feedId, string name, address pythContract);
    event FeedRemoved(bytes32 indexed feedId);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _pyth, address _owner) Ownable(_owner) {
        defaultPyth = _pyth;
    }

    // ─── Feed management (onlyOwner) ──────────────────────────────────────────

    function addFeed(bytes32 feedId, string calldata name, address pythContract) external onlyOwner {
        require(!feeds[feedId].supported, "Feed already exists");
        address pyth = pythContract != address(0) ? pythContract : defaultPyth;
        feeds[feedId] = FeedInfo({ supported: true, name: name, pythContract: pyth });
        feedIds.push(feedId);
        emit FeedAdded(feedId, name, pyth);
    }

    function removeFeed(bytes32 feedId) external onlyOwner {
        require(feeds[feedId].supported, "Feed not found");
        feeds[feedId].supported = false;
        // Remove from enumerable list
        for (uint256 i = 0; i < feedIds.length; i++) {
            if (feedIds[i] == feedId) {
                feedIds[i] = feedIds[feedIds.length - 1];
                feedIds.pop();
                break;
            }
        }
        emit FeedRemoved(feedId);
    }

    function getSupportedFeedIds() external view returns (bytes32[] memory) {
        return feedIds;
    }

    // ─── Public market creation ───────────────────────────────────────────────

    /// @notice Anyone may create a market by sending exactly CREATION_DEPOSIT.
    ///
    /// The deposit is forwarded to the market contract and refunded to msg.sender
    /// on successful resolve(). The feed must be in the allowlist.
    function createMarket(
        string calldata question,
        string[] calldata outcomeLabels,
        uint256 closeTime,
        uint256 resolveTime,
        bytes32 pythPriceFeedId,
        int64[] calldata thresholds,
        PredictionMarket.ResolutionType resolutionType
    ) external payable returns (address market) {
        require(msg.value == CREATION_DEPOSIT, "Must send exactly 0.1 MON deposit");
        require(feeds[pythPriceFeedId].supported, "Feed not in allowlist");
        require(outcomeLabels.length >= 2, "Need >= 2 outcomes");
        require(closeTime < resolveTime, "closeTime must precede resolveTime");

        address pythAddr = feeds[pythPriceFeedId].pythContract;

        PredictionMarket m = new PredictionMarket{value: CREATION_DEPOSIT}(
            pythAddr,
            question,
            outcomeLabels,
            closeTime,
            resolveTime,
            pythPriceFeedId,
            thresholds,
            resolutionType,
            msg.sender,  // creator — receives deposit back on resolve
            false,       // isDemo — time-lock enforced
            CREATION_DEPOSIT
        );

        address mAddr = address(m);
        markets.push(mAddr);
        _creatorMarkets[msg.sender].push(mAddr);
        emit MarketCreated(mAddr, msg.sender, question, false);
        return mAddr;
    }

    // ─── Admin market creation (onlyOwner) ───────────────────────────────────

    /// @notice Deploy a demo market (isDemo = true, no time-lock, no deposit).
    ///
    /// Demo markets can be resolved at any time and the Pyth VAA window is
    /// anchored to block.timestamp. Useful for short-duration test markets.
    function createDemoMarket(
        string calldata question,
        string[] calldata outcomeLabels,
        uint256 closeTime,
        uint256 resolveTime,
        bytes32 pythPriceFeedId,
        int64[] calldata thresholds,
        PredictionMarket.ResolutionType resolutionType
    ) external onlyOwner returns (address market) {
        require(feeds[pythPriceFeedId].supported, "Feed not in allowlist");

        address pythAddr = feeds[pythPriceFeedId].pythContract;

        PredictionMarket m = new PredictionMarket(
            pythAddr,
            question,
            outcomeLabels,
            closeTime,
            resolveTime,
            pythPriceFeedId,
            thresholds,
            resolutionType,
            address(0), // no creator → no deposit refund
            true,       // isDemo = true
            0           // no deposit
        );

        address mAddr = address(m);
        markets.push(mAddr);
        emit MarketCreated(mAddr, address(0), question, true);
        return mAddr;
    }

    /// @notice Deploy an admin (non-demo) market with no deposit requirement.
    ///
    /// Used for long-duration seeded markets (BTC/ETH/MON) that follow the
    /// standard time-lock. Creator = address(0), so no deposit refund.
    function createAdminMarket(
        string calldata question,
        string[] calldata outcomeLabels,
        uint256 closeTime,
        uint256 resolveTime,
        bytes32 pythPriceFeedId,
        int64[] calldata thresholds,
        PredictionMarket.ResolutionType resolutionType
    ) external onlyOwner returns (address market) {
        require(feeds[pythPriceFeedId].supported, "Feed not in allowlist");

        address pythAddr = feeds[pythPriceFeedId].pythContract;

        PredictionMarket m = new PredictionMarket(
            pythAddr,
            question,
            outcomeLabels,
            closeTime,
            resolveTime,
            pythPriceFeedId,
            thresholds,
            resolutionType,
            address(0), // no creator
            false,      // not demo — time-lock enforced
            0           // no deposit
        );

        address mAddr = address(m);
        markets.push(mAddr);
        emit MarketCreated(mAddr, address(0), question, false);
        return mAddr;
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getAllMarkets() external view returns (address[] memory) {
        return markets;
    }

    function marketCount() external view returns (uint256) {
        return markets.length;
    }

    function getMarketsByCreator(address creator) external view returns (address[] memory) {
        return _creatorMarkets[creator];
    }
}
