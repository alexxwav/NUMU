import { profileService } from './profileService.js';
import { normalizeInterests } from '../data/subjects.js';

/**
 * Cuenta aciertos del diagnóstico.
 * @param {Array<number|null>} answers - Índice elegido por pregunta (draft.answers de LoginView).
 * @param {number[]} answerKey - Índice correcto por pregunta (DIAGNOSTIC[i].answer).
 */
export function scoreDiagnostic(answers = [], answerKey = []) {
  const score = answerKey.reduce((sum, correct, i) => sum + (answers[i] === correct ? 1 : 0), 0);
  return { score, total: answerKey.length };
}

/**
 * Convierte el borrador del cuestionario inicial (draft de LoginView.jsx)
 * en las filas de profiles y diagnostic_results.
 */
export function buildOnboardingPayload(draft, answerKey) {
  const { score, total } = scoreDiagnostic(draft.answers, answerKey);
  return {
    profile: {
      name: draft.name?.trim() || null,
      age: draft.age === '' || draft.age == null ? null : Number(draft.age),
      country: draft.country?.trim() || null,
      grade: draft.grade?.trim() || null,
      interests: normalizeInterests(draft.interests),
      avatar: draft.avatar ?? 0,
      nickname: draft.nickname?.trim() || null,
      onboarding_completed: true,
    },
    diagnostic: {
      answers: draft.answers ?? [],
      score,
      total,
      selfLevel: draft.level ?? null,
    },
  };
}

/**
 * Traduce las filas de Supabase a la forma de state.profile en store.js,
 * para que store.completeOnboarding y las vistas sigan funcionando igual.
 */
export function toStoreProfile(profile, diagnostic = null) {
  return {
    completed: Boolean(profile?.onboarding_completed),
    name: profile?.name ?? '',
    age: profile?.age ?? '',
    country: profile?.country ?? '',
    grade: profile?.grade ?? '',
    interests: profile?.interests ?? [],
    level: diagnostic?.self_level ?? '',
    score: diagnostic?.score ?? 0,
    avatar: profile?.avatar ?? 0,
    nickname: profile?.nickname ?? '',
  };
}

export function createOnboardingService(profiles = profileService) {
  return {
    /** Guarda primero el diagnóstico y luego el perfil; tener perfil = cuestionario terminado. */
    async save(draft, answerKey) {
      const { profile, diagnostic } = buildOnboardingPayload(draft, answerKey);
      const saved = await profiles.saveDiagnostic(diagnostic);
      if (saved.error) return { profile: null, diagnostic: null, error: saved.error };
      const updated = await profiles.saveProfile(profile);
      if (updated.error) return { profile: null, diagnostic: saved.diagnostic, error: updated.error };
      return { profile: updated.profile, diagnostic: saved.diagnostic, error: null };
    },
  };
}

export const onboardingService = createOnboardingService();
