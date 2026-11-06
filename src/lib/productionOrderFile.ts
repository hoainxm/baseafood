// ============================================================
// Tên file: src/lib/productionOrderFile.ts
// Tên tiếng Việt: Đọc file Lệnh sản xuất (Word / PDF) để điền sẵn hộp Lập lệnh sản xuất
// Description: Parses the rows of a production-order document (the Word form Phòng KH has always used:
//              "LỆNH SẢN XUẤT · SỐ : 17.10 · Ngày 21 Tháng 10 Năm 2026", table STT | Tên hàng | Quy cách | Số lượng |
//              Khối lượng | MSL, then delivery date, market, notes), matches each file line to a line of the
//              contract's working revision, and lists what to fill + clear warnings. Pure; loader at the end.
//              Oracle: docs/app-map/48-production-order.ba-spec.md R21.
// ============================================================
// Phòng KH 2026-11-06 (HĐ 23.26/BSF-SCM.2026 · SEACHEMOT): đã đính file LSX 17.10 ở bước 2 của chuyến mà hộp Lập lệnh
// sản xuất vẫn trống ⇒ gõ lại lần nữa 13 dòng hàng, ngày ISO, MSL, ngày giao.
import type { ExportContractLine } from "@/types";

export interface OrderFileLine {
  /** STT trên file. */
  no: number;
  /** Cột Tên hàng (nguyên văn, gộp khoảng trắng). */
  name: string;
  /** Cột Quy cách (nguyên văn). */
  spec: string;
  units: number | null;
  unitKind: "carton" | "bundle" | "";
  kg: number | null;
  lotCode: string;
  /** Ngày ISO (đóng trên thùng) ghi ở dòng — yyyy-mm-dd. */
  isoDates: string[];
  shelfLifeMonths: number | null;
}

export interface OrderFile {
  orderNo: string;
  orderDate: string;
  deliveryDate: string;
  market: string;
  /** Tên khách ghi ở dòng thị trường ("khách SEACHEMOT CO.,LTD"). */
  customer: string;
  lotCode: string;
  productionDates: string[];
  shelfLifeMonths: number | null;
  processNote: string;
  /** Dòng lưu ý chép vào ô Các lưu ý khác (ngày hết hạn ghi trên thùng, ngày có bao bì…). */
  notes: string[];
  lines: OrderFileLine[];
}

// File Word cũ có thể lưu chữ Việt dạng tách dấu ("O" + dấu) ⇒ gộp về dạng dựng sẵn trước khi đọc.
const squash = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
/** Bỏ dấu, chữ thường — so tên tiếng Việt. */
export const plainText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();

/** Số kiểu Việt: "1.000" = nghìn, "4,5" = thập phân; "1.5" (một chữ số sau dấu chấm) vẫn là thập phân. */
export function parseLocalNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  let s = t;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : "");
/** "03/11/2026" · "3-11-2026" ⇒ yyyy-mm-dd. */
function dmy(text: string): string {
  const m = text.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{4})/);
  return m ? iso(Number(m[3]), Number(m[2]), Number(m[1])) : "";
}

