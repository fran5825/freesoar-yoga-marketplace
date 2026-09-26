// teacher-join-gated-application Slice 1：純資料定義，刻意不含 "use client"——讓未登入訪客
// 看到的唯讀預覽（_components/TeacherJoinExplainer.tsx）跟登入後的互動表單
// （_components/TeacherApplicationForm.tsx）共用同一份欄位定義來源，不維護兩份容易漏改其中
//一份的清單，也不強迫純靜態的訪客內容變成不必要的 Client Component。

export type FormFieldName =
  | "displayName"
  | "bio"
  | "teachingStyle"
  | "experienceYears"
  | "certifications"
  | "specialties"
  | "serviceAreas"
  | "teachingFormats"
  | "priceRange"
  | "profilePhotoUrl"
  | "preferredSessionLengthMinutes"
  | "preferredFrequency"
  | "preferredLocationType"
  | "preferenceNotes";

export type OptionItem = { value: string; label: string };
export type OptionGroup = { title: string; options: OptionItem[] };

type BaseField = {
  name: FormFieldName;
  label: string;
  requirement: "submitRequired" | "optionalRecommended";
  helper: string;
};

export type TextInputField = BaseField & {
  kind: "text";
  placeholder: string;
  inputMode?: "numeric" | "url";
};

export type TextareaField = BaseField & {
  kind: "textarea";
  placeholder: string;
  // 參考寫法：顯示在欄位上方，降低「不知道寫什麼」的卡關感；不會自動填入欄位。
  example?: string;
};

export type SelectField = BaseField & {
  kind: "select";
  options: OptionItem[];
};

export type CheckboxGroupField = BaseField & {
  kind: "checkboxGroup";
  groups: OptionGroup[];
  // 有「其他」自由輸入框時才需要提示文字；allowOther 為 false 表示只能從選項中勾選。
  otherPlaceholder?: string;
  allowOther?: boolean;
};

export type TextField =
  | TextInputField
  | TextareaField
  | SelectField
  | CheckboxGroupField;

export const fieldLabels: Record<FormFieldName, string> = {
  displayName: "公開顯示名稱",
  bio: "老師簡介",
  teachingStyle: "教學風格",
  experienceYears: "教學年資",
  certifications: "證照或訓練背景",
  specialties: "擅長類型",
  serviceAreas: "可服務區域",
  teachingFormats: "授課形式",
  priceRange: "參考收費區間",
  profilePhotoUrl: "老師照片連結",
  preferredSessionLengthMinutes: "希望的上課時長",
  preferredFrequency: "希望的上課頻率",
  preferredLocationType: "希望的上課地點",
  preferenceNotes: "其他教學偏好備註",
};

export const requiredFields: FormFieldName[] = [
  "displayName",
  "bio",
  "teachingStyle",
  "experienceYears",
  "specialties",
  "serviceAreas",
  "teachingFormats",
];

// 2026-09-20 老師擅長清單：整理合併使用者提供的短版與分類版用詞而成，分四組方便勾選。
// 2026-09-20 補充：拿掉英文原文，選項只留中文。
export const SPECIALTY_GROUPS: OptionGroup[] = [
  {
    title: "靜心與修復系",
    options: [
      { value: "哈達瑜伽", label: "哈達瑜伽" },
      { value: "陰瑜珈", label: "陰瑜珈" },
      { value: "修復瑜珈", label: "修復瑜珈" },
      { value: "昆達里尼瑜伽", label: "昆達里尼瑜伽" },
      { value: "正念冥想與呼吸法", label: "正念冥想與呼吸法" },
    ],
  },
  {
    title: "活力與動態系",
    options: [
      { value: "流瑜珈", label: "流瑜珈" },
      { value: "阿斯坦加瑜珈", label: "阿斯坦加瑜珈" },
      { value: "力量瑜珈", label: "力量瑜珈" },
      { value: "熱瑜珈", label: "熱瑜珈" },
      { value: "火箭瑜珈", label: "火箭瑜珈" },
    ],
  },
  {
    title: "正位與功能性",
    options: [
      { value: "艾揚格瑜珈", label: "艾揚格瑜珈" },
      { value: "寰宇瑜珈", label: "寰宇瑜珈" },
      { value: "皮拉提斯瑜珈", label: "皮拉提斯瑜珈" },
      { value: "療癒瑜珈／身體正位", label: "療癒瑜珈／身體正位" },
    ],
  },
  {
    title: "特殊對象與主題",
    options: [
      { value: "空中瑜珈", label: "空中瑜珈" },
      { value: "孕婦瑜珈", label: "孕婦瑜珈" },
      { value: "倒立與後彎特訓", label: "倒立與後彎特訓" },
      { value: "壁繩瑜珈", label: "壁繩瑜珈" },
    ],
  },
];

