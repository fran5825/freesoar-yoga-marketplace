"use server";

import {
  publishSubmittedDemandRequest,
  rejectSubmittedDemandRequest,
} from "@/domain/demand-request/admin-service";
import { requireAdmin } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// admin-usability 票 07：審核完成後回到需求列表（預設停在「待審」），列表頂端顯示成功提示；
// 失敗則留在這筆需求的詳情頁顯示原因，管理員不用重找。
function redirectToList(result: "success" | "error", message: string): never {
  redirect(`/admin/demands?result=${result}&message=${encodeURIComponent(message)}`);
}

function redirectToDetail(demandRequestId: string, message: string): never {
  redirect(
    `/admin/demands/${encodeURIComponent(demandRequestId)}?result=error&message=${encodeURIComponent(message)}`,
  );
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

export async function publishDemandRequestAction(
  formData: FormData,
): Promise<void> {
  const demandRequestId = await readDemandRequestId(formData);

  const result = await publishSubmittedDemandRequest(demandRequestId);

  revalidatePath("/admin/demands");

  if (!result.ok) {
    redirectToDetail(demandRequestId, result.message);
  }

  redirectToList("success", "需求已公開。");
}

export async function rejectDemandRequestAction(
  formData: FormData,
): Promise<void> {
  const demandRequestId = await readDemandRequestId(formData);

  // 後端再守一次確認欄位：表單以隱藏欄位帶入，代表管理員已在畫面上明確按下「退回需求」。
  if (formData.get("confirmReject") !== "yes") {
    redirectToDetail(demandRequestId, "請確認要退回這筆需求。");
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
    redirectToDetail(demandRequestId, result.message);
  }

  redirectToList("success", "需求已退回，退回原因會顯示給團主。");
}
