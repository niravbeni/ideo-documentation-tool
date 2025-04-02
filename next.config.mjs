/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '10mb' // Increase the size limit to 10MB
    },
    responseLimit: '10mb'
  }
};

export default nextConfig;
