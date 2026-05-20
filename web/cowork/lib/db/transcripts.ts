import 'server-only';
import { getDb } from './client';
import { assertSchemaVersion } from './schema-version';

export type TranscriptDigest = {
  id: number;
  source_type: 'drive' | 'local' | 'gmail';
  source_ref: string;
  content_hash: string;
  version: number;
  meeting_type: 'one_on_one' | 'meeting';
  event_name: string | null;
  meeting_date: string;
  participants: string[];
  markdown_path: string;
  confluence_page_id: string | null;
  slack_message_ts: string | null;
  trigger_source: 'slack' | 'code' | 'cowork';
  status: 'ok' | 'partial' | 'failed';
  error_log: string | null;
  created_at: string;
  cards_count: number;
};

export type TranscriptAction = {
  id: number;
  digest_id: number;
  assignee: string;
  description: string;
  due_date: string | null;
  todo_card_id: number | null;
  created_at: string;
};

export type TranscriptJob = {
  id: number;
  source: 'local' | 'drive' | 'gmail';
  ref: string | null;
  requested_via: 'cowork' | 'code' | 'slack';
  status: 'queued' | 'processing' | 'done' | 'failed' | 'skipped';
  digest_id: number | null;
  error_log: string | null;
  requested_at: string;
  processed_at: string | null;
};

type DigestRow = Omit<TranscriptDigest, 'participants' | 'cards_count'> & {
  participants: string | null;
  cards_count: number;
};

function decodeParticipants(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* ignore */
  }
  return [];
}

function rowToDigest(r: DigestRow): TranscriptDigest {
  return { ...r, participants: decodeParticipants(r.participants) };
}

function transcriptTablesPresent(): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='transcript_digest'`,
    )
    .get() as { name: string } | undefined;
  return Boolean(row);
}

export type ListDigestsOpts = {
  limit?: number;
  personSlug?: string;
  type?: 'one_on_one' | 'meeting';
};

export function listDigests(opts: ListDigestsOpts = {}): TranscriptDigest[] {
  assertSchemaVersion();
  if (!transcriptTablesPresent()) return [];
  const db = getDb();
  const limit = opts.limit ?? 50;
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.type) {
    where.push('d.meeting_type = ?');
    args.push(opts.type);
  }
  if (opts.personSlug) {
    where.push("d.participants LIKE ?");
    args.push(`%"${opts.personSlug}"%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT d.*, COALESCE(c.cards_count, 0) AS cards_count
       FROM transcript_digest d
       LEFT JOIN (
         SELECT digest_id, COUNT(*) AS cards_count
         FROM transcript_action
         WHERE todo_card_id IS NOT NULL
         GROUP BY digest_id
       ) c ON c.digest_id = d.id
       ${whereSql}
       ORDER BY d.meeting_date DESC, d.id DESC
       LIMIT ?`,
    )
    .all(...args, limit) as DigestRow[];
  return rows.map(rowToDigest);
}

export function getDigest(id: number): TranscriptDigest | null {
  assertSchemaVersion();
  if (!transcriptTablesPresent()) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT d.*, COALESCE(c.cards_count, 0) AS cards_count
       FROM transcript_digest d
       LEFT JOIN (
         SELECT digest_id, COUNT(*) AS cards_count
         FROM transcript_action
         WHERE todo_card_id IS NOT NULL
         GROUP BY digest_id
       ) c ON c.digest_id = d.id
       WHERE d.id = ?`,
    )
    .get(id) as DigestRow | undefined;
  return row ? rowToDigest(row) : null;
}

export function listActions(digestId: number): TranscriptAction[] {
  assertSchemaVersion();
  if (!transcriptTablesPresent()) return [];
  const db = getDb();
  return db
    .prepare(
      `SELECT id, digest_id, assignee, description, due_date, todo_card_id, created_at
       FROM transcript_action
       WHERE digest_id = ?
       ORDER BY id`,
    )
    .all(digestId) as TranscriptAction[];
}

export type ListJobsOpts = {
  status?: Array<TranscriptJob['status']>;
  limit?: number;
};

export function listJobs(opts: ListJobsOpts = {}): TranscriptJob[] {
  assertSchemaVersion();
  if (!transcriptTablesPresent()) return [];
  const db = getDb();
  const limit = opts.limit ?? 50;
  const statuses = opts.status;
  if (statuses && statuses.length > 0) {
    const placeholders = statuses.map(() => '?').join(',');
    return db
      .prepare(
        `SELECT * FROM transcript_job
         WHERE status IN (${placeholders})
         ORDER BY requested_at DESC
         LIMIT ?`,
      )
      .all(...statuses, limit) as TranscriptJob[];
  }
  return db
    .prepare(
      `SELECT * FROM transcript_job
       ORDER BY requested_at DESC
       LIMIT ?`,
    )
    .all(limit) as TranscriptJob[];
}

export type JobCreateInput = {
  source: 'local' | 'drive' | 'gmail';
  ref?: string | null;
  requested_via?: TranscriptJob['requested_via'];
};

export function createJob(input: JobCreateInput): TranscriptJob {
  assertSchemaVersion();
  if (!transcriptTablesPresent()) {
    throw new Error(
      'Tabelas de transcript-digest ausentes — execute a skill `transcript-digest` ao menos uma vez para aplicar a migração.',
    );
  }
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO transcript_job (source, ref, requested_via, status)
       VALUES (?, ?, ?, 'queued')`,
    )
    .run(input.source, input.ref ?? null, input.requested_via ?? 'cowork');
  const job = db
    .prepare(`SELECT * FROM transcript_job WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as TranscriptJob | undefined;
  if (!job) throw new Error('Falha ao recarregar job recém-criado.');
  return job;
}
