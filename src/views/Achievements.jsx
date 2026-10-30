import { useState, useEffect } from 'react';
import { Medal, Flame, Star, Gem, Trophy, Crown } from 'lucide-react';
import { store } from '../state/store.js';

// Función para mapear el nombre del ícono a los componentes de Lucide
const getIcon = (name, className) => {
  switch (name) {
    case 'medal': return <Medal className={className} />;
    case 'flame': return <Flame className={className} />;
    case 'star': return <Star className={className} fill="currentColor" />;
    case 'gem': return <Gem className={className} />;
    case 'trophy': return <Trophy className={className} />;
    case 'crown': return <Crown className={className} />;
    default: return <Star className={className} />;
  }
};

const BADGES = [
  { id: 'first', title: 'Primera lección', iconName: 'medal', tone: 'bg-orange-energy text-white', test: (s) => s.level > 1 },
  { id: 'streak3', title: 'Racha de 3 días', iconName: 'flame', tone: 'bg-coral-alert text-white', test: (s) => s.streak >= 3 },
  { id: 'stars20', title: '20 estrellas', iconName: 'star', tone: 'bg-sunshine-yellow text-text-dark', test: (s) => s.stars >= 20 },
  { id: 'gems50', title: '50 gemas', iconName: 'gem', tone: 'bg-cyan-ocean text-white', test: (s) => s.gems >= 50 },
  { id: 'level5', title: 'Nivel 5', iconName: 'trophy', tone: 'bg-numu-purple text-white', test: (s) => s.level >= 5 },
  { id: 'perfect', title: 'Ronda perfecta', iconName: 'crown', tone: 'bg-mint-success text-white', test: (s) => Object.values(s.starsByLevel || {}).some((v) => v === 3) },
];

export default function Achievements() {
  // Sincronizamos el componente con el store global de tu compañero
  const [state, setState] = useState(() => store.get());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setState(store.get());
    });
    return () => unsubscribe();
  }, []);

  const unlocked = BADGES.filter((b) => b.test(state)).length;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 font-poppins min-h-screen">
      
      <header className="text-center mb-8">
        <h1 className="font-fredoka font-bold text-3xl md:text-4xl text-text-dark">
          Tu progreso
        </h1>
        <p className="text-gray-500 mt-2 text-sm md:text-base">
          {unlocked} de {BADGES.length} insignias desbloqueadas
        </p>
      </header>

      {/* Cuadrícula de Insignias */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {BADGES.map((badge) => {
          const has = badge.test(state);
          return (
            <div 
              key={badge.id} 
              className={`bg-white rounded-card p-4 text-center border-2 border-gray-100 transition-all ${has ? 'shadow-sm hover:-translate-y-1 hover:shadow-md' : 'opacity-50 grayscale shadow-none'}`}
              aria-disabled={!has}
            >
              <div 
                className={`w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center shadow-inner ${badge.tone}`} 
                aria-hidden="true"
              >
                {getIcon(badge.iconName, 'w-7 h-7')}
              </div>
              <p className="font-fredoka font-bold text-sm text-text-dark leading-tight mb-1">
                {badge.title}
              </p>
              <p className={`text-xs font-bold ${has ? 'text-mint-success' : 'text-gray-400'}`}>
                {has ? '¡Lograda!' : 'Bloqueada'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Tarjeta de Estadísticas Globales */}
      <div className="bg-white rounded-card border-2 border-gray-100 shadow-sm p-6 sm:p-8 grid grid-cols-3 gap-4 text-center mt-8 relative overflow-hidden">
        
        {/* Decoración de fondo sutil */}
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-soft-lavender opacity-50 pointer-events-none"></div>

        <div className="relative z-10">
          <p className="font-fredoka font-bold text-4xl sm:text-5xl text-numu-purple tabular-nums">
            {state.stars}
          </p>
          <p className="font-poppins font-bold text-sm text-gray-500 mt-1 uppercase tracking-wider">Estrellas</p>
        </div>
        
        <div className="relative z-10 border-x-2 border-gray-50">
          <p className="font-fredoka font-bold text-4xl sm:text-5xl text-cyan-ocean tabular-nums">
            {state.gems}
          </p>
          <p className="font-poppins font-bold text-sm text-gray-500 mt-1 uppercase tracking-wider">Gemas</p>
        </div>
        
        <div className="relative z-10">
          <p className="font-fredoka font-bold text-4xl sm:text-5xl text-orange-energy tabular-nums">
            {state.xp}
          </p>
          <p className="font-poppins font-bold text-sm text-gray-500 mt-1 uppercase tracking-wider">XP</p>
        </div>
        
      </div>
      
    </div>
  );
}