/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: false, // Always enable PWA
});

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  webpack: (config) => {
    config.resolve.alias["undici"] = false;
    return config;
  },
};

module.exports = withPWA(nextConfig);
