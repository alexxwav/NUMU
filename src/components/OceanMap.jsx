import { Check, Lock } from 'lucide-react';
import mascotUrl from '../assets/brand/mascot/logo-mascota-morado.png';
import { starIcon } from './iconAssets.js';
import './OceanMap.css';

// Mapa de niveles como una aventura submarina: se baja desde la superficie (nivel 1)
// hasta el fondo del mar. Solo cambia la presentación; las reglas son las mismas que antes:
//   · completado: nivel < nivel general · actual: nivel === nivel general · bloqueado: nivel > nivel general.
// Colores: solo clases y variables del sistema de diseño (DESIGN_SYSTEM.md, index.css).

const ROW = 128;         // distancia vertical entre niveles (px)
const PAD_TOP = 96;      // espacio de la superficie
const PAD_BOTTOM = 176;  // espacio del fondo marino
// Posición horizontal (%) de cada nivel: un camino que serpentea sin salirse en móvil.
const X_PATTERN = [50, 72, 76, 56, 32, 24, 42, 68, 74, 52];
const THEME_IDS = ['conteo', 'aritmetica', 'geometria', 'patrones'];

const BUBBLES = [
  { left: 6, size: 10, duration: 11, delay: 0, rest: -0.82 },
  { left: 14, size: 16, duration: 15, delay: 4, rest: -0.35 },
  { left: 27, size: 8, duration: 10, delay: 7, rest: -0.6 },
  { left: 38, size: 12, duration: 14, delay: 2, rest: -0.15 },
  { left: 61, size: 9, duration: 12, delay: 9, rest: -0.7 },
  { left: 69, size: 14, duration: 16, delay: 1, rest: -0.45 },
  { left: 83, size: 10, duration: 11, delay: 5, rest: -0.9 },
  { left: 92, size: 18, duration: 18, delay: 3, rest: -0.25 },
];

function levelPositions(total) {
  return Array.from({ length: total }, (_, i) => ({
    level: i + 1,
    x: X_PATTERN[i % X_PATTERN.length],
    y: PAD_TOP + i * ROW,
  }));
}

// Tramo curvo entre dos niveles (coordenadas: x en %, y en px).
function segment(a, b) {
  const mid = (b.y - a.y) / 2;
  return `M ${a.x} ${a.y} C ${a.x} ${a.y + mid}, ${b.x} ${b.y - mid}, ${b.x} ${b.y}`;
}

function Seaweed({ className = '', height = 90, tone = 'ocean-map__fill-a', style }) {
  return (
    <svg viewBox="0 0 40 100" width={height * 0.4} height={height} className={`ocean-map__deco ocean-map__weed ${className}`} style={style} aria-hidden="true">
      <path className={tone} d="M18 100 C8 82 28 70 16 52 C6 36 24 24 14 4 C24 14 30 30 22 46 C32 62 18 76 26 100 Z" />
      <path className={`${tone} opacity-70`} d="M24 100 C30 86 22 78 30 64 C36 54 34 44 38 36 C40 50 34 62 34 72 C34 84 30 92 30 100 Z" />
    </svg>
  );
}

function Coral({ className = '', size = 80, tone = 'ocean-map__fill-a', style }) {
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} className={`ocean-map__deco ${className}`} style={style} aria-hidden="true">
      <path className={tone} d="M36 80 L36 52 C36 44 30 40 24 34 C18 28 16 18 20 12 C24 8 28 12 27 18 C26 24 32 30 37 34 L38 22 C38 14 42 8 46 10 C50 12 48 20 46 26 L44 40 C48 34 56 30 58 22 C60 14 66 14 66 20 C66 30 56 40 48 48 L46 80 Z" />
      <circle className={tone} cx="20" cy="11" r="5" />
      <circle className={tone} cx="46" cy="9" r="5" />
      <circle className={tone} cx="66" cy="18" r="5" />
    </svg>
  );
}

function Starfish({ className = '', style }) {
  return (
    <svg viewBox="0 0 40 40" width="34" height="34" className={`ocean-map__deco ${className}`} style={style} aria-hidden="true">
      <path className="ocean-map__fill-c" d="M20 2 L25 15 L38 15 L27.5 23.5 L31.5 37 L20 29 L8.5 37 L12.5 23.5 L2 15 L15 15 Z" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="2" fill="#fff" opacity="0.8" />
    </svg>
  );
}

