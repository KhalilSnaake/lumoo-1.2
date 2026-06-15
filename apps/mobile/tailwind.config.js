/** @type {import('tailwindcss').Config} */
const { colors, fonts, radii } = require("./src/theme/tokens");

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        whatsapp: colors.whatsapp,
        "admin-blue": colors.adminBlue,
        mali: colors.mali,
        ink: colors.text,
        muted: colors.muted,
        surface: colors.surface,
        line: colors.border,
      },
      fontFamily: {
        display: [fonts.display],
        "display-semibold": [fonts.displaySemibold],
        body: [fonts.body],
        "body-semibold": [fonts.bodySemibold],
      },
      borderRadius: { "2xl": String(radii["2xl"]) },
    },
  },
  plugins: [],
};
