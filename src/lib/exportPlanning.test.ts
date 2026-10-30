// Oracle: docs/app-map/41-export-planning.ba-spec.md §10 — số HĐ 18.26/BSF-SCM.2026 là số THẬT
// (14 dòng, 1.900 thùng/kiện, 19.000 kg, 172.445 USD). Ghép lô 165 (INV 234/26) vào HĐ 18.26 là
// GIẢ ĐỊNH để thử dung sai — chưa có chứng từ nối hai cái.
import { describe, expect, it } from "vitest";
import {
  EMPTY_EXPORT_DATA,
  copyContractLine,
  lineGoodsTypeNames,
  insertCopiedLine,
  extractCustomerNamesFromContracts,
  rankProductsForLine,
  blankItem,
  buildMonthExcel,
  buildMonthPlan,
  canCancel,
  canDeleteContract,
  canMarkDone,
  canMarkNotApplicable,
  cancelContract,
  contractAttachments,
  contractClosure,
  finalReviewGate,
  finalReviewsOf,
  missingAttachmentKinds,
  shipmentGate,
  contractCoverage,
  contractState,
  contractTotals,
  effectiveDeadline,
  effectiveRevision,
  findDuplicateContract,
  isShipmentClosed,
  isShipmentLate,
  shipmentLateInfo,
  missingDocumentItems,
  buildPeriodPlan,
  deviationText,
  isRequiredDocumentItem,
  monthPeriod,
  rangePeriod,
  revisionApprovalLabelState,
  searchContracts,
  searchShipments,
  shiftPeriod,
  shipmentInPeriod,
  suggestProductId,
  applyProductMapping,
  unmappedLines,
  weekPeriod,
  shipmentActuals,
  shipmentMonth,
  shiftMonth,
  stepState,
  validateContract,
  validateShipment,
  type ExportData,
  documentKindList,
  documentKindRowsFromList,
  findOrCreateDocumentKind,
  documentKindLabel,
  requiredDocumentLabel,
} from "./exportPlanning";
import type {
  ExportContract,
  ExportContractApproval,
  ExportContractLine,
  ExportContractRevision,
  ExportContractTerms,
  ExportFile,
  ExportShipment,
  ExportStepItem,
} from "@/types";

let seq = 0;
const nid = () => `id-${++seq}`;
const T0 = "2026-10-01T00:00:00.000Z";

function line(desc: string, quantity: number, netKgPerCarton: number, unitPrice: number, bundle?: number): ExportContractLine {
  return {
    id: nid(),
    description: desc,
    hsCode: "",
    size: "",
    packing: "",
    unitKind: bundle ? "bundle" : "carton",
    cartonsPerUnit: bundle ?? 1,
    netKgPerCarton,
    quantity,
    kg: null,
    unitPrice,
    microSpec: "",
  };
}

/** 14 dòng HĐ 18.26 (scan 2 trang, ký 30/07/2026). Dòng 12: 100 bó × 2 thùng × 4 kg. */
const LINES_1826: ExportContractLine[] = [
  line("Iwadako blanched cut 2-3g", 200, 10, 10.5),
  line("Iwadako blanched cut 4g", 100, 10, 10.25),
  line("Iwadako boiled cut 5-5.5g", 150, 10, 11.2),
  line("Iwadako boiled cut 6-7g", 100, 10, 11.2),
  line("Tako neck boiled cut 1-2g", 200, 10, 4.05),
  line("Tako tip boiled", 200, 12, 4.05),
  line("Tako tip raw", 50, 12, 2.15),
  line("Tako karaage 10-15g", 200, 10, 9.2),
  line("Iwadako boiled cut 2 leg 16-20g", 200, 10, 10.9),
  line("Iwadako sushi open cut 6-8g", 100, 7, 14.95),
  line("Iidako open cut 25-35g", 100, 10, 8.1),
  line("Big iidako skewer 16-24g", 100, 4, 10.15, 2),
  line("Iidako sashimi 15-25g", 100, 10, 11.4),
  line("Eihire (cá đuối khô tẩm)", 100, 10, 15.8),
];

const REQUIRED_1826: ExportContractTerms["requiredDocuments"] = [
  { kind: "commercial-invoice", form: "", issuer: "" },
  { kind: "packing-list", form: "", issuer: "" },
  { kind: "bill-of-lading", form: "", issuer: "" },
  { kind: "health-certificate", form: "", issuer: "công ty tự cấp" },
  { kind: "certificate-of-origin", form: "VJ", issuer: "" },
];

function terms(over: Partial<ExportContractTerms> = {}): ExportContractTerms {
  return {
    incoterm: "CFR",
    portOfLoading: "Cái Mép",
    portOfDischarge: "Tokyo",
    paymentMethod: "ttr",
    depositPct: null,
    lcNo: "",
    lcExpiry: "",
    lcLatestShipment: "",
    currency: "USD",
    tolerancePct: 10,
    latestShipmentDate: "2026-09-05",
    containerCount: 1,
    containerType: "40RF",
    requiredDocuments: REQUIRED_1826,
    ...over,
  };
}

function contract(id: string, over: Partial<ExportContract> = {}): ExportContract {
  return { id, customerId: "scm", contractNo: "18.26/BSF-SCM.2026", signedOn: "2026-07-30", orderRef: "B182", status: "open", cancelReason: "", closeReason: "", note: "", createdAt: T0, ...over };
}

function revision(id: string, contractId: string, revisionNo: number, over: Partial<ExportContractRevision> = {}): ExportContractRevision {
  return { id, contractId, revisionNo, revisedOn: "2026-07-30", changeSummary: "", terms: terms(), lines: LINES_1826, filePath: "f/hd.pdf", fileName: "hd.pdf", recordedBy: "KH", createdAt: T0, ...over };
}

function approval(revisionId: string, contractId: string, decision: ExportContractApproval["decision"], decidedOn = "2026-08-01", reason = ""): ExportContractApproval {
  return { id: nid(), contractId, revisionId, decision, approverName: "GĐ", decidedOn, reason, filePath: "f/ky.pdf", fileName: "ky.pdf", recordedBy: "KH", createdAt: `${decidedOn}T00:00:00Z` };
}

function shipment(id: string, contractId: string, over: Partial<ExportShipment> = {}): ExportShipment {
  return {
    id,
    contractId,
    planMonth: "2026-09",
    kind: "40RF",
    goodsSummary: "Bạch tuộc các loại",
    plannedKg: 19000,
    lotCode: "",
    portOfDischarge: "Tokyo",
    bookingNo: "",
    loadingDate: "",
    etd: "",
    eta: "",
    vesselVoyage: "",
    containerNo: "",
    sealNo: "",
    status: "open",
    cancelReason: "",
    note: "",
    createdAt: T0,
    ...over,
  };
}

function file(shipmentId: string, step: ExportFile["step"], stepItemId = "", layerNo: number | null = null): ExportFile {
  return { id: nid(), contractId: "c1", shipmentId, stepItemId, step, path: `p/${nid()}`, fileName: "x.pdf", layerNo, caption: "", uploadedBy: "a", createdAt: T0 };
}

function item(shipmentId: string, step: ExportStepItem["step"], over: Partial<ExportStepItem> = {}): ExportStepItem {
  return { ...blankItem(shipmentId, step, nid(), T0), ...over };
}

function data(over: Partial<ExportData> = {}): ExportData {
  return { ...EMPTY_EXPORT_DATA, ...over };
}

