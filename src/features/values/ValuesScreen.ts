import { createSelectableCard } from '../../shared/components/SelectableCard';
import { valueCategories, values } from './values.data';
import { createValuesState, MAX_SELECTED_VALUES } from './values.state';

export function createValuesScreen(): HTMLElement {
  const state = createValuesState();
  const screen = document.createElement('main');
  screen.id = 'main-content';
  screen.className = 'main-content';
  screen.innerHTML = `
    <section class="introduction" aria-labelledby="page-title">
      <p class="eyebrow"><span aria-hidden="true">✧</span> A little reflection. A meaningful beginning.</p>
      <h1 id="page-title">What matters most to you?</h1>
      <p class="introduction__description">Explore the values that feel important to you. Choose up to ${MAX_SELECTED_VALUES} you want to bring into your life.</p>
      <div class="guidance"><span class="guidance__symbol" aria-hidden="true">↗</span><p>Follow what feels true to you.<br><span>Choose up to ${MAX_SELECTED_VALUES} values. Deselect one anytime to make room for another.</span></p></div>
    </section>
    <div class="collection-heading"><p>YOUR VALUES, YOUR DIRECTION</p><span>${values.length} values to explore</span></div>
  `;

  const cards = new Map<string, ReturnType<typeof createSelectableCard>>();
  valueCategories.forEach((category, index) => {
    const section = document.createElement('section');
    section.className = 'value-category';
    const heading = document.createElement('h2');
    heading.id = `category-${index}`;
    heading.textContent = category.name;
    section.setAttribute('aria-labelledby', heading.id);
    const count = document.createElement('span');
    count.className = 'category-count';
    count.textContent = `${category.values.length} values`;
    heading.append(count);

    const grid = document.createElement('div');
    grid.className = 'values-grid';
    for (const value of category.values) {
      const card = createSelectableCard({
        name: value.name,
        description: value.description,
        onToggle: () => state.toggle(value.id),
      });
      cards.set(value.id, card);
      grid.append(card.element);
    }
    section.append(heading, grid);
    screen.append(section);
  });

  const footer = document.createElement('footer');
  footer.className = 'page-footer';
  footer.textContent = 'A life that feels like you begins with what you value.';
  screen.append(footer);

  const selectionBar = document.createElement('aside');
  selectionBar.className = 'selection-bar';
  selectionBar.setAttribute('aria-label', 'Your selection');
  selectionBar.innerHTML = `<div class="selection-bar__inner"><p class="selection-count" role="status" aria-live="polite" aria-atomic="true"></p><p class="selection-note">Choose up to ${MAX_SELECTED_VALUES} values that feel right to you.</p></div>`;
  const count = selectionBar.querySelector<HTMLElement>('.selection-count');
  state.subscribe((selectedIds) => {
    const atLimit = selectedIds.size >= MAX_SELECTED_VALUES;
    for (const [id, card] of cards) {
      const selected = selectedIds.has(id);
      card.setSelected(selected);
      card.element.setAttribute('aria-disabled', String(atLimit && !selected));
    }
    if (count) {
      count.textContent = `${selectedIds.size} of ${MAX_SELECTED_VALUES} values selected${atLimit ? '. Deselect one to choose another.' : ''}`;
    }
  });
  screen.append(selectionBar);
  return screen;
}
