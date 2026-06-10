import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { User, RegisterInput, AuthContextType } from '../types/auth';
import { apiLogin, apiRegister, apiCreateUser, apiLogout, apiGetCurrentUser, apiGetAllUsers, apiUpdateUser, apiDeleteUser, seedDefaultAdmin } from '../services/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    seedDefaultAdmin();
    apiGetCurrentUser().then(u => {
      if (u && u.blocked) { setUser(null); } else { setUser(u); }
      setInitialized(true);
    });
  }, []);

  const refreshUsers = useCallback(async () => {
    const data = await apiGetAllUsers();
    setUsers(data);
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') refreshUsers();
  }, [user?.role, refreshUsers]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const u = await apiLogin(email, password);
      if (u) {
        setUser(u);
        setShowAuth(false);
      }
      return u;
    } catch (err: any) {
      throw err;
    }
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

  if (!initialized) return null;

  return (
    <AuthContext.Provider value={{
      user, users, login, register, createUser, logout, updateUser, deleteUser,
      isLoggedIn: !!user,
      isAdmin: user?.role === 'admin',
      isLivreur: user?.role === 'livreur',
      isClient: user?.role === 'client',
      showAuth, setShowAuth,
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
