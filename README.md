# Monamarket

> ⚠️ **Testnet only — unaudited contracts — do not use with real funds.**

A Polymarket-style on-chain prediction market built on **Monad testnet**. Users connect a wallet, browse open markets, buy outcome shares with MON, and let a **Pyth pull oracle** settle the result — no admin intervention required for resolution. Anyone can create their own market with a refundable 0.1 MON deposit.

---

## Screenshots

| Homepage | Market Detail | Portfolio | Create |
|----------|--------------|-----------|--------|
| Hero + live stats strip + animated market grid | 60/40 layout — outcome bars, buy panel, market info | Positions + My markets tabs, one-click claim | 5-step market creation wizard |

---

## Features

- **Multi-outcome markets** — binary YES/NO or up to N price-band outcomes
- **User-created markets** — anyone can deploy a market with a 0.1 MON refundable deposit
- **Resolver bounty** — 0.5% of pool (max 1 MON) paid to whoever calls `resolve()` first
- **Demo markets** — `isDemo = true` skips the time-lock so markets can be resolved at any time
- **Parimutuel pricing** — `price[i] = pool[i] / totalPool`, updates in real time via Multicall3
- **Pyth pull oracle** — anyone can resolve by submitting a signed VAA from Hermes; no admin required
- **Feed allowlist** — factory enforces an allowlist of price feeds; each feed stores the Pyth contract to use
- **RainbowKit + Wagmi v2** — MetaMask, Coinbase Wallet, WalletConnect out of the box
- **Network guard** — wrong-chain detection with one-click switch to Monad testnet
- **Faucet prompt** — inline low-balance CTA pointing to faucet.monad.xyz
- **Batched on-chain reads** — all data in a single Multicall3 round-trip; 15 s poll on grid, 5 s on detail
- **Server Components** — homepage, portfolio, about, and market shell prerender as static HTML; only chain-read islands are client bundles
- **Mobile bottom sheet** — vaul drawer replaces inline panel on narrow viewports
- **Onboarding modal** — 3-slide first-visit guide with framer-motion, deferred via `requestIdleCallback`
- **Confetti on claim** — canvas-confetti fires dynamically only when a winning claim succeeds
- **Monad purple design system** — dark-mode only, Inter font, CSS design tokens, `scaleX` bar animations

---

## Deployed contracts (Monad testnet · chain 10143)

> These are the original v1 contracts. Deploy v2 with the new factory to get user-created markets and resolver bounties.

| Contract | Address |
|----------|---------|
| MarketFactory v1 | `0xB629D6EAF379A8484b5E669BFe35dCaF8017b852` |
| Market 1 — BTC/USD | `0x2b2892586573b1414DfDebB7A2DA70972e118749` |
| Market 2 — ETH/USD | `0xA407c17012a6242E3a8763D6915f6c6C97a5b0BA` |
| Market 3 — MON/USD | `0x91580C797b97523652B5722DD9B504972e9F8fc2` |

---

## Seeded markets (v2 deploy)

| # | Question | Oracle feed | Resolution type | Closes |
|---|----------|-------------|-----------------|--------|
| 1 | Will BTC be above $120,000 on June 30, 2026? | BTC/USD | `ABOVE_THRESHOLD` | Jun 28, 2026 |
| 2 | Will ETH be above $5,000 on June 30, 2026? | ETH/USD | `ABOVE_THRESHOLD` | Jun 28, 2026 |
| 3 | What will MON's price band be on July 15, 2026? | MON/USD (beta) | `CLOSEST_TO` | Jul 13, 2026 |
| 4 | Will BTC be above $120,000? [Demo - 1h] | BTC/USD | `ABOVE_THRESHOLD` | Demo |
| 5 | Will ETH be above $5,000? [Demo - 6h] | ETH/USD | `ABOVE_THRESHOLD` | Demo |
| 6 | What will MON's price band be? [Demo - 24h] | MON/USD (beta) | `CLOSEST_TO` | Demo |

---

## Stack

| Layer | Tech |
|-------|------|
| Smart contracts | Solidity ^0.8.20, Foundry, OpenZeppelin v5, pyth-sdk-solidity |
| Oracle | Pyth Network — Hermes client (main + beta), `parsePriceFeedUpdates` on-chain |
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Wallet | RainbowKit v2 + Wagmi v2 + Viem |
| Chain reads | Multicall3 — all reads batched per route |
| Animation | framer-motion (LazyMotion + domAnimation, code-split) |
| Mobile sheet | vaul drawer |
| Icons | lucide-react (tree-shaken) |
| Toasts | sonner |
| Confetti | canvas-confetti (dynamic import, claim-only) |

