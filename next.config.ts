import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WebAssembly and data files that must be loaded from node_modules, not bundled
  serverExternalPackages: ["@electric-sql/pglite"],
  // getDb() reads the SQL migrations from disk at runtime, so ship them with every server function
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
};

export default nextConfig;
