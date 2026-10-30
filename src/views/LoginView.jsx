import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { Check, Settings, Sparkles, ArrowLeft, ArrowRight, Gauge } from 'lucide-react';
import logoUrl from '../assets/brand/mascot/logo-completo-blanco.png';
import { useAuth } from '../hooks/useAuth.jsx';
import { buildOnboardingPayload, toStoreProfile } from '../services/onboardingService.js';
import { store } from '../state/store.js';

// --- Constantes del Cuestionario ---
const DIAGNOSTIC = [
  { prompt: '¿Cuánto es 8 x 7?', options: ['48', '56', '64', '54'], answer: 1 },
  { prompt: '¿Cuánto es 20 / 4?', options: ['4', '6', '5', '10'], answer: 2 },
  { prompt: '¿Cuánto es 15 + 27?', options: ['42', '41', '52', '32'], answer: 0 },
  { prompt: '¿Cuánto es 9 x 6?', options: ['56', '45', '64', '54'], answer: 3 },
  { prompt: '¿Cuánto es 100 - 36?', options: ['64', '74', '54', '66'], answer: 0 },
];

const LEVEL_OPTIONS = [
  { id: 'none', label: 'No sé nada', hint: 'Empezamos desde cero, sin prisa.' },
  { id: 'some', label: 'Sé un poco', hint: 'Repasamos lo básico y avanzamos.' },
  { id: 'much', label: 'Sé mucho', hint: 'Reto level: vamos directo a lo bueno.' },
];

const MODULES = [
  { id: 'conteo', name: 'Conteo Mágico', color: 'bg-cyan-ocean' },
  { id: 'sumas', name: 'Sumas y Restas', color: 'bg-orange-energy' },
  { id: 'formas', name: 'Formas Ocultas', color: 'bg-coral-alert' },
];

const TOTAL_STEPS = 3 + DIAGNOSTIC.length + 1; // 9 pasos
const ANSWER_KEY = DIAGNOSTIC.map((q) => q.answer);

const STEP_META = [
  { title: '¡Conocámonos!', subtitle: 'Cuéntanos un poco de ti para personalizar tu aventura.' },
  { title: '¿Qué te gustaría aprender?', subtitle: 'Elige uno o varios temas. Podrás cambiar después.' },
  { title: '¿Qué tanto sabes del tema?', subtitle: 'Así ajustamos la dificultad a tu ritmo.' },
  ...DIAGNOSTIC.map((q, i) => ({ title: `Pregunta ${i + 1} de 5`, subtitle: 'Responde con calma: aquí no se pierden vidas.' })),
  { title: 'Elige tu avatar', subtitle: 'Ponle un toque personal a tu perfil de jugador.' },
];

// Avatares disponibles (Emojis para este ejemplo)
const AVATARS = ['👾', '🐱', '🐶', '🦊', '🚀', '⭐'];

