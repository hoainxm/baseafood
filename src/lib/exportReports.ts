// ============================================================
// Tên file: src/lib/exportReports.ts
// Tên tiếng Việt: Báo cáo Xuất khẩu theo kỳ (tháng · quý · năm)
// Description: Pure aggregation of the export module for one period and optional customer:
//              totals, per-month and per-customer rows, on-time rate, shipments stuck per step,
//              contracts needing attention. Only re-reads rules from lib/exportPlanning.
// ============================================================
// Oracle: docs/app-map/41-export-planning.ba-spec.md v5 — NV15, R25, AC-42…AC-44.
// KHÔNG đổi luật: thực xuất (R7), trễ hạn (R15), kỳ của chuyến (R18), dung sai / khép (NV12)
// đều gọi hàm có sẵn của lib/exportPlanning.
import {
  STEP_TITLES,
  contractClosure,
  contractCoverage,
  contractStepState,
  contractTotals,
  effectiveDeadline,
  effectiveRevision,
  isContainerKind,
  isShipmentLate,
  monthLabel,
  shipmentActuals,
  shipmentDeliveryDate,
  shipmentInPeriod,
  shipmentPaymentSummary,
  stepState,
  workingRevision,
  type EvidenceOptions,
  type ExportData,
} from "./exportPlanning";
import type { Customer, ExportShipment } from "@/types";

const round2 = (v: number) => Math.round(v * 100) / 100;
const numOr0 = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const EPS = 1e-6;
const pad2 = (n: number) => String(n).padStart(2, "0");
const lastDay = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();

/* ---------- Kỳ báo cáo ---------- */

export type ReportPeriodKind = "month" | "quarter" | "year";

export interface ReportPeriod {
  kind: ReportPeriodKind;
  /** Khóa ổn định cho URL: "2026" · "2026-Q3" · "2026-09". */
  key: string;
  /** ISO yyyy-mm-dd, tính cả hai đầu. */
  from: string;
  to: string;
  label: string;
  /** Các tháng "yyyy-mm" của kỳ, theo thứ tự. */
  months: string[];
}

function build(kind: ReportPeriodKind, year: number, first: number, count: number, key: string, label: string): ReportPeriod {
  const months = Array.from({ length: count }, (_, i) => `${year}-${pad2(first + i)}`);
  const last = months[months.length - 1];
  return { kind, key, from: `${months[0]}-01`, to: `${last}-${pad2(lastDay(last))}`, label, months };
}

export const yearPeriod = (year: number): ReportPeriod => build("year", year, 1, 12, String(year), `Năm ${year}`);
export const quarterPeriod = (year: number, q: number): ReportPeriod => build("quarter", year, (q - 1) * 3 + 1, 3, `${year}-Q${q}`, `Quý ${q}/${year}`);
export const monthReportPeriod = (month: string): ReportPeriod => build("month", Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1, month, monthLabel(month));

/** Đọc khóa URL; khóa hỏng ⇒ kỳ `fallbackKind` chứa `today`. */
export function parseReportPeriod(key: string | null | undefined, today: string, fallbackKind: ReportPeriodKind = "year"): ReportPeriod {
  const k = (key ?? "").trim();
  let m = /^(\d{4})$/.exec(k);
  if (m) return yearPeriod(Number(m[1]));
  m = /^(\d{4})-Q([1-4])$/.exec(k);
  if (m) return quarterPeriod(Number(m[1]), Number(m[2]));
  m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(k);
  if (m) return monthReportPeriod(k);
  return periodOfKind(fallbackKind, today);
}

/** Kỳ loại `kind` chứa ngày `date`. */
export function periodOfKind(kind: ReportPeriodKind, date: string): ReportPeriod {
  const y = Number(date.slice(0, 4));
  const mo = Number(date.slice(5, 7));
  if (kind === "year") return yearPeriod(y);
  if (kind === "quarter") return quarterPeriod(y, Math.floor((mo - 1) / 3) + 1);
  return monthReportPeriod(date.slice(0, 7));
}

