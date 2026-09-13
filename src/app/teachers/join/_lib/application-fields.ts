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
  | "profilePhotoUrl";

export type TextField = {
  name: FormFieldName;
  label: string;
  requirement: "submitRequired" | "optionalRecommended";
  helper: string;
  placeholder: string;
  inputMode?: "numeric" | "url";
  multiline?: boolean;
};

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
        placeholder: "例如：林安瑜 / Anya Lin",
      },
      {
        name: "experienceYears",
        label: fieldLabels.experienceYears,
        requirement: "submitRequired",
        helper: "正式送審時必填。可填 0 或以上的教學年資。",
        placeholder: "例如：5",
        inputMode: "numeric",
      },
      {
        name: "profilePhotoUrl",
        label: fieldLabels.profilePhotoUrl,
        requirement: "optionalRecommended",
        helper: "建議欄位，可稍後補上。此 slice 先以圖片連結表示，尚未實作上傳。",
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
        placeholder:
          "例如：我長期陪伴初學者與企業團體練習，重視呼吸、身體覺察與安全調整。",
        multiline: true,
      },
      {
        name: "teachingStyle",
        label: fieldLabels.teachingStyle,
        requirement: "submitRequired",
        helper: "正式送審時必填。請描述你的帶領方式、節奏與課堂氛圍。",
        placeholder: "例如：穩定、細緻，重視呼吸與身體覺察。",
        multiline: true,
      },
      {
        name: "certifications",
        label: fieldLabels.certifications,
        requirement: "optionalRecommended",
        helper: "建議欄位，可留空。可用逗號或換行分隔不同訓練。",
        placeholder: "例如：RYT 200、陰瑜伽培訓、孕產瑜伽進修",
        multiline: true,
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
        helper: "正式送審時至少一項。可用逗號或換行分隔。",
        placeholder: "例如：哈達、陰瑜伽、伸展、企業放鬆課",
        multiline: true,
      },
      {
        name: "serviceAreas",
        label: fieldLabels.serviceAreas,
        requirement: "submitRequired",
        helper: "正式送審時至少一項。請填寫你可服務的城市、行政區或線上形式。",
        placeholder: "例如：台北市、新北市、線上團課",
        multiline: true,
      },
      {
        name: "teachingFormats",
        label: fieldLabels.teachingFormats,
        requirement: "submitRequired",
        helper: "正式送審時至少一項。V1 以實體團課優先，也可補充其他形式。",
        placeholder: "例如：實體團課、企業內訓、線上課",
        multiline: true,
      },
      {
        name: "priceRange",
        label: fieldLabels.priceRange,
        requirement: "optionalRecommended",
        helper: "建議欄位，可留空。此資訊只作為合作溝通參考，不作低價競標或排序。",
        placeholder: "例如：依課程長度與地點討論，團課每堂 NT$3,000 起",
      },
    ],
  },
];