/** Ngày ISO trong quy cách: "ISO 27 10 2026", "ISO 28,29 / 10 / 2026", "ISO : 20,28/10/2026", "Đóng ISO 29 10 2026". */
export function isoDatesOf(text: string): string[] {
  const out: string[] = [];
  const re = /ISO\s*:?\s*((?:\d{1,2}\s*,\s*)*\d{1,2})\s*[/\s]+\s*(\d{1,2})\s*[/\s]+\s*(\d{4})/gi;
  for (const m of text.matchAll(re)) {
    for (const d of m[1].split(",")) {
      const v = iso(Number(m[3]), Number(m[2]), Number(d.trim()));
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out;
}

const UNIT_RE = /(\d[\d.,]*)\s*(thùng|thung|ctn|cartons?|kiện|kien|bundles?)\b/i;
const KG_RE = /(\d[\d.,]*)\s*kg\b/gi;

function quantityOf(cells: readonly string[]): { units: number | null; unitKind: OrderFileLine["unitKind"]; kg: number | null } {
  // Cột Số lượng thường ghi "100 thùng = 1.000 kg"; có file tách kg sang cột Khối lượng.
  const qty = cells.find((c) => UNIT_RE.test(c) && /=|kg/i.test(c)) ?? cells.find((c) => UNIT_RE.test(c) && !/\//.test(c)) ?? "";
  const u = qty.match(UNIT_RE);
  const units = u ? parseLocalNumber(u[1]) : null;
  const unitKind: OrderFileLine["unitKind"] = u ? (/ki[eệ]n|bundle/i.test(u[2]) ? "bundle" : "carton") : "";
  const kgCell = qty && /kg/i.test(qty) ? qty : (cells.find((c) => /^\s*[\d.,]+\s*kg\s*$/i.test(c)) ?? "");
  const kgs = [...kgCell.matchAll(KG_RE)].map((m) => parseLocalNumber(m[1])).filter((x): x is number => x != null);
  return { units, unitKind, kg: kgs.length ? kgs[kgs.length - 1] : null };
}

const isHeader = (r: readonly string[]) => {
  const t = plainText(r.join(" "));
  return /ten hang/.test(t) && /(so luong|khoi luong)/.test(t);
};

/**
 * Dòng chữ của file ⇒ nội dung lệnh. Không phải file lệnh sản xuất (không có tiêu đề "Lệnh sản xuất" và không có bảng
 * Tên hàng · Số lượng) ⇒ null.
 */
export function parseOrderRows(rows: readonly (readonly string[])[]): OrderFile | null {
  const clean = rows.map((r) => r.map(squash).filter(Boolean)).filter((r) => r.length);
  const all = clean.map((r) => r.join(" "));
  const headerAt = clean.findIndex(isHeader);
  const titled = all.some((t) => /^lenh\s+san\s+xuat\b/.test(plainText(t)));
  if (headerAt < 0 && !titled) return null;

  const out: OrderFile = { orderNo: "", orderDate: "", deliveryDate: "", market: "", customer: "", lotCode: "", productionDates: [], shelfLifeMonths: null, processNote: "", notes: [], lines: [] };
  for (const t of all.slice(0, headerAt < 0 ? all.length : headerAt)) {
    // Dò từ khóa trên chữ đã bỏ dấu — "SỐ" / "Số lệnh" viết hoa, viết thường, dựng sẵn hay tách dấu đều bắt.
    const no = plainText(t).match(/^so\s*(?:lenh)?\s*:?\s*([\w./-]+)/);
    if (no && !out.orderNo) out.orderNo = no[1];
    const d = plainText(t).match(/ngay\s+(\d{1,2})\s+thang\s+(\d{1,2})\s+nam\s+(\d{4})/);
    if (d && !out.orderDate) out.orderDate = iso(Number(d[3]), Number(d[2]), Number(d[1]));
  }

  if (headerAt >= 0) {
    const header = clean[headerAt].map(plainText);
    const nameCol = header.findIndex((h) => /ten hang/.test(h));
    const specCol = header.findIndex((h) => /quy cach/.test(h));
    for (const r of clean.slice(headerAt + 1)) {
      if (!/^\d{1,3}$/.test(r[0] ?? "")) break;
      const name = r[nameCol >= 0 ? nameCol : 1] ?? "";
      const spec = specCol >= 0 && specCol < r.length ? r[specCol] : (r[2] ?? "");
      const q = quantityOf(r.slice(3));
      const lot = r.map((c) => c.match(/\bMSL\s*:?\s*([\w./-]+)/i)?.[1]).find(Boolean) ?? "";
      const hsd = plainText(`${name} ${spec}`).match(/hsd\s*:?\s*(\d{1,3})\s*thang/);
      out.lines.push({ no: Number(r[0]), name, spec, ...q, lotCode: lot, isoDates: isoDatesOf(spec), shelfLifeMonths: hsd ? Number(hsd[1]) : null });
    }
  }

  const after = headerAt >= 0 ? all.slice(headerAt + 1 + out.lines.length) : all;
  for (const t of after) {
    const p = plainText(t);
    if (/^ngay giao hang/.test(p)) out.deliveryDate = dmy(t) || out.deliveryDate;
    else if (/^xuat vao thi truong/.test(p)) {
      const v = t.replace(/^[^:]*:\s*/, "");
      out.market = squash(v.replace(/\(.*$/, ""));
      out.customer = squash(v.match(/kh(?:a|á|\u0061\u0301)ch\s*:?\s*([^)]+)/i)?.[1] ?? "");
    } else if (/^quy trinh san xuat/.test(p)) out.processNote = squash(t.replace(/^[^:]*:\s*/, ""));
    else if (/^du kien co (day du )?bao bi/.test(p) || /^ghi ngay het han/.test(p) || /^dong ngay iso/.test(p)) out.notes.push(t.replace(/\s*:\s*/, ": ").replace(/\s+([.,])/g, "$1"));
  }
  const dates = [...new Set(out.lines.flatMap((l) => l.isoDates))].sort();
  out.productionDates = dates;
  const lots = [...new Set(out.lines.map((l) => l.lotCode).filter(Boolean))];
  out.lotCode = lots.length === 1 ? lots[0] : "";
  const hsd = out.lines.map((l) => l.shelfLifeMonths).filter((x): x is number => x != null);
  out.shelfLifeMonths = hsd.length ? mostCommon(hsd) : null;
  return out;
}

function mostCommon<T>(xs: readonly T[]): T {
  const n = new Map<T, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/* ---------- Khớp dòng file ↔ dòng HĐ ---------- */

/** Size gr/pc chuẩn hóa: "1-under gr/pc" ⇒ "1-under", "2-3gr/pc" ⇒ "2-3", "Size: 10-15 grs/PC" ⇒ "10-15", "Mix size" ⇒ "mix". */
export function sizesOf(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:gr?s?|g)?\s*-\s*(\d+(?:[.,]\d+)?|under)\s*(?:gr?s?|g)\s*\/\s*pc/gi)) out.push(`${m[1].replace(",", ".")}-${m[2].toLowerCase().replace(",", ".")}`);
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:gr?s?|g)\s*under/gi)) out.push(`${m[1].replace(",", ".")}-under`);
  if (/\bmix\s*size\b/i.test(text)) out.push("mix");
  return [...new Set(out)];
}

