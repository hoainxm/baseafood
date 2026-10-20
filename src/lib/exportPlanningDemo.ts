// ============================================================
// Tên file: src/lib/exportPlanningDemo.ts
// Tên tiếng Việt: Bộ số demo của module Xuất khẩu (chế độ demo — luật 15)
// Description: Builds a deterministic export-planning demo set mirroring the cases run in the
//              2026-10-20 audit with the real SCM dossier (contract 18.26, lot 165 / INV 234/26,
//              LSX 17.09 / lot 181, LXH 02.01 40+20, L/C + truck, overdue, rejected) — placeholder
//              files only, dates relative to "today" so the demo stays current.
// ============================================================
// R14 (ba-spec 41): bộ demo KHÔNG chép file thật — file dùng đường dẫn giữ chỗ
// `demo-placeholder/…`, chỉ tính là bằng chứng trong `site-demo`. Số dòng hàng HĐ 18.26 và lô 165
// lấy theo hồ sơ thật (để trình diễn đúng con số khách quen); ghép lô 165 vào HĐ 18.26 là GIẢ ĐỊNH
// (như ba-spec AC-21). Không ghi tên người thật — người ký demo là "Giám đốc (demo)".
import { subtractDays } from "./dataFlow";
import { DEMO_PLACEHOLDER_PREFIX, blankItem, emptyTerms, missingDocumentItems, type ExportData } from "./exportPlanning";
import type {
  Customer,
  ExportContract,
  ExportContractApproval,
  ExportContractLine,
  ExportContractRevision,
  ExportContractTerms,
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

function line(id: string, description: string, quantity: number, netKgPerCarton: number, unitPrice: number, cartonsPerBundle?: number): ExportContractLine {
  return {
    id,
    description,
    hsCode: "",
    size: "",
    packing: cartonsPerBundle ? `${netKgPerCarton}kg/CTN x ${cartonsPerBundle}/Bundle` : `${netKgPerCarton}kg/CTN`,
    unitKind: cartonsPerBundle ? "bundle" : "carton",
    cartonsPerUnit: cartonsPerBundle ?? 1,
    netKgPerCarton,
    quantity,
    kg: null,
    unitPrice,
    microSpec: "",
  };
}

export type ExportDemoSet = { [K in keyof ExportData]: ExportData[K] extends readonly (infer T)[] ? T[] : never };

/**
 * 7 HĐ — đủ ca của buổi audit 2026-10-20:
 *  1. HĐ 18.26 (14 dòng thật) · BGĐ yêu cầu sửa → sửa → đồng ý · gia hạn · lô 165 đủ hồ sơ · ngoài
 *     dung sai (+16,9 % kg) ⇒ **Đã chốt HĐ** · cọc cấp HĐ + tiền về chuyến.
 *  2. HĐ theo LSX 17.09 (lô 181) · đủ hồ sơ trong dung sai ⇒ **Đã xuất đủ** · bản sửa 1 bị BGĐ từ chối.
 *  3. HĐ 2 cont theo LXH 02.01 · cont 40 + 20 cùng booking, cont 20 **dùng chung** Lệnh SX / bao bì.
 *  4. HĐ CIF · L/C · cọc 30 % · chở **xe tải** + **đóng ghép** · trễ hạn · 1 dòng **chưa nối** danh mục.
 *  5. HĐ **quá hạn chưa lên chuyến** (chờ duyệt).
 *  6. HĐ bản 0 bị BGĐ **từ chối** ⇒ hủy cả chuyến kế hoạch.
 *  7. HĐ mới lập, **chờ duyệt**.
 */
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
  const T = (days: number) => addDaysIso(today, days);
  let n = 0;
  const id = (t: string) => `dm-xk-${t}-${++n}`;
  const at = (date: string) => `${date}T08:00:00.000Z`;
  const kh = (i: number) => customers[i % customers.length].id;
  const placeholder = (name: string) => `${DEMO_PLACEHOLDER_PREFIX}${name}`;
  const APPROVER = "Giám đốc (demo)";

  let nextProduct = 0;
  type ContractOpts = { orderRef?: string; incoterm?: string; pod?: string; tolerance?: number; containerType?: string; paymentMethod?: ExportContractTerms["paymentMethod"]; lcNo?: string; depositPct?: number | null; note?: string; unmapped?: number[] };
  const contract = (no: string, customerId: string, signedOn: string, deadline: string, containers: number | null, lines: ExportContractLine[], o: ContractOpts = {}) => {
    const c: ExportContract = { id: id("hd"), customerId, contractNo: no, signedOn, orderRef: o.orderRef ?? "", status: "open", cancelReason: "", closeReason: "", note: o.note ?? "Hợp đồng demo", createdAt: at(signedOn) };
    const terms: ExportContractTerms = {
      ...emptyTerms(),
      incoterm: o.incoterm ?? "CFR",
      portOfLoading: "Cai Mep, Vietnam",
      portOfDischarge: o.pod ?? "Tokyo, Japan",
      tolerancePct: o.tolerance ?? 10,
      latestShipmentDate: deadline,
      containerCount: containers,
      containerType: o.containerType ?? "40RF",
      paymentMethod: o.paymentMethod ?? "ttr",
      lcNo: o.lcNo ?? "",
      depositPct: o.depositPct ?? null,
      requiredDocuments: DOCS.map((x) => ({ ...x })),
    };
    const r: ExportContractRevision = {
      id: id("ban"),
      contractId: c.id,
      revisionNo: 0,
      revisedOn: signedOn,
      changeSummary: "",
      terms,
      // Dòng hàng nối danh mục mặt hàng của bộ demo (Lệnh SX cần mặt hàng thật — R16); `unmapped` cố ý để trống.
      lines: lines.map((l, i) => (products.length && !o.unmapped?.includes(i) ? { ...l, productId: products[(nextProduct + i) % products.length].id } : l)),
      filePath: placeholder(`hd-${c.id}.pdf`),
      fileName: `HĐ ${no}.pdf`,
      recordedBy: "Demo",
      createdAt: at(signedOn),
    };
    nextProduct += lines.length;
    out.contracts.push(c);
    out.revisions.push(r);
    return { c, r };
  };
  const approve = (r: ExportContractRevision, decision: ExportContractApproval["decision"], on: string, reason = "") =>
    out.approvals.push({ id: id("duyet"), contractId: r.contractId, revisionId: r.id, decision, approverName: APPROVER, decidedOn: on, reason, filePath: decision === "approved" ? placeholder(`ky-${r.id}.pdf`) : "", fileName: decision === "approved" ? "Bản ký.pdf" : "", recordedBy: "Demo", createdAt: at(on) });

  const shipment = (c: ExportContract, terms: ExportContractTerms, over: Partial<ExportShipment>) => {
    const s: ExportShipment = {
      id: id("chuyen"),
      contractId: c.id,
      planMonth: (over.loadingDate || over.etd || today).slice(0, 7),
      kind: "40RF",
      goodsSummary: "Bạch tuộc các loại",
      plannedKg: null,
      lotCode: "",
      portOfDischarge: terms.portOfDischarge,
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
    out.items.push(...missingDocumentItems(s.id, terms, out.items, () => id("muc"), at(today)));
    return s;
  };

  const done = (s: ExportShipment, c: ExportContract, step: ExportStepItem["step"], patch: Partial<ExportStepItem> = {}) => {
    const existing = out.items.find((i) => i.shipmentId === s.id && i.step === step && (step !== "document" || i.docKind === patch.docKind));
    const it: ExportStepItem = { ...(existing ?? blankItem(s.id, step, id("muc"), at(today))), state: "done", number: "", issuedOn: s.loadingDate || today, ...patch };
    if (existing) out.items[out.items.indexOf(existing)] = it;
    else out.items.push(it);
    out.files.push({ id: id("file"), contractId: c.id, shipmentId: s.id, stepItemId: it.id, step, path: placeholder(`${step}-${it.id}.pdf`), fileName: `${step}.pdf`, layerNo: null, caption: "", uploadedBy: "Demo", createdAt: at(today) });
    return it;
  };
  /** Mục "dùng chung" trỏ tới mục đã xong của chuyến khác (cont ghép). */
  const share = (s: ExportShipment, step: ExportStepItem["step"], src: ExportStepItem) => {
    out.items.push({ ...blankItem(s.id, step, id("muc"), at(today)), sharedFromId: src.id, docKind: src.docKind, docForm: src.docForm, docIssuer: src.docIssuer });
  };
  const loadingFiles = (s: ExportShipment, c: ExportContract, photos: number) => {
    out.files.push({ id: id("file"), contractId: c.id, shipmentId: s.id, stepItemId: "", step: "loading-plan", path: placeholder(`so-do-${s.id}.xls`), fileName: "Sơ đồ container.xls", layerNo: null, caption: "", uploadedBy: "Thủ kho demo", createdAt: at(today) });
    for (let k = 1; k <= photos; k++)
      out.files.push({ id: id("anh"), contractId: c.id, shipmentId: s.id, stepItemId: "", step: "loading-photos", path: placeholder(`lop-${k}.jpg`), fileName: `Lớp ${k}.jpg`, layerNo: k, caption: "", uploadedBy: "Thủ kho demo", createdAt: at(today) });
  };
  const pay = (c: ExportContract, shipmentId: string, kind: ExportPayment["kind"], date: string, amount: number | null, method: string, note = "") =>
    out.payments.push({ id: id("tien"), contractId: c.id, shipmentId, kind, date, amount, currency: "USD", method, note, filePath: "", fileName: "", recordedBy: "Demo", createdAt: at(date) });
  const fullLoading = (s: ExportShipment, c: ExportContract, declarationNo: string, photos: number) => {
    for (const step of ["production-order", "packaging", "customs-declaration", "export-order"] as const)
      done(s, c, step, step === "customs-declaration" ? { number: declarationNo } : step === "packaging" ? { note: "Bao bì đã có sẵn" } : {});
    loadingFiles(s, c, photos);
  };

  /* ---- 1. HĐ 18.26 + lô 165 (số theo hồ sơ thật) ⇒ ngoài dung sai, đã chốt tay ---- */
  {
    const { c, r } = contract("18.26/BSF-SCM.2026", kh(0), T(-82), T(-45), 1, LINES_1826.map((l) => line(id("dong"), ...l)), { orderRef: "#B182", note: "Theo HĐ giấy rvs 12.08 (both signed)" });
    approve(r, "needs-revision", T(-76), "Ghi rõ dung sai ±10% lượng và tiền, C/O form VJ");
    r.createdAt = at(T(-70)); // đã sửa sau lần yêu cầu sửa ⇒ hiện Chờ duyệt rồi Đồng ý
    approve(r, "approved", T(-70));
    out.extensions.push({ id: id("giahan"), contractId: c.id, newDeadline: T(-20), confirmedOn: T(-49), note: "Email khách đồng ý giao trước hạn mới", filePath: "", fileName: "", recordedBy: "Demo", createdAt: at(T(-49)) });
    const loaded = T(-25);
    const s = shipment(c, r.terms, { lotCode: "165", goodsSummary: "Bạch tuộc các loại (iwadako, tako, iidako)", plannedKg: 22000, loadingDate: loaded, etd: T(-24), eta: T(-17), vesselVoyage: "MOL ENDOWMENT 105N", containerNo: "SZLU9522312", sealNo: "VN50853AT", note: "Container plan lô 165" });
    fullLoading(s, c, "30612345678", 25);
    done(s, c, "document", { docKind: "commercial-invoice", number: "234/26", cartons: 2251, netKg: 22214, amount: 194557.6 });
    done(s, c, "document", { docKind: "packing-list", number: "234/26" });
    done(s, c, "document", { docKind: "bill-of-lading", number: "PAPTYO260926224", onBoardDate: T(-24) });
    done(s, c, "document", { docKind: "health-certificate", docIssuer: "công ty tự cấp", number: "", note: "H/C không in số — lô 165" });
    done(s, c, "document", { docKind: "certificate-of-origin", docForm: "VJ", number: "VJ-165" });
    done(s, c, "document", { docKind: "expiry-list", number: "234/26" });
    done(s, c, "document", { docKind: "sample-invoice", number: "234M/26", note: "1 CTN · 13,80 kg · 27,60 USD (hàng mẫu)" });
    pay(c, "", "payment", T(-60), 50000, "TTR", "Cọc trước sản xuất (demo)");
    pay(c, s.id, "documents-sent", T(-23), null, "Email + DHL bản gốc");
    pay(c, s.id, "payment", T(-12), 144557.6, "TTR");
    c.status = "closed";
    c.closeReason = "Khách nhận thêm 16,9% kg của lô 165 — xác nhận qua email (demo)";
  }

  /* ---- 2. HĐ theo LSX 17.09 (lô 181) ⇒ đủ hồ sơ, trong dung sai — bản sửa 1 bị từ chối ---- */
  {
    const lines = [
      line(id("dong"), "Big iidako skewer 16-24g", 100, 4, 10.15, 2),
      line(id("dong"), "Iwadako boiled cut 4-5g", 100, 10, 11.2),
      line(id("dong"), "Tako tip boiled", 200, 12, 4.05),
      line(id("dong"), "Iidako whole cleaned sashimi 15-25g", 300, 10, 11.4),
    ];
    const { c, r } = contract("21.26/BSF-SCM.2026", kh(0), T(-49), T(-13), 1, lines, { tolerance: 5, note: "Theo LSX 17.09 · MSL 181" });
    approve(r, "approved", T(-47));
    const r1: ExportContractRevision = { ...r, id: id("ban"), revisionNo: 1, revisedOn: T(-10), changeSummary: "Phụ kiện 01: dòng 2 giảm còn 80 thùng", lines: r.lines.map((l, i) => (i === 1 ? { ...l, quantity: 80 } : l)), filePath: "", fileName: "", createdAt: at(T(-10)) };
    out.revisions.push(r1);
    approve(r1, "rejected", T(-9), "Khách chưa ký phụ kiện — giữ HĐ gốc");
    const loaded = T(-14);
    const s = shipment(c, r.terms, { lotCode: "181", goodsSummary: "Bạch tuộc xiên que, luộc, tip, NCLS", plannedKg: 7200, bookingNo: "DM-BK-181", loadingDate: loaded, etd: T(-13), eta: T(-6), vesselVoyage: "DEMO STAR 201N", containerNo: "DEMU1810001", sealNo: "DM181" });
    fullLoading(s, c, "30612345181", 18);
    done(s, c, "document", { docKind: "commercial-invoice", number: "250/26", cartons: 790, netKg: 7000, amount: 61500 });
    done(s, c, "document", { docKind: "packing-list", number: "250/26" });
    done(s, c, "document", { docKind: "bill-of-lading", number: "DMBL0181", onBoardDate: T(-13) });
    done(s, c, "document", { docKind: "health-certificate", docIssuer: "công ty tự cấp", note: "Lô 181" });
    done(s, c, "document", { docKind: "certificate-of-origin", docForm: "VJ", number: "VJ-181" });
    pay(c, s.id, "documents-sent", T(-12), null, "Email");
  }

  /* ---- 3. HĐ 2 cont theo LXH 02.01: 40RF + 20RF cùng booking, cont 20 dùng chung ---- */
  {
    const lines = [
      line(id("dong"), "Tako neck boiled cut 1-2g", 200, 10, 4.05),
      line(id("dong"), "Tako tip raw", 50, 12, 2.15),
      line(id("dong"), "Iwadako blanched cut 5g", 200, 10, 10.5),
      line(id("dong"), "Iwadako blanched cut 2-3g bulk", 505, 10, 10.15),
      line(id("dong"), "Tako tip boiled", 200, 12, 4.05),
    ];
    const { c, r } = contract("02.26/BSF-SCM.2026", kh(1), T(-30), T(10), 2, lines, { containerType: "40RF + 20RF", note: "Theo LXH 02.01 — cont ghép 40+20" });
    approve(r, "approved", T(-28));
    const loaded = T(3);
    const s40 = shipment(c, r.terms, { kind: "40RF", lotCode: "006", goodsSummary: "Bạch tuộc các loại (40)", plannedKg: 9000, bookingNo: "DM-SGNECZ513400", loadingDate: loaded, etd: T(5) });
    const s20 = shipment(c, r.terms, { kind: "20RF", lotCode: "006", goodsSummary: "Bạch tuộc các loại (20)", plannedKg: 4500, bookingNo: "DM-SGNECZ513400", loadingDate: loaded, etd: T(5) });
    const lsx = done(s40, c, "production-order", { note: "LXH 02.01 — cont 20RF + 40RF" });
    const pkg = done(s40, c, "packaging", { note: "Bao bì đã có sẵn" });
    share(s20, "production-order", lsx);
    share(s20, "packaging", pkg);
  }

  /* ---- 4. HĐ CIF · L/C · cọc 30 % · xe tải + đóng ghép · trễ hạn · 1 dòng chưa nối ---- */
  {
    const { c, r } = contract("07.26/BSF-HTC.2026", kh(2), T(-40), T(-10), 1, [line(id("dong"), "Boiled octopus cut 10-15g", 2160, 10, 11.05), line(id("dong"), "Samples (consolidated)", 10, 10, 0)], {
      incoterm: "CIF",
      pod: "Hakata, Japan",
      tolerance: 5,
      paymentMethod: "lc",
      lcNo: "DM-LC-0001",
      depositPct: 30,
      unmapped: [1],
      note: "L/C + cọc 30% — chở xe tải ra cảng",
    });
    approve(r, "approved", T(-38));
    const truck = shipment(c, r.terms, { kind: "truck", lotCode: "017", goodsSummary: "Bạch tuộc cắt luộc (xe tải ra cảng)", plannedKg: 21600, bookingNo: "DM-235500390009", loadingDate: T(-9), etd: T(-8), eta: T(-4), containerNo: "72C-DEMO1" });
    done(truck, c, "packaging", { note: "Bao bì đã có sẵn" });
    shipment(c, r.terms, { kind: "consolidated", lotCode: "017M", goodsSummary: "Hàng mẫu đóng ghép", plannedKg: 100, loadingDate: T(-9), etd: T(-8) });
    pay(c, "", "payment", T(-35), 71604, "L/C — cọc 30%");
  }

  /* ---- 5. Quá hạn chưa lên chuyến (chờ duyệt) ---- */
  contract("11.26/BSF-MTD.2026", kh(3), T(-60), T(-30), 1, [line(id("dong"), "Boiled octopus cut 700-1000", 900, 10, 8.95)], { pod: "Osaka, Japan", tolerance: 5, note: "Quá hạn giao mà chưa lên chuyến" });

  /* ---- 6. BGĐ từ chối bản 0 ⇒ hủy HĐ và chuyến kế hoạch ---- */
  {
    const { c, r } = contract("05.26/BSF-PC.2026", kh(4), T(-19), T(5), 1, [line(id("dong"), "Frozen octopus blanched cut 3-4g", 2150, 10, 8.2)], { pod: "Niigata, Japan", tolerance: 0 });
    const s = shipment(c, r.terms, { lotCode: "201", plannedKg: 21500, goodsSummary: "Bạch tuộc chần" });
    approve(r, "rejected", T(-15), "Giá thấp hơn giá thành — không ký");
    c.status = "cancelled";
    c.cancelReason = "Giá thấp hơn giá thành — không ký";
    s.status = "cancelled";
    s.cancelReason = c.cancelReason;
  }

  /* ---- 7. Mới lập, chờ BGĐ ký ---- */
  contract("99.26/BSF-LK.2026", kh(5), today, T(40), 1, [line(id("dong"), "Tako karaage 10-15g", 100, 6, 7.95, 2)], { note: "Mới lập — chờ BGĐ ký" });

  return out;
}

/** 14 dòng HĐ 18.26/BSF-SCM.2026 (hồ sơ thật): [tên, số lượng, kg/thùng, đơn giá, thùng/kiện?]. */
const LINES_1826: [string, number, number, number, number?][] = [
  ["Frozen iwadako blanched cut 2-3g", 200, 10, 10.5],
  ["Frozen iwadako blanched cut 4g", 100, 10, 10.25],
  ["Frozen iwadako boiled cut 5-5.5g", 150, 10, 11.2],
  ["Frozen iwadako boiled cut 6-7g", 100, 10, 11.2],
  ["Frozen tako neck boiled cut 1-2g", 200, 10, 4.05],
  ["Frozen tako tip boiled", 200, 12, 4.05],
  ["Frozen tako tip raw", 50, 12, 2.15],
  ["Frozen tako karaage new powder 10-15g", 200, 10, 9.2],
  ["Frozen iwadako boiled cut 2 leg 16-20g", 200, 10, 10.9],
  ["Frozen iwadako sushi open cut 6-8g", 100, 7, 14.95],
  ["Frozen iidako open cut 25-35g", 100, 10, 8.1],
  ["Frozen big iidako skewer 16-24g", 100, 4, 10.15, 2],
  ["Frozen iidako whole cleaned sashimi 15-25g", 100, 10, 11.4],
  ["Dried seasoned eihire grade A", 100, 10, 15.8],
];
