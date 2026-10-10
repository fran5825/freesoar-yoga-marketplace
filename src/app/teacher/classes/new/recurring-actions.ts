"use server";

import { redirect } from "next/navigation";

import { createOwnRecurringClassSeriesForTeacher } from "@/domain/class-session/service";
import type { RecurringSeriesInput } from "@/domain/class-session/recurring-series-validation";

import { buildCreateClassFieldErrors, type CreateClassFormState } from "./_lib/form-state";
import { readServiceTypesFromForm, readYogaStylesFromForm } from "./read-yoga-styles";

// teacher-initiated-open-classes Slice B：常規（每週固定星期）／固定期（明確日期清單）
// 課程系列建立，mode 由前端的兩個獨立表單各自帶入固定值。
// teacher-usability-redesign 票 02：失敗時回傳結果給表單（useActionState），留在原頁、保留全部場次輸入；
// 成功才 redirect（不放在 try/catch 裡）。domain service 與生成規則不變。
export async function createOwnRecurringClassSeriesAction(
  _previousState: CreateClassFormState,
  formData: FormData,
): Promise<CreateClassFormState> {
  const mode = readFormString(formData, "mode");

  const input: RecurringSeriesInput = {
    title: readFormString(formData, "title"),
    description: readFormString(formData, "description"),
    suitableFor: readFormString(formData, "suitableFor"),
    preparationNotes: readFormString(formData, "preparationNotes"),
    priceNote: readFormString(formData, "priceNote"),
    serviceTypes: readServiceTypesFromForm(formData),
    yogaStyles: readYogaStylesFromForm(formData),
    startTime: readFormString(formData, "startTime"),
    endTime: readFormString(formData, "endTime"),
    location: readFormString(formData, "location"),
    capacity: readFormNumber(formData, "capacity"),
    requiresApproval: formData.get("requiresApproval") === "yes",
    isPublic: formData.get("isPublic") === "yes",
    mode,
    // 票 07：每週固定才送型態；指定日期在 domain 一律視為期班。
    seriesKind: mode === "weekly" ? readFormString(formData, "seriesKind") : undefined,
    termEnrollmentMode: readFormString(formData, "termEnrollmentMode"),
    dayOfWeek: mode === "weekly" ? readFormNumber(formData, "dayOfWeek") : undefined,
    generateCount: mode === "weekly" ? readFormNumber(formData, "generateCount") : undefined,
    startDate: mode === "weekly" ? readFormString(formData, "startDate") : undefined,
    dates:
      mode === "fixed_dates"
        ? readFormString(formData, "dates")
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
        : undefined,
  };

  let result: Awaited<ReturnType<typeof createOwnRecurringClassSeriesForTeacher>>;

  try {
    result = await createOwnRecurringClassSeriesForTeacher(input, {
      openForEnrollment: formData.get("openForEnrollment") === "yes",
    });
  } catch {
    // 系列可能已建立、場次生成到一半出錯：結果不確定，不能讓使用者直接重送。
    return {
      status: "error",
      mode: mode === "fixed_dates" ? "fixed_dates" : "weekly",
      code: "result_unknown",
      message: "建立結果無法確認：系列可能已經建立，也可能沒有。",
      fieldErrors: {},
    };
  }

  if (!result.ok) {
    return {
      status: "error",
      mode: mode === "fixed_dates" ? "fixed_dates" : "weekly",
      code: result.code,
      message: result.message,
      fieldErrors: buildCreateClassFieldErrors(result.validationErrors),
    };
  }

  redirect(
    `/teacher/classes/series/${result.recurringClassSeriesId}?result=success&message=${encodeURIComponent(
      buildCreatedMessage(
        result.createdClassSessionIds.length,
        result.skipped,
        formData.get("openForEnrollment") === "yes",
        mode === "fixed_dates" || readFormString(formData, "seriesKind") === "term",
      ),
    )}`,
  );
}

// 草稿可以在系列頁一次全部開放報名（teacher-class-scheduling 票 01）；公開與否依系列設定（票 06）。
const DRAFT_NEXT_STEP_MESSAGE = "每一場目前都是草稿，確認沒問題後按「全部開放報名」。";
const OPENED_NEXT_STEP_MESSAGE = "每一場都已開放報名，可以複製報名連結傳給學員。";

function buildCreatedMessage(
  createdCount: number,
  skipped: { date: string }[],
  openedForEnrollment: boolean,
  isTerm: boolean,
): string {
  const nextStep = openedForEnrollment ? OPENED_NEXT_STEP_MESSAGE : DRAFT_NEXT_STEP_MESSAGE;
  // 票 07：期班的摘要寫實際堂數（撞課跳過的不算）。
  const created = isTerm ? `期班已建立，共 ${createdCount} 堂` : `課程系列已建立，共生成 ${createdCount} 場`;

  if (skipped.length === 0) {
    return `${created}。${nextStep}`;
  }

  const skippedDates = skipped.map((occurrence) => occurrence.date).join("、");

  return `${created}；以下日期因時段衝突未生成：${skippedDates}。${nextStep}`;
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function readFormNumber(formData: FormData, name: string): number | null {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}
