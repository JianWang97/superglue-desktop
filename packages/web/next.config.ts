import type { NextConfig } from "next";

const isElectron = process.env.NEXT_PUBLIC_ELECTRON === "true";

const nextConfig = {
  env: {
    // 在构建时将服务端环境变量暴露到客户端
    NEXT_PUBLIC_SUPERGLUE_ENDPOINT:
      process.env.GRAPHQL_ENDPOINT ||
      process.env.NEXT_PUBLIC_SUPERGLUE_ENDPOINT ||
      `http://localhost:${process.env.GRAPHQL_PORT || "3000"}`,
    NEXT_PUBLIC_SUPERGLUE_API_KEY:
      process.env.NEXT_PUBLIC_SUPERGLUE_API_KEY || process.env.AUTH_TOKEN,
    NEXT_PUBLIC_ELECTRON: process.env.NEXT_PUBLIC_ELECTRON || "true",
  },
  output: "export",
  trailingSlash: true, 
  distDir: "dist/web",
  images: {
    unoptimized: true,
  },
  // 在Electron模式下启用适当的配置以避免路径问题
  assetPrefix: "/", // 对于Next.js构建，保持以斜杠开头的路径
  basePath: "",
} satisfies NextConfig;

export default nextConfig;
