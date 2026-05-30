/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.app', '*.ngrok.io'],
  typescript: {
    ignoreBuildErrors: false, // Fixed: Enable type checking for better type safety
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@fortawesome/free-solid-svg-icons",
      "@fortawesome/react-fontawesome",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
    ],
  },
  // Fix workspace root warning - set turbopack root to current directory
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
