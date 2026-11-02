// ============================================================
// Tên file: src/lib/audit.ts
// Tên tiếng Việt: Nhật ký thao tác người dùng (audit log)
// Description: Append-only user action audit trail — capture + buffer + flush
// ============================================================
import { supabase, SITE_ID } from "@/lib/supabase";
import { modeLocalKey } from "@/lib/demoMode";
import { uid } from "@/lib/db";
import { auditActionAliases, normalizeAuditAction } from "@/lib/legacyValues";

/**
 * Lưu vết thao tác CHẠM DỮ LIỆU (thêm/sửa/xóa bản ghi, đăng nhập/xuất). KHÔNG
 * log thao tác UI vụn (điều hướng, mở dialog) — ồn, phình dung lượng, vô giá trị
 * kiểm toán. Bắt tại MỘT chốt: `useBang.ghi` trong repo.ts so cũ↔mới rồi gọi
 * `appendAuditEntries` ở đây, nên mọi bảng đều được lưu vết mà không phải sửa từng màn.
 *
 * Bền bỉ như tầng dữ liệu: ghi xuống localStorage TRƯỚC (buffer), rồi đẩy lên
 * `audit_log`. Đẩy hụt (mất mạng / bảng chưa tạo) thì giữ buffer, IM LẶNG — KHÔNG
 * bật đèn đỏ kết nối như bảng nghiệp vụ (nhật ký hụt không được chặn người dùng
 * làm việc). Chưa cấu hình Supabase ⇒ buffer chính là kho đọc cho màn Nhật ký.
 *
 * Append-only: bảng chỉ cho INSERT, cấm UPDATE/DELETE ở RLS (migration 0025).
 */

export interface NewAuditEntry {
  action: string; // create | update | delete | login | logout | submit (dòng cũ tiếng Việt: xem lib/legacyValues)
  entity: string; // tên bảng (vd material_imports) hoặc 'auth'
  entityKey: string;
  summary: string;
  diff?: unknown; // {truong: [truoc, sau]} cho sửa; {_new: row} cho thêm
}

export interface AuditEntry extends NewAuditEntry {
  id: string;
  at: string; // ISO
  actorId: string;
  actorUsername: string;
  deviceId: string;
}

let actorId = "";
let actorName = "";

/** Set người đang thao tác (gọi từ App khi đổi tài khoản). null = đăng xuất. */
export function setAuditOperator(a: { id?: string; username?: string } | null): void {
  actorId = a?.id ?? "";
  actorName = a?.username ?? "";
}

const KEY_DEVICE = "bsf.device-id";
function layDeviceId(): string {
  try {
    let d = localStorage.getItem(KEY_DEVICE);
    if (!d) {
      d = uid();
      localStorage.setItem(KEY_DEVICE, d);
    }
    return d;
  } catch {
    return "";
  }
}

/** Buffer nhật ký — chế độ demo dùng vùng `bsf-demo.*` riêng (lib/demoMode.ts). */
const KEY_BUF = modeLocalKey("bsf.audit.buffer");
const CAP = 3000; // giới hạn buffer để không nuốt hết quota localStorage

function docBuffer(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(KEY_BUF);
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}
function saveBuffer(xs: AuditEntry[]): void {
  try {
    localStorage.setItem(KEY_BUF, JSON.stringify(xs.slice(-CAP)));
  } catch {
    /* hết quota — bỏ qua, nhật ký là phụ, không chặn nghiệp vụ */
  }
}

function toRow(r: AuditEntry): Record<string, unknown> {
  return {
    id: r.id,
    site_id: SITE_ID,
    at: r.at,
    actor_id: r.actorId,
    actor_username: r.actorUsername,
    action: r.action,
    entity: r.entity,
    entity_key: r.entityKey,
    summary: r.summary,
    diff: r.diff ?? null,
    device_id: r.deviceId,
  };
}
function fromRow(r: Record<string, unknown>): AuditEntry {
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    id: s(r.id),
    at: s(r.at),
    actorId: s(r.actor_id),
    actorUsername: s(r.actor_username),
    action: normalizeAuditAction(r.action),
    entity: s(r.entity),
    entityKey: s(r.entity_key),
    summary: s(r.summary),
    diff: r.diff ?? undefined,
    deviceId: s(r.device_id),
  };
}

