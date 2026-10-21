// ============================================================
// Tên file: src/design-system/patterns/GuidedTour.tsx
// Tên tiếng Việt: Hướng dẫn từng bước trên trang — lớp phủ chỉ chỗ + khung lời
// Description: Page tour overlay: dims the page, spotlights the element marked
//              `data-tour="<target>"`, shows a step card (k / n · title · text · Back / Next / Exit).
//              Blocks every click on the page while running (tour only guides, never writes —
//              docs/app-map/43-guided-tour.ba-spec.md R1). Keys: → / Enter next, ← back, Esc exit.
// ============================================================
import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TOUR_TARGET_WAIT_MS, nextStepIndex, tourTargetSelector, type PageTour, type TourStep } from "@/lib/guidedTour";

/** Khoảng hở quanh chỗ được chỉ, và lề tối thiểu của khung lời tới mép màn. */
const SPOT_PAD = 6;
const EDGE = 16;
const GAP = 12;
/** Dưới mốc này (px) khung lời nằm dính đáy màn như tấm trượt điện thoại. */
const SHEET_BELOW = 640;

function findVisible(target: string): HTMLElement | null {
  const els = document.querySelectorAll<HTMLElement>(tourTargetSelector(target));
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** Trang coi là "đứng yên" khi cây DOM không đổi trong khoảng này (đã vẽ xong chỗ xem mới). */
const QUIET_MS = 300;

/**
 * Đợi chỗ được chỉ hiện ra. Không thấy thì thôi khi trang đã đứng yên `QUIET_MS` (chỗ đó
 * thật sự không có — khỏi bắt người dùng đợi đủ `ms`), chậm nhất `ms` (R3).
 */
function waitForTarget(target: string, ms: number, isCancelled: () => boolean): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let lastChange = startedAt;
    const mo = new MutationObserver(() => {
      lastChange = Date.now();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    const done = (el: HTMLElement | null) => {
      mo.disconnect();
      resolve(el);
    };
    const tick = () => {
      if (isCancelled()) return done(null);
      const el = findVisible(target);
      const now = Date.now();
      if (el || now - startedAt >= ms || now - lastChange >= QUIET_MS) return done(el);
      window.setTimeout(tick, 50);
    };
    // Nhịp đầu để lệnh đổi chỗ xem (prepare) kịp vẽ.
    window.setTimeout(tick, 50);
  });
}

type CardStyle = React.CSSProperties;

/** Mép dưới của thanh tiêu đề dính đầu trang (chỗ được chỉ không được nằm khuất dưới nó). */
function stickyTop(): number {
  const header = document.querySelector("header");
  return header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
}

/** Khung cuộn dọc thật của chỗ được chỉ: desktop là vùng nội dung, điện thoại là cả trang. */
function scrollerOf(el: HTMLElement): Element | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.overflowY !== "auto" && cs.overflowY !== "scroll") continue;
    // Khung cuộn NGANG của bảng cũng có overflow-y auto (trình duyệt tự đổi) — chỉ tính là khung
    // cuộn dọc khi nó thật sự dư chiều cao đáng kể.
    const isHorizontal = cs.overflowX === "auto" || cs.overflowX === "scroll";
    if (p.scrollHeight - p.clientHeight > (isHorizontal ? 40 : 1)) return p;
  }
  return document.scrollingElement;
}

/**
 * Đưa chỗ được chỉ lên sát dưới thanh tiêu đề dính đầu trang, để phần dưới màn còn chỗ cho khung
 * lời; khu vực cuối trang không cuộn lên được nữa thì khung lời đặt phía trên hoặc bên cạnh.
 * Tự cuộn ĐÚNG một khung — `scrollIntoView` ở cuối trang đẩy cả khung app lên, thanh tiêu đề trôi mất.
 */
function revealTarget(el: HTMLElement) {
  const sc = scrollerOf(el);
  if (!sc) return;
  const isDocument = sc === document.scrollingElement;
  const frameTop = isDocument ? 0 : sc.getBoundingClientRect().top;
  const want = Math.max(frameTop, stickyTop()) + GAP;
  const delta = el.getBoundingClientRect().top - want;
  if (Math.abs(delta) > 1) sc.scrollTop += delta;
}

/**
 * GuidedTour — chạy một `PageTour` (khai ở `@/lib/guidedTour`). Trang gắn `data-tour="…"` vào
 * chỗ cần chỉ; bước không gắn chỗ hiện lời giữa trang. Luật: README design-system § Hướng dẫn từng bước.
 */
