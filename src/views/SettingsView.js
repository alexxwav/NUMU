import { createButton } from '../components/Button.js';
import { createField } from '../components/Form.js';
import { createToggle } from '../components/Toggle.js';
import { createAvatarPicker } from '../components/Avatar.js';
import { icon } from '../components/icons.js';
import { store } from '../state/store.js';
import { sfx } from '../utils/audio.js';

const GATE_ANSWER = 6;

function renderProfileSection() {
  const state = store.get();
  const section = document.createElement('section');
  section.className = 'card-numu p-6 space-y-5';
  section.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="w-11 h-11 rounded-full bg-soft-lavender grid place-items-center text-numu-purple">${icon('user', 'w-6 h-6')}</span>
      <div>
        <h2 class="font-fredoka font-bold text-h2 text-text-dark">Perfil del Estudiante</h2>
        <p class="font-nunito text-micro text-text-dark/55">Nombre, edad y avatar seleccionado</p>
      </div>
    </div>

    <div data-avatar-picker></div>
    <div class="grid sm:grid-cols-2 gap-4" data-profile-fields></div>
    <p class="font-nunito text-micro text-text-dark/45">Los cambios se guardan automáticamente en este dispositivo.</p>
  `;

  section.querySelector('[data-avatar-picker]').appendChild(
    createAvatarPicker({
      selected: state.profile.avatar ?? 0,
      onSelect: (index) => store.set({ profile: { avatar: index } }),
    })
  );

  const fields = section.querySelector('[data-profile-fields]');
  fields.appendChild(
    createField({
      label: 'Nombre',
      name: 'settings-name',
      placeholder: 'Luis Raza Rivera',
      value: state.profile.name,
      onInput: (value) => store.set({ profile: { name: value } }),
    })
  );
  fields.appendChild(
    createField({
      label: 'Edad',
      name: 'settings-age',
      type: 'number',
      placeholder: '8',
      value: state.profile.age,
      min: 4,
      max: 15,
      onInput: (value) => store.set({ profile: { age: value } }),
    })
  );
  return section;
}

function renderAccessibilitySection() {
  const state = store.get();
  const section = document.createElement('section');
  section.className = 'card-numu p-6 space-y-5';
  section.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="w-11 h-11 rounded-full bg-soft-lavender grid place-items-center text-numu-purple">${icon('speaker', 'w-6 h-6')}</span>
      <div>
        <h2 class="font-fredoka font-bold text-h2 text-text-dark">Accesibilidad y Audio</h2>
        <p class="font-nunito text-micro text-text-dark/55">Volumen, sonido y legibilidad</p>
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label for="volume-range" class="font-fredoka font-bold text-button text-text-dark">Volumen de efectos y voz</label>
        <span data-volume-value class="font-fredoka font-bold text-button text-numu-purple tabular-nums"></span>
      </div>
      <input id="volume-range" data-volume type="range" min="0" max="100" step="5" class="range-numu w-full" />
    </div>

    <div data-a11y-toggles></div>
  `;

  const range = section.querySelector('[data-volume]');
  const valueEl = section.querySelector('[data-volume-value]');
  const current = Math.round((state.settings.volume ?? 0.8) * 100);
  range.value = String(current);
  valueEl.textContent = `${current}%`;
  range.addEventListener('input', () => {
    valueEl.textContent = `${range.value}%`;
    store.set({ settings: { volume: Number(range.value) / 100 } });
  });

  const toggles = section.querySelector('[data-a11y-toggles]');
  toggles.appendChild(
    createToggle({
      label: 'Efectos de Sonido',
      description: 'Sonidos de interfaz, aciertos e instrucciones habladas',
      checked: state.settings.sound,
      onChange: (v) => store.set({ settings: { sound: v } }),
    })
  );
  toggles.appendChild(
    createToggle({
      label: 'Modo de Alta Legibilidad',
      description: 'Reduce animaciones y refuerza el contraste visual',
      checked: state.settings.reduceMotion,
      onChange: (v) => store.set({ settings: { reduceMotion: v } }),
    })
  );
  return section;
}

function renderMetrics(state) {
  return `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
      ${[
        { label: 'Nivel', value: state.level },
        { label: 'Estrellas', value: state.stars },
        { label: 'Gemas', value: state.gems },
        { label: 'Racha', value: `${state.streak} d` },
      ]
        .map(
          (m) => `
        <div class="rounded-card bg-soft-lavender py-4 border-2 border-border-gray">
          <p class="font-fredoka font-bold text-h2 text-numu-purple tabular-nums">${m.value}</p>
          <p class="font-nunito font-bold text-micro text-text-dark/60">${m.label}</p>
        </div>`
        )
        .join('')}
    </div>
  `;
}

