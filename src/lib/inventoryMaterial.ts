// ============================================================
// Tên file: src/lib/inventoryMaterial.ts
// Tên tiếng Việt: Sổ Nhập–Xuất–Tồn kho nguyên liệu (kho đông dự trữ)
// Description: Raw-material inventory (frozen reserve) NXT ledger — pure, no React
// ============================================================
import type {
  BalancingPeriod,
  BalancingInputItem,
  MaterialImportItem,
  MaterialOpeningStock,
  DailyLock,
  DailyQuantities,
  DomesticSaleItem,
  Workshop,
} from "@/types";
import { sumGridRow } from "@/types";
import { getMaterialFamily, isSameMaterialFamily, getBalancingStockLineKind, getPeriodDates } from "@/lib/balancingGrid";

/**
 * VÌ SAO CÓ FILE NÀY — điểm đau số 1: "tồn nguyên liệu cuối kỳ sai do ghi chép
 * tay". Sổ này suy TỒN NGUYÊN LIỆU hoàn toàn từ dữ liệu đã có, KHÔNG bắt tổ
 * trưởng ghi tay lần hai (quyết định nghiệp vụ: "xuất tự suy từ cân đối", "kg
 * thuần"), nên số không thể lệch sổ gốc.
 *
 * MÔ HÌNH — tồn kho nguyên liệu CHÍNH LÀ kho đông dự trữ của vòng gối đầu:
 *
 *   Tồn cuối = Tồn đầu + Đông gửi (nhập kho tồn) − Xả đông (xuất kho tồn)
 *
 * ánh xạ thẳng sang cột "Chuyển kỳ" của Cân đối (xem 31-can-doi-ky.md):
 *   - carryOverKg < 0  = ĐÔNG GỬI  → phần đẩy sang kỳ sau, +vào kho tồn.
 *   - carryOverKg > 0  = XẢ ĐÔNG   → phần lấy từ kỳ trước ra dùng, −khỏi kho tồn.
 * Nên tồn cuối kỳ này = phần "nhận chuyển kỳ" mà kỳ sau lấy về — khép vòng mà
 * không ai phải mở file kỳ cũ chép tay.
 *
 * HAI DÒNG KHO Ở CÂN ĐỐI (2026-10-06): khối NL có dòng cố định "Lấy xả đông"
 * (đầu bảng) và "Gửi đông" (cuối bảng) — xem `getBalancingStockLineKind`. Lấy xả đông = TRỪ
 * tồn (cả dòng: ngày + chuyển kỳ), Gửi đông = CỘNG tồn. Chuyển kỳ ở các dòng
 * thường vẫn đọc như cũ (dữ liệu trước khi bỏ cột).
 *
 * CÒN DỞ SẢN XUẤT (khép vòng G1, migration 0038): khi chốt ngày SX, tổ trưởng
 * ghi NL chưa chế biến hết đem lưu kho, TÁCH THEO loại NL (production_locks
 * .leftover_by_material). HƯỚNG 1 (chốt 2026-09-06 với chủ dự án): "ghi ở SẢN
 * XUẤT là chính" ⇒ ĐÔNG GỬI = còn dở SX của kỳ (cùng họ NL + ngày chốt trong
 * kỳ) NẾU có; chưa có (dữ liệu cũ / kỳ chưa dùng SX còn dở) mới lấy Chuyển kỳ
 * âm khai tay ở Cân đối. KHÔNG cộng cả hai ⇒ HẾT cộng đôi. Kế toán khỏi khai
 * Chuyển kỳ âm cho đông gửi; xả đông (Chuyển kỳ dương) vẫn khai bình thường.
 *
 * "Nhập tươi" (material_imports) đi kèm làm bối cảnh để sổ phủ TOÀN BỘ nguyên
 * liệu mỗi ngày; phần lớn NL tươi chế biến ngay trong kỳ nên không đọng thành
 * tồn — chỉ phần cấp đông (đông gửi) mới ở lại kho tồn.
 *
 * BỘ DÒ LỖI THẬT: tồn cuối < 0 nghĩa là xả đông nhiều hơn số đang trữ — chắc
 * chắn sai ghi chép. Màn hình phải gọi tên, không được giấu (luật "màn tự giải
 * thích" của 31-can-doi-ky.md).
 *
 * ⚠️ v1 — quy tắc chính xác nằm DUY NHẤT ở file này; phải đối chiếu tay với một
 * kỳ có số thật (bạch tuộc 2 da 21–25/07) trước khi tin con số.
 */

