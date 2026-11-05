// ============================================================
// Tên file: src/lib/exportConsolidate.ts
// Tên tiếng Việt: Đưa chuyến Đóng ghép vào cont của chuyến khác (một cont nhiều hợp đồng)
// Description: Moves a "consolidated" export shipment's goods onto a container shipment as lines of its contract
//              (ba-spec 70 multi-contract model), removing the consolidated shipment.
// ============================================================
// Phòng KH 2026-11-05: DAIREI ghi mỗi HĐ mỗi tháng một chuyến "Đóng ghép" (31 chuyến BD-007/008/009) — không chọn được
// đi chung cont nào ⇒ đưa vào chuyến cont: hàng thành dòng của HĐ đó trên chuyến cont, mỗi HĐ vẫn tự tính đã giao.
import type { ExportShipment, ExportShipmentLine, ExportStepItem } from "@/types";
import { shipmentLineFromContract } from "./exportInvoice";
import { addContractGate, canDeleteShipment, isContainerKind, workingRevision, type EvidenceOptions, type ExportData } from "./exportPlanning";

export type ConsolidateGate =
  | { ok: true }
  | { ok: false; reason: "same" | "not-consolidated" | "not-open" | "not-container" | "has-progress" | "customer-mismatch" | "contract-blocked" };

const customerOf = (d: Pick<ExportData, "contracts">, s: Pick<ExportShipment, "contractId">) => d.contracts.find((c) => c.id === s.contractId)?.customerId ?? "";

/**
 * Đưa được chuyến Đóng ghép `from` vào chuyến cont `into` không: `from` là Đóng ghép còn mở, chưa file / chưa bước Xong
 * (hồ sơ nằm ở chuyến cont); `into` là chuyến cont lạnh còn mở, cùng khách; HĐ khác thì qua cổng thêm hàng HĐ khác (70 R4).
 */
export function consolidateGate(d: ExportData, from: ExportShipment, into: ExportShipment, opts?: EvidenceOptions): ConsolidateGate {
  if (from.id === into.id) return { ok: false, reason: "same" };
  if (from.kind !== "consolidated") return { ok: false, reason: "not-consolidated" };
  if (from.status !== "open" || into.status !== "open") return { ok: false, reason: "not-open" };
  // HĐ của chuyến cont đã đóng / hủy ⇒ không nhận thêm hàng.
  if (d.contracts.find((c) => c.id === into.contractId)?.status !== "open") return { ok: false, reason: "not-open" };
  if (!isContainerKind(into.kind)) return { ok: false, reason: "not-container" };
  if (!canDeleteShipment(d, from.id)) return { ok: false, reason: "has-progress" };
  if (customerOf(d, from) !== customerOf(d, into)) return { ok: false, reason: "customer-mismatch" };
  if (from.contractId !== into.contractId && !addContractGate(d, into, from.contractId, opts).ok) return { ok: false, reason: "contract-blocked" };
  return { ok: true };
}

const dayGap = (a: string, b: string) => (a && b ? Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000 : 9_999);
const shipDate = (s: Pick<ExportShipment, "loadingDate" | "etd" | "planMonth">) => s.loadingDate || s.etd || (s.planMonth ? `${s.planMonth}-15` : "");

/** Chuyến cont nhận được, gợi ý trước: cùng booking → cùng ngày đóng → ngày gần nhất. */
export function consolidateTargets(d: ExportData, from: ExportShipment, opts?: EvidenceOptions): ExportShipment[] {
  const booking = from.bookingNo.trim().toLowerCase();
  return d.shipments
    .filter((s) => consolidateGate(d, from, s, opts).ok)
    .map((s) => ({ s, same: !!booking && s.bookingNo.trim().toLowerCase() === booking, gap: dayGap(shipDate(s), shipDate(from)) }))
    .sort((a, b) => Number(b.same) - Number(a.same) || a.gap - b.gap)
    .map((x) => x.s);
}

/**
 * Dòng kế hoạch của một HĐ từ kg của chuyến (chuyến chưa nhập Hàng của chuyến): HĐ một dòng hàng ⇒ số kiện = kg ÷ kg mỗi
 * kiện; HĐ nhiều dòng ⇒ mỗi dòng một hàng chưa có số kiện (Phòng KH ghi ở Hàng của chuyến) + nhắc.
 */
