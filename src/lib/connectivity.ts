// ============================================================
// Tên file cũ: src/lib/ketNoi.ts
// Tên tiếng Việt: Trạng thái Kết nối Mạng & Queue đồng bộ
// Description: Network connectivity state tracking and sync offline queue manager
// ============================================================
/**
 * Trạng thái kết nối máy chủ DÙNG CHUNG.
 *
 * repo.ts báo vào đây sau MỖI lần đọc/ghi Supabase (mọi bảng, mọi lúc),
 * TrangThaiDuLieu đọc ra. Nhờ vậy đèn báo phản ánh sức khỏe ghi/đọc THẬT —
 * một lần ghi bảng bất kỳ thất bại là đỏ ngay — thay vì tự probe 1 bảng 1 lần
 * lúc mở app rồi xanh mãi.
 *
 * Quy ước "lần gần nhất thắng": thao tác server mới nhất quyết định màu. Ghi
 * lỗi → đỏ; lần ghi sau thành công → xanh lại. Hợp trực giác người dùng
 * ("lần lưu vừa rồi có lên máy chủ không").
 */

export type TrangKetNoi = "chua-ro" | "da-noi" | "loi";

export interface AnhTrangKetNoi {
  trang: TrangKetNoi;
  loi: string;
}

// Snapshot bất biến — đổi tham chiếu chỉ khi trạng thái đổi, để
// useSyncExternalStore không render vô hạn.
let anh: AnhTrangKetNoi = { trang: "chua-ro", loi: "" };
const nguoiNghe = new Set<() => void>();

function dat(trang: TrangKetNoi, loi: string) {
  if (anh.trang === trang && anh.loi === loi) return;
  anh = { trang, loi };
  nguoiNghe.forEach((f) => f());
}

export const ketNoi = {
  /** Một thao tác server vừa thành công. */
  baoOK: () => dat("da-noi", ""),
  /** Một thao tác server vừa lỗi (kèm thông báo để hiện cho người dùng). */
  baoLoi: (thongBao: string) => dat("loi", thongBao),
  subscribe: (f: () => void) => {
    nguoiNghe.add(f);
    return () => {
      nguoiNghe.delete(f);
    };
  },
  laySnapshot: (): AnhTrangKetNoi => anh,
};
