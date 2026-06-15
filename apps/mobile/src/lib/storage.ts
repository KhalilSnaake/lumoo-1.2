import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AsyncStorageLike } from "@lumoo/core";

export const mobileStorage: AsyncStorageLike = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
