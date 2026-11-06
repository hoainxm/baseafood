// ============================================================
// Tên file: src/lib/exportMergeShipments.ts
// Tên tiếng Việt: Một lần xuất của nhiều hợp đồng = một chuyến — dò chuyến trùng, gộp chuyến, đi chung khi lập lịch
// Description: Finds open shipments of one customer that are really one export (same booking / same loading day),
//              merges them into one shipment carrying files, step items, production-order links, booking and
//              transport details, and lets a new contract's schedule row join an existing shipment.
//              Oracle: docs/app-map/74-merge-shipments-one-export.ba-spec.md.
// ============================================================
// Chủ dự án 2026-11-06: chuyến 06/11 của BD-007/26 và BD-008/26 (cùng booking SGNGCZ486800) hiện 2 dòng ⇒ phải nhập
// booking, xe, ảnh 2 lần. "Đưa vào cont" chỉ nhận chuyến Đóng ghép chưa file, "Gộp làm cont thêm" chỉ nhận cùng HĐ.
import type {
  ExportActivity,
  ExportBookingDetails,
  ExportFile,
  ExportShipment,
  ExportShipmentContainer,
  ExportShipmentKind,
  ExportShipmentLine,
  ExportStepItem,
  ExportTransportInfo,
  ProductionOrderShipment,
} from "@/types";
import { plannedLines } from "./exportConsolidate";
import {
  addContractGate,
  canDeleteShipment,
  effectiveRevision,
  isContainerKind,
  shipmentContractIds,
  workingRevision,
  type EvidenceOptions,
  type ExportData,
  type ScheduleRow,
} from "./exportPlanning";

/* ---------- Dấu máy đọc (R3, R12) — không thêm cột ---------- */

const TAG = /⟦(keep|keep-off|merged|merged-into):([^⟧]*)⟧/g;
/** Dấu "Giữ riêng" của một nhóm chuyến (dòng nhật ký). */
export const keepSeparateTag = (ids: readonly string[]) => `⟦keep:${[...ids].sort().join(",")}⟧`;
export const keepSeparateOffTag = (ids: readonly string[]) => `⟦keep-off:${[...ids].sort().join(",")}⟧`;
/** Dấu "chuyến … đã gộp vào chuyến …" ở dòng nhật ký gộp (tra soát). */
export const mergedTag = (dropIds: readonly string[], keepId: string) => `⟦merged:${dropIds.join(",")}>${keepId}⟧`;
/** Chữ cho người đọc (nhật ký, lý do) — bỏ dấu máy đọc. */
export const visibleActivitySummary = (summary: string) => summary.replace(TAG, "").replace(/\s{2,}/g, " ").trim();

/**
 * R7 (v1.1): chuyến bị gộp KHÔNG xóa — giữ nguyên bản ghi (booking, xe, kg, ngày… như lúc nhập), trạng thái hủy với lý do
 * "Đã gộp vào lần xuất …" + dấu chuyến chung. Mọi luật đang bỏ qua chuyến hủy (kỳ xem, độ phủ, khép HĐ) vẫn đúng.
 */
export const mergedIntoReason = (keepLabel: string, keepId: string) => `Đã gộp vào lần xuất ${keepLabel} ⟦merged-into:${keepId}⟧`;
const MERGED_INTO = /⟦merged-into:([^⟧]+)⟧/;
/** Lý do của bản ghi gốc chuyến HĐ chính (giữ giá trị trước khi gộp). */
export const ORIGINAL_RECORD_TEXT = "Bản ghi gốc của chuyến trước khi gộp";
/** Bản ghi gốc của chuyến HĐ chính (không phải chuyến của HĐ khác đã gộp vào) — không tách / mở lại được. */
export const isOriginalRecord = (s: Pick<ExportShipment, "cancelReason">) => s.cancelReason.startsWith(ORIGINAL_RECORD_TEXT);
/** Id chuyến chung mà chuyến này đã gộp vào ("" = không phải chuyến đã gộp). */
export const mergedIntoId = (s: Pick<ExportShipment, "status" | "cancelReason">) => (s.status === "cancelled" ? (MERGED_INTO.exec(s.cancelReason)?.[1] ?? "") : "");
/** Chuyến đã gộp vào chuyến `keepId` (bản ghi gốc của từng HĐ, giữ để tra + tách lại). */
export const mergedChildren = (d: Pick<ExportData, "shipments">, keepId: string) => d.shipments.filter((s) => mergedIntoId(s) === keepId);

/** R3: các tập chuyến U1 đã chọn Giữ riêng (theo thứ tự nhật ký; "keep-off" gỡ lại). */
export function keptSeparateSets(activities: readonly Pick<ExportActivity, "summary" | "createdAt">[]): string[][] {
  const sets = new Map<string, string[]>();
  for (const a of [...activities].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    for (const m of a.summary.matchAll(TAG)) {
      if (m[1] !== "keep" && m[1] !== "keep-off") continue;
      const ids = m[2].split(",").filter(Boolean).sort();
      const key = ids.join(",");
      if (m[1] === "keep") sets.set(key, ids);
      else sets.delete(key);
    }
  }
  return [...sets.values()];
}

