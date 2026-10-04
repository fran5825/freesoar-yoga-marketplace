// 第二批票 05：審核表單送出後的結果。失敗時 action 回傳這個狀態（不跳頁），
// 表單留在原頁、保留已填的原因；成功時 action 直接 redirect，不會回到這裡。
// 原因只存在頁面的表單狀態，不放 URL、也不存資料庫或瀏覽器。
//
// stale：送出時資格已變，這頁的操作不能再用。
// - "changed"：資料已被其他人處理，重新載入可看到目前狀態。
// - "missing"：資料已不存在，重新載入只會是 404，所以改回列表。
// 兩種情況都不跳頁，讓已填的原因留在畫面上，但停用這頁的審核按鈕。
export type AdminStaleKind = "changed" | "missing";

export type AdminActionState =
  | { status: "idle" }
  | { status: "error"; message: string; stale?: AdminStaleKind };

export const idleAdminActionState: AdminActionState = { status: "idle" };

export function adminActionError(message: string, stale?: AdminStaleKind): AdminActionState {
  return stale ? { status: "error", message, stale } : { status: "error", message };
}

// 把 service 的失敗結果轉成畫面狀態：資料不存在 → missing、已不是待審 → changed，其餘可重試。
// changedMessage 可替換 service 原文，讓管理員看得懂發生了什麼。
export function adminReviewFailure(
  result: { code: string; message: string },
  codes: { missing: string; changed: string; changedMessage?: string },
): AdminActionState {
  if (result.code === codes.missing) return adminActionError(result.message, "missing");
  if (result.code === codes.changed) return adminActionError(codes.changedMessage ?? result.message, "changed");
  return adminActionError(result.message);
}