/** Một dòng sổ NXT nguyên liệu cho MỘT kỳ cân đối của MỘT họ nguyên liệu. */
export interface MaterialPeriodNxtRow {
  periodId: string;
  materialFamily: string; // họ nguyên liệu (gom 2 size)
  periodMaterialName: string; // materialTypeName của kỳ (để hiện)
  startDate: string;
  endDate: string;
  openingKg: number; // kho đông đầu kỳ (kế thừa kỳ trước / tồn đầu khai tay)
  freezeDepositKg: number; // + vào kho tồn: ĐÔNG GỬI hoà giải (xem freezeDepositSource)
  /** Đông gửi lấy từ đâu: dòng Gửi đông ở Cân đối › còn dở SX › chuyển kỳ âm (cũ). */
  freezeDepositSource: "can-doi" | "san-xuat" | "chuyen-ky" | "";
  balancingFreezeDepositKg: number; // Σ dòng "Gửi đông" ở Cân đối (kg dương) — để đối chiếu với productionLeftoverKg
  productionLeftoverKg: number; // còn dở khai ở SX (0038) — luôn tính để đối chiếu
  thawKg: number; // − khỏi kho tồn (dòng Lấy xả đông + chuyển kỳ dương cũ)
  closingKg: number; // openingKg + freezeDepositKg − thawKg
  freshInKg: number; // Σ nhập tươi trong kỳ (bối cảnh, không vào kho tồn)
  dailyFreshIn: DailyQuantities; // nhập tươi theo ngày (cho báo cáo theo ngày)
  isNegative: boolean; // closingKg < 0 → lỗi ghi chép
  hasManualOpening: boolean; // openingKg lấy từ tồn đầu khai tay (kỳ đầu tiên của họ)
}

/**
 * XẢ ĐÔNG của kỳ (− kho): cả dòng "Lấy xả đông" (ngày + chuyển kỳ) + chuyển kỳ
 * DƯƠNG của dòng thường (cách ghi cũ trước khi bỏ cột chuyển kỳ ở khối NL).
 */
function sumThaw(inputs: BalancingInputItem[], periodId: string): number {
  let total = 0;
  for (const r of inputs) {
    if (r.periodId !== periodId) continue;
    const lineKind = getBalancingStockLineKind(r);
    if (lineKind === "lay-xa-dong") total += sumGridRow(r.dailyQuantities, r.carryOverKg);
    else if (!lineKind && (r.carryOverKg ?? 0) > 0) total += r.carryOverKg ?? 0;
  }
  return total;
}

/** Σ dòng "Gửi đông" ở Cân đối (lưu âm như dòng giảm) — trả kg DƯƠNG. */
function sumBalancingFreezeDeposit(inputs: BalancingInputItem[], periodId: string): number {
  return inputs
    .filter((r) => r.periodId === periodId && getBalancingStockLineKind(r) === "gui-dong")
    .reduce((s, r) => s + Math.abs(sumGridRow(r.dailyQuantities, r.carryOverKg)), 0);
}

/** Chuyển kỳ ÂM của dòng thường (cách ghi đông gửi cũ) — kg dương. */
function sumNegativeCarry(inputs: BalancingInputItem[], periodId: string): number {
  return inputs
    .filter((r) => r.periodId === periodId && !getBalancingStockLineKind(r) && (r.carryOverKg ?? 0) < 0)
    .reduce((s, r) => s + Math.abs(r.carryOverKg ?? 0), 0);
}

/** Tồn đầu khai tay áp cho một họ NL: cộng mọi dòng cùng họ (+ xưởng) có mốc ≤ ngày. */
function manualOpeningStock(
  opening: MaterialOpeningStock[],
  materialFamily: string,
  toDate: string,
  workshop?: Workshop,
): number {
  return opening
    .filter(
      (o) =>
        isSameMaterialFamily(o.materialTypeName, materialFamily) &&
        (!workshop || o.workshop === workshop) &&
        (!o.asOfDate || o.asOfDate <= toDate),
    )
    .reduce((s, o) => s + (o.quantityKg || 0), 0);
}

