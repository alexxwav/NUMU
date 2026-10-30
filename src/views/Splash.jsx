import { Navigate, useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { sfx, speak } from '../utils/audio.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { resolveStartRoute, ROUTES } from '../services/startRoute.js';
import mascot from '../assets/brand/mascot/logo-mascota-blanco.png';

export default function Splash() {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();

  // Con la sesión abierta no hace falta elegir: va directo a donde se quedó.
  if (!loading && session) return <Navigate to={resolveStartRoute({ session, profile })} replace />;

  const goTo = (route) => {
    if (sfx && sfx.correct) sfx.correct();
    navigate(route);
  };

  const handleSettings = () => {
    if (sfx && sfx.tap) sfx.tap();
    navigate('/ajustes');
  };

  // * Llamar a speak() automáticamente al cargar la página a menudo
  // es bloqueado por los navegadores si el usuario no ha dado clic en nada antes.

  return (
    <main className="min-h-screen bg-numu-purple flex flex-col items-center justify-center relative px-6 py-10 text-white overflow-hidden">
      
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/5" aria-hidden="true"></div>
      <div className="absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-white/5" aria-hidden="true"></div>

      {/* Botón de ajustes */}
      <button 
        type="button" 
        onClick={handleSettings}
        className="absolute top-5 right-5 w-14 h-14 grid place-items-center rounded-full text-white/90 hover:bg-white/10 transition-colors z-10"
        aria-label="Zona de ajustes (personas adultas)"
      >
        <Settings className="w-8 h-8" />
      </button>

      <img 
        src={mascot} 
        alt="El pulpo NUMU saludando" 
        className="w-64 sm:w-72 lg:w-80 mb-8 animate-bounce relative z-10" 
      />
      <p className="font-poppins text-lg md:text-xl text-white/85 mb-8 text-center max-w-md relative z-10">
        Aprende matemáticas jugando. ¡Conteo, formas, patrones y más!
      </p>
      
      <div className="relative w-full max-w-sm z-10 flex flex-col gap-5">
        <button
          type="button"
          onClick={() => goTo(ROUTES.signUp)}
          disabled={loading}
          className="w-full min-h-touch-lg bg-sunshine-yellow text-text-dark font-fredoka font-bold text-2xl sm:text-3xl py-5 px-10 rounded-btn shadow-3d-yellow hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-60"
        >
          CREAR CUENTA
        </button>
        <button
          type="button"
          onClick={() => goTo(ROUTES.signIn)}
          disabled={loading}
          className="w-full min-h-touch bg-white text-numu-purple font-fredoka font-bold text-xl sm:text-2xl py-4 px-10 rounded-btn shadow-3d-white hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-60"
        >
          INICIAR SESIÓN
        </button>
      </div>

    </main>
  );
}