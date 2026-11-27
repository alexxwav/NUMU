import { readFileSync } from 'node:fs';
import { fitsLevelOne } from '../src/utils/lessonRound.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
export const draftIds = [
  'cuantos-quedan', 'grupos-iguales', 'repartimos-por-igual',
  'la-mitad-del-espejo', 'una-vuelta-al-contorno', 'llenamos-el-mosaico',
  'escaleras-de-numeros', 'la-balanza-de-numu', 'el-numero-escondido', 'la-maquina-de-reglas', 'de-un-dibujo-a-una-regla',
];

export function loadCatalogV2() {
  const original = read('../src/data/lessonContent.json');
  const drafts = draftIds.map(id => read(id + '.json'));
  const geometryExtension = read('figuras-ampliacion.json');
  const courses = [
    ...original.courses,
    { id: 'algebra', title: 'Álgebra', position: 3, description: 'Descubre patrones, igualdades y reglas con NUMU.', lessons: [] },
  ];

  // El selector todavía debe deduplicar el banco legado y abastecer los niveles con referencias de generador.
  const withLevels = lesson => {
    const levels = Object.fromEntries([1, 2, 3].map(level => {
      const editorial = level === 1 ? lesson.exercises.filter(fitsLevelOne) : [];
      if (lesson.id === geometryExtension.lesson_id) {
        const extension = geometryExtension.levels[String(level)];
        return [level, { exercise_types: ['contar-lados', ...extension.exercise_types],
          exercises: [...lesson.exercises.filter(exercise => level > 1 || fitsLevelOne(exercise)), ...extension.exercises] }];
      }
      const types = { conteo: ['contar-objetos'], aritmetica: level === 1 ? ['resolver-suma'] : ['resolver-suma', 'resolver-resta'],
        patrones: ['continuar-patron'] };
      return [level, { exercise_types: types[lesson.module_id], exercises: editorial,
        ...(editorial.length < 6 ? { generator_key: lesson.module_id } : {}) }];
    }));
    return { ...lesson, levels };
  };

  return { courses: courses.map(course => ({
    ...course,
    lessons: [...course.lessons.map(withLevels), ...drafts.filter(draft => draft.course_id === course.id)]
      .sort((a, b) => a.position - b.position),
  })) };
}