function Shell({ className = '', style }) {
  return (
    <svg viewBox="0 0 40 32" width="34" height="27" className={`ocean-map__deco ${className}`} style={style} aria-hidden="true">
      <path className="ocean-map__fill-a" d="M20 2 C8 2 2 14 4 26 L36 26 C38 14 32 2 20 2 Z" />
      <path d="M20 4 L20 26 M12 6 L10 26 M28 6 L30 26" stroke="#fff" strokeWidth="2" opacity="0.6" strokeLinecap="round" />
      <rect className="ocean-map__fill-a" x="15" y="25" width="10" height="5" rx="2" />
    </svg>
  );
}

function Fish({ tone = 'ocean-map__fill-a', size = 40 }) {
  return (
    <svg viewBox="0 0 48 28" width={size} height={size * 0.6} aria-hidden="true">
      <path className={tone} d="M30 14 C30 6 22 2 14 2 C6 2 2 9 2 14 C2 19 6 26 14 26 C22 26 30 22 30 14 Z M30 14 L46 4 L42 14 L46 24 Z" />
      <circle cx="10" cy="11" r="2.4" fill="#fff" />
      <circle cx="9.6" cy="11" r="1.1" className="fill-text-dark" />
    </svg>
  );
}

function Chest({ style }) {
  return (
    <svg viewBox="0 0 64 52" width="64" height="52" className="ocean-map__deco" style={style} aria-hidden="true">
      <rect x="4" y="20" width="56" height="30" rx="6" className="ocean-map__fill-a" />
      <path d="M4 22 C4 8 14 4 32 4 C50 4 60 8 60 22 Z" className="ocean-map__fill-a" />
      <path d="M4 22 L60 22" stroke="#fff" strokeWidth="3" opacity="0.7" />
      <rect x="27" y="18" width="10" height="13" rx="3" className="ocean-map__fill-c" />
      <circle cx="18" cy="12" r="2.5" className="ocean-map__fill-c" />
      <circle cx="46" cy="10" r="2" className="ocean-map__fill-c" />
    </svg>
  );
}

/* Decoraciones SVG propias de cada módulo: cambian al alternar las pestañas de /inicio.
   Usan currentColor para tomar el color ambiental del tema correspondiente. */
function CountDots({ style }) {
  return (
    <svg viewBox="0 0 96 40" width="96" height="40" className="ocean-map__deco ocean-map__module-deco" style={style} aria-hidden="true">
      <rect x="1" y="1" width="94" height="38" rx="19" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.7" />
      {[18, 42, 66].map((cx) => <circle key={cx} cx={cx} cy="20" r="7" fill="currentColor" />)}
    </svg>
  );
}

function MathBubbles({ style }) {
  return (
    <svg viewBox="0 0 80 44" width="80" height="44" className="ocean-map__deco ocean-map__module-deco" style={style} aria-hidden="true">
      <circle cx="20" cy="22" r="17" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M12 22 H28 M20 14 V30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="58" cy="22" r="17" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M50 22 H66" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function ShapeTrail({ style }) {
  return (
    <svg viewBox="0 0 110 40" width="110" height="40" className="ocean-map__deco ocean-map__module-deco" style={style} aria-hidden="true">
      <polygon points="18,4 32,34 4,34" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <rect x="42" y="8" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="3" />
      <polygon points="83,4 96,14 91,34 75,34 70,14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

function ColorPattern({ style }) {
  return (
    <svg viewBox="0 0 136 36" width="136" height="36" className="ocean-map__deco ocean-map__module-deco" style={style} aria-hidden="true">
      {[12, 34, 56, 78, 100].map((cx, i) => (
        <circle key={cx} cx={cx} cy="18" r="10" fill="currentColor" opacity={i % 2 === 0 ? 0.9 : 0.45} />
      ))}
      <circle cx="122" cy="18" r="9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="3 4" />
    </svg>
  );
}

function ModuleDecorations({ theme }) {
  const top = (step) => PAD_TOP + ROW * step;
  if (theme === 'aritmetica') {
    return (
      <>
        <MathBubbles style={{ left: '4%', top: top(1.1) }} />
        <MathBubbles style={{ right: '5%', top: top(5.2), transform: 'scale(0.85)' }} />
        <Coral size={58} tone="ocean-map__fill-a" style={{ left: '6%', top: top(8.1) }} />
      </>
    );
  }
  if (theme === 'geometria') {
    return (
      <>
        <ShapeTrail style={{ left: '3%', top: top(1.2) }} />
        <ShapeTrail style={{ right: '4%', top: top(4.6), transform: 'scale(0.85)' }} />
        <ShapeTrail style={{ left: '5%', top: top(8) }} />
      </>
    );
  }
  if (theme === 'patrones') {
    return (
      <>
        <ColorPattern style={{ left: '3%', top: top(1.1) }} />
        <ColorPattern style={{ right: '4%', top: top(4.9), transform: 'scale(0.8)' }} />
        <ColorPattern style={{ left: '5%', top: top(8.2), transform: 'scale(0.9)' }} />
      </>
    );
  }
  return (
    <>
      <CountDots style={{ left: '4%', top: top(1.4) }} />
      <CountDots style={{ right: '5%', top: top(4.3) }} />
      <CountDots style={{ left: '5%', top: top(7.8) }} />
    </>
  );
}

function StopStars({ stars }) {
  return (
    <span className="absolute -top-4 flex gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <img key={i} src={starIcon} alt=""
          className={`w-5 h-5 object-contain ${i < stars ? '' : 'opacity-25 grayscale'} ${i === 1 ? '-translate-y-1' : ''}`} />
      ))}
    </span>
  );
}

