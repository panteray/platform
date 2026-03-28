import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['xlsx', 'pdf-parse'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
}

export default nextConfig
