"use server";

import {
  publishSubmittedDemandRequest,
  rejectSubmittedDemandRequest,
} from "@/domain/demand-request/admin-service";
import { requireAdmin } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function publishDemandRequestAction(
  formData: FormData,
): Promise<void> {
  try {
    await requireAdmin();
  } catch {
    redirect(
      "/admin/demands?result=error&message=Admin%20permission%20is%20required.",
    );
  }

  const demandRequestId = formData.get("demandRequestId");

  if (typeof demandRequestId !== "string" || demandRequestId.length === 0) {
    redirect(
      "/admin/demands?result=error&message=Demand%20request%20is%20missing.",
    );
  }

  const result = await publishSubmittedDemandRequest(demandRequestId);

  revalidatePath("/admin/demands");

  if (!result.ok) {
    redirect(
      `/admin/demands?result=error&message=${encodeURIComponent(result.message)}`,
    );
  }

  redirect(
    `/admin/demands?result=success&message=${encodeURIComponent("需求已公開。")}`,
  );
}

export async function rejectDemandRequestAction(
  formData: FormData,
): Promise<void> {
  try {
    await requireAdmin();
  } catch {
    redirect(
      "/admin/demands?result=error&message=Admin%20permission%20is%20required.",
    );
  }

  const demandRequestId = formData.get("demandRequestId");

  if (typeof demandRequestId !== "string" || demandRequestId.length === 0) {
    redirect(
      "/admin/demands?result=error&message=Demand%20request%20is%20missing.",
    );
  }

  // 二次確認：沒有勾選確認就不執行 negative action（前端 required 已擋，後端再守一次）。
  if (formData.get("confirmReject") !== "yes") {
    redirect(
      `/admin/demands?result=error&message=${encodeURIComponent("請先勾選確認，才能退回這筆需求。")}`,
    );
  }

  const rejectionReasonValue = formData.get("rejectionReason");
  const rejectionReason =
    typeof rejectionReasonValue === "string" ? rejectionReasonValue : "";

  const result = await rejectSubmittedDemandRequest(
    demandRequestId,
    rejectionReason,
  );

  revalidatePath("/admin/demands");

  if (!result.ok) {
    redirect(
      `/admin/demands?result=error&message=${encodeURIComponent(result.message)}`,
    );
  }

  redirect(
    `/admin/demands?result=success&message=${encodeURIComponent("需求已退回。")}`,
  );
}
