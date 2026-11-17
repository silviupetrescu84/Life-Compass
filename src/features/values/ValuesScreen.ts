import { createSelectableCard } from '../../shared/components/SelectableCard';
import { persistenceNote } from '../../shared/storage';
import { countValues } from '../../shared/text';
import { valueCategories, values } from './values.data';
import { CORE_VALUE_COUNT, createValuesState } from './values.state';
import { createValueNotes } from './values.notes';
import { filterValues } from './values.filters';
import { createCompassScreen } from '../compass/CompassScreen';

function selectionGuidance(selected: number): string {
  const missing = CORE_VALUE_COUNT - selected;
  if (missing > 0) return `Add ${countValues(missing)} to continue.`;
  if (missing < 0) return `Remove ${countValues(-missing)} to continue.`;
  return 'Ready when you are.';
}

export function createValuesScreen(): HTMLElement {
  const state = createValuesState();
  const notes = createValueNotes();
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
      <div class="guidance"><span class="guidance__symbol" aria-hidden="true">↗</span><p>Explore freely. Follow what feels true to you.<br><span>Choose the ${CORE_VALUE_COUNT} values that matter most to you. You can change them later.</span></p></div>
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
      const card = createSelectableCard({
        name: value.name,
        description: value.description,
        onToggle: () => state.toggle(value.id),
      });
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
      count.textContent = countValues(size);
    }
    explore.querySelector('.results-count')!.textContent = `${countValues(matches.length)} to explore`;
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
    chip.addEventListener('click', () => {
      category = name;
      applyFilters();
    });
    chips.append(chip);
  }
  input.addEventListener('input', () => {
    search = input.value;
    applyFilters();
  });
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
  bar.innerHTML =
    '<div class="selection-bar__inner"><div><div role="status" aria-live="polite" aria-atomic="true"><p class="selection-count"></p><p id="selection-guidance" class="selection-guidance"></p></div><p class="storage-note"></p></div><button type="button" class="primary-button" aria-describedby="selection-guidance">Continue</button></div>';
  const continueButton = bar.querySelector<HTMLButtonElement>('button')!;
  const compass = createCompassScreen(
    notes,
    () => show('explore'),
    () => {
      state.reset();
      notes.clear();
      search = '';
      category = null;
      input.value = '';
      exploreScroll = 0;
      applyFilters();
      show('explore');
    },
  );
  function show(view: 'explore' | 'compass', focus = true): void {
    if (!explore.hidden) exploreScroll = window.scrollY;
    explore.hidden = view !== 'explore';
    compass.element.hidden = view !== 'compass';
    bar.hidden = view !== 'explore';
    screen.classList.toggle('main-content--compass', view === 'compass');
    if (view === 'compass') {
      const selectedIds = state.getSelectedIds();
      compass.render(values.filter((value) => selectedIds.has(value.id)));
    }
    const active = view === 'explore' ? explore : compass.element;
    if (focus) {
      active.querySelector('h1')?.focus({ preventScroll: true });
      window.scrollTo(0, view === 'explore' ? exploreScroll : 0);
    }
  }
  // The state confirms only a complete selection, even if the button were somehow enabled.
  continueButton.addEventListener('click', () => {
    if (state.confirmCoreValues()) show('compass');
  });
  state.subscribe((selectedIds) => {
    for (const [id, card] of cards) card.setSelected(selectedIds.has(id));
    bar.querySelector('.selection-count')!.textContent =
      `${selectedIds.size} of ${countValues(CORE_VALUE_COUNT)} selected`;
    bar.querySelector('.selection-guidance')!.textContent = selectionGuidance(selectedIds.size);
    bar.querySelector('.storage-note')!.textContent = persistenceNote(state.isPersistenceAvailable(), 'choices');
    continueButton.disabled = !state.canContinue();
  });
  // Reserve the actual bar height, including wrapped mobile text and safe-area padding.
  const observer = new ResizeObserver(() => {
    if (!bar.hidden) screen.style.setProperty('--selection-bar-height', `${bar.getBoundingClientRect().height}px`);
  });
  observer.observe(bar);
  screen.append(explore, compass.element, bar);
  if (state.hasCoreValues()) show('compass', false);
  return screen;
}
