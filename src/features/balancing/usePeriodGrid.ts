// ============================================================
// Tên file: src/features/balancing/usePeriodGrid.ts
// Tên tiếng Việt: Hook dữ liệu + thao tác của một kỳ cân đối
// Description: Data + actions for one balancing period (grid screen)
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BalancingInputItem,
  BalancingOutputItem,
  BalancingPeriod,
  DailyQuantities,
  MaterialImportItem,
  MonthlyStockLine,
  WipProductionItem,
} from "@/types";
import { BSF1_WAREHOUSES } from "@/types";
import { uid } from "@/lib/db";
import { num, todayISO, formatDateVN } from "@/lib/format";
import { notify } from "@/design-system";
import { useCan } from "@/features/shared/PermissionProvider";
import { calculateBalancing, type BalancingResult } from "@/lib/balancingCalc";
import {
  buildMaterialGridRows,
  buildFinishedGoodGridRows,
  writeBackDailyImport,
  writeBackDailyOutput,
  groupImportsByMaterialType,
  groupWipsByProduct,
  getMaterialFamily,
  productSpecKey,
  listPendingCarryOvers,
  filterAllImportsInPeriod,
  isSameMaterialFamily,
  findPreviousPeriod,
  findOverlappingFamilyPeriods,
  pickTemplatePeriod,
  getBalancingStockLineKind,
  buildFinishedGoodTemplateRows,
  findMissingTemplateRows,
  suggestCustomerPrice,
  type FinishedGoodTemplateRow,
  filterEligibleImports,
  selectPeriodImports,
  filterFreeImportsInPeriod,
  getPeriodDates,
  filterEligibleWips,
  type MaterialGridRow,
  type FinishedGoodGridRow,
} from "@/lib/balancingGrid";
import {
  useBalancingInputs,
  useBalancingOutputs,
  useBalancingPeriods,
  useDomesticSales,
  useDailyLocks,
  useMaterialImports,
  useMaterialOpeningStock,
  useMonthlyStock,
  useProductionLocks,
  useStorageLocations,
  useWipProductions,
} from "@/lib/catalogRepo";
import {
  DEFAULT_LEDGER_WAREHOUSE,
  joinDepositLocation,
  listDepositLocationOptions,
  listDepositTargets,
  listThawLotOptions,
  syncMonthlyStockLedger,
  LEGACY_FREEZE_DEPOSIT_CATEGORY,
  countMonthlyStockMismatches,
  splitDepositLocation,
  monthOfDate,
  normalizeDepositPrices,
  lastDepositPrice,
  type DepositTargetGroup,
  type LotOption,
} from "@/lib/balancingStockLines";
import { sumLeftoverByDay, computeMaterialNxt, type MaterialPeriodNxtRow } from "@/lib/inventoryMaterial";
import { getPeriodDomesticSales, type PeriodDomesticSales } from "@/lib/domesticSales";

/** Nhóm cột (`GridColumn.group`) mà nút "Thu cột ngày" của cả hai lưới dựa vào —
    MỘT nguồn để khai cột và `collapsedGroups` không lệch tên (lệch ⇒ cột không thu
    mà footer lại bỏ ô ⇒ footer lệch cột). Thêm cột phụ thuộc ngày ⇒ gắn đúng nhóm. */
/** Một chuyến nhập sửa từ Cân đối: kg + đơn giá mới (đ/kg, null = chưa có giá). */
export interface ImportTripEdit {
  id: string;
  quantityKg: number;
  unitPrice: number | null;
}

export const DAY_COLUMN_GROUPS = {
  /** Cột từng ngày + cột chỉ có nghĩa khi đang mở ngày (Tổng cuối hàng, Chuyển kỳ cũ). */
  days: "day",
  /** Chỉ hiện khi MỞ cột ngày (VD "Số lượng" tính từ các ngày). */
  daysExpandedOnly: "days-expanded-only",
  /** Chỉ hiện khi THU cột ngày (VD "Số lượng" gõ thẳng). */
  daysCollapsedOnly: "days-collapsed-only",
} as const;

/** `collapsedGroups` cho EditableGrid theo trạng thái thu/mở cột ngày. */
export function collapsedDayGroups(daysCollapsed: boolean): string[] {
  return daysCollapsed
    ? [DAY_COLUMN_GROUPS.days, DAY_COLUMN_GROUPS.daysExpandedOnly]
    : [DAY_COLUMN_GROUPS.daysCollapsedOnly];
}

/** Một ô ngày cần ghi về sổ nguồn. */
export interface DayCell {
  /** Khoá dòng lưới: tên loại NL (khối 1) hoặc mặt hàng|quy cách (khối 2). */
  rowKey: string;
  date: string;
  kg: number;
}

