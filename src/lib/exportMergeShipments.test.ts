// Oracle: docs/app-map/74-merge-shipments-one-export.ba-spec.md — một lần xuất của nhiều HĐ = một chuyến.
// Số liệu theo DB thật 2026-11-06: DAIREI, chuyến 06/11 BD-007/26 (4.000 kg) + BD-008/26 (3.000 kg), booking SGNGCZ486800.
import { describe, expect, it } from "vitest";
import type {
  ExportActivity,
  ExportContract,
  ExportContractLine,
  ExportContractRevision,
  ExportContractTerms,
  ExportFile,
  ExportShipment,
  ExportStepItem,
  ExportTransportInfo,
  ProductionOrder,
  ProductionOrderShipment,
} from "@/types";
import { EMPTY_EXPORT_DATA, contractCoverage, searchShipments, shipmentContractIds, subStepState, productionOrderMissingContracts, type ExportData } from "./exportPlanning";
import { issuedOrderContracts, issuedShipmentIds } from "./productionOrder";
import {
  SEPARATE_SHIPMENT,
  applyScheduleRows,
  defaultKeeper,
  duplicateShipmentGroups,
  jointShipmentsFor,
  joinShipment,
  keepSeparateOffTag,
  keepSeparateTag,
  fieldDifferences,
  isOriginalRecord,
  mergeConflicts,
  mergedIntoId,
  splitContract,
  splitGate,
  withFieldValue,
  mergedInto,
  mergedTag,
  mergeGate,
  mergeShipments,
  plannedKgByContract,
  sameExportShipments,
  visibleActivitySummary,
} from "./exportMergeShipments";

const T0 = "2026-11-05T00:00:00.000Z";
const carton = (id: string, quantity: number): ExportContractLine => ({
  id, description: `FROZEN OCTOPUS ${id}`, hsCode: "", size: "", packing: "10kg/ctn", unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton: 10, quantity, kg: null, unitPrice: 9, microSpec: "",
});
const terms: ExportContractTerms = {
  incoterm: "CFR", portOfLoading: "", portOfDischarge: "Tokyo", paymentMethod: "ttr", depositPct: null, lcNo: "", lcExpiry: "", lcLatestShipment: "", currency: "USD", tolerancePct: 10, latestShipmentDate: "2027-09-30", containerCount: null, containerType: "", requiredDocuments: [],
};
const contract = (id: string, no: string, customerId = "dairei"): ExportContract => ({ id, customerId, contractNo: no, signedOn: "2026-08-07", orderRef: "", status: "open", cancelReason: "", closeReason: "", note: "", createdAt: T0 });
const revision = (contractId: string, lines: ExportContractLine[]): ExportContractRevision => ({ id: `r-${contractId}`, contractId, revisionNo: 0, revisedOn: "2026-08-07", changeSummary: "", terms, lines, filePath: "", fileName: "", recordedBy: "KH", createdAt: T0 });
const ship = (id: string, contractId: string, over: Partial<ExportShipment> = {}): ExportShipment => ({
  id, contractId, planMonth: "2026-11", kind: "consolidated", goodsSummary: "", plannedKg: null, lotCode: "", portOfDischarge: "Tokyo", bookingNo: "", loadingDate: "2026-11-06", etd: "", eta: "", vesselVoyage: "", containerNo: "", sealNo: "", status: "open", cancelReason: "", note: "", createdAt: T0, ...over,
});
const file = (id: string, contractId: string, shipmentId: string, step: ExportFile["step"], fileName: string, over: Partial<ExportFile> = {}): ExportFile => ({
  id, contractId, shipmentId, stepItemId: "", step, attachmentKind: "", path: "p", fileName, layerNo: null, caption: "", uploadedBy: "KH", createdAt: T0, ...over,
});
const signed = (contractId: string): ExportFile => file(`hd-${contractId}`, contractId, "", "contract", "hd.pdf", { attachmentKind: "signed-contract" });
const item = (id: string, shipmentId: string, docKind: ExportStepItem["docKind"], over: Partial<ExportStepItem> = {}): ExportStepItem => ({
  id, shipmentId, step: "document", docKind, docForm: "", docIssuer: "BSF1", state: "not-started", number: "", issuedOn: "", note: "", naReason: "", sharedFromId: "", cartons: null, netKg: null, amount: null, onBoardDate: "", createdAt: T0, ...over,
} as ExportStepItem);
const booking = (forwarder: string) => ({ forwarder, placeOfReceipt: "Cái Mép", portOfLoading: "Cái Mép", placeOfDelivery: "Tokyo, Japan", returnYard: "TCTT", emptyPickupYard: "ICD TAY NAM", docCutoff: "2026-11-06T10:00", vgmCutoff: "", cargoCutoff: "" });
const transport: ExportTransportInfo = { haulier: "MINH AN", driverName: "Nguyễn Xuân Huy", driverPhone: "0933976373", driverIdNo: "", truckPlate: "50E47960", emptyPickupPlace: "ICD TAY NAM", stuffingPlace: "F34", returnYard: "TCTT" };

