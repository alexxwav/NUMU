const svg = (paths, viewBox = '0 0 24 24', extra = '') => `
<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${paths}</svg>`;

export const icons = {
  heart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.7-9.6-9.2C.7 8.3 2.4 4.6 5.9 3.7c2.2-.6 4.4.3 5.6 2 1.2-1.7 3.4-2.6 5.6-2 3.5.9 5.2 4.6 3.5 8.1C19.5 16.3 12 21 12 21Z"/></svg>`,
  heartBroken: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21s-7.5-4.7-9.6-9.2C.7 8.3 2.4 4.6 5.9 3.7c2.2-.6 4.4.3 5.6 2 .5-.7 1.3-1.3 2.2-1.7l-2 4.6 3.4 1.5-2.1 2.6 1.6 5.4c-.9.7-2 1.4-3.2 2L12 21Z"/><path d="M13 3.5 11 8l4 1.8-2.2 2.7" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  star: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.6 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9L12 2.6Z"/></svg>`,
  gem: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 3h12l4 6-10 12L2 9l4-6Zm.9 2L4.4 8.6h4.2L10 5H6.9Zm5.1-.4L10.4 7H4l3.3-4H12Zm2.6 0 3.3 4h-6.4L14 4.6ZM20 8.6h-4.2L14 5h3.7L20 8.6ZM12 19.2 17 10.6h-2.3L12 15.6 9.3 10.6H7l5 8.6Z"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 2c.6 3.2-1 5-2.6 6.5C8.7 10.1 7 11.7 7 15a5 5 0 0 0 10 0c0-2.4-1.2-4-2.4-5.4-.3 1-1 1.8-2 2.2.6-2.6-.4-6.6 2.4-9.8h-2ZM10.5 14c-1.5 1-2 2.2-2 3.4A2.6 2.6 0 0 0 11 20a2.5 2.5 0 0 0 2.5-2.5c0-1.2-.9-2.4-3-3.5Z"/></svg>`,
  gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>'),
  home: svg('<path d="m3 10 9-7 9 7v10a1.5 1.5 0 0 1-1.5 1.5h-5v-7h-5v7h-5A1.5 1.5 0 0 1 3 20V10Z"/>'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5.5A1.5 1.5 0 0 0 4 6.5v.5a4 4 0 0 0 4 4M16 5h2.5A1.5 1.5 0 0 1 20 6.5v.5a4 4 0 0 1-4 4"/><path d="M12 13v4m-4 3h8m-6.5-3h5"/>'),
  lock: svg('<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
  speaker: svg('<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.7 7.7 0 0 1 0 11"/>'),
  close: svg('<path d="m6 6 12 12M18 6 6 18"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7"/>'),
  arrowRight: svg('<path d="M4 12h15m-6-6 6 6-6 6"/>'),
  play: svg('<path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.5-7.2a.8.8 0 0 0 0-1.4L8.2 4.1A.8.8 0 0 0 7 4.8Z"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),
  book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z"/>'),

  /* Navegación lateral / progreso / tienda */
  chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>'),
  shop: svg('<path d="M4 9h16l-1 11.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20.5L4 9Z"/><path d="M4 9 5.6 4.5A1.5 1.5 0 0 1 7 3.5h10a1.5 1.5 0 0 1 1.4 1L20 9"/><path d="M9 12.5v3M15 12.5v3"/>'),
  arrowLeft: svg('<path d="M20 12H5m6 6-6-6 6-6"/>'),
  pencil: svg('<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m13.5 6.5 4 4"/>'),
  shield: svg('<path d="M12 3 5 5.5v5.7c0 4.3 2.9 7.6 7 9.3 4.1-1.7 7-5 7-9.3V5.5L12 3Z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),

  /* Insignias / premios */
  medal: svg('<circle cx="12" cy="14.5" r="5.5"/><path d="m8.5 10-3-6h5l1.5 3 1.5-3h5l-3 6"/><path d="m12 12.2.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9.1 14.3l2-.3.9-1.8Z"/>'),
  crown: svg('<path d="M4 17.5 3 7l5 3.5L12 4l4 6.5L21 7l-1 10.5H4Z"/><path d="M4.5 20.5h15"/>'),
  gift: svg('<rect x="4" y="10" width="16" height="10.5" rx="1.5"/><path d="M3 7h18v3H3zM12 7v13.5"/><path d="M12 7S10.5 3 8.5 3a2.2 2.2 0 0 0 0 4H12Zm0 0s1.5-4 3.5-4a2.2 2.2 0 0 1 0 4H12Z"/>'),

  /* Tarjetas de intereses (onboarding) */
  countIcon: svg('<circle cx="8" cy="9" r="4.2"/><circle cx="16" cy="9" r="4.2"/><circle cx="12" cy="16.5" r="4.2"/>'),
  plusMinus: svg('<path d="M4 8.5h6M7 5.5v6M14 15.5h6M17 12.5v6"/>'),
  shapes: svg('<rect x="3.5" y="12.5" width="8" height="8" rx="1.5"/><circle cx="16.5" cy="16.5" r="4"/><path d="M12 3.5 16.5 10h-9L12 3.5Z"/>'),
  pattern: svg('<circle cx="5" cy="12" r="2.6"/><circle cx="12" cy="12" r="2.6"/><circle cx="19" cy="12" r="2.6"/><path d="M8.5 12h1M15.5 12h1" stroke-dasharray="1.5 2"/>'),

  /* Nivel de conocimiento (onboarding) */
  gaugeLow: svg('<path d="M5 18a8 8 0 1 1 14 0"/><path d="m12 14 4-4"/>'),
  gaugeMid: svg('<path d="M5 18a8 8 0 1 1 14 0"/><path d="m12 14 1.5-6"/>'),
  gaugeHigh: svg('<path d="M5 18a8 8 0 1 1 14 0"/><path d="m12 14-4-5"/>'),

  /* Objetos de conteo (sin emojis) */
  ball: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M5 9.5c4 1.5 9.5 1.5 14-1M5 14.5c4-1.5 9.5-1.5 14 1M12 3c-2.5 5.5-2.5 12.5 0 18M12 3c2.5 5.5 2.5 12.5 0 18" stroke="#fff" stroke-width="1.4" fill="none"/></svg>`,
  fish: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 5c4.5 0 8 3.6 8 7s-3.5 7-8 7c-2.3 0-4.3-.9-5.8-2.4L3 19l1.4-3.6A6.9 6.9 0 0 1 3 12c0-3.4 3.5-7 8-7Z"/><circle cx="17" cy="11" r="1.4" fill="#fff"/><path d="M8.5 12c1.2 1.4 2.4 1.4 3.6 0" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`,
  balloon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3c3.9 0 7 3.1 7 7 0 3.7-2.6 6.4-5 7.4l-.8 2.3h-2.4l-.8-2.3C7.6 16.4 5 13.7 5 10c0-3.9 3.1-7 7-7Z"/><path d="M12 17.5 10.8 21h2.4L12 17.5Z" fill="currentColor"/><ellipse cx="9.5" cy="7.5" rx="1.6" ry="2.2" fill="#fff" opacity=".55"/></svg>`,

  /* Avatares */
  bolt: svg('<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z"/>'),
  moon: svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>'),
  leaf: svg('<path d="M5 19c0-8 5.5-13 14-13 0 8.5-5 14-13 14"/><path d="M5 19c3-4.5 6.5-7.5 11-10"/>'),
  smile: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14c1 1.6 2.2 2.4 3.5 2.4s2.5-.8 3.5-2.4"/><path d="M9 9.5h.01M15 9.5h.01" stroke-width="2.8"/>'),
  sparkle: svg('<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9L4.5 10.8 10.2 9 12 3.5Z"/><path d="M19 3v3M20.5 4.5h-3"/>'),
};

export function icon(name, className = 'w-6 h-6') {
  return `<span class="inline-flex ${className}">${icons[name] ?? ''}</span>`;
}