// --- Componente Principal ---
export default function LoginView() {
  const navigate = useNavigate();
  const { configured, saveOnboarding } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Estado del Formulario
  const [draft, setDraft] = useState({
    name: '',
    age: '',
    country: '',
    grade: '',
    interests: [],
    level: null,
    answers: Array(DIAGNOSTIC.length).fill(null),
    avatar: 0,
    nickname: '',
  });

  // --- Lógica de Validación ---
  const isValid = () => {
    switch (step) {
      case 0:
        return (
          draft.name.trim() !== '' &&
          draft.age !== '' &&
          Number(draft.age) >= 4 &&
          Number(draft.age) <= 15 &&
          draft.country.trim() !== '' &&
          draft.grade.trim() !== ''
        );
      case 1:
        return draft.interests.length > 0;
      case 2:
        return draft.level !== null;
      case TOTAL_STEPS - 1:
        return draft.nickname.trim().length >= 2;
      default:
        return draft.answers[step - 3] !== null;
    }
  };

  // --- Funciones de Navegación ---
  const handleNext = async () => {
    if (!isValid() || saving) return;

    if (step === TOTAL_STEPS - 1) {
      // Finalizar Onboarding: se guarda en la cuenta (o solo en local si no hay Supabase)
      setSaving(true);
      setSaveError('');
      if (configured) {
        const { error } = await saveOnboarding(draft, ANSWER_KEY);
        if (error) {
          console.error('No se pudo guardar el cuestionario inicial:', error);
          setSaving(false);
          setSaveError(`No pudimos guardar tu perfil. Inténtalo de nuevo. (Detalle: ${error})`);
          return;
        }
      } else {
        const { profile, diagnostic } = buildOnboardingPayload(draft, ANSWER_KEY);
        store.completeOnboarding(toStoreProfile(profile, { self_level: diagnostic.selfLevel, score: diagnostic.score }));
      }
      confetti({
        particleCount: 140,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#5124EE', '#FFC700', '#00D282', '#00B4D8', '#FF8800'],
      });
      navigate('/inicio', { replace: true });
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  // --- Handlers de Inputs ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setDraft({ ...draft, [name]: value });
  };

  const toggleInterest = (id) => {
    setDraft((prev) => {
      const interests = prev.interests.includes(id)
        ? prev.interests.filter((i) => i !== id)
        : [...prev.interests, id];
      return { ...prev, interests };
    });
  };

  const setAnswer = (questionIndex, optionIndex) => {
    const newAnswers = [...draft.answers];
    newAnswers[questionIndex] = optionIndex;
    setDraft({ ...draft, answers: newAnswers });
  };

  // --- Renderizado de Pasos ---
  const renderStepContent = () => {
    if (step === 0) {
      return (
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-fredoka font-bold text-gray-700">¿Cómo te llamas?</span>
            <input name="name" value={draft.name} onChange={handleInputChange} placeholder="Ej. Luis Raza" className="bg-gray-50 border-2 border-gray-200 rounded-btn px-4 py-3 text-sm focus:outline-none focus:border-numu-purple transition-colors" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-fredoka font-bold text-gray-700">¿Cuántos años tienes?</span>
            <input name="age" type="number" min="4" max="15" value={draft.age} onChange={handleInputChange} placeholder="Ej. 8" className="bg-gray-50 border-2 border-gray-200 rounded-btn px-4 py-3 text-sm focus:outline-none focus:border-numu-purple transition-colors" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-fredoka font-bold text-gray-700">¿De qué país eres?</span>
            <input name="country" value={draft.country} onChange={handleInputChange} placeholder="Ej. México" className="bg-gray-50 border-2 border-gray-200 rounded-btn px-4 py-3 text-sm focus:outline-none focus:border-numu-purple transition-colors" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-fredoka font-bold text-gray-700">¿En qué grado estás?</span>
            <input name="grade" value={draft.grade} onChange={handleInputChange} placeholder="Ej. 3° de Primaria" className="bg-gray-50 border-2 border-gray-200 rounded-btn px-4 py-3 text-sm focus:outline-none focus:border-numu-purple transition-colors" />
          </label>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MODULES.map((module) => {
            const isSelected = draft.interests.includes(module.id);
            return (
              <button
                key={module.id}
                onClick={() => toggleInterest(module.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-card border-2 transition-all duration-100 text-left ${isSelected ? 'border-numu-purple bg-soft-lavender shadow-3d-primary translate-y-1' : 'border-gray-200 bg-white shadow-3d-white hover:-translate-y-0.5'}`}
              >
                <div className={`w-14 h-14 rounded-2xl grid place-items-center text-white shrink-0 ${module.color}`}>
                  <Sparkles className="w-6 h-6" />
                </div>
                <span className="font-fredoka font-bold text-xl text-text-dark flex-1">{module.name}</span>
                <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${isSelected ? 'bg-numu-purple text-white' : 'border-2 border-gray-200 text-transparent'}`}>
                  <Check className="w-5 h-5" />
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="space-y-4">
          {LEVEL_OPTIONS.map((option) => {
            const isSelected = draft.level === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setDraft({ ...draft, level: option.id })}
                className={`w-full flex items-center gap-4 p-4 rounded-card border-2 transition-all duration-100 text-left ${isSelected ? 'border-numu-purple bg-soft-lavender shadow-3d-primary translate-y-1' : 'border-gray-200 bg-white shadow-3d-white hover:-translate-y-0.5'}`}
              >
                <div className={`w-14 h-14 rounded-full grid place-items-center shrink-0 ${isSelected ? 'bg-numu-purple text-white' : 'bg-soft-lavender text-numu-purple'}`}>
                  <Gauge className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <span className="block font-fredoka font-bold text-lg text-text-dark">{option.label}</span>
                  <span className="block font-poppins text-sm text-gray-500">{option.hint}</span>
                </div>
                <div className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${isSelected ? 'bg-numu-purple text-white' : 'border-2 border-gray-200 text-transparent'}`}>
                  <Check className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    if (step >= 3 && step < TOTAL_STEPS - 1) {
      const qIndex = step - 3;
      const question = DIAGNOSTIC[qIndex];
      return (
        <div className="flex flex-col items-center">
          <p className="font-fredoka font-semibold text-2xl md:text-3xl text-text-dark text-center mb-8">{question.prompt}</p>
          <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            {question.options.map((val, idx) => {
              const isSelected = draft.answers[qIndex] === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setAnswer(qIndex, idx)}
                  className={`min-h-[90px] rounded-card font-fredoka font-bold text-3xl border-2 transition-all ${isSelected ? 'border-numu-purple bg-soft-lavender text-numu-purple shadow-3d-primary translate-y-1' : 'border-gray-200 bg-white text-text-dark shadow-3d-white hover:border-numu-purple hover:-translate-y-1'}`}
                >
                  {val}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (step === TOTAL_STEPS - 1) {
      return (
        <div className="flex flex-col items-center gap-8">
          <div className="flex gap-4 overflow-x-auto p-4 w-full justify-center">
            {AVATARS.map((emoji, idx) => (
              <button
                key={idx}
                onClick={() => setDraft({ ...draft, avatar: idx })}
                className={`w-20 h-20 rounded-full text-4xl flex items-center justify-center border-4 transition-all ${draft.avatar === idx ? 'border-numu-purple bg-soft-lavender scale-110' : 'border-transparent bg-gray-100 hover:bg-gray-200'}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-2 w-full max-w-sm">
            <span className="font-fredoka font-bold text-gray-700">Elige un apodo</span>
            <input name="nickname" value={draft.nickname} onChange={handleInputChange} placeholder="Ej. LuisPro" className="w-full bg-gray-50 border-2 border-gray-200 rounded-btn px-4 py-3 text-lg font-bold text-center focus:outline-none focus:border-numu-purple transition-colors" />
            <span className="text-sm text-gray-500 text-center mt-1">Será el nombre que veas en tu mapa de aprendizaje.</span>
          </label>
        </div>
      );
    }
  };

  const meta = STEP_META[step];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-soft-lavender font-poppins">
      
      {/* Columna Izquierda: Panel Visual */}
      <section className="relative bg-numu-purple text-white px-6 py-8 sm:px-10 flex flex-col overflow-hidden lg:min-h-screen">
        <div className="absolute -top-20 -left-16 w-64 h-64 rounded-full bg-white/5" aria-hidden="true"></div>
        <div className="absolute -bottom-24 -right-12 w-80 h-80 rounded-full bg-white/5" aria-hidden="true"></div>

        <div className="relative flex-1 grid place-items-center py-8">
          <img src={logoUrl} alt="NUMU" className="w-48 sm:w-60 animate-bounce relative z-10" />
        </div>

        <div className="relative flex flex-col items-start gap-3 pb-2 z-10">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/25 font-poppins font-bold text-sm">
            <Sparkles className="w-4 h-4" /> Paso {step + 1} de {TOTAL_STEPS}
          </span>
          <p className="font-poppins text-white/75 max-w-sm text-sm">
            Puedes volver atrás siempre que quieras: tu progreso se guarda al finalizar.
          </p>
        </div>
      </section>

      {/* Columna Derecha: Formulario */}
      <section className="flex flex-col lg:justify-center px-4 sm:px-8 py-6 lg:py-10">
        <div className="bg-white rounded-card w-full max-w-xl mx-auto p-6 sm:p-8 flex flex-col shadow-lg border-2 border-gray-100 h-full lg:h-auto min-h-[500px]">
          
          <header className="mb-8">
            <h1 className="font-fredoka font-bold text-3xl text-text-dark">{meta.title}</h1>
            <p className="font-poppins text-gray-500 mt-1">{meta.subtitle}</p>
          </header>

          <div className="flex-1">
            {renderStepContent()}
          </div>

          {saveError && (
            <p role="alert" className="mt-6 text-sm font-medium text-coral-alert text-center">{saveError}</p>
          )}

          {/* Footer de Navegación */}
          <footer className="mt-8 pt-5 border-t-2 border-gray-100 grid grid-cols-[auto_1fr_auto] items-center gap-4">
            
            <div>
              <button 
                onClick={handleBack} 
                disabled={step === 0}
                className={`flex items-center gap-2 px-4 py-2 font-fredoka font-bold rounded-lg transition-colors ${step === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100 hover:text-text-dark'}`}
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Regresar</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <span key={i} className={`h-2.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-numu-purple' : i < step ? 'w-2.5 bg-numu-purple/40' : 'w-2.5 bg-gray-200'}`}></span>
              ))}
            </div>

            <div>
              <button 
                onClick={handleNext}
                disabled={!isValid() || saving}
                className={`flex items-center gap-2 px-6 py-3 font-fredoka font-bold text-lg rounded-btn transition-all shadow-md ${!isValid() || saving ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : step === TOTAL_STEPS - 1 ? 'bg-sunshine-yellow text-text-dark shadow-3d-yellow hover:translate-y-1 hover:shadow-none' : 'bg-numu-purple text-white shadow-3d-primary hover:translate-y-1 hover:shadow-none'}`}
              >
                {step === TOTAL_STEPS - 1 ? (saving ? 'Guardando…' : '¡A JUGAR!') : 'Continuar'}
                {step !== TOTAL_STEPS - 1 && <ArrowRight className="w-5 h-5" />}
              </button>
            </div>

          </footer>
        </div>
      </section>

    </div>
  );
}