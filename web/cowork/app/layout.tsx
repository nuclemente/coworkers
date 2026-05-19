import type { ReactNode } from 'react';
import './globals.css';
import NudsBoot from '@/components/shared/NudsBoot';
import AppShell from '@/components/shared/AppShell';
import { loadDashboardModules } from '@/lib/config/dashboard';

export const metadata = {
  title: 'Cowork Dashboard',
  description: 'UI local do Coworker — Engineering Manager',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const modules = loadDashboardModules();
  return (
    <html lang="pt-BR">
      <body>
        <NudsBoot>
          <AppShell modules={modules}>{children}</AppShell>
        </NudsBoot>
      </body>
    </html>
  );
}
