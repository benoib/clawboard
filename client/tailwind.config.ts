import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#0a0a0a",
          DEFAULT: "#111111",
          card: "#1a1a1a",
          elevated: "#222222",
        },
        gold: {
          DEFAULT: "#d4a843",
          hover: "#c9952b",
          pressed: "#b8862a",
          muted: "rgba(212,168,67,0.15)",
        },
        border: {
          subtle: "#2a2a2a",
          DEFAULT: "#333333",
        },
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(212,168,67,0.06)",
        "glow-lg": "0 0 40px rgba(212,168,67,0.1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
