// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import {
  CORE_STORAGE_KEY,
  NOTES_STORAGE_KEY,
  SELECTION_STORAGE_KEY,
  type AccountSession,
} from '../../src/shared/compass-data';
import { createAccountStorage } from '../../src/app/accounts';
import { noteSaveButton, rate, ratingOf } from '../support/app';
import { $, $$, required, text, type } from '../support/dom';
import { useFakeLayout } from '../support/fake-layout';

useFakeLayout();

const ids = ['love', 'trust', 'kindness', 'patience', 'honesty', 'courage'];
const session: AccountSession = {
  accountId: 1,
  email: 'person@example.test',
  data: {
    [SELECTION_STORAGE_KEY]: JSON.stringify(ids),
    [CORE_STORAGE_KEY]: JSON.stringify(ids),
  },
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const noContent = () => new Response(null, { status: 204 });
const badSave = () => json({ error: 'Save failed. Try again.' }, 500);

function startApp() {
  document.body.innerHTML = '<div id="app"></div>';
  vi.resetModules();
  return import('../../src/app/main');
}

const heading = () => [...document.querySelectorAll('main h1')].find((item) => !item.closest('[hidden]'))?.textContent;
const button = (selector: string) => $<HTMLButtonElement>(document, selector);
function submit(password = 'Long password!') {
  type($<HTMLInputElement>(document, '#account-email'), session.email);
  type($<HTMLInputElement>(document, '#account-password'), password);
  $(document, '.account-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

test('requires a root and shows the account gate only after checking the session', async () => {
  vi.resetModules();
  await expect(import('../../src/app/main')).rejects.toThrow('Application root is missing.');
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(json(null));
  vi.stubGlobal('fetch', fetch);
  await startApp();
  expect(text(document, '.site-header .brand').trim()).toBe('Life Compass');
  expect(document.querySelector('.values-results')).toBeNull();
  await vi.waitFor(() => expect(text(document, 'main [role="status"]')).toContain('Could not connect'));
  button('main button').click();
  await vi.waitFor(() => expect(heading()).toBe('Sign in'));
});

test('signs in, restores a compass, and logs out without keeping the compass on screen', async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(json(null))
    .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
    .mockResolvedValueOnce(json(session))
    .mockResolvedValueOnce(noContent());
  vi.stubGlobal('fetch', fetch);
  await startApp();
  await vi.waitFor(() => expect(heading()).toBe('Sign in'));
  submit('long password');
  submit();
  await vi.waitFor(() => expect(text(document, '.account-error')).toContain('could not complete'));
  submit('long password');
  await vi.waitFor(() => expect(heading()).toBe('Your Life Compass'));
  expect(text(document, '.account-email')).toBe(session.email);

  button('.logout-button').click();
  await vi.waitFor(() => expect(heading()).toBe('Sign in'));
  expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/session', '/api/login', '/api/login', '/api/logout']);
  expect(document.querySelector('.compass-screen')).toBeNull();
});

test('creates an account with credentials only when the browser has saved compass data', async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(json(null))
    .mockResolvedValueOnce(json({ ...session, data: {} }, 201));
  vi.stubGlobal('fetch', fetch);
  localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(['love']));
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify({ love: { reflection: 'From this browser' } }));
  await startApp();
  await vi.waitFor(() => expect(heading()).toBe('Sign in'));
  button('.account-switch').click();
  button('.account-switch').click();
  expect(heading()).toBe('Sign in');
  button('.account-switch').click();
  expect(heading()).toBe('Create account');
  expect([...document.querySelectorAll('.account-form input')].map((input) => input.getAttribute('type'))).toEqual([
    'email',
    'password',
  ]);
  submit();
  await vi.waitFor(() => expect(heading()).toBe('What matters most to you?'));
  expect(text(document, '.selection-count')).toBe('0 of 6 values selected');
  const [path, options] = fetch.mock.calls[1]!;
  expect(path).toBe('/api/signup');
  expect(JSON.parse(options!.body as string)).toEqual({
    email: session.email,
    password: 'Long password!',
  });
});

test('shows password requirements and blocks invalid passwords before submitting signup', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json(null));
  vi.stubGlobal('fetch', fetch);
  await startApp();
  await vi.waitFor(() => expect(heading()).toBe('Sign in'));
  button('.account-switch').click();
  const requirements = text(document, '#account-password-hint');
  expect(requirements).toContain('8–128 characters');
  expect(requirements).toContain('one uppercase letter and one special character');
  for (const password of ['Abcdef!', 'abcdefg!', 'Abcdefg ', 'A!' + 'b'.repeat(127)]) {
    submit(password);
    expect(text(document, '.account-error')).toBe(requirements);
  }
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(document.activeElement?.id).toBe('account-password');
});

