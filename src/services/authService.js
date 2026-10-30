import { requireSupabase } from '../lib/supabase.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 6;

/**
 * Valida los datos del formulario de registro (Register.jsx) antes de llamar a Supabase.
 * Devuelve un mensaje de error en español o null si todo es correcto.
 */
export function validateSignUp({ email, confirmEmail, password }) {
  const cleanEmail = (email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) return 'Escribe un correo electrónico válido.';
  if (confirmEmail !== undefined && cleanEmail !== (confirmEmail ?? '').trim().toLowerCase()) {
    return 'Los correos no coinciden.';
  }
  if ((password ?? '').length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

// Las contraseñas nunca se guardan aquí: Supabase Auth las almacena con hash.
export function createAuthService(getClient = requireSupabase) {
  return {
    async signUp({ email, confirmEmail, password, nickname }) {
      const invalid = validateSignUp({ email, confirmEmail, password });
      if (invalid) return { user: null, session: null, error: invalid };

      const { data, error } = await getClient().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: nickname ? { data: { nickname: nickname.trim() } } : undefined,
      });
      if (error) return { user: null, session: null, error: error.message };
      return { user: data.user, session: data.session, error: null };
    },

    async signIn({ email, password }) {
      const { data, error } = await getClient().auth.signInWithPassword({
        email: (email ?? '').trim().toLowerCase(),
        password: password ?? '',
      });
      if (error) return { user: null, session: null, error: error.message };
      return { user: data.user, session: data.session, error: null };
    },

    async signOut() {
      const { error } = await getClient().auth.signOut();
      return { error: error ? error.message : null };
    },

    async getSession() {
      const { data, error } = await getClient().auth.getSession();
      if (error) return { session: null, error: error.message };
      return { session: data.session, error: null };
    },

    onAuthChange(callback) {
      const { data } = getClient().auth.onAuthStateChange((_event, session) => callback(session));
      return () => data.subscription.unsubscribe();
    },
  };
}

export const authService = createAuthService();
