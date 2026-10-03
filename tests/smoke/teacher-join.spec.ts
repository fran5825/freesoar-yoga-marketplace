import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const authCookieName = "authjs.session-token";
const testEmailDomain = "teacher-join-smoke.local";
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

test.describe("/teachers/join smoke", () => {
  test("shows a visitor-facing explainer, not a fillable form, when signed out", async ({
    page,
  }) => {
    await page.goto("/teachers/join");

    await expect(
      page.getByRole("heading", {
        name: "一起建立清楚、安心的瑜伽團課合作",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "審核怎麼進行" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "申請前可以先準備這些" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "常見問題" }),
    ).toBeVisible();

    // teacher-join-gated-application：未登入訪客只看得到唯讀導覽內容，不會看到
    // 任何可以送出但送不出去的表單輸入框（G1／Definition of Done）。
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "儲存草稿" }).first(),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "送出審核" }).first(),
    ).not.toBeVisible();

    const signInCta = page.getByRole("link", {
      name: "登入／建立帳號並開始申請",
    });
    await expect(signInCta).toBeVisible();
    // G3：CTA 帶 callbackUrl，登入完成後導回這一頁，不會掉回 /account。
    await expect(signInCta).toHaveAttribute(
      "href",
      "/sign-in?callbackUrl=%2Fteachers%2Fjoin",
    );
  });

  test("shows teacher application controls and submit confirmation", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const email = `new-teacher-${testRunId}@${testEmailDomain}`;
    const sessionToken = await createSignedInSessionWithoutTeacherProfile({
      email,
    });

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

    await page.goto("/teachers/join");

    await expect(
      page.getByRole("heading", {
        name: "一起建立清楚、安心的瑜伽團課合作",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "儲存草稿" }).first()).toBeVisible();
    // 票 06：沒有「檢查準備狀態」按鈕，缺幾項隨時看得到；七項必填集中一區，選填收在「其他資料」。
    await expect(page.getByRole("button", { name: "檢查準備狀態" })).toHaveCount(0);
    await expect(page.getByText("還缺 7 項才能送審：").first()).toBeVisible();
    await expect(page.getByText("必填 0 / 7").first()).toBeVisible();
    await expect(page.getByText("其他資料（可之後補）")).toBeVisible();
    await expect(page.getByText("參考寫法：").first()).toBeVisible();

    // 缺項時按「送出審核」：不打開確認，標出缺項並帶到第一個（公開顯示名稱）。
    await page.getByRole("button", { name: "送出審核" }).first().click();
    await expect(page.getByText("確認送出審核")).toHaveCount(0);
    await expect(page.getByLabel("公開顯示名稱")).toBeFocused();
    await expect(
      page.getByText("請補上「公開顯示名稱」，讓申請內容更完整、也更容易被理解。"),
    ).toBeVisible();

    // 必填 7 項都填完，「送出審核」才會啟用。
    await page.getByLabel("公開顯示名稱").fill("Smoke Teacher");
    await page.getByLabel("老師簡介").fill("Smoke bio.");
    await page.getByLabel("教學風格").fill("Smoke style.");
    await page.getByLabel("教學年資").selectOption("1");
    await page.getByText("陰瑜伽", { exact: true }).click();
    await page.getByText("台北市", { exact: true }).click();
    await page.getByText("小班制教學", { exact: true }).click();

    await expect(page.getByText("必填欄位都填好了，可以送出審核。").first()).toBeVisible();
    await expect(page.getByText("必填已完成").first()).toBeVisible();
    await expect(page.getByText("已輸入 10 字").first()).toBeVisible();

    await page.getByRole("button", { name: "送出審核" }).first().click();

    await expect(page.getByText("確認送出審核").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "確認送出審核" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "先回來調整" }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "先回來調整" }).first().click();

    await expect(page.getByText("確認送出審核").first()).toBeHidden();
  });

  // 2026-10-03：送審不用先儲存草稿；上課頻率、地點可複選；上課時長多了 50 分鐘。
  test("submits directly without saving a draft first, with multi-choice preferences", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const email = `direct-submit-${testRunId}@${testEmailDomain}`;
    const sessionToken = await createSignedInSessionWithoutTeacherProfile({
      email,
    });

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

    await page.goto("/teachers/join");

    await page.getByLabel("公開顯示名稱").fill("Direct Submit Teacher");
    await page.getByLabel("老師簡介").fill("Smoke bio.");
    await page.getByLabel("教學風格").fill("Smoke style.");
    await page.getByLabel("教學年資").selectOption("1");
    await page.getByText("陰瑜伽", { exact: true }).click();
    await page.getByText("台北市", { exact: true }).click();
    await page.getByText("小班制教學", { exact: true }).click();

    // 選填收在「其他資料（可之後補）」，要先展開。
    await page.getByText("其他資料（可之後補）").click();
    await page.getByLabel("希望的上課時長").selectOption("50");
    await page.getByText("每週一次", { exact: true }).click();
    await page.getByText("每兩週一次", { exact: true }).click();
    await page
      .getByText("可配合到學員／團主指定的地點授課", { exact: true })
      .click();
    await page.getByText("希望在自己的教學地點授課", { exact: true }).click();

    await page.getByRole("button", { name: "送出審核" }).first().click();
    await page.getByRole("button", { name: "確認送出審核" }).first().click();

    await expect(page.getByText("已送出審核").first()).toBeVisible();

    const profile = await prisma.teacherProfile.findFirstOrThrow({
      where: { user: { email } },
    });
    expect(profile.status).toBe("submitted");
    expect(profile.preferredSessionLengthMinutes).toBe(50);
    expect(profile.preferredFrequency).toBe("每週一次\n每兩週一次");
    expect(profile.preferredLocationType).toBe(
      "可配合到學員／團主指定的地點授課\n希望在自己的教學地點授課",
    );
  });

  test("shows a read-only summary, not an editable form, while the application is under review", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const displayName = `Submitted Teacher ${testRunId}`;
    const sessionToken = await createRejectedTeacherProfileSession({
      email: `submitted-${testRunId}@${testEmailDomain}`,
      displayName,
      status: "submitted",
    });

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

    await page.goto("/teachers/join");

    await expect(
      page.getByRole("heading", { name: "你的老師申請正在審核" }),
    ).toBeVisible();
    // 結果只會用站內通知告知；寄 email 尚未實作，不能寫成會寄信，也不承諾審核天數。
    await expect(page.getByText("審核完成後會在站內通知你").first()).toBeVisible();
    await expect(page.locator("main").getByText(/email|信箱|工作天/i)).toHaveCount(0);
    // 送出的內容以唯讀方式顯示，沒有可輸入的欄位與儲存／送出按鈕。
    await expect(page.getByText(displayName, { exact: true })).toBeVisible();
    await expect(page.getByText("Hatha", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "儲存草稿" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "送出審核" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "回老師總覽" })).toHaveAttribute(
      "href",
      "/teacher/dashboard",
    );
  });

  test("puts the rejection reason at the top and jumps to the first missing required field", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const rejectionReason = `請補充簡介裡的教學年資與服務對象 ${testRunId}。`;
    const sessionToken = await createRejectedTeacherProfileSession({
      email: `rejected-missing-${testRunId}@${testEmailDomain}`,
      displayName: `Rejected Missing ${testRunId}`,
      rejectionReason,
      bio: "",
    });

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

    await page.goto("/teachers/join");

    const banner = page.getByRole("region", { name: "這份申請需要修正" });
    await expect(banner).toBeVisible();
    await expect(banner.getByText(rejectionReason)).toBeVisible();
    // 不用先按「檢查準備狀態」，缺的欄位一進來就標出來。
    await expect(page.getByText("還缺 1 項才能送審：").first()).toBeVisible();
    await expect(
      page.getByText("請補上「老師簡介」，讓申請內容更完整、也更容易被理解。"),
    ).toBeVisible();

    await banner
      .getByRole("button", { name: "從第一個缺項開始修正（還缺 1 項）" })
      .click();
    await expect(page.getByLabel("老師簡介")).toBeInViewport();
  });

  test("service areas are choose-only; free-text service areas from old applications are flagged, not kept", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const sessionToken = await createRejectedTeacherProfileSession({
      email: `legacy-area-${testRunId}@${testEmailDomain}`,
      displayName: `Legacy Area ${testRunId}`,
      rejectionReason: `請補充服務地區 ${testRunId}。`,
      serviceAreas: ["ddde"],
    });

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

    await page.goto("/teachers/join");

    const areaCard = page.locator("#teacher-application-serviceAreas-card");
    await expect(areaCard).toBeVisible();
    // 服務地區只能勾選，沒有「其他」輸入框；擅長類型仍保留。
    await expect(areaCard.getByRole("textbox")).toHaveCount(0);
    await expect(
      page.locator("#teacher-application-specialties-card").getByRole("textbox"),
    ).toHaveCount(1);
    // 舊的自由輸入內容不算數：算缺項，並提醒老師改選。
    await expect(page.getByText("還缺 1 項才能送審：").first()).toBeVisible();
    await expect(areaCard.getByText("你先前填寫的「ddde」不在選項內")).toBeVisible();
    // 票 06：缺項時按「重新送出審核」不會打開確認，而是帶到缺的服務地區。
    await page.getByRole("button", { name: "重新送出審核" }).first().click();
    await expect(page.getByText("確認送出審核")).toHaveCount(0);
    await expect(areaCard).toBeInViewport();

    await areaCard.getByText("台北市", { exact: true }).click();

    await expect(
      page.getByText("必填欄位都填好了，可以送出審核。").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "重新送出審核" }).first(),
    ).toBeEnabled();
  });

  for (const status of ["approved", "suspended"] as const) {
    test(`sends a ${status} teacher straight to the teacher dashboard`, async ({
      context,
      page,
    }, testInfo) => {
      const testRunId = normalizeForEmail(
        `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
      );
      const sessionToken = await createRejectedTeacherProfileSession({
        email: `${status}-${testRunId}@${testEmailDomain}`,
        displayName: `${status} Teacher ${testRunId}`,
        status,
      });

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

      await page.goto("/teachers/join");

      await expect(page).toHaveURL(/\/teacher\/dashboard$/);
      await expect(page.getByRole("heading", { name: "老師總覽" })).toBeVisible();
    });
  }

  test("lets rejected teachers edit and resubmit", async ({
    context,
    page,
  }, testInfo) => {
    const testRunId = normalizeForEmail(
      `${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`,
    );
    const email = `rejected-${testRunId}@${testEmailDomain}`;
    const rejectionReason = `教學經歷需要更具體，請補充帶領團課的實際經驗與時數 ${testRunId}。`;
    const sessionToken = await createRejectedTeacherProfileSession({
      email,
      displayName: `Rejected Teacher ${testRunId}`,
      rejectionReason,
    });

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

    await page.goto("/teachers/join");

    await expect(page.getByText("已退回修正").first()).toBeVisible();
    // Teacher 在 join 頁看得到 Admin 填寫的退回原因。
    await expect(page.getByText("平台的退回說明")).toBeVisible();
    await expect(page.getByText(rejectionReason)).toBeVisible();
    await expect(page.getByRole("button", { name: "儲存修正" }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "重新送出審核" }).first(),
    ).toBeVisible();

    const revisedDisplayName = `Revised Teacher ${testRunId}`;

    await page.getByLabel("公開顯示名稱").fill(revisedDisplayName);
    await page.getByRole("button", { name: "重新送出審核" }).first().click();
    await expect(page.getByText("確認送出審核").first()).toBeVisible();
    await page.getByRole("button", { name: "確認送出審核" }).first().click();

    await expect(page.getByText("已送出審核").first()).toBeVisible();

    const profile = await prisma.teacherProfile.findFirstOrThrow({
      where: {
        user: {
          email,
        },
      },
      select: {
        displayName: true,
        status: true,
        rejectionReason: true,
      },
    });

    // D4: rejected → submitted 重新送審後，退回原因被清空。
    expect(profile).toEqual({
      displayName: revisedDisplayName,
      status: "submitted",
      rejectionReason: null,
    });
  });
});

// teacher-join-gated-application：一個「已登入、但還沒建立過 TeacherProfile」的老師——
// 資料庫裡完全沒有這個 user 的 TeacherProfile 記錄（不是 status="draft"，是根本不存在），
// 對應到 getInitialTeacherProfileApplicationSnapshotAction() 回傳 null 的那個分支。
async function createSignedInSessionWithoutTeacherProfile({
  email,
}: {
  email: string;
}) {
  createdEmails.push(email);

  const user = await prisma.user.create({
    data: {
      email,
      name: email.split("@")[0],
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

async function createRejectedTeacherProfileSession({
  email,
  displayName,
  rejectionReason = null,
  status = "rejected",
  bio = `${displayName} bio`,
  serviceAreas = ["台北市"],
}: {
  email: string;
  displayName: string;
  rejectionReason?: string | null;
  status?: "rejected" | "submitted" | "approved" | "suspended";
  bio?: string;
  serviceAreas?: string[];
}) {
  createdEmails.push(email);

  const user = await prisma.user.create({
    data: {
      email,
      name: email.split("@")[0],
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
  await prisma.teacherProfile.create({
    data: {
      userId: user.id,
      displayName,
      bio,
      teachingStyle: "Clear and steady group-class guidance.",
      experienceYears: 5,
      specialties: ["Hatha", "Stretch"],
      serviceAreas,
      teachingFormats: ["Group class"],
      status,
      rejectionReason,
    },
  });

  return sessionToken;
}

function normalizeForEmail(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// teacher-usability-redesign 票 06：送審摘要＝實際送出內容、儲存只認列送出的那一份、逾時不冒稱已存、未存離頁提醒。
test.describe("teacher application usability (ticket 06)", () => {
  async function signInFresh(context: import("@playwright/test").BrowserContext, label: string, testInfo: import("@playwright/test").TestInfo) {
    const email = `t06-${label}-${normalizeForEmail(`${testInfo.project.name}-${Date.now()}`)}@${testEmailDomain}`;
    const sessionToken = await createSignedInSessionWithoutTeacherProfile({ email });
    await context.addCookies([
      { name: authCookieName, value: sessionToken, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    return email;
  }

  async function fillRequired(page: import("@playwright/test").Page, displayName: string) {
    await page.getByLabel("公開顯示名稱").fill(displayName);
    await page.getByLabel("老師簡介").fill("十年教學經驗的簡介。");
    await page.getByLabel("教學風格").fill("溫和清楚的引導。");
    await page.getByLabel("教學年資").selectOption("1");
    await page.getByText("陰瑜伽", { exact: true }).click();
    await page.getByText("台北市", { exact: true }).click();
    await page.getByText("小班制教學", { exact: true }).click();
  }

  test("the confirm step shows exactly what will be submitted; backing out submits nothing; confirming submits that snapshot", async ({
    context,
    page,
  }, testInfo) => {
    const email = await signInFresh(context, "summary", testInfo);
    await page.goto("/teachers/join");
    const displayName = `摘要老師 ${Date.now()}`;
    await fillRequired(page, displayName);

    await page.getByRole("button", { name: "送出審核" }).first().click();
    const summary = page.getByRole("definition").filter({ hasText: displayName }).first();
    await expect(summary).toBeVisible();
    const confirmList = page.locator('dl[aria-label="這次送出的申請內容"]').first();
    await expect(confirmList).toContainText("陰瑜伽");
    await expect(confirmList).toContainText("台北市");
    await expect(confirmList).toContainText("小班制教學");
    await expect(confirmList).toContainText("已填 0 /");

    await page.getByRole("button", { name: "先回來調整" }).first().click();
    expect(await prisma.teacherProfile.count({ where: { user: { email } } })).toBe(0);

    await page.getByRole("button", { name: "送出審核" }).first().click();
    await page.getByRole("button", { name: "確認送出審核" }).first().click();
    await expect(page.getByText("你的老師申請正在審核")).toBeVisible();
    const profile = await prisma.teacherProfile.findFirstOrThrow({ where: { user: { email } } });
    expect(profile).toMatchObject({ status: "submitted", displayName });
  });

  test("a save only counts what was sent: edits typed while saving stay unsaved; a stalled save says it cannot tell instead of claiming success", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    const email = await signInFresh(context, "race", testInfo);
    await page.goto("/teachers/join");
    await page.getByLabel("公開顯示名稱").fill("競態老師");

    // 讓儲存請求晚 1.5 秒才送到伺服器，期間再修改名稱。
    await page.route("**/teachers/join", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });
    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await page.getByLabel("公開顯示名稱").fill("競態老師（改過）");
    await expect(page.getByText("草稿已儲存。").first()).toBeVisible();
    await expect(page.getByText("有尚未儲存的修改").first()).toBeVisible();
    const saved = await prisma.teacherProfile.findFirstOrThrow({ where: { user: { email } } });
    expect(saved.displayName).toBe("競態老師");
    await page.unrouteAll({ behavior: "ignoreErrors" });

    // 儲存一直沒有回應（請求卡住）：10 秒後說無法確定，不說已儲存，畫面內容保留。
    await page.route("**/teachers/join", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
      }
      // POST 故意不回應。
    });
    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page.getByText("目前無法確定是否已經存好").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("草稿已儲存。")).toHaveCount(0);
    await expect(page.getByLabel("公開顯示名稱")).toHaveValue("競態老師（改過）");
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("leaving with unsaved edits asks first; a freshly loaded draft and a just-saved draft leave without asking", async ({
    context,
    page,
  }, testInfo) => {
    await signInFresh(context, "leave", testInfo);
    await page.goto("/teachers/join");
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    const leaveLink = page.getByRole("banner").locator('a[href^="/"]:visible').first();

    await page.getByLabel("公開顯示名稱").fill("離頁老師");
    await leaveLink.click();
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain("尚未儲存的修改");
    await expect(page).toHaveURL(/\/teachers\/join$/);
    await expect(page.getByLabel("公開顯示名稱")).toHaveValue("離頁老師");

    await page.getByRole("button", { name: "儲存草稿" }).first().click();
    await expect(page.getByText("草稿已儲存。").first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("公開顯示名稱")).toHaveValue("離頁老師");
    await leaveLink.click();
    await expect(page).not.toHaveURL(/\/teachers\/join$/);
    expect(dialogs).toHaveLength(1);
  });
});
