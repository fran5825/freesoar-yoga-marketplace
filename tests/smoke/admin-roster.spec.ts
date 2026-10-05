import { expect, test } from "@playwright/test";

import { createTeacherProfileWithSession } from "./_helpers/demand-response-fixtures";
import {
  addAuthSessionCookie,
  createUserSession,
  normalizeForEmail,
  prisma,
} from "./_helpers/organizer-demand-fixtures";

// admin-usability 第三批票 12：名單姓名＋email、搜尋與分類、待確認報名取消、取消後留在名單。
const testEmailDomain = "admin-roster-smoke.local";
const createdEmails: string[] = [];
const createdUserIds: string[] = [];

test.afterAll(async () => {
  const users = { OR: [{ email: { in: createdEmails } }, { id: { in: createdUserIds } }] };
  await prisma.enrollment.deleteMany({ where: { user: users } });
  await prisma.classSession.deleteMany({
    where: { teacherProfile: { user: { email: { in: createdEmails } } } },
  });
  await prisma.teacherProfile.deleteMany({ where: { user: { email: { in: createdEmails } } } });
  await prisma.session.deleteMany({ where: { user: users } });
  await prisma.user.deleteMany({ where: users });
  await prisma.$disconnect();
});

const inDays = (days: number, hours = 0) => new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
type Status = "confirmed" | "pending" | "cancelled" | "attended" | "no_show";

