// ============================================================
// Tên file: src/lib/demoMode.ts
// Tên tiếng Việt: Chế độ chạy — THẬT hay DEMO
// Description: Demo-mode flag + pure key/site helpers (spec docs/spec/che-do-demo.md §4, §4b)
// ============================================================
/**
 * Chế độ DEMO (chỉ admin bật): cả app chạy trên bộ số trình diễn nằm ở
 * `site_id = 'site-demo'` trong CÙNG DB, tách khỏi sổ thật bằng BA lớp:
 *
 *  1. `site_id` — mọi đọc lọc `site_id = SITE_ID`, mọi ghi gắn `SITE_ID`, mọi xóa lọc
 *     `site_id` (rào R2).
 *  2. TIỀN TỐ KHÓA ở ranh giới máy chủ (rào R1): khóa chính (`id` / `code`) gửi lên là
 *     `demo:<khóa>`, đọc về thì bỏ tiền tố. Khóa chính các bảng KHÔNG gồm `site_id`
 *     ⇒ không có tiền tố thì upsert dòng demo trùng khóa dòng thật (vd mã TK 1551,
 *     id chốt ngày `<ngày>|<xưởng>`) sẽ ĐÈ dòng thật sang `site-demo`. Có tiền tố thì
 *     không khóa demo nào trùng khóa thật. App bên trong vẫn dùng khóa gốc. CỘT KHÓA
 *     NGOẠI trỏ tới khóa chính đã có tiền tố (`period_id` → `balancing_periods.id`
 *     ở balancing_inputs / balancing_outputs / scraps) cũng phải mang tiền tố, không
 *     thì máy chủ từ chối (23503) — khai ở `TableMapping.refColumns`.
 *  3. Bản sao + hàng chờ dưới máy dùng khóa `bsf-demo.*` thay `bsf.*` — hàng chờ thật
 *     chưa gửi của máy đó không bao giờ bị lượt đồng bộ demo đẩy nhầm site.
 *
 * Chế độ đọc MỘT lần lúc nạp trang; đổi chế độ = ghi cờ + tải lại (tầng dữ liệu,
 * hàng chờ, client đều khởi tạo ở module scope — đổi nóng dễ ghi nhầm kho).
 */

/** Cờ chế độ trong localStorage (khóa riêng, KHÔNG thuộc vùng `bsf.*` / `bsf-demo.*`). */
export const APP_MODE_KEY = "bsf1:che-do";
/** Gói số demo vừa sinh ở chế độ thật, chờ nạp khi sang chế độ demo. */
export const DEMO_BUNDLE_KEY = "bsf1:demo-goi";
export const SITE_DEMO = "site-demo";
export const DEMO_KEY_PREFIX = "demo:";

function readFlag(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(APP_MODE_KEY) === "demo";
  } catch {
    return false;
  }
}

/** Đang ở chế độ DEMO? (đọc một lần lúc nạp trang). */
export const IS_DEMO: boolean = readFlag();

/** Khóa localStorage theo chế độ: `bsf.x` → `bsf-demo.x` khi demo; khóa khác giữ nguyên. */
export function modeLocalKey(k: string, demo: boolean = IS_DEMO): string {
  return demo && k.startsWith("bsf.") ? `bsf-demo.${k.slice(4)}` : k;
}

/** Khóa chính gửi lên máy chủ: demo ⇒ thêm tiền tố (không thêm hai lần). */
export function toServerKey(k: string, demo: boolean = IS_DEMO): string {
  return demo && !k.startsWith(DEMO_KEY_PREFIX) ? `${DEMO_KEY_PREFIX}${k}` : k;
}

/**
 * Khóa chính đọc từ máy chủ về khóa của app. Demo ⇒ bỏ tiền tố; dòng THIẾU tiền tố
 * (không phải dòng demo — không bao giờ nên có ở `site-demo`) ⇒ `null` để bỏ qua.
 */
export function fromServerKey(k: string, demo: boolean = IS_DEMO): string | null {
  if (!demo) return k;
  return k.startsWith(DEMO_KEY_PREFIX) ? k.slice(DEMO_KEY_PREFIX.length) : null;
}

