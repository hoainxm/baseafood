// ============================================================
// Tên file: src/lib/guidedTour.ts
// Tên tiếng Việt: Hướng dẫn từng bước trên trang — kiểu bước + luật đi tới / lùi
// Description: Page tour steps (target = data-tour value, empty ⇒ centred note) and the pure
//              rule for moving forward / back while skipping optional steps whose target is
//              missing. Oracle: docs/app-map/43-guided-tour.ba-spec.md (R3, AC-2).
// ============================================================

/** Một bước của tour. Tour chỉ DẪN và đổi chỗ xem — không bao giờ ghi số (ba-spec 43 R1). */
export interface TourStep {
  id: string;
  /** Giá trị `data-tour` của chỗ được chỉ trên trang. Trống ⇒ lời giữa trang. */
  target?: string;
  title: string;
  body: string;
  /** Chỗ không có (thiếu quyền, chưa có dữ liệu) ⇒ bỏ qua bước thay vì hiện lời giữa trang. */
  optional?: boolean;
  /** Đổi chỗ xem trước khi hiện bước (VD mở hồ sơ minh họa). Chỉ được đổi đường dẫn, không ghi. */
  prepare?: () => void;
}

/** Tour của một trang, trang đăng ký khi đang mở (ba-spec 43 NV4). */
export interface PageTour {
  title: string;
  steps: TourStep[];
  /**
   * Trả trang về chỗ cũ khi tour đóng (ở BẤT KỲ bước nào, kể cả Esc) — cho chỗ xem nằm trong state
   * của màn (chế độ, đơn đang mở…) mà đường dẫn không giữ (R5). Chỉ đổi chỗ xem, không ghi.
   */
  onExit?: () => void;
}

/**
 * Bản khai tour của MỘT trang (ba-spec 43 v4 R13–R16) — mỗi file `features/<khu>/<trang>Tour.ts`
 * export `tourSpec`. Test quét chung (`features/shared/pageTourCoverage.test.ts`) đọc mọi bản khai:
 * trang có route mà thiếu tour / thiếu hộp "?" ⇒ đỏ; lời sai văn phong, mốc `data-tour` không có
 * trên trang ⇒ đỏ.
 */
export interface PageTourSpec {
  /** Đoạn đầu đường dẫn của trang (`/imports` ⇒ "imports") — trùng id nav. */
  pageId: string;
  /** Dựng tour với ĐỦ quyền, đủ dữ liệu (bản dài nhất) — dùng cho test quét chung. */
  build: () => PageTour;
}

/** Thời gian đợi chỗ được chỉ hiện ra (trang đang tải / vừa đổi chỗ xem) — R3. */
export const TOUR_TARGET_WAIT_MS = 3000;

/**
 * Chỉ số bước kế theo hướng `dir` (1 = tới, -1 = lùi), bỏ qua bước TÙY CHỌN mà chỗ
 * của nó không có. Bước bắt buộc thiếu chỗ KHÔNG bị bỏ (hiện lời giữa trang). Hết bước ⇒ -1.
 */
export function nextStepIndex(
  steps: readonly TourStep[],
  from: number,
  dir: 1 | -1,
  isAvailable: (step: TourStep, index: number) => boolean,
): number {
  for (let i = from + dir; i >= 0 && i < steps.length; i += dir) {
    const s = steps[i];
    if (!s.target || !s.optional || isAvailable(s, i)) return i;
  }
  return -1;
}

/** CSS selector của chỗ được chỉ. */
export function tourTargetSelector(target: string): string {
  return `[data-tour="${target.replace(/["\\]/g, "\\$&")}"]`;
}
