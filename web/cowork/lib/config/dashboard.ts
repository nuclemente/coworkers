import 'server-only';
import path from 'node:path';
import fs from 'node:fs';
import yaml from 'js-yaml';

export type DashboardModule = {
  id: string;
  label: string;
  icon: string;
  path: string;
  enabled: boolean;
};

type RawConfig = {
  modules?: Array<Partial<DashboardModule>>;
};

let cached: DashboardModule[] | null = null;

function resolveConfigPath(): string {
  return path.resolve(process.cwd(), '..', '..', 'config', 'dashboard.yaml');
}

export function loadDashboardModules(): DashboardModule[] {
  if (cached) return cached;
  const filePath = resolveConfigPath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`config/dashboard.yaml ausente em ${filePath}.`);
  }
  const raw = yaml.load(fs.readFileSync(filePath, 'utf-8')) as RawConfig | null;
  const modules = (raw?.modules ?? []).map((m, idx) => ({
    id: String(m.id ?? `mod-${idx}`),
    label: String(m.label ?? m.id ?? ''),
    icon: String(m.icon ?? 'AppstoreOutlined'),
    path: String(m.path ?? '/'),
    enabled: m.enabled !== false,
  }));
  cached = modules.filter((m) => m.enabled);
  return cached;
}
