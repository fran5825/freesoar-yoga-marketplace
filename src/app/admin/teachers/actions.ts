"use server";

import {
  approveSubmittedTeacherProfileApplication,
  rejectSubmittedTeacherProfileApplication,
  restoreSuspendedTeacherProfile,
  suspendApprovedTeacherProfile,
} from "@/domain/teacher-profile/service";
import { requireAdmin } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// admin-usability 票 06：審核完成後回到老師列表（預設停在「待審」），列表頂端顯示成功提示；
// 失敗則留在這位老師的詳情頁顯示原因，管理員不用重找。
function redirectToList(result: "success" | "error", message: string): never {
  redirect(`/admin/teachers?result=${result}&message=${encodeURIComponent(message)}`);
}

function redirectToDetail(teacherProfileId: string, message: string): never {
  redirect(
    `/admin/teachers/${encodeURIComponent(teacherProfileId)}?result=error&message=${encodeURIComponent(message)}`,
  );
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

export async function approveTeacherProfileApplicationAction(
  formData: FormData,
): Promise<void> {
  const teacherProfileId = await readTeacherProfileId(formData);

  const result = await approveSubmittedTeacherProfileApplication(teacherProfileId);

  revalidatePath("/admin/teachers");

  if (!result.ok) {
    redirectToDetail(teacherProfileId, result.message);
  }

  redirectToList("success", "已通過這位老師的申請。");
}

export async function rejectTeacherProfileApplicationAction(
  formData: FormData,
): Promise<void> {
  const teacherProfileId = await readTeacherProfileId(formData);

  // 後端再守一次確認欄位：表單以隱藏欄位帶入，代表管理員已在畫面上明確按下「退回申請」。
  if (formData.get("confirmReject") !== "yes") {
    redirectToDetail(teacherProfileId, "請確認要退回這位老師的申請。");
  }

  const rejectionReasonValue = formData.get("rejectionReason");
  const rejectionReason =
    typeof rejectionReasonValue === "string" ? rejectionReasonValue : "";

  const result = await rejectSubmittedTeacherProfileApplication(
    teacherProfileId,
    rejectionReason,
  );

  revalidatePath("/admin/teachers");

  if (!result.ok) {
    redirectToDetail(teacherProfileId, result.message);
  }

  redirectToList("success", "已退回這位老師的申請，退回原因會顯示給老師。");
}

export async function suspendTeacherProfileAction(
  formData: FormData,
): Promise<void> {
  const teacherProfileId = await readTeacherProfileId(formData);

  if (formData.get("confirmSuspend") !== "yes") {
    redirectToDetail(teacherProfileId, "請確認要暫停這位老師。");
  }

  const suspensionReasonValue = formData.get("suspensionReason");
  const suspensionReason =
    typeof suspensionReasonValue === "string" ? suspensionReasonValue : "";

  const result = await suspendApprovedTeacherProfile(
    teacherProfileId,
    suspensionReason,
  );

  revalidatePath("/admin/teachers");

  if (!result.ok) {
    redirectToDetail(teacherProfileId, result.message);
  }

  redirectToList("success", "這位老師已經暫停。");
}

export async function restoreTeacherProfileAction(
  formData: FormData,
): Promise<void> {
  const teacherProfileId = await readTeacherProfileId(formData);

  if (formData.get("confirmRestore") !== "yes") {
    redirectToDetail(teacherProfileId, "請確認要恢復這位老師。");
  }

  const result = await restoreSuspendedTeacherProfile(teacherProfileId);

  revalidatePath("/admin/teachers");

  if (!result.ok) {
    redirectToDetail(teacherProfileId, result.message);
  }

  redirectToList("success", "這位老師已經恢復。");
}
