import { createValuesScreen } from '../features/values/ValuesScreen';
import type { AccountSession } from '../shared/compass-data';
import '../shared/styles/global.css';
import { accountRequest, createAccountStorage } from './accounts';
import { createAccountScreen } from './AccountScreen';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application root is missing.');
const root = app;

const header = document.createElement('header');
header.className = 'site-header';
header.innerHTML = `
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <div class="site-header__inner">
    <a class="brand" href="./" aria-label="Life Compass home">
      <svg class="brand__mark" viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="17" stroke="currentColor" stroke-width="1.4"/><path d="m26 12-3 11-9 5 3-11 9-5Z" fill="currentColor"/><path d="m20 20 6-8-3 11-3-3Z" fill="#f7f8f2"/></svg>
      <span>Life Compass</span>
    </a>
    <div class="account-controls" hidden></div>
  </div>
`;
const controls = header.querySelector<HTMLDivElement>('.account-controls')!;

function showSignIn(focus: boolean): void {
  const screen = createAccountScreen((session) => showAccount(session, true));
  root.replaceChildren(header, screen);
  if (focus) screen.querySelector('h1')!.focus();
}

function showAccount(session: AccountSession, focus: boolean): void {
  const lifetime = new AbortController();
  const email = document.createElement('span');
  email.className = 'account-email';
  email.textContent = session.email;
  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'text-button logout-button';
  logout.textContent = 'Log out';
  controls.hidden = false;
  controls.replaceChildren(email, logout);

  const feedback = document.createElement('div');
  feedback.className = 'account-feedback';
  feedback.innerHTML = '<p role="status"></p><button type="button" class="text-button" hidden>Retry save</button>';
  const message = feedback.querySelector('p')!;
  const retry = feedback.querySelector('button')!;
  const account = createAccountStorage(session, (status, error) => {
    retry.hidden = status !== 'failed';
    message.textContent = status === 'failed' ? (error as Error).message : '';
  });
  const screen = createValuesScreen({ ...account, signal: lifetime.signal });
  account.discardInitializationWrites();
  root.replaceChildren(header, feedback, screen);
  if (focus) screen.querySelector<HTMLElement>('section:not([hidden]) h1')?.focus();

  retry.addEventListener('click', () => void account.save());
  window.addEventListener(
    'beforeunload',
    (event) => {
      if (account.hasPendingChanges()) event.preventDefault();
    },
    { signal: lifetime.signal },
  );

  logout.addEventListener('click', () => {
    logout.disabled = true;
    screen.inert = true;
    void (async () => {
      try {
        const saved = await account.save();
        if (!saved && !window.confirm('Some changes could not be saved. Log out anyway?')) return;
        await account.logout();
        lifetime.abort();
        controls.replaceChildren();
        controls.hidden = true;
        showSignIn(true);
      } catch (error) {
        message.textContent = (error as Error).message;
      } finally {
        logout.disabled = false;
        screen.inert = false;
      }
    })();
  });
}

const loading = document.createElement('main');
loading.id = 'main-content';
loading.className = 'main-content account-screen';
loading.innerHTML = '<p role="status"></p><button type="button" class="text-button" hidden>Try again</button>';
const status = loading.querySelector('p')!;
const retry = loading.querySelector('button')!;

async function loadSession(): Promise<void> {
  status.textContent = 'Checking your session…';
  retry.hidden = true;
  try {
    const session = await accountRequest<AccountSession | null>('session');
    if (session) showAccount(session, false);
    else showSignIn(false);
  } catch (error) {
    status.textContent = (error as Error).message;
    retry.hidden = false;
  }
}

root.replaceChildren(header, loading);
retry.addEventListener('click', () => void loadSession());
void loadSession();
