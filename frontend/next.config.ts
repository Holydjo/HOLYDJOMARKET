import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lets phones/tablets on the local network load the dev server
  // (http://<your-mac-ip>:4000). Only affects `next dev`.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.16.*.*'],
};

export default nextConfig;
