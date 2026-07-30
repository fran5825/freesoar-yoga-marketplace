import { expect, test } from "@playwright/test";

import {
  normalizeUpdateOwnOrganizerProfileInput,
} from "@/domain/organizer-profile/input";
import { validateUpdateOwnOrganizerProfileInput } from "@/domain/organizer-profile/validation";

import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

const testEmailDomain = "organizer-profile-edit-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizerDemandFixtures(createdEmails);
});

test.describe("organizer profile edit domain validation (direct, no UI)", () => {
  test("validateUpdateOwnOrganizerProfileInput rejects blank displayName, accepts non-blank", () => {
    expect(validateUpdateOwnOrganizerProfileInput({ displayName: "王小明" }).valid).toBe(true);
    expect(validateUpdateOwnOrganizerProfileInput({ displayName: "  " }).valid).toBe(false);
    expect(validateUpdateOwnOrganizerProfileInput({ displayName: null }).valid).toBe(false);
    expect(validateUpdateOwnOrganizerProfileInput({}).valid).toBe(false);
  });

  test("normalizeUpdateOwnOrganizerProfileInput trims whitespace and converts blank to null", () => {
    expect(
      normalizeUpdateOwnOrganizerProfileInput({ displayName: "  王小明  " }).displayName,
    ).toBe("王小明");
    expect(normalizeUpdateOwnOrganizerProfileInput({ displayName: "   " }).displayName).toBeNull();
  });
});

test.describe("organizer profile edit smoke", () => {
  test("validates blank displayName server-side, then successfully edits it, leaving another organizer's profile untouched", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-edit-${Date.now()}`,
    );
    const organizerAEmail = `organizer-a-${testRunId}@${testEmailDomain}`;
    const organizerBEmail = `organizer-b-${testRunId}@${testEmailDomain}`;
    createdEmails.push(organizerAEmail, organizerBEmail);

    const organizerA = await createOrganizerProfileWithOrganization({
      email: organizerAEmail,
      displayName: `Organizer A ${testRunId}`,
      organizationName: `Org A ${testRunId}`,
    });
    // Sentinel（codex round 1 指出的問題）：第二位 Organizer，證明 updateMany 的 own-scope
    // where 條件真的有限定在呼叫者自己身上，不是不小心改到所有 OrganizerProfile。
    const organizerB = await createOrganizerProfileWithOrganization({
      email: organizerBEmail,
      displayName: `Organizer B ${testRunId}`,
      organizationName: `Org B ${testRunId}`,
    });

    await addAuthSessionCookie(context, organizerA.sessionToken);
    await page.goto("/organizer/profile");

    // 留空 displayName——繞過瀏覽器原生 required，證明伺服器端才是權威。
    const displayNameInput = page.getByLabel("團主顯示名稱");
    await displayNameInput.evaluate((el: HTMLInputElement) => {
      el.value = "";
      el.form?.setAttribute("novalidate", "true");
    });
    await page.getByRole("button", { name: "儲存顯示名稱" }).click();

    await expect(page.getByText("團主資料格式需要調整後才能儲存。")).toBeVisible();
    const stillOriginal = await prisma.organizerProfile.findUniqueOrThrow({
      where: { id: organizerA.organizerProfileId },
      select: { displayName: true },
    });
    expect(stillOriginal.displayName).toBe(`Organizer A ${testRunId}`);

    // 成功編輯。
    await page.getByLabel("團主顯示名稱").fill(`Organizer A ${testRunId} Updated`);
    await page.getByRole("button", { name: "儲存顯示名稱" }).click();

    await expect(page.getByText("團主顯示名稱已更新。")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: `Organizer A ${testRunId} Updated` }),
    ).toBeVisible();

    const updatedA = await prisma.organizerProfile.findUniqueOrThrow({
      where: { id: organizerA.organizerProfileId },
      select: { displayName: true },
    });
    expect(updatedA.displayName).toBe(`Organizer A ${testRunId} Updated`);

    const untouchedB = await prisma.organizerProfile.findUniqueOrThrow({
      where: { id: organizerB.organizerProfileId },
      select: { displayName: true },
    });
    expect(untouchedB.displayName).toBe(`Organizer B ${testRunId}`);
  });

  test("keeps the existing Organization contact-info form working on the same page (regression check)", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-org-regression-${Date.now()}`,
    );
    const email = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const organizer = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Organizer ${testRunId}`,
      organizationName: `Org ${testRunId}`,
    });

    await addAuthSessionCookie(context, organizer.sessionToken);
    await page.goto("/organizer/profile");

    await page.getByLabel("聯絡窗口姓名").fill("王小明");
    await page.getByRole("button", { name: "儲存組織資訊" }).click();

    await expect(page.getByText("組織資訊已更新。")).toBeVisible();

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizer.organizationId },
      select: { contactName: true },
    });
    expect(organization.contactName).toBe("王小明");
  });

  test("rejects a stale edit-form submit server-side when the OrganizerProfile no longer exists, without creating a new one", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-no-profile-${Date.now()}`,
    );
    const email = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const organizer = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Organizer ${testRunId}`,
      organizationName: `Org ${testRunId}`,
    });

    await addAuthSessionCookie(context, organizer.sessionToken);
    await page.goto("/organizer/profile");

    // 目前仍有 OrganizerProfile：編輯表單存在。
    await expect(page.getByRole("button", { name: "儲存顯示名稱" })).toBeVisible();

    // 這個 OrganizerProfile 事後被刪除（比照既有「approved 載入表單、背後改成
    // suspended、送出過期表單」的既有測試手法，這裡對應的是「有 profile → 沒有
    // profile」這個沒有狀態機可以切換、只能用刪除模擬的情境），瀏覽器分頁不重新整理，
    // 表單維持刪除前渲染出來的舊狀態。
    await prisma.organizerProfile.delete({ where: { id: organizer.organizerProfileId } });

    await page.getByRole("button", { name: "儲存顯示名稱" }).click();

    await expect(page.getByText("請先建立團主資料後再編輯顯示名稱。")).toBeVisible();

    const profileCount = await prisma.organizerProfile.count({
      where: { user: { email } },
    });
    expect(profileCount).toBe(0); // 沒有意外建立一筆新的 OrganizerProfile。

    // 這裡手動刪除 Organization：cleanupOrganizerDemandFixtures 的既有清理邏輯是靠
    // `organizerProfiles: { some: { user: { email } } } }` 找到要清的 Organization，
    // 但這個測試把 OrganizerProfile 刪在前面，afterAll 執行時已經找不到這筆關聯，
    // 會變成清不到的孤兒資料——直接用 organizationId 補刪，不依賴那個關聯條件。
    await prisma.organization.deleteMany({ where: { id: organizer.organizationId } });
  });
});
