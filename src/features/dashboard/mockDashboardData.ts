// ============================================================
// Tên file cũ: src/features/dashboard/duLieu.ts
// Tên tiếng Việt: Dữ liệu mẫu cho Dashboard
// Description: Mock Dashboard Analytics Data
// ============================================================
// src/features/dashboard/duLieu.ts
/**
 * Dữ liệu mẫu + kiểu cho màn Tổng quan sản xuất. Giữ nguyên số liệu tiếng Việt
 * từ prototype ManTongQuan.js — đây là màn TRƯNG BÀY (chưa nối bảng thật: OEE,
 * dây chuyền, lệnh sản xuất chưa số hóa trong nghiệp vụ gốc).
 */

export type TrangDayChuyen =
  | "running"
  | "idle"
  | "stopped"
  | "maintenance"
  | "changeover";

export type MucCanhBao = "stopped" | "idle" | "changeover";

export interface DiemGio {
  gio: string;
  thuc: number;
  ke: number;
}

export interface ChiTietOEE {
  sanSang: string;
  hieuSuat: string;
  chatLuong: string;
}

export interface DayChuyen {
  id: string;
  ten: string;
  trang: TrangDayChuyen;
  metricNhan: string;
  metric: string;
  chiTiet: ChiTietOEE;
}

export interface LenhSanXuat {
  id: string;
  sp: string;
  kh: string;
  tienDo: number;
  han: string;
  gap: boolean;
}

export interface CanhBaoItem {
  id: string;
  muc: MucCanhBao;
  gio: string;
  chu: string;
  them: string;
}

export const DASH_GIO: DiemGio[] = [
  { gio: "6:00", thuc: 380, ke: 400 },
  { gio: "7:00", thuc: 720, ke: 800 },
  { gio: "8:00", thuc: 1180, ke: 1200 },
  { gio: "9:00", thuc: 1610, ke: 1600 },
  { gio: "10:00", thuc: 2050, ke: 2000 },
  { gio: "11:00", thuc: 2380, ke: 2400 },
  { gio: "12:00", thuc: 2520, ke: 2800 },
  { gio: "13:00", thuc: 2900, ke: 3200 },
  { gio: "14:00", thuc: 3380, ke: 3600 },
  { gio: "15:00", thuc: 3900, ke: 4000 },
  { gio: "16:00", thuc: 4420, ke: 4400 },
  { gio: "17:00", thuc: 4880, ke: 4800 },
  { gio: "18:00", thuc: 5210, ke: 5200 },
  { gio: "19:00", thuc: 5480, ke: 5600 },
  { gio: "20:00", thuc: 5760, ke: 6000 },
  { gio: "21:00", thuc: 6020, ke: 6400 },
  { gio: "22:00", thuc: 6180, ke: 6800 },
];

export const DASH_LINE: DayChuyen[] = [
  { id: "l1", ten: "Line 1 — Sơ chế mực", trang: "running", metricNhan: "OEE", metric: "82%", chiTiet: { sanSang: "94%", hieuSuat: "89%", chatLuong: "98%" } },
  { id: "l2", ten: "Line 2 — Hấp luộc", trang: "running", metricNhan: "OEE", metric: "91%", chiTiet: { sanSang: "97%", hieuSuat: "95%", chatLuong: "99%" } },
  { id: "l3", ten: "Line 3 — Đông lạnh IQF", trang: "idle", metricNhan: "Lý do", metric: "Chờ nguyên liệu", chiTiet: { sanSang: "61%", hieuSuat: "0%", chatLuong: "—" } },
  { id: "l4", ten: "Line 4 — Đóng gói XK", trang: "running", metricNhan: "OEE", metric: "76%", chiTiet: { sanSang: "88%", hieuSuat: "87%", chatLuong: "99%" } },
  { id: "l5", ten: "Kho lạnh −25 °C", trang: "running", metricNhan: "Nhiệt độ", metric: "−24,8 °C", chiTiet: { sanSang: "100%", hieuSuat: "—", chatLuong: "—" } },
];

export const DASH_LSX: LenhSanXuat[] = [
  { id: "MQ-240810-001", sp: "Mực ống đông lạnh block 10 kg", kh: "Daiwa Seafood (JP)", tienDo: 78, han: "11/08/2026", gap: true },
  { id: "BT-240810-004", sp: "Bạch tuộc hấp cắt khúc IQF", kh: "Hansung Trading (KR)", tienDo: 45, han: "13/08/2026", gap: false },
  { id: "MQ-240809-011", sp: "Mực nang làm sạch đông block", kh: "Ocean Fresh (EU)", tienDo: 92, han: "10/08/2026", gap: true },
  { id: "CT-240809-002", sp: "Cá thu cắt khúc đông lạnh", kh: "Siêu thị nội địa", tienDo: 30, han: "16/08/2026", gap: false },
  { id: "TS-240808-007", sp: "Tôm sú vỏ đông block 2 kg", kh: "Daiwa Seafood (JP)", tienDo: 64, han: "14/08/2026", gap: false },
  { id: "BT-240808-009", sp: "Bạch tuộc 2 da nguyên con", kh: "Hansung Trading (KR)", tienDo: 12, han: "18/08/2026", gap: false },
];

export const DASH_ALERT: CanhBaoItem[] = [
  { id: "a1", muc: "stopped", gio: "14:32", chu: "Nhiệt độ kho C3 vượt ngưỡng (−22 °C > −25 °C)", them: "Dàn lạnh số 2 chạy quá tải 40 phút. Cần kỹ thuật kiểm tra ngay; hàng trong kho C3 là lô MQ-240809-011 chờ giao 10/08." },
  { id: "a2", muc: "idle", gio: "13:15", chu: "Line 3 dừng 15 phút — thiếu nguyên liệu mực ống", them: "Chuyến hàng đại lý H.Phú về muộn. Tổ sơ chế đã chuyển sang lô bạch tuộc để không dừng cả tuyến." },
  { id: "a3", muc: "changeover", gio: "12:00", chu: "Lô MQ-240810-001 đã qua QC checkpoint 3", them: "Kiểm kim loại và cân trọng lượng đạt. Còn checkpoint 4 (đóng thùng) trước khi nhập kho." },
  { id: "a4", muc: "stopped", gio: "10:47", chu: "Phát hiện 2 khay mực lỗi cảm quan ở Line 1", them: "Đã tách riêng 18 kg, chờ QC quyết định hạ phẩm cấp hay loại." },
  { id: "a5", muc: "idle", gio: "9:20", chu: "Ca A đổi ca muộn 12 phút", them: "Ảnh hưởng sản lượng giờ 9:00 khoảng 90 kg so với kế hoạch." },
];

export const DASH_MUC_NHAN: Record<MucCanhBao, string> = {
  stopped: "Nghiêm trọng",
  idle: "Cảnh báo",
  changeover: "Thông tin",
};
