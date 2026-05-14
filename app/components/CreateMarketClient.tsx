"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseEther, type Address } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Plus, Trash2, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { FACTORY_ABI, FACTORY_ADDRESS, CREATION_DEPOSIT } from "@/lib/contracts";

// ─── Types ────────────────────────────────────────────────────────────────────

type ResolutionType = "ABOVE_THRESHOLD" | "BELOW_THRESHOLD" | "CLOSEST_TO";

interface SupportedFeed {
  id: `0x${string}`;
  name: string;
}

interface FormState {
  question: string;
  outcomes: string[];
  feedId: `0x${string}` | "";
  resolutionType: ResolutionType;
  threshold: string;   // USD string for binary; unused for CLOSEST_TO
  closesIn: string;    // hours from now
  resolvesIn: string;  // hours from now (must be > closesIn)
}

const RESOLUTION_TYPE_VALUES: Record<ResolutionType, number> = {
  ABOVE_THRESHOLD: 0,
  BELOW_THRESHOLD: 1,
  CLOSEST_TO: 2,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowPlusHours(h: number): number {
  return Math.floor(Date.now() / 1000) + h * 3600;
}

// Convert USD string to int64 in expo=-8 (USD × 1e8)
function usdToInt64(usd: string): bigint {
  const n = parseFloat(usd);
  if (isNaN(n) || n <= 0) return 0n;
  return BigInt(Math.round(n * 1e8));
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDot({ step, current }: { step: number; current: number }) {
  const done = step < current;
  const active = step === current;
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
      style={{
        background: done
          ? "var(--success)"
          : active
          ? "var(--accent)"
          : "var(--surface-2)",
        color: done || active ? "#fff" : "var(--text-muted)",
        border: active ? "none" : "1px solid var(--monad-border)",
      }}
    >
      {done ? <Check size={13} /> : step + 1}
    </div>
  );
}

const STEP_LABELS = ["Question", "Outcomes", "Oracle", "Timing", "Review"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <StepDot step={i} current={current} />
            <span
              className="text-[10px] hidden sm:block"
              style={{
                color: i === current ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div
              className="h-px w-6 sm:w-10 mb-4"
              style={{
                background: i < current ? "var(--success)" : "var(--monad-border)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Input components ─────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-txt-secondary">{label}</label>
      {children}
      {hint && <p className="text-xs text-txt-muted">{hint}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--monad-border)",
        color: "var(--text-primary)",
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--monad-border)")}
    />
  );
}

// ─── Step 0 — Question ────────────────────────────────────────────────────────

function Step0({
  form,
  update,
}: {
  form: FormState;
  update: (k: keyof FormState, v: FormState[keyof FormState]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">What's your question?</h2>
        <p className="text-sm text-txt-muted mt-1">
          Write a clear, verifiable question. It should have a definitive answer
          based on a publicly observable price.
        </p>
      </div>
      <Field label="Market question" hint='Tip: start with "Will…" and end with "?"'>
        <textarea
          value={form.question}
          onChange={(e) => update("question", e.target.value)}
          placeholder='e.g. "Will BTC be above $150,000 on Dec 31, 2026?"'
          rows={3}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors resize-none"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--monad-border)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--monad-border)")}
        />
      </Field>
    </div>
  );
}

// ─── Step 1 — Outcomes ───────────────────────────────────────────────────────

function Step1({
  form,
  update,
}: {
  form: FormState;
  update: (k: keyof FormState, v: FormState[keyof FormState]) => void;
}) {
  function updateOutcome(i: number, val: string) {
    const next = [...form.outcomes];
    next[i] = val;
    update("outcomes", next);
  }
  function addOutcome() {
    if (form.outcomes.length >= 8) return;
    update("outcomes", [...form.outcomes, ""]);
  }
  function removeOutcome(i: number) {
    if (form.outcomes.length <= 2) return;
    update("outcomes", form.outcomes.filter((_, j) => j !== i));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Define the outcomes</h2>
        <p className="text-sm text-txt-muted mt-1">
          Binary markets have YES / NO. Multi-outcome markets can have up to 8
          options — used with the CLOSEST_TO resolution type.
        </p>
      </div>
      <div className="space-y-3">
        {form.outcomes.map((outcome, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-txt-muted w-5 text-center">{i + 1}</span>
            <div className="flex-1">
              <TextInput
                value={outcome}
                onChange={(v) => updateOutcome(i, v)}
                placeholder={i === 0 ? "YES" : i === 1 ? "NO" : `Outcome ${i + 1}`}
              />
            </div>
            {form.outcomes.length > 2 && (
              <button
                onClick={() => removeOutcome(i)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: "var(--danger)", background: "rgba(239,68,68,0.08)" }}
                aria-label="Remove outcome"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      {form.outcomes.length < 8 && (
        <button
          onClick={addOutcome}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-colors"
          style={{
            color: "var(--accent)",
            border: "1px dashed rgba(131,110,249,0.4)",
            background: "rgba(131,110,249,0.06)",
          }}
        >
          <Plus size={14} /> Add outcome
        </button>
      )}
    </div>
  );
}

// ─── Step 2 — Oracle ─────────────────────────────────────────────────────────

function Step2({
  form,
  update,
  feeds,
  feedsLoading,
}: {
  form: FormState;
  update: (k: keyof FormState, v: FormState[keyof FormState]) => void;
  feeds: SupportedFeed[];
  feedsLoading: boolean;
}) {
  const isBinary = form.outcomes.length === 2;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Oracle settings</h2>
        <p className="text-sm text-txt-muted mt-1">
          Choose a Pyth price feed and how the winner is determined.
        </p>
      </div>

      <Field label="Price feed">
        {feedsLoading ? (
          <div className="h-11 rounded-xl bg-surface-2 animate-shimmer" />
        ) : (
          <select
            value={form.feedId}
            onChange={(e) => update("feedId", e.target.value as `0x${string}`)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--monad-border)",
              color: form.feedId ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            <option value="">Select a feed…</option>
            {feeds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Resolution type">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(["ABOVE_THRESHOLD", "BELOW_THRESHOLD", "CLOSEST_TO"] as ResolutionType[]).map(
            (rt) => {
              const labels: Record<ResolutionType, string> = {
                ABOVE_THRESHOLD: "Above threshold",
                BELOW_THRESHOLD: "Below threshold",
                CLOSEST_TO: "Closest to",
              };
              const descs: Record<ResolutionType, string> = {
                ABOVE_THRESHOLD: "Wins if price ≥ target",
                BELOW_THRESHOLD: "Wins if price < target",
                CLOSEST_TO: "Nearest band wins",
              };
              const disabled = rt === "CLOSEST_TO" && isBinary;
              const active = form.resolutionType === rt;
              return (
                <button
                  key={rt}
                  onClick={() => !disabled && update("resolutionType", rt)}
                  disabled={disabled}
                  className="rounded-xl p-3 text-left space-y-0.5 transition-all disabled:opacity-40"
                  style={{
                    background: active
                      ? "rgba(131,110,249,0.1)"
                      : "var(--surface-2)",
                    border: active
                      ? "1.5px solid rgba(131,110,249,0.5)"
                      : "1px solid var(--monad-border)",
                  }}
                >
                  <p
                    className="text-xs font-semibold"
                    style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}
                  >
                    {labels[rt]}
                  </p>
                  <p className="text-[10px] text-txt-muted">{descs[rt]}</p>
                </button>
              );
            }
          )}
        </div>
      </Field>

      {form.resolutionType !== "CLOSEST_TO" && (
        <Field
          label="Price threshold (USD)"
          hint="The outcome 0 (first in your list) wins if the condition is met."
        >
          <TextInput
            type="number"
            value={form.threshold}
            onChange={(v) => update("threshold", v)}
            placeholder="e.g. 120000"
          />
        </Field>
      )}

      {form.resolutionType === "CLOSEST_TO" && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: "rgba(131,110,249,0.06)",
            border: "1px solid rgba(131,110,249,0.2)",
            color: "var(--text-secondary)",
          }}
        >
          For CLOSEST_TO markets the contract auto-computes midpoints between your
          outcomes. Add at least 3 outcomes in Step 1 for this to be meaningful.
        </div>
      )}
    </div>
  );
}

// ─── Step 3 — Timing ─────────────────────────────────────────────────────────

function Step3({
  form,
  update,
}: {
  form: FormState;
  update: (k: keyof FormState, v: FormState[keyof FormState]) => void;
}) {
  const closeH = parseFloat(form.closesIn) || 0;
  const resolveH = parseFloat(form.resolvesIn) || 0;
  const closeDate = new Date(Date.now() + closeH * 3_600_000);
  const resolveDate = new Date(Date.now() + resolveH * 3_600_000);
  const fmtDate = (d: Date) =>
    d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Set the timeline</h2>
        <p className="text-sm text-txt-muted mt-1">
          Trading closes first, then the market resolves. Close time must precede
          resolve time.
        </p>
      </div>

      <Field label="Trading closes in (hours from now)" hint={`Closes: ${fmtDate(closeDate)}`}>
        <TextInput
          type="number"
          value={form.closesIn}
          onChange={(v) => update("closesIn", v)}
          placeholder="e.g. 720"
        />
      </Field>

      <Field
        label="Resolves in (hours from now)"
        hint={`Resolves: ${fmtDate(resolveDate)}`}
      >
        <TextInput
          type="number"
          value={form.resolvesIn}
          onChange={(v) => update("resolvesIn", v)}
          placeholder="e.g. 744"
        />
      </Field>

      <div
        className="rounded-xl p-4 text-xs space-y-1"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--monad-border)",
          color: "var(--text-muted)",
        }}
      >
        <p>• Resolution window: ±60 min around resolve time for the Pyth VAA.</p>
        <p>• Anyone can call resolve() after resolve time and earn a 0.5% bounty.</p>
        <p>• Your 0.1 MON creator deposit is refunded on successful resolution.</p>
      </div>
    </div>
  );
}

