// Expo SDK 52+ configure Metro automatiquement pour les monorepos
// (résolution des packages du workspace + watch de la racine). On ne surcharge
// donc PAS watchFolders / nodeModulesPaths / disableHierarchicalLookup :
// l'ancienne approche pré-52 élevait la racine serveur de Metro et cassait la
// résolution des assets de l'app (Metro cherchait ./assets à la racine du monorepo).
// On se contente d'ajouter NativeWind par-dessus la config par défaut.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./src/global.css" });
