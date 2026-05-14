# Monamarket

> ⚠️ **Testnet only — unaudited contracts — do not use with real funds.**

A Polymarket-style on-chain prediction market built on **Monad testnet**. Users connect a wallet, browse open markets, and buy outcome shares with MON (native token). Markets resolve automatically via the **Pyth pull oracle** — no admin intervention required.

---

## Screenshots

| Homepage | Market Detail | Portfolio |
|----------|--------------|-----------|
| Live market grid with outcome bars and countdowns | Outcome probability chart, buy panel, resolve button | User positions across all markets with claim flow |

---

## Features

- 🟣 **Multi-outcome markets** — binary YES/NO or up to N outcome bands
- 📈 **Parimutuel pricing** — `price[i] = pool[i] / totalPool`, updates in real time
- 🔮 **Pyth pull oracle** — anyone can resolve a market by submitting a signed VAA from Hermes
- 🦊 **RainbowKit + Wagmi** — MetaMask, Coinbase Wallet, and more out of the box
- ⚡ **Batched reads** — all on-chain data fetched in a single Multicall3 round-trip per page
- 🌑 **Dark-mode first** — Monad purple design system

---

## Deployed contracts (Monad testnet, chain 10143)

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
| Smart contracts | Solidity ^0.8.20, Foundry, OpenZeppelin v5 |
| Oracle | Pyth Network (`pyth-sdk-solidity`, Hermes client) |
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Wallet | RainbowKit v2 + Wagmi v2 + Viem |
| Chain reads | Multicall3 (`0xcA11bde...`) — all reads batched |

---

## Repo structure

```
Monamarket/
├── contracts/                  Foundry project
│   ├── src/
│   │   ├── PredictionMarket.sol    Core market logic
│   │   └── MarketFactory.sol       Owner-only factory
│   ├── script/
│   │   └── Deploy.s.sol            Seeds 3 markets on Monad testnet
│   ├── test/
│   │   ├── PredictionMarket.t.sol  24 unit tests
│   │   └── MarketFactory.t.sol
│   ├── scripts/
│   │   └── export-abis.sh          Copies ABIs → app/abis/
│   └── foundry.toml
│
├── app/                        Next.js 14 frontend
│   ├── app/
│   │   ├── page.tsx                Homepage — market grid
│   │   ├── market/[address]/       Market detail page
│   │   └── portfolio/              User positions + claim
│   ├── components/
│   │   ├── MarketCard.tsx          Outcome bars, countdown, pool size
│   │   ├── BuyPanel.tsx            Outcome selector, MON input, share preview
│   │   ├── ResolveButton.tsx       Fetches Pyth VAA, calls resolve()
│   │   └── ConnectWalletGate.tsx   Read-only wrapper for unconnected state
│   └── lib/
│       ├── wagmi.ts                Monad chain config + Multicall3
│       ├── pyth.ts                 Hermes main + beta client helpers
│       └── contracts.ts            ABIs + factory address
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
git clone https://github.com/<your-org>/Monamarket
cd Monamarket/contracts
forge install
```

### 2. Build and test contracts

```bash
forge build
forge test -vv
# Expected: 24/24 tests passing
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

All other values have working defaults.

### 6. Run the frontend

```bash
cd app
pnpm dev
# → http://localhost:3000
```

---

## Deploy your own contracts

> The contracts are already deployed at the addresses above. Only follow this if you want to redeploy.

```bash
cd contracts
export PRIVATE_KEY=0x...   # testnet wallet only — never commit this

# 1. Dry-run (simulates, no gas spent)
forge script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY

# 2. Broadcast (real deploy)
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

### Resolution flow

1. Anyone calls `resolve(pythUpdateData)` after `resolveTime`
2. Contract calls `pyth.parsePriceFeedUpdates()` with a ±60 s window around `resolveTime`
3. Price is normalized to expo = −8 (USD × 10^8) and compared against thresholds
4. `winningOutcome` is locked; winners can call `claim()`

### Resolution types

| Type | Logic |
|------|-------|
| `ABOVE_THRESHOLD` | `price >= threshold` → outcome 0 (YES) wins |
| `BELOW_THRESHOLD` | `price < threshold` → outcome 0 (YES) wins |
| `CLOSEST_TO` | outcome whose midpoint threshold is numerically closest to `price` wins |

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

## Contributing / roadmap

- [ ] LMSR pricing (replaces parimutuel)
- [ ] Protocol fee (2%)
- [ ] Market creation UI
- [ ] Subgraph / event indexer for bet history
- [ ] Mobile layout

---

## License

MIT
