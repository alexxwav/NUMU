import confetti from 'canvas-confetti';
import { createButton, createAnswerButton } from '../components/Button.js';
import { createField } from '../components/Form.js';
import { createAvatarPicker } from '../components/Avatar.js';
import { icon } from '../components/icons.js';
import { store, MODULES } from '../state/store.js';
import { sfx } from '../utils/audio.js';
import logoUrl from '../assets/brand/mascot/logo-completo-blanco.png';

/* Evaluación inicial: 5 preguntas breves de opción múltiple */
const DIAGNOSTIC = [
  { prompt: '¿Cuánto es 8 x 7?', options: ['48', '56', '64', '54'], answer: 1 },
  { prompt: '¿Cuánto es 20 / 4?', options: ['4', '6', '5', '10'], answer: 2 },
  { prompt: '¿Cuánto es 15 + 27?', options: ['42', '41', '52', '32'], answer: 0 },
  { prompt: '¿Cuánto es 9 x 6?', options: ['56', '45', '64', '54'], answer: 3 },
  { prompt: '¿Cuánto es 100 - 36?', options: ['64', '74', '54', '66'], answer: 0 },
];

const LEVEL_OPTIONS = [
  { id: 'none', label: 'No sé nada', hint: 'Empezamos desde cero, sin prisa.', iconName: 'gaugeLow' },
  { id: 'some', label: 'Sé un poco', hint: 'Repasamos lo básico y avanzamos.', iconName: 'gaugeMid' },
  { id: 'much', label: 'Sé mucho', hint: 'Reto level: vamos directo a lo bueno.', iconName: 'gaugeHigh' },
];

/* 3 pasos iniciales + 5 de diagnóstico + avatar = 9 pasos */
const TOTAL_STEPS = 3 + DIAGNOSTIC.length + 1;

const STEP_META = [
  { title: '¡Conocámonos!', subtitle: 'Cuéntanos un poco de ti para personalizar tu aventura.' },
  { title: '¿Qué te gustaría aprender?', subtitle: 'Elige uno o varios temas. Podrás cambiar después.' },
  { title: '¿Qué tanto sabes del tema?', subtitle: 'Así ajustamos la dificultad a tu ritmo.' },
  ...DIAGNOSTIC.map((q, i) => ({ title: `Pregunta ${i + 1} de 5`, subtitle: 'Responde con calma: aquí no se pierden vidas.' })),
  { title: 'Elige tu avatar', subtitle: 'Ponle un toque personal a tu perfil de jugador.' },
];

const OPTION_BASE = 'btn-3d btn-white answer-option min-w-[90px] min-h-[90px] text-display px-4 tabular-nums';
const OPTION_SELECTED = 'border-numu-purple bg-soft-lavender text-numu-purple shadow-3d-primary';

