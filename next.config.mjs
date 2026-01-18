/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false, // Fixed: Enable type checking for better type safety
  },
  images: {
    unoptimized: true,
  },
  // Fix workspace root warning - set turbopack root to current directory
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
