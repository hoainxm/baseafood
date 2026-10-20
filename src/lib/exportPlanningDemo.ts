// ============================================================
// Tên file: src/lib/exportPlanningDemo.ts
// Tên tiếng Việt: Bộ số demo của module Xuất khẩu (chế độ demo — luật 15)
// Description: Builds a small deterministic export-planning demo set (3 contracts covering
//              closed / in-progress / pending states) with placeholder files (no real files).
// ============================================================
// R14 (ba-spec 41): bộ demo KHÔNG chép file thật — file dùng đường dẫn giữ chỗ
// `demo-placeholder/…`, chỉ tính là bằng chứng trong `site-demo`. Số không lấy từ sổ thật
// (module chưa có số thật để sinh), chỉ dựng đủ ca cho người trình diễn bấm thử.
import { subtractDays } from "./dataFlow";
import { DEMO_PLACEHOLDER_PREFIX, blankItem, emptyTerms, missingDocumentItems, type ExportData } from "./exportPlanning";
import type {
  Customer,
  ExportContract,
  ExportContractApproval,
  ExportContractLine,
  ExportContractRevision,
  ExportFile,
  ExportPayment,
  ExportShipment,
  ExportStepItem,
  Product,
} from "@/types";

const DOCS = [
  { kind: "commercial-invoice", form: "", issuer: "" },
  { kind: "packing-list", form: "", issuer: "" },
  { kind: "bill-of-lading", form: "", issuer: "" },
  { kind: "health-certificate", form: "", issuer: "công ty tự cấp" },
  { kind: "certificate-of-origin", form: "VJ", issuer: "" },
] as const;

function line(id: string, description: string, quantity: number, netKgPerCarton: number, unitPrice: number): ExportContractLine {
  return { id, description, hsCode: "", size: "", packing: `${netKgPerCarton}kg/CTN`, unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton, quantity, kg: null, unitPrice, microSpec: "" };
}

export type ExportDemoSet = { [K in keyof ExportData]: ExportData[K] extends readonly (infer T)[] ? T[] : never };