interface PackShape {
  bulk: boolean;
  block: boolean;
  bundle: boolean;
  perCarton: number | null;
}
function packOf(text: string, unitKind: string): PackShape {
  const t = text.toLowerCase();
  const n = t.match(/x\s*(\d+)\s*\/\s*(?:ctn|thùng|thung|carton)/i);
  return { bulk: /\bbulk\b/.test(t), block: /\bblock\b/.test(t), bundle: unitKind === "bundle" || /ki[eệ]n|bundle/.test(t), perCarton: n ? Number(n[1]) : null };
}

const PROCESS = ["luoc", "chan", "song"] as const;
const KEYWORDS = ["tip", "co", "tam bot", "xien", "xe banh", "ncls", "sashimi", "1 da", "2 da", ...PROCESS];
const keywordsOf = (plain: string) => KEYWORDS.filter((k) => new RegExp(`(^|[^a-z0-9])${k.replace(" ", "\\s*")}([^a-z0-9]|$)`).test(plain));

/** Điểm giống nhau giữa một dòng file và một dòng HĐ (tên danh mục tiếng Việt + size + quy cách đóng gói). */
export function matchScore(line: OrderFileLine, cl: Pick<ExportContractLine, "description" | "size" | "packing" | "unitKind">, productName: string): number {
  let score = 0;
  const fileSizes = sizesOf(line.name);
  const clSizes = sizesOf(`${cl.size} ${productName}`);
  if (fileSizes.length && clSizes.length) score += fileSizes.some((s) => clSizes.includes(s)) ? 5 : -5;
  const fp = packOf(line.spec, line.unitKind);
  const cp = packOf(cl.packing, cl.unitKind);
  for (const k of ["bulk", "block", "bundle"] as const) score += fp[k] === cp[k] ? (fp[k] ? 3 : 0) : -3;
  if (fp.perCarton != null && cp.perCarton != null) score += fp.perCarton === cp.perCarton ? 2 : -2;
  const fk = keywordsOf(plainText(line.name));
  const ck = keywordsOf(plainText(`${productName} ${cl.description}`));
  for (const k of fk) if (ck.includes(k)) score += 1;
  const fProc = PROCESS.filter((p) => fk.includes(p));
  const cProc = PROCESS.filter((p) => ck.includes(p));
  if (fProc.length && cProc.length && !fProc.some((p) => cProc.includes(p))) score -= 2;
  for (const k of ["tip", "co", "tam bot", "xien", "ncls"] as const) if (fk.includes(k) !== ck.includes(k)) score -= 2;
  return score;
}

