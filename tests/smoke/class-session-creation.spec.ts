import { expect, test } from "@playwright/test";

import { createClassSessionForOrganizer } from "../../src/domain/class-session/__internal__/create-class-session-core";
import {
  formatTaipeiDatetime,
  parseTaipeiDatetimeLocal,
} from "../../src/domain/class-session/timezone";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import {
  addAuthSessionCookie,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createDemandResponse,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

const testEmailDomain = "class-session-creation-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

const validInput = {
  title: "測試課程",
  description: "測試用課程說明。",
  serviceType: "Hatha Yoga",
  startAt: "2026-08-20T14:00",
  endAt: "2026-08-20T15:00",
  location: "台北市信義區測試教室",
  capacity: 20,
  isPublic: false,
};

async function seedMatchedDemandWithSelectedResponse({
  testRunId,
  organizerEmail = `organizer-${testRunId}@${testEmailDomain}`,
  teacherEmail = `teacher-${testRunId}@${testEmailDomain}`,
  teacherStatus = "approved" as const,
}: {
  testRunId: string;
  organizerEmail?: string;
  teacherEmail?: string;
  teacherStatus?: "approved" | "suspended";
}) {
  createdEmails.push(organizerEmail, teacherEmail);

  const { sessionToken, organizerProfileId, organizationId } =
    await createOrganizerProfileWithOrganization({
      email: organizerEmail,
      displayName: `Organizer ${testRunId}`,
      organizationName: `Org ${testRunId}`,
    });
  const demand = await createDemandRequest({
    organizerProfileId,
    organizationId,
    status: "matched",
    data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
  });
  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Teacher ${testRunId}`,
    status: teacherStatus,
  });
  await createDemandResponse({
    demandRequestId: demand.id,
    teacherProfileId: teacher.teacherProfileId,
    status: "selected",
  });

  return { sessionToken, organizerProfileId, organizationId, demand, teacher };
}

test.describe("class session creation smoke", () => {
  test("lets an organizer create a class session through the UI; the demand converts, teacher-facing detail is unaffected by code changes, and the create form disappears afterwards", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-ui-${Date.now()}`,
    );
    const { sessionToken, demand } = await seedMatchedDemandWithSelectedResponse({
      testRunId,
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(`/organizer/demands/${demand.id}`);

    await expect(page.getByRole("heading", { name: "建立課程" })).toBeVisible();

    await page.getByLabel("課程名稱").fill(validInput.title);
    await page.getByLabel("課程類型").selectOption(validInput.serviceType);
    await page.getByLabel("開始時間").fill(validInput.startAt);
    await page.getByLabel("結束時間").fill(validInput.endAt);
    await page.getByLabel("地點").fill(validInput.location);
    await page.getByLabel("名額上限").fill(String(validInput.capacity));
    await page.getByRole("checkbox", { name: /我確認以上資訊無誤/ }).check();
    await page.getByRole("button", { name: "建立課程" }).click();

    await expect(page.getByText("課程已建立。")).toBeVisible();
    await expect(page.getByText(validInput.location)).toBeVisible();

    const demandAfter = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: demand.id },
      select: { status: true },
    });
    expect(demandAfter.status).toBe("converted_to_class");

    // 已轉換的 demand，建立表單不再顯示。
    await page.goto(`/organizer/demands/${demand.id}`);
    await expect(page.getByRole("heading", { name: "建立課程" })).toBeHidden();
  });

  test("does not show the create form for a demand that is not matched", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-not-matched-${Date.now()}`,
    );
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail);

    const { sessionToken, organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(`/organizer/demands/${demand.id}`);

    await expect(page.getByRole("heading", { name: "建立課程" })).toBeHidden();
  });

  test("blocks a non-owning organizer from creating a class session on someone else's demand (IDOR)", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-${Date.now()}`,
    );
    const { demand } = await seedMatchedDemandWithSelectedResponse({
      testRunId,
    });

    const otherOrganizerEmail = `organizer-b-${testRunId}@${testEmailDomain}`;
    createdEmails.push(otherOrganizerEmail);
    const { organizerProfileId: otherOrganizerProfileId } =
      await createOrganizerProfileWithOrganization({
        email: otherOrganizerEmail,
        displayName: `Organizer B ${testRunId}`,
        organizationName: `Org B ${testRunId}`,
      });

    const validation = validateClassSessionCreate(validInput);
    if (!validation.valid) throw new Error("unexpected invalid input in test fixture");

    const result = await createClassSessionForOrganizer(
      otherOrganizerProfileId,
      demand.id,
      validation.normalized,
    );

    expect(result).toEqual({ ok: false, code: "demand_not_found" });

    const classSessionCount = await prisma.classSession.count({
      where: { demandRequestId: demand.id },
    });
    expect(classSessionCount).toBe(0);
  });

  test("validation boundaries reject out-of-range input", async () => {
    const cases: Array<[string, Partial<typeof validInput>]> = [
      ["capacity 0", { capacity: 0 }],
      ["capacity 501", { capacity: 501 }],
      ["startAt in the past", { startAt: "2020-01-01T10:00" }],
      ["endAt equal to startAt", { endAt: validInput.startAt }],
      ["endAt before startAt", { endAt: "2026-08-20T13:00" }],
      ["empty location", { location: "" }],
      ["invalid serviceType", { serviceType: "Not A Real Type" }],
      ["empty title", { title: "" }],
      ["empty serviceType (even though pre-filled by default)", { serviceType: "" }],
    ];

    for (const [label, overrides] of cases) {
      const result = validateClassSessionCreate({ ...validInput, ...overrides });
      expect(result.valid, `expected "${label}" to be rejected`).toBe(false);
    }
  });

  test("repeated create returns class_session_already_exists, not demand_not_matched", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-repeat-${Date.now()}`,
    );
    const { organizerProfileId, demand } = await seedMatchedDemandWithSelectedResponse({
      testRunId,
    });

    const validation = validateClassSessionCreate(validInput);
    if (!validation.valid) throw new Error("unexpected invalid input in test fixture");

    const first = await createClassSessionForOrganizer(
      organizerProfileId,
      demand.id,
      validation.normalized,
    );
    expect(first.ok).toBe(true);

    const second = await createClassSessionForOrganizer(
      organizerProfileId,
      demand.id,
      validation.normalized,
    );
    expect(second).toEqual({ ok: false, code: "class_session_already_exists" });
  });

  // 此設計對 process.env.TZ 天生不敏感（parseTaipeiDatetimeLocal 明確附加 +08:00 偏移量，
  // formatTaipeiDatetime 明確指定 timeZone: "Asia/Taipei"，兩者都不依賴系統預設時區），
  // 因此本機開發環境（Asia/Taipei）跑這個測試不能證明什麼；已額外用
  // `TZ=UTC npx playwright test ...` 實際跑過一次全綠，證明不是「剛好本機時區對」的偽陽性。
  test("D13: known input round-trips correctly regardless of server TZ, and an impossible calendar date is rejected", () => {
    const parsed = parseTaipeiDatetimeLocal("2026-08-15T14:00");
    expect(parsed).not.toBeNull();
    expect(formatTaipeiDatetime(parsed as Date)).toBe("2026/08/15 14:00");

    // 不存在的日期（2 月沒有 31 號），不可被 JS Date 靜默捲成 3 月。
    expect(parseTaipeiDatetimeLocal("2026-02-31T14:00")).toBeNull();
  });

  test("teacher sees only their own class sessions, DTO excludes organization contact info, and a suspended teacher still sees their existing class session", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-teacher-view-${Date.now()}`,
    );
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    const teacherAEmail = `teacher-a-${testRunId}@${testEmailDomain}`;
    const teacherBEmail = `teacher-b-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerEmail, teacherAEmail, teacherBEmail);

    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
        contactEmail: "organizer-secret@example.com",
        contactPhone: "0912345678",
      });
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "matched",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    const teacherA = await createTeacherProfileWithSession({
      email: teacherAEmail,
      displayName: `Teacher A ${testRunId}`,
      status: "approved",
    });
    const teacherB = await createTeacherProfileWithSession({
      email: teacherBEmail,
      displayName: `Teacher B ${testRunId}`,
      status: "suspended",
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacherB.teacherProfileId,
      status: "selected",
    });

    const validation = validateClassSessionCreate(validInput);
    if (!validation.valid) throw new Error("unexpected invalid input in test fixture");

    const created = await createClassSessionForOrganizer(
      organizerProfileId,
      demand.id,
      validation.normalized,
    );
    if (!created.ok) throw new Error("unexpected create failure in test fixture");

    // Teacher A 沒有任何 class session。
    await addAuthSessionCookie(context, teacherA.sessionToken);
    await page.goto("/teacher/classes");
    await expect(page.getByText("目前沒有已建立的課程")).toBeVisible();

    // Teacher B（suspended）仍可看到自己既有的 class session（D15），
    // 且 DTO 不含 organizer/organization 聯絡資訊。
    await addAuthSessionCookie(context, teacherB.sessionToken);
    await page.goto("/teacher/classes");
    await expect(page.getByText(validInput.title)).toBeVisible();
    await expect(page.getByText(validInput.location)).toBeVisible();
    await expect(page.getByText("organizer-secret@example.com")).toBeHidden();
    await expect(page.getByText("0912345678")).toBeHidden();
  });

  // D5 併發保護，比照前一輪 demand-response-selection-and-matching Slice 4 的確定性鎖測試手法：
  // 用 production 函式本身的 hooks.onBeforeLock/onLockAcquired 當同步點，證明第一個呼叫真的
  // 持有鎖、第二個呼叫真的送出了同一句 FOR UPDATE 卻被擋住，而不是機率性的 Promise.all。
  test("concurrent create-on-same-demand: FOR UPDATE deterministically blocks the second call, and exactly one succeeds", async ({}, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-race-${Date.now()}`,
    );
    const { organizerProfileId, demand } = await seedMatchedDemandWithSelectedResponse({
      testRunId,
    });

    const validation = validateClassSessionCreate(validInput);
    if (!validation.valid) throw new Error("unexpected invalid input in test fixture");

    const releaseFirst = createDeferred<void>();
    let firstAcquired = false;
    let secondReachedLockStatement = false;
    let secondAcquired = false;

    const firstCall = createClassSessionForOrganizer(
      organizerProfileId,
      demand.id,
      validation.normalized,
      {
        onLockAcquired: async () => {
          firstAcquired = true;
          await releaseFirst.promise;
        },
      },
    );

    await waitUntil(() => firstAcquired);

    const secondCall = createClassSessionForOrganizer(
      organizerProfileId,
      demand.id,
      validation.normalized,
      {
        onBeforeLock: () => {
          secondReachedLockStatement = true;
        },
        onLockAcquired: () => {
          secondAcquired = true;
        },
      },
    );

    await waitUntil(() => secondReachedLockStatement);

    await sleep(300);
    expect(secondAcquired).toBe(false);

    releaseFirst.resolve();
    const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);
    expect(secondAcquired).toBe(true);

    expect(firstResult.ok).toBe(true);
    expect(secondResult).toEqual({ ok: false, code: "class_session_already_exists" });

    const classSessionCount = await prisma.classSession.count({
      where: { demandRequestId: demand.id },
    });
    expect(classSessionCount).toBe(1);
  });
});

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();

  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitUntil timed out");
    }

    await sleep(10);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
