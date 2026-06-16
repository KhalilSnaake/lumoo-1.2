import { Image } from "expo-image";

// Composant logo Lumoo (rend assets/images/logo-lumoo.png à largeur donnée).
const LOGO = require("../../assets/images/logo-lumoo.png");
const RATIO = 326 / 945; // hauteur / largeur du PNG source

export function Logo({ width = 120 }: { width?: number }) {
  return (
    <Image
      source={LOGO}
      style={{ width, height: Math.round(width * RATIO) }}
      contentFit="contain"
      cachePolicy="memory-disk"
      accessibilityLabel="Lumoo"
    />
  );
}
