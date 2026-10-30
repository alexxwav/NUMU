import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Volume2, Shield, Lock } from 'lucide-react';
import { store } from '../state/store.js';
import { sfx } from '../utils/audio.js';

// --- Constante de la pregunta parental ---
const GATE_ANSWER = 6;

// --- Subcomponente: Switch / Toggle ---
function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex items-center justify-between py-3 cursor-pointer group">
      <div className="flex-1 pr-4">
        <p className="font-fredoka font-bold text-lg text-text-dark">{label}</p>
        <p className="font-poppins text-sm text-gray-500">{description}</p>
      </div>
      <div className={`relative w-14 h-8 rounded-full transition-colors duration-300 ease-in-out ${checked ? 'bg-mint-success' : 'bg-gray-300'}`}>
        <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
      </div>
      <input type="checkbox" className="hidden" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

// --- Componente Principal ---
export default function SettingsView() {
  const navigate = useNavigate();
  
  // Estado local sincronizado con el store
  const [state, setState] = useState(() => store.get());
  const [isParentalUnlocked, setIsParentalUnlocked] = useState(false);
  const [gateInput, setGateInput] = useState('');
  const [gateError, setGateError] = useState('');

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setState(store.get()));
    return () => unsubscribe();
  }, []);

  // --- Manejadores de cambios en Configuración ---
  const updateProfile = (key, value) => {
    store.set({ profile: { ...state.profile, [key]: value } });
  };

  const updateSetting = (key, value) => {
    store.set({ settings: { ...state.settings, [key]: value } });
  };

  // --- Lógica del Control Parental ---
  const handleGateSubmit = (e) => {
    e.preventDefault();
    if (Number(gateInput.trim()) === GATE_ANSWER) {
      sfx.correct();
      setIsParentalUnlocked(true);
      setGateError('');
    } else {
      sfx.wrong();
      setGateError('Respuesta incorrecta. Inténtalo de nuevo.');
      setGateInput('');
    }
  };

  const handleResetProgress = () => {
    if (window.confirm('¿Seguro que quieres borrar todo el progreso guardado? Tu perfil se conservará.')) {
      store.reset();
      sfx.tap();
      navigate('/inicio');
    }
  };

  // --- Avatares Básicos ---
  const AVATARS = ['👾', '🐱', '🐶', '🦊', '🚀', '⭐'];

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8 font-poppins min-h-screen">
      
      <header className="mb-8">
        <h1 className="font-fredoka font-bold text-3xl md:text-4xl text-text-dark">
          Configuración y Preferencias
        </h1>
        <p className="text-gray-500 mt-2 text-sm md:text-base">
          Administra tu perfil, la accesibilidad y los controles para tutores.
        </p>
      </header>

      {/* --- SECCIÓN 1: Perfil --- */}
      <section className="bg-white rounded-card p-6 md:p-8 border-2 border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-soft-lavender flex items-center justify-center text-numu-purple">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-fredoka font-bold text-2xl text-text-dark">Perfil del Estudiante</h2>
            <p className="text-sm text-gray-500">Nombre, edad y avatar</p>
          </div>
        </div>

        {/* Selector de Avatar */}
        <div className="flex gap-4 overflow-x-auto py-2">
          {AVATARS.map((emoji, idx) => (
            <button
              key={idx}
              onClick={() => updateProfile('avatar', idx)}
              className={`w-16 h-16 shrink-0 rounded-full text-3xl flex items-center justify-center border-4 transition-all ${state.profile.avatar === idx ? 'border-numu-purple bg-soft-lavender scale-110' : 'border-transparent bg-gray-100 hover:bg-gray-200'}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Inputs de perfil */}
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-fredoka font-bold text-gray-700">Nombre</span>
            <input 
              value={state.profile.name || ''} 
              onChange={(e) => updateProfile('name', e.target.value)} 
              className="bg-gray-50 border-2 border-gray-200 rounded-btn px-4 py-3 focus:border-numu-purple outline-none" 
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-fredoka font-bold text-gray-700">Edad</span>
            <input 
              type="number" min="4" max="15" 
              value={state.profile.age || ''} 
              onChange={(e) => updateProfile('age', e.target.value)} 
              className="bg-gray-50 border-2 border-gray-200 rounded-btn px-4 py-3 focus:border-numu-purple outline-none" 
            />
          </label>
        </div>
        <p className="text-xs text-gray-400">Los cambios se guardan automáticamente en este dispositivo.</p>
      </section>


      {/* --- SECCIÓN 2: Accesibilidad --- */}
      <section className="bg-white rounded-card p-6 md:p-8 border-2 border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-soft-lavender flex items-center justify-center text-numu-purple">
            <Volume2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-fredoka font-bold text-2xl text-text-dark">Accesibilidad y Audio</h2>
            <p className="text-sm text-gray-500">Volumen, sonido y legibilidad</p>
          </div>
        </div>

        {/* Control de Volumen */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-fredoka font-bold text-lg text-text-dark">Volumen general</label>
            <span className="font-fredoka font-bold text-lg text-numu-purple tabular-nums">
              {Math.round((state.settings.volume ?? 0.8) * 100)}%
            </span>
          </div>
          <input 
            type="range" min="0" max="100" step="5" 
            value={Math.round((state.settings.volume ?? 0.8) * 100)} 
            onChange={(e) => updateSetting('volume', Number(e.target.value) / 100)}
            className="w-full accent-numu-purple h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
          />
        </div>

        <div className="divide-y-2 divide-gray-100">
          <Toggle 
            label="Efectos de Sonido" 
            description="Sonidos de interfaz e instrucciones" 
            checked={state.settings.sound} 
            onChange={(v) => updateSetting('sound', v)} 
          />
          <Toggle 
            label="Modo de Alta Legibilidad" 
            description="Reduce animaciones y refuerza el contraste visual" 
            checked={state.settings.reduceMotion} 
            onChange={(v) => updateSetting('reduceMotion', v)} 
          />
        </div>
      </section>


      {/* --- SECCIÓN 3: Control Parental --- */}
      <section className="bg-white rounded-card p-6 md:p-8 border-2 border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-soft-lavender flex items-center justify-center text-numu-purple">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-fredoka font-bold text-2xl text-text-dark">Control Parental</h2>
            <p className="text-sm text-gray-500">Configuración avanzada para personas adultas</p>
          </div>
        </div>

        {!isParentalUnlocked ? (
          <div className="rounded-card border-2 border-dashed border-gray-300 bg-soft-lavender p-8 space-y-5 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white border-2 border-gray-200 text-numu-purple">
              <Lock className="w-8 h-8" />
            </div>
            <p className="font-fredoka font-bold text-xl text-text-dark">Zona de tutores</p>
            <p className="text-gray-600">Para ingresar, resuelve: <br/><strong className="font-fredoka text-2xl text-numu-purple">Nueve menos tres</strong></p>
            
            <form onSubmit={handleGateSubmit} className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-4">
              <input 
                type="number" inputMode="numeric" placeholder="?" 
                value={gateInput} onChange={(e) => setGateInput(e.target.value)}
                className="w-full sm:w-32 h-14 rounded-btn border-2 border-gray-300 bg-white px-4 text-center font-fredoka font-bold text-3xl text-text-dark focus:border-numu-purple outline-none" 
              />
              <button type="submit" className="bg-numu-purple text-white font-fredoka font-bold text-lg px-8 h-14 rounded-btn shadow-3d-primary hover:translate-y-1 hover:shadow-none transition-all">
                Verificar
              </button>
            </form>
            {gateError && <p className="text-coral-alert font-bold text-sm mt-2">{gateError}</p>}
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {[
                { label: 'Nivel', value: state.level },
                { label: 'Estrellas', value: state.stars },
                { label: 'Gemas', value: state.gems },
                { label: 'Racha', value: `${state.streak} d` }
              ].map((m, i) => (
                <div key={i} className="rounded-card bg-soft-lavender p-4 border-2 border-gray-100">
                  <p className="font-fredoka font-bold text-2xl text-numu-purple">{m.value}</p>
                  <p className="text-xs font-bold text-gray-500 uppercase">{m.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <Toggle 
                label="Modo Daltonismo" 
                description="Refuerza los colores con patrones visuales adicionales" 
                checked={state.settings.colorblind} 
                onChange={(v) => updateSetting('colorblind', v)} 
              />
              
              <div className="space-y-2 pt-4 border-t-2 border-gray-100">
                <label className="font-fredoka font-bold text-lg text-text-dark">Tamaño de texto</label>
                <input 
                  type="range" min="0.9" max="1.3" step="0.05" 
                  value={state.settings.fontScale ?? 1} 
                  onChange={(e) => updateSetting('fontScale', Number(e.target.value))}
                  className="w-full accent-numu-purple h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
                />
                <div className="flex justify-between text-xs text-gray-400 font-bold uppercase"><span>Pequeño</span><span>Grande</span></div>
              </div>
            </div>

            <button onClick={handleResetProgress} className="w-full bg-coral-alert text-white font-fredoka font-bold text-xl py-4 rounded-btn shadow-3d-coral hover:translate-y-1 hover:shadow-none transition-all">
              Restablecer progreso
            </button>
          </div>
        )}
      </section>

    </div>
  );
}