/**
 * Còn dở SX (0038) rơi vào một kỳ: các lần chốt ngày SX có ngày chốt trong kỳ,
 * cộng phần leftover của loại NL cùng họ với kỳ, THEO NGÀY CHỐT (để Cân đối điền
 * dòng Gửi đông đúng từng ngày). Xưởng lọc như nhập tươi.
 */
export function sumLeftoverByDay(
  locks: DailyLock[],
  ky: Pick<BalancingPeriod, "startDate" | "endDate" | "materialTypeName">,
  workshop?: Workshop,
): DailyQuantities {
  const dates = new Set(getPeriodDates(ky));
  const ra: DailyQuantities = {};
  if (dates.size === 0) return ra;
  for (const lk of locks) {
    if (workshop && lk.workshop !== workshop) continue;
    if (!dates.has(lk.lockDate)) continue;
    const lb = lk.leftoverByMaterial;
    if (!lb) continue;
    for (const [ten, v] of Object.entries(lb)) {
      const kg = Number(v) || 0;
      if (kg && isSameMaterialFamily(ten, ky.materialTypeName))
        ra[lk.lockDate] = (ra[lk.lockDate] ?? 0) + kg;
    }
  }
  return ra;
}

function leftoverInPeriod(
  locks: DailyLock[],
  ky: BalancingPeriod,
  workshop?: Workshop,
): number {
  return Object.values(sumLeftoverByDay(locks, ky, workshop)).reduce((s, v) => s + v, 0);
}

/**
 * Còn dở SX (0038) KHÔNG khớp kỳ nào: leftover ghi ở ngày chốt mà không có kỳ cân
 * đối nào (cùng họ NL) phủ ngày đó → sẽ KHÔNG vào tồn (rơi ra ngoài). Trả tổng kg
 * bị rớt trong khoảng ngày/xưởng đang xem để màn gọi tên (không giấu số như tồn âm).
 */
export function sumUnmatchedLeftover(
  periods: BalancingPeriod[],
  locks: DailyLock[],
  range?: { fromDate?: string; toDate?: string; workshop?: Workshop },
): number {
  const workshop = range?.workshop;
  const periodDates = periods.map((ky) => ({
    ky,
    dates: new Set(getPeriodDates(ky)),
  }));
  let unmatched = 0;
  for (const lk of locks) {
    if (workshop && lk.workshop !== workshop) continue;
    if (range?.fromDate && lk.lockDate < range.fromDate) continue;
    if (range?.toDate && lk.lockDate > range.toDate) continue;
    const lb = lk.leftoverByMaterial;
    if (!lb) continue;
    for (const [ten, v] of Object.entries(lb)) {
      const kgv = Number(v) || 0;
      if (kgv <= 0) continue;
      const isMatch = periodDates.some(
        (p) => p.dates.has(lk.lockDate) && isSameMaterialFamily(ten, p.ky.materialTypeName),
      );
      if (!isMatch) unmatched += kgv;
    }
  }
  return unmatched;
}

/** Nhập tươi theo ngày của một kỳ: gom material_imports cùng họ NL, ngày trong kỳ. */
function freshInByDay(
  ky: BalancingPeriod,
  imports: MaterialImportItem[],
  workshop?: Workshop,
): DailyQuantities {
  const dates = new Set(getPeriodDates(ky));
  const ra: DailyQuantities = {};
  if (dates.size === 0) return ra;
  for (const r of imports) {
    if (workshop && r.workshop !== workshop) continue;
    if (!dates.has(r.deliveryDate)) continue;
    if (!isSameMaterialFamily(r.materialTypeName, ky.materialTypeName)) continue;
    ra[r.deliveryDate] = (ra[r.deliveryDate] ?? 0) + (r.quantityKg || 0);
  }
  return ra;
}

/**
 * Dựng sổ NXT nguyên liệu theo kỳ, có KẾ THỪA tồn đầu giữa các kỳ cùng họ.
 *
 * Xử lý MỌI kỳ theo thứ tự ngày bắt đầu để chuỗi tồn đúng, rồi trả về những kỳ
 * rơi trong [fromDate, toDate] (lọc theo startDate). `workshop` để lọc nhập tươi
 * + tồn đầu khai tay; kỳ cân đối hiện chỉ có ở xưởng Đông.
 */
