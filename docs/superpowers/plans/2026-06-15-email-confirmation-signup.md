# Plan d'implémentation — Confirmation d'email à l'inscription

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activer la confirmation d'email à l'inscription : l'inscription ne connecte plus directement, l'app/web affiche « vérifie ta boîte mail », et le lien de l'email confirme le compte (deep link mobile / auto web).

**Architecture:** `apiRegister` (core) passe à `{ user, needsConfirmation }` (répercuté sur `AuthContext.register`, le type, web et mobile). Le mobile unifie son deep link en `auth-callback` et route par `type` (recovery→reset, signup→connecté).

**Tech Stack:** `@lumoo/core` (Supabase Auth), Expo Router, expo-linking, React (web Vite).

**Spec :** `docs/superpowers/specs/2026-06-15-email-confirmation-signup.md`.

> **Tests :** pas de jest → vérif = assertions Node (fonctions pures), `tsc --noEmit` sur **core + web + mobile**, bundle mobile, test manuel.
> **Déjà en place :** `getAuthRedirectUrl` est importé dans `services/auth.ts`. Le reset (parseRecoveryParams, écran reset-password, handler `_layout`) existe **non commité** — ce lot le généralise.

---

## Structure des fichiers

**Créés** : `apps/mobile/src/app/auth-callback.tsx`
**Modifiés** : `packages/core/src/services/auth.ts`, `packages/core/src/context/AuthContext.tsx`, `packages/core/src/types/auth.ts`, `apps/mobile/src/lib/recovery-link.ts`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/components/auth-form.tsx`, `apps/web/src/components/AuthPage.tsx`

---

## Task 1 : Écran `auth-callback` (mobile)

**Files:** Create `apps/mobile/src/app/auth-callback.tsx`

- [ ] **Step 1 : Écran spinner**

Créer `apps/mobile/src/app/auth-callback.tsx` avec EXACTEMENT :
```tsx
import { View, ActivityIndicator } from "react-native";

export default function AuthCallbackScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50">
      <ActivityIndicator color="#16a34a" />
    </View>
  );
}
```

- [ ] **Step 2 : Typecheck + commit** — (depuis `apps/mobile`) `npx tsc --noEmit` → 0 erreur.
```bash
git add apps/mobile/src/app/auth-callback.tsx
git commit -m "feat(mobile): écran auth-callback (deep link auth)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Généraliser `parseAuthCallback` (mobile)

**Files:** Modify `apps/mobile/src/lib/recovery-link.ts`

- [ ] **Step 1 : Test (assertion Node)**

Run (racine) :
```bash
node -e "
function parse(url){ if(!url) return null; const i=url.indexOf('#'); if(i===-1) return null; const p=new URLSearchParams(url.slice(i+1)); const t=p.get('type'); if(!t||!['recovery','signup','email'].includes(t)) return null; const a=p.get('access_token'), r=p.get('refresh_token'); if(!a||!r) return null; return {type:t, access_token:a, refresh_token:r}; }
console.assert(parse('lumoo://auth-callback#access_token=A&refresh_token=B&type=recovery').type==='recovery','KO1');
console.assert(parse('lumoo://auth-callback#access_token=A&refresh_token=B&type=signup').type==='signup','KO2');
console.assert(parse('lumoo://x#type=magiclink&access_token=A&refresh_token=B')===null,'KO3');
console.assert(parse('lumoo://x')===null,'KO4');
console.log('OK parseAuthCallback');
"
```
Expected : `OK parseAuthCallback`

- [ ] **Step 2 : Remplacer le contenu de `recovery-link.ts`** par EXACTEMENT :
```ts
export type AuthCallbackType = "recovery" | "signup" | "email";
export type AuthCallback = { type: AuthCallbackType; access_token: string; refresh_token: string };

const TYPES: AuthCallbackType[] = ["recovery", "signup", "email"];

/** Extrait `type` + tokens d'un lien d'auth Supabase (flux implicite, fragment `#`). */
export function parseAuthCallback(url: string | null): AuthCallback | null {
  if (!url) return null;
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;
  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const type = params.get("type");
  if (!type || !TYPES.includes(type as AuthCallbackType)) return null;
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { type: type as AuthCallbackType, access_token, refresh_token };
}

/** Compat ascendante : restreint au type recovery (consommé par `_layout` jusqu'à Task 4). */
export function parseRecoveryParams(url: string | null) {
  const cb = parseAuthCallback(url);
  return cb && cb.type === "recovery"
    ? { access_token: cb.access_token, refresh_token: cb.refresh_token }
    : null;
}
```
*(Le wrapper garde `_layout` compilable ; Task 4 le rendra inutile — on le retire là.)*

- [ ] **Step 3 : Typecheck + commit** — (depuis `apps/mobile`) `npx tsc --noEmit` → 0 erreur (le wrapper garde `_layout` compilable).
```bash
git add apps/mobile/src/lib/recovery-link.ts
git commit -m "refactor(mobile): parseAuthCallback (généralise parseRecoveryParams)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : `core` — `apiRegister` + `register` + appelants (cross-cutting)

