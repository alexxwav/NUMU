import { useState } from 'react';
import { Fish, Shell } from 'lucide-react';

const controls = 'min-h-touch rounded-btn border-2 border-numu-purple px-3 py-2 font-fredoka font-bold text-numu-purple hover:bg-soft-lavender focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-numu-purple aria-disabled:opacity-60';
const flex = 'flex flex-wrap items-center justify-center gap-3';

function Action({ className = '', unavailable = false, onClick, children, ...props }) {
  return (
    <button type="button" {...props} aria-disabled={unavailable || undefined} tabIndex={unavailable ? -1 : undefined}
      onClick={unavailable ? undefined : onClick} className={controls + ' ' + className}>
      {children}
    </button>
  );
}

function Pieces({ count, Icon }) {
  return (
    <span aria-hidden="true" className="inline-flex flex-wrap justify-center gap-1">
      {Array.from({ length: count }, (_, index) => <Icon className="h-5 w-5" key={index} />)}
    </span>
  );
}

function RemoveObjects({ visual, feedback }) {
  const [removed, setRemoved] = useState([]);
  const complete = removed.length === visual.removed;
  return (
    <>
      <div role="group" aria-label="Peces en la pecera" className={flex}>
        {Array.from({ length: visual.initial }, (_, index) => {
          const hidden = removed.includes(index);
          return (
            <Action key={index} aria-label={`Pez ${index + 1}${hidden ? ', escondido' : ''}`}
              aria-pressed={hidden} unavailable={complete || hidden} onClick={() => setRemoved([...removed, index])}>
              {hidden ? <span aria-hidden="true" className="block h-7 w-7 text-xl">×</span>
                : <Fish aria-hidden="true" className="h-7 w-7" />}
            </Action>
          );
        })}
      </div>
      <p role="status">{complete ? feedback : `Peces retirados: ${removed.length} de ${visual.removed}.`}</p>
    </>
  );
}

function ShareObjects({ visual, feedback }) {
  const [baskets, setBaskets] = useState(() => Array.from({ length: visual.recipients }, () => []));
  const [picked, setPicked] = useState(null);
  const used = baskets.flat();
  const least = Math.min(...baskets.map(basket => basket.length));
  const remaining = visual.total - used.length;
  const complete = remaining < visual.recipients && baskets.every(basket => basket.length === least);

  function deposit(index) {
    setBaskets(baskets.map((basket, position) => position === index ? [...basket, picked] : basket));
    setPicked(null);
  }

  return (
    <>
      <div role="group" aria-label="Conchas por repartir" className={flex}>
        {Array.from({ length: visual.total }, (_, index) => {
          const placed = used.includes(index);
          return (
            <Action key={index} aria-label={`Concha ${index + 1}${placed ? ', repartida' : ''}`}
              aria-pressed={picked === index} unavailable={placed || complete}
              onClick={() => setPicked(index)} className={picked === index ? 'bg-soft-lavender' : ''}>
              {placed ? <span aria-hidden="true" className="block h-6 w-6">✓</span>
                : <Shell aria-hidden="true" className="h-6 w-6" />}
            </Action>
          );
        })}
      </div>
      <div role="group" aria-label="Canastas" className={flex}>
        {baskets.map((basket, index) => (
          <Action key={index} unavailable={picked === null || complete || basket.length > least}
            onClick={() => deposit(index)} className="flex flex-col items-center gap-2">
            <span>Canasta {index + 1} · {basket.length}</span>
            <Pieces count={basket.length} Icon={Shell} />
          </Action>
        ))}
      </div>
      <p role="status">{complete ? feedback : `Conchas por repartir: ${remaining}. ${picked === null
        ? 'Elige una concha.' : 'Elige una canasta que todavía no recibió su concha en esta vuelta.'}`}</p>
    </>
  );
}

function Grid({ rows, columns, children }) {
  return (
    <div className="mx-auto grid w-full max-w-sm gap-1"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: rows * columns }, (_, index) =>
        children(Math.floor(index / columns) + 1, index % columns + 1))}
    </div>
  );
}

const cellLabel = (row, column) => `Fila ${row}, columna ${column}`;
const coordinate = (row, column) => `${row},${column}`;
const cellStyle = 'grid min-h-[44px] min-w-0 place-items-center px-0 border-gray-300';