export function computeMaterialNxt(
  periods: BalancingPeriod[],
  inputs: BalancingInputItem[],
  imports: MaterialImportItem[],
  opening: MaterialOpeningStock[],
  locks: DailyLock[],
  range?: { fromDate?: string; toDate?: string; workshop?: Workshop },
): MaterialPeriodNxtRow[] {
  const workshop = range?.workshop;
  const sortedPeriods = [...periods].sort((a, b) =>
    (a.startDate || "").localeCompare(b.startDate || ""),
  );

  const runningStock = new Map<string, number>(); // materialFamily(lowercase) → tồn cuối gần nhất
  const allPeriods: MaterialPeriodNxtRow[] = [];

  for (const ky of sortedPeriods) {
    const materialFamily = getMaterialFamily(ky.materialTypeName);
    const key = materialFamily.toLowerCase();

    let openingKg: number;
    let isOpeningSeeded = false;
    if (runningStock.has(key)) {
      openingKg = runningStock.get(key)!;
    } else {
      openingKg = manualOpeningStock(opening, ky.materialTypeName, ky.startDate || "9999-99-99", workshop);
      isOpeningSeeded = openingKg !== 0;
    }

    // Đông gửi có 3 nguồn, LẤY MỘT (không cộng — hết cộng đôi), ưu tiên:
    // (a) dòng "Gửi đông" ở Cân đối (2026-10-06: kế toán chốt số cất kho ở đây),
    // (b) còn dở khai ở SẢN XUẤT (production_locks, hướng 1 chốt 2026-09-06),
    // (c) Chuyển kỳ âm khai tay (cách cũ). Cả (a) lẫn (b) vẫn được trả ra để màn
    // Cân đối ĐỐI CHIẾU hai bên — tổ trưởng ghi ở SX, kế toán ghi ở Cân đối.
    const productionLeftover = leftoverInPeriod(locks, ky, workshop);
    const balancingFreezeDeposit = sumBalancingFreezeDeposit(inputs, ky.id);
    const manualFreezeDeposit = sumNegativeCarry(inputs, ky.id);
    const freezeDepositSource: MaterialPeriodNxtRow["freezeDepositSource"] =
      balancingFreezeDeposit > 0 ? "can-doi" : productionLeftover > 0 ? "san-xuat" : manualFreezeDeposit > 0 ? "chuyen-ky" : "";
    const freezeDeposit =
      freezeDepositSource === "can-doi" ? balancingFreezeDeposit : freezeDepositSource === "san-xuat" ? productionLeftover : manualFreezeDeposit;
    const xaDong = sumThaw(inputs, ky.id);
    const closingKg = openingKg + freezeDeposit - xaDong;
    runningStock.set(key, closingKg);

    const importsByDate = freshInByDay(ky, imports, workshop);
    const freshInKg = Object.values(importsByDate).reduce((s, v) => s + v, 0);

    allPeriods.push({
      periodId: ky.id,
      materialFamily,
      periodMaterialName: ky.materialTypeName,
      startDate: ky.startDate || "",
      endDate: ky.endDate || ky.startDate || "",
      openingKg,
      freezeDepositKg: freezeDeposit,
      freezeDepositSource,
      balancingFreezeDepositKg: balancingFreezeDeposit,
      productionLeftoverKg: productionLeftover,
      thawKg: xaDong,
      closingKg,
      freshInKg,
      dailyFreshIn: importsByDate,
      isNegative: closingKg < 0,
      hasManualOpening: isOpeningSeeded,
    });
  }

  // Trả kỳ GIAO NHAU với khoảng ngày (không chỉ khớp ngày bắt đầu): kỳ kéo dài
  // nhiều ngày, lọc theo startDate thôi sẽ rụng kỳ đang chạy vắt qua khoảng.
  const tu = range?.fromDate;
  const den = range?.toDate;
  return allPeriods.filter((r) => {
    const s0 = r.startDate || "";
    const e0 = r.endDate || r.startDate || "";
    if (den && s0 && s0 > den) return false;
    if (tu && e0 && e0 < tu) return false;
    return true;
  });
}

