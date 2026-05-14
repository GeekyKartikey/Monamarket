// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";
import "../src/PredictionMarket.sol";

/// @notice Deploys MarketFactory and seeds 3 prediction markets on Monad testnet.
/// DO NOT broadcast until you are ready to deploy to testnet.
/// Run with:
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
    // MON/USD is a beta feed — must use PYTH_BETA contract + hermes-beta endpoint
    bytes32 constant MON_USD_FEED =
        0xe786153cc54abd4b0e53b4c246d54d9f8eb3f3b5a34d4fc5a2e9a423b0ba5d6b;

    // ─── Market timestamps (UTC) ───────────────────────────────────────
    // BTC & ETH: closeTime = Jun 28 2026 00:00 UTC, resolveTime = Jun 30 2026 00:00 UTC
    uint256 constant BTC_ETH_CLOSE   = 1782604800;
    uint256 constant BTC_ETH_RESOLVE = 1782777600;
    // MON:        closeTime = Jul 13 2026 00:00 UTC, resolveTime = Jul 15 2026 00:00 UTC
    uint256 constant MON_CLOSE   = 1783900800;
    uint256 constant MON_RESOLVE = 1784073600;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // ── Deploy factory ───────────────────────────────────────────
        MarketFactory factory = new MarketFactory(PYTH_MAIN, deployer);
        console2.log("MarketFactory:", address(factory));

        // ── Market 1: BTC/USD binary ─────────────────────────────────
        // "Will BTC be above $120,000 on June 30, 2026?"
        {
            string[] memory outcomes = new string[](2);
            outcomes[0] = "YES";
            outcomes[1] = "NO";

            int64[] memory thresholds = new int64[](1);
            thresholds[0] = 12_000_000_000_000; // $120,000 × 1e8

            address m = factory.createMarket(
                "Will BTC be above $120,000 on June 30, 2026?",
                outcomes,
                BTC_ETH_CLOSE,
                BTC_ETH_RESOLVE,
                BTC_USD_FEED,
                thresholds,
                PredictionMarket.ResolutionType.ABOVE_THRESHOLD,
                address(0) // use PYTH_MAIN
            );
            console2.log("Market 1 (BTC/USD):", m);
        }

        // ── Market 2: ETH/USD binary ─────────────────────────────────
        // "Will ETH be above $5,000 on June 30, 2026?"
        {
            string[] memory outcomes = new string[](2);
            outcomes[0] = "YES";
            outcomes[1] = "NO";

            int64[] memory thresholds = new int64[](1);
            thresholds[0] = 500_000_000_000; // $5,000 × 1e8

            address m = factory.createMarket(
                "Will ETH be above $5,000 on June 30, 2026?",
                outcomes,
                BTC_ETH_CLOSE,
                BTC_ETH_RESOLVE,
                ETH_USD_FEED,
                thresholds,
                PredictionMarket.ResolutionType.ABOVE_THRESHOLD,
                address(0) // use PYTH_MAIN
            );
            console2.log("Market 2 (ETH/USD):", m);
        }

        // ── Market 3: MON/USD multi-outcome CLOSEST_TO ───────────────
        // "What will MON's price band be on July 15, 2026?"
        // Uses PYTH_BETA + hermes-beta.pyth.network for VAA fetching
        {
            string[] memory outcomes = new string[](4);
            outcomes[0] = "< $0.50";
            outcomes[1] = unicode"$0.50 – $1.00";
            outcomes[2] = unicode"$1.00 – $2.00";
            outcomes[3] = "> $2.00";

            // Band midpoints as thresholds, all in units of USD × 1e8
            int64[] memory thresholds = new int64[](4);
            thresholds[0] = 25_000_000;  // $0.25
            thresholds[1] = 75_000_000;  // $0.75
            thresholds[2] = 150_000_000; // $1.50
            thresholds[3] = 300_000_000; // $3.00

            address m = factory.createMarket(
                "What will MON's price band be on July 15, 2026?",
                outcomes,
                MON_CLOSE,
                MON_RESOLVE,
                MON_USD_FEED,
                thresholds,
                PredictionMarket.ResolutionType.CLOSEST_TO,
                PYTH_BETA // beta Pyth contract for MON/USD feed
            );
            console2.log("Market 3 (MON/USD):", m);
        }

        vm.stopBroadcast();
    }
}
