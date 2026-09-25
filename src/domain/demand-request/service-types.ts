// D5/D6/D8: V1 受控清單，數值/文字皆為 PO 已確認之最終定案（非範例），須逐字採用。

// 2026-09-21 服務類型改版（docs/organizer-flow-redesign-plan.md 決策三）：團主多半不熟瑜伽
// 流派，改用「想要什麼樣的課」的目的分類，取代原本 7 個英文流派名稱。全站共用：需求、
// 老師開課、公開課程篩選都讀這一份。舊值由 migration 20260921155028_demand_online_flag_and_goal_service_types 對應轉換。
export const SERVICE_TYPES = [
  "放鬆紓壓",
  "伸展與身體保養",
  "流汗活力",
  "核心與體態",
  "冥想與呼吸",
  "特定對象與主題",
  "還不確定，請老師建議",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

// 2026-09-25 需求的服務類型改成多選：最多選 3 個；「還不確定」代表交給老師建議，不能跟其他選項並存。
export const MAX_SERVICE_TYPES = 3;
export const UNDECIDED_SERVICE_TYPE: ServiceType = "還不確定，請老師建議";

export const SERVICE_TYPE_DESCRIPTIONS: Record<ServiceType, string> = {
  放鬆紓壓: "節奏慢，適合下班後或壓力大的團體",
  伸展與身體保養: "改善久坐、肩頸僵硬，重視動作做對",
  流汗活力: "動作連貫、運動量大，適合有運動習慣的人",
  核心與體態: "強化核心肌群、改善體態",
  冥想與呼吸: "以靜心、呼吸練習為主，動作很少",
  特定對象與主題: "例如孕婦、親子、空中瑜伽，請在需求說明寫清楚",
  "還不確定，請老師建議": "讓老師依你們的對象提案",
};

// 每個服務類型對應到老師「擅長類型」的哪些項目，之後做媒合時使用（目前還沒有程式讀它）。
// 字串必須跟 src/app/teachers/join/_lib/application-fields.ts 的 SPECIALTY_GROUPS 逐字相同
// （包含那邊「瑜珈」的寫法），才對得上老師已存的資料。空陣列代表不限。
export const SERVICE_TYPE_TEACHER_SPECIALTIES: Record<
  ServiceType,
  readonly string[]
> = {
  放鬆紓壓: ["哈達瑜伽", "陰瑜珈", "修復瑜珈"],
  伸展與身體保養: ["哈達瑜伽", "艾揚格瑜珈", "療癒瑜珈／身體正位", "寰宇瑜珈"],
  流汗活力: ["流瑜珈", "阿斯坦加瑜珈", "力量瑜珈", "熱瑜珈", "火箭瑜珈"],
  核心與體態: ["皮拉提斯瑜珈", "力量瑜珈"],
  冥想與呼吸: ["正念冥想與呼吸法", "昆達里尼瑜伽"],
  特定對象與主題: ["孕婦瑜珈", "空中瑜珈", "壁繩瑜珈", "倒立與後彎特訓"],
  "還不確定，請老師建議": [],
};

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

// 顯示用：需求的服務類型清單。舊資料若只有 serviceType（沒有 serviceTypes），退回用它。
export function getDemandServiceTypes(demand: {
  serviceType: string | null;
  serviceTypes: string[];
}): string[] {
  if (demand.serviceTypes.length > 0) {
    return demand.serviceTypes;
  }

  return demand.serviceType ? [demand.serviceType] : [];
}
