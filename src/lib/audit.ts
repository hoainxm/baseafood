// ============================================================
// Tên file: src/lib/audit.ts
// Tên tiếng Việt: Nhật ký thao tác người dùng (audit log)
// Description: Append-only user action audit trail — capture + buffer + flush
// ============================================================
import { supabase, SITE_ID } from "@/lib/supabase";
import { uid } from "@/lib/db";

/**
 * Lưu vết thao tác CHẠM DỮ LIỆU (thêm/sửa/xóa bản ghi, đăng nhập/xuất). KHÔNG
 * log thao tác UI vụn (điều hướng, mở dialog) — ồn, phình dung lượng, vô giá trị
 * kiểm toán. Bắt tại MỘT chốt: `useBang.ghi` trong repo.ts so cũ↔mới rồi gọi
 * `ghiNhatKy` ở đây, nên mọi bảng đều được lưu vết mà không phải sửa từng màn.
 *
 * Bền bỉ như tầng dữ liệu: ghi xuống localStorage TRƯỚC (buffer), rồi đẩy lên
 * `audit_log`. Đẩy hụt (mất mạng / bảng chưa tạo) thì giữ buffer, IM LẶNG — KHÔNG
 * bật đèn đỏ kết nối như bảng nghiệp vụ (nhật ký hụt không được chặn người dùng
 * làm việc). Chưa cấu hình Supabase ⇒ buffer chính là kho đọc cho màn Nhật ký.
 *
 * Append-only: bảng chỉ cho INSERT, cấm UPDATE/DELETE ở RLS (migration 0025).
 */

export interface NhatKyMoi {
  action: string; // them | sua | xoa | dang-nhap | dang-xuat
  entity: string; // tên bảng (vd material_imports) hoặc 'auth'
  entityKey: string;
  summary: string;
  diff?: unknown; // {truong: [truoc, sau]} cho sửa; {_new: row} cho thêm
}

export interface NhatKy extends NhatKyMoi {
  id: string;
  at: string; // ISO
  actorId: string;
  actorUsername: string;
  deviceId: string;
}

let actorId = "";
let actorName = "";

/** Set người đang thao tác (gọi từ App khi đổi tài khoản). null = đăng xuất. */
export function datNguoiThaoTac(a: { id?: string; username?: string } | null): void {
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

const KEY_BUF = "bsf.audit.buffer";
const CAP = 3000; // giới hạn buffer để không nuốt hết quota localStorage

function docBuffer(): NhatKy[] {
  try {
    const raw = localStorage.getItem(KEY_BUF);
    return raw ? (JSON.parse(raw) as NhatKy[]) : [];
  } catch {
    return [];
  }
}
function luuBuffer(xs: NhatKy[]): void {
  try {
    localStorage.setItem(KEY_BUF, JSON.stringify(xs.slice(-CAP)));
  } catch {
    /* hết quota — bỏ qua, nhật ký là phụ, không chặn nghiệp vụ */
  }
}

function toRow(r: NhatKy): Record<string, unknown> {
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
function fromRow(r: Record<string, unknown>): NhatKy {
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    id: s(r.id),
    at: s(r.at),
    actorId: s(r.actor_id),
    actorUsername: s(r.actor_username),
    action: s(r.action),
    entity: s(r.entity),
    entityKey: s(r.entity_key),
    summary: s(r.summary),
    diff: r.diff ?? undefined,
    deviceId: s(r.device_id),
  };
}

let dangFlush = false;
async function flush(): Promise<void> {
  if (!supabase || dangFlush) return;
  const buf = docBuffer();
  if (buf.length === 0) return;
  dangFlush = true;
  try {
    const guiIds = new Set(buf.map((r) => r.id));
    const { error } = await supabase.from("audit_log").insert(buf.map(toRow));
    if (!error) {
      // Chỉ xóa đúng dòng đã gửi — dòng mới thêm lúc đang gửi vẫn giữ.
      luuBuffer(docBuffer().filter((r) => !guiIds.has(r.id)));
    }
  } catch {
    /* giữ buffer, thử lại lần sau — im lặng */
  } finally {
    dangFlush = false;
  }
}

/** Ghi một loạt entry nhật ký. Không throw — lỗi nuốt để không chặn nghiệp vụ. */
export function ghiNhatKy(list: NhatKyMoi[]): void {
  if (!list.length) return;
  try {
    const at = new Date().toISOString();
    const dev = layDeviceId();
    const them: NhatKy[] = list.map((e) => ({
      ...e,
      id: uid(),
      at,
      actorId,
      actorUsername: actorName,
      deviceId: dev,
    }));
    luuBuffer([...docBuffer(), ...them]);
    void flush();
  } catch {
    /* nhật ký là phụ — không bao giờ ném lỗi ra màn nghiệp vụ */
  }
}

export interface LocNhatKy {
  tu?: string; // yyyy-mm-dd
  den?: string; // yyyy-mm-dd
  nguoi?: string; // actor_username
  bang?: string; // entity
  loai?: string; // action
  timKiem?: string;
  gioiHan?: number;
}

/** Đọc nhật ký cho màn Nhật ký (admin). Server: query audit_log; local: đọc buffer. */
export async function docNhatKy(loc: LocNhatKy = {}): Promise<NhatKy[]> {
  const gioiHan = loc.gioiHan ?? 500;
  const khop = (r: NhatKy) => {
    if (loc.nguoi && r.actorUsername !== loc.nguoi) return false;
    if (loc.bang && r.entity !== loc.bang) return false;
    if (loc.loai && r.action !== loc.loai) return false;
    if (loc.tu && r.at < loc.tu) return false;
    if (loc.den && r.at > `${loc.den}T23:59:59.999Z`) return false;
    if (loc.timKiem) {
      const t = loc.timKiem.toLowerCase();
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
    if (loc.nguoi) q = q.eq("actor_username", loc.nguoi);
    if (loc.bang) q = q.eq("entity", loc.bang);
    if (loc.loai) q = q.eq("action", loc.loai);
    if (loc.tu) q = q.gte("at", loc.tu);
    if (loc.den) q = q.lte("at", `${loc.den}T23:59:59.999Z`);
    const { data, error } = await q;
    if (error) return [];
    let rows = (data ?? []).map((r) => fromRow(r as Record<string, unknown>));
    if (loc.timKiem) rows = rows.filter(khop);
    return rows;
  }

  // Chế độ localStorage: buffer chính là kho.
  return [...docBuffer()]
    .reverse()
    .filter(khop)
    .slice(0, gioiHan);
}

// Đẩy hàng chờ khi mở app + khi vừa có mạng lại.
void flush();
if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flush());
}
