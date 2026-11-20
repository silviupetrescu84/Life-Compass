import { mkdtempSync, rmSync } from 'node:fs';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { createApi } from '../../server/api';
import { openDatabase } from '../../server/database';
import {
  CORE_STORAGE_KEY,
  NOTES_STORAGE_KEY,
  SELECTION_STORAGE_KEY,
  type AccountSession,
} from '../../src/shared/compass-data';
import { PASSWORD_REQUIREMENTS } from '../../src/shared/password';

const origin = 'https://compass.example.test';
const first = { email: 'First@example.test', password: 'Compass!' };
const second = { email: 'second@example.test', password: 'Another password!' };
const note = {
  definition: 'Keeping small promises',
  reflection: 'Listen first.',
  rating: 5,
  actions: [{ text: 'Make time to talk', done: true }],
};
const selected = JSON.stringify(['love', 'trust', 'kindness', 'patience', 'honesty', 'courage']);

async function request(
  api: ReturnType<typeof createApi>,
  method: string,
  url: string,
  options: { body?: unknown; cookie?: string; accountId?: number; origin?: string } = {},
) {
  const req = new IncomingMessage(new Socket());
  req.url = url;
  req.method = method;
  req.headers = {
    host: 'compass.example.test',
    origin: options.origin ?? origin,
    cookie: options.cookie,
    'content-type': 'application/json',
    'x-life-compass-account': options.accountId?.toString(),
  };
  if (options.body) req.push(Buffer.from(JSON.stringify(options.body)));
  req.push(null);
  const res = new ServerResponse(req);
  const end = vi.spyOn(res, 'end');
  await api.handle(req, res);
  const rawCookie = res.getHeader('set-cookie') as string | undefined;
  const body = end.mock.calls[0]?.[0] as string | undefined;
  return {
    status: res.statusCode,
    rawCookie,
    cookie: rawCookie?.split(';')[0],
    body: body ? (JSON.parse(body) as unknown) : null,
  };
}

test('rejects invalid signup passwords and accepts a password saved before the new requirements', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'life-compass-test-'));
  const filename = join(directory, 'account.sqlite');
  const legacy = { email: 'legacy@example.test', password: 'old password' };
  const db = openDatabase(filename);
  const api = createApi(filename, origin);
  try {
    await db.createAccount(legacy.email, legacy.password);
    for (const password of ['Abcdef!', 'abcdefg!', 'Abcdefg ', 'A!' + 'b'.repeat(127)]) {
      const response = await request(api, 'POST', '/api/signup', { body: { ...first, password } });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: PASSWORD_REQUIREMENTS });
    }
    expect((await request(api, 'POST', '/api/login', { body: legacy })).status).toBe(200);
  } finally {
    api.close();
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('requires authentication, scopes saved data to its account, and revokes the session on logout', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'life-compass-test-'));
  const filename = join(dir, 'account.sqlite');
  let api = createApi(filename, origin);
  try {
    expect((await request(api, 'GET', '/api/session')).body).toBeNull();
    expect((await request(api, 'PUT', '/api/compass', { body: {} })).status).toBe(401);

    const selection = { [SELECTION_STORAGE_KEY]: selected, [CORE_STORAGE_KEY]: selected };
    const signedUp = await request(api, 'POST', '/api/signup', { body: { ...first, data: selection } });
    expect(signedUp.status).toBe(201);
    expect(signedUp.body).toMatchObject({ data: {} });
    expect(signedUp.rawCookie).toContain('HttpOnly; SameSite=Lax');
    expect(signedUp.rawCookie).toContain('; Secure');
    const firstSession = { cookie: signedUp.cookie, accountId: (signedUp.body as AccountSession).accountId };
    expect((signedUp.body as AccountSession).email).toBe(first.email.toLowerCase());
    expect((await request(api, 'POST', '/api/login', { body: { ...first, password: 'wrong password' } })).status).toBe(
      401,
    );
    expect((await request(api, 'POST', '/api/signup', { body: first })).status).toBe(409);
    const another = await request(api, 'POST', '/api/signup', { body: second });
    const secondSession = { cookie: another.cookie, accountId: (another.body as AccountSession).accountId };
    expect(another.status).toBe(201);

    const update = { ...selection, [NOTES_STORAGE_KEY]: { entries: { love: note } } };
    expect(
      (
        await request(api, 'PUT', '/api/compass', {
          ...firstSession,
          accountId: secondSession.accountId,
          body: update,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(api, 'PUT', '/api/compass', {
          ...firstSession,
          origin: 'https://different.example.test',
          body: update,
        })
      ).status,
    ).toBe(403);
    expect((await request(api, 'PUT', '/api/compass', { ...firstSession, body: update })).status).toBe(204);
    expect(
      (
        await request(api, 'PUT', '/api/compass', {
          ...firstSession,
          body: { [NOTES_STORAGE_KEY]: { entries: { trust: { ...note, rating: 2 } } } },
        })
      ).status,
    ).toBe(204);
    expect((await request(api, 'GET', '/api/session', secondSession)).body).toMatchObject({ data: {} });

    api.close();
    api = createApi(filename, origin);
    const restored = (await request(api, 'GET', '/api/session', firstSession)).body as AccountSession;
    expect(restored.data[SELECTION_STORAGE_KEY]).toBe(selected);
    expect(restored.data[CORE_STORAGE_KEY]).toBe(selected);
    expect(JSON.parse(restored.data[NOTES_STORAGE_KEY]!)).toEqual({ love: note, trust: { ...note, rating: 2 } });

    const logout = await request(api, 'POST', '/api/logout', firstSession);
    expect(logout.status).toBe(204);
    expect(logout.rawCookie).toContain('Max-Age=0');
    expect((await request(api, 'GET', '/api/session', firstSession)).body).toBeNull();
    expect((await request(api, 'PUT', '/api/compass', { ...firstSession, body: update })).status).toBe(401);

    const login = await request(api, 'POST', '/api/login', { body: first });
    expect(login.status).toBe(200);
    expect(login.body).toEqual(restored);
    const loginSession = { ...firstSession, cookie: login.cookie };
    expect(
      (
        await request(api, 'PUT', '/api/compass', {
          ...loginSession,
          body: { [NOTES_STORAGE_KEY]: { entries: { trust: null } } },
        })
      ).status,
    ).toBe(204);
    const afterDeletion = (await request(api, 'GET', '/api/session', loginSession)).body as AccountSession;
    expect(JSON.parse(afterDeletion.data[NOTES_STORAGE_KEY]!)).toEqual({ love: note });

    expect(
      (
        await request(api, 'PUT', '/api/compass', {
          ...loginSession,
          body: {
            [SELECTION_STORAGE_KEY]: null,
            [CORE_STORAGE_KEY]: null,
            [NOTES_STORAGE_KEY]: { clear: true, entries: {} },
          },
        })
      ).status,
    ).toBe(204);
    expect((await request(api, 'GET', '/api/session', loginSession)).body).toMatchObject({ data: {} });
  } finally {
    api.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
