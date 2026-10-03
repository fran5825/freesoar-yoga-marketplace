// 上次身分（docs/context/glossary.md）：最後一次進入的專區所代表的身分，存在瀏覽器 cookie。
// 這個檔案只放純資料與純函式，給 src/proxy.ts 使用（不能在這裡 import Prisma 或 auth）。
// 身分是否仍有效由 last-role.ts 在伺服器端判斷；cookie 只是「偏好」，不代表任何權限。

export const LAST_ROLE_COOKIE = "fsy_last_role";

export const LAST_ROLES = ["member", "teacher", "organizer", "admin"] as const;

export type LastRole = (typeof LAST_ROLES)[number];

export const LAST_ROLE_HOME: Record<LastRole, string> = {
  member: "/member/dashboard",
  teacher: "/teacher/dashboard",
  organizer: "/organizer/dashboard",
  admin: "/admin/dashboard",
};

// 一年：只是記住使用者習慣，過期了就從學員開始，沒有安全上的影響。
export const LAST_ROLE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// proxy（整頁載入）與 remember-last-role（站內換頁）兩條寫入路徑共用，屬性必須一致。
export function lastRoleCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    maxAge: LAST_ROLE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure,
  };
}

const AREA_PREFIXES: [string, LastRole][] = [
  ["/member", "member"],
  ["/teacher", "teacher"],
  ["/organizer", "organizer"],
  ["/admin", "admin"],
];

// 只比對完整的第一段網址：/teacher/... 是老師專區，/teachers/join（公開的老師合作頁）不是。
export function lastRoleFromPath(pathname: string): LastRole | null {
  for (const [prefix, role] of AREA_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return role;
    }
  }

  return null;
}

export function parseLastRole(value: string | undefined): LastRole | null {
  return LAST_ROLES.find((role) => role === value) ?? null;
}
