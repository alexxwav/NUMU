import { icon } from './icons.js';

/**
 * Tarjeta contenedora reutilizable (radius 24px, fondo blanco).
 * @param {Object} [options]
 * @param {string|Node|Array} [options.children]
 * @param {string} [options.className]
 * @param {'div'|'article'|'section'|'button'} [options.as]
 * @param {Function} [options.onClick]
 * @returns {HTMLElement}
 */
export function createCard({ children = '', className = '', as = 'div', onClick } = {}) {
  const el = document.createElement(as);
  el.className = ['card-numu', className].filter(Boolean).join(' ');
  if (typeof onClick === 'function') el.addEventListener('click', onClick);

  const append = (node) => {
    if (node == null) return;
    if (Array.isArray(node)) node.forEach(append);
    else if (node instanceof Node) el.appendChild(node);
    else el.insertAdjacentHTML('beforeend', String(node));
  };
  append(children);
  return el;
}

/**
 * Tarjeta de módulo temático (Frame 2: Conteo / Aritmética / Geometría / Patrones).
 */
export function createModuleCard(module, { onSelect } = {}) {
  const card = createCard({
    as: 'button',
    className: `module-card relative overflow-hidden text-left text-white p-5 min-h-touch ${module.color} border-0 shadow-lg hover:brightness-105 active:translate-y-1 transition-transform duration-100`,
    onClick: () => onSelect?.(module),
  });
  card.style.borderRadius = 'var(--card-border-radius)';
  card.innerHTML = `
    <span class="w-14 h-14 mb-3 grid place-items-center rounded-2xl bg-white/20 block" aria-hidden="true">${icon(module.iconKey, 'w-8 h-8')}</span>
    <span class="font-fredoka font-bold text-h2 block">${module.name}</span>
  `;
  return card;
}
