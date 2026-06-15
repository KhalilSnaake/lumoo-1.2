@AGENTS.md

# UI/UX mobile — Lumoo

Les standards de design partagés sont dans le **`CLAUDE.md` racine** (identité Lumoo, skill `ui-ux-pro-max`, contraintes Mali, accessibilité). Ci-dessous, les spécificités **React Native / Expo**.

## Stack mobile
- **Expo SDK 54**, **Expo Router** (routing par fichiers dans `src/app/`, `typedRoutes` off), React 19, RN 0.81.
- **NativeWind v4** pour le style (Tailwind). Token marque déjà défini dans `tailwind.config.js` : `brand` = `#16a34a`, `brand-dark` = `#059669`.
- **expo-image** (déjà installé) pour toutes les images.
- `react-native-reanimated` + `react-native-gesture-handler` disponibles pour animations/gestes.
- `react-native-safe-area-context` pour les zones sûres.

## Règles mobiles
- **Images** : toujours `expo-image` avec `cachePolicy="memory-disk"` (data chère au Mali) ; jamais le `Image` RN par défaut sur les listes. Prévoir un `placeholder` et des dimensions réservées (pas de saut de contenu).
- **Navigation** : Expo Router (fichiers `src/app/`). Typer les params.
- **Safe areas** : via `react-native-safe-area-context`, pas de marges codées en dur.
- **Listes** : `FlatList` avec `keyExtractor` et `getItemLayout` quand possible ; composants natifs (`Pressable`, `ScrollView`).
- **Touch targets** ≥ 44px.
- **Icônes SVG** (politique hybride, cf. racine) : prévoir `lucide-react-native` (+ `react-native-svg`) — **à installer au moment d'attaquer les écrans** (pas encore présent dans `package.json`).

## Avant de coder un écran
1. Invoquer le skill `ui-ux-pro-max` (cf. racine) — il a une stack `react-native` dédiée :
   ```bash
   python -X utf8 .claude/skills/ui-ux-pro-max/scripts/search.py "list card form navigation" --stack react-native
   ```
2. Appliquer l'**identité Lumoo** (vert émeraude, arrondi, gras) — **pas** les couleurs génériques du skill.
3. Passer la **pre-delivery checklist** du skill avant de livrer.