const MIN_SCORE = 4;

/** Ghép dòng file với dòng HĐ (mỗi dòng HĐ một lần, điểm cao ghép trước). Trả id dòng HĐ theo STT file ("" = không khớp). */
export function matchOrderLines(
  lines: readonly OrderFileLine[],
  contractLines: readonly ExportContractLine[],
  productName: (productId: string) => string,
): Map<number, string> {
  const pairs: { no: number; id: string; score: number }[] = [];
  for (const l of lines) for (const cl of contractLines) pairs.push({ no: l.no, id: cl.id, score: matchScore(l, cl, productName(cl.productId ?? "")) });
  pairs.sort((a, b) => b.score - a.score);
  const out = new Map<number, string>(lines.map((l) => [l.no, ""]));
  const used = new Set<string>();
  for (const p of pairs) {
    if (p.score < MIN_SCORE || used.has(p.id) || out.get(p.no)) continue;
    out.set(p.no, p.id);
    used.add(p.id);
  }
  return out;
}

/* ---------- Điền form ---------- */

/** Phần form Lập lệnh mà file điền được (đúng các ô của OrderForm). */
export interface OrderFillTarget {
  orderNo: string;
  orderDate: string;
  lotCode: string;
  productionDates: string[];
  deliveryDate: string;
  shelfLifeMonths: number | null;
  market: string;
  lines: { id: string; contractLineId: string; units: number | null; kg: number | null; note?: string }[];
  processNote: string;
  note: string;
}

export interface OrderFillReport {
  /** Ô đã điền từ file (nhãn người dùng đọc). */
  filled: string[];
  /** Ô người dùng đã gõ khác file — giữ của người dùng, nêu giá trị trên file. */
  kept: string[];
  /** Cảnh báo lệch cần soát: dòng không khớp HĐ, vượt lượng HĐ, kg lệch, khách khác HĐ, số lệnh trùng… */
  warnings: string[];
}

export interface FillContext {
  contractLines: readonly ExportContractLine[];
  productName: (productId: string) => string;
  /** Kg còn lại của dòng HĐ chưa ra lệnh khác (contractLineCoverage) — null = không biết. */
  remainingKg: (contractLineId: string) => number | null;
  customerName: string;
  /** Số lệnh đã có của lệnh khác (không phân hoa thường). */
  takenOrderNos: readonly string[];
  /** Giá trị mặc định lúc mở hộp — ô còn bằng mặc định coi như chưa gõ. */
  defaults: Pick<OrderFillTarget, "orderNo" | "orderDate" | "shelfLifeMonths" | "market">;
  newId: () => string;
}

const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
const vnDate = (d: string) => d.split("-").reverse().join("/");
const lineLabel = (l: OrderFileLine) => `Dòng ${l.no} (${l.name.slice(0, 48)}${l.name.length > 48 ? "…" : ""})`;

/**
 * R21: điền form từ file — ô còn trống / còn bằng mặc định lấy giá trị file; ô người dùng đã gõ khác file thì giữ và kê ở
 * `kept`. Dòng hàng: form chưa chọn dòng nào ⇒ thay bằng các dòng file đã khớp HĐ; đã chọn ⇒ chỉ điền số thùng / ghi chú
 * cho dòng HĐ trùng còn trống. Không ghi gì — người dùng soát rồi Lưu lệnh.
 */
