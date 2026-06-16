import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, Phone, User } from "lucide-react-native";
import { router } from "expo-router";
import { apiRequestPasswordReset, useAuth, LEGAL_DOC_LINKS } from "@lumoo/core";
import { HomeBanner } from "./ad-banner";

type Mode = "login" | "register" | "reset";

const CARD_SHADOW = {
  shadowColor: "#0F172A",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

export function AuthForm() {
  const { login, register } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [signupSent, setSignupSent] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const kbTopRef = useRef(0);
  const focusedRef = useRef<TextInput | null>(null);
  const [kbHeight, setKbHeight] = useState(0);

  // Remonte le champ focalisé juste au-dessus du clavier (coordonnées écran absolues
  // via measureInWindow + screenY → robuste sur Android resize/pan et nouvelle archi).
  const ensureVisible = useCallback((node: TextInput | null) => {
    const scroller = scrollRef.current;
    if (!node || !scroller) return;
    node.measureInWindow((_x, y, _w, h) => {
      const kbTop = kbTopRef.current;
      if (kbTop <= 0) return;
      const overlap = y + h + 24 - kbTop;
      if (overlap > 0) {
        scroller.scrollTo({ y: scrollYRef.current + overlap, animated: true });
      }
    });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      kbTopRef.current = e.endCoordinates.screenY;
      setKbHeight(e.endCoordinates.height);
      setTimeout(() => ensureVisible(focusedRef.current), 60);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      kbTopRef.current = 0;
      setKbHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ensureVisible]);

  const handleFieldFocus = useCallback(
    (node: TextInput | null) => {
      focusedRef.current = node;
      if (kbTopRef.current > 0) setTimeout(() => ensureVisible(node), 60);
    },
    [ensureVisible],
  );

  const isRegister = mode === "register";
  const isReset = mode === "reset";

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setInfo(null);
    setSignupSent(false);
  }

  async function submit() {
    setError(null);
    setInfo(null);

    const mail = email.trim().toLowerCase();

    if (isReset) {
      if (!mail) {
        setError("Renseigne ton email.");
        return;
      }
      setLoading(true);
      try {
        await apiRequestPasswordReset(mail);
        setInfo(
          "Si un compte existe, un email de réinitialisation a été envoyé. Ouvre le lien pour choisir un nouveau mot de passe.",
        );
        setMode("login");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Une erreur est survenue. Réessaie.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!mail || !password) {
      setError("Renseigne ton email et ton mot de passe.");
      return;
    }
    if (isRegister && (!name.trim() || !phone.trim())) {
      setError("Renseigne ton nom et ton téléphone.");
      return;
    }
    if (isRegister) {
      if (password !== confirmPassword) {
        setError("Les mots de passe ne correspondent pas.");
        return;
      }
      if (password.length < 6) {
        setError("Le mot de passe doit avoir au moins 6 caractères.");
        return;
      }
      if (!/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        setError("Le mot de passe doit contenir au moins 1 majuscule, 1 chiffre et 1 caractère spécial.");
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegister) {
        const { needsConfirmation } = await register({ name: name.trim(), email: mail, phone: phone.trim(), password, role: "client" });
        setPassword("");
        setConfirmPassword("");
        if (needsConfirmation) {
          setSignupSent(true);
        } else {
          setInfo("Compte créé. Tu peux te connecter.");
          setMode("login");
        }
      } else {
        const u = await login(mail, password);
        if (!u) setError("Email ou mot de passe incorrect.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: kbHeight + 32 }}
      onScroll={(e) => {
        scrollYRef.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
        {/* Hero marque */}
        <View className="mb-6">
          <HomeBanner />
        </View>

        {/* Carte formulaire */}
        {signupSent ? (
          <View className="items-center rounded-3xl bg-white p-6" style={CARD_SHADOW}>
            <Text className="text-5xl">📬</Text>
            <Text className="mt-3 font-display text-xl text-gray-900">Vérifie ta boîte mail</Text>
            <Text className="mt-1 text-center font-body text-gray-500">
              Un email d&apos;activation a été envoyé à{" "}
              <Text className="font-display text-gray-700">{email.trim().toLowerCase()}</Text>.
            </Text>
            <View className="mt-4 w-full rounded-2xl bg-green-50 p-4">
              <Text className="font-body text-sm text-gray-700">1. Ouvre l&apos;email de Lumoo.</Text>
              <Text className="mt-1.5 font-body text-sm text-gray-700">2. Clique sur le lien d&apos;activation.</Text>
              <Text className="mt-1.5 font-body text-sm text-gray-700">3. Reviens te connecter ici.</Text>
            </View>
            <Text className="mt-3 text-center font-body text-xs text-gray-400">
              Pense à vérifier tes spams.
            </Text>
            <Pressable
              onPress={() => { setSignupSent(false); switchMode("login"); }}
              accessibilityRole="button"
              className="mt-5 h-12 w-full items-center justify-center rounded-2xl bg-brand active:opacity-80"
            >
              <Text className="font-display-semibold text-white">Aller à la connexion</Text>
            </Pressable>
          </View>
        ) : (
        <View className="rounded-3xl bg-white p-5" style={CARD_SHADOW}>
          {isReset ? (
            <View className="mb-5 flex-row items-center">
              <Pressable
                onPress={() => switchMode("login")}
                hitSlop={10}
                accessibilityLabel="Retour à la connexion"
                className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-gray-100"
              >
                <ArrowLeft size={18} color="#374151" />
              </Pressable>
              <Text className="font-display text-lg text-gray-900">Mot de passe oublié</Text>
            </View>
          ) : (
            <View className="mb-5 flex-row rounded-2xl bg-gray-100 p-1">
              <Segment label="Connexion" active={!isRegister} onPress={() => switchMode("login")} />
              <Segment label="Inscription" active={isRegister} onPress={() => switchMode("register")} />
            </View>
          )}

          <Text className="mb-4 text-gray-500">
            {isReset
              ? "Entre ton email, on t'envoie un lien pour réinitialiser ton mot de passe."
              : isRegister
                ? "Inscris-toi pour commander et suivre tes livraisons."
                : "Connecte-toi pour accéder à tes commandes."}
          </Text>

          {isRegister && (
            <Field
              label="Nom complet"
              icon={<User size={18} color="#9CA3AF" />}
              value={name}
              onChangeText={setName}
              placeholder="Ex. Aïssata Traoré"
              autoCapitalize="words"
              onFocusNode={handleFieldFocus}
            />
          )}
          <Field
            label="Email"
            icon={<Mail size={18} color="#9CA3AF" />}
            value={email}
            onChangeText={setEmail}
            placeholder="ton@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            onFocusNode={handleFieldFocus}
          />
          {isRegister && (
            <Field
              label="Téléphone"
              icon={<Phone size={18} color="#9CA3AF" />}
              value={phone}
              onChangeText={setPhone}
              placeholder="Ex. 70 00 00 00"
              keyboardType="phone-pad"
              onFocusNode={handleFieldFocus}
            />
          )}
          {!isReset && (
            <Field
              label="Mot de passe"
              icon={<Lock size={18} color="#9CA3AF" />}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              onFocusNode={handleFieldFocus}
              right={
                <Pressable
                  onPress={() => setShowPassword((s) => !s)}
                  hitSlop={10}
                  accessibilityLabel={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#9CA3AF" />
                  ) : (
                    <Eye size={18} color="#9CA3AF" />
                  )}
                </Pressable>
              }
            />
          )}

          {isRegister && (
            <Text className="mb-3 ml-1 font-body text-[11px] text-gray-400">
              Min. 6 caractères, avec 1 majuscule, 1 chiffre et 1 caractère spécial.
            </Text>
          )}

          {isRegister && (
            <Field
              label="Confirmer le mot de passe"
              icon={<Lock size={18} color="#9CA3AF" />}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              onFocusNode={handleFieldFocus}
              right={
                <Pressable
                  onPress={() => setShowConfirm((s) => !s)}
                  hitSlop={10}
                  accessibilityLabel={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showConfirm ? (
                    <EyeOff size={18} color="#9CA3AF" />
                  ) : (
                    <Eye size={18} color="#9CA3AF" />
                  )}
                </Pressable>
              }
            />
          )}

          {!isRegister && !isReset && (
            <Pressable
              onPress={() => switchMode("reset")}
              hitSlop={8}
              accessibilityRole="button"
              className="mb-2 min-h-9 items-end justify-center"
            >
              <Text className="text-sm font-semibold text-brand">Mot de passe oublié ?</Text>
            </Pressable>
          )}

          {!!error && (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              className="mb-2 ml-1 font-semibold text-red-600"
            >
              {error}
            </Text>
          )}
          {!!info && (
            <Text
              accessibilityLiveRegion="polite"
              className="mb-2 ml-1 font-semibold text-brand"
            >
              {info}
            </Text>
          )}

          <Pressable
            onPress={submit}
            disabled={loading}
            accessibilityRole="button"
            style={CARD_SHADOW}
            className={`mt-3 h-12 flex-row items-center justify-center rounded-2xl bg-brand active:opacity-80 ${
              loading ? "opacity-60" : ""
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-base font-display-semibold text-white">
                {isReset ? "Envoyer le lien" : isRegister ? "Créer mon compte" : "Se connecter"}
              </Text>
            )}
          </Pressable>

          {isReset && (
            <Pressable
              onPress={() => switchMode("login")}
              hitSlop={8}
              accessibilityRole="button"
              className="mt-4 min-h-9 items-center justify-center"
            >
              <Text className="font-semibold text-brand">Retour à la connexion</Text>
            </Pressable>
          )}
        </View>
        )}

        <LegalFooter />
    </ScrollView>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={active ? { shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 } : undefined}
      className={`h-10 flex-1 items-center justify-center rounded-xl ${active ? "bg-white" : ""}`}
    >
      <Text className={`font-display ${active ? "text-brand" : "text-gray-500"}`}>{label}</Text>
    </Pressable>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  icon: ReactNode;
  right?: ReactNode;
  onFocusNode?: (node: TextInput | null) => void;
};

function Field({ label, icon, right, onFocus, onBlur, onFocusNode, ...inputProps }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  return (
    <View className="mb-3">
      <Text className="mb-1 ml-1 text-xs font-semibold text-gray-500">{label}</Text>
      <View
        className={`min-h-12 flex-row items-center rounded-2xl border bg-white px-3 ${
          focused ? "border-brand" : "border-gray-200"
        }`}
      >
        {icon}
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          className="flex-1 px-2 py-3 text-gray-900"
          placeholderTextColor="#9CA3AF"
          {...inputProps}
          onFocus={(e) => { setFocused(true); onFocusNode?.(inputRef.current); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        />
        {right}
      </View>
    </View>
  );
}

function LegalFooter() {
  const rows: { slug: string; label: string }[][] = [];
  for (let i = 0; i < LEGAL_DOC_LINKS.length; i += 2) {
    rows.push(LEGAL_DOC_LINKS.slice(i, i + 2));
  }
  return (
    <View className="mt-16">
      <Text className="mb-5 px-6 text-center font-body text-xs leading-5 text-gray-500">
        En créant un compte, tu acceptes :
      </Text>
      <View className="gap-3">
        {rows.map((row, ri) => (
          <View key={ri} className="flex-row gap-3">
            {row.map((l) => (
              <Pressable
                key={l.slug}
                onPress={() => router.push(`/legal/${l.slug}`)}
                accessibilityRole="link"
                accessibilityLabel={l.label}
                className="min-h-12 flex-1 items-center justify-center rounded-2xl border border-gray-200 bg-white px-3 active:opacity-70"
              >
                <Text className="font-body-semibold text-xs text-brand">{l.label}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
