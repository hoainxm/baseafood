// ============================================================
// Tên file: src/features/shared/RowMarkProvider.tsx
// Tên tiếng Việt: Nguồn dữ liệu tô màu dòng (row_marks) cho cả app
// Description: Provides shared row marks to every design-system table
// ============================================================
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { RowMarkContext, type MarkStyle, type RowMarkSource } from "@/design-system";
import { useRowMarks } from "@/lib/catalogRepo";
import { setRowMarks, getTableRowMarks } from "@/lib/rowMarks";

const EMPTY_MARKS: ReadonlyMap<string, MarkStyle> = new Map();

/**
 * Gắn MỘT lần ở ShellLayout (App.tsx). Cả app dùng chung một instance
 * `useRowMarks()`: mỗi `useBang` giữ state riêng, nên nếu từng bảng tự gọi hook
 * thì bảng này ghi đè mất dấu bảng kia trong bản sao dưới máy.
 *
 * `nguoi` = username đang đăng nhập — ghi vào `marked_by` (ai tô).
 */
export function RowMarkProvider({ username: user, children }: { username: string; children: ReactNode }) {
  const [marks, write] = useRowMarks();
  // Bản mới nhất ngay sau mỗi lần ghi — hai cú tô liền nhau trong cùng một nhịp
  // render không được dựng từ cùng một danh sách cũ (cú sau nuốt cú trước).
  const latest = useRef(marks);
  useLayoutEffect(() => {
    latest.current = marks;
  }, [marks]);

  const theoBang = useMemo(() => {
    const ra = new Map<string, ReadonlyMap<string, MarkStyle>>();
    for (const k of new Set(marks.map((m) => m.tableKey))) ra.set(k, getTableRowMarks(marks, k).row);
    return ra;
  }, [marks]);

  const source = useMemo<RowMarkSource>(
    () => ({
      getTableMarks: (tableKey) => theoBang.get(tableKey) ?? EMPTY_MARKS,
      setMarks: (tableKey, rowKeys, dau) => {
        const next = setRowMarks(latest.current, tableKey, rowKeys, dau, user);
        latest.current = next;
        write(next);
      },
    }),
    [theoBang, write, user]
  );

  return <RowMarkContext.Provider value={source}>{children}</RowMarkContext.Provider>;
}