/**
 * Parada de una lección (modo `stops`, de getMapModel). Reutiliza los estilos del mapa:
 * terminada (T2, 3★) = verde · siguiente = morado con NUMU · disponible = blanca ·
 * no publicada = gris con candado (abre solo la teoría; la práctica sigue cerrada).
 * Nunca usa ?parada=N: abre playPath (práctica publicada) o theoryPath.
 */
function LessonStop({ stop, number, onOpen }) {
  const open = (path) => () => { if (path && onOpen) onOpen(path, stop); };
  const stars = Math.max(0, Math.min(3, Number(stop.bestStars) || 0));
  if (!stop.published || !stop.playPath) {
    return (
      <button type="button" onClick={open(stop.theoryPath)} disabled={!stop.theoryPath} title={stop.title}
        aria-label={`Parada ${number}: ${stop.title}. Práctica próximamente; abrir la teoría`}
        className="w-20 h-20 rounded-full bg-gray-200 text-gray-400 border-4 border-white/80 font-fredoka font-bold text-3xl grid place-items-center shadow-3d-neutral opacity-90 active:translate-y-1 transition-transform">
        <Lock className="w-8 h-8" />
      </button>
    );
  }
  if (stop.completed) {
    return (
      <button type="button" onClick={open(stop.playPath)} title={stop.title}
        aria-label={`Parada ${number}: ${stop.title}, terminada con ${stars} de 3 estrellas. Jugar otra ronda`}
        className="w-20 h-20 rounded-full bg-mint-success text-white shadow-3d-success border-4 border-white font-fredoka font-bold text-3xl grid place-items-center active:translate-y-1 transition-transform relative">
        {number}
        <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white text-mint-success grid place-items-center shadow-sm" aria-hidden="true">
          <Check className="w-5 h-5" strokeWidth={3} />
        </span>
        <StopStars stars={stars} />
      </button>
    );
  }
  if (stop.isNext) {
    return (
      <button type="button" onClick={open(stop.playPath)} title={stop.title}
        aria-label={`Parada ${number}: ${stop.title}, estás aquí. Siguiente lección`}
        className="w-24 h-24 rounded-full bg-numu-purple text-white shadow-3d-primary border-4 border-white font-fredoka font-bold text-4xl grid place-items-center animate-pulse-active active:translate-y-1 transition-transform relative">
        {number}
        <span className="absolute -top-14 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white grid place-items-center shadow-lg border-2 border-gray-100 p-1.5" aria-hidden="true">
          <img src={mascotUrl} alt="" className="w-full h-full object-contain" />
        </span>
        <span className="absolute -bottom-9 whitespace-nowrap font-poppins font-bold text-sm text-numu-purple bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
          Siguiente lección
        </span>
      </button>
    );
  }
  return (
    <button type="button" onClick={open(stop.playPath)} title={stop.title}
      aria-label={`Parada ${number}: ${stop.title}, disponible${stars ? ` (${stars} de 3 estrellas)` : ''}. Jugar`}
      className="w-20 h-20 rounded-full bg-white text-numu-purple shadow-3d-neutral border-4 border-white font-fredoka font-bold text-3xl grid place-items-center active:translate-y-1 transition-transform relative">
      {number}
      {stars > 0 && <StopStars stars={stars} />}
    </button>
  );
}

