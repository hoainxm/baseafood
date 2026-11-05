// ba-spec 73 — một chuyến xuất nhiều cont (HĐ 23.26/BSF-SCM.2026: booking "1X20RF & 1X40RF").
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ExportContract, ExportContractLine, ExportContractRevision, ExportContractTerms, ExportFile, ExportShipment, ExportShipmentContainer, ExportShipmentLine } from "@/types";
import {
  EMPTY_EXPORT_DATA,
  blankItem,
  containerSealState,
  contractActuals,
  contractCoverage,
  mergeShipmentGate,
  mergeShipmentInto,
  shippingProgressText,
  validateExtraContainers,
  type ExportData,
} from "./exportPlanning";
import { containerCountOf, containerQuantityText, linesByContainer, removeContainerGate, shipmentContainerSummary, shipmentContainers } from "./exportContainers";
import { buildInvoiceDocument, shipmentLineFromContract } from "./exportInvoice";
import { buildExportOrderLines, exportOrderSourceValues } from "./documentTypes/exportOrderForm";
import { initialSi, siContainerRows, siLinked } from "./shippingInstruction";
import { shippingInstructionBytes } from "./shippingInstructionExcel";
import { bookingContainerKinds, parseBookingRows } from "./bookingReader";
import { buildExportReport, parseReportPeriod } from "./exportReports";

const T0 = "2026-11-05T00:00:00.000Z";

const cline = (id: string, description: string, quantity: number, unitPrice = 10): ExportContractLine => ({
  id,
  description,
  hsCode: "0307.52",
  size: "",
  packing: "10kg/ctn",
  unitKind: "carton",
  cartonsPerUnit: 1,
  netKgPerCarton: 10,
  quantity,
  kg: null,
  unitPrice,
  microSpec: "",
});
const terms = (over: Partial<ExportContractTerms> = {}): ExportContractTerms => ({
  incoterm: "CFR",
  portOfLoading: "Cát Lái",
  portOfDischarge: "Tokyo",
  paymentMethod: "ttr",
  depositPct: null,
  lcNo: "",
  lcExpiry: "",
  lcLatestShipment: "",
  currency: "USD",
  tolerancePct: 10,
  latestShipmentDate: "2026-11-10",
  containerCount: 2,
  containerType: "40HC-RF + 20RF",
  requiredDocuments: [],
  ...over,
});
const contract = (id: string, customerId = "seachemot"): ExportContract => ({
  id,
  customerId,
  contractNo: id.toUpperCase(),
  signedOn: "2026-10-10",
  orderRef: "",
  status: "open",
  cancelReason: "",
  closeReason: "",
  note: "",
  createdAt: T0,
});
const revision = (contractId: string, lines: ExportContractLine[], over: Partial<ExportContractTerms> = {}): ExportContractRevision => ({
  id: `r-${contractId}`,
  contractId,
  revisionNo: 0,
  revisedOn: "2026-10-10",
  changeSummary: "",
  terms: terms(over),
  lines,
  filePath: "",
  fileName: "",
  recordedBy: "KH",
  createdAt: T0,
});
const ship = (id: string, over: Partial<ExportShipment> = {}): ExportShipment => ({
  id,
  contractId: "c1",
  planMonth: "2026-11",
  kind: "40HC-RF",
  goodsSummary: "",
  plannedKg: null,
  lotCode: "",
  portOfDischarge: "Tokyo",
  bookingNo: "039GY21068",
  loadingDate: "2026-11-07",
  etd: "2026-11-09",
  eta: "",
  vesselVoyage: "WAN HAI 325 N063",
  containerNo: "SZLU2030326",
  sealNo: "VN48840AW",
  status: "open",
  cancelReason: "",
  note: "",
  createdAt: T0,
  ...over,
});
const cont = (id: string, shipmentId: string, over: Partial<ExportShipmentContainer> = {}): ExportShipmentContainer => ({
  id,
  shipmentId,
  sortOrder: 1,
  kind: "20RF",
  containerNo: "TGHU1234567",
  sealNo: "VN48841AW",
  loadingDate: "",
  note: "",
  createdAt: T0,
  ...over,
});
const L1 = cline("l1", "FROZEN IWADAKO BOILED CUT", 1200);
const L2 = cline("l2", "FROZEN TAKO KARAGE", 800);
const sline = (id: string, s: ExportShipment, cl: ExportContractLine, units: number, containerId?: string, contractId = "c1"): ExportShipmentLine => ({
  ...shipmentLineFromContract(cl, { id, shipmentId: s.id, contractId, sortOrder: 0, plannedUnits: units }),
  loadedUnits: units,
  grossKgPerUnit: 10.8,
  ...(containerId !== undefined ? { containerId } : {}),
});
const photo = (shipmentId: string, containerId?: string): ExportFile => ({
  id: `p-${shipmentId}-${containerId ?? "1"}`,
  contractId: "c1",
  shipmentId,
  stepItemId: "",
  step: "container-seal-photos",
  path: "p",
  fileName: "seal.jpg",
  layerNo: null,
  caption: "",
  uploadedBy: "kho",
  createdAt: T0,
  ...(containerId ? { containerId } : {}),
});
const base = (over: Partial<ExportData> = {}): ExportData => ({ ...EMPTY_EXPORT_DATA, contracts: [contract("c1")], revisions: [revision("c1", [L1, L2])], ...over });

