"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { cancelOwnEnrollment, createOwnEnrollment } from "@/domain/enrollment/service";
import { parseSignInProvider } from "@/lib/auth/sign-in-providers";
import { rememberSignInReturn } from "@/lib/auth/sign-in-return";
import { classDetailHref, safeClassReturnPath } from "@/lib/navigation/class-return-path";

// member-flow-redesign 票 05：訪客在課程頁直接開始登入，不先經過 /sign-in。登入完回到同一堂課
// （含找課條件），由學員自己確認報名；這裡不建立任何報名。
export async function signInToEnrollAction(formData: FormData): Promise<void> {
  const destination = classDetailHref(
    readFormString(formData, "classSessionId"),
    safeClassReturnPath(readFormString(formData, "returnTo")),
  );
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
    result.status === "pending" ? "報名已送出，等待老師確認。" : "報名成功。",
    readFormString(formData, "returnTo"),
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
): never {
  const href = classDetailHref(classSessionId, safeClassReturnPath(returnTo));
  redirect(`${href}${href.includes("?") ? "&" : "?"}result=${result}&message=${encodeURIComponent(message)}`);
}
