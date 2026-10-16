import { icon } from './icons.js';

/**
 * Botón 3D táctil (mín. 64px) siguiendo DESIGN_SYSTEM.md §3.
 * @param {Object} options
 * @param {string} [options.label] - Texto del botón.
 * @param {'primary'|'success'|'yellow'|'coral'|'cyan'|'orange'|'white'} [options.variant]
 * @param {string} [options.iconName] - Clave de icons.js a mostrar antes del texto.
 * @param {Function} [options.onClick]
 * @param {string} [options.className] - Clases extra.
 * @param {'button'|'submit'} [options.type]
 * @param {boolean} [options.disabled]
 * @param {string} [options.ariaLabel]
 * @returns {HTMLButtonElement}
 */
export function createButton({
  label = '',
  variant = 'primary',
  iconName = null,
  onClick,
  className = '',
  type = 'button',
  disabled = false,
  ariaLabel = '',
} = {}) {
  const btn = document.createElement('button');
  btn.type = type;
  btn.className = ['btn-3d', `btn-${variant}`, className].filter(Boolean).join(' ');
  btn.disabled = disabled;
  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
  btn.innerHTML = `${iconName ? icon(iconName, 'w-6 h-6 shrink-0') : ''}${label ? `<span>${label}</span>` : ''}`;
  if (typeof onClick === 'function') {
    btn.addEventListener('click', (event) => {
      if (btn.disabled) return;
      onClick(event);
    });
  }
  return btn;
}

/**
 * Botón de respuesta gigante de juego (90x90, número Fredoka Bold 48px).
 */
export function createAnswerButton(value, { onClick } = {}) {
  const btn = createButton({
    label: String(value),
    variant: 'white',
    className:
      'answer-option min-w-[90px] min-h-[90px] text-display px-4 tabular-nums border-2 border-border-gray hover:border-numu-purple',
    onClick,
  });
  return btn;
}