export function fillOrderForm(form: OrderFillTarget, file: OrderFile, ctx: FillContext): { form: OrderFillTarget; report: OrderFillReport } {
  const report: OrderFillReport = { filled: [], kept: [], warnings: [] };
  const next: OrderFillTarget = { ...form, lines: form.lines.map((l) => ({ ...l })) };
  const take = <K extends "orderNo" | "orderDate" | "lotCode" | "deliveryDate" | "market" | "processNote">(k: K, label: string, value: string, isDefault: boolean, show = (v: string) => v) => {
    if (!value) return;
    const cur = String(next[k] ?? "").trim();
    if (!cur || isDefault) {
      if (cur !== value) report.filled.push(`${label}: ${show(value)}`);
      next[k] = value as OrderFillTarget[K];
    } else if (cur.toLowerCase() !== value.toLowerCase()) report.kept.push(`${label}: giữ "${show(cur)}" (file ghi "${show(value)}")`);
  };
  take("orderNo", "Số lệnh", file.orderNo, form.orderNo === ctx.defaults.orderNo);
  take("orderDate", "Ngày lệnh", file.orderDate, form.orderDate === ctx.defaults.orderDate, vnDate);
  take("lotCode", "Mã số lô (MSL)", file.lotCode, false);
  take("deliveryDate", "Ngày giao hàng", file.deliveryDate, false, vnDate);
  take("market", "Thị trường", file.market, form.market === ctx.defaults.market);
  take("processNote", "Quy trình sản xuất", file.processNote, false);
  if (file.productionDates.length) {
    const cur = form.productionDates.filter(Boolean);
    if (!cur.length) {
      next.productionDates = [...file.productionDates];
      report.filled.push(`Ngày sản xuất (theo ngày ISO trên thùng): ${file.productionDates.map(vnDate).join(", ")}`);
    } else if (cur.join() !== file.productionDates.join()) report.kept.push(`Ngày sản xuất: giữ ${cur.map(vnDate).join(", ")} (file ghi ISO ${file.productionDates.map(vnDate).join(", ")})`);
  }
  if (file.shelfLifeMonths != null) {
    if (form.shelfLifeMonths == null || form.shelfLifeMonths === ctx.defaults.shelfLifeMonths) {
      if (form.shelfLifeMonths !== file.shelfLifeMonths) report.filled.push(`Hạn sử dụng: ${file.shelfLifeMonths} tháng`);
      next.shelfLifeMonths = file.shelfLifeMonths;
    } else if (form.shelfLifeMonths !== file.shelfLifeMonths) report.kept.push(`Hạn sử dụng: giữ ${form.shelfLifeMonths} tháng (file ghi ${file.shelfLifeMonths} tháng)`);
  }
  if (file.notes.length) {
    const add = file.notes.filter((n) => !form.note.includes(n));
    if (add.length) {
      next.note = [form.note.trim(), ...add].filter(Boolean).join("\n");
      report.filled.push(`Các lưu ý khác: ${add.join(" · ")}`);
    }
  }

  // Dòng hàng.
  const match = matchOrderLines(file.lines, ctx.contractLines, ctx.productName);
  const clOf = (id: string) => ctx.contractLines.find((c) => c.id === id);
  const blankForm = form.lines.every((l) => !l.contractLineId);
  const fileLines: OrderFillTarget["lines"] = [];
  let filledLines = 0;
  for (const fl of file.lines) {
    const id = match.get(fl.no) ?? "";
    if (!id) {
      report.warnings.push(`${lineLabel(fl)}: không khớp dòng nào của hợp đồng — chọn tay dòng hàng (file: ${fl.units ?? "?"} ${fl.unitKind === "bundle" ? "kiện" : "thùng"}).`);
      continue;
    }
    const cl = clOf(id)!;
    const note = squash(fl.spec);
    if (blankForm) {
      fileLines.push({ id: ctx.newId(), contractLineId: id, units: fl.units, kg: cl.netKgPerCarton == null ? fl.kg : null, note });
      filledLines++;
    } else {
      const own = next.lines.find((l) => l.contractLineId === id);
      if (own) {
        if (own.units == null && fl.units != null) own.units = fl.units;
        if (!own.note && note) own.note = note;
        filledLines++;
      } else report.warnings.push(`${lineLabel(fl)}: khớp dòng HĐ "${ctx.productName(cl.productId ?? "") || cl.description}" nhưng lệnh đang soạn chưa có dòng đó — thêm dòng nếu cần.`);
    }
    // Lệch so với HĐ.
    if (fl.unitKind && fl.unitKind !== cl.unitKind) report.warnings.push(`${lineLabel(fl)}: file đếm theo ${fl.unitKind === "bundle" ? "kiện" : "thùng"}, hợp đồng theo ${cl.unitKind === "bundle" ? "kiện" : "thùng"} — soát số lượng.`);
    const perUnit = cl.netKgPerCarton == null ? null : cl.netKgPerCarton * (cl.unitKind === "bundle" ? Math.max(1, cl.cartonsPerUnit || 1) : 1);
    const autoKg = perUnit != null && fl.units != null ? Math.round(perUnit * fl.units * 1000) / 1000 : null;
    if (autoKg != null && fl.kg != null && Math.abs(autoKg - fl.kg) > 0.001)
      report.warnings.push(`${lineLabel(fl)}: file ghi ${fmt(fl.kg)} kg nhưng ${fmt(fl.units!)} ${cl.unitKind === "bundle" ? "kiện" : "thùng"} × ${fmt(perUnit!)} kg theo hợp đồng = ${fmt(autoKg)} kg — lệnh tính ${fmt(autoKg)} kg.`);
    const left = ctx.remainingKg(id);
    const kg = autoKg ?? fl.kg;
    if (left != null && kg != null && kg > left + 0.001) report.warnings.push(`${lineLabel(fl)}: ${fmt(kg)} kg vượt phần hợp đồng còn chưa ra lệnh (${fmt(Math.max(0, left))} kg).`);
  }
  if (blankForm && fileLines.length) next.lines = fileLines;
  if (filledLines) report.filled.push(`Dòng hàng: ${filledLines}/${file.lines.length} dòng khớp hợp đồng (số thùng / kiện + quy cách đóng gói vào ghi chú dòng)`);
  const missed = ctx.contractLines.filter((cl) => cl.quantity != null && ![...match.values()].includes(cl.id));
  if (missed.length && file.lines.length) report.warnings.push(`Hợp đồng còn ${missed.length} dòng không có trong file: ${missed.map((c) => ctx.productName(c.productId ?? "") || c.description).join("; ")}.`);

  // Lệch giấy tờ.
  const firm = (s: string) => plainText(s).replace(/\b(co|ltd|company|limited|inc|corp)\b/g, "").replace(/[^a-z0-9]/g, "");
  if (file.customer && ctx.customerName && firm(file.customer) && !firm(ctx.customerName).includes(firm(file.customer)) && !firm(file.customer).includes(firm(ctx.customerName)))
    report.warnings.push(`File ghi khách "${file.customer}", hợp đồng của khách "${ctx.customerName}" — soát đúng file chưa.`);
  if (next.orderNo && ctx.takenOrderNos.some((n) => n.trim().toLowerCase() === next.orderNo.trim().toLowerCase()))
    report.warnings.push(`Số lệnh ${next.orderNo} đã có ở lệnh khác — đổi số trước khi lưu.`);
  if (file.orderDate && file.productionDates.some((d) => d < file.orderDate)) report.warnings.push(`Có ngày ISO trước ngày lệnh ${vnDate(file.orderDate)} — soát ngày sản xuất.`);
  return { form: next, report };
}

