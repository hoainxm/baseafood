// ============================================================
// Tên file: src/features/my-tasks/TaskDetailDialog.tsx
// Tên tiếng Việt: Hộp chi tiết việc được giao — xem lại việc đã xong, Mở lại khi bấm Xong nhầm
// Description: Read-only detail of a manual task assigned to me that is already done,
//              with the "Mở lại việc" action (same permission as marking it done).
// ============================================================
// Rà 2026-11-06 ("làm nhầm thì phải gỡ được"): bấm Xong nhầm thì việc biến khỏi danh
// sách của người nhận, quá vài giây của toast là hết đường lùi. Nút Mở lại nằm TRONG hộp
// chi tiết của việc (như mọi nút xóa / mở lại của hệ thống), không đặt nút nhanh trên dòng.
import type { ReactNode } from "react";
import { Button, FormDialog } from "@/design-system";
import { formatDateVN } from "@/lib/format";
import type { TaskAssignment } from "@/types";
import { ClipboardList, RotateCcw } from "lucide-react";

const doneTime = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Giờ và ngày cùng theo giờ máy (đừng cắt chuỗi UTC — gần nửa đêm lệch một ngày).
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const hhmm = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return `${hhmm} ${formatDateVN(local)}`;
};

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 border-b border-border py-2 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-foreground">{value}</dd>
    </div>
  );
}

export function TaskDetailDialog({
  assignment,
  canReopen,
  onClose,
  onReopen,
}: {
  assignment: TaskAssignment | null;
  /** Người đang xem có được mở lại không (người nhận việc, không ở chế độ Xem như). */
  canReopen: boolean;
  onClose: () => void;
  onReopen: (a: TaskAssignment) => void;
}) {
  const a = assignment;
  return (
    <FormDialog
      open={!!a}
      onOpenChange={(o) => !o && onClose()}
      title="Chi tiết việc được giao"
      description="Việc này bạn đã báo xong. Lỡ chọn Xong nhầm thì chọn Mở lại việc: việc quay về danh sách cần làm, người giao thấy lại là đang làm."
      icon={ClipboardList}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          {a && canReopen && (
            <Button
              data-tour="my-tasks-reopen"
              variant="edit"
              title="Đưa việc đã báo Xong về lại trạng thái đang làm (khi lỡ chọn Xong nhầm). Có Hoàn tác trên thông báo."
              onClick={() => onReopen(a)}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
              Mở lại việc
            </Button>
          )}
        </>
      }
    >
      {a && (
        <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)]">
          <Row label="Việc" value={<span className="font-semibold">{a.title}</span>} />
          {a.detail && <Row label="Chi tiết" value={a.detail} />}
          <Row label="Giao bởi" value={a.assignedByName || "—"} />
          <Row label="Ngày giao" value={a.taskDate ? formatDateVN(a.taskDate) : "—"} />
          <Row label="Hạn" value={a.dueDate ? formatDateVN(a.dueDate) : "Chưa có hạn"} />
          <Row label="Đã báo xong lúc" value={<span className="tnum">{doneTime(a.doneAt)}</span>} />
          {a.note && <Row label="Ghi chú" value={a.note} />}
        </dl>
      )}
    </FormDialog>
  );
}