/**
 * @param {Object} props
 * @param {Array<Object>} [props.stops] - Paradas por lección de getMapModel (modo 15 lecciones). Si se
 *   pasa, reemplaza totalLevels/currentLevel/starsByLevel y cada parada abre su theoryPath o playPath.
 * @param {(path: string, stop: Object) => void} [props.onOpenStop] - Navega a la ruta de la parada.
 * @param {number} props.totalLevels - Cantidad de niveles del recorrido.
 * @param {number} props.currentLevel - Parada actual de la sección (state.levelByModule[moduleId]).
 * @param {Object<string, number>} [props.starsByLevel] - Estrellas ganadas por parada de la sección.
 * @param {string} [props.activityTitle] - Lección que abren las paradas (solo para leerla en voz y en etiquetas).
 * @param {(level: number) => void} props.onPlayLevel - Abre un nivel completado o el actual.
 * @param {boolean} [props.reduceMotion] - Ajuste «Reducir animaciones».
 * @param {string} [props.moduleId] - Módulo activo: elige el tema visual del mapa.
 */
export default function OceanMap({ totalLevels, currentLevel, starsByLevel = {}, activityTitle, onPlayLevel, reduceMotion = false, moduleId = 'conteo', stops = null, onOpenStop }) {
  const theme = THEME_IDS.includes(moduleId) ? moduleId : 'conteo';
  const what = activityTitle ? ` de ${activityTitle}` : '';
  // Modo «lecciones» (getMapModel): una parada por lessonId. Sin `stops`, el mapa antiguo de paradas.
  const lessonMode = Array.isArray(stops);
  const count = lessonMode ? stops.length : totalLevels;
  const points = levelPositions(count);
  const height = PAD_TOP + (count - 1) * ROW + PAD_BOTTOM;
  const firstPending = lessonMode ? stops.findIndex((stop) => !stop.completed) : -1;
  const reached = lessonMode ? (firstPending === -1 ? count : firstPending + 1) : Math.min(currentLevel, totalLevels);

  return (
    <div
      className={`ocean-map ocean-map--${theme} rounded-card border-2 border-gray-100 shadow-sm ${reduceMotion ? 'ocean-map--still' : ''}`}
      style={{ height, '--travel': `${height}px` }}
    >
      <div className="ocean-map__rays" aria-hidden="true" />

      {/* Superficie con olas */}
      <svg className="ocean-map__surface" viewBox="0 0 400 28" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 L400 0 L400 12 C370 24 340 4 300 14 C260 24 230 4 200 14 C170 24 140 4 100 14 C70 24 30 4 0 14 Z" fill="#fff" opacity="0.85" />
      </svg>

      {/* Burbujas */}
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="ocean-map__bubble"
          style={{ left: `${b.left}%`, width: b.size, height: b.size, '--duration': `${b.duration}s`, '--delay': `${b.delay}s`, '--rest': b.rest }}
        />
      ))}

      {/* Peces que cruzan */}
      <div className="ocean-map__fish" style={{ top: PAD_TOP + ROW * 1.5, '--duration': '24s', '--delay': '-6s', '--rest-x': '6%' }}>
        <Fish tone="ocean-map__fill-b" />
      </div>
      <div className="ocean-map__fish ocean-map__fish--left" style={{ top: PAD_TOP + ROW * 5.4, '--duration': '30s', '--delay': '-14s', '--rest-x': '84%' }}>
        <Fish tone="ocean-map__fill-c" size={32} />
      </div>
      {count > 7 && (
        <div className="ocean-map__fish" style={{ top: PAD_TOP + ROW * 7.6, '--duration': '27s', '--delay': '-20s', '--rest-x': '12%' }}>
          <Fish tone="ocean-map__fill-b" size={28} />
        </div>
      )}

      {/* Algas y corales a los lados del camino */}
      <Seaweed height={110} style={{ left: '2%', top: PAD_TOP + ROW * 0.6 }} />
      <Seaweed height={80} tone="ocean-map__fill-b" style={{ right: '3%', top: PAD_TOP + ROW * 2.4, animationDelay: '-1.5s' }} />
      <Coral size={64} tone="ocean-map__fill-c" style={{ left: '4%', top: PAD_TOP + ROW * 3.6 }} />
      <Seaweed height={100} style={{ right: '4%', top: PAD_TOP + ROW * 4.7, animationDelay: '-3s' }} />
      <Starfish style={{ left: '8%', top: PAD_TOP + ROW * 6.3 }} />
      <Seaweed height={90} tone="ocean-map__fill-b" style={{ left: '3%', top: PAD_TOP + ROW * 7.5, animationDelay: '-2s' }} />
      <ModuleDecorations theme={theme} />

      {/* Fondo marino: arena, corales, algas y el cofre al final del recorrido */}
      <div className="ocean-map__sand" aria-hidden="true" />
      <Coral size={92} style={{ left: '3%', bottom: 18 }} />
      <Seaweed height={120} style={{ left: '22%', bottom: 26, animationDelay: '-1s' }} />
      <Shell className="hidden sm:block" style={{ left: '36%', bottom: 20 }} />
      <Chest style={{ left: '50%', bottom: 26, marginLeft: -32 }} />
      <Starfish style={{ right: '28%', bottom: 22 }} />
      <Seaweed height={104} tone="ocean-map__fill-b" style={{ right: '16%', bottom: 26, animationDelay: '-2.5s' }} />
      <Coral size={78} tone="ocean-map__fill-b" style={{ right: '2%', bottom: 18 }} />

      {/* Camino submarino: arena para todo el recorrido y verde para lo ya recorrido */}
      <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {points.slice(1).map((point, i) => {
          const d = segment(points[i], point);
          const done = point.level <= reached;
          return (
            <g key={point.level}>
              <path d={d} fill="none" className="ocean-map__path--base" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path
                d={d}
                fill="none"
                className={`ocean-map__path ${done ? 'ocean-map__path--done' : 'ocean-map__path--pending'}`}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>

      {/* Niveles */}
      <ol className="absolute inset-0 list-none m-0 p-0">
        {lessonMode && points.map(({ level, x, y }) => (
          <li key={stops[level - 1].lessonId} className="absolute z-10" style={{ left: `${x}%`, top: y, transform: 'translate(-50%, -50%)' }}>
            <LessonStop stop={stops[level - 1]} number={level} onOpen={onOpenStop} />
          </li>
        ))}
        {!lessonMode && points.map(({ level, x, y }) => {
          const isDone = level < currentLevel;
          const isCurrent = level === currentLevel;
          const isLocked = level > currentLevel;
          const starsEarned = Math.max(0, Math.min(3, Math.round(Number(starsByLevel[level] ?? 0) || 0)));
          return (
            <li key={level} className="absolute z-10" style={{ left: `${x}%`, top: y, transform: 'translate(-50%, -50%)' }}>
              {isDone && (
                <button
                  type="button"
                  onClick={() => onPlayLevel(level)}
                  aria-label={`Parada ${level}, completada con ${starsEarned} de 3 estrellas. Jugar otra ronda${what}`}
                  className="w-20 h-20 rounded-full bg-mint-success text-white shadow-3d-success border-4 border-white font-fredoka font-bold text-3xl grid place-items-center active:translate-y-1 transition-transform relative"
                >
                  {level}
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white text-mint-success grid place-items-center shadow-sm" aria-hidden="true">
                    <Check className="w-5 h-5" strokeWidth={3} />
                  </span>
                  <span className="absolute -top-4 flex gap-0.5" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <img
                        key={i}
                        src={starIcon}
                        alt=""
                        className={`w-5 h-5 object-contain ${i < starsEarned ? '' : 'opacity-25 grayscale'} ${i === 1 ? '-translate-y-1' : ''}`}
                      />
                    ))}
                  </span>
                </button>
              )}

              {isCurrent && (
                <button
                  type="button"
                  onClick={() => onPlayLevel(level)}
                  aria-label={`Parada ${level}, estás aquí. Jugar una ronda${what}`}
                  className="w-24 h-24 rounded-full bg-numu-purple text-white shadow-3d-primary border-4 border-white font-fredoka font-bold text-4xl grid place-items-center animate-pulse-active active:translate-y-1 transition-transform relative"
                >
                  {level}
                  {/* NUMU marca «estás aquí»: es el único pulpo del mapa. */}
                  <span className="absolute -top-14 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-white grid place-items-center shadow-lg border-2 border-gray-100 p-1.5" aria-hidden="true">
                    <img src={mascotUrl} alt="" className="w-full h-full object-contain" />
                  </span>
                  <span className="absolute -bottom-9 whitespace-nowrap font-poppins font-bold text-sm text-numu-purple bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
                    Siguiente lección
                  </span>
                </button>
              )}

              {isLocked && (
                <button
                  type="button"
                  disabled
                  aria-label={`Parada ${level}, bloqueada. Termina la parada anterior para abrirla`}
                  className="w-20 h-20 rounded-full bg-gray-200 text-gray-400 border-4 border-white/80 font-fredoka font-bold text-3xl grid place-items-center cursor-not-allowed shadow-3d-neutral opacity-90"
                >
                  <Lock className="w-8 h-8" />
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
