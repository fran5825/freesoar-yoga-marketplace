import {
  CAPACITY_MAX,
  CAPACITY_MIN,
  DESCRIPTION_MAX_LENGTH,
  LOCATION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "@/domain/class-session/validation";
import { parseTaipeiDatetimeLocal } from "@/domain/class-session/timezone";
import { isValidServiceType, MAX_SERVICE_TYPES } from "@/domain/demand-request/service-types";

// organizer-usability-redesign 票 05（spec 13.2）：合作邀請草稿的有界驗證。
// 草稿可以部分空白，但填了的欄位必須在範圍內；送出時另用 validateClassSessionCreate 檢查完整度。

export type ProposalFormInput = {
  organizationId: string;
  teacherProfileId: string | null;
  title: string;
  description: string;
  serviceTypes: string[];
  // <input type="datetime-local"> 的 Asia/Taipei 字串（YYYY-MM-DDTHH:mm），可留空
  startAt: string;
  endAt: string;
  location: string;
  capacity: string;
  isPublic: boolean;
};

export type ProposalDraftField =
  | "title"
  | "description"
  | "serviceTypes"
  | "startAt"
  | "endAt"
  | "location"
  | "capacity";

export type ProposalValidationError = {
  field: ProposalDraftField | "teacherProfileId";
  message: string;
};

export type NormalizedProposalDraft = {
  title: string | null;
  description: string | null;
  serviceType: string | null;
  serviceTypes: string[];
  startAt: Date | null;
  endAt: Date | null;
  location: string | null;
  capacity: number | null;
  isPublic: boolean;
};

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateProposalDraft(
  input: ProposalFormInput,
):
  | { valid: true; normalized: NormalizedProposalDraft }
  | { valid: false; errors: ProposalValidationError[] } {
  const errors: ProposalValidationError[] = [];
  const title = optionalText(input.title);
  const description = optionalText(input.description);
  const location = optionalText(input.location);
  const serviceTypes = Array.from(new Set(input.serviceTypes.map((value) => value.trim()).filter(Boolean)));

  if (title && title.length > TITLE_MAX_LENGTH) {
    errors.push({ field: "title", message: `課程名稱不可超過 ${TITLE_MAX_LENGTH} 個字。` });
  }
  if (description && description.length > DESCRIPTION_MAX_LENGTH) {
    errors.push({ field: "description", message: `課程說明不可超過 ${DESCRIPTION_MAX_LENGTH} 個字。` });
  }
  if (location && location.length > LOCATION_MAX_LENGTH) {
    errors.push({ field: "location", message: `地點不可超過 ${LOCATION_MAX_LENGTH} 個字。` });
  }
  if (serviceTypes.length > MAX_SERVICE_TYPES) {
    errors.push({ field: "serviceTypes", message: `課程風格最多選 ${MAX_SERVICE_TYPES} 項。` });
  } else if (!serviceTypes.every((value) => isValidServiceType(value))) {
    errors.push({ field: "serviceTypes", message: "課程風格須從受控清單中選擇。" });
  }

  let capacity: number | null = null;
  const capacityText = input.capacity.trim();
  if (capacityText.length > 0) {
    if (!/^\d+$/.test(capacityText)) {
      errors.push({ field: "capacity", message: "名額需為整數。" });
    } else {
      capacity = Number(capacityText);
      if (capacity < CAPACITY_MIN || capacity > CAPACITY_MAX) {
        errors.push({ field: "capacity", message: `名額需介於 ${CAPACITY_MIN}–${CAPACITY_MAX} 人之間。` });
      }
    }
  }

  let startAt: Date | null = null;
  if (input.startAt.trim().length > 0) {
    startAt = parseTaipeiDatetimeLocal(input.startAt);
    if (!startAt) {
      errors.push({ field: "startAt", message: "開始時間格式不正確。" });
    }
  }
  let endAt: Date | null = null;
  if (input.endAt.trim().length > 0) {
    endAt = parseTaipeiDatetimeLocal(input.endAt);
    if (!endAt) {
      errors.push({ field: "endAt", message: "結束時間格式不正確。" });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    normalized: {
      title,
      description,
      serviceType: serviceTypes[0] ?? null,
      serviceTypes,
      startAt,
      endAt,
      location,
      capacity,
      isPublic: input.isPublic,
    },
  };
}
