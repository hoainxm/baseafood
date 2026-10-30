// Oracle: docs/app-map/48-production-order.ba-spec.md v1 — AC-1…AC-5, AC-9, AC-10, AC-12…AC-14 (+ R6, A4, Q10).
// Số liệu theo LSX 19.10 (1.000 thùng × 12 kg, MSL 205, NSX 02–04/11/2026) và phụ lục 01 HĐ 01-26-HAT.
import { describe, expect, test } from "vitest";
import type {
  ExportContract,
  ExportContractLine,
  ExportContractRevision,
  ExportShipment,
  ImportReceipt,
  ImportReceiptLine,
  ProductionOrder,
  ProductionOrderLine,
  ProductionOrderMaterial,
} from "@/types";
import {
  canCreateOrder,
  cancelOrder,
  contractLineCoverage,
  contractLineSpec,
  emptyRequirements,
  expiryDate,
  issueOrder,
  issuedShipmentIds,
  keepOldRevision,
  lineFromContract,
  lineKg,
  lotMismatch,
  materialOptions,
  nextOrderNumber,
  orderLineKg,
  previousOrderFor,
  reservationOf,
  reviseOrder,
  shipmentsWithLot,
  staleRevision,
  validateOrder,
} from "./productionOrder";

const T0 = "2026-10-01T00:00:00.000Z";

function cLine(id: string, over: Partial<ExportContractLine> = {}): ExportContractLine {
  return {
    id,
    description: "Octopus 2 gr cut",
    hsCode: "",
    size: "2 gr",
    packing: "IQF, 1kg/PE x 12/ctn",
    unitKind: "carton",
    cartonsPerUnit: 1,
    netKgPerCarton: 12,
    quantity: 3240,
    kg: 38880,
    unitPrice: 11.6,
    microSpec: "",
    productId: "p-hat-luu",
    ...over,
  };
}

const contract = (over: Partial<ExportContract> = {}): ExportContract => ({
  id: "c1",
  customerId: "hyakusaibou",
  contractNo: "01-26-HAT",
  signedOn: "2026-04-20",
  orderRef: "",
  status: "open",
  cancelReason: "",
  closeReason: "",
  note: "",
  createdAt: T0,
  ...over,
});

function revision(id: string, revisionNo: number, lines: ExportContractLine[]): ExportContractRevision {
  return {
    id,
    contractId: "c1",
    revisionNo,
    revisedOn: "2026-04-20",
    changeSummary: "",
    terms: {
      incoterm: "CNF",
      portOfLoading: "",
      portOfDischarge: "Hakata",
      paymentMethod: "ttr",
      depositPct: null,
      lcNo: "",
      lcExpiry: "",
      lcLatestShipment: "",
      currency: "USD",
      tolerancePct: 10,
      latestShipmentDate: "2027-04-30",
      containerCount: 6,
      containerType: "40RF",
      requiredDocuments: [],
    },
    lines,
    filePath: "",
    fileName: "",
    recordedBy: "KH",
    createdAt: T0,
  };
}

const order = (id: string, over: Partial<ProductionOrder> = {}): ProductionOrder => ({
  id,
  orderNo: "19.10",
  orderDate: "2026-10-27",
  contractId: "c1",
  contractRevisionId: "r0",
  contractNo: "01-26-HAT",
  customerName: "Matsuda Sangyo",
  market: "Nhật",
  lotCode: "205",
  productionDates: ["2026-11-02", "2026-11-03", "2026-11-04"],
  deliveryDate: "2026-11-15",
  shelfLifeMonths: 24,
  requirements: emptyRequirements(),
  note: "",
  status: "draft",
  issuedAt: "",
  issuedBy: "",
  revisionNo: 0,
  revisionReason: "",
  cancelReason: "",
  staleAckRevisionId: "",
  staleAckReason: "",
  createdBy: "KH",
  createdAt: T0,
  ...over,
});

const oLine = (id: string, orderId: string, over: Partial<ProductionOrderLine> = {}): ProductionOrderLine => ({
  id,
  orderId,
  lineNo: 1,
  contractLineId: "l2",
  productId: "p-hat-luu",
  productName: "Bạch tuộc 1 da cắt hạt lựu",
  description: "Octopus 2 gr cut",
  spec: "Size 2 gr · IQF, 1kg/PE x 12/ctn",
  unitKind: "carton",
  cartonsPerUnit: 1,
  netKgPerCarton: 12,
  units: 1000,
  kg: null,
  note: "",
  ...over,
});

