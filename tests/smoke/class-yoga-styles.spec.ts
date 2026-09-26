import { expect, test } from "@playwright/test";

import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import {
  checkYogaStyles,
  normalizeYogaStyles,
  YOGA_STYLE_MAX_LENGTH,
  YOGA_STYLES_MAX_COUNT,
} from "../../src/domain/class-session/yoga-styles";
import { addAuthSessionCookie, normalizeForEmail, prisma } from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";
import { futureDateString, futureDateTime } from "./_helpers/future-dates";
import { pickServiceType } from "./_helpers/class-form";
import { selectFormTime } from "./_helpers/time-select";

// 課程的瑜伽類型（2026-09-26，產品主人決定：老師建課必填、可多選標籤加自訂）。

const testEmailDomain = "class-yoga-styles-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

const baseInput = {
  title: "瑜伽類型測試課程",
  description: "測試用。",
  serviceType: "伸展與身體保養",
  location: "台北市信義區測試教室",
  capacity: 12,
  isPublic: true,
  startAt: futureDateTime(70, "10:00"),
  endAt: futureDateTime(70, "11:00"),
};

test.describe("yoga styles validation (pure functions, no UI)", () => {
  test("normalizeYogaStyles trims, drops empty items and duplicates, keeps order", () => {
    expect(normalizeYogaStyles(["  陰瑜珈 ", "", "陰瑜珈", "哈達瑜伽", "   "])).toEqual([
      "陰瑜珈",
      "哈達瑜伽",
    ]);
    expect(normalizeYogaStyles(null)).toEqual([]);
    expect(normalizeYogaStyles(undefined)).toEqual([]);
  });

  test("checkYogaStyles enforces required, count and length limits", () => {
    expect(checkYogaStyles([], { required: true })).toBe("yoga_styles_required");
    expect(checkYogaStyles([], { required: false })).toBeNull();
    expect(checkYogaStyles(["陰瑜珈"], { required: true })).toBeNull();
    expect(
      checkYogaStyles(
        Array.from({ length: YOGA_STYLES_MAX_COUNT + 1 }, (_, index) => `風格${index}`),
        { required: false },
      ),
    ).toBe("yoga_styles_too_many");
    expect(
      checkYogaStyles(["長".repeat(YOGA_STYLE_MAX_LENGTH + 1)], { required: false }),
    ).toBe("yoga_style_too_long");
  });

  test("validateClassSessionCreate accepts 1–3 service types, rejects 4 or invalid ones, and falls back to the single serviceType", () => {
    const multi = validateClassSessionCreate({
      ...baseInput,
      serviceType: undefined,
      serviceTypes: ["流汗活力", "核心與體態"],
    });
    expect(multi.valid).toBe(true);
    if (multi.valid) {
      expect(multi.normalized.serviceType).toBe("流汗活力");
      expect(multi.normalized.serviceTypes).toEqual(["流汗活力", "核心與體態"]);
    }

    const tooMany = validateClassSessionCreate({
      ...baseInput,
      serviceTypes: ["流汗活力", "核心與體態", "冥想與呼吸", "放鬆紓壓"],
    });
    expect(tooMany.valid).toBe(false);
    if (!tooMany.valid) {
      expect(tooMany.errors.map((error) => error.code)).toContain("service_type_too_many");
    }

    const invalid = validateClassSessionCreate({ ...baseInput, serviceTypes: ["不存在的風格"] });
    expect(invalid.valid).toBe(false);

    // 沒帶 serviceTypes：退回單一 serviceType（團主媒合建課的舊路徑）。
    const single = validateClassSessionCreate(baseInput);
    expect(single.valid).toBe(true);
    if (single.valid) expect(single.normalized.serviceTypes).toEqual([baseInput.serviceType]);
  });

  test("validateClassSessionCreate requires yoga styles only when asked (teacher path), and normalizes them", () => {
    const withoutStyles = validateClassSessionCreate(baseInput);
    expect(withoutStyles.valid).toBe(true);
    if (withoutStyles.valid) expect(withoutStyles.normalized.yogaStyles).toEqual([]);

    const teacherPathMissing = validateClassSessionCreate(baseInput, { requireYogaStyles: true });
    expect(teacherPathMissing.valid).toBe(false);
    if (!teacherPathMissing.valid) {
      expect(teacherPathMissing.errors.map((error) => error.code)).toEqual(["yoga_styles_required"]);
    }

    const teacherPathOk = validateClassSessionCreate(
      { ...baseInput, yogaStyles: [" 陰瑜珈 ", "陰瑜珈", "自訂風格"] },
      { requireYogaStyles: true },
    );
    expect(teacherPathOk.valid).toBe(true);
    if (teacherPathOk.valid) {
      expect(teacherPathOk.normalized.yogaStyles).toEqual(["陰瑜珈", "自訂風格"]);
    }
  });
});

