/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "numu-purple": "#5124EE",
        "numu-deep-indigo": "#2B0F8A",
        "soft-lavender": "#F4F5FE",
        "sunshine-yellow": "#FFC700",
        "mint-success": "#00D282",
        "coral-alert": "#FF5A5F",
        "cyan-ocean": "#00B4D8",
        "orange-energy": "#FF8800",
        "text-dark": "#1E1B4B",
      },
      fontFamily: {
        fredoka: ["Fredoka", "cursive", "sans-serif"],
        nunito: ["Nunito", "sans-serif"],
      },
      boxShadow: {
        "3d-primary": "0px 6px 0px #2B0F8A",
        "3d-success": "0px 6px 0px #009E60",
        "3d-yellow": "0px 6px 0px #C79A00",
        "3d-coral": "0px 6px 0px #D32F2F",
      },
      borderRadius: {
        card: "24px",
        btn: "18px",
      },
    },
  },
  plugins: [],
}
