// ============================================================
// Tên file: src/design-system/patterns/HoverHint.tsx
// Tên tiếng Việt: Gợi ý khi rê chuột — thay tooltip mặc định của trình duyệt
// Description: Global hover hint controller — replaces the native title tooltip
// ============================================================
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * GoiYHover — MỘT bộ điều khiển chung cho toàn app, gắn một lần ở khung
 * (`AppShell`). Không phải bọc từng nút.
 *
 * Vì sao có file này: luật §9 của design-system bắt mọi nút thao tác phải có
 * `title` giải thích nút làm gì. Nhưng `title` là tooltip CÓ SẴN của trình
 * duyệt — **độ trễ do trình duyệt/OS quyết, trang web không chỉnh được** (Chrome
 * để ~1 giây). Chờ một giây mới thấy chữ thì người dùng đã bấm đại hoặc bỏ đi
 * rồi, coi như mất tác dụng.
 *
 * Cách làm: nghe rê chuột ở cấp document, tìm phần tử gần nhất CÓ `title`, rồi
 * tự vẽ tooltip sau {@link TRE_HIEN_MS}. `title` vẫn là NGUỒN DUY NHẤT của câu
 * chữ — màn hình không phải đổi gì, không phải import gì.
 *
 * Chống hiện HAI tooltip: lúc rê thì gỡ tạm `title` ra (cất ở `data-goi-y`), rời
 * chuột thì trả lại. Đi bằng BÀN PHÍM thì KHÔNG gỡ — trình duyệt không bật
 * tooltip khi focus, mà giữ nguyên `title` thì trình đọc màn hình vẫn đọc được.
 */

/** Trễ trước khi hiện (ms). Đủ ngắn để rê tới là thấy, đủ dài để lướt qua không nhấp nháy. */
export const TRE_HIEN_MS = 150;

/** Khoảng cách từ mép phần tử tới tooltip (px). */
const CACH_LE = 8;
/** Chừa mép màn hình (px) — không để tooltip dính sát viền. */
const LE_MAN = 8;

/** Chỗ neo: câu chữ + khung của phần tử đang rê (toạ độ so với khung nhìn). */
interface Neo {
  chu: string;
  trai: number;
  tren: number;
  duoi: number;
  rong: number;
}

/** Phần tử có thể mang gợi ý: có `title` và không phải đang bị tắt. */
function findAnchor(t: EventTarget | null): HTMLElement | null {
  if (!(t instanceof Element)) return null;
  const el = t.closest<HTMLElement>("[title], [data-goi-y]");
  return el ?? null;
}

const getText = (el: HTMLElement) =>
  (el.getAttribute("data-goi-y") ?? el.getAttribute("title") ?? "").trim();

