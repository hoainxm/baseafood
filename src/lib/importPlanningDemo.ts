// ============================================================
// Tên file: src/lib/importPlanningDemo.ts
// Tên tiếng Việt: Bộ demo Nhập khẩu — 2 NCC nước ngoài, 3 hợp đồng, đủ các trạng thái lô
// Description: Deterministic demo set for the import planning module (ba-spec 45 R14).
// ============================================================
// Số + tên TỰ ĐẶT (không lấy hồ sơ thật — luật repo 15). File là đường dẫn GIỮ CHỖ
// `demo-placeholder/…` (không chạm kho file). Ngày dời theo `today` để luôn rơi vào tháng gần đây.
import type { ImportContract, ImportContractLine, ImportDocument, ImportFile, ImportReceipt, ImportReceiptLine, ImportSampleCheck, ImportSupplier, Product } from "@/types";
import { emptySample } from "./importSampleChecks";
import { DEMO_PLACEHOLDER_PREFIX } from "./exportPlanning";
import { emptyImportSupplier, type ImportData } from "./importPlanning";

export interface ImportDemoSet extends ImportData {
  /** Danh mục NCC nhập khẩu của bộ demo (mig 0083 — danh mục riêng, không lẫn Đại lý). */
  suppliers: ImportSupplier[];
  /** Kiểm mẫu của kho (mig 0085, ba-spec 45 v4) — số tự đặt, không chép báo cáo thật. */
  sampleChecks: ImportSampleCheck[];
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

function supplier(id: string, code: string, shortName: string, fullName: string, country: string, extra: Partial<ImportSupplier> = {}): ImportSupplier {
  return { ...emptyImportSupplier(id), code, shortName, fullName, country, note: "Bộ demo Nhập khẩu", ...extra };
}

/** Mặt hàng demo cho dòng hàng (v3 R20): tên chứa từ khóa, không có thì theo loài, không có nữa thì mặt hàng đầu. */
function pickProduct(products: readonly Pick<Product, "id" | "name" | "category">[], keyword: string, category: string): string {
  const k = keyword.toLowerCase();
  return (products.find((p) => p.name.toLowerCase().includes(k)) ?? products.find((p) => p.category === category) ?? products[0])?.id ?? "";
}

/** `products` = danh mục Mặt hàng của bộ demo — dòng hàng nối vào đó (không truyền ⇒ dòng chưa nối). */
export function buildImportDemo(today: string, products: readonly Pick<Product, "id" | "name" | "category">[] = []): ImportDemoSet {
  const at = `${today}T08:00:00.000Z`;
  const suppliers = [
    supplier("imp-sup-pacific", "NK01", "Pacific Marine", "Pacific Marine Co., Ltd.", "Nhật Bản", { loadingPort: "Tokyo", contactName: "Mr. Tanaka", mainProducts: "Bạch tuộc nguyên con" }),
    supplier("imp-sup-andaman", "NK02", "Andaman Seafood", "Andaman Seafood Trading Co.", "Ấn Độ", { loadingPort: "Chennai", bankName: "State Bank (demo)", swiftCode: "DEMOINBB" }),
    supplier("imp-sup-oldco", "NK03", "Old Ocean", "Old Ocean Fisheries", "Indonesia", { status: "inactive", note: "Ngừng giao dịch từ 2025 (bộ demo)" }),
  ];
  const contract = (id: string, p: Partial<ImportContract>): ImportContract => ({
    id,
    supplierId: "",
    supplierName: "",
    contractNo: "",
    signedDate: "",
    importType: "",
    currency: "USD",
    linePrices: {},
    status: "open",
    closeReason: "",
    cancelReason: "",
    note: "",
    createdAt: at,
    ...p,
  });
  const contracts: ImportContract[] = [
    contract("imp-c1", {
      supplierId: "imp-sup-pacific",
      supplierName: "Pacific Marine",
      contractNo: "PM-GC-2026/07",
      signedDate: addDays(today, -60),
      importType: "processing",
      note: "Hàng gia công, không thanh toán tiền nguyên liệu",
    }),
    contract("imp-c2", {
      supplierId: "imp-sup-andaman",
      supplierName: "Andaman Seafood",
      contractNo: "AS-2026-118",
      signedDate: addDays(today, -30),
      importType: "export-production",
      linePrices: { "imp-c2-l1": 2.1 },
    }),
    contract("imp-c3", {
      supplierId: "imp-sup-andaman",
      supplierName: "Andaman Seafood",
      contractNo: "AS-2026-097",
      signedDate: addDays(today, -75),
      importType: "trading",
      linePrices: { "imp-c3-l1": 3.4 },
      status: "closed",
      closeReason: "Đối tác giao thiếu 100 kg, hai bên đồng ý kết thúc hợp đồng",
    }),
  ];
  const line = (id: string, contractId: string, lineNo: number, productName: string, kg: number, product: [string, string]): ImportContractLine => ({
    id,
    contractId,
    lineNo,
    productName,
    productId: pickProduct(products, ...product),
    kg,
    note: "",
  });
  const lines: ImportContractLine[] = [
    line("imp-c1-l1", "imp-c1", 1, "Frozen whole octopus 1-2 kg", 12000, ["bạch tuộc", "Bạch tuộc"]),
    line("imp-c1-l2", "imp-c1", 2, "Frozen whole octopus 2-3 kg", 8000, ["bạch tuộc", "Bạch tuộc"]),
    line("imp-c2-l1", "imp-c2", 1, "Frozen skate wing", 12000, ["đuối", "Cá"]),
    line("imp-c3-l1", "imp-c3", 1, "Frozen whole squid", 5000, ["mực", "Mực"]),
  ];
  const receipt = (id: string, contractId: string, p: Partial<ImportReceipt>): ImportReceipt => {
    const c = contracts.find((x) => x.id === contractId) as ImportContract;
    return {
      id,
      contractId,
      contractNo: c.contractNo,
      supplierName: c.supplierName,
      arrivalDate: "",
      expectedDate: "",
      transport: "40RF",
      containerNo: "",
      blNo: "",
      status: "open",
      cancelReason: "",
      note: "",
      createdAt: at,
      ...p,
    };
  };
  const receipts: ImportReceipt[] = [
    // Đủ hồ sơ: 3 chứng từ bắt buộc + C/O + kiểm dịch, đã ghi thực nhập.
    receipt("imp-r1", "imp-c1", { arrivalDate: addDays(today, -20), containerNo: "PMLU4410023", blNo: "PMOSGN2610001" }),
    // Thiếu chứng từ: mới có invoice.
    receipt("imp-r2", "imp-c1", { arrivalDate: addDays(today, -3), containerNo: "PMLU4410187", blNo: "PMOSGN2610044" }),
    // Chờ thực nhập: chứng từ đủ, hàng sắp về.
    receipt("imp-r3", "imp-c2", { expectedDate: addDays(today, 4), transport: "lcl", blNo: "ASCHN2610102" }),
    // Hợp đồng đã đóng.
    receipt("imp-r4", "imp-c3", { arrivalDate: addDays(today, -40), transport: "20RF", containerNo: "ASBU2201145" }),
  ];
  let seq = 0;
  const documents: ImportDocument[] = [];
  const files: ImportFile[] = [];
  const doc = (receiptId: string, kind: ImportDocument["kind"], docNo: string, withFile: boolean, p: Partial<ImportDocument> = {}) => {
    const r = receipts.find((x) => x.id === receiptId) as ImportReceipt;
    const c = contracts.find((x) => x.id === r.contractId) as ImportContract;
    const id = `${receiptId}-d${++seq}`;
    documents.push({
      id,
      receiptId,
      kind,
      customName: "",
      docNo,
      docDate: docNo ? r.arrivalDate || addDays(today, -1) : "",
      importType: kind === "import-declaration" ? c.importType : "",
      notApplicable: false,
      naReason: "",
      note: "",
      createdAt: at,
      ...p,
    });
    if (withFile)
      files.push({
        id: `${id}-f`,
        contractId: c.id,
        receiptId,
        documentId: id,
        path: `${DEMO_PLACEHOLDER_PREFIX}import/${id}.pdf`,
        fileName: `${kind}-${docNo || id}.pdf`,
        uploadedBy: "Bộ demo",
        createdAt: at,
      });
  };
  doc("imp-r1", "commercial-invoice", "PM-INV-0712", true);
  doc("imp-r1", "packing-list", "PM-PL-0712", true);
  doc("imp-r1", "import-declaration", "105998877001", true);
  doc("imp-r1", "certificate-of-origin", "JP-CO-55120", true);
  doc("imp-r1", "quarantine-certificate", "KD-2026-3381", true);
  doc("imp-r2", "commercial-invoice", "PM-INV-0738", true);
  doc("imp-r2", "packing-list", "", false);
  doc("imp-r2", "import-declaration", "", false);
  doc("imp-r3", "commercial-invoice", "AS-INV-118A", true);
  doc("imp-r3", "packing-list", "AS-PL-118A", true);
  doc("imp-r3", "import-declaration", "105998877214", true);
  doc("imp-r4", "commercial-invoice", "AS-INV-097", true);
  doc("imp-r4", "packing-list", "AS-PL-097", true);
  doc("imp-r4", "import-declaration", "105998870533", true);
  files.push({
    id: "imp-c1-signed",
    contractId: "imp-c1",
    receiptId: "",
    documentId: "",
    path: `${DEMO_PLACEHOLDER_PREFIX}import/imp-c1-signed.pdf`,
    fileName: "Hop-dong-PM-GC-2026-07.pdf",
    uploadedBy: "Bộ demo",
    createdAt: at,
  });
  const qty = (receiptId: string, contractLineId: string, kg: number): ImportReceiptLine => ({
    id: `${receiptId}-${contractLineId}`,
    receiptId,
    contractLineId,
    kg,
    recordedBy: "Thủ kho (demo)",
    updatedAt: at,
  });
  const receiptLines: ImportReceiptLine[] = [qty("imp-r1", "imp-c1-l1", 6000), qty("imp-r1", "imp-c1-l2", 4000), qty("imp-r4", "imp-c3-l1", 4900)];
  // Báo cáo kiểm mẫu của kho cho lô đã về đủ (imp-r1): 2 mẫu, mỗi mẫu một size của HĐ.
  const sample = (no: string, lineId: string, size: string, p: Partial<ImportSampleCheck>): ImportSampleCheck =>
    emptySample(`imp-r1-s${no}`, {
      contractId: "imp-c1",
      receiptId: "imp-r1",
      contractLineId: lineId,
      batchId: "imp-r1-b1",
      fileId: "imp-r1-sample-file",
      reportDate: addDays(today, -18),
      sampleNo: no,
      size,
      exporterName: "Pacific",
      importDate: addDays(today, -20),
      packing: "4kg/BL x 5/CTN",
      productionDate: addDays(today, -150),
      expiryDate: addDays(today, 580),
      color: "Đạt",
      blackSpot: "Đạt",
      odor: "Đạt",
      createdAt: at,
      ...p,
    });
  const sampleChecks: ImportSampleCheck[] = [
    sample("1", "imp-c1-l1", "1-2 kg", {
      grossWeightG: 24100,
      netWeightG: 19200,
      netShortagePct: 4,
      mossPct: 6,
      oneSkinPct: 20,
      twoSkinPct: 80,
      sizeDistribution: { "70/100": 30, "100/150": 70 },
      thawingNorm: 1.04,
      preprocessingNorm: 1.42,
      blanchingNorm: 1.22,
      cuttingNorm: 1.08,
      surplusNorm: 1.03,
      materialToFinishedNorm: 2.03,
    }),
    sample("2", "imp-c1-l2", "2-3 kg", {
      grossWeightG: 23900,
      netWeightG: 19400,
      netShortagePct: 3,
      color: "Hơi sẫm",
      mossPct: 4,
      oneSkinPct: 15,
      twoSkinPct: 85,
      sizeDistribution: { "100/150": 40, "150/200": 60 },
      thawingNorm: 1.03,
      preprocessingNorm: 1.38,
      blanchingNorm: 1.23,
      cuttingNorm: 1.07,
      surplusNorm: 1.03,
      materialToFinishedNorm: 1.95,
    }),
  ];
  files.push({
    id: "imp-r1-sample-file",
    contractId: "imp-c1",
    receiptId: "imp-r1",
    documentId: "",
    path: `${DEMO_PLACEHOLDER_PREFIX}import/imp-r1-kiem-mau.xlsx`,
    fileName: "Bao-cao-kiem-mau-kho.xlsx",
    uploadedBy: "Bộ demo",
    createdAt: at,
  });
  return { suppliers, contracts, lines, receipts, receiptLines, documents, files, sampleChecks };
}
