import { store } from '../state/store.js';
import { icon } from './icons.js';
import mascotUrl from '../assets/brand/mascot/numu-morado.png';

function statChip({ iconName, value, colorClass, ariaLabel }) {
  return `
    <span class="inline-flex items-center gap-1 font-fredoka font-bold text-micro-lg tabular-nums ${colorClass}" role="status" aria-label="${ariaLabel}">
      ${icon(iconName, 'w-6 h-6')}<span data-stat="${ariaLabel}">${value}</span>
    </span>
  `;
}

/**
 * Barra superior: avatar, estrellas, racha, gemas y vidas (corazones).
 * Se suscribe al store y se redibuja en cada cambio de estado.
 */
export function createNavbar({ onNavigate } = {}) {
  const nav = document.createElement('header');
  nav.className = 'sticky top-0 z-40 bg-soft-lavender/95 backdrop-blur border-b-2 border-border-gray';
  nav.innerHTML = `
    <div class="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-3">
      <button type="button" data-nav="home" class="lg:hidden flex items-center gap-2 min-h-touch pr-2 rounded-full hover:bg-white transition-colors" aria-label="Ir al inicio">
        <img src="${mascotUrl}" alt="NUMU" class="w-10 h-10 object-contain" />
        <span class="font-fredoka font-bold text-h2 text-numu-purple hidden sm:inline">NUMU</span>
      </button>
      <div class="flex items-center gap-3 sm:gap-5 ml-auto" data-stats></div>
    </div>
  `;

  const stats = nav.querySelector('[data-stats]');
  const renderStats = (state) => {
    stats.innerHTML = [
      statChip({ iconName: 'star', value: state.stars, colorClass: 'text-sunshine-yellow drop-shadow-[0_1px_0_#C79A00]', ariaLabel: 'estrellas' }),
      statChip({ iconName: 'gem', value: state.gems, colorClass: 'text-cyan-ocean', ariaLabel: 'gemas' }),
      statChip({ iconName: 'flame', value: state.streak, colorClass: 'text-orange-energy', ariaLabel: 'racha' }),
      statChip({
        iconName: 'heart',
        value: `${state.lives}/${state.maxLives}`,
        colorClass: state.lives > 0 ? 'text-coral-alert' : 'text-border-gray',
        ariaLabel: 'vidas',
      }),
    ].join('');
  };

  renderStats(store.get());
  nav.destroy = store.subscribe(renderStats);

  nav.querySelector('[data-nav]').addEventListener('click', () => onNavigate?.('home'));
  return nav;
}

/**
 * Barra de navegación inferior estilo Duolingo (botones de 64px, solo móvil/tablet).
 */
export function createBottomNav({ current = 'home', onNavigate } = {}) {
  const items = [
    { id: 'home', label: 'Mapa', iconName: 'home' },
    { id: 'achievements', label: 'Progreso', iconName: 'chart' },
    { id: 'shop', label: 'Premios', iconName: 'shop' },
    { id: 'settings', label: 'Ajustes', iconName: 'gear' },
  ];

  const nav = document.createElement('nav');
  nav.className = 'sticky bottom-0 z-40 bg-white border-t-2 border-border-gray lg:hidden';
  nav.setAttribute('aria-label', 'Navegación principal');
  nav.innerHTML = `
    <div class="mx-auto max-w-5xl grid grid-cols-4">
      ${items
        .map(
          (item) => `
        <button type="button" data-nav-to="${item.id}"
          class="h-16 flex flex-col items-center justify-center gap-0.5 font-fredoka font-bold text-micro transition-colors
          ${current === item.id ? 'text-numu-purple bg-soft-lavender' : 'text-text-dark/60 hover:text-numu-purple'}"
          ${current === item.id ? 'aria-current="page"' : ''}>
          ${icon(item.iconName, 'w-7 h-7')}
          <span>${item.label}</span>
        </button>`
        )
        .join('')}
    </div>
  `;

  nav.querySelectorAll('[data-nav-to]').forEach((btn) => {
    btn.addEventListener('click', () => onNavigate?.(btn.dataset.navTo));
  });
  return nav;
}
