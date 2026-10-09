// 票 15b R1：從快照把 OrganizerProfile.organizationId 加回並逐筆寫回原值。
// 用法：node prisma/recovery/organizer-15b/restore-organizer-pointer.mjs <快照檔>
// 只回復資料庫結構與值；之後還要 git revert 15b 的 commit（schema 與程式），並另外處理 _prisma_migrations 紀錄。
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const file = process.argv[2];
if (!file) throw new Error("需要快照檔路徑");
const snapshot = JSON.parse(readFileSync(file, "utf8"));

const prisma = new PrismaClient();
try {
  const [{ db }] = await prisma.$queryRawUnsafe(`select current_database() as db`);
  if (db !== snapshot.database) throw new Error(`快照來自 ${snapshot.database}，目前連到 ${db}，停止`);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`ALTER TABLE "OrganizerProfile" ADD COLUMN IF NOT EXISTS "organizationId" TEXT`);
    await tx.$executeRawUnsafe(`ALTER TABLE "OrganizerProfile" DROP CONSTRAINT IF EXISTS "OrganizerProfile_organizationId_fkey"`);
    await tx.$executeRawUnsafe(
      `ALTER TABLE "OrganizerProfile" ADD CONSTRAINT "OrganizerProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    for (const row of snapshot.rows) {
      if (row.organizationId === null) continue;
      // 團體若在快照後被刪除，FK 會讓這筆失敗；寧可整批停下，也不寫入無效值。
      await tx.$executeRawUnsafe(
        `UPDATE "OrganizerProfile" SET "organizationId" = $1 WHERE "id" = $2`,
        row.organizationId,
        row.id,
      );
    }
  });

  const rows = await prisma.$queryRawUnsafe(`select "id", "organizationId" from "OrganizerProfile" order by "id"`);
  const now = new Map(rows.map((row) => [row.id, row.organizationId]));
  const mismatched = snapshot.rows.filter((row) => now.has(row.id) && now.get(row.id) !== row.organizationId).length;
  const missing = snapshot.rows.filter((row) => !now.has(row.id)).length;
  console.log(`restore ${db}: ${snapshot.rows.length} in snapshot, mismatched=${mismatched}, profiles gone since snapshot=${missing}`);
  if (mismatched > 0) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
