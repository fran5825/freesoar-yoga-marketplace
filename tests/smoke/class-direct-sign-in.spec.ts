import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { createClassSessionForTeacher } from "../../src/domain/class-session/__internal__/create-teacher-class-session-core";
import { validateClassSessionCreate } from "../../src/domain/class-session/validation";
import {
  cleanupDemandResponseFixtures,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";
import { futureDateTime } from "./_helpers/future-dates";
import {
  addAuthSessionCookie,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// member-flow-redesign 票 05：訪客從課程頁直接 Google 登入、取消／失敗的出口，以及 callback 安全。
// 不連 Google：擋下瀏覽器往 accounts.google.com 的導向，改讀 Auth.js 記下的回程網址
// （authjs.callback-url）與本站的登入返回 cookie（fsy_sign_in_return）。
// 前提：伺服器送出登入與 callback 時會連 Google 的 OIDC discovery，執行環境需要能連外網。
const testEmailDomain = "class-direct-sign-in-smoke.local";
const createdEmails: string[] = [];
const backslash = String.fromCharCode(92);
const MALICIOUS_CALLBACKS = [
  "https://evil.example/",
  "//evil.example",
  `/${backslash}evil.example/`,
  "/a/..//evil.example/",
  "/a/%2e%2e//evil.example/",
  "/classes\tevil",
];

test.afterAll(async () => {
  await prisma.enrollment.deleteMany({ where: { classSession: { teacherProfile: { user: { email: { in: createdEmails } } } } } });
  await prisma.classSession.deleteMany({ where: { teacherProfile: { user: { email: { in: createdEmails } } } } });
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

async function seedOpenClass(testRunId: string) {
  const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
  createdEmails.push(teacherEmail);
  const teacher = await createTeacherProfileWithSession({
    email: teacherEmail,
    displayName: `Teacher ${testRunId}`,
    status: "approved",
  });
  const validation = validateClassSessionCreate({
    title: `Direct Sign-in ${testRunId}`,
    serviceType: "伸展與身體保養",
    startAt: futureDateTime(20, "19:00"),
    endAt: futureDateTime(20, "20:00"),
    location: `Test Studio ${testRunId}`,
    capacity: 10,
    isPublic: true,
  });
  if (!validation.valid) throw new Error("unexpected invalid input in test fixture");
  const created = await createClassSessionForTeacher(teacher.teacherProfileId, validation.normalized);
  if (!created.ok) throw new Error(`unexpected create failure: ${created.code}`);
  await prisma.classSession.update({ where: { id: created.classSessionId }, data: { status: "open_for_enrollment" } });
  return created.classSessionId;
}

function runId(testInfo: { project: { name: string } }, label: string) {
  return normalizeForEmail(`${testInfo.project.name}-${label}-${Date.now()}`);
}

async function cookieValue(context: BrowserContext, suffix: string): Promise<string | undefined> {
  const cookie = (await context.cookies()).find((item) => item.name.endsWith(suffix));
  return cookie ? decodeURIComponent(cookie.value) : undefined;
}

// 按下登入按鈕，等瀏覽器準備前往 Google（回一個假頁面，不真的連 Google），回傳 Auth.js 記下的回程網址（path＋query）。
async function submitAndInterceptGoogle(page: Page, context: BrowserContext, buttonName: string): Promise<string> {
  await page.route("https://accounts.google.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>google stub</p>" }),
  );
  const googleRequest = page.waitForRequest((request) => request.url().startsWith("https://accounts.google.com/"));
  await page.getByRole("button", { name: buttonName }).click();
  await googleRequest;
  await page.waitForURL(/^https:\/\/accounts\.google\.com\//);
  const callback = await cookieValue(context, "authjs.callback-url");
  expect(callback).toBeDefined();
  const url = new URL(callback!);
  // Auth.js 以環境設定的站台網址組回程網址（本機可能是 localhost:3000），只確認是本機、不是外站。
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
  return `${url.pathname}${url.search}`;
}

// Auth.js 錯誤時以環境設定的站台網址組轉址（本機可能是 localhost:3000），所以不讓瀏覽器跟著轉址：
// 只讀轉址目標，確認是本站 /sign-in?error=…，回傳 path＋query 讓測試在目前的伺服器打開。
async function authRedirectPath(page: Page, url: string): Promise<string> {
  const response = await page.request.get(url, { maxRedirects: 0 });
  expect([302, 303, 307]).toContain(response.status());
  const location = new URL(response.headers()["location"], "http://placeholder.invalid");
  expect(["127.0.0.1", "localhost", "placeholder.invalid"]).toContain(location.hostname);
  expect(location.pathname).toBe("/sign-in");
  expect(location.searchParams.get("error")).toBeTruthy();
  return `${location.pathname}${location.search}`;
}

function signInFailedAlert(page: Page) {
  return page.getByRole("alert").filter({ hasText: "登入沒有完成" });
}

test.describe("direct Google sign-in from a class", () => {
  test("a signed-in user opening /sign-in with a malicious callbackUrl stays on site", async ({ context, page }, testInfo) => {
    const email = `member-${runId(testInfo, "signed-in")}@${testEmailDomain}`;
    createdEmails.push(email);
    const { sessionToken } = await createUserSession({ email });
    await addAuthSessionCookie(context, sessionToken);

    for (const value of MALICIOUS_CALLBACKS) {
      await page.goto(`/sign-in?callbackUrl=${encodeURIComponent(value)}`);
      await expect(page, JSON.stringify(value)).toHaveURL(/^http:\/\/127\.0\.0\.1:\d+\/member\/dashboard$/);
    }
  });

  test("a visitor submitting Google sign-in with a malicious callbackUrl only returns to the site root", async ({ context, page }) => {
    for (const value of MALICIOUS_CALLBACKS) {
      await page.goto(`/sign-in?callbackUrl=${encodeURIComponent(value)}`);
      const destination = await submitAndInterceptGoogle(page, context, "使用 Google 帳號繼續");
      expect(destination, JSON.stringify(value)).toBe("/");
      expect(await cookieValue(context, "fsy_sign_in_return")).toBe("/");
    }
  });

  test("the class button goes straight to Google and remembers the class with its list filters", async ({ context, page }, testInfo) => {
    const classSessionId = await seedOpenClass(runId(testInfo, "class"));
    const returnTo = "/classes?timeOfDay=evening";
    await page.goto(`/classes/${classSessionId}?returnTo=${encodeURIComponent(returnTo)}`);
    await expect(page.getByText(/第一次使用會自動建立帳號/)).toBeVisible();

    const destination = await submitAndInterceptGoogle(page, context, "使用 Google 登入並報名");
    const expected = `/classes/${classSessionId}?returnTo=${encodeURIComponent(returnTo)}`;
    expect(destination).toBe(expected);
    expect(await cookieValue(context, "fsy_sign_in_return")).toBe(expected);
  });

  test("cancelling at Google lands on the site's sign-in page with a way back to the class and no enrolment", async ({ context, page }, testInfo) => {
    const classSessionId = await seedOpenClass(runId(testInfo, "cancel"));
    const returnTo = "/classes?timeOfDay=evening";
    await page.goto(`/classes/${classSessionId}?returnTo=${encodeURIComponent(returnTo)}`);
    const destination = await submitAndInterceptGoogle(page, context, "使用 Google 登入並報名");
    await page.goto(await authRedirectPath(page, "/api/auth/callback/google?error=access_denied"));
    await expect(signInFailedAlert(page)).toContainText("登入沒有完成，沒有送出任何報名。");
    await expect(page.getByRole("link", { name: "回到課程" })).toHaveAttribute("href", destination);
    await expect(page.getByRole("button", { name: "使用 Google 帳號繼續" })).toBeVisible();
    await expect(page.locator('input[name="callbackUrl"]')).toHaveValue(destination);
    expect(await prisma.enrollment.count({ where: { classSessionId } })).toBe(0);

    // 其他 Auth.js 錯誤（pages.error）也回到本站登入頁。
    await authRedirectPath(page, "/api/auth/error?error=Configuration");
  });

  test("a later sign-in from another entry does not reuse the earlier class destination", async ({ context, page }, testInfo) => {
    const classSessionId = await seedOpenClass(runId(testInfo, "cross"));
    await page.goto(`/classes/${classSessionId}`);
    await submitAndInterceptGoogle(page, context, "使用 Google 登入並報名");

    await page.goto(`/sign-in?callbackUrl=${encodeURIComponent("/teachers/join")}`);
    expect(await submitAndInterceptGoogle(page, context, "使用 Google 帳號繼續")).toBe("/teachers/join");
    await page.goto(await authRedirectPath(page, "/api/auth/callback/google?error=access_denied"));
    await expect(signInFailedAlert(page)).toBeVisible();
    await expect(page.getByRole("link", { name: "回到課程" })).toHaveCount(0);
    await expect(page.locator('input[name="callbackUrl"]')).toHaveValue("/teachers/join");
  });

  test("a tampered sign-in provider is rejected without leaving the site", async ({ page }, testInfo) => {
    const classSessionId = await seedOpenClass(runId(testInfo, "provider"));
    let wentToGoogle = false;
    await page.route("https://accounts.google.com/**", (route) => {
      wentToGoogle = true;
      return route.abort();
    });

    await page.goto(`/classes/${classSessionId}`);
    await page.locator('input[name="provider"]').evaluate((input: HTMLInputElement) => {
      input.value = "github";
    });
    await page.getByRole("button", { name: "使用 Google 登入並報名" }).click();
    await expect(page).toHaveURL(/\/sign-in\?error=UnsupportedProvider/);
    await expect(signInFailedAlert(page)).toBeVisible();

    await page.goto("/sign-in");
    await page.locator('input[name="provider"]').evaluate((input: HTMLInputElement) => {
      input.value = "github";
    });
    await page.getByRole("button", { name: "使用 Google 帳號繼續" }).click();
    await expect(page).toHaveURL(/\/sign-in\?error=UnsupportedProvider/);
    expect(wentToGoogle).toBe(false);
  });
});