---

## Repo structure

```
Monamarket/
├── contracts/                     Foundry project
│   ├── src/
│   │   ├── PredictionMarket.sol       Core market logic (buy, resolve, claim, bounty)
│   │   └── MarketFactory.sol          Feed allowlist, public createMarket, demo/admin helpers
│   ├── script/
│   │   └── Deploy.s.sol               Deploys factory, registers feeds, seeds 6 markets
│   ├── test/
│   │   ├── PredictionMarket.t.sol     27 unit tests (buy, bounty, isDemo, resolution, claim)
│   │   └── MarketFactory.t.sol        18 unit tests (feeds, public create, demo, creator tracking)
│   ├── scripts/
│   │   └── export-abis.sh             Copies ABIs → app/abis/
│   └── foundry.toml
│
├── app/                           Next.js 14 frontend
│   ├── app/
│   │   ├── layout.tsx                 Root layout — testnet banner, nav, NetworkGuard
│   │   ├── page.tsx                   Homepage (Server Component) — hero + client island
│   │   ├── create/page.tsx            Create market — 5-step wizard
│   │   ├── about/page.tsx             Static explainer — how it works, contracts
│   │   ├── market/[address]/page.tsx  Market detail shell (Server Component)
│   │   └── portfolio/page.tsx         Portfolio shell (Server Component)
│   │
│   ├── components/
│   │   ├── MarketGridClient.tsx       Multicall grid — stats strip + market cards
│   │   ├── MarketCard.tsx             Outcome bars (scaleX), countdown, Demo/Community badges
│   │   ├── MarketDetailClient.tsx     60/40 detail — demo banner, bounty/deposit info
│   │   ├── BuyPanel.tsx               Buy/Position tabs, quick amounts, live preview, FaucetPrompt
│   │   ├── BuySheet.tsx               vaul bottom sheet for mobile buy flow
│   │   ├── CreateMarketClient.tsx     5-step market creation form
│   │   ├── PortfolioClient.tsx        Positions + My markets tabs
│   │   ├── ResolveButton.tsx          Fetches Pyth VAA, submits resolve(), shows bounty copy
│   │   ├── NetworkGuard.tsx           Wrong-chain banner with one-click switch
│   │   ├── FaucetPrompt.tsx           Low-balance faucet CTA
│   │   ├── OnboardingModal.tsx        3-slide first-visit guide (framer-motion)
│   │   ├── OnboardingTrigger.tsx      requestIdleCallback + localStorage gate
│   │   ├── ConnectWalletGate.tsx      Read-only wrapper for unconnected state
│   │   └── ui/
│   │       └── Pill.tsx               Shared pill atom (default/accent/success/danger)
│   │
│   └── lib/
│       ├── wagmi.ts                   Monad chain config (chainId 10143) + Multicall3
│       ├── pyth.ts                    Hermes main + beta client helpers
│       ├── contracts.ts               ABIs + factory address + CREATION_DEPOSIT constant
│       └── design-tokens.ts           Single source of truth for brand colors
│
├── .env.example
└── README.md
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| [Foundry](https://getfoundry.sh) | latest — run `foundryup` |
| [Node.js](https://nodejs.org) | 20+ |
| [pnpm](https://pnpm.io) | 9+ |

---

## Local setup

### 1. Clone and install Foundry deps

```bash
git clone https://github.com/GeekyKartikey/Monamarket
cd Monamarket/contracts
forge install
```

### 2. Build and test contracts

```bash
forge build
forge test -vv
# Expected: 45 tests passing (27 market + 18 factory)
```

### 3. Export ABIs to the frontend

```bash
# from repo root
bash contracts/scripts/export-abis.sh
```

### 4. Install frontend deps

```bash
cd app
pnpm install
```

### 5. Configure environment

```bash
# from repo root
cp .env.example app/.env.local
```

Open `app/.env.local` and fill in:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # free at cloud.walletconnect.com
NEXT_PUBLIC_FACTORY_ADDRESS=0xB629D6EAF379A8484b5E669BFe35dCaF8017b852
```

### 6. Run the frontend

```bash
cd app
pnpm dev
# → http://localhost:3000
```

