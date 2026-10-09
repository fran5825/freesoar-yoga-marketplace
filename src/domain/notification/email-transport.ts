// transactional-email Slice C：寄信的出口。測試傳入假的 transport，不連網路。
// 決策（2026-10-09）：不安裝 resend SDK，直接用 Resend 官方 HTTPS Send Email API＋Node 原生 fetch，
// 才能用 AbortController 在逾時時真正中斷底層請求（E2／E7），也少一個相依套件。

export type EmailMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  // 同一筆 Notification 重送時 Resend 只寄一次（E8）；不含個資。
  idempotencyKey: string;
};

export type EmailTransport = (message: EmailMessage) => Promise<void>;

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function createResendTransport(options: {
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): EmailTransport {
  const fetchImpl = options.fetchImpl ?? fetch;

  return async (message) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "freesoar-yoga-marketplace",
          "Idempotency-Key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        // 只回報狀態碼與 Resend 的錯誤名稱，不帶收件人或 API key。
        let name = "";
        try {
          const body = (await response.json()) as { name?: unknown };
          if (typeof body.name === "string") name = body.name;
        } catch {
          // 回應不是 JSON 時只留狀態碼。
        }
        throw new Error(`resend responded ${response.status}${name ? ` ${name}` : ""}`);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`resend request timed out after ${options.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}
