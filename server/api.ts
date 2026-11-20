import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { isValueId } from '../src/features/values/values.data.ts';
import { toNote } from '../src/features/values/values.notes.ts';
import { CORE_STORAGE_KEY, NOTES_STORAGE_KEY, SELECTION_STORAGE_KEY } from '../src/shared/compass-data.ts';
import type { CompassChanges, SelectionChanges } from '../src/shared/compass-data.ts';
import { isValidSignupPassword, PASSWORD_REQUIREMENTS } from '../src/shared/password.ts';
import { openDatabase, passwordDigest, SESSION_SECONDS } from './database.ts';

const COOKIE_NAME = 'life_compass_session';
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const ATTEMPT_WINDOW = 60_000;
const MAX_AUTH_ATTEMPTS = 15;

class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError(400, 'Invalid request.');
  return value as Record<string, unknown>;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new RequestError(415, 'Expected JSON.');
  }
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false }) as AsyncIterable<Buffer>) {
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw new RequestError(413, 'The saved data is too large.');
    chunks.push(chunk);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new RequestError(400, 'Invalid JSON.');
  }
  return record(value);
}

function selectionChanges(data: Record<string, unknown>): SelectionChanges {
  const changes: SelectionChanges = {};
  for (const key of [SELECTION_STORAGE_KEY, CORE_STORAGE_KEY] as const) {
    const value = data[key];
    if (value === undefined) continue;
    if (value === null) {
      changes[key] = null;
      continue;
    }
    if (typeof value !== 'string') throw new RequestError(400, 'Invalid compass data.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new RequestError(400, 'Invalid compass data.');
    }
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
      throw new RequestError(400, 'Invalid values selection.');
    }
    changes[key] = JSON.stringify([...new Set(parsed.filter(isValueId))]);
  }
  return changes;
}

function noteEntries(input: unknown): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record(input))
      .filter(([id]) => isValueId(id))
      .map(([id, note]) => [id, note === null ? null : toNote(note)]),
  );
}

function sessionToken(req: IncomingMessage): string {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(COOKIE_NAME + '='));
  const token = cookie?.slice(COOKIE_NAME.length + 1) ?? '';
  return /^[a-f0-9]{64}$/.test(token) ? token : '';
}

function sessionCookie(res: ServerResponse, token: string, secure: boolean): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_SECONDS : 0}${secure ? '; Secure' : ''}`,
  );
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(value));
}

export function createApi(
  filename = process.env.LIFE_COMPASS_DB ?? fileURLToPath(new URL('../data/life-compass.sqlite', import.meta.url)),
  appOrigin = process.env.APP_ORIGIN,
) {
  const db = openDatabase(filename);
  const attempts = new Map<string, { count: number; expires: number }>();

  function limitAuth(req: IncomingMessage): void {
    const now = Date.now();
    for (const [key, attempt] of attempts) if (attempt.expires <= now) attempts.delete(key);
    const key = req.socket.remoteAddress ?? 'unknown';
    const attempt = attempts.get(key) ?? { count: 0, expires: now + ATTEMPT_WINDOW };
    if (attempt.count >= MAX_AUTH_ATTEMPTS) throw new RequestError(429, 'Too many attempts. Try again in a minute.');
    attempt.count++;
    attempts.set(key, attempt);
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const route = `${req.method} ${req.url?.split('?')[0]}`;
    const origin = appOrigin ?? `http://${req.headers.host}`;
    const secure = origin.startsWith('https://');
    const token = sessionToken(req);
    function requireAccount(): number {
      const id = db.sessionAccountId(token);
      if (id === undefined || String(id) !== req.headers['x-life-compass-account']) {
        throw new RequestError(401, 'Your session ended. Reload to sign in again.');
      }
      return id;
    }

    try {
      if (req.method !== 'GET' && req.headers.origin !== origin) {
        throw new RequestError(403, 'This request must come from Life Compass.');
      }
      if (route === 'GET /api/session') {
        const id = db.sessionAccountId(token);
        sendJson(res, 200, id === undefined ? null : db.getAccount(id));
        return;
      }
      if (route === 'POST /api/signup' || route === 'POST /api/login') {
        const creating = route === 'POST /api/signup';
        limitAuth(req);
        const body = await readJson(req);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const { password } = body;
        if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z0-9-]+$/.test(email)) {
          throw new RequestError(400, 'Enter a valid email address.');
        }
        if (
          typeof password !== 'string' ||
          (creating ? !isValidSignupPassword(password) : password.length < 8 || password.length > 128)
        ) {
          throw new RequestError(
            400,
            creating ? PASSWORD_REQUIREMENTS : 'Enter a password between 8 and 128 characters.',
          );
        }

        let accountId: number;
        if (creating) {
          const id = await db.createAccount(email, password);
          if (id === undefined)
            throw new RequestError(409, 'An account already exists for this email. Sign in instead.');
          accountId = id;
        } else {
          const credentials = db.findCredentials(email);
          const digest = await passwordDigest(password, credentials?.salt ?? Buffer.alloc(16));
          if (!credentials || !timingSafeEqual(digest, credentials.password_hash)) {
            throw new RequestError(401, 'Email or password is incorrect.');
          }
          accountId = credentials.id;
        }
        const nextToken = db.issueSession(accountId, token);
        sessionCookie(res, nextToken, secure);
        sendJson(res, creating ? 201 : 200, db.getAccount(accountId));
        return;
      }
      if (route === 'PUT /api/compass') {
        requireAccount();
        const body = await readJson(req);
        const changes: CompassChanges = selectionChanges(body);
        if (body[NOTES_STORAGE_KEY] !== undefined) {
          const notes = record(body[NOTES_STORAGE_KEY]);
          changes[NOTES_STORAGE_KEY] = { clear: notes.clear === true, entries: noteEntries(notes.entries) };
        }
        // A concurrent logout may have revoked access while the request body was arriving.
        db.save(requireAccount(), changes);
        res.writeHead(204).end();
        return;
      }
      if (route === 'POST /api/logout') {
        const id = db.sessionAccountId(token);
        if (id !== undefined && String(id) !== req.headers['x-life-compass-account']) {
          throw new RequestError(401, 'Your account changed in another tab. Reload this page.');
        }
        db.endSession(token);
        sessionCookie(res, '', secure);
        res.writeHead(204).end();
        return;
      }
      throw new RequestError(404, 'Page not found.');
    } catch (error) {
      req.resume();
      if (error instanceof RequestError) sendJson(res, error.status, { error: error.message });
      else {
        console.error(error);
        sendJson(res, 500, { error: 'Life Compass could not complete the request. Try again.' });
      }
    }
  }

  return { handle, close: db.close };
}
