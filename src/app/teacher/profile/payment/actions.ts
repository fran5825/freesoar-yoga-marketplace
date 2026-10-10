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

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "收款與聯絡資料已儲存。");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function redirectWithFeedback(result: "success" | "error", message: string): never {
  redirect(`/teacher/profile/payment?result=${result}&message=${encodeURIComponent(message)}`);
}