/** 3 HĐ: (A) đã khép kín, (B) đang đóng cont + còn thiếu 1 cont, (C) chờ duyệt chưa lên chuyến. */
export function buildExportDemo(customers: readonly Customer[], today: string, products: readonly Pick<Product, "id">[] = []): ExportDemoSet {
  const out = {
    contracts: [] as ExportContract[],
    revisions: [] as ExportContractRevision[],
    approvals: [] as ExportContractApproval[],
    extensions: [] as ExportDemoSet["extensions"],
    shipments: [] as ExportShipment[],
    items: [] as ExportStepItem[],
    files: [] as ExportFile[],
    payments: [] as ExportPayment[],
  };
  if (!customers.length) return out;
  const addDaysIso = (date: string, days: number) => subtractDays(date, -days);
  let n = 0;
  const id = (t: string) => `dm-xk-${t}-${++n}`;
  const at = (date: string) => `${date}T08:00:00.000Z`;
  const kh = (i: number) => customers[i % customers.length].id;
  const placeholder = (name: string) => `${DEMO_PLACEHOLDER_PREFIX}${name}`;

  let nextProduct = 0;
  const contract = (no: string, customerId: string, signedOn: string, deadline: string, containers: number, lines: ExportContractLine[], approved: boolean) => {
    const c: ExportContract = { id: id("hd"), customerId, contractNo: no, signedOn, orderRef: "", status: "open", cancelReason: "", closeReason: "", note: "Hợp đồng demo", createdAt: at(signedOn) };
    const r: ExportContractRevision = {
      id: id("ban"),
      contractId: c.id,
      revisionNo: 0,
      revisedOn: signedOn,
      changeSummary: "",
      terms: { ...emptyTerms(), incoterm: "CFR", portOfLoading: "Cái Mép", portOfDischarge: "Tokyo", tolerancePct: 10, latestShipmentDate: deadline, containerCount: containers, containerType: "40RF", requiredDocuments: DOCS.map((x) => ({ ...x })) },
      // Dòng hàng nối danh mục mặt hàng của bộ demo (Lệnh SX cần mặt hàng thật — luật lines-unmapped).
      lines: lines.map((l, i) => (products.length ? { ...l, productId: products[(nextProduct + i) % products.length].id } : l)),
      filePath: placeholder(`hd-${no}.pdf`),
      fileName: `HĐ ${no}.pdf`,
      recordedBy: "Demo",
      createdAt: at(signedOn),
    };
    nextProduct += lines.length;
    out.contracts.push(c);
    out.revisions.push(r);
    if (approved)
      out.approvals.push({ id: id("duyet"), contractId: c.id, revisionId: r.id, decision: "approved", approverName: "Giám đốc", decidedOn: signedOn, reason: "", filePath: placeholder(`ky-${no}.pdf`), fileName: `Bản ký ${no}.pdf`, recordedBy: "Demo", createdAt: at(signedOn) });
    return c;
  };

  const shipment = (c: ExportContract, over: Partial<ExportShipment>) => {
    const s: ExportShipment = {
      id: id("chuyen"),
      contractId: c.id,
      planMonth: (over.loadingDate ?? today).slice(0, 7),
      kind: "40RF",
      goodsSummary: "Bạch tuộc các loại",
      plannedKg: null,
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
      createdAt: at(today),
      ...over,
    };
    out.shipments.push(s);
    out.items.push(...missingDocumentItems(s.id, { requiredDocuments: DOCS.map((x) => ({ ...x })) }, out.items, () => id("muc"), at(today)));
    return s;
  };

  const done = (s: ExportShipment, c: ExportContract, step: ExportStepItem["step"], patch: Partial<ExportStepItem> = {}) => {
    const existing = out.items.find((i) => i.shipmentId === s.id && i.step === step && (step !== "document" || i.docKind === patch.docKind));
    const it: ExportStepItem = { ...(existing ?? blankItem(s.id, step, id("muc"), at(today))), state: "done", number: "", issuedOn: s.loadingDate || today, ...patch };
    if (existing) out.items[out.items.indexOf(existing)] = it;
    else out.items.push(it);
    out.files.push({ id: id("file"), contractId: c.id, shipmentId: s.id, stepItemId: it.id, step, path: placeholder(`${step}-${it.id}.pdf`), fileName: `${step}.pdf`, layerNo: null, caption: "", uploadedBy: "Demo", createdAt: at(today) });
  };
  const loadingFiles = (s: ExportShipment, c: ExportContract, photos: number) => {
    out.files.push({ id: id("file"), contractId: c.id, shipmentId: s.id, stepItemId: "", step: "loading-plan", path: placeholder(`so-do-${s.id}.xls`), fileName: "Sơ đồ container.xls", layerNo: null, caption: "", uploadedBy: "Thủ kho demo", createdAt: at(today) });
    for (let k = 1; k <= photos; k++)
      out.files.push({ id: id("anh"), contractId: c.id, shipmentId: s.id, stepItemId: "", step: "loading-photos", path: placeholder(`lop-${k}.jpg`), fileName: `Lớp ${k}.jpg`, layerNo: k, caption: "", uploadedBy: "Thủ kho demo", createdAt: at(today) });
  };

  // (A) Đã xuất, đủ chứng từ, trong dung sai ⇒ khép kín.
  const loadedA = addDaysIso(today, -12);
  const a = contract("DM-01/2026", kh(0), addDaysIso(today, -50), addDaysIso(today, -5), 1, [line(id("dong"), "Bạch tuộc cắt luộc 5-7g", 1000, 10, 11.2), line(id("dong"), "Tip bạch tuộc luộc", 800, 12, 4.05)], true);
  const a1 = shipment(a, { lotCode: "D101", bookingNo: "DMBK0001", loadingDate: loadedA, etd: addDaysIso(loadedA, 1), eta: addDaysIso(loadedA, 8), plannedKg: 19600, containerNo: "DEMU1234567", sealNo: "DM00001", vesselVoyage: "DEMO STAR 001N" });
  for (const step of ["production-order", "packaging", "customs-declaration", "export-order"] as const) done(a1, a, step, step === "customs-declaration" ? { number: "30612345678" } : {});
  loadingFiles(a1, a, 6);
  done(a1, a, "document", { docKind: "commercial-invoice", number: "D01/26", cartons: 1795, netKg: 19500, amount: 147900 });
  done(a1, a, "document", { docKind: "packing-list", number: "D01/26" });
  done(a1, a, "document", { docKind: "bill-of-lading", number: "DMBL0001", onBoardDate: addDaysIso(loadedA, 1) });
  done(a1, a, "document", { docKind: "health-certificate", docIssuer: "công ty tự cấp", number: "HC-D01" });
  done(a1, a, "document", { docKind: "certificate-of-origin", docForm: "VJ", number: "VJ-D01" });
  out.payments.push(
    { id: id("tien"), contractId: a.id, shipmentId: a1.id, kind: "documents-sent", date: addDaysIso(loadedA, 2), amount: null, currency: "USD", method: "Email", note: "", filePath: "", fileName: "", recordedBy: "Demo", createdAt: at(today) },
    { id: id("tien"), contractId: a.id, shipmentId: a1.id, kind: "payment", date: addDaysIso(loadedA, 9), amount: 147900, currency: "USD", method: "TTR", note: "", filePath: "", fileName: "", recordedBy: "Demo", createdAt: at(today) },
  );

  // (B) 2 cont: chuyến 1 đang đóng (thiếu ảnh, tờ khai), chuyến 2 chưa lên ⇒ "còn thiếu 1 cont".
  const b = contract("DM-02/2026", kh(1), addDaysIso(today, -30), addDaysIso(today, 20), 2, [line(id("dong"), "Bạch tuộc 2 râu 16-20g", 2000, 10, 10.9), line(id("dong"), "Cổ bạch tuộc luộc 1-2g", 1800, 10, 4.05)], true);
  const loadedB = addDaysIso(today, 2);
  const b1 = shipment(b, { lotCode: "D102", bookingNo: "DMBK0002", loadingDate: loadedB, etd: addDaysIso(loadedB, 1), plannedKg: 19000 });
  done(b1, b, "production-order");
  done(b1, b, "packaging", { note: "Bao bì đã có sẵn" });

  // (C) Mới lập, chờ BGĐ ký — chưa lên chuyến.
  contract("DM-03/2026", kh(2), today, addDaysIso(today, 35), 1, [line(id("dong"), "Bạch tuộc tẩm bột karaage", 1200, 6, 7.95)], false);

  return out;
}
