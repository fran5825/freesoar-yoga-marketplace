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

export async function approveTeacherProfileApplicationAction(
  formData: FormData,
): Promise<void> {
  try {
    await requireAdmin();
  } catch {
    redirect(
      "/admin/teachers?result=error&message=Admin%20permission%20is%20required.",
    );
  }

  const teacherProfileId = formData.get("teacherProfileId");

  if (typeof teacherProfileId !== "string" || teacherProfileId.length === 0) {
    redirect(
      "/admin/teachers?result=error&message=TeacherProfile%20application%20is%20missing.",
    );
  }

  const result =
    await approveSubmittedTeacherProfileApplication(teacherProfileId);

  revalidatePath("/admin/teachers");

  if (!result.ok) {
    redirect(
      `/admin/teachers?result=error&message=${encodeURIComponent(result.message)}`,
    );
  }

  redirect(
    `/admin/teachers?result=success&message=${encodeURIComponent("TeacherProfile application approved.")}`,
  );
}

export async function rejectTeacherProfileApplicationAction(
  formData: FormData,
): Promise<void> {
  try {
    await requireAdmin();
  } catch {
    redirect(
      "/admin/teachers?result=error&message=Admin%20permission%20is%20required.",
    );
  }

  const teacherProfileId = formData.get("teacherProfileId");

  if (typeof teacherProfileId !== "string" || teacherProfileId.length === 0) {
    redirect(
      "/admin/teachers?result=error&message=TeacherProfile%20application%20is%20missing.",
    );
  }

  // 二次確認：沒有勾選確認就不執行 negative action（前端 required 已擋，後端再守一次）。
  if (formData.get("confirmReject") !== "yes") {
    redirect(
      `/admin/teachers?result=error&message=${encodeURIComponent("請先勾選確認，才能退回這位老師。")}`,
    );
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
    redirect(
      `/admin/teachers?result=error&message=${encodeURIComponent(result.message)}`,
    );
  }

  redirect(
    `/admin/teachers?result=success&message=${encodeURIComponent("TeacherProfile application rejected.")}`,
  );
}

export async function suspendTeacherProfileAction(
  formData: FormData,
): Promise<void> {
  try {
    await requireAdmin();
  } catch {
    redirect(
      "/admin/teachers?result=error&message=Admin%20permission%20is%20required.",
    );
  }

  const teacherProfileId = formData.get("teacherProfileId");

  if (typeof teacherProfileId !== "string" || teacherProfileId.length === 0) {
    redirect(
      "/admin/teachers?result=error&message=TeacherProfile%20is%20missing.",
    );
  }

  // 二次確認：沒有勾選確認就不執行 negative action（前端 required 已擋，後端再守一次）。
  if (formData.get("confirmSuspend") !== "yes") {
    redirect(
      `/admin/teachers?result=error&message=${encodeURIComponent("請先勾選確認，才能暫停這位老師。")}`,
    );
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
    redirect(
      `/admin/teachers?result=error&message=${encodeURIComponent(result.message)}`,
    );
  }

  redirect(
    `/admin/teachers?result=success&message=${encodeURIComponent("這位老師已經暫停。")}`,
  );
}

export async function restoreTeacherProfileAction(
  formData: FormData,
): Promise<void> {
  try {
    await requireAdmin();
  } catch {
    redirect(
      "/admin/teachers?result=error&message=Admin%20permission%20is%20required.",
    );
  }

  const teacherProfileId = formData.get("teacherProfileId");

  if (typeof teacherProfileId !== "string" || teacherProfileId.length === 0) {
    redirect(
      "/admin/teachers?result=error&message=TeacherProfile%20is%20missing.",
    );
  }

  if (formData.get("confirmRestore") !== "yes") {
    redirect(
      `/admin/teachers?result=error&message=${encodeURIComponent("請先勾選確認，才能恢復這位老師。")}`,
    );
  }

  const result = await restoreSuspendedTeacherProfile(teacherProfileId);

  revalidatePath("/admin/teachers");

  if (!result.ok) {
    redirect(
      `/admin/teachers?result=error&message=${encodeURIComponent(result.message)}`,
    );
  }

  redirect(
    `/admin/teachers?result=success&message=${encodeURIComponent("這位老師已經恢復。")}`,
  );
}
