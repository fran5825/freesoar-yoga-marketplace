import { expect, test } from "@playwright/test";

import { notifyUsers } from "../../src/domain/notification/create";
import { buildNotificationCopy } from "../../src/domain/notification/copy";
import { readEmailConfig, type EmailConfig } from "../../src/domain/notification/email-config";
import { renderNotificationEmail } from "../../src/domain/notification/email-copy";
import { EMAIL_POLICY } from "../../src/domain/notification/email-policy";
import { createResendTransport, type EmailMessage } from "../../src/domain/notification/email-transport";
import { inAppNotificationSender } from "../../src/domain/notification/sender";
import { normalizeForEmail, prisma } from "./_helpers/organizer-demand-fixtures";

// transactional-email：寄送規則、設定、版型、逾時與 notifyUsers 的 email 分流。全部用假的寄信出口，不連網路。
// 這些測試不開頁面，只在 desktop project 跑一次。
const testEmailDomain = "transactional-email-smoke.local";
const createdUserIds: string[] = [];

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "node-only checks run once");
});

test.afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

async function seedUser(label: string, testInfo: { workerIndex: number }, withEmail = true) {
  const email = `${label}-${normalizeForEmail(`${testInfo.workerIndex}-${Date.now()}-${Math.random()}`)}@${testEmailDomain}`;
  const user = await prisma.user.create({ data: { email: withEmail ? email : null, name: label } });
  createdUserIds.push(user.id);
  return { id: user.id, email };
}

function enabledConfig(allowed: string[], mode: "allowlist" | "live" = "allowlist"): EmailConfig {
  return {
    status: "enabled",
    mode,
    apiKey: "test-key",
    from: "飛索 <notifications@test.local>",
    baseUrl: "https://app.test",
    allowedRecipients: new Set(allowed),
    timeoutMs: 1_000,
  };
}

function recordingTransport() {
  const sent: EmailMessage[] = [];
  return { sent, transport: async (message: EmailMessage) => void sent.push(message) };
}

async function rowsFor(userId: string) {
  return prisma.notification.findMany({ where: { userId }, select: { id: true, channel: true, status: true }, orderBy: { channel: "asc" } });
}

test.describe("email policy", () => {
  test("covers every notification type with exactly the approved roles, and every allowed pair has copy", () => {
    expect(EMAIL_POLICY).toEqual({
      teacher_application_submitted: ["self", "admin"],
      teacher_application_approved: ["self"],
      teacher_application_rejected: ["self"],
      teacher_profile_suspended: ["self"],
      teacher_profile_restored: ["self"],
      demand_request_submitted: ["self", "admin"],
      demand_request_published: ["self"],
      demand_request_rejected: ["self"],
      demand_request_cancelled: ["self", "affected_responder"],
      demand_response_submitted: ["counterpart", "admin"],
      demand_response_selected: ["self", "counterpart"],
      class_session_created: ["self", "counterpart"],
      class_session_changed: ["affected_member"],
      class_session_cancelled: ["self", "counterpart", "affected_member"],
      class_session_completed: ["affected_member"],
      enrollment_confirmed: ["self"],
      enrollment_pending_review: ["self", "counterpart"],
      enrollment_cancelled: ["self"],
      class_reminder_basic: [],
      review_submitted: ["counterpart"],
      class_proposal_invited: ["counterpart"],
      class_proposal_confirmed: ["counterpart"],
      class_proposal_declined: ["counterpart"],
      class_proposal_withdrawn: ["counterpart"],
      class_proposal_revised: ["counterpart"],
    });
    for (const [type, roles] of Object.entries(EMAIL_POLICY)) {
      for (const role of roles) {
        expect(() => buildNotificationCopy(type as keyof typeof EMAIL_POLICY, role, {})).not.toThrow();
      }
    }
  });
});

