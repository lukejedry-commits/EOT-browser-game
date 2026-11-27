import { SHOP } from '../config/economy.js';

export function createBrazierMenu(root, { onBuy, onClose }) {
  const panel = document.createElement('section');
  panel.id = 'brazier';
  panel.hidden = true;
  panel.innerHTML = `
    <h2 data-title>Brazier</h2>
    <p data-orbs></p>
    <ul data-stock></ul>
    <button type="button" data-close>Close</button>
  `;
  root.append(panel);
  panel.addEventListener('click', (event) => {
    const buy = event.target.closest('[data-buy]');
    if (buy) onBuy(buy.getAttribute('data-buy'));
    if (event.target.closest('[data-close]')) onClose();
  });

  return {
    show(state) {
      panel.hidden = false;
      panel.querySelector('[data-title]').textContent = state.id === 'B2'
        ? 'Brazier, antechamber'
        : 'Brazier, arena alcove';
      panel.querySelector('[data-orbs]').textContent = `${state.orbs} red orbs`;
      panel.querySelector('[data-stock]').innerHTML = SHOP.map((item) => {
        const owned = state.owned.includes(item.id);
        const needs = item.needs && !state.owned.includes(item.needs);
        const label = owned ? 'Owned' : needs ? 'Needs Ember Charge II' : `${item.cost}`;
        const disabled = owned || needs || state.orbs < item.cost ? 'disabled' : '';
        return `<li><button type="button" data-buy="${item.id}" ${disabled}>${item.name} — ${label}</button></li>`;
      }).join('');
    },
    hide() { panel.hidden = true; },
    open() { return !panel.hidden; },
  };
}
