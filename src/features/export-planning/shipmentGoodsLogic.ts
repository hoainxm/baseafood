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
  // Đóng cont điền số sau khi đóng hàng, chọn từ dòng hàng của HĐ — không chờ Phòng KH (feedback 2026-11-03, mig 0098).
  if (!s.lineCount) return "Chưa điền — đóng cont xong, bộ phận đóng cont điền số kiện thực đóng theo dòng hàng của hợp đồng.";
  if (!s.filledCount) return `Chưa điền — ${s.lineCount} dòng, kế hoạch ${formatNumber(s.plannedUnits)} kiện.`;
  const compared = s.filledCount - s.unplannedCount;
  const diff = !compared ? "" : s.diffUnits === 0 ? " (khớp kế hoạch)" : s.diffUnits < 0 ? ` (thiếu ${formatNumber(-s.diffUnits)} so với kế hoạch)` : ` (thừa ${formatNumber(s.diffUnits)} so với kế hoạch)`;
  return `Đã điền ${s.filledCount}/${s.lineCount} dòng · ${formatNumber(s.loadedUnits)} kiện thực đóng${diff}. Chứng từ lấy số này làm invoice.`;
}

/** Dòng hàng (bản đang dùng) của MỘT HĐ — chuyến gộp có nhiều nhóm (ba-spec 70). */
export interface ContractLineGroup {
  contractId: string;
  contractNo: string;
  lines: readonly ExportContractLine[];
}

export interface ShipmentLinesTarget {
  shipment: ExportShipment;
  label: string;
  /** HĐ đang có hàng trên chuyến, HĐ chính đầu tiên. */
  groups: readonly ContractLineGroup[];
  /** HĐ khác của cùng khách thêm hàng vào chuyến được (đủ cổng ghi chuyến — ba-spec 70 R1, R4). */
  addable: readonly ContractLineGroup[];
  /** Hàng đang có của chuyến này. */
  lines: readonly ExportShipmentLine[];
  /** Σ số kiện các chuyến KHÁC (chưa hủy) đã lên theo id dòng HĐ — nhắc phần còn lại. */
  otherShipmentUnits: Record<string, number>;
}

/** Một dòng trong hộp: dòng HĐ + giá trị đang sửa (số kiện trống = không đóng vào chuyến này). */
export interface LineDraft {
  /** HĐ của dòng — chuyến gộp nhiều HĐ (ba-spec 70). */
  contractId: string;
  contractLineId: string;
  lineId: string;
  description: string;
  size: string;
  packing: string;
  plannedUnits: number | null;
  grossKgPerUnit: number | null;
  expiry: string;
}

export const groupLines = (groups: readonly ContractLineGroup[]): ExportContractLine[] => groups.flatMap((g) => g.lines);

/** Dòng của hộp cho một nhóm HĐ: mỗi dòng HĐ một dòng, lấy số đang có của chuyến nếu có. */
export function draftRowsOf(group: ContractLineGroup, lines: readonly ExportShipmentLine[]): LineDraft[] {
  return group.lines.map((cl) => {
    const own = lines.find((l) => l.contractLineId === cl.id);
    return {
      contractId: group.contractId,
      contractLineId: cl.id,
      lineId: own?.id ?? "",
      description: own?.description ?? cl.description,
      size: own?.size ?? cl.size,
      packing: own?.packing ?? cl.packing,
      plannedUnits: own?.plannedUnits ?? null,
      grossKgPerUnit: own?.grossKgPerUnit ?? null,
      expiry: own?.expiry ?? "",
    };
  });
}

/** Ghép dòng của hộp thành hàng của chuyến: giữ id, số thực đóng kho đã điền; bỏ dòng không có số kiện. */
export function linesFromDraft(tg: ShipmentLinesTarget, rows: readonly LineDraft[], makeId: () => string): ExportShipmentLine[] {
  const out: ExportShipmentLine[] = [];
  rows.forEach((r, i) => {
    const own = tg.lines.find((l) => l.id === r.lineId);
    const planned = r.plannedUnits != null && r.plannedUnits > 0 ? r.plannedUnits : null;
    // Dòng đóng cont đã điền số thực đóng (có thể do đóng cont tự tạo, không kế hoạch — mig 0098) KHÔNG được mất
    // khi Phòng KH lưu mà để trống số kế hoạch.
    if (planned == null && own?.loadedUnits == null) return;
    const cl = groupLines([...tg.groups, ...tg.addable]).find((c) => c.id === r.contractLineId);
    const base = own ?? (cl ? shipmentLineFromContract(cl, { id: makeId(), shipmentId: tg.shipment.id, contractId: r.contractId || tg.shipment.contractId, sortOrder: 0 }) : null);
    if (!base) return;
    out.push({
      ...base,
      sortOrder: (i + 1) * 10,
      description: r.description.trim(),
      size: r.size.trim(),
      packing: r.packing.trim(),
      plannedUnits: planned,
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
