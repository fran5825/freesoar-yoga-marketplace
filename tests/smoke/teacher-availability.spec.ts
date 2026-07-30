import type { TeacherProfileStatus } from "@prisma/client";
import { expect, test } from "@playwright/test";

import {
  formatAvailabilityExceptionDate,
  parseAvailabilityExceptionDate,
} from "@/domain/teacher-availability/date-format";
import {
  validateAvailabilityExceptionInput,
  validateTeacherAvailabilityInput,
} from "@/domain/teacher-availability/validation";

import {
  addAuthSessionCookie,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

const testEmailDomain = "teacher-availability-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  // TeacherAvailability／AvailabilityException 都設定 onDelete: Cascade，
  // 刪除 TeacherProfile 時會一併清掉，不需要另外清這兩張表。
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

test.describe("teacher availability domain validation (direct, no UI)", () => {
  // 頁面上的驗證失敗訊息目前一律顯示同一句通用文案（見下方 UI 測試），
  // 所以這裡直接呼叫純函式，證明「正確的那條規則」真的有被擋下，而不是任何原因都擋。
  test("validateTeacherAvailabilityInput rejects each invalid field with its specific error code", () => {
    const dayOfWeekResult = validateTeacherAvailabilityInput({
      dayOfWeek: 7,
      startTime: "10:00",
      endTime: "11:00",
    });
    expect(dayOfWeekResult.valid).toBe(false);
    expect(!dayOfWeekResult.valid && dayOfWeekResult.errors.map((e) => e.code)).toContain(
      "day_of_week_invalid",
    );

    const timeFormatResult = validateTeacherAvailabilityInput({
      dayOfWeek: 1,
      startTime: "9:00",
      endTime: "11:00",
    });
    expect(timeFormatResult.valid).toBe(false);
    expect(!timeFormatResult.valid && timeFormatResult.errors.map((e) => e.code)).toContain(
      "start_time_invalid",
    );

    const timeOrderResult = validateTeacherAvailabilityInput({
      dayOfWeek: 1,
      startTime: "10:00",
      endTime: "10:00",
    });
    expect(timeOrderResult.valid).toBe(false);
    expect(!timeOrderResult.valid && timeOrderResult.errors.map((e) => e.code)).toContain(
      "time_range_invalid",
    );

    const locationTooLongResult = validateTeacherAvailabilityInput({
      dayOfWeek: 1,
      startTime: "10:00",
      endTime: "11:00",
      locationArea: "台".repeat(101),
    });
    expect(locationTooLongResult.valid).toBe(false);
    expect(
      !locationTooLongResult.valid && locationTooLongResult.errors.map((e) => e.code),
    ).toContain("location_area_too_long");

    const validResult = validateTeacherAvailabilityInput({
      dayOfWeek: 6,
      startTime: "23:00",
      endTime: "23:59",
      locationArea: "台北市信義區",
    });
    expect(validResult.valid).toBe(true);
  });

  test("validateAvailabilityExceptionInput rejects each invalid field with its specific error code", () => {
    const dateResult = validateAvailabilityExceptionInput({
      date: "2026-02-31",
      type: "blocked",
    });
    expect(dateResult.valid).toBe(false);
    expect(!dateResult.valid && dateResult.errors.map((e) => e.code)).toContain("date_invalid");

    const typeResult = validateAvailabilityExceptionInput({
      date: "2026-09-01",
      type: "not_a_real_type",
    });
    expect(typeResult.valid).toBe(false);
    expect(!typeResult.valid && typeResult.errors.map((e) => e.code)).toContain("type_invalid");

    const incompleteRangeResult = validateAvailabilityExceptionInput({
      date: "2026-09-01",
      type: "blocked",
      startTime: "09:00",
      endTime: null,
    });
    expect(incompleteRangeResult.valid).toBe(false);
    expect(
      !incompleteRangeResult.valid && incompleteRangeResult.errors.map((e) => e.code),
    ).toContain("time_range_incomplete");

    const reasonTooLongResult = validateAvailabilityExceptionInput({
      date: "2026-09-01",
      type: "blocked",
      reason: "假".repeat(501),
    });
    expect(reasonTooLongResult.valid).toBe(false);
    expect(
      !reasonTooLongResult.valid && reasonTooLongResult.errors.map((e) => e.code),
    ).toContain("reason_too_long");

    const validWholeDayResult = validateAvailabilityExceptionInput({
      date: "2026-09-01",
      type: "blocked",
      reason: "請假一天",
    });
    expect(validWholeDayResult.valid).toBe(true);
  });
});

test.describe("teacher availability date handling (direct, no UI)", () => {
  test("parseAvailabilityExceptionDate rejects an impossible calendar date instead of silently rolling it forward", () => {
    expect(parseAvailabilityExceptionDate("2026-02-31")).toBeNull();
  });

  test("formatAvailabilityExceptionDate stays UTC-anchored even under a negative-offset local TZ", () => {
    const originalTz = process.env.TZ;

    try {
      const parsed = parseAvailabilityExceptionDate("2026-02-28");
      expect(parsed).not.toBeNull();

      // 這個專案目前所有既有執行環境都是正時區偏移，用錯本地時區 getter 的 bug 不會顯現。
      // 只有在負偏移環境下，用錯 getter 才會讓日期整個偏移一天，才測得出來。
      process.env.TZ = "America/Los_Angeles";

      expect(formatAvailabilityExceptionDate(parsed as Date)).toBe("2026-02-28");
    } finally {
      if (originalTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTz;
      }
    }
  });
});

test.describe("teacher availability smoke", () => {
  const nonApprovedCases: Array<{
    status: TeacherProfileStatus | null;
    expectedTitle: string;
  }> = [
    { status: null, expectedTitle: "尚未建立老師申請" },
    { status: "draft", expectedTitle: "老師申請還在準備中" },
    { status: "submitted", expectedTitle: "老師申請審核中" },
    { status: "rejected", expectedTitle: "老師申請可修正後重新送出" },
  ];

  for (const { status, expectedTitle } of nonApprovedCases) {
    test(`shows guidance copy (not the functional UI) when teacher profile status is ${
      status ?? "missing"
    }`, async ({ context, page }, testInfo) => {
      const testRunId = normalizeForEmail(
        `${testInfo.project.name}-${testInfo.workerIndex}-guidance-${status ?? "missing"}-${Date.now()}`,
      );
      const email = `teacher-${testRunId}@${testEmailDomain}`;
      createdEmails.push(email);

      let sessionToken: string;

      if (status === null) {
        const session = await createUserSession({ email });
        sessionToken = session.sessionToken;
      } else {
        const created = await createTeacherProfileWithSession({
          email,
          displayName: `Teacher ${testRunId}`,
          status,
        });
        sessionToken = created.sessionToken;
      }

      await addAuthSessionCookie(context, sessionToken);
      await page.goto("/teacher/availability");

      await expect(page.getByRole("heading", { name: expectedTitle })).toBeVisible();
      await expect(page.getByRole("heading", { name: "固定可授課時段" })).toBeHidden();
      await expect(page.getByRole("heading", { name: "特殊日期例外" })).toBeHidden();
      await expect(page.getByRole("button", { name: "新增固定時段" })).toBeHidden();
    });
  }

  test("lets a suspended teacher view existing availability/exceptions read-only, and rejects a stale create-form submit server-side", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-suspended-${Date.now()}`,
    );
    const email = `teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken, teacherProfileId } = await createTeacherProfileWithSession({
      email,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });

    await prisma.teacherAvailability.create({
      data: {
        teacherProfileId,
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
        locationArea: "台北市大安區",
      },
    });
    await prisma.availabilityException.create({
      data: {
        teacherProfileId,
        date: parseAvailabilityExceptionDate("2026-08-10") as Date,
        type: "blocked",
        reason: "既有例外",
      },
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/teacher/availability");

    // 目前仍是 approved：新增表單存在，先把它填好但不送出。
    // teacher-availability-edit 這輪之後，既有記錄會多一個「編輯…」表單，欄位標籤文字
    // 跟新增表單重複（`<details>` 收合只是視覺隱藏，DOM 節點還在，getByLabel() 定位時
    // 不看可見性）——這裡先用新增表單自己的送出按鈕把範圍鎖定在新增表單本身，不能再
    // 依賴頁面上「這個 label 只有一個」的假設。
    const createSlotForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "新增固定時段" }),
    });
    await expect(page.getByRole("button", { name: "新增固定時段" })).toBeVisible();
    await createSlotForm.getByLabel("星期幾").selectOption("3");
    await createSlotForm.getByLabel("開始時間", { exact: true }).fill("14:00");
    await createSlotForm.getByLabel("結束時間", { exact: true }).fill("15:00");

    // Teacher 事後被 suspend，瀏覽器分頁不重新整理，表單維持 suspend 前渲染出來的舊狀態。
    await prisma.teacherProfile.update({
      where: { id: teacherProfileId },
      data: { status: "suspended" },
    });

    await page.getByRole("button", { name: "新增固定時段" }).click();

    await expect(
      page.getByText("需要通過審核的老師身份才能新增可授課時段。"),
    ).toBeVisible();

    const countAfterStaleSubmit = await prisma.teacherAvailability.count({
      where: { teacherProfileId },
    });
    expect(countAfterStaleSubmit).toBe(1); // 仍只有既有那一筆，沒有新增成功。

    // 重新整理（此時真的是 suspended）：唯讀顯示既有資料，沒有新增表單、沒有刪除按鈕。
    await page.goto("/teacher/availability");

    await expect(
      page.getByText(
        "帳號目前暫停中，暫時無法新增、編輯或刪除可授課時間，但你仍然可以查看既有資料。",
      ),
    ).toBeVisible();
    await expect(page.getByText("週一・09:00–10:00・台北市大安區")).toBeVisible();
    await expect(page.getByText("2026-08-10")).toBeVisible();
    await expect(page.getByRole("button", { name: "新增固定時段" })).toBeHidden();
    await expect(page.getByRole("button", { name: "新增例外" })).toBeHidden();
    await expect(page.getByRole("button", { name: "刪除" })).toHaveCount(0);
    await expect(page.getByText("編輯…")).toHaveCount(0); // suspended 也不能編輯（D2）。
  });

  test("validates fixed availability slot input server-side, then creates and deletes the boundary case (Sat 23:00–23:59)", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-slot-crud-${Date.now()}`,
    );
    const email = `teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken, teacherProfileId } = await createTeacherProfileWithSession({
      email,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/teacher/availability");

    // 時間順序錯誤（結束時間不晚於開始時間）——伺服器端擋下，不是瀏覽器端。
    await page.getByLabel("星期幾").selectOption("6");
    await page.getByLabel("開始時間", { exact: true }).fill("10:00");
    await page.getByLabel("結束時間", { exact: true }).fill("09:00");
    await page.getByRole("button", { name: "新增固定時段" }).click();

    await expect(page.getByText("新增前，請先確認以上資訊。")).toBeVisible();
    expect(
      await prisma.teacherAvailability.count({ where: { teacherProfileId } }),
    ).toBe(0);

    // 地區過長——先移除瀏覽器端 maxlength 限制，證明伺服器端才是權威。
    // Server Action 送出後是 client-side 導頁重新整理（不是硬重新整理），uncontrolled
    // 表單欄位不保證回到宣告的預設值，這裡用 page.goto() 強制真正的重新整理，確保接下來
    // 每一次嘗試都是從乾淨狀態開始填寫。
    await page.goto("/teacher/availability");
    await page.getByLabel("星期幾").selectOption("6");
    await page.getByLabel("開始時間", { exact: true }).fill("10:00");
    await page.getByLabel("結束時間", { exact: true }).fill("11:00");
    const locationInput = page.getByLabel("地區（選填）");
    await locationInput.evaluate((el) => el.removeAttribute("maxlength"));
    await locationInput.fill("台".repeat(101));
    await page.getByRole("button", { name: "新增固定時段" }).click();

    await expect(page.getByText("新增前，請先確認以上資訊。")).toBeVisible();
    expect(
      await prisma.teacherAvailability.count({ where: { teacherProfileId } }),
    ).toBe(0);

    // 成功新增（邊界案例：週六 23:00–23:59，跨到當天最後一分鐘的合法區間）。
    await page.goto("/teacher/availability");
    await page.getByLabel("星期幾").selectOption("6");
    await page.getByLabel("開始時間", { exact: true }).fill("23:00");
    await page.getByLabel("結束時間", { exact: true }).fill("23:59");
    await page.getByLabel("地區（選填）").fill("台北市信義區");
    await page.getByRole("button", { name: "新增固定時段" }).click();

    await expect(page.getByText("已新增固定可授課時段。")).toBeVisible();
    await expect(page.getByText("週六・23:00–23:59・台北市信義區")).toBeVisible();

    const created = await prisma.teacherAvailability.findFirstOrThrow({
      where: { teacherProfileId },
    });
    expect(created.startTime).toBe("23:00");
    expect(created.endTime).toBe("23:59");

    // 刪除，畫面即時反映。
    await page.getByRole("button", { name: "刪除" }).click();

    await expect(page.getByText("已刪除固定可授課時段。")).toBeVisible();
    await expect(page.getByText("週六・23:00–23:59・台北市信義區")).toBeHidden();
    expect(
      await prisma.teacherAvailability.count({ where: { teacherProfileId } }),
    ).toBe(0);
  });

  test("validates date exception input server-side, then creates whole-day and partial-day exceptions and deletes them", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-exception-crud-${Date.now()}`,
    );
    const email = `teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken, teacherProfileId } = await createTeacherProfileWithSession({
      email,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/teacher/availability");

    // 只填開始時間、沒填結束時間（必須同時提供或同時不提供，見 D4）——伺服器端擋下。
    await page.getByLabel("日期").fill("2026-09-01");
    await page.getByRole("radio", { name: "封鎖（這天無法授課）" }).check();
    await page.getByLabel("開始時間（選填，留空代表整天）").fill("09:00");
    await page.getByRole("button", { name: "新增例外" }).click();

    await expect(page.getByText("新增前，請先確認以上資訊。")).toBeVisible();
    expect(
      await prisma.availabilityException.count({ where: { teacherProfileId } }),
    ).toBe(0);

    // 原因過長——先移除瀏覽器端 maxlength 限制，證明伺服器端才是權威。
    // Server Action 送出後是 client-side 導頁重新整理（不是硬重新整理），uncontrolled
    // 表單欄位不保證回到宣告的預設值，這裡用 page.goto() 強制真正的重新整理，確保接下來
    // 每一次嘗試都是從乾淨狀態開始填寫。
    await page.goto("/teacher/availability");
    await page.getByLabel("日期").fill("2026-09-01");
    await page.getByRole("radio", { name: "封鎖（這天無法授課）" }).check();
    const reasonInput = page.getByLabel("原因（選填）");
    await reasonInput.evaluate((el) => el.removeAttribute("maxlength"));
    await reasonInput.fill("假".repeat(501));
    await page.getByRole("button", { name: "新增例外" }).click();

    await expect(page.getByText("新增前，請先確認以上資訊。")).toBeVisible();
    expect(
      await prisma.availabilityException.count({ where: { teacherProfileId } }),
    ).toBe(0);

    // 成功新增：整天封鎖，日期用 date-format 的邊界日期驗證顯示不位移。
    await page.goto("/teacher/availability");
    await page.getByLabel("日期").fill("2026-02-28");
    await page.getByRole("radio", { name: "封鎖（這天無法授課）" }).check();
    await page.getByLabel("原因（選填）").fill("請假一天");
    await page.getByRole("button", { name: "新增例外" }).click();

    await expect(page.getByText("已新增日期例外。")).toBeVisible();
    await expect(page.getByText("2026-02-28")).toBeVisible();
    await expect(page.getByText("整天", { exact: true })).toBeVisible();

    // 成功新增：部分時段額外開放。此時上一步的整天封鎖例外已經存在，它的「編輯…」表單
    // 也在 DOM 裡（收合不代表不存在），欄位標籤文字跟新增表單重複——用新增例外表單自己
    // 的送出按鈕把範圍鎖定在新增表單本身，不能再依賴「這個 label 全頁只有一個」的假設。
    await page.goto("/teacher/availability");
    const createExceptionForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "新增例外" }),
    });
    await createExceptionForm.getByLabel("日期").fill("2026-09-15");
    await createExceptionForm
      .getByRole("radio", { name: "額外開放（原本沒有排班，但這天可以授課）" })
      .check();
    await createExceptionForm.getByLabel("開始時間（選填，留空代表整天）").fill("09:00");
    await createExceptionForm.getByLabel("結束時間（選填）").fill("10:00");
    await createExceptionForm.getByRole("button", { name: "新增例外" }).click();

    await expect(page.getByText("已新增日期例外。")).toBeVisible();
    await expect(page.getByText("2026-09-15")).toBeVisible();
    await expect(page.getByText("09:00–10:00")).toBeVisible();
    await expect(page.getByText("額外開放", { exact: true })).toBeVisible();

    expect(
      await prisma.availabilityException.count({ where: { teacherProfileId } }),
    ).toBe(2);

    // 刪除兩筆，畫面即時反映。用日期文字鎖定各自的列，不依賴 first()/last() 的排序假設，
    // 兩次刪除之間用 page.goto() 強制重新整理，理由同上（避免 client-side 導頁殘留舊狀態）。
    await expect(page.getByRole("button", { name: "刪除" })).toHaveCount(2);

    await page
      .locator("li", { hasText: "2026-02-28" })
      .getByRole("button", { name: "刪除" })
      .click();
    await expect(page.getByText("已刪除日期例外。")).toBeVisible();

    await page.goto("/teacher/availability");
    await page
      .locator("li", { hasText: "2026-09-15" })
      .getByRole("button", { name: "刪除" })
      .click();
    await expect(page.getByText("已刪除日期例外。")).toBeVisible();

    expect(
      await prisma.availabilityException.count({ where: { teacherProfileId } }),
    ).toBe(0);
  });

  test("keeps delete IDOR-safe: another teacher's row id is rejected with not_found and the original row is untouched", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-${Date.now()}`,
    );
    const teacherAEmail = `teacher-a-${testRunId}@${testEmailDomain}`;
    const teacherBEmail = `teacher-b-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherAEmail, teacherBEmail);

    const teacherA = await createTeacherProfileWithSession({
      email: teacherAEmail,
      displayName: `Teacher A ${testRunId}`,
      status: "approved",
    });
    const teacherB = await createTeacherProfileWithSession({
      email: teacherBEmail,
      displayName: `Teacher B ${testRunId}`,
      status: "approved",
    });

    const victimSlot = await prisma.teacherAvailability.create({
      data: { teacherProfileId: teacherA.teacherProfileId, dayOfWeek: 2, startTime: "08:00", endTime: "09:00" },
    });
    const victimException = await prisma.availabilityException.create({
      data: {
        teacherProfileId: teacherA.teacherProfileId,
        date: parseAvailabilityExceptionDate("2026-10-01") as Date,
        type: "blocked",
      },
    });

    // Teacher B 自己也要各有一筆，才會有真正的刪除表單可以「劫持」隱藏欄位——
    // 不能只靠改網址或直接呼叫 Server Action（不存在這種呼叫方式，見 suspended 測試的說明）。
    await prisma.teacherAvailability.create({
      data: { teacherProfileId: teacherB.teacherProfileId, dayOfWeek: 3, startTime: "08:00", endTime: "09:00" },
    });
    await prisma.availabilityException.create({
      data: {
        teacherProfileId: teacherB.teacherProfileId,
        date: parseAvailabilityExceptionDate("2026-10-02") as Date,
        type: "blocked",
      },
    });

    await addAuthSessionCookie(context, teacherB.sessionToken);
    await page.goto("/teacher/availability");

    // teacher-availability-edit 這輪之後，每筆記錄除了刪除表單，還多了一個編輯表單，
    // 兩者的 hidden input 都叫 `availabilityId`／`exceptionId`（值也相同）——不能再假設
    // 「這個 name 的 hidden input 全頁只有一個」。用「同時包含這個 hidden input、且有
    // 『刪除』按鈕」這兩個條件鎖定刪除表單本身（編輯表單的送出按鈕是「儲存變更」，不會
    // 符合第二個條件），把隱藏欄位從 Teacher B 自己的 id 改成 Teacher A 記錄自己的 id。
    const slotDeleteForm = page
      .locator("form")
      .filter({ has: page.locator('input[name="availabilityId"]') })
      .filter({ has: page.getByRole("button", { name: "刪除" }) });
    await slotDeleteForm.locator('input[name="availabilityId"]').evaluate((el, victimId) => {
      (el as HTMLInputElement).value = victimId;
    }, victimSlot.id);
    await slotDeleteForm.getByRole("button", { name: "刪除" }).click();

    await expect(
      page.getByText("找不到這筆固定時段，或你沒有權限操作。"),
    ).toBeVisible();

    const untouchedSlot = await prisma.teacherAvailability.findUnique({
      where: { id: victimSlot.id },
    });
    expect(untouchedSlot).not.toBeNull();
    expect(untouchedSlot?.teacherProfileId).toBe(teacherA.teacherProfileId);

    // 同樣手法測「刪除例外」。
    await page.goto("/teacher/availability");
    const exceptionDeleteForm = page
      .locator("form")
      .filter({ has: page.locator('input[name="exceptionId"]') })
      .filter({ has: page.getByRole("button", { name: "刪除" }) });
    await exceptionDeleteForm.locator('input[name="exceptionId"]').evaluate((el, victimId) => {
      (el as HTMLInputElement).value = victimId;
    }, victimException.id);
    await exceptionDeleteForm.getByRole("button", { name: "刪除" }).click();

    await expect(page.getByText("找不到這筆例外，或你沒有權限操作。")).toBeVisible();

    const untouchedException = await prisma.availabilityException.findUnique({
      where: { id: victimException.id },
    });
    expect(untouchedException).not.toBeNull();
    expect(untouchedException?.teacherProfileId).toBe(teacherA.teacherProfileId);
  });

  test("edits a fixed slot server-side, including clearing locationArea to null, and rejects an edit with required fields left blank", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-edit-slot-${Date.now()}`,
    );
    const email = `teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken, teacherProfileId } = await createTeacherProfileWithSession({
      email,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });

    const slot = await prisma.teacherAvailability.create({
      data: {
        teacherProfileId,
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
        locationArea: "台北市大安區",
      },
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/teacher/availability");

    // 必填欄位留空——繞過瀏覽器原生 required，證明伺服器端才是權威。用 li 的既有顯示文字
    // 鎖定這筆記錄的編輯表單，不依賴頁面上「這個 label 只有一個」的假設。
    const slotItem = page.locator("li", { hasText: "週一・09:00–10:00・台北市大安區" });
    await slotItem.getByText("編輯…").click();
    const editForm = slotItem
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "儲存變更" }) });
    await editForm.getByLabel("開始時間", { exact: true }).evaluate((el) => {
      (el as HTMLInputElement).value = "";
      (el as HTMLInputElement).form?.setAttribute("novalidate", "true");
    });
    await editForm.getByRole("button", { name: "儲存變更" }).click();

    await expect(page.getByText("儲存前，請先確認以上資訊。")).toBeVisible();
    const stillOriginal = await prisma.teacherAvailability.findUniqueOrThrow({
      where: { id: slot.id },
    });
    expect(stillOriginal.startTime).toBe("09:00");
    expect(stillOriginal.locationArea).toBe("台北市大安區");

    // 成功編輯：修改結束時間、把選填的 locationArea 清空成 null（整筆覆寫語意，見 D1）。
    await page.goto("/teacher/availability");
    const slotItemAgain = page.locator("li", { hasText: "週一・09:00–10:00・台北市大安區" });
    await slotItemAgain.getByText("編輯…").click();
    const editForm2 = slotItemAgain
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "儲存變更" }) });
    await editForm2.getByLabel("結束時間", { exact: true }).fill("11:00");
    await editForm2.getByLabel("地區（選填）").fill("");
    await editForm2.getByRole("button", { name: "儲存變更" }).click();

    await expect(page.getByText("已更新固定可授課時段。")).toBeVisible();
    await expect(page.getByText("週一・09:00–11:00", { exact: true })).toBeVisible();

    const updated = await prisma.teacherAvailability.findUniqueOrThrow({
      where: { id: slot.id },
    });
    expect(updated.startTime).toBe("09:00");
    expect(updated.endTime).toBe("11:00");
    expect(updated.locationArea).toBeNull();
  });

  test("edits a date exception server-side, including a type change and clearing reason/time range to null, and rejects an edit with required fields left blank", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-edit-exception-${Date.now()}`,
    );
    const email = `teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken, teacherProfileId } = await createTeacherProfileWithSession({
      email,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });

    const exception = await prisma.availabilityException.create({
      data: {
        teacherProfileId,
        date: parseAvailabilityExceptionDate("2026-09-01") as Date,
        type: "blocked",
        startTime: "09:00",
        endTime: "10:00",
        reason: "原本的原因",
      },
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/teacher/availability");

    const exceptionItem = page.locator("li", { hasText: "2026-09-01" });
    await exceptionItem.getByText("編輯…").click();
    const editForm = exceptionItem
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "儲存變更" }) });

    // 必填欄位（日期）留空——繞過瀏覽器原生 required，證明伺服器端才是權威。
    await editForm.getByLabel("日期").evaluate((el) => {
      (el as HTMLInputElement).value = "";
      (el as HTMLInputElement).form?.setAttribute("novalidate", "true");
    });
    await editForm.getByRole("button", { name: "儲存變更" }).click();

    await expect(page.getByText("儲存前，請先確認以上資訊。")).toBeVisible();
    const stillOriginal = await prisma.availabilityException.findUniqueOrThrow({
      where: { id: exception.id },
    });
    expect(stillOriginal.type).toBe("blocked");
    expect(stillOriginal.reason).toBe("原本的原因");

    // 成功編輯：type 從 blocked 改成 extra_available，並把時間範圍與 reason 都清空成 null
    // （整天、無原因，整筆覆寫語意，見 D1）。
    await page.goto("/teacher/availability");
    const exceptionItemAgain = page.locator("li", { hasText: "2026-09-01" });
    await exceptionItemAgain.getByText("編輯…").click();
    const editForm2 = exceptionItemAgain
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "儲存變更" }) });
    await editForm2
      .getByRole("radio", { name: "額外開放（原本沒有排班，但這天可以授課）" })
      .check();
    await editForm2.getByLabel("開始時間（選填，留空代表整天）").fill("");
    await editForm2.getByLabel("結束時間（選填）").fill("");
    await editForm2.getByLabel("原因（選填）").fill("");
    await editForm2.getByRole("button", { name: "儲存變更" }).click();

    await expect(page.getByText("已更新日期例外。")).toBeVisible();

    const updated = await prisma.availabilityException.findUniqueOrThrow({
      where: { id: exception.id },
    });
    expect(updated.type).toBe("extra_available");
    expect(updated.startTime).toBeNull();
    expect(updated.endTime).toBeNull();
    expect(updated.reason).toBeNull();
  });

  test("rejects a stale edit-form submit server-side once the teacher becomes suspended mid-session (both slot and exception)", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-edit-suspended-${Date.now()}`,
    );
    const email = `teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken, teacherProfileId } = await createTeacherProfileWithSession({
      email,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });

    const slot = await prisma.teacherAvailability.create({
      data: {
        teacherProfileId,
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
      },
    });
    const exception = await prisma.availabilityException.create({
      data: {
        teacherProfileId,
        date: parseAvailabilityExceptionDate("2026-09-01") as Date,
        type: "blocked",
      },
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/teacher/availability");

    // 目前仍是 approved：展開兩筆記錄的編輯表單。
    const slotItem = page.locator("li", { hasText: "週一・09:00–10:00" });
    await slotItem.getByText("編輯…").click();
    const slotEditForm = slotItem
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "儲存變更" }) });

    // Teacher 事後被 suspend，瀏覽器分頁不重新整理，表單維持 suspend 前渲染出來的舊狀態。
    await prisma.teacherProfile.update({
      where: { id: teacherProfileId },
      data: { status: "suspended" },
    });

    await slotEditForm.getByRole("button", { name: "儲存變更" }).click();

    await expect(
      page.getByText("需要通過審核的老師身份才能編輯可授課時段。"),
    ).toBeVisible();

    const slotAfterStaleSubmit = await prisma.teacherAvailability.findUniqueOrThrow({
      where: { id: slot.id },
    });
    expect(slotAfterStaleSubmit.startTime).toBe("09:00"); // 沒有被改動。

    // 這個帳號已經是 suspended，restore 回 approved 才能重複同一個手法測例外編輯。
    await prisma.teacherProfile.update({
      where: { id: teacherProfileId },
      data: { status: "approved" },
    });
    await page.goto("/teacher/availability");
    const exceptionItem = page.locator("li", { hasText: "2026-09-01" });
    await exceptionItem.getByText("編輯…").click();
    const exceptionEditForm = exceptionItem
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "儲存變更" }) });

    await prisma.teacherProfile.update({
      where: { id: teacherProfileId },
      data: { status: "suspended" },
    });

    await exceptionEditForm.getByRole("button", { name: "儲存變更" }).click();

    await expect(page.getByText("需要通過審核的老師身份才能編輯例外。")).toBeVisible();

    const exceptionAfterStaleSubmit = await prisma.availabilityException.findUniqueOrThrow({
      where: { id: exception.id },
    });
    expect(exceptionAfterStaleSubmit.type).toBe("blocked"); // 沒有被改動。
  });

  test("keeps edit IDOR-safe: another teacher's row id is rejected with not_found and the original row is untouched", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-edit-idor-${Date.now()}`,
    );
    const teacherAEmail = `teacher-a-${testRunId}@${testEmailDomain}`;
    const teacherBEmail = `teacher-b-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherAEmail, teacherBEmail);

    const teacherA = await createTeacherProfileWithSession({
      email: teacherAEmail,
      displayName: `Teacher A ${testRunId}`,
      status: "approved",
    });
    const teacherB = await createTeacherProfileWithSession({
      email: teacherBEmail,
      displayName: `Teacher B ${testRunId}`,
      status: "approved",
    });

    const victimSlot = await prisma.teacherAvailability.create({
      data: {
        teacherProfileId: teacherA.teacherProfileId,
        dayOfWeek: 2,
        startTime: "08:00",
        endTime: "09:00",
      },
    });
    const victimException = await prisma.availabilityException.create({
      data: {
        teacherProfileId: teacherA.teacherProfileId,
        date: parseAvailabilityExceptionDate("2026-10-01") as Date,
        type: "blocked",
      },
    });

    // Teacher B 自己也要各有一筆，才會有真正的編輯表單可以「劫持」隱藏欄位。
    await prisma.teacherAvailability.create({
      data: {
        teacherProfileId: teacherB.teacherProfileId,
        dayOfWeek: 3,
        startTime: "08:00",
        endTime: "09:00",
      },
    });
    await prisma.availabilityException.create({
      data: {
        teacherProfileId: teacherB.teacherProfileId,
        date: parseAvailabilityExceptionDate("2026-10-02") as Date,
        type: "blocked",
      },
    });

    await addAuthSessionCookie(context, teacherB.sessionToken);
    await page.goto("/teacher/availability");

    // `<details>` 收合時，裡面的內容不會出現在 accessibility tree 裡（Chromium 對 collapsed
    // `<details>` 採用 content-visibility 語意），`getByRole()` 找不到收合表單裡的按鈕——
    // 跟純文字比對的 `getByLabel()`／`getByText()` 不同，這裡要先點開「編輯…」才能用
    // `getByRole("button")` 鎖定表單。Teacher B 此時只有各一筆自己的資料，故用 first()
    // 展開固定時段那一筆。
    await page.getByText("編輯…").first().click();

    // 用「同時包含這個 hidden input、且有『儲存變更』按鈕」鎖定編輯表單本身（跟既有
    // delete IDOR 測試鎖定刪除表單的既有手法對稱），把隱藏欄位從 Teacher B 自己的 id
    // 改成 Teacher A 記錄自己的 id，再修改一個欄位後送出。
    const slotEditForm = page
      .locator("form")
      .filter({ has: page.locator('input[name="availabilityId"]') })
      .filter({ has: page.getByRole("button", { name: "儲存變更" }) });
    await slotEditForm.locator('input[name="availabilityId"]').evaluate((el, victimId) => {
      (el as HTMLInputElement).value = victimId;
    }, victimSlot.id);
    await slotEditForm.getByLabel("開始時間", { exact: true }).fill("07:00");
    await slotEditForm.getByRole("button", { name: "儲存變更" }).click();

    await expect(
      page.getByText("找不到這筆固定時段，或你沒有權限操作。"),
    ).toBeVisible();

    const untouchedSlot = await prisma.teacherAvailability.findUnique({
      where: { id: victimSlot.id },
    });
    expect(untouchedSlot).not.toBeNull();
    expect(untouchedSlot?.teacherProfileId).toBe(teacherA.teacherProfileId);
    expect(untouchedSlot?.startTime).toBe("08:00");

    // 同樣手法測「編輯例外」。重新整理後同樣先點開「編輯…」（理由同上）。
    await page.goto("/teacher/availability");
    await page.getByText("編輯…").last().click();
    const exceptionEditForm = page
      .locator("form")
      .filter({ has: page.locator('input[name="exceptionId"]') })
      .filter({ has: page.getByRole("button", { name: "儲存變更" }) });
    await exceptionEditForm.locator('input[name="exceptionId"]').evaluate((el, victimId) => {
      (el as HTMLInputElement).value = victimId;
    }, victimException.id);
    await exceptionEditForm
      .getByRole("radio", { name: "額外開放（原本沒有排班，但這天可以授課）" })
      .check();
    await exceptionEditForm.getByRole("button", { name: "儲存變更" }).click();

    await expect(page.getByText("找不到這筆例外，或你沒有權限操作。")).toBeVisible();

    const untouchedException = await prisma.availabilityException.findUnique({
      where: { id: victimException.id },
    });
    expect(untouchedException).not.toBeNull();
    expect(untouchedException?.teacherProfileId).toBe(teacherA.teacherProfileId);
    expect(untouchedException?.type).toBe("blocked");
  });
});