/** Chuyến đã đủ bước 2–5 (bằng chứng có file), thực xuất theo `ci`. */
function closedShipmentData(ci: { cartons: number; netKg: number; amount: number }, shipOver: Partial<ExportShipment> = {}) {
  const c = contract("c1");
  const r0 = revision("r0", "c1", 0);
  const s = shipment("s1", "c1", { containerNo: "SZLU9522312", sealNo: "VN50853AT", loadingDate: "2026-09-25", etd: "2026-09-26", ...shipOver });
  const items: ExportStepItem[] = [];
  const files: ExportFile[] = [];
  const done = (step: ExportStepItem["step"], over: Partial<ExportStepItem> = {}) => {
    const it = item("s1", step, { state: "done", number: "x", issuedOn: "2026-09-25", ...over });
    items.push(it);
    files.push(file("s1", step, it.id));
    return it;
  };
  done("production-order");
  done("packaging");
  done("customs-declaration", { number: "TK-1" });
  done("export-order");
  files.push(file("s1", "loading-plan"), file("s1", "loading-photos", "", 1));
  for (const req of REQUIRED_1826) {
    done("document", {
      docKind: req.kind,
      docForm: req.form,
      ...(req.kind === "commercial-invoice" ? ci : {}),
      ...(req.kind === "bill-of-lading" ? { onBoardDate: "2026-09-26" } : {}),
    });
  }
  return data({ contracts: [c], revisions: [r0], approvals: [approval("r0", "c1", "approved")], shipments: [s], items, files });
}

describe("R2 · tổng hợp đồng (AC-4)", () => {
  it("HĐ 18.26 ra 1.900 đơn vị / 2.000 thùng / 19.000 kg / 172.445 USD", () => {
    expect(contractTotals(LINES_1826)).toEqual({ units: 1900, cartons: 2000, kg: 19000, amount: 172445 });
  });
  it("dòng kiện tính kg = kiện × thùng/kiện × kg; tiền dòng = kg × đơn giá; ô kg gõ tay thắng", () => {
    expect(contractTotals([LINES_1826[11]]).kg).toBe(800);
    expect(contractTotals([LINES_1826[0]]).amount).toBe(21000);
    expect(contractTotals([{ ...LINES_1826[0], kg: 1990 }]).kg).toBe(1990);
  });
});

describe("R9 · kiểm hợp đồng (AC-6)", () => {
  const existing = [contract("c1")];
  it("trùng số HĐ cùng khách (khác hoa thường, thừa khoảng trắng) bị chặn; khác khách thì được", () => {
    expect(findDuplicateContract(existing, "scm", " 18.26/bsf-scm.2026 ")).toBe("c1");
    expect(findDuplicateContract(existing, "other", "18.26/BSF-SCM.2026")).toBeUndefined();
    expect(findDuplicateContract(existing, "scm", "18.26/BSF-SCM.2026", "c1")).toBeUndefined();
  });
  it("thiếu hạn giao ⇒ lỗi latestShipmentDate; trùng số ⇒ lỗi contractNo", () => {
    const base = { id: "c2", customerId: "scm", contractNo: "19.26", signedOn: "2026-08-01", terms: terms({ latestShipmentDate: "" }), lines: LINES_1826 };
    expect(validateContract(base, existing).map((e) => e.key)).toContain("latestShipmentDate");
    expect(validateContract({ ...base, contractNo: " 18.26/bsf-scm.2026 ", terms: terms() }, existing).map((e) => e.key)).toEqual(["contractNo"]);
    expect(validateContract({ ...base, terms: terms() }, existing)).toEqual([]);
  });
  it("thanh toán Khác phải ghi hình thức (2026-10-30)", () => {
    const base = { id: "c2", customerId: "scm", contractNo: "19.26", signedOn: "2026-08-01", lines: LINES_1826 };
    expect(validateContract({ ...base, terms: terms({ paymentMethod: "other", paymentOther: " " }) }, existing).map((e) => e.key)).toEqual(["paymentOther"]);
    expect(validateContract({ ...base, terms: terms({ paymentMethod: "other", paymentOther: "D/P 30 ngày" }) }, existing)).toEqual([]);
  });
});

describe("R3 · bản + duyệt gắn bản (AC-5, AC-7…AC-10)", () => {
  it("AC-65: HĐ mới lập (không còn bước duyệt HĐ) ⇒ bản 0 hiệu lực ngay, vào thẳng Chờ đính kèm", () => {
    const d = data({ contracts: [contract("c1")], revisions: [revision("r0", "c1", 0)] });
    expect(effectiveRevision(d, "c1")?.id).toBe("r0");
    expect(stepState(d, shipment("s", "c1"), 1)).toBe("in-progress");
    expect(contractState(d, "c1")).toBe("attaching");
    expect(missingAttachmentKinds(d, "c1")).toEqual(["signed-contract"]);
  });
  it("HĐ duyệt theo quy trình cũ (BGĐ ký giấy, có file ký) ⇒ bản hiệu lực = 0, bước 1 xong, đang ghi chuyến", () => {
    const d = data({ contracts: [contract("c1")], revisions: [revision("r0", "c1", 0)], approvals: [approval("r0", "c1", "approved")] });
    expect(effectiveRevision(d, "c1")?.revisionNo).toBe(0);
    expect(stepState(d, shipment("s", "c1"), 1)).toBe("done");
    expect(contractState(d, "c1")).toBe("shipping");
  });
  it("AC-66: ghi bản sửa ⇒ có hiệu lực ngay (không chờ duyệt); chuyến đã khép vẫn khép", () => {
    const d0 = closedShipmentData({ cartons: 1900, netKg: 19000, amount: 172445 });
    const r1 = revision("r1", "c1", 1, { lines: LINES_1826.map((l, i) => (i === 0 ? { ...l, quantity: 180 } : l)), revisedOn: "2026-08-12" });
    const d = { ...d0, revisions: [...d0.revisions, r1] };
    expect(effectiveRevision(d, "c1")?.revisionNo).toBe(1);
    expect(effectiveRevision(d, "c1")?.lines[0].quantity).toBe(180);
    expect(isShipmentClosed(d, d.shipments[0])).toBe(true);
    // Bản 0 có file ký kiểu cũ ⇒ không tụt về Chờ đính kèm; thực xuất vẫn trong dung sai của bản mới ⇒ chờ duyệt cuối.
    expect(missingAttachmentKinds(d, "c1")).toEqual([]);
    expect(contractState(d, "c1")).toBe("final-review");
  });
  it("bản sửa bị từ chối ⇒ bỏ bản sửa, bản 0 giữ hiệu lực, HĐ không bị hủy", () => {
    const d = data({
      contracts: [contract("c1")],
      revisions: [revision("r0", "c1", 0), revision("r1", "c1", 1)],
      approvals: [approval("r0", "c1", "approved"), approval("r1", "c1", "rejected", "2026-08-15", "giá sai")],
    });
    expect(effectiveRevision(d, "c1")?.revisionNo).toBe(0);
    expect(contractState(d, "c1")).toBe("shipping");
  });
  it("bản sửa được duyệt ⇒ thành bản hiệu lực", () => {
    const d = data({
      contracts: [contract("c1")],
      revisions: [revision("r0", "c1", 0), revision("r1", "c1", 1)],
      approvals: [approval("r0", "c1", "approved"), approval("r1", "c1", "needs-revision", "2026-08-13"), approval("r1", "c1", "approved", "2026-08-14")],
    });
    expect(effectiveRevision(d, "c1")?.revisionNo).toBe(1);
  });
  it("từ chối bản 0 ⇒ hủy HĐ và mọi chuyến còn mở, cùng lý do (AC-8)", () => {
    const d = data({ contracts: [contract("c1")], shipments: [shipment("s1", "c1")] });
    const out = cancelContract(d, "c1", "khách đổi đơn");
    expect(out.contracts[0]).toMatchObject({ status: "cancelled", cancelReason: "khách đổi đơn" });
    expect(out.shipments[0]).toMatchObject({ status: "cancelled", cancelReason: "khách đổi đơn" });
  });
});

