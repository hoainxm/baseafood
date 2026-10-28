// ============================================================
// Tên file: src/lib/exportPlanningDemo.ts
// Tên tiếng Việt: Bộ số demo của module Xuất khẩu (chế độ demo — luật 15) + gói demo từ hồ sơ thật
// Description: Builds a deterministic export-planning demo set. Without a pack: 7 synthetic
//              contracts covering every case run in the 2026-10-20 audit (placeholder files).
//              With an `ExportDemoPack` (uploaded by an admin to the PRIVATE `export-files` bucket):
//              the same 7 cases use the real SCM dossier (contract 18.26, lot 165 / INV 234/26,
//              LSX 17.09, LXH 02.01, carton designs, container plan, loading photos) and every row
//              of the "Kế hoạch xuất hàng" ledger becomes a contract + shipment, shifted to recent months.
// ============================================================
// R14 (ba-spec 41 v4): số / file THẬT của khách chỉ đi qua GÓI DEMO trong kho file riêng (cần
// đăng nhập + quyền Xuất khẩu) — KHÔNG nằm trong mã nguồn (bản JS phát hành ai cũng tải được).
// Không gói ⇒ bộ demo dùng số tự đặt + file giữ chỗ `demo-placeholder/…`. Người ký luôn là
// "Giám đốc (demo)" — không ghi tên người thật.
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
  ExportActivity,
  ExportShipment,
  ExportShipmentKind,
  ExportStepItem,
  Product,
} from "@/types";

/* ---------- Gói demo (JSON trong kho file riêng) ---------- */

/** Một file thật của gói — `key` cho bộ sinh biết gắn vào đâu (nhiều file cùng key = một nhóm). */
export interface ExportDemoPackFile {
  key: string;
  /** Tên hiện cho người xem. */
  name: string;
  /** Đường dẫn trong bucket `export-files` (site-demo/export-files/demo-pack/<khu>/<tên>). */
  path: string;
}

/** Một dòng sổ "Kế hoạch xuất hàng" (đã gộp dòng con, đã bỏ dòng chép trùng cùng booking). */
export interface ExportDemoPackPlanRow {
  /** "20" | "40" | "40+20" | "Xe tải" | "Đóng ghép" | "" */
  cont: string;
  customer: string;
  goods: string;
  kg: number | null;
  /** Dòng con cùng cont (mặt hàng phụ). */
  extraLines: { goods: string; kg: number | null }[];
  msl: string;
  pod: string;
  booking: string;
  /** ISO — theo năm của sổ; bộ sinh dời sang tháng gần đây. */
  loading: string;
  etd: string;
}

/** HĐ 18.26 + lô 165 theo hồ sơ thật. */
export interface ExportDemoPackCase {
  contractNo: string;
  orderRef: string;
  customerName: string;
  /** [tên trên HĐ, số lượng, kg/thùng, đơn giá, thùng/kiện?] */
  lines: [string, number, number, number, number?][];
  lotCode: string;
  invoiceNo: string;
  cartons: number;
  netKg: number;
  amount: number;
  sampleInvoiceNo: string;
  blNo: string;
  containerNo: string;
  sealNo: string;
  vessel: string;
}

export interface ExportDemoPack {
  version: 1;
  /** Tháng cuối có số của sổ (yyyy-mm) — dời sao cho rơi vào tháng hiện tại. */
  planLastMonth: string;
  plan: ExportDemoPackPlanRow[];
  case1826: ExportDemoPackCase | null;
  files: ExportDemoPackFile[];
}

/** Đọc + kiểm sơ gói (JSON người dùng tải lên) — sai khuôn ⇒ null, không ném lỗi. */
export function parseExportDemoPack(raw: unknown): ExportDemoPack | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<ExportDemoPack>;
  if (p.version !== 1 || !Array.isArray(p.plan) || !Array.isArray(p.files) || typeof p.planLastMonth !== "string") return null;
  return { version: 1, planLastMonth: p.planLastMonth, plan: p.plan, case1826: p.case1826 ?? null, files: p.files };
}

/* ---------- Bộ sinh ---------- */

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

