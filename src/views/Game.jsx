import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { Home, Lightbulb, X, Volume2 } from 'lucide-react';
import { store, getTotalXp } from '../state/store.js';
import { generateQuestions, buildQuestionHint } from '../state/questions.js';
import { lessonForModule, lessonLevelFromState, levelAfterRound, MAX_LESSON_LEVEL } from '../utils/lessonLevel.js';
import { buildLessonRound, QUESTIONS_PER_ROUND } from '../utils/lessonRound.js';
import { sfx, speak } from '../utils/audio.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useLessonProgress } from '../hooks/useLessonProgress.js';
import { academicStarsFor, needsReinforcement, starsForRound } from '../utils/stars.js';
import { ROUTES } from '../services/startRoute.js';
import { normalizeModuleId, courseSlugForModule } from '../data/subjects.js';
import lessonCatalog from '../data/lessonContent.json';
import { getLessonById } from '../utils/lessonContent.js';
import mascotUrl from '../assets/brand/mascot/numu-morado.png';
import { heartOn, heartOff, starIcon } from '../components/iconAssets.js';

function burst({ particleCount = 60, spread = 70 } = {}) {
  if (store.get().settings?.reduceMotion) return;
  confetti({ particleCount, spread, origin: { y: 0.7 }, colors: ['#5124EE', '#FFC700', '#00D282', '#00B4D8', '#FF8800'] });
}

