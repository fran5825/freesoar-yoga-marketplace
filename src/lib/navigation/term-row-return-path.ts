// inline-member-actions 票 01：就地請假等操作做完要回到哪一頁。只允許站內三種頁面，其餘一律回「我的報名」，避免被當成 open redirect。

// 只允許回到這三種頁面（站內相對路徑，不接受外部網址）；其餘一律回「我的報名」。
const RETURN_PATH = /^\/(member\/enrollments|classes\/terms\/[A-Za-z0-9_-]+|classes\/[A-Za-z0-9_-]+)$/;

export function safeTermRowReturnPath(value: unknown): { path: string; query: URLSearchParams } {
  const fallback = { path: "/member/enrollments", query: new URLSearchParams() };

  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const url = new URL(value, "https://freesoar.invalid");

    if (url.origin !== "https://freesoar.invalid" || !RETURN_PATH.test(url.pathname)) {
      return fallback;
    }

    const query = new URLSearchParams(url.searchParams);

    for (const key of ["result", "message", "open", "focus"]) {
      query.delete(key);
    }

    return { path: url.pathname, query };
  } catch {
    return fallback;
  }
}

