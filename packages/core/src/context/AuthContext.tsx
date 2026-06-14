import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { User, RegisterInput, AuthContextType } from '../types/auth';
import { getSupabase } from '../lib/supabaseClient';
import {
  apiLogin, apiRegister, apiCreateUser, apiLogout, apiGetCurrentUser,
  apiGetAllUsers, apiUpdateUser, apiDeleteUser, apiUpdateOwnPassword,
} from '../services/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    apiGetCurrentUser().then(u => {
      setUser(u);
      setInitialized(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      // Recharge l'utilisateur courant à chaque changement de session.
      apiGetCurrentUser().then(setUser);
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const refreshUsers = useCallback(async () => {
    const data = await apiGetAllUsers();
    setUsers(data);
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') refreshUsers();
  }, [user?.role, refreshUsers]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    if (u) { setUser(u); setShowAuth(false); }
    return u;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const u = await apiRegister(input);
    if (u) { setUser(u); setShowAuth(false); }
    return u;
  }, []);

  const createUser = useCallback(async (input: RegisterInput) => {
    const u = await apiCreateUser(input);
    refreshUsers();
    return u;
  }, [refreshUsers]);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    const updated = await apiUpdateUser(id, updates);
    if (updated && user?.id === id) setUser(updated);
    refreshUsers();
    return updated;
  }, [user?.id, refreshUsers]);

  const deleteUser = useCallback(async (id: string) => {
    await apiDeleteUser(id);
    refreshUsers();
    return true;
  }, [refreshUsers]);

  const clearPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);
  const updateOwnPassword = useCallback(async (newPassword: string) => {
    await apiUpdateOwnPassword(newPassword);
  }, []);

  if (!initialized) return null;

  return (
    <AuthContext.Provider value={{
      user, users, login, register, createUser, logout, updateUser, deleteUser,
      isLoggedIn: !!user,
      isAdmin: user?.role === 'admin',
      isLivreur: user?.role === 'livreur',
      isClient: user?.role === 'client',
      showAuth, setShowAuth,
      passwordRecovery, clearPasswordRecovery, updateOwnPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
