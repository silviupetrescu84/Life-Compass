import { createHash, randomBytes, scrypt } from 'node:crypto';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { NOTES_STORAGE_KEY } from '../src/shared/compass-data.ts';
import type { AccountSession, CompassChanges, CompassData } from '../src/shared/compass-data.ts';

export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export function passwordDigest(password: string, salt: Uint8Array): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 65536, r: 8, p: 2, maxmem: 72 * 1024 * 1024 }, (error, digest) => {
      if (error) reject(error);
      else resolve(digest);
    });
  });
}
const tokenDigest = (token: string) => createHash('sha256').update(token).digest('hex');

export function openDatabase(filename: string) {
  if (filename !== ':memory:') {
    mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    closeSync(openSync(filename, 'a', 0o600));
  }
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      salt BLOB NOT NULL,
      password_hash BLOB NOT NULL,
      compass_data TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(compass_data))
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  `);

  const insertAccount = db.prepare(
    'INSERT INTO accounts (email, salt, password_hash) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING',
  );
  const accountByEmail = db.prepare('SELECT id, salt, password_hash FROM accounts WHERE email = ?');
  const accountById = db.prepare('SELECT email, compass_data FROM accounts WHERE id = ?');
  const sessionByToken = db.prepare('SELECT account_id FROM sessions WHERE token_hash = ? AND expires_at > ?');
  const insertSession = db.prepare('INSERT INTO sessions VALUES (?, ?, ?)');
  const expireSessions = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const saveData = db.prepare(`
    UPDATE accounts
    SET compass_data = json_patch(
      CASE WHEN ? THEN json_remove(compass_data, '$."${NOTES_STORAGE_KEY}"') ELSE compass_data END,
      ?
    )
    WHERE id = ?
  `);

  return {
    async createAccount(email: string, password: string): Promise<number | undefined> {
      const salt = randomBytes(16);
      const digest = await passwordDigest(password, salt);
      const result = insertAccount.run(email, salt, digest);
      if (result.changes) return Number(result.lastInsertRowid);
    },
    findCredentials(email: string) {
      return accountByEmail.get(email) as { id: number; salt: Uint8Array; password_hash: Uint8Array } | undefined;
    },
    issueSession(accountId: number, previousToken: string): string {
      const token = randomBytes(32).toString('hex');
      const now = Date.now();
      expireSessions.run(now);
      deleteSession.run(tokenDigest(previousToken));
      insertSession.run(tokenDigest(token), accountId, now + SESSION_SECONDS * 1000);
      return token;
    },
    sessionAccountId(token: string): number | undefined {
      if (!token) return;
      const row = sessionByToken.get(tokenDigest(token), Date.now()) as { account_id: number } | undefined;
      return row?.account_id;
    },
    getAccount(accountId: number): AccountSession {
      const row = accountById.get(accountId) as { email: string; compass_data: string };
      const { [NOTES_STORAGE_KEY]: notes, ...selection } = JSON.parse(row.compass_data) as Omit<
        CompassData,
        typeof NOTES_STORAGE_KEY
      > & { [NOTES_STORAGE_KEY]?: Record<string, unknown> };
      const data: CompassData = selection;
      if (notes) data[NOTES_STORAGE_KEY] = JSON.stringify(notes);
      return { accountId, email: row.email, data };
    },
    endSession(token: string): void {
      deleteSession.run(tokenDigest(token));
    },
    save(accountId: number, changes: CompassChanges): void {
      const { [NOTES_STORAGE_KEY]: notes, ...selection } = changes;
      const patch =
        notes && Object.keys(notes.entries).length ? { ...selection, [NOTES_STORAGE_KEY]: notes.entries } : selection;
      saveData.run(Number(notes?.clear === true), JSON.stringify(patch), accountId);
    },
    close: () => db.close(),
  };
}
