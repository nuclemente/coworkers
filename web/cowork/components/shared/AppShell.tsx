'use client';

import type { ReactNode } from 'react';
import { Layout } from 'antd';
import Sidebar from '@/components/shared/Sidebar';
import type { DashboardModule } from '@/lib/config/dashboard';

const { Content } = Layout;

export default function AppShell({
  modules,
  children,
}: {
  modules: DashboardModule[];
  children: ReactNode;
}) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar modules={modules} />
      <Content
        style={{
          padding: '32px 40px',
          maxWidth: 1440,
          width: '100%',
          margin: '0 auto',
        }}
      >
        {children}
      </Content>
    </Layout>
  );
}
