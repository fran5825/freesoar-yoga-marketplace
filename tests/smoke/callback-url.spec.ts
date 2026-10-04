import { expect, test } from "@playwright/test";

import { sanitizeCallbackUrl } from "../../src/lib/auth/callback-url";
import { parseSignInProvider } from "../../src/lib/auth/sign-in-providers";

// member-flow-redesign 票 05：登入後回到哪裡的過濾（純函式，不經 UI）。
// 舊版只檢查「以 / 開頭、不以 // 開頭」，下面的反斜線與正規化繞過都會通過並導到外站。
const backslash = String.fromCharCode(92);

const MALICIOUS_CALLBACKS = [
  "https://evil.example/",
  "//evil.example",
  `/${backslash}evil.example/`,
  "/%5cevil.example/",
  "/a/..//evil.example/",
  "/a/%2e%2e//evil.example/",
  "/classes\tevil",
  "/classes\nevil",
  "/classes\u0000evil",
];

test.describe("sanitizeCallbackUrl (direct, no UI)", () => {
  test("rejects external, backslash, control-character and normalization bypasses", () => {
    for (const value of MALICIOUS_CALLBACKS) {
      expect(sanitizeCallbackUrl(value), JSON.stringify(value)).toBeNull();
    }
    expect(sanitizeCallbackUrl(undefined)).toBeNull();
    expect(sanitizeCallbackUrl(null)).toBeNull();
    expect(sanitizeCallbackUrl("")).toBeNull();
    expect(sanitizeCallbackUrl("evil.example")).toBeNull();
  });

  test("keeps normal in-site paths with query and hash", () => {
    expect(sanitizeCallbackUrl("/classes")).toBe("/classes");
    expect(sanitizeCallbackUrl("/teachers/join")).toBe("/teachers/join");
    expect(sanitizeCallbackUrl("/classes/abc?returnTo=%2Fclasses%3FtimeOfDay%3Devening#enroll")).toBe(
      "/classes/abc?returnTo=%2Fclasses%3FtimeOfDay%3Devening#enroll",
    );
    // 中文路徑會被編碼成同一個網址，瀏覽器解讀後是同一頁。
    expect(sanitizeCallbackUrl("/課程")).toBe(`/${encodeURIComponent("課程")}`);
  });
});

test.describe("parseSignInProvider (direct, no UI)", () => {
  test("only accepts enabled sign-in providers", () => {
    expect(parseSignInProvider("google")).toBe("google");
    expect(parseSignInProvider("github")).toBeNull();
    expect(parseSignInProvider("")).toBeNull();
    expect(parseSignInProvider(null)).toBeNull();
  });
});
