import { expect, test } from "@playwright/test";

import {
  createDemandResponse,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  cleanupOrganizerDemandFixtures,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// organizer-usability-redesign 票 11：找老師流程的明確下一步。
// - published 需求依「還能選的回應數」衍生下一步，列表、總覽、詳情說法一致。
// - 已成課直接連到那一堂課，課程頁連回來源需求。
// - 建立課程表單只帶入需求裡確定的欄位，時間不猜。
const testEmailDomain = "organizer-demand-next-steps-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.demandResponse.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.teacherProfile.deleteMany({
    where: { user: { email: { in: createdEmails } } },
  });
  await cleanupOrganizerDemandFixtures(createdEmails);
});

async function setup(testInfo: { project: { name: string }; workerIndex: number }, label: string) {
  const runId = normalizeForEmail(
    `${testInfo.project.name}-${testInfo.workerIndex}-${label}-${Date.now()}`,
  );
  const organizerEmail = `organizer-${runId}@${testEmailDomain}`;
  createdEmails.push(organizerEmail);
  const organizer = await createOrganizerProfileWithOrganization({
    email: organizerEmail,
    displayName: `Next ${runId}`,
    organizationName: `Next Org ${runId}`,
    contactName: "聯絡人",
    contactEmail: `contact-${runId}@example.com`,
    contactPhone: "0900000000",
  });

  const teachers = [];
  for (const index of [1, 2]) {
    const email = `teacher${index}-${runId}@${testEmailDomain}`;
    createdEmails.push(email);
    teachers.push(
      await createTeacherProfileWithSession({
        email,
        displayName: `老師${index} ${runId}`,
        status: "approved",
      }),
    );
  }

  return { runId, organizer, teachers };
}

