/**
 * Design token source of truth.
 *
 * CSS custom properties in globals.css mirror these values.
 * Use these constants in programmatic contexts (e.g. RainbowKit theme,
 * inline styles) where CSS vars cannot be consumed directly.
 *
 * Rule: NO hardcoded colors or pixel values anywhere else in the app.
 * If it belongs to the visual language, it lives here first.
 */
export const TOKENS = {
  // ─── Background layers ──────────────────────────────────────────────
  /** Page background — near-black with 2-3% purple tint */
  bg: "#0a0a12",
  /** Card / raised panel surface */
  surface: "#13131e",
  /** Nested panel surface (e.g. buy panel inside detail page) */
  surface2: "#1c1c2a",

  // ─── Borders ────────────────────────────────────────────────────────
  /** Default border — low-opacity white with slight purple warmth */
  border: "rgba(255,255,255,0.08)",

  // ─── Text ───────────────────────────────────────────────────────────
  textPrimary: "#ffffff",
  /** Muted text — off-white with purple cast */
  textSecondary: "#a0a0b8",
  /** Placeholder / disabled text */
  textMuted: "#52526a",

  // ─── Brand / accent ─────────────────────────────────────────────────
  /** Monad purple — primary CTAs, selected state, highlights only */
  accent: "#836EF9",
  accentHover: "#9b8afb",
  accentPressed: "#6b55f0",

  // ─── Semantic status ────────────────────────────────────────────────
  /** YES outcome / profit / confirmed transaction */
  success: "#22c55e",
  /** NO outcome / loss / failed transaction */
  danger: "#ef4444",
  /** Resolves soon / pending transaction / caution */
  warning: "#f59e0b",
} as const;

export type TokenKey = keyof typeof TOKENS;