/** Dòng (đã `toRow`) gửi lên: đổi khóa chính + cột khóa ngoại theo chế độ, gắn `site_id`.
 *  Cột khóa ngoại rỗng / null giữ nguyên (không trỏ đi đâu); cột MẢNG id (`text[]`,
 *  VD `products.batter_ids`) đổi từng phần tử. */
export function rowToServer(
  row: Record<string, unknown>,
  keyColumn: string,
  siteId: string,
  demo: boolean = IS_DEMO,
  refColumns: readonly string[] = [],
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...row, site_id: siteId };
  for (const c of [keyColumn, ...refColumns]) {
    const v = row[c];
    if (Array.isArray(v)) result[c] = v.map((x) => (typeof x === "string" && x !== "" ? toServerKey(x, demo) : x));
    else if (v != null && v !== "") result[c] = toServerKey(String(v), demo);
  }
  return result;
}

const stripDemoKey = (v: unknown) => (typeof v === "string" && v.startsWith(DEMO_KEY_PREFIX) ? v.slice(DEMO_KEY_PREFIX.length) : v);

/** Dòng đọc từ máy chủ → bỏ tiền tố khóa; `null` = không thuộc chế độ này, bỏ qua. */
export function rowFromServer(
  row: Record<string, unknown>,
  keyColumn: string,
  demo: boolean = IS_DEMO,
  refColumns: readonly string[] = [],
): Record<string, unknown> | null {
  if (!demo) return row;
  const k = fromServerKey(String(row[keyColumn] ?? ""), demo);
  if (k == null) return null;
  const result: Record<string, unknown> = { ...row, [keyColumn]: k };
  for (const c of refColumns) {
    if (!(c in row)) continue;
    const v = row[c];
    result[c] = Array.isArray(v) ? v.map(stripDemoKey) : stripDemoKey(v);
  }
  return result;
}

/** Bật / tắt chế độ demo rồi tải lại trang. */
export function setDemoMode(demo: boolean): void {
  try {
    if (demo) localStorage.setItem(APP_MODE_KEY, "demo");
    else localStorage.removeItem(APP_MODE_KEY);
  } catch {
    /* chế độ riêng tư chặn localStorage — không bật được, giữ nguyên */
  }
  location.reload();
}

/* ---------- Gói demo chờ nạp + việc chờ sau khi tải lại ----------
   Lưu ở localStorage (khóa riêng `bsf1:*`, ngoài vùng sổ) — màn hình KHÔNG gọi
   localStorage trực tiếp (CLAUDE.md quy tắc 4), đi qua mấy hàm này. */

/** Việc chờ làm sau khi tải lại: "tao" = quét số thật, sinh gói rồi vào demo. */
const DEMO_TASK_KEY = "bsf1:demo-viec";

/** Gói demo đang chờ nạp (null = không có / hỏng). */
export function readDemoBundle<T>(): T | null {
  try {
    const raw = localStorage.getItem(DEMO_BUNDLE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Cất gói demo chờ nạp. `false` = không cất được (đầy bộ nhớ trình duyệt). */
export function saveDemoBundle(bundle: unknown): boolean {
  try {
    localStorage.setItem(DEMO_BUNDLE_KEY, JSON.stringify(bundle));
    return true;
  } catch {
    return false;
  }
}

export function clearDemoBundle(): void {
  try {
    localStorage.removeItem(DEMO_BUNDLE_KEY);
  } catch {
    /* bỏ qua */
  }
}

export function readDemoJob(): string | null {
  try {
    return localStorage.getItem(DEMO_TASK_KEY);
  } catch {
    return null;
  }
}

/** Đặt / xóa (null) việc chờ sau khi tải lại. */
export function setPendingDemoTask(task: "tao" | null): void {
  try {
    if (task) localStorage.setItem(DEMO_TASK_KEY, task);
    else localStorage.removeItem(DEMO_TASK_KEY);
  } catch {
    /* bỏ qua */
  }
}
