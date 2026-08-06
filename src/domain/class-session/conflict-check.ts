// teacher-initiated-open-classes 第 6 節：雙重預約衝突檢查，Organizer 既有建課核心與新的
// 老師建課核心都必須呼叫，且兩條路徑都必須「一律先鎖 TeacherProfile，其他鎖在之後」，避免
// 兩條路徑對多把鎖的取得順序不一致造成資料庫死鎖。
//
// 純粹的「查詢是否已有重疊 row → 判斷 → 插入」無法自我序列化：兩個幾乎同時對同一位老師建課
// 的 transaction，若當下都還查不到任何既有重疊 row（因為對方尚未 commit），會兩個都通過檢查
// 並成功插入。修法是先鎖住這位老師的 TeacherProfile row——任何兩個「對同一位老師建課」的
// transaction，不論走 Organizer 路徑還是 Teacher 路徑，都會在這裡排隊，第二個必須等第一個
// transaction commit（或 rollback）才能繼續往下查詢重疊，因此第二個 transaction 真正執行
// 查詢時，第一個 transaction 已寫入的 ClassSession row 保證可見。

import { Prisma } from "@prisma/client";

export type ConflictingClassSession = {
  id: string;
  title: string;
};

// 供 Playwright 併發測試在「即將取得 TeacherProfile 鎖」與「已經取得該鎖」兩個時間點插入
// 同步點，比照既有 __internal__ 建課/取消核心的 onBeforeLock/onLockAcquired 慣例——差異是
// 這裡的鎖是本函式內部發出的原始 SQL，呼叫端（Organizer／Teacher 建課核心）本身不持有這把鎖，
// 因此同步點必須開在這個函式裡，不能像既有慣例一樣開在呼叫端自己的鎖查詢前後。
export type ConflictLockHooks = {
  onBeforeLock?: () => void | Promise<void>;
  onLockAcquired?: () => void | Promise<void>;
};

export async function lockTeacherScheduleAndCheckConflict(
  tx: Prisma.TransactionClient,
  teacherProfileId: string,
  startAt: Date,
  endAt: Date,
  excludeClassSessionId?: string,
  hooks?: ConflictLockHooks,
): Promise<ConflictingClassSession | null> {
  // 步驟 1：鎖住這位老師的 TeacherProfile row。必須是這個函式的第一個資料庫操作，
  // 呼叫端（Organizer 路徑、Teacher 路徑）不得在呼叫本函式之前，於同一 transaction 內
  // 先取得其他鎖，否則會破壞「一律先鎖 TeacherProfile」的順序規則、產生死鎖風險。
  await hooks?.onBeforeLock?.();

  await tx.$queryRaw`
    SELECT "id" FROM "TeacherProfile" WHERE "id" = ${teacherProfileId} FOR UPDATE
  `;

  await hooks?.onLockAcquired?.();

  // 步驟 2：鎖到之後才查詢重疊——此時任何併發的建課 transaction 都已經 commit 或還在排隊，
  // 不會出現「兩者都查不到對方」的競態窗口。標準區間重疊判斷：existing.startAt < newEndAt
  // AND existing.endAt > newStartAt。排除 cancelled 課程與（若提供）自己本身的 id。
  const overlapping = await tx.$queryRaw<ConflictingClassSession[]>`
    SELECT "id", "title" FROM "ClassSession"
    WHERE "teacherProfileId" = ${teacherProfileId}
      AND "status" != 'cancelled'::"ClassSessionStatus"
      AND "startAt" < ${endAt}
      AND "endAt" > ${startAt}
      ${excludeClassSessionId ? Prisma.sql`AND "id" != ${excludeClassSessionId}` : Prisma.empty}
    LIMIT 1
  `;

  return overlapping[0] ?? null;
}