describe("AC-1 — kg tự tính từ thùng (R2)", () => {
  test("1.000 thùng × 12 kg = 12.000 kg (LSX 19.10)", () => {
    expect(lineKg({ units: 1000, unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton: 12 })).toBe(12000);
  });
  test("50 kiện × 2 thùng/kiện × 4 kg = 400 kg", () => {
    expect(lineKg({ units: 50, unitKind: "bundle", cartonsPerUnit: 2, netKgPerCarton: 4 })).toBe(400);
  });
  test("thiếu kg tịnh/thùng ⇒ null, kg gõ tay thắng", () => {
    expect(lineKg({ units: 10, unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton: null })).toBeNull();
    expect(orderLineKg(oLine("x", "o", { netKgPerCarton: null, kg: 95 }))).toBe(95);
  });
  test("dòng mới chép tên, quy cách, đơn vị từ dòng HĐ", () => {
    const l = lineFromContract(cLine("l2"), "Bạch tuộc 1 da cắt hạt lựu", { id: "n1", orderId: "o1", lineNo: 1 });
    expect(l).toMatchObject({ contractLineId: "l2", productId: "p-hat-luu", productName: "Bạch tuộc 1 da cắt hạt lựu", spec: "Size 2 gr · IQF, 1kg/PE x 12/ctn", netKgPerCarton: 12, units: null, note: "" });
  });
});

describe("AC-16 — yêu cầu NL của dòng HĐ chép sang dòng lệnh (R17)", () => {
  // Phụ lục 01 HĐ 01-26-HAT, dòng 3 cut.
  const hat = cLine("l3", { size: "3 gr cut", pieceLength: "1.5 - 3.5 cm/pc", piecesPerKg: "330 – 370", partRatio: "80% râu 20% thân", note: " Không dùng hàng da giấy " });
  test("Quy cách = Size · Dài · Số miếng · Tỉ lệ · Packing; ghi chú dòng chép sang", () => {
    const l = lineFromContract(hat, "Râu bạch tuộc cắt", { id: "n3", orderId: "o1", lineNo: 1 });
    expect(l.spec).toBe("Size 3 gr cut · Dài 1.5 - 3.5 cm/pc · 330 – 370 miếng/kg · Tỉ lệ 80% râu 20% thân · IQF, 1kg/PE x 12/ctn");
    expect(l.note).toBe("Không dùng hàng da giấy");
  });
  test("số miếng đã ghi đơn vị /kg thì giữ nguyên; ô trống thì bỏ", () => {
    expect(contractLineSpec({ size: "", packing: "", piecesPerKg: "590-770 pcs/kg", partRatio: "  " })).toBe("590-770 pcs/kg");
    expect(contractLineSpec({ size: "1.5 gr cut", packing: "" })).toBe("Size 1.5 gr cut");
  });
});

describe("AC-2 — chặn lệnh khi HĐ chưa sẵn sàng (R1)", () => {
  const ok = { revisions: [revision("r0", 0, [cLine("l2"), cLine("l9", { productId: undefined })])], approvals: [] };
  test("(a) chưa có bản hiệu lực", () => {
    expect(canCreateOrder({ revisions: [], approvals: [] }, contract(), ["l2"])).toEqual({ ok: false, reason: "no-effective-revision" });
  });
  test("(b) dòng chọn chưa nối mặt hàng", () => {
    expect(canCreateOrder(ok, contract(), ["l2", "l9"])).toEqual({ ok: false, reason: "line-unmapped", lineIds: ["l9"] });
  });
  test("(c) HĐ đã hủy · đã đóng", () => {
    expect(canCreateOrder(ok, contract({ status: "cancelled" }), ["l2"])).toEqual({ ok: false, reason: "contract-cancelled" });
    expect(canCreateOrder(ok, contract({ status: "closed" }), ["l2"])).toEqual({ ok: false, reason: "contract-closed" });
  });
  test("đủ điều kiện", () => {
    expect(canCreateOrder(ok, contract(), ["l2"])).toEqual({ ok: true });
  });
});

