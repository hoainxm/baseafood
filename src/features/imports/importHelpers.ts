// ============================================================
// Tên file: src/features/imports/importHelpers.ts
// Tên tiếng Việt: Kiểu & hàm thuần của màn Nhập hàng (đầu chuyến, dòng bảng, gom chuyến, kiểm lỗi)
// Description: Pure types/helpers for the Material Import screen — no React, unit-testable.
// Tách khỏi MaterialImportScreen.tsx (2169 dòng) ngày 2026-09-21 — KHÔNG đổi logic.
// ============================================================
import type {
  Category,
  ImportShipment,
  MaterialImportItem,
  ScrapItem,
  Workshop,
} from "@/types";
import { calculateImportAmount, isBackdatedImport } from "@/types";
import { newId } from "@/lib/store";
import type { FieldError } from "@/design-system";
import type { OcrResult } from "@/lib/ocr";

export const WORKSHOPS: Workshop[] = ["Đông", "Cá", "Khô"];

/** Loại phế liệu hay gặp — vẫn thêm mới tại chỗ được. */
export const SCRAP_SUGGESTIONS = ["Nội tạng", "Dạt"];

/* ---------- Phế liệu cân cuối ngày: bản nháp ô nhập (một nút Lưu) ---------- */

/** Một dòng phế liệu trên form cuối ngày. `id` null = loại chưa ghi (ô trống sẵn). */
export interface ScrapDraftRow {
  key: string;
  id: string | null;
  name: string;
  quantityKg: number | null;
  sellingPrice: number | null;
  /** Đã được kỳ cân đối hút (chỉ để hiện nhãn). */
  periodId: string;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Form phế liệu của MỘT ngày + xưởng: mọi dòng đã ghi + ô trống sẵn cho từng loại hay
 * gặp chưa ghi (Nội tạng, Dạt) ⇒ người dùng thấy ngay phải cân gì, khỏi quên.
 * Loại hay gặp đứng trước theo thứ tự `SCRAP_SUGGESTIONS`.
 */
export function buildScrapDraft(daySaved: ScrapItem[]): ScrapDraftRow[] {
  const rows: ScrapDraftRow[] = daySaved.map((r) => ({
    key: r.id,
    id: r.id,
    name: r.name,
    quantityKg: r.quantityKg,
    sellingPrice: r.sellingPrice,
    periodId: r.periodId,
  }));
  for (const name of SCRAP_SUGGESTIONS)
    if (!rows.some((r) => sameName(r.name, name)))
      rows.push({ key: `new:${name}`, id: null, name, quantityKg: null, sellingPrice: null, periodId: "" });
  const rank = (name: string) => {
    const i = SCRAP_SUGGESTIONS.findIndex((x) => sameName(x, name));
    return i < 0 ? SCRAP_SUGGESTIONS.length : i;
  };
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r.name) - rank(b.r.name) || a.i - b.i)
    .map((x) => x.r);
}

export const scrapDraftTotalKg = (draft: ScrapDraftRow[]): number =>
  draft.reduce((s, r) => s + (r.quantityKg && r.quantityKg > 0 ? r.quantityKg : 0), 0);

/** Lỗi trước khi lưu: có số kg mà chưa có tên loại. */
export function validateScrapDraft(draft: ScrapDraftRow[]): FieldError[] {
  return draft
    .filter((r) => (r.quantityKg ?? 0) > 0 && !r.name.trim())
    .map(() => ({ field: "Loại phế liệu", message: "Có dòng đã gõ kg nhưng chưa chọn loại" }));
}

/**
 * Áp bản nháp vào sổ phế liệu (một lần, một nút Lưu): dòng đã ghi có kg > 0 ⇒ cập nhật;
 * dòng đã ghi bị XÓA số kg ⇒ bỏ khỏi sổ; ô trống sẵn có kg > 0 ⇒ ghi mới (nguồn "Nhập
 * hàng", ngày + xưởng của form, chưa vào kỳ). Dòng của ngày/xưởng khác không đụng.
 */