/* ---------- Mở file (không ghi gì) ---------- */

export type OrderFileReadResult = { ok: true; file: OrderFile } | { ok: false; message: string };

export const ORDER_FILE_ACCEPT = ".doc,.docx,.pdf";

/** Đọc file lệnh sản xuất (vừa chọn, hoặc tải về từ file đã đính ở bước 2 của chuyến). */
export async function readOrderFile(blob: Blob, fileName: string): Promise<OrderFileReadResult> {
  if (!/\.(docx?|pdf)$/i.test(fileName)) return { ok: false, message: "Chỉ đọc được file Word (.doc, .docx) hoặc PDF có chữ." };
  try {
    const { readDocumentRows } = await import("./contractFileReader");
    const rows = await readDocumentRows(blob, fileName, 4);
    if (rows === "scan") return { ok: false, message: "File PDF là ảnh quét, không có chữ để đọc — gõ tay hoặc dùng file Word gốc." };
    const file = parseOrderRows(rows);
    return file ? { ok: true, file } : { ok: false, message: "Không thấy nội dung lệnh sản xuất trong file (tiêu đề Lệnh sản xuất / bảng Tên hàng · Số lượng)." };
  } catch (e) {
    return { ok: false, message: `Không mở được file${e instanceof Error && e.message ? ` (${e.message})` : ""}.` };
  }
}
