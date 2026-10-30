// ============================================================
// Tên file: src/lib/importReports.ts
// Tên tiếng Việt: Số báo cáo Nhập khẩu theo kỳ — lần nhập, kg thực nhập, trị giá theo tiền tệ, đối tác, mặt hàng
// Description: Pure figures for the Import report tab (ba-spec 50 RP1, R1–R3): receipts of a period
//              (month of arrival, else expected — 45 R1), received kg, value per currency (kg × contract
//              line price), per month / supplier / product / import type, receipts needing attention,
//              Excel rows. Cancelled receipts never count.
// ============================================================
import type { ImportDocumentKind, ImportReceipt, ImportType } from "@/types";
import {
  IMPORT_DOCUMENT_KINDS,
  IMPORT_TYPES,
  importMonth,
  lineProduct,
  missingDocs,
  receiptLinesOf,
  receiptState,
  remainingKg,
  type ImportData,
} from "./importPlanning";
import type { ReportPeriod } from "./exportReports";

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Trị giá theo tiền tệ: { USD: 15000, EUR: 14700 }. */
export type CurrencyAmounts = Record<string, number>;

const addValue = (into: CurrencyAmounts, currency: string, amount: number) => {
  const c = currency || "USD";
  into[c] = round2((into[c] ?? 0) + amount);
};

export interface ImportFigures {
  receipts: number;
  /** Lần nhập đi cont (20RF / 40RF). */
  containers: number;
  /** Lần nhập hàng lẻ. */
  loose: number;
  receivedKg: number;
  value: CurrencyAmounts;
}

export interface ImportTotals extends ImportFigures {
  /** Kg HĐ của các dòng có trong các lần nhập của kỳ (để so "đã về x / y kg"). */
  complete: number;
  missingDocs: number;
  awaitingQuantity: number;
  contractsSigned: number;
  contractKgSigned: number;
}

export interface ImportMonthRow extends ImportFigures {
  month: string;
}
export interface ImportSupplierRow extends ImportFigures {
  supplierName: string;
  /** Kg HĐ đang mở còn chưa về (R3, không theo kỳ). */
  shortKg: number;
}
export interface ImportProductRow {
  key: string;
  name: string;
  receivedKg: number;
  value: CurrencyAmounts;
}
export interface ImportTypeRow {
  importType: ImportType | "";
  label: string;
  receipts: number;
  receivedKg: number;
}
export type ImportAttentionKind = "missing-docs" | "awaiting-quantity";
export interface ImportAttentionRow {
  receiptId: string;
  contractId: string;
  contractNo: string;
  supplierName: string;
  date: string;
  kind: ImportAttentionKind;
  missing: ImportDocumentKind[];
}

export interface ImportReport {
  totals: ImportTotals;
  byMonth: ImportMonthRow[];
  bySupplier: ImportSupplierRow[];
  byProduct: ImportProductRow[];
  byImportType: ImportTypeRow[];
  attention: ImportAttentionRow[];
}

export const IMPORT_ATTENTION_LABELS: Record<ImportAttentionKind, string> = {
  "missing-docs": "Thiếu chứng từ",
  "awaiting-quantity": "Chờ thực nhập",
};

const emptyFigures = (): ImportFigures => ({ receipts: 0, containers: 0, loose: 0, receivedKg: 0, value: {} });

/** "USD 15.000 · EUR 14.700" — người gọi truyền hàm định dạng số. */
export function currencyText(v: CurrencyAmounts, fmt: (n: number) => string): string {
  const parts = Object.entries(v).filter(([, n]) => n);
  return parts.length ? parts.map(([c, n]) => `${fmt(n)} ${c}`).join(" · ") : "—";
}