export interface PeriodGrid {
  periodId: string;
  date: string[];
  /* --- khối 1 --- */
  inputs: BalancingInputItem[];
  materialRows: MaterialGridRow[];
  assignedImports: MaterialImportItem[];
  pendingImports: MaterialImportItem[];
  /** Dòng sổ nhập trong khoảng ngày nhưng KHÁC họ nguyên liệu — chọn tay. */
  otherTypeImports: MaterialImportItem[];
  /** Dòng trong khoảng ngày nhưng ĐANG thuộc kỳ khác — giải thích + kéo về. */
  otherPeriodImports: MaterialImportItem[];
  /** Tên loại NL của kỳ. */
  periodMaterialType: string;
  /** Kỳ KHÁC cùng họ NL có khoảng ngày chồng lên kỳ này (tạo trùng kỳ). */
  overlappingPeriods: BalancingPeriod[];
  /** Dòng sổ nhập có cùng họ nguyên liệu với kỳ không (để hộp chọn tay chỉ tick sẵn dòng đúng loại). */
  isPeriodFamily: (r: MaterialImportItem) => boolean;
  /** Đếm để màn hình nói được vì sao trống. */
  importDiagnostics: { inRangeCount: number; unassignedCount: number; otherPeriodCount: number; nameMismatchCount: number };
  /** Ghi khối NL (kèm đồng bộ Sổ kho tháng cho 2 dòng kho). false = bị chặn (đã báo lỗi). */
  saveInputs: (rows: BalancingInputItem[]) => boolean;
  pullImports: (ids?: string[]) => void;
  /** Ghi nhiều ô ngày về sổ Nhập hàng. Trả về false nếu bị từ chối. */
  saveImportDayCells: (cells: DayCell[]) => boolean;
  /** Ngày nhập hàng (theo xưởng) đã CHỐT ở màn Nhập hàng — sửa từ Cân đối vẫn được, nhưng ghi vết rõ. */
  isImportDayLocked: (date: string, workshop: string) => boolean;
  /**
   * SỬA kg / đơn giá chuyến nhập TỪ CÂN ĐỐI (người dùng yêu cầu 2026-10-20 — hộp hỏi xác nhận
   * trước, xem EditImportTripsDialog). Ghi thẳng sổ Nhập hàng qua repo (nhật ký thao tác tự ghi
   * trước/sau) + dòng vết đọc được ở Ghi chú của chuyến; có Hoàn tác. Chuyến thuộc ngày đã chốt
   * VẪN sửa được (kế toán 2026-10-20) — dòng vết ghi "SAU KHI CHỐT NGÀY". Trả false nếu không ghi.
   */
  editImportTrips: (changes: ImportTripEdit[], editorName: string) => boolean;
  /** Tồn kho đông của họ NL này qua kỳ (tồn đầu · gửi đông · xả đông · tồn cuối) — sống theo từng phím gõ. */
  frozenStock: MaterialPeriodNxtRow | null;
  /** Còn dở SX theo ngày chốt trong kỳ (cùng họ) — đối chiếu / điền nhanh dòng Gửi đông. */
  leftoverByDay: DailyQuantities;
  /** Đơn giá dòng Gửi đông gần nhất (kỳ trước, cùng họ) — gợi ý giá cho Lấy xả đông. */
  lastFreezeDepositPrice: number | null;
  /** Lô (Sổ kho tháng) để chọn ĐÍCH DANH cho dòng Lấy xả đông — tháng của ngày đầu kỳ. */
  lotOptions: (selected: string[]) => LotOption[];
  /** Kho nhận cho dòng Gửi đông: "<sổ kho>|<vị trí>". */
  depositLocationOptions: { value: string; label: string; subLabel?: string }[];
  /** Kho gửi MẶC ĐỊNH của dòng Gửi đông mới: kho lần gửi gần nhất cùng họ NL, chưa có ⇒ Kho 1500 tấn. */
  defaultDepositLocation: string;
  /** Các bảng (nhóm) của Sổ kho tháng `month` để chọn chỗ gửi đông — hộp "Gửi vào sổ kho". */
  depositTargetsFor: (month: string) => DepositTargetGroup[];
  /** Nhóm Sổ kho tháng của lô gửi đông ĐÃ GHI của một dòng (dòng cũ chưa chọn nhóm) — rỗng nếu chưa có lô. */
  depositLotCategory: (rowId: string) => string;
  /** Mô tả lô / kho của một dòng kho (bản in, nhãn). */
  describeStockLine: (r: BalancingInputItem) => string;
  /** Số chỗ Sổ kho tháng lệch phần kho của kỳ (VD sổ bị nạp lại đè) — 0 là khớp. */
  stockLedgerMismatches: number;
  /** Ghi lại toàn bộ phần kho của kỳ vào Sổ kho tháng (sửa lệch). */
  resyncStockLedger: () => void;
  /** Bán nội địa tổ trưởng ghi ở /wip (sổ domestic_sales, mig 0054) trong kỳ, cùng họ —
   *  điền / đối chiếu dòng giảm "Bán nội địa". kg DƯƠNG theo ngày. */
  domesticSales: PeriodDomesticSales;
  /* --- khối 2 --- */
  outputs: BalancingOutputItem[];
  finishedGoodRows: FinishedGoodGridRow[];
  assignedWips: WipProductionItem[];
  pendingWips: WipProductionItem[];
  saveOutputs: (rows: BalancingOutputItem[]) => void;
  pullWips: () => void;
  /** Kỳ làm mẫu cho khối 2 (kỳ gần nhất cùng họ NL có dòng) — null nếu chưa có. */
  templatePeriod: BalancingPeriod | null;
  /** Dòng mẫu CHƯA có trong kỳ — hiện ảo, gõ vào mới thành dòng thật. */
  missingTemplateRows: FinishedGoodTemplateRow[];
  /** Toàn bộ dòng mẫu (để so "giá = kỳ trước"). */
  templateRows: FinishedGoodTemplateRow[];
  /** Gợi ý khách · kênh · giá cho một mặt hàng mới vào kỳ (mẫu → kỳ gần nhất). */
  suggestTemplate: (productId: string, spec: string) => Pick<FinishedGoodTemplateRow, "customerId" | "channel" | "unitPrice"> | null;
  /** Hút cả sổ nhập + sổ sản xuất trong một chạm (KHÔNG đụng sổ bán). */
  pullAllSources: () => void;
  saveWipDayCells: (cells: DayCell[], backdateReason: string) => boolean;
  lockedDates: Set<string>;
  /* --- chuyển kỳ --- */
  previousPeriod: BalancingPeriod | null;
  carryOverRowCount: number;
  applyCarryOver: () => void;
  /* --- chốt kỳ --- */
  /** Kỳ đã chốt HOẶC người xem không có quyền sửa ⇒ mọi ô khoá, mọi nút ghi ẩn. */
  isLocked: boolean;
  /** Không có quyền `balancing.update` (chế độ chỉ xem) — tách khỏi chốt kỳ để báo đúng lý do. */
  isReadOnly: boolean;
  /* --- hoàn tác --- */
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  /* --- kết quả --- */
  result: BalancingResult;
}

/** Ảnh chụp bốn bảng mà một kỳ có quyền đụng tới. */
interface HistoryEntry {
  group: string;
  inputs: BalancingInputItem[];
  outputs: BalancingOutputItem[];
  imports: MaterialImportItem[];
  wips: WipProductionItem[];
  /** Sổ kho tháng — hai dòng kho ghi thẳng vào đây nên hoàn tác phải trả cả sổ. */
  stockLines: MonthlyStockLine[];
}

/** Giữ tối đa ngần này bước lùi — đủ cho một ca nhập, không phình bộ nhớ. */
const MAX_HISTORY_STEPS = 100;

/**
 * Tất cả dữ liệu + thao tác của MỘT kỳ cân đối.
 *
 * Gom vào một chỗ vì màn cân đối đụng năm nguồn dữ liệu (hai bảng của kỳ, hai
 * sổ nguồn, bảng chốt ngày) và ba luật dễ sai: ghép lại danh sách con khi ghi,
 * hút bằng cách gán kỳ chứ không chép số, ghi ngược theo LÔ chứ không từng ô.
 * Để rải trong component thì mỗi lần thêm một cột lại phải nhớ lại cả ba.
 */