/** Frame 2+ — Login / Registro: onboarding por pasos con layout dividido. */
export function renderLogin({ onNavigate }) {
  const saved = store.get().profile;
  const draft = {
    name: saved.name || '',
    age: saved.age || '',
    country: saved.country || '',
    grade: saved.grade || '',
    interests: [...(saved.interests || [])],
    level: saved.level || null,
    answers: Array(DIAGNOSTIC.length).fill(null),
    avatar: saved.avatar ?? 0,
    nickname: saved.nickname || '',
  };
  let step = 0;

  const el = document.createElement('div');
  el.className = 'min-h-dvh grid lg:grid-cols-2 bg-soft-lavender';
  el.innerHTML = `
    <!-- Columna izquierda: panel visual -->
    <section class="relative bg-numu-purple text-white px-6 py-8 sm:px-10 flex flex-col overflow-hidden lg:min-h-dvh">
      <div class="absolute -top-20 -left-16 w-64 h-64 rounded-full bg-white/5" aria-hidden="true"></div>
      <div class="absolute -bottom-24 -right-12 w-80 h-80 rounded-full bg-white/5" aria-hidden="true"></div>

      <div class="relative flex-1 grid place-items-center py-8">
        <img src="${logoUrl}" alt="NUMU" class="w-48 sm:w-60 animate-bounce-squish" />
      </div>

      <div class="relative flex flex-col items-start gap-3 pb-2">
        <span data-step-chip class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/25 font-nunito font-bold text-micro-lg"></span>
        <p class="font-nunito text-body text-white/75 max-w-sm">Puedes volver atrás siempre que quieras: tu progreso se guarda al finalizar.</p>
      </div>
    </section>

    <!-- Columna derecha: formulario -->
    <section class="flex flex-col lg:justify-center px-4 sm:px-8 py-6 lg:py-10">
      <div class="card-numu w-full max-w-xl mx-auto p-6 sm:p-8 flex flex-col">
        <header class="mb-6">
          <h1 data-step-title class="font-fredoka font-bold text-h1 text-text-dark"></h1>
          <p data-step-subtitle class="font-nunito text-body text-text-dark/60 mt-1"></p>
        </header>

        <div data-step-body class="flex-1 space-y-5"></div>

        <footer class="mt-8 pt-5 border-t-2 border-border-gray grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-4">
          <div data-footer-back></div>
          <div data-footer-dots class="flex items-center justify-center gap-2" role="progressbar"
            aria-valuemin="1" aria-valuemax="${TOTAL_STEPS}" aria-valuenow="1" aria-label="Progreso del registro"></div>
          <div data-footer-next></div>
        </footer>
      </div>
    </section>
  `;

  const body = el.querySelector('[data-step-body]');
  const titleEl = el.querySelector('[data-step-title]');
  const subtitleEl = el.querySelector('[data-step-subtitle]');
  const chipEl = el.querySelector('[data-step-chip]');
  const dotsEl = el.querySelector('[data-footer-dots]');
  const backWrap = el.querySelector('[data-footer-back]');
  const nextWrap = el.querySelector('[data-footer-next]');

  /* ---------- Validación por paso ---------- */
  function isValid(s) {
    switch (s) {
      case 0:
        return Boolean(
          draft.name.trim() &&
          String(draft.age).trim() !== '' &&
          Number(draft.age) >= 4 && Number(draft.age) <= 15 &&
          draft.country.trim() &&
          draft.grade.trim()
        );
      case 1:
        return draft.interests.length > 0;
      case 2:
        return draft.level !== null;
      case TOTAL_STEPS - 1:
        return draft.nickname.trim().length >= 2;
      default:
        return draft.answers[s - 3] !== null;
    }
  }

  /* ---------- Footer (Regresar · puntos · Continuar) ---------- */
  function renderFooter() {
    dotsEl.innerHTML = Array.from({ length: TOTAL_STEPS }, (_, i) => {
      if (i === step) return '<span class="w-6 h-2.5 rounded-full bg-numu-purple transition-all"></span>';
      if (i < step) return '<span class="w-2.5 h-2.5 rounded-full bg-numu-purple/45"></span>';
      return '<span class="w-2.5 h-2.5 rounded-full bg-border-gray"></span>';
    }).join('');
    dotsEl.setAttribute('aria-valuenow', String(step + 1));

    backWrap.innerHTML = '';
    const backBtn = createButton({
      label: 'Regresar',
      iconName: 'arrowLeft',
      variant: 'white',
      className: 'px-4 sm:px-5 text-micro-lg',
      onClick: () => {
        if (step === 0) return;
        sfx.tap();
        step -= 1;
        renderStep();
      },
    });
    backBtn.disabled = step === 0;
    backWrap.appendChild(backBtn);

    const isFinal = step === TOTAL_STEPS - 1;
    nextWrap.innerHTML = '';
    nextWrap.appendChild(
      createButton({
        label: isFinal ? '¡A JUGAR!' : 'Continuar',
        iconName: isFinal ? null : 'arrowRight',
        variant: isFinal ? 'yellow' : 'primary',
        className: isFinal ? 'px-7 sm:px-9 text-h2' : 'px-5 sm:px-7 text-button',
        onClick: () => {
          if (!isValid(step)) return;
          sfx.tap();
          if (isFinal) finish();
          else {
            step += 1;
            renderStep();
          }
        },
      })
    );
    nextWrap.querySelector('button').disabled = !isValid(step);
  }

  /* ---------- Constructores de contenido por paso ---------- */

  function renderProfileStep() {
    const grid = document.createElement('div');
    grid.className = 'grid sm:grid-cols-2 gap-4';
    const field = (config) => {
      const f = createField({ ...config, onInput: (value) => { draft[config.name] = value; renderFooter(); } });
      return f;
    };
    grid.appendChild(field({ label: '¿Cómo te llamas?', name: 'name', placeholder: 'Luis Raza Rivera', value: draft.name }));
    grid.appendChild(field({ label: '¿Cuántos años tienes?', name: 'age', type: 'number', placeholder: '8', value: draft.age, min: 4, max: 15 }));
    grid.appendChild(field({ label: '¿De qué país eres?', name: 'country', placeholder: 'México', value: draft.country }));
    grid.appendChild(field({ label: '¿En qué grado estás?', name: 'grade', placeholder: '3° de Primaria', value: draft.grade }));
    body.appendChild(grid);
  }

  function renderInterestsStep() {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4';
    MODULES.forEach((module) => {
      const selected = draft.interests.includes(module.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(selected));
      const base = 'w-full flex items-center gap-4 p-4 rounded-card border-2 transition-all duration-100 active:translate-y-1 text-left';
      const cls = selected
        ? 'border-numu-purple bg-soft-lavender shadow-3d-primary'
        : 'border-border-gray bg-white shadow-3d-white hover:-translate-y-0.5';
      btn.className = `${base} ${cls}`;
      btn.innerHTML = `
        <span class="w-14 h-14 rounded-2xl grid place-items-center text-white shrink-0 ${module.color}">${icon(module.iconKey, 'w-8 h-8')}</span>
        <span class="font-fredoka font-bold text-h2 text-text-dark">${module.name}</span>
        <span class="ml-auto w-8 h-8 rounded-full grid place-items-center shrink-0 ${selected ? 'bg-numu-purple text-white' : 'border-2 border-border-gray text-transparent'}">${icon('check', 'w-5 h-5')}</span>
      `;
      btn.addEventListener('click', () => {
        sfx.tap();
        const id = module.id;
        if (draft.interests.includes(id)) draft.interests = draft.interests.filter((x) => x !== id);
        else draft.interests.push(id);
        renderStep();
      });
      grid.appendChild(btn);
    });
    body.appendChild(grid);
  }

  function renderLevelStep() {
    const list = document.createElement('div');
    list.className = 'space-y-4';
    list.setAttribute('role', 'radiogroup');
    list.setAttribute('aria-label', 'Tu nivel actual');
    LEVEL_OPTIONS.forEach((option) => {
      const selected = draft.level === option.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(selected));
      const base = 'w-full flex items-center gap-4 p-4 sm:p-5 rounded-card border-2 transition-all duration-100 active:translate-y-1 text-left';
      const cls = selected
        ? 'border-numu-purple bg-soft-lavender shadow-3d-primary'
        : 'border-border-gray bg-white shadow-3d-white hover:-translate-y-0.5';
      btn.className = `${base} ${cls}`;
      btn.innerHTML = `
        <span class="w-14 h-14 rounded-full grid place-items-center shrink-0 ${selected ? 'bg-numu-purple text-white' : 'bg-soft-lavender text-numu-purple'}">${icon(option.iconName, 'w-8 h-8')}</span>
        <span class="min-w-0">
          <span class="block font-fredoka font-bold text-button text-text-dark">${option.label}</span>
          <span class="block font-nunito text-micro text-text-dark/55">${option.hint}</span>
        </span>
        <span class="ml-auto w-7 h-7 rounded-full grid place-items-center shrink-0 ${selected ? 'bg-numu-purple text-white' : 'border-2 border-border-gray text-transparent'}">${icon('check', 'w-4 h-4')}</span>
      `;
      btn.addEventListener('click', () => {
        sfx.tap();
        draft.level = option.id;
        renderStep();
      });
      list.appendChild(btn);
    });
    body.appendChild(list);
  }

  function renderDiagnosticStep(questionIndex) {
    const question = DIAGNOSTIC[questionIndex];
    const prompt = document.createElement('p');
    prompt.className = 'font-fredoka font-semibold text-h2-lg text-text-dark text-center';
    prompt.textContent = question.prompt;
    body.appendChild(prompt);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-4 justify-items-center';
    grid.setAttribute('aria-label', 'Opciones de respuesta');
    question.options.forEach((value, optionIndex) => {
      const selected = draft.answers[questionIndex] === optionIndex;
      const btn = createAnswerButton(value, { onClick: () => {
        sfx.tap();
        draft.answers[questionIndex] = optionIndex;
        grid.querySelectorAll('button').forEach((b, i) => {
          b.className = `${OPTION_BASE} ${i === optionIndex ? OPTION_SELECTED : 'hover:border-numu-purple'}`;
          b.setAttribute('aria-pressed', String(i === optionIndex));
        });
        renderFooter();
      } });
      btn.className = `${OPTION_BASE} ${selected ? OPTION_SELECTED : 'hover:border-numu-purple'}`;
      btn.setAttribute('aria-pressed', String(selected));
      grid.appendChild(btn);
    });
    body.appendChild(grid);
  }

  function renderAvatarStep() {
    const picker = createAvatarPicker({
      selected: draft.avatar,
      onSelect: (index) => {
        draft.avatar = index;
        sfx.tap();
        renderFooter();
      },
    });
    body.appendChild(picker);
    body.appendChild(
      createField({
        label: 'Elige un apodo',
        name: 'nickname',
        placeholder: 'LuisPro',
        value: draft.nickname,
        hint: 'Será el nombre que veas en tu mapa de aprendizaje.',
        onInput: (value) => {
          draft.nickname = value;
          renderFooter();
        },
      })
    );
  }

  /* ---------- Render del paso actual ---------- */
  function renderStep() {
    const meta = STEP_META[step];
    titleEl.textContent = meta.title;
    subtitleEl.textContent = meta.subtitle;
    chipEl.innerHTML = `${icon('sparkle', 'w-4 h-4')}<span>Paso ${step + 1} de ${TOTAL_STEPS}</span>`;

    body.innerHTML = '';
    if (step === 0) renderProfileStep();
    else if (step === 1) renderInterestsStep();
    else if (step === 2) renderLevelStep();
    else if (step < TOTAL_STEPS - 1) renderDiagnosticStep(step - 3);
    else renderAvatarStep();

    renderFooter();
    body.firstElementChild?.scrollIntoView?.({ block: 'nearest' });
  }

  /* ---------- Finalización ---------- */
  function finish() {
    const score = draft.answers.reduce(
      (acc, answer, i) => acc + (answer === DIAGNOSTIC[i].answer ? 1 : 0),
      0
    );
    store.completeOnboarding({
      name: draft.name.trim(),
      age: String(draft.age).trim(),
      country: draft.country.trim(),
      grade: draft.grade.trim(),
      interests: draft.interests,
      level: draft.level,
      score,
      avatar: draft.avatar,
      nickname: draft.nickname.trim(),
    });
    sfx.win();
    if (!store.get().settings.reduceMotion) {
      confetti({ particleCount: 140, spread: 100, origin: { y: 0.6 }, colors: ['#5124EE', '#FFC700', '#00D282', '#00B4D8', '#FF8800'] });
    }
    onNavigate('home');
  }

  renderStep();
  return el;
}
