import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home as HomeIcon } from 'lucide-react';
import { sfx } from '../utils/audio.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { ROUTES } from '../services/startRoute.js';

/**
 * Barra superior común a todas las pantallas (salvo el inicio y la ronda de juego).
 * Dos acciones distintas, siempre en el mismo lugar y con texto visible:
 *   · «Regresar» (izquierda): vuelve a la pantalla anterior. Si se entró directo a esta pantalla
 *     (sin historial dentro de la app), va a `backTo` o al inicio.
 *   · «Inicio» (derecha): va directo a la pantalla principal, sin pasar por las intermedias.
 * @param {Object} props
 * @param {string} [props.backTo] - Destino de respaldo de «Regresar» si no hay pantalla anterior.
 * @param {boolean} [props.preferBackTo] - Usa siempre `backTo` (p. ej. pantallas antes de la sesión).
 * @param {boolean} [props.showHome] - Muestra «Inicio» (por defecto, solo con la sesión iniciada).
 * @param {React.ReactNode} [props.children] - Contenido opcional en el centro (título corto).
 */
export default function NavBar({ backTo = ROUTES.home, preferBackTo = false, showHome, children }) {
  const navigate = useNavigate();
  const { configured, session } = useAuth();
  const homeVisible = showHome ?? (!configured || Boolean(session));

  const goBack = () => {
    sfx.tap();
    // react-router guarda en history.state.idx la posición dentro de la app (0 = primera pantalla).
    const canGoBack = (window.history.state?.idx ?? 0) > 0;
    if (canGoBack && !preferBackTo) navigate(-1);
    else navigate(backTo, { replace: true });
  };

  const goHome = () => {
    sfx.tap();
    navigate(ROUTES.home);
  };

  const buttonClass = 'min-h-touch min-w-touch px-4 inline-flex items-center justify-center gap-2 rounded-btn bg-white border-2 border-border-gray text-numu-deep-indigo font-fredoka font-bold text-lg shadow-3d-white active:translate-y-1 active:shadow-none hover:border-numu-purple transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-numu-purple';

  return (
    <nav aria-label="Navegación" className="sticky top-0 z-30 -mx-6 md:-mx-10 mb-6 px-6 md:px-10 py-3 bg-soft-lavender/90 backdrop-blur border-b-2 border-border-gray/60">
      <div className="mx-auto max-w-5xl flex items-center justify-between gap-3">
        <button type="button" onClick={goBack} className={buttonClass}>
          <ArrowLeft className="w-6 h-6" aria-hidden="true" />
          <span>Regresar</span>
        </button>
        {children && <div className="min-w-0 flex-1 text-center font-fredoka font-bold text-lg text-text-dark truncate">{children}</div>}
        {homeVisible ? (
          <button type="button" onClick={goHome} className={buttonClass}>
            <HomeIcon className="w-6 h-6" aria-hidden="true" />
            <span>Inicio</span>
          </button>
        ) : <span className="min-w-touch" aria-hidden="true" />}
      </div>
    </nav>
  );
}
