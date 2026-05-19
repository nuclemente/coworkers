'use client';

import { Tag, Typography, Tooltip } from 'antd';
import { CalendarOutlined, UserOutlined } from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card as TodoCard } from '@/lib/db/todo';
import { nuPj } from '@/lib/theme/nuds-tokens';

type Props = {
  card: TodoCard;
  onOpen: (card: TodoCard) => void;
};

function formatDueDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

export default function CardItem({ card, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `card:${card.id}` });

  const overdue =
    card.due_date &&
    !card.completed_at &&
    new Date(card.due_date) < new Date(new Date().toISOString().slice(0, 10));

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    marginBottom: 10,
    cursor: 'grab',
    background: nuPj.surface,
    borderRadius: 10,
    padding: '12px 14px',
    border: `1px solid ${nuPj.hairline}`,
    boxShadow: isDragging
      ? '0 8px 24px rgba(82, 0, 170, 0.18)'
      : '0 1px 2px rgba(25, 25, 25, 0.04)',
    transitionProperty: 'box-shadow, transform, opacity',
    transitionDuration: '160ms',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card)}
      onMouseEnter={(e) => {
        if (!isDragging)
          e.currentTarget.style.boxShadow =
            '0 4px 12px rgba(82, 0, 170, 0.08)';
      }}
      onMouseLeave={(e) => {
        if (!isDragging)
          e.currentTarget.style.boxShadow =
            '0 1px 2px rgba(25, 25, 25, 0.04)';
      }}
    >
      <Typography.Text
        style={{
          fontWeight: 500,
          color: nuPj.ink,
          display: 'block',
          lineHeight: 1.4,
        }}
      >
        {card.title}
      </Typography.Text>

      {card.labels && card.labels.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {card.labels.map((l) => (
            <Tag
              key={l}
              style={{
                background: nuPj.mist,
                color: nuPj.deep,
                border: 'none',
                borderRadius: 6,
                fontSize: 11,
                margin: 0,
                padding: '1px 8px',
              }}
            >
              {l}
            </Tag>
          ))}
        </div>
      )}

      {(card.due_date || card.linked_person) && (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 11,
            color: nuPj.fog2,
          }}
        >
          {card.due_date && (
            <Tooltip title={overdue ? 'Atrasado' : 'Data limite'}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: overdue ? nuPj.danger : nuPj.fog2,
                  fontWeight: overdue ? 500 : 400,
                }}
              >
                <CalendarOutlined />
                {formatDueDate(card.due_date)}
              </span>
            </Tooltip>
          )}
          {card.linked_person && (
            <Tooltip title="Pessoa vinculada">
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <UserOutlined />
                {card.linked_person}
              </span>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
