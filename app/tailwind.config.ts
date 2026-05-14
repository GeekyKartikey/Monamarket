import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        monad: {
          purple: "#836EF9",
          dark: "#0E0E16",
          card: "#16161F",
          border: "#2A2A3A",
        },
      },
    },
  },
  plugins: [],
};

export default config;
