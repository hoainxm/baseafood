// ============================================================
// Tên file: src/features/production-orders/useContractActivity.ts
// Tên tiếng Việt: Dòng nhật ký hồ sơ HĐ xuất khẩu do khu Lệnh sản xuất ghi
// Description: Việc làm ở Lệnh sản xuất mà đổi hồ sơ HĐ xuất (lập / phát hành / gắn chuyến / hủy lệnh, chép mã số lô
//              sang chuyến, bước Lệnh sản xuất của chuyến tự xong) vào khối "Nhật ký thao tác" của hồ sơ HĐ — cùng
//              bảng nhật ký nhóm Kế hoạch (ba-spec 56; ghi qua `usePlanningActivityLog`, một bộ ghi mỗi trang).
// ============================================================
import type { ActivityInput } from "@/features/shared/activityLog";
import type { ExportActivityAction, ExportShipment } from "@/types";

/** Tên chuyến như trang Xuất khẩu gọi: "lô 205" / "booking …" / "chưa có mã lô". */
export const shipmentLabel = (s: Pick<ExportShipment, "lotCode" | "bookingNo"> | undefined): string =>
  s ? (s.lotCode ? `lô ${s.lotCode}` : s.bookingNo ? `booking ${s.bookingNo}` : "chưa có mã lô") : "";

export interface ContractActivityInput {
  contractId: string;
  shipmentId?: string;
  action: ExportActivityAction;
  summary: string;
}

export const contractInput = (x: ContractActivityInput): ActivityInput => ({
  recordType: "export-contract",
  recordId: x.contractId,
  shipmentId: x.shipmentId,
  action: x.action,
  summary: x.summary,
});