---

## Deploy your own contracts

> The original v1 contracts are live at the addresses above. Follow this to deploy v2 with user-created markets and resolver bounties.

```bash
cd contracts
export PRIVATE_KEY=0x...   # testnet wallet only — never commit this

# Dry-run (simulates, no gas spent)
forge script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY

# Broadcast (real deploy)
forge script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast
```

Update `NEXT_PUBLIC_FACTORY_ADDRESS` in `app/.env.local` with the new MarketFactory address.

---

## How it works

### Share accounting (parimutuel)

```
buy(outcomeIndex) payable
  → userShares[msg.sender][outcomeIndex] += msg.value
  → poolBalances[outcomeIndex]           += msg.value

price[i] = poolBalances[i] * 1e18 / totalPool   // fraction of 1e18

claim()
  effectivePool = totalPool - resolverBounty
  payout = userShares[user][winner] * effectivePool / poolBalances[winner]
```

> LMSR market scoring is planned for v2.

### Resolver bounty

Anyone who calls `resolve()` earns a bounty from the pool:

```
bounty = min(totalPool * 0.5%, 1 MON)
effectivePool = totalPool - bounty   // winners share this reduced pool
```

The bounty is deducted before payouts so winners and losers each contribute proportionally. This incentivises permissionless resolution with no keeper bot required.

### Creator deposit

User-created markets require a **0.1 MON deposit** sent with `createMarket()`. The deposit is:
- Forwarded to the market contract at construction
- Refunded to the creator address when `resolve()` is called successfully
- Lost if the market is never resolved (incentive to design resolvable questions)

Admin and demo markets (deployed by the factory owner) have no deposit requirement.

### Demo markets

Markets created with `isDemo = true`:
- Skip the `resolveTime` time-lock — resolvable at any moment
- Use `block.timestamp` as the Pyth VAA window anchor, so a fresh price update is always valid
- Useful for testing resolution flow without waiting days/weeks

### Resolution flow

1. Anyone calls `resolve(pythUpdateData)` — after `resolveTime` for regular markets, anytime for demo markets
2. Contract calls `pyth.parsePriceFeedUpdates()` with a ±60 min window around the reference time
3. Price is normalised to expo = −8 (USD × 10⁸) and compared against stored thresholds
4. `winningOutcome` is set permanently; resolver bounty is paid; creator deposit is refunded
5. Winners call `claim()` to receive their proportional share of the effective pool

### Resolution types

| Type | Logic |
|------|-------|
| `ABOVE_THRESHOLD` | `price >= threshold` → outcome 0 (YES) wins |
| `BELOW_THRESHOLD` | `price < threshold` → outcome 0 (YES) wins |
| `CLOSEST_TO` | outcome whose midpoint threshold is nearest to the reported price wins |

### Creating a market (UI)

1. Click **+ Create** in the nav
2. Enter a question (min 10 chars), outcomes, price feed, resolution type, threshold, and timeline
3. Review the summary, confirm the 0.1 MON deposit in your wallet
4. Market goes live immediately — share the link to attract traders
5. After `resolveTime`, anyone can resolve and earn the bounty
6. Your 0.1 MON deposit is returned automatically on resolution

### Oracle addresses (Monad testnet)

| Contract | Address |
|----------|---------|
| Pyth (main) | `0x2880aB155794e7179c9eE2e38200202908C17B43` |
| Pyth (beta, MON/USD) | `0xad2B52D2af1a9bD5c561894Cdd84f7505e1CD0B5` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

---

## Deploy frontend to Vercel

```bash
cd app
vercel --prod
```

Set the environment variables from `.env.example` in the Vercel dashboard under **Settings → Environment Variables**.

---

## Routes

| Route | Render | Description |
|-------|--------|-------------|
| `/` | Static | Hero + market grid (client island) |
| `/create` | Static | 5-step market creation wizard |
| `/about` | Static | How it works, oracle mechanics, contracts |
| `/market/[address]` | Dynamic | Market detail — outcome bars, buy panel, resolve |
| `/portfolio` | Static | Wallet positions + created markets |

---

## Roadmap

- [ ] LMSR pricing (replaces parimutuel for better price discovery)
- [ ] Protocol fee (2%, v2)
- [ ] Subgraph / event indexer for trade history
- [ ] CLOSEST_TO market creation UI (midpoint entry per band)
- [ ] Mainnet deployment

---

## License

MIT
