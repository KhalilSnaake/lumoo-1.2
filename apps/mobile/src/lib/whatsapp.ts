import { Linking } from "react-native";

export const WHATSAPP_PHONE = "22377996858";

// Purs (testables) :
export const catalogUrl = () => `https://wa.me/c/${WHATSAPP_PHONE}`;
export const orderUrl = (text: string) =>
  `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;

// Effets :
export const openCatalog = () => Linking.openURL(catalogUrl());
export const openOrder = (text: string) => Linking.openURL(orderUrl(text));
