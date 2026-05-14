"use client";

import { useEffect, useState } from "react";
import {
  LazyMotion,
  domAnimation,
  m,
  AnimatePresence,
} from "framer-motion";
import { X, TrendingUp, BarChart3, Zap } from "lucide-react";

const SLIDES = [
  {
    icon: <TrendingUp size={32} />,
    title: "Predict the future.",
    body: "Monamarket lets you bet on crypto asset prices using MON on Monad testnet. Pick an outcome and buy shares.",
  },
  {
    icon: <BarChart3 size={32} />,
    title: "Parimutuel markets.",
    body: "Your deposit becomes your shares. If your outcome wins, you split the total pool proportionally. No order book — just you vs. the crowd.",
  },
  {
    icon: <Zap size={32} />,
    title: "Oracle-settled.",
    body: "Markets resolve automatically via Pyth price feeds. No admin keys, no gatekeeping — anyone can call resolve() with a cryptographic proof.",
  },
] as const;

interface Props {
  onDismiss: () => void;
}

export default function OnboardingModal({ onDismiss }: Props) {
  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState(1);

  const isLast = slide === SLIDES.length - 1;

  // Escape key dismisses
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  function goNext() {
    if (isLast) { onDismiss(); return; }
    setDir(1);
    setSlide((s) => s + 1);
  }

  function goPrev() {
    setDir(-1);
    setSlide((s) => s - 1);
  }

  function goTo(i: number) {
    setDir(i > slide ? 1 : -1);
    setSlide(i);
  }

  return (
    <LazyMotion features={domAnimation}>
      {/* Backdrop */}
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.72)" }}
        onClick={onDismiss}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Monamarket"
      >
        {/* Card */}
        <m.div
          initial={{ scale: 0.94, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 8 }}
          transition={{ type: "spring", damping: 22, stiffness: 320 }}
          className="relative w-full max-w-sm rounded-2xl p-6"
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(131,110,249,0.25)",
            boxShadow: "var(--shadow-panel)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onDismiss}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-lg transition-colors hover:bg-surface-2"
            aria-label="Close welcome guide"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={16} />
          </button>

          {/* Slides */}
          <div style={{ minHeight: "200px", overflow: "hidden" }}>
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={slide}
                initial={{ x: dir * 56, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: dir * -56, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="space-y-4"
              >
                {/* Icon badge */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "rgba(131,110,249,0.12)",
                    color: "var(--accent)",
                    border: "1px solid rgba(131,110,249,0.2)",
                  }}
                >
                  {SLIDES[slide].icon}
                </div>

                <h2 className="text-xl font-bold text-txt-primary leading-snug">
                  {SLIDES[slide].title}
                </h2>

                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {SLIDES[slide].body}
                </p>
              </m.div>
            </AnimatePresence>
          </div>

          {/* Footer: dots + buttons */}
          <div className="flex items-center justify-between mt-6 gap-4">
            {/* Progress dots */}
            <div className="flex gap-1.5 items-center">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i === slide ? "18px" : "6px",
                    height: "6px",
                    background:
                      i === slide
                        ? "var(--accent)"
                        : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>

            {/* Nav buttons */}
            <div className="flex gap-2 shrink-0">
              {slide > 0 && (
                <button
                  onClick={goPrev}
                  className="px-3 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-muted)",
                    border: "1px solid var(--monad-border)",
                  }}
                >
                  Back
                </button>
              )}
              <button
                onClick={goNext}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: "var(--accent)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--accent)";
                }}
              >
                {isLast ? "Get started" : "Next"}
              </button>
            </div>
          </div>
        </m.div>
      </m.div>
    </LazyMotion>
  );
}