function Reflection({ visual, feedback }) {
  const { rows, columns, axis, source_cells: source, placed_cells: placed } = visual;
  const [cells, setCells] = useState(() => placed.map(([row, column]) => coordinate(row, column)));
  const [message, setMessage] = useState('');
  const target = source.map(([row, column]) => coordinate(row, 2 * axis.after + 1 - column));
  const complete = cells.length === target.length;
  const details = source.map(([row, column]) => cellLabel(row, column)).join(' · ');

  function place(cell) {
    if (!target.includes(cell)) {
      setMessage('Mira la fila y cuenta la distancia hasta el eje en los dos lados.');
      return;
    }
    setCells([...cells, cell]);
    setMessage('Encontraste una pareja.');
  }
  return (
    <>
      <p className="text-sm text-gray-600">Fichas de origen · {details}. El eje está después de la columna {axis.after}.</p>
      <Grid rows={rows} columns={columns}>
        {(row, column) => {
          const cell = coordinate(row, column);
          const filled = cells.includes(cell);
          if (column <= axis.after) {
            const origin = source.some(([r, c]) => r === row && c === column);
            return <span key={cell} aria-hidden="true"
              className={`${cellStyle} rounded-btn border-2 ${column === axis.after ? 'border-r-numu-purple' : ''} ${origin ? 'bg-soft-lavender' : ''}`}>
              {origin ? '◆' : ''}
            </span>;
          }
          return <Action key={cell} aria-label={cellLabel(row, column)} aria-pressed={filled}
            unavailable={complete || filled} onClick={() => place(cell)} className={`${cellStyle} ${filled ? 'bg-soft-lavender' : ''}`}>
            <span aria-hidden="true">{filled ? '◆' : '·'}</span>
          </Action>;
        }}
      </Grid>
      <p role="status">{complete ? feedback : `${message} Fichas reflejadas: ${cells.length} de ${target.length}.`.trim()}</p>
    </>
  );
}

function Mosaic({ visual, feedback }) {
  const [tiles, setTiles] = useState([]);
  const [{ rows, columns, cells }] = visual.figures;
  const complete = tiles.length === cells.length;
  return (
    <>
      <Grid rows={rows} columns={columns}>
        {(row, column) => {
          const cell = coordinate(row, column);
          if (!cells.some(([r, c]) => r === row && c === column)) return <span key={cell} aria-hidden="true" />;
          const filled = tiles.includes(cell);
          return <Action key={cell} aria-label={cellLabel(row, column)} aria-pressed={filled}
            unavailable={filled} onClick={() => setTiles([...tiles, cell])} className={`${cellStyle} ${filled ? 'bg-soft-lavender' : ''}`}>
            <span aria-hidden="true">{filled ? '■' : '·'}</span>
          </Action>;
        }}
      </Grid>
      <p role="status">{complete ? feedback : `Baldosas colocadas: ${tiles.length}.`}</p>
    </>
  );
}

function Balance({ visual, feedback }) {
  const [added, setAdded] = useState(0);
  const left = visual.left.reduce((sum, value) => sum + value, 0);
  const right = visual.right.reduce((sum, value) => sum + value, added);
  const complete = left === right;
  return (
    <>
      <div className={flex} role="group" aria-label="Platos de la balanza">
        <div className="rounded-btn border-b-4 border-numu-purple bg-soft-lavender p-3">
          Plato izquierdo · {left} <span aria-hidden="true">{'● '.repeat(left)}</span>
        </div>
        <div className="rounded-btn border-b-4 border-numu-purple bg-soft-lavender p-3">
          Plato derecho · {right} <span aria-hidden="true">{'● '.repeat(right)}</span>
        </div>
      </div>
      <div className={flex}>
        <Action unavailable={complete} onClick={() => setAdded(added + 1)}>Añadir una ficha</Action>
        <Action unavailable={!added} onClick={() => setAdded(added - 1)}>Quitar una ficha</Action>
      </div>
      <p role="status">{complete ? feedback : `El plato derecho tiene ${right} fichas y todavía pesa menos. Fichas añadidas: ${added}.`}</p>
    </>
  );
}

function Machine({ visual, feedback }) {
  const [selected, setSelected] = useState(null);
  const [shown, setShown] = useState([]);
  const revealed = shown.includes(selected);
  const complete = shown.length === visual.inputs.length;
  const [{ value: factor }] = visual.operations;
  return (
    <>
      <div role="group" aria-label="Tarjetas para la máquina" className={flex}>
        {visual.inputs.map(input => (
          <Action key={input} aria-pressed={input === selected} onClick={() => setSelected(input)}
            className={input === selected ? 'bg-soft-lavender' : ''}>Tarjeta {input}</Action>
        ))}
      </div>
      <div className={flex}>
        <p className="rounded-btn bg-soft-lavender p-3">Entra {selected ?? '□'} → Haz el doble → Sale {revealed ? selected * factor : '□'}</p>
        <Action unavailable={selected === null || revealed} onClick={() => setShown([...shown, selected])}>Abrir la salida</Action>
      </div>
      <p role="status">{complete ? feedback : revealed ? `Entró ${selected} y salieron ${selected * factor}. Prueba otra tarjeta.`
        : selected === null ? 'Elige una tarjeta.' : `Entró ${selected}. Imagina dos grupos iguales antes de abrir la salida.`}</p>
    </>
  );
}

const examples = {
  remove_objects: RemoveObjects,
  share_objects: ShareObjects,
  place_reflection_cells: Reflection,
  place_tiles: Mosaic,
  balance_objects: Balance,
  try_rule_machine: Machine,
};

export default function InteractiveExample({ visual, interaction }) {
  const [run, setRun] = useState(0);
  const Example = examples[interaction.type];
  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1 pl-6 text-gray-600">
        {interaction.instructions.map(step => <li key={step}>{step}</li>)}
      </ol>
      <div className="space-y-3 rounded-card border-2 border-gray-100 p-4 text-center">
        <Example key={run} visual={visual} feedback={interaction.feedback_on_complete} />
        <Action onClick={() => setRun(run + 1)}>{interaction.restart_label}</Action>
      </div>
    </div>
  );
}