export function shiftReportPeriod(p: ReportPeriod, delta: number): ReportPeriod {
  const y = Number(p.from.slice(0, 4));
  const mo = Number(p.from.slice(5, 7));
  if (p.kind === "year") return yearPeriod(y + delta);
  const step = p.kind === "quarter" ? 3 : 1;
  const idx = y * 12 + (mo - 1) + delta * step;
  return periodOfKind(p.kind, `${Math.floor(idx / 12)}-${pad2((idx % 12) + 1)}-01`);
}

/* ---------- Số báo cáo ---------- */

export interface ReportFigures {
  shipments: number;
  containers: number;
  plannedKg: number;
  actualKg: number;
  actualAmount: number;
  /** Tiền về có NGÀY trong kỳ (cả cọc cấp HĐ). */
  received: number;
  /** Σ max(0, thực xuất tiền − tiền về của chuyến) của các chuyến trong kỳ. */
  outstanding: number;
}

export interface ReportTotals extends ReportFigures {
  contractsSigned: number;
  contractKg: number;
  contractAmount: number;
  /** Chuyến của kỳ đã có ngày giao (on board ?? ETD). */
  delivered: number;
  late: number;
  onTime: number;
}

export interface MonthRow extends ReportFigures {
  month: string;
  label: string;
}

export interface CustomerRow extends ReportFigures {
  customerId: string;
  name: string;
  contractsSigned: number;
}

export type AttentionKind = "overdue" | "over-tolerance" | "under-tolerance" | "unpaid";

export interface AttentionRow {
  contractId: string;
  contractNo: string;
  customerId: string;
  customerName: string;
  kind: AttentionKind;
  /** Lệch dung sai (%), dương = thừa. */
  kgPct: number;
  amountPct: number;
  /** Quá hạn: hạn giao hiệu lực + phần chưa lên chuyến. */
  deadline: string;
  missingKg: number;
  missingContainers: number;
  /** Còn chưa về (tiền thực xuất − tiền về của HĐ). */
  outstanding: number;
}

export type StepCounts = Record<1 | 2 | 3 | 4 | 5, number>;

export interface ExportReport {
  period: ReportPeriod;
  customerId: string;
  totals: ReportTotals;
  byMonth: MonthRow[];
  byCustomer: CustomerRow[];
  /** Số chuyến của kỳ có bước n chưa xong / không áp dụng. */
  stuck: StepCounts;
  attention: AttentionRow[];
}

const emptyFigures = (): ReportFigures => ({ shipments: 0, containers: 0, plannedKg: 0, actualKg: 0, actualAmount: 0, received: 0, outstanding: 0 });

function addShipment(f: ReportFigures, d: ExportData, s: ExportShipment): void {
  const a = shipmentActuals(d, s.id);
  const pay = shipmentPaymentSummary(d, s);
  f.shipments += 1;
  if (isContainerKind(s.kind)) f.containers += 1;
  f.plannedKg = round2(f.plannedKg + numOr0(s.plannedKg));
  f.actualKg = round2(f.actualKg + a.kg);
  f.actualAmount = round2(f.actualAmount + a.amount);
  f.outstanding = round2(f.outstanding + Math.max(0, a.amount - pay.received));
}

const settled = (st: string) => st === "done" || st === "not-applicable";
const inRange = (iso: string, p: Pick<ReportPeriod, "from" | "to">) => !!iso && iso >= p.from && iso <= p.to;

/** Lý do HĐ được nêu ở "cần chú ý", theo thứ tự ưu tiên (R25). */
export const ATTENTION_LABELS: Record<AttentionKind, string> = {
  overdue: "Quá hạn giao",
  "over-tolerance": "Vượt dung sai",
  "under-tolerance": "Thiếu dung sai",
  unpaid: "Còn tiền chưa về",
};