/** Chuyến 23.26: 40HC-RF (cont 1) + 20RF (cont thêm k2); dòng L1 1.200 thùng ở cont 2, L2 800 thùng ở cont 1. */
function twoContainers() {
  const s = ship("s1");
  const k2 = cont("k2", "s1");
  const lines = [sline("x1", s, L1, 1200, "k2"), sline("x2", s, L2, 800, "")];
  return { s, k2, lines, d: base({ shipments: [s], shipmentContainers: [k2], shipmentLines: lines }) };
}

const invoiceInput = (d: ExportData, s: ExportShipment) => ({
  invoiceNo: "275.26",
  issuedOn: "2026-11-05",
  customer: { name: "SEACHEMOT CO., LTD", address: "Tokyo" },
  shipment: s,
  blNo: "",
  portOfLoading: "Cát Lái",
  portOfDischarge: "Tokyo",
  currency: "USD",
  tradeTerms: "",
  originNote: "",
  lines: (d.shipmentLines ?? []).filter((l) => l.shipmentId === s.id),
  unitPrice: () => 10,
  bankLines: [],
  specialNotes: "",
  containers: shipmentContainers(d, s),
});
const cellsText = (rows: { cells: unknown[] }[]) => rows.flatMap((r) => r.cells).filter((c) => typeof c === "string").join(" | ");