/** R12: chuyến đã gộp ⇒ chuyến chung đang mở (đi theo chuỗi nếu chuyến chung lại gộp tiếp). Không phải chuyến đã gộp ⇒ null. */
export function mergedInto(d: Pick<ExportData, "shipments">, shipmentId: string): { shipmentId: string } | null {
  let cur = d.shipments.find((s) => s.id === shipmentId);
  const seen = new Set<string>();
  let target = "";
  while (cur && mergedIntoId(cur) && !seen.has(cur.id)) {
    seen.add(cur.id);
    target = mergedIntoId(cur);
    cur = d.shipments.find((s) => s.id === target);
  }
  return target ? { shipmentId: target } : null;
}

/* ---------- GC1: dò chuyến cùng một lần xuất (R1–R3) ---------- */

export type DuplicateReason = "booking" | "loading-date";
export interface DuplicateGroup {
  customerId: string;
  reason: DuplicateReason;
  /** Booking chung (reason = booking) hoặc ngày đóng chung (yyyy-mm-dd). */
  value: string;
  shipmentIds: string[];
}

const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const customerOf = (d: Pick<ExportData, "contracts">, s: Pick<ExportShipment, "contractId">) => d.contracts.find((c) => c.id === s.contractId)?.customerId ?? "";

/** R1: hai chuyến cùng khách là một lần xuất khi cùng booking, hoặc cùng ngày đóng mà ít nhất một bên chưa booking. */
export function sameExport(a: Pick<ExportShipment, "bookingNo" | "loadingDate">, b: Pick<ExportShipment, "bookingNo" | "loadingDate">): DuplicateReason | null {
  const ba = squash(a.bookingNo);
  const bb = squash(b.bookingNo);
  if (ba && bb) return ba === bb ? "booking" : null;
  return a.loadingDate && a.loadingDate === b.loadingDate ? "loading-date" : null;
}

const isOpen = (s: ExportShipment) => s.status === "open";

/** R1–R3: nhóm chuyến mở cùng khách có thể là một lần xuất (bắc cầu), bỏ nhóm đã Giữ riêng. Xếp theo ngày đóng. */
export function duplicateShipmentGroups(d: Pick<ExportData, "contracts" | "shipments" | "activities">): DuplicateGroup[] {
  const open = d.shipments.filter(isOpen);
  const parent = new Map(open.map((s) => [s.id, s.id]));
  const find = (id: string): string => {
    const p = parent.get(id)!;
    if (p === id) return id;
    const r = find(p);
    parent.set(id, r);
    return r;
  };
  const byCustomer = new Map<string, ExportShipment[]>();
  for (const s of open) {
    const c = customerOf(d, s);
    if (c) byCustomer.set(c, [...(byCustomer.get(c) ?? []), s]);
  }
  for (const list of byCustomer.values())
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) if (sameExport(list[i], list[j])) parent.set(find(list[i].id), find(list[j].id));
  const groups = new Map<string, ExportShipment[]>();
  for (const s of open) {
    const r = find(s.id);
    groups.set(r, [...(groups.get(r) ?? []), s]);
  }
  const kept = keptSeparateSets(d.activities);
  const out: DuplicateGroup[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const ids = members.map((s) => s.id);
    if (kept.some((k) => ids.every((id) => k.includes(id)))) continue;
    const bookings = new Set(members.map((s) => squash(s.bookingNo)).filter(Boolean));
    const reason: DuplicateReason = bookings.size === 1 && members.filter((s) => s.bookingNo.trim()).length >= 2 ? "booking" : "loading-date";
    const value = reason === "booking" ? members.find((s) => s.bookingNo.trim())!.bookingNo.trim() : (members.find((s) => s.loadingDate)?.loadingDate ?? "");
    out.push({ customerId: customerOf(d, members[0]), reason, value, shipmentIds: ids });
  }
  const dateOf = (g: DuplicateGroup) => d.shipments.find((s) => s.id === g.shipmentIds[0])?.loadingDate ?? "";
  return out.sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
}

/** GC3 (c): chuyến mở khác của cùng khách cùng lần xuất với `s` (booking vừa ghi / ngày vừa ghi). */
export function sameExportShipments(d: Pick<ExportData, "contracts" | "shipments">, s: ExportShipment): ExportShipment[] {
  const c = customerOf(d, s);
  return d.shipments.filter((x) => x.id !== s.id && isOpen(x) && customerOf(d, x) === c && sameExport(s, x));
}

/* ---------- GC2: gộp (R4–R11) ---------- */

type MergeData = Pick<
  ExportData,
  "contracts" | "revisions" | "approvals" | "shipments" | "items" | "files" | "payments" | "shipmentLines" | "shipmentContainers"
>;

/** Mục đã có gì đó (trạng thái, số, ngày, ghi chú, lý do, file) — không bao giờ bị thay bằng mục trống. */
const hasProgress = (d: Pick<ExportData, "files">, i: ExportStepItem) =>
  i.state !== "not-started" || !!i.number.trim() || !!i.issuedOn || !!i.note?.trim() || !!i.naReason?.trim() || d.files.some((f) => f.stepItemId === i.id);
const itemKey = (i: Pick<ExportStepItem, "step" | "docKind">) => (i.step === "document" ? `document:${i.docKind}` : i.step);
const transportFilled = (t: ExportTransportInfo | undefined) => !!t && [t.haulier, t.emptyPickupPlace, t.stuffingPlace, t.returnYard].every((v) => v.trim());
const BOOKING_KEYS: (keyof ExportBookingDetails)[] = ["forwarder", "placeOfReceipt", "portOfLoading", "placeOfDelivery", "returnYard", "emptyPickupYard", "docCutoff", "vgmCutoff", "cargoCutoff"];
const SHIPMENT_KEYS = ["bookingNo", "loadingDate", "etd", "eta", "vesselVoyage", "portOfDischarge", "containerNo", "sealNo", "lotCode"] as const;
/** Ô thuộc cont 1 — gộp "mỗi chuyến một cont" thì đi theo cont thêm, không hỏi. */
const CONTAINER_KEYS = new Set<string>(["containerNo", "sealNo"]);

