// Server Component — hero HTML renders instantly; chain reads stay in the client island
import Link from "next/link";
import { MarketGridClient } from "@/components/MarketGridClient";
import { OnboardingTrigger } from "@/components/OnboardingTrigger";
import { Pill } from "@/components/ui/Pill";

function Hero() {
  return (
    <div className="relative py-16 sm:py-20 text-center space-y-6 overflow-hidden">
      {/* Radial purple glow — CSS gradient, no image */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(131,110,249,0.15), transparent)",
        }}
      />

      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
        Predict anything.{" "}
        <span style={{ color: "var(--accent)" }}>On-chain.</span>
      </h1>

      <p className="text-base sm:text-lg text-txt-secondary max-w-lg mx-auto px-4">
        Buy YES or NO shares with MON. Markets resolve automatically via Pyth
        oracle — no middleman.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Pill>On Monad testnet</Pill>
        <Pill>Pyth-resolved</Pill>
        <Pill
          variant="accent"
          href="https://github.com/GeekyKartikey/Monamarket"
        >
          Open source ↗
        </Pill>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        <Link
          href="/create"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "var(--accent)" }}
        >
          + Create a market
        </Link>
        <Link
          href="/about"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            color: "var(--text-secondary)",
            background: "var(--surface-2)",
            border: "1px solid var(--monad-border)",
          }}
        >
          How it works
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-12">
      <Hero />
      {/* Client island — all wagmi reads live here, hero above is already painted */}
      <MarketGridClient />
      {/* Deferred first-visit guide — dynamic import, fires on idle */}
      <OnboardingTrigger />
    </div>
  );
}
