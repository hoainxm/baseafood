// ============================================================
// Tên file: src/features/export-planning/shipmentGoodsLogic.ts
// Tên tiếng Việt: Luật của hộp Hàng của chuyến + câu tóm tắt số thực đóng
// Description: Pure helpers for ShipmentGoods (ba-spec 63) — kept out of the component file for fast refresh
// ============================================================
import { formatNumber } from "@/design-system";
import { loadingCountSummary, shipmentLineFromContract } from "@/lib/exportInvoice";
import type { ExportContractLine, ExportLoadingExtraStep, ExportShipment, ExportShipmentLine } from "@/types";

/** "Đã điền 2/2 dòng · 658 thùng (kế hoạch 661, thiếu 3)" — hàng Số thực đóng ở bước 4. */
export function loadingCountText(lines: readonly ExportShipmentLine[]): string {
  const s = loadingCountSummary(lines);
  if (!s.lineCount) return "Chuyến chưa có hàng chi tiết — Phòng KH nhập ở khối Hàng của chuyến.";
  if (!s.filledCount) return `Chưa điền — ${s.lineCount} dòng, kế hoạch ${formatNumber(s.plannedUnits)} kiện.`;
  const diff = s.diffUnits === 0 ? "khớp kế hoạch" : s.diffUnits < 0 ? `thiếu ${formatNumber(-s.diffUnits)} so với kế hoạch` : `thừa ${formatNumber(s.diffUnits)} so với kế hoạch`;
  return `Đã điền ${s.filledCount}/${s.lineCount} dòng · ${formatNumber(s.loadedUnits)} kiện thực đóng (${diff}).`;
}

export interface ShipmentLinesTarget {
  shipment: ExportShipment;
  label: string;
  /** Dòng hàng của bản HĐ đang dùng. */
  contractLines: readonly ExportContractLine[];
  /** Hàng đang có của chuyến này. */
  lines: readonly ExportShipmentLine[];
  /** Σ số kiện các chuyến KHÁC (chưa hủy) đã lên theo id dòng HĐ — nhắc phần còn lại. */
  otherShipmentUnits: Record<string, number>;
}

/** Một dòng trong hộp: dòng HĐ + giá trị đang sửa (số kiện trống = không đóng vào chuyến này). */
export interface LineDraft {
  contractLineId: string;
  lineId: string;
  description: string;
  size: string;
  packing: string;
  plannedUnits: number | null;
  grossKgPerUnit: number | null;
  expiry: string;
}

/** Ghép dòng của hộp thành hàng của chuyến: giữ id, số thực đóng kho đã điền; bỏ dòng không có số kiện. */
export function linesFromDraft(tg: ShipmentLinesTarget, rows: readonly LineDraft[], makeId: () => string): ExportShipmentLine[] {
  const out: ExportShipmentLine[] = [];
  rows.forEach((r, i) => {
    if (r.plannedUnits == null || r.plannedUnits <= 0) return;
    const cl = tg.contractLines.find((c) => c.id === r.contractLineId);
    if (!cl) return;
    const own = tg.lines.find((l) => l.id === r.lineId);
    const base = own ?? shipmentLineFromContract(cl, { id: makeId(), shipmentId: tg.shipment.id, contractId: tg.shipment.contractId, sortOrder: 0 });
    out.push({
      ...base,
      sortOrder: (i + 1) * 10,
      description: r.description.trim(),
      size: r.size.trim(),
      packing: r.packing.trim(),
      plannedUnits: r.plannedUnits,
      grossKgPerUnit: r.grossKgPerUnit,
      expiry: r.expiry.trim(),
    });
  });
  return out;
}

/** Chữ của 2 loại ảnh thêm ở bước 4 (mig 0097, chị Vi 2026-11-03). */
export const EXTRA_PHOTO_TEXT: Record<ExportLoadingExtraStep, { title: string; description: string; captionHint: string }> = {
  "loading-count-photos": {
    title: "Ảnh số lượng thực đóng",
    description: "Chụp tờ đếm / bảng ghi số thùng thực đóng, ảnh lớp hàng làm bằng chứng cho số thực đóng. Chọn nhiều ảnh một lần được.",
    captionHint: "VD: tờ đếm thùng ca sáng",
  },
  "package-weight-photos": {
    title: "Ảnh bao bì + cân gross",
    description: "Chụp thùng / nhãn bao bì và ảnh cân kg cả bì (gross) của thùng mẫu. Chọn nhiều ảnh một lần được.",
    captionHint: "VD: cân thùng size 2-4 = 11,2 kg",
  },
};
