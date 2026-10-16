import { createButton } from '../components/Button.js';
import { icon } from '../components/icons.js';
import { store } from '../state/store.js';
import { sfx, speak } from '../utils/audio.js';
import mascot from '../assets/brand/mascot/logo-mascota-blanco.png';

/** Frame 1 — Splash & Bienvenida (fondo NUMU Purple, CTA "¡A JUGAR!"). */
export function renderSplash({ onNavigate }) {
  const el = document.createElement('main');
  el.className = 'min-h-dvh bg-numu-purple flex flex-col items-center justify-center relative px-6 py-10 text-white overflow-hidden';
  el.innerHTML = `
    <div class="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/5" aria-hidden="true"></div>
    <div class="absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-white/5" aria-hidden="true"></div>

    <button type="button" data-go-settings
      class="absolute top-5 right-5 w-touch h-touch grid place-items-center rounded-full text-white/90 hover:bg-white/10 transition-colors"
      aria-label="Zona de ajustes (personas adultas)">
      ${icon('gear', 'w-8 h-8')}
    </button>

    <img src="${mascot}" alt="El pulpo NUMU saludando" class="w-64 sm:w-72 lg:w-80 mb-8 animate-bounce-squish relative" />
    <p class="font-nunito text-body-lg text-white/85 mb-8 text-center max-w-md relative">
      Aprende matemáticas jugando. ¡Conteo, formas, patrones y más!
    </p>
    <div class="relative w-full max-w-sm" data-cta></div>
  `;

  const cta = createButton({
    label: '¡A JUGAR!',
    variant: 'yellow',
    className: 'font-fredoka text-3xl sm:text-4xl px-10 h-20 sm:h-24 w-full',
    onClick: () => {
      sfx.correct();
      onNavigate(store.get().profile.completed ? 'home' : 'login');
    },
  });
  el.querySelector('[data-cta]').appendChild(cta);

  el.querySelector('[data-go-settings]').addEventListener('click', () => {
    sfx.tap();
    onNavigate('settings');
  });

  speak('¡Hola! Soy NUMU. Pulsa jugar para empezar.');
  return el;
}
