import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Ruido HMR en dev al abrir por 127.0.0.1 (solo-live-reload, sin efecto
  // en render ni en producción).
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: false,
};

export default nextConfig;
