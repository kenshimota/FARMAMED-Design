import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/app/pedidos/estados/nuevo",
        destination: "/app/pedidos/estados",
        permanent: false,
      },
      {
        source: "/app/pedidos/estados/:id/editar",
        destination: "/app/pedidos/estados",
        permanent: false,
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
