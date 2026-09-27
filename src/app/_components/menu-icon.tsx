// 手機選單按鈕的漢堡圖示（打開時變成 ✕）。公開 header 與專區導覽列共用，
// 按鈕本身要用 aria-label 提供「選單／關閉選單」文字給螢幕閱讀器。
export function MenuIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      {isOpen ? (
        <path d="M6 6l12 12M18 6L6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}
