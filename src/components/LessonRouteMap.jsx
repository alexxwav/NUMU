import { useEffect, useRef } from 'react';
import { Check, Lock, Play, RotateCcw } from 'lucide-react';
import OceanMap from './OceanMap.jsx';
import { starIcon } from './iconAssets.js';
import { getModuleStars } from '../state/store.js';

export const ROUTE_STOPS = 10;
// Medidas del recorrido de OceanMap (ROW y PAD_TOP): para centrar la parada actual en la ventana.
const MAP_ROW = 128;
const MAP_PAD_TOP = 96;

/**
 * Mapa de una lección (su ruta de 10 paradas). Cada lección tiene el suyo: usa solo
 * state.levelByModule[moduleId] y state.starsByModuleLevel[moduleId], así que jugar una lección
 * no cambia el mapa de las demás. Al terminar una ronda, Game.jsx llama a recordModuleRound y el
 * mapa avanza una parada con las estrellas ganadas (también en la cuenta).
 *
 * El mapa se muestra en una ventana con desplazamiento propio, centrada en la parada actual, y
 * arriba hay un botón grande para jugarla: no hace falta recorrer toda la página para empezar.
 * @param {Object} props
 * @param {Object} props.state - Estado de store.js.
 * @param {string} props.moduleId - Módulo de la lección (conteo, aritmetica, geometria, patrones).
 * @param {string} props.title - Nombre de la lección.
 * @param {(level: number) => void} props.onPlayLevel - Abre la ronda de esa parada.
 * @param {string} [props.maxHeightClass] - Alto de la ventana del mapa (clases de Tailwind).
 * @param {React.ReactNode} [props.footer] - Contenido extra bajo el botón (p. ej. enlace al curso).
 */
export default function LessonRouteMap({ state, moduleId, title, onPlayLevel, maxHeightClass = 'max-h-[20rem] sm:max-h-[26rem] lg:max-h-[30rem]', footer = null }) {
  const windowRef = useRef(null);
  const level = state.levelByModule?.[moduleId] ?? 1;
  const starsByLevel = state.starsByModuleLevel?.[moduleId] ?? {};
  const routeStars = getModuleStars(state, moduleId);
  const finished = level > ROUTE_STOPS;
  const nextStop = Math.min(level, ROUTE_STOPS);

  // Centra la parada actual al abrir el mapa o al cambiar de lección.
  useEffect(() => {
    const box = windowRef.current;
    if (!box) return;
    const y = MAP_PAD_TOP + (nextStop - 1) * MAP_ROW;
    box.scrollTop = Math.max(0, y - box.clientHeight / 2);
  }, [moduleId, nextStop]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-fredoka font-bold text-2xl text-text-dark">Mapa de {title}</h3>
          <p className="text-base font-semibold text-gray-600">
            {finished ? '¡Ruta completa!' : `Parada ${nextStop} de ${ROUTE_STOPS}`}
            <span className="mx-2" aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 align-middle">
              <img src={starIcon} alt="" className="w-5 h-5 object-contain" />
              <span className="tabular-nums">{routeStars}</span> de {ROUTE_STOPS * 3} estrellas
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onPlayLevel(nextStop)}
          className="min-h-touch px-6 inline-flex items-center justify-center gap-2 rounded-btn bg-sunshine-yellow text-text-dark font-fredoka font-bold text-xl shadow-3d-yellow active:translate-y-1 active:shadow-none hover:translate-y-0.5 transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-numu-purple"
        >
          {finished
            ? <><RotateCcw className="w-6 h-6" aria-hidden="true" /> Jugar otra vez la parada {ROUTE_STOPS}</>
            : <><Play className="w-6 h-6" aria-hidden="true" /> Iniciar parada {nextStop}</>}
        </button>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-bold text-text-dark" aria-label="Cómo leer el mapa">
        <li className="inline-flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-mint-success grid place-items-center text-white" aria-hidden="true"><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>
          Terminada
        </li>
        <li className="inline-flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-numu-purple" aria-hidden="true" />
          Estás aquí
        </li>
        <li className="inline-flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-gray-200 grid place-items-center text-gray-400" aria-hidden="true"><Lock className="w-3 h-3" /></span>
          Bloqueada
        </li>
      </ul>

      <div ref={windowRef} tabIndex={0} aria-label={`Mapa de ${title}: desliza para ver todas las paradas`}
        className={`${maxHeightClass} overflow-y-auto overscroll-contain rounded-card focus-visible:outline focus-visible:outline-4 focus-visible:outline-numu-purple`}>
        <OceanMap
          totalLevels={ROUTE_STOPS}
          currentLevel={level}
          starsByLevel={starsByLevel}
          activityTitle={title}
          moduleId={moduleId}
          onPlayLevel={onPlayLevel}
          reduceMotion={Boolean(state.settings?.reduceMotion)}
        />
      </div>
      {footer}
    </div>
  );
}
