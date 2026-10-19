// ============================================================
// Tên file: src/lib/documents.ts
// Tên tiếng Việt: Tài liệu công ty — phòng ban, quyền xem, lần ban hành, hạn chứng nhận
// Description: Pure rules for the company document library (/documents): departments,
//              per-department visibility, revision lifecycle, certificate expiry tasks.
// ============================================================
/**
 * Spec: docs/spec/quan-ly-tai-lieu.md (luật DOC-R1…R10). Hàm THUẦN, "hôm nay" truyền
 * vào để test được. Máy chủ lặp lại đúng luật xem ở hàm SQL `can_view_company_document`
 * (mig 0072) — đổi luật ở đây thì viết migration mới cho khớp.
 */
import type { AppRole, CompanyDocument, DocumentKind, DocumentVersion, Role } from "@/types";
import type { FlowWarning } from "@/lib/dataFlow";

/* ---------- Phòng ban ---------- */

/** Danh sách phòng ban cố định (spec §3 — chờ chốt danh sách thật, câu D1). Id lưu DB. */
export const DEPARTMENTS = [
  { id: "board", label: "Ban giám đốc" },
  { id: "planning", label: "Phòng Kế hoạch" },
  { id: "accounting", label: "Phòng Kế toán" },
  { id: "purchasing", label: "Thu mua (Nhập hàng)" },
  { id: "production-frozen", label: "Xưởng Đông" },
  { id: "production-fish", label: "Xưởng Cá" },
  { id: "production-dried", label: "Xưởng Khô" },
  { id: "warehouse", label: "Kho" },
  { id: "quality", label: "QC – Kỹ thuật" },
  { id: "admin-hr", label: "Hành chính – Nhân sự" },
] as const;
export type Department = (typeof DEPARTMENTS)[number]["id"];

const DEPARTMENT_LABELS = new Map<string, string>(DEPARTMENTS.map((d) => [d.id, d.label]));
export const isDepartment = (x: string): x is Department => DEPARTMENT_LABELS.has(x);
export const departmentLabel = (id: string): string => DEPARTMENT_LABELS.get(id) ?? (id || "—");

/** Phòng xem được MỌI tài liệu (cùng admin). */
export const SEE_ALL_DEPARTMENT: Department = "board";

/**
 * Phòng ban mặc định của vai trò hệ thống (spec §5, câu D2). Vai trò tự tạo — hoặc vai trò
 * hệ thống admin đã chọn phòng ở "Vai trò & quyền" — lấy `app_roles.department`.
 * Phó quản đốc / tổ trưởng chưa biết xưởng ⇒ thuộc cả ba xưởng.
 */
export const SYSTEM_ROLE_DEPARTMENTS: Readonly<Partial<Record<Role, readonly Department[]>>> = {
  director: ["board"],
  "vice-director": ["board"],
  "chief-accountant": ["accounting"],
  accountant: ["accounting"],
  "warehouse-keeper": ["purchasing", "warehouse"],
  "manager-dong": ["production-frozen"],
  "manager-ca": ["production-fish"],
  "manager-kho": ["production-dried"],
  "vice-manager": ["production-frozen", "production-fish", "production-dried"],
  "team-leader": ["production-frozen", "production-fish", "production-dried"],
};

/** Phòng ban của một người = HỢP phòng các vai trò. */
export function departmentsOfRoles(roles: readonly string[], appRoles: readonly AppRole[] = []): Department[] {
  const out = new Set<Department>();
  for (const r of roles) {
    const custom = appRoles.find((a) => a.id === r)?.department ?? "";
    if (isDepartment(custom)) out.add(custom);
    else for (const d of SYSTEM_ROLE_DEPARTMENTS[r as Role] ?? []) out.add(d);
  }
  return [...out];
}

/** Người đang xem — `seeAll` = admin, Ban giám đốc, hoặc chạy không đăng nhập (chỉ máy này). */
export interface DocumentViewer {
  seeAll: boolean;
  departments: ReadonlySet<string>;
}

export function documentViewerFor(input: {
  roles: readonly string[];
  appRoles?: readonly AppRole[];
  isAdmin: boolean;
  /** Không có tài khoản (chạy localStorage) ⇒ thấy hết như trước giờ. */
  isOffline?: boolean;
}): DocumentViewer {
  const departments = new Set<string>(departmentsOfRoles(input.roles, input.appRoles));
  return { seeAll: input.isAdmin || !!input.isOffline || departments.has(SEE_ALL_DEPARTMENT), departments };
}