export function buildImportReport(d: ImportData, period: ReportPeriod, opts: { supplierId?: string; today: string }): ImportReport {
  const supplierId = opts.supplierId ?? "";
  const contractById = new Map(d.contracts.map((c) => [c.id, c]));
  const lineById = new Map(d.lines.map((l) => [l.id, l]));
  const inSupplier = (contractId: string) => !supplierId || contractById.get(contractId)?.supplierId === supplierId;
  const months = new Set(period.months);
  const receipts = d.receipts.filter((r) => r.status !== "cancelled" && months.has(importMonth(r)) && inSupplier(r.contractId));

  const totals: ImportTotals = { ...emptyFigures(), complete: 0, missingDocs: 0, awaitingQuantity: 0, contractsSigned: 0, contractKgSigned: 0 };
  const byMonth = new Map<string, ImportMonthRow>();
  const bySupplier = new Map<string, ImportSupplierRow>();
  const byProduct = new Map<string, ImportProductRow>();
  const byType = new Map<string, ImportTypeRow>();
  const attention: ImportAttentionRow[] = [];

  const addReceipt = (f: ImportFigures, r: ImportReceipt, kg: number, value: CurrencyAmounts) => {
    f.receipts += 1;
    if (r.transport === "lcl") f.loose += 1;
    else f.containers += 1;
    f.receivedKg = round2(f.receivedKg + kg);
    for (const [c, n] of Object.entries(value)) addValue(f.value, c, n);
  };

  for (const r of receipts) {
    const c = contractById.get(r.contractId);
    const currency = c?.currency || "USD";
    let kg = 0;
    const value: CurrencyAmounts = {};
    for (const rl of receiptLinesOf(d, r.id)) {
      const lkg = rl.kg ?? 0;
      if (!lkg) continue;
      kg += lkg;
      const line = lineById.get(rl.contractLineId);
      const price = c?.linePrices[rl.contractLineId];
      if (price != null) addValue(value, currency, lkg * price);
      const product = line ? lineProduct(d, line) : undefined;
      const key = product?.id || `name:${(line?.productName ?? "").trim().toLowerCase()}`;
      const p = byProduct.get(key) ?? { key, name: product?.name || line?.productName || "(chưa rõ)", receivedKg: 0, value: {} };
      p.receivedKg = round2(p.receivedKg + lkg);
      if (price != null) addValue(p.value, currency, lkg * price);
      byProduct.set(key, p);
    }
    kg = round2(kg);
    addReceipt(totals, r, kg, value);

    const m = importMonth(r);
    const mr = byMonth.get(m) ?? { month: m, ...emptyFigures() };
    addReceipt(mr, r, kg, value);
    byMonth.set(m, mr);

    const sName = c?.supplierName || r.supplierName || "(chưa rõ)";
    const sr = bySupplier.get(sName) ?? { supplierName: sName, shortKg: 0, ...emptyFigures() };
    addReceipt(sr, r, kg, value);
    bySupplier.set(sName, sr);

    const t = c?.importType ?? "";
    const tr = byType.get(t) ?? { importType: t, label: IMPORT_TYPES.find((x) => x.value === t)?.label || "Chưa ghi loại hình", receipts: 0, receivedKg: 0 };
    tr.receipts += 1;
    tr.receivedKg = round2(tr.receivedKg + kg);
    byType.set(t, tr);

    const st = receiptState(d, r);
    if (st === "complete") totals.complete += 1;
    else if (st === "missing-docs") totals.missingDocs += 1;
    else if (st === "awaiting-quantity") totals.awaitingQuantity += 1;
    const arrived = !!r.arrivalDate && r.arrivalDate <= opts.today;
    if (st === "missing-docs" || (st === "awaiting-quantity" && arrived))
      attention.push({
        receiptId: r.id,
        contractId: r.contractId,
        contractNo: c?.contractNo || r.contractNo,
        supplierName: sName,
        date: r.arrivalDate || r.expectedDate,
        kind: st,
        missing: st === "missing-docs" ? missingDocs(d, r.id) : [],
      });
  }

  // R3 — kg HĐ đang mở còn chưa về, theo đối tác (không theo kỳ). Đối tác có HĐ mở mà kỳ không có lần nhập vẫn hiện.
  for (const c of d.contracts) {
    if (c.status !== "open" || !inSupplier(c.id)) continue;
    const short = round2(d.lines.filter((l) => l.contractId === c.id).reduce((s, l) => s + Math.max(0, remainingKg(d, l.id)), 0));
    if (!short) continue;
    const sr = bySupplier.get(c.supplierName) ?? { supplierName: c.supplierName || "(chưa rõ)", shortKg: 0, ...emptyFigures() };
    sr.shortKg = round2(sr.shortKg + short);
    bySupplier.set(sr.supplierName, sr);
  }

  for (const c of d.contracts) {
    if (c.status === "cancelled" || !inSupplier(c.id) || !(c.signedDate >= period.from && c.signedDate <= period.to)) continue;
    totals.contractsSigned += 1;
    totals.contractKgSigned = round2(totals.contractKgSigned + d.lines.filter((l) => l.contractId === c.id).reduce((s, l) => s + (l.kg ?? 0), 0));
  }

  return {
    totals,
    byMonth: period.months.filter((m) => byMonth.has(m)).map((m) => byMonth.get(m)!),
    bySupplier: [...bySupplier.values()].sort((a, b) => b.receivedKg - a.receivedKg || a.supplierName.localeCompare(b.supplierName, "vi")),
    byProduct: [...byProduct.values()].sort((a, b) => b.receivedKg - a.receivedKg),
    byImportType: IMPORT_TYPES.map((t) => byType.get(t.value)).filter((x): x is ImportTypeRow => !!x).concat(byType.get("") ? [byType.get("")!] : []),
    attention: attention.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "missing-docs" ? -1 : 1) || a.date.localeCompare(b.date)),
  };
}

