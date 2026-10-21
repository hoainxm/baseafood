// ============================================================
// Tên file: src/features/shared/PageTourProvider.tsx
// Tên tiếng Việt: Nơi giữ "hướng dẫn từng bước" của trang đang mở
// Description: Page tour registry for the shell. A screen registers its tour while mounted
//              (`usePageTour`); the header guide button / an on-page button start it
//              (`usePageTourControl`). On exit the URL goes back to where the tour started
//              (docs/app-map/43-guided-tour.ba-spec.md R5, R7).
// ============================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GuidedTour, type PageTour } from "@/design-system";

interface PageTourContextValue {
  tour: PageTour | null;
  register: (tour: PageTour | null) => void;
  start: () => void;
}

const PageTourContext = createContext<PageTourContextValue | null>(null);

export function PageTourProvider({ children }: { children: ReactNode }) {
  const [registered, setRegistered] = useState<PageTour | null>(null);
  /** Tour đang chạy — chụp lúc bắt đầu, trang có vẽ lại cũng không đổi bước giữa chừng. */
  const [running, setRunning] = useState<PageTour | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const here = `${location.pathname}${location.search}`;
  const hereRef = useRef(here);
  useEffect(() => {
    hereRef.current = here;
  }, [here]);
  const startedAtRef = useRef("");

  const start = useCallback(() => {
    if (!registered) return;
    startedAtRef.current = hereRef.current;
    setRunning(registered);
  }, [registered]);

  const close = useCallback(() => {
    setRunning(null);
    // Thoát ở bước nào cũng về đúng chỗ lúc bắt đầu (tab, kỳ xem, hồ sơ đang mở).
    if (startedAtRef.current && hereRef.current !== startedAtRef.current) navigate(startedAtRef.current, { replace: true });
  }, [navigate]);

  const value = useMemo(() => ({ tour: registered, register: setRegistered, start }), [registered, start]);

  return (
    <PageTourContext.Provider value={value}>
      {children}
      <GuidedTour tour={running} open={!!running} onClose={close} />
    </PageTourContext.Provider>
  );
}

/** Trang khai tour khi đang mở (truyền tour đã `useMemo`); rời trang ⇒ tự gỡ. `null` ⇒ chưa sẵn sàng (đang tải). */
export function usePageTour(tour: PageTour | null) {
  const ctx = useContext(PageTourContext);
  const register = ctx?.register;
  useEffect(() => {
    if (!register) return;
    register(tour);
    return () => register(null);
  }, [register, tour]);
}

/** Lối vào tour (nút "?" ở header, nút trên trang): có tour không, tên gì, bắt đầu. */
export function usePageTourControl(): { available: boolean; title: string; start: () => void } {
  const ctx = useContext(PageTourContext);
  return { available: !!ctx?.tour?.steps.length, title: ctx?.tour?.title ?? "", start: ctx?.start ?? (() => {}) };
}
