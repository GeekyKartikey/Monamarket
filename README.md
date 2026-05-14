# Monamarket

> ⚠️ **Testnet only — unaudited contracts — do not use with real funds.**

A Polymarket-style on-chain prediction market built on **Monad testnet**. Users connect a wallet, browse open markets, buy outcome shares with MON, and let a **Pyth pull oracle** settle the result — no admin intervention required for resolution.

---

## Screenshots

| Homepage | Market Detail | Portfolio |
|----------|--------------|-----------|
| Hero + live stats strip + animated market grid | 60/40 layout — outcome bars, buy panel, market info | Summary cards + grouped positions + one-click claim |

---

## Features

- **Multi-outcome markets** — binary YES/NO or up to N price-band outcomes
- **Parimutuel pricing** — `price[i] = pool[i] / totalPool`, updates in real time via Multicall3
- **Pyth pull oracle** — anyone can resolve by submitting a signed VAA from Hermes; no admin required
- **RainbowKit + Wagmi v2** — MetaMask, Coinbase Wallet, WalletConnect out of the box
- **Batched on-chain reads** — all data in a single Multicall3 round-trip; 15 s poll on grid, 5 s on detail
- **Server Components** — homepage, portfolio, about, and market shell prerender as static HTML; only chain-read islands are client bundles
- **Mobile bottom sheet** — vaul drawer replaces inline panel on narrow viewports
- **Onboarding modal** — 3-slide first-visit guide with framer-motion, deferred via `requestIdleCallback`
- **Confetti on claim** — canvas-confetti fires dynamically only when a winning claim succeeds
- **Monad purple design system** — dark-mode only, Inter font, CSS design tokens, `scaleX` bar animations

---

## Deployed contracts (Monad testnet · chain 10143)

| Contract | Address |
|----------|---------|
| MarketFactory | `0xB629D6EAF379A8484b5E669BFe35dCaF8017b852` |
| Market 1 — BTC/USD | `0x2b2892586573b1414DfDebB7A2DA70972e118749` |
| Market 2 — ETH/USD | `0xA407c17012a6242E3a8763D6915f6c6C97a5b0BA` |
| Market 3 — MON/USD | `0x91580C797b97523652B5722DD9B504972e9F8fc2` |

---

## Seeded markets

| # | Question | Oracle feed | Resolution type | Closes |
|---|----------|-------------|-----------------|--------|
| 1 | Will BTC be above $120,000 on June 30, 2026? | BTC/USD | `ABOVE_THRESHOLD` | Jun 28, 2026 |
| 2 | Will ETH be above $5,000 on June 30, 2026? | ETH/USD | `ABOVE_THRESHOLD` | Jun 28, 2026 |
| 3 | What will MON's price band be on July 15, 2026? | MON/USD (beta) | `CLOSEST_TO` | Jul 13, 2026 |

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
│   │   ├── PredictionMarket.sol       Core market logic (buy, resolve, claim)
│   │   └── MarketFactory.sol          Owner-only factory; seeds 3 markets
│   ├── script/
│   │   └── Deploy.s.sol               Deploys factory + seeds BTC/ETH/MON markets
│   ├── test/
│   │   ├── PredictionMarket.t.sol     Unit tests (buy, parimutuel, resolution)
│   │   └── MarketFactory.t.sol
│   ├── scripts/
│   │   └── export-abis.sh             Copies ABIs → app/abis/
│   └── foundry.toml
│
├── app/                           Next.js 14 frontend
│   ├── app/
│   │   ├── layout.tsx                 Root layout — testnet banner, nav, footer
│   │   ├── page.tsx                   Homepage (Server Component) — hero + client island
│   │   ├── loading.tsx                Route-level Suspense skeleton
│   │   ├── about/page.tsx             Static explainer — how it works, contracts
│   │   ├── market/[address]/page.tsx  Market detail shell (Server Component)
│   │   └── portfolio/page.tsx         Portfolio shell (Server Component)
│   │
│   ├── components/
│   │   ├── MarketGridClient.tsx       Multicall grid — stats strip + market cards
│   │   ├── MarketCard.tsx             Outcome bars (scaleX), countdown, pool size
│   │   ├── MarketDetailClient.tsx     60/40 detail layout — bars, info card, panel
│   │   ├── BuyPanel.tsx               Buy/Position tabs, quick amounts, live preview
│   │   ├── BuySheet.tsx               vaul bottom sheet for mobile buy flow
│   │   ├── PortfolioClient.tsx        Batched multicall — stat cards, grouped positions
│   │   ├── ResolveButton.tsx          Fetches Pyth VAA, submits resolve()
│   │   ├── OnboardingModal.tsx        3-slide first-visit guide (framer-motion)
│   │   ├── OnboardingTrigger.tsx      requestIdleCallback + localStorage gate
│   │   ├── ConnectWalletGate.tsx      Read-only wrapper for unconnected state
│   │   └── ui/
│   │       └── Pill.tsx               Shared pill atom (default/accent/success/danger)
│   │
│   └── lib/
│       ├── wagmi.ts                   Monad chain config (chainId 10143) + Multicall3
│       ├── pyth.ts                    Hermes main + beta client helpers
│       ├── contracts.ts               ABIs + factory address constant
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
# Expected: all tests passing
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

> The contracts are already live at the addresses above. Only follow this section to redeploy.

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
  → payout = userShares[user][winner] * totalPool / poolBalances[winner]
```

> LMSR market scoring is planned for v2.

### Resolution flow

1. Anyone calls `resolve(pythUpdateData)` after `resolveTime`
2. Contract calls `pyth.parsePriceFeedUpdates()` with a ±60 min window around `resolveTime`
3. Price is normalised to expo = −8 (USD × 10⁸) and compared against stored thresholds
4. `winningOutcome` is set permanently; winners call `claim()`

### Resolution types

| Type | Logic |
|------|-------|
| `ABOVE_THRESHOLD` | `price >= threshold` → outcome 0 (YES) wins |
| `BELOW_THRESHOLD` | `price < threshold` → outcome 0 (YES) wins |
| `CLOSEST_TO` | outcome whose midpoint threshold is nearest to the reported price wins |

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
| `/about` | Static | How it works, oracle mechanics, contracts |
| `/market/[address]` | Dynamic | Market detail — outcome bars, buy panel, resolve |
| `/portfolio` | Static | Wallet positions — grouped by status, claim flow |

---

## Roadmap

- [ ] LMSR pricing (replaces parimutuel for better price discovery)
- [ ] Protocol fee (2%, v2)
- [ ] Market creation UI (factory is currently owner-only)
- [ ] Subgraph / event indexer for trade history
- [ ] Mainnet deployment

---

## License

MIT
