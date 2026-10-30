import { store } from '../state/store.js';
import { icon } from './icons.js';
import { avatarHTML } from './Avatar.js';

/** Elementos del menú lateral (sidebar de escritorio/tablet). */
export const NAV_ITEMS = [
  { route: 'home', label: 'MAPA', iconName: 'home' },
  { route: 'achievements', label: 'PROGRESO', iconName: 'chart' },
  { route: 'shop', label: 'PREMIOS', iconName: 'shop' },
  { route: 'settings', label: 'CONFIGURACIÓN', iconName: 'gear' },
];

/**
 * Barra lateral izquierda fija (≥ lg). Estado activo con relieve 3D estilo Duolingo.
 */
export function createSidebar({ current = 'home', onNavigate } = {}) {
  const el = document.createElement('aside');
  el.className = 'hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-white border-r-2 border-border-gray z-30';
  el.setAttribute('aria-label', 'Menú principal');
  el.innerHTML = `
    <div class="px-5 pt-7 pb-5">
      <a href="#/home" class="block group" aria-label="NUMU - Ir al mapa">
        <span class="font-fredoka font-bold text-3xl text-numu-purple leading-none group-hover:opacity-80 transition-opacity">NUMU</span>
        <span class="block font-nunito font-bold text-micro text-text-dark/45 tracking-wide">MATEMÁTICAS</span>
      </a>
    </div>

    <nav class="flex-1 px-3 space-y-3" aria-label="Secciones">
      ${NAV_ITEMS.map((item) => {
        const active = current === item.route;
        return `
        <button type="button" data-route="${item.route}" ${active ? 'aria-current="page"' : ''}
          class="w-full h-touch flex items-center gap-3 px-4 rounded-btn font-fredoka font-bold text-button transition-colors
          ${active
            ? 'bg-soft-lavender border-2 border-border-gray shadow-3d-white text-numu-purple -translate-y-0.5'
            : 'border-2 border-transparent text-text-dark/70 hover:bg-soft-lavender hover:text-numu-purple'}">
          ${icon(item.iconName, 'w-6 h-6 shrink-0')}
          <span>${item.label}</span>
        </button>`;
      }).join('')}
    </nav>

    <div class="p-3 border-t-2 border-border-gray">
      <div class="flex items-center gap-3 px-2 py-2 rounded-btn" data-side-profile></div>
    </div>
  `;

  el.querySelectorAll('[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => onNavigate?.(btn.dataset.route));
  });

  const profileEl = el.querySelector('[data-side-profile]');
  const renderProfile = (state) => {
    const name = state.profile?.nickname || state.profile?.name || 'Sin perfil';
    profileEl.innerHTML = `
      ${avatarHTML(state.profile?.avatar ?? 0, { size: 'w-11 h-11', frame: state.profile?.frame ?? null })}
      <div class="min-w-0">
        <p class="font-fredoka font-bold text-micro-lg text-text-dark truncate">${name}</p>
        <p class="font-nunito text-micro text-text-dark/50">Nivel ${state.level}</p>
      </div>
    `;
  };
  renderProfile(store.get());
  el.destroy = store.subscribe(renderProfile);

  return el;
}
