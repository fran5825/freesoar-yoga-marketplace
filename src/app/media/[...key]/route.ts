import path from "node:path";

import { readLocalPhoto } from "@/lib/storage/photo-storage";

// teacher-showcase-photos 票 02：只在 STORAGE_DRIVER=local（開發與測試）時提供照片檔案。
// 正式環境用 R2，照片網址直接指向 R2 的公開網域，這個路由一律回 404。
// 只接受應用程式自己產生的 key（photos/<uuid>.webp），任何其他路徑一律 404，沒有路徑穿越的空間。
export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  if (process.env.STORAGE_DRIVER?.trim() !== "local") {
    return new Response("Not found", { status: 404 });
  }

  const { key } = await context.params;
  const directory = process.env.LOCAL_STORAGE_DIR?.trim() || path.join(process.cwd(), ".local-storage");
  const file = await readLocalPhoto(directory, key.join("/"));

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(file), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
