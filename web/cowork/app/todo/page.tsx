import { listColumns, listCards } from '@/lib/db/todo';
import Board from '@/components/todo/Board';

export const dynamic = 'force-dynamic';

export default function TodoPage() {
  const columns = listColumns();
  const cards = listCards({ includeDone: true });
  return <Board initialColumns={columns} initialCards={cards} />;
}
