// ============================================================
// Tên file: src/design-system/patterns/DocxPreview.tsx
// Tên tiếng Việt: Xem trước file Word (.docx) đúng trang + khung in ra PDF
// Description: Renders a generated .docx in the browser with docx-preview (lazy-loaded) so the on-screen preview
//              IS the Word file (ba-spec 54 R8), plus a print overlay that prints exactly those pages (PDF via the
//              browser print dialog — Q8). Display only; never writes data.
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * DocxPreview — vẽ trang Word ngay trên màn. Thư viện `docx-preview` chỉ nạp khi khung này hiện (không vào gói
 * trang đầu). `file` đổi ⇒ vẽ lại. Lỗi vẽ ⇒ hiện câu lỗi, file Word vẫn tải được bình thường.
 */
export function DocxPreview({ file, className, onRendered }: { file: Uint8Array | null; className?: string; onRendered?: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const renderedRef = useRef(onRendered);
  useEffect(() => {
    renderedRef.current = onRendered;
  });

  useEffect(() => {
    const body = bodyRef.current;
    if (!file || !body) return;
    let alive = true;
    void import("docx-preview")
      .then(({ renderAsync }) =>
        renderAsync(new Blob([file as BlobPart]), body, styleRef.current ?? undefined, {
          className: "docx",
          inWrapper: true,
          hideWrapperOnPrint: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          renderHeaders: true,
          renderFooters: true,
        }),
      )
      .then(() => {
        if (!alive) return;
        setError(null);
        renderedRef.current?.();
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [file]);

  return (
    <div className={cn("min-w-0 overflow-auto rounded-lg border-2 border-border bg-muted", className)}>
      <div ref={styleRef} />
      {error ? <p className="p-4 text-sm text-destructive">Không vẽ được bản xem trước: {error}. File Word vẫn tải về được.</p> : null}
      <div ref={bodyRef} />
    </div>
  );
}

/**
 * DocxPrintSheet — lớp phủ in đúng các trang của file Word (A4 dọc). "In / Lưu PDF" gọi `onPrint` (ghi lần xuất PDF)
 * rồi mở hộp in của trình duyệt — chọn "Lưu thành PDF" để ra file. Không thêm đầu trang công ty: khuôn đã có.
 */
export function DocxPrintSheet({ file, title, onClose, onPrint, note }: { file: Uint8Array; title: string; onClose: () => void; onPrint?: () => void; note?: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute("data-print-preview", "");
    return () => document.documentElement.removeAttribute("data-print-preview");
  }, []);
  return createPortal(
    <div className="print-root print-docx fixed inset-0 z-50 overflow-auto bg-background p-4 sm:p-8">
      <div className="no-print mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={onClose}>
          <X className="size-4" /> Đóng
        </Button>
        <span className="min-w-0 flex-1 font-semibold">{title}</span>
        <Button
          onClick={() => {
            onPrint?.();
            window.print();
          }}
          title="Mở hộp in của trình duyệt cho đúng các trang đang xem. Chọn 'Lưu thành PDF' để ra file PDF, hoặc chọn máy in để in giấy."
        >
          <Printer className="size-4" /> In / Lưu PDF
        </Button>
        {note ? <div className="basis-full text-sm text-muted-foreground">{note}</div> : null}
      </div>
      <DocxPreview file={file} className="mx-auto max-w-4xl border-0 bg-transparent" />
    </div>,
    document.body,
  );
}
