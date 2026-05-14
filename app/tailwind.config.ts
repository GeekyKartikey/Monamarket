import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Single font family — Inter for both sans and mono contexts.
        // font-mono gets tabular figures via globals.css, not a separate font file.
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-inter)", "system-ui", "sans-serif"],
      },

      colors: {
        // ─── Semantic system — use these in phases 2-5 rewrites ──────────
        bg:          "var(--bg)",
        surface:     "var(--surface)",
        "surface-2": "var(--surface-2)",

        // Hex values (not CSS vars) so Tailwind opacity modifiers work:
        // e.g. bg-accent/10, border-success/20
        accent: {
          DEFAULT: "#836EF9",
          hover:   "#9b8afb",
          pressed: "#6b55f0",
        },
        success: "#22c55e",
        danger:  "#ef4444",
        warning: "#f59e0b",

        // ─── Text shorthands ──────────────────────────────────────────────
        // Use as: text-txt-primary, text-txt-secondary, text-txt-muted
        txt: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted:     "var(--text-muted)",
        },

        // ─── Backward-compat aliases — existing code keeps working ────────
        // Pointed at new token values so visual update lands automatically.
        monad: {
          purple: "#836EF9",
          dark:   "#0a0a12",
          card:   "#13131e",
          border: "rgba(255,255,255,0.08)",
        },
      },

      borderRadius: {
        // Strict radius scale — use these, not arbitrary values
        sm:   "8px",
        md:   "12px",
        lg:   "16px",
        // rounded-full = 9999px (Tailwind default, kept for pill shapes)
      },

      boxShadow: {
        card:  "var(--shadow-card)",
        panel: "var(--shadow-panel)",
      },

      // Strict spacing scale enforced in theme (4/8/12/16/24/32/48/64).
      // Tailwind's default spacing already covers these; listing here for docs.
    },
  },
  plugins: [],
};

export default config;
