import type { AccountSession } from '../shared/compass-data';
import { isValidSignupPassword, PASSWORD_REQUIREMENTS } from '../shared/password';
import { accountRequest } from './accounts';

export function createAccountScreen(onSignIn: (session: AccountSession) => void): HTMLElement {
  const screen = document.createElement('main');
  screen.id = 'main-content';
  screen.className = 'main-content account-screen';
  screen.innerHTML = `
    <section class="account-card" aria-labelledby="account-title">
      <h1 id="account-title" tabindex="-1"></h1>
      <form class="account-form">
        <label for="account-email">Email address</label>
        <input id="account-email" type="email" autocomplete="username" maxlength="254" required />
        <label for="account-password">Password</label>
        <input id="account-password" type="password" required maxlength="128" />
        <p class="account-password-hint" id="account-password-hint">${PASSWORD_REQUIREMENTS}</p>
        <p class="account-error" role="alert"></p>
        <button type="submit" class="primary-button"></button>
      </form>
      <button type="button" class="text-button account-switch"></button>
    </section>
  `;

  const title = screen.querySelector('h1')!;
  const form = screen.querySelector('form')!;
  const email = screen.querySelector<HTMLInputElement>('#account-email')!;
  const password = screen.querySelector<HTMLInputElement>('#account-password')!;
  const hint = screen.querySelector<HTMLElement>('.account-password-hint')!;
  const message = screen.querySelector<HTMLElement>('.account-error')!;
  const submit = form.querySelector('button')!;
  const switchMode = screen.querySelector<HTMLButtonElement>('.account-switch')!;
  let creating = false;

  function render(): void {
    title.textContent = submit.textContent = creating ? 'Create account' : 'Sign in';
    switchMode.textContent = creating ? 'Already have an account? Sign in' : 'New to Life Compass? Create an account';
    password.autocomplete = creating ? 'new-password' : 'current-password';
    password.minLength = creating ? 8 : 1;
    hint.hidden = !creating;
    password.setAttribute('aria-describedby', creating ? hint.id : '');
  }

  switchMode.addEventListener('click', () => {
    creating = !creating;
    password.value = '';
    message.textContent = '';
    render();
    title.focus();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    if (creating && !isValidSignupPassword(password.value)) {
      message.textContent = PASSWORD_REQUIREMENTS;
      password.focus();
      return;
    }
    const body = {
      email: email.value,
      password: password.value,
    };
    submit.disabled = switchMode.disabled = true;
    message.textContent = '';
    void accountRequest<AccountSession>(creating ? 'signup' : 'login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(onSignIn)
      .catch((error: Error) => {
        message.textContent = error.message;
      })
      .finally(() => {
        submit.disabled = switchMode.disabled = false;
      });
  });

  render();
  return screen;
}
