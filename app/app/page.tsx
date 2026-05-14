// Server Component — hero HTML renders instantly; chain reads stay in the client island
import { MarketGridClient } from "@/components/MarketGridClient";
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
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-12">
      <Hero />
      {/* Client island — all wagmi reads live here, hero above is already painted */}
      <MarketGridClient />
    </div>
  );
}
