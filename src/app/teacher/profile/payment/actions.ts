"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { updateOwnPaymentSettings } from "@/domain/teacher-profile/payment-settings";
import { safeTeacherClassReturnPath } from "@/lib/navigation/teacher-return-path";

const SAVED_MESSAGE = "收款與聯絡資料已儲存。";

export async function updatePaymentSettingsAction(formData: FormData): Promise<void> {
  const result = await updateOwnPaymentSettings({
    paymentAccountInfo: readFormString(formData, "paymentAccountInfo"),
    paymentRulesText: readFormString(formData, "paymentRulesText"),
    contactInfo: readFormString(formData, "contactInfo"),
  });

  revalidatePath("/teacher/profile/payment");
  // 驗收發現：從總覽「開始使用」進來的，儲存成功後回總覽；只認固定值，不接受任意網址。
  const fromGetStarted = readFormString(formData, "from") === "get-started";
  // wrong-route-fixes F9-1：從課程頁、系列頁的收款提醒進來的，儲存成功後回那一頁；只接受白名單路徑。
  const returnTo = safeTeacherClassReturnPath(readFormString(formData, "returnTo"));

  if (!result.ok) {
    redirectWithFeedback("error", result.message, fromGetStarted, returnTo);
  }

  if (fromGetStarted) {
    revalidatePath("/teacher/dashboard");
    redirect("/teacher/dashboard?saved=payment");
  }

  if (returnTo) {
    revalidatePath(returnTo);
    redirect(`${returnTo}?result=success&message=${encodeURIComponent(SAVED_MESSAGE)}`);
  }

  redirectWithFeedback("success", SAVED_MESSAGE, false, null);
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function redirectWithFeedback(result: "success" | "error", message: string, fromGetStarted: boolean, returnTo: string | null): never {
  const from = fromGetStarted ? "&from=get-started" : "";
  const back = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
  redirect(`/teacher/profile/payment?result=${result}&message=${encodeURIComponent(message)}${from}${back}`);
}
