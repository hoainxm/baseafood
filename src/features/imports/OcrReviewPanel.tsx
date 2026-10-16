// ============================================================
// Tên file: src/features/imports/OcrReviewPanel.tsx
// Tên tiếng Việt: Bảng đối chiếu ảnh phiếu ⇄ bản máy đọc (OCR)
// Description: Ảnh phiếu thật cạnh bảng "Trên phiếu → Điền vào sổ", tick ô để dùng
// ============================================================
import { useState, type ReactNode } from "react";
import { Button, Tag } from "@/design-system";
import { Minus, Plus as PlusIcon, Maximize2 } from "lucide-react";
import type { OcrResult, OcrCatalog } from "@/lib/ocr";
import { kg as fmtKg, formatDateVN, num } from "@/lib/format";
import type { OcrHeaderField, OcrSelection } from "./importHelpers";

/** Mức phóng ảnh: 1 = vừa khung. */
const ZOOM_STEPS = [1, 1.5, 2, 3];

/**
 * Ảnh phiếu thật để đặt cạnh bảng đối chiếu. Phóng to bằng nút (ảnh to hơn khung thì
 * cuộn trong khung), "Mở ảnh gốc" mở tab mới cho xem kỹ trên máy tính.
 */
export function SlipImageViewer({ src }: { src: string }) {
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = ZOOM_STEPS[zoomIdx];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Ảnh phiếu</span>
        <Button
          title="Thu nhỏ ảnh phiếu."
          variant="outline"
          size="sm"
          onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
          aria-label="Thu nhỏ ảnh"
        >
          <Minus />
        </Button>
        <span className="tnum w-12 text-center text-sm text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          title="Phóng to ảnh phiếu để đọc rõ chữ tay."
          variant="outline"
          size="sm"
          onClick={() =>
            setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))
          }
          aria-label="Phóng to ảnh"
        >
          <PlusIcon />
        </Button>
        <Button
          title="Mở ảnh phiếu gốc ở thẻ mới để xem kỹ."
          variant="outline"
          size="sm"
          onClick={() => window.open(src, "_blank", "noopener")}
        >
          <Maximize2 />
          Mở ảnh gốc
        </Button>
      </div>
      <div className="max-h-[45dvh] overflow-auto rounded-lg border border-border bg-muted lg:max-h-[70dvh]">
        <img
          src={src}
          alt="Ảnh phiếu nhập đang đối chiếu"
          className="block h-auto max-w-none"
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
    </div>
  );
}

const HEADER_LABEL: Record<OcrHeaderField, string> = {
  date: "Ngày hàng về",
  supplier: "Đại lý",
  workshop: "Xưởng",
  licensePlate: "Biển số xe",
  driverName: "Tài xế",
};

/** Ô "Trên phiếu" trống ⇒ gạch ngang mờ (phiếu không ghi / máy không chép được). */
const RawCell = ({ text }: { text?: string }) =>
  text ? (
    <span className="font-mono text-sm">{text}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );

const checkboxClass = "size-5 accent-primary";

/**
 * Bảng đối chiếu: mỗi ô một hàng "Trên phiếu (chữ máy chép y) → Điền vào sổ (đã khớp
 * danh mục)" + nhãn trạng thái + ô tick. Người soát đặt cạnh ảnh, BỎ tick ô sai; chỉ ô
 * đang tick được điền. Dòng tổng đối chiếu với tổng ghi ở chân phiếu.
 */
