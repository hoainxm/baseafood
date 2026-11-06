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

/* ---------- Dấu máy đọc trong nhật ký (R3, R12) — không thêm cột ---------- */

const TAG = /⟦(keep|keep-off|merged):([^⟧]*)⟧/g;
/** Dấu "Giữ riêng" của một nhóm chuyến. */
export const keepSeparateTag = (ids: readonly string[]) => `⟦keep:${[...ids].sort().join(",")}⟧`;
export const keepSeparateOffTag = (ids: readonly string[]) => `⟦keep-off:${[...ids].sort().join(",")}⟧`;
/** Dấu "chuyến … đã gộp vào chuyến …". */
export const mergedTag = (dropIds: readonly string[], keepId: string) => `⟦merged:${dropIds.join(",")}>${keepId}⟧`;
/** Chữ nhật ký cho người đọc — bỏ dấu máy đọc. */
export const visibleActivitySummary = (summary: string) => summary.replace(TAG, "").replace(/\s{2,}/g, " ").trim();

/** R3: các tập chuyến U1 đã chọn Giữ riêng (theo thứ tự nhật ký; "keep-off" gỡ lại). */
export function keptSeparateSets(activities: readonly Pick<ExportActivity, "summary" | "createdAt">[]): string[][] {
  const sets = new Map<string, string[]>();
  for (const a of [...activities].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    for (const m of a.summary.matchAll(TAG)) {
      if (m[1] === "merged") continue;
      const ids = m[2].split(",").filter(Boolean).sort();
      const key = ids.join(",");
      if (m[1] === "keep") sets.set(key, ids);
      else sets.delete(key);
    }
  }
  return [...sets.values()];
}

