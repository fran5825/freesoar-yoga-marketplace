"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { createOwnSeriesEnrollment, withdrawOwnSeriesEnrollment } from "@/domain/enrollment/term-service";
import { parseSignInProvider } from "@/lib/auth/sign-in-providers";
import { rememberSignInReturn } from "@/lib/auth/sign-in-return";
import { safeParentReturnPath, termDetailHref } from "@/lib/navigation/class-return-path";

// teacher-class-scheduling 票 08：期班頁的整期報名。訪客先登入，回到同一個期班頁由本人確認送出。

export async function signInToEnrollTermAction(formData: FormData): Promise<void> {
  // 票 14（Q5）：登入回來時帶 enroll=1，期班頁直接展開報名表單，由本人確認送出。
  const base = termDetailHref(readFormString(formData, "recurringClassSeriesId"), readFormString(formData, "returnTo"));
  const destination = `${base}${base.includes("?") ? "&" : "?"}enroll=1`;
  const provider = parseSignInProvider(formData.get("provider"));

  if (!provider) {
    redirect(`/sign-in?error=UnsupportedProvider&callbackUrl=${encodeURIComponent(destination)}`);
  }

  await rememberSignInReturn(destination);
  await signIn(provider, { redirectTo: destination });
}

export async function enrollTermAction(formData: FormData): Promise<void> {
  const recurringClassSeriesId = readFormString(formData, "recurringClassSeriesId");
  const returnTo = safeParentReturnPath(readFormString(formData, "returnTo"));
  const result = await createOwnSeriesEnrollment(recurringClassSeriesId, {
    notes: readFormString(formData, "notes"),
    basicConsent: formData.get("basicConsent") === "yes",
  });

  revalidatePath(termHref(recurringClassSeriesId));
  revalidatePath("/member/enrollments");
  revalidatePath("/member/dashboard");

  if (!result.ok) {
    redirectWithFeedback(recurringClassSeriesId, returnTo, "error", result.message);
  }

  redirectWithFeedback(
    recurringClassSeriesId,
    returnTo,
    "success",
    result.status === "pending"
      ? `整期報名已送出（共 ${result.sessionCount} 堂），等待老師確認。`
      : `整期報名成功，共 ${result.sessionCount} 堂。`,
  );
}

// teacher-class-scheduling 票 09：退出整期（本人；規則都在 withdrawOwnSeriesEnrollment）。
export async function withdrawTermAction(formData: FormData): Promise<void> {
  const recurringClassSeriesId = readFormString(formData, "recurringClassSeriesId");
  const returnTo = safeParentReturnPath(readFormString(formData, "returnTo"));
  const result = await withdrawOwnSeriesEnrollment(readFormString(formData, "seriesEnrollmentId"));

  revalidatePath(termHref(recurringClassSeriesId));
  revalidatePath("/member/enrollments");
  revalidatePath("/member/dashboard");

  if (!result.ok) {
    redirectWithFeedback(recurringClassSeriesId, returnTo, "error", result.message);
  }

  redirectWithFeedback(
    recurringClassSeriesId,
    returnTo,
    "success",
    result.cancelledCount > 0
      ? `已退出整期，取消了之後的 ${result.cancelledCount} 堂。`
      : "已退出整期。",
  );
}

function termHref(recurringClassSeriesId: string): string {
  return `/classes/terms/${encodeURIComponent(recurringClassSeriesId)}`;
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function redirectWithFeedback(recurringClassSeriesId: string, returnTo: string, result: "success" | "error", message: string): never {
  const base = termDetailHref(recurringClassSeriesId, returnTo);
  redirect(`${base}${base.includes("?") ? "&" : "?"}result=${result}&message=${encodeURIComponent(message)}`);
}
