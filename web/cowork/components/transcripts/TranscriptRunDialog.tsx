'use client';

import { useState } from 'react';
import { Modal, Form, Select, Input, App, Typography } from 'antd';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const SOURCE_OPTIONS = [
  { value: 'local', label: 'Local (path no filesystem)' },
  { value: 'drive', label: 'Google Drive (file_id ou URL)' },
  { value: 'gmail', label: 'Gmail (message_id ou varredura)' },
];

const REF_LABEL: Record<string, string> = {
  local: 'Path',
  drive: 'File ID ou URL',
  gmail: 'Message ID (deixe vazio para varrer não-processados)',
};

type FormValues = {
  source: 'local' | 'drive' | 'gmail';
  ref?: string;
};

export default function TranscriptRunDialog({ open, onClose, onCreated }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const source = Form.useWatch('source', form);
  const refRequired = source === 'local' || source === 'drive';

  async function handleOk() {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await fetch('/api/transcript-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: values.source,
          ref: values.ref?.trim() || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        message.error(payload.message || `Falha ao criar job (${res.status}).`);
        return;
      }
      form.resetFields();
      onCreated();
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return; // validation; antd já marca os campos
      }
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    form.resetFields();
    onClose();
  }

  return (
    <Modal
      title="Novo digest de transcrição"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Enfileirar"
      cancelText="Cancelar"
      confirmLoading={submitting}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        O job entra na fila como <code>queued</code>. A skill{' '}
        <code>transcript-digest</code> drena a fila quando invocada com{' '}
        <code>source=queue</code>.
      </Typography.Paragraph>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ source: 'local' }}
        requiredMark="optional"
      >
        <Form.Item
          label="Fonte"
          name="source"
          rules={[{ required: true, message: 'Selecione a fonte.' }]}
        >
          <Select options={SOURCE_OPTIONS} />
        </Form.Item>
        <Form.Item
          label={REF_LABEL[source ?? 'local']}
          name="ref"
          rules={[
            {
              required: refRequired,
              message: '`ref` é obrigatório para `local` e `drive`.',
            },
            { max: 1024, message: 'Máximo 1024 caracteres.' },
          ]}
        >
          <Input
            placeholder={
              source === 'local'
                ? './data/notes/transcripts/raw/exemplo.txt'
                : source === 'drive'
                ? '1AbCxyz... ou https://docs.google.com/...'
                : 'opcional — vazio = varre não-processados'
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
