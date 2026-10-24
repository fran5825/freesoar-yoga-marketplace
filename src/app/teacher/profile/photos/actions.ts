"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearOwnAvatar,
  deleteOwnTeacherPhoto,
  moveOwnPhoto,
  setOwnAvatar,
  uploadOwnTeacherPhoto,
} from "@/domain/teacher-photo/service";

// teacher-showcase-photos 票 03：老師照片管理的操作。失敗時帶著說明導回同一頁，不顯示錯誤訊息原文。
export async function uploadPhotoAction(formData: FormData): Promise<void> {
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) {
    redirectWithFeedback("error", "請先選擇一張照片。");
  }

  const result = await uploadOwnTeacherPhoto(file);

  revalidate();

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "照片已上傳。");
}

export async function deletePhotoAction(formData: FormData): Promise<void> {
  const result = await deleteOwnTeacherPhoto(readFormString(formData, "photoId"));

  revalidate();

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "照片已刪除。");
}

export async function setAvatarAction(formData: FormData): Promise<void> {
  const result = await setOwnAvatar(readFormString(formData, "photoId"));

  revalidate();

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "已設為頭像。");
}

export async function clearAvatarAction(): Promise<void> {
  const result = await clearOwnAvatar();

  revalidate();

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "已取消頭像。");
}

export async function movePhotoAction(formData: FormData): Promise<void> {
  const direction = readFormString(formData, "direction") === "down" ? "down" : "up";
  const result = await moveOwnPhoto(readFormString(formData, "photoId"), direction);

  revalidate();

  if (!result.ok) {
    redirectWithFeedback("error", result.message);
  }

  redirectWithFeedback("success", "已調整順序。");
}

function revalidate() {
  revalidatePath("/teacher/profile/photos");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function redirectWithFeedback(result: "success" | "error", message: string): never {
  redirect(`/teacher/profile/photos?result=${result}&message=${encodeURIComponent(message)}`);
}
