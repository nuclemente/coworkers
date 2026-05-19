/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 é nativo: precisa ser external no server runtime.
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    // Mantido por compat com versões 15.x antigas. O canônico em 15.5+ é
    // `serverExternalPackages` acima; deixamos os dois enquanto o pin varia.
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

module.exports = nextConfig;
