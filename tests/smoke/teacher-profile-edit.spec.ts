import type { TeacherProfileStatus } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { validateTeacherProfileSubmit } from "@/domain/teacher-profile/validation";

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

const testEmailDomain = "teacher-profile-edit-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

test.describe("teacher profile edit domain validation (direct, no UI)", () => {
  // 頁面上的驗證失敗訊息只顯示同一句通用文案（見下方 UI 測試），
  // 所以這裡直接呼叫純函式，證明 experienceYears 的整數／範圍規則真的有接上。
  test("validateTeacherProfileSubmit rejects non-integer/out-of-range experienceYears, accepts the Int4 max", () => {
    const base = {
      displayName: "Teacher",
      bio: "bio",
      teachingStyle: "style",
      specialties: ["a"],
      serviceAreas: ["b"],
      teachingFormats: ["c"],
    };

    expect(validateTeacherProfileSubmit({ ...base, experienceYears: 1.5 }).valid).toBe(false);
    expect(
      validateTeacherProfileSubmit({ ...base, experienceYears: 2147483648 }).valid,
    ).toBe(false);
    expect(
      validateTeacherProfileSubmit({ ...base, experienceYears: 2147483647 }).valid,
    ).toBe(true);
    expect(validateTeacherProfileSubmit({ ...base, experienceYears: -1 }).valid).toBe(false);
    expect(validateTeacherProfileSubmit({ ...base, experienceYears: 5 }).valid).toBe(true);
  });
});

