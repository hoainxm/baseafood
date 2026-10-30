// ============================================================
// Tên file: src/design-system/patterns/PrintSheet.tsx
// Tên tiếng Việt: Khung phiếu in A4 dùng chung (báo cáo)
// Description: Reusable A4 print sheet overlay + print table cells
// ============================================================
import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { NumberInput } from "./NumberInput";

/**
 * PrintSheet — khung bản in A4 NGANG dùng chung cho các màn Báo cáo.
 *
 * Là lớp phủ toàn màn (`fixed inset-0`) nền trắng; khi bấm "In / Xuất PDF" thì
 * `@media print` (src/index.css) chỉ in vùng `.print-root`, ẩn thanh công cụ
 * `.no-print` và phần app còn lại. Toàn bộ style riêng cho bản in (slate, IN HOA,
 * cỡ nhỏ) nằm Ở ĐÂY (tầng design-system) để màn nghiệp vụ không phải viết
 * `text-xs`/`uppercase` — đúng ranh giới của CLAUDE.md §3.
 */
export function PrintSheet({
  title,
  subtitle: phuDe,
  onClose,
  children,
  landscape = true,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** `false` ⇒ in A4 dọc (VD lệnh sản xuất mẫu QTI-KH-01-04). Mặc định khổ ngang như cũ. */
  landscape?: boolean;
}) {
  return (
    <div className={`print-root ${landscape ? "print-landscape" : ""} fixed inset-0 z-50 overflow-auto bg-white p-6 text-slate-900 sm:p-10`}>
      <div className="no-print mx-auto mb-5 flex max-w-6xl items-center justify-between gap-4">
        <Button variant="outline" onClick={onClose}>
          <X className="size-4" /> Đóng
        </Button>
        <Button
          onClick={() => window.print()}
          title="Mở hộp in của trình duyệt cho đúng trang đang xem. Chọn máy in để in giấy, hoặc 'Lưu thành PDF' để ra file."
        >
          <Printer className="size-4" /> In / Xuất PDF
        </Button>
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="text-sm font-semibold uppercase leading-tight">
          <div>Công ty TNHH Basefood I</div>
          <div>Xí nghiệp BSF1 — Bà Rịa</div>
        </div>
        <div className="mt-2 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">{title}</h1>
          {phuDe ? <p className="text-sm font-semibold uppercase">{phuDe}</p> : null}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/** Cỡ tem thông dụng (mm) — máy in tem nhiệt hay dùng các khổ này. */
const LABEL_SIZES = [
  { width: 50, height: 30, label: "50×30" },
  { width: 40, height: 30, label: "40×30" },
  { width: 35, height: 25, label: "35×25" },
  { width: 60, height: 40, label: "60×40" },
  { width: 100, height: 50, label: "100×50" },
];
const keo = (v: number) => Math.max(10, Math.min(200, Math.round(v) || 0));
const keoBan = (v: number) => Math.max(1, Math.min(500, Math.round(v) || 1));

/** Một tem trong lượt in: mã lô (to, một dòng) + ảnh QR + các dòng phụ. */
export interface PrintLabel {
  lotCode: string;
  qrDataUrl: string;
  lines?: string[];
  /** Số bản in của tem này (VD mỗi block một tem). Mặc định 1, sửa được ở xem trước. */
  copies?: number;
}

/** Một tem — co giãn theo khổ nhờ container-query, dùng chung cho xem trước và bản in. */
function LabelTile({ label, width, height, px, isLast }: { label: PrintLabel; width: number; height: number; px: number; isLast?: boolean }) {
  const { lotCode, qrDataUrl, lines: row = [] } = label;
  return (
    <div
      className={`print-tem-box shrink-0 border border-slate-300 bg-white${isLast ? " print-tem-cuoi" : ""}`}
      style={{ width: width * px, height: height * px, containerType: "size" }}
    >
      <div className="flex h-full w-full items-center" style={{ gap: "4cqw", padding: "6cqmin" }}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR mã lô ${lotCode}`}
            className="shrink-0"
            style={{ height: "min(88cqh, 44cqw)", width: "min(88cqh, 44cqw)" }}
          />
        ) : (
          <div
            className="flex shrink-0 items-center justify-center border border-dashed border-slate-300 text-slate-400"
            style={{ height: "min(88cqh, 44cqw)", width: "min(88cqh, 44cqw)", fontSize: "6cqh" }}
          >
            QR
          </div>
        )}
        {/* Cột chữ = container riêng (inline-size): cỡ chữ theo BỀ RỘNG cột nên
            mã lô luôn vừa MỘT dòng, chữ phụ xuống dòng hiện đủ, không bị cắt. */}
        <div
          className="flex min-w-0 flex-1 flex-col justify-center"
          style={{ containerType: "inline-size", gap: "4cqh" }}
        >
          <div
            className="tnum font-bold leading-none"
            style={{ fontSize: "min(14cqw, 32cqh)", color: "#0f172a", whiteSpace: "nowrap" }}
          >
            {lotCode || "—"}
          </div>
          {row.map((d, i) => (
            <div
              key={i}
              style={{
                fontSize: i === 0 ? "8.5cqw" : "7.8cqw",
                lineHeight: 1.2,
                color: i === 0 ? "#1e293b" : "#475569",
                overflowWrap: "anywhere",
              }}
            >
              {d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * LabelPrintSheet — bản in TEM NHÃN khổ nhỏ (khác PrintSheet khổ A4), cho mã lô + QR.
 *
 * In ĐÚNG KHỔ TEM qua `@page { size }` động (bơm `<style>` khi chọn cỡ); xem
 * trước phóng to trên màn. Nội dung tem (QR + chữ) co giãn theo khổ nhờ đơn vị
 * container-query (`cqh`/`cqw`/`cqmin`) — một layout chạy đúng cả khi xem lẫn khi
 * in, không cần đổi kích thước tay. Hiện in qua hộp thoại in trình duyệt (chọn
 * máy in tem đã cài làm máy in); KẾT NỐI TRỰC TIẾP máy in tem (WebUSB/ESC-POS)
 * để sau. `dong` = các dòng phụ tùy ý (đại lý·xưởng, ngày về, SSCC…), giữ generic.
 *
 * In NHIỀU tem một lượt: truyền `tems` — mỗi tem ra MỘT trang đúng khổ (máy in
 * tem cuộn coi mỗi trang là một nhãn). Khung được portal thẳng vào <body> để lúc
 * in ẩn được toàn bộ app (không thì phần app ẩn vẫn chiếm chỗ ⇒ in thừa nhãn trắng).
 */
export function LabelPrintSheet({
  onClose,
  lotCode = "",
  qrDataUrl = "",
  lines: row = [],
  labels,
  onPrint: onIn,
  defaultWidth = 50,
  defaultHeight = 30,
}: {
  onClose: () => void;
  /** Gọi ngay trước khi mở hộp in (vd ghi sổ in tem) — kèm số bản của từng tem. */
  onPrint?: (copies: number[]) => void;
  lotCode?: string;
  qrDataUrl?: string;
  lines?: string[];
  labels?: PrintLabel[];
  defaultWidth?: number;
  defaultHeight?: number;
}) {
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  const list: PrintLabel[] = labels ?? [{ lotCode, qrDataUrl, lines: row }];
  const [copies, setCopies] = useState<number[]>(() => list.map((t) => keoBan(t.copies ?? 1)));
  const copiesOf = (i: number) => copies[i] ?? 1;
  const totalLabels = list.reduce((s, _, i) => s + copiesOf(i), 0);
  const nhieu = totalLabels > 1;
  const PX = nhieu ? 4 : 6; // px mỗi mm khi xem trước (chỉ ảnh hưởng màn, không ảnh hưởng bản in)
  const isSelected = (r: number, c: number) => r === width && c === height;
  const printCss = `@media print {
  @page { size: ${width}mm ${height}mm; margin: 0; }
  html, body { margin: 0 !important; background: #fff !important; }
  body > *:not(.print-tem) { display: none !important; }
  .print-tem { position: static !important; overflow: visible !important; padding: 0 !important; }
  .print-tem-list { display: block !important; }
  .print-tem-box { width: ${width}mm !important; height: ${height}mm !important; padding: 2mm; box-sizing: border-box;
    border: 0 !important; margin: 0 !important; break-after: page; break-inside: avoid; }
  .print-tem-box.print-tem-cuoi { break-after: auto; }
  .print-tem-sao { display: block !important; }
}`;

  return createPortal(
    <div className="print-root print-tem fixed inset-0 z-50 overflow-auto bg-white p-6 text-slate-900">
      <style dangerouslySetInnerHTML={{ __html: printCss }} />

      <div className="no-print mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={onClose}>
          <X className="size-4" /> Đóng
        </Button>
        <Button
          onClick={() => {
            onIn?.(list.map((_, i) => copiesOf(i)));
            window.print();
          }}
          title={
            nhieu
              ? `Mở hộp in của trình duyệt để in ${totalLabels} tem, mỗi tem một nhãn. Chọn khổ giấy tem trước khi in.`
              : "Mở hộp in của trình duyệt để in tem. Chọn khổ giấy tem trước khi in."
          }
        >
          <Printer className="size-4" /> {nhieu ? `In ${totalLabels} tem` : "In tem"}
        </Button>
      </div>

      <div className="no-print mx-auto mb-3 flex max-w-3xl flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600">Khổ tem:</span>
        {LABEL_SIZES.map((c) => (
          <Button
            key={c.label}
            size="sm"
            variant={isSelected(c.width, c.height) ? "default" : "outline"}
            title={`Đổi khổ tem sang ${c.label} mm.`}
            onClick={() => {
              setWidth(c.width);
              setHeight(c.height);
            }}
          >
            {c.label}
          </Button>
        ))}
        <span className="ml-1 flex items-center gap-1 text-sm text-slate-600">
          <span className="ml-1">Tự chọn</span>
          <NumberInput
            value={width}
            onChange={(v) => v != null && setWidth(keo(v))}
            unit="mm"
            wrapperClassName="inline-block"
            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
            aria-label="Chiều rộng tem (mm)"
          />
          <span aria-hidden>×</span>
          <NumberInput
            value={height}
            onChange={(v) => v != null && setHeight(keo(v))}
            unit="mm"
            wrapperClassName="inline-block"
            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
            aria-label="Chiều cao tem (mm)"
          />
          <span>mm</span>
        </span>
      </div>

      <p className="no-print mx-auto mb-3 max-w-3xl text-center text-sm text-slate-500">
        {nhieu ? `${totalLabels} tem — ` : ""}Xem trước (đã phóng to, mỗi lô hiện một tem). Khi in sẽ ra đúng khổ {width}×{height} mm
        {nhieu ? ", mỗi tem một nhãn" : ""} — chọn máy in tem trong hộp thoại in.
      </p>

      <div className="print-tem-list mx-auto flex max-w-5xl flex-wrap justify-center gap-4">
        {list.map((t, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <LabelTile label={t} width={width} height={height} px={PX} isLast={i === list.length - 1 && copiesOf(i) === 1} />
            {/* Bản sao: ẩn trên màn, chỉ hiện khi in (.print-tem-sao trong printCss). */}
            {Array.from({ length: copiesOf(i) - 1 }, (_, k) => (
              <div key={k} className="print-tem-sao" style={{ display: "none" }}>
                <LabelTile label={t} width={width} height={height} px={PX} isLast={i === list.length - 1 && k === copiesOf(i) - 2} />
              </div>
            ))}
            <label className="no-print flex items-center gap-1 text-sm text-slate-600">
              Số tem
              <NumberInput
                value={copiesOf(i)}
                onChange={(v) => v != null && setCopies((prev) => list.map((_, j) => (j === i ? keoBan(v) : (prev[j] ?? 1))))}
                wrapperClassName="inline-block"
                className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
                aria-label={`Số tem in cho lô ${t.lotCode}`}
              />
            </label>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

/** Ô tiêu đề bảng in (nền xám nhạt, IN HOA, viền). */
export function PrintTh({
  children,
  right,
  className = "",
}: {
  children?: ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`border border-slate-400 bg-slate-100 px-2 py-1 text-xs font-semibold uppercase ${
        right ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

/** Ô dữ liệu bảng in. `dam` = dòng cộng/tổng (in đậm + viền trên rõ). */
export function PrintTd({
  children,
  right,
  bold,
  rowSpan,
  colSpan,
  className = "",
}: {
  children?: ReactNode;
  right?: boolean;
  bold?: boolean;
  rowSpan?: number;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`border border-slate-400 px-2 py-1 text-sm ${right ? "text-right" : "text-left"} ${
        bold ? "bg-slate-50 font-bold" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}