test("roster shows name and email, searches and filters, cancels pending enrolments and keeps the roster context", async ({ context, page }, testInfo) => {
  const runId = normalizeForEmail(`${testInfo.project.name}-${testInfo.workerIndex}-${Date.now()}`);
  const adminEmail = `admin-${runId}@${testEmailDomain}`;
  const teacherEmail = `teacher-${runId}@${testEmailDomain}`;
  createdEmails.push(adminEmail, teacherEmail);
  const teacher = await createTeacherProfileWithSession({ email: teacherEmail, displayName: `Roster Teacher ${runId}`, status: "approved" });
  const makeClass = (title: string, startInDays: number) =>
    prisma.classSession.create({
      data: {
        title, teacherProfileId: teacher.teacherProfileId, status: "open_for_enrollment", origin: "teacher_initiated",
        requiresApproval: true, startAt: inDays(startInDays), endAt: inDays(startInDays, 1), location: "Taipei", capacity: 10,
      },
      select: { id: true },
    });
  const classTitle = `Roster Class ${runId}`;
  const classSession = await makeClass(classTitle, 5);

  const member = async (classSessionId: string, key: string, name: string | null, status: Status, withEmail = true) => {
    const email = withEmail ? `${key}.${"m".repeat(40)}-${runId}@${testEmailDomain}` : null;
    if (email) createdEmails.push(email);
    const user = await prisma.user.create({ data: { email, name }, select: { id: true } });
    createdUserIds.push(user.id);
    const enrollment = await prisma.enrollment.create({ data: { classSessionId, userId: user.id, status, consentedAt: new Date() }, select: { id: true } });
    return { email, name, enrollmentId: enrollment.id };
  };
  const alice = await member(classSession.id, "alice", `Alice ${runId}`, "confirmed");
  const bob = await member(classSession.id, "bob", `Bob ${runId}`, "confirmed");
  const carol = await member(classSession.id, "carol", `Carol ${runId}`, "pending");
  await member(classSession.id, "dave", `Dave ${runId}`, "cancelled");
  const erin = await member(classSession.id, "erin", `Erin ${runId}`, "attended");
  const nora = await member(classSession.id, "nora", `Nora ${runId}`, "no_show");
  const anonymous = await member(classSession.id, "anon", null, "confirmed");
  await member(classSession.id, "nomail", `NoMail ${runId}`, "confirmed", false);

  await addAuthSessionCookie(context, (await createUserSession({ email: adminEmail, isAdmin: true })).sessionToken);

  // 從課程列表（帶搜尋）進入，之後的名單操作都不能弄丟這個返回脈絡。
  await page.goto(`/admin/classes?q=${encodeURIComponent(classTitle)}`);
  await page.getByRole("link").filter({ has: page.getByRole("heading", { name: classTitle, exact: true }) }).click();
  const roster = page.getByRole("region", { name: /報名名單/ });
  const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
  const tab = (name: string) => roster.getByRole("navigation", { name: "報名狀態篩選" }).getByRole("link", { name, exact: true });
  const row = (text: string) => roster.locator("li", { hasText: text });
  const searchbox = roster.getByRole("searchbox", { name: "搜尋學員" });

  // 姓名＋email；缺姓名／缺 email 有 fallback；已出席／未出席清楚標示、沒有操作。
  await expect(roster.getByText(alice.email!, { exact: true })).toBeVisible();
  await expect(roster.getByText(`Alice ${runId}`, { exact: true })).toBeVisible();
  await expect(row(erin.email!)).toContainText("已出席");
  await expect(row(nora.email!)).toContainText("未出席");
  for (const historic of [erin.email!, nora.email!]) await expect(row(historic).getByRole("button")).toHaveCount(0);
  await expect(row(anonymous.email!)).toContainText("未填姓名");
  await expect(row(`NoMail ${runId}`)).toContainText("未提供 email");
  for (const name of ["全部・8", "待老師確認・1", "已報名・4", "已取消・1"]) await expect(tab(name)).toBeVisible();
  await expect(header).toContainText("已報名 4 人・待老師確認 1 人・名額佔用 5／10");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `.ai-runs/admin-usability/${testInfo.project.name}-roster.png`, fullPage: true });

  // email 片段搜尋（鍵盤 Enter 送出）：分類數量只算搜尋結果，上方摘要仍是完整名單。
  await searchbox.fill("alice.");
  await searchbox.press("Enter");
  await expect(roster.getByText("搜尋結果：1 筆", { exact: true })).toBeVisible();
  for (const name of ["全部・1", "待老師確認・0", "已報名・1", "已取消・0"]) await expect(tab(name)).toBeVisible();
  await expect(header).toContainText("已報名 4 人・待老師確認 1 人・名額佔用 5／10");
  // 搜尋時，整堂取消的影響數仍是完整名單（pending＋confirmed）。
  await page.getByRole("button", { name: "取消課程", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("目前 5 筆報名（含待老師確認）會一併取消");
  await page.getByRole("dialog").getByRole("button", { name: "返回" }).click();

  // 姓名搜尋＋待老師確認分類 → 全程用鍵盤取消 pending 報名。
  await searchbox.fill("Carol");
  await searchbox.press("Enter");
  await tab("待老師確認・1").click();
  await expect(page).toHaveURL((url) => url.searchParams.get("rq") === "Carol" && url.searchParams.get("rstatus") === "pending" && url.searchParams.has("returnTo"));
  await roster.getByRole("button", { name: "取消這筆報名" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: `確定要取消「Carol ${runId}」的報名嗎？` });
  await expect(dialog).toContainText("這筆報名還在等老師確認");
  await expect(dialog).toContainText("同一位學員也不能再報名這堂課");
  await dialog.getByRole("button", { name: "確認取消報名" }).focus();
  await page.keyboard.press("Enter");

  // 留在同一份名單、保留搜尋、分類與返回脈絡；網址只有通用文字與 id，學員名稱由頁面補上。
  await expect(page).toHaveURL((url) => url.pathname === `/admin/classes/${classSession.id}` && url.searchParams.get("rq") === "Carol" && url.searchParams.get("rstatus") === "pending" && url.searchParams.has("returnTo") && url.searchParams.get("result") === "success" && url.searchParams.get("item") === carol.enrollmentId);
  expect(new URL(page.url()).searchParams.get("message")).toBe("已取消這筆報名，同一位學員不能再報名這堂課。");
  await expect(page.getByText(`已取消「Carol ${runId}」的報名，同一位學員不能再報名這堂課。`)).toBeVisible();
  await expect(roster.getByText("這個分類沒有符合搜尋條件的學員。")).toBeVisible();
  await expect(searchbox).toHaveValue("Carol");
  await page.getByRole("link", { name: `查看這筆（Carol ${runId}・已取消）` }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("rstatus") === "cancelled" && url.searchParams.get("rq") === "Carol" && url.hash === `#enrollment-${carol.enrollmentId}`);
  await expect(row(carol.email!)).toContainText("已取消");
  await expect(row(carol.email!).getByRole("button")).toHaveCount(0);
  await expect(header).toContainText("已報名 4 人・待老師確認 0 人・名額佔用 4／10");

  const returnTo = new URL(page.url()).searchParams.get("returnTo")!;
  const rosterUrl = (rq: string, rstatus: string) => `/admin/classes/${classSession.id}?returnTo=${encodeURIComponent(returnTo)}&rstatus=${rstatus}&rq=${encodeURIComponent(rq)}`;

  // 資格已變（背後已被取消）：失敗留在同一份名單、保留條件，該筆不再提供取消。
  await page.goto(rosterUrl("Bob", "confirmed"));
  await prisma.enrollment.update({ where: { id: bob.enrollmentId }, data: { status: "cancelled" } });
  await roster.getByRole("button", { name: "取消這筆報名" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "確認取消報名" }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("result") === "error" && url.searchParams.get("rq") === "Bob" && url.searchParams.get("rstatus") === "confirmed" && url.searchParams.get("item") === bob.enrollmentId);
  await expect(page.getByText(new RegExp(`^「Bob ${runId}」的報名沒有取消：.*畫面已更新為目前狀態，請確認後再操作。`))).toBeVisible();
  await expect(roster.getByText("這個分類沒有符合搜尋條件的學員。")).toBeVisible();

  // 竄改 enrollmentId 成 email：失敗，但網址不會出現 email，也不帶 item。
  await page.goto(rosterUrl("Alice", "confirmed"));
  await row(alice.email!).locator('input[name="enrollmentId"]').evaluate((el: HTMLInputElement, value) => { el.value = value; }, alice.email!);
  await roster.getByRole("button", { name: "取消這筆報名" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "確認取消報名" }).click();
  await expect(page.getByText(/^這筆報名沒有取消：/)).toBeVisible();
  expect(decodeURIComponent(page.url())).not.toContain("@");
  expect(new URL(page.url()).searchParams.has("item")).toBe(false);
  // 重試（沒有竄改）成功，仍在同一份名單。
  await roster.getByRole("button", { name: "取消這筆報名" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "確認取消報名" }).click();
  await expect(page.getByText(`已取消「Alice ${runId}」的報名，同一位學員不能再報名這堂課。`)).toBeVisible();

  // 沒有姓名的學員：頁面上用 email 辨識，但網址裡不能有 email。
  await page.goto(rosterUrl("anon.", "confirmed"));
  await roster.getByRole("button", { name: "取消這筆報名" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "確認取消報名" }).click();
  await expect(page.getByText(`已取消「${anonymous.email}」的報名，同一位學員不能再報名這堂課。`)).toBeVisible();
  expect(decodeURIComponent(page.url())).not.toContain("@");

  // 整堂取消失敗（背後已被取消）：留在同一課程並保留名單條件。
  await page.goto(rosterUrl("NoMail", "confirmed"));
  await prisma.classSession.update({ where: { id: classSession.id }, data: { status: "cancelled" } });
  await page.getByRole("button", { name: "取消課程", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "確認取消課程" }).click();
  await expect(page).toHaveURL((url) => url.pathname === `/admin/classes/${classSession.id}` && url.searchParams.get("result") === "error" && url.searchParams.get("rq") === "NoMail" && url.searchParams.get("rstatus") === "confirmed" && url.searchParams.has("returnTo"));
  await expect(page.getByText(/^課程沒有取消：/)).toBeVisible();

  // 回課程列表仍保留原本的搜尋；不合法的分類安全回到「全部」。
  await page.getByRole("link", { name: "← 回課程列表" }).click();
  await expect(page.getByRole("searchbox", { name: "搜尋課程" })).toHaveValue(classTitle);
  await page.goto(`/admin/classes/${classSession.id}?rstatus=bogus`);
  await expect(tab("全部・8")).toHaveAttribute("aria-current", "page");
  // 重複的網址參數（Next 會給陣列）：頁面正常顯示，條件安全回退，不顯示結果提示。
  const repeated = await page.goto(`/admin/classes/${classSession.id}?result=success&result=error&message=a&message=b&item=${carol.enrollmentId}&item=${alice.enrollmentId}&rq=a&rq=b&rstatus=pending&rstatus=confirmed&returnTo=/admin/classes&returnTo=/admin/teachers`);
  expect(repeated?.status()).toBe(200);
  await expect(tab("全部・8")).toHaveAttribute("aria-current", "page");
  await expect(searchbox).toHaveValue("");
  await expect(page.getByRole("link", { name: "← 回課程列表" })).toHaveAttribute("href", "/admin/classes");

  // 已開始的課程：待老師確認的報名不提供取消。
  const startedClass = await makeClass(`Started Class ${runId}`, -1);
  const late = await member(startedClass.id, "late", `Late ${runId}`, "pending");
  await page.goto(`/admin/classes/${startedClass.id}`);
  await expect(row(late.email!)).toContainText("待老師確認");
  await expect(row(late.email!).getByRole("button")).toHaveCount(0);

  // 非 admin：同一堂真的有名單的課程，詳情（含名單條件）一律 404。
  await context.clearCookies();
  const outsiderEmail = `outsider-${runId}@${testEmailDomain}`;
  createdEmails.push(outsiderEmail);
  await addAuthSessionCookie(context, (await createUserSession({ email: outsiderEmail })).sessionToken);
  expect((await page.goto(`/admin/classes/${classSession.id}?rq=Alice&rstatus=confirmed`))?.status()).toBe(404);
});
