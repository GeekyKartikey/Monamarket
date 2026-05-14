// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";
import "../src/PredictionMarket.sol";

/// @notice Deploys MarketFactory v2, registers price feeds, seeds long-duration
/// admin markets (BTC/ETH/MON) and short-duration demo markets.
///
/// Dry-run (no gas spent):
///   forge script script/Deploy.s.sol \
///     --rpc-url https://testnet-rpc.monad.xyz \
///     --private-key $PRIVATE_KEY
///
/// Broadcast (real deploy — requires explicit approval):
///   forge script script/Deploy.s.sol \
///     --rpc-url https://testnet-rpc.monad.xyz \
///     --private-key $PRIVATE_KEY \
///     --broadcast
contract Deploy is Script {
    // ─── Pyth contracts on Monad testnet ──────────────────────────────
    address constant PYTH_MAIN = 0x2880aB155794e7179c9eE2e38200202908C17B43;
    address constant PYTH_BETA = 0xad2B52D2af1a9bD5c561894Cdd84f7505e1CD0B5;

    // ─── Price feed IDs ────────────────────────────────────────────────
    bytes32 constant BTC_USD_FEED =
        0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    bytes32 constant ETH_USD_FEED =
        0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    // MON/USD — beta feed; must use PYTH_BETA contract + hermes-beta.pyth.network
    bytes32 constant MON_USD_FEED =
        0xe786153cc54abd4b0e53b4c246d54d9f8eb3f3b5a34d4fc5a2e9a423b0ba5d6b;

    // ─── Long-duration market timestamps (UTC) ─────────────────────────
    // BTC & ETH: close Jun 28 2026 00:00 UTC, resolve Jun 30 2026 00:00 UTC
    uint256 constant BTC_ETH_CLOSE   = 1782604800;
    uint256 constant BTC_ETH_RESOLVE = 1782777600;
    // MON: close Jul 13 2026 00:00 UTC, resolve Jul 15 2026 00:00 UTC
    uint256 constant MON_CLOSE   = 1783900800;
    uint256 constant MON_RESOLVE = 1784073600;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // ── 1. Deploy factory ─────────────────────────────────────────
        MarketFactory factory = new MarketFactory(PYTH_MAIN, deployer);
        console2.log("MarketFactory:", address(factory));

        // ── 2. Register price feeds ────────────────────────────────────
        // address(0) for pythContract → factory uses defaultPyth (PYTH_MAIN)
        factory.addFeed(BTC_USD_FEED, "BTC/USD", address(0));
        factory.addFeed(ETH_USD_FEED, "ETH/USD", address(0));
        factory.addFeed(MON_USD_FEED, "MON/USD", PYTH_BETA); // beta contract

        console2.log("Feeds registered: BTC/USD, ETH/USD, MON/USD");

        // ── 3. Long-duration admin markets ────────────────────────────

        // Market 1: BTC/USD binary — "Will BTC be above $120,000 on June 30, 2026?"
        {
            string[] memory outcomes = new string[](2);
            outcomes[0] = "YES";
            outcomes[1] = "NO";
            int64[] memory thresholds = new int64[](1);
            thresholds[0] = 12_000_000_000_000; // $120,000 × 1e8

            address m = factory.createAdminMarket(
                "Will BTC be above $120,000 on June 30, 2026?",
                outcomes, BTC_ETH_CLOSE, BTC_ETH_RESOLVE,
                BTC_USD_FEED, thresholds,
                PredictionMarket.ResolutionType.ABOVE_THRESHOLD
            );
            console2.log("Market 1 (BTC/USD long):", m);
        }

        // Market 2: ETH/USD binary — "Will ETH be above $5,000 on June 30, 2026?"
        {
            string[] memory outcomes = new string[](2);
            outcomes[0] = "YES";
            outcomes[1] = "NO";
            int64[] memory thresholds = new int64[](1);
            thresholds[0] = 500_000_000_000; // $5,000 × 1e8

            address m = factory.createAdminMarket(
                "Will ETH be above $5,000 on June 30, 2026?",
                outcomes, BTC_ETH_CLOSE, BTC_ETH_RESOLVE,
                ETH_USD_FEED, thresholds,
                PredictionMarket.ResolutionType.ABOVE_THRESHOLD
            );
            console2.log("Market 2 (ETH/USD long):", m);
        }

        // Market 3: MON/USD CLOSEST_TO — "What will MON's price band be on July 15, 2026?"
        {
            string[] memory outcomes = new string[](4);
            outcomes[0] = "< $0.50";
            outcomes[1] = unicode"$0.50 – $1.00";
            outcomes[2] = unicode"$1.00 – $2.00";
            outcomes[3] = "> $2.00";
            int64[] memory thresholds = new int64[](4);
            thresholds[0] = 25_000_000;  // $0.25
            thresholds[1] = 75_000_000;  // $0.75
            thresholds[2] = 150_000_000; // $1.50
            thresholds[3] = 300_000_000; // $3.00

            address m = factory.createAdminMarket(
                "What will MON's price band be on July 15, 2026?",
                outcomes, MON_CLOSE, MON_RESOLVE,
                MON_USD_FEED, thresholds,
                PredictionMarket.ResolutionType.CLOSEST_TO
            );
            console2.log("Market 3 (MON/USD long):", m);
        }

        // ── 4. Short-duration demo markets (isDemo = true) ────────────
        // These markets skip the time-lock so anyone can resolve them immediately.
        // The Pyth VAA window is anchored to block.timestamp, so a fresh price
        // update always validates regardless of when resolve() is called.

        uint256 now_ = block.timestamp;

        // Demo 1: BTC/USD 1-hour market
        {
            string[] memory outcomes = new string[](2);
            outcomes[0] = "YES";
            outcomes[1] = "NO";
            int64[] memory thresholds = new int64[](1);
            thresholds[0] = 12_000_000_000_000; // $120,000 × 1e8

            address m = factory.createDemoMarket(
                "Will BTC be above $120,000? [Demo - 1h]",
                outcomes,
                now_ + 30 minutes, // close after 30 min
                now_ + 1 hours,    // resolve after 1 h (ignored by isDemo)
                BTC_USD_FEED, thresholds,
                PredictionMarket.ResolutionType.ABOVE_THRESHOLD
            );
            console2.log("Demo 1 (BTC/USD 1h):", m);
        }

        // Demo 2: ETH/USD 6-hour market
        {
            string[] memory outcomes = new string[](2);
            outcomes[0] = "YES";
            outcomes[1] = "NO";
            int64[] memory thresholds = new int64[](1);
            thresholds[0] = 500_000_000_000; // $5,000 × 1e8

            address m = factory.createDemoMarket(
                "Will ETH be above $5,000? [Demo - 6h]",
                outcomes,
                now_ + 5 hours,
                now_ + 6 hours,
                ETH_USD_FEED, thresholds,
                PredictionMarket.ResolutionType.ABOVE_THRESHOLD
            );
            console2.log("Demo 2 (ETH/USD 6h):", m);
        }

        // Demo 3: MON/USD 24-hour CLOSEST_TO
        {
            string[] memory outcomes = new string[](4);
            outcomes[0] = "< $0.50";
            outcomes[1] = unicode"$0.50 – $1.00";
            outcomes[2] = unicode"$1.00 – $2.00";
            outcomes[3] = "> $2.00";
            int64[] memory thresholds = new int64[](4);
            thresholds[0] = 25_000_000;
            thresholds[1] = 75_000_000;
            thresholds[2] = 150_000_000;
            thresholds[3] = 300_000_000;

            address m = factory.createDemoMarket(
                "What will MON's price band be? [Demo - 24h]",
                outcomes,
                now_ + 23 hours,
                now_ + 24 hours,
                MON_USD_FEED, thresholds,
                PredictionMarket.ResolutionType.CLOSEST_TO
            );
            console2.log("Demo 3 (MON/USD 24h):", m);
        }

        vm.stopBroadcast();

        console2.log("---");
        console2.log("Deployment complete. Update NEXT_PUBLIC_FACTORY_ADDRESS in app/.env.local");
        console2.log("Factory address:", address(factory));
    }
}
