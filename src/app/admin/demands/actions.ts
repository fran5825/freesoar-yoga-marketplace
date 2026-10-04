"use server";

import {
  publishSubmittedDemandRequest,
  rejectSubmittedDemandRequest,
} from "@/domain/demand-request/admin-service";
import { requireAdmin } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminActionError, adminReviewFailure, type AdminActionState } from "../_lib/action-state";
import { adminFeedbackHref } from "../_lib/list-context";

// admin-usability 票 07：審核完成後回到需求列表（保留原搜尋／分類），列表頂端顯示成功提示。
function redirectToList(result: "success" | "error", message: string, formData?: FormData, item?: string): never {
  redirect(adminFeedbackHref("demands", formData?.get("returnTo"), result, message, item));
}

async function readDemandRequestId(formData: FormData): Promise<string> {
  try {
    await requireAdmin();
  } catch {
    redirectToList("error", "需要管理員權限才能執行這個操作。");
  }

  const demandRequestId = formData.get("demandRequestId");

  if (typeof demandRequestId !== "string" || demandRequestId.length === 0) {
    redirectToList("error", "找不到這筆需求。");
  }

  return demandRequestId;
}

// 第二批票 06：沿用票 05 的審核回饋模式。失敗一律回傳狀態、不跳頁，已填原因留在本頁；
// 只有成功時才 revalidate 並回原列表。資格已變時標記 stale，畫面停用審核並提供重新載入／回列表。
function reviewFailure(result: { code: string; message: string }): AdminActionState {
  return adminReviewFailure(result, {
    missing: "demand_request_not_found",
    changed: "demand_request_not_submitted",
    changedMessage: "這筆需求已不是待審狀態，可能剛才已經被處理過。",
  });
}

export async function publishDemandRequestAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const demandRequestId = await readDemandRequestId(formData);

  const result = await publishSubmittedDemandRequest(demandRequestId);

  if (!result.ok) {
    return reviewFailure(result);
  }

  revalidatePath("/admin/demands");
  redirectToList("success", "需求已公開。", formData, demandRequestId);
}

export async function rejectDemandRequestAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const demandRequestId = await readDemandRequestId(formData);

  // 後端再守一次確認欄位：表單以隱藏欄位帶入，代表管理員已在畫面上明確展開並送出退回。
  if (formData.get("confirmReject") !== "yes") {
    return adminActionError("請確認要退回這筆需求。");
  }

  const rejectionReasonValue = formData.get("rejectionReason");
  const rejectionReason =
    typeof rejectionReasonValue === "string" ? rejectionReasonValue : "";

  const result = await rejectSubmittedDemandRequest(
    demandRequestId,
    rejectionReason,
  );

  if (!result.ok) {
    return reviewFailure(result);
  }

  revalidatePath("/admin/demands");
  redirectToList("success", "需求已退回，退回原因會顯示給團主，團主需另建一筆需求。", formData, demandRequestId);
}
