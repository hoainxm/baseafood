// ============================================================
// Tên file cũ: src/lib/connectivity.ts
// Tên tiếng Việt: Trạng thái Kết nối Mạng & Queue đồng bộ
// Description: Network connectivity state tracking and sync offline queue manager
// ============================================================
/**
 * Trạng thái kết nối máy chủ DÙNG CHUNG.
 *
 * repo.ts báo vào đây sau MỖI lần đọc/ghi Supabase (mọi bảng, mọi lúc),
 * DataSyncStatus đọc ra. Nhờ vậy đèn báo phản ánh sức khỏe ghi/đọc THẬT —
 * một lần ghi bảng bất kỳ thất bại là đỏ ngay — thay vì tự probe 1 bảng 1 lần
 * lúc mở app rồi xanh mãi.
 *
 * Quy ước "lần gần nhất thắng": thao tác server mới nhất quyết định màu. Ghi
 * lỗi → đỏ; lần ghi sau thành công → xanh lại. Hợp trực giác người dùng
 * ("lần lưu vừa rồi có lên máy chủ không").
 */

export type ConnectionStatus = "unknown" | "connected" | "error";

export interface ConnectionSnapshot {
  status: ConnectionStatus;
  error: string;
}

// Snapshot bất biến — đổi tham chiếu chỉ khi trạng thái đổi, để
// useSyncExternalStore không render vô hạn.
let snapshot: ConnectionSnapshot = { status: "unknown", error: "" };
const listeners = new Set<() => void>();

function setStatus(status: ConnectionStatus, error: string) {
  if (snapshot.status === status && snapshot.error === error) return;
  snapshot = { status, error };
  listeners.forEach((f) => f());
}

export const connectivity = {
  /** Một thao tác server vừa thành công. */
  reportOk: () => setStatus("connected", ""),
  /** Một thao tác server vừa lỗi (kèm thông báo để hiện cho người dùng). */
  reportError: (message: string) => setStatus("error", message),
  subscribe: (f: () => void) => {
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  },
  getSnapshot: (): ConnectionSnapshot => snapshot,
};
