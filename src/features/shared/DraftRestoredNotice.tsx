// ============================================================
// Tên file: src/features/shared/DraftRestoredNotice.tsx
// Tên tiếng Việt: Dải báo "đã mở lại phiếu đang gõ dở" (nháp tự lưu)
// Description: Notice shown when a form draft was restored (lib/formDraft.ts)
// ============================================================
// Quy tắc 17 (CLAUDE.md): mọi form ghi tự lưu nháp. Khi màn vừa đổ lại nháp vào form,
// hiện dải nhỏ này (không toast — quy tắc 13) để người dùng biết số trên form CHƯA vào
// sổ và bỏ được nếu không cần.
import { Button } from "@/design-system";
import { formatDateVN } from "@/lib/format";

export function DraftRestoredNotice({ savedAt, onDiscard }: { savedAt: string | null; onDiscard: () => void }) {
  if (!savedAt) return null;
  const d = new Date(savedAt);
  const time = Number.isNaN(d.getTime())
    ? ""
    : ` lúc ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ${formatDateVN(savedAt.slice(0, 10))}`;
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg bg-info-surface px-4 py-2 text-sm">
      <p className="min-w-0 flex-1">
        Đã mở lại phiếu đang gõ dở (tự lưu{time}). Số trên phiếu <strong>chưa vào sổ</strong> — bấm Lưu để ghi.
      </p>
      <Button
        size="sm"
        variant="danger"
        onClick={onDiscard}
        title="Bỏ bản nháp này — phiếu về trống, số đang gõ dở không được lưu."
      >
        Bỏ bản nháp
      </Button>
    </div>
  );
}
