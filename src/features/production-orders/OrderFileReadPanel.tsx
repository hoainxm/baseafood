// ============================================================
// Tên file: src/features/production-orders/OrderFileReadPanel.tsx
// Tên tiếng Việt: Khối "Đọc file lệnh sản xuất" trong hộp Lập / Sửa lệnh sản xuất
// Description: Reads a production-order Word / PDF file — one already attached at step 2 of the contract's shipment,
//              or one picked from the computer — and hands it to the dialog to pre-fill; shows what was filled, what was
//              kept, and every mismatch as a warning. Writes nothing (ba-spec 48 R21).
// ============================================================
import { useRef, useState } from "react";
import { Button } from "@/design-system";
import { downloadExportFile } from "@/lib/exportFileStorage";
import { ORDER_FILE_ACCEPT, readOrderFile, type OrderFile, type OrderFillReport } from "@/lib/productionOrderFile";
import { FilePicker } from "@/features/export-planning/parts";
import { FileSearch } from "lucide-react";

export interface AttachedOrderFile {
  path: string;
  fileName: string;
  /** Chuyến đã đính (nhãn ngắn). */
  where: string;
}

interface ReadState {
  name: string;
  status: "reading" | "done" | "error";
  message?: string;
  report?: OrderFillReport;
}

export function OrderFileReadPanel({ attached, onRead }: { attached: readonly AttachedOrderFile[]; onRead: (file: OrderFile, name: string) => OrderFillReport }) {
  const [state, setState] = useState<ReadState | null>(null);
  const latest = useRef("");

  const run = async (name: string, load: () => Promise<Blob | null>) => {
    latest.current = name;
    setState({ name, status: "reading" });
    const blob = await load();
    if (latest.current !== name) return;
    if (!blob) {
      setState({ name, status: "error", message: "Không tải được file đã đính (đang chạy không nối máy chủ, hoặc file đã gỡ)." });
      return;
    }
    const res = await readOrderFile(blob, name);
    if (latest.current !== name) return;
    if (!res.ok) setState({ name, status: "error", message: res.message });
    else setState({ name, status: "done", report: onRead(res.file, name) });
  };

  const report = state?.report;
  return (
    <section className="grid min-w-0 gap-3 rounded-lg border border-border p-3 sm:p-4" aria-label="Đọc file lệnh sản xuất" data-tour="order-file-read">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <FileSearch className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="font-semibold">Đọc file lệnh sản xuất</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Đọc file Word (.doc, .docx) hoặc PDF có chữ của lệnh: app điền sẵn số lệnh, ngày, MSL, ngày sản xuất theo ngày ISO, ngày giao, thị trường, hạn sử dụng, dòng hàng
        (khớp dòng hợp đồng) và lưu ý. Ô đã gõ khác file thì giữ và kê lại. Chỗ lệch có cảnh báo. App không tự lưu.
      </p>
      <div className="flex min-w-0 flex-wrap items-end gap-2">
        {attached.map((f) => (
          <Button
            key={f.path}
            size="sm"
            variant={state?.name === f.fileName ? "outline" : "default"}
            onClick={() => void run(f.fileName, () => downloadExportFile(f.path))}
            title={`Đọc file đã đính ở bước Lệnh sản xuất của ${f.where} để điền sẵn hộp này.`}
          >
            <FileSearch className="mr-1 h-4 w-4" aria-hidden />
            Đọc {f.fileName.length > 42 ? `${f.fileName.slice(0, 40)}…` : f.fileName}
          </Button>
        ))}
        <FilePicker files={[]} onChange={(fs) => fs[0] && void run(fs[0].name, async () => fs[0])} multiple={false} accept={ORDER_FILE_ACCEPT} label={attached.length ? "Chọn file khác trên máy" : "Chọn file để đọc"} />
      </div>
      {state?.status === "reading" && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang đọc {state.name}…
        </p>
      )}
      {state?.status === "error" && (
        <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
          {state.name}: {state.message}
        </p>
      )}
      {report && (
        <div role="status" className="grid min-w-0 gap-2 text-sm">
          <p className="font-medium break-words">Đã đọc {state?.name}.</p>
          {report.filled.length > 0 && (
            <div className="grid gap-0.5">
              <span className="font-semibold">Đã điền ({report.filled.length}):</span>
              {report.filled.map((x) => (
                <span key={x} className="break-words">
                  · {x}
                </span>
              ))}
            </div>
          )}
          {report.kept.length > 0 && (
            <div className="grid gap-0.5">
              <span className="font-semibold">Giữ ô đã gõ ({report.kept.length}):</span>
              {report.kept.map((x) => (
                <span key={x} className="break-words">
                  · {x}
                </span>
              ))}
            </div>
          )}
          {report.warnings.length > 0 ? (
            <div className="grid gap-0.5 rounded-lg bg-warning-surface px-4 py-3">
              <span className="font-semibold">Cần soát ({report.warnings.length}):</span>
              {report.warnings.map((x) => (
                <span key={x} className="break-words">
                  · {x}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Không có chỗ lệch giữa file và hợp đồng.</p>
          )}
        </div>
      )}
    </section>
  );
}
