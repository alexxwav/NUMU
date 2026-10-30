import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { authService } from '../services/authService.js';
import { profileService } from '../services/profileService.js';
import { onboardingService, toStoreProfile } from '../services/onboardingService.js';
import { progressService } from '../services/progressService.js';
import { courseSlugForModule } from '../data/subjects.js';
import { store } from '../state/store.js';

const AuthContext = createContext(null);

// Carga lo guardado en la cuenta y lo vuelca en store.js, que sigue siendo la fuente de verdad de las vistas.
async function loadProfile(userId) {
  const [{ profile, error }, { diagnostic }, { progress }] = await Promise.all([
    profileService.getProfile(),
    profileService.getLatestDiagnostic(),
    progressService.getProgress(),
  ]);
  if (error) return { profile: null, error };
  store.startSession(userId);
  if (!profile) return { profile: null, error: null }; // aún no hace el cuestionario inicial

  const storeProfile = toStoreProfile(profile, diagnostic);
  if (!store.get().profile?.completed) store.completeOnboarding(storeProfile);
  else store.set({ profile: storeProfile });

  // Recupera gemas, XP y el nivel del curso actual (sin perder lo que ya hubiera en este dispositivo).
  const local = store.get();
  const saved = progress?.[courseSlugForModule(local.module)];
  store.set({
    gems: Math.max(local.gems, profile.gems),
    xp: Math.max(local.xp, profile.xp),
    ...(saved ? { level: Math.max(local.level, saved.nivel_actual ?? 1), streak: Math.max(local.streak, saved.racha_dias ?? 1) } : {}),
  });
  return { profile, error: null };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const refreshProfile = useCallback(async (userId) => {
    const result = await loadProfile(userId);
    setProfile(result.profile);
    return result;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;

    authService.getSession().then(async ({ session: current }) => {
      if (!active) return;
      setSession(current);
      if (current) await refreshProfile(current.user.id);
      if (active) setLoading(false);
    });

    const unsubscribe = authService.onAuthChange((next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refreshProfile]);

  const value = useMemo(() => ({
    configured: isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    profile,
    loading,

    async signUp(form) {
      const result = await authService.signUp(form);
      if (!result.error && result.session) {
        setSession(result.session);
        await refreshProfile(result.user.id);
      }
      return result;
    },

    async signIn(form) {
      const result = await authService.signIn(form);
      if (result.error) return { ...result, profile: null };
      setSession(result.session);
      const loaded = await refreshProfile(result.user.id);
      return { ...result, profile: loaded.profile, error: loaded.error };
    },

    async signOut() {
      const result = await authService.signOut();
      setSession(null);
      setProfile(null);
      store.endSession();
      return result;
    },

    async saveOnboarding(draft, answerKey) {
      if (!session) return { error: 'Inicia sesión para guardar tu perfil.' };
      const result = await onboardingService.save(draft, answerKey);
      if (!result.error) {
        setProfile(result.profile);
        store.completeOnboarding(toStoreProfile(result.profile, result.diagnostic));
      }
      return result;
    },

    // Guarda en la cuenta el resultado de una ronda ya aplicado en store.js (nivel, gemas, XP, racha).
    async recordRound({ stars }) {
      if (!session) return { error: null };
      const state = store.get();
      const courseSlug = courseSlugForModule(state.module);
      const [round, totals] = await Promise.all([
        courseSlug
          ? progressService.recordRound({ courseSlug, stars, nextLevel: state.level, streak: state.streak })
          : { error: null },
        profileService.saveProfile({ gems: state.gems, xp: state.xp }),
      ]);
      return { error: round.error || totals.error };
    },
  }), [session, profile, loading, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return context;
}
