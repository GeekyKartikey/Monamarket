"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";

const OnboardingModal = dynamic(
  () => import("@/components/OnboardingModal"),
  { ssr: false }
);

const STORAGE_KEY = "monamarket_onboarded_v1";

export function OnboardingTrigger() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const reveal = () => setShow(true);

    if ("requestIdleCallback" in window) {
      // Defer until browser is idle — don't compete with first paint
      const id = window.requestIdleCallback(reveal, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    } else {
      const id = setTimeout(reveal, 600);
      return () => clearTimeout(id);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && <OnboardingModal onDismiss={dismiss} />}
    </AnimatePresence>
  );
}
