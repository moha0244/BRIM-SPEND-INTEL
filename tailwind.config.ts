import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080C12",
        foreground: "#E8EDF5",
        surface: "#0B1120",
        elevated: "#0F1A2E",
        border: { DEFAULT: "#1a2236", hover: "#2a3a55" },
        muted: { DEFAULT: "#0B1120", foreground: "#3A4A6A" },
        accent: {
          DEFAULT: "#00F5A0",
          dim: "#00c97e",
          bg: "#030d08",
          border: "#003d22",
        },
        danger: { DEFAULT: "#ff4d6d", bg: "#200a10", border: "#3a1520" },
        warning: { DEFAULT: "#f5a623", bg: "#1a1200", border: "#3a2800" },
        info: { DEFAULT: "#5a7aff", bg: "#0a0e20", border: "#1a2040" },
        text: {
          primary: "#E8EDF5",
          secondary: "#8A9AB8",
          muted: "#3A4A6A",
          hint: "#2A3A55",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
        sm: "4px",
        md: "8px",
        lg: "10px",
        xl: "14px",
      },
      fontSize: {
        "2xs": ["9px", { lineHeight: "1.4" }],
        xs: ["10px", { lineHeight: "1.5" }],
        sm: ["12px", { lineHeight: "1.5" }],
        base: ["13px", { lineHeight: "1.6" }],
        lg: ["15px", { lineHeight: "1.5" }],
        xl: ["18px", { lineHeight: "1.4" }],
        "2xl": ["22px", { lineHeight: "1.3" }],
        "3xl": ["28px", { lineHeight: "1.2" }],
      },
    },
  },
  plugins: [],
};

export default config;
