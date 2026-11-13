/**
 * Imágenes de icono de la marca (corazones de vida, estrellas y fuego de racha).
 * Cada ruta se declara de forma literal porque Vite solo reescribe a asset con
 * hash los `new URL('...', import.meta.url)` con argumento estático; en Node,
 * donde los tests ejecutan estos mismos módulos, devuelve una URL file:// inocua.
 */
export const heartOn = new URL('../assets/icons/corazoncito.png', import.meta.url).href;
export const heartOff = new URL('../assets/icons/corazoncito gris.png', import.meta.url).href;
export const starIcon = new URL('../assets/icons/Estrella.png', import.meta.url).href;
export const flameOn = new URL('../assets/icons/fuego on.png', import.meta.url).href;
export const flameOff = new URL('../assets/icons/fuego off.png', import.meta.url).href;

/** Estados disponibles por icono: on (activo) y off (inactivo). */
export const iconAssets = Object.freeze({
  heart: Object.freeze({ on: heartOn, off: heartOff }),
  star: Object.freeze({ on: starIcon, off: starIcon }),
  flame: Object.freeze({ on: flameOn, off: flameOff }),
});

export function hasAssetIcon(name) {
  return Object.hasOwn(iconAssets, name);
}

/**
 * HTML de un icono de imagen con el tamaño y las clases que se le indiquen.
 * @param {string} name - heart | star | flame
 * @param {string} [state] - on | off
 * @param {string} [className] - Clases de tamaño y estilo.
 */
export function assetIcon(name, state = 'on', className = 'w-6 h-6') {
  const entry = iconAssets[name];
  if (!entry) return '';
  const src = entry[state] ?? entry.on;
  return `<img src="${src}" alt="" class="${className} object-contain" />`;
}
