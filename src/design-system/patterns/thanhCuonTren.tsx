// ============================================================
// Tên file: src/design-system/patterns/thanhCuonTren.tsx
// Tên tiếng Việt: Hook thanh cuộn ngang TRÊN đầu bảng (đồng bộ với thanh dưới)
// Description: Hook rendering a top scrollbar synced with a table's horizontal scroller
// ============================================================
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Bảng rộng hơn màn hình: thanh cuộn ngang thật nằm ở ĐÁY bảng — bảng dài thì
 * phải cuộn xuống tận đáy mới kéo ngang được. Luật (README § 5a): bảng tràn ngang
 * có thanh cuộn ở CẢ TRÊN lẫn DƯỚI, đồng bộ hai chiều. Hook này trả về `thanh` —
 * thanh TRÊN dựng sẵn (null khi bảng không tràn), đặt ngay trên khung bảng; thanh
 * dưới là thanh thật của khung (hoặc thanh dính đáy của `BangTong xoRa`).
 *
 * `layKhung` trả về phần tử ĐANG cuộn ngang (thường là `[data-slot=table-container]`
 * của primitive `Table`, hoặc chính div `overflow-x-auto` của bảng tự dựng).
 */
export function useThanhCuonTren(layKhung: () => HTMLElement | null, className?: string) {
  const trenRef = React.useRef<HTMLDivElement>(null);
  const [khung, setKhung] = React.useState<HTMLElement | null>(null);
  const [tran, setTran] = React.useState(false);
  const [rong, setRong] = React.useState(0);

  // Tìm lại khung sau mỗi lần vẽ (`layKhung` là hàm mới mỗi lần vẽ) — bảng rỗng →
  // có dòng thì khung mới xuất hiện; chỉ đặt state khi đổi phần tử.
  React.useLayoutEffect(() => {
    // Phần tử DOM là "hệ thống ngoài" của React — đọc sau khi vẽ rồi mới gắn đo.
    const timLai = () => {
      const k = layKhung();
      setKhung((cu) => (cu === k ? cu : k));
    };
    timLai();
  }, [layKhung]);

  // Đo bề rộng cuộn + có tràn không, mỗi khi khung / bảng đổi cỡ.
  React.useLayoutEffect(() => {
    if (!khung) return;
    const doLai = () => {
      const sw = khung.scrollWidth;
      setRong((cu) => (Math.abs(cu - sw) < 1 ? cu : sw));
      setTran(sw > khung.clientWidth + 1);
    };
    doLai();
    const ro = new ResizeObserver(doLai);
    ro.observe(khung);
    for (const con of Array.from(khung.children)) ro.observe(con);
    return () => ro.disconnect();
  }, [khung]);

  // Đồng bộ hai chiều. Gán scrollLeft bằng giá trị đang có thì trình duyệt không
  // bắn sự kiện ⇒ không vòng lặp.
  React.useEffect(() => {
    const tren = trenRef.current;
    if (!khung || !tren || !tran) return;
    const theoKhung = () => {
      if (tren.scrollLeft !== khung.scrollLeft) tren.scrollLeft = khung.scrollLeft;
    };
    const theoTren = () => {
      if (khung.scrollLeft !== tren.scrollLeft) khung.scrollLeft = tren.scrollLeft;
    };
    khung.addEventListener("scroll", theoKhung, { passive: true });
    tren.addEventListener("scroll", theoTren, { passive: true });
    theoKhung();
    return () => {
      khung.removeEventListener("scroll", theoKhung);
      tren.removeEventListener("scroll", theoTren);
    };
  }, [khung, tran]);

  return tran ? (
    <div
      ref={trenRef}
      aria-hidden
      title="Kéo để cuộn bảng sang ngang (thanh này chạy cùng thanh cuộn dưới đáy bảng)."
      className={cn("bang-thanh-cuon mb-1 print:hidden", className)}
    >
      <div style={{ width: rong, height: 1 }} />
    </div>
  ) : null;
}
