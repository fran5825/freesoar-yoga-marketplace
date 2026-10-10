import { setOwnClassCover, uploadOwnTeacherPhoto, type CoverTarget } from "@/domain/teacher-photo/service";

// teacher-showcase-photos 票 04：建課與改課表單送出後，套用「課程封面」的選擇。
// 課程本身先照原本流程存好（domain 規則不變），封面是之後的一個獨立步驟；封面失敗不會讓課程消失，
// 而是在成功訊息後面補一句說明，老師可以稍後到改課頁重新設定。
//
// 表單欄位：
// - coverUpload（檔案）：有選檔案就上傳新照片並設為封面（新照片也進入老師的照片庫，算在 5 張上限裡）；
// - coverChoice：keep／空字串＝不變、none＝不放封面、其他＝老師自己某張有效照片的 id。
// 回傳要附在訊息後面的警告文字；沒有問題就回傳 null。
export async function applyCoverFromForm(formData: FormData, target: CoverTarget): Promise<string | null> {
  const upload = formData.get("coverUpload");

  if (upload instanceof File && upload.size > 0) {
    const uploaded = await uploadOwnTeacherPhoto(upload);

    if (!uploaded.ok) {
      return `封面照片沒有上傳成功：${uploaded.message}`;
    }

    return coverWarning(await setOwnClassCover(target, uploaded.photoId));
  }

  const choice = formData.get("coverChoice");

  if (typeof choice !== "string" || choice === "" || choice === "keep") {
    return null;
  }

  return coverWarning(await setOwnClassCover(target, choice === "none" ? null : choice));
}

function coverWarning(result: Awaited<ReturnType<typeof setOwnClassCover>>): string | null {
  return result.ok ? null : `封面沒有設定成功：${result.message}`;
}

export function appendWarning(message: string, warning: string | null): string {
  return warning ? `${message}（${warning}）` : message;
}
