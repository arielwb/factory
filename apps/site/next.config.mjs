/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure external TS packages in the monorepo are transpiled by Next/SWC
  transpilePackages: [
    '@factory/core',
    '@factory/infra',
    '@factory/adapters',
    '@factory/plugins',
    '@factory/factory',
    '@factory/lib'
  ],
};

export default nextConfig;

