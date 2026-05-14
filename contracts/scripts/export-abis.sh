#!/usr/bin/env bash
# Copies compiled contract artifacts from Foundry out/ into app/abis/.
# Run from repo root: bash contracts/scripts/export-abis.sh
# Or from app/: pnpm run export-abis

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../out"
ABI_DIR="$SCRIPT_DIR/../../app/abis"

mkdir -p "$ABI_DIR"

cp "$OUT_DIR/PredictionMarket.sol/PredictionMarket.json" "$ABI_DIR/PredictionMarket.json"
cp "$OUT_DIR/MarketFactory.sol/MarketFactory.json"       "$ABI_DIR/MarketFactory.json"

echo "ABIs exported to $ABI_DIR"
