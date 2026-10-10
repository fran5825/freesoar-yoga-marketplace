import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { createEnrollmentForUser } from "../../src/domain/enrollment/__internal__/create-enrollment-core";
import { futureDateString } from "./_helpers/future-dates";
import { pickServiceType } from "./_helpers/class-form";
import { waitForHydrated } from "./_helpers/hydration";
import { addAuthSessionCookie, cleanupOrganizerDemandFixtures, createUserSession, prisma } from "./_helpers/organizer-demand-fixtures";
import { createTermFixtures } from "./_helpers/term-fixtures";
import { selectFormTime } from "./_helpers/time-select";

// teacher-showcase-photos 票 09（spec 第 9 節驗收）：從老師放照片、開課、公開老師頁，到學員看到圖文課程、
// 報名、轉帳、老師標記收款，再到管理員下架照片的整段旅程。每一段的細節在各自的 spec 已測，這裡只確認接得起來。
const fixtures = createTermFixtures("showcase-journey-smoke.local");
const { runId, seedTeacher, seedMember } = fixtures;
const adminEmails: string[] = [];

test.setTimeout(240_000);
const slow = { timeout: 30_000 };
const MEDIA = /\/media\/photos\/[0-9a-f-]{36}\.webp/;

test.afterAll(async () => {
  await cleanupOrganizerDemandFixtures(adminEmails);
  await fixtures.cleanup();
  await prisma.$disconnect();
});

const jpeg = (color: string) => sharp({ create: { width: 1200, height: 800, channels: 3, background: color } }).jpeg().toBuffer();

