// teacher-initiated-open-classes 第 7 節：接受一個已存在的 RecurringClassSeries 與一份
// Taipei 日曆日字串清單（"YYYY-MM-DD"），逐筆呼叫 createClassSessionForTeacher 建立獨立
// ClassSession row（G1 = A，materialize）。常規週期的日期本身在呼叫端用
// recurring-series-dates.ts 算好；固定期課程的日期清單則直接來自使用者輸入——這個函式不關心
// 兩者差異，只負責「逐筆建立 + 衝突跳過」。
//
// 刻意逐筆序列處理（不平行）：數量受 Gate G4 限制在個位數~數十場，序列處理讓「某一場衝突，
// 其餘照常生成」的邏輯單純、可預期，不需要額外的批次交易設計。若某一場撞到 conflict-check，
// 該場跳過並列在回傳結果的 skipped 裡，不讓整批生成因為一場衝突而全部失敗——但若失敗原因
// 不是衝突（理論上不該發生，因為呼叫者已經是 series 擁有者、series 已存在），視為非預期錯誤
// 直接中止整批，不悄悄吞掉。

import { prisma } from "@/lib/prisma";
import { createClassSessionForTeacher } from "./create-teacher-class-session-core";
import { parseTaipeiDatetimeLocal } from "../timezone";

export type OccurrenceSkip = { date: string; reason: "teacher_schedule_conflict" };

export type GenerateOccurrencesResult =
  | { ok: true; createdClassSessionIds: string[]; skipped: OccurrenceSkip[] }
  | { ok: false; code: "series_not_found" | "teacher_not_approved" };

export async function generateOccurrencesForSeries(
  teacherProfileId: string,
  recurringClassSeriesId: string,
  dates: string[],
): Promise<GenerateOccurrencesResult> {
  const series = await prisma.recurringClassSeries.findFirst({
    where: { id: recurringClassSeriesId, teacherProfileId },
    include: { teacherProfile: { select: { status: true } } },
  });

  if (!series) {
    return { ok: false, code: "series_not_found" };
  }

  // 資格檢查在這裡先做一次（比照單堂建課的既有慣例），失敗就整批不生成——避免下面的迴圈把
  // 「老師未通過審核」誤判成逐場的 unexpected error 而拋例外。跟單堂建課核心一致，這裡刻意
  // 不額外加鎖防護建立中途才變成 suspended 的極端競態（見 create-teacher-class-session-core.ts
  // 的同一份說明）。
  if (series.teacherProfile.status !== "approved") {
    return { ok: false, code: "teacher_not_approved" };
  }

  const createdClassSessionIds: string[] = [];
  const skipped: OccurrenceSkip[] = [];

  for (const date of dates) {
    const startAt = parseTaipeiDatetimeLocal(`${date}T${series.startTime}`);
    const endAt = parseTaipeiDatetimeLocal(`${date}T${series.endTime}`);

    // 理論上不會發生——startTime/endTime/日期格式都已經在建立 series（或固定期輸入）時
    // 驗證過——但防禦性地把它當成「這一場跳過」而不是讓整批中止，行為上跟衝突跳過一致。
    if (!startAt || !endAt) {
      skipped.push({ date, reason: "teacher_schedule_conflict" });
      continue;
    }

    const result = await createClassSessionForTeacher(teacherProfileId, {
      title: series.title,
      description: series.description,
      // RecurringClassSeries.serviceType 在 schema 上是 nullable（第 5 節資料模型），但
      // validateRecurringSeriesInput 把它列為必填，建立 series 時一律會寫入非 null 值，
      // 這裡讀回來只是型別上允許 null，實際上不會發生。
      serviceType: series.serviceType as string,
      startAt,
      endAt,
      location: series.location,
      capacity: series.capacity,
      // 老師自建課程的公開瀏覽（Slice D）與常規課程目前沒有交集：RecurringClassSeries
      // 資料模型（第 5 節，已 Codex 核准）沒有 isPublic 欄位，且 ClassSession 建立後無法
      // 事後修改可見性，因此這裡刻意保守預設為 false（私人），不擅自幫尚未核准的欄位做決定。
      isPublic: false,
      requiresApproval: series.requiresApproval,
      recurringClassSeriesId: series.id,
    });

    if (result.ok) {
      createdClassSessionIds.push(result.classSessionId);
    } else if (result.code === "teacher_schedule_conflict") {
      skipped.push({ date, reason: "teacher_schedule_conflict" });
    } else if (result.code === "teacher_not_approved") {
      // 極端競態：老師在迴圈執行中途被 suspend（上面的資格檢查是迴圈開始前的單次讀取，
      // 沒有加鎖）。已經成功生成的場次維持有效，不回溯撤銷，剩餘日期不再繼續生成。
      break;
    } else {
      throw new Error(
        `unexpected error generating occurrence for series ${recurringClassSeriesId} on ${date}: ${result.code}`,
      );
    }
  }

  return { ok: true, createdClassSessionIds, skipped };
}
