import { icon } from '../components/icons.js';
import { store } from '../state/store.js';

const BADGES = [
  { id: 'first', title: 'Primera lección', iconName: 'medal', tone: 'bg-orange-energy text-white', test: (s) => s.level > 1 },
  { id: 'streak3', title: 'Racha de 3 días', iconName: 'flame', tone: 'bg-coral-alert text-white', test: (s) => s.streak >= 3 },
  { id: 'stars20', title: '20 estrellas', iconName: 'star', tone: 'bg-sunshine-yellow text-text-dark', test: (s) => s.stars >= 20 },
  { id: 'gems50', title: '50 gemas', iconName: 'gem', tone: 'bg-cyan-ocean text-white', test: (s) => s.gems >= 50 },
  { id: 'level5', title: 'Nivel 5', iconName: 'trophy', tone: 'bg-numu-purple text-white', test: (s) => s.level >= 5 },
  { id: 'perfect', title: 'Ronda perfecta', iconName: 'crown', tone: 'bg-mint-success text-white', test: (s) => Object.values(s.starsByLevel).some((v) => v === 3) },
];

/** Pantalla Progreso: logros, insignias y recompensas acumuladas. */
export function renderAchievements() {
  const state = store.get();
  const unlocked = BADGES.filter((b) => b.test(state)).length;

  const main = document.createElement('div');
  main.className = 'space-y-6';
  main.innerHTML = `
    <header class="text-center">
      <h1 class="font-fredoka font-bold text-h1 text-text-dark">Tu progreso</h1>
      <p class="font-nunito text-body text-text-dark/60">${unlocked} de ${BADGES.length} insignias desbloqueadas</p>
    </header>

    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      ${BADGES.map((badge) => {
        const has = badge.test(state);
        return `
        <div class="card-numu p-4 text-center ${has ? '' : 'opacity-45 grayscale'}" ${has ? '' : 'aria-disabled="true"'}>
          <span class="w-14 h-14 mx-auto mb-3 rounded-full grid place-items-center ${badge.tone}" aria-hidden="true">${icon(badge.iconName, 'w-8 h-8')}</span>
          <p class="font-fredoka font-bold text-micro text-text-dark">${badge.title}</p>
          <p class="font-nunito text-micro ${has ? 'text-mint-success' : 'text-text-dark/45'}">${has ? '¡Lograda!' : 'Bloqueada'}</p>
        </div>`;
      }).join('')}
    </div>

    <div class="card-numu p-6 grid grid-cols-3 gap-4 text-center">
      <div>
        <p class="font-fredoka font-bold text-display text-numu-purple tabular-nums">${state.stars}</p>
        <p class="font-nunito font-bold text-micro text-text-dark/60">Estrellas</p>
      </div>
      <div>
        <p class="font-fredoka font-bold text-display text-cyan-ocean tabular-nums">${state.gems}</p>
        <p class="font-nunito font-bold text-micro text-text-dark/60">Gemas</p>
      </div>
      <div>
        <p class="font-fredoka font-bold text-display text-orange-energy tabular-nums">${state.xp}</p>
        <p class="font-nunito font-bold text-micro text-text-dark/60">XP</p>
      </div>
    </div>
  `;

  return main;
}
