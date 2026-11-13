import { starIcon } from './iconAssets.js';
import { clampStars } from '../utils/stars.js';

/**
 * Indicador de 3 estrellas de una lección con la imagen de marca.
 * Las ganadas se ven a color; las demás, en escala de grises y atenuadas.
 * @param {Object} props
 * @param {number} [props.stars] - Estrellas ganadas (0 a 3).
 * @param {string} [props.size] - Clases de tamaño de cada estrella.
 * @param {string} [props.className] - Clases extra del contenedor.
 */
export default function LessonStars({ stars = 0, size = 'w-5 h-5', className = '' }) {
  const earned = clampStars(stars);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} role="img" aria-label={`${earned} de 3 estrellas`}>
      {[0, 1, 2].map((i) => (
        <img
          key={i}
          src={starIcon}
          alt=""
          className={`${size} object-contain ${i < earned ? '' : 'grayscale opacity-40'}`}
        />
      ))}
    </span>
  );
}
