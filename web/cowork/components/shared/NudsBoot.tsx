'use client';

import type { ReactNode } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import { nudsTheme } from '@/lib/theme/nuds-tokens';

export default function NudsBoot({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider locale={ptBR} theme={nudsTheme}>
      <AntApp
        notification={{ placement: 'topRight', duration: 3 }}
        message={{ duration: 2.5, maxCount: 3 }}
      >
        {children}
      </AntApp>
    </ConfigProvider>
  );
}
