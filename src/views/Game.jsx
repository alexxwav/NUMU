import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { X, Volume2, Star, Heart } from 'lucide-react';
import { store } from '../state/store.js';
import { generateQuestions } from '../state/questions.js';
import { sfx, speak } from '../utils/audio.js';
import mascotUrl from '../assets/brand/mascot/numu-morado.png';

const QUESTIONS_PER_ROUND = 6;

function burst({ particleCount = 60, spread = 70 } = {}) {
  if (store.get().settings?.reduceMotion) return;
  confetti({ particleCount, spread, origin: { y: 0.7 }, colors: ['#5124EE', '#FFC700', '#00D282', '#00B4D8', '#FF8800'] });
}

export default function Game() {
  const navigate = useNavigate();
  const { nivel } = useParams(); // Obtiene si es 'conteo', 'sumas', etc. de la URL

  // Estados del juego
  const [questions] = useState(() => {
    const state = store.get();
    const moduleId = nivel ?? state.module;
    return generateQuestions(moduleId, state.level, QUESTIONS_PER_ROUND);
  });

  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [sheet, setSheet] = useState(null); // Controla el mensaje emergente de abajo
  const [isFinished, setIsFinished] = useState(false);
  const [lives, setLives] = useState(() => store.get().lives);
  
  const currentQ = questions[index];
  const maxLives = store.get().maxLives;
  const progressPercent = (index / questions.length) * 100;

  // Escuchar la instrucción al cargar la pregunta
  useEffect(() => {
    if (currentQ && !isFinished) {
      speak(currentQ.speakText);
    }
  }, [index, currentQ, isFinished]);

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
            setIndex(index + 1);
            setAnswered(false);
            setSelectedOption(null);
          }
        }
      });
    } else {
      sfx.wrong();
      setMistakes((m) => m + 1);
      const updated = store.loseLife();
      setLives(updated.lives);

      if (updated.lives <= 0) {
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
    setAnswered(false);
    setSelectedOption(null);
  };

  const finishRound = () => {
    setIsFinished(true);
    const stars = mistakes <= 1 ? 3 : mistakes <= 3 ? 2 : 1;
    store.addRewards({ gems: stars * 5, stars, xp: stars * 10, levelStars: stars });
    store.completeLevel();
    sfx.win();
    burst({ particleCount: 160, spread: 110 });
  };

  // --- Vista de Resultados (Frame 5) ---
  if (isFinished) {
    const stars = mistakes <= 1 ? 3 : mistakes <= 3 ? 2 : 1;
    return (
      <div className="min-h-screen bg-numu-purple text-white flex flex-col items-center justify-center px-6 py-10 text-center relative overflow-hidden font-poppins">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5" aria-hidden="true"></div>
        <div className="absolute -bottom-24 -left-16 w-80 h-80 rounded-full bg-white/5" aria-hidden="true"></div>

        <p className="font-fredoka font-bold text-4xl sm:text-5xl mb-6 relative z-10">¡LO LOGRASTE!</p>

        <div className="flex gap-4 mb-7 relative z-10">
          {[0, 1, 2].map((i) => (
            <Star 
              key={i} 
              className={`w-16 h-16 sm:w-20 sm:h-20 ${i < stars ? 'text-sunshine-yellow fill-sunshine-yellow animate-bounce' : 'text-white/30 fill-white/30'}`} 
            />
          ))}
        </div>

        <div className="bg-white text-text-dark rounded-card px-8 py-5 mb-8 font-fredoka font-bold text-2xl shadow-lg relative z-10">
          {questions.length} respuestas · {stars * 10} XP · +{stars * 5} gemas
        </div>

        <div className="flex flex-col sm:flex-row gap-4 relative z-10 w-full max-w-md">
          <button onClick={() => { sfx.tap(); navigate('/inicio'); }} className="flex-1 bg-mint-success text-white font-fredoka font-bold text-xl py-4 rounded-btn shadow-3d-primary hover:translate-y-1 hover:shadow-none transition-all">
            CONTINUAR
          </button>
          <button onClick={() => { sfx.tap(); window.location.reload(); }} className="flex-1 bg-cyan-ocean text-white font-fredoka font-bold text-xl py-4 rounded-btn shadow-3d-primary hover:translate-y-1 hover:shadow-none transition-all">
            REPETIR
          </button>
        </div>
      </div>
    );
  }

  // --- Vista del Juego (Frame 4) ---
  return (
    <div className="min-h-screen flex flex-col bg-white font-poppins pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b-2 border-gray-100">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-4">
          <button onClick={() => { sfx.tap(); navigate('/inicio'); }} className="w-12 h-12 shrink-0 grid place-items-center rounded-full bg-coral-alert text-white shadow-sm hover:scale-105 transition-transform">
            <X className="w-7 h-7" />
          </button>
          
          {/* Barra de Progreso */}
          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden border border-gray-200">
            <div className="bg-numu-purple h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
          </div>
          
          {/* Corazones (Vidas) */}
          <div className="flex items-center gap-1">
            {Array.from({ length: maxLives }).map((_, i) => (
              <Heart key={i} className={`w-7 h-7 ${i < lives ? 'text-coral-alert fill-coral-alert animate-pulse' : 'text-gray-200 fill-gray-200'}`} />
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
                    <button onClick={() => navigate('/inicio')} className="flex-1 sm:flex-none bg-white/20 hover:bg-white/30 text-white font-fredoka font-bold text-xl py-3 px-6 rounded-btn transition-colors">
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

    </div>
  );
}