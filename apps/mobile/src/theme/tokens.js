// Source unique de l'identité Lumoo. CommonJS pour être require() par
// tailwind.config.js ET import par le TS de l'app (types via tokens.d.ts).
const colors = {
  brand: {
    DEFAULT: "#16a34a",
    dark: "#059669",
    50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac",
    400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d",
    800: "#166534", 900: "#14532d",
  },
  whatsapp: "#25D366",   // réservé CTA commande/contact
  adminBlue: "#2563eb",  // espace admin uniquement
  mali: { green: "#14B53A", yellow: "#FCD116", red: "#CE1126" },
  text: "#0F172A",
  muted: "#475569",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E5E7EB",
};

const spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 };
const radii = { lg: 16, xl: 24, "2xl": 28, full: 9999 };

const fonts = {
  display: "SplineSans_700Bold",
  displaySemibold: "SplineSans_600SemiBold",
  body: "Inter_400Regular",
  bodySemibold: "Inter_600SemiBold",
};

const fontSizes = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30 };

module.exports = { colors, spacing, radii, fonts, fontSizes };
