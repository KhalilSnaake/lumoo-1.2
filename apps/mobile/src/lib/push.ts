import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { apiRegisterDeviceToken } from "@lumoo/core";
import { getDeviceId } from "./device-id";

// Afficher les notifications même quand l'app est au premier plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Demande la permission, récupère l'ExpoPushToken et l'enregistre (lié au user_id si connecté).
// No-op silencieux si refus / simulateur / pas de projectId.
export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Commandes Lumoo",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#16a34a",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } })?.easConfig?.projectId;
  if (!projectId) return;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await apiRegisterDeviceToken(token, await getDeviceId(), Platform.OS);
}
