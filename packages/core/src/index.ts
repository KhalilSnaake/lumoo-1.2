// Config / client
export { initCore, getSupabase, getAuthRedirectUrl } from './lib/supabaseClient';
export type { CoreConfig } from './lib/supabaseClient';
export type { AsyncStorageLike } from './lib/storage';

// Types métier
export * from './types';

// Services
export * from './services/api';
export * from './services/auth';
export * from './services/notifications';

// Contenu légal partagé (mobile + web)
export * from './legal/documents';

// Contenu légal partagé (CGU/CGV/confidentialité/mentions) — source unique web + mobile
export * from './legal/documents';

// Contexts (providers + hooks) — NOT ToastContext / ContactMessagesContext (web-only)
export * from './context/AuthContext';
export * from './context/CartContext';
export * from './context/OrderContext';
export * from './context/ProductContext';
// CategoryContext exports its own `Category` (with `created_at`) which conflicts with
// the canonical `Category` from ./types (with `createdAt`). Suppress the duplicate by
// listing explicit named exports — keeps CategoryContextType, CategoryProvider, useCategories.
export type { CategoryContextType } from './context/CategoryContext';
export { CategoryProvider, useCategories } from './context/CategoryContext';
export * from './context/AdContext';
export * from './context/NotificationContext';
export * from './context/SearchContext';
