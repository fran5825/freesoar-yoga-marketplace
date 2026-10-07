"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  editOwnClassSessionForTeacher,
  editOwnSeriesFromOccurrenceForTeacher,
} from "@/domain/class-session/service";

import {
  buildCreateClassFieldErrors,
  type CreateClassFormState,
} from "../../new/_lib/form-state";
import { readServiceTypesFromForm, readYogaStylesFromForm } from "../../new/read-yoga-styles";

// teacher-class-scheduling 票 04：改課（單堂）。比照建立單堂的 action：失敗回傳結果給表單、留在原頁保留輸入；
// 成功才 redirect 回課程詳情頁。改課的所有檢查都在 domain 的鎖內完成，這裡只負責讀表單與回饋。
export async function editOwnClassSessionAction(
  _previousState: CreateClassFormState,
  formData: FormData,
): Promise<CreateClassFormState> {
  const classSessionId = readFormString(formData, "classSessionId");

  // 票 05：系列場次選「改這一場和之後所有場次」。
  if (readFormString(formData, "scope") === "following") {
    return editFollowingSessions(classSessionId, formData);
  }

  let result: Awaited<ReturnType<typeof editOwnClassSessionForTeacher>>;

  try {
    result = await editOwnClassSessionForTeacher(classSessionId, {
      title: readFormString(formData, "title"),
      description: readFormString(formData, "description"),
      // member-flow 票 03：系列場次「只改這一場」的表單不顯示這兩欄，沒送出就不帶，核心會保留原值。
      suitableFor: readOptionalFormString(formData, "suitableFor"),
      preparationNotes: readOptionalFormString(formData, "preparationNotes"),
      serviceTypes: readServiceTypesFromForm(formData),
      yogaStyles: readYogaStylesFromForm(formData),
      startAt: readFormString(formData, "startAt"),
      endAt: readFormString(formData, "endAt"),
      location: readFormString(formData, "location"),
      capacity: readFormNumber(formData, "capacity"),
      isPublic: formData.get("isPublic") === "yes",
    });
  } catch {
    // 改課是整筆覆寫、在同一個 transaction 內完成，失敗就是沒有寫入，可以直接再送一次。
    return {
      status: "error",
      mode: "single",
      code: "edit_failed",
      message: "儲存時發生問題，請稍後再試一次。",
      fieldErrors: {},
    };
  }

  if (!result.ok) {
    const fieldErrors = buildCreateClassFieldErrors(result.validationErrors);

    if (result.code === "teacher_schedule_conflict") {
      fieldErrors.time = [...(fieldErrors.time ?? []), result.message];
    }

    if (result.code === "capacity_below_enrolled") {
      fieldErrors.capacity = [...(fieldErrors.capacity ?? []), result.message];
    }

    return { status: "error", mode: "single", code: result.code, message: result.message, fieldErrors };
  }

  revalidatePath(`/teacher/classes/${classSessionId}`);
  revalidatePath("/teacher/classes");
  revalidatePath("/teacher/dashboard");

  const message =
    result.notifiedMemberCount > 0
      ? `課程已更新，已通知 ${result.notifiedMemberCount} 位已報名的學員。`
      : "課程已更新。";

  redirect(`/teacher/classes/${classSessionId}?result=success&message=${encodeURIComponent(message)}`);
}

async function editFollowingSessions(
  classSessionId: string,
  formData: FormData,
): Promise<CreateClassFormState> {
  const recurringClassSeriesId = readFormString(formData, "recurringClassSeriesId");
  // 表單送出的是「原本日期＋新時段」，這裡只取時段（每一場維持自己的日期）。
  const startTime = readFormString(formData, "startAt").split("T")[1] ?? "";
  const endTime = readFormString(formData, "endAt").split("T")[1] ?? "";
  let result: Awaited<ReturnType<typeof editOwnSeriesFromOccurrenceForTeacher>>;

  try {
    result = await editOwnSeriesFromOccurrenceForTeacher(recurringClassSeriesId, classSessionId, {
      title: readFormString(formData, "title"),
      description: readFormString(formData, "description"),
      serviceTypes: readServiceTypesFromForm(formData),
      yogaStyles: readYogaStylesFromForm(formData),
      startTime,
      endTime,
      location: readFormString(formData, "location"),
      capacity: readFormNumber(formData, "capacity"),
      isPublic: formData.get("isPublic") === "yes",
    });
  } catch {
    // 整批在同一個 transaction 內，失敗就是全部沒寫入，可以直接再送一次。
    return {
      status: "error",
      mode: "single",
      code: "edit_failed",
      message: "儲存時發生問題，這次沒有修改任何場次，請稍後再試一次。",
      fieldErrors: {},
    };
  }

  if (!result.ok) {
    const fieldErrors = buildCreateClassFieldErrors(result.validationErrors);

    if (result.code === "teacher_schedule_conflict") {
      fieldErrors.time = [...(fieldErrors.time ?? []), result.message];
    }

    if (result.code === "capacity_below_enrolled") {
      fieldErrors.capacity = [...(fieldErrors.capacity ?? []), result.message];
    }

    return { status: "error", mode: "single", code: result.code, message: result.message, fieldErrors };
  }

  revalidatePath(`/teacher/classes/series/${recurringClassSeriesId}`);
  revalidatePath("/teacher/classes");
  revalidatePath("/teacher/dashboard");

  const message =
    result.notifiedMemberCount > 0
      ? `已更新 ${result.updatedCount} 場與系列設定，已通知 ${result.notifiedMemberCount} 位已報名的學員。`
      : `已更新 ${result.updatedCount} 場與系列設定。`;

  redirect(
    `/teacher/classes/series/${recurringClassSeriesId}?result=success&message=${encodeURIComponent(message)}`,
  );
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function readOptionalFormString(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);

  return typeof value === "string" ? value : undefined;
}

function readFormNumber(formData: FormData, name: string): number | null {
  const value = formData.get(name);

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}
