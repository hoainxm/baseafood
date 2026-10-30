import type * as React from "react";

/**
 * GroupLabel — nhãn cho một NHÓM ô / nút không có ô nhập riêng (nhóm nút chọn nhiều, danh sách
 * lô để chọn, danh sách phòng ban…). Cùng khuôn nhãn của Field / ChoiceGroup: chữ `text-sm`
 * đậm, hàng cao `min-h-9`, dấu * đỏ `ml-1 font-bold`. Thay cho `<p className="font-medium">`
 * tự dựng (khác cỡ, khác độ đậm, dấu * dính chữ — rà giao diện 2026-10-30).
 * Trong `<fieldset>` dùng `as="legend"` để trình đọc màn hình đọc tên nhóm.
 */
export function GroupLabel({
  children,
  required,
  as = "p",
  id,
}: {
  children: React.ReactNode;
  required?: boolean;
  as?: "p" | "legend";
  id?: string;
}) {
  const Tag = as;
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2">
      <Tag id={id} className="text-sm leading-snug font-semibold text-foreground">
        {children}
        {required && (
          <span aria-hidden className="ml-1 font-bold text-destructive">
            *
          </span>
        )}
      </Tag>
    </div>
  );
}
