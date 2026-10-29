// ============================================================
// Tên file: src/lib/importSampleChecks.ts
// Tên tiếng Việt: Kiểm mẫu hàng nhập khẩu của Kho — khuôn chỉ số, đọc Excel, chọn cột theo invoice
// Description: Pure rules of ba-spec 45 v4 (NI11, R23–R26): metric template of the warehouse
//              sample report, Excel grid parsing (merged cells, Vietnamese numbers), column /
//              contract-line suggestion for one receipt, batch replace. Values are STORED, never computed.
// ============================================================
// Oracle: docs/app-map/45-import-planning.ba-spec.md §0d (AC-35…AC-39). Đọc file thật ở
// lib/importSampleFile.ts (trình duyệt); file này chỉ nhận lưới ô đã đọc ⇒ test được.
import type { ImportContractLine, ImportSampleCheck } from "@/types";

/* ---------- Khuôn chỉ số (giữ đúng nhãn của kho) ---------- */

export type SampleMetricKind = "text" | "date" | "number" | "percent";

/** Khóa chỉ số đơn (không gồm phân bố size). */
export type SampleMetricKey =
  | "sampleNo"
  | "size"
  | "exporterName"
  | "importDate"
  | "packing"
  | "productionDate"
  | "expiryDate"
  | "grossWeightG"
  | "netWeightG"
  | "netShortagePct"
  | "color"
  | "blackSpot"
  | "odor"
  | "mossPct"
  | "oneSkinPct"
  | "twoSkinPct"
  | "madaPct"
  | "thawingNorm"
  | "preprocessingNorm"
  | "blanchingNorm"
  | "cuttingNorm"
  | "surplusNorm"
  | "materialToFinishedNorm";

export interface SampleMetric {
  key: SampleMetricKey;
  label: string;
  kind: SampleMetricKind;
  group: "head" | "weight" | "sensory" | "type" | "norm";
  /** Nhóm của nhãn trên báo cáo (ô gộp cột đầu) — "Loại" cho 1 da / 2 da / Mada. */
  parent?: string;
}

export const SAMPLE_METRICS: readonly SampleMetric[] = [
  { key: "size", label: "Size", kind: "text", group: "head" },
  { key: "sampleNo", label: "STT mẫu", kind: "text", group: "head" },
  { key: "exporterName", label: "Nhà xuất khẩu", kind: "text", group: "head" },
  { key: "importDate", label: "Ngày nhập", kind: "date", group: "head" },
  { key: "packing", label: "Packing", kind: "text", group: "head" },
  { key: "productionDate", label: "Ngày sản xuất", kind: "date", group: "head" },
  { key: "expiryDate", label: "Ngày hết hạn", kind: "date", group: "head" },
  { key: "grossWeightG", label: "GW (gr)", kind: "number", group: "weight" },
  { key: "netWeightG", label: "NW (gr)", kind: "number", group: "weight" },
  { key: "netShortagePct", label: "Thiếu net (%)", kind: "percent", group: "weight" },
  { key: "color", label: "Màu", kind: "text", group: "sensory" },
  { key: "blackSpot", label: "Nám", kind: "text", group: "sensory" },
  { key: "odor", label: "Mùi", kind: "text", group: "sensory" },
  { key: "mossPct", label: "Rêu", kind: "percent", group: "sensory" },
  { key: "oneSkinPct", label: "1 da", kind: "percent", group: "type", parent: "Loại" },
  { key: "twoSkinPct", label: "2 da", kind: "percent", group: "type", parent: "Loại" },
  { key: "madaPct", label: "Mada", kind: "percent", group: "type", parent: "Loại" },
  { key: "thawingNorm", label: "Định mức XĐ", kind: "number", group: "norm" },
  { key: "preprocessingNorm", label: "Định mức SC", kind: "number", group: "norm" },
  { key: "blanchingNorm", label: "Định mức chần", kind: "number", group: "norm" },
  { key: "cuttingNorm", label: "Định mức cắt", kind: "number", group: "norm" },
  { key: "surplusNorm", label: "Phụ trội 3%", kind: "number", group: "norm" },
  { key: "materialToFinishedNorm", label: "ĐM NL - TP", kind: "number", group: "norm" },
];

