"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { cancelOwnEnrollment, createOwnEnrollment } from "@/domain/enrollment/service";
import { createOwnSeriesEnrollment, restoreOwnLeave } from "@/domain/enrollment/term-service";
import { parseSignInProvider } from "@/lib/auth/sign-in-providers";
import { rememberSignInReturn } from "@/lib/auth/sign-in-return";
import { classDetailHref, safeClassReturnPath } from "@/lib/navigation/class-return-path";

// member-flow-redesign 票 05：訪客在課程頁直接開始登入，不先經過 /sign-in。登入完回到同一堂課
// （含找課條件），由學員自己確認報名；這裡不建立任何報名。
export async function signInToEnrollAction(formData: FormData): Promise<void> {
  const detail = classDetailHref(
    readFormString(formData, "classSessionId"),
    safeClassReturnPath(readFormString(formData, "returnTo")),
  );
  // teacher-class-scheduling 票 14（Q5）：期班單堂頁登入回來時帶 enroll=1，報名區直接展開（仍由本人送出）。
  const destination =
    formData.get("openForm") === "1" ? `${detail}${detail.includes("?") ? "&" : "?"}enroll=1` : detail;
  const provider = parseSignInProvider(formData.get("provider"));

  if (!provider) {
    redirect(`/sign-in?error=UnsupportedProvider&callbackUrl=${encodeURIComponent(destination)}`);
  }

  await rememberSignInReturn(destination);
  await signIn(provider, { redirectTo: destination });
}

export async function enrollAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");

  const result = await createOwnEnrollment(classSessionId, {
    notes: readFormString(formData, "notes"),
    basicConsent: formData.get("basicConsent") === "yes",
  });

  revalidatePath(`/classes/${classSessionId}`);

  if (!result.ok) {
    redirectWithFeedback(
      classSessionId,
      "error",
      buildErrorMessage(result.message, result.validationErrors),
      readFormString(formData, "returnTo"),
    );
  }

  revalidatePath("/member/enrollments");
  redirectWithFeedback(
    classSessionId,
    "success",
    formData.get("reEnroll") === "1"
      ? result.status === "pending" ? "重新報名已送出，等待老師確認。" : "已重新報名。"
      : result.status === "pending" ? "報名已送出，等待老師確認。" : "報名成功。",
    readFormString(formData, "returnTo"),
  );
}

// teacher-class-scheduling 票 14（Q2）：整期和單堂都收的期班，單堂頁「我要報名」二選一，同一張表單送出。
// 整期走 createOwnSeriesEnrollment、只報這一堂走 createOwnEnrollment，規則與鎖都在原本的 service。
export async function enrollFromTermClassAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");
  const returnTo = readFormString(formData, "returnTo");
  const input = { notes: readFormString(formData, "notes"), basicConsent: formData.get("basicConsent") === "yes" };

  if (readFormString(formData, "choice") === "term") {
    const result = await createOwnSeriesEnrollment(readFormString(formData, "recurringClassSeriesId"), input);

    revalidatePath(`/classes/${classSessionId}`);
    revalidatePath("/member/enrollments");

    if (!result.ok) {
      redirectWithFeedback(classSessionId, "error", result.message, returnTo, true);
    }

    redirectWithFeedback(
      classSessionId,
      "success",
      result.status === "pending"
        ? `整期報名已送出（共 ${result.sessionCount} 堂），等待老師確認。`
        : `整期報名成功，共 ${result.sessionCount} 堂。`,
      returnTo,
    );
  }

  const result = await createOwnEnrollment(classSessionId, input);

  revalidatePath(`/classes/${classSessionId}`);
  revalidatePath("/member/enrollments");

  if (!result.ok) {
    redirectWithFeedback(classSessionId, "error", buildErrorMessage(result.message, result.validationErrors), returnTo, true);
  }

  redirectWithFeedback(
    classSessionId,
    "success",
    result.status === "pending" ? "報名已送出，等待老師確認。" : "報名成功。",
    returnTo,
  );
}

// 課程詳情頁的取消報名：規則與本人檢查全部沿用 cancelOwnEnrollment（只能取消自己的、
// 處理中／已報名、課程尚未開始），這裡只負責取消後回到同一堂課的詳情頁。
export async function cancelEnrollmentFromClassAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");
  const result = await cancelOwnEnrollment(readFormString(formData, "enrollmentId"));

  revalidatePath(`/classes/${classSessionId}`);
  revalidatePath("/member/enrollments");
  revalidatePath("/member/dashboard");

  if (!result.ok) {
    redirectWithFeedback(classSessionId, "error", result.message, readFormString(formData, "returnTo"));
  }

  redirectWithFeedback(
    classSessionId,
    "success",
    formData.get("leave") === "yes" ? "已請假這一堂，整期的其他堂照常。" : "報名已取消。",
    readFormString(formData, "returnTo"),
  );
}

// enrollment-re-enrollment 票 03：整期學員在這一堂的頁面取消請假；規則與本人檢查全部在 restoreOwnLeave。
export async function restoreLeaveFromClassAction(formData: FormData): Promise<void> {
  const classSessionId = readFormString(formData, "classSessionId");
  const result = await restoreOwnLeave(readFormString(formData, "enrollmentId"));

  revalidatePath(`/classes/${classSessionId}`);
  revalidatePath("/member/enrollments");
  revalidatePath("/member/dashboard");

  if (!result.ok) {
    redirectWithFeedback(classSessionId, "error", result.message, readFormString(formData, "returnTo"));
  }

  redirectWithFeedback(classSessionId, "success", "已取消請假，這一堂照常上課。", readFormString(formData, "returnTo"));
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function buildErrorMessage(
  message: string,
  validationErrors?: { message: string }[],
): string {
  if (!validationErrors || validationErrors.length === 0) {
    return message;
  }

  return [message, ...validationErrors.map((error) => error.message)].join(" ");
}

function redirectWithFeedback(
  classSessionId: string,
  result: "success" | "error",
  message: string,
  returnTo?: string,
  // 票 14：期班單堂頁報名失敗時，回來保持表單展開。
  keepFormOpen = false,
): never {
  const href = classDetailHref(classSessionId, safeClassReturnPath(returnTo));
  redirect(
    `${href}${href.includes("?") ? "&" : "?"}result=${result}&message=${encodeURIComponent(message)}${keepFormOpen ? "&enroll=1" : ""}`,
  );
}