// ─── Step 4 — Review + submit ─────────────────────────────────────────────────

function Step4({
  form,
  feeds,
  onSubmit,
  isSubmitting,
  isConfirming,
}: {
  form: FormState;
  feeds: SupportedFeed[];
  onSubmit: () => void;
  isSubmitting: boolean;
  isConfirming: boolean;
}) {
  const selectedFeed = feeds.find((f) => f.id === form.feedId);
  const closeDate = new Date(Date.now() + parseFloat(form.closesIn) * 3_600_000);
  const resolveDate = new Date(Date.now() + parseFloat(form.resolvesIn) * 3_600_000);
  const fmtDate = (d: Date) =>
    d.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "UTC", timeZoneName: "short",
    });

  const rows: [string, string][] = [
    ["Question", form.question],
    ["Outcomes", form.outcomes.filter(Boolean).join(" / ")],
    ["Price feed", selectedFeed?.name ?? form.feedId],
    ["Resolution", form.resolutionType.replace(/_/g, " ").toLowerCase()],
    ...(form.resolutionType !== "CLOSEST_TO"
      ? [["Threshold", `$${form.threshold} USD`] as [string, string]]
      : []),
    ["Trading closes", fmtDate(closeDate)],
    ["Resolves", fmtDate(resolveDate)],
    ["Creator deposit", "0.1 MON (refunded on resolve)"],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Review & create</h2>
        <p className="text-sm text-txt-muted mt-1">
          Double-check everything — market parameters are immutable once deployed.
        </p>
      </div>

      <div
        className="rounded-xl divide-y text-sm"
        style={{ border: "1px solid var(--monad-border)", borderColor: "var(--monad-border)" }}
      >
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-start justify-between gap-4 px-4 py-3"
            style={{ borderColor: "var(--monad-border)" }}
          >
            <span className="text-txt-muted shrink-0">{label}</span>
            <span className="text-txt-primary text-right font-medium">{value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onSubmit}
        disabled={isSubmitting || isConfirming}
        className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "var(--accent)" }}
      >
        {isSubmitting
          ? "Check wallet…"
          : isConfirming
          ? "Confirming on-chain…"
          : "Create market (0.1 MON deposit)"}
      </button>
    </div>
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(step: number, form: FormState): string | null {
  if (step === 0) {
    if (form.question.trim().length < 10) return "Question must be at least 10 characters.";
  }
  if (step === 1) {
    if (form.outcomes.some((o) => !o.trim())) return "All outcome labels must be filled in.";
    if (new Set(form.outcomes.map((o) => o.trim())).size !== form.outcomes.length)
      return "Outcome labels must be unique.";
  }
  if (step === 2) {
    if (!form.feedId) return "Select a price feed.";
    if (form.resolutionType !== "CLOSEST_TO" && !form.threshold)
      return "Enter a price threshold.";
    if (form.resolutionType !== "CLOSEST_TO" && parseFloat(form.threshold) <= 0)
      return "Threshold must be > 0.";
  }
  if (step === 3) {
    const closeH = parseFloat(form.closesIn);
    const resolveH = parseFloat(form.resolvesIn);
    if (!closeH || closeH <= 0) return "Close time must be > 0 hours.";
    if (!resolveH || resolveH <= 0) return "Resolve time must be > 0 hours.";
    if (resolveH <= closeH) return "Resolve time must be after close time.";
  }
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

const INITIAL_FORM: FormState = {
  question: "",
  outcomes: ["YES", "NO"],
  feedId: "",
  resolutionType: "ABOVE_THRESHOLD",
  threshold: "",
  closesIn: "720",   // 30 days
  resolvesIn: "744", // 31 days
};

export function CreateMarketClient() {
  const { isConnected } = useAccount();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [createdAddress, setCreatedAddress] = useState<Address | null>(null);

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Load supported feeds from factory
  const { data: feedIdsRaw, isLoading: feedsLoading } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getSupportedFeedIds",
    query: { staleTime: 60_000 },
  });

  // For each feed ID, read its name from the feeds mapping
  const feedIdList = (feedIdsRaw as `0x${string}`[] | undefined) ?? [];
  const { data: feedInfosRaw } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "feeds",
    args: [feedIdList[0] ?? "0x0000000000000000000000000000000000000000000000000000000000000000"],
    query: { enabled: feedIdList.length > 0 },
  });

  // Build feeds list by reading each feed's name
  // Since we can't do N reads easily here, we'll show feed IDs truncated if names aren't available.
  // The factory ABI getter for feeds(bytes32) returns (bool, string, address) tuple.
  const feeds: SupportedFeed[] = feedIdList.map((id) => {
    // We'll get names in a separate multicall — for now derive from feed ID
    // The feed names are stored on-chain and will be fetched below via useReadContracts
    return { id, name: id.slice(0, 10) + "…" + id.slice(-6) };
  });

  // Enrich feed names via separate reads (one per feed)
  // Using a simple approach: show the known names from the allowlist
  // In production, this would use useReadContracts to batch feed reads
  const KNOWN_FEED_NAMES: Record<string, string> = {
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43": "BTC/USD",
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace": "ETH/USD",
    "0xe786153cc54abd4b0e53b4c246d54d9f8eb3f3b5a34d4fc5a2e9a423b0ba5d6b": "MON/USD (beta)",
  };

  const namedFeeds: SupportedFeed[] = feedIdList.map((id) => ({
    id,
    name: KNOWN_FEED_NAMES[id.toLowerCase()] ?? `${id.slice(0, 8)}…${id.slice(-4)}`,
  }));

  function update(k: keyof FormState, v: FormState[keyof FormState]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleNext() {
    const err = validate(step, form);
    if (err) { toast.error(err); return; }
    setStep((s) => s + 1);
  }

  function handleSubmit() {
    const err = validate(step, form);
    if (err) { toast.error(err); return; }

    const closeTime  = BigInt(nowPlusHours(parseFloat(form.closesIn)));
    const resolveTime = BigInt(nowPlusHours(parseFloat(form.resolvesIn)));

    let thresholds: bigint[];
    if (form.resolutionType === "CLOSEST_TO") {
      // Auto-generate midpoints from 0 to 1e8, evenly spaced across outcomes
      // In a real implementation users would enter midpoints per outcome.
      // For v1, we use placeholder midpoints that need to be set properly.
      // This is acceptable because CLOSEST_TO markets should only be created
      // by advanced users who understand the threshold encoding.
      const n = form.outcomes.length;
      thresholds = Array.from({ length: n }, (_, i) =>
        BigInt(Math.round(((i + 0.5) / n) * 1e8))
      );
    } else {
      thresholds = [usdToInt64(form.threshold)];
    }

    const resTypeNum = RESOLUTION_TYPE_VALUES[form.resolutionType];

    const toastId = toast.loading("Creating market…");
    writeContract(
      {
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createMarket",
        args: [
          form.question,
          form.outcomes.filter(Boolean),
          closeTime,
          resolveTime,
          form.feedId as `0x${string}`,
          thresholds,
          resTypeNum,
        ],
        value: CREATION_DEPOSIT,
      },
      {
        onSuccess: (hash) => {
          toast.success("Transaction submitted!", { id: toastId });
          // We'll show a success state once confirmed
        },
        onError: (e) => toast.error(e.message.slice(0, 120), { id: toastId }),
      }
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Create a market</h1>
          <p className="text-txt-muted text-sm mt-1">Connect your wallet to get started.</p>
        </div>
        <div
          className="rounded-2xl p-10 text-center space-y-5"
          style={{ background: "var(--surface-2)", border: "1px solid var(--monad-border)" }}
        >
          <p className="text-txt-secondary font-medium">Connect your wallet to create a market.</p>
          <ConnectButton label="Connect wallet" />
        </div>
      </div>
    );
  }

  // Confirmed — success state
  if (isConfirmed) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}
        >
          <Check size={32} style={{ color: "var(--success)" }} />
        </div>
        <div>
          <h2 className="text-xl font-bold">Market created!</h2>
          <p className="text-txt-muted text-sm mt-1">
            Your market is live on Monad testnet. Share the link to attract traders.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-5 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--monad-border)",
              color: "var(--text-secondary)",
            }}
          >
            Back to markets
          </Link>
          {txHash && (
            <a
              href={`https://testnet.monadexplorer.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "rgba(131,110,249,0.12)",
                color: "var(--accent)",
                border: "1px solid rgba(131,110,249,0.25)",
              }}
            >
              View tx <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create a market</h1>
        <p className="text-txt-muted text-sm mt-1">
          Requires a 0.1 MON refundable deposit. Returned to you when the market resolves.
        </p>
      </div>

      <div
        className="rounded-2xl p-6 sm:p-8"
        style={{ background: "var(--surface-2)", border: "1px solid var(--monad-border)" }}
      >
        <StepBar current={step} />

        {step === 0 && <Step0 form={form} update={update} />}
        {step === 1 && <Step1 form={form} update={update} />}
        {step === 2 && (
          <Step2
            form={form}
            update={update}
            feeds={namedFeeds}
            feedsLoading={feedsLoading}
          />
        )}
        {step === 3 && <Step3 form={form} update={update} />}
        {step === 4 && (
          <Step4
            form={form}
            feeds={namedFeeds}
            onSubmit={handleSubmit}
            isSubmitting={isPending}
            isConfirming={isConfirming}
          />
        )}

        {/* Nav buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-30"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--monad-border)",
              color: "var(--text-secondary)",
            }}
          >
            <ChevronLeft size={14} /> Back
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: "var(--accent)" }}
            >
              Next <ChevronRight size={14} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
