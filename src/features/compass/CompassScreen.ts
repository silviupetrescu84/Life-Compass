import type { Value } from '../values/values.types';
import { getCompassLayout } from './compass.layout';

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

export function createCompassScreen(onExplore: () => void, onReset: () => void) {
  const element = document.createElement('section');
  element.className = 'compass-screen';
  element.hidden = true;
  element.innerHTML = `
    <div class="introduction compass-introduction">
      <p class="eyebrow">LET WHAT MATTERS GUIDE YOU</p>
      <h1 tabindex="-1">Your Life Compass</h1>
      <p class="introduction__description">These are the values you've chosen to guide how you live.</p>
    </div>
    <p id="compass-instructions" class="compass-instructions">Choose a value to read its meaning. Use Tab or the arrow keys to explore.</p>
    <div class="compass-stage" role="group" aria-label="Your core values compass" aria-describedby="compass-instructions"></div>
    <section class="compass-detail" role="status" aria-live="polite" aria-atomic="true"><h2>What guides you?</h2><p>Tap or click a value on your compass to explore its meaning.</p></section>
    <p class="compass-reflection">Your values are directions, not destinations. You can return and change them as you grow.</p>
    <div class="compass-actions"><button class="primary-button explore-button" type="button">Explore my values</button><button class="text-button restart-button" type="button" aria-expanded="false" aria-controls="restart-confirmation">Start again</button></div>
    <section id="restart-confirmation" class="restart-confirmation" aria-labelledby="restart-title" hidden>
      <h2 id="restart-title">Start again?</h2><p>This will clear your selected values and saved compass on this device. You can then explore with a fresh start.</p>
      <div class="compass-actions"><button class="primary-button cancel-restart" type="button">Keep my values</button><button class="text-button confirm-restart" type="button">Clear my values</button></div>
    </section>
  `;
  const stage = element.querySelector<HTMLDivElement>('.compass-stage')!;
  const detail = element.querySelector<HTMLElement>('.compass-detail')!;
  const restart = element.querySelector<HTMLButtonElement>('.restart-button')!;
  const confirmation = element.querySelector<HTMLElement>('.restart-confirmation')!;
  const cancel = element.querySelector<HTMLButtonElement>('.cancel-restart')!;
  let coreValues: readonly Value[] = [];
  let activeId: string | null = null;
  let lastWidth = 0;
  const buttons: HTMLButtonElement[] = [];
  const spokes: SVGLineElement[] = [];

  function closeConfirmation(): void {
    confirmation.hidden = true;
    restart.setAttribute('aria-expanded', 'false');
  }
  element.querySelector('.explore-button')!.addEventListener('click', () => { closeConfirmation(); onExplore(); });
  restart.addEventListener('click', () => {
    confirmation.hidden = false;
    restart.setAttribute('aria-expanded', 'true');
    cancel.focus();
  });
  cancel.addEventListener('click', () => { closeConfirmation(); restart.focus(); });
  confirmation.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeConfirmation(); restart.focus(); }
  });
  element.querySelector('.confirm-restart')!.addEventListener('click', () => {
    closeConfirmation();
    activeId = null;
    onReset();
  });

  function select(value: Value): void {
    activeId = value.id;
    coreValues.forEach((item, index) => {
      buttons[index]?.setAttribute('aria-pressed', String(item.id === activeId));
      spokes[index]?.classList.toggle('is-active', item.id === activeId);
    });
    detail.querySelector('h2')!.textContent = value.name;
    detail.querySelector('p')!.textContent = value.description;
  }

  function draw(): void {
    if (coreValues.length === 0 || element.hidden) return;
    const width = stage.getBoundingClientRect().width;
    if (width < 240) return;
    lastWidth = width;
    const layout = getCompassLayout(coreValues.length, width);
    stage.style.height = `${layout.height}px`;
    const svg = svgElement('svg', { viewBox: `0 0 ${width} ${layout.height}`, width, height: layout.height, 'aria-hidden': 'true', focusable: 'false', class: 'compass-svg' });
    svg.append(svgElement('circle', { cx: layout.center.x, cy: layout.center.y, r: layout.circleRadius, class: 'compass-ring' }));
    svg.append(svgElement('circle', { cx: layout.center.x, cy: layout.center.y, r: layout.circleRadius * 0.52, class: 'compass-inner-ring' }));
    buttons.length = 0;
    spokes.length = 0;
    stage.replaceChildren(svg);
    coreValues.forEach((value, index) => {
      const position = layout.positions[index]!;
      const spoke = svgElement('line', { x1: layout.center.x, y1: layout.center.y, x2: position.point.x, y2: position.point.y, class: 'compass-spoke' });
      svg.append(spoke);
      spokes.push(spoke);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'compass-value';
      button.textContent = value.name;
      button.setAttribute('aria-label', `${value.name}: show value description`);
      button.setAttribute('aria-pressed', String(value.id === activeId));
      button.style.left = `${position.point.x}px`;
      button.style.top = `${position.point.y}px`;
      button.style.width = `${position.labelWidth}px`;
      button.style.textAlign = position.alignment;
      button.addEventListener('click', () => select(value));
      button.addEventListener('keydown', (event) => {
        let next = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % coreValues.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + coreValues.length) % coreValues.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = coreValues.length - 1;
        else return;
        event.preventDefault();
        buttons[next]?.focus();
        const nextValue = coreValues[next];
        if (nextValue) select(nextValue);
      });
      buttons.push(button);
      stage.append(button);
      spoke.classList.toggle('is-active', value.id === activeId);
    });
    svg.append(svgElement('circle', { cx: layout.center.x, cy: layout.center.y, r: 16, class: 'compass-hub' }));
    svg.append(svgElement('path', { d: `M ${layout.center.x} ${layout.center.y - 8} L ${layout.center.x + 4} ${layout.center.y + 5} L ${layout.center.x} ${layout.center.y + 2} L ${layout.center.x - 4} ${layout.center.y + 5} Z`, class: 'compass-needle' }));
  }

  const observer = new ResizeObserver(() => {
    if (element.hidden || Math.abs(stage.getBoundingClientRect().width - lastWidth) < 0.5) return;
    const focusedIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    draw();
    if (focusedIndex >= 0) buttons[focusedIndex]?.focus({ preventScroll: true });
  });
  observer.observe(stage);

  return {
    element,
    render(selectedValues: readonly Value[]): void {
      coreValues = selectedValues;
      if (!coreValues.some((value) => value.id === activeId)) {
        activeId = null;
        detail.querySelector('h2')!.textContent = 'What guides you?';
        detail.querySelector('p')!.textContent = 'Tap or click a value on your compass to explore its meaning.';
      }
      closeConfirmation();
      draw();
    },
  };
}