/** DOC-R5: ai xem được tài liệu này. */
export function canViewDocument(
  doc: Pick<CompanyDocument, "visibility" | "ownerDepartment" | "visibleDepartments">,
  viewer: DocumentViewer,
): boolean {
  if (viewer.seeAll || doc.visibility === "company") return true;
  if (viewer.departments.has(doc.ownerDepartment)) return true;
  return doc.visibleDepartments.some((d) => viewer.departments.has(d));
}

/* ---------- Loại, mã ---------- */

export const DOCUMENT_KINDS: readonly { id: DocumentKind; label: string }[] = [
  { id: "procedure", label: "Quy trình" },
  { id: "instruction", label: "Hướng dẫn" },
  { id: "form", label: "Biểu mẫu" },
  { id: "certificate", label: "Chứng nhận" },
  { id: "capability_profile", label: "Hồ sơ năng lực" },
  { id: "other", label: "Khác" },
];
const KIND_LABELS = new Map<string, string>(DOCUMENT_KINDS.map((k) => [k.id, k.label]));
export const documentKindLabel = (k: string): string => KIND_LABELS.get(k) ?? "Khác";
export const isDocumentKind = (x: string): x is DocumentKind => KIND_LABELS.has(x);
/** Loại có ngày hết hạn (DOC-R7). */
export const kindHasExpiry = (k: DocumentKind): boolean => k === "certificate" || k === "capability_profile";