export const MERGE_FIELD_LABELS: Record<string, string> = {
  bookingNo: "Số booking",
  loadingDate: "Ngày đóng cont",
  etd: "ETD",
  eta: "ETA",
  vesselVoyage: "Tàu / chuyến",
  portOfDischarge: "Cảng đích",
  containerNo: "Số container",
  sealNo: "Số seal",
  lotCode: "Mã lô (MSL)",
  forwarder: "Đại lý (forwarder)",
  placeOfReceipt: "Nơi nhận hàng",
  portOfLoading: "Cảng xếp",
  placeOfDelivery: "Nơi giao hàng",
  returnYard: "Nơi hạ bãi",
  emptyPickupYard: "Bãi lấy rỗng",
  docCutoff: "Hạn chứng từ",
  vgmCutoff: "Hạn VGM",
  cargoCutoff: "Hạn hạ bãi",
  transport: "Thông tin xe vận chuyển",
};

export type MergeMode = "same-container" | "separate-containers";

export type MergeGate =
  | { ok: true }
  | {
      ok: false;
      reason: "same" | "not-open" | "customer-mismatch" | "sent-or-paid" | "both-progress" | "contract-blocked" | "no-revision" | "not-container";
      /** Tên mục (both-progress) hoặc id HĐ (contract-blocked / no-revision). */
      detail?: string;
    };

/** Chuyến chỉ là kế hoạch: chưa file, chưa mục Xong (41 R40 — gộp không cần đủ hồ sơ). */
const isPlanned = (d: Pick<ExportData, "files" | "items">, s: ExportShipment) => canDeleteShipment(d, s.id);

/** R5: gộp được `drop` vào `keep` không. */
export function mergeGate(d: MergeData, keep: ExportShipment, drop: ExportShipment, mode: MergeMode = "same-container", opts?: EvidenceOptions): MergeGate {
  if (keep.id === drop.id) return { ok: false, reason: "same" };
  if (!isOpen(keep) || !isOpen(drop)) return { ok: false, reason: "not-open" };
  if (customerOf(d, keep) !== customerOf(d, drop) || !customerOf(d, keep)) return { ok: false, reason: "customer-mismatch" };
  if (mode === "separate-containers" && (!isContainerKind(keep.kind) || !isContainerKind(drop.kind))) return { ok: false, reason: "not-container" };
  if (d.payments.some((p) => p.shipmentId === keep.id || p.shipmentId === drop.id)) return { ok: false, reason: "sent-or-paid" };
  const keepItems = d.items.filter((i) => i.shipmentId === keep.id && !i.sharedFromId && hasProgress(d, i));
  for (const i of d.items.filter((x) => x.shipmentId === drop.id && !x.sharedFromId && hasProgress(d, x)))
    if (keepItems.some((k) => itemKey(k) === itemKey(i))) return { ok: false, reason: "both-progress", detail: itemKey(i) };
  for (const cid of shipmentContractIds(d, drop)) {
    const c = d.contracts.find((x) => x.id === cid);
    if (!c || c.status !== "open") return { ok: false, reason: "not-open" };
    if (!(effectiveRevision(d, cid) ?? workingRevision(d, cid))) return { ok: false, reason: "no-revision", detail: cid };
    if (isPlanned(d, drop) || shipmentContractIds(d, keep).includes(cid)) continue;
    if (!addContractGate(d as ExportData, keep, cid, opts).ok) return { ok: false, reason: "contract-blocked", detail: cid };
  }
  const keepContract = d.contracts.find((x) => x.id === keep.contractId);
  if (!keepContract || keepContract.status !== "open") return { ok: false, reason: "not-open" };
  return { ok: true };
}

const filledCount = (s: ExportShipment) =>
  SHIPMENT_KEYS.filter((k) => String(s[k] ?? "").trim()).length +
  BOOKING_KEYS.filter((k) => String(s.booking?.[k] ?? "").trim()).length +
  (s.transport ? Object.values(s.transport).filter((v) => v.trim()).length : 0);

/** R4: chuyến giữ mặc định — nhiều file → nhiều mục Xong → nhiều ô đã điền → tạo sớm hơn. */
export function defaultKeeper(d: Pick<ExportData, "files" | "items">, shipments: readonly ExportShipment[]): ExportShipment | null {
  const score = (s: ExportShipment) => [
    d.files.filter((f) => f.shipmentId === s.id).length,
    d.items.filter((i) => i.shipmentId === s.id && i.state === "done").length,
    filledCount(s),
  ];
  return (
    [...shipments].sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i] - sa[i];
      return a.createdAt.localeCompare(b.createdAt);
    })[0] ?? null
  );
}

export interface MergeConflict {
  key: string;
  label: string;
  /** Giá trị khác nhau, mỗi giá trị kèm chuyến có nó (chuyến giữ trước). */
  options: { shipmentId: string; value: string }[];
}

