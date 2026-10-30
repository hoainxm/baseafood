import type * as React from "react";

/**
 * FormSection — đầu KHỐI trong thân một form / hộp thoại dài (VD "1 Hợp đồng", "2 Dòng hàng").
 *
 * Khung nền nhạt bo góc tách khối khỏi khối bên cạnh; tiêu đề khối có số thứ tự tròn (khi form
 * đi theo trình tự) + dòng gợi ý ngắn + chỗ cho nút phụ của khối (VD "Chép từ lệnh …").
 * Dùng thay `<h3 className="font-semibold">` trần: tiêu đề trần cùng độ đậm với nhãn ô nên
 * người dùng không phân được tầng "khối" và "ô" (rà giao diện 2026-10-30).
 * Gốc: `FormSection` cục bộ của hộp Hợp đồng xuất khẩu, đưa lên dùng chung.
 */
export function FormSection({
  no,
  title,
  hint,
  action,
  children,
}: {
  /** Số thứ tự khối (form đi theo trình tự). Bỏ trống ⇒ không vẽ vòng số. */
  no?: number;
  title: string;
  hint?: React.ReactNode;
  /** Nút phụ của riêng khối, đứng cuối hàng tiêu đề. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 rounded-xl bg-muted/40 p-4">
      <div className="flex flex-wrap items-start gap-3">
        {no != null && (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground" aria-hidden>
            {no}
          </span>
        )}
        <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
          <h3 className="font-semibold">{title}</h3>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
