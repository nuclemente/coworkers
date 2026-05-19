import { NextResponse } from 'next/server';
import { listColumns } from '@/lib/db/todo';
import { SchemaMismatchError } from '@/lib/db/schema-version';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ columns: listColumns() });
  } catch (err) {
    if (err instanceof SchemaMismatchError) {
      return NextResponse.json(
        { error: 'schema_mismatch', message: err.message },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'internal', message: msg }, { status: 500 });
  }
}