test.describe("organizer demand next steps", () => {
  test("a published demand turns into 待我處理 only when a selectable response exists, consistently on list, dashboard and detail", async ({
    context,
    page,
  }, testInfo) => {
    const { runId, organizer, teachers } = await setup(testInfo, "published");
    const title = `公開中的需求 ${runId}`;
    const demand = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "published",
      data: completeDemandRequestData({ title }),
    });
    // 已撤回的回應、被暫停老師的回應都選不了，不算：仍然是等待老師。
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teachers[0].teacherProfileId,
      status: "withdrawn",
    });
    const suspendedEmail = `teacher-suspended-${runId}@${testEmailDomain}`;
    createdEmails.push(suspendedEmail);
    const suspended = await createTeacherProfileWithSession({
      email: suspendedEmail,
      displayName: `暫停老師 ${runId}`,
      status: "suspended",
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: suspended.teacherProfileId,
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto("/organizer/demands");
    await expect(page.getByRole("link", { name: new RegExp(title) })).toContainText(
      "已公開，等待老師回應",
    );
    await page.goto("/organizer/dashboard");
    await expect(page.getByText("目前沒有待處理事項。")).toBeHidden();
    await expect(page.getByRole("region", { name: "待你處理" })).toHaveCount(0);
    await page.goto(`/organizer/demands/${demand.id}`);
    const nextStep = page.getByRole("region", { name: "下一步提示" });
    await expect(nextStep).toContainText("目前進度");
    await expect(nextStep.getByRole("link")).toHaveCount(0);

    // 暫停老師恢復資格後，回應就能選：三處一起變成待選老師。
    await prisma.teacherProfile.update({
      where: { id: suspended.teacherProfileId },
      data: { status: "approved" },
    });
    await page.goto("/organizer/demands");
    await expect(page.getByRole("link", { name: new RegExp(title) })).toContainText(
      "1 位老師已回應：請選擇合作的老師",
    );
    await prisma.teacherProfile.update({
      where: { id: suspended.teacherProfileId },
      data: { status: "suspended" },
    });
    await page.goto("/organizer/demands");
    await expect(page.getByRole("link", { name: new RegExp(title) })).toContainText(
      "已公開，等待老師回應",
    );

    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teachers[1].teacherProfileId,
    });

    await page.goto("/organizer/demands");
    await expect(page.getByRole("link", { name: new RegExp(title) })).toContainText(
      "1 位老師已回應：請選擇合作的老師",
    );
    await page.goto("/organizer/dashboard");
    const pending = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "待你處理" }) });
    await expect(pending.getByRole("link", { name: new RegExp(title) })).toContainText(
      "1 位老師已回應：請選擇合作的老師",
    );
    await page.goto(`/organizer/demands/${demand.id}`);
    await expect(nextStep).toContainText("下一步");
    await expect(nextStep).toContainText("已有 1 位老師回應");
    await nextStep.getByRole("link", { name: "查看老師回應" }).click();
    await expect(page).toHaveURL(/#responses$/);
    await expect(page.locator("#responses")).toBeInViewport();
  });

  test("a matched demand prefills only determinable fields, and the converted class links both ways", async ({
    context,
    page,
  }, testInfo) => {
    const { runId, organizer, teachers } = await setup(testInfo, "matched");
    const demand = await createDemandRequest({
      organizerProfileId: organizer.organizerProfileId,
      organizationId: organizer.organizationId,
      status: "matched",
      data: completeDemandRequestData({
        title: `已媒合的需求 ${runId}`,
        description: "下班前的伸展課，著重肩頸與呼吸。",
        expectedParticipants: 12,
        preferredAreas: ["台北市信義區松仁路 100 號"],
      }),
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teachers[0].teacherProfileId,
      status: "selected",
    });
    await addAuthSessionCookie(context, organizer.sessionToken);

    await page.goto(`/organizer/demands/${demand.id}`);
    const nextStep = page.getByRole("region", { name: "下一步提示" });
    await expect(nextStep.getByRole("link", { name: "填寫課程資訊" })).toHaveAttribute(
      "href",
      "#create-class",
    );
    const form = page.locator("#create-class");
    await expect(form.getByLabel("地點")).toHaveValue("台北市信義區松仁路 100 號");
    await expect(form.getByLabel("名額上限")).toHaveValue("12");
    await expect(form.getByLabel("課程說明（選填）")).toHaveValue(
      "下班前的伸展課，著重肩頸與呼吸。",
    );
    // 偏好時段與頻率只當參考，不帶入成上課時間。
    await expect(form.getByLabel("開始時間")).toHaveValue("");
    await expect(form.getByLabel("結束時間")).toHaveValue("");
    await expect(form.getByText(/需求填寫的偏好：.*平日晚上/)).toBeVisible();
    await expect(form.getByText("同時公開在課程列表")).toBeVisible();
    await expect(page.getByText(/未來功能/)).toHaveCount(0);

    // 已成課：直接連到那一堂課，課程頁再連回需求。
    const classSession = await prisma.classSession.create({
      data: {
        demandRequestId: demand.id,
        teacherProfileId: teachers[0].teacherProfileId,
        organizerProfileId: organizer.organizerProfileId,
        organizationId: organizer.organizationId,
        title: `已成課 ${runId}`,
        startAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        endAt: new Date(Date.now() + 7 * 24 * 3600 * 1000 + 3600 * 1000),
        location: "台北市信義區松仁路 100 號",
        capacity: 12,
      },
    });
    await prisma.demandRequest.update({
      where: { id: demand.id },
      data: { status: "converted_to_class" },
    });

    await page.goto(`/organizer/demands/${demand.id}`);
    await expect(nextStep.getByRole("link", { name: "前往這堂課" })).toHaveAttribute(
      "href",
      `/organizer/classes/${classSession.id}`,
    );
    await nextStep.getByRole("link", { name: "前往這堂課" }).click();
    await expect(page).toHaveURL(new RegExp(`/organizer/classes/${classSession.id}$`));
    await expect(page.getByRole("link", { name: "查看來源需求" })).toHaveAttribute(
      "href",
      `/organizer/demands/${demand.id}`,
    );
  });
});
