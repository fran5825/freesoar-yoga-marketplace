import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { generateOccurrencesForSeries } from "../../src/domain/class-session/__internal__/generate-recurring-occurrences-core";
import { computeNextWeeklyOccurrenceDates } from "../../src/domain/class-session/recurring-series-dates";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import { sanitizeCallbackUrl } from "../../src/lib/auth/callback-url";
import {
  addAuthSessionCookie,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import { futureDateTime } from "./_helpers/future-dates";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

const testEmailDomain = "public-classes-discovery-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.enrollment.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.recurringClassSeries.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

async function seedApprovedTeacher(testRunId: string) {
  const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
  createdEmails.push(teacherEmail);
  return createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Teacher ${testRunId}`,
    status: "approved",
  });
}

async function seedPublicClassSession({
  testRunId,
  teacherProfileId,
  title,
  serviceType = "伸展與身體保養",
  startAt = "2026-11-02T14:00",
  endAt = "2026-11-02T15:00",
  isPublic = true,
  status = "open_for_enrollment" as const,
}: {
  testRunId: string;
  teacherProfileId: string;
  title: string;
  serviceType?: string;
  startAt?: string;
  endAt?: string;
  isPublic?: boolean;
  status?: "draft" | "open_for_enrollment" | "cancelled" | "completed";
}) {
  const validation = validateClassSessionCreate({
    title,
    serviceType,
    startAt,
    endAt,
    location: `Test Studio ${testRunId}`,
    capacity: 10,
    isPublic,
  });
  if (!validation.valid) throw new Error("unexpected invalid input in test fixture");

  const created = await createClassSessionForTeacher(teacherProfileId, validation.normalized);
  if (!created.ok) throw new Error(`unexpected create failure: ${created.code}`);

  if (status !== "draft") {
    await prisma.classSession.update({
      where: { id: created.classSessionId },
      data: { status },
    });
  }

  return created.classSessionId;
}

test.describe("sanitizeCallbackUrl (direct, no UI)", () => {
  test("accepts relative in-site paths, rejects protocol-relative and absolute external URLs", () => {
    expect(sanitizeCallbackUrl("/classes/abc123")).toBe("/classes/abc123");
    expect(sanitizeCallbackUrl(undefined)).toBeNull();
    expect(sanitizeCallbackUrl(null)).toBeNull();
    expect(sanitizeCallbackUrl("")).toBeNull();
    expect(sanitizeCallbackUrl("//evil.example.com")).toBeNull();
    expect(sanitizeCallbackUrl("https://evil.example.com")).toBeNull();
    expect(sanitizeCallbackUrl("evil.example.com")).toBeNull();
  });
});

// member-flow-redesign 票 05：課程頁直接開始 Google 登入。測試不連 Google：擋下瀏覽器往 Google 的導向，
// 讀 Auth.js 記下的回程網址（authjs.callback-url），再用 session cookie 模擬登入完成、前往該網址。
async function startGoogleSignInFromClass(page: Page, context: BrowserContext): Promise<string> {
  await page.route("https://accounts.google.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>google stub</p>" }),
  );
  const googleRequest = page.waitForRequest((request) => request.url().startsWith("https://accounts.google.com/"));
  await page.getByRole("button", { name: "使用 Google 登入並報名" }).click();
  await googleRequest;
  await page.waitForURL(/^https:\/\/accounts\.google\.com\//);
  const callbackCookie = (await context.cookies()).find((cookie) => cookie.name.endsWith("authjs.callback-url"));
  expect(callbackCookie).toBeDefined();
  const callbackUrl = new URL(decodeURIComponent(callbackCookie!.value));
  expect(["127.0.0.1", "localhost"]).toContain(callbackUrl.hostname);
  return `${callbackUrl.pathname}${callbackUrl.search}`;
}

test.describe("public classes discovery smoke", () => {
  test("combined filters survive detail, sign-in, enrollment and cancel; long content remains usable on small screens", async ({ page, context }, testInfo) => {
    testInfo.setTimeout(90_000);
    const run = normalizeForEmail(`${testInfo.project.name}-return-flow-${Date.now()}`);
    const teacher = await seedApprovedTeacher(run);
    const id = await seedPublicClassSession({ testRunId: run, teacherProfileId: teacher.teacherProfileId, title: `Find ${run}`, startAt: futureDateTime(12, "18:00"), endAt: futureDateTime(12, "19:00") });
    const title = `舒展與呼吸練習 ${"溫柔感受身體的節奏".repeat(5)}`;
    const address = `信義區 ${"場地地址與入口說明".repeat(15)}`;
    await prisma.classSession.update({ where: { id }, data: { title, yogaStyles: ["哈達"], location: address, description: "帶著覺察練習。".repeat(285) } });
    const email = `member-${run}@${testEmailDomain}`;
    createdEmails.push(email);
    const { userId, sessionToken } = await createUserSession({ email });
    await page.goto("/classes");
    await page.getByLabel("地點", { exact: true }).fill("  信義區  ");
    await page.getByLabel("時段", { exact: true }).selectOption("evening");
    await page.getByLabel("瑜伽類型", { exact: true }).selectOption("哈達");
    await page.getByRole("button", { name: "套用篩選" }).click();
    await page.setViewportSize({ width: 375, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("list-375.png"), fullPage: true });
    await page.getByRole("link", { name: new RegExp(title) }).click();
    const returnLink = page.getByRole("link", { name: "返回課程列表", exact: true });
    const returnTo = await returnLink.getAttribute("href");
    expect(returnTo).toBe("/classes?timeOfDay=evening&location=%E4%BF%A1%E7%BE%A9%E5%8D%80&yogaStyle=%E5%93%88%E9%81%94");
    const summary = page.getByRole("region", { name: "課程重點" });
    const panel = page.getByRole("region", { name: "報名這堂課程" });
    expect((await summary.boundingBox())!.y).toBeLessThan((await panel.boundingBox())!.y);
    expect((await panel.boundingBox())!.y).toBeLessThan((await page.getByRole("region", { name: "課程說明" }).boundingBox())!.y);
    for (const width of [375, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`visitor-${width}.png`), fullPage: true });
      if (width === 375 || width === 1280) await page.screenshot({ path: testInfo.outputPath(`visitor-${width}-viewport.png`) });
    }
    const signInDestination = await startGoogleSignInFromClass(page, context);
    expect(signInDestination).toBe(`/classes/${id}?returnTo=${encodeURIComponent(returnTo!)}`);
    await addAuthSessionCookie(context, sessionToken);
    await page.goto(signInDestination);
    await expect(returnLink).toHaveAttribute("href", returnTo!);
    expect(await prisma.enrollment.count({ where: { userId, classSessionId: id } })).toBe(0);
    const consent = page.getByRole("checkbox", { name: /我了解此課程非醫療行為/ });
    await expect(consent).not.toBeChecked();
    await page.setViewportSize({ width: 375, height: 900 });
    await page.getByLabel("備註（選填）").focus();
    await expect(page.getByRole("link", { name: "前往報名", exact: true })).toBeHidden();
    await page.keyboard.press("Tab");
    await expect(consent).toBeFocused();
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "確認報名", exact: true })).toBeFocused();
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "確認報名", exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "確認報名", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("member-text-200-percent.png"), fullPage: true });
    await page.screenshot({ path: testInfo.outputPath("member-text-200-percent-viewport.png") });
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.getByRole("button", { name: "確認報名", exact: true }).click();
    await expect(page.getByText("報名成功。")).toBeVisible();
    await expect(returnLink).toHaveAttribute("href", returnTo!);
    await page.getByText("取消報名…", { exact: true }).click();
    await page.getByRole("checkbox", { name: "我確認要取消這則報名。" }).check();
    await page.getByRole("button", { name: "確認取消", exact: true }).click();
    await expect(page.getByText("報名已取消。")).toBeVisible();
    await expect(returnLink).toHaveAttribute("href", returnTo!);
    await returnLink.click();
    await expect(page.getByLabel("地點", { exact: true })).toHaveValue("信義區");
    await expect(page.getByLabel("瑜伽類型", { exact: true })).toHaveValue("哈達");
    await expect(page.getByLabel("時段", { exact: true })).toHaveValue("evening");
  });

  test("custom dates reject reversed bounds and include the entire end date; started courses stay hidden", async ({ page }, testInfo) => {
    const run = normalizeForEmail(`${testInfo.project.name}-date-filter-${Date.now()}`);
    const teacher = await seedApprovedTeacher(run);
    const day = futureDateTime(14, "23:00").slice(0, 10);
    const id = await seedPublicClassSession({ testRunId: run, teacherProfileId: teacher.teacherProfileId, title: `Date ${run}`, startAt: `${day}T23:00`, endAt: `${day}T23:30` });
    await page.goto("/classes");
    await page.getByLabel("日期", { exact: true }).selectOption("custom");
    await expect(page.getByLabel("開始日期", { exact: true })).toBeVisible();
    await page.getByLabel("開始日期", { exact: true }).fill(day);
    await page.getByLabel("結束日期", { exact: true }).fill(day);
    await page.getByRole("button", { name: "套用篩選" }).click();
    await expect(page.getByRole("link", { name: new RegExp(`Date ${run}`) })).toBeVisible();
    await page.goto(`/classes?dateRange=custom&dateFrom=${day}&dateTo=2020-01-01`);
    await expect(page.getByRole("region", { name: "篩選課程" }).getByRole("alert")).toContainText("結束日期不能早於開始日期");
    await prisma.classSession.update({ where: { id }, data: { startAt: new Date(Date.now() - 3600_000), endAt: new Date() } });
    await page.goto("/classes?includeFull=1");
    await expect(page.getByRole("link", { name: new RegExp(`Date ${run}`) })).toHaveCount(0);
  });

  test("an unauthenticated visitor can view a public, open, approved-teacher class session's detail without an enrollment form, and is offered a login link back to the same page", async ({
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-visitor-detail-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);
    const classSessionId = await seedPublicClassSession({
      testRunId,
      teacherProfileId: teacher.teacherProfileId,
      title: `Public Class ${testRunId}`,
    });

    const response = await page.goto(`/classes/${classSessionId}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: `Public Class ${testRunId}` })).toBeVisible();
    await expect(page.getByText(`Teacher ${testRunId}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "確認報名" })).toBeHidden();
    await expect(page.getByLabel("備註（選填）")).toBeHidden();

    await expect(page.getByRole("button", { name: "使用 Google 登入並報名" })).toBeVisible();
    await expect(page.getByText(/第一次使用會自動建立帳號/)).toBeVisible();
  });

  // member-usability 票 07：把「分享連結 → 詳情 → 登入 → 回原頁 → 自己按報名 → 看到下一步」串成一次走完。
  // Google 登入本身無法在測試裡操作：票 05 起由課程頁直接進 Google，用 startGoogleSignInFromClass 讀出
  // Auth.js 記下的回程網址，再加上 session cookie 前往該網址，模擬 Google 登入完成。
  test("share link to enrolled: visitor detail → direct Google sign-in → back on the same class (not auto-enrolled) → enroll → pending next step", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-share-flow-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);
    const classSessionId = await seedPublicClassSession({
      testRunId,
      teacherProfileId: teacher.teacherProfileId,
      title: `Share Flow ${testRunId}`,
      startAt: futureDateTime(45, "19:00"),
      endAt: futureDateTime(45, "20:00"),
    });
    await prisma.classSession.update({
      where: { id: classSessionId },
      data: { requiresApproval: true },
    });
    const memberEmail = `member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const { userId, sessionToken } = await createUserSession({ email: memberEmail });

    // 畫面 1：分享連結打開的課程詳情（訪客）。
    await page.goto(`/classes/${classSessionId}`);
    await expect(page.getByText("剩 10 個名額")).toBeVisible();
    await expect(page.getByText("老師開課", { exact: true })).toBeVisible();
    // 畫面 2：直接進 Google（票 05，不再經過站內登入頁）。Auth.js 記下的回程網址是同一堂課。
    const signInDestination = await startGoogleSignInFromClass(page, context);
    expect(signInDestination).toBe(`/classes/${classSessionId}`);

    // 模擬 Google 登入完成 → 畫面 3：回到同一堂課，已是學員專區，但不會自動報名。
    await addAuthSessionCookie(context, sessionToken);
    await page.goto(signInDestination);
    await expect(page).toHaveURL(new RegExp(`/classes/${classSessionId}$`));
    await expect(page.getByRole("banner").getByText("學員專區", { exact: true })).toBeVisible();
    expect(await prisma.enrollment.count({ where: { classSessionId, userId } })).toBe(0);

    // 同一畫面送出申請：等待老師確認與下一步，名額已被佔用。
    await page.getByRole("checkbox", { name: /我了解此課程非醫療行為/ }).check();
    await page.getByRole("button", { name: "送出報名申請" }).click();
    await expect(page.getByText("報名已送出，等待老師確認。")).toBeVisible();
    await expect(page.getByText("等待老師確認", { exact: true })).toBeVisible();
    await expect(page.getByText(/老師確認後才算成立，確認結果會顯示在「通知」/)).toBeVisible();
    await expect(page.getByRole("link", { name: "查看我的報名" })).toHaveAttribute(
      "href",
      "/member/enrollments",
    );
    await expect(page.getByText("剩 9 個名額")).toBeVisible();
    expect(
      (await prisma.enrollment.findFirstOrThrow({ where: { classSessionId, userId } })).status,
    ).toBe("pending");
  });

  test("a visitor gets the generic sign-in guide (no existence leak) for a non-public class, a draft class, and a class taught by a suspended teacher, even though the last one is otherwise open_for_enrollment and isPublic=true", async ({
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-visitor-404-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    // 同一位老師底下的兩堂課，時段必須錯開，否則會撞上 conflict-check（跟本測試要驗證的
    // 主題無關的另一個既有規則）。
    const privateClassId = await seedPublicClassSession({
      testRunId: `${testRunId}-private`,
      teacherProfileId: teacher.teacherProfileId,
      title: `Private Class ${testRunId}`,
      isPublic: false,
      startAt: "2026-11-02T14:00",
      endAt: "2026-11-02T15:00",
    });
    const draftClassId = await seedPublicClassSession({
      testRunId: `${testRunId}-draft`,
      teacherProfileId: teacher.teacherProfileId,
      title: `Draft Class ${testRunId}`,
      status: "draft",
      startAt: "2026-11-02T16:00",
      endAt: "2026-11-02T17:00",
    });

    const suspendedTeacher = await seedApprovedTeacher(`${testRunId}-suspended`);
    const suspendedTeacherClassId = await seedPublicClassSession({
      testRunId: `${testRunId}-suspended`,
      teacherProfileId: suspendedTeacher.teacherProfileId,
      title: `Suspended Teacher Class ${testRunId}`,
    });
    await prisma.teacherProfile.update({
      where: { id: suspendedTeacher.teacherProfileId },
      data: { status: "suspended" },
    });

    // organizer-usability-redesign 票 13：訪客讀不到的課程改顯示通用登入引導（不再 not-found），
    // 不出現任何課程內容；一致性細節見 organizer-class-sharing.spec.ts。
    for (const [classSessionId, title] of [
      [privateClassId, `Private Class ${testRunId}`],
      [draftClassId, `Draft Class ${testRunId}`],
      [suspendedTeacherClassId, `Suspended Teacher Class ${testRunId}`],
    ]) {
      await page.goto(`/classes/${classSessionId}`);
      await expect(page.getByRole("heading", { name: "登入後查看這堂課" })).toBeVisible();
      await expect(page.getByText(title)).toHaveCount(0);
    }
  });

  test("a signed-in member visiting the same class session URL still gets the existing member experience (enrollment form, three-state ownEnrollment), unaffected by the visitor branch", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-member-unaffected-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);
    const classSessionId = await seedPublicClassSession({
      testRunId,
      teacherProfileId: teacher.teacherProfileId,
      title: `Member Class ${testRunId}`,
    });

    const memberEmail = `member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const { sessionToken } = await createUserSession({ email: memberEmail });

    await addAuthSessionCookie(context, sessionToken);
    const response = await page.goto(`/classes/${classSessionId}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: `Member Class ${testRunId}` })).toBeVisible();
    await expect(page.getByRole("button", { name: "確認報名" })).toBeVisible();
    await expect(page.getByRole("button", { name: "使用 Google 登入並報名" })).toBeHidden();
  });

  test("/classes public list only shows qualifying sessions, and the serviceType/dayOfWeek filters narrow correctly for both single classes and recurring-series occurrences", async ({
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-list-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    await seedPublicClassSession({
      testRunId: `${testRunId}-hatha`,
      teacherProfileId: teacher.teacherProfileId,
      title: `Hatha Public ${testRunId}`,
      serviceType: "伸展與身體保養",
      startAt: "2026-11-02T14:00", // 2026-11-02 是星期一
      endAt: "2026-11-02T15:00",
    });

    // 非公開課程：不該出現在列表。時段跟上面那堂錯開，避免撞上跟本測試主題無關的
    // conflict-check。
    await seedPublicClassSession({
      testRunId: `${testRunId}-private`,
      teacherProfileId: teacher.teacherProfileId,
      title: `Private ${testRunId}`,
      isPublic: false,
      startAt: "2026-11-02T16:00",
      endAt: "2026-11-02T17:00",
    });

    // 常規課程系列生成的場次：星期幾篩選要吃 series.dayOfWeek，不是從 startAt 推算。
    const series = await prisma.recurringClassSeries.create({
      data: {
        teacherProfileId: teacher.teacherProfileId,
        title: `Vinyasa Series ${testRunId}`,
        serviceType: "Vinyasa Flow",
        dayOfWeek: 3, // 星期三
        startTime: "18:00",
        endTime: "19:00",
        location: "Series Studio",
        capacity: 10,
      },
    });
    const generated = await generateOccurrencesForSeries(
      teacher.teacherProfileId,
      series.id,
      computeNextWeeklyOccurrenceDates(3, 1),
    );
    if (!generated.ok) throw new Error("unexpected error in test fixture");
    await prisma.classSession.updateMany({
      where: { id: { in: generated.createdClassSessionIds } },
      data: { status: "open_for_enrollment", isPublic: true },
    });

    await page.goto("/classes");
    await expect(page.getByText(`Hatha Public ${testRunId}`)).toBeVisible();
    await expect(page.getByText(`Vinyasa Series ${testRunId}`)).toBeVisible();
    await expect(page.getByText(`Private ${testRunId}`)).toBeHidden();

    await page.goto(
      `/classes?serviceType=${encodeURIComponent("伸展與身體保養")}`,
    );
    await expect(page.getByText(`Hatha Public ${testRunId}`)).toBeVisible();
    await expect(page.getByText(`Vinyasa Series ${testRunId}`)).toBeHidden();

    // 星期一（dayOfWeek=1）：只有單堂那個吃 startAt 推算命中，常規系列（星期三）不該出現。
    await page.goto("/classes?dayOfWeek=1");
    await expect(page.getByText(`Hatha Public ${testRunId}`)).toBeVisible();
    await expect(page.getByText(`Vinyasa Series ${testRunId}`)).toBeHidden();

    // 星期三（dayOfWeek=3）：只有常規系列那場吃 series.dayOfWeek 命中。
    await page.goto("/classes?dayOfWeek=3");
    await expect(page.getByText(`Hatha Public ${testRunId}`)).toBeHidden();
    await expect(page.getByText(`Vinyasa Series ${testRunId}`)).toBeVisible();

    await page.goto("/classes");
    await page.getByText(`Hatha Public ${testRunId}`).click();
    await expect(page.getByRole("heading", { name: `Hatha Public ${testRunId}` })).toBeVisible();
  });

  test("/classes defaults to available seats, applies filters together, and optionally includes full classes", async ({
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-chips-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);

    await seedPublicClassSession({
      testRunId: `${testRunId}-open`,
      teacherProfileId: teacher.teacherProfileId,
      title: `Open Seats ${testRunId}`,
      startAt: futureDateTime(40, "10:00"),
      endAt: futureDateTime(40, "11:00"),
    });
    const fullId = await seedPublicClassSession({
      testRunId: `${testRunId}-full`,
      teacherProfileId: teacher.teacherProfileId,
      title: `Full Class ${testRunId}`,
      startAt: futureDateTime(41, "10:00"),
      endAt: futureDateTime(41, "11:00"),
    });
    await prisma.classSession.update({ where: { id: fullId }, data: { capacity: 1 } });
    const memberEmail = `member-${testRunId}@${testEmailDomain}`;
    createdEmails.push(memberEmail);
    const { userId } = await createUserSession({ email: memberEmail });
    await prisma.enrollment.create({
      data: { classSessionId: fullId, userId, status: "confirmed", consentedAt: new Date() },
    });

    await page.goto("/classes");
    const openCard = page.getByRole("link", { name: new RegExp(`Open Seats ${testRunId}`) });
    const fullCard = page.getByRole("link", { name: new RegExp(`Full Class ${testRunId}`) });
    await expect(openCard).toContainText("老師開課");
    await expect(openCard).toContainText("開放報名");
    await expect(openCard).toContainText("剩 10 個名額");
    await expect(fullCard).toBeHidden();
    await page.getByText("更多篩選", { exact: true }).click();
    await page.getByLabel("包含額滿課程").check();
    await page.getByRole("button", { name: "套用篩選" }).click();
    await expect(page).toHaveURL(/includeFull=1/);
    await expect(openCard).toBeVisible();
    await expect(fullCard).toContainText("已額滿");

    await page.getByLabel("課程風格", { exact: true }).selectOption("冥想與呼吸");
    await page.getByRole("button", { name: "套用篩選" }).click();
    await expect(page).toHaveURL(/serviceType=/);
    await expect(page).toHaveURL(/includeFull=1/);
    await expect(page.getByText("目前沒有符合條件的公開課程")).toBeVisible();
    await page.getByRole("link", { name: "清除篩選" }).first().click();
    await expect(page).toHaveURL(/\/classes$/);
    await expect(fullCard).toBeHidden();
  });

  test("/classes excludes a suspended teacher's otherwise-qualifying public class", async ({
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-list-suspended-${Date.now()}`,
    );
    const teacher = await seedApprovedTeacher(testRunId);
    await seedPublicClassSession({
      testRunId,
      teacherProfileId: teacher.teacherProfileId,
      title: `Should Be Hidden ${testRunId}`,
    });
    await prisma.teacherProfile.update({
      where: { id: teacher.teacherProfileId },
      data: { status: "suspended" },
    });

    await page.goto("/classes");
    await expect(page.getByText(`Should Be Hidden ${testRunId}`)).toBeHidden();
  });
});
