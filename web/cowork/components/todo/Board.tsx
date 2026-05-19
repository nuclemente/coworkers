'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Typography, Button, Spin, App } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { Card as TodoCard, Column as TodoColumn } from '@/lib/db/todo';
import ColumnView from './Column';
import CardDialog from './CardDialog';
import { nuPj } from '@/lib/theme/nuds-tokens';

type Props = {
  initialColumns: TodoColumn[];
  initialCards: TodoCard[];
};

export default function Board({ initialColumns, initialCards }: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [isPending, startTransition] = useTransition();
  const [cards, setCards] = useState<TodoCard[]>(initialCards);
  const [isDragging, setIsDragging] = useState(false);

  // Sincroniza estado local quando o servidor envia novos dados (router.refresh).
  // Ignora a primeira renderização para preservar updates otimistas em andamento.
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    setCards(initialCards);
  }, [initialCards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    card?: TodoCard | null;
    defaultColumnSlug: string;
  }>({ open: false, mode: 'create', defaultColumnSlug: 'a-fazer' });

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, TodoCard[]>();
    for (const col of initialColumns) map.set(col.slug, []);
    for (const c of cards) {
      const list = map.get(c.column_slug);
      if (list) list.push(c);
    }
    for (const [, list] of map) list.sort((a, b) => a.position - b.position);
    return map;
  }, [cards, initialColumns]);

  const totalCards = cards.length;
  const doneCards = cards.filter((c) => c.completed_at).length;

  function refresh() {
    startTransition(() => router.refresh());
  }

  function applySaved(saved: TodoCard, mode: 'create' | 'edit') {
    setCards((prev) => {
      if (mode === 'create') return [...prev, saved];
      return prev.map((c) => (c.id === saved.id ? saved : c));
    });
    refresh();
  }

  function applyDeleted(id: number) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    refresh();
  }

  function handleDragStart(_ev: DragStartEvent) {
    setIsDragging(true);
  }

  async function handleDragEnd(ev: DragEndEvent) {
    setIsDragging(false);
    const activeId = String(ev.active.id);
    const overId = ev.over ? String(ev.over.id) : null;
    if (!overId || !activeId.startsWith('card:')) return;

    const cardId = Number(activeId.slice('card:'.length));
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    let targetColumnSlug: string | null = null;
    if (overId.startsWith('col:')) {
      targetColumnSlug = overId.slice('col:'.length);
    } else if (overId.startsWith('card:')) {
      const overCard = cards.find(
        (c) => c.id === Number(overId.slice('card:'.length)),
      );
      targetColumnSlug = overCard?.column_slug ?? null;
    }
    if (!targetColumnSlug || targetColumnSlug === card.column_slug) return;

    const target = targetColumnSlug;
    const targetLabel =
      initialColumns.find((col) => col.slug === target)?.label ?? target;

    setCards((prev) =>
      prev.map((c) =>
        c.id === card.id
          ? { ...c, column_slug: target, column_label: targetLabel }
          : c,
      ),
    );

    const hide = message.loading(`Movendo para "${targetLabel}"...`, 0);
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          column_slug: target,
          completed: target === 'concluido',
        }),
      });
      hide();
      if (!res.ok) {
        message.error('Falha ao mover card.');
        setCards((prev) =>
          prev.map((c) =>
            c.id === card.id
              ? {
                  ...c,
                  column_slug: card.column_slug,
                  column_label: card.column_label,
                }
              : c,
          ),
        );
      } else {
        message.success(`Movido para "${targetLabel}".`);
      }
    } catch {
      hide();
      message.error('Falha de rede ao mover card.');
    }
    refresh();
  }

  return (
    <>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 16,
        }}
      >
        <div>
          <Typography.Title
            level={2}
            style={{ marginTop: 0, marginBottom: 4, color: nuPj.ink }}
          >
            To Do
          </Typography.Title>
          <Typography.Text style={{ color: nuPj.graphite, fontSize: 13 }}>
            {totalCards === 0 ? (
              'Nenhum card ainda — comece criando o primeiro.'
            ) : (
              <>
                <strong style={{ color: nuPj.ink }}>{doneCards}</strong> de{' '}
                <strong style={{ color: nuPj.ink }}>{totalCards}</strong>{' '}
                concluídos
              </>
            )}
          </Typography.Text>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isPending && <Spin size="small" />}
          <Button
            icon={<ReloadOutlined />}
            onClick={refresh}
            loading={isPending}
          >
            Atualizar
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() =>
              setDialog({
                open: true,
                mode: 'create',
                card: null,
                defaultColumnSlug: 'a-fazer',
              })
            }
          >
            Novo card
          </Button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setIsDragging(false)}
      >
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
            overflowX: 'auto',
            paddingBottom: 8,
            cursor: isDragging ? 'grabbing' : 'default',
          }}
        >
          {initialColumns.map((col) => (
            <ColumnView
              key={col.slug}
              column={col}
              cards={cardsByColumn.get(col.slug) ?? []}
              onOpenCard={(c) =>
                setDialog({
                  open: true,
                  mode: 'edit',
                  card: c,
                  defaultColumnSlug: col.slug,
                })
              }
              onAddCard={(slug) =>
                setDialog({
                  open: true,
                  mode: 'create',
                  card: null,
                  defaultColumnSlug: slug,
                })
              }
            />
          ))}
        </div>
      </DndContext>

      <CardDialog
        open={dialog.open}
        mode={dialog.mode}
        card={dialog.card ?? null}
        defaultColumnSlug={dialog.defaultColumnSlug}
        columns={initialColumns}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSaved={applySaved}
        onDeleted={applyDeleted}
      />
    </>
  );
}