// Chuyến 06/11 thật: A của BD-007 (1 file booking), B của BD-008 (3 file, có xe).
const A = ship("A", "c7", { kind: "20RF", plannedKg: 4000, bookingNo: "SGNGCZ486800", vesselVoyage: "NYK FUTAGO 0109E(JTI)", booking: booking("Phương Anh Phạm"), createdAt: "2026-11-05T08:35:00Z" });
const B = ship("B", "c8", { kind: "20RF", plannedKg: 3000, bookingNo: "sgngcz 486800", vesselVoyage: "NYK FUTAGO 0109E(JTI)", booking: booking("NYD LINE COMPANY LIMITED"), transport, createdAt: "2026-11-05T08:53:00Z" });
const docs = (s: string) => [item(`${s}-ci`, s, "commercial-invoice"), item(`${s}-pl`, s, "packing-list"), item(`${s}-hc`, s, "health-certificate")];
const base = (over: Partial<ExportData> = {}): ExportData => ({
  ...EMPTY_EXPORT_DATA,
  contracts: [contract("c7", "BD-007/26"), contract("c8", "BD-008/26"), contract("c9", "BD-009/26"), contract("c10", "BD-010/26"), contract("x", "X-1", "khac")],
  revisions: [revision("c7", [carton("l7", 5000)]), revision("c8", [carton("l8", 6000)]), revision("c9", [carton("l9", 2000)]), revision("c10", [carton("l10", 2000)]), revision("x", [carton("lx", 100)])],
  files: [
    signed("c7"), signed("c8"), signed("c9"), signed("c10"), signed("x"),
    file("fA1", "c7", "A", "booking", "PAP - 1X20RF - TOKYO - SGNGCZ486800.pdf"),
    file("fB1", "c8", "B", "booking", "PAP - 1X20RF - TOKYO - SGNGCZ486800.pdf"),
    file("fB2", "c8", "B", "container-seal-photos", "cont.jpg"),
    file("fB3", "c8", "B", "container-seal-photos", "seal.jpg"),
  ],
  shipments: [A, B],
  items: [...docs("A"), ...docs("B")],
  ...over,
});
let n = 0;
const newId = () => `n${++n}`;
const NOW = "2026-11-06T09:00:00.000Z";