describe("AC-3 — số lệnh trùng chặn, MSL trùng chỉ cảnh báo (R3)", () => {
  const existing = order("o1", { status: "issued", issuedAt: T0 });
  test('" 19.10 " trùng "19.10" ⇒ lỗi field number', () => {
    const { errors } = validateOrder(order("o2", { orderNo: " 19.10 " }), [oLine("x", "o2")], [existing]);
    expect(errors.map((e) => e.field)).toEqual(["number"]);
  });
  test("MSL 205 trùng lệnh đang phát hành ⇒ 0 lỗi, 1 cảnh báo", () => {
    const { errors, warnings } = validateOrder(order("o2", { orderNo: "20.10" }), [oLine("x", "o2")], [existing]);
    expect(errors.length).toBe(0);
    expect(warnings.map((w) => w.field)).toEqual(["lotCode"]);
  });
  test("thiếu dòng, thiếu số thùng ⇒ lỗi", () => {
    expect(validateOrder(order("o2", { orderNo: "20.10" }), [], []).errors.map((e) => e.field)).toEqual(["lines"]);
    const bad = validateOrder(order("o2", { orderNo: "20.10" }), [oLine("x", "o2", { units: null })], []).errors.map((e) => e.field);
    expect(bad).toEqual(["lines.0.units", "lines.0.kg"]);
  });
});

describe("AC-4 — còn chưa ra lệnh + vượt dung sai (R4)", () => {
  test("38.880 kg, dung sai 10 %: A 21.600 (phát hành) + B 21.600 (nháp), C 5.000 đã hủy", () => {
    const orders = [order("A", { status: "issued" }), order("B"), order("C", { status: "cancelled" })];
    const lines = [oLine("a", "A", { units: 1800 }), oLine("b", "B", { units: 1800 }), oLine("c", "C", { units: null, kg: 5000 })];
    const cov = contractLineCoverage(cLine("l2"), 10, orders, lines);
    expect(cov).toEqual({ contractKg: 38880, orderedKg: 43200, remainingKg: -4320, overTolerance: true });
  });
  test("trong dung sai ⇒ không cảnh báo", () => {
    const cov = contractLineCoverage(cLine("l2"), 10, [order("A")], [oLine("a", "A", { units: 3500 })]);
    expect(cov.orderedKg).toBe(42000);
    expect(cov.overTolerance).toBe(false);
  });
});

describe("AC-5 — NL nhập khẩu dự kiến không vượt im lặng (R5)", () => {
  const receipts: ImportReceipt[] = [
    { id: "rc1", contractId: "ic1", contractNo: "AB-01", supplierName: "Mauritania Fish", arrivalDate: "2026-10-12", expectedDate: "", transport: "40RF", containerNo: "MSKU1", blNo: "", status: "open", cancelReason: "", note: "", createdAt: T0 },
    { id: "rc2", contractId: "ic1", contractNo: "AB-01", supplierName: "Mauritania Fish", arrivalDate: "2026-10-20", expectedDate: "", transport: "40RF", containerNo: "MSKU2", blNo: "", status: "cancelled", cancelReason: "trả hàng", note: "", createdAt: T0 },
  ];
  const rl = (id: string, receiptId: string, kg: number | null): ImportReceiptLine => ({ id, receiptId, contractLineId: "il1", kg, recordedBy: "Kho", updatedAt: T0 });
  const receiptLines = [rl("x1", "rc1", 20000), rl("x2", "rc2", 18000), rl("x3", "rc1", null)];
  const m = (id: string, orderId: string, kg: number): ProductionOrderMaterial => ({ id, orderId, orderLineId: "l", receiptId: "rc1", importLineId: "il1", label: "", kg });
  test("đã dành 12.000 + 9.000 (lệnh hủy 5.000 không tính) ⇒ 21.000, vượt", () => {
    const orders = [order("A"), order("B", { status: "cancelled" }), order("C")];
    const r = reservationOf(receiptLines[0], [m("1", "A", 12000), m("2", "B", 5000), m("3", "C", 9000)], orders);
    expect(r).toEqual({ receivedKg: 20000, reservedKg: 21000, freeKg: -1000, overReceived: true });
  });
  test("lần nhập đã hủy và dòng chưa có thực nhập không chọn được", () => {
    const opts = materialOptions(receipts, receiptLines);
    expect(opts.map((o) => o.id)).toEqual(["x1"]);
    expect(opts.filter((o) => o.receiptId === "rc2").length).toBe(0);
  });
});

