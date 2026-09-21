import type { DemandRequestApplicationInput } from "./validation";

export type DemandRequestFormInput = {
  title: string;
  serviceType: string;
  description: string;
  targetLevel: string;
  expectedParticipants: string;
  preferredAreas: string;
  isOnline: boolean;
  preferredTimeSlots: string;
  classLengthMinutes: string;
  frequency: string;
  preferredStartDate: string;
  budgetRange: string;
};

export function normalizeDemandRequestInput(
  input: DemandRequestFormInput,
): DemandRequestApplicationInput {
  return {
    title: normalizeOptionalString(input.title),
    serviceType: normalizeOptionalString(input.serviceType),
    description: normalizeOptionalString(input.description),
    targetLevel: normalizeOptionalString(input.targetLevel),
    expectedParticipants: normalizeOptionalNumber(input.expectedParticipants),
    // 2026-09-21 期望地點改為一筆自由輸入的地址／場地名稱，地址裡常有逗號，所以不再拆成多項。
    preferredAreas: normalizeSingleItemList(input.preferredAreas),
    isOnline: input.isOnline === true,
    preferredTimeSlots: normalizeStringList(input.preferredTimeSlots),
    classLengthMinutes: normalizeOptionalNumber(input.classLengthMinutes),
    frequency: normalizeOptionalString(input.frequency),
    preferredStartDate: normalizeOptionalDate(input.preferredStartDate),
    budgetRange: normalizeOptionalString(input.budgetRange),
  };
}

function normalizeOptionalString(value: string): string | null {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return trimmedValue;
}

function normalizeOptionalNumber(value: string): number | null {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
}

function normalizeSingleItemList(value: string): string[] {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? [trimmedValue] : [];
}

function normalizeStringList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeOptionalDate(value: string): Date | null {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  const parsedDate = new Date(trimmedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}