/** R12: chuyến đã bị gộp ⇒ chuyến giữ + ngày gộp (lần gộp mới nhất). Chuyến còn tồn tại (đã Hoàn tác) ⇒ null. */
export function mergedInto(d: Pick<ExportData, "activities" | "shipments">, shipmentId: string): { shipmentId: string; mergedAt: string } | null {
  if (d.shipments.some((s) => s.id === shipmentId)) return null;
  let hit: { shipmentId: string; mergedAt: string } | null = null;
  for (const a of [...d.activities].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    for (const m of a.summary.matchAll(TAG)) {
      if (m[1] !== "merged") continue;
      const [drops, keep] = m[2].split(">");
      if (keep && drops.split(",").includes(shipmentId)) hit = { shipmentId: keep, mergedAt: a.createdAt };
    }
  }
  // Chuyến giữ cũng có thể đã gộp tiếp vào chuyến khác.
  if (hit && !d.shipments.some((s) => s.id === hit!.shipmentId)) return mergedInto(d, hit.shipmentId) ?? hit;
  return hit;
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

const hasProgress = (d: Pick<ExportData, "files">, i: ExportStepItem) =>
  i.state !== "not-started" || !!i.number.trim() || d.files.some((f) => f.stepItemId === i.id);
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
 * R6–R10: gộp các chuyến `drops` vào `keep` (đã qua `mergeGate`). `choices[key]` = id chuyến có giá trị được chọn cho
 * ô lệch; không chọn ⇒ chuyến giữ. Ô trống của chuyến giữ lấy bù từ chuyến bỏ (theo thứ tự).
 */
export function mergeShipments(
  d: MergeData,
  keep: ExportShipment,
  drops: readonly ExportShipment[],
  opts: { choices?: Record<string, string>; mode?: MergeMode; orderLinks?: readonly ProductionOrderShipment[]; newId: () => string; now: string },
): MergeResult {
  const mode = opts.mode ?? "same-container";
  const choices = opts.choices ?? {};
  const all = [keep, ...drops];
  const byId = new Map(all.map((s) => [s.id, s]));
  const dropIds = new Set(drops.map((s) => s.id));
  const pickFor = (key: string): ExportShipment | undefined => {
    const chosen = choices[key] ? byId.get(choices[key]) : undefined;
    if (chosen && fieldValue(chosen, key)) return chosen;
    return all.find((s) => fieldValue(s, key));
  };

  /* Ô của chuyến (R6). */
  const merged: ExportShipment = { ...keep };
  for (const key of SHIPMENT_KEYS) {
    if (mode === "separate-containers" && (CONTAINER_KEYS.has(key) || key === "loadingDate")) continue;
    const src = pickFor(key);
    if (src) merged[key] = src[key];
  }
  if (all.some((s) => s.booking)) {
    const booking = { ...(keep.booking ?? ({} as ExportBookingDetails)) };
    for (const key of BOOKING_KEYS) booking[key] = pickFor(key)?.booking?.[key] ?? booking[key] ?? "";
    merged.booking = booking;
  }
  const transportSrc = (choices.transport && byId.get(choices.transport)?.transport && transportFilled(byId.get(choices.transport)!.transport) ? byId.get(choices.transport) : undefined) ??
    all.find((s) => transportFilled(s.transport)) ??
    all.find((s) => s.transport && Object.values(s.transport).some((v) => v.trim()));
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
  // Dòng dựng mới không mang `containerId` rỗng (cont 1 = để trống).
  const cleanLine = (l: ExportShipmentLine): ExportShipmentLine => {
    if (l.containerId) return l;
    const { containerId: _c, ...rest } = l;
    return rest as ExportShipmentLine;
  };

  /* Mục bước (R8). */
  const keepItems = d.items.filter((i) => i.shipmentId === keep.id);
  const removed = new Map<string, string>(); // id mục bị bỏ → id mục thay thế
  const movedItems: ExportStepItem[] = [];
  const replaced = new Set<string>();
  const taken = new Map(keepItems.map((i) => [itemKey(i), i]));
  for (const s of drops) {
    for (const i of d.items.filter((x) => x.shipmentId === s.id)) {
      // Mục dùng chung trỏ về chuyến giữ / chuyến cùng gộp ⇒ thừa.
      if (i.sharedFromId && (d.items.find((x) => x.id === i.sharedFromId)?.shipmentId === keep.id || dropIds.has(d.items.find((x) => x.id === i.sharedFromId)?.shipmentId ?? ""))) {
        const twin = taken.get(itemKey(i));
        if (twin) {
          removed.set(i.id, twin.id);
          continue;
        }
      }
      const twin = taken.get(itemKey(i));
      if (!twin) {
        const moved = { ...i, shipmentId: keep.id };
        movedItems.push(moved);
        taken.set(itemKey(i), moved);
      } else if (hasProgress(d, i) && !hasProgress(d, twin)) {
        replaced.add(twin.id);
        removed.set(twin.id, i.id);
        const moved = { ...i, shipmentId: keep.id };
        movedItems.push(moved);
        taken.set(itemKey(i), moved);
      } else {
        removed.set(i.id, twin.id);
      }
    }
  }
  const resolve = (id: string): string => (removed.has(id) ? resolve(removed.get(id)!) : id);
  const items = [
    ...d.items
      .filter((i) => !dropIds.has(i.shipmentId) && !replaced.has(i.id))
      .map((i) => (i.sharedFromId && removed.has(i.sharedFromId) ? { ...i, sharedFromId: resolve(i.sharedFromId) } : i)),
    ...movedItems,
  ].map((i) => (i.shipmentId === keep.id && i.sharedFromId && pointsToKeepItself(i, keep.id, d.items, removed) ? { ...i, sharedFromId: "" } : i));

  /* File (R7). */
  const files = d.files.map((f) => {
    let next = f;
    if (dropIds.has(f.shipmentId)) {
      next = { ...f, shipmentId: keep.id };
      const cont = containerOfDrop.get(f.shipmentId);
      if (cont && !f.containerId && (f.step === "container-seal-photos" || f.step === "loading-photos")) next = { ...next, containerId: cont };
    }
    if (next.stepItemId && removed.has(next.stepItemId)) next = { ...next, stepItemId: resolve(next.stepItemId) };
    return next;
  });
  const seen = new Map<string, number>();
  for (const f of files.filter((x) => x.shipmentId === keep.id)) {
    const k = `${f.step}|${f.stepItemId}|${f.containerId ?? ""}|${f.fileName.trim().toLowerCase()}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const duplicateFileNames = [...seen.values()].filter((n) => n > 1).reduce((t, n) => t + n, 0);

  /* Lệnh sản xuất gắn chuyến (R8). */
  const links = opts.orderLinks ?? [];
  const orderLinks: ProductionOrderShipment[] = [];
  for (const l of links) {
    const next = dropIds.has(l.shipmentId) ? { ...l, shipmentId: keep.id } : l;
    if (orderLinks.some((x) => x.orderId === next.orderId && x.shipmentId === next.shipmentId)) continue;
    orderLinks.push(next);
  }

  return {
    shipments: d.shipments.filter((s) => !dropIds.has(s.id)).map((s) => (s.id === keep.id ? merged : s)),
    items,
    files,
    shipmentLines: [...lines.filter((l) => !dropIds.has(l.shipmentId)), ...added].map(cleanLine),
    shipmentContainers: [...(d.shipmentContainers ?? []).filter((c) => !dropIds.has(c.shipmentId)), ...movedContainers, ...newContainers],
    orderLinks,
    notices,
    duplicateFileNames,
  };
}

/** Mục của chuyến giữ "dùng chung" trỏ về chính một mục của chuyến giữ (sau gộp) ⇒ bỏ dùng chung. */
function pointsToKeepItself(i: ExportStepItem, keepId: string, before: readonly ExportStepItem[], removed: ReadonlyMap<string, string>): boolean {
  let src = i.sharedFromId;
  while (removed.has(src)) src = removed.get(src)!;
  const target = before.find((x) => x.id === src);
  return !!target && (target.shipmentId === keepId || target.id === i.id);
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
