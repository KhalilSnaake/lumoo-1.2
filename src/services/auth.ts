import { User, UserRole, RegisterInput } from '../types/auth';
import { supabase } from '../lib/supabase';

const SESSION_KEY = 'lumoo_session';

// Colonnes lisibles côté client : JAMAIS `password`.
// Après le verrouillage SQL (PARTIE 2), la clé anon n'a plus le droit de lire `password`,
// donc on ne fait plus de `select('*')` sur la table users.
const USER_COLUMNS = 'id, name, email, phone, role, avatar, blocked, created_at';

const roleAvatars: Record<UserRole, string> = {
  admin: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
  client: 'https://api.dicebear.com/7.x/avataaars/svg?seed=client',
  livreur: 'https://api.dicebear.com/7.x/avataaars/svg?seed=livreur',
};

function generateId(): string {
  return 'USR-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
}

function getSession(): User | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function saveSession(user: User | null) {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: row.created_at,
    avatar: row.avatar,
    blocked: row.blocked || false,
  };
}

// Appelle la fonction serveur `login_user` (SECURITY DEFINER) : elle vérifie le mot de passe
// en interne (hash bcrypt) et ne renvoie JAMAIS le mot de passe.
async function callLoginRpc(identifier: string, password: string): Promise<any | null> {
  const { data, error } = await supabase.rpc('login_user', {
    identifier,
    pass: password,
  });
  if (error) {
    console.error('API Login Exception:', error);
    throw new Error('Erreur de connexion');
  }
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

export async function apiLogin(identifier: string, password: string): Promise<User | null> {
  const cleanId = identifier.trim();

  // Tentative directe (email ou téléphone tel que saisi)
  let row = await callLoginRpc(cleanId, password);

  // Repli téléphone : on retente en ne gardant que les chiffres et le +
  if (!row) {
    const strippedPhone = cleanId.replace(/[^\d+]/g, '');
    if (strippedPhone && strippedPhone !== cleanId) {
      row = await callLoginRpc(strippedPhone, password);
    }
  }

  if (!row) return null; // Identifiant introuvable ou mauvais mot de passe

  const user = rowToUser(row);
  if (user.blocked) throw new Error('Votre compte est bloqué. Contactez un administrateur.');
  saveSession(user);
  return user;
}

export async function apiRegister(input: RegisterInput): Promise<User | null> {
  const normalizedEmail = input.email.toLowerCase().trim();
  const normalizedPhone = input.phone.trim();
  const id = generateId();
  const createdAt = new Date().toISOString();
  const avatar = roleAvatars[input.role];

  // Le mot de passe est envoyé en clair puis hashé côté base par le trigger `trg_hash_user_password`.
  const { error } = await supabase.from('users').insert({
    id,
    name: input.name,
    email: normalizedEmail,
    phone: normalizedPhone,
    password: input.password,
    role: input.role,
    avatar,
    created_at: createdAt,
    blocked: false,
  });

  if (error) throw new Error(error.message || 'Erreur lors de la création du compte');

  // L'objet de session ne contient pas le mot de passe.
  const user: User = { id, name: input.name, email: normalizedEmail, phone: normalizedPhone, role: input.role, createdAt, avatar, blocked: false };
  saveSession(user);
  return user;
}

export async function apiCreateUser(input: RegisterInput): Promise<User | null> {
  const normalizedEmail = input.email.toLowerCase().trim();
  const normalizedPhone = input.phone.trim();
  const id = generateId();
  const createdAt = new Date().toISOString();
  const avatar = roleAvatars[input.role];

  const { error } = await supabase.from('users').insert({
    id,
    name: input.name,
    email: normalizedEmail,
    phone: normalizedPhone,
    password: input.password,
    role: input.role,
    avatar,
    created_at: createdAt,
    blocked: false,
  });

  if (error) {
    console.error('Supabase error:', error);
    return null;
  }
  return { id, name: input.name, email: normalizedEmail, phone: normalizedPhone, role: input.role, createdAt, avatar, blocked: false };
}

export async function apiLogout(): Promise<void> {
  saveSession(null);
}

export async function apiGetCurrentUser(): Promise<User | null> {
  const session = getSession();
  if (!session) return null;
  const { data } = await supabase.from('users').select(USER_COLUMNS).eq('id', session.id).single();
  if (!data || (data as any).blocked) {
    saveSession(null);
    return null;
  }
  return rowToUser(data);
}

export async function apiGetAllUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('users').select(USER_COLUMNS).order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(rowToUser);
}

export async function apiUpdateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.email !== undefined) updateData.email = updates.email.toLowerCase().trim();
  if (updates.phone !== undefined) updateData.phone = updates.phone;
  // Le nouveau mot de passe est envoyé en clair puis hashé côté base par le trigger.
  if (updates.password !== undefined) updateData.password = updates.password;
  if (updates.role !== undefined) updateData.role = updates.role;
  if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
  if (updates.blocked !== undefined) updateData.blocked = updates.blocked;

  const { data, error } = await supabase.from('users').update(updateData).eq('id', id).select(USER_COLUMNS).single();
  if (error || !data) return null;
  const user = rowToUser(data);
  const session = getSession();
  if (session && session.id === id) {
    if (user.blocked) saveSession(null);
    else saveSession(user);
  }
  return user;
}

export async function apiDeleteUser(id: string): Promise<boolean> {
  const { error } = await supabase.from('users').delete().eq('id', id);
  return !error;
}

export async function seedDefaultAdmin() {
  const { data } = await supabase.from('users').select('id').eq('id', 'USR-ADMIN-001').single();
  return data;
}
