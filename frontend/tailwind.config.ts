import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50:  "#edfefe",
          100: "#c5f5f5",
          200: "#92ecec",
          300: "#5ee0e0",
          400: "#2dd4d4",
          500: "#14bcbc",
          600: "#0f9999",
          700: "#0f7272",
          800: "#0d5f5f",
          900: "#0b4d4d",
          950: "#073333",
        },
      },
      animation: {
        float:     "float 3.5s ease-in-out infinite",
        "fade-in": "fadeIn 0.7s ease-out both",
        "slide-up":"slideUp 0.7s ease-out both",
        "slide-in-right": "slideInRight 0.6s ease-out both",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":       { transform: "translateY(-12px)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(24px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
