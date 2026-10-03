import { expect, test, type Page } from "@playwright/test";

import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// docs/signed-in-navigation-plan.md：登入後全站用專區導覽列、記住上次身分、
// 首頁與登入頁把已登入的人導到上次身分的總覽。
const testEmailDomain = "signed-in-navigation-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

function runId(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  return normalizeForEmail(
    `${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`,
  );
}

async function seedMember(id: string) {
  const email = `member-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  return createUserSession({ email });
}

async function seedTeacher(id: string, status: "submitted" | "approved") {
  const email = `teacher-${id}@${testEmailDomain}`;
  createdEmails.push(email);
  return createTeacherProfileWithSession({ email, displayName: `Teacher ${id}`, status });
}

async function expectArea(page: Page, areaLabel: string) {
  const banner = page.getByRole("banner");
  await expect(banner.getByText(areaLabel, { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "公開網站導覽" })).toHaveCount(0);
}

// 手機版角色切換在 ☰ 選單裡，要先打開。
async function expectCurrentRole(page: Page, roleLabel: string) {
  const menuButton = page.getByRole("banner").getByRole("button", { name: "選單", exact: true });
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  await expect(
    page.getByRole("button", { name: new RegExp(`目前身分：${roleLabel}`) }),
  ).toBeVisible();
}

test.describe("signed-in navigation", () => {
  test("home and sign-in send a signed-in user to the last-used area, falling back to member; callbackUrl still wins and stays on-site", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "landing");
    const { sessionToken } = await seedTeacher(id, "submitted");
    await addAuthSessionCookie(context, sessionToken);

    // 還沒進過任何專區：從學員開始。
    await page.goto("/");
    await expect(page).toHaveURL(/\/member\/dashboard$/);

    // 進過老師專區後：首頁、登入頁都回老師總覽。
    await page.goto("/teacher/dashboard");
    await page.goto("/");
    await expect(page).toHaveURL(/\/teacher\/dashboard$/);
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/teacher\/dashboard$/);

    // 有指定要回去的站內頁面就回去；站外網址會被過濾掉，改回上次身分總覽。
    await page.goto(`/sign-in?callbackUrl=${encodeURIComponent("/classes")}`);
    await expect(page).toHaveURL(/\/classes$/);
    await page.goto(`/sign-in?callbackUrl=${encodeURIComponent("https://evil.example/")}`);
    await expect(page).toHaveURL(/\/teacher\/dashboard$/);
  });

  // member-flow-redesign 票 01：/classes 套學員外框，導覽列的 /member/* 會被背景預先載入；
  // 預先載入不算進入學員專區，真的點進去才算。
  test("background prefetch of member links does not change the last-used area; actually entering the member area does", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "prefetch");
    const { sessionToken } = await seedTeacher(id, "submitted");
    await addAuthSessionCookie(context, sessionToken);
    const lastRole = async () =>
      (await context.cookies()).find((cookie) => cookie.name === "fsy_last_role")?.value;

    await page.goto("/teacher/dashboard");
    expect(await lastRole()).toBe("teacher");

    const memberPrefetch = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.startsWith("/member/") &&
        response.request().headers()["next-router-prefetch"] !== undefined,
    );
    await page.goto("/classes");
    await memberPrefetch;
    expect(await lastRole()).toBe("teacher");

    await page.goto("/");
    await expect(page).toHaveURL(/\/teacher\/dashboard$/);

    // 從 /classes 點 logo 真的進入學員總覽：上次身分改為學員。
    await page.goto("/classes");
    await page.getByRole("banner").getByRole("link", { name: /飛索・瑜伽團課共創平台/ }).click();
    await expect(page).toHaveURL(/\/member\/dashboard$/);
    await expect.poll(lastRole).toBe("member");
    await page.goto("/");
    await expect(page).toHaveURL(/\/member\/dashboard$/);
  });

  // 同專區換頁會重用 layout；另一個分頁改掉 cookie 後，這個分頁在同專區換頁也要寫回。
  test("navigating inside an area rewrites the last-used area even after another tab changed it", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "tabs");
    const { sessionToken } = await seedTeacher(id, "submitted");
    await addAuthSessionCookie(context, sessionToken);
    const lastRole = async () =>
      (await context.cookies()).find((cookie) => cookie.name === "fsy_last_role")?.value;

    await page.goto("/teacher/dashboard");
    expect(await lastRole()).toBe("teacher");
    // 等這個分頁掛載時送出的記錄請求完成，避免它晚於另一個分頁抵達而蓋掉 member。
    await page.waitForLoadState("networkidle");

    const otherTab = await context.newPage();
    await otherTab.goto("/member/dashboard");
    expect(await lastRole()).toBe("member");
    await otherTab.close();

    const menuButton = page.getByRole("banner").getByRole("button", { name: "選單", exact: true });
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }
    await page.getByRole("link", { name: "通知", exact: true }).click();
    await expect(page).toHaveURL(/\/teacher\/notifications$/);
    await expect.poll(lastRole).toBe("teacher");

    await page.goto("/");
    await expect(page).toHaveURL(/\/teacher\/dashboard$/);
  });

  test("switching role from the menu updates the last-used area each time", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "switch");
    const { sessionToken } = await seedTeacher(id, "submitted");
    await addAuthSessionCookie(context, sessionToken);
    const lastRole = async () =>
      (await context.cookies()).find((cookie) => cookie.name === "fsy_last_role")?.value;
    const switchTo = async (label: string) => {
      const menuButton = page.getByRole("banner").getByRole("button", { name: "選單", exact: true });
      if (await menuButton.isVisible()) {
        await menuButton.click();
      }
      await page.getByRole("button", { name: /目前身分/ }).click();
      await page.locator("#role-switch-menu").getByRole("link", { name: label, exact: true }).click();
    };

    await page.goto("/teacher/dashboard");

    await switchTo("學員");
    await expect(page).toHaveURL(/\/member\/dashboard$/);
    await expect.poll(lastRole).toBe("member");
    await page.goto("/");
    await expect(page).toHaveURL(/\/member\/dashboard$/);

    await switchTo("老師");
    await expect(page).toHaveURL(/\/teacher\/dashboard$/);
    await expect.poll(lastRole).toBe("teacher");
    await page.goto("/");
    await expect(page).toHaveURL(/\/teacher\/dashboard$/);
  });

  test("a remembered role the user no longer has falls back to the member dashboard", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "fallback");
    const { sessionToken } = await seedMember(id);
    await addAuthSessionCookie(context, sessionToken);
    await context.addCookies([
      { name: "fsy_last_role", value: "admin", domain: "127.0.0.1", path: "/" },
    ]);

    await page.goto("/");
    await expect(page).toHaveURL(/\/member\/dashboard$/);
  });

  test("public entry points use the right signed-in area: a teacher under review sees the teacher area on 老師合作, a member sees the member area elsewhere", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "areas");
    const teacher = await seedTeacher(id, "submitted");
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto("/teachers/join");
    await expectArea(page, "老師專區");
    await expectCurrentRole(page, "老師");

    // 搜尋課程：學員專區，「找課程」是目前頁，logo 連到學員總覽。
    await page.goto("/classes");
    await expectArea(page, "學員專區");
    await expect(
      page.getByRole("banner").getByRole("link", { name: /飛索・瑜伽團課共創平台/ }),
    ).toHaveAttribute("href", "/member/dashboard");
    await expectCurrentRole(page, "學員");

    await context.clearCookies();
    const member = await seedMember(id);
    await addAuthSessionCookie(context, member.sessionToken);
    await page.goto("/teachers/join");
    await expectArea(page, "學員專區");
    await page.goto("/organizers/request");
    await expectArea(page, "學員專區");
  });

  test("about, FAQ and the shared notifications page follow the last-used area; members get their own notifications page", async ({
    context,
    page,
  }, testInfo) => {
    const id = runId(testInfo, "shared");
    const teacher = await seedTeacher(id, "approved");
    await addAuthSessionCookie(context, teacher.sessionToken);

    await page.goto("/teacher/dashboard");
    for (const path of ["/about", "/faq", "/notifications"]) {
      await page.goto(path);
      await expectArea(page, "老師專區");
    }

    await page.goto("/member/notifications");
    await expectArea(page, "學員專區");
    await expect(page.getByRole("heading", { name: "我的通知" })).toBeVisible();
    // 進過學員專區後，共用頁跟著換成學員。
    await page.goto("/about");
    await expectArea(page, "學員專區");
  });

  test("visitors keep the public header without 我的專區", async ({ page }) => {
    for (const path of ["/", "/classes", "/about", "/faq", "/teachers/join", "/organizers/request", "/sign-in"]) {
      await page.goto(path);
      // 首頁的 header 包在 <main> 裡，不算 banner，所以直接找第一個 header。
      const banner = page.locator("header").first();
      await expect(banner.getByText("Free Soar Yoga")).toBeVisible();
      await expect(banner.getByRole("link", { name: "我的專區" })).toHaveCount(0);
    }
  });
});
