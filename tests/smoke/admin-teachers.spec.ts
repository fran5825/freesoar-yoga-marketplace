import { PrismaClient, type TeacherProfileStatus } from "@prisma/client";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const authCookieName = "authjs.session-token";
const testEmailDomain = "admin-teachers-smoke.local";
const createdEmails: string[] = [];

test.afterAll(async () => {
  if (createdEmails.length === 0) {
    await prisma.$disconnect();
    return;
  }

  await prisma.session.deleteMany({
    where: {
      user: {
        email: {
          in: createdEmails,
        },
      },
    },
  });
  await prisma.teacherProfile.deleteMany({
    where: {
      user: {
        email: {
          in: createdEmails,
        },
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: createdEmails,
      },
    },
  });
  await prisma.$disconnect();
});

// 從老師列表點進某位老師的詳情頁（票 06：審核操作都在詳情頁）。
async function openTeacherFromList(page: Page, displayName: string, tab?: string) {
  await page.goto(tab ? `/admin/teachers?status=${tab}` : "/admin/teachers");
  await page.getByRole("link").filter({ hasText: displayName }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: displayName })).toBeVisible();
}

test.describe("/admin/teachers smoke", () => {
  test("search combines statuses, preserves return context after approval, and offers the processed record", async ({ context, page }, testInfo) => {
    const runId = normalizeForEmail(`${testInfo.project.name}-search-${Date.now()}`);
    const name = `春日老師 ${runId}`;
    const email = `find-${runId}@${testEmailDomain}`;
    await createTeacherProfileWithSession({ email, displayName: name, status: "submitted" });
    await createTeacherProfileWithSession({ email: `approved-${runId}@${testEmailDomain}`, displayName: `已核准 ${runId}`, status: "approved" });
    await createTeacherProfileWithSession({ email: `draft-${runId}@${testEmailDomain}`, displayName: `草稿 ${runId}`, status: "draft" });
    await addAuthSessionCookie(context, await createUserSession({ email: `admin-${runId}@${testEmailDomain}`, isAdmin: true }));
    await page.goto("/admin/teachers");
    await page.getByRole("searchbox", { name: "搜尋老師" }).fill(runId);
    await page.getByRole("button", { name: "搜尋", exact: true }).click();
    await expect(page.getByText("搜尋結果：1 筆", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "全部・2", exact: true }).click();
    await expect(page.getByRole("searchbox")).toHaveValue(runId);
    await expect(page.getByText("搜尋結果：2 筆", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: `草稿 ${runId}`, exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "待審・1", exact: true }).click();
    await expect(page.getByRole("link", { name: "待審・1", exact: true })).toHaveAttribute("aria-current", "page");
    await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-teachers.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name, exact: true }) }).click();
    await page.getByRole("link", { name: "← 回老師列表" }).click();
    await expect(page.getByRole("searchbox")).toHaveValue(runId);
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name, exact: true }) }).click();
    await page.getByRole("button", { name: "通過申請" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/admin/teachers" && url.searchParams.get("q") === runId && url.searchParams.get("result") === "success");
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: `查看 ${name}（目前：已通過）`, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
    await page.getByRole("link", { name: "← 回老師列表" }).click();
    await page.getByRole("link", { name: "清除關鍵字", exact: true }).click();
    await expect(page.getByRole("searchbox")).toHaveValue("");
    for (const keyword of [email, `find-${runId}`]) {
      await page.goto(`/admin/teachers?status=all&q=${encodeURIComponent(keyword)}`);
      await expect(page.getByText("搜尋結果：1 筆", { exact: true })).toBeVisible();
    }
  });
  test("blocks non-admin sessions", async ({ context, page }, testInfo) => {
    const nonAdminSessionToken = await createUserSession({
      email: createTestEmail(testInfo.project.name, "non-admin"),
      isAdmin: false,
    });

    await addAuthSessionCookie(context, nonAdminSessionToken);

    const response = await page.goto("/admin/teachers");

    expect(response?.status()).toBe(404);
  });

  test("teacher detail page: 404 for non-admin and for drafts, results only for rejected, filter tabs split by status", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-detail-${Date.now()}`,
    );
    const emailOf = (label: string) => `${label}-${testRunId}@${testEmailDomain}`;
    const idOf = async (label: string) =>
      (
        await prisma.teacherProfile.findFirstOrThrow({
          where: { user: { email: emailOf(label) } },
          select: { id: true },
        })
      ).id;

    await createTeacherProfileWithSession({
      email: emailOf("draft"),
      displayName: `Detail Draft ${testRunId}`,
      status: "draft",
    });
    await createTeacherProfileWithSession({
      email: emailOf("rejected"),
      displayName: `Detail Rejected ${testRunId}`,
      status: "rejected",
      rejectionReason: "教學經歷需要更具體，請補充後重新送審。",
    });
    await createTeacherProfileWithSession({
      email: emailOf("approved"),
      displayName: `Detail Approved ${testRunId}`,
      status: "approved",
    });
    const draftId = await idOf("draft");
    const rejectedId = await idOf("rejected");

    // 非管理員：404。
    const nonAdminToken = await createUserSession({ email: emailOf("plain"), isAdmin: false });
    await addAuthSessionCookie(context, nonAdminToken);
    const forbidden = await page.goto(`/admin/teachers/${rejectedId}`);
    expect(forbidden?.status()).toBe(404);

    await context.clearCookies();
    await addAuthSessionCookie(
      context,
      await createUserSession({ email: emailOf("admin"), isAdmin: true }),
    );

    // 草稿是老師私人資料，管理員也看不到。
    const draftResponse = await page.goto(`/admin/teachers/${draftId}`);
    expect(draftResponse?.status()).toBe(404);
    const missingResponse = await page.goto("/admin/teachers/does-not-exist");
    expect(missingResponse?.status()).toBe(404);

    // 已退回：只顯示結果與退回原因，沒有審核按鈕。
    await page.goto(`/admin/teachers/${rejectedId}`);
    await expect(page.getByRole("heading", { name: "這份申請已退回" })).toBeVisible();
    await expect(page.getByText("退回原因：教學經歷需要更具體，請補充後重新送審。")).toBeVisible();
    await expect(page.getByRole("button", { name: "通過申請" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "退回申請" })).toHaveCount(0);

    // 篩選分頁：已通過的只在「已通過」與「全部」，不在預設「待審」。
    await page.goto("/admin/teachers");
    await expect(page.getByText(`Detail Approved ${testRunId}`)).toBeHidden();
    await page.goto("/admin/teachers?status=approved");
    await expect(page.getByText(`Detail Approved ${testRunId}`)).toBeVisible();
    await expect(page.getByRole("link", { name: /已通過・\d+/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.goto("/admin/teachers?status=all");
    await expect(page.getByText(`Detail Approved ${testRunId}`)).toBeVisible();
    // 草稿不在任何分頁；已退回在自己的分頁，不在「全部」以外的其他分頁。
    await expect(page.getByText(`Detail Draft ${testRunId}`)).toBeHidden();
    await expect(page.getByText(`Detail Rejected ${testRunId}`)).toBeVisible();

    await page.goto("/admin/teachers");
    await expect(page.getByText(`Detail Rejected ${testRunId}`)).toBeHidden();
    await page.goto("/admin/teachers?status=rejected");
    await expect(page.getByText(`Detail Rejected ${testRunId}`)).toBeVisible();
    await expect(page.getByRole("link", { name: /已退回・\d+/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByText(`Detail Draft ${testRunId}`)).toBeHidden();
  });

  test("lets admin approve submitted teacher applications", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const adminSessionToken = await createUserSession({
      email: `admin-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
    });
    const submittedTeacherSessionToken = await createTeacherProfileWithSession({
      email: `submitted-${testRunId}@${testEmailDomain}`,
      displayName: `Submitted Teacher ${testRunId}`,
      status: "submitted",
    });

    await createTeacherProfileWithSession({
      email: `draft-${testRunId}@${testEmailDomain}`,
      displayName: `Draft Teacher ${testRunId}`,
      status: "draft",
    });
    await createTeacherProfileWithSession({
      email: `rejected-${testRunId}@${testEmailDomain}`,
      displayName: `Rejected Teacher ${testRunId}`,
      status: "rejected",
    });
    await createTeacherProfileWithSession({
      email: `suspended-${testRunId}@${testEmailDomain}`,
      displayName: `Suspended Teacher ${testRunId}`,
      status: "suspended",
    });

    await addAuthSessionCookie(context, adminSessionToken);
    await page.goto("/admin/teachers");
    await expect(page.getByRole("heading", { name: "老師審核", level: 1 })).toBeVisible();
    // 預設停在「待審」：待審核的老師在，草稿、已退回、已暫停的不在。
    await expect(
      page.getByRole("link", { name: new RegExp(`Submitted Teacher ${testRunId}`) }),
    ).toBeVisible();
    await expect(page.getByText(`Draft Teacher ${testRunId}`)).toBeHidden();
    await expect(page.getByText(`Rejected Teacher ${testRunId}`)).toBeHidden();
    await expect(page.getByText(`Suspended Teacher ${testRunId}`)).toBeHidden();

    // 已暫停的老師在「已暫停」分頁，進詳情頁看得到恢復、看不到審核按鈕。
    await openTeacherFromList(page, `Suspended Teacher ${testRunId}`, "suspended");
    await expect(page.getByRole("button", { name: "恢復這位老師" })).toBeVisible();
    await expect(page.getByRole("button", { name: "通過申請" })).toHaveCount(0);

    await openTeacherFromList(page, `Submitted Teacher ${testRunId}`);
    await page.getByRole("button", { name: "通過申請" }).click();

    // 審核完回到列表（停在待審）並顯示成功提示，這位老師已離開待審。
    await expect(page).toHaveURL(/\/admin\/teachers\?result=success/);
    await expect(page.getByText("已通過這位老師的申請。")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: `Submitted Teacher ${testRunId}`, exact: true }),
    ).toHaveCount(0);

    const approvedProfile = await prisma.teacherProfile.findFirstOrThrow({
      where: {
        user: {
          email: `submitted-${testRunId}@${testEmailDomain}`,
        },
      },
      select: { status: true },
    });

    expect(approvedProfile.status).toBe("approved");

    await context.clearCookies();
    await addAuthSessionCookie(context, submittedTeacherSessionToken);
    await page.goto("/teachers/join");

    // 已通過審核的老師開申請頁，會直接被導到老師總覽。
    await expect(page).toHaveURL(/\/teacher\/dashboard$/);
    await expect(page.getByText("已核准", { exact: true }).first()).toBeVisible();
  });

  test("lets admin reject a submitted application with a required reason", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-reject-${Date.now()}`,
    );
    const adminSessionToken = await createUserSession({
      email: `admin-reject-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
    });
    const rejectedEmail = `to-reject-${testRunId}@${testEmailDomain}`;
    await createTeacherProfileWithSession({
      email: rejectedEmail,
      displayName: `Reject Target ${testRunId}`,
      status: "submitted",
    });

    await addAuthSessionCookie(context, adminSessionToken);
    await openTeacherFromList(page, `Reject Target ${testRunId}`);

    // 票 05：退回先展開原因才出現送出鈕；D3: reason 必填 —— native required 會擋住空白送出。
    await expect(page.getByLabel("退回原因")).toHaveCount(0);
    await page.getByRole("button", { name: "退回申請" }).click();
    await expect(page.getByLabel("退回原因")).toBeFocused();
    await page.getByRole("button", { name: "送出退回" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: `Reject Target ${testRunId}` }),
    ).toBeVisible();

    // 前後空白應在持久化前被 trim（D3）。
    const reason =
      "  教學經歷需要更具體，請補充帶領團課的實際經驗與時數，方便後續媒合。  ";
    await page.getByLabel("退回原因").fill(reason);
    await page.getByRole("button", { name: "送出退回" }).click();

    await expect(page).toHaveURL(
      (url) =>
        url.pathname === "/admin/teachers" &&
        url.searchParams.get("result") === "success" &&
        url.searchParams.get("message") ===
          "已退回這位老師的申請，退回原因會顯示給老師。",
      { timeout: 15_000 },
    );
    await expect(
      page.getByText("已退回這位老師的申請，退回原因會顯示給老師。"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: `Reject Target ${testRunId}`, exact: true }),
    ).toHaveCount(0);

    const rejectedProfile = await prisma.teacherProfile.findFirstOrThrow({
      where: { user: { email: rejectedEmail } },
      select: { status: true, rejectionReason: true },
    });

    expect(rejectedProfile.status).toBe("rejected");
    expect(rejectedProfile.rejectionReason).toBe(reason.trim());
  });

  test("fills the rejection reason from a common-reason template, which can still be edited", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-template-${Date.now()}`,
    );
    const email = `teacher-template-${testRunId}@${testEmailDomain}`;
    await createTeacherProfileWithSession({
      email,
      displayName: `Template Target ${testRunId}`,
      status: "submitted",
    });
    const adminSessionToken = await createUserSession({
      email: `admin-template-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
    });
    await addAuthSessionCookie(context, adminSessionToken);

    await openTeacherFromList(page, `Template Target ${testRunId}`);

    await page.getByRole("button", { name: "退回申請" }).click();
    const reasonField = page.getByLabel("退回原因");
    await expect(reasonField).toHaveValue("");
    // 票 05：範本逐字使用規格第 9 節核准的老師三句。
    await page.getByRole("button", { name: "教學經歷", exact: true }).click();
    await expect(reasonField).toHaveValue(
      "請補充帶領團課的實際經驗與教學年資，讓我們更了解你的教學背景；補充後歡迎重新送審。",
    );
    await page.getByRole("button", { name: "簡介與風格", exact: true }).click();
    await expect(reasonField).toHaveValue("請多描述你的課程特色、教學方式與適合的學員；補充後歡迎重新送審。");
    await page.getByRole("button", { name: "資料不清楚", exact: true }).click();
    await expect(reasonField).toHaveValue(
      "部分申請資料尚不清楚，請確認擅長類型、服務地區與授課形式，補充後重新送審。",
    );
    await expect(page.getByText(/已輸入 \d+ 字（10–1000 字）/)).toBeVisible();

    // 帶入後仍可修改。
    const edited = "教學經歷需要更具體，另外請附上最近一年帶團的實際紀錄。";
    await reasonField.fill(edited);
    await page.getByRole("button", { name: "送出退回" }).click();

    await expect
      .poll(async () =>
        prisma.teacherProfile.findFirst({
          where: { user: { email } },
          select: { status: true, rejectionReason: true },
        }),
      )
      .toEqual({ status: "rejected", rejectionReason: edited });
  });

  test("keeps the typed reason on the page when rejection fails, and refreshes to the real status when the application was already handled", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-reject-fail-${Date.now()}`,
    );
    const email = `reject-fail-${testRunId}@${testEmailDomain}`;
    const displayName = `Reject Fail ${testRunId}`;
    await createTeacherProfileWithSession({ email, displayName, status: "submitted" });
    await addAuthSessionCookie(
      context,
      await createUserSession({ email: `admin-reject-fail-${testRunId}@${testEmailDomain}`, isAdmin: true }),
    );
    await openTeacherFromList(page, displayName);

    // 頁首摘要與跳到操作區的連結；次要資料預設收合。
    await expect(page.getByText("Taipei・教學 5 年・Group class")).toBeVisible();
    await expect(page.getByText("其他資料：證照、價格與上課偏好")).toBeVisible();
    await expect(page.getByText("偏好課程長度")).toBeHidden();
    await page.getByRole("link", { name: "前往審核操作" }).click();
    await expect(page).toHaveURL(/#teacher-actions$/);

    // 前後是空白、實際內容不足 10 字：瀏覽器端依 trim 後字數擋下，不送出。
    const shortReason = "          太短";
    await page.getByRole("button", { name: "退回申請" }).click();
    await page.getByLabel("退回原因").fill(shortReason);
    await page.getByRole("button", { name: "送出退回" }).click();
    expect(await page.getByLabel("退回原因").evaluate((el: HTMLTextAreaElement) => el.validationMessage)).toContain("扣掉前後空白後至少需要 10 個字");
    await expect(page.getByRole("alert").filter({ hasText: "已填的原因仍保留" })).toHaveCount(0);

    // 繞過瀏覽器端檢查，伺服器 trim 後仍擋下。原因留在本頁、不進 URL。
    await bypassClientReasonValidation(page, "退回原因");
    await page.getByRole("button", { name: "送出退回" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "已填的原因仍保留" })).toBeVisible();
    await expect(page.getByLabel("退回原因")).toHaveValue(shortReason);
    expect(page.url()).not.toContain(encodeURIComponent("太短"));
    expect(
      (await prisma.teacherProfile.findFirstOrThrow({ where: { user: { email } }, select: { status: true } })).status,
    ).toBe("submitted");
    await expect(page.getByRole("button", { name: "送出退回" })).toBeEnabled();
    await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-teacher-review-error.png`, fullPage: true });

    // 修正後可重試；但若這段期間申請已被別人通過：停用本頁審核、保留已填原因，並提供重新載入看目前狀態。
    await prisma.teacherProfile.updateMany({ where: { user: { email } }, data: { status: "approved" } });
    const fixedReason = "請補充帶領團課的實際經驗與教學年資，補充後歡迎重新送審。";
    await page.getByLabel("退回原因").fill(fixedReason);
    await page.getByRole("button", { name: "送出退回" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "這頁的審核操作已停用" })).toBeVisible();
    await expect(page.getByLabel("退回原因")).toHaveValue(fixedReason);
    await expect(page.getByRole("button", { name: "送出退回" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "通過申請" })).toBeDisabled();
    expect(page.url()).not.toContain(encodeURIComponent("教學年資"));
    expect(
      (await prisma.teacherProfile.findFirstOrThrow({ where: { user: { email } }, select: { status: true } })).status,
    ).toBe("approved");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link", { name: "重新載入，查看目前狀態" }).click();
    await expect(page.getByRole("heading", { name: "這位老師已通過審核" })).toBeVisible();
    await expect(page.getByRole("button", { name: "通過申請" })).toHaveCount(0);
  });

  test("when one form failed earlier and the other then finds the application already handled, only the stale explanation is shown", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-mixed-${Date.now()}`,
    );
    const email = `mixed-${testRunId}@${testEmailDomain}`;
    const displayName = `Mixed Fail ${testRunId}`;
    await createTeacherProfileWithSession({ email, displayName, status: "submitted" });
    await addAuthSessionCookie(
      context,
      await createUserSession({ email: `admin-mixed-${testRunId}@${testEmailDomain}`, isAdmin: true }),
    );
    await openTeacherFromList(page, displayName);

    // 退回先暫時失敗（伺服器擋下原因不足），接著別人處理掉申請，再按通過。
    const shortReason = "          太短";
    await page.getByRole("button", { name: "退回申請" }).click();
    await bypassClientReasonValidation(page, "退回原因");
    await page.getByLabel("退回原因").fill(shortReason);
    await page.getByRole("button", { name: "送出退回" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "已填的原因仍保留" })).toBeVisible();

    await prisma.teacherProfile.updateMany({ where: { user: { email } }, data: { status: "approved" } });
    await page.getByRole("button", { name: "通過申請" }).click();

    const staleNotice = page.getByRole("alert").filter({ hasText: "這頁的審核操作已停用" });
    await expect(staleNotice).toBeVisible();
    await expect(staleNotice).toContainText("可能剛才已經被處理過");
    // 先前退回的「修正後可以再送出」提示不能和停用狀態同時出現。
    await expect(page.getByText("已填的原因仍保留，修正後可以再送出一次。")).toHaveCount(0);
    await expect(page.getByLabel("退回原因")).toHaveValue(shortReason);
    await expect(page.getByRole("button", { name: "送出退回" })).toBeDisabled();
  });

  test("tells the admin the application no longer exists instead of falling into a 404, and offers the list", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-gone-${Date.now()}`,
    );
    const email = `gone-${testRunId}@${testEmailDomain}`;
    const displayName = `Gone Teacher ${testRunId}`;
    await createTeacherProfileWithSession({ email, displayName, status: "submitted" });
    await addAuthSessionCookie(
      context,
      await createUserSession({ email: `admin-gone-${testRunId}@${testEmailDomain}`, isAdmin: true }),
    );
    await page.goto(`/admin/teachers?q=${encodeURIComponent(testRunId)}`);
    await page.getByRole("link").filter({ hasText: displayName }).first().click();
    // 先等詳情頁載入完，再模擬「這段期間資料被刪除」。
    await expect(page.getByRole("button", { name: "通過申請" })).toBeEnabled();

    await prisma.teacherProfile.deleteMany({ where: { user: { email } } });
    await page.getByRole("button", { name: "通過申請" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "找不到這份老師申請" })).toBeVisible();
    await expect(page.getByRole("button", { name: "通過申請" })).toBeDisabled();
    await page.getByRole("link", { name: "回老師列表", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/admin/teachers" && url.searchParams.get("q") === testRunId);
  });

  test("suspends with a reason after confirming the teacher and impact, keeps the reason on failure, and restores in one click", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-suspend-${Date.now()}`,
    );
    const email = `suspend-${testRunId}@${testEmailDomain}`;
    const displayName = `Suspend Target ${testRunId}`;
    await createTeacherProfileWithSession({ email, displayName, status: "approved" });
    await addAuthSessionCookie(
      context,
      await createUserSession({ email: `admin-suspend-${testRunId}@${testEmailDomain}`, isAdmin: true }),
    );
    const statusOf = async () =>
      (await prisma.teacherProfile.findFirstOrThrow({ where: { user: { email } }, select: { status: true } })).status;

    await page.goto(`/admin/teachers?status=approved&q=${encodeURIComponent(testRunId)}`);
    await page.getByRole("link").filter({ hasText: displayName }).first().click();
    const trigger = page.getByRole("button", { name: "暫停這位老師" });
    await expect(trigger).toBeEnabled();
    const dialog = page.getByRole("dialog");

    // 原因無效時不開確認視窗。
    await trigger.click();
    await expect(dialog).toBeHidden();

    // 前後補空白、實際不足 10 字：瀏覽器端依 trim 後字數擋下，不開視窗。
    const shortReason = "          太短";
    await page.getByLabel("暫停原因").fill(shortReason);
    await trigger.click();
    await expect(dialog).toBeHidden();

    // 原因有效才開視窗：顯示老師名稱與實際影響；Esc 關閉不送出、不清空原因，焦點回到觸發按鈕。
    const validReason = "近期收到多筆課程品質相關反映，需要先暫停接受新需求。";
    await page.getByLabel("暫停原因").fill(validReason);
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`確定要暫停 ${displayName} 嗎？`);
    await expect(dialog).toContainText("課程會從公開課程列表移除，也不能接受新報名");
    await expect(dialog).toContainText("已建立的課程與既有報名不會自動取消");
    await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-teacher-suspend-confirm.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.getByLabel("暫停原因")).toHaveValue(validReason);
    expect(await statusOf()).toBe("approved");

    // 繞過瀏覽器端檢查，證明伺服器 trim 後仍會擋下：留在本頁、原因保留、不進 URL，按鈕解除停用可以重試。
    await bypassClientReasonValidation(page, "暫停原因");
    await page.getByLabel("暫停原因").fill(shortReason);
    await trigger.click();
    await dialog.getByRole("button", { name: "確認暫停" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "已填的原因仍保留" })).toBeVisible();
    await expect(page.getByLabel("暫停原因")).toHaveValue(shortReason);
    expect(page.url()).not.toContain(encodeURIComponent("太短"));
    await expect(trigger).toBeEnabled();
    expect(await statusOf()).toBe("approved");

    // 修正後重試成功：回原搜尋／分類，結果指出老師與目前狀態，可追查（已離開「已通過」分類）。
    await page.getByLabel("暫停原因").fill("近期收到多筆課程品質相關反映，需要先暫停接受新需求。");
    await trigger.click();
    await dialog.getByRole("button", { name: "確認暫停" }).click();
    await expect(page).toHaveURL(
      (url) => url.pathname === "/admin/teachers" && url.searchParams.get("status") === "approved" && url.searchParams.get("q") === testRunId,
    );
    await expect(page.getByText("這位老師已經暫停，暫停原因會顯示給老師。")).toBeVisible();
    expect(await statusOf()).toBe("suspended");
    await page.getByRole("link", { name: `查看 ${displayName}（目前：已暫停）`, exact: true }).click();
    await expect(page.getByRole("heading", { name: "這位老師目前暫停中" })).toBeVisible();

    // 恢復一鍵完成，不跳確認視窗。
    await page.getByRole("button", { name: "恢復這位老師" }).click();
    await expect(page.getByText("這位老師已經恢復。")).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(await statusOf()).toBe("approved");
    await expect(page.getByRole("link", { name: `查看 ${displayName}（目前：已通過）`, exact: true })).toBeVisible();
  });

  test("disables suspend/restore and keeps the reason when the teacher status changed meanwhile", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-status-stale-${Date.now()}`,
    );
    const email = `status-stale-${testRunId}@${testEmailDomain}`;
    const displayName = `Status Stale ${testRunId}`;
    await createTeacherProfileWithSession({ email, displayName, status: "approved" });
    await addAuthSessionCookie(
      context,
      await createUserSession({ email: `admin-status-stale-${testRunId}@${testEmailDomain}`, isAdmin: true }),
    );
    await openTeacherFromList(page, displayName, "approved");
    const reason = "近期收到多筆課程品質相關反映，需要先暫停接受新需求。";
    await page.getByLabel("暫停原因").fill(reason);

    // 別人先暫停了：送出後停用操作、保留原因，可重新載入看目前狀態。
    await prisma.teacherProfile.updateMany({ where: { user: { email } }, data: { status: "suspended" } });
    await page.getByRole("button", { name: "暫停這位老師" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "確認暫停" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "這頁的狀態操作已停用" })).toContainText("已不是「已通過」狀態");
    await expect(page.getByLabel("暫停原因")).toHaveValue(reason);
    await expect(page.getByRole("button", { name: "暫停這位老師" })).toBeDisabled();
    await page.getByRole("link", { name: "重新載入，查看目前狀態" }).click();
    await expect(page.getByRole("heading", { name: "這位老師目前暫停中" })).toBeVisible();

    // 恢復時別人已先恢復：同樣停用並提示。
    await prisma.teacherProfile.updateMany({ where: { user: { email } }, data: { status: "approved" } });
    await page.getByRole("button", { name: "恢復這位老師" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "這頁的狀態操作已停用" })).toContainText("已不是「已暫停」狀態");
    await expect(page.getByRole("button", { name: "恢復這位老師" })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("clears rejectionReason when an application is approved", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-approve-clear-${Date.now()}`,
    );
    const adminSessionToken = await createUserSession({
      email: `admin-approve-clear-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
    });
    const email = `approve-clear-${testRunId}@${testEmailDomain}`;
    await createTeacherProfileWithSession({
      email,
      displayName: `Approve Clear ${testRunId}`,
      status: "submitted",
      rejectionReason: "舊的退回原因，approve 後應被清空。",
    });

    await addAuthSessionCookie(context, adminSessionToken);
    await openTeacherFromList(page, `Approve Clear ${testRunId}`);
    await page.getByRole("button", { name: "通過申請" }).click();

    await expect(page.getByText("已通過這位老師的申請。")).toBeVisible();

    const profile = await prisma.teacherProfile.findFirstOrThrow({
      where: { user: { email } },
      select: { status: true, rejectionReason: true },
    });

    expect(profile.status).toBe("approved");
    expect(profile.rejectionReason).toBeNull();
  });

  test("overwrites an existing reason when rejecting again", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-rereject-${Date.now()}`,
    );
    const adminSessionToken = await createUserSession({
      email: `admin-rereject-${testRunId}@${testEmailDomain}`,
      isAdmin: true,
    });
    const email = `rereject-${testRunId}@${testEmailDomain}`;
    await createTeacherProfileWithSession({
      email,
      displayName: `Re-reject ${testRunId}`,
      status: "submitted",
      rejectionReason: "第一次的退回原因 A，應被覆蓋。",
    });

    await addAuthSessionCookie(context, adminSessionToken);
    await openTeacherFromList(page, `Re-reject ${testRunId}`);

    const newReason =
      "第二次的退回原因 B，請補充教學時數與實際帶團經歷，方便判斷適合的團課。";
    await page.getByRole("button", { name: "退回申請" }).click();
    await page.getByLabel("退回原因").fill(newReason);
    await page.getByRole("button", { name: "送出退回" }).click();

    await expect(
      page.getByText("已退回這位老師的申請，退回原因會顯示給老師。"),
    ).toBeVisible();

    const profile = await prisma.teacherProfile.findFirstOrThrow({
      where: { user: { email } },
      select: { status: true, rejectionReason: true },
    });

    expect(profile.status).toBe("rejected");
    expect(profile.rejectionReason).toBe(newReason);
  });
});

async function createUserSession({
  email,
  isAdmin,
}: {
  email: string;
  isAdmin: boolean;
}) {
  createdEmails.push(email);

  const user = await prisma.user.create({
    data: {
      email,
      name: email.split("@")[0],
      isAdmin,
    },
    select: { id: true },
  });
  const sessionToken = randomUUID();

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  return sessionToken;
}

async function createTeacherProfileWithSession({
  email,
  displayName,
  status,
  rejectionReason = null,
}: {
  email: string;
  displayName: string;
  status: TeacherProfileStatus;
  rejectionReason?: string | null;
}) {
  const sessionToken = await createUserSession({ email, isAdmin: false });
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true },
  });

  await prisma.teacherProfile.create({
    data: {
      userId: user.id,
      displayName,
      bio: `${displayName} bio`,
      teachingStyle: "Clear and steady group-class guidance.",
      experienceYears: 5,
      specialties: ["Hatha", "Stretch"],
      serviceAreas: ["Taipei"],
      teachingFormats: ["Group class"],
      status,
      rejectionReason,
    },
  });

  return sessionToken;
}

// 關掉原因欄的瀏覽器端檢查（required／minlength 與 trim 後字數的 custom validity），
// 用來證明伺服器端驗證仍會權威地擋下。
async function bypassClientReasonValidation(page: Page, label: string) {
  await page.getByLabel(label).evaluate((el: HTMLTextAreaElement) => {
    el.removeAttribute("required");
    el.removeAttribute("minlength");
    el.removeAttribute("maxlength");
    el.setCustomValidity = () => {};
    HTMLTextAreaElement.prototype.setCustomValidity.call(el, "");
  });
}

async function addAuthSessionCookie(
  context: BrowserContext,
  sessionToken: string,
) {
  await context.addCookies([
    {
      name: authCookieName,
      value: sessionToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

function createTestEmail(projectName: string, label: string) {
  return `${label}-${normalizeForEmail(projectName)}-${Date.now()}@${testEmailDomain}`;
}

function normalizeForEmail(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
