/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,html}",
  ],
  // Clases construidas dinámicamente (ej. `btn-${variant}`) que Tailwind debe conservar
  safelist: [
    "btn-3d",
    "btn-primary",
    "btn-success",
    "btn-yellow",
    "btn-coral",
    "btn-cyan",
    "btn-orange",
    "btn-white",
  ],
  theme: {
    extend: {
      colors: {
        // Primarios de marca (DESIGN_SYSTEM.md §1.1)
        "numu-purple": "#5124EE",
        "numu-deep-indigo": "#2B0F8A",
        "soft-lavender": "#F4F5FE",
        // Gamificación (DESIGN_SYSTEM.md §1.2)
        "sunshine-yellow": "#FFC700",
        "mint-success": "#00D282",
        "coral-alert": "#FF5A5F",
        "cyan-ocean": "#00B4D8",
        "orange-energy": "#FF8800",
        // Neutros / accesibilidad (DESIGN_SYSTEM.md §1.3)
        "text-dark": "#1E1B4B",
        plum: '#381932',
        milk: '#FFF3E6',
        purple: '#6C3483',
        purpleDark: '#512E5F',
        darkBg: '#1E121C',
        "card-white": "#FFFFFF",
        "border-gray": "#E2E8F0",
        // Sombras 3D sólidas de cada color
        "shadow-primary": "#2B0F8A",
        "shadow-success": "#009E60",
        "shadow-yellow": "#C79A00",
        "shadow-coral": "#D32F2F",
        "shadow-cyan": "#0077A3",
        "shadow-orange": "#CC6A00",
      },
      fontFamily: {
        fredoka: ["Fredoka", "cursive", "sans-serif"],
        poppins: ["Poppins", "sans-serif"],
      },
      fontSize: {
        // Escala tipográfica (DESIGN_SYSTEM.md §2.1)
        display: ["3rem", { lineHeight: "1.1", fontWeight: "700" }],
        "display-lg": ["4rem", { lineHeight: "1.1", fontWeight: "700" }],
        h1: ["1.75rem", { lineHeight: "1.2", fontWeight: "700" }],
        "h1-lg": ["2.25rem", { lineHeight: "1.2", fontWeight: "700" }],
        h2: ["1.375rem", { lineHeight: "1.3", fontWeight: "600" }],
        "h2-lg": ["1.75rem", { lineHeight: "1.3", fontWeight: "600" }],
        body: ["1.125rem", { lineHeight: "1.4", fontWeight: "500" }],
        "body-lg": ["1.25rem", { lineHeight: "1.4", fontWeight: "500" }],
        button: ["1.125rem", { lineHeight: "1.0", fontWeight: "700" }],
        "button-lg": ["1.375rem", { lineHeight: "1.0", fontWeight: "700" }],
        micro: ["0.875rem", { lineHeight: "1.3", fontWeight: "700" }],
        "micro-lg": ["1rem", { lineHeight: "1.3", fontWeight: "700" }],
      },
      boxShadow: {
        // Efecto botón 3D táctil (DESIGN_SYSTEM.md §3)
        "3d-primary": "0px 6px 0px #2B0F8A",
        "3d-success": "0px 6px 0px #009E60",
        "3d-yellow": "0px 6px 0px #C79A00",
        "3d-coral": "0px 6px 0px #D32F2F",
        "3d-cyan": "0px 6px 0px #0077A3",
        "3d-orange": "0px 6px 0px #CC6A00",
        "3d-neutral": "0px 6px 0px #CBD5E1",
        "3d-white": "0px 6px 0px #E2E8F0",
      },
      borderRadius: {
        card: "24px",
        btn: "18px",
      },
      spacing: {
        // Áreas táctiles mínimas (Fitts' Law)
        touch: "64px",
        "touch-lg": "72px",
      },
      keyframes: {
        "bounce-squish": {
          "0%, 100%": { transform: "translateY(0) scale(1, 1)" },
          "30%": { transform: "translateY(-6px) scale(0.98, 1.02)" },
          "60%": { transform: "translateY(0) scale(1.03, 0.97)" },
        },
        "pulse-active": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(81, 36, 238, 0.5)" },
          "50%": { transform: "scale(1.05)", boxShadow: "0 0 0 14px rgba(81, 36, 238, 0)" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.08)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "star-light": {
          "0%": { transform: "scale(0.4) rotate(-25deg)", opacity: "0" },
          "70%": { transform: "scale(1.25) rotate(8deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
      },
      animation: {
        "bounce-squish": "bounce-squish 0.5s ease-in-out",
        "pulse-active": "pulse-active 1.6s ease-in-out infinite",
        "pop-in": "pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "slide-up": "slide-up 0.3s ease-out both",
        "star-light": "star-light 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
    },
  },
  plugins: [],
}