/** Khoảng size của phân bố (gr/pc) — đúng nhãn báo cáo, thứ tự như tờ báo cáo. */
export const SIZE_BUCKETS = ["<30gr", "30/50", "50/70", "70/100", "100/150", "150/200", "200/300", "300/up"] as const;

export const SAMPLE_GROUP_LABELS: Record<SampleMetric["group"], string> = {
  head: "Thông tin mẫu",
  weight: "Cân",
  sensory: "Cảm quan",
  type: "Loại",
  norm: "Định mức",
};

/** Mẫu rỗng của một lần nhập — mọi ô trống. */
export function emptySample(id: string, p: Pick<ImportSampleCheck, "contractId" | "receiptId"> & Partial<ImportSampleCheck>): ImportSampleCheck {
  return {
    contractLineId: "",
    batchId: "",
    fileId: "",
    reportDate: "",
    sampleNo: "",
    size: "",
    exporterName: "",
    importDate: "",
    packing: "",
    productionDate: "",
    expiryDate: "",
    grossWeightG: null,
    netWeightG: null,
    netShortagePct: null,
    color: "",
    blackSpot: "",
    odor: "",
    mossPct: null,
    oneSkinPct: null,
    twoSkinPct: null,
    madaPct: null,
    sizeDistribution: {},
    thawingNorm: null,
    preprocessingNorm: null,
    blanchingNorm: null,
    cuttingNorm: null,
    surplusNorm: null,
    materialToFinishedNorm: null,
    extra: {},
    note: "",
    createdAt: "",
    ...p,
    id,
  };
}

/* ---------- Đọc ô ---------- */

/** Một ô đã đọc từ Excel: giá trị + định dạng số (để biết ô %). */
export interface SampleCell {
  v: string | number | boolean | Date | null;
  /** Chuỗi định dạng số của ô ("0.0%", "dd/mm/yyyy"…). */
  z?: string;
}

