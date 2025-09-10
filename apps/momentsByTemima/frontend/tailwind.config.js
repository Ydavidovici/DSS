/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,ts,js}"],
  theme: {
    extend: {
      colors: {
        pearl: "#FAFAF8",
        charcoal: "#2B2B2B",
        blush: { 100: "#FBEFF4", 200: "#F8E9EF", 300: "#F6E3EA", 400: "#F5DCE6", 500: "#F4E6EC" },
        sky: { 200: "#EEF5FD", 300: "#EAF2FB", 400: "#E6F0FA" },
        sage: { 200: "#EEF6F3", 300: "#ECF4F1", 400: "#E8F3EE" },
        warmgray: { 200: "#EAE6E3", 600: "#6B6460" }
      },
      borderRadius: { md: "12px", lg: "16px" },
      boxShadow: { card: "0 8px 24px rgba(0,0,0,0.06)" },
      fontFamily: { heading: ["Cormorant Garamond", "serif"], body: ["Inter", "system-ui", "sans-serif"] }
    }
  },
  plugins: []
}
