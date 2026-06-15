// Expo SDK 52+ configure Metro automatiquement pour les monorepos
// (résolution des packages du workspace + watch de la racine). On ne surcharge
// donc PAS watchFolders / nodeModulesPaths / disableHierarchicalLookup :
// l'ancienne approche pré-52 élevait la racine serveur de Metro et cassait la
// résolution des assets de l'app (Metro cherchait ./assets à la racine du monorepo).
// On se contente d'ajouter NativeWind par-dessus la config par défaut.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// lucide-react-native : son barrel ESM importe ses icônes via des chemins relatifs
// `.mjs` que la résolution stricte des "package exports" de Metro (activée par défaut
// en SDK 54) refuse (le champ `exports` de Lucide ne déclare que `.` et `./icons`).
// On désactive les package exports UNIQUEMENT pour Lucide — les autres paquets qui
// en dépendent (ex. @supabase/supabase-js) ne sont pas impactés.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith("lucide-react-native") ||
    (context.originModulePath || "").includes("lucide-react-native")
  ) {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
