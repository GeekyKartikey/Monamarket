# Monamarket — Project Context for Claude

## What This Is

Polymarket-style prediction market dApp on Monad testnet. Users connect a wallet, browse open markets, and buy outcome shares with MON (native token). Markets resolve automatically via Pyth pull oracle — no admin intervention for seeded markets.

---

## Network

| Key | Value |
|-----|-------|
| Chain | Monad testnet |
| Chain ID | 10143 |
| Native token | MON |
| RPC | `https://testnet-rpc.monad.xyz` |
| Pyth Hermes (main) | `https://hermes.pyth.network` |
| Pyth Hermes (beta, MON/USD) | `https://hermes-beta.pyth.network` |

---

## Critical Addresses (do not guess — verified from docs.monad.xyz)

| Contract | Address |
|----------|---------|
| Pyth (main) | `0x2880aB155794e7179c9eE2e38200202908C17B43` |
| Pyth (beta, for MON/USD) | `0xad2B52D2af1a9bD5c561894Cdd84f7505e1CD0B5` |

## Pyth Price Feed IDs

| Feed | ID |
|------|----|
| BTC/USD | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |
| ETH/USD | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| MON/USD (beta) | `0xe786153cc54abd4b0e53b4c246d54d9f8eb3f3b5a34d4fc5a2e9a423b0ba5d6b` |

---

## Stack

| Layer | Tech |
|-------|------|
| Smart contracts | Solidity ^0.8.20, Foundry, OpenZeppelin v5, pyth-sdk-solidity |
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Wallet | RainbowKit + Wagmi + Viem |
| Oracle (off-chain) | @pythnetwork/hermes-client |
| Deploy | Vercel |

---

## Architecture Decisions

### Share Accounting (Parimutuel, v1)

- `buy(outcomeIndex)` payable: `userShares[user][outcome] += msg.value`, `poolBalances[outcome] += msg.value`
- Price display: `price[i] = poolBalances[i] * 1e18 / totalPool` (fraction of 1e18, equal-split when pool is 0)
- Claim payout: `payout = userShares[user][winningOutcome] * totalPool / poolBalances[winningOutcome]`
- TODO: upgrade to LMSR for v2

### Outcome Encoding

- `string[] outcomes` — 2 to N strings, e.g. `["YES","NO"]` or `["< $0.50","$0.50–$1.00","$1.00–$2.00","> $2.00"]`
- `int8 winningOutcome` — -1 until resolved, then 0..N-1

### Threshold Encoding

All thresholds stored in Pyth-native scale normalized to expo = -8 (multiply USD by 1e8):

| Market | USD | Stored int64 |
|--------|-----|--------------|
| BTC YES | $120,000 | `12_000_000_000_000` |
| ETH YES | $5,000 | `500_000_000_000` |
| MON < $0.50 midpoint | $0.25 | `25_000_000` |
| MON $0.50–$1.00 midpoint | $0.75 | `75_000_000` |
| MON $1.00–$2.00 midpoint | $1.50 | `150_000_000` |
| MON > $2.00 midpoint | $3.00 | `300_000_000` |

### ResolutionType

```
enum ResolutionType { ABOVE_THRESHOLD, BELOW_THRESHOLD, CLOSEST_TO }
```

- Binary markets use `int64[] thresholds` of length 1
- CLOSEST_TO markets use length N (one midpoint per outcome)
- `MarketFactory.createMarket` accepts an optional `pythOverride` address (defaults to factory's pyth if `address(0)`) — needed so market 3 (MON/USD) can use the beta Pyth contract

### Oracle Call in resolve()

Uses `pyth.parsePriceFeedUpdates{value: fee}(updateData, feedIds, resolveTime - 60, resolveTime + 3600)` so the caller can prove a price published near `resolveTime` even if they call resolve() hours later.

### Timestamps (UTC)

| Market | closeTime | resolveTime |
|--------|-----------|-------------|
| BTC & ETH | `1782604800` (Jun 28, 2026) | `1782777600` (Jun 30, 2026) |
| MON | `1783900800` (Jul 13, 2026) | `1784073600` (Jul 15, 2026) |

---

## Repo Structure

```
/contracts          ← Foundry
  /src
    PredictionMarket.sol
    MarketFactory.sol
  /script
    Deploy.s.sol
  /test
    PredictionMarket.t.sol
    MarketFactory.t.sol
  foundry.toml
  remappings.txt

/app                ← Next.js 14
  /app
    layout.tsx
    page.tsx
    market/[address]/page.tsx
    portfolio/page.tsx
    providers.tsx
  /components
    MarketCard.tsx
    BuyPanel.tsx
    ResolveButton.tsx
    ConnectWalletGate.tsx
  /lib
    wagmi.ts        ← Monad chain config (chainId 10143)
    pyth.ts         ← Hermes client helpers (main + beta)
    contracts.ts    ← ABIs + factory address
  /abis             ← copied from contracts/out via post-build script

.env.example
README.md
.gitignore
```

---

## Hard Rules

1. **Never deploy** — write all code but stop short of `forge script --broadcast`
2. **Never guess Pyth addresses** — always use the verified addresses above
3. **Testnet only** — no real funds, testnet banner on every page
4. **Foundry only** — never Hardhat
5. **Stub LMSR** with constant-product / parimutuel; add `// TODO: upgrade to LMSR` comment
6. **Plan → approve → build**

## Out of Scope (V1)

- Order book / limit orders
- Protocol fees (add 2% in v2)
- Market creation UI (factory.createMarket is onlyOwner; deploy via script)
- Subgraph / indexer (read live from chain)
- Mobile-specific layouts (responsive desktop-first)