/* ============================================================
 * TỒN NL "TỔNG" theo NHẬP HÀNG (2026-09-11, PA-a) — khác engine kỳ ở trên.
 *
 * Vì sao: màn /nxt-nl cũ suy tồn theo KỲ cân đối (đông gửi/xả đông) nên nhập hàng
 * không vào tồn + chỉ xưởng Đông có số. Yêu cầu chủ dự án: dùng NHẬP HÀNG làm vế
 * NHẬP thật của tồn kho NL, phủ CẢ 3 xưởng, xem theo NGÀY. Xuất (NL lấy ra SX)
 * CHƯA capture nên = 0 (chừa sẵn cột), tồn hiện là "chưa trừ xuất".
 *
 *   Tồn cuối = Tồn đầu + Nhập hàng − Xuất SX(=0)
 *
 * PA-a (chốt 2026-09-11): đông gửi/xả đông là CHUYỂN NỘI BỘ tươi↔kho đông, KHÔNG
 * cộng vào tổng (tránh đếm đôi phần leftover đã nằm trong nhập hàng) — chỉ lấy làm
 * CỘT THÔNG TIN "kho đông dự trữ" (đọc lại từ engine kỳ `computeMaterialNxt`).
 *
 * Tồn đầu kỳ = tồn đầu khai tay (material_opening_stock — BASELINE MỘT LẦN tại mốc
 * asOfDate) + Σ nhập hàng TỪ mốc baseline tới trước kỳ. Nhập TRƯỚC mốc baseline coi
 * như đã nằm trong số khai tay (không cộng đôi). Không khai baseline ⇒ cộng mọi nhập
 * trước kỳ. ⇒ khai "Tồn đầu" với asOfDate = ngày ĐẦU TIÊN app bắt đầu tính nhập (VD
 * 01/07 cho baseline tồn cuối 30/06).
 *
 * QUY TẮC MỐC (dùng CHUNG với sổ BTP `inventoryFinished.computeFinishedGoodNxt`): khai tay có
 * mốc ≤ CUỐI khoảng xem đều áp — kể cả mốc nằm GIỮA khoảng (xem "Năm" khi baseline
 * 01/07). Mốc giữa khoảng ⇒ số khai tay vào cột Tồn đầu (trước mốc app không theo
 * dõi, phát sinh trước mốc bị bỏ), phát sinh từ mốc vào cột trong kỳ. Mốc SAU cuối
 * khoảng ⇒ chưa áp, cộng mọi phát sinh như chưa khai.
 * ============================================================ */

/** Một dòng tồn NL "tổng" cho MỘT họ nguyên liệu, trong khoảng ngày đang xem. */
export interface MaterialTotalStockFamily {
  materialFamily: string;
  openingKg: number; // opening(mốc ≤ cuối kỳ) + Σ nhập từ mốc tới trước kỳ
  inPeriodKg: number; // Σ nhập hàng trong kỳ
  productionOutKg: number; // 0 — chờ capture "NL lấy ra sản xuất"
  /** Bán nội địa trong kỳ (NL bán thẳng, sổ domestic_sales mig 0054) — XUẤT, trừ tồn. */
  domesticSaleKg: number;
  closingKg: number; // openingKg + inPeriodKg − productionOutKg − domesticSaleKg
  freezeDepositKg: number; // THÔNG TIN (kho đông) — KHÔNG vào closingKg
  thawKg: number; // THÔNG TIN — KHÔNG vào closingKg
  hasManualOpening: boolean; // tồn đầu có phần khai tay
  isNegative: boolean; // closingKg < 0
}

/** Một mốc tồn tổng cuối ngày (mọi họ gộp) — cho bảng "tồn theo ngày". */
export interface MaterialTotalStockDay {
  date: string;
  inKg: number;
  productionOutKg: number; // 0
  domesticSaleKg: number; // NL bán thẳng trong ngày — trừ tồn
  closingKg: number; // tồn tổng cuối ngày = tồn đầu tổng + Σ (nhập − bán nội địa) ≤ ngày
}

export interface MaterialTotalStock {
  families: MaterialTotalStockFamily[];
  days: MaterialTotalStockDay[];
  totalOpeningKg: number;
  totalInKg: number;
  totalDomesticSaleKg: number;
  totalClosingKg: number;
  totalFreezeDepositKg: number;
  totalThawKg: number;
  familyCount: number;
  warningCount: number;
}

/**
 * Dựng tồn NL "tổng" theo nhập hàng cho khoảng ngày [fromDate, toDate] + xưởng.
 * Dòng theo HỌ nguyên liệu (không cần kỳ cân đối) ⇒ phủ cả 3 xưởng. Đông gửi/xả
 * đông lấy làm cột thông tin từ `computeMaterialNxt` (engine kỳ), KHÔNG cộng vào tồn.
 */