export type ExportDemoSet = { [K in keyof ExportData]: ExportData[K] extends readonly (infer T)[] ? T[] : never } & {
  /** Khách của sổ kế hoạch chưa có trong danh mục demo — bộ sinh thêm vào danh mục khách. */
  extraCustomers: Customer[];
};

export interface ExportDemoOptions {
  products?: readonly Pick<Product, "id">[];
  pack?: ExportDemoPack | null;
  /** Tên GỐC của `customers` (cùng thứ tự) — để khớp tên khách của gói khi bộ demo ẩn tên. */
  originalNames?: readonly string[];
  anonymize?: boolean;
  /** Hệ số đổi giá khi ẩn tên (như phần còn lại của bộ demo). */
  priceFactor?: number;
}

/** Ca 1 khi KHÔNG có gói: số tự đặt (không phải số của khách). */
const GENERIC_CASE: ExportDemoPackCase = {
  contractNo: "DM-01/2026",
  orderRef: "#DM01",
  customerName: "",
  lines: [
    ["Frozen octopus blanched cut 2-3g", 600, 10, 10.5],
    ["Frozen octopus boiled cut 5-6g", 500, 10, 11.2],
    ["Frozen octopus neck boiled cut", 400, 10, 4.05],
    ["Frozen octopus tip boiled", 300, 12, 4.05],
    ["Frozen octopus skewer 16-24g", 100, 4, 10.15, 2],
  ],
  lotCode: "D165",
  invoiceNo: "D01/26",
  cartons: 2190,
  netKg: 21560,
  amount: 168400,
  sampleInvoiceNo: "D01M/26",
  blNo: "DMBL0001",
  containerNo: "DEMU1234567",
  sealNo: "DM00001",
  vessel: "DEMO STAR 001N",
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
/** Dời ngày ISO thêm `months` tháng, giữ ngày (kẹp cuối tháng). */
export function shiftMonths(iso: string, months: number): string {
  if (!iso) return "";
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const t = y * 12 + (m - 1) + months;
  const ny = Math.floor(t / 12);
  const nm = (t % 12) + 1;
  return `${ny}-${pad2(nm)}-${pad2(Math.min(d, lastDay(ny, nm)))}`;
}
const monthIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

/** Giá demo theo nhóm hàng (sổ kế hoạch không ghi đơn giá) — USD/kg. */
function demoPrice(goods: string, i: number): number {
  const g = goods.toLowerCase();
  if (/tôm/.test(g)) return 12.4;
  if (/khô|đuối/.test(g)) return 8.6;
  if (/bạch tuộc|tako|iidako|iwadako/.test(g)) return Math.round((8.8 + (i % 6) * 0.45) * 100) / 100;
  if (/cá|saba|sòng|thu|tráo|herring|sardine/.test(g)) return Math.round((3.4 + (i % 4) * 0.3) * 100) / 100;
  return 6;
}

/** Viết tắt tên khách cho số HĐ demo: "Seachemot" → "SEA", "SB Trade" → "SBT". */
export function abbreviation(name: string): string {
  const plain = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "D");
  const words = plain.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  const raw = words.length > 1 ? words.map((w) => w[0]).join("") + words[words.length - 1].slice(1, 3) : plain;
  return raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "KH";
}

/**
 * 7 HĐ — đủ ca của buổi audit 2026-10-20 (+ mỗi dòng sổ kế hoạch của gói thành một HĐ):
 *  1. HĐ 18.26 + lô 165 · BGĐ yêu cầu sửa → sửa → đồng ý · gia hạn · đủ hồ sơ · ngoài dung sai ⇒ **Đã chốt HĐ**.
 *  2. Lô 181 (LSX 17.09) · đủ hồ sơ trong dung sai ⇒ **Đã xuất đủ** · bản sửa 1 bị BGĐ từ chối.
 *  3. 2 cont theo LXH 02.01 · cont 40 + 20 cùng booking, cont 20 **dùng chung** Lệnh SX / bao bì.
 *  4. CIF · L/C · cọc 30 % · **xe tải** + **đóng ghép** · trễ hạn · 1 dòng **chưa nối** danh mục.
 *  5. **Quá hạn chưa lên chuyến** (chờ duyệt).  6. Bản 0 bị **từ chối** ⇒ hủy cả chuyến.  7. Mới lập, **chờ duyệt**.
 */
