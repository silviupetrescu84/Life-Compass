interface SelectableCardOptions {
  name: string;
  description: string;
  onToggle: () => void;
}

export function createSelectableCard(options: SelectableCardOptions) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'value-card';
  button.setAttribute('aria-pressed', 'false');

  const name = document.createElement('span');
  name.className = 'value-card__name';
  name.textContent = options.name;

  const indicator = document.createElement('span');
  indicator.className = 'value-card__indicator';
  indicator.setAttribute('aria-hidden', 'true');

  const description = document.createElement('span');
  description.className = 'value-card__description';
  description.textContent = options.description;

  button.append(name, indicator, description);
  button.addEventListener('click', options.onToggle);

  return {
    element: button,
    setSelected(selected: boolean): void {
      button.setAttribute('aria-pressed', String(selected));
      indicator.textContent = selected ? '✓' : '+';
    },
  };
}