export const REPORT_STEP_TITLES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: STEP_TITLES[0],
  2: STEP_TITLES[1],
  3: STEP_TITLES[2],
  4: STEP_TITLES[3],
  5: STEP_TITLES[4],
};

/**
 * Báo cáo một kỳ (NV15 · R25). `customerId` rỗng = mọi khách; có ⇒ MỌI con số chỉ của khách đó.
 * Chuyến đã hủy và HĐ đã hủy không vào số nào.
 */
export function buildExportReport(
  d: ExportData,
  period: ReportPeriod,
  opts: { customers: readonly Pick<Customer, "id" | "name">[]; customerId?: string; today: string; evidence?: EvidenceOptions },
): ExportReport {
  const customerId = opts.customerId ?? "";
  const evidence = opts.evidence ?? { filesAvailable: true };
  const nameOf = new Map(opts.customers.map((c) => [c.id, c.name]));
  const contractById = new Map(d.contracts.map((c) => [c.id, c]));
  const keep = (contractId: string) => {
    const c = contractById.get(contractId);
    return !!c && c.status !== "cancelled" && (!customerId || c.customerId === customerId);
  };

  const ships = d.shipments.filter((s) => s.status === "open" && keep(s.contractId) && shipmentInPeriod(s, period));
  const shipById = new Map(d.shipments.map((s) => [s.id, s]));

  // Tiền về theo NGÀY nhận (R25): cả lần ghi cấp HĐ (cọc) lẫn cấp chuyến; chuyến đã hủy vẫn tính tiền đã nhận.
  const payments = d.payments.filter((p) => {
    if (p.kind !== "payment" || !inRange(p.date, period)) return false;
    const cid = p.contractId || shipById.get(p.shipmentId)?.contractId || "";
    return keep(cid);
  });
  const contractOfPayment = (p: (typeof payments)[number]) => p.contractId || shipById.get(p.shipmentId)?.contractId || "";

  /* --- theo tháng --- */
  const byMonth: MonthRow[] = period.months.map((m) => ({ month: m, label: monthLabel(m), ...emptyFigures() }));
  const monthIdx = new Map(byMonth.map((r, i) => [r.month, i]));
  for (const s of ships) {
    const ref = s.loadingDate || s.etd;
    const m = ref ? ref.slice(0, 7) : s.planMonth;
    const row = byMonth[monthIdx.get(m) ?? -1];
    if (row) addShipment(row, d, s);
  }
  for (const p of payments) {
    const row = byMonth[monthIdx.get(p.date.slice(0, 7)) ?? -1];
    if (row) row.received = round2(row.received + numOr0(p.amount));
  }

  /* --- HĐ ký trong kỳ --- */
  const signed = d.contracts.filter((c) => keep(c.id) && inRange(c.signedOn, period));

  /* --- theo khách --- */
  const custRows = new Map<string, CustomerRow>();
  const custRow = (cid: string) => {
    let r = custRows.get(cid);
    if (!r) {
      r = { customerId: cid, name: nameOf.get(cid) ?? "(khách đã xóa)", contractsSigned: 0, ...emptyFigures() };
      custRows.set(cid, r);
    }
    return r;
  };
  for (const s of ships) addShipment(custRow(contractById.get(s.contractId)!.customerId), d, s);
  for (const p of payments) {
    const r = custRow(contractById.get(contractOfPayment(p))!.customerId);
    r.received = round2(r.received + numOr0(p.amount));
  }
  for (const c of signed) custRow(c.customerId).contractsSigned += 1;
  const byCustomer = [...custRows.values()].sort((a, b) => b.actualKg - a.actualKg || b.plannedKg - a.plannedKg || a.name.localeCompare(b.name, "vi"));

  /* --- tổng --- */
  const totals: ReportTotals = {
    ...emptyFigures(),
    contractsSigned: signed.length,
    contractKg: 0,
    contractAmount: 0,
    delivered: 0,
    late: 0,
    onTime: 0,
  };
  for (const s of ships) {
    addShipment(totals, d, s);
    if (shipmentDeliveryDate(d, s)) {
      totals.delivered += 1;
      if (isShipmentLate(d, s)) totals.late += 1;
      else totals.onTime += 1;
    }
  }
  totals.received = round2(payments.reduce((t, p) => t + numOr0(p.amount), 0));
  for (const c of signed) {
    const rev = workingRevision(d, c.id);
    if (!rev) continue;
    const t = contractTotals(rev.lines);
    totals.contractKg = round2(totals.contractKg + t.kg);
    totals.contractAmount = round2(totals.contractAmount + t.amount);
  }

  /* --- bước còn kẹt --- */
  const stuck: StepCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of ships) {
    for (const n of [1, 2, 3, 4, 5] as const) {
      const st = n === 1 ? contractStepState(d, s.contractId, evidence) : stepState(d, s, n, evidence);
      if (!settled(st)) stuck[n] += 1;
    }
  }

  /* --- HĐ cần chú ý --- */
  const shipContractIds = new Set(ships.map((s) => s.contractId));
  const attention: AttentionRow[] = [];
  for (const c of d.contracts) {
    if (!keep(c.id)) continue;
    const deadline = effectiveDeadline(d, c.id);
    if (!shipContractIds.has(c.id) && !inRange(deadline, period)) continue;
    const eff = effectiveRevision(d, c.id);
    const closure = contractClosure(d, c.id, evidence);
    const base = {
      contractId: c.id,
      contractNo: c.contractNo,
      customerId: c.customerId,
      customerName: nameOf.get(c.customerId) ?? "(khách đã xóa)",
      kgPct: closure.kgDeviationPct,
      amountPct: closure.amountDeviationPct,
      deadline,
      missingKg: 0,
      missingContainers: 0,
      outstanding: 0,
    };
    if (c.status !== "closed") {
      const cov = contractCoverage(d, c.id);
      if (deadline && deadline < opts.today && !cov.covered) {
        attention.push({ ...base, kind: "overdue", missingKg: cov.missingKg, missingContainers: cov.missingContainers });
      }
      if (eff) {
        const tol = numOr0(eff.terms.tolerancePct) / 100;
        const over = (a: number, t: number) => t > 0 && a > t * (1 + tol) + EPS;
        if (over(closure.actuals.kg, closure.target.kg) || over(closure.actuals.amount, closure.target.amount)) {
          attention.push({ ...base, kind: "over-tolerance" });
        } else if (closure.reason === "out-of-tolerance") {
          attention.push({ ...base, kind: "under-tolerance" });
        }
      }
    }
    // Còn tiền chưa về: cả HĐ (tiền thực xuất − mọi lần tiền về), không theo kỳ.
    const received = d.payments
      .filter((p) => p.kind === "payment" && (p.contractId === c.id || shipById.get(p.shipmentId)?.contractId === c.id))
      .reduce((t, p) => t + numOr0(p.amount), 0);
    const expected = closure.actuals.amount;
    const left = round2(expected - received);
    if (left > 0.005) attention.push({ ...base, kind: "unpaid", outstanding: left });
  }
  const order: Record<AttentionKind, number> = { overdue: 0, "over-tolerance": 1, "under-tolerance": 2, unpaid: 3 };
  attention.sort((a, b) => order[a.kind] - order[b.kind] || a.customerName.localeCompare(b.customerName, "vi") || a.contractNo.localeCompare(b.contractNo, "vi"));

  return { period, customerId, totals, byMonth, byCustomer, stuck, attention };
}

