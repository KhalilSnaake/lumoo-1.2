# Plan d'implémentation — Reset password mobile (deep link)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire en sorte que le lien de réinitialisation de mot de passe ouvre l'app mobile et permette d'y saisir un nouveau mot de passe (le web est déjà fait).

**Architecture:** Flux implicite (inchangé, partagé avec le web). `_layout.tsx` redirige le lien vers l'app (`Linking.createURL`) et capte le deep link (parse du fragment → `setSession` → navigation). Un écran `reset-password.tsx` saisit le nouveau mot de passe via `getSupabase().auth.updateUser`.

**Tech Stack:** Expo SDK 54, Expo Router, expo-linking, `@lumoo/core` (`getSupabase`), NativeWind.

**Spec :** `docs/superpowers/specs/2026-06-15-mobile-password-reset.md`. Standards : `CLAUDE.md`.

> **Tests :** pas de jest mobile → vérif = `tsc --noEmit`, bundle one-shot, assertion Node pour la fonction pure, test manuel.
> **Déjà en place :** `getSupabase` est exporté par `@lumoo/core` (utilisé partout). `react-native-url-polyfill/auto` est importé dans `_layout` → `URLSearchParams` dispo. NativeWind classes (`font-display`, `font-body`, `font-display-semibold`, `bg-brand`, `text-ink`) définies.

---

## Structure des fichiers

**Créés**
- `apps/mobile/src/lib/recovery-link.ts` — `parseRecoveryParams(url)` (pur, testable).
- `apps/mobile/src/app/reset-password.tsx` — écran de saisie.

**Modifiés**
- `apps/mobile/src/app/_layout.tsx` — `authRedirectUrl` + handler deep link + `Stack.Screen`.

---

## Task 1 : Helper de parsing du lien (pur)

**Files:**
- Create: `apps/mobile/src/lib/recovery-link.ts`

- [ ] **Step 1 : Test (assertion Node) — d'abord vérifier qu'il échoue avec une fonction absente, puis l'implémenter.**