const fieldValue = (s: ExportShipment, key: string): string => {
  if (key === "transport") return transportFilled(s.transport) ? [s.transport!.haulier, s.transport!.truckPlate, s.transport!.driverName].filter((v) => v.trim()).join(" · ") : "";
  if ((SHIPMENT_KEYS as readonly string[]).includes(key)) return String(s[key as (typeof SHIPMENT_KEYS)[number]] ?? "").trim();
  return String(s.booking?.[key as keyof ExportBookingDetails] ?? "").trim();
};
const sameValue = (key: string, a: string, b: string) => (key === "bookingNo" ? squash(a) === squash(b) : a.trim().toLowerCase() === b.trim().toLowerCase());

/** R6: ô hai bên đều có giá trị mà khác nhau (chuyến giữ trước). Khối xe so nguyên khối. */
export function mergeConflicts(keep: ExportShipment, drops: readonly ExportShipment[], mode: MergeMode = "same-container"): MergeConflict[] {
  const keys = [...SHIPMENT_KEYS.filter((k) => mode === "same-container" || !CONTAINER_KEYS.has(k)), ...BOOKING_KEYS, "transport"];
  const out: MergeConflict[] = [];
  for (const key of keys) {
    // Gộp làm cont thêm: ngày đóng của chuyến bỏ đi theo cont thêm, không hỏi.
    if (mode === "separate-containers" && key === "loadingDate") continue;
    const options: MergeConflict["options"] = [];
    for (const s of [keep, ...drops]) {
      const v = fieldValue(s, key);
      if (v && !options.some((o) => sameValue(key, o.value, v))) options.push({ shipmentId: s.id, value: v });
    }
    if (options.length > 1) out.push({ key, label: MERGE_FIELD_LABELS[key] ?? key, options });
  }
  return out;
}

/** R10: loại chuyến sau gộp. */
function mergedKind(keep: ExportShipment, drops: readonly ExportShipment[]): ExportShipmentKind {
  if (keep.kind !== "consolidated") return keep.kind;
  return drops.find((s) => isContainerKind(s.kind))?.kind ?? drops.find((s) => s.kind !== "consolidated")?.kind ?? keep.kind;
}

export interface MergeResult {
  shipments: ExportShipment[];
  items: ExportStepItem[];
  files: ExportFile[];
  shipmentLines: ExportShipmentLine[];
  shipmentContainers: ExportShipmentContainer[];
  orderLinks: ProductionOrderShipment[];
  /** Nhắc dòng hàng cần ghi tay (HĐ nhiều dòng / chưa tính được số kiện). */
  notices: string[];
  /** R7: số file trùng tên cùng mục sau gộp (giữ cả hai). */
  duplicateFileNames: number;
}

/**
 * R6–R10 (v1.1 — không mất gì): gộp các chuyến `drops` vào `keep` (đã qua `mergeGate`).
 *  • ô của chuyến chung: giá trị của chuyến HĐ chính; ô trống lấy bù từ chuyến kia. Ô hai bên ghi khác nhau KHÔNG bỏ:
 *    giá trị kia còn nguyên ở bản ghi chuyến đã gộp và hiện ở `fieldDifferences`;
 *  • chuyến bỏ giữ bản ghi (trạng thái "Đã gộp vào lần xuất …"); mục bước trống của nó nằm lại bản ghi đó;
 *  • dòng hàng, file, mục có tiến độ, lệnh sản xuất, cont thêm sang chuyến chung — không xóa dòng nào.
 */