export default function Game() {
  const navigate = useNavigate();
  const { recordRound, recordModuleRound } = useAuth();
  const { saveLessonResult } = useLessonProgress();
  const { nivel, lessonId } = useParams(); // módulo ('conteo', 'sumas', …) o lección del catálogo
  const [searchParams] = useSearchParams(); // ?parada=N la envía el mapa del curso
  // La lección del catálogo: la de la ruta /lecciones/:id/jugar o, desde /jugar/:modulo, la de ese módulo.
  const [lessonEntry] = useState(() => (lessonId
    ? getLessonById(lessonCatalog, lessonId)
    : lessonForModule(lessonCatalog, nivel ?? store.get().module)));
  const moduleId = lessonEntry?.lesson.module_id ?? normalizeModuleId(nivel ?? store.get().module) ?? 'conteo';
  // Parada del mapa que se está jugando; si viene de una lección, se usa la parada actual del módulo.
  const fromMap = Number(searchParams.get('parada'));
  const playedLevel = Math.max(1, Math.floor(fromMap || store.get().levelByModule?.[moduleId] || 1));
  // Las rondas del mapa vuelven a la vista del curso con la ruta activa; las de lección, a su ficha.
  const courseId = lessonEntry?.course?.id ?? courseSlugForModule(moduleId);
  const exitTo = lessonId && lessonEntry
    ? `/lecciones/${lessonEntry.lesson.id}`
    : courseId ? `/cursos/${courseId}?modulo=${moduleId}` : ROUTES.home;

  // Nivel ACADÉMICO de esta lección (1 a 3): el guardado o el inicial del diagnóstico (R1–R3).
  // Es independiente del nivel general (state.level), que solo es gamificación.
  const [lessonLevel] = useState(() => (lessonEntry ? lessonLevelFromState(store.get(), lessonEntry.lesson.id) : null));

  // Estados del juego
  const [questions] = useState(() => {
    // Lección: ejercicios según su nivel (nivel 1 catálogo de Viviana; 2 y 3 generador con R12–R14).
    if (lessonEntry) return buildLessonRound({ lesson: lessonEntry.lesson, level: lessonLevel });
    return generateQuestions(moduleId, 1, QUESTIONS_PER_ROUND);
  });

  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0); // errores de la ronda (para las estrellas)
  const [questionMistakes, setQuestionMistakes] = useState(0); // errores del ejercicio actual
  const [isTipOpen, setIsTipOpen] = useState(false);
  const [showHintPrompt, setShowHintPrompt] = useState(false);
  const [hintDeclined, setHintDeclined] = useState(false);
  const [hintOffered, setHintOffered] = useState(false);
  const reduceMotion = Boolean(store.get().settings?.reduceMotion);
  const [answered, setAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [sheet, setSheet] = useState(null); // Controla el mensaje emergente de abajo
  const [isFinished, setIsFinished] = useState(false);
  const [lives, setLives] = useState(() => store.get().lives);
  // R10: si en esta ronda las vidas llegaron a 0, no hay avance académico aunque se recarguen.
  const [livesDepleted, setLivesDepleted] = useState(false);
  const [levelResult, setLevelResult] = useState(null);
  const [xpEarned, setXpEarned] = useState(0);
  
  const currentQ = questions[index];
  const maxLives = store.get().maxLives;
  const progressPercent = (index / questions.length) * 100;
  // Estrellas de la ronda: 0 si se acabaron las vidas, de 1 a 3 según los errores.
  const roundStars = starsForRound({ total: questions.length, mistakes, approved: lives > 0 });
  // El resultado solo ofrece refuerzo tras una ronda con errores; con 3 estrellas no hay mensajes.
  const showReinforcement = Boolean(lessonEntry) && needsReinforcement({ mistakes, stars: roundStars });

  // Escuchar la instrucción al cargar la pregunta
  useEffect(() => {
    if (currentQ && !isFinished) {
      speak(currentQ.speakText);
    }
  }, [index, currentQ, isFinished]);

  // Solo se llama al cambiar de ejercicio (o al salir): recargar vidas no toca estos estados.
  const resetHintStates = () => {
    setQuestionMistakes(0);
    setIsTipOpen(false);
    setShowHintPrompt(false);
    setHintDeclined(false);
    setHintOffered(false);
  };

  const handleAnswer = (optionIndex) => {
    if (answered) return;
    setAnswered(true);
    setSelectedOption(optionIndex);

    if (optionIndex === currentQ.answerIndex) {
      sfx.correct();
      burst({ particleCount: 40, spread: 50 });
      setSheet({
        kind: 'correct',
        title: '¡Muy bien!',
        message: 'Respuesta correcta, sigamos adelante.',
        buttonText: index + 1 >= questions.length ? 'Ver resultados' : 'Siguiente',
        onAction: () => {
          sfx.tap();
          setSheet(null);
          if (index + 1 >= questions.length) {
            finishRound();
          } else {
            resetHintStates();
            setIndex(index + 1);
            setAnswered(false);
            setSelectedOption(null);
          }
        }
      });
    } else {
      sfx.wrong();
      setMistakes((m) => m + 1);
      const nextMistakes = questionMistakes + 1;
      setQuestionMistakes(nextMistakes);
      // Se ofrece en el 2.º error aunque este fallo se lleve las últimas vidas;
      // al recargar corazones el pop-up (o el botón mostaza) seguirá disponible.
      if (nextMistakes >= 2 && !hintOffered) {
        setHintOffered(true);
        setShowHintPrompt(true);
      }
      const updated = store.loseLife();
      setLives(updated.lives);

      if (updated.lives <= 0) {
        setLivesDepleted(true);
        setSheet({
          kind: 'danger',
          title: '¡Se acabaron las vidas!',
          message: 'NUMU puede seguir contigo. ¿Recargamos corazones?',
          isGameOver: true
        });
      } else {
        setSheet({
          kind: 'warn',
          title: '¡Casi! Inténtalo de nuevo',
          message: 'Todavía tienes vidas. ¡Tú puedes!',
          buttonText: 'Reintentar',
          onAction: () => {
            setSheet(null);
            setAnswered(false);
            setSelectedOption(null);
          }
        });
      }
    }
  };

  const refillLives = () => {
    store.restoreLives();
    setLives(store.get().lives);
    setSheet(null);
    // No se tocan questionMistakes ni los estados de pista de este ejercicio.
    setAnswered(false);
    setSelectedOption(null);
  };

  const finishRound = () => {
    setIsFinished(true);
    const stars = roundStars;
    const completedLevel = playedLevel; // parada de esta sección que se acaba de terminar
    const xpBefore = getTotalXp(store.get());
    store.addRewards({ gems: stars * 5, stars, xp: stars * 50, levelStars: stars });
    // Avance de esta sección: parada siguiente y estrellas de la parada terminada.
    store.recordModuleRound({ moduleId, stars, level: completedLevel });
    // Repetir una parada con las mismas estrellas no añade XP; mejorar sí suma 50 por estrella.
    setXpEarned(getTotalXp(store.get()) - xpBefore);
    store.completeLevel();
    recordModuleRound({ moduleId, stars, level: completedLevel }).then(({ error }) => {
      if (error) console.warn('No se pudo guardar el progreso de la sección en la cuenta:', error);
    });
    // Guarda el avance en la cuenta; si falla, el progreso sigue en este dispositivo.
    recordRound({ stars }).then(({ error }) => {
      if (error) console.warn('No se pudo guardar el progreso en la cuenta:', error);
    });
    // Progreso de la lección: mejor y última puntuación, y su nivel académico (R7–R10).
    const finishedLessonId = lessonEntry?.lesson?.id;
    if (finishedLessonId) {
      const result = levelAfterRound({ level: lessonLevel, stars, livesDepleted });
      setLevelResult(result);
      // Estrellas académicas: 0 si se agotaron las vidas en la ronda (aunque se recargaran).
      // Las recompensas de arriba siguen usando `stars`; la mejor marca guardada no baja.
      const academicStars = academicStarsFor({ roundStars: stars, livesDepleted });
      saveLessonResult({ lessonId: finishedLessonId, stars: academicStars, level: result.level }).then(({ error }) => {
        if (error) console.warn('No se pudo guardar el progreso de la lección:', error);
      });
    }
    sfx.win();
    burst({ particleCount: 160, spread: 110 });
  };

  // La tarjeta depende solo de que el niño haya pedido la pista: el texto siempre existe.
  const tipText = buildQuestionHint(currentQ, moduleId);
  const tipCard = isTipOpen && (
    <aside id="question-tip" role="status" className="flex items-start gap-3 rounded-card bg-soft-lavender border-2 border-numu-purple/20 px-4 py-3 text-left text-text-dark shadow-sm">
      <Lightbulb className="mt-1 h-6 w-6 shrink-0 text-numu-purple" aria-hidden="true" />
      <div>
        <p className="font-fredoka text-xl font-bold text-numu-purple">¡Vamos paso a paso!</p>
        <p className="text-sm sm:text-base">{tipText}</p>
      </div>
    </aside>
  );

  // --- Vista de Resultados (Frame 5) ---
  if (isFinished) {
    const stars = roundStars;
    return (
      <div className="min-h-screen bg-numu-purple text-white flex flex-col items-center justify-center px-6 py-10 text-center relative overflow-hidden font-poppins">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5" aria-hidden="true"></div>
        <div className="absolute -bottom-24 -left-16 w-80 h-80 rounded-full bg-white/5" aria-hidden="true"></div>

        <p className="font-fredoka font-bold text-4xl sm:text-5xl mb-6 relative z-10">¡LO LOGRASTE!</p>

        <div className="flex gap-4 mb-7 relative z-10">
          {[0, 1, 2].map((i) => (
            <img
              key={i}
              src={starIcon}
              alt=""
              className={`w-16 h-16 sm:w-20 sm:h-20 object-contain ${i < stars ? 'animate-bounce' : 'grayscale opacity-30'}`}
            />
          ))}
        </div>

        <div className="bg-white text-text-dark rounded-card px-8 py-5 mb-8 font-fredoka font-bold text-2xl shadow-lg relative z-10">
          {questions.length} respuestas · +{xpEarned} XP · +{stars * 5} gemas
        </div>

        {lessonEntry && levelResult && (
          <p className="relative z-10 -mt-4 mb-8 font-fredoka font-bold text-xl" role="status">
            {levelResult.advanced
              ? `¡Subiste al nivel ${levelResult.level} de ${lessonEntry.lesson.title}!`
              : levelResult.rule === 'R10'
                ? `Se acabaron las vidas: sigues en el nivel ${levelResult.level} de ${MAX_LESSON_LEVEL}.`
                : `${lessonEntry.lesson.title}: nivel ${levelResult.level} de ${MAX_LESSON_LEVEL}`}
          </p>
        )}

        {showReinforcement && (
          <div className="relative z-10 w-full max-w-md mb-8 rounded-card bg-white px-5 py-5 text-left text-text-dark shadow-lg">
            <p className="font-fredoka font-bold text-xl text-numu-purple mb-1">Refuerza esta habilidad</p>
            <p className="font-poppins text-base">
              Tuviste varios errores en esta ronda. ¿Quieres practicar «{lessonEntry.lesson.title}» de nuevo para dominarla?
            </p>
            <button
              type="button"
              onClick={() => { sfx.tap(); navigate(`/lecciones/${lessonEntry.lesson.id}/jugar`); }}
              className="mt-4 min-h-[64px] w-full rounded-btn bg-orange-energy text-white font-fredoka font-bold text-lg shadow-3d-orange active:translate-y-1 active:shadow-none transition-all"
            >
              Reforzar ahora
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 relative z-10 w-full max-w-md">
          <button onClick={() => { sfx.tap(); navigate(exitTo); }} className="flex-1 bg-mint-success text-white font-fredoka font-bold text-xl py-4 rounded-btn shadow-3d-primary hover:translate-y-1 hover:shadow-none transition-all">
            CONTINUAR
          </button>
          <button onClick={() => { sfx.tap(); window.location.reload(); }} className="flex-1 bg-cyan-ocean text-white font-fredoka font-bold text-xl py-4 rounded-btn shadow-3d-primary hover:translate-y-1 hover:shadow-none transition-all">
            REPETIR
          </button>
        </div>

        {/* El progreso ya se guardó en finishRound; este botón solo navega. */}
        <button onClick={() => { sfx.tap(); navigate(ROUTES.home); }} className="relative z-10 mt-4 w-full max-w-md min-h-[64px] bg-white text-numu-purple font-fredoka font-bold text-xl py-4 rounded-btn shadow-3d-white hover:translate-y-1 hover:shadow-none transition-all inline-flex items-center justify-center gap-2">
          <Home className="w-6 h-6" aria-hidden="true" /> Volver al inicio
        </button>
      </div>
    );
  }

  // --- Vista del Juego (Frame 4) ---
  return (
    <div className="min-h-screen flex flex-col bg-white font-poppins pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b-2 border-gray-100">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-4">
          <button onClick={() => { sfx.tap(); navigate(exitTo); }} className="w-12 h-12 shrink-0 grid place-items-center rounded-full bg-coral-alert text-white shadow-sm hover:scale-105 transition-transform">
            <X className="w-7 h-7" />
          </button>
          
          {lessonLevel && (
            <span className="shrink-0 rounded-full bg-soft-lavender text-numu-purple font-fredoka font-bold text-sm px-3 py-1" title={`Nivel de ${lessonEntry.lesson.title}`}>
              Nivel {lessonLevel}
            </span>
          )}

          {/* Barra de Progreso */}
          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden border border-gray-200">
            <div className="bg-numu-purple h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
          </div>
          
          {/* Corazones (Vidas) */}
          <div className="flex items-center gap-1">
            {Array.from({ length: maxLives }).map((_, i) => (
              <img
                key={i}
                src={i < lives ? heartOn : heartOff}
                alt=""
                className={`w-7 h-7 object-contain ${i < lives ? 'animate-pulse' : ''}`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Área de la Pregunta */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 flex flex-col gap-8">
        <section className="space-y-6">
          <div className="flex items-start justify-center gap-3">
            <h1 className="font-fredoka font-bold text-3xl md:text-4xl text-text-dark text-center flex-1">{currentQ?.prompt}</h1>
            <button onClick={() => { sfx.tap(); speak(currentQ?.speakText); }} className="w-14 h-14 shrink-0 grid place-items-center rounded-full bg-numu-purple text-white shadow-3d-primary active:translate-y-1 transition-transform">
              <Volume2 className="w-7 h-7" />
            </button>
          </div>
          
          {/* Imagen o visual de la pregunta */}
          {currentQ?.visual && (
            <div className="flex justify-center text-6xl" dangerouslySetInnerHTML={{ __html: currentQ.visual }}></div>
          )}
          {tipCard && <div className="mx-auto w-full max-w-2xl">{tipCard}</div>}
        </section>

        {/* Opciones de Respuesta */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center mt-4">
          {currentQ?.options.map((option, idx) => {
            const isCorrectOption = idx === currentQ.answerIndex;
            const isSelected = selectedOption === idx;
            
            // Lógica para pintar los botones de colores según si acertó o falló
            let btnClass = "border-gray-200 bg-white text-text-dark shadow-3d-white hover:border-numu-purple hover:-translate-y-1";
            if (answered) {
              if (isSelected && isCorrectOption) btnClass = "border-mint-success bg-mint-success text-white shadow-none translate-y-1";
              else if (isSelected && !isCorrectOption) btnClass = "border-coral-alert bg-coral-alert text-white shadow-none translate-y-1 animate-bounce";
              else btnClass = "border-gray-200 bg-gray-50 text-gray-400 opacity-50 shadow-none";
            }

            return (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                className={`w-full min-h-[100px] rounded-card font-fredoka font-bold text-3xl border-2 transition-all flex items-center justify-center ${btnClass}`}
              >
                {option.color ? (
                  <span className="flex flex-col items-center gap-2 text-xl">
                    <span className="w-10 h-10 rounded-full border-4 border-white shadow-md" style={{ background: option.color }}></span>
                    {option.label}
                  </span>
                ) : (
                  option.label
                )}
              </button>
            );
          })}
        </section>
      </main>

      {/* Bottom Sheet (Mensajes de retroalimentación) */}
      <div className={`fixed inset-x-0 bottom-0 z-40 transform transition-transform duration-300 ease-out ${sheet ? 'translate-y-0' : 'translate-y-full'}`}>
        {sheet && (
          <div className={`${sheet.kind === 'correct' ? 'bg-mint-success' : sheet.kind === 'warn' ? 'bg-orange-energy' : 'bg-coral-alert'} text-white px-6 py-6 shadow-2xl rounded-t-3xl`}>
            <div className="mx-auto max-w-3xl flex flex-col sm:flex-row items-center gap-6">
              
              <div className="w-16 h-16 shrink-0 rounded-full bg-white grid place-items-center p-2 border-4 border-white/60">
                <img src={mascotUrl} alt="NUMU" className="w-full h-full object-contain" />
              </div>
              
              <div className="flex-1 text-center sm:text-left">
                <p className="font-fredoka font-bold text-3xl">{sheet.title}</p>
                <p className="font-poppins text-lg opacity-90 mt-1">{sheet.message}</p>
              </div>
              
              <div className="flex gap-3 shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                {sheet.isGameOver ? (
                  <>
                    <button onClick={() => navigate(exitTo)} className="flex-1 sm:flex-none bg-white/20 hover:bg-white/30 text-white font-fredoka font-bold text-xl py-3 px-6 rounded-btn transition-colors">
                      Salir
                    </button>
                    <button onClick={refillLives} className="flex-1 sm:flex-none bg-sunshine-yellow text-text-dark font-fredoka font-bold text-xl py-3 px-6 rounded-btn shadow-3d-yellow hover:translate-y-1 hover:shadow-none transition-all">
                      Recargar
                    </button>
                  </>
                ) : (
                  <button onClick={sheet.onAction} className="w-full sm:w-auto bg-white text-text-dark font-fredoka font-bold text-xl py-3 px-10 rounded-btn shadow-3d-white hover:translate-y-1 hover:shadow-none transition-all">
                    {sheet.buttonText}
                  </button>
                )}
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Botón flotante mostaza: aparece solo si rechazó la pista y aún no la abrió */}
      {hintDeclined && !isTipOpen && !showHintPrompt && (
        <button
          type="button"
          aria-controls="question-tip"
          aria-expanded={isTipOpen}
          onClick={() => { sfx.tap(); setHintDeclined(false); setIsTipOpen(true); }}
          className={`fixed bottom-40 right-4 z-40 inline-flex min-h-[64px] items-center gap-2 rounded-btn bg-mustard-yellow px-6 font-fredoka text-xl font-bold text-text-dark shadow-3d-mustard active:translate-y-1 active:shadow-none transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-numu-purple sm:bottom-36 sm:right-8 ${reduceMotion ? '' : 'animate-pop-in'}`}
        >
          <span aria-hidden="true">💡</span> Pista
        </button>
      )}

      {/* Modal al segundo error del mismo ejercicio */}
      {showHintPrompt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-text-dark/50 px-4">
          <div role="dialog" aria-modal="true" aria-labelledby="tip-prompt-title" className="w-full max-w-md rounded-card border-2 border-numu-purple/20 bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-soft-lavender">
              <Lightbulb className="h-10 w-10 text-numu-purple" aria-hidden="true" />
            </div>
            <h2 id="tip-prompt-title" className="font-fredoka font-bold text-2xl text-text-dark">¿Quieres una pista?</h2>
            <p className="mt-2 font-poppins text-base text-text-dark/70">Te ayudamos con este ejercicio sin quitarte más vidas.</p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => { sfx.tap(); setShowHintPrompt(false); setHintDeclined(false); setIsTipOpen(true); }}
                className="min-h-[64px] rounded-btn bg-mint-success text-white font-fredoka font-bold text-xl shadow-3d-success active:translate-y-1 active:shadow-none transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-numu-purple"
              >
                Sí, quiero una pista
              </button>
              <button
                type="button"
                onClick={() => { sfx.tap(); setShowHintPrompt(false); setHintDeclined(true); }}
                className="min-h-[64px] rounded-btn border-2 border-border-gray bg-white text-text-dark font-fredoka font-bold text-xl shadow-3d-white active:translate-y-1 active:shadow-none transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-numu-purple"
              >
                No, gracias
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