let isFlushing = false;
/** Có entry mới trong lúc đang đẩy ⇒ đẩy thêm một lượt ngay khi lượt này xong. */
let flushAgain = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
/** Mỗi lượt gửi tối đa chừng này dòng — buffer dồn cả nghìn dòng không thành một yêu cầu quá lớn. */
export const AUDIT_BATCH = 200;
const RETRY_MS = 30_000;

export interface AuditSendResult {
  ok: boolean;
  /** Máy chủ báo trùng khóa (23505): có dòng đã lên ở lần gửi trước mà mất phản hồi. */
  duplicate?: boolean;
}

/**
 * Đẩy hết buffer theo từng lô (hàm thuần — test được, không đụng mạng / localStorage).
 * Đọc lại buffer sau mỗi lô ⇒ entry thêm vào LÚC ĐANG GỬI cũng được đẩy luôn (lỗi cũ: thao tác ghi 2 bảng
 * liền nhau, dòng thứ hai nằm kẹt dưới máy tới lần thao tác / tải trang sau — 2026-11-02, file Lệnh xuất
 * của tghung). Lô báo trùng khóa ⇒ gửi lại từng dòng, dòng trùng coi như đã lên (RLS không cho
 * `on conflict do nothing` vì chỉ admin đọc được audit_log). Trả `true` khi buffer đã sạch.
 */
export async function drainAuditBuffer(
  io: { read: () => AuditEntry[]; write: (rows: AuditEntry[]) => void; send: (rows: AuditEntry[]) => Promise<AuditSendResult> },
  batchSize = AUDIT_BATCH,
): Promise<boolean> {
  for (let round = 0; round < 1000; round++) {
    const batch = io.read().slice(0, batchSize);
    if (!batch.length) return true;
    const sent = new Set<string>();
    const res = await io.send(batch);
    if (res.ok) batch.forEach((r) => sent.add(r.id));
    else if (res.duplicate) {
      for (const r of batch) {
        const one = await io.send([r]);
        if (!one.ok && !one.duplicate) break;
        sent.add(r.id);
      }
    }
    // Chỉ xóa đúng dòng đã lên — dòng mới thêm lúc đang gửi vẫn giữ.
    if (sent.size) io.write(io.read().filter((r) => !sent.has(r.id)));
    if (sent.size < batch.length) return false;
  }
  return io.read().length === 0;
}

async function sendRows(rows: AuditEntry[]): Promise<AuditSendResult> {
  if (!supabase) return { ok: false };
  const { error } = await supabase.from("audit_log").insert(rows.map(toRow));
  return error ? { ok: false, duplicate: error.code === "23505" } : { ok: true };
}

function scheduleRetry(): void {
  if (retryTimer || typeof window === "undefined") return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, RETRY_MS);
}

async function flush(): Promise<void> {
  if (!supabase) return;
  if (isFlushing) {
    flushAgain = true;
    return;
  }
  isFlushing = true;
  flushAgain = false;
  let isDrained = false;
  try {
    isDrained = await drainAuditBuffer({ read: docBuffer, write: saveBuffer, send: sendRows });
  } catch {
    /* giữ buffer, thử lại sau — im lặng */
  } finally {
    isFlushing = false;
  }
  if (!isDrained) scheduleRetry();
  else if (flushAgain && docBuffer().length) void flush();
}

