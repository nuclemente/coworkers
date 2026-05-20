'use client';

import { Table, Tag, Typography, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TranscriptDigest } from '@/lib/db/transcripts';

const STATUS_COLOR: Record<TranscriptDigest['status'], string> = {
  ok: 'green',
  partial: 'gold',
  failed: 'red',
};

const TYPE_LABEL: Record<TranscriptDigest['meeting_type'], string> = {
  one_on_one: '1:1',
  meeting: 'Reunião',
};

const SOURCE_LABEL: Record<TranscriptDigest['source_type'], string> = {
  drive: 'Drive',
  local: 'Local',
  gmail: 'Gmail',
};

export default function TranscriptList({
  digests,
}: {
  digests: TranscriptDigest[];
}) {
  if (digests.length === 0) {
    return <Empty description="Nenhum digest ainda." />;
  }

  const columns: ColumnsType<TranscriptDigest> = [
    {
      title: 'Data',
      dataIndex: 'meeting_date',
      key: 'meeting_date',
      width: 110,
      sorter: (a, b) => a.meeting_date.localeCompare(b.meeting_date),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Tipo',
      dataIndex: 'meeting_type',
      key: 'meeting_type',
      width: 100,
      render: (t: TranscriptDigest['meeting_type']) => (
        <Tag color={t === 'one_on_one' ? 'blue' : 'purple'}>{TYPE_LABEL[t]}</Tag>
      ),
      filters: [
        { text: '1:1', value: 'one_on_one' },
        { text: 'Reunião', value: 'meeting' },
      ],
      onFilter: (value, record) => record.meeting_type === value,
    },
    {
      title: 'Participantes / Evento',
      key: 'who',
      render: (_, r) => {
        if (r.meeting_type === 'meeting' && r.event_name) return r.event_name;
        return r.participants.join(', ') || '—';
      },
    },
    {
      title: 'Fonte',
      dataIndex: 'source_type',
      key: 'source_type',
      width: 90,
      render: (s: TranscriptDigest['source_type']) => SOURCE_LABEL[s],
    },
    {
      title: 'v',
      dataIndex: 'version',
      key: 'version',
      width: 60,
      render: (v: number) => (v > 1 ? <Tag>v{v}</Tag> : <Typography.Text type="secondary">—</Typography.Text>),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: TranscriptDigest['status']) => (
        <Tag color={STATUS_COLOR[s]}>{s}</Tag>
      ),
    },
    {
      title: 'Confluence',
      dataIndex: 'confluence_page_id',
      key: 'confluence',
      width: 130,
      render: (id: string | null) =>
        id ? (
          <a
            href={`https://nubank.atlassian.net/wiki/pages/viewpage.action?pageId=${id}`}
            target="_blank"
            rel="noreferrer"
          >
            abrir página
          </a>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: 'Cards',
      dataIndex: 'cards_count',
      key: 'cards_count',
      width: 80,
      render: (c: number) => (c > 0 ? <Tag color="geekblue">{c}</Tag> : '—'),
    },
  ];

  return (
    <Table
      rowKey="id"
      columns={columns}
      dataSource={digests}
      pagination={{ pageSize: 20, showSizeChanger: false }}
      size="middle"
    />
  );
}
