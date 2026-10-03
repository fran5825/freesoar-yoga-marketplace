import { expect, test } from "@playwright/test";

import { SPECIALTY_GROUPS } from "../../src/app/teachers/join/_lib/application-fields";
import { normalizeYogaStyles } from "../../src/domain/class-session/yoga-styles";
import { SERVICE_TYPE_TEACHER_SPECIALTIES } from "../../src/domain/demand-request/service-types";
import { normalizeTeacherProfileDraftInput } from "../../src/domain/teacher-profile/input";
import { normalizeYogaWording } from "../../src/domain/yoga-wording";

// 2026-10-03：選項與文案一律寫「瑜伽」；「特殊對象與主題」新增親子、兒童、樂齡瑜伽。

const allOptions = SPECIALTY_GROUPS.flatMap((group) => group.options.map((option) => option.value));

test.describe("yoga wording (pure functions, no UI)", () => {
  test("no specialty option or matching-table entry uses 瑜珈", () => {
    expect(allOptions.filter((value) => value.includes("珈"))).toEqual([]);
    const mapped = Object.values(SERVICE_TYPE_TEACHER_SPECIALTIES).flat();
    expect(mapped.filter((value) => value.includes("珈"))).toEqual([]);
    // 對照表裡的每一個值都要是真的選項，才對得上老師存的資料。
    expect(mapped.filter((value) => !allOptions.includes(value))).toEqual([]);
  });

  test("特殊對象與主題 lists audiences first, including the new 親子／兒童／樂齡瑜伽", () => {
    const group = SPECIALTY_GROUPS.find((item) => item.title === "特殊對象與主題");
    expect(group?.options.map((option) => option.value)).toEqual([
      "孕婦瑜伽",
      "親子瑜伽",
      "兒童瑜伽",
      "樂齡瑜伽",
      "空中瑜伽",
      "倒立與後彎特訓",
      "壁繩瑜伽",
    ]);
    expect(SERVICE_TYPE_TEACHER_SPECIALTIES["特定對象與主題"]).toEqual(
      expect.arrayContaining(["親子瑜伽", "兒童瑜伽", "樂齡瑜伽"]),
    );
    expect(SERVICE_TYPE_TEACHER_SPECIALTIES["伸展與身體保養"]).toContain("樂齡瑜伽");
  });

  test("custom text typed with 瑜珈 is saved as 瑜伽, for teacher specialties and class yoga types", () => {
    expect(normalizeYogaWording("陰瑜珈與瑜珈哲學")).toBe("陰瑜伽與瑜伽哲學");
    expect(normalizeYogaStyles(["陰瑜珈", "陰瑜伽", " 自訂瑜珈 "])).toEqual(["陰瑜伽", "自訂瑜伽"]);

    const normalized = normalizeTeacherProfileDraftInput({
      displayName: "T",
      bio: "我教瑜珈",
      teachingStyle: "",
      experienceYears: "",
      certifications: "",
      specialties: "流瑜伽\n我的瑜珈",
      serviceAreas: "",
      teachingFormats: "",
      priceRange: "",
      profilePhotoUrl: "",
      preferredSessionLengthMinutes: "",
      preferredFrequency: "",
      preferredLocationType: "",
      preferenceNotes: "",
    });
    expect(normalized.specialties).toEqual(["流瑜伽", "我的瑜伽"]);
    // 自由文字（簡介）不動。
    expect(normalized.bio).toBe("我教瑜珈");
  });
});
