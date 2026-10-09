// transactional-email Slice B：把站內通知的標題／內文排成 email（主旨、HTML、純文字）。
// 內容沿用 copy.ts 的文案，不新增資訊；所有插值一律 escape，不接受使用者提供的 HTML。
// 色票沿用 src/app/globals.css（cream、ink、pine）；email client 不支援 CSS 變數，只能寫死色碼。

export type EmailCallToAction = { href: string; label: string };

export type RenderedEmail = { subject: string; html: string; text: string };

const BRAND = "飛索・瑜伽團課共創平台";

export function renderNotificationEmail(input: {
  title: string;
  body: string;
  cta: EmailCallToAction;
}): RenderedEmail {
  // 主旨不可帶換行（header injection），連續空白收成一格。
  const subject = `${input.title}｜飛索`.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();

  const text = [
    input.title,
    "",
    input.body,
    "",
    `${input.cta.label}：${input.cta.href}`,
    "",
    "——",
    `${BRAND}`,
    "這封信是因為你在平台上的課程、需求或申請有新的狀態而自動寄出，不需要回覆。",
  ].join("\n");

  const html = `<!doctype html>
<html lang="zh-Hant">
<body style="margin:0;padding:0;background:#f7f4ee;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #ebe2d7;border-radius:16px;">
<tr><td style="padding:28px 28px 8px;font-family:'PingFang TC','Microsoft JhengHei',sans-serif;font-size:13px;color:#56645b;">${escapeHtml(BRAND)}</td></tr>
<tr><td style="padding:8px 28px 0;font-family:'PingFang TC','Microsoft JhengHei',sans-serif;font-size:20px;line-height:1.4;font-weight:600;color:#29382f;">${escapeHtml(input.title)}</td></tr>
<tr><td style="padding:12px 28px 0;font-family:'PingFang TC','Microsoft JhengHei',sans-serif;font-size:15px;line-height:1.8;color:#29382f;">${escapeHtml(input.body).replace(/\n/g, "<br>")}</td></tr>
<tr><td style="padding:24px 28px 28px;"><a href="${escapeHtml(input.cta.href)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#345343;color:#ffffff;font-family:'PingFang TC','Microsoft JhengHei',sans-serif;font-size:15px;text-decoration:none;">${escapeHtml(input.cta.label)}</a></td></tr>
</table>
<p style="max-width:520px;margin:16px auto 0;font-family:'PingFang TC','Microsoft JhengHei',sans-serif;font-size:12px;line-height:1.7;color:#767c73;">這封信是因為你在平台上的課程、需求或申請有新的狀態而自動寄出，不需要回覆。</p>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
