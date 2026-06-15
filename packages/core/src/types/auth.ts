export type UserRole = 'admin' | 'client' | 'livreur';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string; // jamais lu côté client : la vérification se fait côté serveur (fonction login_user)
  role: UserRole;
  createdAt: string;
  avatar: string;
  blocked: boolean;
  address?: string;
  city?: string;
}

export interface AuthContextType {
  user: User | null;
  users: User[];
  login: (email: string, password: string) => Promise<User | null>;
  register: (data: RegisterInput) => Promise<{ user: User | null; needsConfirmation: boolean }>;
  createUser: (data: RegisterInput) => Promise<User | null>;
  logout: () => void;
  updateUser: (id: string, updates: Partial<User>) => Promise<User | null>;
  deleteUser: (id: string) => Promise<boolean>;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isLivreur: boolean;
  isClient: boolean;
  showAuth: boolean;
  setShowAuth: (show: boolean) => void;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  updateOwnPassword: (newPassword: string) => Promise<void>;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
}
