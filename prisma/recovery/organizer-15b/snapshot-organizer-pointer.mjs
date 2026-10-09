// 票 15b R1：套用 migration 前保存每位團主的 legacy pointer（只有 id，沒有個資）。
// 用法：node prisma/recovery/organizer-15b/snapshot-organizer-pointer.mjs <輸出檔>
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const out = process.argv[2];
if (!out) throw new Error("需要輸出檔路徑");

const prisma = new PrismaClient();
try {
  const [{ db }] = await prisma.$queryRawUnsafe(`select current_database() as db`);
  const rows = await prisma.$queryRawUnsafe(
    `select "id", "organizationId" from "OrganizerProfile" order by "id"`,
  );
  writeFileSync(out, JSON.stringify({ database: db, takenAt: new Date().toISOString(), rows }, null, 2));
  const withPointer = rows.filter((row) => row.organizationId !== null).length;
  console.log(`snapshot ${db}: ${rows.length} profiles, ${withPointer} with pointer -> ${out}`);
} finally {
  await prisma.$disconnect();
}