test('saves account selections and notes, retries failed changes, and clears the account compass', async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(json({ ...session, data: {} }))
    .mockResolvedValueOnce(noContent())
    .mockResolvedValueOnce(badSave())
    .mockResolvedValueOnce(noContent())
    .mockResolvedValueOnce(noContent())
    .mockResolvedValueOnce(noContent());
  vi.stubGlobal('fetch', fetch);
  await startApp();
  await vi.waitFor(() => expect(heading()).toBe('What matters most to you?'));
  const main = $(document, 'main');
  const before = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(before);
  expect(before.defaultPrevented).toBe(false);
  for (const name of ['Love', 'Trust', 'Kindness', 'Patience', 'Honesty', 'Courage']) {
    const card = required(
      $$(main, '.value-card').find((el) => el.querySelector('.value-card__name')?.textContent === name),
      name,
    );
    card.click();
  }
  button('.selection-bar button').click();
  const pending = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(pending);
  expect(pending.defaultPrevented).toBe(true);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetch.mock.calls[1]![1]!.body as string)).toEqual(session.data);

  rate(main, 'Love', 5);
  expect(ratingOf(main, 'Love')).toBe(5);
  noteSaveButton(main).click();
  expect(text(main, '.compass-save [role="status"]')).toBe('Saving…');
  await vi.waitFor(() => expect(text(document, '.account-feedback p')).toContain('Save failed'));
  button('.account-feedback button').click();
  await vi.waitFor(() => expect(button('.account-feedback button').hidden).toBe(true));
  expect(fetch.mock.calls[2]![1]!.body).toBe(fetch.mock.calls[3]![1]!.body);
  expect(JSON.parse(fetch.mock.calls[3]![1]!.body as string)).toEqual({
    [NOTES_STORAGE_KEY]: { entries: { love: { definition: '', reflection: '', rating: 5, actions: [] } } },
  });

  noteSaveButton(main).click();
  await vi.waitFor(() => expect(text(main, '.compass-save [role="status"]')).toBe('Saved to your account.'));
  button('.restart-button').click();
  button('.confirm-restart').click();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
  expect(JSON.parse(fetch.mock.calls[4]![1]!.body as string)).toEqual({
    [SELECTION_STORAGE_KEY]: null,
    [CORE_STORAGE_KEY]: null,
    [NOTES_STORAGE_KEY]: { clear: true, entries: {} },
  });
  button('.logout-button').click();
  await vi.waitFor(() => expect(heading()).toBe('Sign in'));
});

test('lets the user stay on the compass or log out when a pending save fails', async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(json(session))
    .mockResolvedValueOnce(badSave())
    .mockResolvedValueOnce(badSave())
    .mockResolvedValueOnce(badSave())
    .mockResolvedValueOnce(json({ error: 'Could not log out.' }, 500))
    .mockResolvedValueOnce(badSave())
    .mockResolvedValueOnce(noContent());
  vi.stubGlobal('fetch', fetch);
  const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
  vi.stubGlobal('confirm', confirm);
  await startApp();
  await vi.waitFor(() => expect(heading()).toBe('Your Life Compass'));
  const main = $(document, 'main');
  rate(main, 'Love', 4);
  noteSaveButton(main).click();
  await vi.waitFor(() => expect(noteSaveButton(main).disabled).toBe(false));

  button('.logout-button').click();
  await vi.waitFor(() => expect(button('.logout-button').disabled).toBe(false));
  expect(confirm).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledTimes(3);

  button('.logout-button').click();
  await vi.waitFor(() => expect(text(document, '.account-feedback p')).toBe('Could not log out.'));
  button('.logout-button').click();
  await vi.waitFor(() => expect(heading()).toBe('Sign in'));
});

test('merges failed batches with new edits and drains edits made while a save is in flight', async () => {
  function defer() {
    let complete!: (response: Response) => void;
    const promise = new Promise<Response>((resolve) => {
      complete = resolve;
    });
    return { promise, resolve: complete };
  }
  const first = defer();
  const second = defer();
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
    .mockResolvedValueOnce(noContent());
  vi.stubGlobal('fetch', fetch);
  const account = createAccountStorage(session, vi.fn());
  const { storage } = account;
  storage.setItem('unrelated', 'ignored');
  storage.removeItem('unrelated');
  expect(storage.getItem('unrelated')).toBeNull();
  storage.setItem(NOTES_STORAGE_KEY, '{"love":{"rating":5}}');
  const failed = account.save();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  storage.setItem(NOTES_STORAGE_KEY, '{"love":{"rating":5},"trust":{"rating":4}}');
  first.resolve(badSave());
  expect(await failed).toBe(false);

  const saved = account.save();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetch.mock.calls[1]![1]!.body as string)).toEqual({
    [NOTES_STORAGE_KEY]: { entries: { love: { rating: 5 }, trust: { rating: 4 } } },
  });
  storage.removeItem(NOTES_STORAGE_KEY);
  second.resolve(noContent());
  expect(await saved).toBe(true);
  expect(JSON.parse(fetch.mock.calls[2]![1]!.body as string)).toEqual({
    [NOTES_STORAGE_KEY]: { entries: { love: null, trust: null } },
  });
});