function plannedLines(
  d: ExportData,
  contractId: string,
  shipmentId: string,
  kg: number | null,
  newId: () => string,
  sortFrom: number,
): { lines: ExportShipmentLine[]; notice: string } {
  const rev = workingRevision(d, contractId);
  const cls = rev?.lines ?? [];
  const no = d.contracts.find((c) => c.id === contractId)?.contractNo ?? "";
  if (!cls.length) return { lines: [], notice: `HĐ ${no} chưa có dòng hàng — nhập Hàng của chuyến sau.` };
  if (cls.length === 1) {
    const cl = cls[0];
    const perUnit = cl.netKgPerCarton == null ? null : cl.netKgPerCarton * (cl.unitKind === "bundle" ? Math.max(1, cl.cartonsPerUnit || 1) : 1);
    const units = kg != null && perUnit ? Math.round(kg / perUnit) : null;
    return {
      lines: [shipmentLineFromContract(cl, { id: newId(), shipmentId, contractId, sortOrder: sortFrom + 10, plannedUnits: units })],
      notice: units == null ? `HĐ ${no}: chưa tính được số kiện từ kg — ghi số kiện ở Hàng của chuyến.` : "",
    };
  }
  return {
    lines: cls.map((cl, i) => shipmentLineFromContract(cl, { id: newId(), shipmentId, contractId, sortOrder: sortFrom + (i + 1) * 10 })),
    notice: `HĐ ${no} có ${cls.length} dòng hàng — ghi số kiện từng dòng ở Hàng của chuyến.`,
  };
}

/**
 * Kết quả đưa `from` vào `into` (ghi một lần + Hoàn tác ở màn):
 *  • dòng hàng của `from` chuyển sang `into` (giữ HĐ của dòng); `from` chưa có dòng ⇒ dựng từ kg kế hoạch;
 *  • `into` chưa có dòng mà sắp thành chuyến nhiều HĐ ⇒ dựng dòng cho HĐ chính từ kg của nó (kg kế hoạch theo HĐ của
 *    chuyến gộp tính từ dòng — không thì HĐ chính tụt về 0);
 *  • kg kế hoạch của `into` cộng thêm kg của `from`; chuyến `from` + mục bước của nó bị bỏ.
 */
export function consolidateInto(
  d: ExportData,
  from: ExportShipment,
  into: ExportShipment,
  newId: () => string,
): { shipments: ExportShipment[]; items: ExportStepItem[]; shipmentLines: ExportShipmentLine[]; notices: string[] } {
  const all = d.shipmentLines ?? [];
  const intoLines = all.filter((l) => l.shipmentId === into.id);
  const fromLines = all.filter((l) => l.shipmentId === from.id);
  const notices: string[] = [];
  let sort = intoLines.reduce((m, l) => Math.max(m, l.sortOrder), 0);
  const added: ExportShipmentLine[] = [];
  if (!intoLines.length && from.contractId !== into.contractId) {
    const own = plannedLines(d, into.contractId, into.id, into.plannedKg, newId, sort);
    added.push(...own.lines);
    if (own.notice) notices.push(own.notice);
    sort = added.reduce((m, l) => Math.max(m, l.sortOrder), sort);
  }
  if (fromLines.length) {
    added.push(...fromLines.map((l, i) => ({ ...l, shipmentId: into.id, contractId: l.contractId || from.contractId, sortOrder: sort + (i + 1) * 10 })));
  } else {
    const moved = plannedLines(d, from.contractId, into.id, from.plannedKg, newId, sort);
    added.push(...moved.lines);
    if (moved.notice) notices.push(moved.notice);
  }
  const plannedKg = into.plannedKg == null && from.plannedKg == null ? null : (into.plannedKg ?? 0) + (from.plannedKg ?? 0);
  return {
    shipments: d.shipments.filter((s) => s.id !== from.id).map((s) => (s.id === into.id ? { ...s, plannedKg } : s)),
    items: d.items.filter((i) => i.shipmentId !== from.id),
    shipmentLines: [...all.filter((l) => l.shipmentId !== from.id), ...added],
    notices,
  };
}
