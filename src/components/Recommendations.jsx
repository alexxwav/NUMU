import { Link } from 'react-router-dom';
import { Sparkles, Play, RotateCcw, TrendingUp, ArrowRight } from 'lucide-react';
import { sfx } from '../utils/audio.js';

// Estilo por tipo de recomendación (paleta de DESIGN_SYSTEM.md; el refuerzo no es punitivo).
const TYPE_STYLE = {
  INICIAR: { label: 'Empieza', button: 'Comenzar', Icon: Play, badge: 'bg-numu-purple', cta: 'bg-numu-purple shadow-3d-primary' },
  CONTINUAR: { label: 'Continúa', button: 'Continuar', Icon: ArrowRight, badge: 'bg-cyan-ocean', cta: 'bg-cyan-ocean shadow-3d-cyan' },
  REFORZAR: { label: 'Refuerza', button: 'Practicar', Icon: RotateCcw, badge: 'bg-orange-energy', cta: 'bg-orange-energy shadow-3d-orange' },
  AVANZAR: { label: 'Avanza', button: '¡Vamos!', Icon: TrendingUp, badge: 'bg-mint-success', cta: 'bg-mint-success shadow-3d-success' },
};

/**
 * Sección "Recomendado para ti".
 * @param {Object} props
 * @param {Array} props.recommendations - Resultado de buildRecommendations().recommendations.
 * @param {Array} [props.unavailableInterests] - Intereses sin curso publicado (se muestran como «Próximamente»).
 * @param {string} [props.title] - Título de la sección.
 * @param {boolean} [props.compact] - Una sola tarjeta sin título (pantalla de resultados).
 */
export default function Recommendations({ recommendations = [], unavailableInterests = [], title = 'Recomendado para ti', compact = false }) {
  if (!recommendations.length && !unavailableInterests.length) return null;

  return (
    <section aria-label={title} className={compact ? 'w-full max-w-md' : ''}>
      {!compact && (
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="w-7 h-7 text-sunshine-yellow" />
          <h3 className="text-2xl font-fredoka font-bold text-text-dark">{title}</h3>
        </div>
      )}

      <div className={compact ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-3 gap-6'}>
        {recommendations.map((rec) => {
          const style = TYPE_STYLE[rec.type] ?? TYPE_STYLE.INICIAR;
          return (
            <article key={`${rec.type}-${rec.lessonId}`} data-recommendation={rec.type}
              className="bg-white text-text-dark rounded-card p-6 border-2 border-gray-100 shadow-sm flex flex-col gap-3 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-sm font-bold ${style.badge}`}>
                  <style.Icon className="w-4 h-4" /> {style.label}
                </span>
                <span className="text-xs font-semibold text-gray-400">{rec.courseTitle}{rec.level ? ` · Nivel ${rec.level}` : ''}</span>
              </div>
              <h4 className="text-xl font-fredoka font-bold">{rec.title}</h4>
              <p className="font-semibold text-numu-deep-indigo">{rec.message}</p>
              <p className="text-sm text-gray-500 flex-1">
                <span className="font-semibold">¿Por qué?</span> {rec.reason}
              </p>
              <Link to={rec.route} onClick={() => sfx.tap()}
                className={`min-h-touch rounded-btn ${style.cta} text-white font-fredoka font-bold text-lg flex items-center justify-center gap-2 hover:translate-y-1 hover:shadow-none transition-all`}>
                {style.button}
              </Link>
            </article>
          );
        })}
      </div>

      {!compact && unavailableInterests.length > 0 && (
        <p className="mt-4 text-sm text-gray-500">
          {unavailableInterests.map((interest) => (
            <span key={interest.id} className="inline-flex items-center gap-1 mr-3 px-3 py-1 rounded-full bg-white border border-gray-200">
              {interest.name}: <span className="font-semibold text-numu-purple">Próximamente</span>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
