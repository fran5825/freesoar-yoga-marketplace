// __internal__：這個目錄不是通用 API。這裡的函式刻意不呼叫 requireUser()/
// requireApprovedTeacher()，只給 (1) 各自唯一的 auth-resolving 外層
// （organizer-select-service.ts 的 selectDemandResponse、service.ts 的
// submitOwnDemandResponse）與 (2) Playwright 併發測試直接呼叫。
//
// 這不是靠呼叫慣例把關：擁有權／資格檢查都內建在同一個原子 SQL 陳述式裡
// （見下方），就算被非預期的呼叫方直接 import 呼叫，也不會產生「選中別人
// demand 底下的 response」或「非 approved teacher 成功提交」這類資料不一致。
// 詳見 plan 第 4 節第 8 點。

import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";
import type { DemandRequestStatus, DemandResponseStatus } from "@prisma/client";

import { markDemandRequestAsMatchedIfPublished } from "@/domain/demand-request/matching-service";
import { listAdminUserIds } from "@/domain/notification/admin-recipients";
import { notifyUsers } from "@/domain/notification/create";
import { prisma } from "@/lib/prisma";

// D1/D11：submit 時的 eligibility 判斷依 D11=B 固定為 published。
const eligibleStatusesForSubmit: DemandRequestStatus[] = ["published"];

export type OwnDemandResponse = {
  id: string;
  demandRequestId: string;
  teacherProfileId: string;
  message: string;
  proposedTimeSlots: string[];
  proposedPrice: string | null;
  status: DemandResponseStatus;
  createdAt: Date;
  updatedAt: Date;
};

