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
const orphanOrganizationIds: string[] = [];

test.afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: orphanOrganizationIds } } });
  await cleanupOrganizerDemandFixtures(createdEmails);
});

test.describe("organization ownership smoke", () => {
  test("does not expose an orphan group through a legacy pointer and can still use an owned group", async ({
    context,
    page,
  }, testInfo) => {
    const id = normalizeForEmail(`${testInfo.project.name}-${Date.now()}-orphan`);
    const email = `orphan-${id}@${testEmailDomain}`;
    createdEmails.push(email);
    const organizer = await createOrganizerProfileWithOrganization({
      email,
      displayName: `Owner ${id}`,
      organizationName: `Private Orphan ${id}`,
      contactEmail: `private-${id}@example.com`,
    });
    orphanOrganizationIds.push(organizer.organizationId);
    // 15a 有意保留的 legacy 安全注入：pointer 不能洩漏 owner=null 的聯絡資料。
    await prisma.organizerProfile.update({
      where: { id: organizer.organizerProfileId }, data: { organizationId: organizer.organizationId },
    });
    await prisma.organization.update({
      where: { id: organizer.organizationId }, data: { ownerOrganizerProfileId: null },
    });
    await addAuthSessionCookie(context, organizer.sessionToken);
    await page.goto("/organizer/organizations");
    await expect(page.getByText(`Private Orphan ${id}`)).toHaveCount(0);
    const response = await page.goto(`/organizer/organizations/${organizer.organizationId}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(`private-${id}@example.com`)).toHaveCount(0);
    const owned = await prisma.organization.create({
      data: { name: `Owned Instead ${id}`, type: "company", ownerOrganizerProfileId: organizer.organizerProfileId },
      select: { id: true },
    });
    await page.goto("/organizer/demands/new");
    await expect(page.getByLabel("為哪個團體提出需求")).toHaveValue(owned.id);
    await expect(page.getByText(`Private Orphan ${id}`)).toHaveCount(0);
    await page.getByLabel("需求標題").fill(`Owned Draft ${id}`);
    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page).toHaveURL(/\/organizer\/demands\/[^/]+\/edit$/);
    const draft = await prisma.demandRequest.findFirstOrThrow({
      where: { organizerProfileId: organizer.organizerProfileId, title: `Owned Draft ${id}` },
      select: { organizationId: true },
    });
    expect(draft.organizationId).toBe(owned.id);
  });

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
    // 15a 有意保留的 legacy 安全注入；一般 fixture 已不寫 pointer。
    await prisma.organizerProfile.update({
      where: { id: organizerA.organizerProfileId },
      data: { organizationId: organizerA.organizationId },
    });
    await prisma.organization.update({
      where: { id: organizerA.organizationId },
      data: { ownerOrganizerProfileId: organizerB.organizerProfileId },
    });

    await addAuthSessionCookie(context, organizerA.sessionToken);

    // 讀取：團主資料頁與我的團體都不會列出不屬於自己的團體或它的聯絡資料。
    await page.goto("/organizer/profile");
    await expect(page.getByText(`Org A ${testRunId}`)).toHaveCount(0);
    await expect(page.getByText(`contact-a-${testRunId}@example.com`)).toHaveCount(0);
    await page.goto("/organizer/organizations");
    await expect(page.getByText(`Org A ${testRunId}`)).toHaveCount(0);

    // 直接開團體編輯頁：不是自己的團體一律 404，看不到也改不到。
    const editResponse = await page.goto(`/organizer/organizations/${organizerA.organizationId}`);
    expect(editResponse?.status()).toBe(404);
    await expect(page.getByText(`contact-a-${testRunId}@example.com`)).toHaveCount(0);

    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: organizerA.organizationId },
      select: { contactName: true },
    });
    expect(organization.contactName).toBe("聯絡人 A");

    // 建立需求：A 沒有自己擁有的團體，新需求頁先帶去新增團體，不會產生任何需求。
    await page.goto("/organizer/demands/new");
    await expect(page).toHaveURL(/\/organizer\/organizations\/new\?returnTo=/);

    const demandCount = await prisma.demandRequest.count({
      where: { organizerProfileId: organizerA.organizerProfileId },
    });
    expect(demandCount).toBe(1);

    // 既有草稿直接送審：A 另有一個自己的團體，所以編輯頁會出現表單；
    // 但這筆草稿目前掛在不屬於 A 的團體上，送審被伺服器拒絕，狀態維持 draft。
    await prisma.organization.create({
      data: {
        name: `A 自己的團體 ${testRunId}`,
        type: "company",
        contactName: "A2 聯絡人",
        contactEmail: `a2-${testRunId}@example.com`,
        contactPhone: "0900000003",
        ownerOrganizerProfileId: organizerA.organizerProfileId,
      },
    });
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
  test("tampering with the organization id on a valid edit form cannot update someone else's organization", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-owner-forge-${Date.now()}`,
    );
    const emailA = `owner-forge-a-${testRunId}@${testEmailDomain}`;
    const emailB = `owner-forge-b-${testRunId}@${testEmailDomain}`;
    createdEmails.push(emailA, emailB);

    const organizerA = await createOrganizerProfileWithOrganization({
      email: emailA,
      displayName: `Forger A ${testRunId}`,
      organizationName: `Forger Org A ${testRunId}`,
    });
    const organizerB = await createOrganizerProfileWithOrganization({
      email: emailB,
      displayName: `Victim B ${testRunId}`,
      organizationName: `Victim Org B ${testRunId}`,
      contactName: "B 的聯絡人",
    });

    await addAuthSessionCookie(context, organizerA.sessionToken);
    await page.goto(`/organizer/organizations/${organizerA.organizationId}`);

    // 從自己合法的編輯表單送出，但把隱藏的 organizationId 改成 B 的團體。
    await page
      .locator('input[name="organizationId"]')
      .evaluate((input: HTMLInputElement, forgedId: string) => {
        input.value = forgedId;
      }, organizerB.organizationId);
    await page.getByLabel("組織名稱").fill(`Hijacked ${testRunId}`);
    await page.getByLabel("聯絡窗口姓名").fill("不該寫入");
    await page.getByRole("button", { name: "儲存", exact: true }).click();

    await expect(page.getByText("找不到這個團體，或你沒有權限編輯。").first()).toBeVisible();

    const [victim, own] = await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: organizerB.organizationId },
        select: { name: true, contactName: true },
      }),
      prisma.organization.findUniqueOrThrow({
        where: { id: organizerA.organizationId },
        select: { name: true },
      }),
    ]);
    expect(victim).toEqual({ name: `Victim Org B ${testRunId}`, contactName: "B 的聯絡人" });
    expect(own.name).toBe(`Forger Org A ${testRunId}`);
  });
});
