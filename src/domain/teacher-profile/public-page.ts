// teacher-showcase-photos 票 06（spec S6、6.2、6.6–6.8）：老師公開頁的讀取。完全不呼叫 requireUser()，服務未登入的訪客。
//
// 可見條件：老師審核通過（approved）且「自己開啟了公開頁」；其餘（未開啟、暫停、退回、不存在）一律回傳 null，
// 頁面回 404，不透露差別。
// 只回傳公開頁該給訪客看的欄位：顯示名稱、簡介、教學風格、年資區間、證照、擅長類型、教學形式、服務地區、
// 頭像與個人照片。刻意不選取：email、電話、收款帳號、繳費規則、聯絡方式、價格區間、審核狀態與任何內部欄位。
// 沒填的欄位回傳空值，畫面整塊不顯示（有填才顯示）。

import { activePhotoUrl, photoRefSelect, teacherAvatarUrl } from "@/domain/teacher-photo/display";
import { prisma } from "@/lib/prisma";

export type PublicTeacherPage = {
  id: string;
  displayName: string;
  bio: string | null;
  teachingStyle: string | null;
  experienceLabel: string | null;
  certifications: string[];
  specialties: string[];
  serviceAreas: string[];
  teachingFormats: string[];
  avatarUrl: string | null;
  photos: { id: string; url: string; width: number; height: number }[];
};

// 教學年資是區間下界（見 application-fields.ts 的 EXPERIENCE_YEARS_OPTIONS）。
const EXPERIENCE_LABELS: [number, string][] = [
  [10, "10 年以上"],
  [5, "5~10 年"],
  [3, "3~5 年"],
  [1, "1~3 年"],
  [0, "未滿 1 年"],
];

function experienceLabel(years: number | null): string | null {
  if (years === null) {
    return null;
  }

  return EXPERIENCE_LABELS.find(([lowerBound]) => years >= lowerBound)?.[1] ?? null;
}

function text(value: string | null): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

export async function getPublicTeacherPage(teacherProfileId: string): Promise<PublicTeacherPage | null> {
  const profile = await prisma.teacherProfile.findFirst({
    where: { id: teacherProfileId, status: "approved", isPublicPageEnabled: true },
    select: {
      id: true,
      displayName: true,
      bio: true,
      teachingStyle: true,
      experienceYears: true,
      certifications: true,
      specialties: true,
      serviceAreas: true,
      teachingFormats: true,
      avatarPhoto: photoRefSelect,
      photos: {
        where: { status: "active" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, storageKey: true, status: true, width: true, height: true },
      },
    },
  });

  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    displayName: text(profile.displayName) ?? "飛索老師",
    bio: text(profile.bio),
    teachingStyle: text(profile.teachingStyle),
    experienceLabel: experienceLabel(profile.experienceYears),
    certifications: profile.certifications.filter((entry) => entry.trim().length > 0),
    specialties: profile.specialties.filter((entry) => entry.trim().length > 0),
    serviceAreas: profile.serviceAreas.filter((entry) => entry.trim().length > 0),
    teachingFormats: profile.teachingFormats.filter((entry) => entry.trim().length > 0),
    avatarUrl: teacherAvatarUrl({ avatarPhoto: profile.avatarPhoto }),
    photos: profile.photos.flatMap((photo) => {
      const url = activePhotoUrl(photo);

      return url ? [{ id: photo.id, url, width: photo.width, height: photo.height }] : [];
    }),
  };
}