export function applyScrapDraft(
  all: ScrapItem[],
  draft: ScrapDraftRow[],
  date: string,
  workshop: Workshop,
): { next: ScrapItem[]; added: number; updated: number; removed: number; changed: boolean } {
  const removedIds = new Set<string>();
  const updates = new Map<string, ScrapItem>();
  const created: ScrapItem[] = [];
  for (const d of draft) {
    const kgValue = d.quantityKg ?? 0;
    const name = d.name.trim();
    if (d.id) {
      const orig = all.find((r) => r.id === d.id);
      if (!orig) continue;
      if (!(kgValue > 0)) removedIds.add(d.id);
      else if (orig.name !== name || orig.quantityKg !== kgValue || orig.sellingPrice !== d.sellingPrice)
        updates.set(d.id, { ...orig, name, quantityKg: kgValue, sellingPrice: d.sellingPrice });
    } else if (kgValue > 0 && name) {
      created.push({
        id: newId(),
        periodId: "",
        name,
        quantityKg: kgValue,
        sellingPrice: d.sellingPrice,
        date,
        workshop,
        source: "Nhập hàng",
      });
    }
  }
  const next = [
    ...all.filter((r) => !removedIds.has(r.id)).map((r) => updates.get(r.id) ?? r),
    ...created,
  ];
  return {
    next,
    added: created.length,
    updated: updates.size,
    removed: removedIds.size,
    changed: created.length + updates.size + removedIds.size > 0,
  };
}

/** Đầu chuyến đang nhập — dùng chung cho mọi dòng loại hàng trong chuyến. */
export interface ShipmentHeader {
  deliveryDate: string;
  postingDate: string;
  backdateReason: string;
  workshop: Workshop;
  supplierName: string;
  driverName: string;
  licensePlate: string;
  note: string;
  /** Mã SSCC nhà nước — thường để trống, điền sau khi được cấp. */
  ssccCode: string;
  /** Đường dẫn ảnh phiếu tay đã chụp (nền OCR). Rỗng = chưa chụp. */
  scanPath: string;
}

/** Chữ viết tắt phân xưởng cho mã lô. */
export const WORKSHOP_INITIALS: Record<Workshop, string> = {
  Đông: "Đ",
  Cá: "C",
  Khô: "K",
};

/** Sinh mã lô nội bộ đọc được: ‹chữ xưởng›-‹yymmdd›-‹stt trong ngày›, vd "Đ-260902-01".
 *  Là NHÃN hiển thị/trace, không phải khóa — trùng cũng không sao, cho sửa tay sau. */
export function generateLotCode(
  deliveryDate: string,
  workshop: Workshop,
  shipments: ImportShipment[],
): string {
  const w = WORKSHOP_INITIALS[workshop] ?? "X";
  const date = (deliveryDate || "").replace(/-/g, "").slice(2); // yymmdd
  const stt =
    shipments.filter(
      (c) => c.deliveryDate === deliveryDate && c.workshop === workshop,
    ).length + 1;
  return `${w}-${date}-${String(stt).padStart(2, "0")}`;
}

/**
 * Một dòng loại hàng trong BẢNG nhập của chuyến. Cả chuyến điền một lượt rồi
 * lưu một lần (batch) thay vì "thêm từng loại → bấm lưu" như bản trước.
 *  - `key`: khóa React ổn định theo dòng (không đổi khi gõ).
 *  - `id`: id dòng ĐÃ LƯU (`null` = dòng mới chưa lưu). Khi sửa chuyến, dòng cũ
 *    giữ nguyên id để cập nhật đúng bản ghi; bỏ dòng = không đưa lại vào persist.
 */
export interface ImportLine {
  key: string;
  id: string | null;
  category: Category;
  materialTypeName: string;
  quantityKg: number;
  unitPrice: number | null;
  /** Dòng ĐIỀN SẴN theo chuyến gần nhất của đại lý (loại + giá), chờ gõ kg. Chưa
   *  có kg thì coi như KHÔNG có dữ liệu: lưu tự bỏ qua, không nài lỗi. Người dùng
   *  tự sửa loại/giá thì cờ này tắt (thành dòng thường). */
  isSuggested?: boolean;
  /** Ngày của lượt giao mà ĐƠN GIÁ điền sẵn lấy từ đó — hiện cạnh ô giá để người
   *  nhập biết đây là giá cũ, không phải giá vừa gõ. Tự sửa giá thì xóa. */
  priceDate?: string;
}

export const DEFAULT_CATEGORY: Category = "Bạch tuộc";

/** Dòng trống mới cho bảng (mặc định theo loài đang dùng cho nhanh). */
export const createEmptyImportLine = (category: Category = DEFAULT_CATEGORY): ImportLine => ({
  key: newId(),
  id: null,
  category,
  materialTypeName: "",
  quantityKg: 0,
  unitPrice: null,
});

