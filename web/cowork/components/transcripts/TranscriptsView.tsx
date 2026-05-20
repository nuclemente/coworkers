'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Typography, Button, Space, Tabs, App } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { TranscriptDigest, TranscriptJob } from '@/lib/db/transcripts';
import TranscriptList from './TranscriptList';
import TranscriptJobQueue from './TranscriptJobQueue';
import TranscriptRunDialog from './TranscriptRunDialog';

type Props = {
  initialDigests: TranscriptDigest[];
  initialActiveJobs: TranscriptJob[];
  initialRecentJobs: TranscriptJob[];
};

export default function TranscriptsView({
  initialDigests,
  initialActiveJobs,
  initialRecentJobs,
}: Props) {
  const router = useRouter();
  const { message } = App.useApp();
  const [openDialog, setOpenDialog] = useState(false);

  // Auto-refresh leve: a cada 30s, se houver jobs ativos, força refresh do RSC.
  useEffect(() => {
    if (initialActiveJobs.length === 0) return;
    const handle = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(handle);
  }, [initialActiveJobs.length, router]);

  function handleJobCreated() {
    message.success('Job enfileirado.');
    setOpenDialog(false);
    router.refresh();
  }

  return (
    <>
      <Space
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          marginBottom: 24,
        }}
      >
        <Typography.Title level={2} style={{ margin: 0 }}>
          Transcripts
        </Typography.Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => router.refresh()}
          >
            Atualizar
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setOpenDialog(true)}
          >
            Novo digest
          </Button>
        </Space>
      </Space>

      <Tabs
        defaultActiveKey="queue"
        items={[
          {
            key: 'queue',
            label: `Fila (${initialActiveJobs.length})`,
            children: (
              <TranscriptJobQueue
                activeJobs={initialActiveJobs}
                recentJobs={initialRecentJobs}
              />
            ),
          },
          {
            key: 'history',
            label: `Histórico (${initialDigests.length})`,
            children: <TranscriptList digests={initialDigests} />,
          },
        ]}
      />

      <TranscriptRunDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreated={handleJobCreated}
      />
    </>
  );
}
