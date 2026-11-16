import { createSelectableCard } from '../../shared/components/SelectableCard';
import { valueCategories, values } from './values.data';
import { createValuesState } from './values.state';
import { filterValues } from './values.filters';
import { createReviewScreen } from './ReviewScreen';

export function createValuesScreen(): HTMLElement {
  const state = createValuesState();
  let search = '';
  let category: string | null = null;
  let exploreScroll = 0;
  const screen = document.createElement('main');
  screen.id = 'main-content';
  screen.className = 'main-content';
  const explore = document.createElement('section');
  explore.innerHTML = `
    <section class="introduction" aria-labelledby="page-title">
      <p class="eyebrow"><span aria-hidden="true">✧</span> A little reflection. A meaningful beginning.</p>
      <h1 id="page-title" tabindex="-1">What matters most to you?</h1>
      <p class="introduction__description">Explore the values that feel important to you. Choose the ones you want to bring into your life.</p>
      <div class="guidance"><span class="guidance__symbol" aria-hidden="true">↗</span><p>Explore freely. Follow what feels true to you.<br><span>Choose as many as you like, then review and narrow them to 6 core values. You can change these later.</span></p></div>
    </section>
    <div class="filters">
      <label for="value-search">Search values</label>
      <input id="value-search" type="search" placeholder="Search by name or description" autocomplete="off" />
      <div class="category-filters" role="group" aria-label="Filter by category"></div>
    </div>
    <div class="collection-heading"><p>YOUR VALUES, YOUR DIRECTION</p><span class="results-count" role="status" aria-live="polite" aria-atomic="true"></span></div>
    <div class="values-results"></div>
    <div class="empty-state" hidden><h2>No matching values</h2><p>Try a different word or clear your filters to explore all values.</p><button type="button" class="text-button clear-filters">Clear filters</button></div>
    <footer class="page-footer">A life that feels like you begins with what you value.</footer>
  `;
  const results = explore.querySelector<HTMLDivElement>('.values-results')!;
  const input = explore.querySelector<HTMLInputElement>('#value-search')!;
  const chips = explore.querySelector<HTMLDivElement>('.category-filters')!;
  const cards = new Map<string, ReturnType<typeof createSelectableCard>>();
  const sections = valueCategories.map((group, index) => {
    const section = document.createElement('section');
    section.className = 'value-category';
    section.setAttribute('aria-labelledby', `category-${index}`);
    const heading = document.createElement('h2');
    heading.id = `category-${index}`;
    heading.textContent = group.name;
    const count = document.createElement('span');
    count.className = 'category-count';
    heading.append(count);
    const grid = document.createElement('div');
    grid.className = 'values-grid';
    for (const value of group.values) {
      const card = createSelectableCard({ name: value.name, description: value.description, onToggle: () => state.toggle(value.id) });
      cards.set(value.id, card);
      grid.append(card.element);
    }
    section.append(heading, grid);
    results.append(section);
    return { section, count, group };
  });

  function applyFilters(): void {
    const matches = filterValues(values, search, category);
    const ids = new Set(matches.map((value) => value.id));
    for (const [id, card] of cards) card.element.hidden = !ids.has(id);
    for (const { section, count, group } of sections) {
      const size = group.values.filter((value) => ids.has(value.id)).length;
      section.hidden = size === 0;
      count.textContent = `${size} ${size === 1 ? 'value' : 'values'}`;
    }
    explore.querySelector('.results-count')!.textContent = `${matches.length} ${matches.length === 1 ? 'value' : 'values'} to explore`;
    explore.querySelector<HTMLElement>('.empty-state')!.hidden = matches.length !== 0;
    for (const chip of chips.querySelectorAll('button')) {
      chip.setAttribute('aria-pressed', String(chip.dataset.category === (category ?? '')));
    }
  }
  for (const name of [null, ...valueCategories.map((group) => group.name)]) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'category-chip';
    chip.dataset.category = name ?? '';
    chip.textContent = name ?? 'All';
    chip.addEventListener('click', () => { category = name; applyFilters(); });
    chips.append(chip);
  }
  input.addEventListener('input', () => { search = input.value; applyFilters(); });
  explore.querySelector('.clear-filters')!.addEventListener('click', () => {
    category = null;
    search = '';
    input.value = '';
    applyFilters();
    input.focus();
  });
  applyFilters();

  const bar = document.createElement('aside');
  bar.className = 'selection-bar';
  bar.setAttribute('aria-label', 'Your selection');
  bar.innerHTML = '<div class="selection-bar__inner"><div><p class="selection-count" role="status" aria-live="polite" aria-atomic="true"></p><p class="storage-note"></p></div><button type="button" class="primary-button">Review my values</button></div>';
  const reviewButton = bar.querySelector<HTMLButtonElement>('button')!;
  const complete = document.createElement('section');
  complete.hidden = true;
  complete.innerHTML = '<div class="introduction"><p class="eyebrow">A MEANINGFUL BEGINNING</p><h1 tabindex="-1">Your values, your direction.</h1><p class="introduction__description">Your core values are ready to reflect on. These are a starting point, and you can change them as your life evolves.</p></div><div class="values-grid core-summary"></div><div class="review-actions"><button type="button" class="primary-button">Edit my values</button></div>';
  const review = createReviewScreen(state, () => show('explore'), () => show('complete'));

  function show(view: 'explore' | 'review' | 'complete'): void {
    if (!explore.hidden) exploreScroll = window.scrollY;
    explore.hidden = view !== 'explore';
    review.element.hidden = view !== 'review';
    complete.hidden = view !== 'complete';
    bar.hidden = view !== 'explore';
    if (view === 'review') review.render();
    if (view === 'complete') {
      const summary = complete.querySelector('.core-summary')!;
      summary.replaceChildren();
      for (const value of values.filter((value) => state.getSelectedIds().has(value.id))) {
        const card = document.createElement('article');
        card.className = 'value-card';
        const title = document.createElement('h2');
        title.textContent = value.name;
        const description = document.createElement('p');
        description.className = 'value-card__description';
        description.textContent = value.description;
        card.append(title, description);
        summary.append(card);
      }
    }
    const active = view === 'explore' ? explore : view === 'review' ? review.element : complete;
    active.querySelector('h1')?.focus({ preventScroll: true });
    window.scrollTo(0, view === 'explore' ? exploreScroll : 0);
  }
  reviewButton.addEventListener('click', () => show('review'));
  complete.querySelector('button')!.addEventListener('click', () => show('review'));
  state.subscribe((selectedIds) => {
    for (const [id, card] of cards) card.setSelected(selectedIds.has(id));
    bar.querySelector('.selection-count')!.textContent = `${selectedIds.size} ${selectedIds.size === 1 ? 'value' : 'values'} selected`;
    bar.querySelector('.storage-note')!.textContent = state.isPersistenceAvailable()
      ? 'Saved on this device. You can change these later.'
      : 'Storage unavailable. Your choices will last for this visit only.';
    reviewButton.disabled = selectedIds.size === 0;
  });
  // Reserve the actual bar height, including wrapped mobile text and safe-area padding.
  const observer = new ResizeObserver(([entry]) => {
    if (entry && !bar.hidden) screen.style.setProperty('--selection-bar-height', `${bar.getBoundingClientRect().height}px`);
  });
  observer.observe(bar);
  screen.append(explore, review.element, complete, bar);
  return screen;
}
