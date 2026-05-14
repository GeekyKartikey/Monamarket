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
            PredictionMarket.ResolutionType resType,
            address pythOverride
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

        resType      = PredictionMarket.ResolutionType.ABOVE_THRESHOLD;
        pythOverride = address(0);
    }

    function test_createMarket_onlyOwner() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2,
            address po
        ) = _defaultArgs();

        vm.prank(other);
        vm.expectRevert();
        factory.createMarket(q, outs, ct, rt, fid, th, rt2, po);
    }

    function test_createMarket_deploysAndRegisters() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2,
            address po
        ) = _defaultArgs();

        vm.prank(owner);
        address m = factory.createMarket(q, outs, ct, rt, fid, th, rt2, po);

        assertEq(factory.marketCount(), 1);
        address[] memory all = factory.getAllMarkets();
        assertEq(all.length, 1);
        assertEq(all[0], m);
    }

    function test_createMarket_usesDefaultPyth() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2,
        ) = _defaultArgs();

        vm.prank(owner);
        address m = factory.createMarket(q, outs, ct, rt, fid, th, rt2, address(0));

        PredictionMarket pm = PredictionMarket(m);
        assertEq(address(pm.pyth()), address(mockPyth));
    }

    function test_createMarket_usesPythOverride() public {
        MockPyth betaPyth = new MockPyth(1 days, 1);

        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2,
        ) = _defaultArgs();

        vm.prank(owner);
        address m = factory.createMarket(q, outs, ct, rt, fid, th, rt2, address(betaPyth));

        PredictionMarket pm = PredictionMarket(m);
        assertEq(address(pm.pyth()), address(betaPyth));
    }

    function test_createMultipleMarkets() public {
        (
            string memory q, string[] memory outs, uint256 ct, uint256 rt,
            bytes32 fid, int64[] memory th, PredictionMarket.ResolutionType rt2,
            address po
        ) = _defaultArgs();

        vm.startPrank(owner);
        factory.createMarket(q, outs, ct, rt, fid, th, rt2, po);
        factory.createMarket(q, outs, ct, rt, fid, th, rt2, po);
        factory.createMarket(q, outs, ct, rt, fid, th, rt2, po);
        vm.stopPrank();

        assertEq(factory.marketCount(), 3);
        assertEq(factory.getAllMarkets().length, 3);
    }

    function test_getAllMarkets_emptyInitially() public view {
        assertEq(factory.getAllMarkets().length, 0);
    }
}
