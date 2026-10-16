import { createModuleCard } from '../components/Card.js';
import { icon } from '../components/icons.js';
import { avatarHTML } from '../components/Avatar.js';
import { store, MODULES } from '../state/store.js';
import { sfx } from '../utils/audio.js';
import mascotUrl from '../assets/brand/mascot/numu-morado.png';

const TOTAL_LEVELS = 10;

function levelNode({ number, status, module, onPlay }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className =
    'relative w-touch-lg h-touch-lg rounded-full grid place-items-center font-fredoka font-bold text-h2 transition-transform active:translate-y-1';

  if (status === 'done') {
    btn.classList.add('bg-mint-success', 'text-white', 'shadow-3d-success');
    btn.innerHTML = `${number}<span class="absolute -top-3 flex gap-0.5 text-sunshine-yellow">${icon('star', 'w-4 h-4')}${icon('star', 'w-4 h-4')}${icon('star', 'w-4 h-4')}</span>`;
    btn.setAttribute('aria-label', `Nivel ${number} completado. Repetir`);
    btn.addEventListener('click', () => {
      sfx.tap();
      onPlay(module, number);
    });
  } else if (status === 'current') {
    btn.classList.add('bg-numu-purple', 'text-white', 'shadow-3d-primary', 'animate-pulse-active');
    btn.innerHTML = `${number}
      <span class="absolute -top-10 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-white grid place-items-center shadow-lg border-2 border-border-gray p-1.5" aria-hidden="true">
        <img src="${mascotUrl}" alt="" class="w-full h-full object-contain" />
      </span>
      <span class="absolute -bottom-7 whitespace-nowrap font-nunito font-bold text-micro text-numu-purple">¡Vamos!</span>`;
    btn.setAttribute('aria-label', `Nivel ${number} actual. Jugar ahora`);
    btn.addEventListener('click', () => {
      sfx.correct();
      onPlay(module, number);
    });
  } else {
    btn.classList.add('bg-border-gray', 'text-text-dark/50', 'shadow-3d-neutral', 'cursor-not-allowed');
    btn.innerHTML = `${icon('lock', 'w-7 h-7')}`;
    btn.disabled = true;
    btn.setAttribute('aria-label', `Nivel ${number} bloqueado`);
  }
  return btn;
}

/** Frames 2 y 3 — Selector de módulos + Mapa de niveles (contenido del AppShell). */
export function renderHome({ onNavigate }) {
  const state = store.get();
  const selectedModule = MODULES.find((m) => m.id === state.module) ?? MODULES[0];
  const displayName = state.profile?.nickname || state.profile?.name || 'campeón';

  const main = document.createElement('div');
  main.className = 'space-y-8';

  /* --- Perfil + estrellas (Frame 2 header) --- */
  const profile = document.createElement('section');
  profile.className = 'flex items-center justify-between gap-3';
  profile.innerHTML = `
    <div class="flex items-center gap-3">
      ${avatarHTML(state.profile?.avatar ?? 0, { size: 'w-14 h-14', frame: state.profile?.frame ?? null })}
      <div>
        <p class="font-fredoka font-bold text-h2 text-text-dark leading-tight">¡Hola, ${displayName}!</p>
        <p class="font-nunito text-micro text-text-dark/60">Nivel ${state.level} · ${state.xp} XP</p>
      </div>
    </div>
    <span class="inline-flex items-center gap-1.5 font-fredoka font-bold text-h2 text-text-dark tabular-nums">
      <span class="text-sunshine-yellow drop-shadow-[0_1px_0_#C79A00]">${icon('star', 'w-8 h-8')}</span>
      <span data-total-stars>${state.stars}</span>
    </span>
  `;
  main.appendChild(profile);

  /* --- Grid de módulos --- */
  const modulesSection = document.createElement('section');
  modulesSection.setAttribute('aria-label', 'Temas de matemáticas');
  modulesSection.innerHTML = `<h1 class="font-fredoka font-bold text-h1 text-text-dark mb-4">¿Qué quieres practicar?</h1>`;
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 md:grid-cols-4 gap-4';
  MODULES.forEach((module) => {
    grid.appendChild(
      createModuleCard(module, {
        onSelect: (m) => {
          sfx.tap();
          store.set({ module: m.id });
          onNavigate('game', { module: m.id });
        },
      })
    );
  });
  modulesSection.appendChild(grid);
  main.appendChild(modulesSection);

  /* --- Mapa de niveles --- */
  const mapSection = document.createElement('section');
  mapSection.setAttribute('aria-label', 'Mapa de niveles');
  mapSection.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-fredoka font-bold text-h1 text-text-dark">Tu ruta de aprendizaje</h2>
      <span class="font-nunito font-bold text-micro px-3 py-1 rounded-full bg-numu-purple text-white">${selectedModule.name}</span>
    </div>
    <ol class="relative flex flex-col items-center gap-9 py-6 px-4 rounded-card bg-white border-2 border-border-gray">
      <span class="absolute inset-x-16 top-10 bottom-10 w-1 -translate-x-1/2 left-1/2 bg-border-gray rounded-full" aria-hidden="true"></span>
    </ol>
  `;
  const list = mapSection.querySelector('ol');
  for (let level = 1; level <= TOTAL_LEVELS; level++) {
    const li = document.createElement('li');
    li.className = 'relative z-10';
    const status = level < state.level ? 'done' : level === state.level ? 'current' : 'locked';
    li.appendChild(
      levelNode({
        number: level,
        status,
        module: selectedModule.id,
        onPlay: (moduleId) => onNavigate('game', { module: moduleId }),
      })
    );
    list.appendChild(li);
  }
  main.appendChild(mapSection);

  return main;
}