// 2026-09-20 服務地區：只做到縣市層級（22 個），行政區層級之後如果需要再另外規劃。
export const SERVICE_AREA_OPTIONS: OptionItem[] = [
  "基隆市",
  "台北市",
  "新北市",
  "宜蘭縣",
  "新竹市",
  "新竹縣",
  "桃園市",
  "苗栗縣",
  "台中市",
  "彰化縣",
  "南投縣",
  "嘉義市",
  "嘉義縣",
  "雲林縣",
  "台南市",
  "高雄市",
  "屏東縣",
  "台東縣",
  "花蓮縣",
  "金門縣",
  "連江縣",
  "澎湖縣",
].map((name) => ({ value: name, label: name }));

// 2026-09-20 授課形式拆成「班制大小」跟「通路／場合」兩組，各自可複選。
// 2026-09-20 補充：拿掉英文原文，選項只留中文。
export const TEACHING_FORMAT_GROUPS: OptionGroup[] = [
  {
    title: "班制大小",
    options: [
      { value: "一對一私人教學", label: "一對一私人教學" },
      { value: "小班制教學", label: "小班制教學" },
      { value: "大班制團體課", label: "大班制團體課" },
    ],
  },
  {
    title: "通路／場合",
    options: [
      { value: "企業包班", label: "企業包班" },
      { value: "線上直播或錄播課", label: "線上直播或錄播課" },
      { value: "工作坊與師資培訓", label: "工作坊與師資培訓" },
    ],
  },
];

// 2026-09-20 教學年資改為區間選單，儲存區間下界數字，方便之後排序／篩選。
export const EXPERIENCE_YEARS_OPTIONS: OptionItem[] = [
  { value: "0", label: "未滿 1 年" },
  { value: "1", label: "1~3 年" },
  { value: "3", label: "3~5 年" },
  { value: "5", label: "5~10 年" },
  { value: "10", label: "10 年以上" },
];

export function matchExperienceYearsOptionValue(
  years: number | null | undefined,
): string {
  if (typeof years !== "number" || !Number.isFinite(years)) {
    return "";
  }

  let matched = EXPERIENCE_YEARS_OPTIONS[0]!.value;

  for (const option of EXPERIENCE_YEARS_OPTIONS) {
    if (years >= Number(option.value)) {
      matched = option.value;
    }
  }

  return matched;
}

export const SESSION_LENGTH_OPTIONS: OptionItem[] = [
  { value: "45", label: "45 分鐘" },
  { value: "60", label: "60 分鐘" },
  { value: "90", label: "90 分鐘" },
  { value: "120", label: "120 分鐘" },
];

export const FREQUENCY_OPTIONS: OptionItem[] = [
  { value: "每週多次", label: "每週多次" },
  { value: "每週一次", label: "每週一次" },
  { value: "每兩週一次", label: "每兩週一次" },
];

export const LOCATION_TYPE_OPTIONS: OptionItem[] = [
  {
    value: "可配合到學員／團主指定的地點授課",
    label: "可配合到學員／團主指定的地點授課",
  },
  { value: "希望在自己的教學地點授課", label: "希望在自己的教學地點授課" },
  { value: "兩者皆可，再個別討論", label: "兩者皆可，再個別討論" },
];

// checkboxGroup 欄位把選取的項目跟「其他」自由輸入的內容，合併存成同一個以換行分隔的
// 字串——跟這個欄位原本自由輸入文字方塊的資料格式完全相同，後端／資料庫都不需要跟著改。
export function parseCheckboxGroupValue(
  value: string,
  groups: OptionGroup[],
): { selectedValues: string[]; otherText: string } {
  const knownValues = new Set(
    groups.flatMap((group) => group.options.map((option) => option.value)),
  );
  const items = value
    .split("\n")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return {
    selectedValues: items.filter((item) => knownValues.has(item)),
    otherText: items.filter((item) => !knownValues.has(item)).join("、"),
  };
}

export function buildCheckboxGroupValue(
  selectedValues: string[],
  otherText: string,
): string {
  const trimmedOther = otherText.trim();

  return [...selectedValues, ...(trimmedOther ? [trimmedOther] : [])].join(
    "\n",
  );
}

