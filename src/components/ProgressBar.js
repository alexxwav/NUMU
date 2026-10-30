/**
 * Barra de progreso del juego (altura 20px, radio 10px, relleno #00D282).
 * @param {Object} [options]
 * @param {number} [options.percent] - 0 a 100.
 * @param {string} [options.className]
 * @returns {HTMLElement}
 */
export function createProgressBar({ percent = 0, className = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `w-full h-5 rounded-[10px] bg-border-gray overflow-hidden ${className}`;
  wrap.setAttribute('role', 'progressbar');
  wrap.setAttribute('aria-valuemin', '0');
  wrap.setAttribute('aria-valuemax', '100');

  const fill = document.createElement('div');
  fill.className = 'h-full rounded-[10px] bg-mint-success transition-all duration-300 ease-out';
  wrap.appendChild(fill);

  const setPercent = (value) => {
    const clamped = Math.min(100, Math.max(0, value));
    fill.style.width = `${clamped}%`;
    wrap.setAttribute('aria-valuenow', String(Math.round(clamped)));
  };
  setPercent(percent);

  wrap.setPercent = setPercent;
  return wrap;
}

/**
 * Corazones de vidas (máx. 5) con feedback de pérdida.
 */
export function createLivesBar({ lives, maxLives = 5 } = {}) {
  const bar = document.createElement('div');
  bar.className = 'flex items-center gap-1';
  bar.setAttribute('aria-label', `Vidas: ${lives} de ${maxLives}`);
  const fill = () => {
    bar.innerHTML = Array.from({ length: maxLives }, (_, i) => {
      const active = i < lives;
      return `<span class="w-6 h-6 ${active ? 'text-coral-alert' : 'text-border-gray'}">${heartSvg(active)}</span>`;
    }).join('');
  };
  fill();
  bar.setLives = (value) => {
    lives = value;
    fill();
    bar.setAttribute('aria-label', `Vidas: ${lives} de ${maxLives}`);
  };
  return bar;
}

function heartSvg(active) {
  return active
    ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.7-9.6-9.2C.7 8.3 2.4 4.6 5.9 3.7c2.2-.6 4.4.3 5.6 2 1.2-1.7 3.4-2.6 5.6-2 3.5.9 5.2 4.6 3.5 8.1C19.5 16.3 12 21 12 21Z"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" d="M12 20.3S5.2 16 3.3 11.9C1.9 8.8 3.4 5.6 6.5 4.8c2-.5 4 .3 5 1.8 1-1.5 3-2.3 5-1.8 3.1.8 4.6 4 3.2 7.1C18.8 16 12 20.3 12 20.3Z"/></svg>`;
}
