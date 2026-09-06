import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm, premium sweets/gifting identity — not a childish
        // candy-store palette. Deep maroon + gold accent.
        brand: {
          50: "#fdf3f0",
          100: "#fbe4dd",
          400: "#c96a4a",
          500: "#a9432a", // primary
          600: "#8a3320",
          900: "#3d160d",
        },
        gold: {
          400: "#d4af6a",
          500: "#c19a4b",
        },
        cream: "#fbf6ef",
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        body: ["Inter", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};

export default config;
