import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // teacher-showcase-photos：老師上傳照片走 Server Action，預設上限只有 1 MB。
    // 單張照片上限是 5 MB（見 src/domain/teacher-photo/process-image.ts），留一點表單額外資料的空間。
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
