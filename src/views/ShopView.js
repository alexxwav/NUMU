import { createButton } from '../components/Button.js';
import { avatarHTML, FRAMES } from '../components/Avatar.js';
import { icon } from '../components/icons.js';
import { store } from '../state/store.js';
import { sfx } from '../utils/audio.js';

function frameCard(item, { owned, equipped, canAfford, onBuy, onEquip }) {
  const card = document.createElement('article');
  card.className = 'card-numu p-5 flex flex-col items-center text-center gap-3';
  card.innerHTML = `
    <div data-preview class="p-3 rounded-full bg-soft-lavender border-2 border-border-gray"></div>
    <div>
      <h3 class="font-fredoka font-bold text-button text-text-dark">${item.name}</h3>
      <p class="font-nunito text-micro text-text-dark/50 flex items-center justify-center gap-1">
        <span class="w-4 h-4 text-cyan-ocean inline-flex">${icon('gem', 'w-4 h-4')}</span>
        <span class="tabular-nums">${item.price} gemas</span>
      </p>
    </div>
    <div data-action class="w-full"></div>
  `;
  card.querySelector('[data-preview]').innerHTML = avatarHTML(0, { size: 'w-16 h-16', frame: item.id });

  const action = card.querySelector('[data-action]');
  if (equipped) {
    action.appendChild(
      createButton({ label: 'Equipado', variant: 'success', className: 'w-full text-button', onClick: onEquip })
    );
  } else if (owned) {
    action.appendChild(
      createButton({ label: 'Equipar', variant: 'primary', className: 'w-full text-button', onClick: onEquip })
    );
  } else if (canAfford) {
    action.appendChild(
      createButton({ label: 'Canjear', variant: 'yellow', className: 'w-full text-button', onClick: onBuy })
    );
  } else {
    const btn = createButton({ label: 'Sin gemas', variant: 'white', className: 'w-full text-button' });
    btn.disabled = true;
    action.appendChild(btn);
  }
  return card;
}

/** Vista Premios / Tienda: canjea gemas por marcos de perfil. */
export function renderShopView() {
  const el = document.createElement('div');
  el.className = 'space-y-6';
  el.innerHTML = `
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="font-fredoka font-bold text-h1 text-text-dark">Premios y Tienda</h1>
        <p class="font-nunito text-body text-text-dark/60">Canjea las gemas que gana jugando por marcos de perfil.</p>
      </div>
      <span data-gems class="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border-2 border-border-gray font-fredoka font-bold text-h2 text-cyan-ocean tabular-nums"></span>
    </header>
    <div data-grid class="grid grid-cols-2 lg:grid-cols-3 gap-4"></div>
  `;

  const grid = el.querySelector('[data-grid]');
  const gemsEl = el.querySelector('[data-gems]');

  const render = () => {
    const state = store.get();
    gemsEl.innerHTML = `${icon('gem', 'w-6 h-6')}<span>${state.gems}</span>`;
    grid.innerHTML = '';
    FRAMES.forEach((item) => {
      const owned = state.owned.includes(item.id);
      const equipped = state.profile.frame === item.id;
      grid.appendChild(
        frameCard(item, {
          owned,
          equipped,
          canAfford: state.gems >= item.price,
          onBuy: () => {
            const before = store.get().owned.length;
            store.purchase(item.id, item.price);
            if (store.get().owned.length > before) {
              store.set({ profile: { frame: item.id } });
              sfx.win();
            } else {
              sfx.wrong();
            }
          },
          onEquip: () => {
            store.set({ profile: { frame: item.id } });
            sfx.tap();
          },
        })
      );
    });
  };

  render();
  el.destroy = store.subscribe(render);
  return el;
}