describe("GC1 — dò chuyến cùng một lần xuất", () => {
  it("AC-1: cặp 06/11 cùng booking (khác hoa thường, khoảng trắng) ⇒ một nhóm 2 chuyến, lý do booking", () => {
    const g = duplicateShipmentGroups(base());
    expect(g).toHaveLength(1);
    expect(g[0].shipmentIds.sort()).toEqual(["A", "B"]);
    expect(g[0].reason).toBe("booking");
  });

  it("AC-2: cùng ngày khác booking · cùng booking khác khách · một chuyến hủy ⇒ không nhóm nào", () => {
    expect(duplicateShipmentGroups(base({ shipments: [A, { ...B, bookingNo: "KHAC123" }] }))).toHaveLength(0);
    expect(duplicateShipmentGroups(base({ shipments: [A, ship("X", "x", { bookingNo: "SGNGCZ486800" })] }))).toHaveLength(0);
    expect(duplicateShipmentGroups(base({ shipments: [A, { ...B, status: "cancelled" }] }))).toHaveLength(0);
  });

  it("AC-3: 27/03/2027 bốn chuyến Đóng ghép chưa booking (BD-007/008/009/010) ⇒ một nhóm 4, lý do ngày đóng", () => {
    const day = "2027-03-27";
    const d = base({ shipments: ["c7", "c8", "c9", "c10"].map((c) => ship(`m-${c}`, c, { loadingDate: day })) });
    const g = duplicateShipmentGroups(d);
    expect(g).toHaveLength(1);
    expect(g[0].shipmentIds).toHaveLength(4);
    expect(g[0].reason).toBe("loading-date");
    expect(g[0].value).toBe(day);
  });

  it("AC-4: Giữ riêng tắt dấu cho đúng tập đó; thêm chuyến C cùng booking ⇒ báo lại nhóm 3; gỡ Giữ riêng ⇒ báo lại", () => {
    const act = (summary: string, at: string): ExportActivity => ({ id: at, contractId: "c7", shipmentId: "A", action: "update", summary, actor: "KH", createdAt: at });
    const kept = base({ activities: [act(`Giữ riêng 2 chuyến ${keepSeparateTag(["B", "A"])}`, "2026-11-06T01:00:00Z")] });
    expect(duplicateShipmentGroups(kept)).toHaveLength(0);
    const withC = { ...kept, shipments: [...kept.shipments, ship("C", "c9", { bookingNo: "SGNGCZ486800" })] };
    expect(duplicateShipmentGroups(withC)).toHaveLength(1);
    expect(duplicateShipmentGroups(withC)[0].shipmentIds).toHaveLength(3);
    const off = { ...kept, activities: [...kept.activities, act(`Bỏ giữ riêng ${keepSeparateOffTag(["A", "B"])}`, "2026-11-06T02:00:00Z")] };
    expect(duplicateShipmentGroups(off)).toHaveLength(1);
    expect(visibleActivitySummary(kept.activities[0].summary)).toBe("Giữ riêng 2 chuyến");
  });

  it("AC-14: ghi booking trùng chuyến khác cùng khách ⇒ trả về chuyến đó (không chặn lưu)", () => {
    expect(sameExportShipments(base(), B).map((s) => s.id)).toEqual(["A"]);
    expect(sameExportShipments(base(), { ...B, bookingNo: "KHAC" })).toEqual([]);
  });
});

