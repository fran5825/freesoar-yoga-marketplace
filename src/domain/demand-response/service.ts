import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";
import type { DemandRequestStatus, DemandResponseStatus } from "@prisma/client";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { requireApprovedTeacher } from "./capability";
import {
  type DemandResponseWithdrawTransitionErrorCode,
  validateDemandResponseWithdrawTransition,
} from "./state";
import {
  type DemandResponseSubmitInput,
  type DemandResponseValidationError,
  validateDemandResponseSubmit,
} from "./validation";

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

const ownDemandResponseSelect = {
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

export type DemandResponseSubmitErrorCode =
  | "authentication_required"
  | "not_approved_teacher"
  | "submit_validation_failed"
  | "demand_not_eligible"
  | "response_already_exists"
  | "demand_response_submit_failed";

export type DemandResponseSubmitResult =
  | { ok: true; demandResponse: OwnDemandResponse }
  | {
      ok: false;
      code: DemandResponseSubmitErrorCode;
      message: string;
      validationErrors?: DemandResponseValidationError[];
    };

export type DemandResponseWithdrawErrorCode =
  | "authentication_required"
  | "teacher_profile_required"
  | "teacher_not_approved_cannot_withdraw"
  | DemandResponseWithdrawTransitionErrorCode
  | "demand_response_not_found"
  | "demand_response_withdraw_failed";

export type DemandResponseWithdrawResult =
  | { ok: true; demandResponse: OwnDemandResponse }
  | {
      ok: false;
      code: DemandResponseWithdrawErrorCode;
      message: string;
    };

// D4/§4 規則8：submit 必須以單一原子語句同時確認「demand 當下仍 eligible」與
// 「該 teacher 尚無有效 response」，不得用 findUnique 檢查再分開 create。
export async function submitOwnDemandResponse(
  demandRequestId: string,
  input: DemandResponseSubmitInput,
): Promise<DemandResponseSubmitResult> {
  const validation = validateDemandResponseSubmit(input);

  if (!validation.valid) {
    return {
      ok: false,
      code: "submit_validation_failed",
      message: "送出回應前，請先補齊必填欄位。",
      validationErrors: validation.errors,
    };
  }

  let teacherProfileId: string;

  try {
    const capability = await requireApprovedTeacher();
    teacherProfileId = capability.teacherProfileId;
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再回應這則需求。",
      };
    }

    return {
      ok: false,
      code: "not_approved_teacher",
      message: "你的老師資格審核完成後，就可以在這裡回應需求。",
    };
  }

  const id = randomUUID();
  const now = new Date();
  const { message, proposedTimeSlots, proposedPrice } = validation.normalized;

  try {
    const insertedRows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "DemandResponse"
        ("id", "demandRequestId", "teacherProfileId", "message", "proposedTimeSlots", "proposedPrice", "status", "createdAt", "updatedAt")
      SELECT
        ${id}, ${demandRequestId}, ${teacherProfileId}, ${message}, ${proposedTimeSlots}::text[], ${proposedPrice}, 'submitted'::"DemandResponseStatus", ${now}, ${now}
      WHERE EXISTS (
        SELECT 1 FROM "DemandRequest"
        WHERE "id" = ${demandRequestId} AND "status" = ANY(${eligibleStatusesForSubmit}::"DemandRequestStatus"[])
      )
      RETURNING "id"
    `;

    if (insertedRows.length === 0) {
      return {
        ok: false,
        code: "demand_not_eligible",
        message: "這則需求目前無法回應，可能已不再公開。",
      };
    }

    const demandResponse = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: insertedRows[0].id },
      select: ownDemandResponseSelect,
    });

    return { ok: true, demandResponse };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return {
        ok: false,
        code: "response_already_exists",
        message: "你已經對這則需求提交過回應了，withdraw 後也無法再重新提交。",
      };
    }

    return {
      ok: false,
      code: "demand_response_submit_failed",
      message: "回應暫時無法送出，請稍後再試。",
    };
  }
}

// D10：withdraw 不論 DemandRequest 當下狀態如何，只要 own response 仍為 submitted 即可。
// D12：withdraw 額外顯式檢查 teacherProfile.status === "approved"（suspended 不可 withdraw），
// 不透過 requireApprovedTeacher()，因為那會連「查看」都一併擋掉。
export async function withdrawOwnDemandResponse(
  demandResponseId: string,
): Promise<DemandResponseWithdrawResult> {
  try {
    const currentUser = await requireUser();

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: currentUser.id },
      select: { id: true, status: true },
    });

    if (!teacherProfile) {
      return {
        ok: false,
        code: "teacher_profile_required",
        message: "找不到你的老師資料。",
      };
    }

    if (teacherProfile.status !== "approved") {
      return {
        ok: false,
        code: "teacher_not_approved_cannot_withdraw",
        message: "此帳號目前狀態不能撤回回應。若需要協助，請聯繫平台管理者。",
      };
    }

    const existingResponse = await prisma.demandResponse.findFirst({
      where: { id: demandResponseId, teacherProfileId: teacherProfile.id },
      select: { status: true },
    });

    if (!existingResponse) {
      return {
        ok: false,
        code: "demand_response_not_found",
        message: "找不到這筆回應，或你沒有權限操作。",
      };
    }

    const transition = validateDemandResponseWithdrawTransition(
      existingResponse.status,
    );

    if (!transition.allowed) {
      return {
        ok: false,
        code: transition.code,
        message: withdrawTransitionBlockedMessage(transition.code),
      };
    }

    const updateResult = await prisma.demandResponse.updateMany({
      where: {
        id: demandResponseId,
        teacherProfileId: teacherProfile.id,
        status: "submitted",
      },
      data: { status: "withdrawn" },
    });

    if (updateResult.count === 0) {
      return {
        ok: false,
        code: "demand_response_not_found",
        message: "這筆回應目前狀態不允許撤回，請重新整理後確認狀態。",
      };
    }

    const demandResponse = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: demandResponseId },
      select: ownDemandResponseSelect,
    });

    return { ok: true, demandResponse };
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return {
        ok: false,
        code: "authentication_required",
        message: "請先登入後再撤回回應。",
      };
    }

    return {
      ok: false,
      code: "demand_response_withdraw_failed",
      message: "回應暫時無法撤回，請稍後再試。",
    };
  }
}

// D12：查看 own response 不受 approved-teacher-only 的 eligibility gate 限制——
// 任何曾建立過 TeacherProfile 的 user 皆可查看自己的既有 response，不檢查
// TeacherProfile.status 或 DemandRequest.status 是否仍 eligible。
export async function getOwnDemandResponseForDemand(
  demandRequestId: string,
): Promise<OwnDemandResponse | null> {
  const currentUser = await requireUser();

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true },
  });

  if (!teacherProfile) {
    return null;
  }

  return prisma.demandResponse.findFirst({
    where: {
      demandRequestId,
      teacherProfileId: teacherProfile.id,
    },
    select: ownDemandResponseSelect,
  });
}

function withdrawTransitionBlockedMessage(
  code: DemandResponseWithdrawTransitionErrorCode,
): string {
  if (code === "withdrawn_response_cannot_withdraw_again") {
    return "這筆回應已經撤回過了。";
  }

  if (code === "selected_response_cannot_withdraw") {
    return "已被選中的回應無法自行撤回，請聯繫平台管理者。";
  }

  return "這筆回應目前狀態不允許撤回。";
}

function isAuthenticationRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === "Authentication required";
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
