import { sfx } from '../utils/audio.js';

/**
 * Switch de activación suave (verde Mint #00D282 cuando está activo).
 * @param {Object} options
 * @param {string} options.label
 * @param {string} [options.description]
 * @param {boolean} options.checked
 * @param {Function} options.onChange
 * @returns {HTMLElement}
 */
export function createToggle({ label, description = '', checked = false, onChange } = {}) {
  const row = document.createElement('div');
  row.className = 'flex items-center justify-between gap-4 py-4 border-b-2 border-border-gray last:border-b-0';
  row.innerHTML = `
    <div class="pr-2">
      <p class="font-fredoka font-bold text-button text-text-dark">${label}</p>
      ${description ? `<p class="font-nunito text-micro text-text-dark/60">${description}</p>` : ''}
    </div>
    <button type="button" role="switch" aria-checked="${checked}" aria-label="${label}"
      class="relative w-16 h-9 rounded-full transition-colors shrink-0 ${checked ? 'bg-mint-success' : 'bg-border-gray'}">
      <span class="absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${checked ? 'left-8' : 'left-1'}"></span>
    </button>
  `;

  const btn = row.querySelector('button');
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', String(next));
    btn.className = `relative w-16 h-9 rounded-full transition-colors shrink-0 ${next ? 'bg-mint-success' : 'bg-border-gray'}`;
    btn.querySelector('span').className = `absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${next ? 'left-8' : 'left-1'}`;
    sfx.tap();
    onChange?.(next);
  });
  return row;
}
