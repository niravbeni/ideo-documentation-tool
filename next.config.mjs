/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // This was deprecated
    // serverComponentsExternalPackages: [],
  },
  serverRuntimeConfig: {
    maxFileSize: 100 * 1024 * 1024, // 100MB in bytes
  },
  webpack: (config) => {
    config.externals = [...config.externals, 'canvas', 'jsdom'];
    return config;
  }
};

export default nextConfig;
