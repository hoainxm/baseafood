import * as React from "react";
import { AlertTriangle } from "lucide-react";

export interface LoiNhap {
  /** Nhãn ô bị lỗi, vd "Số lượng" */
  truong: string;
  /** Câu nói người dùng hiểu, vd "Chưa nhập số lượng" */
  thongBao: string;
  /** id của ô để nhảy tới khi bấm */
  targetId?: string;
}

/**
 * ErrorSummary — hộp gộp lỗi ở ĐẦU form (pattern GOV.UK).
 *
 * Vì sao cần: lỗi rải rác cạnh từng ô thì người dùng phải tự dò cả màn hình.
 * Hộp này đứng đầu, tự nhận focus, liệt kê từng lỗi thành LINK nhảy thẳng tới ô.
 *
 * Dùng chung với nguyên tắc: nút "Lưu" KHÔNG BAO GIỜ bị disable —
 * bấm vào thì hiện hộp này, thay vì im lặng không phản ứng.
 */
export function ErrorSummary({ loi }: { loi: LoiNhap[] }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (loi.length > 0) {
      ref.current?.focus();
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [loi]);

  if (loi.length === 0) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="loi-tieu-de"
      className="rounded-xl border-4 border-destructive bg-background p-5"
    >
      <h2
        id="loi-tieu-de"
        className="flex items-center gap-3 text-xl font-semibold text-destructive"
      >
        <AlertTriangle className="size-7 shrink-0" aria-hidden />
        Còn {loi.length} chỗ chưa xong
      </h2>
      <ul className="mt-4 space-y-3">
        {loi.map((l, i) => (
          <li key={i}>
            {l.targetId ? (
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById(l.targetId!);
                  el?.focus();
                  el?.scrollIntoView({ block: "center", behavior: "smooth" });
                }}
                className="text-left text-base font-semibold text-destructive underline underline-offset-4"
              >
                {l.truong}: {l.thongBao}
              </button>
            ) : (
              <span className="text-base font-semibold text-destructive">
                {l.truong}: {l.thongBao}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
