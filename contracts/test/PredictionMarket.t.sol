// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PredictionMarket.sol";
import "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

contract ReentrancyAttacker {
    PredictionMarket public target;
    uint256 public attackCount;

    constructor(address _target) {
        target = PredictionMarket(_target);
    }

    receive() external payable {
        if (attackCount < 3) {
            attackCount++;
            target.claim();
        }
    }

    function attack() external {
        target.claim();
    }
}

contract PredictionMarketTest is Test {
    MockPyth public mockPyth;
    PredictionMarket public market;
    PredictionMarket public multiMarket;

    bytes32 constant FEED_ID = bytes32(uint256(1));

    address alice = address(0xA11CE);
    address bob   = address(0xB0B);

    uint256 closeTime;
    uint256 resolveTime;

    function setUp() public {
        // validTimePeriod = 1 day, fee = 1 wei per update
        mockPyth = new MockPyth(1 days, 1);

        closeTime  = block.timestamp + 1 days;
        resolveTime = block.timestamp + 2 days;

        // Binary YES/NO market — ABOVE_THRESHOLD at $120,000 (1.2e13 in expo=-8)
        string[] memory binaryOutcomes = new string[](2);
        binaryOutcomes[0] = "YES";
        binaryOutcomes[1] = "NO";

        int64[] memory binaryThresholds = new int64[](1);
        binaryThresholds[0] = 12_000_000_000_000; // $120,000 × 1e8

        market = new PredictionMarket(
            address(mockPyth),
            "Will BTC be above $120,000?",
            binaryOutcomes,
            closeTime,
            resolveTime,
            FEED_ID,
            binaryThresholds,
            PredictionMarket.ResolutionType.ABOVE_THRESHOLD
        );

        // 4-outcome CLOSEST_TO market
        string[] memory multiOutcomes = new string[](4);
        multiOutcomes[0] = "< $0.50";
        multiOutcomes[1] = "$0.50 - $1.00";
        multiOutcomes[2] = "$1.00 - $2.00";
        multiOutcomes[3] = "> $2.00";

        int64[] memory multiThresholds = new int64[](4);
        multiThresholds[0] = 25_000_000;   // $0.25
        multiThresholds[1] = 75_000_000;   // $0.75
        multiThresholds[2] = 150_000_000;  // $1.50
        multiThresholds[3] = 300_000_000;  // $3.00

        multiMarket = new PredictionMarket(
            address(mockPyth),
            "What will MON price be?",
            multiOutcomes,
            closeTime,
            resolveTime,
            FEED_ID,
            multiThresholds,
            PredictionMarket.ResolutionType.CLOSEST_TO
        );

        vm.deal(alice, 100 ether);
        vm.deal(bob,   100 ether);
    }

    // ─── Helpers ────────────────────────────────────────────────────

    function _makePriceUpdate(int64 price, int32 expo) internal view returns (bytes[] memory) {
        bytes memory updateData = mockPyth.createPriceFeedUpdateData(
            FEED_ID,
            price,
            10,   // conf
            expo,
            price,
            10,
            uint64(resolveTime) // publishTime inside the window
        );
        bytes[] memory updates = new bytes[](1);
        updates[0] = updateData;
        return updates;
    }

    // ─── buy() tests ────────────────────────────────────────────────

    function test_buy_updatesPoolAndShares() public {
        vm.prank(alice);
        market.buy{value: 1 ether}(0); // YES

        assertEq(market.poolBalances(0), 1 ether);
        assertEq(market.poolBalances(1), 0);

        uint256[] memory pos = market.getUserPosition(alice);
        assertEq(pos[0], 1 ether);
        assertEq(pos[1], 0);
    }

    function test_buy_multipleUsersAccumulate() public {
        vm.prank(alice);
        market.buy{value: 3 ether}(0);

        vm.prank(bob);
        market.buy{value: 1 ether}(1);

        assertEq(market.poolBalances(0), 3 ether);
        assertEq(market.poolBalances(1), 1 ether);
    }

    function test_buy_revertsAfterCloseTime() public {
        vm.warp(closeTime + 1);
        vm.prank(alice);
        vm.expectRevert("Trading closed");
        market.buy{value: 1 ether}(0);
    }

    function test_buy_revertsInvalidOutcome() public {
        vm.prank(alice);
        vm.expectRevert("Invalid outcome");
        market.buy{value: 1 ether}(5);
    }

    // ─── resolve() tests ────────────────────────────────────────────

    function test_resolve_revertsBeforeResolveTime() public {
        bytes[] memory updates = _makePriceUpdate(13_000_000_000_000, -8);
        vm.deal(address(this), 10);
        vm.expectRevert("Too early to resolve");
        market.resolve{value: 1}(updates);
    }

    function test_resolve_aboveThreshold_yesWins() public {
        // Price $130,000 > threshold $120,000 → YES (outcome 0) wins
        bytes[] memory updates = _makePriceUpdate(13_000_000_000_000, -8);
        vm.warp(resolveTime);
        market.resolve{value: 1}(updates);
        assertEq(market.winningOutcome(), 0);
    }

    function test_resolve_aboveThreshold_noWins() public {
        // Price $100,000 < threshold $120,000 → NO (outcome 1) wins
        bytes[] memory updates = _makePriceUpdate(10_000_000_000_000, -8);
        vm.warp(resolveTime);
        market.resolve{value: 1}(updates);
        assertEq(market.winningOutcome(), 1);
    }

    function test_resolve_belowThreshold() public {
        // Deploy a BELOW_THRESHOLD market
        string[] memory outs = new string[](2);
        outs[0] = "YES"; outs[1] = "NO";
        int64[] memory thresh = new int64[](1);
        thresh[0] = 10_000_000_000_000; // $100,000
        PredictionMarket belowMarket = new PredictionMarket(
            address(mockPyth),
            "Below test",
            outs,
            closeTime,
            resolveTime,
            FEED_ID,
            thresh,
            PredictionMarket.ResolutionType.BELOW_THRESHOLD
        );
        // Price $50,000 < $100,000 → YES (outcome 0) wins
        bytes[] memory updates = _makePriceUpdate(5_000_000_000_000, -8);
        vm.warp(resolveTime);
        belowMarket.resolve{value: 1}(updates);
        assertEq(belowMarket.winningOutcome(), 0);
    }

    function test_resolve_closestTo() public {
        // Price $0.80 → closest to $0.75 midpoint → outcome 1
        // $0.80 × 1e8 = 80_000_000, expo = -8
        bytes[] memory updates = _makePriceUpdate(80_000_000, -8);
        vm.warp(resolveTime);
        multiMarket.resolve{value: 1}(updates);
        assertEq(multiMarket.winningOutcome(), 1); // "$0.50 - $1.00"
    }

    function test_resolve_closestTo_highPrice() public {
        // Price $5.00 → closest to $3.00 midpoint → outcome 3
        bytes[] memory updates = _makePriceUpdate(500_000_000, -8);
        vm.warp(resolveTime);
        multiMarket.resolve{value: 1}(updates);
        assertEq(multiMarket.winningOutcome(), 3); // "> $2.00"
    }

    function test_resolve_revertsIfAlreadyResolved() public {
        bytes[] memory updates = _makePriceUpdate(13_000_000_000_000, -8);
        vm.warp(resolveTime);
        market.resolve{value: 1}(updates);
        vm.expectRevert("Already resolved");
        market.resolve{value: 1}(updates);
    }

    function test_resolve_normalizesExponent() public {
        // Supply price with expo = -5: price = 13_000_000_000 (= $130,000 × 1e5)
        // Normalizes to 13_000_000_000_000 (× 1e8) → above threshold
        bytes[] memory updates = _makePriceUpdate(13_000_000_000, -5);
        vm.warp(resolveTime);
        market.resolve{value: 1}(updates);
        assertEq(market.winningOutcome(), 0); // YES
    }

    // ─── claim() tests ───────────────────────────────────────────────

    function test_claim_proportionalPayout() public {
        // Alice 3 ETH YES, Bob 1 ETH NO — total pool 4 ETH
        // YES wins → Alice gets all 4 ETH
        vm.prank(alice);
        market.buy{value: 3 ether}(0);
        vm.prank(bob);
        market.buy{value: 1 ether}(1);

        bytes[] memory updates = _makePriceUpdate(13_000_000_000_000, -8);
        vm.warp(resolveTime);
        market.resolve{value: 1}(updates);

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        market.claim();
        assertEq(alice.balance - balBefore, 4 ether);
    }

    function test_claim_splitPayout() public {
        // Alice 3 ETH YES, Bob 1 ETH YES, Carol 2 ETH NO — pool 6 ETH
        // YES wins → Alice gets 3/4 × 4 = 3 ETH ... wait total pool = 6 ETH
        // Alice: (3/4) × 6 = 4.5 ETH; Bob: (1/4) × 6 = 1.5 ETH
        address carol = address(0xCAB0);
        vm.deal(carol, 10 ether);

        vm.prank(alice);
        market.buy{value: 3 ether}(0);
        vm.prank(bob);
        market.buy{value: 1 ether}(0);
        vm.prank(carol);
        market.buy{value: 2 ether}(1);

        bytes[] memory updates = _makePriceUpdate(13_000_000_000_000, -8);
        vm.warp(resolveTime);
        market.resolve{value: 1}(updates);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore   = bob.balance;

        vm.prank(alice);
        market.claim();
        vm.prank(bob);
        market.claim();

        assertEq(alice.balance - aliceBefore, 4.5 ether);
        assertEq(bob.balance   - bobBefore,   1.5 ether);
    }

    function test_claim_revertsForLoser() public {
        vm.prank(alice);
        market.buy{value: 1 ether}(1); // NO

        bytes[] memory updates = _makePriceUpdate(13_000_000_000_000, -8);
        vm.warp(resolveTime);
        market.resolve{value: 1}(updates); // YES wins

        vm.prank(alice);
        vm.expectRevert("No winning shares");
        market.claim();
    }

    function test_claim_revertsBeforeResolution() public {
        vm.prank(alice);
        market.buy{value: 1 ether}(0);

        vm.prank(alice);
        vm.expectRevert("Not resolved yet");
        market.claim();
    }

    function test_claim_cannotClaimTwice() public {
        vm.prank(alice);
        market.buy{value: 1 ether}(0);

        bytes[] memory updates = _makePriceUpdate(13_000_000_000_000, -8);
        vm.warp(resolveTime);
        market.resolve{value: 1}(updates);

        vm.prank(alice);
        market.claim();

        vm.prank(alice);
        vm.expectRevert("No winning shares");
        market.claim();
    }

    // ─── Reentrancy guard ────────────────────────────────────────────

    function test_claim_reentrancyGuard() public {
        // Attacker buys YES shares, then tries to re-enter claim()
        ReentrancyAttacker attacker = new ReentrancyAttacker(address(market));
        vm.deal(address(attacker), 10 ether);

        // Attacker buys via a helper because buy() is not the reentrant call
        vm.prank(address(attacker));
        market.buy{value: 1 ether}(0);

        // Bob also buys NO so there's a pool to steal
        vm.prank(bob);
        market.buy{value: 2 ether}(1);

        bytes[] memory updates = _makePriceUpdate(13_000_000_000_000, -8);
        vm.warp(resolveTime);
        market.resolve{value: 1}(updates);

        // ReentrancyGuard should prevent the second claim inside receive()
        vm.expectRevert();
        attacker.attack();
    }
}