/** Mã chuẩn để so trùng (DOC-R10): bỏ khoảng trắng thừa, viết hoa. */
export function normalizeDocumentCode(code: string): string {
  return code.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Tài liệu khác đã dùng mã này (không phân hoa thường); không có ⇒ undefined. */
export function findDocumentByCode(
  docs: readonly CompanyDocument[],
  code: string,
  exceptId = "",
): CompanyDocument | undefined {
  const k = normalizeDocumentCode(code);
  return k ? docs.find((d) => d.id !== exceptId && normalizeDocumentCode(d.code) === k) : undefined;
}

/** "01", "02"… như trên tài liệu giấy. */
export const formatRevision = (n: number): string => String(Math.max(0, Math.trunc(n))).padStart(2, "0");

/* ---------- Lần ban hành ---------- */

/** Các lần ban hành của một tài liệu, mới nhất trước. */
export function versionsOf(versions: readonly DocumentVersion[], documentId: string): DocumentVersion[] {
  return versions
    .filter((v) => v.documentId === documentId)
    .sort((a, b) => b.revisionNo - a.revisionNo || b.effectiveDate.localeCompare(a.effectiveDate));
}

/** DOC-R1: lần đang hiệu lực (nếu lỡ có hai — dữ liệu cũ — lấy lần mới nhất). */
export function activeVersionOf(versions: readonly DocumentVersion[], documentId: string): DocumentVersion | undefined {
  return versionsOf(versions, documentId).find((v) => v.status === "active");
}

export function nextRevisionNo(versions: readonly DocumentVersion[], documentId: string): number {
  return versionsOf(versions, documentId).reduce((m, v) => Math.max(m, v.revisionNo), 0) + 1;
}

export type DocumentState = "active" | "draft" | "not-issued" | "withdrawn";
export const DOCUMENT_STATE_LABELS: Record<DocumentState, string> = {
  active: "Đang hiệu lực",
  draft: "Dự thảo",
  "not-issued": "Chưa ban hành",
  withdrawn: "Hết hiệu lực",
};

export function documentState(doc: Pick<CompanyDocument, "id" | "isWithdrawn">, versions: readonly DocumentVersion[]): DocumentState {
  if (doc.isWithdrawn) return "withdrawn";
  const own = versionsOf(versions, doc.id);
  if (own.some((v) => v.status === "active")) return "active";
  return own.length ? "draft" : "not-issued";
}

/** DOC-R8: chỉ xóa được tài liệu chưa từng có lần hiệu lực. */
export function canDeleteDocument(documentId: string, versions: readonly DocumentVersion[]): boolean {
  return !versionsOf(versions, documentId).some((v) => v.status === "active" || v.status === "obsolete");
}

/**
 * Ghi một lần ban hành ĐÃ KÝ GIẤY (DOC-R3b) ⇒ có hiệu lực ngay; lần đang hiệu lực trước đó
 * chuyển "Hết hiệu lực" từ ngày hiệu lực của lần mới (DOC-R1, R2 — không ghi đè).
 * Trả về danh sách lần ban hành MỚI của cả bảng + lần vừa ghi.
 */
export function recordPaperVersion(
  versions: readonly DocumentVersion[],
  version: Omit<DocumentVersion, "status" | "approvalMode" | "obsoletedOn">,
): { versions: DocumentVersion[]; version: DocumentVersion } {
  const added: DocumentVersion = { ...version, status: "active", approvalMode: "paper", obsoletedOn: "" };
  const next = versions.map((v) =>
    v.documentId === version.documentId && v.status === "active" ? { ...v, status: "obsolete" as const, obsoletedOn: version.effectiveDate } : v,
  );
  return { versions: [...next, added], version: added };
}

/** yyyy-mm-dd + n năm. */
function addYears(date: string, years: number): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return `${String(y + years).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** DOC-R9: lần đã hết hiệu lực đã quá thời hạn lưu — chỉ ĐÁNH DẤU, không tự xóa. */
export function isPastRetention(v: Pick<DocumentVersion, "status" | "obsoletedOn">, retentionYears: number, today: string): boolean {
  if (v.status !== "obsolete" || !v.obsoletedOn || retentionYears <= 0) return false;
  return today >= addYears(v.obsoletedOn, retentionYears);
}

/* ---------- Hạn chứng nhận (DOC-R7) ---------- */

/** Báo gia hạn trước ngày hết hạn bao nhiêu ngày (câu D4 — mặc định 60). */
export const DOCUMENT_EXPIRY_NOTICE_DAYS = 60;

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const minusDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

export type ExpiryState = "none" | "ok" | "expiring" | "expired";

export function expiryOf(doc: Pick<CompanyDocument, "expiresOn">, today: string): { state: ExpiryState; daysLeft: number } {
  if (!doc.expiresOn || Number.isNaN(Date.parse(`${doc.expiresOn}T00:00:00Z`))) return { state: "none", daysLeft: 0 };
  const daysLeft = daysBetween(today, doc.expiresOn);
  if (daysLeft < 0) return { state: "expired", daysLeft };
  return { state: daysLeft <= DOCUMENT_EXPIRY_NOTICE_DAYS ? "expiring" : "ok", daysLeft };
}

/** Link mở đúng tài liệu ở /documents. */
export const documentPath = (id: string): string => `/documents?doc=${encodeURIComponent(id)}`;

/**
 * Việc "Gia hạn chứng nhận" cho màn Việc của tôi: tài liệu còn hiệu lực (không thu hồi),
 * có hạn, còn ≤ DOCUMENT_EXPIRY_NOTICE_DAYS ngày hoặc đã hết hạn, và NGƯỜI XEM được xem.
 * Ngày của việc = ngày bắt đầu báo ⇒ hạn (DUE_OFFSET_DAYS) rơi đúng ngày hết hạn.
 */
export function buildDocumentWarnings(docs: readonly CompanyDocument[], today: string, viewer: DocumentViewer): FlowWarning[] {
  const out: FlowWarning[] = [];
  for (const d of docs) {
    if (d.isWithdrawn || !canViewDocument(d, viewer)) continue;
    const e = expiryOf(d, today);
    if (e.state !== "expiring" && e.state !== "expired") continue;
    out.push({
      id: `doc-exp|${d.id}|${d.expiresOn}`,
      kind: "document-expiring",
      level: e.state === "expired" ? "error" : "reminder",
      title: `Gia hạn ${documentKindLabel(d.kind).toLowerCase()}: ${d.code} — ${d.title}`,
      detail:
        e.state === "expired"
          ? `Đã hết hạn ${-e.daysLeft} ngày · ${departmentLabel(d.ownerDepartment)}`
          : `${e.daysLeft === 0 ? "Hết hạn hôm nay" : `Còn ${e.daysLeft} ngày`} · ${departmentLabel(d.ownerDepartment)}`,
      date: minusDays(d.expiresOn, DOCUMENT_EXPIRY_NOTICE_DAYS),
      workshop: "",
      path: documentPath(d.id),
    });
  }
  return out;
}

/* ---------- Tải file ---------- */

/** Giới hạn một file (câu D3 — mặc định 20 MB, khớp cài đặt bucket). */
export const DOCUMENT_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_PDF_ACCEPT = ".pdf,application/pdf";
export const DOCUMENT_SOURCE_ACCEPT = ".doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";

/** Lỗi của một file chọn để tải (null = được). */
export function checkDocumentFile(file: { name: string; size: number }, kind: "pdf" | "source"): string | null {
  if (file.size > DOCUMENT_MAX_FILE_BYTES) return `File "${file.name}" lớn hơn ${DOCUMENT_MAX_FILE_BYTES / 1024 / 1024} MB`;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const allowed = kind === "pdf" ? ["pdf"] : ["doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"];
  return allowed.includes(ext) ? null : `File "${file.name}" không đúng loại (${kind === "pdf" ? "chỉ PDF" : "Word, Excel hoặc ảnh"})`;
}

/** Tên file an toàn cho đường dẫn Storage (bỏ dấu, chỉ giữ chữ-số-gạch). */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  return `${base || "file"}${ext ? `.${ext}` : ""}`;
}
