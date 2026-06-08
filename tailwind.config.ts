import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        editorial: {
          black: "#18181B",
          secondary: "#3F3F46",
          accent: "#4F46E5",
          bg: "#FAFAFA",
          text: "#09090B",
          muted: "#71717A",
          border: "#E4E4E7",
          "border-dark": "#27272A",
        },
        accent: {
          indigo: "#4F46E5",
          teal: "#0D9488",
          amber: "#F59E0B",
          rose: "#E11D48",
          violet: "#7C3AED",
        },
      },
      fontFamily: {
        code: ["var(--font-fira-code)", "monospace"],
        sans: ["var(--font-fira-sans)", "sans-serif"],
      },
      borderRadius: {
        editorial: "4px",
      },
    },
  },
  plugins: [],
};
export default config;
