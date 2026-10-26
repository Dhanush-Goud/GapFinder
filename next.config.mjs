/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // unpdf ships its own PDF.js build; keep it out of the bundler graph.
  serverExternalPackages: ["unpdf"],
  // Sample materials are read from disk by the server at runtime.
  outputFileTracingIncludes: {
    "/api/**/*": ["./sample-materials/**/*"],
  },
};
export default nextConfig;
