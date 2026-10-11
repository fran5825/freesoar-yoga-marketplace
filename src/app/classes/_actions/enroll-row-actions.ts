"use server";

// inline-member-enroll 票 06（spec 2.2）：場次列上就地報名、重新報名、取消單堂報名、訪客登入。
// 規則、本人檢查與鎖都在既有 service（createOwnEnrollment、cancelOwnEnrollment），這裡只負責做完回到「按下的那一頁」：
//   - 成功：result=success、focus=<列 ID>，頁面頂部顯示結果並捲到那一列（列已是新狀態）。
//   - 失敗：result=error、focus=<列 ID>、open=<列 ID>；頁面依「重新讀取後」的列狀態決定是否保持表單展開，
//     失敗訊息顯示在那一列上方（例如剛好額滿時，列已變成「已額滿」，表單收起）。
//   - 訪客登入：登入完回到同一頁、open=<列 ID>，表單自動展開，仍由本人勾選同意後送出。

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { enrollRowId } from "@/domain/enrollment/session-enroll-rows";
import { cancelOwnEnrollment, createOwnEnrollment } from "@/domain/enrollment/service";
import { parseSignInProvider } from "@/lib/auth/sign-in-providers";
import { rememberSignInReturn } from "@/lib/auth/sign-in-return";
import { safeTermRowReturnPath } from "@/lib/navigation/term-row-return-path";

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function finish(formData: FormData, classSessionId: string, outcome: { ok: boolean; message: string }): never {
  const { path, query } = safeTermRowReturnPath(readFormString(formData, "returnTo"));
  const rowId = enrollRowId(classSessionId);

  revalidatePath(path);
  revalidatePath(`/classes/${classSessionId}`);
  revalidatePath("/member/enrollments");
  revalidatePath("/member/dashboard");

  query.set("result", outcome.ok ? "success" : "error");
  query.set("message", outcome.message);
  query.set("focus", rowId);

  // 期班頁的「查看每一堂」預設收合；網址帶 focus／open 指向某一列時，頁面會自動展開。
  if (!outcome.ok) {
    query.set("open", rowId);
  }

  redirect(`${path}?${query.toString()}`);
}

export async function enrollRowAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");
  const reEnroll = formData.get("reEnroll") === "1";
  const result = await createOwnEnrollment(classSessionId, {
    notes: readFormString(formData, "notes"),
    basicConsent: formData.get("basicConsent") === "yes",
  });

  if (!result.ok) {
    const details = result.validationErrors?.map((error) => error.message) ?? [];
    finish(formData, classSessionId, { ok: false, message: [result.message, ...details].join(" ") });
  }

  finish(formData, classSessionId, {
    ok: true,
    message: reEnroll
      ? result.status === "pending" ? "重新報名已送出，等待老師確認。" : "已重新報名。"
      : result.status === "pending" ? "報名已送出，等待老師確認。" : "報名成功。",
  });
}

export async function cancelSingleRowAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");
  const result = await cancelOwnEnrollment(readFormString(formData, "enrollmentId"));

  finish(formData, classSessionId, result.ok ? { ok: true, message: "報名已取消。" } : { ok: false, message: result.message });
}

export async function signInToEnrollRowAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");
  const { path, query } = safeTermRowReturnPath(readFormString(formData, "returnTo"));
  const rowId = enrollRowId(classSessionId);

  query.set("open", rowId);
  query.set("focus", rowId);

  const destination = `${path}?${query.toString()}`;
  const provider = parseSignInProvider(formData.get("provider"));

  if (!provider) {
    redirect(`/sign-in?error=UnsupportedProvider&callbackUrl=${encodeURIComponent(destination)}`);
  }

  await rememberSignInReturn(destination);
  await signIn(provider, { redirectTo: destination });
}