describe("AC-9 — MSL chép sang chuyến (LS3)", () => {
  const sh = (id: string, lotCode: string) => ({ id, lotCode }) as ExportShipment;
  test("S1 trống nhận 205, S2 giữ 198 và lệch", () => {
    const o = order("o1");
    const changed = shipmentsWithLot(o, [sh("S1", ""), sh("S2", "198")]);
    expect(changed.map((s) => [s.id, s.lotCode])).toEqual([["S1", "205"]]);
    expect(lotMismatch(sh("S2", "198"), o)).toBe(true);
    expect(lotMismatch(sh("S1", "205"), o)).toBe(false);
  });
});

describe("AC-10 — HSD và ngày giao (R7, R8)", () => {
  test("NSX 02/11/2026 + 24 tháng ⇒ 01/11/2028", () => {
    expect(expiryDate(["2026-11-04", "2026-11-02", "2026-11-03"], 24)).toBe("2028-11-01");
    expect(expiryDate(["2026-09-15"], 24)).toBe("2028-09-01");
    expect(expiryDate([], 24)).toBe("");
  });
  test("(a) giao 15/11 hợp lệ · (b) giao 03/11 trước NSX cuối 04/11 ⇒ lỗi deliveryDate", () => {
    expect(validateOrder(order("o1"), [oLine("x", "o1")], []).errors.length).toBe(0);
    expect(validateOrder(order("o1", { deliveryDate: "2026-11-03" }), [oLine("x", "o1")], []).errors.map((e) => e.field)).toEqual(["deliveryDate"]);
  });
  test("không ngày SX ⇒ lỗi productionDates", () => {
    expect(validateOrder(order("o1", { productionDates: [] }), [oLine("x", "o1")], []).errors.map((e) => e.field)).toEqual(["productionDates"]);
  });
});

describe("R6 — chuyến có lệnh phát hành", () => {
  test("chỉ lệnh Đã phát hành tính; nháp và đã hủy không", () => {
    const orders = [order("A", { status: "issued" }), order("B"), order("C", { status: "cancelled" })];
    const links = [
      { id: "1", orderId: "A", shipmentId: "S1", createdAt: T0 },
      { id: "2", orderId: "A", shipmentId: "S2", createdAt: T0 },
      { id: "3", orderId: "B", shipmentId: "S3", createdAt: T0 },
      { id: "4", orderId: "C", shipmentId: "S4", createdAt: T0 },
    ];
    expect([...issuedShipmentIds(orders, links)].sort()).toEqual(["S1", "S2"]);
  });
  test("phát hành giữ người + giờ phát hành đầu tiên", () => {
    const o = issueOrder(order("A"), "Ngọc", "2026-10-27T08:00:00Z");
    expect(o).toMatchObject({ status: "issued", issuedBy: "Ngọc", issuedAt: "2026-10-27T08:00:00Z" });
    expect(issueOrder(o, "Khác", "2026-10-28T08:00:00Z").issuedBy).toBe("Ngọc");
  });
});

describe("AC-12 — hủy nhả mọi liên kết (R11)", () => {
  test("hủy có lý do ⇒ cancelled; chuyến hết lệnh phát hành; kg dành nhả", () => {
    const issued = order("A", { status: "issued", issuedAt: T0 });
    const res = cancelOrder(issued, "khách dời đơn");
    expect(res.ok && res.order.status).toBe("cancelled");
    if (!res.ok) return;
    const links = [{ id: "1", orderId: "A", shipmentId: "S1", createdAt: T0 }];
    expect(issuedShipmentIds([issued], links).has("S1")).toBe(true);
    expect(issuedShipmentIds([res.order], links).has("S1")).toBe(false);
    const rl: ImportReceiptLine = { id: "x", receiptId: "rc1", contractLineId: "il1", kg: 20000, recordedBy: "", updatedAt: T0 };
    const mat: ProductionOrderMaterial[] = [{ id: "m", orderId: "A", orderLineId: "a", receiptId: "rc1", importLineId: "il1", label: "", kg: 12000 }];
    expect(reservationOf(rl, mat, [issued]).reservedKg - reservationOf(rl, mat, [res.order]).reservedKg).toBe(12000);
  });
  test("hủy không lý do ⇒ lỗi cancelReason", () => {
    expect(cancelOrder(order("A"), "  ")).toEqual({ ok: false, field: "cancelReason", message: "Ghi lý do hủy lệnh" });
  });
});

