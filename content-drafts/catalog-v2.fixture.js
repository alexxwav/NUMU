import { readFileSync } from 'node:fs';

export const draftIds = [
  'cuantos-quedan', 'grupos-iguales', 'repartimos-por-igual',
  'la-mitad-del-espejo', 'una-vuelta-al-contorno', 'llenamos-el-mosaico',
  'escaleras-de-numeros', 'la-balanza-de-numu', 'el-numero-escondido', 'la-maquina-de-reglas', 'de-un-dibujo-a-una-regla',
];

export function loadCatalogV2() {
  return JSON.parse(readFileSync(new URL('../src/data/lessonContent.json', import.meta.url), 'utf8'));
}