export function buildExportDemo(customers: readonly Customer[], today: string, options: ExportDemoOptions = {}): ExportDemoSet {
  const { products = [], pack = null, originalNames = [], anonymize = false, priceFactor = 1 } = options;
  const out = {
    contracts: [] as ExportContract[],
    revisions: [] as ExportContractRevision[],
    approvals: [] as ExportContractApproval[],
    extensions: [] as ExportDemoSet["extensions"],
    shipments: [] as ExportShipment[],
    items: [] as ExportStepItem[],
    files: [] as ExportFile[],
    payments: [] as ExportPayment[],
    activities: [] as ExportActivity[],
    extraCustomers: [] as Customer[],
  };
  if (!customers.length) return out;
  const T = (days: number) => subtractDays(today, -days);
  const addDays = (date: string, days: number) => subtractDays(date, -days);
  let n = 0;
  const id = (t: string) => `dm-xk-${t}-${++n}`;
  const at = (date: string) => `${date}T08:00:00.000Z`;
  const kh = (i: number) => customers[i % customers.length].id;
  const placeholder = (name: string) => `${DEMO_PLACEHOLDER_PREFIX}${name}`;
  const APPROVER = "Giám đốc (demo)";
  const price = (v: number) => Math.round(v * priceFactor * 100) / 100;

  /* ---- File thật của gói (theo key) ---- */
  const packFiles = (key: string) => pack?.files.filter((f) => f.key === key) ?? [];
  const packFile = (key: string): ExportDemoPackFile | undefined => packFiles(key)[0];

  /* ---- Khách theo tên (gói) ⇒ khách demo; chưa có thì thêm ---- */
  const customerByName = new Map<string, string>();
  customers.forEach((c, i) => {
    customerByName.set((originalNames[i] ?? c.name).trim().toLowerCase(), c.id);
    customerByName.set(c.name.trim().toLowerCase(), c.id);
  });
  const customerFor = (name: string, fallback: number) => {
    const key = name.trim().toLowerCase();
    if (!key) return kh(fallback);
    const hit = customerByName.get(key);
    if (hit) return hit;
    const k = out.extraCustomers.length + 1;
    const extra: Customer = { id: `dm-kh-x-${k}`, code: String(customers.length + k), name: anonymize ? `Khách XK ${pad2(k)}` : name.trim(), market: "Xuất khẩu" };
    out.extraCustomers.push(extra);
    customerByName.set(key, extra.id);
    return extra.id;
  };

  let nextProduct = 0;
  type ContractOpts = {
    orderRef?: string;
    incoterm?: string;
    pod?: string;
    tolerance?: number;
    containerType?: string;
    paymentMethod?: ExportContractTerms["paymentMethod"];
    lcNo?: string;
    depositPct?: number | null;
    note?: string;
    unmapped?: number[];
    file?: ExportDemoPackFile;
  };
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
      filePath: o.file?.path ?? placeholder(`hd-${c.id}.pdf`),
      fileName: o.file?.name ?? `HĐ ${no}.pdf`,
      recordedBy: "Demo",
      createdAt: at(signedOn),
    };
    nextProduct += lines.length;
    out.contracts.push(c);
    out.revisions.push(r);
    return { c, r };
  };
  const approve = (r: ExportContractRevision, decision: ExportContractApproval["decision"], on: string, reason = "", file?: ExportDemoPackFile) =>
    out.approvals.push({
      id: id("duyet"),
      contractId: r.contractId,
      revisionId: r.id,
      decision,
      approverName: APPROVER,
      decidedOn: on,
      reason,
      filePath: decision === "approved" ? (file?.path ?? placeholder(`ky-${r.id}.pdf`)) : "",
      fileName: decision === "approved" ? (file?.name ?? "Bản ký.pdf") : "",
      recordedBy: "Demo",
      createdAt: at(on),
    });

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

  /** Đánh xong một mục kèm file (file thật của gói nếu có, không thì giữ chỗ). */
  const done = (s: ExportShipment, c: ExportContract, step: ExportStepItem["step"], patch: Partial<ExportStepItem> = {}, files: ExportDemoPackFile[] = []) => {
    const existing = out.items.find((i) => i.shipmentId === s.id && i.step === step && (step !== "document" || i.docKind === patch.docKind));
    const it: ExportStepItem = { ...(existing ?? blankItem(s.id, step, id("muc"), at(today))), state: "done", number: "", issuedOn: s.loadingDate || today, ...patch };
    if (existing) out.items[out.items.indexOf(existing)] = it;
    else out.items.push(it);
    const list = files.length ? files : [{ key: "", name: `${step}.pdf`, path: placeholder(`${step}-${it.id}.pdf`) }];
    for (const f of list)
      out.files.push({ id: id("file"), contractId: c.id, shipmentId: s.id, stepItemId: it.id, step, path: f.path, fileName: f.name, layerNo: null, caption: "", uploadedBy: "Demo", createdAt: at(today) });
    return it;
  };
  /** Mục "dùng chung" trỏ tới mục đã xong của chuyến khác (cont ghép). */
  const share = (s: ExportShipment, step: ExportStepItem["step"], src: ExportStepItem) => {
    out.items.push({ ...blankItem(s.id, step, id("muc"), at(today)), sharedFromId: src.id, docKind: src.docKind, docForm: src.docForm, docIssuer: src.docIssuer });
  };
  const loadingFiles = (s: ExportShipment, c: ExportContract, photos: number, plan?: ExportDemoPackFile, realPhotos: ExportDemoPackFile[] = []) => {
    out.files.push({ id: id("file"), contractId: c.id, shipmentId: s.id, stepItemId: "", step: "loading-plan", path: plan?.path ?? placeholder(`so-do-${s.id}.xls`), fileName: plan?.name ?? "Sơ đồ container.xls", layerNo: null, caption: "", uploadedBy: "Thủ kho demo", createdAt: at(today) });
    const list = realPhotos.length ? realPhotos : Array.from({ length: photos }, (_, k) => ({ key: "", name: `Lớp ${k + 1}.jpg`, path: placeholder(`lop-${k + 1}.jpg`) }));
    list.forEach((f, k) =>
      out.files.push({ id: id("anh"), contractId: c.id, shipmentId: s.id, stepItemId: "", step: "loading-photos", path: f.path, fileName: f.name, layerNo: k + 1, caption: "", uploadedBy: "Thủ kho demo", createdAt: at(today) }),
    );
  };
  const pay = (c: ExportContract, shipmentId: string, kind: ExportPayment["kind"], date: string, amount: number | null, method: string, note = "") =>
    out.payments.push({ id: id("tien"), contractId: c.id, shipmentId, kind, date, amount, currency: "USD", method, note, filePath: "", fileName: "", recordedBy: "Demo", createdAt: at(date) });
  const cartons = packFiles("carton");
  const mainCustomer = (fallback: number) => (pack?.case1826?.customerName ? customerFor(pack.case1826.customerName, fallback) : kh(fallback));

  /* ---- 1. HĐ 18.26 + lô 165 (gói: số + file thật) ⇒ ngoài dung sai, đã chốt tay ---- */
  {
    const k = pack?.case1826 ?? GENERIC_CASE;
    const lines = k.lines.map(([d, q, kgc, p, b]) => line(id("dong"), d, q, kgc, price(p), b));
    const { c, r } = contract(k.contractNo, mainCustomer(0), T(-82), T(-45), 1, lines, { orderRef: k.orderRef, note: "Theo HĐ giấy bản rvs (both signed)", file: packFile("contract-1826") });
    approve(r, "needs-revision", T(-76), "Ghi rõ dung sai ±10% lượng và tiền, C/O form VJ");
    r.createdAt = at(T(-70)); // đã sửa sau lần yêu cầu sửa ⇒ hiện Chờ duyệt rồi Đồng ý
    approve(r, "approved", T(-70), "", packFile("contract-1826"));
    out.extensions.push({ id: id("giahan"), contractId: c.id, newDeadline: T(-20), confirmedOn: T(-49), note: "Email khách đồng ý giao trước hạn mới", filePath: "", fileName: "", recordedBy: "Demo", createdAt: at(T(-49)) });
    const kgTotal = lines.reduce((t, l) => t + (l.quantity ?? 0) * l.cartonsPerUnit * (l.netKgPerCarton ?? 0), 0);
    const s = shipment(c, r.terms, {
      lotCode: k.lotCode,
      goodsSummary: "Bạch tuộc các loại (iwadako, tako, iidako)",
      plannedKg: Math.round(kgTotal * 1.15),
      loadingDate: T(-25),
      etd: T(-24),
      eta: T(-17),
      vesselVoyage: k.vessel,
      containerNo: k.containerNo,
      sealNo: k.sealNo,
      note: `Container plan lô ${k.lotCode}`,
    });
    for (const step of ["production-order", "packaging", "customs-declaration", "export-order"] as const)
      done(s, c, step, step === "customs-declaration" ? { number: "30612345678" } : step === "packaging" ? { note: "Bao bì đã có sẵn — thùng in theo mẫu" } : {}, step === "packaging" ? cartons : []);
    loadingFiles(s, c, 25, packFile("container-plan-165"), packFiles("photo-165"));
    done(s, c, "document", { docKind: "commercial-invoice", number: k.invoiceNo, cartons: k.cartons, netKg: k.netKg, amount: price(k.amount) }, packFiles("ci-234"));
    done(s, c, "document", { docKind: "packing-list", number: k.invoiceNo }, packFiles("pl-234"));
    done(s, c, "document", { docKind: "bill-of-lading", number: k.blNo, onBoardDate: T(-24) }, packFiles("bl-234"));
    done(s, c, "document", { docKind: "health-certificate", docIssuer: "công ty tự cấp", note: `H/C không in số — lô ${k.lotCode}` }, packFiles("hc-234"));
    done(s, c, "document", { docKind: "certificate-of-origin", docForm: "VJ", number: `VJ-${k.lotCode}` });
    done(s, c, "document", { docKind: "expiry-list", number: k.invoiceNo }, packFiles("expiry-234"));
    done(s, c, "document", { docKind: "sample-invoice", number: k.sampleInvoiceNo, note: "1 thùng hàng mẫu — không cộng vào thực xuất" }, [...packFiles("sample-inv-234"), ...packFiles("sample-pl-234")]);
    pay(c, "", "payment", T(-60), price(50000), "TTR", "Cọc trước sản xuất (demo)");
    pay(c, s.id, "documents-sent", T(-23), null, "Email + DHL bản gốc");
    pay(c, s.id, "payment", T(-12), price(k.amount - 50000), "TTR");
    c.status = "closed";
    c.closeReason = "Khách nhận phần vượt dung sai của lô — xác nhận qua email (demo)";
  }

  /* ---- 2. Lô 181 (LSX 17.09) ⇒ đủ hồ sơ, trong dung sai — bản sửa 1 bị từ chối ---- */
  {
    const lines = [
      line(id("dong"), "Big iidako skewer 16-24g", 100, 4, price(10.15), 2),
      line(id("dong"), "Iwadako boiled cut 4-5g", 100, 10, price(11.2)),
      line(id("dong"), "Tako tip boiled", 200, 12, price(4.05)),
      line(id("dong"), "Iidako whole cleaned sashimi 15-25g", 300, 10, price(11.4)),
    ];
    const { c, r } = contract("21.26/BSF-SCM.2026", mainCustomer(0), T(-49), T(-13), 1, lines, { tolerance: 5, note: "Theo LSX 17.09 · MSL 181" });
    approve(r, "approved", T(-47));
    const r1: ExportContractRevision = {
      ...r,
      id: id("ban"),
      revisionNo: 1,
      revisedOn: T(-10),
      changeSummary: "Phụ kiện 01: dòng 2 giảm còn 80 thùng",
      lines: r.lines.map((l, i) => (i === 1 ? { ...l, quantity: 80 } : l)),
      filePath: "",
      fileName: "",
      createdAt: at(T(-10)),
    };
    out.revisions.push(r1);
    approve(r1, "rejected", T(-9), "Khách chưa ký phụ kiện — giữ HĐ gốc");
    const s = shipment(c, r.terms, { lotCode: "181", goodsSummary: "Bạch tuộc xiên que, luộc, tip, NCLS", plannedKg: 7200, bookingNo: "DM-BK-181", loadingDate: T(-14), etd: T(-13), eta: T(-6), vesselVoyage: "DEMO STAR 201N", containerNo: "DEMU1810001", sealNo: "DM181" });
    done(s, c, "production-order", { note: "LSX 17.09 · MSL 181 — giao 05-07/10" }, packFiles("lsx-181"));
    done(s, c, "packaging", { note: "Dự kiến đầy đủ bao bì: đã có sẵn (LSX)" }, cartons.slice(0, 4));
    done(s, c, "customs-declaration", { number: "30612345181" });
    done(s, c, "export-order");
    loadingFiles(s, c, 18);
    done(s, c, "document", { docKind: "commercial-invoice", number: "250/26", cartons: 790, netKg: 7000, amount: price(61500) });
    done(s, c, "document", { docKind: "packing-list", number: "250/26" });
    done(s, c, "document", { docKind: "bill-of-lading", number: "DMBL0181", onBoardDate: T(-13) });
    done(s, c, "document", { docKind: "health-certificate", docIssuer: "công ty tự cấp", note: "Lô 181" });
    done(s, c, "document", { docKind: "certificate-of-origin", docForm: "VJ", number: "VJ-181" });
    pay(c, s.id, "documents-sent", T(-12), null, "Email");
  }

  /* ---- 3. 2 cont theo LXH 02.01: 40RF + 20RF cùng booking, cont 20 dùng chung ---- */
  {
    const lines = [
      line(id("dong"), "Tako neck boiled cut 1-2g", 200, 10, price(4.05)),
      line(id("dong"), "Tako tip raw", 50, 12, price(2.15)),
      line(id("dong"), "Iwadako blanched cut 5g", 200, 10, price(10.5)),
      line(id("dong"), "Iwadako blanched cut 2-3g bulk", 505, 10, price(10.15)),
      line(id("dong"), "Tako tip boiled", 200, 12, price(4.05)),
    ];
    const { c, r } = contract("02.26/BSF-SCM.2026", mainCustomer(1), T(-30), T(10), 2, lines, { containerType: "40RF + 20RF", note: "Theo LXH 02.01 — cont ghép 40+20" });
    approve(r, "approved", T(-28));
    const s40 = shipment(c, r.terms, { kind: "40RF", lotCode: "006", goodsSummary: "Bạch tuộc các loại (40)", plannedKg: 9000, bookingNo: "DM-SGNECZ513400", loadingDate: T(3), etd: T(5) });
    const s20 = shipment(c, r.terms, { kind: "20RF", lotCode: "006", goodsSummary: "Bạch tuộc các loại (20)", plannedKg: 4500, bookingNo: "DM-SGNECZ513400", loadingDate: T(3), etd: T(5) });
    const lsx = done(s40, c, "production-order", { note: "LXH 02.01 — cont 20RF + 40RF" }, packFiles("lxh-0201"));
    const pkg = done(s40, c, "packaging", { note: "Bao bì đã có sẵn" }, cartons.slice(4, 8));
    share(s20, "production-order", lsx);
    share(s20, "packaging", pkg);
  }

  /* ---- 4. CIF · L/C · cọc 30 % · xe tải + đóng ghép · trễ hạn · 1 dòng chưa nối ---- */
  {
    const { c, r } = contract("07.26/BSF-HTC.2026", kh(2), T(-40), T(-10), 1, [line(id("dong"), "Boiled octopus cut 10-15g", 2160, 10, price(11.05)), line(id("dong"), "Samples (consolidated)", 10, 10, 0)], {
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
    pay(c, "", "payment", T(-35), price(71604), "L/C — cọc 30%");
  }

  /* ---- 5. Quá hạn chưa lên chuyến (chờ duyệt) ---- */
  contract("11.26/BSF-MTD.2026", kh(3), T(-60), T(-30), 1, [line(id("dong"), "Boiled octopus cut 700-1000", 900, 10, price(8.95))], { pod: "Osaka, Japan", tolerance: 5, note: "Quá hạn giao mà chưa lên chuyến" });

  /* ---- 6. BGĐ từ chối bản 0 ⇒ hủy HĐ và chuyến kế hoạch ---- */
  {
    const { c, r } = contract("05.26/BSF-PC.2026", kh(4), T(-19), T(5), 1, [line(id("dong"), "Frozen octopus blanched cut 3-4g", 2150, 10, price(8.2))], { pod: "Niigata, Japan", tolerance: 0 });
    const s = shipment(c, r.terms, { lotCode: "201", plannedKg: 21500, goodsSummary: "Bạch tuộc chần" });
    approve(r, "rejected", T(-15), "Giá thấp hơn giá thành — không ký");
    c.status = "cancelled";
    c.cancelReason = "Giá thấp hơn giá thành — không ký";
    s.status = "cancelled";
    s.cancelReason = c.cancelReason;
  }

  /* ---- 7. Mới lập, chờ BGĐ ký ---- */
  contract("99.26/BSF-LK.2026", kh(5), today, T(40), 1, [line(id("dong"), "Tako karaage 10-15g", 100, 6, price(7.95), 2)], { note: "Mới lập — chờ BGĐ ký" });

  /* ---- 8. Sổ "Kế hoạch xuất hàng" của gói: mỗi dòng một HĐ + chuyến, dời sang tháng gần đây ---- */
  if (pack?.plan.length) {
    const offset = monthIndex(today.slice(0, 7)) - monthIndex(pack.planLastMonth);
    const seqByCustomer = new Map<string, number>();
    pack.plan.forEach((row, i) => {
      const loading = shiftMonths(row.loading, offset);
      if (!loading || !row.customer.trim() || !row.kg) return;
      const etd = row.etd ? shiftMonths(row.etd, offset) : addDays(loading, 2);
      const custId = customerFor(row.customer, i);
      const seq = (seqByCustomer.get(custId) ?? 0) + 1;
      seqByCustomer.set(custId, seq);
      const yy = loading.slice(2, 4);
      const cont = row.cont.replace(/\s+/g, "").toUpperCase();
      const kinds: ExportShipmentKind[] = cont.startsWith("40+20")
        ? ["40RF", "20RF"]
        : cont.startsWith("20")
          ? ["20RF"]
          : cont.startsWith("40")
            ? ["40RF"]
            : /XE/.test(cont)
              ? ["truck"]
              : /GHÉP|GHEP/.test(cont)
                ? ["consolidated"]
                : ["40RF"];
      const goodsAll = [{ goods: row.goods, kg: row.kg }, ...row.extraLines.filter((x) => x.kg)];
      const lines = goodsAll.map((g, j) => line(id("dong"), g.goods, Math.round((g.kg ?? 0) / 10), 10, price(demoPrice(g.goods, i + j))));
      const containers = kinds.filter((k) => k !== "truck" && k !== "consolidated").length || null;
      const d = dayDiff(loading, today);
      const pending = d > 15;
      const { c, r } = contract(`${pad2(seq)}.${yy}/BSF-${abbreviation(row.customer)}.20${yy}`, custId, addDays(loading, -40), addDays(loading, i % 9 === 0 ? -2 : 6), containers, lines, {
        pod: row.pod || "Tokyo, Japan",
        containerType: kinds.join(" + "),
        note: "Theo sổ Kế hoạch xuất hàng (dời ngày cho demo)",
      });
      if (!pending) approve(r, "approved", addDays(loading, -36));
      const plannedTotal = goodsAll.reduce((t, g) => t + (g.kg ?? 0), 0);
      const avgPrice = r.lines.reduce((t, l) => t + (l.unitPrice ?? 0), 0) / r.lines.length;
      kinds.forEach((kind, ki) => {
        const part = kinds.length > 1 ? (ki === 0 ? 2 / 3 : 1 / 3) : 1;
        const loaded = d <= 0;
        const s = shipment(c, r.terms, {
          kind,
          lotCode: row.msl,
          goodsSummary: goodsAll.map((g) => g.goods).join(" + "),
          plannedKg: Math.round(plannedTotal * part),
          bookingNo: row.booking,
          loadingDate: loading,
          etd,
          eta: addDays(etd, 7),
          containerNo: loaded ? (kind === "truck" ? `72C-${pad2(i % 100)}${pad2(ki)}` : kind === "consolidated" ? "" : `DMXU${String(1000000 + i * 10 + ki)}`) : "",
          sealNo: loaded && kind !== "truck" && kind !== "consolidated" ? `DMS${pad2(i % 100)}${ki}` : "",
        });
        if (pending) return;
        done(s, c, "production-order", { note: `LSX theo MSL ${row.msl || "—"}` });
        done(s, c, "packaging", { note: "Bao bì đã có sẵn" });
        if (d > 0) return;
        done(s, c, "customs-declaration", { number: `306${String(10000000 + i * 10 + ki)}` });
        done(s, c, "export-order");
        loadingFiles(s, c, 1);
        const f = 0.97 + ((i * 7 + ki) % 6) * 0.01; // thực xuất lệch kế hoạch −3 % … +2 %
        const actualKg = Math.round(plannedTotal * part * f);
        const amount = Math.round(actualKg * avgPrice * 100) / 100;
        done(s, c, "document", { docKind: "commercial-invoice", number: `${100 + i}/${yy}`, cartons: Math.round(actualKg / 10), netKg: actualKg, amount });
        if (d > -7) return; // vừa đóng cont: chứng từ còn dở
        done(s, c, "document", { docKind: "packing-list", number: `${100 + i}/${yy}` });
        done(s, c, "document", { docKind: "bill-of-lading", number: `DMBL${5000 + i * 10 + ki}`, onBoardDate: etd });
        done(s, c, "document", { docKind: "health-certificate", docIssuer: "công ty tự cấp", note: `Lô ${row.msl || "—"}` });
        done(s, c, "document", { docKind: "certificate-of-origin", docForm: "VJ", number: `VJ-${100 + i}` });
        if (d <= -20) {
          pay(c, s.id, "documents-sent", addDays(etd, 1), null, "Email");
          pay(c, s.id, "payment", addDays(etd, 12), amount, "TTR");
        }
      });
    });
  }

  // Nhật ký hợp đồng (mig 0079): bộ demo để lại dấu các bước đã làm — trang hồ sơ có nhật ký để xem thử.
  for (const c of out.contracts) {
    out.activities.push({ id: id("nk"), contractId: c.id, shipmentId: "", action: "create", summary: `Lập HĐ ${c.contractNo} (bản 0) — chờ duyệt`, actor: "Demo", createdAt: at(c.signedOn || today) });
    for (const a of out.approvals.filter((x) => x.contractId === c.id)) {
      const verb = a.decision === "approved" ? "đồng ý" : a.decision === "rejected" ? "từ chối" : "yêu cầu sửa";
      out.activities.push({ id: id("nk"), contractId: c.id, shipmentId: "", action: a.decision === "approved" ? "approve" : a.decision === "rejected" ? "reject" : "return", summary: `Duyệt HĐ ${c.contractNo}: ${verb}${a.reason ? ` — ${a.reason}` : ""}`, actor: a.approverName, createdAt: a.createdAt });
    }
    for (const s of out.shipments.filter((x) => x.contractId === c.id))
      out.activities.push({ id: id("nk"), contractId: c.id, shipmentId: s.id, action: "create", summary: `Ghi chuyến ${s.lotCode ? `lô ${s.lotCode}` : s.bookingNo || ""}`.trim(), actor: "Demo", createdAt: s.createdAt });
    if (c.status === "closed") out.activities.push({ id: id("nk"), contractId: c.id, shipmentId: "", action: "close", summary: `Đóng HĐ ${c.contractNo}${c.closeReason ? ` — ${c.closeReason}` : ""}`, actor: APPROVER, createdAt: at(today) });
  }

  return out;
}
