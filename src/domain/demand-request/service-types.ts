// D5/D6/D8: V1 受控清單，數值/文字皆為 PO 已確認之最終定案（非範例），須逐字採用。

export const SERVICE_TYPES = [
  "Hatha Yoga",
  "Yin Yoga",
  "Stretch Yoga",
  "Breathwork",
  "Corporate Relaxation Yoga",
  "Beginner Yoga",
  "Parent-child Yoga",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const PREFERRED_TIME_SLOTS = [
  "平日早上",
  "平日午間",
  "平日晚上",
  "週末早上",
  "週末午間",
  "週末晚上",
] as const;

export type PreferredTimeSlot = (typeof PREFERRED_TIME_SLOTS)[number];

export const FREQUENCIES = ["single", "weekly", "biweekly", "monthly"] as const;

export type Frequency = (typeof FREQUENCIES)[number];

export const TARGET_LEVELS = ["beginner", "general", "advanced", "mixed"] as const;

export type TargetLevel = (typeof TARGET_LEVELS)[number];

export function isValidServiceType(value: string): value is ServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(value);
}

export function isValidPreferredTimeSlot(
  value: string,
): value is PreferredTimeSlot {
  return (PREFERRED_TIME_SLOTS as readonly string[]).includes(value);
}

export function isValidFrequency(value: string): value is Frequency {
  return (FREQUENCIES as readonly string[]).includes(value);
}

export function isValidTargetLevel(value: string): value is TargetLevel {
  return (TARGET_LEVELS as readonly string[]).includes(value);
}