describe("v8 · quy trình duyệt → đính kèm → ghi chuyến → duyệt cuối (mig 0079)", () => {
  /** Lượt duyệt theo quy trình MỚI (Trưởng / Phó phòng duyệt trên app — có `stage`). */
  const approveNew = (revisionId: string, contractId: string, stage: "contract" | "final" = "contract", decision: ExportContractApproval["decision"] = "approved", reason = "") => ({
    ...approval(revisionId, contractId, decision, "2026-08-02", reason),
    stage,
    filePath: "",
    fileName: "",
  });
  const attach = (kind: NonNullable<ExportFile["attachmentKind"]>): ExportFile => ({ ...file("", "contract"), attachmentKind: kind });

  it("AC-56: duyệt mới xong ⇒ Chờ đính kèm; bước 1 chuyến chưa xong; chưa ghi chuyến được (file bản HĐ lúc lập KHÔNG tính)", () => {
    const d = data({ contracts: [contract("c1")], revisions: [revision("r0", "c1", 0)], approvals: [approveNew("r0", "c1")] });
    expect(contractState(d, "c1")).toBe("attaching");
    expect(missingAttachmentKinds(d, "c1")).toEqual(["signed-contract"]);
    expect(stepState(d, shipment("s", "c1"), 1)).toBe("in-progress");
    expect(shipmentGate(d, "c1")).toMatchObject({ ok: false, reason: "attachments-missing" });
  });
  it("AC-57: chưa đính kèm HĐ đã ký ⇒ không ghi chuyến được; mọi bản bị từ chối kiểu cũ ⇒ lý do không có bản hiệu lực", () => {
    const d = data({ contracts: [contract("c1")], revisions: [revision("r0", "c1", 0)] });
    expect(shipmentGate(d, "c1")).toMatchObject({ ok: false, reason: "attachments-missing", missing: ["signed-contract"] });
    const rejected = { ...d, approvals: [approval("r0", "c1", "rejected", "2026-08-15", "sai giá")] };
    expect(shipmentGate(rejected, "c1")).toMatchObject({ ok: false, reason: "no-revision" });
    expect(contractState(rejected, "c1")).toBe("attaching");
  });
  it("AC-58: thanh toán L/C ⇒ bắt cả HĐ đã ký lẫn L/C; đủ thì Đang ghi chuyến + ghi chuyến được", () => {
    const r0 = revision("r0", "c1", 0, { terms: terms({ paymentMethod: "lc" }) });
    const base = data({ contracts: [contract("c1")], revisions: [r0], approvals: [approveNew("r0", "c1")], files: [attach("signed-contract")] });
    expect(missingAttachmentKinds(base, "c1")).toEqual(["lc"]);
    expect(contractState(base, "c1")).toBe("attaching");
    const d = { ...base, files: [...base.files, attach("lc"), attach("other")] };
    expect(contractAttachments(d, "c1")).toHaveLength(3);
    expect(missingAttachmentKinds(d, "c1")).toEqual([]);
    expect(contractState(d, "c1")).toBe("shipping");
    expect(shipmentGate(d, "c1").ok).toBe(true);
    expect(stepState(d, shipment("s", "c1"), 1)).toBe("done");
  });
  it("AC-59: chạy không nối máy chủ ⇒ không bắt file đính kèm", () => {
    const d = data({ contracts: [contract("c1")], revisions: [revision("r0", "c1", 0)], approvals: [approveNew("r0", "c1")] });
    expect(missingAttachmentKinds(d, "c1", { filesAvailable: false })).toEqual([]);
    expect(contractState(d, "c1", { filesAvailable: false })).toBe("shipping");
  });
  it("AC-60: duyệt cuối KHÔNG phải lượt duyệt bản — không đổi bản hiệu lực; đồng ý + status closed ⇒ Đã đóng HĐ", () => {
    const d0 = closedShipmentData({ cartons: 1900, netKg: 19000, amount: 172445 });
    expect(contractState(d0, "c1")).toBe("final-review");
    expect(finalReviewGate(d0, "c1")).toEqual({ ok: true, needsReason: false });
    const back = { ...d0, approvals: [...d0.approvals, approveNew("r0", "c1", "final", "needs-revision", "thiếu B/L gốc")] };
    expect(effectiveRevision(back, "c1")?.id).toBe("r0");
    expect(finalReviewsOf(back, "c1")).toHaveLength(1);
    expect(contractState(back, "c1")).toBe("final-review");
    const closed = { ...back, contracts: back.contracts.map((c) => ({ ...c, status: "closed" as const, closeReason: "Duyệt cuối" })) };
    expect(contractState(closed, "c1")).toBe("closed");
    expect(finalReviewGate(closed, "c1").ok).toBe(false);
  });
  it("AC-63: HĐ cũ (bản 0 duyệt kiểu cũ có file ký) + bản sửa duyệt theo cách mới ⇒ KHÔNG tụt về Chờ đính kèm", () => {
    const d = data({
      contracts: [contract("c1")],
      revisions: [revision("r0", "c1", 0), revision("r1", "c1", 1, { filePath: "", fileName: "" })],
      approvals: [approval("r0", "c1", "approved"), approveNew("r1", "c1")],
    });
    expect(effectiveRevision(d, "c1")?.id).toBe("r1");
    expect(missingAttachmentKinds(d, "c1")).toEqual([]);
    expect(contractState(d, "c1")).toBe("shipping");
  });
  it("AC-64: bản sửa mới không chặn duyệt cuối (đã có hiệu lực, duyệt cuối xem luôn)", () => {
    const d0 = closedShipmentData({ cartons: 1900, netKg: 19000, amount: 172445 });
    const d = { ...d0, revisions: [...d0.revisions, revision("r1", "c1", 1, { revisedOn: "2026-10-01" })] };
    expect(effectiveRevision(d, "c1")?.id).toBe("r1");
    expect(contractState(d, "c1")).toBe("final-review");
    expect(finalReviewGate(d, "c1")).toEqual({ ok: true, needsReason: false });
  });
  it("AC-61: đóng sớm khi ngoài dung sai ⇒ duyệt cuối được nhưng bắt lý do; chưa có chuyến ⇒ chưa duyệt cuối", () => {
    const d = closedShipmentData({ cartons: 1500, netKg: 15000, amount: 140000 });
    expect(contractState(d, "c1")).toBe("shipping");
    expect(finalReviewGate(d, "c1")).toEqual({ ok: true, needsReason: true });
    const none = data({ contracts: [contract("c1")], revisions: [revision("r0", "c1", 0)], approvals: [approval("r0", "c1", "approved")] });
    expect(finalReviewGate(none, "c1").ok).toBe(false);
  });
});

describe("NV6 · gia hạn (AC-11)", () => {
  it("gia hạn tới 30/09 ⇒ chuyến ETD 26/09 hết trễ, không thêm bản HĐ", () => {
    const base = data({
      contracts: [contract("c1")],
      revisions: [revision("r0", "c1", 0)],
      approvals: [approval("r0", "c1", "approved")],
      shipments: [shipment("s1", "c1", { etd: "2026-09-26" })],
    });
    expect(isShipmentLate(base, base.shipments[0])).toBe(true);
    const d = { ...base, extensions: [{ id: "e1", contractId: "c1", newDeadline: "2026-09-30", confirmedOn: "2026-09-01", note: "", filePath: "", fileName: "", recordedBy: "", createdAt: T0 }] };
    expect(effectiveDeadline(d, "c1")).toBe("2026-09-30");
    expect(isShipmentLate(d, d.shipments[0])).toBe(false);
    expect(d.revisions).toHaveLength(1);
  });
});

