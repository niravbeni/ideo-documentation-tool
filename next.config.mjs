/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [],
  },
  api: {
    bodyParser: {
      sizeLimit: '100mb'
    },
    responseLimit: '100mb'
  }
};

export default nextConfig;