export function OcrReviewTable({
  result,
  catalog,
  selection,
  onSelectionChange,
  showPrice = true,
}: {
  /** Phân quyền: không có Xem giá ở Nhập hàng ⇒ ẩn đơn giá đọc từ phiếu. */
  showPrice?: boolean;
  result: OcrResult;
  catalog: OcrCatalog;
  selection: OcrSelection;
  onSelectionChange: (s: OcrSelection) => void;
}) {
  const raw = result.rawHeader ?? {};
  const knownPlates = new Set(
    (catalog.knownPlates ?? []).map((p) => p.toUpperCase()),
  );
  const knownDrivers = new Set(
    (catalog.knownDrivers ?? []).map((d) => d.toLowerCase()),
  );

  const toggleHeader = (f: OcrHeaderField) => {
    const header = new Set(selection.header);
    if (header.has(f)) header.delete(f);
    else header.add(f);
    onSelectionChange({ ...selection, header });
  };
  const toggleLine = (i: number) => {
    const lines = new Set(selection.lines);
    if (lines.has(i)) lines.delete(i);
    else lines.add(i);
    onSelectionChange({ ...selection, lines });
  };

  /** Giá trị hiển thị + nhãn trạng thái của một ô đầu chuyến. */
  const headerCell = (
    f: OcrHeaderField,
  ): { value?: string; status?: ReactNode } => {
    const v = result[f];
    if (!v)
      return {
        status: raw[f] ? (
          <Tag variant="warning">
            {f === "supplier"
              ? "Chưa khớp, chọn tay"
              : "Chưa hiểu, điền tay"}
          </Tag>
        ) : undefined,
      };
    if (f === "date") return { value: formatDateVN(v) };
    if (f === "supplier" || f === "workshop")
      return { value: v, status: <Tag variant="done">Khớp danh mục</Tag> };
    const known =
      f === "licensePlate"
        ? knownPlates.has(v.toUpperCase())
        : knownDrivers.has(v.toLowerCase());
    return {
      value: v,
      status: known ? (
        <Tag variant="done">Đã có trong sổ</Tag>
      ) : (
        <Tag variant="warning">Mới, kiểm kỹ</Tag>
      ),
    };
  };

  /** Chỉ hiện ô có gì để đối chiếu (máy hiểu được, hoặc ít nhất chép được chữ). */
  const headerFields = (Object.keys(HEADER_LABEL) as OcrHeaderField[]).filter(
    (f) => !!result[f] || !!raw[f],
  );
  const selectedLines = result.lines.filter((_, i) => selection.lines.has(i));
  const sumKg = selectedLines.reduce((t, l) => t + l.kg, 0);
  const allLinesKg = result.lines.reduce((t, l) => t + l.kg, 0);
  const totalMatches =
    result.totalKg == null || Math.abs(allLinesKg - result.totalKg) <= 0.5;

  const th =
    "border-b-2 border-border bg-card px-2 py-2 text-left text-sm font-semibold";
  const td = "border-b border-border px-2 py-2 align-top [overflow-wrap:anywhere]";

  return (
    <div className="space-y-4">
      {/* Đầu chuyến — 3 cột ở MỌI cỡ màn (điện thoại không phải cuộn ngang) */}
      {headerFields.length > 0 && (
        <table className="w-full table-fixed border-collapse text-base">
          <thead>
            <tr>
              <th className={`${th} w-9`} aria-label="Dùng ô này" />
              <th className={`${th} w-[38%]`}>Trên phiếu</th>
              <th className={th}>Điền vào sổ</th>
            </tr>
          </thead>
          <tbody>
            {headerFields.map((f) => {
              const { value, status } = headerCell(f);
              return (
                <tr
                  key={f}
                  className={
                    value && !selection.header.has(f) ? "opacity-50" : undefined
                  }
                >
                  <td className={td}>
                    {value && (
                      <input
                        type="checkbox"
                        className={checkboxClass}
                        checked={selection.header.has(f)}
                        onChange={() => toggleHeader(f)}
                        aria-label={`Dùng ${HEADER_LABEL[f].toLowerCase()} máy đọc được`}
                      />
                    )}
                  </td>
                  <td className={td}>
                    <div className="text-sm text-muted-foreground">
                      {HEADER_LABEL[f]}
                    </div>
                    <RawCell text={raw[f]} />
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {value && <span className="font-semibold">{value}</span>}
                      {status}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Dòng loại NL — cùng 3 cột: chữ trên phiếu | loại · kg · giá sẽ điền (giá ẩn nếu không có quyền Xem giá) */}
      {result.lines.length > 0 ? (
        <table className="w-full table-fixed border-collapse text-base">
          <thead>
            <tr>
              <th className={`${th} w-9`} aria-label="Dùng dòng này" />
              <th className={`${th} w-[38%]`}>Trên phiếu</th>
              <th className={th}>Điền vào sổ</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((l, i) => (
              <tr
                key={i}
                className={selection.lines.has(i) ? undefined : "opacity-50"}
              >
                <td className={td}>
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={selection.lines.has(i)}
                    onChange={() => toggleLine(i)}
                    aria-label={`Dùng dòng ${l.materialType}`}
                  />
                </td>
                <td className={td}>
                  <RawCell text={l.raw} />
                </td>
                <td className={td}>
                  <div className="font-semibold">{l.materialType}</div>
                  <div className="tnum text-sm">
                    <span className="font-semibold">{fmtKg(l.kg)}</span>
                    {showPrice && (
                      <>
                        {" · "}
                        {l.unitPrice != null ? (
                          `${num(l.unitPrice)} đ/kg`
                        ) : (
                          <span className="text-muted-foreground">
                            giữ giá lượt trước
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-2 py-2" />
              <td
                className="px-2 py-2 text-sm text-muted-foreground"
                colSpan={2}
              >
                Cộng {selectedLines.length} dòng đã chọn:{" "}
                <span className="tnum font-semibold">{fmtKg(sumKg)}</span>
                {result.totalKg != null && (
                  <>
                    {" · "}tổng trên phiếu{" "}
                    <span className="tnum font-semibold">
                      {fmtKg(result.totalKg)}
                    </span>{" "}
                    {totalMatches ? (
                      <Tag variant="done">Khớp</Tag>
                    ) : (
                      <Tag variant="error">
                        Lệch {fmtKg(Math.abs(allLinesKg - result.totalKg))}
                      </Tag>
                    )}
                  </>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="text-base text-muted-foreground">
          Chưa ghép được dòng loại NL + số lượng nào. Xem toàn văn bên dưới để
          điền tay.
        </p>
      )}
    </div>
  );
}
