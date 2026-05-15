# Monamarket — Project Context for Claude

## What This Is

Polymarket-style prediction market dApp on Monad testnet. Users connect a wallet, browse open markets, and buy outcome shares with MON (native token). Markets resolve automatically via Pyth pull oracle — no admin intervention required. Anyone can create their own market with a refundable 0.1 MON deposit; the resolver earns a 0.5% bounty.

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
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

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
- Claim payout: `payout = userShares[user][winningOutcome] * effectivePool / poolBalances[winningOutcome]`
  - `effectivePool = totalPool - resolverBounty` (bounty deducted before payouts)
- TODO: upgrade to LMSR for v2

### Resolver Bounty

- `BOUNTY_BPS = 50` (0.5%), `MAX_BOUNTY = 1 ether`
- Computed in `resolve()`: `bounty = min(totalPool * BOUNTY_BPS / 10_000, MAX_BOUNTY)`
- Paid to `msg.sender` (the resolver) before any payout to winners
- Stored in `resolverBounty` state variable; subtracted in `claim()` via `effectivePool`
- Incentivises permissionless resolution — no keeper bot required

### Creator Deposit

- `CREATION_DEPOSIT = 0.1 ether` — required in `factory.createMarket()` and forwarded to the market
- Stored in `market.creationDeposit` (immutable), `market.creator` (immutable)
- Refunded to `creator` inside `resolve()` after the bounty transfer
- Admin and demo markets: `creator = address(0)`, `creationDeposit = 0` — no refund

### isDemo Markets

- `bool public immutable isDemo`
- If `true`: `resolve()` skips `require(block.timestamp >= resolveTime)`
- Pyth VAA window: `refTime = isDemo ? block.timestamp : resolveTime`
  - Guards against underflow: `windowStart = refTime >= 60 ? refTime - 60 : 0`
- Demo markets are created via `factory.createDemoMarket()` (owner-only)
- Useful for showcasing resolution flow without long-duration waits

### Feed Allowlist (MarketFactory v2)

```solidity
struct FeedInfo { bool supported; string name; address pythContract; }
mapping(bytes32 => FeedInfo) public feeds;
bytes32[] public feedIds; // enumerable
```

- Replaces the old per-market `pythOverride` parameter
- `addFeed(feedId, name, pythContract)` — owner-only; `address(0)` → uses `defaultPyth`
- `removeFeed(feedId)` — owner-only
- `getSupportedFeedIds()` — returns enumerable list for frontend dropdowns
- `createMarket()` validates `feeds[pythPriceFeedId].supported` — reverts if unknown feed

### Factory Entry Points

| Function | Caller | Deposit | isDemo |
|----------|--------|---------|--------|
| `createMarket()` | Anyone | 0.1 MON | false |
| `createAdminMarket()` | Owner only | 0 | false |
| `createDemoMarket()` | Owner only | 0 | true |

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
- Feed's Pyth contract address comes from `feeds[feedId].pythContract` in the factory

### Oracle Call in resolve()

```solidity
uint64 refTime = isDemo ? uint64(block.timestamp) : uint64(resolveTime);
uint64 windowStart = refTime >= 60 ? refTime - 60 : 0;  // underflow guard
pyth.parsePriceFeedUpdates{value: fee}(updateData, feedIds, windowStart, refTime + 3600)
```

### Timestamps (UTC)

| Market | closeTime | resolveTime |
|--------|-----------|-------------|
| BTC & ETH | `1782604800` (Jun 28, 2026) | `1782777600` (Jun 30, 2026) |
| MON | `1783900800` (Jul 13, 2026) | `1784073600` (Jul 15, 2026) |
| Demo markets | deployment + 30m/5h/23h | deployment + 1h/6h/24h |

### Frontend Multicall Slot Counts

| Component | READS_PER_MARKET | Fields |
|-----------|------------------|--------|
| MarketGridClient | 8 | question, getOutcomes, getPrices, getPoolBalances, timeRemaining, winningOutcome, isDemo, creator |
| PortfolioClient (positions) | 5 | question, getOutcomes, winningOutcome, getPoolBalances, getUserPosition |
| PortfolioClient (creator) | 5 | question, winningOutcome, getPoolBalances, isDemo, creationDeposit |
| MarketDetailClient | 12 | question, getOutcomes, getPrices, getPoolBalances, winningOutcome, timeRemaining, resolveTime, pythPriceFeedId, isDemo, creator, resolverBounty, creationDeposit |

When adding a new on-chain read to a component, increment the per-market constant and add the slice in the mapping.

### CREATION_DEPOSIT Constant

Exported from `app/lib/contracts.ts` as:
```typescript
export const CREATION_DEPOSIT = BigInt("100000000000000000"); // 0.1 MON in wei
```
This matches `MarketFactory.CREATION_DEPOSIT = 0.1 ether`. Pass as `value:` to `createMarket()` calls.

---

## Repo Structure

```
/contracts          ← Foundry
  /src
    PredictionMarket.sol   (bounty, isDemo, creator deposit)
    MarketFactory.sol      (feed allowlist, public/admin/demo create)
  /script
    Deploy.s.sol           (registers feeds, seeds 6 markets)
  /test
    PredictionMarket.t.sol (27 tests)
    MarketFactory.t.sol    (18 tests)
  foundry.toml
  remappings.txt

/app                ← Next.js 14
  /app
    layout.tsx             (NetworkGuard included here)
    page.tsx               (hero with Create CTA)
    create/page.tsx
    market/[address]/page.tsx
    portfolio/page.tsx
    about/page.tsx
    providers.tsx
  /components
    MarketGridClient.tsx   (8 reads/market including isDemo, creator)
    MarketCard.tsx         (Demo pill, Community badge)
    MarketDetailClient.tsx (12 reads/market, demo banner, bounty rows)
    BuyPanel.tsx           (FaucetPrompt integrated)
    BuySheet.tsx
    CreateMarketClient.tsx (5-step form)
    PortfolioClient.tsx    (Positions + My markets tabs)
    ResolveButton.tsx      (isDemo aware, bounty copy)
    NetworkGuard.tsx       (wrong-chain banner)
    FaucetPrompt.tsx       (low-balance CTA)
    OnboardingModal.tsx
    OnboardingTrigger.tsx
    ConnectWalletGate.tsx
    ui/Pill.tsx
  /lib
    wagmi.ts        ← Monad chain config (chainId 10143)
    pyth.ts         ← Hermes client helpers (main + beta)
    contracts.ts    ← ABIs + factory address + CREATION_DEPOSIT
    design-tokens.ts
  /abis             ← copied from contracts/out via export-abis.sh

.env.example
README.md
CLAUDE.md
.gitignore
```

---

## Hard Rules

1. **Never deploy** — write all code but stop short of `forge script --broadcast`. Print the commands.
2. **Never guess Pyth addresses** — always use the verified addresses above
3. **Testnet only** — no real funds, testnet banner on every page
4. **Foundry only** — never Hardhat
5. **Stub LMSR** with constant-product / parimutuel; add `// TODO: upgrade to LMSR` comment
6. **Plan → approve → build**
7. **Never introduce a keeper bot** — bounty mechanism incentivises human resolvers

## Out of Scope (V1)

- Order book / limit orders
- Protocol fees (add 2% in v2)
- CLOSEST_TO market creation UI (midpoint entry per band — currently auto-generated)
- Subgraph / indexer (read live from chain)
- Dispute periods or bonded proposals (Pyth price is ground truth)