describe("ba-spec 73 — chuyến nhiều cont", () => {
  it("AC-1: chuyến cũ không cont thêm ⇒ 1 cont từ chuyến, invoice như cũ", () => {
    const s = ship("s1", { kind: "40RF" });
    const lines = [sline("x1", s, L1, 1200), sline("x2", s, L2, 800)];
    const d = base({ shipments: [s], shipmentLines: lines });
    const conts = shipmentContainers(d, s);
    expect(conts).toHaveLength(1);
    expect(conts[0]).toMatchObject({ id: "", no: 1, containerNo: "SZLU2030326" });
    const withConts = buildInvoiceDocument(invoiceInput(d, s));
    const { containers: _c, ...plain } = invoiceInput(d, s);
    void _c;
    expect(withConts.sheets).toEqual(buildInvoiceDocument(plain).sheets);
    expect(withConts.containerTotals).toEqual([]);
  });

  it("AC-2: HĐ 2 cont, thêm cont 20RF ⇒ hết thiếu cont; thẻ ghi hai loại", () => {
    const s = ship("s1");
    const before = base({ shipments: [s] });
    expect(contractCoverage(before, "c1").missingContainers).toBe(1);
    const after = base({ shipments: [s], shipmentContainers: [cont("k2", "s1")] });
    expect(contractCoverage(after, "c1").missingContainers).toBe(0);
    expect(shipmentContainerSummary(after, s)).toBe("40HC-RF + 20RF");
    expect(containerCountOf(after, ship("t", { kind: "truck" }))).toBe(0);
  });

  it("AC-3: dòng gán cont; trống = cont 1; Σ = cả chuyến", () => {
    const { s, d, lines } = twoContainers();
    const groups = linesByContainer(shipmentContainers(d, s), lines);
    const units = (i: number) => groups[i].lines.reduce((t, l) => t + (l.loadedUnits ?? 0), 0);
    expect(units(0)).toBe(800);
    expect(units(1)).toBe(1200);
    expect(units(0) + units(1)).toBe(2000);
    // Dòng trỏ cont đã xóa ⇒ về cont 1.
    const orphan = linesByContainer(shipmentContainers(d, s), [{ containerId: "gone" }]);
    expect(orphan[0].lines).toHaveLength(1);
  });

  it("AC-4: xóa cont còn dòng ⇒ chặn, kể dòng", () => {
    const { d, k2 } = twoContainers();
    const gate = removeContainerGate(d, k2);
    expect(gate.ok).toBe(false);
    expect(gate.blockingLines).toHaveLength(1);
    expect(removeContainerGate({ shipmentLines: [] }, k2).ok).toBe(true);
  });

  it("AC-5: số cont trùng / sai ⇒ 2 lỗi", () => {
    const issues = validateExtraContainers({ containerNo: "SZLU2030326" }, [cont("a", "s1", { containerNo: "szlu 203 0326" }), cont("b", "s1", { containerNo: "ABC123" })]);
    expect(issues.filter((i) => i.key.startsWith("container"))).toHaveLength(2);
    expect(validateExtraContainers({ containerNo: "SZLU2030326" }, [cont("a", "s1", { containerNo: "" })])).toHaveLength(0);
  });

  it("AC-6: Số cont + seal Xong khi MỌI cont đủ số + seal + ảnh", () => {
    const { s, d } = twoContainers();
    const on = { ...d, shippingInstructionEnabled: true };
    expect(containerSealState({ ...on, files: [photo("s1")] }, s)).toBe("in-progress");
    expect(containerSealState({ ...on, files: [photo("s1"), photo("s1", "k2")] }, s)).toBe("done");
    // Cont 2 chưa có seal ⇒ chưa xong dù đủ ảnh.
    expect(containerSealState({ ...on, shipmentContainers: [cont("k2", "s1", { sealNo: "" })], files: [photo("s1"), photo("s1", "k2")] }, s)).toBe("in-progress");
  });

  it("AC-7: Lệnh xuất ghi đủ cont", () => {
    expect(containerQuantityText(["40HC-RF", "20RF"])).toBe("1 x 40HC-RF + 1 x 20RF");
    expect(containerQuantityText(["40RF", "40RF"])).toBe("2 x 40RF");
    const { s, d, lines } = twoContainers();
    const conts = shipmentContainers(d, s);
    const values = exportOrderSourceValues({ shipment: s, contractNo: "C1", customerName: "", rows: [], containerKinds: conts.map((c) => c.kind) });
    expect(values.containers).toBe("1 x 40HC-RF + 1 x 20RF");
    expect(exportOrderSourceValues({ shipment: s, contractNo: "C1", customerName: "", rows: [] }).containers).toBe("1 x 40HC-RF");
    // Bảng hàng theo cont: cont 1 trước, mỗi dòng mang nhãn cont.
    const { rows } = buildExportOrderLines({ shipment: s, orders: [], orderLines: [], contractLines: [L1, L2], shipmentLines: lines, containers: conts });
    expect(rows.map((r) => [r.container, r.cartons])).toEqual([
      ["Cont 1 · 40HC-RF", 800],
      ["Cont 2 · 20RF", 1200],
    ]);
  });

  it("AC-8 + AC-9: invoice kê mọi cont, PL nhóm theo cont, tổng cả chuyến", () => {
    const { s, d } = twoContainers();
    const doc = buildInvoiceDocument(invoiceInput(d, s));
    expect(doc.totals.netKg).toBe(20000);
    const inv = cellsText(doc.sheets[0].rows);
    expect(inv.includes("SZLU2030326") && inv.includes("TGHU1234567")).toBe(true);
    expect(doc.containerTotals).toHaveLength(2);
    expect(doc.containerTotals[0].netKg + doc.containerTotals[1].netKg).toBe(20000);
    expect(doc.containerTotals.map((t) => t.netKg)).toEqual([8000, 12000]);
    const pl = cellsText(doc.sheets[1].rows);
    expect(pl).toContain("CONTAINER 2: 20RF · TGHU1234567 / VN48841AW");
    expect(pl).toContain("Sub-total container 1");
  });

  it("AC-10: SI một dòng mỗi cont, gross theo cont, ghi đúng ô mẫu", async () => {
    const { s, d, lines } = twoContainers();
    const rows = siContainerRows(shipmentContainers(d, s), lines);
    expect(rows).toHaveLength(2);
    expect(rows[1].grossKg).toBe(12960);
    expect(rows[0].packages).toBe(800);
    const ExcelJS = (await import("exceljs")).default;
    const tpl = fs.readFileSync(path.join(__dirname, "templates/si-form.xlsx"));
    const l = siLinked(s, { nameEn: "BASEAFOOD 1", addressEn: "BA RIA" }, { containers: shipmentContainers(d, s), lines });
    const f = initialSi({ saved: null, previous: null, customer: { name: "SEACHEMOT" }, goods: [], today: "2026-11-05" });
    const bytes = await shippingInstructionBytes(tpl.buffer.slice(tpl.byteOffset, tpl.byteOffset + tpl.byteLength), l, f);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const ws = wb.getWorksheet("SI Form")!;
    expect(ws.getCell("A33").value).toBe("SZLU2030326");
    expect(ws.getCell("A35").value).toBe("TGHU1234567");
    expect(ws.getCell("A36").value).toBe("SEAL: VN48841AW");
    expect(String(ws.getCell("C35").value)).toContain("12960 KGS");
  });

  it("AC-12: gộp chuyến B (20RF) vào A thành cont thêm", () => {
    const a = ship("a", { kind: "40RF" });
    const b = ship("b", { kind: "20RF", containerNo: "", sealNo: "", loadingDate: "2026-11-08" });
    const lines = [sline("la", a, L1, 1200), sline("lb", b, L2, 800)];
    const d = base({ shipments: [a, b], shipmentLines: lines, items: [blankItem("b", "export-order", "ib", T0)] });
    expect(mergeShipmentGate(d, a, b)).toEqual({ ok: true });
    const out = mergeShipmentInto(d, a, b, "k-new", T0);
    expect(out.shipments.map((s) => s.id)).toEqual(["a"]);
    expect(out.items).toHaveLength(0);
    expect(out.shipmentContainers).toHaveLength(1);
    expect(out.shipmentContainers[0]).toMatchObject({ shipmentId: "a", kind: "20RF", loadingDate: "2026-11-08" });
    expect(out.shipmentLines.find((l) => l.id === "lb")).toMatchObject({ shipmentId: "a", containerId: "k-new" });
    const merged = { ...d, ...out };
    expect(shipmentContainers(merged, a)).toHaveLength(2);
    expect(contractCoverage(merged, "c1").missingContainers).toBe(0);
    // Chuyến B đã có file ⇒ chặn; khác booking ⇒ chặn.
    expect(mergeShipmentGate({ ...d, files: [photo("b")] }, a, b)).toEqual({ ok: false, reason: "has-progress" });
    expect(mergeShipmentGate(d, a, { ...b, bookingNo: "OTHER" })).toEqual({ ok: false, reason: "other-booking" });
  });

  it("AC-13: báo cáo tháng đếm cont", () => {
    const s1 = ship("s1");
    const s2 = ship("s2", { kind: "40RF", containerNo: "TCLU1234567" });
    const d = base({ shipments: [s1, s2], shipmentContainers: [cont("k2", "s1")] });
    const report = buildExportReport(d, parseReportPeriod("2026-11", "2026-11-05"), { customers: [], today: "2026-11-05" });
    expect(report.totals.containers).toBe(3);
  });

  it("AC-14: chuyến gộp nhiều HĐ + nhiều cont ⇒ đã giao theo HĐ không đổi", () => {
    const s = ship("s1");
    const LB = cline("lb1", "FROZEN OCTOPUS", 500);
    const lines = [sline("x1", s, L1, 1200, ""), sline("x2", s, LB, 500, "k2", "c2")];
    const d = base({
      contracts: [contract("c1"), contract("c2")],
      revisions: [revision("c1", [L1, L2]), revision("c2", [LB])],
      shipments: [s],
      shipmentContainers: [cont("k2", "s1")],
      shipmentLines: lines,
    });
    expect(contractActuals(d, "c1").kg).toBe(12000);
    expect(contractActuals(d, "c2").kg).toBe(5000);
  });

  it("AC-15: đọc booking nhiều loại cont", () => {
    expect(bookingContainerKinds("1X20RF & 1X40RF")).toEqual(["40RF", "20RF"]);
    expect(bookingContainerKinds("2 x 40RF + 1 x 20RF")).toEqual(["40RF", "40RF", "20RF"]);
    expect(bookingContainerKinds("20'REEFER-1")).toEqual(["20RF"]);
    const { read } = parseBookingRows([["Equipment Type/Qty:", "1X20RF & 1X40RF"]]);
    expect(read.kind).toBe("40RF");
    expect(read.extraKinds).toEqual(["20RF"]);
  });

  it("dòng tiến độ chặng Giao hàng (HĐ 68/2025): thiếu ⇒ Còn … chưa ghi chuyến; đủ ⇒ Đã ghi đủ chuyến · k/n chuyến xong", () => {
    const signed: ExportFile = { ...photo("", undefined), id: "hd", shipmentId: "", step: "contract", attachmentKind: "signed-contract" };
    const s = ship("s1");
    const lines = [sline("x1", s, L1, 1200), sline("x2", s, L2, 800)];
    const one = base({ shipments: [{ ...s, plannedKg: 20000 }], shipmentLines: lines, files: [signed] });
    expect(shippingProgressText(one, "c1")).toBe("Còn 1 cont chưa ghi chuyến");
    const both = { ...one, shipmentContainers: [cont("k2", "s1")] };
    expect(shippingProgressText(both, "c1")).toBe("Đã ghi đủ chuyến · 0/1 chuyến xong");
  });
});

