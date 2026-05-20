import { NextResponse } from 'next/server';
import { listJobs, createJob } from '@/lib/db/transcripts';
import { transcriptJobCreateSchema } from '@/lib/validation/transcripts';
import { SchemaMismatchError } from '@/lib/db/schema-version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status');
    const statuses = statusParam
      ? (statusParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean) as Array<
          'queued' | 'processing' | 'done' | 'failed' | 'skipped'
        >)
      : undefined;
    const jobs = listJobs({ status: statuses });
    return NextResponse.json({ jobs });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = transcriptJobCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const job = createJob({
      source: parsed.data.source,
      ref: parsed.data.ref ?? null,
      requested_via: 'cowork',
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
  if (err instanceof SchemaMismatchError) {
    return NextResponse.json(
      { error: 'schema_mismatch', message: err.message },
      { status: 503 },
    );
  }
  const msg = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: 'internal', message: msg }, { status: 500 });
}
