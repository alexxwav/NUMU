# Lectura en voz alta de NUMU

NUMU usa la síntesis de voz del navegador. Prioriza español de México y, dentro de ese idioma, los nombres reconocibles de voces femeninas y la calidad que anuncia el navegador. Una voz como Dalia (Natural) se usa si aparece en la lista del dispositivo. Sabina y las voces de español de EE. UU., Latinoamérica o España sirven de respaldo. Si el navegador aún no enumeró voces en español, recibe una solicitud en `es-MX` y decide si puede reproducirla.

La lectura conserva la puntuación, convierte signos matemáticos a palabras y marca las pausas entre líneas. Las voces de calidad anunciada conservan un ritmo cercano al suyo. Para el resto, NUMU usa un ritmo un poco más lento y una variación de tono moderada. El botón de teoría detiene la lectura. El cambio de ruta cancela la anterior y la lectura respeta el control de sonido y el volumen maestro.

## Si se aprueba una voz neuronal independiente del dispositivo

El punto de entrada actual es `speak(text, { onFinish })` y `stopSpeech()` en `src/utils/audio.js`. Un proveedor futuro debe conservar ese ciclo de reproducción, cancelación y finalización, con la voz del navegador como respaldo. Para conectarlo haría falta:

1. Elegir proveedor y voz `es-MX`, aprobar el costo y las condiciones de tratamiento de texto educativo.
2. Aprovisionar la cuenta y guardar la credencial exclusivamente en un servidor autorizado. Para un catálogo fijo también se puede sintetizar y revisar audio en ese servidor antes de distribuirlo como un recurso.
3. Si se sintetiza bajo demanda, ofrecer un endpoint autenticado con límites de longitud y frecuencia, devolver audio y cancelar solicitudes o reproducción cuando cambie la ruta. Enviar únicamente el fragmento educativo que corresponda.
4. Escuchar muestras reales de teorías, operaciones y nombres en los dispositivos objetivo antes de habilitarlo.

El Bloque usa exclusivamente las voces expuestas por el navegador. La calidad audible depende del dispositivo y de la voz disponible.