test.describe("email config", () => {
  const live = {
    EMAIL_DELIVERY_MODE: "live",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "飛索 <notifications@freesoar.test>",
    APP_BASE_URL: "https://freesoar.test",
  };

  test("defaults to disabled and fails closed on incomplete or unsafe settings", () => {
    expect(readEmailConfig({})).toEqual({ status: "disabled" });
    expect(readEmailConfig({ EMAIL_DELIVERY_MODE: "disabled", RESEND_API_KEY: "re_test" })).toEqual({ status: "disabled" });
    expect(readEmailConfig({ EMAIL_DELIVERY_MODE: "everyone" })).toMatchObject({ status: "invalid" });
    expect(readEmailConfig({ ...live, RESEND_API_KEY: "" })).toMatchObject({ status: "invalid", problems: ["RESEND_API_KEY"] });
    expect(readEmailConfig({ ...live, APP_BASE_URL: "http://localhost:3000" })).toMatchObject({ status: "invalid", problems: ["APP_BASE_URL"] });
    expect(readEmailConfig({ ...live, EMAIL_FROM: "not an address" })).toMatchObject({ status: "invalid", problems: ["EMAIL_FROM"] });
    expect(readEmailConfig({ ...live, EMAIL_TRANSPORT_TIMEOUT_MS: "60000" })).toMatchObject({ status: "invalid", problems: ["EMAIL_TRANSPORT_TIMEOUT_MS"] });
    expect(readEmailConfig({ ...live, EMAIL_DELIVERY_MODE: "allowlist" })).toMatchObject({ status: "invalid", problems: ["EMAIL_ALLOWED_RECIPIENTS"] });
  });

  test("accepts complete live and allowlist settings, normalizing the allowlist", () => {
    expect(readEmailConfig(live)).toMatchObject({ status: "enabled", mode: "live", baseUrl: "https://freesoar.test", timeoutMs: 5_000 });
    const allowlist = readEmailConfig({
      ...live,
      EMAIL_DELIVERY_MODE: "allowlist",
      APP_BASE_URL: "http://localhost:3000",
      EMAIL_ALLOWED_RECIPIENTS: " Owner@Example.com , tester@example.com",
    });
    expect(allowlist).toMatchObject({ status: "enabled", mode: "allowlist", baseUrl: "http://localhost:3000" });
    expect(allowlist.status === "enabled" && [...allowlist.allowedRecipients]).toEqual(["owner@example.com", "tester@example.com"]);
  });
});

test.describe("email rendering and transport", () => {
  test("escapes user text and keeps the subject on one line", () => {
    const email = renderNotificationEmail({
      title: "需求<b>已公開</b>\r\nBcc: x@y.z",
      body: "原因：<script>alert(1)</script>",
      cta: { href: "https://app.test/sign-in?callbackUrl=%2Forganizer%2Fdemands", label: "前往我的需求" },
    });
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain('href="https://app.test/sign-in?callbackUrl=%2Forganizer%2Fdemands"');
    expect(email.text).toContain("前往我的需求：https://app.test/sign-in?callbackUrl=%2Forganizer%2Fdemands");
  });

  test("aborts a request that never answers and reports provider errors without secrets", async () => {
    let aborted = false;
    const hanging = createResendTransport({
      apiKey: "re_secret",
      timeoutMs: 50,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
    });
    const message = { from: "a@test.local", to: "b@test.local", subject: "s", html: "h", text: "t", idempotencyKey: "notification-x" };
    await expect(hanging(message)).rejects.toThrow("timed out after 50ms");
    expect(aborted).toBe(true);

    let headers: Headers | undefined;
    const rejecting = createResendTransport({
      apiKey: "re_secret",
      timeoutMs: 1_000,
      fetchImpl: async (_url, init) => {
        headers = new Headers(init?.headers);
        return new Response(JSON.stringify({ name: "validation_error", message: "b@test.local is invalid" }), { status: 422 });
      },
    });
    const error = await rejecting(message).catch((caught: Error) => caught);
    expect(String(error)).toContain("resend responded 422 validation_error");
    expect(String(error)).not.toContain("re_secret");
    expect(String(error)).not.toContain("b@test.local");
    expect(headers?.get("Idempotency-Key")).toBe("notification-x");
  });
});

