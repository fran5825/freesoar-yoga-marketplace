// teacher-showcase-photos 票 02（ADR 0007、spec S4）：上傳照片的檢查與縮圖。
//
// 規則：
// - 只接受 JPG、PNG、WebP，以「實際解碼出來的格式」判斷，不相信檔名或瀏覽器回報的類型；
// - 單張最大 5 MB；總像素有上限，擋掉「檔案很小但解開來超級大」的惡意圖片（decompression bomb）；
// - 自動依相機方向轉正、長邊縮到 1600 px 以內（不放大），輸出成 WebP（約 300 KB）；
// - 輸出不帶任何 metadata：相機拍攝時嵌在照片裡的 GPS 位置、裝置資訊不會被保存或公開。

import sharp from "sharp";

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_EDGE = 1600;
// 5000 萬像素（約 7000×7000）已遠超過手機相機，超過一律拒絕。
export const PHOTO_MAX_INPUT_PIXELS = 50_000_000;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ProcessPhotoErrorCode = "too_large" | "unsupported_format" | "too_many_pixels" | "unreadable";

export type ProcessPhotoResult =
  | { ok: true; body: Buffer; width: number; height: number; contentType: "image/webp" }
  | { ok: false; code: ProcessPhotoErrorCode };

export const processPhotoMessages: Record<ProcessPhotoErrorCode, string> = {
  too_large: "照片檔案太大，請選 5 MB 以內的照片。",
  unsupported_format: "請上傳 JPG、PNG 或 WebP 格式的照片。",
  too_many_pixels: "照片的解析度太高，請換一張小一點的照片。",
  unreadable: "這個檔案無法讀取成照片，請換一張再試。",
};

export async function processPhotoUpload(input: Buffer): Promise<ProcessPhotoResult> {
  if (input.length === 0) {
    return { ok: false, code: "unreadable" };
  }

  if (input.length > PHOTO_MAX_BYTES) {
    return { ok: false, code: "too_large" };
  }

  try {
    const metadata = await sharp(input, { limitInputPixels: PHOTO_MAX_INPUT_PIXELS, failOn: "error" }).metadata();

    if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
      return { ok: false, code: "unsupported_format" };
    }

    // 動畫（例如多幀 WebP）只取第一幀；pages 超過 1 也當一般照片處理，不拒絕。
    const { data, info } = await sharp(input, { limitInputPixels: PHOTO_MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: PHOTO_MAX_EDGE, height: PHOTO_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    return { ok: true, body: data, width: info.width, height: info.height, contentType: "image/webp" };
  } catch (error) {
    if (error instanceof Error && /pixel limit|exceeds/i.test(error.message)) {
      return { ok: false, code: "too_many_pixels" };
    }

    return { ok: false, code: "unreadable" };
  }
}
