/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  // Functions never read public/ or remotion/ at request time (public/ is served from the CDN;
  // article pages are prerendered, so their image checks run at build time).
  outputFileTracingExcludes: {
    '*': ['public/**/*', 'remotion/**/*'],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
