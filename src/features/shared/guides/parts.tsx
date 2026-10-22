// ============================================================
// Tên file: src/features/shared/guides/parts.tsx
// Tên tiếng Việt: Khối chữ dùng chung cho hộp "Hướng dẫn: <trang>" (nút "?" ở thanh tiêu đề)
// Description: Shared building blocks for per-page guide content (ordered steps, bullet list,
//              titled section). Each page guide lives in `guides/<pageId>.tsx` and is wired into
//              PAGE_GUIDES (features/shared/guideContent.tsx). ba-spec 43 v4 R14.
// ============================================================
import type { ReactNode } from "react";

/** Các bước làm theo thứ tự (1, 2, 3…). */
export function GuideSteps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-6">{children}</ol>;
}

/** Danh sách gạch đầu dòng (giải thích trạng thái, cảnh báo…). */
export function GuideList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
}

/** Một mục có tiêu đề (danh từ, không chấm cuối). */
export function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}
