/**
 * Campo de texto amigable (bordes redondeados 2xl, objetivo táctil 64px).
 * @param {Object} options
 * @param {string} options.label - Texto visible de la pregunta.
 * @param {string} options.name
 * @param {string} [options.placeholder]
 * @param {'text'|'number'} [options.type]
 * @param {string|number} [options.value]
 * @param {number} [options.min]
 * @param {number} [options.max]
 * @param {Function} [options.onInput] - Recibe el valor actual.
 * @param {string} [options.hint]
 * @returns {HTMLElement}
 */
export function createField({
  label,
  name,
  placeholder = '',
  type = 'text',
  value = '',
  min,
  max,
  onInput,
  hint = '',
} = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'space-y-2';
  wrap.innerHTML = `
    <label for="field-${name}" class="block font-fredoka font-semibold text-button text-text-dark">${label}</label>
    <input id="field-${name}" name="${name}" type="${type}" value="${value ?? ''}" placeholder="${placeholder}"
      ${type === 'number' ? `inputmode="numeric" min="${min ?? ''}" max="${max ?? ''}"` : 'autocomplete="off"'}
      class="input-numu" />
    ${hint ? `<p class="font-nunito text-micro text-text-dark/50">${hint}</p>` : ''}
  `;
  const input = wrap.querySelector('input');
  input.addEventListener('input', () => onInput?.(input.value, input));
  return wrap;
}
