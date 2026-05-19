import 'server-only';
import { getDb } from './client';

/**
 * Versão de schema esperada por este build do Cowork Dashboard.
 * Bump apenas após a skill `todo` (Coworker) publicar nova migração.
 */
export const EXPECTED_SCHEMA_VERSION = 1;

export class SchemaMismatchError extends Error {
  expected: number;
  found: number;
  constructor(expected: number, found: number) {
    super(
      `Schema v${expected} esperado, v${found} encontrado — ` +
        `atualize o Cowork Dashboard ou rode feature-implement para migrar.`,
    );
    this.name = 'SchemaMismatchError';
    this.expected = expected;
    this.found = found;
  }
}

export function currentSchemaVersion(): number {
  const db = getDb();
  const row = db
    .prepare('SELECT version FROM _schema_meta ORDER BY version DESC LIMIT 1')
    .get() as { version: number } | undefined;
  return row?.version ?? 0;
}

/**
 * Fail-fast: chame no início de cada request server-side (RSC ou route handler).
 * Não cacheia — leitura é O(1) no índice de _schema_meta.
 */
export function assertSchemaVersion(): void {
  const found = currentSchemaVersion();
  if (found !== EXPECTED_SCHEMA_VERSION) {
    throw new SchemaMismatchError(EXPECTED_SCHEMA_VERSION, found);
  }
}
