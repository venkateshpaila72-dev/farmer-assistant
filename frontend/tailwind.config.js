/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#9A3412", dark: "#7A2A0E", tint: "#FBEBE4" },
        accent: { DEFAULT: "#166534", tint: "#E7F3EA" },
        danger: { DEFAULT: "#B42318", tint: "#FDECEA" },
        bg: "#F6F7F2",
        surface: "#FFFFFF",
        border: "#E4E2D6",
        ink: { DEFAULT: "#2A2114", soft: "#5B5140" },
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