/** Dòng đã có dữ liệu (dù chưa đủ) — dùng để biết khi nào cần thêm dòng trống. */
export const importLineHasData = (d: ImportLine): boolean =>
  d.isSuggested
    ? d.quantityKg > 0
    : d.materialTypeName.trim() !== "" ||
      d.quantityKg > 0 ||
      d.unitPrice != null;

/** Dòng đủ để lưu (có loại + số lượng > 0). */
export const isLineComplete = (d: ImportLine): boolean =>
  d.materialTypeName.trim() !== "" && d.quantityKg > 0;

/**
 * Một chuyến hiện trên sổ. Có hai nguồn:
 *  - chuyến THẬT (bảng `chuyen_nhap`) — mọi chuyến ghi từ nay;
 *  - nhóm NGẦM của dữ liệu cũ (dòng chưa có `chuyenId`) — gom theo
 *    (ngày + xưởng + đại lý + xe) đúng như cách màn cũ đếm.
 */
export interface ShipmentGroup {
  groupKey: string;
  shipment: ImportShipment | null;
  deliveryDate: string;
  postingDate: string;
  backdateReason: string;
  workshop: Workshop;
  supplierName: string;
  driverName: string;
  licensePlate: string;
  note: string;
  rows: MaterialImportItem[];
  totalKg: number;
  totalAmount: number;
  isBackdated: boolean;
}

export function groupShipments(
  rows: MaterialImportItem[],
  shipments: ImportShipment[],
): ShipmentGroup[] {
  const theoId = new Map(shipments.map((c) => [c.id, c]));
  const nhoms = new Map<string, ShipmentGroup>();

  for (const r of rows) {
    const c = r.shipmentId ? theoId.get(r.shipmentId) : undefined;
    const key = c
      ? c.id
      : `ngam|${r.deliveryDate}|${r.workshop}|${r.supplierName}|${r.driverName}|${r.licensePlate}`;
    let group = nhoms.get(key);
    if (!group) {
      group = {
        groupKey: key,
        shipment: c ?? null,
        deliveryDate: c?.deliveryDate ?? r.deliveryDate,
        postingDate: c?.postingDate ?? r.deliveryDate,
        backdateReason: c?.backdateReason ?? "",
        workshop: c?.workshop ?? r.workshop,
        supplierName: c?.supplierName ?? r.supplierName,
        driverName: c?.driverName ?? r.driverName,
        licensePlate: c?.licensePlate ?? r.licensePlate,
        note: c?.note ?? r.note,
        rows: [],
        totalKg: 0,
        totalAmount: 0,
        isBackdated: false,
      };
      group.isBackdated = isBackdatedImport(group);
      nhoms.set(key, group);
    }
    group.rows.push(r);
    group.totalKg += r.quantityKg || 0;
    group.totalAmount += calculateImportAmount(r);
  }

  return [...nhoms.values()].sort(
    (a, b) =>
      a.deliveryDate.localeCompare(b.deliveryDate) ||
      a.supplierName.localeCompare(b.supplierName, "vi") ||
      a.groupKey.localeCompare(b.groupKey),
  );
}

/** Kiểm tra đầu chuyến — dùng chung cho lúc ghi mới và lúc sửa. */
export function validateShipmentHeader(d: ShipmentHeader, isLocked: boolean): FieldError[] {
  const ls: FieldError[] = [];
  if (!d.supplierName.trim())
    ls.push({ field: "Đại lý", message: "Chưa chọn đại lý giao hàng" });
  if (d.postingDate < d.deliveryDate)
    ls.push({
      field: "Ngày ghi sổ",
      message: "Ngày ghi sổ không thể trước ngày hàng về xưởng",
    });
  const needsReason = isBackdatedImport(d) || isLocked;
  if (needsReason && !d.backdateReason.trim())
    ls.push({
      field: "Lý do ghi bù",
      message: isLocked
        ? "Ngày này đã chốt — phải ghi rõ vì sao ghi thêm"
        : "Ghi sau ngày hàng về — phải ghi rõ lý do (VD: chờ hóa đơn)",
    });
  return ls;
}

/* ---------- Gợi ý theo đại lý — chọn đại lý là kéo theo xe + loại hàng ---------- */
// Tính TỪ DÒNG HÀNG (material_imports), không từ bảng chuyến: dòng luôn mang đủ
// ngày · đại lý · tài xế · biển số, kể cả dữ liệu cũ không có chuyến cha.