/** Ghi một loạt entry nhật ký. Không throw — lỗi nuốt để không chặn nghiệp vụ. */
export function appendAuditEntries(list: NewAuditEntry[]): void {
  if (!list.length) return;
  try {
    const at = new Date().toISOString();
    const dev = layDeviceId();
    const toAdd: AuditEntry[] = list.map((e) => ({
      ...e,
      id: uid(),
      at,
      actorId,
      actorUsername: actorName,
      deviceId: dev,
    }));
    saveBuffer([...docBuffer(), ...toAdd]);
    void flush();
  } catch {
    /* nhật ký là phụ — không bao giờ ném lỗi ra màn nghiệp vụ */
  }
}

export interface AuditLogFilter {
  fromDate?: string; // yyyy-mm-dd
  toDate?: string; // yyyy-mm-dd
  actor?: string; // actor_username
  entity?: string; // entity
  action?: string; // action
  search?: string;
  limit?: number;
}

/**
 * Biên lọc ngày theo GIỜ VIỆT NAM (UTC+7) → mốc ISO UTC để so với `at`
 * (`toISOString`, luôn `…Z`). Lọc "từ 12/10" phải tính từ 00:00 giờ VN = 17:00Z
 * ngày 11/10 — so thẳng `yyyy-mm-dd` với chuỗi UTC lệch 7 tiếng (thao tác 0h–7h
 * sáng VN rơi sang ngày hôm trước).
 */
export function toVnDayBoundsUtc(fromDate?: string, toDate?: string): { fromDate?: string; toDate?: string } {
  const iso = (s: string) => {
    const t = Date.parse(s);
    return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
  };
  return {
    fromDate: fromDate ? iso(`${fromDate}T00:00:00+07:00`) : undefined,
    toDate: toDate ? iso(`${toDate}T23:59:59.999+07:00`) : undefined,
  };
}

/** Đọc nhật ký cho màn Nhật ký (admin). Server: query audit_log; local: đọc buffer. */
export async function readAuditLog(filter: AuditLogFilter = {}): Promise<AuditEntry[]> {
  const gioiHan = filter.limit ?? 500;
  const bounds = toVnDayBoundsUtc(filter.fromDate, filter.toDate);
  const matches = (r: AuditEntry) => {
    if (filter.actor && r.actorUsername !== filter.actor) return false;
    if (filter.entity && r.entity !== filter.entity) return false;
    if (filter.action && normalizeAuditAction(r.action) !== normalizeAuditAction(filter.action)) return false;
    if (bounds.fromDate && r.at < bounds.fromDate) return false;
    if (bounds.toDate && r.at > bounds.toDate) return false;
    if (filter.search) {
      const t = filter.search.toLowerCase();
      const hay = `${r.actorUsername} ${r.entity} ${r.entityKey} ${r.summary}`.toLowerCase();
      if (!hay.includes(t)) return false;
    }
    return true;
  };

  if (supabase) {
    let q = supabase
      .from("audit_log")
      .select("*")
      .eq("site_id", SITE_ID)
      .order("at", { ascending: false })
      .limit(gioiHan);
    if (filter.actor) q = q.eq("actor_username", filter.actor);
    if (filter.entity) q = q.eq("entity", filter.entity);
    if (filter.action) q = q.in("action", auditActionAliases(filter.action));
    if (bounds.fromDate) q = q.gte("at", bounds.fromDate);
    if (bounds.toDate) q = q.lte("at", bounds.toDate);
    const { data, error } = await q;
    if (error) return [];
    let rows = (data ?? []).map((r) => fromRow(r as Record<string, unknown>));
    if (filter.search) rows = rows.filter(matches);
    return rows;
  }

  // Chế độ localStorage: buffer chính là kho.
  return [...docBuffer()]
    .reverse()
    .map((r) => ({ ...r, action: normalizeAuditAction(r.action) }))
    .filter(matches)
    .slice(0, gioiHan);
}

// Đẩy hàng chờ khi mở app, khi vừa có mạng lại, khi quay lại tab (máy ngủ / chuyển tab lâu); lượt hụt tự thử lại sau 30 giây.
void flush();
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flush();
  });
}
