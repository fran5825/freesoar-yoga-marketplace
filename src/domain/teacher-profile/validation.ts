export type TeacherProfileApplicationInput = {
  displayName?: string | null;
  bio?: string | null;
  teachingStyle?: string | null;
  experienceYears?: number | null;
  certifications?: string[] | null;
  specialties?: string[] | null;
  serviceAreas?: string[] | null;
  teachingFormats?: string[] | null;
  priceRange?: string | null;
  profilePhotoUrl?: string | null;
};

export type TeacherProfileValidationErrorCode =
  | "display_name_required"
  | "bio_required"
  | "teaching_style_required"
  | "experience_years_required"
  | "specialties_required"
  | "service_areas_required"
  | "teaching_formats_required";

export type TeacherProfileValidationError = {
  field:
    | "displayName"
    | "bio"
    | "teachingStyle"
    | "experienceYears"
    | "specialties"
    | "serviceAreas"
    | "teachingFormats";
  code: TeacherProfileValidationErrorCode;
  message: string;
};

export type TeacherProfileValidationResult =
  | {
      valid: true;
      errors: [];
    }
  | {
      valid: false;
      errors: TeacherProfileValidationError[];
    };

export function validateTeacherProfileDraft(
  input: TeacherProfileApplicationInput,
): TeacherProfileValidationResult {
  void input;

  return createValidResult();
}

export function validateTeacherProfileSubmit(
  input: TeacherProfileApplicationInput,
): TeacherProfileValidationResult {
  const errors: TeacherProfileValidationError[] = [];

  if (isBlank(input.displayName)) {
    errors.push({
      field: "displayName",
      code: "display_name_required",
      message: "公開顯示名稱為送審必填欄位。",
    });
  }

  if (isBlank(input.bio)) {
    errors.push({
      field: "bio",
      code: "bio_required",
      message: "老師簡介為送審必填欄位。",
    });
  }

  if (isBlank(input.teachingStyle)) {
    errors.push({
      field: "teachingStyle",
      code: "teaching_style_required",
      message: "教學風格為送審必填欄位。",
    });
  }

  if (!hasExperienceYears(input.experienceYears)) {
    errors.push({
      field: "experienceYears",
      code: "experience_years_required",
      message: "教學年資為送審必填欄位。",
    });
  }

  if (!hasAtLeastOneValue(input.specialties)) {
    errors.push({
      field: "specialties",
      code: "specialties_required",
      message: "擅長類型至少需要一項。",
    });
  }

  if (!hasAtLeastOneValue(input.serviceAreas)) {
    errors.push({
      field: "serviceAreas",
      code: "service_areas_required",
      message: "可服務區域至少需要一項。",
    });
  }

  if (!hasAtLeastOneValue(input.teachingFormats)) {
    errors.push({
      field: "teachingFormats",
      code: "teaching_formats_required",
      message: "授課形式至少需要一項。",
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return createValidResult();
}

function createValidResult(): TeacherProfileValidationResult {
  return {
    valid: true,
    errors: [],
  };
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function hasExperienceYears(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function hasAtLeastOneValue(values: string[] | null | undefined): boolean {
  return Array.isArray(values) && values.some((value) => value.trim().length > 0);
}
