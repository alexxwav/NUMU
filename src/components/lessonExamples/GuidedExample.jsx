import { Lightbulb } from 'lucide-react';
import { renderGuidedExample } from '../../utils/lessonGameAdapter.js';
import InteractiveExample from './InteractiveExample.jsx';

function VisualExample({ example }) {
  return (
    <div className="space-y-3">
      <div dangerouslySetInnerHTML={{ __html: renderGuidedExample(example.visual) }} />
      <p className="text-lg text-gray-600">{example.explanation}</p>
    </div>
  );
}

export default function GuidedExample({ example }) {
  return (
    <section className="space-y-4 rounded-card border-2 border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex gap-4">
        <Lightbulb aria-hidden="true" className="h-8 w-8 shrink-0 text-sunshine-yellow" />
        <h2 className="font-fredoka text-xl font-bold">Ejemplo guiado</h2>
      </div>
      {example.mode === 'interactive' ? (
        <>
          <p className="text-lg text-gray-600">{example.explanation}</p>
          <InteractiveExample visual={example.visual} interaction={example.interaction} />
        </>
      ) : <VisualExample example={example} />}
      {example.additional_examples?.map((item, index) => <VisualExample key={index} example={item} />)}
    </section>
  );
}
