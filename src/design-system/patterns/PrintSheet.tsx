// ============================================================
// Tên file: src/design-system/patterns/PrintSheet.tsx
// Tên tiếng Việt: Khung phiếu in A4 dùng chung (báo cáo)
// Description: Reusable A4 print sheet overlay + print table cells
// ============================================================
import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { ONhapSo } from "./ONhapSo";

/**
 * PhieuIn — khung bản in A4 NGANG dùng chung cho các màn Báo cáo.
 *
 * Là lớp phủ toàn màn (`fixed inset-0`) nền trắng; khi bấm "In / Xuất PDF" thì
 * `@media print` (src/index.css) chỉ in vùng `.print-root`, ẩn thanh công cụ
 * `.no-print` và phần app còn lại. Toàn bộ style riêng cho bản in (slate, IN HOA,
 * cỡ nhỏ) nằm Ở ĐÂY (tầng design-system) để màn nghiệp vụ không phải viết
 * `text-xs`/`uppercase` — đúng ranh giới của CLAUDE.md §3.
 */
export function PhieuIn({
  tieuDe,
  phuDe,
  onClose,
  children,
}: {
  tieuDe: string;
  phuDe?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="print-root print-landscape fixed inset-0 z-50 overflow-auto bg-white p-6 text-slate-900 sm:p-10">
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
          <h1 className="text-lg font-bold uppercase tracking-wide">{tieuDe}</h1>
          {phuDe ? <p className="text-sm font-semibold uppercase">{phuDe}</p> : null}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/** Cỡ tem thông dụng (mm) — máy in tem nhiệt hay dùng các khổ này. */
const CO_TEM = [
  { rong: 50, cao: 30, nhan: "50×30" },
  { rong: 40, cao: 30, nhan: "40×30" },
  { rong: 35, cao: 25, nhan: "35×25" },
  { rong: 60, cao: 40, nhan: "60×40" },
  { rong: 100, cao: 50, nhan: "100×50" },
];
const keo = (v: number) => Math.max(10, Math.min(200, Math.round(v) || 0));
const keoBan = (v: number) => Math.max(1, Math.min(500, Math.round(v) || 1));

/** Một tem trong lượt in: mã lô (to, một dòng) + ảnh QR + các dòng phụ. */
export interface TemIn {
  maLo: string;
  qrDataUrl: string;
  dong?: string[];
  /** Số bản in của tem này (VD mỗi block một tem). Mặc định 1, sửa được ở xem trước. */
  soBan?: number;
}

/** Một tem — co giãn theo khổ nhờ container-query, dùng chung cho xem trước và bản in. */
function KhoiTem({ tem, rong, cao, px, cuoi }: { tem: TemIn; rong: number; cao: number; px: number; cuoi?: boolean }) {
  const { maLo, qrDataUrl, dong = [] } = tem;
  return (
    <div
      className={`print-tem-box shrink-0 border border-slate-300 bg-white${cuoi ? " print-tem-cuoi" : ""}`}
      style={{ width: rong * px, height: cao * px, containerType: "size" }}
    >
      <div className="flex h-full w-full items-center" style={{ gap: "4cqw", padding: "6cqmin" }}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR mã lô ${maLo}`}
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
            {maLo || "—"}
          </div>
          {dong.map((d, i) => (
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
 * PhieuInTem — bản in TEM NHÃN khổ nhỏ (khác PhieuIn khổ A4), cho mã lô + QR.
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
export function PhieuInTem({
  onClose,
  maLo = "",
  qrDataUrl = "",
  dong = [],
  tems,
  onIn,
  rongMacDinh = 50,
  caoMacDinh = 30,
}: {
  onClose: () => void;
  /** Gọi ngay trước khi mở hộp in (vd ghi sổ in tem) — kèm số bản của từng tem. */
  onIn?: (soBan: number[]) => void;
  maLo?: string;
  qrDataUrl?: string;
  dong?: string[];
  tems?: TemIn[];
  rongMacDinh?: number;
  caoMacDinh?: number;
}) {
  const [rong, setRong] = useState(rongMacDinh);
  const [cao, setCao] = useState(caoMacDinh);
  const ds: TemIn[] = tems ?? [{ maLo, qrDataUrl, dong }];
  const [soBan, setSoBan] = useState<number[]>(() => ds.map((t) => keoBan(t.soBan ?? 1)));
  const banCua = (i: number) => soBan[i] ?? 1;
  const tongTem = ds.reduce((s, _, i) => s + banCua(i), 0);
  const nhieu = tongTem > 1;
  const PX = nhieu ? 4 : 6; // px mỗi mm khi xem trước (chỉ ảnh hưởng màn, không ảnh hưởng bản in)
  const laChon = (r: number, c: number) => r === rong && c === cao;
  const printCss = `@media print {
  @page { size: ${rong}mm ${cao}mm; margin: 0; }
  html, body { margin: 0 !important; background: #fff !important; }
  body > *:not(.print-tem) { display: none !important; }
  .print-tem { position: static !important; overflow: visible !important; padding: 0 !important; }
  .print-tem-list { display: block !important; }
  .print-tem-box { width: ${rong}mm !important; height: ${cao}mm !important; padding: 2mm; box-sizing: border-box;
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
            onIn?.(ds.map((_, i) => banCua(i)));
            window.print();
          }}
          title={
            nhieu
              ? `Mở hộp in của trình duyệt để in ${tongTem} tem, mỗi tem một nhãn. Chọn khổ giấy tem trước khi in.`
              : "Mở hộp in của trình duyệt để in tem. Chọn khổ giấy tem trước khi in."
          }
        >
          <Printer className="size-4" /> {nhieu ? `In ${tongTem} tem` : "In tem"}
        </Button>
      </div>

      <div className="no-print mx-auto mb-3 flex max-w-3xl flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600">Khổ tem:</span>
        {CO_TEM.map((c) => (
          <Button
            key={c.nhan}
            size="sm"
            variant={laChon(c.rong, c.cao) ? "default" : "outline"}
            title={`Đổi khổ tem sang ${c.nhan} mm.`}
            onClick={() => {
              setRong(c.rong);
              setCao(c.cao);
            }}
          >
            {c.nhan}
          </Button>
        ))}
        <span className="ml-1 flex items-center gap-1 text-sm text-slate-600">
          <span className="ml-1">Tự chọn</span>
          <ONhapSo
            value={rong}
            onChange={(v) => v != null && setRong(keo(v))}
            donVi="mm"
            khungClassName="inline-block"
            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
            aria-label="Chiều rộng tem (mm)"
          />
          <span aria-hidden>×</span>
          <ONhapSo
            value={cao}
            onChange={(v) => v != null && setCao(keo(v))}
            donVi="mm"
            khungClassName="inline-block"
            className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
            aria-label="Chiều cao tem (mm)"
          />
          <span>mm</span>
        </span>
      </div>

      <p className="no-print mx-auto mb-3 max-w-3xl text-center text-sm text-slate-500">
        {nhieu ? `${tongTem} tem — ` : ""}Xem trước (đã phóng to, mỗi lô hiện một tem). Khi in sẽ ra đúng khổ {rong}×{cao} mm
        {nhieu ? ", mỗi tem một nhãn" : ""} — chọn máy in tem trong hộp thoại in.
      </p>

      <div className="print-tem-list mx-auto flex max-w-5xl flex-wrap justify-center gap-4">
        {ds.map((t, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <KhoiTem tem={t} rong={rong} cao={cao} px={PX} cuoi={i === ds.length - 1 && banCua(i) === 1} />
            {/* Bản sao: ẩn trên màn, chỉ hiện khi in (.print-tem-sao trong printCss). */}
            {Array.from({ length: banCua(i) - 1 }, (_, k) => (
              <div key={k} className="print-tem-sao" style={{ display: "none" }}>
                <KhoiTem tem={t} rong={rong} cao={cao} px={PX} cuoi={i === ds.length - 1 && k === banCua(i) - 2} />
              </div>
            ))}
            <label className="no-print flex items-center gap-1 text-sm text-slate-600">
              Số tem
              <ONhapSo
                value={banCua(i)}
                onChange={(v) => v != null && setSoBan((cu) => ds.map((_, j) => (j === i ? keoBan(v) : (cu[j] ?? 1))))}
                khungClassName="inline-block"
                className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
                aria-label={`Số tem in cho lô ${t.maLo}`}
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
export function ThIn({
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
export function TdIn({
  children,
  right,
  dam,
  rowSpan,
  colSpan,
  className = "",
}: {
  children?: ReactNode;
  right?: boolean;
  dam?: boolean;
  rowSpan?: number;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`border border-slate-400 px-2 py-1 text-sm ${right ? "text-right" : "text-left"} ${
        dam ? "bg-slate-50 font-bold" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}
