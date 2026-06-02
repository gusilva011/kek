import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  safelist: [
    "from-emerald-600",
    "to-emerald-900",
    "from-sky-700",
    "to-indigo-900",
    "from-amber-500",
    "to-orange-700",
    "from-rose-600",
    "to-red-900",
    "from-violet-600",
    "to-fuchsia-900",
    "from-slate-700",
    "to-slate-900",
    "from-green-600",
    "to-yellow-600",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          DEFAULT: "#15cb80",
          dark: "#0fa968",
          light: "#3ce99e",
          400: "#3ce99e",
          500: "#15cb80",
          600: "#0fa968",
        },
        gold: { DEFAULT: "#ffce47", dark: "#e8b324" },
        ink: {
          950: "#06090f",
          900: "#0a0e15",
          850: "#0e131c",
          800: "#121823",
          700: "#172030",
          600: "#1e2838",
          550: "#273346",
          500: "#36465c",
          400: "#5b6b82",
        },
        live: "#ff4d63",
      },
      boxShadow: {
        card: "0 8px 24px -14px rgba(0,0,0,0.7)",
        pop: "0 18px 50px -18px rgba(0,0,0,0.85)",
        glow: "0 8px 30px -10px rgba(21,203,128,0.45)",
        "inner-top": "inset 0 1px 0 0 rgba(255,255,255,0.04)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(120% 80% at 50% -10%, rgba(21,203,128,0.10), transparent 60%)",
      },
      keyframes: {
        flashUp: {
          "0%": { backgroundColor: "rgba(21,203,128,0.30)" },
          "100%": { backgroundColor: "transparent" },
        },
        flashDown: {
          "0%": { backgroundColor: "rgba(255,77,99,0.30)" },
          "100%": { backgroundColor: "transparent" },
        },
        livePulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        kenburns: {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(1.09)" },
        },
      },
      animation: {
        flashUp: "flashUp 0.9s ease-out",
        flashDown: "flashDown 0.9s ease-out",
        livePulse: "livePulse 1.4s ease-in-out infinite",
        fadeIn: "fadeIn 0.3s ease-out",
        slideUp: "slideUp 0.3s ease-out",
        kenburns: "kenburns 16s ease-out infinite alternate",
      },
    },
  },
  plugins: [],
};

export default config;
