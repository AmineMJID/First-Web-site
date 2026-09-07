/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the dev server to be embedded / accessed from sandbox preview hosts
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],
};

export default nextConfig;