describe("R1 + R8 · tháng của chuyến, thứ tự ngày (AC-12)", () => {
  it("tháng 10 → ETD 03/11 ⇒ 11 → ngày đóng 31/10 ⇒ 10; ngày đóng sau ETD bị chặn", () => {
    const s = shipment("s", "c", { planMonth: "2026-10" });
    expect(shipmentMonth(s)).toBe("2026-10");
    expect(shipmentMonth({ ...s, etd: "2026-11-03" })).toBe("2026-11");
    expect(shipmentMonth({ ...s, etd: "2026-11-03", loadingDate: "2026-10-31" })).toBe("2026-10");
    expect(validateShipment({ ...s, etd: "2026-11-03", loadingDate: "2026-11-05" }).map((e) => e.key)).toContain("loadingAfterEtd");
    expect(validateShipment({ ...s, etd: "2026-11-03", loadingDate: "2026-10-31" })).toEqual([]);
  });
  it("lùi / tiến tháng qua năm", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("R6 · mục chứng từ sinh từ HĐ (AC-13)", () => {
  it("5 chứng từ yêu cầu ⇒ 5 mục chưa làm, C/O giữ form VJ; chạy lại không nhân đôi", () => {
    const items = missingDocumentItems("s1", terms(), [], nid, T0);
    expect(items).toHaveLength(5);
    expect(items.every((i) => i.state === "not-started")).toBe(true);
    expect(items.find((i) => i.docKind === "certificate-of-origin")?.docForm).toBe("VJ");
    expect(missingDocumentItems("s1", terms(), items, nid, T0)).toHaveLength(0);
  });
  it("HĐ không liệt kê Commercial Invoice ⇒ vẫn thêm (thực xuất lấy từ đó)", () => {
    const items = missingDocumentItems("s1", { requiredDocuments: [{ kind: "packing-list", form: "", issuer: "" }] }, [], nid, T0);
    expect(items.map((i) => i.docKind)).toEqual(["commercial-invoice", "packing-list"]);
  });
});

describe("R4 + R5 · bằng chứng (AC-14, AC-15)", () => {
  const s = shipment("s1", "c1");
  it("bước 2 không xong khi HĐ không có bản hiệu lực (mọi bản bị từ chối kiểu cũ); file vẫn giữ", () => {
    const it2 = item("s1", "production-order");
    const d = data({
      contracts: [contract("c1")],
      revisions: [revision("r0", "c1", 0)],
      approvals: [approval("r0", "c1", "rejected", "2026-08-15", "sai giá")],
      shipments: [s],
      items: [it2],
      files: [file("s1", "production-order", it2.id)],
    });
    expect(canMarkDone(it2, d)).toMatchObject({ ok: false, reason: "contract-not-approved" });
    expect(d.files.filter((f) => f.stepItemId === it2.id)).toHaveLength(1);
    // Có bản hiệu lực mà dòng hàng chưa nối danh mục mặt hàng ⇒ vẫn chặn (lệnh SX cần mặt hàng thật).
    const approvedUnmapped = { ...d, approvals: [] };
    expect(canMarkDone(it2, approvedUnmapped)).toMatchObject({ ok: false, reason: "lines-unmapped" });
    const mapped = { ...approvedUnmapped, revisions: [revision("r0", "c1", 0, { lines: LINES_1826.map((l, i) => ({ ...l, productId: `p${i}` })) })] };
    expect(canMarkDone(it2, mapped).ok).toBe(true);
  });
  it("tờ khai có file mà thiếu số ⇒ chặn, thiếu đúng declarationNo", () => {
    const tk = item("s1", "customs-declaration");
    const d = data({ shipments: [s], items: [tk], files: [file("s1", "customs-declaration", tk.id)] });
    expect(canMarkDone(tk, d).missing).toEqual(["declarationNo"]);
    expect(canMarkDone({ ...tk, number: "305123" }, d).ok).toBe(true);
  });
  it("Commercial Invoice cần số, ngày, file + 3 tổng; B/L cần ngày on board", () => {
    const ci = item("s1", "document", { docKind: "commercial-invoice", number: "234/26", issuedOn: "2026-09-25" });
    const d = data({ shipments: [s], items: [ci], files: [file("s1", "document", ci.id)] });
    expect(canMarkDone(ci, d).missing).toEqual(["cartons", "netKg", "amount"]);
    const bl = item("s1", "document", { docKind: "bill-of-lading", number: "PAPTYO260926224", issuedOn: "2026-09-26" });
    expect(canMarkDone(bl, { ...d, items: [bl], files: [file("s1", "document", bl.id)] }).missing).toEqual(["onBoardDate"]);
  });
  it("không nối máy chủ ⇒ không bắt file (như /documents)", () => {
    const tk = item("s1", "customs-declaration", { number: "305123" });
    expect(canMarkDone(tk, data({ shipments: [s], items: [tk] }), { filesAvailable: false }).ok).toBe(true);
    expect(canMarkDone(tk, data({ shipments: [s], items: [tk] })).missing).toEqual(["file"]);
  });
  it("không áp dụng phải có lý do", () => {
    const co = item("s1", "document", { docKind: "certificate-of-origin" });
    expect(canMarkNotApplicable(co, "  ").ok).toBe(false);
    expect(canMarkNotApplicable(co, "khách bỏ yêu cầu").ok).toBe(true);
  });
  it("4a / 4b tự xong khi có file, không đánh dấu tay", () => {
    const d = data({ shipments: [s], files: [file("s1", "loading-photos", "", 1)] });
    expect(stepState(d, s, 4)).toBe("in-progress");
    expect(canMarkDone(item("s1", "loading-plan"), d)).toMatchObject({ ok: false, reason: "derived-from-files" });
  });
});

describe("R7 · thực xuất (AC-16)", () => {
  it("lô 165: chỉ lấy invoice thương mại — không cộng hàng mẫu 234M/26, không lấy B/L", () => {
    const d = data({
      items: [
        item("s1", "document", { docKind: "commercial-invoice", number: "234/26", cartons: 2251, netKg: 22214, amount: 194557.6 }),
        item("s1", "document", { docKind: "sample-invoice", number: "234M/26", cartons: 1, netKg: 13.8, amount: 27.6 }),
        item("s1", "document", { docKind: "bill-of-lading", number: "PAPTYO260926224", cartons: 2252, netKg: 22227.8 }),
      ],
    });
    expect(shipmentActuals(d, "s1")).toEqual({ cartons: 2251, kg: 22214, amount: 194557.6 });
  });
});

describe("R5 · dùng chung chứng từ cho cont 40+20 (AC-17)", () => {
  it("chuyến 20RF trỏ dùng chung ⇒ bước 5 xong; hủy chuyến gốc ⇒ về chưa làm", () => {
    const s40 = shipment("s40", "c1", { bookingNo: "039FY22479" });
    const s20 = shipment("s20", "c1", { bookingNo: "039FY22479", kind: "20RF" });
    const src = item("s40", "document", { docKind: "commercial-invoice", state: "done" });
    const shared = item("s20", "document", { docKind: "commercial-invoice", sharedFromId: src.id });
    const d = data({ shipments: [s40, s20], items: [src, shared] });
    expect(stepState(d, s20, 5)).toBe("done");
    expect(shipmentActuals(d, "s20").kg).toBe(0);
    const cancelled = { ...d, shipments: [{ ...s40, status: "cancelled" as const }, s20] };
    expect(stepState(cancelled, s20, 5)).toBe("not-started");
  });
});

describe("NV12 · khép kín (AC-19…AC-23)", () => {
  it("chuyến khép khi bước 2–5 xong, chưa có tiền về", () => {
    const d = closedShipmentData({ cartons: 1900, netKg: 19000, amount: 172445 });
    expect(isShipmentClosed(d, d.shipments[0])).toBe(true);
    expect(d.payments).toHaveLength(0);
  });
  it("thiếu seal ⇒ bước 4 chưa xong ⇒ chuyến chưa khép; xe tải chỉ cần biển số", () => {
    const d = closedShipmentData({ cartons: 1900, netKg: 19000, amount: 172445 }, { sealNo: "" });
    expect(stepState(d, d.shipments[0], 4)).toBe("in-progress");
    const truck = { ...d, shipments: [{ ...d.shipments[0], kind: "truck" as const, containerNo: "72C-12345" }] };
    expect(stepState(truck, truck.shipments[0], 4)).toBe("done");
  });
  it("HĐ tự khép trong dung sai, kể cả đúng biên 20.900 kg / 189.689,50 USD", () => {
    expect(contractClosure(closedShipmentData({ cartons: 2090, netKg: 20900, amount: 189689.5 }), "c1").closed).toBe(true);
  });
  it("17.000 kg ⇒ dưới biên kg, không khép", () => {
    const c = contractClosure(closedShipmentData({ cartons: 1700, netKg: 17000, amount: 160000 }), "c1");
    expect(c).toMatchObject({ closed: false, reason: "out-of-tolerance" });
    expect(c.kgDeviationPct).toBeGreaterThanOrEqual(-10.6);
    expect(c.kgDeviationPct).toBeLessThanOrEqual(-10.5);
  });
  it("ghép giả định lô 165 vào HĐ 18.26: lệch +16,9% kg và +12,8% tiền ⇒ không tự khép", () => {
    const c = contractClosure(closedShipmentData({ cartons: 2251, netKg: 22214, amount: 194557.6 }), "c1");
    expect(c.closed).toBe(false);
    expect(c.reason).toBe("out-of-tolerance");
    expect(c.kgDeviationPct).toBeGreaterThanOrEqual(16.9);
    expect(c.kgDeviationPct).toBeLessThanOrEqual(17.0);
    expect(c.amountDeviationPct).toBeGreaterThanOrEqual(12.8);
    expect(c.amountDeviationPct).toBeLessThanOrEqual(12.9);
  });
  it("tiền lệch dù kg đúng ⇒ vẫn không khép (dung sai áp cả hai)", () => {
    expect(contractClosure(closedShipmentData({ cartons: 1900, netKg: 19000, amount: 200000 }), "c1").reason).toBe("out-of-tolerance");
  });
  it("đóng tay ⇒ khép, lý do manual", () => {
    const d = closedShipmentData({ cartons: 2251, netKg: 22214, amount: 194557.6 });
    const manual = { ...d, contracts: [{ ...d.contracts[0], status: "closed" as const, closeReason: "khách xác nhận" }] };
    expect(contractClosure(manual, "c1")).toMatchObject({ closed: true, reason: "manual" });
  });
  it("độ phủ: HĐ 19.000 kg, 1 cont, lên 15.000 kg ⇒ thiếu 2.100 kg, không phải lệch dung sai", () => {
    const d = data({
      contracts: [contract("c1")],
      revisions: [revision("r0", "c1", 0)],
      approvals: [approval("r0", "c1", "approved")],
      shipments: [shipment("s1", "c1", { plannedKg: 15000 })],
    });
    expect(contractCoverage(d, "c1")).toEqual({ missingKg: 2100, missingContainers: 0, covered: false });
    expect(contractClosure(d, "c1").reason).not.toBe("out-of-tolerance");
  });
});

describe("NV13 · xóa / hủy (AC-28)", () => {
  it("HĐ chưa duyệt chưa chuyến xóa được; có chuyến thì không", () => {
    expect(canDeleteContract(data({ contracts: [contract("a")] }), "a").ok).toBe(true);
    expect(canDeleteContract(data({ contracts: [contract("b")], shipments: [shipment("s", "b")] }), "b").ok).toBe(false);
  });
  it("HĐ có chuyến đã có số cont ⇒ không hủy được", () => {
    const d = data({ contracts: [contract("c")], shipments: [shipment("s", "c", { containerNo: "SZLU9522312" })] });
    expect(canCancel(d, "c")).toEqual({ ok: false, reason: "shipment-loaded" });
    expect(canCancel(data({ contracts: [contract("b")], shipments: [shipment("s", "b")] }), "b").ok).toBe(true);
  });
});

describe("NV11 · tháng, tra cứu, Excel (AC-24…AC-26)", () => {
  const today = "2026-10-15";
  function monthData(): ExportData {
    const closed = closedShipmentData({ cartons: 1900, netKg: 19000, amount: 172445 }, { planMonth: "2026-10", loadingDate: "2026-10-05", etd: "2026-10-06", bookingNo: "BK1" });
    closed.items.forEach((i) => i.docKind === "bill-of-lading" && (i.onBoardDate = "2026-10-06"));
    const c2 = contract("c2", { customerId: "kr", contractNo: "K-01" });
    const c3 = contract("c3", { customerId: "kr", contractNo: "K-02" });
    const c4 = contract("c4", { customerId: "kr", contractNo: "K-03" });
    return {
      ...closed,
      contracts: [...closed.contracts, c2, c3, c4],
      revisions: [
        ...closed.revisions.map((r) => ({ ...r, terms: terms({ latestShipmentDate: "2026-10-31" }) })),
        revision("r2", "c2", 0, { terms: terms({ latestShipmentDate: "2026-10-30" }) }),
        revision("r3", "c3", 0, { terms: terms({ latestShipmentDate: "2026-10-10" }) }),
        revision("r4", "c4", 0, { terms: terms({ latestShipmentDate: "2026-09-20" }) }),
      ],
      approvals: [...closed.approvals, approval("r2", "c2", "approved"), approval("r3", "c3", "approved"), approval("r4", "c4", "approved")],
      shipments: [
        ...closed.shipments,
        shipment("s2", "c2", { planMonth: "2026-10", loadingDate: "2026-10-20", etd: "2026-10-21", lotCode: "K012" }),
        shipment("s3", "c3", { planMonth: "2026-10", etd: "2026-10-12", lotCode: "K013" }),
      ],
    };
  }
  const customers = [
    { id: "scm", name: "SEACHEMOT" },
    { id: "kr", name: "Korea Foods" },
  ];

  it("gom 2 khách, 3 chuyến; HĐ hạn 20/09 chưa lên chuyến hiện ở tháng 10 nhãn trễ; 4 con số", () => {
    const plan = buildMonthPlan("2026-10", monthData(), customers, today);
    expect(plan.groups).toHaveLength(2);
    expect(plan.stats).toEqual({ shipments: 3, closed: 1, missingSteps: 2, lateShipments: 1, overdueContractsWithoutShipment: 1 });
    expect(plan.pendingContracts.find((p) => p.contract.id === "c4")?.overdue).toBe(true);
  });

  it("HĐ quá hạn chưa lên chuyến KHÔNG hiện ở tháng khác tháng hiện tại", () => {
    const plan = buildMonthPlan("2026-11", monthData(), customers, today);
    expect(plan.pendingContracts.map((p) => p.contract.id)).not.toContain("c4");
  });

  it("tra theo mã lô, số cont, số invoice, số B/L, số HĐ đều ra đúng chuyến", () => {
    const d = closedShipmentData({ cartons: 2251, netKg: 22214, amount: 194557.6 }, { lotCode: "165" });
    const withNos = { ...d, items: d.items.map((i) => (i.docKind === "commercial-invoice" ? { ...i, number: "234/26" } : i.docKind === "bill-of-lading" ? { ...i, number: "PAPTYO260926224" } : i)) };
    for (const q of ["165", "szlu 9522312", "234/26", "PAPTYO260926224", "18.26/bsf"]) expect(searchShipments(withNos, q).map((s) => s.id), q).toEqual(["s1"]);
    expect(searchShipments(withNos, "")).toEqual([]);
  });

  it("Excel đúng cột sổ cũ; hai chuyến cùng booking gộp một dòng CONT 40+20", () => {
    const d = monthData();
    const extra = [
      shipment("s40", "c2", { planMonth: "2026-10", loadingDate: "2026-10-25", etd: "2026-10-26", bookingNo: "BKX", kind: "40RF" }),
      shipment("s20", "c2", { planMonth: "2026-10", loadingDate: "2026-10-25", etd: "2026-10-26", bookingNo: "bkx", kind: "20RF" }),
    ];
    const d2 = { ...d, shipments: [...d.shipments, ...extra] };
    const xl = buildMonthExcel(buildMonthPlan("2026-10", d2, customers, today), d2);
    expect(xl.header).toEqual(["CONT", "Khách hàng", "Mặt hàng", "Lượng (kg)", "MSL", "Cảng đến", "Số booking", "Ngày đóng cont", "ETD", "Đơn giá", "Bao bì", "Thực xuất (kg)", "Giá trị (USD)", "Ghi chú", "Loại hàng"]);
    const ships = xl.rows.filter((r) => r.kind === "shipment");
    expect(ships).toHaveLength(4);
    expect(ships.some((r) => r.cells[0] === "40+20")).toBe(true);
    // Tuần LỊCH T2 → CN như sổ cũ ("T2 (06-12/01)"): 01/10/2026 là thứ Năm ⇒ T1 = 01–04, ngày 05 thuộc T2 = 05–11.
    expect(xl.rows[0]).toEqual({ kind: "week", cells: ["T2 (05-11/10)"] });
  });
});

// ---------- Bổ sung sau audit 2026-10-20 (ba-spec 41 v4 · AC-30…AC-38) ----------

describe("Kỳ xem tháng · tuần · khoảng ngày (AC-30)", () => {
  it("tuần lịch T2 → CN; khoảng ngày đảo đầu nếu chọn ngược; dịch kỳ", () => {
    expect(weekPeriod("2026-10-15")).toMatchObject({ kind: "week", from: "2026-10-12", to: "2026-10-18" });
    expect(weekPeriod("2026-10-12").from).toBe("2026-10-12");
    expect(weekPeriod("2026-10-18").from).toBe("2026-10-12");
    expect(rangePeriod("2026-10-20", "2026-10-01")).toMatchObject({ from: "2026-10-01", to: "2026-10-20" });
    expect(shiftPeriod(weekPeriod("2026-10-15"), 1)).toMatchObject({ from: "2026-10-19", to: "2026-10-25" });
    expect(shiftPeriod(monthPeriod("2026-12"), 1)).toMatchObject({ from: "2027-01-01", to: "2027-01-31" });
    expect(shiftPeriod(rangePeriod("2026-10-01", "2026-10-10"), 1)).toMatchObject({ from: "2026-10-11", to: "2026-10-20" });
  });
  it("chuyến thuộc kỳ theo ngày đóng ?? ETD; chỉ có tháng KH thì thuộc kỳ chạm tháng đó", () => {
    const p = rangePeriod("2026-10-05", "2026-10-11");
    expect(shipmentInPeriod({ loadingDate: "2026-10-05", etd: "2026-10-20", planMonth: "2026-10" }, p)).toBe(true);
    expect(shipmentInPeriod({ loadingDate: "", etd: "2026-10-12", planMonth: "2026-10" }, p)).toBe(false);
    expect(shipmentInPeriod({ loadingDate: "", etd: "", planMonth: "2026-10" }, p)).toBe(true);
    expect(shipmentInPeriod({ loadingDate: "", etd: "", planMonth: "2026-11" }, p)).toBe(false);
  });
  it("tháng qua buildPeriodPlan ra y như buildMonthPlan cũ; lọc khách thì 4 con số cũng theo khách", () => {
    const d = (() => {
      const c = closedShipmentData({ cartons: 1900, netKg: 19000, amount: 172445 }, { planMonth: "2026-10", loadingDate: "2026-10-05", etd: "2026-10-06" });
      const c2 = contract("c2", { customerId: "kr", contractNo: "K-01" });
      return {
        ...c,
        contracts: [...c.contracts, c2],
        revisions: [...c.revisions, revision("r2", "c2", 0, { terms: terms({ latestShipmentDate: "2026-10-30" }) })],
        approvals: [...c.approvals, approval("r2", "c2", "approved")],
        shipments: [...c.shipments, shipment("s2", "c2", { planMonth: "2026-10", loadingDate: "2026-10-20" })],
      };
    })();
    const cs = [
      { id: "scm", name: "Seachemot" },
      { id: "kr", name: "KR" },
    ];
    const all = buildPeriodPlan(monthPeriod("2026-10"), d, cs, "2026-10-15");
    expect(all.stats.shipments).toBe(2);
    expect(buildMonthPlan("2026-10", d, cs, "2026-10-15").stats).toEqual(all.stats);
    const onlyKr = buildPeriodPlan(monthPeriod("2026-10"), d, cs, "2026-10-15", undefined, "kr");
    expect(onlyKr.groups.map((g) => g.customerId)).toEqual(["kr"]);
    expect(onlyKr.stats).toMatchObject({ shipments: 1, closed: 0, missingSteps: 1 });
    const week = buildPeriodPlan(weekPeriod("2026-10-05"), d, cs, "2026-10-15");
    expect(week.stats.shipments).toBe(1);
  });
});

describe("Dòng hàng nối danh mục mặt hàng (AC-31, AC-32)", () => {
  it("dòng có nội dung mà chưa có productId là chưa nối", () => {
    const ls = [{ ...LINES_1826[0], productId: "p1" }, LINES_1826[1], { ...LINES_1826[2], description: "", quantity: null }];
    expect(unmappedLines(ls).map((l) => l.id)).toEqual([LINES_1826[1].id]);
  });
  it("gợi ý mặt hàng theo tên tiếng Anh đã nối ở HĐ trước, ưu tiên cùng khách", () => {
    const other = contract("c9", { customerId: "kr", contractNo: "K-9" });
    const d = {
      contracts: [contract("c1"), other],
      revisions: [
        revision("r1", "c1", 0, { lines: [{ ...LINES_1826[0], productId: "p-scm" }], createdAt: "2026-08-01T00:00:00Z" }),
        revision("r9", "c9", 0, { lines: [{ ...LINES_1826[0], productId: "p-kr" }], createdAt: "2026-09-01T00:00:00Z" }),
      ],
    };
    expect(suggestProductId(d, "  iwadako BLANCHED cut 2-3g ", "scm")).toBe("p-scm");
    expect(suggestProductId(d, "Iwadako blanched cut 2-3g", "khac")).toBe("p-kr");
    expect(suggestProductId(d, "Tên chưa từng nối", "scm")).toBe("");
  });
  it("HĐ trước cùng tên KHÁC size không làm gợi ý (iwadako 5-5.5 gr ≠ 6-7 gr)", () => {
    const d = {
      contracts: [contract("c1")],
      revisions: [revision("r1", "c1", 0, { lines: [{ ...LINES_1826[0], size: "5-5.5 gr/pc", productId: "p-55" }] })],
    };
    expect(suggestProductId(d, LINES_1826[0].description, "scm", [], { size: "6-7 gr/pc" })).toBe("");
    expect(suggestProductId(d, LINES_1826[0].description, "scm", [], { size: "5-5.5  gr/pc" })).toBe("p-55");
    expect(suggestProductId(d, LINES_1826[0].description, "scm")).toBe("p-55");
  });
  it("applyProductMapping: dòng không có trong bản nháp giữ nối cũ; bản chờ duyệt nhận nối cho dòng cùng tên + size còn trống", () => {
    const l0 = { ...LINES_1826[0], productId: "p-old" };
    const l1 = { ...LINES_1826[1] };
    const eff = revision("r0", "c1", 0, { lines: [l0, l1] });
    const pend = revision("r1", "c1", 1, { lines: [{ ...l1, id: "x1" }, { ...l0, id: "x0", productId: "p-keep" }] });
    const out = applyProductMapping([eff, pend], "r0", { [l1.id]: "p-new" });
    expect(out[0].lines.map((l) => l.productId)).toEqual(["p-old", "p-new"]);
    expect(out[1].lines.map((l) => l.productId)).toEqual(["p-new", "p-keep"]);
  });
});

describe("Trễ hạn giao n ngày (R15, nhãn v5 c)", () => {
  it("lô 165: hạn 05/09, on board 26/09 ⇒ trễ 21 ngày; chưa ngày giao ⇒ không trễ", () => {
    const d = closedShipmentData({ cartons: 2251, netKg: 22214, amount: 194557.6 });
    expect(shipmentLateInfo(d, d.shipments[0])).toEqual({ late: true, days: 21, deadline: "2026-09-05", deliveredOn: "2026-09-26" });
    const d2 = data({ ...d, items: [], shipments: [{ ...d.shipments[0], etd: "" }] });
    expect(shipmentLateInfo(d2, d2.shipments[0]).late).toBe(false);
  });
});

describe("Gợi ý nối theo 4 bậc — tên theo khách, lịch sử, tên mặc định (AC-40 — R23 v6)", () => {
  const products = [
    { id: "p-55", tradeName: "" },
    { id: "p-67", tradeName: "" },
    { id: "p-a", tradeName: "Frozen Tako tip boiled" },
    { id: "p-x", tradeName: "" },
    { id: "p-hist" },
  ];
  const names = [
    { customerId: "scm", productId: "p-55", tradeName: "Frozen iwadako boiled cut", sizeText: "5-5.5 gr/pc" },
    { customerId: "scm", productId: "p-67", tradeName: "Frozen iwadako boiled cut", sizeText: "6-7 gr/pc" },
  ];
  const d = {
    contracts: [contract("c1")],
    revisions: [revision("r1", "c1", 0, { lines: [{ ...LINES_1826[0], description: "Frozen Tako tip raw", productId: "p-hist" }] })],
  };
  it("bậc 1 tên + size tách hai size cùng tên; bậc 2 ra hai mặt hàng ⇒ không điền", () => {
    expect(suggestProductId(d, "frozen  iwadako BOILED cut", "scm", products, { size: "6-7  GR/pc", names })).toBe("p-67");
    expect(suggestProductId(d, "Frozen iwadako boiled cut", "scm", products, { size: "5-5.5 gr/pc", names })).toBe("p-55");
    expect(suggestProductId(d, "Frozen iwadako boiled cut", "scm", products, { size: "", names })).toBe("");
  });
  it("bậc 3 lịch sử nối, bậc 4 tên mặc định khớp đúng một", () => {
    expect(suggestProductId(d, "Frozen Tako tip raw", "scm", products, { names })).toBe("p-hist");
    expect(suggestProductId(d, "Frozen Tako tip boiled", "mat", products, { names })).toBe("p-a");
    expect(suggestProductId(d, "Tên chưa ai dùng", "scm", products, { names })).toBe("");
  });
  it("tên của khách khác không dùng cho khách này", () => {
    expect(suggestProductId(d, "Frozen iwadako boiled cut", "mat", products, { size: "6-7 gr/pc", names })).toBe("");
  });
  it("danh sách chọn: mục khớp tên của khách rồi tên mặc định đứng đầu", () => {
    const ranked = rankProductsForLine("Frozen iwadako boiled cut", products, "scm", { names }).map((p) => p.id);
    expect(ranked.slice(0, 2).sort()).toEqual(["p-55", "p-67"]);
    expect(rankProductsForLine("Frozen Tako tip boiled", products, "scm", { names })[0].id).toBe("p-a");
    expect(rankProductsForLine("", products).map((p) => p.id)).toEqual(["p-55", "p-67", "p-a", "p-x", "p-hist"]);
  });
});

describe("Trích xuất từ chứng từ — quét mọi HĐ của khách (AC-50 — NV16 · R26)", () => {
  let k = 0;
  const id = () => `n-${++k}`;
  const mapped = (desc: string, size: string, productId: string) => ({ ...LINES_1826[0], id: `l-${desc}-${size}`, description: desc, size, productId });
  const d = {
    contracts: [
      contract("c1", { signedOn: "2026-07-30", contractNo: "18.26/BSF-SCM.2026" }),
      contract("c2", { signedOn: "2026-09-01", contractNo: "21.26/BSF-SCM.2026" }),
      contract("c3", { signedOn: "2026-09-10", contractNo: "HUY", status: "cancelled" }),
      contract("c9", { customerId: "khac", contractNo: "K-9" }),
    ],
    revisions: [
      revision("r1", "c1", 0, { lines: [mapped("Frozen iwadako boiled cut", "5-5.5 gr/pc", "p-55"), mapped("Frozen Tako tip raw", "", "p-tip")] }),
      revision("r2", "c2", 0, { lines: [mapped("Frozen iwadako boiled cut", "6-7 gr/pc", "p-67"), mapped("Tên khác", "", "p-55"), { ...LINES_1826[1], productId: undefined }] }),
      revision("r3", "c3", 0, { lines: [mapped("Từ HĐ hủy", "", "p-huy")] }),
      revision("r9", "c9", 0, { lines: [mapped("Của khách khác", "", "p-k")] }),
    ],
    approvals: [],
  };
  it("thêm tên còn thiếu từ mọi HĐ chưa hủy của khách, HĐ ký trước thắng, không ghi đè", () => {
    const existing = [{ id: "e1", customerId: "scm", productId: "p-tip", tradeName: "Tako tip (cũ)", sizeText: "", packing: "", hsCode: "", note: "" }];
    const r = extractCustomerNamesFromContracts(d, existing, "scm", id);
    expect(r.contractCount).toBe(2);
    expect(r.created.map((c) => [c.productId, c.tradeName, c.note])).toEqual([
      ["p-55", "Frozen iwadako boiled cut", "Trích xuất từ HĐ 18.26/BSF-SCM.2026"],
      ["p-67", "Frozen iwadako boiled cut", "Trích xuất từ HĐ 21.26/BSF-SCM.2026"],
    ]);
  });
  it("chạy lại sau khi đã thêm ⇒ 0 dòng mới", () => {
    const first = extractCustomerNamesFromContracts(d, [], "scm", id).created;
    expect(extractCustomerNamesFromContracts(d, first, "scm", id).created).toEqual([]);
  });
});

describe("Chứng từ: tự cấp, bảo hiểm CIF, mục bắt buộc không xóa (AC-33…AC-35)", () => {
  const s = shipment("s1", "c1");
  it("H/C công ty tự cấp không bắt số chứng từ; chứng từ thường vẫn bắt", () => {
    const hc = item("s1", "document", { docKind: "health-certificate", docIssuer: "công ty tự cấp", issuedOn: "2026-09-25" });
    const co = item("s1", "document", { docKind: "certificate-of-origin", docForm: "VJ", issuedOn: "2026-09-25" });
    const d = data({ shipments: [s], items: [hc, co], files: [file("s1", "document", hc.id), file("s1", "document", co.id)] });
    expect(canMarkDone(hc, d).ok).toBe(true);
    expect(canMarkDone(co, d).missing).toEqual(["number"]);
  });
  it("CIF / CIP tự thêm mục bảo hiểm; CFR thì không", () => {
    const cif = missingDocumentItems("s1", { requiredDocuments: [], incoterm: "CIF" }, [], nid, T0);
    expect(cif.map((i) => i.docKind)).toEqual(["commercial-invoice", "insurance"]);
    expect(missingDocumentItems("s1", { requiredDocuments: [], incoterm: "CFR" }, [], nid, T0).map((i) => i.docKind)).toEqual(["commercial-invoice"]);
  });
  it("mục theo chứng từ khách yêu cầu là bắt buộc; mục thêm tay thì không", () => {
    const t = terms();
    expect(isRequiredDocumentItem(t, { docKind: "certificate-of-origin", docForm: "vj" })).toBe(true);
    expect(isRequiredDocumentItem(t, { docKind: "commercial-invoice", docForm: "" })).toBe(true);
    expect(isRequiredDocumentItem(t, { docKind: "sample-invoice", docForm: "" })).toBe(false);
    expect(isRequiredDocumentItem({ ...t, incoterm: "CIP" }, { docKind: "insurance", docForm: "" })).toBe(true);
  });
});

describe("Nhãn: duyệt sau khi sửa, chiều lệch dung sai, tra HĐ chưa chuyến (AC-36…AC-38)", () => {
  it("bản bị 'yêu cầu sửa' rồi được sửa sau đó ⇒ hiện Chờ duyệt; chưa sửa thì vẫn yêu cầu sửa", () => {
    const ap = { ...approval("r0", "c1", "needs-revision", "2026-08-05", "ghi rõ dung sai"), createdAt: "2026-08-05T00:00:00Z" };
    const d = { approvals: [ap] };
    expect(revisionApprovalLabelState(d, { id: "r0", createdAt: "2026-08-12T00:00:00Z" })).toBe("pending");
    expect(revisionApprovalLabelState(d, { id: "r0", createdAt: "2026-08-01T00:00:00Z" })).toBe("needs-revision");
  });
  it("lệch dung sai nói chiều thừa / thiếu", () => {
    expect(deviationText(16.916)).toBe("thừa 16,9%");
    expect(deviationText(-10.53)).toBe("thiếu 10,5%");
  });
  it("tra số HĐ / số đơn / khách ra cả HĐ chưa lên chuyến", () => {
    const d = data({ contracts: [contract("c1"), contract("c2", { contractNo: "TEST-G 11.26", customerId: "mtd", orderRef: "" })] });
    expect(searchContracts(d, "test-g").map((c) => c.id)).toEqual(["c2"]);
    expect(searchContracts(d, "b182").map((c) => c.id)).toEqual(["c1"]);
    expect(searchContracts(d, "matsu", [{ id: "mtd", name: "Matsuda" }]).map((c) => c.id)).toEqual(["c2"]);
  });
});

describe("v9.1 · danh mục loại chứng từ (mig 0081, R37)", () => {
  const ids = (() => {
    let n = 0;
    return () => `x${++n}`;
  })();
  it("AC-68: danh mục trống ⇒ đủ 10 loại hệ thống, tên gốc", () => {
    const list = documentKindList([]);
    expect(list).toHaveLength(10);
    expect(list.every((k) => k.isSystem)).toBe(true);
    expect(documentKindLabel("commercial-invoice")).toBe("Commercial Invoice");
  });
  it("AC-69: thêm loại mới theo tên ⇒ id doc-…, hiện sau 10 loại hệ thống; gõ trùng tên (khác hoa thường) ⇒ trả loại có sẵn", () => {
    const a = findOrCreateDocumentKind("Giấy chứng nhận Halal", [], ids);
    expect(a.created).toBe(true);
    expect(a.id.startsWith("doc-")).toBe(true);
    expect(documentKindList(a.rows).map((k) => k.name).indexOf("Giấy chứng nhận Halal")).toBe(10);
    const again = findOrCreateDocumentKind("  giấy chứng nhận HALAL ", a.rows, ids);
    expect(again).toMatchObject({ id: a.id, created: false });
    expect(again.rows).toHaveLength(1);
    const sys = findOrCreateDocumentKind("packing list", a.rows, ids);
    expect(sys).toMatchObject({ id: "packing-list", created: false });
  });
  it("AC-70: đổi tên loại hệ thống ⇒ nhãn đổi theo, id giữ nguyên; trả về tên gốc ⇒ không còn dòng lưu", () => {
    const list = documentKindList([]).map((k) => (k.id === "certificate-of-origin" ? { ...k, name: "C/O (giấy chứng nhận xuất xứ)" } : k));
    const rows = documentKindRowsFromList(list);
    expect(rows).toEqual([{ id: "certificate-of-origin", name: "C/O (giấy chứng nhận xuất xứ)", sortOrder: 4, note: "" }]);
    expect(requiredDocumentLabel({ kind: "certificate-of-origin", form: "VJ", issuer: "" }, rows)).toBe("C/O (giấy chứng nhận xuất xứ) form VJ");
    expect(documentKindRowsFromList(documentKindList([]))).toEqual([]);
  });
  it("AC-71: loại tự thêm có luật như Chứng từ khác; id lạ (bảng chưa nạp) ⇒ tên Chứng từ khác", () => {
    const it5 = { ...item("s1", "document"), docKind: "doc-x9", number: "", issuedOn: "" };
    const d = data({ shipments: [shipment("s1", "c1")], items: [it5] });
    expect(canMarkDone(it5, d)).toMatchObject({ ok: false, missing: ["number", "issuedOn", "file"] });
    expect(documentKindLabel("doc-x9")).toBe("Chứng từ khác");
  });
});

describe("chép dòng hàng HĐ (2026-10-30)", () => {
  const base = {
    id: "l1", description: "Frozen octopus", hsCode: "0307", size: "1-2kg", packing: "10kg/ctn", unitKind: "carton" as const,
    cartonsPerUnit: 1, netKgPerCarton: 10, quantity: 100, kg: null, unitPrice: 5.2, microSpec: "TPC<1e5", productId: "p1",
  };
  it("giữ mọi thông tin, chỉ đổi id và để trống size", () => {
    const c = copyContractLine(base, "l9");
    expect(c).toEqual({ ...base, id: "l9", size: "" });
    expect(base.size).toBe("1-2kg");
  });
  it("bản chép nằm ngay dưới dòng gốc", () => {
    const lines = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(insertCopiedLine(lines, "b", { id: "x" }).map((l) => l.id)).toEqual(["a", "b", "x", "c"]);
    expect(insertCopiedLine(lines, "zz", { id: "x" }).map((l) => l.id)).toEqual(["a", "b", "c", "x"]);
  });
});

describe("cột Loại hàng trong Excel (mig 0089)", () => {
  const g = [
    { id: "one-skin", name: "1 da", sortOrder: 10, note: "" },
    { id: "mada", name: "Mada", sortOrder: 30, note: "" },
  ];
  const line = (id: string, goodsTypeId?: string) => ({
    id, description: "x", hsCode: "", size: "", packing: "", unitKind: "carton" as const, cartonsPerUnit: 1,
    netKgPerCarton: null, quantity: null, kg: null, unitPrice: null, microSpec: "", ...(goodsTypeId ? { goodsTypeId } : {}),
  });
  it("tên theo thứ tự dòng, không lặp; dòng chưa chọn / loại đã xóa bỏ qua", () => {
    expect(lineGoodsTypeNames([line("a", "mada"), line("b", "one-skin"), line("c", "mada"), line("d"), line("e", "gone")], g)).toBe("Mada; 1 da");
    expect(lineGoodsTypeNames([], g)).toBe("");
  });
});
