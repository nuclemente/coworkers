'use client';

import { Typography, Button, Empty } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Card as TodoCard, Column as TodoColumn } from '@/lib/db/todo';
import CardItem from './Card';
import { nuPj } from '@/lib/theme/nuds-tokens';

type Props = {
  column: TodoColumn;
  cards: TodoCard[];
  onOpenCard: (card: TodoCard) => void;
  onAddCard: (columnSlug: string) => void;
};

export default function ColumnView({
  column,
  cards,
  onOpenCard,
  onAddCard,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.slug}` });

  return (
    <section
      style={{
        width: 320,
        flex: '0 0 auto',
        background: isOver ? nuPj.mist : nuPj.fog,
        border: `1px solid ${isOver ? nuPj.lavender : nuPj.hairline}`,
        borderRadius: 14,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 200px)',
        transition: 'background 160ms ease, border-color 160ms ease',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 6px 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography.Text strong style={{ color: nuPj.ink, fontSize: 13 }}>
            {column.label}
          </Typography.Text>
          <span
            style={{
              background: nuPj.surface,
              color: nuPj.graphite,
              borderRadius: 999,
              padding: '1px 8px',
              fontSize: 11,
              border: `1px solid ${nuPj.hairline}`,
              fontWeight: 500,
            }}
          >
            {cards.length}
          </span>
        </div>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onAddCard(column.slug)}
          aria-label={`Adicionar card em ${column.label}`}
          style={{ color: nuPj.graphite }}
        />
      </header>

      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '2px 2px 4px',
        }}
      >
        <SortableContext
          items={cards.map((c) => `card:${c.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((c) => (
            <CardItem key={c.id} card={c} onOpen={onOpenCard} />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            imageStyle={{ height: 36, marginBottom: 8 }}
            description={
              <Typography.Text
                type="secondary"
                style={{ fontSize: 12, color: nuPj.fog2 }}
              >
                Sem cards
              </Typography.Text>
            }
            style={{ margin: '24px 0' }}
          />
        )}
      </div>

      <Button
        type="text"
        block
        icon={<PlusOutlined />}
        onClick={() => onAddCard(column.slug)}
        style={{
          marginTop: 8,
          color: nuPj.graphite,
          justifyContent: 'flex-start',
        }}
      >
        Adicionar card
      </Button>
    </section>
  );
}
