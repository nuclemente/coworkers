import { NextResponse } from 'next/server';
import { listCards, createCard } from '@/lib/db/todo';
import { cardCreateSchema } from '@/lib/validation/cards';
import { SchemaMismatchError } from '@/lib/db/schema-version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const includeDone = url.searchParams.get('include_done') === 'true';
    const cards = listCards({ includeDone });
    return NextResponse.json({ cards });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = cardCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const card = createCard({
      ...parsed.data,
      source: parsed.data.source ?? 'manual_slack',
    });
    return NextResponse.json({ card }, { status: 201 });
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
