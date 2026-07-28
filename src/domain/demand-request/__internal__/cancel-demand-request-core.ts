// __internal__：不是通用 API。只給 (1) 唯一的 auth-resolving 外層（service.ts 的
// cancelOwnDemandRequest）與 (2) Playwright 併發測試直接呼叫——取消動作要跟
// submitDemandResponseForTeacher／selectDemandResponseForOrganizer／
// createClassSessionForOrganizer 三個既有 mutation 搶同一個 DemandRequest 資源，全部
// 用 SELECT ... FOR UPDATE 鎖住同一行，比照 class-session/__internal__/
// cancel-class-session-core.ts 已驗證過的同一套架構。

import type { NotificationType } from "@prisma/client";

import { notifyUsers } from "@/domain/notification/create";
import type { NotificationPayload, NotificationRecipient } from "@/domain/notification/types";
import { prisma } from "@/lib/prisma";

// 供 D11 端到端失敗隔離測試注入；預設值就是「解析收件人 + 呼叫 notifyUsers」的真正邏輯。
export type NotifyFn = (
  type: NotificationType,
  recipients: NotificationRecipient[],
  payload: NotificationPayload,
) => Promise<void>;

export type DemandLockHooks = {
  onBeforeLock?: () => void | Promise<void>;
  onLockAcquired?: () => void | Promise<void>;
};

export type CancelDemandRequestForOrganizerErrorCode =
  | "demand_request_not_found"
  | "demand_request_already_cancelled"
  | "demand_request_not_cancellable"
  | "cancel_failed";

export type CancelDemandRequestForOrganizerResult =
  | { ok: true }
  | { ok: false; code: CancelDemandRequestForOrganizerErrorCode };

class DemandRequestNotFoundError extends Error {
  constructor() {
    super("Demand request not found or not owned by this organizer");
    this.name = "DemandRequestNotFoundError";
  }
}

class DemandRequestAlreadyCancelledError extends Error {
  constructor() {
    super("Demand request is already cancelled");
    this.name = "DemandRequestAlreadyCancelledError";
  }
}

class DemandRequestNotCancellableError extends Error {
  constructor() {
    super("Demand request is not in a cancellable state");
    this.name = "DemandRequestNotCancellableError";
  }
}

// D1/D2：draft/submitted/published/matched 可取消；converted_to_class 明確排除
// （這個狀態已經有 ClassSession 存在，取消 demand 會產生語意矛盾的資料，見 plan 2.2）。
const CANCELLABLE_STATUSES = new Set(["draft", "submitted", "published", "matched"]);

// D1/D2/D4/D5：own-scoped，整段包在 prisma.$transaction 內：
// (a) 鎖住 DemandRequest 並驗證擁有權（WHERE 子句本身就同時驗證 organizerProfileId，
//     跟既有的 submitDemandResponseForTeacher/selectDemandResponseForOrganizer/
//     createClassSessionForOrganizer 搶同一把鎖）；
// (b) 檢查尚未是 cancelled；
// (c) 檢查狀態在可取消集合內；
// (d) 轉成 cancelled；
// (e) 連帶把所有 status IN ('submitted','selected') 的 DemandResponse 轉成
//     declined，RETURNING teacherProfileId 供通知使用（D4，不新增 DemandResponseStatus
//     新值，reuse 既有的 declined）。
export async function cancelDemandRequestForOrganizer(
  organizerProfileId: string,
  demandRequestId: string,
  hooks?: DemandLockHooks,
  notifyOverride: NotifyFn = notifyUsers,
): Promise<CancelDemandRequestForOrganizerResult> {
  try {
    const { title, affectedTeacherProfileIds } = await prisma.$transaction(async (tx) => {
      await hooks?.onBeforeLock?.();

      const lockedDemand = await tx.$queryRaw<
        { id: string; status: string; title: string | null }[]
      >`
        SELECT "id", "status", "title"
        FROM "DemandRequest"
        WHERE "id" = ${demandRequestId} AND "organizerProfileId" = ${organizerProfileId}
        FOR UPDATE
      `;

      if (lockedDemand.length === 0) {
        throw new DemandRequestNotFoundError();
      }

      await hooks?.onLockAcquired?.();

      const demand = lockedDemand[0];

      if (demand.status === "cancelled") {
        throw new DemandRequestAlreadyCancelledError();
      }

      if (!CANCELLABLE_STATUSES.has(demand.status)) {
        throw new DemandRequestNotCancellableError();
      }

      await tx.demandRequest.update({
        where: { id: demandRequestId },
        data: { status: "cancelled" },
      });

      const now = new Date();
      const cascadedResponses = await tx.$queryRaw<{ teacherProfileId: string }[]>`
        UPDATE "DemandResponse"
        SET "status" = 'declined'::"DemandResponseStatus", "updatedAt" = ${now}
        WHERE "demandRequestId" = ${demandRequestId} AND "status" IN ('submitted', 'selected')
        RETURNING "teacherProfileId"
      `;

      return {
        title: demand.title,
        affectedTeacherProfileIds: cascadedResponses.map((row) => row.teacherProfileId),
      };
    });

    // D4/D9 修正版：resolver query + notify 一律在 tx commit 之後才執行，不進 tx；
    // 例外在這裡被吞掉，不影響回傳給呼叫端的結果。
    try {
      const organizerProfile = await prisma.organizerProfile.findUnique({
        where: { id: organizerProfileId },
        select: { userId: true },
      });

      const recipients: NotificationRecipient[] = [];

      if (organizerProfile) {
        recipients.push({ userId: organizerProfile.userId, role: "self" });
      }

      if (affectedTeacherProfileIds.length > 0) {
        const teacherProfiles = await prisma.teacherProfile.findMany({
          where: { id: { in: affectedTeacherProfileIds } },
          select: { userId: true },
        });

        for (const teacherProfile of teacherProfiles) {
          recipients.push({ userId: teacherProfile.userId, role: "affected_responder" });
        }
      }

      await notifyOverride("demand_request_cancelled", recipients, {
        demandTitle: title ?? undefined,
      });
    } catch (notifyError) {
      console.error("[notification] demand_request_cancelled trigger failed", notifyError);
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof DemandRequestNotFoundError) {
      return { ok: false, code: "demand_request_not_found" };
    }

    if (error instanceof DemandRequestAlreadyCancelledError) {
      return { ok: false, code: "demand_request_already_cancelled" };
    }

    if (error instanceof DemandRequestNotCancellableError) {
      return { ok: false, code: "demand_request_not_cancellable" };
    }

    return { ok: false, code: "cancel_failed" };
  }
}
