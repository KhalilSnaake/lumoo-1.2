import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Animated, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Info, X } from "lucide-react-native";

type ToastType = "success" | "error" | "info";
type ToastState = { message: string; type: ToastType };

type ToastContextType = { show: (message: string, type?: ToastType) => void };

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const SHADOW = {
  shadowColor: "#0F172A",
  shadowOpacity: 0.18,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
} as const;

const BG: Record<ToastType, string> = {
  success: "bg-brand",
  error: "bg-red-600",
  info: "bg-gray-800",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (message: string, type: ToastType = "success") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, type });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
          setToast(null);
        });
      }, 2600);
    },
    [opacity],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: insets.bottom + 80,
            opacity,
            transform: [
              { translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
            ],
          }}
        >
          <View className={`flex-row items-center rounded-2xl px-4 py-3 ${BG[toast.type]}`} style={SHADOW}>
            {toast.type === "success" ? (
              <Check size={18} color="#ffffff" />
            ) : toast.type === "error" ? (
              <X size={18} color="#ffffff" />
            ) : (
              <Info size={18} color="#ffffff" />
            )}
            <Text className="ml-2 flex-1 font-body-semibold text-white">{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
