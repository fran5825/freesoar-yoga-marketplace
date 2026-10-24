"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createOwnClassSessionForTeacher, OPENED_FOR_ENROLLMENT_MESSAGE } from "@/domain/class-session/service";

import { appendWarning, applyCoverFromForm } from "../_lib/apply-cover";
import { buildCreateClassFieldErrors, type CreateClassFormState } from "./_lib/form-state";
import { readServiceTypesFromForm, readYogaStylesFromForm } from "./read-yoga-styles";

// teacher-usability-redesign 票 01：失敗時回傳結果給表單（useActionState），表單留在原頁、保留輸入；
// 成功才 redirect。redirect 放在任何 try/catch 之外，domain service 與寫入規則不變。
export async function createOwnClassSessionAction(
  _previousState: CreateClassFormState,
  formData: FormData,
): Promise<CreateClassFormState> {
  let result: Awaited<ReturnType<typeof createOwnClassSessionForTeacher>>;

  try {
    result = await createOwnClassSessionForTeacher({
    title: readFormString(formData, "title"),
    description: readFormString(formData, "description"),
    suitableFor: readFormString(formData, "suitableFor"),
    preparationNotes: readFormString(formData, "preparationNotes"),
    priceNote: readFormString(formData, "priceNote"),
    serviceTypes: readServiceTypesFromForm(formData),
    yogaStyles: readYogaStylesFromForm(formData),
    startAt: readFormString(formData, "startAt"),
    endAt: readFormString(formData, "endAt"),
    location: readFormString(formData, "location"),
    capacity: readFormNumber(formData, "capacity"),
    isPublic: formData.get("isPublic") === "yes",
    requiresApproval: formData.get("requiresApproval") === "yes",
    openForEnrollment: formData.get("openForEnrollment") === "yes",
    });
  } catch {
    // 伺服器處理到一半出錯：不知道有沒有寫入，不能讓使用者直接重送。
    return { status: "error", mode: "single", code: "result_unknown", message: RESULT_UNKNOWN_MESSAGE, fieldErrors: {} };
  }

  if (!result.ok) {
    const fieldErrors = buildCreateClassFieldErrors(result.validationErrors);

    // 時段衝突沒有 validationErrors，錯誤說明直接放在時間欄位旁邊。
    if (result.code === "teacher_schedule_conflict") {
      fieldErrors.time = [...(fieldErrors.time ?? []), result.message];
    }

    return {
      status: "error",
      mode: "single",
      code: result.code,
      message: result.message,
      fieldErrors,
    };
  }

  // teacher-showcase-photos 票 04：課程先照原流程建好，封面是之後的獨立一步；失敗只補一句說明。
  const coverWarning = await applyCoverFromForm(formData, { kind: "session", id: result.classSessionId });

  revalidatePath("/teacher/classes");
  revalidatePath("/teacher/dashboard");
  // teacher-usability 第 07 票：建好直接進這堂課的詳情頁。
  // teacher-first-run 票 02：課程只要寫入了就一律導到詳情頁，不回到表單——表單上的「還沒建立」與
  // 重送按鈕只適用寫入前的錯誤。直接開放失敗時課程留在草稿，詳情頁說明原因，「開放報名」按鈕就在那裡可重試。
  const feedback =
    result.openOutcome === "opened"
      ? { kind: "success", message: OPENED_FOR_ENROLLMENT_MESSAGE }
      : result.openOutcome === "failed"
        ? { kind: "error", message: result.openFailureMessage }
        : { kind: "success", message: "課程已建立。下一步：確認內容後按「開放報名」。" };

  redirect(
    `/teacher/classes/${result.classSessionId}?result=${feedback.kind}&message=${encodeURIComponent(
      appendWarning(feedback.message, coverWarning),
    )}`,
  );
}

const RESULT_UNKNOWN_MESSAGE =
  "建立結果無法確認：可能已經建立，也可能沒有。";

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
