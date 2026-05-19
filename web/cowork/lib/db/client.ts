import 'server-only';
import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

declare global {
  // eslint-disable-next-line no-var
  var __coworkDb: Database.Database | undefined;
}

function resolveDbPath(): string {
  const override = process.env.COWORK_DB_PATH;
  if (override && override.trim()) {
    return path.resolve(process.cwd(), override.trim());
  }
  // Default: ../../data/coworker.db relativo a web/cowork/
  return path.resolve(process.cwd(), '..', '..', 'data', 'coworker.db');
}

function open(): Database.Database {
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Cowork DB não encontrado em ${dbPath}. ` +
        `Rode python3 .claude/skills/todo/scripts/migrate.py antes de iniciar o dashboard.`,
    );
  }
  const db = new Database(dbPath, { fileMustExist: true });
  // Decisão de Rodada 7: SQLite SEM WAL.
  db.pragma('journal_mode = DELETE');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 2000');
  return db;
}

export function getDb(): Database.Database {
  if (!global.__coworkDb) {
    global.__coworkDb = open();
  }
  return global.__coworkDb;
}

export function dbPath(): string {
  return resolveDbPath();
}