describe("GC2 — gộp thành một lần xuất", () => {
  it("AC-5: gộp cặp 06/11 ⇒ HĐ chính BD-008, 1 chuyến chung 7.000 kg, 2 HĐ, 4 file, khối xe của B; bản ghi chuyến A còn nguyên (Đã gộp)", () => {
    const d = base();
    const keep = defaultKeeper(d, [A, B])!;
    expect(keep.id).toBe("B");
    expect(mergeGate(d, B, A)).toEqual({ ok: true });
    const conflicts = mergeConflicts(B, [A]);
    expect(conflicts.map((c) => c.key)).toEqual(["forwarder"]);
    const out = mergeShipments(d, B, [A], { newId, now: NOW, keepLabel: "HĐ BD-008/26" });
    const after = { ...d, ...out };
    expect(after.shipments.filter((s) => s.status === "open" && s.loadingDate === "2026-11-06")).toHaveLength(1);
    const m = after.shipments.find((s) => s.id === "B")!;
    // Không mất: bản ghi chuyến A giữ nguyên booking / forwarder / kg, trạng thái Đã gộp vào B.
    const a = after.shipments.find((s) => s.id === "A")!;
    expect(a.status).toBe("cancelled");
    expect(mergedIntoId(a)).toBe("B");
    expect(a.booking?.forwarder).toBe("Phương Anh Phạm");
    expect(a.plannedKg).toBe(4000);
    expect(visibleActivitySummary(a.cancelReason)).toBe("Đã gộp vào lần xuất HĐ BD-008/26");
    // Có ô khác nhau ⇒ thêm bản ghi gốc của chuyến B (forwarder NYD) — đổi sang giá trị của A thì NYD vẫn còn.
    const snap = after.shipments.filter((s) => isOriginalRecord(s));
    expect(snap).toHaveLength(1);
    expect(snap[0].booking?.forwarder).toBe("NYD LINE COMPANY LIMITED");
    expect(after.shipments.filter((s) => s.status === "open")).toHaveLength(1);
    expect(m.id).toBe("B");
    expect(m.plannedKg).toBe(7000);
    expect(shipmentContractIds(after, m)).toEqual(["c8", "c7"]);
    expect(after.files.filter((f) => f.shipmentId === "B")).toHaveLength(4);
    expect(m.booking?.forwarder).toBe("NYD LINE COMPANY LIMITED");
    expect(m.transport?.driverName).toBe("Nguyễn Xuân Huy");
    expect(out.duplicateFileNames).toBe(2);
    // Mục trống của A nằm lại bản ghi A (không xóa mục nào).
    expect(after.items).toHaveLength(d.items.length);
    expect(after.items.filter((i) => i.shipmentId === "B")).toHaveLength(3);
    // Ô ghi khác nhau: cả hai giá trị còn, giá trị đang dùng là của HĐ chính.
    const diff = fieldDifferences(after, m);
    expect(diff.map((x) => x.key)).toEqual(["forwarder"]);
    expect(diff[0].values.map((v) => [v.contractId, v.value, v.inUse])).toEqual([["c8", "NYD LINE COMPANY LIMITED", true], ["c7", "Phương Anh Phạm", false]]);
  });

  it("AC-5b: ô trống của chuyến chung lấy bù; dùng lại giá trị của HĐ kia khi cần (giá trị cũ vẫn còn ở bản ghi)", () => {
    const d = base({ shipments: [A, { ...B, vesselVoyage: "" }] });
    const out = mergeShipments(d, d.shipments[1], [A], { newId, now: NOW });
    const m = out.shipments.find((s) => s.id === "B")!;
    expect(m.vesselVoyage).toBe("NYK FUTAGO 0109E(JTI)");
    const switched = withFieldValue(m, out.shipments.find((s) => s.id === "A")!, "forwarder");
    expect(switched.booking?.forwarder).toBe("Phương Anh Phạm");
    const after = { ...d, ...out, shipments: out.shipments.map((s) => (s.id === "B" ? switched : s)) };
    // Giá trị đang dùng ghi theo HĐ đã nhập nó (BD-007); giá trị cũ của HĐ chính còn ở bản ghi gốc.
    expect(fieldDifferences(after, switched)[0].values.map((v) => [v.value, v.contractId, v.inUse, !!v.original])).toEqual([["Phương Anh Phạm", "c7", true, false], ["NYD LINE COMPANY LIMITED", "c8", false, true]]);
  });

  it("AC-6: kg kế hoạch từng HĐ không đổi sau gộp (10 kg / kiện ⇒ BD-007 400 kiện)", () => {
    const d = base();
    const before = { c7: contractCoverage(d, "c7").plannedKg, c8: contractCoverage(d, "c8").plannedKg };
    const out = mergeShipments(d, B, [A], { newId, now: NOW });
    const after = { ...d, ...out };
    expect(contractCoverage(after, "c7").plannedKg).toBe(before.c7);
    expect(contractCoverage(after, "c8").plannedKg).toBe(before.c8);
    expect(out.shipmentLines.find((l) => l.contractId === "c7")?.plannedUnits).toBe(400);
    expect(plannedKgByContract(after, after.shipments.find((s) => s.id === "B")!)).toEqual([{ contractId: "c8", kg: 3000 }, { contractId: "c7", kg: 4000 }]);
  });

  it("AC-7: chặn nêu đích danh — cùng mục đã làm ở hai chuyến · đã gửi chứng từ · HĐ thiếu hồ sơ · khác khách", () => {
    const bothCi = base({ items: [item("A-ci", "A", "commercial-invoice", { state: "done", number: "INV-1" }), item("B-ci", "B", "commercial-invoice", { number: "INV-2" })] });
    expect(mergeGate(bothCi, B, A)).toEqual({ ok: false, reason: "both-progress", detail: "document:commercial-invoice" });
    const sent = base({ payments: [{ id: "p", contractId: "c7", shipmentId: "A", kind: "documents-sent", date: "2026-11-06", amount: null, currency: "USD", method: "", note: "", createdAt: T0 } as ExportData["payments"][number]] });
    expect(mergeGate(sent, B, A)).toMatchObject({ ok: false, reason: "sent-or-paid" });
    const missing = base({ files: base().files.filter((f) => f.id !== "hd-c7") });
    expect(mergeGate(missing, B, A)).toEqual({ ok: false, reason: "contract-blocked", detail: "c7" });
    const other = base({ shipments: [B, ship("X", "x", { bookingNo: "SGNGCZ486800" })] });
    expect(mergeGate(other, B, other.shipments[1])).toMatchObject({ ok: false, reason: "customer-mismatch" });
  });

  it("AC-8: chuyến kế hoạch (chưa file, chưa mục Xong) gộp được dù HĐ còn hồ sơ Thiếu", () => {
    const g7 = ship("g7", "c7", { plannedKg: 7000, loadingDate: "2026-11-28" });
    const g8 = ship("g8", "c8", { plannedKg: 6400, loadingDate: "2026-11-28" });
    const d = base({ shipments: [g7, g8], items: [], files: [signed("c8")] });
    expect(mergeGate(d, g8, g7)).toEqual({ ok: true });
  });

  it("AC-9: mục có tiến độ, mục dùng chung, lệnh sản xuất đi theo chuyến giữ", () => {
    const C = ship("C", "c9", { bookingNo: "ZZZ", loadingDate: "2026-12-01" });
    const d = base({
      shipments: [A, B, C],
      items: [...docs("A").map((i) => (i.docKind === "health-certificate" ? { ...i, state: "done" as const, number: "HC-1" } : i)), ...docs("B"), item("C-pl", "C", "packing-list", { sharedFromId: "A-pl" })],
    });
    const links: ProductionOrderShipment[] = [
      { id: "k1", orderId: "L1", shipmentId: "A", createdAt: T0 },
      { id: "k2", orderId: "L1", shipmentId: "B", createdAt: T0 },
    ];
    const out = mergeShipments(d, B, [A], { orderLinks: links, newId, now: NOW });
    const hc = out.items.filter((i) => i.shipmentId === "B" && i.docKind === "health-certificate");
    expect(hc).toHaveLength(1);
    expect(hc[0].state).toBe("done");
    expect(out.items.find((i) => i.id === "C-pl")?.sharedFromId).toBe("B-pl");
    expect(out.orderLinks.filter((l) => l.orderId === "L1" && l.shipmentId === "B")).toHaveLength(1);
    expect(out.files.filter((f) => f.shipmentId === "A").length + out.orderLinks.filter((l) => l.shipmentId === "A").length).toBe(0);
    // Mục trống của A còn ở bản ghi A; HC trống của B đổi chỗ sang bản ghi A; không mục nào bị xóa.
    expect(out.items.filter((i) => i.shipmentId === "A").map((i) => i.id).sort()).toEqual(["A-ci", "A-pl", "B-hc"]);
    expect(out.items).toHaveLength(d.items.length);
  });

  it("AC-10: loại chuyến — giữ Đóng ghép bỏ 20RF ⇒ 20RF; mọi chuyến Đóng ghép ⇒ vẫn Đóng ghép", () => {
    const g = ship("g", "c8", { loadingDate: "2026-11-06" });
    const r = ship("r", "c7", { kind: "20RF", loadingDate: "2026-11-06" });
    const d = base({ shipments: [g, r], items: [], files: [] });
    expect(mergeShipments(d, g, [r], { newId, now: NOW }).shipments[0].kind).toBe("20RF");
    const g2 = ship("g2", "c7", { loadingDate: "2026-11-06" });
    expect(mergeShipments({ ...d, shipments: [g, g2] }, g, [g2], { newId, now: NOW }).shipments[0].kind).toBe("consolidated");
  });

  it("AC-11: gộp cả nhóm 4 chuyến 27/03/2027 một lần ⇒ 1 chuyến 4 HĐ 15.300 kg; bản trước giữ nguyên (Hoàn tác = ghi lại bản trước)", () => {
    const kg = { c7: 4300, c8: 5000, c9: 2000, c10: 4000 };
    const list = Object.entries(kg).map(([c, k]) => ship(`m-${c}`, c, { loadingDate: "2027-03-27", plannedKg: k }));
    const d = base({ shipments: list, items: [], files: [signed("c7"), signed("c8"), signed("c9"), signed("c10")] });
    const snapshot = JSON.stringify({ s: d.shipments, l: d.shipmentLines ?? [] });
    const keep = defaultKeeper(d, list)!;
    const drops = list.filter((s) => s.id !== keep.id);
    expect(drops.every((s) => mergeGate(d, keep, s).ok)).toBe(true);
    const out = mergeShipments(d, keep, drops, { newId, now: NOW });
    const open = out.shipments.filter((s) => s.status === "open");
    expect(open).toHaveLength(1);
    expect(out.shipments).toHaveLength(4);
    expect(shipmentContractIds({ ...d, ...out }, open[0])).toHaveLength(4);
    expect(open[0].plannedKg).toBe(15300);
    expect(JSON.stringify({ s: d.shipments, l: d.shipmentLines ?? [] })).toBe(snapshot);
  });

  it("gộp mỗi chuyến một cont ⇒ chuyến bỏ thành cont thêm, ảnh seal gắn cont đó, hàng gán cont đó", () => {
    const d = base({ shipments: [A, { ...B, containerNo: "TGHU1234567" }], items: [] });
    const out = mergeShipments(d, A, [d.shipments[1]], { mode: "separate-containers", newId, now: NOW });
    expect(out.shipmentContainers).toHaveLength(1);
    const cont = out.shipmentContainers[0];
    expect(cont.containerNo).toBe("TGHU1234567");
    expect(out.files.filter((f) => f.step === "container-seal-photos").every((f) => f.containerId === cont.id)).toBe(true);
    expect(out.shipmentLines.filter((l) => l.contractId === "c8").every((l) => l.containerId === cont.id)).toBe(true);
    expect(out.shipments.find((s) => s.id === "A")!.containerNo).toBe("");
  });

  it("AC-17: mở chuyến đã gộp ⇒ ra chuyến chung (theo chuỗi); chuyến thường / đã Hoàn tác ⇒ null", () => {
    const d = base();
    const after = { ...d, ...mergeShipments(d, B, [A], { newId, now: NOW }) };
    expect(mergedInto(after, "A")).toEqual({ shipmentId: "B" });
    expect(mergedInto(d, "A")).toBeNull();
    expect(mergedTag(["A"], "B")).toBe("⟦merged:A>B⟧");
  });

  it("AC-20: tách BD-007 khỏi lần xuất 06/11 ⇒ mở lại đúng bản ghi A (booking, forwarder như lúc nhập), hàng + file của BD-007 về A", () => {
    const d = base({ files: [...base().files, file("fNew", "c8", "B", "loading-photos", "dong-cont.jpg")] });
    const links: ProductionOrderShipment[] = [{ id: "k7", orderId: "L7", shipmentId: "A", createdAt: T0 }, { id: "k8", orderId: "L8", shipmentId: "B", createdAt: T0 }];
    const m = mergeShipments(d, B, [A], { orderLinks: links, newId, now: NOW });
    const after = { ...d, ...m };
    const keep = after.shipments.find((s) => s.id === "B")!;
    expect(splitGate(after, keep, "c8")).toEqual({ ok: false, reason: "main-contract" });
    expect(splitGate(after, keep, "c7")).toEqual({ ok: true });
    const out = splitContract(after, keep, "c7", { orderLinks: m.orderLinks, orderContractOf: (id) => (id === "L7" ? "c7" : "c8"), newId, now: NOW });
    expect(out.reopened).toBe(true);
    const a = out.shipments.find((s) => s.id === "A")!;
    expect(a.status).toBe("open");
    expect(a.booking?.forwarder).toBe("Phương Anh Phạm");
    expect(a.plannedKg).toBe(4000);
    expect(out.shipments.find((s) => s.id === "B")!.plannedKg).toBe(3000);
    expect(out.shipmentLines.filter((l) => l.contractId === "c7").every((l) => l.shipmentId === "A")).toBe(true);
    expect(out.files.filter((f) => f.shipmentId === "A").map((f) => f.id)).toEqual(["fA1"]);
    expect(out.files.filter((f) => f.shipmentId === "B")).toHaveLength(4);
    expect(out.orderLinks.find((l) => l.orderId === "L7")?.shipmentId).toBe("A");
    expect(out.orderLinks.find((l) => l.orderId === "L8")?.shipmentId).toBe("B");
  });

  it("AC-21: tách HĐ đi chung từ lịch (không có bản ghi gốc) ⇒ chuyến mới chép booking / ngày, không chép số cont / xe", () => {
    const host = { ...B, containerNo: "TGHU1234567" };
    const d = base({ shipments: [host], items: [] });
    const j = joinShipment(d, host, "c7", { plannedKg: 2000, loadingDate: "2026-11-06" }, newId);
    const after = { ...d, shipments: [j.shipment], shipmentLines: j.shipmentLines };
    const out = splitContract(after, j.shipment, "c7", { newId, now: NOW });
    expect(out.reopened).toBe(false);
    expect(out.child.contractId).toBe("c7");
    expect(out.child.bookingNo).toBe(host.bookingNo);
    expect(out.child.containerNo).toBe("");
    expect(out.child.transport).toBeUndefined();
    expect(out.child.plannedKg).toBe(2000);
    expect(out.shipments.find((s) => s.id === "B")!.plannedKg).toBe(3000);
  });
});

