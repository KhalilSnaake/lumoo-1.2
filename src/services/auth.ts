import { User, UserRole, RegisterInput } from '../types/auth';
import { supabase } from '../lib/supabase';

const SESSION_KEY = 'lumoo_session';

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
    password: row.password,
    role: row.role,
    createdAt: row.created_at,
    avatar: row.avatar,
    blocked: row.blocked || false,
  };
}

export async function apiLogin(identifier: string, password: string): Promise<User | null> {
  const cleanId = identifier.trim();
  const lowerId = cleanId.toLowerCase();
  
  try {
    // 1. Try to find user by email first
    const { data: byEmail, error: errorEmail } = await supabase
      .from('users')
      .select('*')
      .eq('email', lowerId)
      .eq('password', password)
      .maybeSingle();

    if (errorEmail) throw new Error('Erreur de connexion (Email)');
    if (byEmail) {
      const user = rowToUser(byEmail);
      if (user.blocked) throw new Error('Votre compte est bloqué. Contactez un administrateur.');
      saveSession(user);
      return user;
    }

    // 2. If not found, try to find by phone
    // We try exactly as entered
    const { data: byPhone, error: errorPhone } = await supabase
      .from('users')
      .select('*')
      .eq('phone', cleanId)
      .eq('password', password)
      .maybeSingle();

    if (errorPhone) throw new Error('Erreur de connexion (Phone)');
    if (byPhone) {
      const user = rowToUser(byPhone);
      if (user.blocked) throw new Error('Votre compte est bloqué. Contactez un administrateur.');
      saveSession(user);
      return user;
    }

    // 3. One more try for phone: stripping all non-digits except +
    const strippedPhone = cleanId.replace(/[^\d+]/g, '');
    if (strippedPhone !== cleanId) {
      const { data: byStrippedPhone } = await supabase
        .from('users')
        .select('*')
        .eq('phone', strippedPhone)
        .eq('password', password)
        .maybeSingle();
        
      if (byStrippedPhone) {
        const user = rowToUser(byStrippedPhone);
        if (user.blocked) throw new Error('Votre compte est bloqué.');
        saveSession(user);
        return user;
      }
    }

    return null; // Not found or wrong password
  } catch (err: any) {
    console.error('API Login Exception:', err);
    throw err;
  }
}

export async function apiRegister(input: RegisterInput): Promise<User | null> {
  const normalizedEmail = input.email.toLowerCase().trim();
  const normalizedPhone = input.phone.trim();
  
  const user: User = {
    id: generateId(),
    name: input.name,
    email: normalizedEmail,
    phone: normalizedPhone,
    password: input.password,
    role: input.role,
    createdAt: new Date().toISOString(),
    avatar: roleAvatars[input.role],
    blocked: false,
  };

  const { error } = await supabase.from('users').insert({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    password: user.password,
    role: user.role,
    avatar: user.avatar,
    created_at: user.createdAt,
    blocked: false
  });

  if (error) throw new Error(error.message || 'Erreur lors de la création du compte');
  saveSession(user);
  return user;

}

export async function apiCreateUser(input: RegisterInput): Promise<User | null> {
  const normalizedEmail = input.email.toLowerCase().trim();
  const normalizedPhone = input.phone.trim();
  
  const user: User = {
    id: generateId(),
    name: input.name,
    email: normalizedEmail,
    phone: normalizedPhone,
    password: input.password,
    role: input.role,
    createdAt: new Date().toISOString(),
    avatar: roleAvatars[input.role],
    blocked: false,
  };

  const { error } = await supabase.from('users').insert({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    password: user.password,
    role: user.role,
    avatar: user.avatar,
    created_at: user.createdAt,
    blocked: false
  });

  if (error) {
    console.error('Supabase error:', error);
    return null;
  }
  return user;
}

export async function apiLogout(): Promise<void> {
  saveSession(null);
}

export async function apiGetCurrentUser(): Promise<User | null> {
  const session = getSession();
  if (!session) return null;
  const { data } = await supabase.from('users').select('*').eq('id', session.id).single();
  if (!data || data.blocked) {
    saveSession(null);
    return null;
  }
  return rowToUser(data);
}

export async function apiGetAllUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(rowToUser);
}

export async function apiUpdateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.email !== undefined) updateData.email = updates.email.toLowerCase().trim();
  if (updates.phone !== undefined) updateData.phone = updates.phone;
  if (updates.password !== undefined) updateData.password = updates.password;
  if (updates.role !== undefined) updateData.role = updates.role;
  if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
  if (updates.blocked !== undefined) updateData.blocked = updates.blocked;

  const { data, error } = await supabase.from('users').update(updateData).eq('id', id).select().single();
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