export function GuidedTour({ tour, open, onClose }: { tour: PageTour | null; open: boolean; onClose: () => void }) {
  const steps: readonly TourStep[] = React.useMemo(() => tour?.steps ?? [], [tour]);
  const [index, setIndex] = React.useState(-1);
  const [target, setTarget] = React.useState<HTMLElement | null>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [cardStyle, setCardStyle] = React.useState<CardStyle>({ visibility: "hidden" });
  const [isMoving, setIsMoving] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const nextRef = React.useRef<HTMLButtonElement>(null);
  /** Mỗi lần đi tới / lùi / thoát tăng một — lượt chờ cũ tự bỏ. */
  const runRef = React.useRef(0);
  /** Bước nào đã dò mà chỗ không có (để lùi / tới bỏ qua đúng bước đó, và đếm k / n đúng). */
  const missingRef = React.useRef<Set<number>>(new Set());
  const [, bumpMissing] = React.useReducer((x: number) => x + 1, 0);

  /** Vị trí cuộn lúc bắt đầu — kết thúc thì trả lại (R5: về đúng chỗ đang xem). */
  const scrollAtStartRef = React.useRef<{ el: Element; top: number } | null>(null);

  const finish = React.useCallback(() => {
    runRef.current += 1;
    setIndex(-1);
    setTarget(null);
    setRect(null);
    onClose();
    const saved = scrollAtStartRef.current;
    scrollAtStartRef.current = null;
    // Đợi trang vẽ lại chỗ xem cũ (đường dẫn vừa được trả) rồi mới cuộn về.
    if (saved) window.setTimeout(() => saved.el.scrollTo({ top: saved.top }), 60);
  }, [onClose]);

  const move = React.useCallback(
    async (from: number, dir: 1 | -1) => {
      const run = ++runRef.current;
      const cancelled = () => runRef.current !== run;
      setIsMoving(true);
      const isAvailable = (_s: TourStep, i: number) => !missingRef.current.has(i);
      let i = nextStepIndex(steps, from, dir, isAvailable);
      while (i !== -1) {
        const s = steps[i];
        s.prepare?.();
        const el = s.target ? await waitForTarget(s.target, TOUR_TARGET_WAIT_MS, cancelled) : null;
        if (cancelled()) return;
        if (!s.target || el || !s.optional) {
          missingRef.current.delete(i);
          setCardStyle({ visibility: "hidden" });
          setIndex(i);
          setTarget(el);
          if (el) revealTarget(el);
          setRect(el ? el.getBoundingClientRect() : null);
          // Dò trước các bước tùy chọn CÙNG chỗ xem (cùng hàm prepare) — chỗ không có thì đánh
          // dấu luôn, để "Bước k / n" không nhảy cóc và khỏi đợi khi đi tới (R6).
          for (let j = 0; j < steps.length; j++) {
            const o = steps[j];
            if (j === i || !o.optional || !o.target || o.prepare !== s.prepare) continue;
            if (findVisible(o.target)) missingRef.current.delete(j);
            else missingRef.current.add(j);
          }
          bumpMissing();
          setIsMoving(false);
          return;
        }
        missingRef.current.add(i);
        i = nextStepIndex(steps, from, dir, isAvailable);
      }
      setIsMoving(false);
      // Tới quá bước cuối ⇒ kết thúc; lùi quá bước đầu ⇒ đứng yên.
      if (dir === 1) finish();
    },
    [steps, finish],
  );

  // Mở ⇒ bắt đầu từ bước đầu; đóng ⇒ dọn.
  React.useEffect(() => {
    if (!open || !steps.length) return;
    missingRef.current = new Set();
    const main = document.querySelector<HTMLElement>("main");
    const sc = main ? scrollerOf(main) : document.scrollingElement;
    scrollAtStartRef.current = sc ? { el: sc, top: sc.scrollTop } : null;
    void move(-1, 1);
    return () => {
      runRef.current += 1;
    };
    // Chỉ chạy lại khi mở / đóng — tour đã chụp lúc bắt đầu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Theo dõi vị trí chỗ được chỉ khi cuộn / đổi cỡ.
  React.useEffect(() => {
    if (!target) return;
    const update = () => setRect(target.getBoundingClientRect());
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    ro.observe(target);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, [target]);

  // Đặt khung lời: dưới chỗ được chỉ, không đủ thì trên, không đủ nữa thì đáy màn.
  React.useLayoutEffect(() => {
    const card = cardRef.current;
    if (!open || index < 0 || !card) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ch = card.offsetHeight;
    const cw = card.offsetWidth;
    if (vw < SHEET_BELOW) {
      setCardStyle({ left: EDGE, right: EDGE, bottom: EDGE });
      return;
    }
    if (!rect) {
      setCardStyle({ left: Math.max(EDGE, (vw - cw) / 2), top: Math.max(EDGE, (vh - ch) / 2) });
      return;
    }
    // Thứ tự: dưới → trên → phải → trái chỗ được chỉ; không chỗ nào đủ thì góc dưới phải màn.
    const left = Math.min(Math.max(EDGE, rect.left), vw - cw - EDGE);
    const sideTop = Math.min(Math.max(stickyTop() + GAP, rect.top), vh - ch - EDGE);
    const below = rect.bottom + SPOT_PAD + GAP;
    const above = rect.top - SPOT_PAD - GAP - ch;
    const right = rect.right + SPOT_PAD + GAP;
    const leftSide = rect.left - SPOT_PAD - GAP - cw;
    if (below + ch <= vh - EDGE) setCardStyle({ left, top: below });
    else if (above >= stickyTop() + EDGE) setCardStyle({ left, top: above });
    else if (right + cw <= vw - EDGE) setCardStyle({ left: right, top: sideTop });
    else if (leftSide >= EDGE) setCardStyle({ left: leftSide, top: sideTop });
    else setCardStyle({ left: vw - cw - EDGE, top: vh - ch - EDGE });
  }, [open, index, rect, target]);

  // Điện thoại: khung lời nằm đáy màn ⇒ chừa đáy trang đúng bằng khung, để khu vực cuối trang
  // (VD Điều khoản) cuộn lên được trên khung. Tour đóng thì trả lại như cũ.
  const isRunning = open && index >= 0;
  React.useEffect(() => {
    if (!isRunning || window.innerWidth >= SHEET_BELOW) return;
    // Đệm vào vùng nội dung (thân trang cao cố định bằng màn, đệm ở đó không thêm chỗ cuộn).
    const area = document.querySelector<HTMLElement>("main") ?? document.body;
    const prev = area.style.paddingBottom;
    // Khung lời cao khác nhau từng bước (lời dài cuộn trong khung, tối đa ~2/3 màn) ⇒ chừa 70 % màn.
    area.style.paddingBottom = "70dvh";
    return () => {
      area.style.paddingBottom = prev;
    };
  }, [isRunning]);

  // Bàn phím: → / Enter tới, ← lùi, Esc thoát; Tab quẩn trong khung lời.
  React.useEffect(() => {
    if (!open || index < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish();
      } else if ((e.key === "ArrowRight" || e.key === "Enter") && !isMoving) {
        e.preventDefault();
        e.stopPropagation();
        void move(index, 1);
      } else if (e.key === "ArrowLeft" && !isMoving && index > 0) {
        e.preventDefault();
        e.stopPropagation();
        void move(index, -1);
      } else if (e.key === "Tab") {
        const card = cardRef.current;
        if (!card) return;
        const btns = [...card.querySelectorAll<HTMLElement>("button")];
        if (!btns.length) return;
        const at = btns.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        btns[(at + (e.shiftKey ? btns.length - 1 : 1)) % btns.length]?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, index, isMoving, move, finish]);

  React.useEffect(() => {
    if (open && index >= 0) nextRef.current?.focus({ preventScroll: true });
  }, [open, index]);

  if (!open || !tour || index < 0) return null;
  const step = steps[index];
  const isLast = nextStepIndex(steps, index, 1, (_s, i) => !missingRef.current.has(i)) === -1;
  // Đếm bỏ các bước đã biết là không áp dụng (R6).
  let skippedBefore = 0;
  for (const m of missingRef.current) if (m < index) skippedBefore += 1;
  const stepNo = index + 1 - skippedBefore;
  const stepCount = steps.length - missingRef.current.size;
  const titleId = `guided-tour-title-${step.id}`;

  return createPortal(
    <div className="fixed inset-0 z-[60]" data-guided-tour aria-hidden={false}>
      {/* Lớp chặn: nhận mọi cú bấm lên trang khi tour chạy (R1 — tour không ghi gì). */}
      <div className="absolute inset-0" onMouseDown={(e) => e.preventDefault()} />
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl shadow-[0_0_0_9999px_rgb(0_0_0/0.45)] ring-2 ring-primary transition-all duration-200"
          style={{ top: rect.top - SPOT_PAD, left: rect.left - SPOT_PAD, width: rect.width + SPOT_PAD * 2, height: rect.height + SPOT_PAD * 2 }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-black/45" />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed grid gap-3 rounded-xl bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
          "sm:w-[min(24rem,calc(100vw-2rem))]",
        )}
        style={cardStyle}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="tnum text-sm text-muted-foreground">
            Hướng dẫn thao tác · Bước {stepNo}/{stepCount}
          </span>
          <Button variant="ghost" size="icon-sm" onClick={finish} title="Thoát hướng dẫn (phím Esc). Trang trở về màn hình đang xem trước khi bắt đầu." aria-label="Thoát hướng dẫn">
            <X aria-hidden />
          </Button>
        </div>
        <div aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${(stepNo / stepCount) * 100}%` }} />
        </div>
        <h2 id={titleId} className="font-semibold">
          {step.title}
        </h2>
        {/* Lời dài (bảng trạng thái) cuộn trong khung, không đẩy nút ra khỏi màn. */}
        <p className="max-h-[26dvh] overflow-y-auto overscroll-contain text-sm leading-relaxed whitespace-pre-line sm:max-h-[45dvh]">{step.body}</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {index > 0 && (
            <Button variant="outline" onClick={() => void move(index, -1)} title="Xem lại bước trước (phím ←).">
              Quay lại
            </Button>
          )}
          <Button ref={nextRef} onClick={() => (isLast ? finish() : void move(index, 1))} title={isLast ? "Kết thúc hướng dẫn. Trang trở về màn hình đang xem trước khi bắt đầu." : "Sang bước tiếp theo (phím → hoặc Enter)."}>
            {isLast ? "Hoàn tất" : isMoving ? "Đang chuyển…" : "Tiếp theo"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
