// ============================================================
// Tên file: src/features/balancing/RowNoteCell.tsx
// Tên tiếng Việt: Ô "Ghi chú" cuối dòng của lưới Cân đối (mig 0067)
// ============================================================
// Gõ chữ tự do cho từng dòng (khối NL + khối bán thành phẩm). KHÔNG ghi theo từng phím
// như ô số (ghi sổ mỗi phím là thừa với chữ) — lưu khi rời ô / Enter; Esc trả chữ cũ.
import { useRef, useState } from "react";
import { Input } from "@/design-system";

export function RowNoteCell({
  value,
  rowLabel,
  onCommit,
}: {
  value: string;
  /** Tên dòng — cho nhãn đọc của ô. */
  rowLabel: string;
  onCommit: (note: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  /** Esc ⇒ bỏ bản nháp (blur ngay sau đó KHÔNG được lưu — state chưa kịp cập nhật). */
  const cancelled = useRef(false);
  const shown = draft ?? value;
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }
    if (draft == null) return;
    const next = draft.trim();
    setDraft(null);
    if (next !== value.trim()) onCommit(next);
  };
  return (
    <Input
      aria-label={`Ghi chú — ${rowLabel}`}
      title="Ghi chú cho dòng này — lưu khi rời ô hoặc nhấn Enter, Esc để bỏ."
      className="h-9 min-w-40"
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