/** Bỏ dấu + thường + gộp khoảng trắng — so nhãn không lệ thuộc cách gõ. */
export const plainKey = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Nhãn để so: bỏ phần trong ngoặc, dấu ":", gạch nối → khoảng trắng. */
const labelKey = (v: string) =>
  plainKey(v)
    .replace(/\(.*?\)/g, " ")
    .replace(/[:\-–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cellText = (c: SampleCell | undefined): string => {
  if (!c || c.v == null) return "";
  if (c.v instanceof Date) return isoDate(c.v);
  return String(c.v).trim();
};

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isRealDate = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** Số kiểu Việt ("1,05" · "24.300" · "5,0%") hoặc số thật của ô. Không đọc được ⇒ null. */
export function parseSampleNumber(c: SampleCell | undefined, percent = false): number | null {
  if (!c || c.v == null || c.v === "") return null;
  if (typeof c.v === "number") {
    const isPctFormat = !!c.z && c.z.includes("%");
    const n = percent && isPctFormat ? c.v * 100 : c.v;
    return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : null;
  }
  if (typeof c.v !== "string") return null;
  let t = c.v.trim().replace(/\s+/g, "");
  if (!t) return null;
  const hasPct = t.endsWith("%");
  if (hasPct) t = t.slice(0, -1);
  if (!/^-?[\d.,]+$/.test(t)) return null;
  // Kiểu Việt: "." phân nghìn (nhóm 3 số), "," thập phân.
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(t)) t = t.replace(",", ".");
  else if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Ngày của ô (Date thật hoặc "dd/mm/yyyy") ⇒ ISO; sai ngày ⇒ "". */
export function parseSampleDate(c: SampleCell | undefined): string {
  if (!c || c.v == null) return "";
  if (c.v instanceof Date) return Number.isNaN(c.v.getTime()) ? "" : isoDate(c.v);
  // Ô ngày của Excel = số serial (ngày kể từ 30/12/1899) + định dạng ngày; đọc theo UTC, khỏi lệch múi giờ.
  if (typeof c.v === "number") {
    if (!c.z || !/[dy]/i.test(c.z) || c.v < 1 || c.v > 2958465) return "";
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(c.v) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const t = String(c.v).trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) return isRealDate(+m[3], +m[2], +m[1]) ? `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` : "";
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return isRealDate(+m[1], +m[2], +m[3]) ? t : "";
  return "";
}

/* ---------- Đọc lưới báo cáo (AC-35, AC-37) ---------- */

export interface SampleMerge {
  s: { r: number; c: number };
  e: { r: number; c: number };
}

export interface ParsedSample {
  /** Cột của mẫu trên tờ báo cáo (0 = cột A). */
  column: number;
  values: Omit<ImportSampleCheck, "id" | "contractId" | "receiptId" | "contractLineId" | "batchId" | "fileId" | "createdAt" | "note">;
  /** Ô có chữ mà không đọc ra số / ngày hợp lệ — người dùng soát (R24). */
  needsReview: string[];
}

export interface SampleReportParse {
  reportDate: string;
  samples: ParsedSample[];
  /** Lý do không đọc được (không thấy hàng "STT mẫu" / "Size"). */
  failure?: string;
}

const METRIC_BY_LABEL = new Map<string, SampleMetric>(SAMPLE_METRICS.map((m) => [labelKey(m.label), m]));
const BUCKET_BY_LABEL = new Map<string, string>(SIZE_BUCKETS.map((b) => [labelKey(b), b]));
/** Nhãn khác cách viết của cùng chỉ số. */
const ALIASES: Record<string, SampleMetricKey> = {
  "stt": "sampleNo",
  "nha xk": "exporterName",
  "nsx": "productionDate",
  "hsd": "expiryDate",
  "dm nl tp": "materialToFinishedNorm",
  "dinh muc nl tp": "materialToFinishedNorm",
  "phu troi": "surplusNorm",
  "phu troi 3%": "surplusNorm",
};

function metricFor(label: string): SampleMetric | undefined {
  const k = labelKey(label);
  if (!k) return undefined;
  const direct = METRIC_BY_LABEL.get(k);
  if (direct) return direct;
  const alias = ALIASES[k] ?? (k.startsWith("phu troi") ? "surplusNorm" : undefined);
  return alias ? SAMPLE_METRICS.find((m) => m.key === alias) : undefined;
}

/** Chép giá trị ô gộp sang mọi ô của vùng (Excel chỉ giữ ô trên-trái). */
export function fillMerges(grid: SampleCell[][], merges: readonly SampleMerge[] = []): SampleCell[][] {
  const out = grid.map((row) => [...row]);
  for (const m of merges) {
    const src = out[m.s.r]?.[m.s.c];
    if (!src) continue;
    for (let r = m.s.r; r <= m.e.r; r++) {
      out[r] = out[r] ?? [];
      for (let c = m.s.c; c <= m.e.c; c++) if (r !== m.s.r || c !== m.s.c) out[r][c] = { ...src };
    }
  }
  return out;
}

/**
 * Đọc tờ báo cáo kiểm mẫu (R24): nhãn ở cột đầu (nhóm "Loại" / "Size (gr/pc)" có nhãn con ở cột
 * kế), mỗi cột sau nhãn là một mẫu. Đọc THEO NHÃN, không theo số dòng ⇒ kho thêm / bớt hàng vẫn đúng.
 */
export function parseSampleReport(rawGrid: SampleCell[][], merges: readonly SampleMerge[] = []): SampleReportParse {
  const grid = fillMerges(rawGrid, merges);
  const width = Math.max(0, ...grid.map((r) => r.length));
  // Tìm hàng "STT mẫu" để biết cột nhãn và các cột mẫu.
  let labelCols = 1;
  let sampleCols: number[] = [];
  let reportDate = "";
  for (const row of grid) {
    const texts = Array.from({ length: width }, (_, c) => cellText(row[c]));
    const k0 = labelKey(texts[0] ?? "");
    if (k0 === "ngay" && !reportDate) {
      const v = row.slice(1).find((c) => cellText(c) && labelKey(cellText(c)) !== "ngay");
      reportDate = parseSampleDate(v);
    }
    if (metricFor(texts[0] ?? "")?.key === "sampleNo") {
      labelCols = texts[1] && labelKey(texts[1]) === k0 ? 2 : 1;
      sampleCols = texts.map((t, c) => (c >= labelCols && t && labelKey(t) !== k0 ? c : -1)).filter((c) => c >= 0);
    }
  }
  if (!sampleCols.length) return { reportDate, samples: [], failure: 'Không thấy hàng "STT mẫu" — file không theo khuôn báo cáo kiểm mẫu của kho.' };

  const samples: ParsedSample[] = sampleCols.map((column) => ({
    column,
    values: {
      reportDate,
      sampleNo: "",
      size: "",
      exporterName: "",
      importDate: "",
      packing: "",
      productionDate: "",
      expiryDate: "",
      grossWeightG: null,
      netWeightG: null,
      netShortagePct: null,
      color: "",
      blackSpot: "",
      odor: "",
      mossPct: null,
      oneSkinPct: null,
      twoSkinPct: null,
      madaPct: null,
      sizeDistribution: {},
      thawingNorm: null,
      preprocessingNorm: null,
      blanchingNorm: null,
      cuttingNorm: null,
      surplusNorm: null,
      materialToFinishedNorm: null,
      extra: {},
    },
    needsReview: [],
  }));

  for (const row of grid) {
    const head = cellText(row[0]);
    const sub = labelCols === 2 ? cellText(row[1]) : "";
    const isSubRow = !!sub && labelKey(sub) !== labelKey(head);
    const label = isSubRow ? sub : head;
    if (!label || labelKey(head) === "ngay") continue;
    const bucket = isSubRow ? BUCKET_BY_LABEL.get(labelKey(sub)) : undefined;
    const metric = bucket ? undefined : metricFor(label);
    // Hàng tiêu đề nhóm ("Định mức") không có số ở cột mẫu ⇒ bỏ qua.
    const cells = samples.map((s) => row[s.column]);
    if (!metric && !bucket && cells.every((c) => !cellText(c) || labelKey(cellText(c)) === labelKey(label))) continue;
    samples.forEach((s, i) => {
      const c = cells[i];
      const text = cellText(c);
      if (bucket) {
        const n = parseSampleNumber(c, true);
        if (text && (n == null || n < 0 || n > 100)) s.needsReview.push(`Size ${bucket}`);
        if (text || bucket in s.values.sizeDistribution) s.values.sizeDistribution[bucket] = n != null && n >= 0 && n <= 100 ? n : null;
        return;
      }
      if (!metric) {
        if (text) s.values.extra[isSubRow ? `${head} · ${sub}` : head] = text;
        return;
      }
      const v = s.values as unknown as Record<string, unknown>;
      if (metric.kind === "text") v[metric.key] = text;
      else if (metric.kind === "date") {
        const d = parseSampleDate(c);
        if (text && !d) s.needsReview.push(metric.label);
        v[metric.key] = d;
      } else {
        const n = parseSampleNumber(c, metric.kind === "percent");
        const ok = n != null && n >= 0 && (metric.kind !== "percent" || n <= 100);
        if (text && !ok) s.needsReview.push(metric.label);
        v[metric.key] = ok ? n : null;
      }
    });
  }
  return { reportDate, samples };
}

/* ---------- Chọn cột cho một lần nhập (AC-36) ---------- */

export interface SampleMatchContext {
  /** Tên NCC của HĐ (tên gọi tắt + tên đầy đủ). */
  supplierNames: readonly string[];
  /** Số chứng từ của lần nhập (invoice "IFE/21/2026-27"…) — tiền tố chữ có thể là tên viết tắt. */
  docNos: readonly string[];
  /** Ngày về kho (ISO) của lần nhập; "" = chưa biết. */
  arrivalDate: string;
}

const words = (v: string) => plainKey(v).replace(/[^a-z0-9 ]/g, " ").split(" ").filter(Boolean);
const STOP = new Set(["co", "ltd", "pvt", "company", "the", "and", "of"]);

/** Nhà XK trên báo cáo khớp NCC: chứa nhau · chữ đầu tên đầy đủ ("Ife" ↔ International Freezfish Exports) · tiền tố số invoice. */
export function exporterMatches(exporter: string, ctx: Pick<SampleMatchContext, "supplierNames" | "docNos">): boolean {
  const e = words(exporter).join(" ");
  if (!e) return false;
  for (const name of ctx.supplierNames) {
    const n = words(name).filter((w) => !STOP.has(w));
    if (!n.length) continue;
    const joined = n.join(" ");
    if (joined.includes(e) || e.includes(joined)) return true;
    if (n.map((w) => w[0]).join("") === e.replace(/ /g, "")) return true;
  }
  return ctx.docNos.some((no) => {
    const prefix = /^([A-Za-z]{2,})[/-]/.exec(no.trim())?.[1];
    return !!prefix && prefix.toLowerCase() === e.replace(/ /g, "");
  });
}

/** Cột thuộc lần nhập: nhà XK khớp NCC và (ngày nhập trống hoặc trùng ngày về kho). */
export function suggestSampleColumns(samples: readonly ParsedSample[], ctx: SampleMatchContext): number[] {
  return samples
    .filter((s) => exporterMatches(s.values.exporterName, ctx))
    .filter((s) => !ctx.arrivalDate || !s.values.importDate || s.values.importDate === ctx.arrivalDate)
    .map((s) => s.column);
}

/** Size "70/100" ⇒ dòng hàng có tên chứa đúng size đó (không dính số kề bên). Không ra đúng một ⇒ "". */
export function suggestLineForSize(size: string, lines: readonly Pick<ImportContractLine, "id" | "productName">[]): string {
  const s = size.replace(/\s+/g, "").replace(/gr?\/?pc$/i, "");
  if (!/\d/.test(s)) return "";
  const esc = s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const re = new RegExp(`(^|[^\\d/])${esc}($|[^\\d/])`, "i");
  const hit = lines.filter((l) => re.test(l.productName.replace(/\s*\/\s*/g, "/")));
  return hit.length === 1 ? hit[0].id : "";
}

/* ---------- Lưu: nạp lại thì thay (AC-39) ---------- */

export function samplesOfReceipt(rows: readonly ImportSampleCheck[], receiptId: string): ImportSampleCheck[] {
  return rows
    .filter((x) => x.receiptId === receiptId)
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate) || a.sampleNo.localeCompare(b.sampleNo, "vi", { numeric: true }) || a.createdAt.localeCompare(b.createdAt));
}

/** Ghi mẫu mới của một lần nhập. `replace` (Q4) ⇒ bỏ mọi mẫu đang có của lần nhập đó. */
export function mergeSamples(rows: readonly ImportSampleCheck[], receiptId: string, added: readonly ImportSampleCheck[], replace: boolean): ImportSampleCheck[] {
  const kept = replace ? rows.filter((x) => x.receiptId !== receiptId) : [...rows];
  return [...kept, ...added];
}

/** Giá trị của chỉ số để hiển thị / sửa (khóa đơn). */
export const metricValue = (s: ImportSampleCheck, key: SampleMetricKey): string | number | null => (s as unknown as Record<string, string | number | null>)[key];
