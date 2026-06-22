import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "lumoo.device_id";

// UUID v4 (identifiant d'appareil non-cryptographique — suffisant pour cibler le push).
function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(KEY);
  if (!id) {
    id = uuid();
    await AsyncStorage.setItem(KEY, id);
  }
  return id;
}