describe("thẻ chưa ghi chuyến ghi rõ lý do (Phòng KH 2026-11-05, HĐ BD-008/26)", () => {
  it("6.000 kiện × 2 × 5 kg, dung sai 10 %, 12 chuyến 49.300 kg ⇒ nói đã ghi / tối thiểu / HĐ", async () => {
    const { coverageText } = await import("./exportPlanning");
    const L = { ...cline("bd8", "FROZEN OCTOPUS KARAAGE IQF", 6000), unitKind: "bundle" as const, cartonsPerUnit: 2, netKgPerCarton: 5 };
    const kgs = [2900, 3000, 7000, 3000, 5300, 3000, 4300, 2000, 7000, 3000, 5800, 3000];
    const ships = kgs.map((kg, i) => ship(`b${i}`, { kind: "consolidated", plannedKg: kg, containerNo: "", sealNo: "" }));
    const d = base({ revisions: [revision("c1", [L], { containerCount: null })], shipments: ships });
    const cov = contractCoverage(d, "c1");
    expect([cov.missingKg, cov.plannedKg, cov.minKg, cov.contractKg]).toEqual([4700, 49300, 54000, 60000]);
    expect(coverageText(cov)).toBe("Còn 4.700 kg chưa ghi chuyến · đã ghi 49.300 / tối thiểu 54.000 kg (HĐ 60.000 kg, dung sai 10 %)");
    expect(coverageText({ ...cov, missingKg: 0, missingContainers: 1, plannedContainers: 1, contractContainers: 2 })).toBe("Còn 1 cont chưa ghi chuyến · đã ghi 1 / 2 cont");
  });
});