> Le changement de type de `register` touche **core + web + mobile** : tout dans **un seul commit** pour que `tsc` passe partout. `auth-form.tsx` et `AuthPage.tsx` sont édités par l'utilisateur → **intégrer en lisant la version courante**.

**Files:** Modify `packages/core/src/services/auth.ts`, `packages/core/src/context/AuthContext.tsx`, `packages/core/src/types/auth.ts`, `apps/mobile/src/components/auth-form.tsx`, `apps/web/src/components/AuthPage.tsx`

- [ ] **Step 1 : `apiRegister`** — remplacer la fonction `apiRegister` de `services/auth.ts` par :
```ts
export async function apiRegister(
  input: RegisterInput,
): Promise<{ user: User | null; needsConfirmation: boolean }> {
  const supabase = getSupabase();
  const email = input.email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: { name: input.name, phone: input.phone.trim() },
      emailRedirectTo: getAuthRedirectUrl(),
    },
  });
  if (error) throw new Error(error.message || 'Erreur lors de la création du compte');
  const needsConfirmation = !data.session;
  if (needsConfirmation || !data.user) {
    return { user: null, needsConfirmation };
  }
  const profile = await fetchProfile(data.user.id);
  return { user: toUser(data.user.id, data.user.email, profile), needsConfirmation };
}
```
*(`getAuthRedirectUrl` est déjà importé dans ce fichier.)*

- [ ] **Step 2 : `AuthContext.register`** — remplacer le `register` de `context/AuthContext.tsx` par :
```tsx
  const register = useCallback(async (input: RegisterInput) => {
    const { user: u, needsConfirmation } = await apiRegister(input);
    if (u && !needsConfirmation) { setUser(u); setShowAuth(false); }
    return { user: u, needsConfirmation };
  }, []);
```

- [ ] **Step 3 : Type** — dans `types/auth.ts`, remplacer la ligne `register` de `AuthContextType` par :
```ts
  register: (data: RegisterInput) => Promise<{ user: User | null; needsConfirmation: boolean }>;
```

- [ ] **Step 4 : Mobile `auth-form.tsx`** — dans le bloc `isRegister` de `submit`, remplacer l'appel à `register(...)` + le message par :
```tsx
        const { needsConfirmation } = await register({ name: name.trim(), email: mail, phone: phone.trim(), password, role: "client" });
        setInfo(
          needsConfirmation
            ? "📬 Vérifie ta boîte mail pour activer ton compte, puis connecte-toi."
            : "Compte créé. Tu peux te connecter.",
        );
        setPassword("");
        setMode("login");
```
*(Lire la version courante : conserver la structure existante, ne remplacer que ces lignes.)*

- [ ] **Step 5 : Web `AuthPage.tsx`** — (a) ajouter un état après les états register : `const [regSent, setRegSent] = useState(false);` ; (b) dans `handleTabChange`, ajouter `setRegSent(false);` ; (c) dans `handleRegister`, remplacer le bloc succès par :
```tsx
      const { user, needsConfirmation } = await register({ name: regName, email: regEmail, phone: regPhone, password: regPassword, role: regRole });
      if (needsConfirmation) {
        setRegSent(true);
      } else if (user) {
        showToast(`Compte créé avec succès ! Bienvenue ${user.name}`);
      } else {
        setError("Erreur lors de l'inscription (réponse vide)");
      }
```
(d) envelopper le formulaire register : `{mode === 'register' && !regSent && (<form ...>…</form>)}` et ajouter après :
```tsx
          {mode === 'register' && regSent && (
            <div className="p-6 space-y-4 text-center animate-bounce-in">
              <span className="text-5xl block">📬</span>
              <h3 className="text-lg font-extrabold text-gray-800">Vérifiez votre boîte mail</h3>
              <p className="text-sm text-gray-500">
                Un email d'activation a été envoyé à <span className="font-bold text-gray-700">{regEmail}</span>.
              </p>
              <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-left space-y-1.5">
                <p className="text-xs text-gray-600"><span className="font-bold text-green-700">1.</span> Ouvrez l'email de Lumoo.</p>
                <p className="text-xs text-gray-600"><span className="font-bold text-green-700">2.</span> Cliquez sur le lien d'activation.</p>
                <p className="text-xs text-gray-600"><span className="font-bold text-green-700">3.</span> Connectez-vous.</p>
              </div>
              <p className="text-[11px] text-gray-400">Pensez à vérifier vos spams.</p>
              <button
                type="button"
                onClick={() => { setRegSent(false); handleTabChange('login'); }}
                className="w-full py-3.5 bg-gray-50 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-all text-sm"
              >
                ← Aller à la connexion
              </button>
            </div>
          )}
```

