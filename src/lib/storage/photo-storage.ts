// teacher-showcase-photos 票 02（ADR 0007）：照片檔案的儲存介面。
//
// 正式環境把檔案放在 Cloudflare R2（物件儲存，像獨立於網站主機的檔案倉庫）；網站主機與資料庫只記錄
// 「倉庫裡的位置（storageKey）」，不存檔案本身，所以日後換主機不用搬照片。
// 開發與測試可以用本機資料夾（STORAGE_DRIVER=local）。沒有設定（預設）時一律拒絕上傳，並顯示「照片功能尚未開通」，
// 其他功能照常運作——正式環境沒設好 R2 絕不會悄悄把檔案寫到網站主機的硬碟。
//
// 設定（環境變數，金鑰只放在 .env，不貼在對話、不進 Git）：
//   STORAGE_DRIVER=r2    → 需要 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY、R2_BUCKET、R2_PUBLIC_BASE_URL
//   STORAGE_DRIVER=local → 只給開發與測試；LOCAL_STORAGE_DIR 可改資料夾（預設 .local-storage）
//   其他或未設定         → 照片功能關閉

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type PhotoStorage = {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  // 瀏覽器讀取這張照片的網址（R2 是公開網域，本機是站內 /media 路由）。
  publicUrl(key: string): string;
};

export type PhotoStorageResult =
  | { ok: true; driver: "r2" | "local"; storage: PhotoStorage }
  | { ok: false; reason: "not_configured" };

// 只接受應用程式自己產生的 key（photos/<uuid>.webp）；任何來自外部的字串都不能直接當檔案路徑。
const PHOTO_KEY_PATTERN = /^photos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export function isValidPhotoKey(key: string): boolean {
  return PHOTO_KEY_PATTERN.test(key);
}

type EnvLike = Record<string, string | undefined>;

export function getPhotoStorage(env: EnvLike = process.env): PhotoStorageResult {
  const driver = env.STORAGE_DRIVER?.trim();

  if (driver === "r2") {
    const config = readR2Config(env);

    return config ? { ok: true, driver: "r2", storage: createR2Storage(config) } : { ok: false, reason: "not_configured" };
  }

  if (driver === "local") {
    return { ok: true, driver: "local", storage: createLocalStorage(env.LOCAL_STORAGE_DIR?.trim() || path.join(process.cwd(), ".local-storage")) };
  }

  return { ok: false, reason: "not_configured" };
}

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

function readR2Config(env: EnvLike): R2Config | null {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = env.R2_BUCKET?.trim();
  const publicBaseUrl = env.R2_PUBLIC_BASE_URL?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

type S3Like = { send(command: unknown): Promise<unknown> };

// client 可注入，測試用假的就不需要真的連到 Cloudflare。
export function createR2Storage(config: R2Config, client?: S3Like): PhotoStorage {
  const s3: S3Like =
    client ??
    new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  const base = config.publicBaseUrl.replace(/\/+$/, "");

  return {
    async put(key, body, contentType) {
      assertValidKey(key);
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          // key 是隨機的、內容不會被覆寫，可以放心長期快取。
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    },
    async delete(key) {
      assertValidKey(key);
      await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
    publicUrl(key) {
      assertValidKey(key);

      return `${base}/${key}`;
    },
  };
}

export function createLocalStorage(directory: string): PhotoStorage {
  const resolve = (key: string) => {
    assertValidKey(key);

    return path.join(directory, key);
  };

  return {
    async put(key, body) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async delete(key) {
      try {
        await unlink(resolve(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    },
    publicUrl(key) {
      assertValidKey(key);

      return `/media/${key}`;
    },
  };
}

// 本機驅動專用：給 /media 路由讀檔。
export async function readLocalPhoto(directory: string, key: string): Promise<Buffer | null> {
  if (!isValidPhotoKey(key)) {
    return null;
  }

  try {
    return await readFile(path.join(directory, key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function assertValidKey(key: string): void {
  if (!isValidPhotoKey(key)) {
    throw new Error("Invalid photo storage key");
  }
}
