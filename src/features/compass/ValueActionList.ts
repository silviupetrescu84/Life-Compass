import { MAX_ACTION_LENGTH, MAX_ACTIONS, type ValueAction } from '../values/values.notes';

// Lists one value's small actions so they can be added, edited, completed, and deleted.
// Every change is reported through onChange; the notes form keeps it as an unsaved edit.
export function createActionList(onChange: (actions: readonly ValueAction[]) => void) {
  const element = document.createElement('section');
  element.className = 'value-actions';
  element.setAttribute('aria-labelledby', 'value-actions-title');
  element.innerHTML = `
    <h3 id="value-actions-title">Small actions</h3>
    <p id="value-actions-hint" class="value-notes__hint"></p>
    <ul class="value-actions__list"></ul>
    <form class="value-actions__add">
      <label for="value-action-new">New action</label>
      <div class="value-actions__add-row">
        <input id="value-action-new" type="text" autocomplete="off" aria-describedby="value-actions-hint" />
        <button type="submit" class="primary-button">Add</button>
      </div>
    </form>
    <p class="value-actions__count" role="status"></p>
  `;
  const hint = element.querySelector<HTMLParagraphElement>('#value-actions-hint')!;
  const list = element.querySelector<HTMLUListElement>('.value-actions__list')!;
  const form = element.querySelector<HTMLFormElement>('.value-actions__add')!;
  const newAction = element.querySelector<HTMLInputElement>('#value-action-new')!;
  const addButton = form.querySelector<HTMLButtonElement>('button')!;
  const count = element.querySelector<HTMLParagraphElement>('.value-actions__count')!;
  newAction.maxLength = MAX_ACTION_LENGTH;
  let actions: ValueAction[] = [];

  function report(): void {
    onChange([...actions]);
  }

  function row(action: ValueAction, index: number): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'value-action';
    const done = document.createElement('input');
    done.type = 'checkbox';
    const text = document.createElement('input');
    text.type = 'text';
    text.className = 'value-action__text';
    text.maxLength = MAX_ACTION_LENGTH;
    text.setAttribute('aria-label', `Action ${index + 1}`);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'text-button';
    remove.textContent = 'Delete';
    // The last text that was not empty, restored if the action is left empty.
    let kept = action.text;

    function update(changes: Partial<ValueAction>): void {
      actions[index] = { ...actions[index]!, ...changes };
      const { text: current, done: complete } = actions[index];
      item.classList.toggle('is-done', complete);
      done.setAttribute('aria-label', `Done: ${current}`);
      remove.setAttribute('aria-label', `Delete: ${current}`);
    }
    done.checked = action.done;
    text.value = action.text;
    update({});

    done.addEventListener('change', () => {
      update({ done: done.checked });
      report();
    });
    text.addEventListener('input', () => {
      update({ text: text.value });
      report();
    });
    // Actions cannot be left empty; use Delete to remove one.
    text.addEventListener('change', () => {
      if (text.value.trim() === '') text.value = kept;
      kept = text.value;
      update({ text: kept });
      report();
    });
    remove.addEventListener('click', () => {
      actions.splice(index, 1);
      render();
      const texts = list.querySelectorAll<HTMLInputElement>('.value-action__text');
      (texts[index] ?? texts[index - 1] ?? newAction).focus();
      report();
    });
    item.append(done, text, remove);
    return item;
  }

  function render(): void {
    list.replaceChildren(...actions.map(row));
    const full = actions.length >= MAX_ACTIONS;
    newAction.disabled = full;
    addButton.disabled = full;
    count.textContent = `${actions.length} of ${MAX_ACTIONS} actions${full ? '. Delete one to add another.' : ''}`;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = newAction.value.trim();
    if (text === '' || actions.length >= MAX_ACTIONS) return;
    actions.push({ text, done: false });
    newAction.value = '';
    render();
    newAction.focus();
    report();
  });

  return {
    element,
    /** Shows a value's actions, replacing whatever was shown before. */
    show(valueActions: readonly ValueAction[], valueName: string): void {
      actions = [...valueActions];
      hint.textContent = `Up to ${MAX_ACTIONS} small steps that help you live ${valueName}.`;
      newAction.value = '';
      render();
    },
  };
}
