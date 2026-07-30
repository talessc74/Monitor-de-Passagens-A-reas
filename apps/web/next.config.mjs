/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL || 'http://localhost:8080';

const nextConfig = {
  // Cloud Run precisa do server Node standalone gerado pelo Next.js —
  // sem isso, a imagem Docker teria que carregar node_modules inteiro.
  // Ver _local-adr-policy-001 (amendment: apps/web em Cloud Run, não Vercel).
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