export function GoiYHover() {
  const [neo, setNeo] = React.useState<Neo | null>(null);
  const hen = React.useRef<number | null>(null);
  /** Phần tử đang bị gỡ `title` — giữ để trả lại đúng chỗ. */
  const typingEl = React.useRef<HTMLElement | null>(null);
  const hop = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // Máy cảm ứng không có "rê chuột" — đừng bật, tránh tooltip nhảy khi chạm.
    if (!window.matchMedia?.("(hover: hover)").matches) return;

    const huyHen = () => {
      if (hen.current != null) {
        window.clearTimeout(hen.current);
        hen.current = null;
      }
    };

    /** Trả `title` về đúng phần tử đã gỡ. */
    const traTitle = () => {
      const el = typingEl.current;
      if (el) {
        const chu = el.getAttribute("data-goi-y");
        if (chu != null) {
          el.setAttribute("title", chu);
          el.removeAttribute("data-goi-y");
        }
        typingEl.current = null;
      }
    };

    const an = () => {
      huyHen();
      traTitle();
      setNeo(null);
    };

    /** Ghi lại khung của phần tử; chỗ đặt thật tính sau khi đo được hộp chữ. */
    const positionAt = (el: HTMLElement, chu: string) => {
      const o = el.getBoundingClientRect();
      setNeo({ chu, trai: o.left, tren: o.top, duoi: o.bottom, rong: o.width });
    };

    const showAfter = (el: HTMLElement, goTitle: boolean) => {
      const chu = getText(el);
      if (!chu) return;
      huyHen();
      hen.current = window.setTimeout(() => {
        // Gỡ `title` NGAY TRƯỚC khi hiện, để tooltip gốc của trình duyệt không
        // đua lên cùng lúc. Chỉ gỡ khi rê chuột (xem docblock đầu file).
        if (goTitle && el.hasAttribute("title")) {
          el.setAttribute("data-goi-y", chu);
          el.removeAttribute("title");
          typingEl.current = el;
        }
        positionAt(el, chu);
      }, TRE_HIEN_MS);
    };

    const onPointerEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = findAnchor(e.target);
      if (!el) {
        an();
        return;
      }
      if (el === typingEl.current) return; // vẫn đang ở trên chính nó
      an();
      showAfter(el, true);
    };

    const onFocusIn = (e: FocusEvent) => {
      const el = findAnchor(e.target);
      if (!el) return;
      an();
      showAfter(el, false);
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") an();
    };

    document.addEventListener("pointerover", onPointerEnter, true);
    document.addEventListener("pointerdown", an, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", an, true);
    document.addEventListener("keydown", handleKey, true);
    // Cuộn / đổi cỡ thì toạ độ cũ sai ngay — ẩn cho gọn.
    window.addEventListener("scroll", an, true);
    window.addEventListener("resize", an);
    window.addEventListener("blur", an);

    return () => {
      document.removeEventListener("pointerover", onPointerEnter, true);
      document.removeEventListener("pointerdown", an, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", an, true);
      document.removeEventListener("keydown", handleKey, true);
      window.removeEventListener("scroll", an, true);
      window.removeEventListener("resize", an);
      window.removeEventListener("blur", an);
      huyHen();
      traTitle();
    };
  }, []);

  /**
   * Đặt chỗ SAU khi đã đo được hộp chữ. Cố ý KHÔNG dùng `transform` để căn/lật:
   * class `animate-in` của tailwind đặt `transform` trong keyframes, đè mất phép
   * căn giữa và phép lật lên trên (đã dính lỗi tràn mép phải + đè lên nút). Tính
   * thẳng `left`/`top` bằng px thì không ai giành được.
   *
   * `useLayoutEffect` chạy TRƯỚC khi vẽ nên không thấy nhấp nháy ở góc màn.
   */
  React.useLayoutEffect(() => {
    const el = hop.current;
    if (!el || !neo) return;
    const o = el.getBoundingClientRect();
    const trongKhoang = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

    // Mặc định nằm DƯỚI; dưới không đủ chỗ mà trên rộng hơn thì lật lên TRÊN.
    const spaceBelow = window.innerHeight - neo.duoi - CACH_LE - LE_MAN;
    const placeAbove = spaceBelow < o.height && neo.tren - CACH_LE - LE_MAN > spaceBelow;

    const left = trongKhoang(
      neo.trai + neo.rong / 2 - o.width / 2,
      LE_MAN,
      Math.max(LE_MAN, window.innerWidth - LE_MAN - o.width)
    );
    const top = trongKhoang(
      placeAbove ? neo.tren - CACH_LE - o.height : neo.duoi + CACH_LE,
      LE_MAN,
      Math.max(LE_MAN, window.innerHeight - LE_MAN - o.height)
    );

    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.opacity = "1";
  }, [neo]);

  if (!neo) return null;

  return (
    <div
      ref={hop}
      role="tooltip"
      aria-hidden
      /* Vẽ tạm ở góc với opacity 0; layout-effect ngay sau đó đặt đúng chỗ. */
      style={{ left: 0, top: 0, opacity: 0 }}
      className={cn(
        "pointer-events-none fixed z-[100] max-w-xs rounded-md border border-border",
        "bg-popover px-3 py-2 text-sm leading-snug text-popover-foreground shadow-lg"
      )}
    >
      {neo.chu}
    </div>
  );
}
