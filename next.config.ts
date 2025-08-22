/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
  eslint: {
    // Always disable ESLint during builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Always disable TypeScript errors during builds - forced for production
    ignoreBuildErrors: true,
  },
  experimental: {
    // Additional setting to bypass strict checks
    typedRoutes: false,
  },
};

export default nextConfig;
