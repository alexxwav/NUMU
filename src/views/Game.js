import confetti from 'canvas-confetti';
import { createButton, createAnswerButton } from '../components/Button.js';
import { createProgressBar, createLivesBar } from '../components/ProgressBar.js';
import { icon } from '../components/icons.js';
import { store } from '../state/store.js';
import { generateQuestions } from '../state/questions.js';
import { sfx, speak } from '../utils/audio.js';
import mascotUrl from '../assets/brand/mascot/numu-morado.png';

const QUESTIONS_PER_ROUND = 6;

function burst({ particleCount = 60, spread = 70 } = {}) {
  if (store.get().settings?.reduceMotion) return;
  confetti({ particleCount, spread, origin: { y: 0.7 }, colors: ['#5124EE', '#FFC700', '#00D282', '#00B4D8', '#FF8800'] });
}

/** Frame 4 — Ejercicio / Juego interactivo + Frame 5 — Recompensa. */
export function renderGame({ onNavigate, params }) {
  const state = store.get();
  const moduleId = params?.module ?? state.module;
  const questions = generateQuestions(moduleId, state.level, QUESTIONS_PER_ROUND);

  let index = 0;
  let mistakes = 0;
  let answered = false;

  const wrapper = document.createElement('div');
  wrapper.className = 'min-h-dvh flex flex-col bg-white';

  /* ---------- Header del juego ---------- */
  const header = document.createElement('header');
  header.className = 'sticky top-0 z-30 bg-white border-b-2 border-border-gray';
  header.innerHTML = `
    <div class="mx-auto max-w-3xl px-4 py-3 flex items-center gap-4">
      <button type="button" data-exit class="w-12 h-12 shrink-0 grid place-items-center rounded-full bg-coral-alert text-white shadow-3d-coral active:translate-y-1 transition-transform" aria-label="Salir de la lección">
        ${icon('close', 'w-7 h-7')}
      </button>
      <div data-progress class="flex-1"></div>
      <div data-lives></div>
    </div>
  `;
  const progress = createProgressBar({ percent: 0 });
  header.querySelector('[data-progress]').appendChild(progress);
  const livesBar = createLivesBar({ lives: state.lives, maxLives: state.maxLives });
  header.querySelector('[data-lives]').appendChild(livesBar);
  header.querySelector('[data-exit]').addEventListener('click', () => {
    sfx.tap();
    onNavigate('home');
  });
  wrapper.appendChild(header);

  /* ---------- Cuerpo: pregunta + opciones ---------- */
  const main = document.createElement('main');
  main.className = 'flex-1 mx-auto w-full max-w-3xl px-4 py-6 flex flex-col gap-6';
  wrapper.appendChild(main);

  const questionBlock = document.createElement('section');
  questionBlock.className = 'space-y-4';
  main.appendChild(questionBlock);

  const optionsWrap = document.createElement('section');
  optionsWrap.className = 'grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center';
  optionsWrap.setAttribute('aria-label', 'Opciones de respuesta');
  main.appendChild(optionsWrap);

  /* ---------- Feedback inferior (bottom sheet) ---------- */
  const sheet = document.createElement('div');
  sheet.className = 'fixed inset-x-0 bottom-0 z-40 translate-y-full transition-transform duration-300 ease-out';
  sheet.setAttribute('role', 'status');
  sheet.setAttribute('aria-live', 'polite');
  wrapper.appendChild(sheet);

  const showSheet = ({ kind, title, message, actions }) => {
    const bg = kind === 'correct' ? 'bg-mint-success' : kind === 'warn' ? 'bg-orange-energy' : 'bg-coral-alert';
    sheet.className = `fixed inset-x-0 bottom-0 z-40 translate-y-0 transition-transform duration-300 ease-out ${bg} text-white px-5 py-5 shadow-[0_-8px_24px_rgba(30,27,75,0.15)] animate-slide-up`;
    sheet.innerHTML = `
      <div class="mx-auto max-w-3xl flex flex-col sm:flex-row items-center gap-4">
        <span class="w-14 h-14 shrink-0 rounded-full bg-white grid place-items-center p-1.5 border-2 border-white/60" aria-hidden="true">
          <img src="${mascotUrl}" alt="" class="w-full h-full object-contain" />
        </span>
        <div class="flex-1 text-center sm:text-left">
          <p class="font-fredoka font-bold text-h2">${title}</p>
          <p class="font-nunito text-body">${message}</p>
        </div>
        <div class="flex gap-3 shrink-0" data-actions></div>
      </div>
    `;
    const actionsEl = sheet.querySelector('[data-actions]');
    actions.forEach((action) => {
      actionsEl.appendChild(
        createButton({
          label: action.label,
          variant: action.variant ?? 'white',
          onClick: action.onClick,
          className: 'min-w-[140px]',
        })
      );
    });
  };

  const hideSheet = () => {
    sheet.className = 'fixed inset-x-0 bottom-0 z-40 translate-y-full transition-transform duration-300 ease-out';
    sheet.innerHTML = '';
  };

  const refillLives = () => {
    store.restoreLives();
    livesBar.setLives(store.get().lives);
    hideSheet();
    renderQuestion();
  };

  /* ---------- Ciclo de preguntas ---------- */
  function renderQuestion() {
    answered = false;
    hideSheet();
    const question = questions[index];
    progress.setPercent((index / questions.length) * 100);

    questionBlock.innerHTML = `
      <div class="flex items-start justify-center gap-3">
        <h1 class="font-fredoka font-semibold text-h2-lg text-text-dark text-center flex-1">${question.prompt}</h1>
        <button type="button" data-speak class="w-14 h-14 shrink-0 grid place-items-center rounded-full bg-numu-purple text-white shadow-3d-primary active:translate-y-1 transition-transform" aria-label="Escuchar instrucción">
          ${icon('speaker', 'w-7 h-7')}
        </button>
      </div>
      <div class="flex justify-center">${question.visual}</div>
    `;
    questionBlock.querySelector('[data-speak]').addEventListener('click', () => {
      sfx.tap();
      speak(question.speakText);
    });

    optionsWrap.innerHTML = '';
    question.options.forEach((option, optionIndex) => {
      const btn = createAnswerButton(option.label, {
        onClick: () => handleAnswer(optionIndex, btn),
      });
      if (option.color) {
        btn.innerHTML = `<span class="flex flex-col items-center gap-2">
            <span class="w-9 h-9 rounded-full border-4 border-white shadow-md" style="background:${option.color}"></span>
            <span>${option.label}</span>
          </span>`;
        btn.classList.remove('text-display');
        btn.classList.add('text-h2');
      }
      optionsWrap.appendChild(btn);
    });

    speak(question.speakText);
  }

  function handleAnswer(optionIndex, btn) {
    if (answered) return;
    const question = questions[index];

    if (optionIndex === question.answerIndex) {
      answered = true;
      btn.classList.add('is-correct', 'bg-mint-success', 'text-white', 'border-mint-success');
      sfx.correct();
      burst({ particleCount: 40, spread: 50 });
      showSheet({
        kind: 'correct',
        title: '¡Muy bien!',
        message: 'Respuesta correcta, sigamos adelante.',
        actions: [
          {
            label: index + 1 >= questions.length ? 'Ver resultados' : 'Siguiente',
            variant: 'white',
            onClick: () => {
              sfx.tap();
              index += 1;
              if (index >= questions.length) finishRound();
              else renderQuestion();
            },
          },
        ],
      });
    } else {
      btn.classList.add('is-wrong', 'border-coral-alert', 'animate-bounce-squish');
      sfx.wrong();
      mistakes += 1;
      const updated = store.loseLife();
      livesBar.setLives(updated.lives);

      if (updated.lives <= 0) {
        answered = true;
        showSheet({
          kind: 'danger',
          title: '¡Se acabaron las vidas!',
          message: 'NUMU puede seguir contigo. ¿Recargamos corazones?',
          actions: [
            { label: 'Recargar', variant: 'yellow', onClick: refillLives },
            { label: 'Ir al inicio', variant: 'white', onClick: () => onNavigate('home') },
          ],
        });
        return;
      }
      showSheet({
        kind: 'warn',
        title: '¡Casi! Inténtalo de nuevo',
        message: 'Todavía tienes vidas. ¡Tú puedes!',
        actions: [{ label: 'Reintentar', variant: 'white', onClick: () => { hideSheet(); } }],
      });
    }
  }

  /* ---------- Frame 5 — Recompensa ---------- */
  function finishRound() {
    const stars = mistakes <= 1 ? 3 : mistakes <= 3 ? 2 : 1;
    store.addRewards({ gems: stars * 5, stars, xp: stars * 10, levelStars: stars });
    store.completeLevel();
    sfx.win();
    burst({ particleCount: 160, spread: 110 });

    const total = questions.length;
    wrapper.innerHTML = '';
    wrapper.className = 'min-h-dvh bg-numu-purple text-white flex flex-col items-center justify-center px-6 py-10 text-center relative overflow-hidden';
    wrapper.innerHTML = `
      <div class="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5" aria-hidden="true"></div>
      <div class="absolute -bottom-24 -left-16 w-80 h-80 rounded-full bg-white/5" aria-hidden="true"></div>

      <p class="font-fredoka font-bold text-h1-lg sm:text-display mb-6 relative">¡LO LOGRASTE!</p>

      <div class="flex gap-4 mb-7 relative" data-stars aria-label="${stars} de 3 estrellas">
        ${[0, 1, 2]
          .map(
            (i) => `
          <span class="text-sunshine-yellow ${i < stars ? '' : 'opacity-30 grayscale'}" style="animation-delay:${i * 0.25}s" data-star>
            ${icon('star', 'w-16 h-16 sm:w-20 sm:h-20')}
          </span>`
          )
          .join('')}
      </div>

      <div class="bg-white text-text-dark rounded-card px-8 py-5 mb-8 font-fredoka font-bold text-h2 shadow-lg relative tabular-nums">
        ${total} respuestas · ${stars * 10} XP · +${stars * 5} gemas
      </div>

      <div class="flex flex-col sm:flex-row gap-4 relative" data-reward-actions></div>
    `;

    wrapper.querySelectorAll('[data-star]').forEach((star, i) => {
      if (i < stars) star.classList.add('animate-star-light');
    });

    const actions = wrapper.querySelector('[data-reward-actions]');
    actions.appendChild(
      createButton({
        label: 'CONTINUAR',
        variant: 'success',
        className: 'h-touch-lg text-button-lg px-10 w-full sm:w-auto',
        onClick: () => {
          sfx.tap();
          onNavigate('home');
        },
      })
    );
    actions.appendChild(
      createButton({
        label: 'REPETIR',
        variant: 'cyan',
        className: 'h-touch-lg text-button-lg px-10 w-full sm:w-auto',
        onClick: () => {
          sfx.tap();
          onNavigate('game', { module: moduleId });
        },
      })
    );
  }

  renderQuestion();
  return wrapper;
}
