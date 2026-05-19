import 'server-only';
import { getDb } from './client';
import { assertSchemaVersion } from './schema-version';

export type Column = {
  id: number;
  slug: string;
  label: string;
  position: number;
};

export type Card = {
  id: number;
  title: string;
  column_id: number;
  column_slug: string;
  column_label: string;
  position: number;
  description: string | null;
  labels: string[];
  due_date: string | null;
  source: 'manual_slack' | 'manual_cli' | 'one_on_one' | 'transcript';
  linked_person: string | null;
  context: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type CardRow = Omit<Card, 'labels' | 'column_slug' | 'column_label'> & {
  labels: string | null;
  column_slug: string;
  column_label: string;
};

function decodeLabels(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* ignore */
  }
  return [];
}

function encodeLabels(labels: string[] | undefined | null): string | null {
  if (!labels || labels.length === 0) return null;
  return JSON.stringify(labels);
}

function rowToCard(r: CardRow): Card {
  return { ...r, labels: decodeLabels(r.labels) };
}

export function listColumns(): Column[] {
  assertSchemaVersion();
  const db = getDb();
  return db
    .prepare('SELECT id, slug, label, position FROM todo_column ORDER BY position')
    .all() as Column[];
}

export function listCards(opts: { includeDone?: boolean } = {}): Card[] {
  assertSchemaVersion();
  const db = getDb();
  const where = opts.includeDone ? '' : 'WHERE c.completed_at IS NULL';
  const rows = db
    .prepare(
      `SELECT c.*, col.slug AS column_slug, col.label AS column_label
       FROM todo_card c
       JOIN todo_column col ON col.id = c.column_id
       ${where}
       ORDER BY col.position, c.position, c.id`,
    )
    .all() as CardRow[];
  return rows.map(rowToCard);
}

export function getCard(id: number): Card | null {
  assertSchemaVersion();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT c.*, col.slug AS column_slug, col.label AS column_label
       FROM todo_card c
       JOIN todo_column col ON col.id = c.column_id
       WHERE c.id = ?`,
    )
    .get(id) as CardRow | undefined;
  return row ? rowToCard(row) : null;
}

function columnIdBySlug(slug: string): number {
  const db = getDb();
  const row = db
    .prepare('SELECT id FROM todo_column WHERE slug = ?')
    .get(slug) as { id: number } | undefined;
  if (!row) throw new Error(`Coluna inexistente: ${slug}`);
  return row.id;
}

function nextPosition(columnId: number): number {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM todo_card WHERE column_id = ?',
    )
    .get(columnId) as { next: number };
  return row.next;
}

export type CardCreateInput = {
  title: string;
  column_slug?: string;
  description?: string | null;
  labels?: string[] | null;
  due_date?: string | null;
  linked_person?: string | null;
  context?: string | null;
  source?: Card['source'];
};

export function createCard(input: CardCreateInput): Card {
  assertSchemaVersion();
  const db = getDb();
  const slug = input.column_slug ?? 'a-fazer';
  const trx = db.transaction((data: CardCreateInput) => {
    const columnId = columnIdBySlug(slug);
    const position = nextPosition(columnId);
    const info = db
      .prepare(
        `INSERT INTO todo_card
          (title, column_id, position, description, labels, due_date,
           source, linked_person, context)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.title.trim(),
        columnId,
        position,
        data.description ?? null,
        encodeLabels(data.labels ?? null),
        data.due_date ?? null,
        data.source ?? 'manual_slack',
        data.linked_person ?? null,
        data.context ?? null,
      );
    return Number(info.lastInsertRowid);
  });
  db.exec('BEGIN IMMEDIATE');
  let newId: number;
  try {
    newId = trx(input);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  const card = getCard(newId);
  if (!card) throw new Error('Falha ao recarregar card recém-criado.');
  return card;
}

export type CardUpdateInput = {
  title?: string;
  description?: string | null;
  labels?: string[] | null;
  due_date?: string | null;
  linked_person?: string | null;
  context?: string | null;
  column_slug?: string;
  position?: number;
  completed?: boolean;
};

export function updateCard(id: number, input: CardUpdateInput): Card {
  assertSchemaVersion();
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db
      .prepare('SELECT id FROM todo_card WHERE id = ?')
      .get(id) as { id: number } | undefined;
    if (!existing) throw new Error(`Card #${id} inexistente.`);

    const sets: string[] = [];
    const args: unknown[] = [];

    if (input.title !== undefined) {
      sets.push('title = ?');
      args.push(input.title);
    }
    if (input.description !== undefined) {
      sets.push('description = ?');
      args.push(input.description);
    }
    if (input.labels !== undefined) {
      sets.push('labels = ?');
      args.push(encodeLabels(input.labels));
    }
    if (input.due_date !== undefined) {
      sets.push('due_date = ?');
      args.push(input.due_date);
    }
    if (input.linked_person !== undefined) {
      sets.push('linked_person = ?');
      args.push(input.linked_person);
    }
    if (input.context !== undefined) {
      sets.push('context = ?');
      args.push(input.context);
    }
    if (input.column_slug !== undefined) {
      const colId = columnIdBySlug(input.column_slug);
      sets.push('column_id = ?');
      args.push(colId);
      const pos = input.position ?? nextPosition(colId);
      sets.push('position = ?');
      args.push(pos);
    } else if (input.position !== undefined) {
      sets.push('position = ?');
      args.push(input.position);
    }
    if (input.completed !== undefined) {
      if (input.completed) {
        const doneId = columnIdBySlug('concluido');
        sets.push('completed_at = datetime(\'now\')');
        if (input.column_slug === undefined) {
          sets.push('column_id = ?');
          args.push(doneId);
          sets.push('position = ?');
          args.push(nextPosition(doneId));
        }
      } else {
        sets.push('completed_at = NULL');
      }
    }

    if (sets.length === 0) throw new Error('Nada a atualizar.');
    args.push(id);
    db.prepare(`UPDATE todo_card SET ${sets.join(', ')} WHERE id = ?`).run(
      ...args,
    );
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  const card = getCard(id);
  if (!card) throw new Error(`Card #${id} sumiu após update.`);
  return card;
}

export function deleteCard(id: number): void {
  assertSchemaVersion();
  const db = getDb();
  const info = db.prepare('DELETE FROM todo_card WHERE id = ?').run(id);
  if (info.changes === 0) throw new Error(`Card #${id} inexistente.`);
}