/** Tỉ lệ đúng hạn (%) — null khi chưa chuyến nào có ngày giao. */
export const onTimeRate = (t: Pick<ReportTotals, "delivered" | "onTime">): number | null => (t.delivered ? (t.onTime / t.delivered) * 100 : null);

/* ---------- Xuất Excel (một sheet, các khối xếp dọc) ---------- */

export type ReportCell = string | number | null;

/**
 * Bảng Excel của báo cáo đang xem. `viewPrice = false` ⇒ KHÔNG có cột / dòng tiền nào
 * (AC-45 — người không có quyền xem giá).
 */
export function buildReportExcel(r: ExportReport, opts: { viewPrice: boolean; customerName?: string; deviationText: (pct: number) => string }): ReportCell[][] {
  const money = opts.viewPrice;
  const fig = (f: ReportFigures): ReportCell[] => [f.shipments, f.containers, f.plannedKg, f.actualKg, ...(money ? [f.actualAmount, f.received, f.outstanding] : [])];
  const figHead = ["Chuyến", "Cont", "Kg kế hoạch", "Kg thực xuất", ...(money ? ["Giá trị thực xuất (USD)", "Tiền về trong kỳ (USD)", "Còn chưa về (USD)"] : [])];
  const t = r.totals;
  const rate = onTimeRate(t);
  const aoa: ReportCell[][] = [
    [`BÁO CÁO XUẤT KHẨU ${r.period.label.toUpperCase()}${opts.customerName ? ` — ${opts.customerName}` : ""}`],
    [],
    ["TỔNG KỲ"],
    ["HĐ ký trong kỳ", t.contractsSigned, "Kg HĐ ký", t.contractKg, ...(money ? ["Giá trị HĐ ký (USD)", t.contractAmount] : [])],
    figHead,
    fig(t),
    ["Chuyến đã giao", t.delivered, "Đúng hạn", t.onTime, "Trễ hạn", t.late, "Tỉ lệ đúng hạn (%)", rate == null ? null : Math.round(rate * 10) / 10],
    [],
  ];
  if (r.byMonth.length > 1) {
    aoa.push(["THEO THÁNG"], ["Tháng", ...figHead], ...r.byMonth.map((m) => [m.label, ...fig(m)]), []);
  }
  aoa.push(["THEO KHÁCH"], ["Khách", "HĐ ký", ...figHead], ...r.byCustomer.map((c) => [c.name, c.contractsSigned, ...fig(c)]), []);
  aoa.push(["HỒ SƠ CÒN KẸT (số chuyến chưa xong bước)"], ...([1, 2, 3, 4, 5] as const).map((n) => [`Bước ${n} · ${REPORT_STEP_TITLES[n]}`, r.stuck[n]]), []);
  aoa.push(["HỢP ĐỒNG CẦN CHÚ Ý"], ["Hợp đồng", "Khách", "Vấn đề", "Chi tiết"]);
  for (const a of r.attention) {
    if (a.kind === "unpaid" && !money) continue;
    aoa.push([a.contractNo, a.customerName, ATTENTION_LABELS[a.kind], attentionDetail(a, { viewPrice: money, deviationText: opts.deviationText })]);
  }
  return aoa;
}

/** Câu chi tiết của một HĐ cần chú ý (dùng chung màn + Excel). */
export function attentionDetail(a: AttentionRow, opts: { viewPrice: boolean; deviationText: (pct: number) => string; formatNumber?: (n: number) => string; formatMoney?: (n: number) => string; formatDate?: (iso: string) => string }): string {
  const n = opts.formatNumber ?? ((v: number) => String(v));
  const m = opts.formatMoney ?? ((v: number) => v.toFixed(2));
  const d = opts.formatDate ?? ((iso: string) => iso);
  switch (a.kind) {
    case "overdue":
      return `hạn ${d(a.deadline)} · ${[a.missingKg > 0 && `${n(a.missingKg)} kg`, a.missingContainers > 0 && `${a.missingContainers} cont`].filter(Boolean).join(" / ") || "chưa đủ"} chưa lên chuyến`;
    case "over-tolerance":
    case "under-tolerance":
      return `kg ${opts.deviationText(a.kgPct)}${opts.viewPrice ? ` · tiền ${opts.deviationText(a.amountPct)}` : ""}`;
    case "unpaid":
      return opts.viewPrice ? `còn ${m(a.outstanding)} USD chưa về` : "còn tiền chưa về";
  }
}
