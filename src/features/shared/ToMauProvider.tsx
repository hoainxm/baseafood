// ============================================================
// Tên file: src/features/shared/ToMauProvider.tsx
// Tên tiếng Việt: Nguồn dữ liệu tô màu dòng (row_marks) cho cả app
// Description: Provides shared row marks to every design-system table
// ============================================================
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { ToMauContext, type DauDong, type NguonToMau } from "@/design-system";
import { useRowMarks } from "@/lib/catalogRepo";
import { datDau, dauCuaBang } from "@/lib/toMau";

const RONG: ReadonlyMap<string, DauDong> = new Map();

/**
 * Gắn MỘT lần ở ShellLayout (App.tsx). Cả app dùng chung một instance
 * `useRowMarks()`: mỗi `useBang` giữ state riêng, nên nếu từng bảng tự gọi hook
 * thì bảng này ghi đè mất dấu bảng kia trong bản sao dưới máy.
 *
 * `nguoi` = username đang đăng nhập — ghi vào `marked_by` (ai tô).
 */
export function ToMauProvider({ nguoi, children }: { nguoi: string; children: ReactNode }) {
  const [marks, ghi] = useRowMarks();
  // Bản mới nhất ngay sau mỗi lần ghi — hai cú tô liền nhau trong cùng một nhịp
  // render không được dựng từ cùng một danh sách cũ (cú sau nuốt cú trước).
  const moiNhat = useRef(marks);
  useLayoutEffect(() => {
    moiNhat.current = marks;
  }, [marks]);

  const theoBang = useMemo(() => {
    const ra = new Map<string, ReadonlyMap<string, DauDong>>();
    for (const k of new Set(marks.map((m) => m.tableKey))) ra.set(k, dauCuaBang(marks, k).dong);
    return ra;
  }, [marks]);

  const nguon = useMemo<NguonToMau>(
    () => ({
      dauCuaBang: (maBang) => theoBang.get(maBang) ?? RONG,
      dat: (maBang, khoaDong, dau) => {
        const next = datDau(moiNhat.current, maBang, khoaDong, dau, nguoi);
        moiNhat.current = next;
        ghi(next);
      },
    }),
    [theoBang, ghi, nguoi]
  );

  return <ToMauContext.Provider value={nguon}>{children}</ToMauContext.Provider>;
}
