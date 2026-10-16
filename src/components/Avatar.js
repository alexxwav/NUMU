import { icons } from './icons.js';
import mascotUrl from '../assets/brand/mascot/numu-morado.png';

/** Opciones de avatar (iconos SVG limpios, sin emojis). */
export const AVATARS = [
  { id: 'mascot', type: 'image', src: mascotUrl, bg: 'bg-white', border: 'border-border-gray' },
  { id: 'person', type: 'icon', iconName: 'user', bg: 'bg-numu-purple', fg: 'text-white' },
  { id: 'smile', type: 'icon', iconName: 'smile', bg: 'bg-cyan-ocean', fg: 'text-white' },
  { id: 'star', type: 'icon', iconName: 'star', bg: 'bg-sunshine-yellow', fg: 'text-text-dark' },
  { id: 'heart', type: 'icon', iconName: 'heart', bg: 'bg-coral-alert', fg: 'text-white' },
  { id: 'bolt', type: 'icon', iconName: 'bolt', bg: 'bg-orange-energy', fg: 'text-white' },
  { id: 'moon', type: 'icon', iconName: 'moon', bg: 'bg-numu-deep-indigo', fg: 'text-white' },
  { id: 'leaf', type: 'icon', iconName: 'leaf', bg: 'bg-mint-success', fg: 'text-white' },
];

/** Marcos de perfil (premios canjeables con gemas en la tienda). */
export const FRAMES = [
  { id: 'frame-gold', name: 'Marco Dorado', price: 60, iconName: 'crown', ring: 'border-sunshine-yellow' },
  { id: 'frame-mint', name: 'Marco Menta', price: 40, iconName: 'leaf', ring: 'border-mint-success' },
  { id: 'frame-cyan', name: 'Marco Océano', price: 40, iconName: 'sparkle', ring: 'border-cyan-ocean' },
  { id: 'frame-coral', name: 'Marco Coral', price: 30, iconName: 'heart', ring: 'border-coral-alert' },
  { id: 'frame-orange', name: 'Marco Energía', price: 30, iconName: 'bolt', ring: 'border-orange-energy' },
  { id: 'frame-indigo', name: 'Marco Profundo', price: 50, iconName: 'moon', ring: 'border-numu-deep-indigo' },
];

export function getFrame(frameId) {
  return FRAMES.find((f) => f.id === frameId) ?? null;
}

/**
 * HTML de un avatar (imagen o icono SVG) dentro de un círculo, con marco opcional.
 * @param {number} avatarIndex - Índice en AVATARS.
 * @param {Object} [options]
 * @param {string} [options.size] - Clases de tamaño (w-14 h-14).
 * @param {string|null} [options.frame] - Id de marco (FRAMES).
 */
export function avatarHTML(avatarIndex = 0, { size = 'w-14 h-14', frame = null } = {}) {
  const avatar = AVATARS[avatarIndex] ?? AVATARS[0];
  const frameDef = getFrame(frame);
  const ring = frameDef ? `${frameDef.ring} border-[4px]` : 'border-2 border-white';
  const inner =
    avatar.type === 'image'
      ? `<img src="${avatar.src}" alt="" class="w-3/4 h-3/4 object-contain" />`
      : `<span class="w-1/2 h-1/2 ${avatar.fg}">${icons[avatar.iconName] ?? ''}</span>`;
  const bg = avatar.type === 'image' ? `${avatar.bg} ${avatar.border ?? ''} border-2` : avatar.bg;
  return `<span class="${size} ${bg} ${ring} rounded-full grid place-items-center overflow-hidden shrink-0" aria-hidden="true">${inner}</span>`;
}

/**
 * Grid selector de avatares (cada opción ≥ 64px).
 * @param {Object} options
 * @param {number} options.selected
 * @param {Function} options.onSelect
 */
export function createAvatarPicker({ selected = 0, onSelect } = {}) {
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-4 sm:grid-cols-8 gap-3';
  grid.setAttribute('role', 'radiogroup');
  grid.setAttribute('aria-label', 'Elige tu avatar');

  AVATARS.forEach((avatar, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(index === selected));
    btn.setAttribute('aria-label', `Avatar ${avatar.id}`);
    btn.className = `w-touch h-touch rounded-full grid place-items-center transition-transform active:translate-y-1 ${
      index === selected ? 'bg-white shadow-3d-primary ring-4 ring-numu-purple' : 'bg-white border-2 border-border-gray hover:border-numu-purple/50'
    }`;
    btn.innerHTML = avatarHTML(index, { size: 'w-12 h-12', frame: null });
    btn.addEventListener('click', () => {
      grid.querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-checked', 'false');
        b.className = `w-touch h-touch rounded-full grid place-items-center transition-transform active:translate-y-1 bg-white border-2 border-border-gray hover:border-numu-purple/50`;
      });
      btn.setAttribute('aria-checked', 'true');
      btn.className = `w-touch h-touch rounded-full grid place-items-center transition-transform active:translate-y-1 bg-white shadow-3d-primary ring-4 ring-numu-purple`;
      onSelect?.(index);
    });
    grid.appendChild(btn);
  });

  return grid;
}
