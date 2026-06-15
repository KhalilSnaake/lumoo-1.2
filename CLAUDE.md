# Lumoo — Standards de design & UI/UX

Monorepo npm workspaces : `packages/core` (logique partagée), `apps/web` (Vite + Tailwind), `apps/mobile` (Expo Router + NativeWind). UI séparée par plateforme, logique partagée. E-commerce Mali ; la commande passe par **WhatsApp**.

## Règle d'or : utiliser le skill `ui-ux-pro-max` pour TOUT travail UI

Avant de concevoir/coder un écran ou un composant, ou de revoir du design :

1. **Invoquer le skill** `ui-ux-pro-max` (installé dans `.claude/skills/`).
2. **Lancer son CLI** pour obtenir le design system + les bonnes pratiques :
   ```bash
   # Windows : TOUJOURS préfixer par -X utf8 (sinon UnicodeEncodeError sur la console)
   python -X utf8 .claude/skills/ui-ux-pro-max/scripts/search.py "<type produit> <mots-clés>" --design-system -f markdown
   python -X utf8 .claude/skills/ui-ux-pro-max/scripts/search.py "<sujet>" --stack react-native
   ```
3. **Suivre sa pre-delivery checklist** : contraste 4.5:1, touch targets ≥ 44px, focus states, `prefers-reduced-motion`, responsive, transitions 150–300 ms.

⚠️ Le skill propose des couleurs/polices **génériques** (souvent bleu/orange, Rubik…). **On les ignore** : l'identité Lumoo ci-dessous prime toujours. Le skill sert pour la **méthode et la rigueur UX**, pas pour la marque.

## Identité Lumoo (verrouillée — cohérence web/mobile)

- **Couleur principale** : vert émeraude — `#16a34a` (DEFAULT) / `#059669` (dark). Dégradés `green-500 → emerald-600`.
- **Vert WhatsApp** `#25D366` : réservé aux CTA de commande / contact WhatsApp.
- **Bleu** (`blue-600`) : accent secondaire, **espace admin uniquement**.
- **Accents Mali** (drapeau) : vert `#14B53A`, jaune `#FCD116`, rouge `#CE1126` — usage ponctuel / culturel.
- **Polices** : Spline Sans / Inter (display), SF Pro Rounded.
- **Style** : très arrondi (`rounded-2xl/3xl/full`), typo grasse (`font-bold/black`), dégradés, ombres colorées, micro-interactions (`active:scale-95`). Correspond au style « Vibrant & Block-based ».

## Icônes : politique hybride

- **Actions / boutons fonctionnels** → **icônes SVG** (Lucide), taille cohérente 24×24, `aria-label` si l'icône est seule.
- **Marketing / catégories / contenu éditorial** → emojis autorisés (identité Lumoo).
- ❌ Pas d'emoji comme icône d'**action** (ex. bouton « ✏️ Modifier » → icône SVG crayon + label texte).

## Contraintes marché Mali (toujours les prendre en compte)

- **Android bas de gamme** : animations légères, privilégier `transform`/`opacity` (jamais animer `width`/`height`).
- **Data chère / réseau lent** : images optimisées et **mises en cache**, lazy loading, réserver l'espace (zéro saut de contenu).
- **Langue** : interface en **français**.
- **Offline-friendly** quand c'est possible : états de chargement (skeletons), messages d'erreur clairs près du problème.

## Accessibilité (CRITIQUE — non négociable)

- Contraste texte ≥ 4.5:1 ; texte body ≥ 16px sur mobile.
- Touch targets ≥ 44×44px, avec feedback visuel au tap.
- `aria-label` sur les boutons icône-seule ; labels sur tous les champs de formulaire.
- Respecter `prefers-reduced-motion`.

> Spécificités React Native / Expo : voir `apps/mobile/CLAUDE.md`.
