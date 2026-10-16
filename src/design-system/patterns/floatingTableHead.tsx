// ============================================================
// Tên file: src/design-system/patterns/floatingTableHead.tsx
// Tên tiếng Việt: Hàng tên cột NỔI cho mọi bảng nằm trong khung cuộn ngang
// Description: Floating (sticky) table header for tables inside a horizontal scroll frame
// ============================================================
// Chốt 2026-10-16: MỌI bảng trong hệ thống phải giữ hàng tên cột trong tầm nhìn khi
// bảng dài phải cuộn xuống. `position: sticky` trên <thead> KHÔNG bám theo trang khi
// bảng nằm trong khung `overflow-x-auto` (khung đó thành khung cuộn của sticky) ⇒ dùng
// cách của `SummaryTable fullHeight`: một hộp cao 0 dính dưới header trang (`top-header`)
// đặt NGOÀI khung cuộn, khi hàng tên cột thật đã trôi khỏi tầm nhìn mà bảng còn trên màn
// thì hiện BẢN SAO hàng tên cột (đo đúng bề rộng từng cột, cuộn ngang theo bảng).
//
// Bản sao là DOM nhân bản, `inert` + aria-hidden: chỉ để ĐỌC tên cột (nút sắp xếp / ô
// tick "chọn tất cả" bấm ở hàng thật). Bảng nào cần hàng nổi bấm được thì tự vẽ hai lần
// như SummaryTable.
import * as React from "react";

/**
 * Trả về phần tử cần đặt NGAY TRƯỚC khung cuộn ngang (cùng cha, cha không được
 * `overflow` ≠ visible). `getFrame` = phần tử cuộn ngang chứa <table> (thẳng hoặc lồng).
 */
export function useFloatingTableHead(getFrame: () => HTMLElement | null, enabled = true): React.ReactNode {
  const holderRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [frame, setFrame] = React.useState<HTMLElement | null>(null);
  const [show, setShow] = React.useState(false);

  // Tìm lại khung sau mỗi lần vẽ (bảng rỗng → có dòng thì khung mới xuất hiện).
  React.useLayoutEffect(() => {
    const f = enabled ? getFrame() : null;
    setFrame((prev) => (prev === f ? prev : f));
  });

  // Khi nào hiện: hàng tên cột thật đã trôi lên dưới header trang, bảng còn đủ cao bên
  // dưới (gần đáy bảng thì ẩn để khỏi đè dòng cuối / dòng tổng).
  React.useEffect(() => {
    if (!frame) return;
    const measure = () => {
      const table = frame.querySelector("table");
      const head = table?.tHead;
      const holder = holderRef.current;
      if (!table || !head || !holder) return setShow(false);
      const top = holder.getBoundingClientRect().top;
      const r = table.getBoundingClientRect();
      const h = head.getBoundingClientRect().height;
      setShow(r.height > 0 && r.top < top - 1 && r.bottom > top + h * 2);
    };
    measure();
    // capture: bắt cuộn của MỌI khung (cột nội dung desktop cuộn riêng, điện thoại cuộn trang, hộp thoại).
    window.addEventListener("scroll", measure, { capture: true, passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("resize", measure);
    };
  }, [frame]);

  // Dựng bản sao khi hiện + khi bảng đổi cỡ / hàng tên cột đổi; đồng bộ cuộn ngang.
  React.useEffect(() => {
    const inner = innerRef.current;
    if (!frame || !inner || !show) return;
    const table = frame.querySelector("table");
    if (!table?.tHead) return;
    const build = () => {
      const head = table.tHead;
      if (!head) return;
      const clone = document.createElement("table");
      clone.className = table.className;
      clone.style.width = `${table.getBoundingClientRect().width}px`;
      clone.style.margin = "0";
      const headClone = head.cloneNode(true) as HTMLTableSectionElement;
      // Bề rộng TỪNG ô = ô thật (kể cả hàng nhóm cột có colspan).
      const src = head.querySelectorAll("th, td");
      const dst = headClone.querySelectorAll<HTMLElement>("th, td");
      src.forEach((cell, i) => {
        const w = `${cell.getBoundingClientRect().width}px`;
        const d = dst[i];
        if (!d) return;
        d.style.width = w;
        d.style.minWidth = w;
        d.style.maxWidth = w;
        d.style.boxSizing = "border-box";
      });
      headClone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      clone.appendChild(headClone);
      inner.replaceChildren(clone);
      inner.scrollLeft = frame.scrollLeft;
    };
    build();
    const syncScroll = () => {
      inner.scrollLeft = frame.scrollLeft;
    };
    frame.addEventListener("scroll", syncScroll, { passive: true });
    const ro = new ResizeObserver(build);
    ro.observe(table);
    const mo = new MutationObserver(build);
    mo.observe(table.tHead, { subtree: true, childList: true, characterData: true, attributes: true });
    return () => {
      frame.removeEventListener("scroll", syncScroll);
      ro.disconnect();
      mo.disconnect();
      inner.replaceChildren();
    };
  }, [frame, show]);

  if (!enabled) return null;
  return (
    <div ref={holderRef} className="pointer-events-none sticky top-header z-20 h-0 print:hidden" aria-hidden>
      <div
        ref={innerRef}
        // inert: bản sao không nhận phím / chuột (tránh tab vào ô tick trùng).
        {...{ inert: true }}
        className={show ? "visible overflow-hidden bg-card shadow-sm ring-1 ring-border" : "invisible h-0 overflow-hidden"}
      />
    </div>
  );
}
