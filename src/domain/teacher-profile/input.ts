import type { TeacherProfileApplicationInput } from "./validation";

export type TeacherProfileDraftFormInput = {
  displayName: string;
  bio: string;
  teachingStyle: string;
  experienceYears: string;
  certifications: string;
  specialties: string;
  serviceAreas: string;
  teachingFormats: string;
  priceRange: string;
  profilePhotoUrl: string;
  preferredSessionLengthMinutes: string;
  preferredFrequency: string;
  preferredLocationType: string;
  preferenceNotes: string;
};

export function normalizeTeacherProfileDraftInput(
  input: TeacherProfileDraftFormInput,
): TeacherProfileApplicationInput {
  return {
    displayName: normalizeOptionalString(input.displayName),
    bio: normalizeOptionalString(input.bio),
    teachingStyle: normalizeOptionalString(input.teachingStyle),
    experienceYears: normalizeOptionalNumber(input.experienceYears),
    certifications: normalizeStringList(input.certifications),
    specialties: normalizeStringList(input.specialties),
    serviceAreas: normalizeStringList(input.serviceAreas),
    teachingFormats: normalizeStringList(input.teachingFormats),
    priceRange: normalizeOptionalString(input.priceRange),
    profilePhotoUrl: normalizeOptionalString(input.profilePhotoUrl),
    preferredSessionLengthMinutes: normalizeOptionalNumber(
      input.preferredSessionLengthMinutes,
    ),
    preferredFrequency: normalizeOptionalString(input.preferredFrequency),
    preferredLocationType: normalizeOptionalString(input.preferredLocationType),
    preferenceNotes: normalizeOptionalString(input.preferenceNotes),
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

function normalizeStringList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
