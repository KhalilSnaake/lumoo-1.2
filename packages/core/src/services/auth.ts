import { User, RegisterInput } from '../types/auth';
import { getSupabase, getAuthRedirectUrl } from '../lib/supabaseClient';

const PROFILE_COLUMNS = 'id, name, email, phone, role, avatar, blocked, created_at';

// Construit le User de l'app à partir de la session Supabase + la ligne profiles.
function toUser(authUserId: string, authEmail: string | undefined, profile: any): User {
  return {
    id: authUserId,
    name: profile?.name ?? '',
    email: profile?.email ?? authEmail ?? '',
    phone: profile?.phone ?? '',
    role: profile?.role ?? 'client',
    createdAt: profile?.created_at ?? new Date().toISOString(),
    avatar: profile?.avatar ?? '',
    blocked: profile?.blocked ?? false,
  };
}

async function fetchProfile(userId: string): Promise<any | null> {
  const supabase = getSupabase();
  const { data } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single();
  return data;
}

export async function apiLogin(email: string, password: string): Promise<User | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    if (error.message?.toLowerCase().includes('invalid')) return null; // identifiants incorrects
    throw new Error(error.message || 'Erreur lors de la connexion');
  }
  if (!data.user) return null;
  const profile = await fetchProfile(data.user.id);
  if (profile?.blocked) {
    await supabase.auth.signOut();
    throw new Error('Votre compte est bloqué. Contactez un administrateur.');
  }
  return toUser(data.user.id, data.user.email, profile);
}

export async function apiRegister(input: RegisterInput): Promise<User | null> {
  const supabase = getSupabase();
  const email = input.email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { name: input.name, phone: input.phone.trim() } },
  });
  if (error) throw new Error(error.message || 'Erreur lors de la création du compte');
  if (!data.user) return null;
  const profile = await fetchProfile(data.user.id);
  return toUser(data.user.id, data.user.email, profile);
}

// Option simple : la création de compte par l'admin n'est plus possible (clé service requise).
export async function apiCreateUser(_input: RegisterInput): Promise<User | null> {
  throw new Error("La création de compte par l'admin n'est pas disponible. L'utilisateur doit s'inscrire lui-même.");
}

export async function apiLogout(): Promise<void> {
  const supabase = getSupabase();
  await supabase.auth.signOut();
}

export async function apiGetCurrentUser(): Promise<User | null> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const profile = await fetchProfile(session.user.id);
  if (profile?.blocked) {
    await supabase.auth.signOut();
    return null;
  }
  return toUser(session.user.id, session.user.email, profile);
}

export async function apiGetAllUsers(): Promise<User[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((p: any) => toUser(p.id, p.email, p));
}

// Met à jour le profil (name/phone/role/avatar/blocked). Email/mot de passe NON modifiables ici.
export async function apiUpdateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const supabase = getSupabase();
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.phone !== undefined) updateData.phone = updates.phone;
  if (updates.role !== undefined) updateData.role = updates.role;
  if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
  if (updates.blocked !== undefined) updateData.blocked = updates.blocked;

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error || !data) return null;
  return toUser(data.id, data.email, data);
}

// Option simple : suppression de compte non disponible (clé service requise). Utiliser le blocage.
export async function apiDeleteUser(_id: string): Promise<boolean> {
  return false;
}

export async function seedDefaultAdmin() {
  // Plus de seed maison : l'admin se crée via inscription puis passage role='admin' (SQL/console).
  return null;
}

// Changement de SON PROPRE mot de passe (utilisateur connecté).
export async function apiUpdateOwnPassword(newPassword: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message || 'Erreur lors du changement de mot de passe');
}

// Demande de reset par email.
export async function apiRequestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: getAuthRedirectUrl(),
  });
  if (error) throw new Error(error.message || 'Erreur lors de la demande de réinitialisation');
}
