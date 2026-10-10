"use server";

import {
  approveSubmittedTeacherProfileApplication,
  rejectSubmittedTeacherProfileApplication,
  restoreSuspendedTeacherProfile,
  suspendApprovedTeacherProfile,
} from "@/domain/teacher-profile/service";
import { removeTeacherPhotoForAdmin } from "@/domain/teacher-photo/admin-service";
import { requireAdmin } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminActionError, adminReviewFailure, type AdminActionState } from "../_lib/action-state";
import { adminDetailHref, adminFeedbackHref } from "../_lib/list-context";

// admin-usability 票 06：操作完成後回到老師列表（保留原搜尋／分類），列表頂端顯示成功提示；
// 失敗則留在這位老師的詳情頁顯示原因（第二批起由 action 回傳狀態，不再跳頁）。
function redirectToList(result: "success" | "error", message: string, formData?: FormData, item?: string): never {
  redirect(adminFeedbackHref("teachers", formData?.get("returnTo"), result, message, item));
}

async function readTeacherProfileId(formData: FormData): Promise<string> {
  try {
    await requireAdmin();
  } catch {
    redirectToList("error", "需要管理員權限才能執行這個操作。");
  }

  const teacherProfileId = formData.get("teacherProfileId");

  if (typeof teacherProfileId !== "string" || teacherProfileId.length === 0) {
    redirectToList("error", "找不到這位老師的資料。");
  }

  return teacherProfileId;
}

// 第二批票 05：審核失敗一律回傳錯誤、不跳頁，表單保留已填的原因。
// 資格已變（申請已被處理或已不存在）時另外標記 stale，畫面停用審核按鈕並提供重新載入／回列表。
// 失敗時不呼叫 revalidatePath：重新整理會讓詳情頁換成目前狀態、卸載表單，已填的原因就不見了。
function reviewFailure(result: { code: string; message: string }): AdminActionState {
  return adminReviewFailure(result, {
    missing: "teacher_profile_not_found",
    changed: "teacher_profile_not_submitted",
  });
}

export async function approveTeacherProfileApplicationAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const teacherProfileId = await readTeacherProfileId(formData);

  const result = await approveSubmittedTeacherProfileApplication(teacherProfileId);

  if (!result.ok) {
    return reviewFailure(result);
  }

  revalidatePath("/admin/teachers");
  redirectToList("success", "已通過這位老師的申請。", formData, teacherProfileId);
}

export async function rejectTeacherProfileApplicationAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const teacherProfileId = await readTeacherProfileId(formData);

  // 後端再守一次確認欄位：表單以隱藏欄位帶入，代表管理員已在畫面上明確展開並送出退回。
  if (formData.get("confirmReject") !== "yes") {
    return adminActionError("請確認要退回這位老師的申請。");
  }

  const rejectionReasonValue = formData.get("rejectionReason");
  const rejectionReason =
    typeof rejectionReasonValue === "string" ? rejectionReasonValue : "";

  const result = await rejectSubmittedTeacherProfileApplication(
    teacherProfileId,
    rejectionReason,
  );

  if (!result.ok) {
    return reviewFailure(result);
  }

  revalidatePath("/admin/teachers");
  redirectToList("success", "已退回這位老師的申請，退回原因會顯示給老師。", formData, teacherProfileId);
}

// 第二批票 07：暫停／恢復沿用票 05 的回饋模式。失敗回傳狀態、不跳頁，暫停原因留在本頁；
// 資格已變（已不是可暫停／可恢復的狀態，或老師已不存在）時標記 stale。只有成功才 revalidate。
export async function suspendTeacherProfileAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const teacherProfileId = await readTeacherProfileId(formData);

  if (formData.get("confirmSuspend") !== "yes") {
    return adminActionError("請確認要暫停這位老師。");
  }

  const suspensionReasonValue = formData.get("suspensionReason");
  const suspensionReason =
    typeof suspensionReasonValue === "string" ? suspensionReasonValue : "";

  const result = await suspendApprovedTeacherProfile(
    teacherProfileId,
    suspensionReason,
  );

  if (!result.ok) {
    return adminReviewFailure(result, {
      missing: "teacher_profile_not_found",
      changed: "teacher_profile_not_approved",
      changedMessage: "這位老師已不是「已通過」狀態，可能剛才已經被處理過。",
    });
  }

  revalidatePath("/admin/teachers");
  redirectToList("success", "這位老師已經暫停，暫停原因會顯示給老師。", formData, teacherProfileId);
}

export async function restoreTeacherProfileAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const teacherProfileId = await readTeacherProfileId(formData);

  if (formData.get("confirmRestore") !== "yes") {
    return adminActionError("請確認要恢復這位老師。");
  }

  const result = await restoreSuspendedTeacherProfile(teacherProfileId);

  if (!result.ok) {
    return adminReviewFailure(result, {
      missing: "teacher_profile_not_found",
      changed: "teacher_profile_not_suspended",
      changedMessage: "這位老師已不是「已暫停」狀態，可能剛才已經被處理過。",
    });
  }

  revalidatePath("/admin/teachers");
  redirectToList("success", "這位老師已經恢復。", formData, teacherProfileId);
}

// teacher-showcase-photos 票 07（spec S5）：管理員下架老師的一張照片。原因必填，會以通知告訴老師；
// 結果回到這位老師的詳情頁顯示。身分與規則都在 domain 層檢查，這裡只讀表單與導回。
export async function removeTeacherPhotoAdminAction(formData: FormData): Promise<void> {
  const read = (name: string) => {
    const value = formData.get(name);

    return typeof value === "string" ? value : "";
  };
  const teacherProfileId = read("teacherProfileId");
  const returnTo = read("returnTo");
  const result = await removeTeacherPhotoForAdmin(read("photoId"), read("reason"));

  revalidatePath("/admin/teachers");
  revalidatePath(`/admin/teachers/${teacherProfileId}`);

  const base = /^[A-Za-z0-9_-]{1,64}$/.test(teacherProfileId) ? adminDetailHref("teachers", teacherProfileId, returnTo) : "/admin/teachers";
  const url = new URL(base, "https://admin.invalid");
  url.searchParams.set("result", result.ok ? "success" : "error");
  url.searchParams.set("message", result.ok ? "已下架這張照片，老師會收到通知。" : result.message);

  redirect(`${url.pathname}?${url.searchParams}#teacher-photos`);
}
