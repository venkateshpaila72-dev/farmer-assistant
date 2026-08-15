/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#8A2E10", dark: "#6B240C", tint: "#FBEBE4" },
        accent: { DEFAULT: "#0F5132", dark: "#0A3D25", tint: "#E7F3EA" },
        gold: { DEFAULT: "#B8860B", tint: "#FDF6E3" },
        danger: { DEFAULT: "#B42318", tint: "#FDECEA" },
        bg: "#F6F7F2",
        surface: "#FFFFFF",
        border: "#E4E2D6",
        ink: { DEFAULT: "#241C12", soft: "#5B5140" },
      },
      fontFamily: {
        display: ["Zilla Slab", "serif"],
        body: ["Noto Sans", "sans-serif"],
      },
      borderRadius: { sm: "10px", md: "16px" },
      transitionTimingFunction: { "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)" },
    },
  },
  plugins: [],
};