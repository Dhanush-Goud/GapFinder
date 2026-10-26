import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        lab: {
          bg: "#080908",
          surface: "#10110F",
          "surface-subtle": "#171915",
          "surface-elevated": "#20221D",
          lime: "#D5FF32",
          "lime-hover": "#C2EB28",
          "lime-dim": "#98BD1A",
          "lime-muted": "rgba(213, 255, 50, 0.12)",
          "text-primary": "#F4F5F0",
          "text-secondary": "#A0A39A",
          "text-muted": "#73776E",
          border: "#2A2D26",
          "border-subtle": "#1B1D18",
          "border-hover": "#3A3F33",
          amber: "#E5A83B",
          red: "#EF4444",
          green: "#10B981",
          blue: "#38BDF8",
          violet: "#A855F7",
        },
        brand: {
          50: "#171915",
          100: "rgba(213, 255, 50, 0.12)",
          200: "rgba(213, 255, 50, 0.25)",
          300: "#98BD1A",
          400: "#B8E026",
          500: "#D5FF32",
          600: "#D5FF32",
          700: "#C2EB28",
          800: "#98BD1A",
          900: "#10110F",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.25)",
        lime: "0 0 20px -3px rgba(213, 255, 50, 0.25)",
      },
    },
  },
  plugins: [],
};
export default config;
