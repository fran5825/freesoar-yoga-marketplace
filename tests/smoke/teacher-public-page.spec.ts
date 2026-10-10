import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { setCoverCore } from "../../src/domain/teacher-photo/__internal__/cover-core";
import { setAvatarCore, uploadTeacherPhotoCore } from "../../src/domain/teacher-photo/__internal__/photo-core";
import { createLocalStorage } from "../../src/lib/storage/photo-storage";
import { waitForHydrated } from "./_helpers/hydration";
import { addAuthSessionCookie, prisma } from "./_helpers/organizer-demand-fixtures";
import { E2E_LOCAL_STORAGE_DIR } from "./_helpers/storage";
import { createTermFixtures } from "./_helpers/term-fixtures";

// teacher-showcase-photos 票 06（spec S6、6.2、6.6–6.8）：老師公開頁——老師自己決定、預設關閉、有填才顯示、
// 只列公開的課程、不外洩私人欄位；未公開、暫停、退回、不存在一律 404。
const fixtures = createTermFixtures("teacher-public-page-smoke.local");
const { runId, seedTeacher, seedMember, seedContinuous } = fixtures;
const storage = createLocalStorage(E2E_LOCAL_STORAGE_DIR);

test.setTimeout(120_000);
const slow = { timeout: 30_000 };
const MEDIA = /\/media\/photos\/[0-9a-f-]{36}\.webp/;

test.afterAll(async () => {
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const jpeg = (color: string) => sharp({ create: { width: 900, height: 600, channels: 3, background: color } }).jpeg().toBuffer();

async function seedFullTeacher(label: string, testInfo: Parameters<typeof runId>[0], enabled = true) {
  const id = runId(testInfo, label);
  const teacher = await seedTeacher(id);
  await prisma.teacherProfile.update({
    where: { id: teacher.teacherProfileId },
    data: {
      displayName: `Anya ${id}`,
      bio: `我是 Anya，專注在溫和的陰瑜伽。${id}`,
      teachingStyle: "慢慢來、重視呼吸與身體覺察。",
      experienceYears: 6,
      certifications: ["RYT 200", "Yin Yoga 30h"],
      specialties: ["陰瑜伽", "哈達瑜伽"],
      serviceAreas: ["新竹市"],
      teachingFormats: ["團體課"],
      priceRange: "SECRET-PRICE-RANGE",
      paymentAccountInfo: "SECRET-ACCOUNT-1234",
      paymentRulesText: "規則不在老師頁",
      contactInfo: "SECRET-CONTACT-line",
      isPublicPageEnabled: enabled,
    },
  });
  const upload = async (color: string) => {
    const result = await uploadTeacherPhotoCore(teacher.teacherProfileId, await jpeg(color), storage);
    if (!result.ok) throw new Error("fixture");
    return result;
  };
  const avatar = await upload("#a55");
  const second = await upload("#5a5");
  await upload("#55a");
  await setAvatarCore(teacher.teacherProfileId, avatar.photoId);

  return { id, teacher, avatar, second, path: `/teachers/${teacher.teacherProfileId}` };
}

test.describe("who can see the page", () => {
  test("disabled (the default), suspended, rejected, submitted and unknown ids are all the same 404", async ({ page }, testInfo) => {
    const off = await seedFullTeacher("off", testInfo, false);
    expect((await page.goto(off.path))?.status()).toBe(404);

    const suspended = await seedFullTeacher("suspended", testInfo, true);
    await prisma.teacherProfile.update({ where: { id: suspended.teacher.teacherProfileId }, data: { status: "suspended" } });
    expect((await page.goto(suspended.path))?.status()).toBe(404);

    for (const status of ["rejected", "submitted", "draft"] as const) {
      const other = await seedFullTeacher(`status-${status}`, testInfo, true);
      await prisma.teacherProfile.update({ where: { id: other.teacher.teacherProfileId }, data: { status } });
      expect((await page.goto(other.path))?.status()).toBe(404);
    }

    expect((await page.goto("/teachers/no-such-teacher"))?.status()).toBe(404);
    // 申請頁不受影響
    expect((await page.goto("/teachers/join"))?.status()).toBeLessThan(400);
  });

  test("a new teacher profile defaults to hidden", async ({}, testInfo) => {
    const teacher = await seedTeacher(runId(testInfo, "default"));
    expect((await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.teacherProfileId } })).isPublicPageEnabled).toBe(false);
  });
});