function renderLocked(onUnlock, state) {
  const locked = document.createElement('div');
  locked.className = 'rounded-card border-2 border-dashed border-border-gray bg-soft-lavender p-6 space-y-4 text-center';
  locked.innerHTML = `
    <span class="inline-grid place-items-center w-touch h-touch rounded-full bg-white border-2 border-border-gray text-numu-purple">${icon('lock', 'w-8 h-8')}</span>
    <p class="font-fredoka font-bold text-button text-text-dark">Zona de tutores</p>
    <p class="font-nunito text-body text-text-dark/70">Para ingresar a la zona de tutores, resuelve:<br />
      <strong class="font-fredoka text-h2 text-numu-purple">Nueve menos tres</strong>
    </p>
    <form data-gate-form class="flex flex-col sm:flex-row gap-3 justify-center items-center">
      <input data-gate-input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="?"
        aria-label="Resultado: nueve menos tres"
        class="w-full sm:w-32 h-touch rounded-btn border-2 border-border-gray bg-white px-4 text-center font-fredoka font-bold text-h2 text-text-dark focus:border-numu-purple" />
      <div data-gate-submit></div>
    </form>
    <p data-gate-error class="font-nunito font-bold text-micro text-coral-alert min-h-[1.2em]" role="alert"></p>
  `;

  const form = locked.querySelector('[data-gate-form]');
  const input = locked.querySelector('[data-gate-input]');
  const error = locked.querySelector('[data-gate-error]');

  const submit = () => {
    if (Number(input.value.trim()) === GATE_ANSWER) {
      sfx.correct();
      onUnlock();
    } else {
      sfx.wrong();
      error.textContent = 'Respuesta incorrecta. Inténtalo de nuevo.';
      input.value = '';
      input.focus();
    }
  };

  locked.querySelector('[data-gate-submit]').appendChild(
    createButton({ label: 'Verificar', variant: 'primary', onClick: submit })
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });

  void state;
  return locked;
}

function renderUnlocked({ onNavigate }) {
  const state = store.get();
  const panel = document.createElement('div');
  panel.className = 'space-y-5';
  panel.innerHTML = `
    ${renderMetrics(state)}
    <div data-advanced-toggles></div>

    <div class="space-y-2">
      <label for="font-scale" class="font-fredoka font-bold text-button text-text-dark">Tamaño de texto e iconos</label>
      <input id="font-scale" data-font-scale type="range" min="0.9" max="1.3" step="0.05" value="${state.settings.fontScale}" class="range-numu w-full" />
      <div class="flex justify-between font-nunito text-micro text-text-dark/50"><span>Pequeño</span><span>Grande</span></div>
    </div>

    <div data-reset></div>
  `;

  const toggles = panel.querySelector('[data-advanced-toggles]');
  toggles.appendChild(
    createToggle({
      label: 'Modo de Alta Legibilidad (daltonismo)',
      description: 'Refuerza los colores con patrones visuales adicionales',
      checked: state.settings.colorblind,
      onChange: (v) => store.set({ settings: { colorblind: v } }),
    })
  );

  panel.querySelector('[data-font-scale]').addEventListener('input', (e) => {
    store.set({ settings: { fontScale: Number(e.target.value) } });
  });

  panel.querySelector('[data-reset]').appendChild(
    createButton({
      label: 'Restablecer progreso',
      variant: 'coral',
      className: 'w-full',
      onClick: () => {
        if (confirm('¿Seguro que quieres borrar todo el progreso guardado? Tu perfil se conservará.')) {
          store.reset();
          sfx.tap();
          onNavigate('home');
        }
      },
    })
  );
  return panel;
}

function renderParentalSection({ onNavigate }) {
  const section = document.createElement('section');
  section.className = 'card-numu p-6 space-y-5';
  section.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="w-11 h-11 rounded-full bg-soft-lavender grid place-items-center text-numu-purple">${icon('shield', 'w-6 h-6')}</span>
      <div>
        <h2 class="font-fredoka font-bold text-h2 text-text-dark">Control Parental</h2>
        <p class="font-nunito text-micro text-text-dark/55">Configuración avanzada para personas adultas</p>
      </div>
    </div>
    <div data-parental-body></div>
  `;

  const mountLocked = () => {
    const body = section.querySelector('[data-parental-body]');
    body.innerHTML = '';
    body.appendChild(renderLocked(mountUnlocked, store.get()));
  };
  const mountUnlocked = () => {
    const body = section.querySelector('[data-parental-body]');
    body.innerHTML = '';
    body.appendChild(renderUnlocked({ onNavigate }));
  };

  mountLocked();
  return section;
}

/** Frame 6 — Configuración y Preferencias (perfil, accesibilidad y control parental). */
export function renderSettingsView({ onNavigate }) {
  const el = document.createElement('div');
  el.className = 'max-w-3xl mx-auto space-y-6';
  el.innerHTML = `
    <header>
      <h1 class="font-fredoka font-bold text-h1 text-text-dark">Configuración y Preferencias</h1>
      <p class="font-nunito text-body text-text-dark/60">Administra el perfil, la accesibilidad y los controles para tutores.</p>
    </header>
    <div data-sections class="space-y-6"></div>
  `;

  const sections = el.querySelector('[data-sections]');
  sections.appendChild(renderProfileSection());
  sections.appendChild(renderAccessibilitySection());
  sections.appendChild(renderParentalSection({ onNavigate }));

  return el;
}
