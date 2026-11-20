import { MAX_RATING, RATINGS, toRating, type ValueNotes } from '../values/values.notes';
import type { Value } from '../values/values.types';
import { BADGE_RADIUS, getCompassLayout, pointOnCircle, ratingAtPoint } from './compass.layout';
import { createNotesSaveBar } from './NotesSaveBar';
import { createValueNotesForm } from './ValueNotesForm';

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

// Keys that change a focused rating badge, following the usual slider conventions.
const RATING_KEYS: Partial<Record<string, (rating: number) => number>> = {
  ArrowUp: (rating) => rating + 1,
  ArrowRight: (rating) => rating + 1,
  ArrowDown: (rating) => rating - 1,
  ArrowLeft: (rating) => rating - 1,
  Home: () => RATINGS[0],
  End: () => MAX_RATING,
};

const PLACEHOLDER = {
  name: 'What guides you?',
  description: 'Tap or click a value on your compass to explore its meaning and describe it in your own words.',
};

export function createCompassScreen(
  notes: ValueNotes,
  onExplore: () => void,
  onReset: () => void,
  saveToAccount?: () => Promise<boolean>,
) {
  const element = document.createElement('section');
  element.className = 'compass-screen';
  element.hidden = true;
  element.innerHTML = `
    <div class="introduction compass-introduction">
      <p class="eyebrow">LET WHAT MATTERS GUIDE YOU</p>
      <h1 tabindex="-1">Your Life Compass</h1>
      <p class="introduction__description">These are the values you've chosen to guide how you live.</p>
    </div>
    <p id="compass-instructions" class="compass-instructions">Click along a value's line to rate it from 1 to 5, or select its number and use the arrow keys. Choose a value's name to read its meaning and add your own definition, reflection, and small actions.</p>
    <div class="compass-stage" role="group" aria-label="Your core values compass" aria-describedby="compass-instructions"></div>
    <section class="compass-detail" aria-labelledby="compass-detail-title"><div role="status" aria-live="polite" aria-atomic="true"><h2 id="compass-detail-title"></h2><p></p></div></section>
    <p class="compass-reflection">Your values are directions, not destinations. You can return and change them as you grow.</p>
    <div class="compass-actions"><button class="primary-button explore-button" type="button">Explore my values</button><button class="text-button restart-button" type="button" aria-expanded="false" aria-controls="restart-confirmation">Start again</button></div>
    <section id="restart-confirmation" class="restart-confirmation" aria-labelledby="restart-title" hidden>
      <h2 id="restart-title">Start again?</h2><p>This will clear your selected values, your ratings, definitions, reflections, and small actions, and your saved compass ${saveToAccount ? 'from your account' : 'on this device'}. You can then explore with a fresh start.</p>
      <div class="compass-actions"><button class="primary-button cancel-restart" type="button">Keep my values</button><button class="text-button confirm-restart" type="button">Clear my values</button></div>
    </section>
  `;
  const stage = element.querySelector<HTMLDivElement>('.compass-stage')!;
  const detail = element.querySelector<HTMLElement>('.compass-detail')!;
  const detailName = detail.querySelector('h2')!;
  const detailDescription = detail.querySelector('p')!;
  const restart = element.querySelector<HTMLButtonElement>('.restart-button')!;
  const confirmation = element.querySelector<HTMLElement>('.restart-confirmation')!;
  const cancel = element.querySelector<HTMLButtonElement>('.cancel-restart')!;
  const saveBar = createNotesSaveBar(notes, saveToAccount);
  const notesForm = createValueNotesForm(notes, () => saveBar.refresh());
  detail.append(notesForm.element);
  detail.after(saveBar.element);
  let coreValues: readonly Value[] = [];
  let activeId: string | null = null;
  let lastWidth = 0;
  const markers: {
    id: string;
    angle: number;
    button: HTMLButtonElement;
    handle: SVGGElement;
    score: SVGTextElement;
    spoke: SVGLineElement;
  }[] = [];

  function closeConfirmation(): void {
    confirmation.hidden = true;
    restart.setAttribute('aria-expanded', 'false');
  }
  element.querySelector('.explore-button')!.addEventListener('click', () => {
    closeConfirmation();
    onExplore();
  });
  restart.addEventListener('click', () => {
    confirmation.hidden = false;
    restart.setAttribute('aria-expanded', 'true');
    cancel.focus();
  });
  cancel.addEventListener('click', () => {
    closeConfirmation();
    restart.focus();
  });
  confirmation.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeConfirmation();
      restart.focus();
    }
  });
  element.querySelector('.confirm-restart')!.addEventListener('click', () => {
    closeConfirmation();
    showDetail(null);
    onReset();
  });

  function markActive(): void {
    for (const { id, button, spoke } of markers) {
      button.setAttribute('aria-pressed', String(id === activeId));
      spoke.classList.toggle('is-active', id === activeId);
    }
  }

  function showDetail(value: Value | null): void {
    activeId = value?.id ?? null;
    markActive();
    detailName.textContent = (value ?? PLACEHOLDER).name;
    detailDescription.textContent = (value ?? PLACEHOLDER).description;
    notesForm.show(value);
  }
  showDetail(null);

  function draw(): void {
    if (element.hidden) return;
    const width = stage.getBoundingClientRect().width;
    // Remember the width even when skipping, so the observer redraws once there is room.
    lastWidth = width;
    // Not laid out yet (for example, rendered before being attached); the observer redraws later.
    if (width === 0) return;
    const layout = getCompassLayout(coreValues.length, width);
    const { center, circleRadius } = layout;
    stage.style.height = `${layout.height}px`;
    const svg = svgElement('svg', {
      viewBox: `0 0 ${width} ${layout.height}`,
      width,
      height: layout.height,
      role: 'group',
      'aria-label': 'Your ratings',
      class: 'compass-svg',
    });
    // Everything but the rating badges is drawing only, hidden from screen readers.
    const drawing = svgElement('g', { 'aria-hidden': 'true' });
    const centeredCircle = (r: number, className: string) =>
      svgElement('circle', { cx: center.x, cy: center.y, r, class: className });
    const levelPoint = (angle: number, level: number) =>
      pointOnCircle(center, (circleRadius * level) / MAX_RATING, angle);
    // The outer ring is the highest rating; fainter rings mark the levels below it.
    drawing.append(centeredCircle(circleRadius, 'compass-ring'));
    for (let level = 1; level < MAX_RATING; level++) {
      drawing.append(centeredCircle((circleRadius * level) / MAX_RATING, 'compass-level'));
    }
    const ratingArea = svgElement('polygon', { class: 'compass-rating-area' });
    markers.length = 0;
    svg.append(drawing);
    stage.replaceChildren(svg);

    // Moves each value's badge along its axis to its rating and keeps the shape in step.
    function updateRatings(): void {
      const points = markers.map(({ id, angle, handle, score }) => {
        const { rating } = notes.get(id);
        const point = levelPoint(angle, rating);
        handle.setAttribute('transform', `translate(${point.x} ${point.y})`);
        handle.setAttribute('aria-valuenow', String(rating));
        handle.setAttribute('aria-valuetext', `${rating} out of ${MAX_RATING}`);
        score.textContent = String(rating);
        return `${point.x},${point.y}`;
      });
      ratingArea.setAttribute('points', points.join(' '));
    }

    function setRating(id: string, rating: number): void {
      notes.edit(id, { ...notes.get(id), rating: toRating(rating) });
      saveBar.refresh();
      updateRatings();
    }

    // Clicking the graph along a value's axis sets that value's rating.
    svg.addEventListener('click', (event) => {
      const { left, top } = svg.getBoundingClientRect();
      const picked = ratingAtPoint(layout, { x: event.clientX - left, y: event.clientY - top }, MAX_RATING);
      if (picked) setRating(markers[picked.index]!.id, picked.rating);
    });

    coreValues.forEach((value, index) => {
      const position = layout.positions[index]!;
      const spoke = svgElement('line', {
        x1: center.x,
        y1: center.y,
        x2: position.point.x,
        y2: position.point.y,
        class: 'compass-spoke',
      });
      drawing.append(spoke);
      // A small tick across the axis at every level shows where the graph can be clicked.
      const across = ((position.angle + 90) * Math.PI) / 180;
      for (const level of RATINGS) {
        const { x, y } = levelPoint(position.angle, level);
        const [dx, dy] = [4 * Math.cos(across), 4 * Math.sin(across)];
        drawing.append(svgElement('line', { x1: x - dx, y1: y - dy, x2: x + dx, y2: y + dy, class: 'compass-tick' }));
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = `compass-value compass-value--${position.placement}`;
      button.textContent = value.name;
      button.setAttribute('aria-label', `${value.name}: show value description and your notes`);
      button.style.left = `${position.point.x}px`;
      button.style.top = `${position.point.y}px`;
      button.style.width = `${position.labelWidth}px`;
      button.addEventListener('click', () => showDetail(value));
      button.addEventListener('keydown', (event) => {
        let next = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % coreValues.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
          next = (index - 1 + coreValues.length) % coreValues.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = coreValues.length - 1;
        else return;
        event.preventDefault();
        markers[next]?.button.focus();
        const nextValue = coreValues[next];
        if (nextValue) showDetail(nextValue);
      });

      // The rating badge shows the number and is a slider for keyboard and screen reader users.
      const handle = svgElement('g', {
        class: 'compass-rating-handle',
        role: 'slider',
        tabindex: 0,
        'aria-label': `${value.name} rating`,
        'aria-valuemin': RATINGS[0],
        'aria-valuemax': MAX_RATING,
      });
      const score = svgElement('text', { class: 'compass-rating-score' });
      handle.append(svgElement('circle', { r: BADGE_RADIUS }), score);
      handle.addEventListener('keydown', (event) => {
        const change = RATING_KEYS[event.key];
        if (!change) return;
        event.preventDefault();
        setRating(value.id, Math.min(MAX_RATING, Math.max(RATINGS[0], change(notes.get(value.id).rating))));
      });
      markers.push({ id: value.id, angle: position.angle, button, handle, score, spoke });
      stage.append(button);
    });
    markActive();
    drawing.append(
      ratingArea,
      centeredCircle(12, 'compass-hub'),
      svgElement('path', {
        d: `M ${center.x} ${center.y - 8} L ${center.x + 4} ${center.y + 5} L ${center.x} ${center.y + 2} L ${center.x - 4} ${center.y + 5} Z`,
        class: 'compass-needle',
      }),
    );
    svg.append(...markers.map(({ handle }) => handle));
    updateRatings();
  }

  const observer = new ResizeObserver(() => {
    if (element.hidden || Math.abs(stage.getBoundingClientRect().width - lastWidth) < 0.5) return;
    // Redrawing replaces every marker, so put focus back on the same name or rating badge.
    const focused = document.activeElement;
    const index = markers.findIndex(({ button, handle }) => button === focused || handle === focused);
    const part = markers[index]?.handle === focused ? 'handle' : 'button';
    draw();
    if (index >= 0) markers[index]![part].focus({ preventScroll: true });
  });
  observer.observe(stage);

  return {
    element,
    disconnect: () => observer.disconnect(),
    render(selectedValues: readonly Value[]): void {
      coreValues = selectedValues;
      showDetail(coreValues.find((value) => value.id === activeId) ?? null);
      saveBar.refresh();
      closeConfirmation();
      draw();
    },
  };
}