- [ ] **Step 6 : Typecheck les 3 packages + commit**

Run :
```bash
( cd packages/core && npx tsc --noEmit ) && ( cd apps/mobile && npx tsc --noEmit ) && ( cd apps/web && npx tsc --noEmit ) && echo "ALL TSC OK"
```
Expected : `ALL TSC OK` (0 erreur partout).
```bash
git add packages/core/src/services/auth.ts packages/core/src/context/AuthContext.tsx packages/core/src/types/auth.ts apps/mobile/src/components/auth-form.tsx apps/web/src/components/AuthPage.tsx
git commit -m "feat(auth): confirmation d'email à l'inscription (needsConfirmation)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 : `_layout` — callback unifié + route par `type`

> ⚠️ `_layout.tsx` est édité par l'utilisateur → **intégrer en lisant la version courante** (ne pas réécrire providers/Stack/écrans).

**Files:** Modify `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1 : Import** — remplacer `import { parseRecoveryParams } from "@/lib/recovery-link";` par :
```tsx
import { parseAuthCallback } from "@/lib/recovery-link";
```
Puis **retirer** le wrapper `parseRecoveryParams` devenu inutile dans `apps/mobile/src/lib/recovery-link.ts`, et l'ajouter au commit de cette tâche (`git add` les deux fichiers au Step 5).

- [ ] **Step 2 : authRedirectUrl** — remplacer `authRedirectUrl: Linking.createURL("reset-password"),` par :
```tsx
  authRedirectUrl: Linking.createURL("auth-callback"),
```

- [ ] **Step 3 : Handler** — remplacer le corps du `useEffect` de deep link par :
```tsx
  useEffect(() => {
    const handleUrl = (url: string | null) => {
      const cb = parseAuthCallback(url);
      if (!cb) return;
      getSupabase()
        .auth.setSession({ access_token: cb.access_token, refresh_token: cb.refresh_token })
        .then(() => {
          if (cb.type === "recovery") router.push("/reset-password");
          else router.replace("/(tabs)");
        })
        .catch(() => {});
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener("url", (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);
```

- [ ] **Step 4 : Route** — dans le `<Stack>`, ajouter à côté de `reset-password` :
```tsx
                <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
```

- [ ] **Step 5 : Typecheck + commit** — (depuis `apps/mobile`) `npx tsc --noEmit` → 0 erreur (le reset doit toujours compiler).
```bash
git add apps/mobile/src/app/_layout.tsx apps/mobile/src/lib/recovery-link.ts
git commit -m "feat(mobile): callback auth unifié (reset + confirmation) par type" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 : Vérification + config Supabase

- [ ] **Step 1 : Typecheck global**
```bash
( cd packages/core && npx tsc --noEmit ) && ( cd apps/mobile && npx tsc --noEmit ) && ( cd apps/web && npx tsc --noEmit ) && echo "ALL TSC OK"
```
Expected : `ALL TSC OK`.

- [ ] **Step 2 : Bundle one-shot mobile**
```bash
cd apps/mobile && EXPO_OFFLINE=1 npx expo export --platform android --output-dir "$TEMP/lumoo-confirm" 2>&1 | tail -6 ; rm -rf "$TEMP/lumoo-confirm"
```
Expected : `Exported: …`, aucune ligne `Unable to resolve`.

- [ ] **Step 3 : Config Supabase (manuel — utilisateur)**
  - Authentication → Providers → Email → activer **« Confirm email »**.
  - Authentication → URL Configuration → **Redirect URLs** → ajouter `lumoo://auth-callback` (+ l'URL Expo Go `exp://…/--/auth-callback`).

- [ ] **Step 4 : Test manuel**
- [ ] Mobile : s'inscrire → message « 📬 Vérifie ta boîte mail » (pas de connexion auto).
- [ ] Email reçu → tap le lien → l'app s'ouvre, confirme et **connecte** (arrive sur les onglets).
- [ ] Reset password : toujours fonctionnel (lien → écran reset).
- [ ] Web : s'inscrire → panneau « Vérifiez votre boîte mail » ; cliquer le lien → confirmé.

---

## Couverture du spec (self-review)

| Exigence spec | Tâche |
|---|---|
| `apiRegister` emailRedirectTo + `{user, needsConfirmation}` | Task 3 (Step 1) |
| `AuthContext.register` + type | Task 3 (Steps 2-3) |
| Mobile message confirmation | Task 3 (Step 4) |
| Web panneau confirmation | Task 3 (Step 5) |
| `parseAuthCallback` (type) | Task 2 |
| Callback unifié + route par type + auth-callback | Tasks 1 & 4 |
| `tsc` core+web+mobile | Tasks 3 & 5 |
| Config Supabase | Task 5 (Step 3) |
| Reset toujours OK | Task 4 (route recovery) + Task 5 (test) |
