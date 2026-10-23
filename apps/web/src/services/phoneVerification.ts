import { getSupabase } from '@lumoo/core';

function normalizeMaliPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (/^223\d{8}$/.test(digits)) return `+${digits}`;
  if (/^\d{8}$/.test(digits)) return `+223${digits}`;
  throw new Error('Saisissez un numéro malien valide à 8 chiffres.');
}

export async function sendPhoneVerificationCode(phone: string): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke<{ sent: boolean }>('phone-verification', {
    body: { action: 'send', phone: normalizeMaliPhone(phone) },
  });

  if (error) throw new Error("Le SMS n'a pas pu être envoyé. Vérifiez le numéro et réessayez.");
  if (!data?.sent) throw new Error("Le SMS n'a pas pu être envoyé. Réessayez plus tard.");
}

export async function verifyPhoneCode(phone: string, code: string): Promise<boolean> {
  const { data, error } = await getSupabase().functions.invoke<{ verified: boolean }>('phone-verification', {
    body: { action: 'verify', phone: normalizeMaliPhone(phone), code: code.trim() },
  });

  if (error) throw new Error('La vérification est temporairement indisponible. Réessayez.');
  return data?.verified === true;
}