test.describe("what the page shows", () => {
  test("shows the filled sections, avatar and photos, and never leaks private fields", async ({ page }, testInfo) => {
    const data = await seedFullTeacher("full", testInfo);
    await page.goto(data.path);

    await expect(page.getByRole("heading", { level: 1, name: `Anya ${data.id}` })).toBeVisible(slow);
    await expect(page.getByRole("heading", { name: "關於我" })).toBeVisible();
    await expect(page.getByText(`我是 Anya，專注在溫和的陰瑜伽。${data.id}`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "教學風格" })).toBeVisible();
    await expect(page.getByText("慢慢來、重視呼吸與身體覺察。")).toBeVisible();
    await expect(page.getByRole("list", { name: "擅長類型" }).getByText("陰瑜伽")).toBeVisible();
    await expect(page.getByText("5~10 年")).toBeVisible();
    await expect(page.getByText("RYT 200")).toBeVisible();
    await expect(page.getByText("新竹市")).toBeVisible();
    await expect(page.getByText("團體課")).toBeVisible();

    // 頭像＋三張個人照片
    await expect(page.getByRole("img", { name: `Anya ${data.id} 的頭像` })).toHaveAttribute("src", MEDIA);
    const photos = page.getByRole("img", { name: new RegExp(`Anya ${data.id} 的照片`) });
    await expect(photos).toHaveCount(3);
    await expect.poll(() => photos.first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

    const html = await page.content();
    for (const secret of ["SECRET-PRICE-RANGE", "SECRET-ACCOUNT-1234", "SECRET-CONTACT-line", "規則不在老師頁", "teacher-public-page-smoke.local"]) {
      expect(html).not.toContain(secret);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("a sparse profile shows only what is filled: no empty boxes, no 'not provided' text", async ({ page }, testInfo) => {
    const id = runId(testInfo, "sparse");
    const teacher = await seedTeacher(id);
    await prisma.teacherProfile.update({
      where: { id: teacher.teacherProfileId },
      data: { displayName: `Sparse ${id}`, bio: null, teachingStyle: null, experienceYears: null, certifications: [], specialties: [], serviceAreas: [], teachingFormats: [], isPublicPageEnabled: true },
    });
    await page.goto(`/teachers/${teacher.teacherProfileId}`);

    await expect(page.getByRole("heading", { level: 1, name: `Sparse ${id}` })).toBeVisible(slow);
    for (const absent of ["關於我", "教學風格", "照片", "資歷與授課方式"]) {
      await expect(page.getByRole("heading", { name: absent, exact: true })).toHaveCount(0);
    }
    await expect(page.locator("main img")).toHaveCount(0);
    await expect(page.getByText("尚未提供")).toHaveCount(0);
    await expect(page.getByText("目前沒有公開的課程。")).toBeVisible();
  });

  test("photos removed by an admin are not shown", async ({ page }, testInfo) => {
    const data = await seedFullTeacher("removed", testInfo);
    await prisma.teacherPhoto.updateMany({ where: { id: { in: [data.avatar.photoId, data.second.photoId] } }, data: { status: "removed_by_admin", removedAt: new Date() } });
    await page.goto(data.path);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible(slow);
    await expect(page.getByRole("img", { name: /的頭像/ })).toHaveCount(0);
    await expect(page.getByRole("img", { name: /的照片/ })).toHaveCount(1);
  });
});

test.describe("classes on the teacher page", () => {
  test("lists only this teacher's public, upcoming classes (single, series, term) and links back with 返回老師頁", async ({ page }, testInfo) => {
    const data = await seedFullTeacher("classes", testInfo);
    const other = await seedTeacher(runId(testInfo, "classes-other"));
    const start = (days: number) => new Date(Date.now() + days * 86_400_000);
    const base = { origin: "teacher_initiated" as const, serviceType: "放鬆紓壓", serviceTypes: ["放鬆紓壓"], yogaStyles: ["陰瑜伽"], location: "教室", capacity: 5 };
    const make = (teacherProfileId: string, title: string, extra: Record<string, unknown> = {}) =>
      prisma.classSession.create({ data: { ...base, teacherProfileId, title, startAt: start(10), endAt: new Date(start(10).getTime() + 3_600_000), status: "open_for_enrollment", isPublic: true, ...extra } });
    const visible = await make(data.teacher.teacherProfileId, `公開單堂 ${data.id}`);
    await setCoverCore(data.teacher.teacherProfileId, { kind: "session", id: visible.id }, data.second.photoId);
    await make(data.teacher.teacherProfileId, `連結招募 ${data.id}`, { isPublic: false });
    await make(data.teacher.teacherProfileId, `草稿 ${data.id}`, { status: "draft" });
    await make(data.teacher.teacherProfileId, `已取消 ${data.id}`, { status: "cancelled" });
    await make(other.teacherProfileId, `別人的課 ${data.id}`);
    await seedContinuous(data.teacher.teacherProfileId, { count: 2, title: `持續開課 ${data.id}`, dayOfWeek: 4 });

    await page.goto(data.path);
    const region = page.getByRole("region", { name: "這位老師的課程" });
    await expect(region.getByRole("link", { name: new RegExp(`公開單堂 ${data.id}`) })).toHaveCount(1, slow);
    await expect(region.getByRole("link", { name: new RegExp(`持續開課 ${data.id}`) })).toHaveCount(1);
    for (const hidden of ["連結招募", "草稿", "已取消", "別人的課"]) {
      await expect(region.getByText(new RegExp(`${hidden} ${data.id}`))).toHaveCount(0);
    }
    // 卡片上有封面與老師名字
    await expect(region.getByRole("link", { name: new RegExp(`公開單堂 ${data.id}`) }).locator("img").first()).toHaveAttribute("src", MEDIA);

    await region.getByRole("link", { name: new RegExp(`公開單堂 ${data.id}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/classes/${visible.id}`), slow);
    const back = page.getByRole("link", { name: "返回老師頁", exact: true });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/teachers/${data.teacher.teacherProfileId}$`), slow);
  });

  test("a class page links the teacher's name to the page only while the page is public", async ({ page }, testInfo) => {
    const data = await seedFullTeacher("link", testInfo);
    const { sessions } = await seedContinuous(data.teacher.teacherProfileId, { count: 1, title: `連結課 ${data.id}`, dayOfWeek: 5 });
    await prisma.classSession.update({ where: { id: sessions[0].id }, data: { recurringClassSeriesId: null } });

    await page.goto(`/classes/${sessions[0].id}`);
    const summary = page.getByRole("region", { name: "課程重點" });
    await expect(summary.getByRole("link", { name: `Anya ${data.id}` })).toHaveAttribute("href", data.path, slow);

    await prisma.teacherProfile.update({ where: { id: data.teacher.teacherProfileId }, data: { isPublicPageEnabled: false } });
    await page.goto(`/classes/${sessions[0].id}`);
    await expect(summary.getByText(`Anya ${data.id}`)).toBeVisible(slow);
    await expect(summary.getByRole("link", { name: `Anya ${data.id}` })).toHaveCount(0);
  });
});

test.describe("the teacher's switch", () => {
  test("the teacher turns the page on and off from the photos tab; off means 404 right away", async ({ page, context, browser }, testInfo) => {
    const data = await seedFullTeacher("switch", testInfo, false);
    await addAuthSessionCookie(context, data.teacher.sessionToken);

    await page.goto("/teacher/profile/photos");
    await expect(page.getByText("目前：未公開")).toBeVisible(slow);
    const turnOn = page.getByRole("button", { name: "公開我的老師頁" });
    await waitForHydrated(turnOn);
    await turnOn.click();
    await expect(page.getByText("已公開你的老師頁。")).toBeVisible(slow);
    await expect(page.getByText("目前：已公開")).toBeVisible();
    await expect(page.getByRole("link", { name: "查看我的公開頁" })).toHaveAttribute("href", data.path);

    const visitor = await browser.newPage();
    expect((await visitor.goto(`${testInfo.project.use.baseURL}${data.path}`))?.status()).toBe(200);

    await page.getByRole("button", { name: "關閉公開頁" }).click();
    await expect(page.getByText("已關閉老師頁，訪客不會再看到。")).toBeVisible(slow);
    expect((await visitor.goto(`${testInfo.project.use.baseURL}${data.path}`))?.status()).toBe(404);
    await visitor.close();
  });

  test("a suspended teacher cannot change the switch, and keeping it on does not make the page visible", async ({ page, context }, testInfo) => {
    const data = await seedFullTeacher("switch-suspended", testInfo, true);
    await prisma.teacherProfile.update({ where: { id: data.teacher.teacherProfileId }, data: { status: "suspended" } });
    await addAuthSessionCookie(context, data.teacher.sessionToken);

    await page.goto("/teacher/profile/photos");
    await expect(page.getByText("（帳號暫停期間訪客看不到）")).toBeVisible(slow);
    await expect(page.getByText("帳號暫停期間無法變更。")).toBeVisible();
    await expect(page.getByRole("button", { name: "關閉公開頁" })).toHaveCount(0);
    expect((await page.goto(data.path))?.status()).toBe(404);
  });

  test("a member (not the teacher) cannot reach the switch action", async ({ page, context }, testInfo) => {
    const data = await seedFullTeacher("switch-stranger", testInfo, false);
    const member = await seedMember(data.id, "stranger");
    await addAuthSessionCookie(context, member.sessionToken);

    await page.goto("/teacher/profile/photos");
    await expect(page.getByRole("heading", { name: "通過老師審核後就能上傳照片" })).toBeVisible(slow);
    await expect(page.getByRole("button", { name: "公開我的老師頁" })).toHaveCount(0);
    expect((await prisma.teacherProfile.findUniqueOrThrow({ where: { id: data.teacher.teacherProfileId } })).isPublicPageEnabled).toBe(false);
  });
});