describe("GC3 — lập lịch HĐ mới đi chung chuyến có sẵn", () => {
  const c11 = contract("c11", "BD-011/26");
  const host = ship("h28", "c7", { plannedKg: 7000, loadingDate: "2026-11-28" });
  const d = base({ contracts: [...base().contracts, c11], revisions: [...base().revisions, revision("c11", [carton("l11", 2000)])], shipments: [host], items: [] });

  it("AC-12: dòng lịch đóng 28/11 của BD-011 ⇒ đề xuất chuyến 28/11; đi chung ⇒ không chuyến mới, chuyến có thêm HĐ, kg +2.000", () => {
    const cands = jointShipmentsFor(d, "dairei", "c11", { loadingDate: "2026-11-28" });
    expect(cands.map((s) => s.id)).toEqual(["h28"]);
    const out = joinShipment(d, host, "c11", { plannedKg: 2000, loadingDate: "2026-11-28" }, newId);
    const after = { ...d, shipments: [out.shipment], shipmentLines: out.shipmentLines };
    expect(after.shipments).toHaveLength(1);
    expect(shipmentContractIds(after, out.shipment)).toEqual(["c7", "c11"]);
    expect(out.shipment.plannedKg).toBe(9000);
    expect(contractCoverage(after, "c7").plannedKg).toBe(7000);
  });

  it("AC-12b: ghi lịch 2 dòng — dòng trùng ngày đi chung, dòng chọn Tạo chuyến riêng / không khớp ⇒ chuyến mới", () => {
    const rows = [
      { planMonth: "2026-11", plannedKg: 2000, loadingDate: "2026-11-28" },
      { planMonth: "2026-12", plannedKg: 1000, loadingDate: "2026-12-28" },
      { planMonth: "2026-11", plannedKg: 500, loadingDate: "2026-11-28", joinShipmentId: SEPARATE_SHIPMENT },
    ];
    const out = applyScheduleRows(d, "dairei", "c11", rows, (rs) => rs.map((r, i) => ship(`new${i}`, "c11", { loadingDate: r.loadingDate, plannedKg: r.plannedKg })), newId);
    expect(out.joined.map((s) => s.id)).toEqual(["h28"]);
    expect(out.created).toHaveLength(2);
    expect(out.shipments).toHaveLength(3);
    expect(out.shipments.find((s) => s.id === "h28")?.plannedKg).toBe(9000);
  });

  it("AC-13: không có ngày / khác khách / chuyến đã có HĐ đó ⇒ không đề xuất; tạo chuyến riêng ⇒ dò trùng báo", () => {
    expect(jointShipmentsFor(d, "dairei", "c11", {})).toEqual([]);
    expect(jointShipmentsFor(d, "khac", "c11", { loadingDate: "2026-11-28" })).toEqual([]);
    expect(jointShipmentsFor(d, "dairei", "c7", { loadingDate: "2026-11-28" })).toEqual([]);
    const separate = { ...d, shipments: [host, ship("own", "c11", { loadingDate: "2026-11-28" })] };
    expect(duplicateShipmentGroups(separate)).toHaveLength(1);
  });
});

