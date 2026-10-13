// ============================================================
// Tên file: src/lib/cheDo.ts
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
 *     thì máy chủ từ chối (23503) — khai ở `AnhXaBang.cotThamChieu`.
 *  3. Bản sao + hàng chờ dưới máy dùng khóa `bsf-demo.*` thay `bsf.*` — hàng chờ thật
 *     chưa gửi của máy đó không bao giờ bị lượt đồng bộ demo đẩy nhầm site.
 *
 * Chế độ đọc MỘT lần lúc nạp trang; đổi chế độ = ghi cờ + tải lại (tầng dữ liệu,
 * hàng chờ, client đều khởi tạo ở module scope — đổi nóng dễ ghi nhầm kho).
 */

/** Cờ chế độ trong localStorage (khóa riêng, KHÔNG thuộc vùng `bsf.*` / `bsf-demo.*`). */
export const KHOA_CHE_DO = "bsf1:che-do";
/** Gói số demo vừa sinh ở chế độ thật, chờ nạp khi sang chế độ demo. */
export const KHOA_GOI_DEMO = "bsf1:demo-goi";
export const SITE_DEMO = "site-demo";
export const TIEN_TO_DEMO = "demo:";

function docCo(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(KHOA_CHE_DO) === "demo";
  } catch {
    return false;
  }
}

/** Đang ở chế độ DEMO? (đọc một lần lúc nạp trang). */
export const LA_DEMO: boolean = docCo();

/** Khóa localStorage theo chế độ: `bsf.x` → `bsf-demo.x` khi demo; khóa khác giữ nguyên. */
export function khoaLocal(k: string, demo: boolean = LA_DEMO): string {
  return demo && k.startsWith("bsf.") ? `bsf-demo.${k.slice(4)}` : k;
}

/** Khóa chính gửi lên máy chủ: demo ⇒ thêm tiền tố (không thêm hai lần). */
export function khoaLenMay(k: string, demo: boolean = LA_DEMO): string {
  return demo && !k.startsWith(TIEN_TO_DEMO) ? `${TIEN_TO_DEMO}${k}` : k;
}

/**
 * Khóa chính đọc từ máy chủ về khóa của app. Demo ⇒ bỏ tiền tố; dòng THIẾU tiền tố
 * (không phải dòng demo — không bao giờ nên có ở `site-demo`) ⇒ `null` để bỏ qua.
 */
export function khoaTuMay(k: string, demo: boolean = LA_DEMO): string | null {
  if (!demo) return k;
  return k.startsWith(TIEN_TO_DEMO) ? k.slice(TIEN_TO_DEMO.length) : null;
}

/** Dòng (đã `toRow`) gửi lên: đổi khóa chính + cột khóa ngoại theo chế độ, gắn `site_id`.
 *  Cột khóa ngoại rỗng / null giữ nguyên (không trỏ đi đâu). */
export function dongLenMay(
  row: Record<string, unknown>,
  cotKhoa: string,
  siteId: string,
  demo: boolean = LA_DEMO,
  cotThamChieu: readonly string[] = [],
): Record<string, unknown> {
  const ra: Record<string, unknown> = { ...row, site_id: siteId };
  for (const c of [cotKhoa, ...cotThamChieu]) {
    const v = row[c];
    if (v != null && v !== "") ra[c] = khoaLenMay(String(v), demo);
  }
  return ra;
}

/** Dòng đọc từ máy chủ → bỏ tiền tố khóa; `null` = không thuộc chế độ này, bỏ qua. */
export function dongTuMay(
  row: Record<string, unknown>,
  cotKhoa: string,
  demo: boolean = LA_DEMO,
  cotThamChieu: readonly string[] = [],
): Record<string, unknown> | null {
  if (!demo) return row;
  const k = khoaTuMay(String(row[cotKhoa] ?? ""), demo);
  if (k == null) return null;
  const ra: Record<string, unknown> = { ...row, [cotKhoa]: k };
  for (const c of cotThamChieu) {
    const v = row[c];
    if (typeof v === "string" && v.startsWith(TIEN_TO_DEMO)) ra[c] = v.slice(TIEN_TO_DEMO.length);
  }
  return ra;
}

/** Bật / tắt chế độ demo rồi tải lại trang. */
export function datCheDo(demo: boolean): void {
  try {
    if (demo) localStorage.setItem(KHOA_CHE_DO, "demo");
    else localStorage.removeItem(KHOA_CHE_DO);
  } catch {
    /* chế độ riêng tư chặn localStorage — không bật được, giữ nguyên */
  }
  location.reload();
}

/* ---------- Gói demo chờ nạp + việc chờ sau khi tải lại ----------
   Lưu ở localStorage (khóa riêng `bsf1:*`, ngoài vùng sổ) — màn hình KHÔNG gọi
   localStorage trực tiếp (CLAUDE.md quy tắc 4), đi qua mấy hàm này. */

/** Việc chờ làm sau khi tải lại: "tao" = quét số thật, sinh gói rồi vào demo. */
const KHOA_VIEC_DEMO = "bsf1:demo-viec";

/** Gói demo đang chờ nạp (null = không có / hỏng). */
export function docGoiDemo<T>(): T | null {
  try {
    const raw = localStorage.getItem(KHOA_GOI_DEMO);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Cất gói demo chờ nạp. `false` = không cất được (đầy bộ nhớ trình duyệt). */
export function luuGoiDemo(goi: unknown): boolean {
  try {
    localStorage.setItem(KHOA_GOI_DEMO, JSON.stringify(goi));
    return true;
  } catch {
    return false;
  }
}

export function xoaGoiDemo(): void {
  try {
    localStorage.removeItem(KHOA_GOI_DEMO);
  } catch {
    /* bỏ qua */
  }
}

export function docViecDemo(): string | null {
  try {
    return localStorage.getItem(KHOA_VIEC_DEMO);
  } catch {
    return null;
  }
}

/** Đặt / xóa (null) việc chờ sau khi tải lại. */
export function datViecDemo(viec: "tao" | null): void {
  try {
    if (viec) localStorage.setItem(KHOA_VIEC_DEMO, viec);
    else localStorage.removeItem(KHOA_VIEC_DEMO);
  } catch {
    /* bỏ qua */
  }
}