/* ---------- Excel ---------- */

export type ImportReportCell = string | number | null;

const docName = (k: ImportDocumentKind) => IMPORT_DOCUMENT_KINDS.find((x) => x.value === k)?.label ?? k;

export function buildImportReportExcel(r: ImportReport, opts: { periodLabel: string; supplierName?: string; viewPrice: boolean }): ImportReportCell[][] {
  const valueCols = (v: CurrencyAmounts): ImportReportCell[] => (opts.viewPrice ? [Object.entries(v).map(([c, n]) => `${n} ${c}`).join(" · ") || null] : []);
  const vh = opts.viewPrice ? ["Trị giá"] : [];
  const t = r.totals;
  const out: ImportReportCell[][] = [
    [`BÁO CÁO NHẬP KHẨU — ${opts.periodLabel}${opts.supplierName ? ` — ${opts.supplierName}` : ""}`],
    [],
    ["Tổng kỳ", "Lần nhập", "Cont", "Hàng lẻ", "Kg thực nhập", ...vh, "Đủ hồ sơ", "Thiếu chứng từ", "Chờ thực nhập"],
    ["", t.receipts, t.containers, t.loose, t.receivedKg, ...valueCols(t.value), t.complete, t.missingDocs, t.awaitingQuantity],
    [],
    ["Theo tháng", "Lần nhập", "Cont", "Hàng lẻ", "Kg thực nhập", ...vh],
    ...r.byMonth.map((m) => [m.month, m.receipts, m.containers, m.loose, m.receivedKg, ...valueCols(m.value)]),
    [],
    ["Theo đối tác", "Lần nhập", "Cont", "Hàng lẻ", "Kg thực nhập", ...vh, "Kg HĐ còn chưa về"],
    ...r.bySupplier.map((s) => [s.supplierName, s.receipts, s.containers, s.loose, s.receivedKg, ...valueCols(s.value), s.shortKg]),
    [],
    ["Theo mặt hàng", "Kg thực nhập", ...vh],
    ...r.byProduct.map((p) => [p.name, p.receivedKg, ...valueCols(p.value)]),
    [],
    ["Theo loại hình", "Lần nhập", "Kg thực nhập"],
    ...r.byImportType.map((x) => [x.label, x.receipts, x.receivedKg]),
    [],
    ["Lần nhập cần chú ý", "Đối tác", "Ngày", "Vấn đề"],
    ...r.attention.map((a) => [a.contractNo, a.supplierName, a.date, a.kind === "missing-docs" ? `Thiếu: ${a.missing.map(docName).join(", ")}` : IMPORT_ATTENTION_LABELS[a.kind]]),
  ];
  return out;
}