test.describe("teacher profile edit smoke", () => {
  test("redirects unauthenticated users to sign in", async ({ page }) => {
    await page.goto("/teacher/profile", { waitUntil: "commit" });

    await expect(page).toHaveURL(/\/sign-in/);
  });

  const nonApprovedCases: Array<{
    status: TeacherProfileStatus | null;
    expectedTitle: string;
    expectedActionLabel: string;
  }> = [
    { status: null, expectedTitle: "尚未建立老師申請", expectedActionLabel: "前往建立老師申請" },
    { status: "draft", expectedTitle: "老師申請還在準備中", expectedActionLabel: "繼續整理申請" },
    { status: "submitted", expectedTitle: "老師申請審核中", expectedActionLabel: "查看申請狀態" },
    {
      status: "rejected",
      expectedTitle: "老師申請可修正後重新送出",
      expectedActionLabel: "前往修正申請",
    },
  ];

  for (const { status, expectedTitle, expectedActionLabel } of nonApprovedCases) {
    test(`shows guidance copy (not the edit form) when teacher profile status is ${
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
      await page.goto("/teacher/profile");

      await expect(page.getByRole("heading", { name: expectedTitle })).toBeVisible();
      await expect(
        page.getByRole("link", { name: expectedActionLabel }),
      ).toHaveAttribute("href", "/teachers/join");
      await expect(page.getByRole("button", { name: "儲存變更" })).toBeHidden();
    });
  }

  test("lets a suspended teacher view existing profile data read-only, and rejects a stale edit-form submit server-side", async ({
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

    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/teacher/profile");

    // 目前仍是 approved：編輯表單存在。
    await expect(page.getByRole("button", { name: "儲存變更" })).toBeVisible();

    // Teacher 事後被 suspend，瀏覽器分頁不重新整理，表單維持 suspend 前渲染出來的舊狀態。
    await prisma.teacherProfile.update({
      where: { id: teacherProfileId },
      data: { status: "suspended" },
    });

    await page.getByRole("button", { name: "儲存變更" }).click();

    await expect(
      page.getByText("需要通過審核的老師身份才能編輯老師資料。"),
    ).toBeVisible();

    const stillOriginal = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacherProfileId },
      select: { bio: true },
    });
    expect(stillOriginal.bio).toBe(`Teacher ${testRunId} bio`); // createTeacherProfileWithSession 的既有預設值，沒有被改動。

    // 重新整理（此時真的是 suspended）：唯讀顯示既有資料，沒有表單。
    await page.goto("/teacher/profile");

    await expect(
      page.getByText("帳號目前暫停中，暫時無法編輯個人資料，但你仍然可以查看既有資料。"),
    ).toBeVisible();
    await expect(page.getByText(`Teacher ${testRunId}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "儲存變更" })).toBeHidden();
  });

  test("validates required fields server-side, then successfully edits and persists multiple fields without changing status or firing a notification", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-edit-${Date.now()}`,
    );
    const email = `teacher-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken, userId, teacherProfileId } = await createTeacherProfileWithSession({
      email,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });

    const notificationCountBefore = await prisma.notification.count({ where: { userId } });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto("/teacher/profile");

    // 必填欄位留空——繞過瀏覽器原生 required，證明伺服器端才是權威。
    const displayNameInput = page.getByLabel("公開顯示名稱");
    await displayNameInput.evaluate((el: HTMLInputElement) => {
      el.value = "";
      el.form?.setAttribute("novalidate", "true");
    });
    await page.getByRole("button", { name: "儲存變更" }).click();

    await expect(page.getByText("儲存前，請先確認以上資訊。")).toBeVisible();
    const stillOriginalName = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacherProfileId },
      select: { displayName: true },
    });
    expect(stillOriginalName.displayName).toBe(`Teacher ${testRunId}`);

    // 成功編輯：修改多個欄位。
    await page.getByLabel("公開顯示名稱").fill(`Teacher ${testRunId} Updated`);
    await page.getByLabel("老師簡介").fill("Updated bio content.");
    await page.getByLabel("擅長類型（可用逗號或換行分隔）").fill("Yin Yoga\nStretch Yoga");
    await page.getByLabel("證照或訓練背景（選填，可用逗號或換行分隔）").fill("RYT 500");
    await page.getByRole("button", { name: "儲存變更" }).click();

    await expect(page.getByText("老師資料已儲存。")).toBeVisible();

    const updated = await prisma.teacherProfile.findUniqueOrThrow({
      where: { id: teacherProfileId },
    });
    expect(updated.displayName).toBe(`Teacher ${testRunId} Updated`);
    expect(updated.bio).toBe("Updated bio content.");
    expect(updated.specialties).toEqual(["Yin Yoga", "Stretch Yoga"]);
    expect(updated.certifications).toEqual(["RYT 500"]);
    expect(updated.status).toBe("approved"); // D3：編輯不改變 status。

    const notificationCountAfter = await prisma.notification.count({ where: { userId } });
    expect(notificationCountAfter).toBe(notificationCountBefore); // D7：不觸發任何 notification。
  });

  test("shows updatedAt and full profile content on /admin/teachers for approved teachers, reflecting the latest edit", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-admin-visibility-${Date.now()}`,
    );
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    const adminEmail = `admin-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail, adminEmail);

    const { teacherProfileId } = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });
    const { sessionToken: adminSessionToken } = await createUserSession({
      email: adminEmail,
      isAdmin: true,
    });

    // 模擬老師編輯後的新內容（Slice 2 已經用瀏覽器手動驗證過真正的編輯路徑，這裡只驗證
    // Admin 頁面是否正確反映當下的欄位內容，不重複驗證編輯本身）。
    const updated = await prisma.teacherProfile.update({
      where: { id: teacherProfileId },
      data: { bio: "Edited bio for admin visibility check." },
      select: { updatedAt: true },
    });

    await addAuthSessionCookie(context, adminSessionToken);
    await page.goto("/admin/teachers");

    const teacherCard = page.locator("article", { hasText: `Teacher ${testRunId}` });
    await expect(teacherCard.getByText("Edited bio for admin visibility check.")).toBeHidden();

    await teacherCard.getByText("View profile details").click();

    await expect(
      teacherCard.getByText("Edited bio for admin visibility check."),
    ).toBeVisible();

    const expectedTimestampFragment = new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(updated.updatedAt);
    await expect(teacherCard.getByText(`Last updated: ${expectedTimestampFragment}`)).toBeVisible();
  });
});