test.describe("yoga styles in the teacher class form and public pages", () => {
  test("the create form blocks submit until a yoga style is chosen or typed; the error clears once one is picked", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-required-${Date.now()}`,
    );
    const email = `teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const teacher = await createTeacherProfileWithSession({
      email,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");

    await page.locator("#title").fill(`必填測試 ${testRunId}`);
    await pickServiceType(page, baseInput.serviceType);
    await page.locator("#single-date").fill(futureDateString(71));
    await selectFormTime(page, "single-", "start", "10:00");
    await selectFormTime(page, "single-", "end", "11:00");
    await page.locator("#location").fill(baseInput.location);
    await page.locator("#capacity").fill("10");
    await page.getByRole("checkbox", { name: /我確認以上資訊無誤/ }).check();
    await page.getByRole("button", { name: "建立課程" }).click();

    // 沒選瑜伽類型：留在原頁、顯示提醒，沒有建立任何課程。
    await expect(page.getByText("請至少選擇一種瑜伽類型，或在「其他」填寫。")).toBeVisible();
    await expect(page).toHaveURL(/\/teacher\/classes\/new$/);
    expect(
      await prisma.classSession.count({
        where: { teacherProfileId: teacher.teacherProfileId },
      }),
    ).toBe(0);

    // 只填「其他」也算有選。
    await page.locator("#yoga-styles-other").fill("自訂風格");
    await expect(page.getByText("請至少選擇一種瑜伽類型，或在「其他」填寫。")).toBeHidden();
    await page.getByRole("button", { name: "建立課程" }).click();
    await expect(page.getByText("課程已建立。")).toBeVisible();

    const created = await prisma.classSession.findFirstOrThrow({
      where: { teacherProfileId: teacher.teacherProfileId },
      select: { yogaStyles: true },
    });
    expect(created.yogaStyles).toEqual(["自訂風格"]);
  });

  test("course styles (課程風格) are multi-select up to 3, the first pick is the primary serviceType, and the 4th is disabled", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-styles-${Date.now()}`,
    );
    const email = `teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const teacher = await createTeacherProfileWithSession({
      email,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });

    await addAuthSessionCookie(context, teacher.sessionToken);
    await page.goto("/teacher/classes/new");

    await page.locator("#title").fill(`多選測試 ${testRunId}`);
    await pickServiceType(page, "流汗活力");
    await pickServiceType(page, "核心與體態");
    await pickServiceType(page, "冥想與呼吸");
    // 已選 3 個：其他選項不能再選，但已選的可以取消。
    await expect(page.getByRole("checkbox", { name: "放鬆紓壓" })).toBeDisabled();
    await expect(page.getByRole("checkbox", { name: "流汗活力" })).toBeEnabled();
    await expect(page.getByText("已選 3 / 3")).toBeVisible();

    await page.locator("#single-date").fill(futureDateString(72));
    await selectFormTime(page, "single-", "start", "09:00");
    await selectFormTime(page, "single-", "end", "10:00");
    await page.locator("#location").fill(baseInput.location);
    await page.locator("#capacity").fill("10");
    await page.getByText("流瑜珈", { exact: true }).click();
    await page.getByRole("checkbox", { name: /我確認以上資訊無誤/ }).check();
    await page.getByRole("button", { name: "建立課程" }).click();
    await expect(page.getByText("課程已建立。")).toBeVisible();
    await expect(page.getByText("流汗活力、核心與體態、冥想與呼吸")).toBeVisible();

    const created = await prisma.classSession.findFirstOrThrow({
      where: { teacherProfileId: teacher.teacherProfileId },
      select: { serviceType: true, serviceTypes: true },
    });
    expect(created.serviceTypes).toEqual(["流汗活力", "核心與體態", "冥想與呼吸"]);
    expect(created.serviceType).toBe("流汗活力");
  });

  test("a public class shows its yoga styles on the public list and detail pages", async ({ page }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-public-${Date.now()}`,
    );
    const email = `teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);
    const teacher = await createTeacherProfileWithSession({
      email,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });

    const validation = validateClassSessionCreate(
      { ...baseInput, title: `公開風格課 ${testRunId}`, yogaStyles: ["哈達瑜伽", "陰瑜珈"] },
      { requireYogaStyles: true },
    );
    if (!validation.valid) throw new Error("unexpected invalid input in test fixture");

    const created = await createClassSessionForTeacher(teacher.teacherProfileId, validation.normalized);
    if (!created.ok) throw new Error("unexpected create failure in test fixture");
    await prisma.classSession.update({
      where: { id: created.classSessionId },
      data: { status: "open_for_enrollment" },
    });

    await page.goto(`/classes/${created.classSessionId}`);
    await expect(page.getByText("瑜伽類型", { exact: true })).toBeVisible();
    await expect(page.getByText("哈達瑜伽、陰瑜珈")).toBeVisible();

    await page.goto("/classes");
    await expect(page.getByText("瑜伽類型：哈達瑜伽、陰瑜珈").first()).toBeVisible();
  });
});
