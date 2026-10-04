import { expect, test } from "@playwright/test";

import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 02：多團體 owner 的相容擴充。
// 驗證首次建立團主資料會寫入 owner，以及團體更新、建立需求改用 owner 判斷權限。
const testEmailDomain = "organization-ownership-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupOrganizerDemandFixtures(createdEmails);
});

test.describe("organization ownership smoke", () => {
  test("first-time organizer bootstrap records the new profile as the organization owner", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-owner-bootstrap-${Date.now()}`,
    );
    const email = `owner-bootstrap-${testRunId}@${testEmailDomain}`;
    createdEmails.push(email);

    const { sessionToken } = await createUserSession({ email });
    await addAuthSessionCookie(context, sessionToken);

    await page.goto("/organizer/profile");
    await page.getByLabel("團主顯示名稱").fill(`Owner ${testRunId}`);
    await page.getByLabel("組織名稱").fill(`Owner Org ${testRunId}`);
    await page.getByLabel("組織類型").selectOption("company");
    await page.getByLabel("聯絡電話").fill("0912345678");
    await page.getByRole("button", { name: "建立團主資料並開始整理需求" }).click();
    await expect(page).toHaveURL(/\/organizer\/demands\/new$/);

    const profile = await prisma.organizerProfile.findFirstOrThrow({
      where: { user: { email } },
      select: {
        id: true,
        organizationId: true,
        organization: { select: { ownerOrganizerProfileId: true } },
      },
    });

    // 相容期：legacy pointer 與 owner 指向同一個團體、同一位團主。
    expect(profile.organizationId).not.toBeNull();
    expect(profile.organization?.ownerOrganizerProfileId).toBe(profile.id);
  });

  test("an organizer cannot edit or create demands for an organization they do not own, even via the legacy pointer", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-owner-guard-${Date.now()}`,
    );
    const emailA = `owner-guard-a-${testRunId}@${testEmailDomain}`;
    const emailB = `owner-guard-b-${testRunId}@${testEmailDomain}`;
    createdEmails.push(emailA, emailB);

    const organizerA = await createOrganizerProfileWithOrganization({
      email: emailA,
      displayName: `Organizer A ${testRunId}`,
      organizationName: `Org A ${testRunId}`,
      contactName: "聯絡人 A",
      contactEmail: `contact-a-${testRunId}@example.com`,
      contactPhone: "0900000001",
    });
    const organizerB = await createOrganizerProfileWithOrganization({
      email: emailB,
      displayName: `Organizer B ${testRunId}`,
      organizationName: `Org B ${testRunId}`,
    });

    // A 在自己的團體下已有一筆欄位完整的草稿（owner 改掉之前建立）。
    const existingDraft = await createDemandRequest({
      organizerProfileId: organizerA.organizerProfileId,
      organizationId: organizerA.organizationId,
      data: completeDemandRequestData({ title: `既有草稿 ${testRunId}` }),
    });

    // 模擬資料不一致：A 的 legacy pointer 仍指向這個團體，但 owner 是 B。
    await prisma.organization.update({
      where: { id: organizerA.organizationId },
      data: { ownerOrganizerProfileId: organizerB.organizerProfileId },
    });

    await addAuthSessionCookie(context, organizerA.sessionToken);

    // 讀取：團主資料頁不會顯示不屬於自己的團體聯絡資料。
    await page.goto("/organizer/profile");
    await expect(page.getByText(`contact-a-${testRunId}@example.com`)).toHaveCount(0);
    await expect(page.getByLabel("聯絡信箱")).not.toHaveValue(`contact-a-${testRunId}@example.com`);

    // 改團體聯絡資料：被拒絕，資料不變。
    // 團體欄位是空白的（讀不到他人資料），補上必填欄位，讓請求通過表單驗證、確實走到 owner 檢查。
    await page.getByLabel("組織名稱").fill("不該寫入");
    await page.getByLabel("組織類型").selectOption("company");
    await page.getByLabel("聯絡窗口姓名").fill("不該寫入");
    await page.getByRole("button", { name: "儲存", exact: true }).click();
    await expect(page.getByText("請先建立團主資料後再編輯組織資訊。").first()).toBeVisible();
    await expect(page.getByText("團主資料已儲存。")).toHaveCount(0);

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizerA.organizationId },
      select: { contactName: true },
    });
    expect(organization.contactName).toBe("聯絡人 A");

    // 建立需求草稿：被拒絕，不會產生任何需求。
    await page.goto("/organizer/demands/new");
    await page.getByLabel("需求標題").fill(`不該建立 ${testRunId}`);
    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page.getByText("請先建立團主資料，才能建立需求草稿。").first()).toBeVisible();

    const demandCount = await prisma.demandRequest.count({
      where: { organizerProfileId: organizerA.organizerProfileId },
    });
    expect(demandCount).toBe(1);

    // 既有草稿直接送審：被拒絕，狀態維持 draft。
    await page.goto(`/organizer/demands/${existingDraft.id}/edit`);
    await page.getByRole("button", { name: "送出審核" }).first().click();
    await expect(page.getByText("確認送出需求").first()).toBeVisible();
    await page.getByRole("button", { name: "確認送出" }).first().click();
    await expect(page.getByText("找不到這筆需求，或您沒有權限操作。").first()).toBeVisible();

    const afterSubmit = await prisma.demandRequest.findUniqueOrThrow({
      where: { id: existingDraft.id },
      select: { status: true },
    });
    expect(afterSubmit.status).toBe("draft");
  });
});
