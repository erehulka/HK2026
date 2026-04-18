/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "#000000",
          surface: "#090d1a",
          card: "#0f172a",
          border: "#2563eb",
          "border-soft": "#1d4ed8",
          input: "#0f172a",
          "input-border": "#3b82f6",
          text: "#ffffff",
          muted: "#9fb8ff",
          placeholder: "#7c90c6",
          cancel: "#374151",
          primary: "#2563eb",
          "primary-dim": "#1f3b74",
          success: "#22c55e",
          danger: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
