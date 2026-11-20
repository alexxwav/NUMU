import { useRef, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { icon } from './icons.js';

const balloon = icon('balloon', 'w-10 h-10 sm:w-12 sm:h-12');

export default function CountingExample({ example, renderPractice }) {
  const [counted, setCounted] = useState([]);
  const firstBalloon = useRef(null);
  const total = example.visual.count;
  const complete = counted.length === total;

  const countBalloon = (index) => {
    setCounted((previous) => previous.includes(index) ? previous : [...previous, index]);
  };

  const restart = () => {
    setCounted([]);
    firstBalloon.current?.focus();
  };

  return (
    <>
      <section aria-labelledby="counting-example-title" className="bg-white rounded-card p-4 sm:p-6 border-2 border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-7 h-7 text-sunshine-yellow shrink-0" aria-hidden="true" />
          <h2 id="counting-example-title" className="font-fredoka font-bold text-2xl">Cuenta los globos</h2>
        </div>
        <p className="text-text-dark">{example.explanation}</p>

        <div role="group" aria-labelledby="counting-example-title" className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
          {Array.from({ length: total }, (_, index) => {
            const order = counted.indexOf(index) + 1;
            return (
              <button
                key={index}
                ref={index === 0 ? firstBalloon : undefined}
                type="button"
                aria-label={order ? `Globo ${index + 1}, contado en el turno ${order}` : `Contar globo ${index + 1}`}
                aria-disabled={Boolean(order)}
                tabIndex={order ? -1 : undefined}
                onClick={() => countBalloon(index)}
                className={`relative grid min-h-touch-lg place-items-center rounded-btn border-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-numu-purple ${
                  order ? 'border-numu-purple bg-soft-lavender text-numu-purple' : 'border-border-gray bg-white text-coral-alert hover:border-numu-purple'
                }`}
              >
                <span className="inline-flex" aria-hidden="true" dangerouslySetInnerHTML={{ __html: balloon }} />
                {order > 0 && (
                  <span aria-hidden="true" className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-numu-purple text-white font-fredoka font-bold">
                    {order}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div role="status" className="rounded-btn bg-soft-lavender px-4 py-3 text-text-dark">
          <p className="flex flex-wrap items-center justify-between gap-2 font-fredoka font-bold text-xl">
            <span>Globos contados</span>
            <span className="tabular-nums text-numu-purple">{counted.length} de {total}</span>
          </p>
          {complete && (
            <div className="mt-2">
              <p className="font-fredoka font-bold text-2xl text-numu-deep-indigo">¡Excelente! Contaste {total} globos.</p>
              <p>El último número que dijiste nos indica cuántos globos hay en total.</p>
            </div>
          )}
        </div>

        {complete && (
          <button type="button" onClick={restart} className="min-h-touch rounded-btn border-2 border-numu-purple px-4 font-fredoka font-bold text-xl text-numu-purple hover:bg-soft-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-numu-purple">
            Volver a contar
          </button>
        )}
      </section>
      {renderPractice(!complete)}
    </>
  );
}
