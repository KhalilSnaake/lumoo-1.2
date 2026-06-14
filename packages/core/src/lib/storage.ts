// Contrat compatible avec l'option `auth.storage` de supabase-js,
// satisfait par localStorage (web, via wrapper) et AsyncStorage (mobile).
export interface AsyncStorageLike {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