Run (depuis la racine) — ce test **reproduit la logique** attendue (le fichier `.ts` n'est pas exécutable en Node nu) :
```bash
node -e "
function parse(url){ if(!url) return null; const i=url.indexOf('#'); if(i===-1) return null; const p=new URLSearchParams(url.slice(i+1)); if(p.get('type')!=='recovery') return null; const a=p.get('access_token'), r=p.get('refresh_token'); if(!a||!r) return null; return {access_token:a, refresh_token:r}; }
console.assert(JSON.stringify(parse('lumoo://reset-password#access_token=AAA&refresh_token=BBB&type=recovery&expires_in=3600'))==='{\"access_token\":\"AAA\",\"refresh_token\":\"BBB\"}','KO1');
console.assert(parse('lumoo://reset-password')===null,'KO2: pas de fragment');
console.assert(parse('lumoo://x#type=signup&access_token=X&refresh_token=Y')===null,'KO3: mauvais type');
console.assert(parse(null)===null,'KO4: null');
console.log('OK parse');
"
```
Expected output exactly : `OK parse`

- [ ] **Step 2 : Implémenter le helper**

Créer `apps/mobile/src/lib/recovery-link.ts` avec EXACTEMENT :
```ts
export type RecoveryParams = { access_token: string; refresh_token: string };

/** Extrait les tokens d'un lien de recovery Supabase (flux implicite, fragment `#`). */
export function parseRecoveryParams(url: string | null): RecoveryParams | null {
  if (!url) return null;
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;
  const params = new URLSearchParams(url.slice(hashIndex + 1));
  if (params.get("type") !== "recovery") return null;
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}
```

- [ ] **Step 3 : Typecheck + commit**

Run (depuis `apps/mobile`) : `npx tsc --noEmit` → 0 erreur.
```bash
git add apps/mobile/src/lib/recovery-link.ts
git commit -m "feat(mobile): parseRecoveryParams (lien de reset)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Écran reset-password

**Files:**
- Create: `apps/mobile/src/app/reset-password.tsx`

- [ ] **Step 1 : Écran**

Créer `apps/mobile/src/app/reset-password.tsx` avec EXACTEMENT :
```tsx
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { getSupabase } from "@lumoo/core";

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => {
        setHasSession(!!data.session);
        setChecking(false);
      });
  }, []);

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) throw new Error(upErr.message);
      await supabase.auth.signOut();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color="#16a34a" />
      </View>
    );
  }

  if (!hasSession && !done) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8" style={{ paddingTop: insets.top }}>
        <Text className="text-6xl">⏰</Text>
        <Text className="mt-4 font-display text-xl text-ink">Lien invalide ou expiré</Text>
        <Text className="mt-1 text-center font-body text-gray-500">Demande un nouveau lien de réinitialisation.</Text>
        <Pressable onPress={() => router.replace("/(tabs)/compte")} accessibilityRole="button" className="mt-6 h-12 w-full items-center justify-center rounded-2xl bg-brand active:opacity-80">
          <Text className="font-display-semibold text-white">Demander un nouveau lien</Text>
        </Pressable>
      </View>
    );
  }

  if (done) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8" style={{ paddingTop: insets.top }}>
        <Text className="text-6xl">✅</Text>
        <Text className="mt-4 font-display text-xl text-ink">Mot de passe modifié</Text>
        <Text className="mt-1 text-center font-body text-gray-500">Connecte-toi avec ton nouveau mot de passe.</Text>
        <Pressable onPress={() => router.replace("/(tabs)/compte")} accessibilityRole="button" className="mt-6 h-12 w-full items-center justify-center rounded-2xl bg-brand active:opacity-80">
          <Text className="font-display-semibold text-white">Aller à la connexion</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 px-6" style={{ paddingTop: insets.top + 24 }}>
      <Text className="font-display text-2xl text-ink">Nouveau mot de passe</Text>
      <Text className="mt-1 font-body text-gray-500">Choisis un nouveau mot de passe (6 caractères minimum).</Text>
      <View className="mt-6 gap-3">
        <TextInput value={password} onChangeText={setPassword} placeholder="Nouveau mot de passe" placeholderTextColor="#9CA3AF" secureTextEntry autoCapitalize="none" accessibilityLabel="Nouveau mot de passe" className="min-h-12 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-body text-gray-900" />
        <TextInput value={confirm} onChangeText={setConfirm} placeholder="Confirmer le mot de passe" placeholderTextColor="#9CA3AF" secureTextEntry autoCapitalize="none" accessibilityLabel="Confirmer le mot de passe" className="min-h-12 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-body text-gray-900" />
        {error ? <Text className="font-body text-sm text-red-600">{error}</Text> : null}
        <Pressable onPress={submit} disabled={loading} accessibilityRole="button" className={`mt-2 h-12 items-center justify-center rounded-2xl bg-brand active:opacity-80 ${loading ? "opacity-60" : ""}`}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text className="font-display-semibold text-white">Mettre à jour</Text>}
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 2 : Typecheck + commit**

Run (depuis `apps/mobile`) : `npx tsc --noEmit` → 0 erreur.
```bash
git add apps/mobile/src/app/reset-password.tsx
git commit -m "feat(mobile): écran reset-password (saisie nouveau mdp)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Brancher le deep link dans `_layout.tsx`

**Files:**
- Modify: `apps/mobile/src/app/_layout.tsx`

> ⚠️ **Fichier édité activement par l'utilisateur** — intégrer de façon **additive** (lire la version courante, ne pas réécrire les providers/Stack existants).

- [ ] **Step 1 : Vérifier expo-linking**

Run (depuis `apps/mobile`) :
```bash
node -e "require.resolve('expo-linking'); console.log('expo-linking OK')" || npx expo install expo-linking
```
Expected : `expo-linking OK` (il est fourni transitivement par expo-router ; sinon `expo install` l'ajoute).

- [ ] **Step 2 : Imports** — ajouter en haut de `_layout.tsx` :
```tsx
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { getSupabase } from "@lumoo/core";
import { parseRecoveryParams } from "@/lib/recovery-link";
```
*(Si `Stack`/`useEffect` ou `getSupabase` sont déjà importés, ne pas dupliquer — fusionner.)*

- [ ] **Step 3 : `authRedirectUrl`** — dans l'appel `initCore({...})`, ajouter la propriété :
```tsx
authRedirectUrl: Linking.createURL("reset-password"),
```

- [ ] **Step 4 : Handler deep link** — dans le composant `RootLayout`, ajouter un effet (à côté du `useEffect` des polices) :
```tsx
useEffect(() => {
  const handleUrl = (url: string | null) => {
    const params = parseRecoveryParams(url);
    if (!params) return;
    getSupabase()
      .auth.setSession(params)
      .then(() => router.push("/reset-password"))
      .catch(() => {});
  };
  Linking.getInitialURL().then(handleUrl);
  const sub = Linking.addEventListener("url", (e) => handleUrl(e.url));
  return () => sub.remove();
}, []);
```

- [ ] **Step 5 : Route** — dans le `<Stack ...>`, ajouter (à côté des autres `Stack.Screen`) :
```tsx
<Stack.Screen name="reset-password" options={{ headerShown: false }} />
```

- [ ] **Step 6 : Typecheck + commit**

Run (depuis `apps/mobile`) : `npx tsc --noEmit` → 0 erreur.
```bash
git add apps/mobile/src/app/_layout.tsx apps/mobile/package.json package-lock.json
git commit -m "feat(mobile): capter le lien de reset (deep link) + route reset-password" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 : Vérification + config Supabase

- [ ] **Step 1 : Typecheck global** — (depuis `apps/mobile`) `npx tsc --noEmit` → 0 erreur.

- [ ] **Step 2 : Bundle one-shot**

Run (depuis `apps/mobile`) :
```bash
EXPO_OFFLINE=1 npx expo export --platform android --output-dir "$TEMP/lumoo-reset" 2>&1 | tail -6
```
Expected : `Exported: …`, **aucune** ligne `Unable to resolve`. Puis : `rm -rf "$TEMP/lumoo-reset"`.

- [ ] **Step 3 : Config Supabase (manuel — utilisateur)**
Dashboard → **Authentication → URL Configuration → Redirect URLs** : ajouter `lumoo://reset-password`. Pour tester en Expo Go, ajouter aussi l'URL imprimée par `Linking.createURL("reset-password")` (forme `exp://<ip>:<port>/--/reset-password`).

- [ ] **Step 4 : Test manuel (device)**
- [ ] Depuis l'app (déconnecté) → « Mot de passe oublié » → saisir l'email → email reçu.
- [ ] Tap sur le lien → **l'app s'ouvre** sur l'écran « Nouveau mot de passe ».
- [ ] Saisir un nouveau mot de passe (×2, ≥ 6) → « Mettre à jour » → écran succès.
- [ ] « Aller à la connexion » → se reconnecter avec le **nouveau** mot de passe.
- [ ] (Lien expiré → écran « Lien invalide ou expiré ».)

---

## Couverture du spec (self-review)

| Exigence spec | Tâche |
|---|---|
| `authRedirectUrl` (redirection lien) | Task 3 (Step 3) |
| Capture deep link + `setSession` | Task 3 (Step 4) + Task 1 (parsing) |
| Route `reset-password` enregistrée | Task 3 (Step 5) |
| Écran saisie nouveau mdp + `updateUser` + signOut | Task 2 |
| État lien invalide/expiré | Task 2 (garde `hasSession`) |
| Flux implicite (pas de changement `core`) | Tasks 1-3 (parse fragment, aucun `flowType`) |
| Config Supabase Redirect URLs | Task 4 (Step 3) |
| Vérif (tsc + bundle + manuel) | Task 4 |