describe("AC-13 — sửa sau phát hành có vết (R10)", () => {
  const prev = { order: order("A", { status: "issued", issuedAt: T0 }), lines: [oLine("a", "A")] };
  const next = { order: prev.order, lines: [oLine("a", "A", { units: 900 })] };
  test("1.000 → 900 thùng, lý do ⇒ lần sửa 1, nhật ký có trước / sau", () => {
    const res = reviseOrder(prev, next, "giảm theo khách");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.order.revisionNo).toBe(1);
    expect(res.order.revisionReason).toBe("giảm theo khách");
    expect(res.changes.length).toBe(1);
    expect(res.changes[0]).toContain("1.000");
    expect(res.changes[0]).toContain("900");
  });
  test("không lý do ⇒ lỗi; lệnh nháp sửa thẳng không tăng lần sửa", () => {
    expect(reviseOrder(prev, next, "").ok).toBe(false);
    const draft = { order: order("B"), lines: [oLine("b", "B")] };
    const res = reviseOrder(draft, { ...draft, lines: [oLine("b", "B", { units: 900 })] }, "");
    expect(res.ok && res.order.revisionNo).toBe(0);
  });
});

describe("AC-14 — phụ lục sau phát hành (R12)", () => {
  const d = { revisions: [revision("r0", 0, [cLine("l2")]), revision("r1", 1, [cLine("l2", { kg: 51840 })])], approvals: [] };
  const issued = order("A", { status: "issued", issuedAt: T0, contractRevisionId: "r0" });
  test("bản hiệu lực r1 ≠ r0 ⇒ cờ; giữ nguyên có lý do ⇒ hết cờ, dòng không đổi", () => {
    const lines = [oLine("a", "A")];
    expect(staleRevision(issued, d)).toBe(true);
    expect(keepOldRevision(issued, d, "").ok).toBe(false);
    const res = keepOldRevision(issued, d, "khách giữ cơ cấu cũ cho cont 1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(staleRevision(res.order, d)).toBe(false);
    expect(lines).toEqual([oLine("a", "A")]);
  });
  test("bản mới nữa (r2) ⇒ cờ lại; lệnh nháp không bao giờ có cờ", () => {
    const acked = { ...issued, staleAckRevisionId: "r1" };
    const d2 = { ...d, revisions: [...d.revisions, revision("r2", 2, [cLine("l2")])] };
    expect(staleRevision(acked, d2)).toBe(true);
    expect(staleRevision(order("B", { contractRevisionId: "r0" }), d)).toBe(false);
  });
});

describe("A4, Q10 — gợi ý số lệnh, chép yêu cầu từ lệnh trước", () => {
  test("đã có 18.10, 19.10 trong tháng 10 ⇒ gợi ý 20.10; tháng mới ⇒ 1.11", () => {
    const orders = [order("a", { orderNo: "18.10" }), order("b", { orderNo: "19.10" }), order("c", { orderNo: "LSX đặc biệt" })];
    expect(nextOrderNumber(orders, "2026-10-30")).toBe("20.10");
    expect(nextOrderNumber(orders, "2026-11-02")).toBe("1.11");
  });
  test("lệnh gần nhất cùng khách + mặt hàng, bỏ lệnh đã hủy", () => {
    const orders = [
      order("old", { orderDate: "2026-09-01", requirements: { ...emptyRequirements(), strapNote: "xanh dương" } }),
      order("new", { orderDate: "2026-10-01", requirements: { ...emptyRequirements(), strapNote: "mỗi NSX một màu" } }),
      order("x", { orderDate: "2026-10-20", status: "cancelled" }),
      order("other", { orderDate: "2026-10-25", customerName: "Khác" }),
    ];
    const lines = orders.map((o) => oLine(`l-${o.id}`, o.id));
    expect(previousOrderFor(orders, lines, "Matsuda Sangyo", "p-hat-luu")?.id).toBe("new");
    expect(previousOrderFor(orders, lines, "Matsuda Sangyo", "p-khac")).toBeNull();
  });
});
