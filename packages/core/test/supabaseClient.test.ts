import { describe, it, expect } from 'vitest';
import { initCore, getSupabase } from '../src/lib/supabaseClient';

// Les tests d'un même fichier partagent l'état du module (singleton) et s'exécutent dans l'ordre.
describe('core supabase client', () => {
  it('getSupabase() lève une erreur avant initCore()', () => {
    expect(() => getSupabase()).toThrowError(/initCore/);
  });

  it('initCore() crée un client et getSupabase() renvoie la même instance', () => {
    const client = initCore({
      supabaseUrl: 'http://localhost:54321',
      supabaseAnonKey: 'test-anon-key',
    });
    expect(client).toBeTruthy();
    expect(typeof client.from).toBe('function');
    expect(getSupabase()).toBe(client);
  });
});
