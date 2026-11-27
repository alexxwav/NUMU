import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { authService } from '../services/authService.js';
import { profileService } from '../services/profileService.js';
import { onboardingService, toStoreProfile } from '../services/onboardingService.js';
import { progressService } from '../services/progressService.js';
import { moduleProgressService } from '../services/moduleProgressService.js';
import { courseSlugForModule } from '../data/subjects.js';
import { store, getTotalXp } from '../state/store.js';
import { reconcileXp } from '../utils/xpProtection.js';
import { gemsService, syncPendingGems, reconcileAccountGems, purchaseItem } from '../services/gemsService.js';

const AuthContext = createContext(null);

// Carga lo guardado en la cuenta y lo vuelca en store.js, que sigue siendo la fuente de verdad de las vistas.
async function loadProfile(userId) {
  const [{ profile, error }, { diagnostic }, { progress }, moduleProgress] = await Promise.all([
    profileService.getProfile(),
    profileService.getLatestDiagnostic(),
    progressService.getProgress(),
    moduleProgressService.getModuleProgress(),
  ]);
  if (error) return { profile: null, error };
  store.startSession(userId);
  // El mapa de /inicio usa el progreso por sección guardado en la cuenta.
  if (!moduleProgress.error) store.applyModuleProgress(moduleProgress);
  if (!profile) return { profile: null, error: null }; // aún no hace el cuestionario inicial

  const storeProfile = toStoreProfile(profile, diagnostic);
  if (!store.get().profile?.completed) store.completeOnboarding(storeProfile);
  else store.set({ profile: storeProfile });

  // Gemas: el saldo de la cuenta manda (+ recompensas de este dispositivo aún sin confirmar). Ya no
  // se toma el máximo con el saldo local: así volvían las gemas gastadas (gemsService.js).
  await reconcileAccountGems({ service: gemsService, store, remoteGems: profile.gems });
  // Nivel del curso actual. La XP nunca baja: el máximo entre la cuenta, este dispositivo y la
  // derivada de las estrellas de las rutas (xpProtection.js).
  const local = store.get();
  const saved = progress?.[courseSlugForModule(local.module)];
  store.set({
    xp: reconcileXp({ remoteXp: profile.xp, localXp: local.xp, derivedXp: getTotalXp(local) }),
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
      // Antes de cerrar, sube las recompensas pendientes (si falla, se perderían al limpiar el dispositivo).
      if (session) await syncPendingGems({ service: gemsService, store });
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
    // Gemas: se confirman las recompensas pendientes con su clave (una sola vez). Sin la migración de
    // gemas, se guarda el saldo como antes y se dan por subidas.
    async recordRound({ stars }) {
      if (!session) return { error: null };
      const gems = await syncPendingGems({ service: gemsService, store });
      const state = store.get();
      const courseSlug = courseSlugForModule(state.module);
      const xp = reconcileXp({ localXp: state.xp, derivedXp: getTotalXp(state) });
      const [round, totals] = await Promise.all([
        courseSlug
          ? progressService.recordRound({ courseSlug, stars, nextLevel: state.level, streak: state.streak })
          : { error: null },
        profileService.saveProfile(gems.legacy ? { gems: state.gems, xp } : { xp }),
      ]);
      if (gems.legacy && !totals.error) store.applyAccountGems({ balance: state.gems, confirmedKeys: (state.gemsPending ?? []).map((p) => p.key) }); // el saldo guardado ya incluye las pendientes
      return { error: round.error || totals.error || (gems.legacy ? null : gems.error) };
    },

    // Compra en la tienda. Con cuenta la cobra el servidor (una sola vez, con su precio); sin la
    // migración, compra en el dispositivo y guarda el saldo al momento (ya no espera a otra ronda).
    async purchase(item) {
      if (!session) {
        const before = store.get().owned.length;
        store.purchase(item.id, item.price);
        return { purchased: store.get().owned.length > before, reason: null, error: null };
      }
      return purchaseItem({
        service: gemsService, store, itemId: item.id, price: item.price,
        saveLegacyGems: (gems) => profileService.saveProfile({ gems }),
      });
    },

    // Guarda en la cuenta el avance de una sección del mapa (parada y estrellas).
    async recordModuleRound({ moduleId, stars, level }) {
      if (!session) return { error: null };
      const result = await moduleProgressService.saveModuleRound({ moduleId, stars, level });
      if (!result.error) {
        store.applyModuleProgress({
          levelByModule: { [result.moduleId]: result.currentLevel },
          starsByModuleLevel: { [result.moduleId]: result.starsByLevel },
        });
      }
      return { error: result.error };
    },
  }), [session, profile, loading, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return context;
}