describe("GC4 — một lần xuất một dòng: tra theo số HĐ phụ", () => {
  it("AC-15: chuyến gộp 06/11 ra khi tra BD-007/26 (HĐ phụ)", () => {
    const d = base();
    const after = { ...d, ...mergeShipments(d, B, [A], { newId, now: NOW }) };
    expect(searchShipments(after, "BD-007/26").map((s) => s.id)).toEqual(["B"]);
    // GC4: lịch xếp chuyến mở — bản ghi đã gộp không thành dòng riêng.
    expect(after.shipments.filter((s) => s.status === "open")).toHaveLength(1);
  });
});

describe("GC5 — bước 2 của chuyến nhiều HĐ xét từng HĐ", () => {
  it("AC-16: chỉ lệnh BD-008 ⇒ Đang làm, thiếu BD-007; thêm lệnh BD-007 ⇒ Xong; chuyến một HĐ một lệnh ⇒ Xong", () => {
    const d0 = base();
    const merged = { ...d0, ...mergeShipments(d0, B, [A], { newId, now: NOW }) };
    const order = (id: string, contractId: string) => ({ id, contractId, status: "issued" } as ProductionOrder);
    const with8 = { orders: [order("L8", "c8")], links: [{ id: "x1", orderId: "L8", shipmentId: "B", createdAt: T0 }] };
    const dd = (o: typeof with8) => ({ ...merged, issuedOrderShipmentIds: issuedShipmentIds(o.orders, o.links), orderContractsByShipment: issuedOrderContracts(o.orders, o.links) });
    expect(subStepState(dd(with8), "B", "production-order")).toBe("in-progress");
    expect(productionOrderMissingContracts(dd(with8), "B")?.ids).toEqual(["c7"]);
    const both = { orders: [...with8.orders, order("L7", "c7")], links: [...with8.links, { id: "x2", orderId: "L7", shipmentId: "B", createdAt: T0 }] };
    expect(subStepState(dd(both), "B", "production-order")).toBe("done");
    const single = { ...d0, shipments: [A], issuedOrderShipmentIds: new Set(["A"]), orderContractsByShipment: new Map([["A", new Set(["c7"])]]) };
    expect(subStepState(single, "A", "production-order")).toBe("done");
  });
});
