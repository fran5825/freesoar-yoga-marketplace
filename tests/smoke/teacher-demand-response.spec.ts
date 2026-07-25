import { expect, test } from "@playwright/test";

import {
  addAuthSessionCookie,
  completeDemandRequestData,
  createDemandRequest,
  createOrganizerProfileWithOrganization,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";
import {
  cleanupDemandResponseFixtures,
  createDemandResponse,
  createTeacherProfileWithSession,
} from "./_helpers/demand-response-fixtures";

const testEmailDomain = "teacher-demand-response-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  await cleanupDemandResponseFixtures(createdEmails);
  await prisma.$disconnect();
});

test.describe("teacher demand response smoke", () => {
  test("lets an approved teacher submit a response, blocks a duplicate submit, then lets them withdraw and never resubmit", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-submit-withdraw-${Date.now()}`,
    );
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail, organizerEmail);

    const { sessionToken, teacherProfileId } = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });
    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
    const demandTitle = `Demand ${testRunId}`;
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: demandTitle }),
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(`/teacher/demands/${demand.id}`);

    await page
      .getByLabel("給團主的回覆")
      .fill("我很樂意帶領這場團課，過去有豐富的企業團體教學經驗，重視呼吸與身體覺察。");
    await page.getByRole("checkbox", { name: "平日晚上" }).check();
    await page.getByRole("button", { name: "送出回應" }).click();

    await expect(page.getByText("回應已送出。")).toBeVisible();
    await expect(page.getByText("已送出", { exact: true })).toBeVisible();

    const storedResponse = await prisma.demandResponse.findFirstOrThrow({
      where: { demandRequestId: demand.id, teacherProfileId },
    });
    expect(storedResponse.status).toBe("submitted");
    expect(storedResponse.proposedTimeSlots).toEqual(["平日晚上"]);

    // 重新整理頁面應顯示既有 response 狀態，而非再次出現提交表單（D8 終身一筆）。
    await page.goto(`/teacher/demands/${demand.id}`);
    await expect(page.getByLabel("給團主的回覆")).toBeHidden();
    await expect(page.getByText("已送出", { exact: true })).toBeVisible();

    // Withdraw。
    await page.getByText("撤回回應…").click();
    await page.getByRole("checkbox", { name: "我確認要撤回這則回應。" }).check();
    await page.getByRole("button", { name: "確認撤回" }).click();

    await expect(page.getByText("回應已撤回。")).toBeVisible();
    await expect(page.getByText("已撤回", { exact: true })).toBeVisible();

    const withdrawnResponse = await prisma.demandResponse.findUniqueOrThrow({
      where: { id: storedResponse.id },
    });
    expect(withdrawnResponse.status).toBe("withdrawn");

    // Withdraw 後不可再撤回、也無法重新提交（不再顯示表單或撤回按鈕）。
    await page.goto(`/teacher/demands/${demand.id}`);
    await expect(page.getByText("已撤回", { exact: true })).toBeVisible();
    await expect(page.getByText("撤回回應…")).toBeHidden();
    await expect(page.getByLabel("給團主的回覆")).toBeHidden();
  });

  test("rejects a message that is too short with a validation error, and blocks unpicked controlled time-slot values", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-validation-${Date.now()}`,
    );
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail, organizerEmail);

    const { sessionToken, teacherProfileId } = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });
    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(`/teacher/demands/${demand.id}`);

    // message 太短（< 10 字），且未勾選任何時段。
    // textarea 的 minLength 只是體驗提升，這裡關閉原生表單驗證以證明伺服器端才是權威。
    await page.getByLabel("給團主的回覆").fill("太短");
    await page.locator("form").evaluate((form: HTMLFormElement) => {
      form.noValidate = true;
    });
    await page.getByRole("button", { name: "送出回應" }).click();

    await expect(page.getByText(/至少需要 10 個字/)).toBeVisible();
    await expect(page.getByText(/請至少選擇一個可配合時段/)).toBeVisible();

    const count = await prisma.demandResponse.count({
      where: { demandRequestId: demand.id, teacherProfileId },
    });
    expect(count).toBe(0);
  });

  test("lets a suspended teacher still view their own existing response, but blocks withdraw", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-suspended-${Date.now()}`,
    );
    const teacherEmail = `teacher-${testRunId}@${testEmailDomain}`;
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherEmail, organizerEmail);

    const { sessionToken, teacherProfileId } = await createTeacherProfileWithSession({
      email: teacherEmail,
      displayName: `Teacher ${testRunId}`,
      status: "approved",
    });
    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId,
      status: "submitted",
    });

    // Teacher 事後被 suspend（D12：既有 response 仍可讀，但不可 withdraw）。
    await prisma.teacherProfile.update({
      where: { id: teacherProfileId },
      data: { status: "suspended" },
    });

    await addAuthSessionCookie(context, sessionToken);
    await page.goto(`/teacher/demands/${demand.id}`);

    await expect(page.getByText("已送出", { exact: true })).toBeVisible();

    await page.getByText("撤回回應…").click();
    await page.getByRole("checkbox", { name: "我確認要撤回這則回應。" }).check();
    await page.getByRole("button", { name: "確認撤回" }).click();

    await expect(page.getByText(/不能撤回回應/)).toBeVisible();

    const response = await prisma.demandResponse.findFirstOrThrow({
      where: { demandRequestId: demand.id, teacherProfileId },
    });
    expect(response.status).toBe("submitted");
  });

  test("keeps responses private between teachers (IDOR): teacher B sees the submit form, never teacher A's response content", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-idor-${Date.now()}`,
    );
    const teacherAEmail = `teacher-a-${testRunId}@${testEmailDomain}`;
    const teacherBEmail = `teacher-b-${testRunId}@${testEmailDomain}`;
    const organizerEmail = `organizer-${testRunId}@${testEmailDomain}`;
    createdEmails.push(teacherAEmail, teacherBEmail, organizerEmail);

    const teacherA = await createTeacherProfileWithSession({
      email: teacherAEmail,
      displayName: `Teacher A ${testRunId}`,
      status: "approved",
    });
    const { sessionToken: teacherBToken } = await createTeacherProfileWithSession({
      email: teacherBEmail,
      displayName: `Teacher B ${testRunId}`,
      status: "approved",
    });
    const { organizerProfileId, organizationId } =
      await createOrganizerProfileWithOrganization({
        email: organizerEmail,
        displayName: `Organizer ${testRunId}`,
        organizationName: `Org ${testRunId}`,
      });
    const demand = await createDemandRequest({
      organizerProfileId,
      organizationId,
      status: "published",
      data: completeDemandRequestData({ title: `Demand ${testRunId}` }),
    });
    const secretMessage = "只有 Teacher A 應該看得到這段回覆內容。";
    await createDemandResponse({
      demandRequestId: demand.id,
      teacherProfileId: teacherA.teacherProfileId,
      message: secretMessage,
    });

    await addAuthSessionCookie(context, teacherBToken);
    await page.goto(`/teacher/demands/${demand.id}`);

    // Teacher B 沒有自己的 response，應看到提交表單，而非 Teacher A 的回覆內容。
    await expect(page.getByLabel("給團主的回覆")).toBeVisible();
    await expect(page.getByText(secretMessage)).toBeHidden();
  });
});
