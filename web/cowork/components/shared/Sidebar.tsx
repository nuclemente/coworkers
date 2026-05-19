'use client';

import { Layout, Menu, Typography } from 'antd';
import * as Icons from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { DashboardModule } from '@/lib/config/dashboard';
import { nuPj } from '@/lib/theme/nuds-tokens';

const { Sider } = Layout;

function iconFor(name: string) {
  const C = (Icons as Record<string, React.ComponentType | undefined>)[name];
  return C ? <C /> : null;
}

export default function Sidebar({ modules }: { modules: DashboardModule[] }) {
  const pathname = usePathname();
  const selected = modules
    .filter((m) => pathname?.startsWith(m.path))
    .map((m) => m.id);

  return (
    <Sider
      width={240}
      style={{
        borderRight: `1px solid ${nuPj.hairline}`,
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflow: 'auto',
      }}
    >
      <div
        style={{
          padding: '28px 24px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${nuPj.primary}, ${nuPj.deep})`,
          }}
          aria-hidden
        />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <Typography.Text strong style={{ fontSize: 15, color: nuPj.ink }}>
            Cowork
          </Typography.Text>
          <Typography.Text style={{ fontSize: 11, color: nuPj.fog2 }}>
            Engineering Manager
          </Typography.Text>
        </div>
      </div>

      <Menu
        mode="inline"
        selectedKeys={selected}
        style={{
          borderRight: 0,
          padding: '8px 12px',
          background: 'transparent',
        }}
        items={modules.map((m) => ({
          key: m.id,
          icon: iconFor(m.icon),
          label: <Link href={m.path}>{m.label}</Link>,
        }))}
      />
    </Sider>
  );
}
