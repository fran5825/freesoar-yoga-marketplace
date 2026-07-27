// __internal__：不是通用 API。只給 (1) 唯一的 auth-resolving 外層（service.ts 的
// createOwnClassSession）與 (2) Playwright 併發測試直接呼叫。擁有權驗證內建在鎖查詢的
// WHERE 子句本身，就算被非預期的呼叫方直接 import 呼叫，也不會建立到別人 demand 底下的
// class session（比照 demand-response domain 已驗證過的同一設計，見該 domain 的
// __internal__/select-and-submit-core.ts）。

import { prisma } from "@/lib/prisma";
import { markDemandRequestAsConvertedToClassIfMatched } from "@/domain/demand-request/matching-service";

export type DemandLockHooks = {
  onBeforeLock?: () => void | Promise<void>;
  onLockAcquired?: () => void | Promise<void>;
};

export type CreateClassSessionInput = {
  title: string;
  description: string | null;
  serviceType: string;
  startAt: Date;
  endAt: Date;
  location: string;
  capacity: number;
  isPublic: boolean;
};

export type CreateClassSessionForOrganizerErrorCode =
  | "demand_not_found"
  | "class_session_already_exists"
  | "demand_not_matched"
  | "demand_not_ready"
  | "create_failed";

export type CreateClassSessionForOrganizerResult =
  | { ok: true; classSessionId: string }
  | { ok: false; code: CreateClassSessionForOrganizerErrorCode };

class DemandNotFoundError extends Error {
  constructor() {
    super("Demand request not found or not owned by this organizer");
    this.name = "DemandNotFoundError";
  }
}

class ClassSessionAlreadyExistsError extends Error {
  constructor() {
    super("This demand request already has a class session");
    this.name = "ClassSessionAlreadyExistsError";
  }
}

class DemandNotMatchedError extends Error {
  constructor() {
    super("Demand request is not in a matched state");
    this.name = "DemandNotMatchedError";
  }
}

class DemandNotReadyError extends Error {
  constructor() {
    super("Demand request has no selected response");
    this.name = "DemandNotReadyError";
  }
}

// D1/D2/D5：own-scoped、one-shot 建立。整段包在 prisma.$transaction 內：
// (a) 鎖住 demand 並驗證擁有權，同時取回 status/organizationId；
// (b) 在檢查 status 之前先查是否已有 class session（順序刻意如此——demand 一旦轉換成
//     converted_to_class，status 檢查會先於 unique 約束擋下，導致 class_session_already_exists
//     這個錯誤碼在正常重試路徑下永遠碰不到，見 plan Slice 2 說明）；
// (c) 檢查 status === matched；
// (d) 查出 selected DemandResponse 的 teacherProfileId；
// (e) 建立 ClassSession；
// (f) 呼叫 markDemandRequestAsConvertedToClassIfMatched。
export async function createClassSessionForOrganizer(
  organizerProfileId: string,
  demandRequestId: string,
  input: CreateClassSessionInput,
  hooks?: DemandLockHooks,
): Promise<CreateClassSessionForOrganizerResult> {
  try {
    const classSessionId = await prisma.$transaction(async (tx) => {
      await hooks?.onBeforeLock?.();

      const lockedDemand = await tx.$queryRaw<
        { id: string; status: string; organizationId: string }[]
      >`
        SELECT "id", "status", "organizationId"
        FROM "DemandRequest"
        WHERE "id" = ${demandRequestId} AND "organizerProfileId" = ${organizerProfileId}
        FOR UPDATE
      `;

      if (lockedDemand.length === 0) {
        throw new DemandNotFoundError();
      }

      await hooks?.onLockAcquired?.();

      const demand = lockedDemand[0];

      const existingClassSession = await tx.classSession.findUnique({
        where: { demandRequestId },
        select: { id: true },
      });

      if (existingClassSession) {
        throw new ClassSessionAlreadyExistsError();
      }

      if (demand.status !== "matched") {
        throw new DemandNotMatchedError();
      }

      const selectedResponse = await tx.demandResponse.findFirst({
        where: { demandRequestId, status: "selected" },
        select: { teacherProfileId: true },
      });

      if (!selectedResponse) {
        throw new DemandNotReadyError();
      }

      const classSession = await tx.classSession.create({
        data: {
          demandRequestId,
          teacherProfileId: selectedResponse.teacherProfileId,
          organizerProfileId,
          organizationId: demand.organizationId,
          title: input.title,
          description: input.description,
          serviceType: input.serviceType,
          startAt: input.startAt,
          endAt: input.endAt,
          location: input.location,
          capacity: input.capacity,
          isPublic: input.isPublic,
        },
        select: { id: true },
      });

      await markDemandRequestAsConvertedToClassIfMatched(tx, demandRequestId);

      return classSession.id;
    });

    return { ok: true, classSessionId };
  } catch (error) {
    if (error instanceof DemandNotFoundError) {
      return { ok: false, code: "demand_not_found" };
    }

    if (error instanceof ClassSessionAlreadyExistsError) {
      return { ok: false, code: "class_session_already_exists" };
    }

    if (error instanceof DemandNotMatchedError) {
      return { ok: false, code: "demand_not_matched" };
    }

    if (error instanceof DemandNotReadyError) {
      return { ok: false, code: "demand_not_ready" };
    }

    if (isUniqueConstraintViolation(error)) {
      // Defense-in-depth：正常路徑下 (b) 已經先擋掉重複，這裡只處理理論上的極端競態。
      return { ok: false, code: "class_session_already_exists" };
    }

    return { ok: false, code: "create_failed" };
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
