'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Popconfirm,
  Divider,
  Typography,
  App,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import type { Card as TodoCard, Column as TodoColumn } from '@/lib/db/todo';

type FormValues = {
  title: string;
  column_slug: string;
  description?: string;
  labels?: string[];
  due_date?: Dayjs | null;
  linked_person?: string;
  context?: string;
  completed?: boolean;
};

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  card?: TodoCard | null;
  defaultColumnSlug: string;
  columns: TodoColumn[];
  onClose: () => void;
  onSaved: (saved: TodoCard, mode: 'create' | 'edit') => void;
  onDeleted: (id: number) => void;
};

export default function CardDialog({
  open,
  mode,
  card,
  defaultColumnSlug,
  columns,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initialValues = useMemo<FormValues>(() => {
    if (mode === 'edit' && card) {
      return {
        title: card.title,
        column_slug: card.column_slug,
        description: card.description ?? undefined,
        labels: card.labels,
        due_date: card.due_date ? dayjs(card.due_date) : null,
        linked_person: card.linked_person ?? undefined,
        context: card.context ?? undefined,
        completed: !!card.completed_at,
      };
    }
    return {
      title: '',
      column_slug: defaultColumnSlug,
      labels: [],
      due_date: null,
    };
  }, [mode, card, defaultColumnSlug]);

  useEffect(() => {
    if (open) form.setFieldsValue(initialValues);
  }, [open, initialValues, form]);

  async function handleSubmit() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const payload = {
      title: values.title,
      column_slug: values.column_slug,
      description: values.description ?? null,
      labels: values.labels ?? [],
      due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null,
      linked_person: values.linked_person ?? null,
      context: values.context ?? null,
      ...(mode === 'edit' ? { completed: values.completed ?? false } : {}),
    };
    const url = mode === 'create' ? '/api/cards' : `/api/cards/${card!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    setSaving(true);
    const hide = message.loading(
      mode === 'create' ? 'Criando card...' : 'Salvando alterações...',
      0,
    );
    try {
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      hide();
      if (!res.ok) {
        const err = await res.text();
        message.error(`Erro ao salvar: ${err}`);
        return;
      }
      const data = (await res.json()) as { card: TodoCard };
      message.success(mode === 'create' ? 'Card criado.' : 'Card atualizado.');
      onSaved(data.card, mode);
      onClose();
    } catch (e) {
      hide();
      message.error('Falha de rede ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!card) return;
    setDeleting(true);
    const hide = message.loading('Removendo card...', 0);
    try {
      const res = await fetch(`/api/cards/${card.id}`, { method: 'DELETE' });
      hide();
      if (!res.ok) {
        message.error('Erro ao remover card.');
        return;
      }
      message.success('Card removido.');
      onDeleted(card.id);
      onClose();
    } catch {
      hide();
      message.error('Falha de rede ao remover.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      destroyOnClose
      title={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography.Text strong style={{ fontSize: 15 }}>
            {mode === 'create' ? 'Novo card' : `Editar card #${card?.id ?? ''}`}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {mode === 'create'
              ? 'Adicione um item à lista'
              : 'Atualize informações ou remova permanentemente'}
          </Typography.Text>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {mode === 'edit' && (
              <Popconfirm
                title="Remover permanentemente?"
                description="Esta ação não pode ser desfeita."
                okText="Remover"
                okType="danger"
                cancelText="Cancelar"
                onConfirm={handleDelete}
              >
                <Button danger loading={deleting} disabled={saving}>
                  Remover
                </Button>
              </Popconfirm>
            )}
          </div>
          <Space>
            <Button onClick={onClose} disabled={saving || deleting}>
              Cancelar
            </Button>
            <Button type="primary" loading={saving} onClick={handleSubmit}>
              {mode === 'create' ? 'Criar' : 'Salvar'}
            </Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical" initialValues={initialValues}>
        <Form.Item
          name="title"
          label="Título"
          rules={[{ required: true, message: 'Informe um título.' }]}
        >
          <Input maxLength={280} placeholder="Ex.: Revisar PDI da Ana" />
        </Form.Item>

        <Space.Compact block>
          <Form.Item
            name="column_slug"
            label="Coluna"
            rules={[{ required: true }]}
            style={{ flex: 1, marginRight: 12 }}
          >
            <Select
              options={columns.map((c) => ({ value: c.slug, label: c.label }))}
            />
          </Form.Item>
          <Form.Item name="due_date" label="Data limite" style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
        </Space.Compact>

        <Form.Item name="labels" label="Tags">
          <Select
            mode="tags"
            tokenSeparators={[',']}
            placeholder="Pressione Enter para criar"
          />
        </Form.Item>
        <Form.Item name="linked_person" label="Pessoa vinculada (slug)">
          <Input placeholder="ex.: ana-silva" />
        </Form.Item>

        <Divider style={{ margin: '8px 0 16px' }} />

        <Form.Item name="description" label="Descrição">
          <Input.TextArea
            rows={4}
            maxLength={4000}
            showCount
            placeholder="Detalhes do que precisa ser feito"
          />
        </Form.Item>
        <Form.Item name="context" label="Contexto">
          <Input.TextArea
            rows={2}
            maxLength={2000}
            placeholder="Origem, link, situação relacionada..."
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