export function mergeShipments(
  d: MergeData,
  keep: ExportShipment,
  drops: readonly ExportShipment[],
  opts: { mode?: MergeMode; orderLinks?: readonly ProductionOrderShipment[]; newId: () => string; now: string; keepLabel?: string },
): MergeResult {
  const mode = opts.mode ?? "same-container";
  const all = [keep, ...drops];
  const dropIds = new Set(drops.map((s) => s.id));
  const firstFilled = (key: string) => all.find((s) => fieldValue(s, key));

  /* Ô của chuyến chung (R6): HĐ chính trước, trống thì bù. */
  const merged: ExportShipment = { ...keep };
  for (const key of SHIPMENT_KEYS) {
    if (mode === "separate-containers" && (CONTAINER_KEYS.has(key) || key === "loadingDate")) continue;
    const src = firstFilled(key);
    if (src) merged[key] = src[key];
  }
  if (all.some((s) => s.booking)) {
    const booking = { ...(keep.booking ?? ({} as ExportBookingDetails)) };
    for (const key of BOOKING_KEYS) booking[key] = firstFilled(key)?.booking?.[key] ?? booking[key] ?? "";
    merged.booking = booking;
  }
  const transportSrc = all.find((s) => transportFilled(s.transport)) ?? all.find((s) => s.transport && Object.values(s.transport).some((v) => v.trim()));
  if (transportSrc?.transport) merged.transport = { ...transportSrc.transport };
  merged.note = [...new Set(all.map((s) => s.note.trim()).filter(Boolean))].join(" · ");
  merged.kind = mergedKind(keep, drops);
  merged.plannedKg = all.every((s) => s.plannedKg == null) ? null : all.reduce((t, s) => t + (s.plannedKg ?? 0), 0);
  merged.planMonth = keep.planMonth || drops.find((s) => s.planMonth)?.planMonth || "";

  /* Cont (mỗi chuyến một cont ⇒ chuyến bỏ thành cont thêm — 73 R13). */
  const extras = (d.shipmentContainers ?? []).filter((c) => c.shipmentId === keep.id);
  let sort = extras.reduce((m, c) => Math.max(m, c.sortOrder), 0);
  const containerOfDrop = new Map<string, string>();
  const newContainers: ExportShipmentContainer[] = [];
  const movedContainers: ExportShipmentContainer[] = [];
  for (const s of drops) {
    if (mode === "separate-containers") {
      const id = opts.newId();
      containerOfDrop.set(s.id, id);
      newContainers.push({
        id,
        shipmentId: keep.id,
        sortOrder: ++sort,
        kind: s.kind === "20RF" || s.kind === "40RF" || s.kind === "40HC-RF" ? s.kind : "20RF",
        containerNo: s.containerNo,
        sealNo: s.sealNo,
        loadingDate: s.loadingDate === merged.loadingDate ? "" : s.loadingDate,
        note: "",
        createdAt: opts.now,
      });
    }
    for (const c of (d.shipmentContainers ?? []).filter((x) => x.shipmentId === s.id)) movedContainers.push({ ...c, shipmentId: keep.id, sortOrder: ++sort });
  }
  const contOf = (dropId: string, containerId: string | undefined) => (containerId ? containerId : (containerOfDrop.get(dropId) ?? ""));

  /* Dòng hàng (R9 — như consolidateInto). */
  const lines = d.shipmentLines ?? [];
  const keepLines = lines.filter((l) => l.shipmentId === keep.id);
  const notices: string[] = [];
  let lineSort = keepLines.reduce((m, l) => Math.max(m, l.sortOrder), 0);
  const added: ExportShipmentLine[] = [];
  const multi = drops.some((s) => s.contractId !== keep.contractId || lines.some((l) => l.shipmentId === s.id && l.contractId && l.contractId !== keep.contractId));
  if (!keepLines.length && multi) {
    const own = plannedLines(d as ExportData, keep.contractId, keep.id, keep.plannedKg, opts.newId, lineSort);
    added.push(...own.lines);
    if (own.notice) notices.push(own.notice);
    lineSort = added.reduce((m, l) => Math.max(m, l.sortOrder), lineSort);
  }
  for (const s of drops) {
    const own = lines.filter((l) => l.shipmentId === s.id);
    if (own.length) {
      added.push(...own.map((l, i) => ({ ...l, shipmentId: keep.id, contractId: l.contractId || s.contractId, containerId: contOf(s.id, l.containerId) || undefined, sortOrder: lineSort + (i + 1) * 10 })));
    } else {
      const built = plannedLines(d as ExportData, s.contractId, keep.id, s.plannedKg, opts.newId, lineSort);
      const cont = containerOfDrop.get(s.id);
      added.push(...built.lines.map((l) => (cont ? { ...l, containerId: cont } : l)));
      if (built.notice) notices.push(built.notice);
    }
    lineSort = added.reduce((m, l) => Math.max(m, l.sortOrder), lineSort);
  }
  const cleanLine = (l: ExportShipmentLine): ExportShipmentLine => {
    if (l.containerId) return l;
    const { containerId: _c, ...rest } = l;
    return rest as ExportShipmentLine;
  };

  /* Mục bước (R8): không xóa mục nào — mục có tiến độ (hoặc loại chuyến chung chưa có) sang chuyến chung; mục trống của
     chuyến bỏ nằm lại bản ghi của nó; mục trống của chuyến chung bị mục có tiến độ thế chỗ thì đổi sang bản ghi đó. */
  const keepItems = d.items.filter((i) => i.shipmentId === keep.id);
  const newShipmentOf = new Map<string, string>(); // id mục → chuyến mới
  const replacedBy = new Map<string, string>(); // id mục (không còn ở chuyến chung) → mục cùng loại ở chuyến chung
  const slot = new Map(keepItems.map((i) => [itemKey(i), i]));
  for (const s of drops) {
    for (const i of d.items.filter((x) => x.shipmentId === s.id)) {
      const twin = slot.get(itemKey(i));
      if (!twin) {
        newShipmentOf.set(i.id, keep.id);
        slot.set(itemKey(i), i);
      } else if (hasProgress(d, i) && !hasProgress(d, twin) && twin.shipmentId === keep.id && !newShipmentOf.has(twin.id)) {
        newShipmentOf.set(i.id, keep.id);
        newShipmentOf.set(twin.id, s.id);
        replacedBy.set(twin.id, i.id);
        slot.set(itemKey(i), i);
      } else {
        replacedBy.set(i.id, twin.id);
      }
    }
  }
  const resolve = (id: string): string => {
    const seen = new Set<string>();
    let cur = id;
    while (replacedBy.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = replacedBy.get(cur)!;
    }
    return cur;
  };
  const items = d.items.map((i) => {
    let next = newShipmentOf.has(i.id) ? { ...i, shipmentId: newShipmentOf.get(i.id)! } : i;
    // Mục "dùng chung" ở chuyến khác trỏ tới mục nay không ở chuyến chung ⇒ trỏ mục cùng loại của chuyến chung.
    if (next.sharedFromId && replacedBy.has(next.sharedFromId) && next.shipmentId !== keep.id) next = { ...next, sharedFromId: resolve(next.sharedFromId) };
    // Mục của chuyến chung "dùng chung" từ chuyến vừa gộp vào ⇒ thành mục của chính chuyến đó, bỏ dùng chung.
    if (next.shipmentId === keep.id && next.sharedFromId) {
      const src = d.items.find((x) => x.id === next.sharedFromId);
      if (src && (src.shipmentId === keep.id || dropIds.has(src.shipmentId))) next = { ...next, sharedFromId: "" };
    }
    return next;
  });

  /* File (R7): mọi file của chuyến bỏ sang chuyến chung, giữ người đính / ngày / HĐ gốc (`contractId` — tách lại theo đó). */
  const files = d.files.map((f) => {
    let next = f;
    if (dropIds.has(f.shipmentId)) {
      next = { ...f, shipmentId: keep.id };
      const cont = containerOfDrop.get(f.shipmentId);
      if (cont && !f.containerId && (f.step === "container-seal-photos" || f.step === "loading-photos")) next = { ...next, containerId: cont };
    }
    if (next.stepItemId && replacedBy.has(next.stepItemId)) next = { ...next, stepItemId: resolve(next.stepItemId) };
    return next;
  });
  const seen = new Map<string, number>();
  for (const f of files.filter((x) => x.shipmentId === keep.id)) {
    const k = `${f.step}|${f.stepItemId}|${f.containerId ?? ""}|${f.fileName.trim().toLowerCase()}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const duplicateFileNames = [...seen.values()].filter((n) => n > 1).reduce((t, n) => t + n, 0);

  /* Lệnh sản xuất gắn chuyến (R8). */
  const orderLinks: ProductionOrderShipment[] = [];
  for (const l of opts.orderLinks ?? []) {
    const next = dropIds.has(l.shipmentId) ? { ...l, shipmentId: keep.id } : l;
    if (orderLinks.some((x) => x.orderId === next.orderId && x.shipmentId === next.shipmentId)) continue;
    orderLinks.push(next);
  }

  const reason = mergedIntoReason(opts.keepLabel ?? "", keep.id);
  // Có ô ghi khác nhau ⇒ giữ thêm bản ghi gốc của chuyến HĐ chính: sau này dùng giá trị của HĐ kia thì giá trị cũ của HĐ
  // chính vẫn còn (không ô nào của HĐ nào bị mất).
  const snapshot: ExportShipment[] = mergeConflicts(keep, drops, mode).length
    ? [{ ...keep, id: opts.newId(), status: "cancelled", cancelReason: `${ORIGINAL_RECORD_TEXT} ⟦merged-into:${keep.id}⟧` }]
    : [];
  return {
    shipments: [...d.shipments.map((s) => (s.id === keep.id ? merged : dropIds.has(s.id) ? { ...s, status: "cancelled" as const, cancelReason: reason } : s)), ...snapshot],
    items,
    files,
    shipmentLines: [...lines.filter((l) => !dropIds.has(l.shipmentId)), ...added].map(cleanLine),
    shipmentContainers: [...(d.shipmentContainers ?? []).filter((c) => !dropIds.has(c.shipmentId)), ...movedContainers, ...newContainers],
    orderLinks,
    notices,
    duplicateFileNames,
  };
}

/* ---------- Ô ghi khác nhau giữa các HĐ của một lần xuất (R6 v1.1) ---------- */

export interface FieldDifference {
  key: string;
  label: string;
  /** Mỗi giá trị kèm chuyến (HĐ) đã ghi; `inUse` = giá trị chuyến chung đang dùng. */
  values: { shipmentId: string; contractId: string; value: string; inUse: boolean; original?: boolean }[];
}

/** Ô mà chuyến chung và bản ghi các chuyến đã gộp vào nó ghi khác nhau — để thấy đủ, chọn lại khi cần. */
export function fieldDifferences(d: Pick<ExportData, "shipments">, keep: ExportShipment): FieldDifference[] {
  const children = mergedChildren(d, keep.id);
  if (!children.length) return [];
  const out: FieldDifference[] = [];
  for (const key of [...SHIPMENT_KEYS, ...BOOKING_KEYS, "transport"]) {
    const values: FieldDifference["values"] = [];
    const current = fieldValue(keep, key);
    // Giá trị đang dùng ghi theo HĐ đã nhập nó (chuyến của HĐ khác trước, rồi bản ghi gốc của HĐ chính), không mặc định HĐ chính.
    const source = current ? (children.find((c) => !isOriginalRecord(c) && sameValue(key, fieldValue(c, key), current)) ?? children.find((c) => sameValue(key, fieldValue(c, key), current))) : undefined;
    if (current) values.push({ shipmentId: keep.id, contractId: source?.contractId ?? keep.contractId, value: current, inUse: true });
    for (const c of children) {
      const v = fieldValue(c, key);
      if (v && !values.some((x) => sameValue(key, x.value, v))) values.push({ shipmentId: c.id, contractId: c.contractId, value: v, inUse: false, original: isOriginalRecord(c) });
    }
    if (values.length > 1) out.push({ key, label: MERGE_FIELD_LABELS[key] ?? key, values });
  }
  return out;
}

/** Dùng giá trị của bản ghi `sourceId` cho ô `key` của chuyến chung (khối xe: cả khối). */
export function withFieldValue(keep: ExportShipment, source: ExportShipment, key: string): ExportShipment {
  if (key === "transport") return source.transport ? { ...keep, transport: { ...source.transport } } : keep;
  if ((SHIPMENT_KEYS as readonly string[]).includes(key)) return { ...keep, [key]: source[key as (typeof SHIPMENT_KEYS)[number]] };
  const k = key as keyof ExportBookingDetails;
  return { ...keep, booking: { ...(keep.booking ?? ({} as ExportBookingDetails)), [k]: source.booking?.[k] ?? "" } };
}

/* ---------- Tách HĐ ra khỏi lần xuất (R17) ---------- */

export type SplitGate = { ok: true } | { ok: false; reason: "not-open" | "main-contract" | "not-carried" | "sent-or-paid" };

/** Tách HĐ `contractId` khỏi chuyến chung `keep`: chuyến mở, HĐ không phải HĐ chính, có hàng trên chuyến, chưa gửi chứng từ / tiền về. */
export function splitGate(d: Pick<ExportData, "shipments" | "shipmentLines" | "payments">, keep: ExportShipment, contractId: string): SplitGate {
  if (!isOpen(keep)) return { ok: false, reason: "not-open" };
  if (keep.contractId === contractId) return { ok: false, reason: "main-contract" };
  if (!(d.shipmentLines ?? []).some((l) => l.shipmentId === keep.id && l.contractId === contractId)) return { ok: false, reason: "not-carried" };
  if (d.payments.some((p) => p.shipmentId === keep.id)) return { ok: false, reason: "sent-or-paid" };
  return { ok: true };
}

/**
 * R17: HĐ `contractId` ra chuyến riêng. Có bản ghi chuyến gốc của HĐ đã gộp vào đây ⇒ mở lại đúng bản ghi đó (booking, xe,
 * ngày… như lúc nhập); không có (HĐ đi chung từ lịch) ⇒ chuyến mới chép booking / ngày của chuyến chung. Đi theo: dòng hàng
 * của HĐ, file đính cho HĐ đó (`contractId`), lệnh sản xuất của HĐ gắn chuyến. Mục chứng từ đã làm chung ở lại chuyến chung.
 */
export function splitContract(
  d: Pick<ExportData, "shipments" | "files" | "shipmentLines">,
  keep: ExportShipment,
  contractId: string,
  opts: { orderLinks?: readonly ProductionOrderShipment[]; orderContractOf?: (orderId: string) => string; newId: () => string; now: string },
): { shipments: ExportShipment[]; files: ExportFile[]; shipmentLines: ExportShipmentLine[]; orderLinks: ProductionOrderShipment[]; child: ExportShipment; reopened: boolean } {
  const lines = d.shipmentLines ?? [];
  const moving = lines.filter((l) => l.shipmentId === keep.id && l.contractId === contractId);
  const movedKg = moving.reduce((t, l) => t + lineKg(l), 0);
  const original = [...mergedChildren(d, keep.id)].reverse().find((s) => s.contractId === contractId && !isOriginalRecord(s));
  const child: ExportShipment = original
    ? { ...original, status: "open", cancelReason: "", plannedKg: movedKg > 0 ? movedKg : original.plannedKg }
    : {
        ...keep,
        id: opts.newId(),
        contractId,
        plannedKg: movedKg > 0 ? movedKg : null,
        lotCode: "",
        containerNo: "",
        sealNo: "",
        transport: undefined,
        goodsSummary: "",
        note: "",
        status: "open",
        cancelReason: "",
        createdAt: opts.now,
      };
  if (!child.transport) delete child.transport;
  const keepKg = keep.plannedKg == null ? null : Math.max(0, keep.plannedKg - movedKg);
  const shipments = original ? d.shipments.map((s) => (s.id === keep.id ? { ...s, plannedKg: keepKg } : s.id === child.id ? child : s)) : [...d.shipments.map((s) => (s.id === keep.id ? { ...s, plannedKg: keepKg } : s)), child];
  const movingIds = new Set(moving.map((l) => l.id));
  const shipmentLines = lines.map((l) => {
    if (!movingIds.has(l.id)) return l;
    const { containerId: _c, ...rest } = l;
    return { ...(rest as ExportShipmentLine), shipmentId: child.id };
  });
  const files = d.files.map((f) => (f.shipmentId === keep.id && f.contractId === contractId ? { ...f, shipmentId: child.id, containerId: undefined } : f)).map((f) => {
    if (f.containerId !== undefined) return f;
    const { containerId: _c, ...rest } = f;
    return rest as ExportFile;
  });
  const orderLinks = (opts.orderLinks ?? []).map((l) => (l.shipmentId === keep.id && opts.orderContractOf?.(l.orderId) === contractId ? { ...l, shipmentId: child.id } : l));
  return { shipments, files, shipmentLines, orderLinks, child, reopened: !!original };
}

/* ---------- GC3: dòng lịch của HĐ mới đi chung chuyến có sẵn (R13) ---------- */

/** Chuyến mở của khách (HĐ khác) cùng lần xuất với dòng lịch — cùng booking trước, rồi ngày gần. */
export function jointShipmentsFor(
  d: Pick<ExportData, "contracts" | "shipments" | "shipmentLines">,
  customerId: string,
  contractId: string,
  row: { bookingNo?: string; loadingDate?: string },
): ExportShipment[] {
  if (!customerId) return [];
  const probe = { bookingNo: row.bookingNo ?? "", loadingDate: row.loadingDate ?? "" };
  return d.shipments
    .filter((s) => isOpen(s) && customerOf(d, s) === customerId && !shipmentContractIds(d, s).includes(contractId) && sameExport(probe, s))
    .sort((a, b) => Number(sameExport(probe, b) === "booking") - Number(sameExport(probe, a) === "booking"));
}

/**
 * Thêm hàng của HĐ `contractId` vào chuyến `target` (dòng lịch Đi chung): dòng dựng từ kg (R9), kg chuyến cộng thêm,
 * booking / ngày của dòng lấp ô trống của chuyến. Chuyến chưa có dòng ⇒ dựng dòng HĐ chính trước.
 */
export function joinShipment(
  d: Pick<ExportData, "contracts" | "revisions" | "approvals" | "shipments" | "shipmentLines">,
  target: ExportShipment,
  contractId: string,
  row: { plannedKg: number | null; bookingNo?: string; loadingDate?: string; etd?: string; eta?: string },
  newId: () => string,
): { shipment: ExportShipment; shipmentLines: ExportShipmentLine[]; notices: string[] } {
  const lines = d.shipmentLines ?? [];
  const own = lines.filter((l) => l.shipmentId === target.id);
  let sort = own.reduce((m, l) => Math.max(m, l.sortOrder), 0);
  const added: ExportShipmentLine[] = [];
  const notices: string[] = [];
  if (!own.length) {
    const host = plannedLines(d as ExportData, target.contractId, target.id, target.plannedKg, newId, sort);
    added.push(...host.lines);
    if (host.notice) notices.push(host.notice);
    sort = added.reduce((m, l) => Math.max(m, l.sortOrder), sort);
  }
  const mine = plannedLines(d as ExportData, contractId, target.id, row.plannedKg, newId, sort);
  added.push(...mine.lines);
  if (mine.notice) notices.push(mine.notice);
  const fill = (cur: string, v: string | undefined) => cur || v?.trim() || "";
  return {
    shipment: {
      ...target,
      plannedKg: target.plannedKg == null && row.plannedKg == null ? null : (target.plannedKg ?? 0) + (row.plannedKg ?? 0),
      bookingNo: fill(target.bookingNo, row.bookingNo),
      loadingDate: fill(target.loadingDate, row.loadingDate),
      etd: fill(target.etd, row.etd),
      eta: fill(target.eta, row.eta),
    },
    shipmentLines: [...lines, ...added],
    notices,
  };
}

/** Giá trị `joinShipmentId` của dòng lịch chọn Tạo chuyến riêng. */
export const SEPARATE_SHIPMENT = "none";

/** R13: chuyến dòng lịch sẽ đi chung (null = tạo chuyến mới). */
export function scheduleJoinTarget(
  d: Pick<ExportData, "contracts" | "shipments" | "shipmentLines">,
  customerId: string,
  contractId: string,
  row: Pick<ScheduleRow, "bookingNo" | "loadingDate" | "joinShipmentId">,
): ExportShipment | null {
  if (row.joinShipmentId === SEPARATE_SHIPMENT) return null;
  const cands = jointShipmentsFor(d, customerId, contractId, row);
  return cands.find((s) => s.id === row.joinShipmentId) ?? cands[0] ?? null;
}

/**
 * Ghi lịch của HĐ: dòng đi chung ⇒ thêm hàng HĐ vào chuyến có sẵn (không chuyến mới); dòng còn lại ⇒ `create` dựng
 * chuyến mới như luật cũ (41 NV19). `d` phải có sẵn HĐ + bản HĐ đang ghi (để dựng dòng từ kg).
 */
export function applyScheduleRows(
  d: Pick<ExportData, "contracts" | "revisions" | "approvals" | "shipments" | "shipmentLines">,
  customerId: string,
  contractId: string,
  rows: readonly ScheduleRow[],
  create: (rows: ScheduleRow[]) => ExportShipment[],
  newId: () => string,
): { shipments: ExportShipment[]; created: ExportShipment[]; joined: ExportShipment[]; shipmentLines: ExportShipmentLine[]; notices: string[] } {
  let work = { ...d, shipments: [...d.shipments], shipmentLines: [...(d.shipmentLines ?? [])] };
  const own: ScheduleRow[] = [];
  const joined: ExportShipment[] = [];
  const notices: string[] = [];
  for (const r of rows) {
    const target = scheduleJoinTarget(work, customerId, contractId, r);
    if (!target) {
      own.push(r);
      continue;
    }
    const out = joinShipment(work, target, contractId, r, newId);
    work = { ...work, shipments: work.shipments.map((s) => (s.id === target.id ? out.shipment : s)), shipmentLines: out.shipmentLines };
    joined.push(out.shipment);
    notices.push(...out.notices);
  }
  const created = create(own.map(({ joinShipmentId: _j, ...r }) => r));
  return { shipments: [...work.shipments, ...created], created, joined, shipmentLines: work.shipmentLines, notices };
}

/* ---------- GC4: kg kế hoạch theo HĐ trên một chuyến ---------- */

const lineKg = (l: ExportShipmentLine) =>
  l.plannedUnits == null || l.netKgPerCarton == null ? 0 : l.plannedUnits * l.netKgPerCarton * (l.unitKind === "bundle" ? Math.max(1, l.cartonsPerUnit || 1) : 1);

/** Kg kế hoạch của từng HĐ trên chuyến (HĐ chính trước). Chuyến chưa có dòng ⇒ cả kg thuộc HĐ chính. */
export function plannedKgByContract(d: Pick<ExportData, "shipmentLines">, s: ExportShipment): { contractId: string; kg: number }[] {
  const own = (d.shipmentLines ?? []).filter((l) => l.shipmentId === s.id);
  if (!own.length) return [{ contractId: s.contractId, kg: s.plannedKg ?? 0 }];
  return shipmentContractIds(d, s).map((cid) => ({ contractId: cid, kg: own.filter((l) => (l.contractId || s.contractId) === cid).reduce((t, l) => t + lineKg(l), 0) }));
}