export function computeMaterialTotalStock(
  periods: BalancingPeriod[],
  inputs: BalancingInputItem[],
  imports: MaterialImportItem[],
  opening: MaterialOpeningStock[],
  locks: DailyLock[],
  range?: { fromDate?: string; toDate?: string; workshop?: Workshop },
  /** Sổ BÁN NỘI ĐỊA (mig 0054) — NL bán thẳng là khoản XUẤT, trừ tồn như nhập là cộng. */
  domesticSales: DomesticSaleItem[] = [],
): MaterialTotalStock {
  const workshop = range?.workshop;
  const tu = range?.fromDate ?? "0000-01-01";
  const den = range?.toDate ?? "9999-12-31";
  const matchesWorkshop = (w?: Workshop) => !workshop || w === workshop;

  // Đông gửi / xả đông (THÔNG TIN) — gom theo họ từ engine kỳ (kỳ giao khoảng).
  const kyRows = computeMaterialNxt(periods, inputs, imports, opening, locks, range);
  const dongXa = new Map<string, { freezeDepositKg: number; thawKg: number }>();
  for (const r of kyRows) {
    const k = r.materialFamily.toLowerCase();
    const cur = dongXa.get(k) ?? { freezeDepositKg: 0, thawKg: 0 };
    cur.freezeDepositKg += r.freezeDepositKg;
    cur.thawKg += r.thawKg;
    dongXa.set(k, cur);
  }

  // Gom theo HỌ NL bằng MỘT lượt qua opening + MỘT lượt qua imports (thay vì lọc
  // toàn bộ imports 3 lần/mỗi họ). Khoá gom = getMaterialFamily(tên).toLowerCase() —
  // đúng bằng cách `isSameMaterialFamily` so khớp trước đây.
  const familyNames = new Map<string, string>(); // key(lower) → tên họ hiển thị
  const addFamily = (ten: string): string => {
    const h = getMaterialFamily(ten);
    if (h) familyNames.set(h.toLowerCase(), h);
    return h;
  };

  // Baseline-MỘT-LẦN theo họ: openTruoc (tồn đầu khai tay, mốc ≤ CUỐI khoảng xem —
  // mốc giữa khoảng vẫn áp, xem QUY TẮC MỐC ở trên) + mốc asOfDate mới nhất. Nhập
  // TRƯỚC mốc coi như đã nằm trong tồn đầu ⇒ không cộng lại.
  const openByHo = new Map<string, { open: number; anchorDate: string }>();
  for (const o of opening) {
    if (!matchesWorkshop(o.workshop)) continue;
    const ho = addFamily(o.materialTypeName);
    if (!ho) continue;
    if (o.asOfDate && o.asOfDate > den) continue; // mốc sau khoảng xem ⇒ chưa áp
    const k = ho.toLowerCase();
    const cur = openByHo.get(k) ?? { open: 0, anchorDate: "" };
    cur.open += o.quantityKg || 0;
    if (o.asOfDate && o.asOfDate > cur.anchorDate) cur.anchorDate = o.asOfDate;
    openByHo.set(k, cur);
  }

  // Nhập theo họ: tách trước-kỳ / trong-kỳ, LỌC baseline; đồng thời gom nhập theo
  // ngày (chỉ phần đã qua baseline ⇒ tồn theo ngày khớp Σ tồn theo họ).
  const inByFamily = new Map<string, { before: number; period: number }>();
  const inByDay = new Map<string, number>();
  for (const r of imports) {
    if (!matchesWorkshop(r.workshop)) continue;
    const ho = addFamily(r.materialTypeName);
    if (!ho) continue;
    const k = ho.toLowerCase();
    const moc = openByHo.get(k)?.anchorDate ?? "";
    if (moc && r.deliveryDate < moc) continue; // trước baseline → đã trong tồn đầu
    const kg = r.quantityKg || 0;
    const cur = inByFamily.get(k) ?? { before: 0, period: 0 };
    if (r.deliveryDate < tu) cur.before += kg;
    else if (r.deliveryDate <= den) {
      cur.period += kg;
      inByDay.set(r.deliveryDate, (inByDay.get(r.deliveryDate) ?? 0) + kg);
    }
    inByFamily.set(k, cur);
  }

  // Bán nội địa theo họ — cùng luật baseline với nhập (bán TRƯỚC mốc khai tồn đầu đã
  // nằm trong số khai tay ⇒ không trừ lại); trước kỳ trừ vào tồn đầu, trong kỳ là cột xuất.
  const salesByFamily = new Map<string, { before: number; period: number }>();
  const salesByDay = new Map<string, number>();
  for (const r of domesticSales) {
    if (!matchesWorkshop(r.workshop)) continue;
    const kg = r.quantityKg || 0;
    if (kg <= 0) continue;
    const ho = addFamily(r.materialTypeName);
    if (!ho) continue;
    const k = ho.toLowerCase();
    const moc = openByHo.get(k)?.anchorDate ?? "";
    if (moc && r.saleDate < moc) continue;
    const cur = salesByFamily.get(k) ?? { before: 0, period: 0 };
    if (r.saleDate < tu) cur.before += kg;
    else if (r.saleDate <= den) {
      cur.period += kg;
      salesByDay.set(r.saleDate, (salesByDay.get(r.saleDate) ?? 0) + kg);
    }
    salesByFamily.set(k, cur);
  }

  // Họ chỉ có ở kỳ (đông gửi/xả đông) cũng phải hiện.
  for (const r of kyRows) familyNames.set(r.materialFamily.toLowerCase(), r.materialFamily);

  const theoHo: MaterialTotalStockFamily[] = [];
  for (const [k, materialFamily] of familyNames) {
    const priorOpening = openByHo.get(k)?.open ?? 0;
    const nh = inByFamily.get(k) ?? { before: 0, period: 0 };
    const ban = salesByFamily.get(k) ?? { before: 0, period: 0 };
    const info = dongXa.get(k) ?? { freezeDepositKg: 0, thawKg: 0 };
    // Bỏ họ trống trơn (không tồn đầu, không nhập/bán, không đông/xả) khỏi bảng.
    if (
      priorOpening === 0 && nh.before === 0 && nh.period === 0 && ban.before === 0 && ban.period === 0 &&
      info.freezeDepositKg === 0 && info.thawKg === 0
    )
      continue;
    const openingKg = priorOpening + nh.before - ban.before;
    const closingKg = openingKg + nh.period - ban.period; // − xuất SX(0)
    theoHo.push({
      materialFamily,
      openingKg,
      inPeriodKg: nh.period,
      productionOutKg: 0,
      domesticSaleKg: ban.period,
      closingKg,
      freezeDepositKg: info.freezeDepositKg,
      thawKg: info.thawKg,
      hasManualOpening: priorOpening > 0,
      isNegative: closingKg < 0,
    });
  }
  theoHo.sort((a, b) => b.closingKg - a.closingKg);

  const totalOpening = theoHo.reduce((s, r) => s + r.openingKg, 0);

  // Tồn tổng theo NGÀY: tồn cuối ngày = tồn đầu tổng + Σ (nhập − bán nội địa) (đã qua
  // baseline) ≤ ngày. Ngày chỉ có bán nội địa cũng thành một dòng.
  const byDate: MaterialTotalStockDay[] = [...new Set([...inByDay.keys(), ...salesByDay.keys()])]
    .sort()
    .reduce<MaterialTotalStockDay[]>((acc, date) => {
      const inKg = inByDay.get(date) ?? 0;
      const banND = salesByDay.get(date) ?? 0;
      const prevRows = acc.length ? acc[acc.length - 1].closingKg : totalOpening;
      acc.push({ date, inKg, productionOutKg: 0, domesticSaleKg: banND, closingKg: prevRows + inKg - banND });
      return acc;
    }, []);

  return {
    families: theoHo,
    days: byDate,
    totalOpeningKg: totalOpening,
    totalInKg: theoHo.reduce((s, r) => s + r.inPeriodKg, 0),
    totalDomesticSaleKg: theoHo.reduce((s, r) => s + r.domesticSaleKg, 0),
    totalClosingKg: theoHo.reduce((s, r) => s + r.closingKg, 0),
    totalFreezeDepositKg: theoHo.reduce((s, r) => s + r.freezeDepositKg, 0),
    totalThawKg: theoHo.reduce((s, r) => s + r.thawKg, 0),
    familyCount: theoHo.length,
    warningCount: theoHo.filter((r) => r.isNegative).length,
  };
}
