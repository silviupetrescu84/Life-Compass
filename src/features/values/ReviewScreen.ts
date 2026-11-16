import { values } from './values.data';
import { MAX_CORE_VALUES, type ValuesState } from './values.state';

export function createReviewScreen(state: ValuesState, onBack: () => void, onContinue: () => void) {
  const element = document.createElement('section');
  element.hidden = true;
  element.innerHTML = `
    <div class="introduction">
      <button type="button" class="text-button back-button">← Back to explore</button>
      <p class="eyebrow">MAKE ROOM FOR WHAT MATTERS MOST</p>
      <h1 tabindex="-1">Your core values</h1>
      <p class="introduction__description">Narrow your selection to between 1 and ${MAX_CORE_VALUES} core values. Keep what feels most meaningful to you right now. You can change these later.</p>
    </div>
    <div class="review-status" role="status" aria-live="polite" aria-atomic="true"><h2 class="core-count"></h2><p id="review-guidance"></p></div>
    <div class="values-grid review-grid"></div>
    <p class="review-empty" hidden>No values selected yet. Return to explore and choose a value that feels important to you.</p>
    <div class="review-actions"><button type="button" class="primary-button continue-button" aria-describedby="review-guidance">Continue</button></div>
  `;
  const back = element.querySelector<HTMLButtonElement>('.back-button')!;
  const next = element.querySelector<HTMLButtonElement>('.continue-button')!;
  const grid = element.querySelector<HTMLDivElement>('.review-grid')!;
  back.addEventListener('click', onBack);
  next.addEventListener('click', () => { if (state.canContinue()) onContinue(); });

  function render(): void {
    const selectedIds = state.getSelectedIds();
    element.querySelector('.core-count')!.textContent = `${selectedIds.size} of ${MAX_CORE_VALUES} core values`;
    const excess = selectedIds.size - MAX_CORE_VALUES;
    element.querySelector('#review-guidance')!.textContent = excess > 0
      ? `Remove ${excess} ${excess === 1 ? 'value' : 'values'} to continue. You can keep between 1 and ${MAX_CORE_VALUES}.`
      : selectedIds.size === 0 ? 'Choose at least 1 value to continue.' : 'Ready when you are. You can change your values later.';
    next.disabled = !state.canContinue();
    element.querySelector<HTMLElement>('.review-empty')!.hidden = selectedIds.size !== 0;
    grid.replaceChildren();
    for (const value of values.filter((value) => selectedIds.has(value.id))) {
      const card = document.createElement('article');
      card.className = 'value-card review-card';
      const title = document.createElement('h3');
      title.className = 'value-card__name';
      title.textContent = value.name;
      const description = document.createElement('p');
      description.className = 'value-card__description';
      description.textContent = value.description;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'text-button remove-button';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${value.name}`);
      remove.addEventListener('click', () => {
        const index = [...grid.querySelectorAll('button')].indexOf(remove);
        state.toggle(value.id);
        render();
        const buttons = grid.querySelectorAll<HTMLButtonElement>('button');
        (buttons[Math.min(index, buttons.length - 1)] ?? back).focus();
      });
      card.append(title, description, remove);
      grid.append(card);
    }
  }
  return { element, render };
}
