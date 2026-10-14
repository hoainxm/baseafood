// ============================================================
// Tên file: src/lib/balancingGrid.ts
// Tên tiếng Việt: Logic lưới cân đối theo ngày
// Description: Pure helpers for the day-grid balancing screen
// ============================================================
import type {
  BalancingPeriod,
  BalancingInputItem,
  BalancingOutputItem,
  MaterialImportItem,
  WipProductionItem,
  DailyQuantities,
} from "@/types";
import { sumGridRow } from "@/types";

/* ---------- Ngày trong kỳ ---------- */

/**
 * Danh sách ngày (ISO) của kỳ, dùng làm CỘT của lưới.
 * Kỳ chưa khai ngày ⇒ lưới không có cột ngày, chỉ còn cột Tổng — vẫn nhập được.
 * Chặn ở 62 ngày: quá mốc đó lưới không còn đọc được trên tablet, và một "kỳ"
 * dài vậy là dấu hiệu chọn nhầm khoảng ngày.
 */
export const MAX_PERIOD_DAYS = 62;

export function getPeriodDates(ky: Pick<BalancingPeriod, "startDate" | "endDate">): string[] {
  const tu = ky.startDate;
  const den = ky.endDate || ky.startDate;
  if (!tu || !den || den < tu) return [];
  const ra: string[] = [];
  /* Dựng ngày ở giờ UTC và đọc lại bằng UTC. Dùng `new Date("...T00:00:00")`
     rồi `toISOString()` là bẫy kinh điển: giờ Việt Nam +07 ⇒ nửa đêm địa phương
     thành 17:00 UTC HÔM TRƯỚC, kỳ 21–25/7 biến thành 20–24/7 và ngày cuối rơi
     ra ngoài kỳ (dòng nhập hàng ngày 25 không hút được). */
  const d = new Date(`${tu}T00:00:00Z`);
  const end = new Date(`${den}T00:00:00Z`);
  while (d.getTime() <= end.getTime() && ra.length < MAX_PERIOD_DAYS) {
    ra.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return ra;
}

/** Nhãn cột ngày: "22/7" — ngắn để lưới 5–8 cột vẫn vừa màn tablet. */
export function formatDayLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/* ---------- Họ nguyên liệu (gom 2 size về một kỳ) ---------- */

/**
 * Bỏ hậu tố size để biết hai tên có cùng một họ nguyên liệu không.
 * "Bạch tuộc 2 da lớn (80↑)" và "Bạch tuộc 2 da nhỏ (80↓)" cùng họ
 * "Bạch tuộc 2 da" ⇒ một kỳ cân đối gom được cả hai, đúng bảng giấy.
 */
export function getMaterialFamily(ten: string): string {
  return ten
    .replace(/\s*(lớn|nhỏ)\s*\(\s*80\s*[↑↓]\s*\)\s*$/iu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSameMaterialFamily(a: string, b: string): boolean {
  const x = getMaterialFamily(a).toLowerCase();
  const y = getMaterialFamily(b).toLowerCase();
  return Boolean(x) && x === y;
}

/**
 * Các kỳ KHÁC cùng họ nguyên liệu có khoảng ngày CHỒNG lên kỳ này. Tạo trùng kỳ là
 * đường chính dẫn tới hút nhầm: kỳ trước đã giữ hết chuyến đúng loại, kỳ trùng chỉ
 * còn thấy chuyến khác loại (VD 1 da khi kỳ là 2 da) trong hộp "Chọn dòng nhập".
 */
export function findOverlappingFamilyPeriods(
  ky: Pick<BalancingPeriod, "id" | "materialTypeName" | "startDate" | "endDate">,
  all: Pick<BalancingPeriod, "id" | "materialTypeName" | "startDate" | "endDate">[]
): typeof all {
  const tu = ky.startDate;
  const den = ky.endDate || ky.startDate;
  if (!tu || !den) return [];
  return all.filter((k) => {
    if (k.id === ky.id || !isSameMaterialFamily(k.materialTypeName, ky.materialTypeName)) return false;
    const kTu = k.startDate;
    const kDen = k.endDate || k.startDate;
    if (!kTu || !kDen) return false;
    return kTu <= den && tu <= kDen;
  });
}

/* ---------- Hút số liệu vào kỳ ---------- */

/**
 * Dòng sổ nhập hàng đủ điều kiện vào kỳ: cùng họ nguyên liệu, ngày hàng về nằm
 * trong kỳ, và chưa bị kỳ nào khác giữ. Kỳ chưa khai ngày ⇒ không hút gì (tránh
 * kéo nhầm cả sổ vào một kỳ trống).
 */
export function filterEligibleImports(
  ky: BalancingPeriod,
  imports: MaterialImportItem[]
): MaterialImportItem[] {
  const dates = new Set(getPeriodDates(ky));
  if (dates.size === 0) return [];
  return imports.filter(
    (r) =>
      dates.has(r.deliveryDate) &&
      isSameMaterialFamily(r.materialTypeName, ky.materialTypeName) &&
      (!r.balancingPeriodId || r.balancingPeriodId === ky.id)
  );
}

/**
 * Dòng sổ sản xuất đủ điều kiện vào kỳ: ngày sản xuất trong kỳ, chưa gắn kỳ khác.
 * KHÔNG lọc theo loại nguyên liệu — một lô nguyên liệu ra nhiều mặt hàng, và
 * mặt hàng không mang thông tin nguyên liệu nguồn.
 */
export function filterEligibleWips(
  ky: BalancingPeriod,
  wips: WipProductionItem[]
): WipProductionItem[] {
  const dates = new Set(getPeriodDates(ky));
  if (dates.size === 0) return [];
  return wips.filter(
    (r) =>
      dates.has(r.productionDate) &&
      (!r.balancingPeriodId || r.balancingPeriodId === ky.id)
  );
}

/* ---------- Dòng ra/vào KHO ĐÔNG của khối nguyên liệu ---------- */

/** Cờ nguồn kho (`source_warehouse`) của hàng kho đông chính xưởng. */
export const OWN_WAREHOUSE = "Kho mình";

/**
 * Hai dòng cố định của khối NL: LẤY XẢ ĐÔNG (đầu bảng — lấy NL đông từ kho ra
 * chế biến, cộng vào NL vào, TRỪ tồn kho đông) và GỬI ĐÔNG (cuối bảng — NL không
 * chế biến, cấp đông cất kho, trừ khỏi NL vào, CỘNG tồn kho đông).
 *
 * Không thêm cột: nhận ra bằng nhóm "Xả đông" + nguồn kho "Kho mình" (đúng nghĩa
 * cờ 0008), chiều theo `isReduction` (gửi đông là dòng giảm — gõ dương, lưu âm).
 * Dòng "nhận chuyển kỳ" cũ (Xả đông · Kho mình · chuyển kỳ dương) tự là lấy xả đông.
 */
export type BalancingStockLineKind = "lay-xa-dong" | "gui-dong";

export function getBalancingStockLineKind(
  r: Pick<BalancingInputItem, "groupName" | "sourceWarehouse" | "isReduction">
): BalancingStockLineKind | null {
  if (r.groupName !== "Xả đông" || r.sourceWarehouse !== OWN_WAREHOUSE) return null;
  return r.isReduction ? "gui-dong" : "lay-xa-dong";
}

export const BALANCING_STOCK_LINE_NAMES: Record<BalancingStockLineKind, string> = {
  "lay-xa-dong": "Lấy xả đông",
  "gui-dong": "Gửi đông",
};

/* ---------- Trả · Nợ (khối bán thành phẩm) ---------- */

const tron3 = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Hai cột Trả · Nợ thay cột Chuyển kỳ. Kế toán gõ số CÓ DẤU, Tổng dòng = Σ ngày +
 * Trả + Nợ (quy tắc chuyển kỳ cũ, chưa gán nghĩa riêng cho từng cột). Lưu: tổng ở
 * `carryOverKg` (mọi công thức cũ đọc trường này), phần Nợ ở `debtKg`; số chuyển kỳ
 * cũ (chưa có `debtKg`) hiện ở cột Trả.
 */
export function splitRepaidDebt(r: Pick<BalancingOutputItem, "carryOverKg" | "debtKg">): {
  repaidKg: number;
  debtKg: number;
} {
  const no = r.debtKg ?? 0;
  return { repaidKg: tron3((r.carryOverKg ?? 0) - no), debtKg: no };
}

/** Patch ghi một trong hai cột, giữ nguyên cột kia. */
export function setRepaidDebt(
  r: Pick<BalancingOutputItem, "carryOverKg" | "debtKg">,
  edit: { repaidKg?: number; debtKg?: number }
): Pick<BalancingOutputItem, "carryOverKg" | "debtKg"> {
  const prev = splitRepaidDebt(r);
  const tra = edit.repaidKg ?? prev.repaidKg;
  const no = edit.debtKg ?? prev.debtKg;
  return { carryOverKg: tron3(tra + no), debtKg: no };
}

/* ---------- Khách "Khác" ---------- */

/**
 * Dòng bán thành phẩm BẮT BUỘC có khách — chưa biết khách thật thì chọn "Khác".
 * Là mục cố định (không nằm trong danh mục khách) để danh mục không lẫn khách ảo.
 */
export const OTHER_CUSTOMER_ID = "khac";

export function getBalancingCustomerName(id: string, customers: { id: string; name: string }[]): string {
  if (id === OTHER_CUSTOMER_ID) return "Khác";
  return customers.find((k) => k.id === id)?.name || "—";
}

/* ---------- Dựng dòng lưới ---------- */

export interface MaterialGridRow {
  /** id của dòng balancing_inputs */
  id: string;
  name: string;
  /** Dòng lấy xả đông / gửi đông (ra/vào kho đông) — null nếu là dòng thường. */
  stockLineKind: BalancingStockLineKind | null;
  group: BalancingInputItem["groupName"];
  dailyQuantities: DailyQuantities;
  carryOverKg: number;
  total: number;
  unitPrice: number | null;
  ratio: number | null;
  isDecrease: boolean;
  decreaseTarget: string;
  /** Dòng dựng từ sổ nhập hàng ⇒ ô ngày khoá, sửa ở sổ gốc. */
  fromImports: boolean;
  sourceIds: string[];
}

/**
 * Gom sản lượng theo ngày của các dòng sổ nhập đã gắn kỳ, khoá theo TÊN loại
 * nguyên liệu (sổ nhập lưu theo tên, không phải khoá ngoại — xem 30-nhap-hang).
 */
export function groupImportsByMaterialType(
  rows: MaterialImportItem[]
): Map<string, { dailyQuantities: DailyQuantities; ids: string[]; unitPrice: number | null }> {
  /* GỘP theo HỌ nguyên liệu: "Bạch tuộc 2 da lớn (80↑)" + "… nhỏ (80↓)" gom về
     MỘT dòng "Bạch tuộc 2 da" — chốt với chủ dự án: cân đối KHÔNG tách size, gộp
     chung. Sổ Nhập hàng vẫn ghi tên có size (truy nguyên); chỉ khi ĐƯA VÀO cân
     đối mới gộp. Tên không có mốc 80↑/↓ giữ nguyên (getMaterialFamily không cắt). */
  const ra = new Map<
    string,
    { dailyQuantities: DailyQuantities; ids: string[]; unitPrice: number | null; sourceNames: Set<string> }
  >();
  for (const r of rows) {
    const k = getMaterialFamily(r.materialTypeName || "") || "(chưa ghi loại)";
    const o = ra.get(k) ?? { dailyQuantities: {}, ids: [], unitPrice: null, sourceNames: new Set<string>() };
    o.dailyQuantities[r.deliveryDate] = (o.dailyQuantities[r.deliveryDate] ?? 0) + r.quantityKg;
    o.ids.push(r.id);
    o.sourceNames.add(r.materialTypeName || "");
    if (r.unitPrice != null) o.unitPrice = r.unitPrice;
    ra.set(k, o);
  }
  /* Gộp NHIỀU size giá khác nhau (lớn vs nhỏ) ⇒ ĐỂ TRỐNG đơn giá cho kế toán gõ
     MỘT giá chung (chốt) — không gợi ý bừa giá của một size. Một nguồn ⇒ giữ giá
     gợi ý như cũ. */
  const out = new Map<string, { dailyQuantities: DailyQuantities; ids: string[]; unitPrice: number | null }>();
  for (const [k, o] of ra) {
    out.set(k, { dailyQuantities: o.dailyQuantities, ids: o.ids, unitPrice: o.sourceNames.size > 1 ? null : o.unitPrice });
  }
  return out;
}

export interface FinishedGoodGridRow {
  /** id của dòng balancing_outputs */
  id: string;
  productId: string;
  customerId: string;
  spec: string;
  channel: BalancingOutputItem["channel"];
  unitPrice: number | null;
  dailyQuantities: DailyQuantities;
  /** Trả + Nợ — phần cộng thêm vào Tổng ngoài các ngày. */
  carryOverKg: number;
  repaidKg: number;
  debtKg: number;
  total: number;
  fromProduction: boolean;
  sourceIds: string[];
}

/** Khoá gom dòng bán thành phẩm: một mặt hàng × một quy cách = một dòng lưới. */
export function productSpecKey(productId: string, spec: string): string {
  return `${productId}|${spec || ""}`;
}

export function groupWipsByProduct(
  rows: WipProductionItem[]
): Map<string, { dailyQuantities: DailyQuantities; ids: string[] }> {
  const ra = new Map<string, { dailyQuantities: DailyQuantities; ids: string[] }>();
  for (const r of rows) {
    const k = productSpecKey(r.productId, r.spec);
    const o = ra.get(k) ?? { dailyQuantities: {}, ids: [] };
    o.dailyQuantities[r.productionDate] = (o.dailyQuantities[r.productionDate] ?? 0) + r.quantityKg;
    o.ids.push(r.id);
    ra.set(k, o);
  }
  return ra;
}

/**
 * Dòng lưới nguyên liệu = dòng `balancing_inputs` của kỳ. Dòng có
 * `autoSource = "imports"` lấy sản lượng ngày THẲNG từ sổ nhập (không chép
 * sang bảng cân đối) nên hai nơi không bao giờ lệch nhau.
 */
export function buildMaterialGridRows(
  inputs: BalancingInputItem[],
  assignedImports: MaterialImportItem[]
): MaterialGridRow[] {
  const byType = groupImportsByMaterialType(assignedImports);
  return inputs.map((r) => {
    const isFromImports = r.autoSource === "imports";
    // Tra theo HỌ: gom nhập keyed theo họ, dòng lưới có thể mang tên họ (hút mới)
    // hoặc tên size cũ ⇒ chuẩn hoá r.name về họ khi tra.
    const source = isFromImports ? byType.get(getMaterialFamily(r.name)) : undefined;
    const byDate = source ? source.dailyQuantities : (r.dailyQuantities ?? {});
    const carryOver = r.carryOverKg ?? 0;
    return {
      id: r.id,
      name: r.name,
      stockLineKind: getBalancingStockLineKind(r),
      group: r.groupName,
      dailyQuantities: byDate,
      carryOverKg: carryOver,
      total: sumGridRow(byDate, carryOver),
      unitPrice: r.unitPrice,
      ratio: r.ratioPercentage,
      isDecrease: Boolean(r.isReduction),
      decreaseTarget: r.reductionWarehouseId ?? "",
      fromImports: isFromImports,
      sourceIds: source?.ids ?? [],
    };
  });
}

export function buildFinishedGoodGridRows(
  outputs: BalancingOutputItem[],
  assignedWips: WipProductionItem[]
): FinishedGoodGridRow[] {
  const byProduct = groupWipsByProduct(assignedWips);
  return outputs.map((r) => {
    const isFromProduction = r.autoSource === "production";
    const source = isFromProduction ? byProduct.get(productSpecKey(r.productId, r.spec ?? "")) : undefined;
    const byDate = source ? source.dailyQuantities : (r.dailyQuantities ?? {});
    const carryOver = r.carryOverKg ?? 0;
    return {
      id: r.id,
      productId: r.productId,
      customerId: r.customerId,
      spec: r.spec ?? "",
      channel: r.channel,
      unitPrice: r.unitPrice,
      dailyQuantities: byDate,
      carryOverKg: carryOver,
      ...splitRepaidDebt(r),
      total: sumGridRow(byDate, carryOver),
      fromProduction: isFromProduction,
      sourceIds: source?.ids ?? [],
    };
  });
}

/* ---------- Dòng mẫu khối 2 (bán thành phẩm) ---------- */

/**
 * Một dòng MẪU của khối 2: mặt hàng × quy cách × khách × kênh × giá, chép từ kỳ gần
 * nhất cùng họ nguyên liệu. Bảng cân đối giấy in sẵn cả danh sách này (kể cả dòng
 * không ra hàng) — người dùng chỉ điền số, không phải thêm từng dòng.
 */
export interface FinishedGoodTemplateRow {
  /** Định danh DUY NHẤT của dòng mẫu (khoa + thứ tự) — cùng mặt hàng + khách có thể có
      nhiều dòng khác giá (bảng giấy: "2 da tẩm bột 9-12 · Seachemot" 7,95 và 9,2). */
  id: string;
  /** productId|spec|customerId */
  key: string;
  productId: string;
  spec: string;
  customerId: string;
  channel: BalancingOutputItem["channel"];
  unitPrice: number | null;
}

export const finishedGoodTemplateKey = (productId: string, spec: string, customerId: string): string =>
  `${productId}|${spec || ""}|${customerId || ""}`;

type PeriodSummary = Pick<BalancingPeriod, "id" | "materialTypeName" | "startDate" | "endDate">;
const periodEnd = (k: Pick<BalancingPeriod, "startDate" | "endDate">) => k.endDate || k.startDate || "";

/**
 * Kỳ làm MẪU cho khối 2: kỳ khác cùng họ NL có ít nhất một dòng bán thành phẩm.
 * Ưu tiên kỳ KẾT THÚC TRƯỚC kỳ này (mới nhất trước); không có thì lấy kỳ mới nhất
 * còn lại (VD kỳ đầu năm nhưng đã nhập kỳ sau trước).
 */
export function pickTemplatePeriod<K extends PeriodSummary>(
  ky: PeriodSummary,
  allPeriods: K[],
  allOutputs: Pick<BalancingOutputItem, "periodId" | "productId">[]
): K | null {
  const periodsWithRows = new Set(allOutputs.filter((r) => r.productId).map((r) => r.periodId));
  const ung = allPeriods
    .filter((k) => k.id !== ky.id && periodsWithRows.has(k.id) && isSameMaterialFamily(k.materialTypeName, ky.materialTypeName))
    .sort((a, b) => periodEnd(b).localeCompare(periodEnd(a)));
  const batDau = ky.startDate || "";
  return ung.find((k) => batDau && periodEnd(k) && periodEnd(k) < batDau) ?? ung[0] ?? null;
}

/**
 * Dòng mẫu từ các dòng khối 2 của kỳ mẫu, giữ thứ tự gốc. Cùng (mặt hàng, quy cách,
 * khách) mà KHÁC giá ⇒ vẫn là hai dòng (như bảng giấy); trùng cả giá ⇒ một dòng.
 */
export function buildFinishedGoodTemplateRows(templatePeriodRows: BalancingOutputItem[]): FinishedGoodTemplateRow[] {
  const ra = new Map<string, FinishedGoodTemplateRow>();
  const dem = new Map<string, number>();
  for (const r of templatePeriodRows) {
    if (!r.productId) continue;
    const key = finishedGoodTemplateKey(r.productId, r.spec ?? "", r.customerId);
    const priceKey = `${key}|${r.unitPrice ?? ""}`;
    if (ra.has(priceKey)) continue;
    const occurrence = dem.get(key) ?? 0;
    dem.set(key, occurrence + 1);
    ra.set(priceKey, {
      id: `${key}#${occurrence}`,
      key,
      productId: r.productId,
      spec: r.spec ?? "",
      customerId: r.customerId,
      channel: r.channel,
      unitPrice: r.unitPrice,
    });
  }
  return [...ra.values()];
}

/**
 * Dòng mẫu CHƯA có trong kỳ — đếm theo SỐ DÒNG: kỳ đã có m dòng cùng (mặt hàng, quy
 * cách, khách) thì bỏ m dòng mẫu đầu của khoá đó (gõ vào dòng mẫu thứ nhất không làm
 * dòng thứ hai biến mất). Kỳ có dòng cùng mặt hàng + quy cách mà CHƯA chọn khách (dòng
 * hút từ sổ sản xuất cũ) ⇒ ẩn mọi dòng mẫu của mặt hàng đó: hiện thêm cạnh nó dễ khiến
 * người dùng gõ số hai lần cho cùng một mặt hàng.
 */
export function findMissingTemplateRows(
  template: FinishedGoodTemplateRow[],
  finishedGoods: Pick<BalancingOutputItem, "productId" | "spec" | "customerId">[]
): FinishedGoodTemplateRow[] {
  const existing = new Map<string, number>();
  for (const r of finishedGoods) {
    const k = finishedGoodTemplateKey(r.productId, r.spec ?? "", r.customerId);
    existing.set(k, (existing.get(k) ?? 0) + 1);
  }
  const missingCustomerKeys = new Set(finishedGoods.filter((r) => !r.customerId).map((r) => productSpecKey(r.productId, r.spec ?? "")));
  const removed = new Map<string, number>();
  return template.filter((m) => {
    if (missingCustomerKeys.has(productSpecKey(m.productId, m.spec))) return false;
    const bo = removed.get(m.key) ?? 0;
    if (bo < (existing.get(m.key) ?? 0)) {
      removed.set(m.key, bo + 1);
      return false;
    }
    return true;
  });
}

/**
 * Gợi ý khách · kênh · đơn giá cho một mặt hàng (+ quy cách) mới vào kỳ:
 * 1) dòng mẫu cùng mặt hàng + quy cách; 2) dòng mẫu cùng mặt hàng;
 * 3) dòng GẦN NHẤT ở các kỳ khác (theo ngày cuối kỳ) cùng mặt hàng có đơn giá.
 * Không có gì ⇒ null (để trống, không bịa).
 */
export function suggestCustomerPrice(
  productId: string,
  spec: string,
  template: FinishedGoodTemplateRow[],
  allOutputs: BalancingOutputItem[],
  allPeriods: Pick<BalancingPeriod, "id" | "startDate" | "endDate">[],
  currentPeriod: string
): Pick<FinishedGoodTemplateRow, "customerId" | "channel" | "unitPrice"> | null {
  const m =
    template.find((x) => x.productId === productId && x.spec === (spec || "")) ??
    template.find((x) => x.productId === productId);
  if (m) return { customerId: m.customerId, channel: m.channel, unitPrice: m.unitPrice };
  const end = new Map(allPeriods.map((k) => [k.id, periodEnd(k)]));
  const ung = allOutputs
    .filter((r) => r.periodId !== currentPeriod && r.productId === productId && r.unitPrice != null)
    .sort(
      (a, b) =>
        Number((b.spec ?? "") === (spec || "")) - Number((a.spec ?? "") === (spec || "")) ||
        (end.get(b.periodId) ?? "").localeCompare(end.get(a.periodId) ?? "")
    )[0];
  return ung ? { customerId: ung.customerId, channel: ung.channel, unitPrice: ung.unitPrice } : null;
}

/* ---------- Ghi ngược ô ngày về sổ nguồn ---------- */

export type WriteBackResult =
  | { kind: "sua"; id: string; kg: number }
  | { kind: "them"; kg: number }
  | { kind: "tuChoi"; reason: string };

/**
 * Sửa một ô ngày của dòng bán thành phẩm ⇒ ghi ngược về sổ Sản xuất.
 *
 * - Không có dòng nguồn nào trong ngày ⇒ tạo dòng mới (nhập nhanh trong lưới).
 * - Đúng một dòng ⇒ sửa dòng đó.
 * - Nhiều dòng (nhiều ca, nhiều kho) ⇒ chỉnh dòng CUỐI để tổng ngày khớp số
 *   vừa gõ, giữ nguyên các dòng trước. Nếu phải làm dòng cuối âm thì từ chối —
 *   thà bắt người dùng vào sổ Sản xuất sửa đúng dòng còn hơn bịa số.
 */
export function writeBackDailyOutput(
  daySources: WipProductionItem[],
  newKg: number
): WriteBackResult {
  if (daySources.length === 0) return { kind: "them", kg: newKg };
  if (daySources.length === 1) {
    return { kind: "sua", id: daySources[0].id, kg: newKg };
  }
  const end = daySources[daySources.length - 1];
  const otherTotal = daySources.slice(0, -1).reduce((s, r) => s + r.quantityKg, 0);
  const remaining = newKg - otherTotal;
  if (remaining < 0) {
    return {
      kind: "tuChoi",
      reason: `Ngày này có ${daySources.length} dòng sản xuất, các dòng khác đã ${otherTotal} kg. Sửa trực tiếp ở màn Sản xuất bán thành phẩm.`,
    };
  }
  return { kind: "sua", id: end.id, kg: remaining };
}

/**
 * Mọi dòng sổ nhập rơi trong khoảng ngày của kỳ và CHƯA kỳ nào giữ — bất kể
 * loại nguyên liệu.
 *
 * Vì sao cần: `filterEligibleImports` lọc theo họ nguyên liệu, mà sổ nhập ghi loại NL
 * theo TÊN tự do (xem 30-nhap-hang). Xưởng gõ "2 da nguyên liệu" trong khi kỳ
 * tên "Bạch tuộc 2 da" ⇒ khớp tên thất bại và màn hình báo "không có gì để
 * lấy" dù sổ đầy số. Danh sách này là đường lui: cho người dùng tự tick dòng.
 */
export function filterFreeImportsInPeriod(
  ky: BalancingPeriod,
  imports: MaterialImportItem[]
): MaterialImportItem[] {
  const dates = new Set(getPeriodDates(ky));
  if (dates.size === 0) return [];
  return imports.filter((r) => dates.has(r.deliveryDate) && !r.balancingPeriodId);
}

/**
 * MỌI chuyến nhập rơi trong khoảng ngày của kỳ, kể cả dòng đang thuộc kỳ khác.
 *
 * Dùng để màn hình GIẢI THÍCH được vì sao trống. Ba lý do làm kỳ không thấy số
 * mà nhìn màn không đoán ra: tên loại NL lệch · dòng đã bị kỳ khác giữ · kỳ
 * khai nhầm ngày (sổ lọc theo ngày HÀNG VỀ, không phải ngày ghi sổ). Không đếm
 * được ba con số này thì màn chỉ biết nói "chưa có nguyên liệu".
 */
export function filterAllImportsInPeriod(
  ky: BalancingPeriod,
  imports: MaterialImportItem[]
): MaterialImportItem[] {
  const dates = new Set(getPeriodDates(ky));
  if (dates.size === 0) return [];
  return imports.filter((r) => dates.has(r.deliveryDate));
}

/**
 * Sửa một ô ngày của dòng nguyên liệu ⇒ ghi ngược về sổ Nhập hàng.
 * Cùng luật với `writeBackDailyOutput`: một dòng thì sửa thẳng, nhiều dòng thì
 * chỉnh dòng CUỐI cho tổng ngày khớp, phải làm âm thì từ chối.
 */
export function writeBackDailyImport(
  daySources: MaterialImportItem[],
  newKg: number
): WriteBackResult {
  if (daySources.length === 0) return { kind: "them", kg: newKg };
  if (daySources.length === 1) {
    return { kind: "sua", id: daySources[0].id, kg: newKg };
  }
  const end = daySources[daySources.length - 1];
  const otherTotal = daySources.slice(0, -1).reduce((s, r) => s + r.quantityKg, 0);
  const remaining = newKg - otherTotal;
  if (remaining < 0) {
    return {
      kind: "tuChoi",
      reason: `Ngày này có ${daySources.length} chuyến nhập, các chuyến khác đã ${otherTotal} kg. Sửa trực tiếp ở màn Nhập hàng.`,
    };
  }
  return { kind: "sua", id: end.id, kg: remaining };
}

/* ---------- Chuyển kỳ: nối kỳ trước sang kỳ sau ---------- */

/**
 * Kỳ liền trước của cùng một họ nguyên liệu: kết thúc TRƯỚC ngày bắt đầu kỳ này,
 * gần nhất. Dùng để lấy phần "chuyển kỳ âm" (hàng làm ra nhưng đẩy sang kỳ sau)
 * mà kỳ trước đã khai.
 */
export function findPreviousPeriod(
  ky: BalancingPeriod,
  allPeriods: BalancingPeriod[]
): BalancingPeriod | null {
  const batDau = ky.startDate;
  if (!batDau) return null;
  const prevRows = allPeriods
    .filter(
      (k) =>
        k.id !== ky.id &&
        isSameMaterialFamily(k.materialTypeName, ky.materialTypeName) &&
        (k.endDate || k.startDate || "") < batDau
    )
    .sort((a, b) => (b.endDate || b.startDate || "").localeCompare(a.endDate || a.startDate || ""));
  return prevRows[0] ?? null;
}

export interface CarryOverRow {
  /** id dòng ở kỳ TRƯỚC — đánh dấu đã nhận để không lấy hai lần. */
  sourceId: string;
  name: string;
  kg: number;
}

/**
 * Phần chuyển kỳ ÂM của kỳ trước mà chưa kỳ nào nhận.
 *
 * Quy ước dấu (xem 31-can-doi-ky.md): âm = đẩy sang kỳ sau. Kỳ này nhận thì
 * dựng dòng có chuyển kỳ DƯƠNG bằng đúng trị tuyệt đối — vòng gối đầu khép lại
 * mà không ai phải mở file kỳ cũ ra chép tay.
 */
export function listPendingCarryOvers<
  T extends { id: string; carryOverKg?: number; carryOverPeriodId?: string },
>(prevPeriodRows: T[], ten: (r: T) => string): CarryOverRow[] {
  return prevPeriodRows
    .filter((r) => (r.carryOverKg ?? 0) < 0 && !r.carryOverPeriodId)
    .map((r) => ({ sourceId: r.id, name: ten(r), kg: Math.abs(r.carryOverKg ?? 0) }));
}
