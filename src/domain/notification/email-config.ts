// transactional-email E3：email 的寄送模式集中在這裡解析，只在 server 端使用。
// - disabled（預設）：只發站內通知，不建立 email 記錄。
// - allowlist：只寄給 EMAIL_ALLOWED_RECIPIENTS 裡的信箱，給 Preview／本機實測用。
// - live：寄給所有收件人；API key、寄件人與網址缺一不可，且網址不能是 localhost。
// 設定不完整一律當作不寄（fail closed），不會因為「有 API key」就自動寄出。

export type EmailDeliveryMode = "disabled" | "allowlist" | "live";

export type EmailConfig =
  | { status: "disabled" }
  | { status: "invalid"; mode: EmailDeliveryMode; problems: string[] }
  | {
      status: "enabled";
      mode: "allowlist" | "live";
      apiKey: string;
      from: string;
      baseUrl: string;
      allowedRecipients: ReadonlySet<string>;
      timeoutMs: number;
    };

const DEFAULT_TIMEOUT_MS = 5_000;
const EMAIL_PATTERN = /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function readEmailConfig(env: Readonly<Record<string, string | undefined>> = process.env): EmailConfig {
  const rawMode = (env.EMAIL_DELIVERY_MODE ?? "").trim() || "disabled";
  if (rawMode === "disabled") {
    return { status: "disabled" };
  }
  if (rawMode !== "allowlist" && rawMode !== "live") {
    return { status: "invalid", mode: "disabled", problems: ["EMAIL_DELIVERY_MODE"] };
  }

  const problems: string[] = [];
  const apiKey = (env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) problems.push("RESEND_API_KEY");

  // 寄件人可寫成「名稱 <地址>」或只寫地址；只檢查地址部分。
  const from = (env.EMAIL_FROM ?? "").trim();
  const fromAddress = from.match(/<([^>]+)>\s*$/)?.[1] ?? from;
  if (!from || /[\r\n]/.test(from) || !EMAIL_PATTERN.test(fromAddress)) problems.push("EMAIL_FROM");

  const baseUrl = parseBaseUrl(env.APP_BASE_URL, rawMode);
  if (!baseUrl) problems.push("APP_BASE_URL");

  const allowedRecipients = new Set(
    (env.EMAIL_ALLOWED_RECIPIENTS ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter((email) => email.length > 0),
  );
  if (rawMode === "allowlist") {
    if (allowedRecipients.size === 0 || [...allowedRecipients].some((email) => !EMAIL_PATTERN.test(email))) {
      problems.push("EMAIL_ALLOWED_RECIPIENTS");
    }
  }

  const timeoutMs = parseTimeout(env.EMAIL_TRANSPORT_TIMEOUT_MS);
  if (timeoutMs === null) problems.push("EMAIL_TRANSPORT_TIMEOUT_MS");

  if (problems.length > 0 || !baseUrl || timeoutMs === null) {
    return { status: "invalid", mode: rawMode, problems };
  }

  return { status: "enabled", mode: rawMode, apiKey, from, baseUrl, allowedRecipients, timeoutMs };
}

function parseBaseUrl(value: string | undefined, mode: "allowlist" | "live"): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (mode === "live" && (isLocal || url.protocol !== "https:")) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.origin;
}

// 1–10 秒，預設 5 秒（E7）。
function parseTimeout(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return DEFAULT_TIMEOUT_MS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 10_000) return null;
  return parsed;
}