/** Khóa gom một lượt giao: chuyến thật theo id, dữ liệu cũ theo (ngày + xe). */
const tripKey = (r: MaterialImportItem) =>
  r.shipmentId || `ngam|${r.deliveryDate}|${r.licensePlate}|${r.driverName}`;

/** Mới nhất lên đầu: theo ngày hàng về, cùng ngày thì theo id (id sinh theo giờ). */
const newestFirst = (a: MaterialImportItem, b: MaterialImportItem) =>
  b.deliveryDate.localeCompare(a.deliveryDate) || b.id.localeCompare(a.id);

/** Biển số bỏ dấu cách/chấm/gạch, viết hoa — "72c-16603" và "72C 16603" là một xe. */
export const normalizePlate = (s: string) =>
  s.replace(/[\s.\-']/g, "").toUpperCase();

/** Đại lý hay giao cho xưởng này gần đây — nhiều lượt trước, bằng nhau thì mới trước. */
export function getFrequentSuppliers(
  rows: MaterialImportItem[],
  workshop: Workshop,
  maxCount = 4,
  lookbackTrips = 40,
): string[] {
  const trips = new Map<string, string>(); // khóa lượt → đại lý (giữ thứ tự mới→cũ)
  for (const r of rows
    .filter((x) => x.workshop === workshop && x.supplierName)
    .sort(newestFirst)) {
    if (trips.size >= lookbackTrips && !trips.has(tripKey(r))) break;
    if (!trips.has(tripKey(r))) trips.set(tripKey(r), r.supplierName);
  }
  const counts = new Map<string, { n: number; firstIndex: number }>();
  [...trips.values()].forEach((name, i) => {
    const d = counts.get(name);
    if (d) d.n += 1;
    else counts.set(name, { n: 1, firstIndex: i });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].firstIndex - b[1].firstIndex)
    .slice(0, maxCount)
    .map(([name]) => name);
}

/** Một biển số từng chở cho đại lý, kèm tài xế GẦN NHẤT lái xe đó. */
export interface VehicleSuggestion {
  licensePlate: string;
  driverName: string;
}

/**
 * Xe + tài xế từng chở cho đại lý — TÁCH hai danh sách vì thực tế tài xế đổi xe
 * liên tục (gộp theo cặp thì vài thẻ không phủ hết tổ hợp). Chạm biển số ⇒ điền
 * luôn tài xế gần nhất của xe đó; khác người thì chạm thêm tên tài xế.
 * Biển số gộp theo dạng chuẩn hóa và hiển thị VIẾT HOA cho sổ sạch.
 */
export function getSupplierVehicles(
  rows: MaterialImportItem[],
  supplierName: string,
  maxCount = 6,
): { plates: VehicleSuggestion[]; drivers: string[] } {
  const plateMap = new Map<string, VehicleSuggestion>();
  const drivers = new Map<string, string>();
  if (supplierName)
    for (const r of rows
      .filter((x) => x.supplierName === supplierName)
      .sort(newestFirst)) {
      const plate = r.licensePlate.trim().toUpperCase();
      const tx = r.driverName.trim();
      if (plate && !plateMap.has(normalizePlate(plate)) && plateMap.size < maxCount)
        plateMap.set(normalizePlate(plate), { licensePlate: plate, driverName: tx });
      if (tx && !drivers.has(tx.toLowerCase()) && drivers.size < maxCount)
        drivers.set(tx.toLowerCase(), tx);
    }
  return { plates: [...plateMap.values()], drivers: [...drivers.values()] };
}

/**
 * Mẫu bảng loại hàng cho đại lý: các loại đại lý này giao trong `tripCount` lượt gần
 * nhất (loại của lượt mới nhất đứng trước), kèm ĐƠN GIÁ gần nhất của từng loại.
 * Kg để trống — người nhập chỉ còn gõ số. Không có lịch sử ⇒ mảng rỗng.
 */
export function getSupplierLineTemplates(
  rows: MaterialImportItem[],
  supplierName: string,
  workshop: Workshop,
  tripCount = 3,
  maxCount = 6,
): ImportLine[] {
  if (!supplierName) return [];
  const supplierRows = rows.filter(
    (r) => r.supplierName === supplierName && r.workshop === workshop,
  );
  // Các lượt gần nhất (mới → cũ).
  const trips: string[] = [];
  for (const r of [...supplierRows].sort(newestFirst)) {
    if (trips.includes(tripKey(r))) continue;
    if (trips.length >= tripCount) break;
    trips.push(tripKey(r));
  }
  // Trong một lượt giữ THỨ TỰ GHI (thứ tự mảng gốc) — đúng thứ tự trên tờ giấy.
  const templates = new Map<string, ImportLine>();
  for (const k of trips)
    for (const r of supplierRows) {
      if (tripKey(r) !== k) continue;
      const name = r.materialTypeName.trim();
      if (!name) continue;
      const existing = templates.get(name);
      if (!existing)
        templates.set(name, {
          ...createEmptyImportLine(r.category),
          materialTypeName: name,
          unitPrice: r.unitPrice,
          priceDate: r.unitPrice != null ? r.deliveryDate : undefined,
          isSuggested: true,
        });
      else if (existing.unitPrice == null && r.unitPrice != null) {
        existing.unitPrice = r.unitPrice;
        existing.priceDate = r.deliveryDate;
      }
    }
  return [...templates.values()].slice(0, maxCount);
}

/**
 * ĐỔI ĐẠI LÝ giữa chừng: dựng lại bảng theo mẫu của đại lý MỚI nhưng GIỮ số kg đã
 * gõ — giá điền sẵn của đại lý cũ KHÔNG được ở lại (sai tiền). Quy tắc:
 *  - loại có trong mẫu mới ⇒ lấy giá + ngày giá của đại lý mới, kg giữ theo tên loại;
 *  - dòng gợi ý cũ đã gõ kg mà đại lý mới chưa từng giao ⇒ giữ kg, GIÁ ĐỂ TRỐNG;
 *  - dòng người dùng tự nhập (không phải gợi ý) ⇒ giữ nguyên, kể cả giá tự gõ.
 */
export function applyNewSupplierTemplate(prev: ImportLine[], templates: ImportLine[]): ImportLine[] {
  const oldKgByType = new Map(
    prev
      .filter((d) => d.isSuggested && d.quantityKg > 0)
      .map((d) => [d.materialTypeName, d.quantityKg]),
  );
  const templateNames = new Set(templates.map((d) => d.materialTypeName));
  const fromTemplate = templates.map((d) => ({
    ...d,
    quantityKg: oldKgByType.get(d.materialTypeName) ?? 0,
  }));
  const staleSuggestions = prev
    .filter(
      (d) => d.isSuggested && d.quantityKg > 0 && !templateNames.has(d.materialTypeName),
    )
    .map((d) => ({ ...d, unitPrice: null, priceDate: undefined }));
  const userEntered = prev.filter((d) => !d.isSuggested && importLineHasData(d));
  const result = [...fromTemplate, ...staleSuggestions, ...userEntered];
  return result.length ? result : [createEmptyImportLine()];
}

/** Dòng điền sẵn bị BỎ QUA khi lưu vì chưa gõ kg — để báo rõ, không bỏ im lặng. */
export const getSkippedSuggestedLines = (items: ImportLine[]): ImportLine[] =>
  items.filter((d) => d.isSuggested && !(d.quantityKg > 0));

/**
 * Biển số + tài xế ĐÃ TỪNG ghi (mọi đại lý, mới nhất trước) — gửi kèm OCR để máy khớp
 * chữ tay trên phiếu về đúng cách viết đã có trong sổ, khỏi đẻ biến thể "72c-16603".
 */
export function getKnownVehicles(
  rows: MaterialImportItem[],
  maxCount = 300,
): { plates: string[]; drivers: string[] } {
  const plates = new Map<string, string>();
  const drivers = new Map<string, string>();
  for (const r of [...rows].sort(newestFirst)) {
    const plate = r.licensePlate.trim().toUpperCase();
    const driver = r.driverName.trim();
    if (plate && !plates.has(normalizePlate(plate)) && plates.size < maxCount) plates.set(normalizePlate(plate), plate);
    if (driver && !drivers.has(driver.toLowerCase()) && drivers.size < maxCount) drivers.set(driver.toLowerCase(), driver);
  }
  return { plates: [...plates.values()], drivers: [...drivers.values()] };
}

/** Một dòng OCR đọc được: loại NL (đã khớp danh mục) + kg + đơn giá nếu phiếu có ghi. */
export interface OcrLineInput {
  materialType: string;
  kg: number;
  unitPrice?: number | null;
}

/**
 * Ghép dòng OCR vào bảng loại hàng. Dòng mẫu (`goiY`) cùng loại còn trống kg ⇒ điền kg
 * vào đó, giá phiếu ghi thì thay giá mẫu (không ghi thì giữ giá lượt trước). Không có
 * dòng mẫu ⇒ thêm dòng mới cuối bảng. Dòng trống hẳn (chưa chọn gì) bị bỏ cho gọn.
 */
export function mergeOcrLines(
  items: ImportLine[],
  lines: OcrLineInput[],
  categoryOf: (materialType: string) => Category | undefined,
  fallbackCategory: Category,
): ImportLine[] {
  let result = [...items];
  for (const line of lines) {
    const price = line.unitPrice != null && line.unitPrice > 0 ? line.unitPrice : null;
    const idx = result.findIndex((d) => d.materialTypeName === line.materialType && !(d.quantityKg > 0));
    if (idx >= 0) {
      const d = result[idx];
      result[idx] = {
        ...d,
        quantityKg: line.kg,
        unitPrice: price ?? d.unitPrice,
        priceDate: price != null ? undefined : d.priceDate,
        isSuggested: false,
      };
      continue;
    }
    result = result.filter((d) => d.isSuggested || importLineHasData(d)).concat({
      ...createEmptyImportLine(categoryOf(line.materialType) ?? result[result.length - 1]?.category ?? fallbackCategory),
      materialTypeName: line.materialType,
      quantityKg: line.kg,
      unitPrice: price,
    });
  }
  return result.length ? result : [createEmptyImportLine(fallbackCategory)];
}

/**
 * Lịch sử giao gửi kèm OCR, mỗi đại lý một dòng "Đại lý: loại (giá) · loại (giá)…" —
 * đại lý giao gần nhất trước, loại theo lượt mới nhất trước, giá = giá gần nhất. Phiếu
 * tay chỉ ghi "2Da NL 80↑" (không ghi loài) ⇒ máy cần biết đại lý đó hay giao gì.
 */
export function buildSupplierHistory(
  rows: MaterialImportItem[],
  maxSuppliers = 60,
  maxTypes = 8,
): string[] {
  const bySupplier = new Map<string, Map<string, number | null>>();
  for (const r of [...rows].sort(newestFirst)) {
    if (!r.supplierName || !r.materialTypeName) continue;
    let types = bySupplier.get(r.supplierName);
    if (!types) {
      if (bySupplier.size >= maxSuppliers) continue;
      types = new Map();
      bySupplier.set(r.supplierName, types);
    }
    if (!types.has(r.materialTypeName) && types.size < maxTypes) types.set(r.materialTypeName, r.unitPrice);
  }
  return [...bySupplier].map(
    ([supplier, types]) =>
      `${supplier}: ${[...types].map(([t, p]) => (p != null ? `${t} (${p.toLocaleString("vi-VN")})` : t)).join(" · ")}`,
  );
}

/** Ô đầu chuyến trong bảng đối chiếu OCR — tick ô nào thì điền ô đó. */
export const OCR_HEADER_FIELDS = ["date", "supplier", "workshop", "licensePlate", "driverName"] as const;
export type OcrHeaderField = (typeof OCR_HEADER_FIELDS)[number];

export interface OcrSelection {
  header: Set<OcrHeaderField>;
  lines: Set<number>;
}

/** Mặc định tick mọi ô máy đọc được + mọi dòng — người soát BỎ tick ô sai. */
export function defaultOcrSelection(r: OcrResult): OcrSelection {
  return {
    header: new Set(OCR_HEADER_FIELDS.filter((f) => !!r[f])),
    lines: new Set(r.lines.map((_, i) => i)),
  };
}

/** Kết quả chỉ còn các ô / dòng đang tick (ô bỏ tick = coi như máy không đọc được). */
export function applyOcrSelection(r: OcrResult, sel: OcrSelection): OcrResult {
  const pick = <K extends OcrHeaderField>(f: K) => (sel.header.has(f) ? r[f] : undefined);
  return {
    ...r,
    date: pick("date"),
    supplier: pick("supplier"),
    workshop: pick("workshop"),
    licensePlate: pick("licensePlate"),
    driverName: pick("driverName"),
    lines: r.lines.filter((_, i) => sel.lines.has(i)),
  };
}
