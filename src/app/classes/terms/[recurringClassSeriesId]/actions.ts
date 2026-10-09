"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { createOwnSeriesEnrollment } from "@/domain/enrollment/term-service";
import { parseSignInProvider } from "@/lib/auth/sign-in-providers";
import { rememberSignInReturn } from "@/lib/auth/sign-in-return";

// teacher-class-scheduling 票 08：期班頁的整期報名。訪客先登入，回到同一個期班頁由本人確認送出。

export async function signInToEnrollTermAction(formData: FormData): Promise<void> {
  const destination = termHref(readFormString(formData, "recurringClassSeriesId"));
  const provider = parseSignInProvider(formData.get("provider"));

  if (!provider) {
    redirect(`/sign-in?error=UnsupportedProvider&callbackUrl=${encodeURIComponent(destination)}`);
  }

  await rememberSignInReturn(destination);
  await signIn(provider, { redirectTo: destination });
}

export async function enrollTermAction(formData: FormData): Promise<void> {
  const recurringClassSeriesId = readFormString(formData, "recurringClassSeriesId");
  const result = await createOwnSeriesEnrollment(recurringClassSeriesId, {
    notes: readFormString(formData, "notes"),
    basicConsent: formData.get("basicConsent") === "yes",
  });

  revalidatePath(termHref(recurringClassSeriesId));
  revalidatePath("/member/enrollments");
  revalidatePath("/member/dashboard");

  if (!result.ok) {
    redirectWithFeedback(recurringClassSeriesId, "error", result.message);
  }

  redirectWithFeedback(
    recurringClassSeriesId,
    "success",
    result.status === "pending"
      ? `整期報名已送出（共 ${result.sessionCount} 堂），等待老師確認。`
      : `整期報名成功，共 ${result.sessionCount} 堂。`,
  );
}

function termHref(recurringClassSeriesId: string): string {
  return `/classes/terms/${encodeURIComponent(recurringClassSeriesId)}`;
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function redirectWithFeedback(recurringClassSeriesId: string, result: "success" | "error", message: string): never {
  redirect(`${termHref(recurringClassSeriesId)}?result=${result}&message=${encodeURIComponent(message)}`);
}