export function usePeriodGrid(period: BalancingPeriod): PeriodGrid {
  const [allMaterialRows, writeAllMaterials, { status: inputStatus }] = useBalancingInputs();
  const [allOutputs, writeAllFinishedGoods, { status: outputStatus }] = useBalancingOutputs();
  const [allImports, writeAllImports, { status: importStatus }] = useMaterialImports();
  const [importDayLocks] = useDailyLocks();
  const [allWips, writeAllProductions, { status: wipStatus }] = useWipProductions();
  const [productionLocks] = useProductionLocks();
  const [domesticSales] = useDomesticSales();
  const [allPeriods] = useBalancingPeriods();
  const [manualOpeningStock] = useMaterialOpeningStock();
  const [monthlyStock, writeStockLedger, { status: stockLedgerStatus }] = useMonthlyStock();
  const [storageLocations] = useStorageLocations();

  /** Không có quyền sửa cân đối ⇒ chỉ xem: khoá như kỳ đã chốt (kể cả ghi tự động). */
  const isReadOnly = !useCan("balancing").update;
  /** Kỳ đã chốt ⇒ mọi ô khoá, mọi nút ghi ẩn. Mở lại ở thanh cuối màn. */
  const isLocked = Boolean(period.isLocked) || isReadOnly;

  const dates = useMemo(() => getPeriodDates(period), [period]);

  /* ---------- Ngăn xếp hoàn tác (Ctrl+Z / Ctrl+Y) ----------
     Người dùng đến từ Excel, ở đó Ctrl+Z lùi được MỌI thứ vừa làm chứ không chỉ
     ô số. Nút "Hoàn tác" trên toast vẫn còn cho người dùng chuột; hai đường
     cùng khôi phục từ ảnh chụp nên không đá nhau.

     Gộp theo `nhom`: gõ liên tiếp vào CÙNG một ô chỉ tạo MỘT mốc, nếu không mỗi
     phím là một bước lùi và Ctrl+Z thành vô dụng. */
  const lui = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  /* `lui`/`tien` là ref (không gây render, không được đọc lúc render), nên
     số mốc được chép sang state sau mỗi lần đổi để nút Hoàn tác / Làm lại
     bật-tắt đúng lúc. */
  const [historyCount, setHistoryCount] = useState({ undo: 0, redo: 0 });
  const syncHistoryCount = useCallback(
    () => setHistoryCount({ undo: lui.current.length, redo: redoStack.current.length }),
    []
  );

  const snapshotCurrent = useCallback(
    (group: string): HistoryEntry => ({
      group,
      inputs: allMaterialRows,
      outputs: allOutputs,
      imports: allImports,
      wips: allWips,
      stockLines: monthlyStock,
    }),
    [allMaterialRows, allOutputs, allImports, allWips, monthlyStock]
  );

  /** Đánh dấu "trước khi đổi" — gọi TRƯỚC mọi lần ghi. */
  const saveCheckpoint = useCallback(
    (group: string) => {
      if (!group) return; // ghi tự động (đồng bộ tổng) — không phải việc người dùng làm
      const topSnapshot = lui.current[lui.current.length - 1];
      if (topSnapshot && topSnapshot.group === group) return; // gõ tiếp cùng ô — không tạo mốc mới
      lui.current.push(snapshotCurrent(group));
      if (lui.current.length > MAX_HISTORY_STEPS) lui.current.shift();
      redoStack.current = [];
      syncHistoryCount();
    },
    [snapshotCurrent, syncHistoryCount]
  );

  const restoreEntry = useCallback(
    (m: HistoryEntry) => {
      writeAllMaterials(m.inputs);
      writeAllFinishedGoods(m.outputs);
      writeAllImports(m.imports);
      writeAllProductions(m.wips);
      if (m.stockLines !== monthlyStock) writeStockLedger(m.stockLines);
    },
    [writeAllMaterials, writeAllFinishedGoods, writeAllImports, writeAllProductions, writeStockLedger, monthlyStock]
  );

  const undo = useCallback(() => {
    const m = lui.current.pop();
    if (!m) return;
    redoStack.current.push(snapshotCurrent(m.group));
    restoreEntry(m);
    syncHistoryCount();
    notify.saved("Đã hoàn tác");
  }, [restoreEntry, snapshotCurrent, syncHistoryCount]);

  const redo = useCallback(() => {
    const m = redoStack.current.pop();
    if (!m) return;
    lui.current.push(snapshotCurrent(m.group));
    restoreEntry(m);
    syncHistoryCount();
    notify.saved("Đã làm lại");
  }, [restoreEntry, snapshotCurrent, syncHistoryCount]);

  /* Repo trả về dòng của MỌI kỳ. Ghi mà quên ghép lại với kỳ khác = xoá sạch
     các kỳ đó (xem 04-tang-du-lieu.md). Bọc một lần ở đây. */
  const materialInRows = useMemo(() => allMaterialRows.filter((r) => r.periodId === period.id), [allMaterialRows, period.id]);
  const finishedGoods = useMemo(() => allOutputs.filter((r) => r.periodId === period.id), [allOutputs, period.id]);

  /* Nhãn kỳ + họ NL để ghi vết / đặt tên lô gửi đông trong Sổ kho tháng. */
  const ngucanh = useMemo(
    () => ({
      periodLabel: `${period.materialTypeName} ${period.dateRangeDescription ?? ""}`.trim(),
      materialFamily: getMaterialFamily(period.materialTypeName),
    }),
    [period.materialTypeName, period.dateRangeDescription]
  );

  /* MỘT chốt cho mọi lần ghi khối NL (gõ ô, dán khối, xoá dòng, gộp…): hai dòng kho
     (Lấy xả đông / Gửi đông) ghi THẲNG vào Sổ kho tháng theo kiểu đặt giá trị — xem
     lib/balancingStockLines.ts. Sổ kho từ chối (vượt tồn lô, chưa chọn lô/kho) ⇒ KHÔNG ghi gì. */
  const writeMaterials = useCallback(
    (written: BalancingInputItem[], group = "nl"): boolean => {
      /* Giá gửi đông theo ngày: ngày mới gửi tự có giá, đơn giá dòng = bình quân (mig 0071). */
      const rows = written.map(normalizeDepositPrices);
      const result = syncMonthlyStockLedger(monthlyStock, materialInRows, rows, ngucanh);
      if (result.error) {
        notify.error(result.error);
        return false;
      }
      saveCheckpoint(group);
      writeAllMaterials([...allMaterialRows.filter((r) => r.periodId !== period.id), ...rows]);
      if (result.changed) writeStockLedger(result.lines);
      if (result.carriedCount > 0)
        notify.saved(`Sổ kho tháng: đã tự kế thừa ${result.carriedCount} dòng tồn sang tháng mới`);
      return true;
    },
    [writeAllMaterials, allMaterialRows, period.id, saveCheckpoint, monthlyStock, materialInRows, ngucanh, writeStockLedger]
  );
  const writeFinishedGoods = useCallback(
    (rows: BalancingOutputItem[], group = "tp") => {
      saveCheckpoint(group);
      writeAllFinishedGoods([...allOutputs.filter((r) => r.periodId !== period.id), ...rows]);
    },
    [writeAllFinishedGoods, allOutputs, period.id, saveCheckpoint]
  );

  /* ---------- Sổ Nhập hàng ---------- */

  /* Kỳ TỰ LẤY sổ nhập theo khoảng ngày + họ NL (chốt 2026-10-20) — không cần bấm "Lấy n dòng",
     và kỳ chồng ngày cùng dùng chung các chuyến của ngày trùng (`selectPeriodImports`). */
  const assignedImports = useMemo(() => selectPeriodImports(period, allImports), [period, allImports]);
  /** Dòng lưới "hút từ sổ nhập" còn THIẾU: họ có chuyến trong kỳ mà kỳ chưa có dòng của họ đó. */
  const importsToPull = useMemo(() => {
    const families = new Set(
      materialInRows.filter((r) => r.autoSource === "imports").map((r) => getMaterialFamily(r.name))
    );
    return filterEligibleImports(period, allImports).filter((r) => !families.has(getMaterialFamily(r.materialTypeName)));
  }, [period, allImports, materialInRows]);
  /* Khớp theo tên loại NL hay trượt vì sổ nhập ghi tên tự do. Giữ sẵn danh sách
     "trong khoảng ngày nhưng khác loại" để người dùng tự tick, thay vì màn hình
     báo "không có gì để lấy" trong khi sổ đầy số. */
  const otherTypeImports = useMemo(
    () =>
      filterFreeImportsInPeriod(period, allImports).filter(
        (r) => !isSameMaterialFamily(r.materialTypeName, period.materialTypeName)
      ),
    [period, allImports]
  );

  /* Dòng đang bị kỳ KHÁC giữ. Không đếm được nhóm này thì khi người dùng lỡ hút
     vào nhầm kỳ, mọi kỳ sau chỉ thấy màn trống và không có manh mối nào. */
  const otherPeriodImports = useMemo(
    () =>
      filterAllImportsInPeriod(period, allImports).filter(
        (r) =>
          r.balancingPeriodId &&
          r.balancingPeriodId !== period.id &&
          // Cùng họ thì kỳ này đã tự dùng chung — chỉ còn dòng khác loại do kỳ khác tự chọn.
          !isSameMaterialFamily(r.materialTypeName, period.materialTypeName)
      ),
    [period, allImports]
  );

  const overlappingPeriods = useMemo(
    () => findOverlappingFamilyPeriods(period, allPeriods) as BalancingPeriod[],
    [period, allPeriods]
  );
  const isSamePeriodFamily = useCallback(
    (r: MaterialImportItem) => isSameMaterialFamily(r.materialTypeName, period.materialTypeName),
    [period.materialTypeName]
  );

  const importDiagnosis = useMemo(() => {
    const importsInPeriod = filterAllImportsInPeriod(period, allImports);
    return {
      inRangeCount: importsInPeriod.length,
      unassignedCount: importsToPull.length,
      otherPeriodCount: otherPeriodImports.length,
      nameMismatchCount: otherTypeImports.length,
    };
  }, [period, allImports, importsToPull, otherPeriodImports, otherTypeImports]);

  const pullImports = useCallback(
    (ids?: string[]) => {
      /* Có `ids` = người dùng tự tick, kể cả dòng đang thuộc kỳ khác ⇒ KÉO VỀ
         kỳ này. Không có `ids` = lấy tự động, chỉ đụng dòng chưa kỳ nào giữ. */
      const selectedIds = ids
        ? allImports.filter((r) => ids.includes(r.id) && r.balancingPeriodId !== period.id)
        : importsToPull;
      if (selectedIds.length === 0) return;
      const prevImports = allImports;
      const prevMaterials = allMaterialRows;
      saveCheckpoint(`hut-nhap:${selectedIds.length}:${selectedIds[0].id}`);
      const dropIds = new Set(selectedIds.map((r) => r.id));
      writeAllImports(
        allImports.map((r) => (dropIds.has(r.id) ? { ...r, balancingPeriodId: period.id } : r))
      );

      /* Mỗi HỌ nguyên liệu một dòng lưới (lớn/nhỏ gộp chung); họ đã có dòng thì
         giữ nguyên. groupImportsByMaterialType trả key theo họ nên so theo họ. */
      const existing = new Set(
        materialInRows.filter((r) => r.autoSource === "imports").map((r) => getMaterialFamily(r.name))
      );
      const toAdd: BalancingInputItem[] = [];
      for (const [materialType, o] of groupImportsByMaterialType([...assignedImports, ...selectedIds])) {
        if (existing.has(materialType)) continue;
        toAdd.push({
          id: uid(),
          periodId: period.id,
          groupName: "Thủy sản",
          name: materialType,
          quantityKg: Object.values(o.dailyQuantities).reduce((s, v) => s + v, 0),
          unitPrice: o.unitPrice,
          ratioPercentage: null,
          sourceWarehouse: "",
          dailyQuantities: {},
          carryOverKg: 0,
          isReduction: false,
          reductionWarehouseId: "",
          autoSource: "imports",
        });
      }
      if (toAdd.length > 0) writeMaterials([...materialInRows, ...toAdd], "");
      notify.saved(`Đã lấy ${selectedIds.length} dòng nhập hàng vào kỳ`, () => {
        writeAllImports(prevImports);
        writeAllMaterials(prevMaterials);
      });
    },
    [allImports, importsToPull, allMaterialRows, materialInRows, assignedImports, writeAllImports, writeAllMaterials, writeMaterials, saveCheckpoint, period.id]
  );

  const isImportDayLocked = useCallback(
    (date: string, workshop: string) =>
      importDayLocks.some((l) => l.lockDate === date && l.workshop === workshop && l.isLocked),
    [importDayLocks]
  );

  const editImportTrips = useCallback(
    (changes: ImportTripEdit[], editorName: string): boolean => {
      const byId = new Map(allImports.map((r) => [r.id, r]));
      const real = changes.filter((c) => {
        const r = byId.get(c.id);
        return r && (r.quantityKg !== c.quantityKg || r.unitPrice !== c.unitPrice);
      });
      if (real.length === 0) return false;
      /* Kế toán 2026-10-20: ngày đã CHỐT ở Nhập hàng vẫn sửa được từ đây (thao tác dễ), nhưng
         dòng vết ghi rõ "SAU KHI CHỐT NGÀY dd/mm" để lưu vết — nhật ký thao tác vẫn tự ghi trước/sau. */
      const lockedCount = real.filter((c) => {
        const r = byId.get(c.id)!;
        return isImportDayLocked(r.deliveryDate, r.workshop);
      }).length;
      const stamp = new Date().toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const periodLabel = `${period.materialTypeName} ${period.dateRangeDescription ?? ""}`.trim();
      const edits = new Map(real.map((c) => [c.id, c]));
      const prevRows = allImports;
      saveCheckpoint(`sua-chuyen-nhap:${real.map((c) => c.id).join(",")}`);
      writeAllImports(
        allImports.map((r) => {
          const c = edits.get(r.id);
          if (!c) return r;
          const parts = [
            r.quantityKg !== c.quantityKg ? `kg ${num(r.quantityKg)} → ${num(c.quantityKg)}` : "",
            r.unitPrice !== c.unitPrice ? `giá ${r.unitPrice == null ? "—" : num(r.unitPrice)} → ${c.unitPrice == null ? "—" : num(c.unitPrice)}` : "",
          ].filter(Boolean);
          // Dòng vết đọc được ngay ở màn Nhập hàng (nhật ký thao tác vẫn tự ghi trước/sau mọi trường).
          const afterLock = isImportDayLocked(r.deliveryDate, r.workshop) ? ` · SAU KHI CHỐT NGÀY ${formatDateVN(r.deliveryDate)}` : "";
          const trace = `[Sửa từ Cân đối ${periodLabel}${afterLock} · ${stamp}${editorName ? ` · ${editorName}` : ""}] ${parts.join("; ")}`;
          return { ...r, quantityKg: c.quantityKg, unitPrice: c.unitPrice, note: r.note ? `${r.note}\n${trace}` : trace };
        })
      );
      notify.saved(
        `Đã sửa ${real.length} chuyến nhập vào sổ Nhập hàng${lockedCount ? ` (${lockedCount} chuyến của ngày đã chốt — đã ghi vết)` : ""}`,
        () => writeAllImports(prevRows)
      );
      return true;
    },
    [allImports, isImportDayLocked, period.materialTypeName, period.dateRangeDescription, saveCheckpoint, writeAllImports]
  );

  /**
   * Ghi nhiều ô ngày về sổ Nhập hàng trong MỘT lần. Khoá dòng là TÊN loại
   * nguyên liệu vì sổ nhập lưu theo tên (xem 30-nhap-hang.md).
   */
  const writeImportsMultiDay = useCallback(
    (cells: DayCell[]): boolean => {
      if (cells.length === 0) return true;
      const edits = new Map<string, number>();
      const toAdd: MaterialImportItem[] = [];
      let current = assignedImports;
      for (const o of cells) {
        // Dòng lưới mang tên HỌ (lớn/nhỏ gộp) ⇒ tìm chuyến nhập theo HỌ; sửa ô
        // ngày gộp sẽ chỉnh chuyến size cuối cùng của ngày cho khớp tổng.
        const sameDayRows = current.filter(
          (r) => getMaterialFamily(r.materialTypeName) === o.rowKey && r.deliveryDate === o.date
        );
        const result = writeBackDailyImport(sameDayRows, o.kg);
        if (result.kind === "reject") {
          notify.error(result.reason);
          return false;
        }
        if (result.kind === "update") {
          edits.set(result.id, result.kg);
          current = current.map((r) => (r.id === result.id ? { ...r, quantityKg: result.kg } : r));
        } else {
          if (result.kg === 0) continue;
          const template = assignedImports.find((r) => getMaterialFamily(r.materialTypeName) === o.rowKey);
          const created: MaterialImportItem = {
            id: uid(),
            shipmentId: "",
            deliveryDate: o.date,
            workshop: template?.workshop ?? "Đông",
            category: template?.category ?? "Khác",
            supplierName: template?.supplierName ?? "",
            // Giữ tên size của chuyến mẫu để sổ Nhập hàng vẫn có size; chưa có mẫu
            // (thêm ngày mới) thì đành dùng tên họ.
            materialTypeName: template?.materialTypeName ?? o.rowKey,
            quantityKg: result.kg,
            unitPrice: template?.unitPrice ?? null,
            driverName: "",
            licensePlate: "",
            note: "Ghi từ lưới cân đối",
            balancingPeriodId: period.id,
          };
          toAdd.push(created);
          current = [...current, created];
        }
      }
      if (edits.size === 0 && toAdd.length === 0) return true;
      const prevRows = allImports;
      /* Gõ tiếp vào cùng một ô ⇒ cùng nhóm ⇒ một bước lùi cho cả lần gõ. */
      saveCheckpoint(
        cells.length === 1 ? `nhap:${cells[0].rowKey}:${cells[0].date}` : `nhap-khoi:${cells.length}`
      );
      writeAllImports([
        ...allImports.map((r) => {
          const kg = edits.get(r.id);
          return kg == null ? r : { ...r, quantityKg: kg };
        }),
        ...toAdd,
      ]);
      notify.saved(
        cells.length === 1
          ? `Đã ghi ${num(cells[0].kg)} kg ngày ${formatDateVN(cells[0].date)} vào sổ nhập hàng`
          : `Đã ghi ${cells.length} ô vào sổ nhập hàng`,
        () => writeAllImports(prevRows)
      );
      return true;
    },
    [assignedImports, allImports, writeAllImports, saveCheckpoint, period.id]
  );

  /* ---------- Sổ Sản xuất ---------- */

  const assignedWips = useMemo(
    () => allWips.filter((r) => r.balancingPeriodId === period.id),
    [allWips, period.id]
  );
  const pendingWips = useMemo(
    () => filterEligibleWips(period, allWips).filter((r) => !r.balancingPeriodId),
    [period, allWips]
  );

  /* ---------- Dòng mẫu khối 2 (A) + gợi ý khách/giá (B) ---------- */
  const templatePeriod = useMemo(() => (isLocked ? null : pickTemplatePeriod(period, allPeriods, allOutputs)), [isLocked, period, allPeriods, allOutputs]);
  const finishedGoodTemplates = useMemo(
    () => (templatePeriod ? buildFinishedGoodTemplateRows(allOutputs.filter((r) => r.periodId === templatePeriod.id)) : []),
    [templatePeriod, allOutputs]
  );
  const missingTemplates = useMemo(() => findMissingTemplateRows(finishedGoodTemplates, finishedGoods), [finishedGoodTemplates, finishedGoods]);
  const suggestTemplate = useCallback(
    (productId: string, spec: string) => suggestCustomerPrice(productId, spec, finishedGoodTemplates, allOutputs, allPeriods, period.id),
    [finishedGoodTemplates, allOutputs, allPeriods, period.id]
  );

  const pullProduction = useCallback(() => {
    if (pendingWips.length === 0) return;
    const prevProduction = allWips;
    const prevFinishedGoods = allOutputs;
    saveCheckpoint(`hut-sx:${pendingWips.length}:${pendingWips[0].id}`);
    const dropIds = new Set(pendingWips.map((r) => r.id));
    writeAllProductions(
      allWips.map((r) => (dropIds.has(r.id) ? { ...r, balancingPeriodId: period.id } : r))
    );
    const existing = new Set(
      finishedGoods
        .filter((r) => r.autoSource === "production")
        .map((r) => productSpecKey(r.productId, r.spec ?? ""))
    );
    const toAdd: BalancingOutputItem[] = [];
    for (const [key, o] of groupWipsByProduct([...assignedWips, ...pendingWips])) {
      if (existing.has(key)) continue;
      const [productId, spec] = key.split("|");
      /* (B) Khách · kênh · giá lấy theo dòng mẫu / kỳ gần nhất — trước đây để trống
         nên kỳ nào cũng phải chọn khách + gõ giá lại từ đầu. Không có gợi ý ⇒ trống. */
      const g = suggestTemplate(productId, spec ?? "");
      toAdd.push({
        id: uid(),
        periodId: period.id,
        productId,
        customerId: g?.customerId ?? "",
        channel: g?.channel ?? "Xuất khẩu",
        quantityKg: Object.values(o.dailyQuantities).reduce((s, v) => s + v, 0),
        unitPrice: g?.unitPrice ?? null,
        spec: spec ?? "",
        salesItemId: "",
        dailyQuantities: {},
        carryOverKg: 0,
        carryOverPeriodId: "",
        autoSource: "production",
      });
    }
    if (toAdd.length > 0) writeFinishedGoods([...finishedGoods, ...toAdd], "");
    notify.saved(`Đã lấy ${pendingWips.length} dòng sản xuất vào kỳ`, () => {
      writeAllProductions(prevProduction);
      writeAllFinishedGoods(prevFinishedGoods);
    });
  }, [
    pendingWips,
    assignedWips,
    allWips,
    allOutputs,
    finishedGoods,
    writeAllProductions,
    writeAllFinishedGoods,
    writeFinishedGoods,
    saveCheckpoint,
    period.id,
    suggestTemplate,
  ]);

  /* Một chạm kéo CẢ HAI nguồn tự động (nhập + sản xuất) vào kỳ. KHÔNG gộp sổ bán
     — bán là seam đầu ra thay thế, kéo nhầm sẽ sai nguồn. Chỉ một nguồn có dòng
     thì uỷ thẳng cho hàm chuyên trách (giữ nguyên toast + undo của nó); cả hai
     thì chạy tuần tự — bốn bảng ghi RỜI nhau nên số không đè, Ctrl+Z một lần
     trả cả hai vì ảnh chụp lấy trước cả hai thao tác. */
  const pullAllSources = useCallback(() => {
    // Sổ nhập TỰ lấy vào kỳ (effect bên dưới) — nút chung chỉ còn kéo sổ sản xuất.
    if (pendingWips.length > 0) pullProduction();
  }, [pendingWips.length, pullProduction]);

  const lockedDates = useMemo(
    () => new Set(productionLocks.filter((c) => c.isLocked).map((c) => c.lockDate)),
    [productionLocks]
  );

  const writeProductionsMultiDay = useCallback(
    (cells: DayCell[], backdateReason: string): boolean => {
      if (cells.length === 0) return true;
      const edits = new Map<string, number>();
      const toAdd: WipProductionItem[] = [];
      let current = assignedWips;
      for (const o of cells) {
        const [productId, spec = ""] = o.rowKey.split("|");
        const sameDayRows = current.filter(
          (r) =>
            r.productId === productId && r.spec === spec && r.productionDate === o.date
        );
        const result = writeBackDailyOutput(sameDayRows, o.kg);
        if (result.kind === "reject") {
          notify.error(result.reason);
          return false;
        }
        if (result.kind === "update") {
          edits.set(result.id, result.kg);
          current = current.map((r) => (r.id === result.id ? { ...r, quantityKg: result.kg } : r));
        } else {
          if (result.kg === 0) continue;
          const created: WipProductionItem = {
            id: uid(),
            productionDate: o.date,
            postingDate: todayISO(),
            backdateReason,
            workshop: "Đông",
            productId,
            spec,
            quantityKg: result.kg,
            blocksCount: 0,
            warehouse: "",
            status: "pending",
            note: "Ghi từ lưới cân đối",
            balancingPeriodId: period.id,
          };
          toAdd.push(created);
          current = [...current, created];
        }
      }
      if (edits.size === 0 && toAdd.length === 0) return true;
      const prevRows = allWips;
      saveCheckpoint(cells.length === 1 ? `sx:${cells[0].rowKey}:${cells[0].date}` : `sx-khoi:${cells.length}`);
      writeAllProductions([
        ...allWips.map((r) => {
          const kg = edits.get(r.id);
          if (kg == null) return r;
          return {
            ...r,
            quantityKg: kg,
            backdateReason: backdateReason || r.backdateReason,
            postingDate: backdateReason ? todayISO() : r.postingDate,
          };
        }),
        ...toAdd,
      ]);
      notify.saved(
        cells.length === 1
          ? `Đã ghi ${num(cells[0].kg)} kg ngày ${formatDateVN(cells[0].date)} vào sổ sản xuất`
          : `Đã ghi ${cells.length} ô vào sổ sản xuất`,
        () => writeAllProductions(prevRows)
      );
      return true;
    },
    [assignedWips, allWips, writeAllProductions, saveCheckpoint, period.id]
  );

  /* ---------- Dòng lưới + kết quả ---------- */

  const materialRows = useMemo(() => buildMaterialGridRows(materialInRows, assignedImports), [materialInRows, assignedImports]);
  const finishedGoodRows = useMemo(() => buildFinishedGoodGridRows(finishedGoods, assignedWips), [finishedGoods, assignedWips]);

  /* Dòng hút đọc sản lượng thẳng từ sổ nguồn, nhưng `calculateBalancing` (bất
     biến, không sửa) đọc `quantityKg`. Tính kết quả từ bản đã đồng bộ thay vì
     ghi ngược xuống kho rồi chờ vòng render sau — số trên màn khớp ngay lúc gõ. */
  const materialsForCalc = useMemo(
    () =>
      materialInRows.map((r) => {
        const h = materialRows.find((x) => x.id === r.id);
        if (!h) return r;
        /* Dòng hút từ sổ nhập: đơn giá = Σ kg × giá TỪNG chuyến ÷ kg (buildMaterialGridRows,
           không làm tròn) ⇒ công thức kỳ ra đúng tổng tiền các chuyến — áp cho MỌI kỳ, kể cả
           đã chốt (người dùng chốt 2026-10-20). Kỳ đã chốt chỉ TÍNH lại trên màn, không ghi
           ngược (effect bên dưới). */
        const unitPrice = h.fromImports ? h.unitPrice : r.unitPrice;
        return h.total !== r.quantityKg || unitPrice !== r.unitPrice ? { ...r, quantityKg: h.total, unitPrice } : r;
      }),
    [materialInRows, materialRows]
  );
  const finishedGoodsToCalc = useMemo(
    () =>
      finishedGoods.map((r) => {
        const h = finishedGoodRows.find((x) => x.id === r.id);
        return h && h.total !== r.quantityKg ? { ...r, quantityKg: h.total } : r;
      }),
    [finishedGoods, finishedGoodRows]
  );

  /* …và ghi con số đã đồng bộ xuống kho để bản in và màn khác đọc đúng. Chạy
     trong effect (không phải lúc render) và chỉ ghi khi thật sự lệch nên hội tụ
     sau đúng một vòng.

     HAI CỔNG trước khi ghi ngược (đây là ghi TỰ ĐỘNG, người dùng không bấm gì):
     1. MỌI bảng nguồn + bảng đích đã nạp xong từ máy chủ ("san-sang"). Máy mới
        (localStorage trống) mở kỳ: balancing_inputs về trước, material_imports
        chưa về ⇒ tổng = 0 ⇒ trước đây ghi quantityKg = 0 lên máy chủ + nhật ký
        "Sửa"; sổ nhập nạp lỗi thì số 0 ở lại luôn. Bảng đích chưa nạp thì
        `ghiNL` ghép với bản local cũ ⇒ có thể xoá dòng kỳ khác trên máy chủ.
     2. Kỳ CHƯA chốt. Sổ nhập / sổ SX sửa sau khi kỳ chốt thì màn vẫn TÍNH theo
        sổ, nhưng không được lặng lẽ đổi số đã lưu của kỳ đã chốt — muốn nhận số
        mới thì mở lại kỳ (bắt lý do), effect sẽ tự ghi. */
  const materialSourcesReady = inputStatus === "ready" && importStatus === "ready" && stockLedgerStatus === "ready";
  const finishedGoodSourcesReady = outputStatus === "ready" && wipStatus === "ready";
  useEffect(() => {
    if (isLocked || !materialSourcesReady) return;
    if (materialsForCalc.some((r, i) => r !== materialInRows[i])) writeMaterials(materialsForCalc, "");
  }, [materialsForCalc, materialInRows, writeMaterials, isLocked, materialSourcesReady]);

  /* TỰ LẤY sổ nhập vào kỳ (người dùng chốt 2026-10-20: tạo kỳ là nguyên liệu tự vào, bỏ nút
     "Lấy n dòng từ sổ nhập"): họ NL có chuyến trong khoảng ngày mà kỳ chưa có dòng ⇒ tạo dòng
     lưới "hút từ sổ nhập" (số đọc thẳng từ sổ, không chép, không gán kỳ lên sổ nhập). Id CỐ
     ĐỊNH theo kỳ + họ ⇒ hai máy cùng mở kỳ chỉ ghi đè cùng một dòng, không đẻ dòng trùng.
     Cùng hai cổng như ghi ngược ở trên: nguồn đã nạp xong + kỳ chưa chốt (+ có quyền ghi). */
  /* Chốt CHỐNG CHẠY HAI LẦN: kho ghi xong mới vẽ lại ⇒ effect có thể chạy lần nữa khi
     `importsToPull` chưa kịp rỗng (đã thấy: toast "Đã tự lấy…" hiện đôi). Ghi theo kỳ + họ. */
  const autoPulledRef = useRef("");
  useEffect(() => {
    if (isLocked || isReadOnly || !materialSourcesReady || importsToPull.length === 0) return;
    const pullKey = `${period.id}|${[...new Set(importsToPull.map((r) => getMaterialFamily(r.materialTypeName)))].sort().join(",")}`;
    if (autoPulledRef.current === pullKey) return;
    autoPulledRef.current = pullKey;
    const toAdd: BalancingInputItem[] = [];
    for (const [family, o] of groupImportsByMaterialType(importsToPull)) {
      toAdd.push({
        id: `${period.id}-imports-${family}`,
        periodId: period.id,
        groupName: "Thủy sản",
        name: family,
        quantityKg: Object.values(o.dailyQuantities).reduce((s, v) => s + v, 0),
        unitPrice: null, // giá theo từng chuyến (buildMaterialGridRows)
        ratioPercentage: null,
        sourceWarehouse: "",
        dailyQuantities: {},
        carryOverKg: 0,
        isReduction: false,
        reductionWarehouseId: "",
        autoSource: "imports",
      });
    }
    if (toAdd.length > 0 && writeMaterials([...materialInRows, ...toAdd], "")) {
      notify.saved(`Đã tự lấy ${importsToPull.length} chuyến nhập trong khoảng ngày của kỳ`);
    }
  }, [importsToPull, isLocked, isReadOnly, materialSourcesReady, materialInRows, writeMaterials, period.id]);
  useEffect(() => {
    if (isLocked || !finishedGoodSourcesReady) return;
    if (finishedGoodsToCalc.some((r, i) => r !== finishedGoods[i])) writeFinishedGoods(finishedGoodsToCalc, "");
  }, [finishedGoodsToCalc, finishedGoods, writeFinishedGoods, isLocked, finishedGoodSourcesReady]);

  /* Phế liệu không còn là đầu vào của kỳ (xem 31-can-doi-ky.md) — truyền []. */
  const balancingResult = useMemo(
    () => calculateBalancing(period, materialsForCalc, [], finishedGoodsToCalc),
    [period, materialsForCalc, finishedGoodsToCalc]
  );

  /* ---------- Kho đông: dòng Lấy xả đông / Gửi đông ---------- */

  /* Cùng engine với sổ /nxt-nl (computeMaterialNxt) — gõ vào hai dòng kho là tồn đổi
     ngay, không có bản sao số nào phải đồng bộ. Nhập tươi không cần ở đây ⇒ []. */
  const stockRows = useMemo(
    () =>
      computeMaterialNxt(allPeriods, allMaterialRows, [], manualOpeningStock, productionLocks).find(
        (r) => r.periodId === period.id
      ) ?? null,
    [allPeriods, allMaterialRows, manualOpeningStock, productionLocks, period.id]
  );
  const productionLeftoverByDate = useMemo(() => sumLeftoverByDay(productionLocks, period), [productionLocks, period]);
  const periodDomesticSales = useMemo(() => getPeriodDomesticSales(domesticSales, period), [domesticSales, period]);

  /* Kho của lần gửi đông gần nhất cùng họ NL (kỳ trước) — mặc định cho dòng Gửi đông mới. */
  const prevDepositLocation = useMemo(() => {
    const family = getMaterialFamily(period.materialTypeName);
    const periodById = new Map(allPeriods.map((k) => [k.id, k]));
    let latest: { date: string; location: string } | null = null;
    for (const r of allMaterialRows) {
      if (r.periodId === period.id || !r.stockLocation || getBalancingStockLineKind(r) !== "freeze-deposit") continue;
      const k = periodById.get(r.periodId);
      if (!k || getMaterialFamily(k.materialTypeName) !== family) continue;
      const d = k.endDate || k.startDate || "";
      if (!latest || d > latest.date) latest = { date: d, location: r.stockLocation };
    }
    return latest?.location ?? joinDepositLocation(DEFAULT_LEDGER_WAREHOUSE, "");
  }, [allMaterialRows, allPeriods, period.id, period.materialTypeName]);

  const prevFreezePrice = useMemo(() => {
    const family = getMaterialFamily(period.materialTypeName);
    const periodById = new Map(allPeriods.map((k) => [k.id, k]));
    let latest: { date: string; price: number } | null = null;
    for (const r of allMaterialRows) {
      if (r.periodId === period.id || getBalancingStockLineKind(r) !== "freeze-deposit") continue;
      // Giá ngày gửi CUỐI (giá gửi theo ngày, mig 0071) — không phải bình quân cả dòng.
      const price = lastDepositPrice(r);
      if (price == null) continue;
      const k = periodById.get(r.periodId);
      if (!k || getMaterialFamily(k.materialTypeName) !== family) continue;
      const d = k.endDate || k.startDate || "";
      if (period.startDate && d >= period.startDate) continue;
      if (!latest || d > latest.date) latest = { date: d, price };
    }
    return latest?.price ?? null;
  }, [allMaterialRows, allPeriods, period.id, period.materialTypeName, period.startDate]);

  /* Sổ kho tháng: lô để Lấy xả đông (tháng của ngày đầu kỳ; tháng chưa mở ⇒ xem trước
     phần kế thừa) + kho nhận để Gửi đông + kiểm khớp. */
  const periodMonth = monthOfDate(dates[0] ?? period.startDate ?? "");
  const selectLot = useCallback(
    (selected: string[]) => (periodMonth ? listThawLotOptions(monthlyStock, periodMonth, ngucanh.materialFamily, selected) : []),
    [monthlyStock, periodMonth, ngucanh.materialFamily]
  );
  const depositTargetsFor = useCallback(
    (month: string) => (month ? listDepositTargets(monthlyStock, month, ngucanh.materialFamily) : []),
    [monthlyStock, ngucanh.materialFamily]
  );
  const depositLotCategory = useCallback(
    // Bảng cũ "Nguyên liệu gửi đông" không còn dùng (2026-10-20) ⇒ không lấy làm bảng của dòng.
    (rowId: string) =>
      monthlyStock.find((l) => l.id.startsWith(`cd|${rowId}|`) && l.category !== LEGACY_FREEZE_DEPOSIT_CATEGORY)?.category ?? "",
    [monthlyStock]
  );
  const storageOptions = useMemo(
    () =>
      listDepositLocationOptions(
        monthlyStock,
        BSF1_WAREHOUSES.filter((w) => w.type === "plant").map((w) => w.name),
        storageLocations.map((k) => k.name)
      ),
    [monthlyStock, storageLocations]
  );
  const describeStockLine = useCallback(
    (r: BalancingInputItem) => {
      if (r.stockLineId) {
        const lot = selectLot([r.stockLineId]).find((x) => x.value === r.stockLineId);
        return lot ? lot.label : "lô đã chọn không còn trong sổ kho";
      }
      if (r.stockLocation) {
        const { warehouse, storageLocation } = splitDepositLocation(r.stockLocation);
        return storageLocation || warehouse;
      }
      return "";
    },
    [selectLot]
  );
  const stockLedgerDiff = useMemo(() => countMonthlyStockMismatches(monthlyStock, materialInRows), [monthlyStock, materialInRows]);
  const rewriteStockLedger = useCallback(() => {
    const prevRows = monthlyStock;
    const result = syncMonthlyStockLedger(monthlyStock, [], materialInRows, ngucanh);
    if (result.error) {
      notify.error(result.error);
      return;
    }
    if (!result.changed) return;
    saveCheckpoint(`ghi-lai-so-kho:${period.id}`);
    writeStockLedger(result.lines);
    notify.saved("Đã ghi lại phần lấy xả đông / gửi đông của kỳ vào Sổ kho tháng", () =>
      writeStockLedger(prevRows)
    );
  }, [monthlyStock, materialInRows, ngucanh, saveCheckpoint, period.id, writeStockLedger]);

  /* ---------- Chuyển kỳ từ kỳ liền trước ---------- */

  const prevPeriod = useMemo(() => findPreviousPeriod(period, allPeriods), [period, allPeriods]);

  const materialCarryOver = useMemo(() => {
    if (!prevPeriod) return [];
    const row = allMaterialRows.filter((r) => r.periodId === prevPeriod.id);
    return listPendingCarryOvers(row, (r) => r.name);
  }, [prevPeriod, allMaterialRows]);

  const finishedGoodCarryOver = useMemo(() => {
    if (!prevPeriod) return [];
    const row = allOutputs.filter((r) => r.periodId === prevPeriod.id);
    return listPendingCarryOvers(row, (r) => r.productId);
  }, [prevPeriod, allOutputs]);

  /**
   * Nhận phần chuyển kỳ ÂM của kỳ trước thành dòng chuyển kỳ DƯƠNG ở kỳ này,
   * và đánh dấu dòng nguồn đã được kỳ nào nhận để không lấy hai lần.
   * Đây là mắt xích khép vòng gối đầu: trước đó kỳ sau phải mở file kỳ cũ ra
   * chép tay, và chép tay là chỗ số bắt đầu lệch.
   */
  const receiveCarryOver = useCallback(() => {
    if (!prevPeriod || (materialCarryOver.length === 0 && finishedGoodCarryOver.length === 0)) return;
    const prevMaterials = allMaterialRows;
    const prevFinishedGoods = allOutputs;
    saveCheckpoint(`nhan-chuyen-ky:${prevPeriod.id}`);

    const receivedMaterialIds = new Set(materialCarryOver.map((d) => d.sourceId));
    const materialsToAdd: BalancingInputItem[] = materialCarryOver.map((d) => ({
      id: uid(),
      periodId: period.id,
      /* Hàng kỳ trước cất kho, kỳ này lấy ra dùng ⇒ đúng nhóm Xả đông. */
      groupName: "Xả đông",
      name: d.name,
      quantityKg: d.kg,
      unitPrice: null,
      ratioPercentage: null,
      sourceWarehouse: "Kho mình",
      dailyQuantities: {},
      carryOverKg: d.kg,
      carryOverPeriodId: "",
      isReduction: false,
      reductionWarehouseId: "",
      autoSource: "",
    }));

    const receivedFinishedIds = new Set(finishedGoodCarryOver.map((d) => d.sourceId));
    const finishedGoodTemplates = new Map(allOutputs.map((r) => [r.id, r]));
    const finishedGoodsToAdd: BalancingOutputItem[] = finishedGoodCarryOver.map((d) => {
      const template = finishedGoodTemplates.get(d.sourceId);
      return {
        id: uid(),
        periodId: period.id,
        productId: d.name,
        customerId: template?.customerId ?? "",
        channel: template?.channel ?? "Xuất khẩu",
        quantityKg: d.kg,
        unitPrice: template?.unitPrice ?? null,
        spec: template?.spec ?? "",
        salesItemId: "",
        dailyQuantities: {},
        carryOverKg: d.kg,
        carryOverPeriodId: "",
        autoSource: "",
      };
    });

    writeAllMaterials([
      ...allMaterialRows.map((r) =>
        receivedMaterialIds.has(r.id) ? { ...r, carryOverPeriodId: period.id } : r
      ),
      ...materialsToAdd,
    ]);
    writeAllFinishedGoods([
      ...allOutputs.map((r) =>
        receivedFinishedIds.has(r.id) ? { ...r, carryOverPeriodId: period.id } : r
      ),
      ...finishedGoodsToAdd,
    ]);
    notify.saved(
      `Đã nhận ${materialsToAdd.length + finishedGoodsToAdd.length} dòng chuyển từ kỳ ${prevPeriod.dateRangeDescription || "trước"}`,
      () => {
        writeAllMaterials(prevMaterials);
        writeAllFinishedGoods(prevFinishedGoods);
      }
    );
  }, [prevPeriod, materialCarryOver, finishedGoodCarryOver, allMaterialRows, allOutputs, writeAllMaterials, writeAllFinishedGoods, saveCheckpoint, period.id]);

  return {
    periodId: period.id,
    date: dates,
    inputs: materialInRows,
    materialRows,
    assignedImports,
    pendingImports: importsToPull,
    otherTypeImports,
    otherPeriodImports,
    periodMaterialType: period.materialTypeName,
    overlappingPeriods,
    isPeriodFamily: isSamePeriodFamily,
    importDiagnostics: importDiagnosis,
    saveInputs: writeMaterials,
    pullImports,
    saveImportDayCells: writeImportsMultiDay,
    isImportDayLocked,
    editImportTrips,
    frozenStock: stockRows,
    leftoverByDay: productionLeftoverByDate,
    lastFreezeDepositPrice: prevFreezePrice,
    lotOptions: selectLot,
    depositLocationOptions: storageOptions,
    defaultDepositLocation: prevDepositLocation,
    depositTargetsFor,
    depositLotCategory,
    describeStockLine,
    stockLedgerMismatches: stockLedgerDiff,
    resyncStockLedger: rewriteStockLedger,
    domesticSales: periodDomesticSales,
    outputs: finishedGoods,
    finishedGoodRows,
    assignedWips,
    pendingWips,
    saveOutputs: writeFinishedGoods,
    pullWips: pullProduction,
    templatePeriod,
    missingTemplateRows: missingTemplates,
    templateRows: finishedGoodTemplates,
    suggestTemplate,
    pullAllSources,
    saveWipDayCells: writeProductionsMultiDay,
    lockedDates,
    previousPeriod: prevPeriod,
    carryOverRowCount: materialCarryOver.length + finishedGoodCarryOver.length,
    applyCarryOver: receiveCarryOver,
    isLocked,
    isReadOnly,
    canUndo: historyCount.undo > 0,
    canRedo: historyCount.redo > 0,
    undo,
    redo,
    result: balancingResult,
  };
}
