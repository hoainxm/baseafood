// ============================================================
// Tên file: src/features/production-orders/orderText.ts
// Tên tiếng Việt: Chữ hiển thị dùng chung của màn Lệnh sản xuất (tháng, nhãn chuyến)
// Description: Small display-text helpers shared by the order views and dialogs.
// ============================================================
import type { ExportShipment } from "@/types";

export const monthText = (m: string) => `Tháng ${Number(m.slice(5, 7))}/${m.slice(0, 4)}`;

/** Nhãn một chuyến xuất: tháng kế hoạch · loại chuyến · số cont. */
export const shipmentLabel = (s: ExportShipment) =>
  [s.planMonth ? monthText(s.planMonth) : "", s.kind === "truck" ? "Xe tải" : s.kind === "consolidated" ? "Đóng ghép" : s.kind, s.containerNo || "chưa có số cont"]
    .filter(Boolean)
    .join(" · ");
