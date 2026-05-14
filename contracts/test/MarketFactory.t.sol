// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MarketFactory.sol";
import "../src/PredictionMarket.sol";
import "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

contract MarketFactoryTest is Test {
    MockPyth public mockPyth;
    MarketFactory public factory;

    address owner = address(0x1234);
    address other = address(0x5678);

    bytes32 constant FEED_ID = bytes32(uint256(42));

    function setUp() public {
        mockPyth = new MockPyth(1 days, 1);
        factory = new MarketFactory(address(mockPyth), owner);

        // Register the test feed so createMarket calls can succeed
        vm.prank(owner);
        factory.addFeed(FEED_ID, "TEST/USD", address(0)); // address(0) → uses defaultPyth
    }

    function _defaultArgs()
        internal
        view
        returns (
            string memory question,
            string[] memory outcomes,
            uint256 closeTime,
            uint256 resolveTime,
            bytes32 feedId,
            int64[] memory thresholds,
            PredictionMarket.ResolutionType resType
        )
    {
        question = "Test question?";

        outcomes = new string[](2);
        outcomes[0] = "YES";
        outcomes[1] = "NO";

        closeTime   = block.timestamp + 1 days;
        resolveTime = block.timestamp + 2 days;
        feedId      = FEED_ID;

        thresholds = new int64[](1);
        thresholds[0] = 10_000_000_000_000;

        resType = PredictionMarket.ResolutionType.ABOVE_THRESHOLD;
    }

    // ─── Existing tests (updated for new API) ────────────────────────

    function test_createAdminMarket_deploysAndRegisters() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2
        ) = _defaultArgs();

        vm.prank(owner);
        address m = factory.createAdminMarket(q, outs, ct, rt, fid, th, rt2);

        assertEq(factory.marketCount(), 1);
        address[] memory all = factory.getAllMarkets();
        assertEq(all.length, 1);
        assertEq(all[0], m);
    }

    function test_createAdminMarket_usesDefaultPyth() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2
        ) = _defaultArgs();

        vm.prank(owner);
        address m = factory.createAdminMarket(q, outs, ct, rt, fid, th, rt2);

        PredictionMarket pm = PredictionMarket(m);
        assertEq(address(pm.pyth()), address(mockPyth));
    }

    function test_createAdminMarket_usesFeedPythContract() public {
        MockPyth betaPyth = new MockPyth(1 days, 1);
        bytes32 betaFeedId = bytes32(uint256(99));

        vm.prank(owner);
        factory.addFeed(betaFeedId, "MON/USD", address(betaPyth));

        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            , int64[] memory th, PredictionMarket.ResolutionType rt2
        ) = _defaultArgs();

        vm.prank(owner);
        address m = factory.createAdminMarket(q, outs, ct, rt, betaFeedId, th, rt2);

        PredictionMarket pm = PredictionMarket(m);
        assertEq(address(pm.pyth()), address(betaPyth));
    }

    function test_createMultipleAdminMarkets() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2
        ) = _defaultArgs();

        vm.startPrank(owner);
        factory.createAdminMarket(q, outs, ct, rt, fid, th, rt2);
        factory.createAdminMarket(q, outs, ct, rt, fid, th, rt2);
        factory.createAdminMarket(q, outs, ct, rt, fid, th, rt2);
        vm.stopPrank();

        assertEq(factory.marketCount(), 3);
        assertEq(factory.getAllMarkets().length, 3);
    }

    function test_getAllMarkets_emptyInitially() public {
        // Deploy a fresh factory with no markets
        MarketFactory fresh = new MarketFactory(address(mockPyth), owner);
        assertEq(fresh.getAllMarkets().length, 0);
    }

    // ─── Feed allowlist tests ────────────────────────────────────────

    function test_addFeed_onlyOwner() public {
        vm.prank(other);
        vm.expectRevert();
        factory.addFeed(bytes32(uint256(999)), "FAKE/USD", address(0));
    }

    function test_addFeed_storesCorrectly() public {
        bytes32 newFeed = bytes32(uint256(100));
        address customPyth = address(0xDEAD);

        vm.prank(owner);
        factory.addFeed(newFeed, "NEW/USD", customPyth);

        (bool supported, string memory name, address pythContract) = factory.feeds(newFeed);
        assertTrue(supported);
        assertEq(name, "NEW/USD");
        assertEq(pythContract, customPyth);
    }

    function test_addFeed_revertsIfDuplicate() public {
        vm.prank(owner);
        vm.expectRevert("Feed already exists");
        factory.addFeed(FEED_ID, "DUP/USD", address(0));
    }

    function test_removeFeed_removesFromAllowlist() public {
        vm.prank(owner);
        factory.removeFeed(FEED_ID);

        (bool supported,,) = factory.feeds(FEED_ID);
        assertFalse(supported);
        assertEq(factory.getSupportedFeedIds().length, 0);
    }

    function test_removeFeed_onlyOwner() public {
        vm.prank(other);
        vm.expectRevert();
        factory.removeFeed(FEED_ID);
    }

    // ─── Public createMarket() tests ─────────────────────────────────

    function test_createMarket_publicAccess_succeedsWithDeposit() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2
        ) = _defaultArgs();

        uint256 deposit = factory.CREATION_DEPOSIT(); // cache before prank
        vm.deal(other, 1 ether);
        vm.prank(other);
        address m = factory.createMarket{value: deposit}(q, outs, ct, rt, fid, th, rt2);

        assertEq(factory.marketCount(), 1);
        address[] memory creatorMarkets = factory.getMarketsByCreator(other);
        assertEq(creatorMarkets.length, 1);
        assertEq(creatorMarkets[0], m);
    }

    function test_createMarket_revertsWithoutDeposit() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2
        ) = _defaultArgs();

        vm.deal(other, 1 ether);
        vm.prank(other);
        vm.expectRevert("Must send exactly 0.1 MON deposit");
        factory.createMarket{value: 0}(q, outs, ct, rt, fid, th, rt2);
    }

    function test_createMarket_revertsUnknownFeed() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            , int64[] memory th, PredictionMarket.ResolutionType rt2
        ) = _defaultArgs();

        bytes32 unknownFeed = bytes32(uint256(9999));
        uint256 deposit = factory.CREATION_DEPOSIT(); // cache before expectRevert
        vm.deal(other, 1 ether);
        vm.prank(other);
        vm.expectRevert("Feed not in allowlist");
        factory.createMarket{value: deposit}(q, outs, ct, rt, unknownFeed, th, rt2);
    }

    function test_createMarket_depositForwardedToMarket() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2
        ) = _defaultArgs();

        uint256 deposit = factory.CREATION_DEPOSIT(); // cache before prank
        vm.deal(other, 1 ether);
        vm.prank(other);
        address m = factory.createMarket{value: deposit}(q, outs, ct, rt, fid, th, rt2);

        assertEq(m.balance, deposit);
        assertEq(PredictionMarket(m).creator(), other);
        assertEq(PredictionMarket(m).creationDeposit(), deposit);
    }

    // ─── createDemoMarket() tests ─────────────────────────────────────

    function test_createDemoMarket_onlyOwner() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2
        ) = _defaultArgs();

        vm.prank(other);
        vm.expectRevert();
        factory.createDemoMarket(q, outs, ct, rt, fid, th, rt2);
    }

    function test_createDemoMarket_isDemoTrue() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2
        ) = _defaultArgs();

        vm.prank(owner);
        address m = factory.createDemoMarket(q, outs, ct, rt, fid, th, rt2);

        assertTrue(PredictionMarket(m).isDemo());
        assertEq(PredictionMarket(m).creator(), address(0));
        assertEq(PredictionMarket(m).creationDeposit(), 0);
        assertEq(factory.marketCount(), 1);
    }

    // ─── getMarketsByCreator() tests ───────────────────────────────────

    function test_getMarketsByCreator_emptyForUnknownCreator() public view {
        assertEq(factory.getMarketsByCreator(other).length, 0);
    }

    function test_getMarketsByCreator_tracksCorrectly() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2
        ) = _defaultArgs();

        uint256 deposit = factory.CREATION_DEPOSIT(); // cache before pranks
        address creator1 = address(0xAA);
        address creator2 = address(0xBB);
        vm.deal(creator1, 1 ether);
        vm.deal(creator2, 1 ether);

        vm.prank(creator1);
        address m1 = factory.createMarket{value: deposit}(q, outs, ct, rt, fid, th, rt2);

        vm.prank(creator2);
        address m2 = factory.createMarket{value: deposit}(q, outs, ct, rt, fid, th, rt2);

        vm.prank(creator1);
        address m3 = factory.createMarket{value: deposit}(q, outs, ct, rt, fid, th, rt2);

        address[] memory c1Markets = factory.getMarketsByCreator(creator1);
        assertEq(c1Markets.length, 2);
        assertEq(c1Markets[0], m1);
        assertEq(c1Markets[1], m3);

        address[] memory c2Markets = factory.getMarketsByCreator(creator2);
        assertEq(c2Markets.length, 1);
        assertEq(c2Markets[0], m2);
    }
}
