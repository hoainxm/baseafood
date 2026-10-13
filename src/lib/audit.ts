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
async function flush(): Promise<void> {
  if (!supabase || isFlushing) return;
  const buf = docBuffer();
  if (buf.length === 0) return;
  isFlushing = true;
  try {
    const sentIds = new Set(buf.map((r) => r.id));
    const { error } = await supabase.from("audit_log").insert(buf.map(toRow));
    if (!error) {
      // Chỉ xóa đúng dòng đã gửi — dòng mới thêm lúc đang gửi vẫn giữ.
      saveBuffer(docBuffer().filter((r) => !sentIds.has(r.id)));
    }
  } catch {
    /* giữ buffer, thử lại lần sau — im lặng */
  } finally {
    isFlushing = false;
  }
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
  tu?: string; // yyyy-mm-dd
  den?: string; // yyyy-mm-dd
  nguoi?: string; // actor_username
  bang?: string; // entity
  loai?: string; // action
  timKiem?: string;
  gioiHan?: number;
}

/**
 * Biên lọc ngày theo GIỜ VIỆT NAM (UTC+7) → mốc ISO UTC để so với `at`
 * (`toISOString`, luôn `…Z`). Lọc "từ 12/10" phải tính từ 00:00 giờ VN = 17:00Z
 * ngày 11/10 — so thẳng `yyyy-mm-dd` với chuỗi UTC lệch 7 tiếng (thao tác 0h–7h
 * sáng VN rơi sang ngày hôm trước).
 */
export function toVnDayBoundsUtc(tu?: string, den?: string): { tu?: string; den?: string } {
  const iso = (s: string) => {
    const t = Date.parse(s);
    return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
  };
  return {
    tu: tu ? iso(`${tu}T00:00:00+07:00`) : undefined,
    den: den ? iso(`${den}T23:59:59.999+07:00`) : undefined,
  };
}

/** Đọc nhật ký cho màn Nhật ký (admin). Server: query audit_log; local: đọc buffer. */
export async function readAuditLog(filter: AuditLogFilter = {}): Promise<AuditEntry[]> {
  const gioiHan = filter.gioiHan ?? 500;
  const bien = toVnDayBoundsUtc(filter.tu, filter.den);
  const matches = (r: AuditEntry) => {
    if (filter.nguoi && r.actorUsername !== filter.nguoi) return false;
    if (filter.bang && r.entity !== filter.bang) return false;
    if (filter.loai && normalizeAuditAction(r.action) !== normalizeAuditAction(filter.loai)) return false;
    if (bien.tu && r.at < bien.tu) return false;
    if (bien.den && r.at > bien.den) return false;
    if (filter.timKiem) {
      const t = filter.timKiem.toLowerCase();
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
    if (filter.nguoi) q = q.eq("actor_username", filter.nguoi);
    if (filter.bang) q = q.eq("entity", filter.bang);
    if (filter.loai) q = q.in("action", auditActionAliases(filter.loai));
    if (bien.tu) q = q.gte("at", bien.tu);
    if (bien.den) q = q.lte("at", bien.den);
    const { data, error } = await q;
    if (error) return [];
    let rows = (data ?? []).map((r) => fromRow(r as Record<string, unknown>));
    if (filter.timKiem) rows = rows.filter(matches);
    return rows;
  }

  // Chế độ localStorage: buffer chính là kho.
  return [...docBuffer()]
    .reverse()
    .map((r) => ({ ...r, action: normalizeAuditAction(r.action) }))
    .filter(matches)
    .slice(0, gioiHan);
}

// Đẩy hàng chờ khi mở app + khi vừa có mạng lại.
void flush();
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flush());
}
