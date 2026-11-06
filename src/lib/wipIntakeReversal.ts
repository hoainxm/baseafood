// ============================================================
// DUYỆT NHẬP KHO / HỦY DUYỆT một lô bán thành phẩm (Kho dự trữ, audit 2026-11-06).
// Duyệt ghi đè kg / block / kho / ghi chú của mẻ bằng số thực ⇒ trước đây mất số xưởng ghi.
// Giờ chụp lại số gốc vào `preApproval` (cột production_wips.pre_approval, mig 0108) để:
//   • luôn đối chiếu được "xưởng ghi X kg — kho nhận Y kg";
//   • Hủy duyệt trả lô về Chờ nhập kho với ĐÚNG số gốc.
// Chặn Hủy duyệt khi lô đã đi (lệnh xuất, bán gắn lô, đóng gói dùng lô, FIFO đã trừ vào lô)
// hoặc kỳ Cân đối đã hút mẻ mà hủy sẽ đổi số kg.
// ============================================================
import type { ExportItem, LotDispatch, LotInput, WipPreApproval, WipProductionItem } from "@/types";
import type { LotStock } from "@/lib/inventory";

export interface IntakeApprovalForm {
  warehouse: string;
  actualKg: number;
  actualBlocks: number;
  note: string;
}

/** Duyệt nhập kho: số thực vào mẻ + chụp số gốc (chỉ chụp khi chưa có, giữ bản gốc đầu tiên). */
export function approveWipIntake(
  wip: WipProductionItem,
  form: IntakeApprovalForm,
  meta: { approvedBy: string; approvedAt: string },
): WipProductionItem {
  const preApproval: WipPreApproval = wip.preApproval ?? {
    quantityKg: wip.quantityKg,
    blocksCount: wip.blocksCount,
    warehouse: wip.warehouse,
    note: wip.note,
    approvedBy: meta.approvedBy,
    approvedAt: meta.approvedAt,
  };
  return {
    ...wip,
    warehouse: form.warehouse,
    quantityKg: form.actualKg,
    blocksCount: form.actualBlocks,
    status: "stocked",
    note: form.note || wip.note,
    preApproval: { ...preApproval, approvedBy: meta.approvedBy, approvedAt: meta.approvedAt },
  };
}

export interface IntakeReversalContext {
  lotStock: readonly LotStock[];
  exportItems: readonly ExportItem[];
  lotDispatches: readonly LotDispatch[];
  lotInputs: readonly LotInput[];
}

export type IntakeReversalCheck = { ok: true; restoredKg: number; hasSnapshot: boolean } | { ok: false; reason: string };

const KG_EPSILON = 0.001;

export function checkIntakeReversal(wip: WipProductionItem, ctx: IntakeReversalContext): IntakeReversalCheck {
  if (wip.status !== "stocked") return { ok: false, reason: "Lô này đang Chờ nhập kho, chưa duyệt nên không có gì để hủy." };
  const exportCount = ctx.exportItems.filter((d) => d.wipId === wip.id).length;
  if (exportCount > 0) {
    return {
      ok: false,
      reason: `Lô đã nằm trong ${exportCount} dòng lệnh xuất. Mở đơn ở màn Đơn đặt, bấm Hủy lệnh xuất trước, rồi mới hủy duyệt được.`,
    };
  }
  if (ctx.lotInputs.some((x) => x.inputKind === "W" && x.inputId === wip.id)) {
    return {
      ok: false,
      reason: "Lô đã được gắn làm đầu vào của phiếu đóng gói. Gỡ lô khỏi phiếu đóng gói ở màn Đóng gói trước.",
    };
  }
  if (ctx.lotDispatches.some((x) => x.lotKind === "W" && x.lotId === wip.id && x.docKind !== "export_item")) {
    return {
      ok: false,
      reason: "Lô đã được gắn cho dòng bán. Gỡ lô khỏi phiếu bán ở màn Bán hàng trước.",
    };
  }
  const lot = ctx.lotStock.find((t) => t.wipId === wip.id);
  if (lot && lot.outKg > KG_EPSILON) {
    return {
      ok: false,
      reason: `Lô đã bị trừ ${lot.outKg.toLocaleString("vi-VN")} kg (bán lẻ / đóng gói lấy lô cũ nhất trước). Sửa phiếu bán hoặc đóng gói đó trước.`,
    };
  }
  const restoredKg = wip.preApproval ? wip.preApproval.quantityKg : wip.quantityKg;
  if (wip.balancingPeriodId && Math.abs(restoredKg - wip.quantityKg) > KG_EPSILON) {
    return {
      ok: false,
      reason: "Kỳ cân đối đã hút mẻ này; hủy duyệt sẽ đổi số kg và làm lệch kỳ. Gỡ mẻ khỏi kỳ ở màn Cân đối trước.",
    };
  }
  return { ok: true, restoredKg, hasSnapshot: Boolean(wip.preApproval) };
}

/**
 * Hủy duyệt: về Chờ nhập kho với số gốc (kg, block, kho, ghi chú). Lô duyệt trước bản này
 * không có số gốc ⇒ chỉ đổi trạng thái, giữ số đang có.
 */
export function revertWipIntake(wip: WipProductionItem): WipProductionItem {
  const snap = wip.preApproval;
  if (!snap) return { ...wip, status: "pending" };
  return {
    ...wip,
    status: "pending",
    quantityKg: snap.quantityKg,
    blocksCount: snap.blocksCount,
    warehouse: snap.warehouse,
    note: snap.note,
    preApproval: null,
  };
}