test("a teacher shows herself and her class with photos, a visitor and a member see it, the member pays and the admin can take a photo down", async ({ browser, page, context }, testInfo) => {
  const id = runId(testInfo, "journey");
  const teacher = await seedTeacher(id);
  await prisma.teacherProfile.update({
    where: { id: teacher.teacherProfileId },
    data: {
      displayName: `Anya ${id}`,
      bio: "專注在溫和的陰瑜伽。",
      teachingStyle: "慢慢來、重視呼吸。",
      experienceYears: 5,
      specialties: ["陰瑜伽"],
      serviceAreas: ["新竹市"],
      teachingFormats: ["團體課"],
    },
  });
  await addAuthSessionCookie(context, teacher.sessionToken);

  // 1. 老師：上傳兩張照片、設頭像、公開老師頁
  await page.goto("/teacher/profile/photos");
  for (const color of ["#c66", "#6c6"]) {
    await waitForHydrated(page.locator("#photo"));
    await page.locator("#photo").setInputFiles({ name: "p.jpg", mimeType: "image/jpeg", buffer: await jpeg(color) });
    await page.getByRole("button", { name: "上傳" }).click();
    await expect(page.getByText("照片已上傳。")).toBeVisible(slow);
  }
  await page.getByRole("button", { name: "設為頭像" }).first().click();
  await expect(page.getByText("已設為頭像。")).toBeVisible(slow);
  await page.getByRole("button", { name: "公開我的老師頁" }).click();
  await expect(page.getByText("已公開你的老師頁。")).toBeVisible(slow);

  // 2. 老師：填繳費規則與收款資料
  await page.goto("/teacher/profile/payment");
  await waitForHydrated(page.getByLabel("繳費與取消規則（選填）"));
  await page.getByLabel("繳費與取消規則（選填）").fill("請於開課前 3 天內完成轉帳。");
  await page.getByLabel("收款帳號（選填）").fill("（012）富邦 1234-5678-9012");
  await page.getByLabel("聯絡方式（選填）").fill("Line ID anya_yoga");
  await page.getByRole("button", { name: "儲存" }).click();
  await expect(page.getByText("收款與聯絡資料已儲存。")).toBeVisible(slow);

  // 3. 老師：建一堂課（選第二張照片當封面、寫價格）
  await page.goto("/teacher/classes/new");
  await waitForHydrated(page.locator("#title"));
  const title = `旅程課 ${id}`;
  await page.locator("#title").fill(title);
  await pickServiceType(page, "放鬆紓壓");
  await page.getByText("陰瑜伽", { exact: true }).first().click();
  await page.locator("#single-date").fill(futureDateString(25));
  await selectFormTime(page, "single-", "start", "19:00");
  await selectFormTime(page, "single-", "end", "20:00");
  await page.locator("#location").fill("新竹科學園區 科技生活館");
  await page.locator("#capacity").fill("8");
  await page.getByRole("img", { name: "第 2 張照片" }).first().click();
  await page.getByText("價格、適合對象與準備事項（選填）", { exact: true }).click();
  await page.locator("#priceNote").fill("單堂 600 元");
  await page.getByRole("button", { name: "建立課程" }).click();
  await expect(page).toHaveURL(/\/teacher\/classes\/[^/?]+\?result=success/, { timeout: 60_000 });
  const created = await prisma.classSession.findFirstOrThrow({ where: { title } });
  expect(created.coverPhotoId).not.toBeNull();
  await prisma.classSession.update({ where: { id: created.id }, data: { status: "open_for_enrollment", isPublic: true } });

  // 4. 訪客：找課程列表看到封面與老師頭像；課程頁有價格與規則、沒有收款帳號；老師名字連到公開老師頁
  const visitor = await browser.newPage();
  const base = String(testInfo.project.use.baseURL);
  await visitor.goto(`${base}/classes?location=${encodeURIComponent("新竹科學園區 科技生活館")}`);
  const card = visitor.getByRole("link", { name: new RegExp(title) });
  await expect(card).toHaveCount(1, slow);
  await expect(card.locator("img")).toHaveCount(2);
  await expect(card.locator("img").first()).toHaveAttribute("src", MEDIA);

  await visitor.goto(`${base}/classes/${created.id}`);
  await expect(visitor.getByRole("heading", { name: "價格" })).toBeVisible(slow);
  await expect(visitor.getByText("單堂 600 元")).toBeVisible();
  await expect(visitor.getByText("請於開課前 3 天內完成轉帳。")).toBeVisible();
  expect(await visitor.content()).not.toContain("1234-5678-9012");
  await visitor.getByRole("region", { name: "課程重點" }).getByRole("link", { name: `Anya ${id}` }).click();
  await expect(visitor).toHaveURL(new RegExp(`/teachers/${teacher.teacherProfileId}$`), slow);
  await expect(visitor.getByRole("heading", { level: 1, name: `Anya ${id}` })).toBeVisible();
  await expect(visitor.getByRole("img", { name: /的頭像/ })).toHaveCount(1);
  await expect(visitor.getByRole("img", { name: /的照片/ })).toHaveCount(2);
  await expect(visitor.getByRole("link", { name: new RegExp(title) })).toHaveCount(1);
  expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await visitor.close();

  // 5. 學員：報名、看到報名當下的收款資訊、填轉帳後五碼
  const member = await seedMember(id, "member");
  const enrolled = await createEnrollmentForUser(member.id, created.id, { notes: null });
  if (!enrolled.ok) throw new Error("enrollment failed");
  const memberContext = await browser.newContext({ baseURL: base });
  await addAuthSessionCookie(memberContext, member.sessionToken);
  const memberPage = await memberContext.newPage();
  await memberPage.goto("/member/enrollments");
  const block = memberPage.locator(`#enrollment-${enrolled.enrollmentId}`);
  await expect(block.getByText("付款：待付款")).toBeVisible(slow);
  await expect(block.getByText("（012）富邦 1234-5678-9012")).toBeVisible();
  await expect(block.getByText("Line ID anya_yoga")).toBeVisible();
  await waitForHydrated(block.getByLabel("轉帳後五碼或備註（選填）"));
  await block.getByLabel("轉帳後五碼或備註（選填）").fill("後五碼 13579");
  await block.getByRole("button", { name: "儲存備註" }).click();
  await expect(memberPage.getByText("已儲存轉帳備註。")).toBeVisible(slow);

  // 6. 老師：在名單看到學員的備註、標記已收款
  await page.goto(`/teacher/classes/${created.id}`);
  await expect(page.getByText("後五碼 13579")).toBeVisible(slow);
  const openPaid = page.getByRole("button", { name: /標記 .* 為已收款/ });
  await waitForHydrated(openPaid);
  await openPaid.click();
  await page.getByRole("button", { name: "標記為已收款" }).click();
  await expect(page.getByText("付款：已收款")).toBeVisible(slow);
  await memberPage.goto("/member/enrollments");
  await expect(memberPage.locator(`#enrollment-${enrolled.enrollmentId}`).getByText("付款：已收款")).toBeVisible(slow);

  // 7. 管理員：下架老師的一張照片，頭像與封面一併拿掉，老師收到通知
  const adminEmail = `admin-${id}@showcase-journey-smoke.local`;
  adminEmails.push(adminEmail);
  const admin = await createUserSession({ email: adminEmail, isAdmin: true });
  const adminContext = await browser.newContext({ baseURL: base });
  await addAuthSessionCookie(adminContext, admin.sessionToken);
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`/admin/teachers/${teacher.teacherProfileId}`);
  await expect(adminPage.getByRole("heading", { name: "老師的照片（2）" })).toBeVisible(slow);
  const reason = adminPage.getByLabel("下架原因（必填，老師會看到）").first();
  await waitForHydrated(reason);
  await reason.fill("照片不適合公開使用。");
  await adminPage.getByRole("button", { name: "下架這張照片" }).first().click();
  await adminPage.getByRole("button", { name: "確認下架這張照片" }).click();
  await expect(adminPage.getByText("已下架這張照片，老師會收到通知。")).toBeVisible(slow);
  expect(await prisma.notification.count({ where: { userId: teacher.userId, type: "teacher_photo_removed" } })).toBe(1);
  expect((await prisma.teacherProfile.findUniqueOrThrow({ where: { id: teacher.teacherProfileId } })).avatarPhotoId).toBeNull();

  await memberContext.close();
  await adminContext.close();
});