test.describe("notifyUsers email channel", () => {
  test("disabled mode keeps in-app only and never calls the transport", async ({}, testInfo) => {
    const user = await seedUser("disabled", testInfo);
    const { sent, transport } = recordingTransport();
    await notifyUsers("teacher_application_approved", [{ userId: user.id, role: "self" }], {}, inAppNotificationSender, {
      email: { config: { status: "disabled" }, transport },
    });
    expect(await rowsFor(user.id)).toEqual([expect.objectContaining({ channel: "in_app", status: "sent" })]);
    expect(sent).toHaveLength(0);
  });

  test("invalid config sends nothing and creates no email row", async ({}, testInfo) => {
    const user = await seedUser("invalid", testInfo);
    const { sent, transport } = recordingTransport();
    await notifyUsers("teacher_application_approved", [{ userId: user.id, role: "self" }], {}, inAppNotificationSender, {
      email: { config: { status: "invalid", mode: "live", problems: ["RESEND_API_KEY"] }, transport },
    });
    expect((await rowsFor(user.id)).map((row) => row.channel)).toEqual(["in_app"]);
    expect(sent).toHaveLength(0);
  });

  test("allowlist mode emails only listed recipients, with a sign-in link back to the target page", async ({}, testInfo) => {
    const listed = await seedUser("listed", testInfo);
    const other = await seedUser("other", testInfo);
    const { sent, transport } = recordingTransport();
    await notifyUsers(
      "teacher_application_approved",
      [
        { userId: listed.id, role: "self" },
        { userId: other.id, role: "self" },
      ],
      {},
      inAppNotificationSender,
      { email: { config: enabledConfig([listed.email.toLowerCase()]), transport } },
    );

    const listedRows = await rowsFor(listed.id);
    expect(listedRows).toEqual([
      expect.objectContaining({ channel: "email", status: "sent" }),
      expect.objectContaining({ channel: "in_app", status: "sent" }),
    ]);
    expect((await rowsFor(other.id)).map((row) => row.channel)).toEqual(["in_app"]);

    expect(sent).toHaveLength(1);
    const emailRow = listedRows.find((row) => row.channel === "email")!;
    expect(sent[0]).toMatchObject({
      to: listed.email.toLowerCase(),
      from: "飛索 <notifications@test.local>",
      idempotencyKey: `notification-${emailRow.id}`,
      subject: "老師申請已通過｜飛索",
    });
    // 沒有老師資料的收件人沒有對應頁面，退回通知列表。
    expect(sent[0].html).toContain("https://app.test/sign-in?callbackUrl=%2Fnotifications");
  });

  test("a failing transport marks the email failed and leaves in-app sent and later recipients delivered", async ({}, testInfo) => {
    const first = await seedUser("fail-first", testInfo);
    const second = await seedUser("fail-second", testInfo);
    let calls = 0;
    await notifyUsers(
      "teacher_application_approved",
      [
        { userId: first.id, role: "self" },
        { userId: second.id, role: "self" },
      ],
      {},
      inAppNotificationSender,
      {
        email: {
          config: enabledConfig([], "live"),
          transport: async () => {
            calls += 1;
            if (calls === 1) throw new Error("resend responded 500");
          },
        },
      },
    );
    expect(await rowsFor(first.id)).toEqual([
      expect.objectContaining({ channel: "email", status: "failed" }),
      expect.objectContaining({ channel: "in_app", status: "sent" }),
    ]);
    expect(await rowsFor(second.id)).toEqual([
      expect.objectContaining({ channel: "email", status: "sent" }),
      expect.objectContaining({ channel: "in_app", status: "sent" }),
    ]);
  });

  test("a retried event emails once, and a user without an email address is skipped", async ({}, testInfo) => {
    const user = await seedUser("retry", testInfo);
    const noEmail = await seedUser("no-email", testInfo, false);
    const { sent, transport } = recordingTransport();
    const options = { eventKeyBase: `transactional-email-retry-${user.id}`, email: { config: enabledConfig([], "live"), transport } };
    const recipients = [
      { userId: user.id, role: "self" as const },
      { userId: noEmail.id, role: "self" as const },
    ];
    await notifyUsers("teacher_application_approved", recipients, {}, inAppNotificationSender, options);
    await notifyUsers("teacher_application_approved", recipients, {}, inAppNotificationSender, options);

    expect((await rowsFor(user.id)).map((row) => row.channel)).toEqual(["email", "in_app"]);
    expect((await rowsFor(noEmail.id)).map((row) => row.channel)).toEqual(["in_app"]);
    expect(sent).toHaveLength(1);
  });
});
