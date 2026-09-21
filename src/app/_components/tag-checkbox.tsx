// 用純 CSS 的 peer-checked 呈現勾選狀態，而不是用 JS 算 className——這樣同一套標記在
// 沒有 client state 的 Server Component 表單裡（例如 teacher/profile 編輯頁）也能用一樣的
// 視覺效果，不需要額外的互動邏輯。
export function TagCheckbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <label className="relative cursor-pointer">
      <input
        checked={checked}
        className="peer sr-only"
        disabled={disabled}
        onChange={onChange}
        type="checkbox"
      />
      <span className="inline-flex rounded-full border border-ink/20 px-3 py-1.5 text-sm text-ink-soft transition peer-checked:border-pine peer-checked:bg-pine peer-checked:text-white peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
        {label}
      </span>
    </label>
  );
}