export const ownDemandResponseSelect = {
  id: true,
  demandRequestId: true,
  teacherProfileId: true,
  message: true,
  proposedTimeSlots: true,
  proposedPrice: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

// D5：submit／select 共用的 demand-level lock 同步點，僅供 Slice 4 的鎖測試使用。
// 正式路徑（submitOwnDemandResponse／selectDemandResponse）呼叫時不傳 hooks，
// 兩個 await 在生產路徑上恆為 no-op。
export type DemandLockHooks = {
  onBeforeLock?: () => void | Promise<void>;
  onLockAcquired?: () => void | Promise<void>;
};

// ---------------------------------------------------------------------------
// submit
// ---------------------------------------------------------------------------

export type SubmitDemandResponseForTeacherErrorCode =
  | "not_eligible"
  | "response_already_exists"
  | "submit_failed";

export type SubmitDemandResponseForTeacherResult =
  | { ok: true; demandResponse: OwnDemandResponse }
  | { ok: false; code: SubmitDemandResponseForTeacherErrorCode };

// D4/§4 規則8：整段包在 prisma.$transaction 內——(a) 先鎖住 demand，(b) 原子 INSERT
// 同時檢查「demand 當下仍 eligible」與「teacher 當下仍 approved」，不得用 findUnique
// 檢查再分開 create（見 service.ts 既有註解，這裡把它遷入同一個原子語句的一部分）。
export async function submitDemandResponseForTeacher(
  teacherProfileId: string,
  demandRequestId: string,
  input: { message: string; proposedTimeSlots: string[]; proposedPrice: string | null },
  hooks?: DemandLockHooks,
): Promise<SubmitDemandResponseForTeacherResult> {
  const id = randomUUID();
  const now = new Date();
  const { message, proposedTimeSlots, proposedPrice } = input;

  try {
    const insertedRows = await prisma.$transaction(async (tx) => {
      await hooks?.onBeforeLock?.();
      await tx.$queryRaw`
        SELECT "id" FROM "DemandRequest" WHERE "id" = ${demandRequestId} FOR UPDATE
      `;
      await hooks?.onLockAcquired?.();

      return tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "DemandResponse"
          ("id", "demandRequestId", "teacherProfileId", "message", "proposedTimeSlots", "proposedPrice", "status", "createdAt", "updatedAt")
        SELECT
          ${id}, ${demandRequestId}, ${teacherProfileId}, ${message}, ${proposedTimeSlots}::text[], ${proposedPrice}, 'submitted'::"DemandResponseStatus", ${now}, ${now}
        WHERE EXISTS (
          SELECT 1 FROM "DemandRequest"
          WHERE "id" = ${demandRequestId} AND "status" = ANY(${eligibleStatusesForSubmit}::"DemandRequestStatus"[])
        )
        AND EXISTS (
          SELECT 1 FROM "TeacherProfile"
          WHERE "id" = ${teacherProfileId} AND "status" = 'approved'::"TeacherProfileStatus"
        )
        RETURNING "id"
      `;
    });

    if (insertedRows.length === 0) {
      return { ok: false, code: "not_eligible" };
    }

    const demandResponse = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: insertedRows[0].id },
      select: ownDemandResponseSelect,
    });

    // D4/D7 修正版：resolver query + notifyUsers 一律在 tx commit 之後才執行，不進 tx。
    try {
      const detail = await prisma.demandResponse.findUnique({
        where: { id: demandResponse.id },
        select: {
          teacherProfile: { select: { displayName: true } },
          demandRequest: {
            select: { title: true, organizerProfile: { select: { userId: true } } },
          },
        },
      });

      if (detail) {
        const adminIds = await listAdminUserIds();
        await notifyUsers(
          "demand_response_submitted",
          [
            { userId: detail.demandRequest.organizerProfile.userId, role: "counterpart" },
            ...adminIds.map((id) => ({ userId: id, role: "admin" as const })),
          ],
          {
            actorLabel: detail.teacherProfile.displayName ?? undefined,
            demandTitle: detail.demandRequest.title ?? undefined,
          },
        );
      }
    } catch (notifyError) {
      console.error("[notification] demand_response_submitted trigger failed", notifyError);
    }

    return { ok: true, demandResponse };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return { ok: false, code: "response_already_exists" };
    }

    return { ok: false, code: "submit_failed" };
  }
}

// ---------------------------------------------------------------------------
// select
// ---------------------------------------------------------------------------

export type SelectDemandResponseForOrganizerErrorCode =
  | "demand_response_not_found"
  | "response_not_submitted"
  | "response_demand_already_matched"
  | "select_failed";

export type SelectDemandResponseForOrganizerResult =
  | { ok: true; demandResponseId: string; demandRequestId: string }
  | { ok: false; code: SelectDemandResponseForOrganizerErrorCode };

class SelectDemandResponseNotFoundError extends Error {
  constructor() {
    super("Demand response not found or not owned by this organizer");
    this.name = "SelectDemandResponseNotFoundError";
  }
}

class SelectDemandResponseNotSelectableError extends Error {
  constructor(
    public readonly code: Extract<
      SelectDemandResponseForOrganizerErrorCode,
      "response_not_submitted" | "response_demand_already_matched"
    >,
  ) {
    super("Demand response is not currently selectable");
    this.name = "SelectDemandResponseNotSelectableError";
  }
}

// D3/D4/D5：select 成功時，同一 transaction 內 (a) 鎖住 demand、(b) 原子把該 response
// 轉 selected、(c) 其餘 submitted response 轉 declined、(d) DemandRequest 轉 matched。
// 任一步失敗（(b) 0 列 或 (d) throw）整段 rollback，not-found 語意不洩漏擁有權差異。
export async function selectDemandResponseForOrganizer(
  organizerProfileId: string,
  demandResponseId: string,
  hooks?: DemandLockHooks,
): Promise<SelectDemandResponseForOrganizerResult> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await hooks?.onBeforeLock?.();

      // 同時解析並鎖住這筆 response 所屬的 DemandRequest，且原子驗證擁有權——
      // 非法或不屬於自己的 demandResponseId 在這裡就會查不到列。
      const lockedDemand = await tx.$queryRaw<{ id: string }[]>`
        SELECT dr."id"
        FROM "DemandRequest" dr
        JOIN "DemandResponse" resp ON resp."demandRequestId" = dr."id"
        WHERE resp."id" = ${demandResponseId} AND dr."organizerProfileId" = ${organizerProfileId}
        FOR UPDATE OF dr
      `;

      if (lockedDemand.length === 0) {
        throw new SelectDemandResponseNotFoundError();
      }

      const demandRequestId = lockedDemand[0].id;

      await hooks?.onLockAcquired?.();

      const now = new Date();
      const selectedRows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "DemandResponse"
        SET "status" = 'selected'::"DemandResponseStatus", "updatedAt" = ${now}
        WHERE "id" = ${demandResponseId}
          AND "status" = 'submitted'::"DemandResponseStatus"
          AND NOT EXISTS (
            SELECT 1 FROM "DemandResponse" AS other
            WHERE other."demandRequestId" = ${demandRequestId} AND other."status" = 'selected'::"DemandResponseStatus"
          )
        RETURNING "id"
      `;

      if (selectedRows.length === 0) {
        const existingSelected = await tx.demandResponse.findFirst({
          where: { demandRequestId, status: "selected" },
          select: { id: true },
        });

        throw new SelectDemandResponseNotSelectableError(
          existingSelected ? "response_demand_already_matched" : "response_not_submitted",
        );
      }

      await tx.demandResponse.updateMany({
        where: {
          demandRequestId,
          status: "submitted",
          id: { not: demandResponseId },
        },
        data: { status: "declined" },
      });

      await markDemandRequestAsMatchedIfPublished(tx, demandRequestId);

      return { demandResponseId, demandRequestId };
    });

    // D4/D7 修正版：resolver query + notifyUsers 一律在 tx commit 之後才執行，不進 tx。
    try {
      const detail = await prisma.demandResponse.findUnique({
        where: { id: result.demandResponseId },
        select: {
          teacherProfile: { select: { userId: true } },
          demandRequest: {
            select: { title: true, organizerProfile: { select: { userId: true } } },
          },
        },
      });

      if (detail) {
        await notifyUsers(
          "demand_response_selected",
          [
            { userId: detail.demandRequest.organizerProfile.userId, role: "self" },
            { userId: detail.teacherProfile.userId, role: "counterpart" },
          ],
          { demandTitle: detail.demandRequest.title ?? undefined },
        );
      }
    } catch (notifyError) {
      console.error("[notification] demand_response_selected trigger failed", notifyError);
    }

    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof SelectDemandResponseNotFoundError) {
      return { ok: false, code: "demand_response_not_found" };
    }

    if (error instanceof SelectDemandResponseNotSelectableError) {
      return { ok: false, code: error.code };
    }

    // 理論上不會發生：select 自己的原子 UPDATE 已經在同一把鎖底下確認過
    // demand 尚無 selected response，此時 DemandRequest 只可能仍是 published。
    // 防禦性地保留這個分支，避免萬一未來狀態機變動時靜默吞掉不一致。
    return { ok: false, code: "select_failed" };
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return true;
  }

  // Raw query 的 unique violation 經 Prisma 包裝為 P2010，訊息含底層 Postgres 錯誤碼 23505。
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2010" &&
    typeof error.message === "string" &&
    error.message.includes("23505")
  ) {
    return true;
  }

  return false;
}
