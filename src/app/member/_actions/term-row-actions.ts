"use server";

// inline-member-actions 票 01（spec 3.2）：整期請假、取消請假、退出整期的就地操作。
// 「我的報名」、期班頁、單堂頁共用這一組 action；規則、本人檢查與鎖都在既有 service
// （cancelOwnEnrollment、restoreOwnLeave、withdrawOwnSeriesEnrollment），這裡只負責做完回到「按下的那一頁」。
//
// 回傳網址：
//   - 請假、取消請假成功：帶 open=sessions 與 focus=session-row-<報名 id>，列表保持展開並捲到那一列。
//   - 請假、取消請假失敗：帶 open=sessions 與 focus=action-feedback，捲到可見的失敗原因（列的狀態沒變）。
//   - 退出整期：成功只回到同一頁並顯示結果訊息（整期卡消失，沒有列可以定位）；失敗帶 focus=action-feedback。
//   （server action 的 redirect 不保留網址 fragment，所以用 focus 參數，頁面用 ScrollToTarget 捲過去。）

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { cancelOwnEnrollment } from "@/domain/enrollment/service";
import { restoreOwnLeave, withdrawOwnSeriesEnrollment } from "@/domain/enrollment/term-service";
import { safeTermRowReturnPath } from "@/lib/navigation/term-row-return-path";

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function finish(
  formData: FormData,
  outcome: { ok: boolean; message: string },
  options: { rowId?: string } = {},
): never {
  const { path, query } = safeTermRowReturnPath(readFormString(formData, "returnTo"));

  revalidatePath(path);
  revalidatePath("/member/enrollments");
  revalidatePath("/member/dashboard");

  query.set("result", outcome.ok ? "success" : "error");
  query.set("message", outcome.message);

  if (options.rowId) {
    query.set("open", "sessions");
    query.set("focus", outcome.ok ? `session-row-${options.rowId}` : "action-feedback");
  } else if (!outcome.ok) {
    query.set("focus", "action-feedback");
  }

  redirect(`${path}?${query.toString()}`);
}

export async function leaveRowAction(formData: FormData): Promise<void> {
  const enrollmentId = readFormString(formData, "enrollmentId");
  const result = await cancelOwnEnrollment(enrollmentId);

  finish(
    formData,
    result.ok ? { ok: true, message: "已請假這一堂，整期的其他堂照常。" } : { ok: false, message: result.message },
    { rowId: enrollmentId },
  );
}

export async function restoreRowAction(formData: FormData): Promise<void> {
  const enrollmentId = readFormString(formData, "enrollmentId");
  const result = await restoreOwnLeave(enrollmentId);

  finish(
    formData,
    result.ok ? { ok: true, message: "已取消請假，這一堂照常上課。" } : { ok: false, message: result.message },
    { rowId: enrollmentId },
  );
}

export async function withdrawTermRowAction(formData: FormData): Promise<void> {
  if (readFormString(formData, "confirmWithdraw") !== "yes") {
    finish(formData, { ok: false, message: "請勾選確認後再退出整期。" });
  }

  const result = await withdrawOwnSeriesEnrollment(readFormString(formData, "seriesEnrollmentId"));

  finish(
    formData,
    result.ok
      ? { ok: true, message: result.cancelledCount > 0 ? `已退出整期，取消了之後的 ${result.cancelledCount} 堂。` : "已退出整期。" }
      : { ok: false, message: result.message },
  );
}
