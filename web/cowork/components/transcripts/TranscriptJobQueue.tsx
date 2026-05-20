'use client';

import { Table, Tag, Typography, Space, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TranscriptJob } from '@/lib/db/transcripts';

const STATUS_COLOR: Record<TranscriptJob['status'], string> = {
  queued: 'default',
  processing: 'blue',
  done: 'green',
  failed: 'red',
  skipped: 'gold',
};

const SOURCE_LABEL: Record<TranscriptJob['source'], string> = {
  drive: 'Drive',
  local: 'Local',
  gmail: 'Gmail',
};

function jobColumns(): ColumnsType<TranscriptJob> {
  return [
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (s: TranscriptJob['source']) => SOURCE_LABEL[s],
    },
    {
      title: 'Ref',
      dataIndex: 'ref',
      key: 'ref',
      ellipsis: true,
      render: (r: string | null) =>
        r ? (
          <Typography.Text code style={{ fontSize: 12 }}>
            {r}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">(varredura)</Typography.Text>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: TranscriptJob['status']) => (
        <Tag color={STATUS_COLOR[s]}>{s}</Tag>
      ),
    },
    {
      title: 'Pedido em',
      dataIndex: 'requested_at',
      key: 'requested_at',
      width: 170,
    },
    {
      title: 'Concluído em',
      dataIndex: 'processed_at',
      key: 'processed_at',
      width: 170,
      render: (v: string | null) =>
        v ? v : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Digest',
      dataIndex: 'digest_id',
      key: 'digest_id',
      width: 90,
      render: (id: number | null) =>
        id ? <Tag color="geekblue">#{id}</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
  ];
}

export default function TranscriptJobQueue({
  activeJobs,
  recentJobs,
}: {
  activeJobs: TranscriptJob[];
  recentJobs: TranscriptJob[];
}) {
  const cols = jobColumns();
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Typography.Title level={4} style={{ marginTop: 0 }}>
          Fila ativa
        </Typography.Title>
        {activeJobs.length === 0 ? (
          <Empty description="Sem jobs pendentes. Drenagem é feita pela skill via `source=queue`." />
        ) : (
          <Table
            rowKey="id"
            columns={cols}
            dataSource={activeJobs}
            pagination={false}
            size="small"
          />
        )}
      </div>

      <div>
        <Typography.Title level={4}>Concluídos recentes</Typography.Title>
        {recentJobs.length === 0 ? (
          <Empty description="Nenhum job concluído." />
        ) : (
          <Table
            rowKey="id"
            columns={cols}
            dataSource={recentJobs}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            size="small"
          />
        )}
      </div>
    </Space>
  );
}