export const applicationSections: {
  title: string;
  description: string;
  fields: TextField[];
}[] = [
  {
    title: "基本呈現",
    description:
      "先讓團主理解你的稱呼、教學經驗，以及你希望被看見的專業樣貌。",
    fields: [
      {
        name: "displayName",
        label: fieldLabels.displayName,
        requirement: "submitRequired",
        helper: "正式送審時必填。請填寫你希望在平台上被看見的名稱。",
        kind: "text",
        placeholder: "例如：林安瑜 / Anya Lin",
      },
      {
        name: "experienceYears",
        label: fieldLabels.experienceYears,
        requirement: "submitRequired",
        helper: "正式送審時必填。請選擇最接近的教學年資區間。",
        kind: "select",
        options: EXPERIENCE_YEARS_OPTIONS,
      },
      {
        name: "profilePhotoUrl",
        label: fieldLabels.profilePhotoUrl,
        requirement: "optionalRecommended",
        helper: "通過後再補也可以。目前請貼上圖片連結（尚未提供上傳）。",
        kind: "text",
        placeholder: "例如：https://example.com/profile.jpg",
        inputMode: "url",
      },
    ],
  },
  {
    title: "教學風格與背景",
    description:
      "用清楚、溫和的方式描述你如何帶領練習，而不是把老師壓縮成標籤。",
    fields: [
      {
        name: "bio",
        label: fieldLabels.bio,
        requirement: "submitRequired",
        helper: "正式送審時必填。可以簡短說明你的練習背景、服務對象與教學關懷。",
        kind: "textarea",
        placeholder: "用幾句話介紹你自己，不需要寫得很長。",
        example:
          "我從事瑜伽教學 6 年，主要陪伴上班族與初學者練習，曾在企業與社區帶領團體課。我重視呼吸、身體覺察與安全調整，希望大家練完能感覺更放鬆。",
      },
      {
        name: "teachingStyle",
        label: fieldLabels.teachingStyle,
        requirement: "submitRequired",
        helper: "正式送審時必填。請描述你的帶領方式、節奏與課堂氛圍。",
        kind: "textarea",
        placeholder: "描述你的帶領方式與課堂氛圍。",
        example:
          "節奏穩定、口令清楚，會先讓大家熟悉呼吸再進入動作，並提供不同程度的調整選項。課堂氣氛溫和，不追求動作完美，重視每個人的感受。",
      },
      {
        name: "certifications",
        label: fieldLabels.certifications,
        requirement: "optionalRecommended",
        helper: "通過後再補也可以。可用逗號或換行分隔不同訓練。",
        kind: "textarea",
        placeholder: "例如：RYT 200、陰瑜伽培訓、孕產瑜伽進修",
      },
    ],
  },
  {
    title: "服務範圍與合作形式",
    description:
      "協助平台判斷哪些團課需求真正適合你，避免倉促媒合或不清楚的合作期待。",
    fields: [
      {
        name: "specialties",
        label: fieldLabels.specialties,
        requirement: "submitRequired",
        helper: "正式送審時至少一項。勾選你擅長的瑜伽風格，找不到的話可以填在「其他」。",
        kind: "checkboxGroup",
        groups: SPECIALTY_GROUPS,
        otherPlaceholder: "例如：其他你擅長但沒列出的風格",
      },
      {
        name: "serviceAreas",
        label: fieldLabels.serviceAreas,
        requirement: "submitRequired",
        helper: "正式送審時至少一項。勾選你可服務的縣市；線上授課請在「授課形式」勾選。",
        kind: "checkboxGroup",
        groups: [{ title: "", options: SERVICE_AREA_OPTIONS }],
        allowOther: false,
      },
      {
        name: "teachingFormats",
        label: fieldLabels.teachingFormats,
        requirement: "submitRequired",
        helper: "正式送審時至少一項。可複選班制大小，也可以加選你會用的授課管道。",
        kind: "checkboxGroup",
        groups: TEACHING_FORMAT_GROUPS,
        otherPlaceholder: "例如：其他你提供的授課形式",
      },
      {
        name: "priceRange",
        label: fieldLabels.priceRange,
        requirement: "optionalRecommended",
        helper: "通過後再補也可以。此資訊只作為合作溝通參考，不作低價競標或排序。",
        kind: "text",
        placeholder: "例如：依課程長度與地點討論，團課每堂 NT$3,000 起",
      },
    ],
  },
  {
    title: "教學偏好",
    description:
      "讓團主更快理解你習慣的合作方式；這些都是選填，通過後再補也可以。",
    fields: [
      {
        name: "preferredSessionLengthMinutes",
        label: fieldLabels.preferredSessionLengthMinutes,
        requirement: "optionalRecommended",
        helper: "通過後再補也可以。",
        kind: "select",
        options: SESSION_LENGTH_OPTIONS,
      },
      {
        name: "preferredFrequency",
        label: fieldLabels.preferredFrequency,
        requirement: "optionalRecommended",
        helper: "通過後再補也可以。",
        kind: "select",
        options: FREQUENCY_OPTIONS,
      },
      {
        name: "preferredLocationType",
        label: fieldLabels.preferredLocationType,
        requirement: "optionalRecommended",
        helper: "通過後再補也可以。",
        kind: "select",
        options: LOCATION_TYPE_OPTIONS,
      },
      {
        name: "preferenceNotes",
        label: fieldLabels.preferenceNotes,
        requirement: "optionalRecommended",
        helper: "通過後再補也可以。還有什麼想讓團主知道的教學偏好，都可以寫在這裡。",
        kind: "textarea",
        placeholder: "例如：需要提前 30 分鐘到場準備場地。",
      },
    ],
  },
];
