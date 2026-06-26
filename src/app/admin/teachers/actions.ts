"use server";

import { approveSubmittedTeacherProfileApplication } from "@/domain/teacher-profile/service";
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
