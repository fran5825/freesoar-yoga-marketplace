"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { updateOwnPaymentSettings } from "@/domain/teacher-profile/payment-settings";

export async function updatePaymentSettingsAction(formData: FormData): Promise<void> {
  const result = await updateOwnPaymentSettings({
    paymentAccountInfo: readFormString(formData, "paymentAccountInfo"),
    paymentRulesText: readFormString(formData, "paymentRulesText"),
    contactInfo: readFormString(formData, "contactInfo"),
  });

  revalidatePath("/teacher/profile/payment");
  // 驗收發現：從總覽「開始使用」進來的，儲存成功後回總覽；只認固定值，不接受任意網址。
  const fromGetStarted = readFormString(formData, "from") === "get-started";

  if (!result.ok) {
    redirectWithFeedback("error", result.message, fromGetStarted);
  }

  if (fromGetStarted) {
    revalidatePath("/teacher/dashboard");
    redirect("/teacher/dashboard?saved=payment");
  }

  redirectWithFeedback("success", "收款與聯絡資料已儲存。", false);
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function redirectWithFeedback(result: "success" | "error", message: string, fromGetStarted: boolean): never {
  const from = fromGetStarted ? "&from=get-started" : "";
  redirect(`/teacher/profile/payment?result=${result}&message=${encodeURIComponent(message)}${from}`);
}
