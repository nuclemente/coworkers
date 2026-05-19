import { NextResponse } from 'next/server';
import { getCard, updateCard, deleteCard } from '@/lib/db/todo';
import { cardUpdateSchema } from '@/lib/validation/cards';
import { SchemaMismatchError } from '@/lib/db/schema-version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
    const card = getCard(id);
    if (!card) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ card });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
    const body = await req.json();
    const parsed = cardUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const card = updateCard(id, parsed.data);
    return NextResponse.json({ card });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
    deleteCard(id);
    return NextResponse.json({ ok: true });
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
  const status = msg.includes('inexistente') ? 404 : 500;
  return NextResponse.json({ error: 'internal', message: msg }, { status });
}
