// ============================================================
// Tên file: src/features/balancing/MaterialGrid.tsx
// Tên tiếng Việt: Khối 1 — lưới nguyên liệu vào theo ngày
// Description: Balancing block 1 — material input day grid
// ============================================================
import { useMemo, useState } from "react";
import type { BalancingInputItem, DailyQuantities, InputGroup, MaterialImportItem, MaterialType } from "@/types";
import { BSF1_WAREHOUSES, INPUT_GROUPS, sumGridRow } from "@/types";
import { uid } from "@/lib/db";
import {
  OWN_WAREHOUSE,
  BALANCING_STOCK_LINE_NAMES,
  getMaterialFamily,
  getBalancingStockLineKind,
  formatDayLabel,
  findUnpricedMaterialRows,
  suggestMaterialPrices,
  type MaterialGridRow,
  type BalancingStockLineKind,
} from "@/lib/balancingGrid";
import {
  DOMESTIC_SALE_ROW_NAME,
  negateDailyQuantities,
  compareDomesticSales,
  isDomesticSaleRow,
} from "@/lib/domesticSales";
import { DAY_COLUMN_GROUPS, collapsedDayGroups, type DayCell, type PeriodGrid } from "./usePeriodGrid";
import { PickImportRowsDialog, ManualRowsDialog, AddMaterialRowDialog } from "./gridDialogs";
import { CellShipments } from "./CellShipments";
import { RowNoteCell } from "./RowNoteCell";
import { DepositTargetDialog, type DepositTargetValue } from "./DepositTargetDialog";
import { useImportShipments } from "@/lib/catalogRepo";
import { groupImportsBySupplier, groupImportsByMaterialType } from "@/lib/dailyShipments";
import {
  DEFAULT_DEPOSIT_CATEGORY,
  depositPriceOn,
  hasVaryingDepositPrices,
  setDepositPriceAllDays,
  setDepositPricesOn,
  shortWarehouseLabel,
} from "@/lib/balancingStockLines";
import {
  Button,
  Combobox,
  EditableGrid,
  Tag,
  notify,
  type GridColumn,
  type GridRow,
} from "@/design-system";
import { num, formatDateVN } from "@/lib/format";
import { useCan } from "@/features/shared/PermissionProvider";
import { ChevronDown, ChevronsLeftRight, Combine, Download, ListChecks, Pencil, Plus, Users } from "lucide-react";

const WORKSHOP_WAREHOUSES = BSF1_WAREHOUSES.filter((w) => w.type === "workshop");

/** Cột tiền của khối NL — ẩn khi không có quyền `balancing.view-price`. */
const PRICE_COLUMN_KEYS = new Set(["donGia", "thanhTien"]);
/** Id hàng phụ "Giá gửi" theo ngày dưới dòng Gửi đông (chỉ ở màn, không lưu). */
const PRICE_ROW_SUFFIX = "::price";
const priceRowId = (rowId: string) => `${rowId}${PRICE_ROW_SUFFIX}`;

/** Cắt hậu tố size để gom "2 da lớn"/"2 da nhỏ" về một họ — CHỈ dùng cho nút Gộp,
    KHÔNG đổi `getMaterialFamily` (logic hút) để tránh đụng khớp họ khi hút. */
const mergeFamily = (names: string) =>
  names.replace(/\s*(lớn|nhỏ)(\s*\([^)]*\))?\s*$/iu, "").replace(/\s+/g, " ").trim();

export function MaterialGrid({
  grid,
  materialTypeCatalog: catalogMaterialTypes,
  onCreateMaterialType: onAddMaterialType,
  materialTypeEdit: materialTypeEditor,
  daysCollapsed: isDateColumnsCollapsed,
  onToggleDays: onToggleDayColumns,
}: {
  grid: PeriodGrid;
  materialTypeCatalog: MaterialType[];
  /** Không truyền ⇒ không có quyền thêm loại NL vào danh mục: ô chỉ chọn. */
  onCreateMaterialType?: (names: string) => string;
  /** Bút chì sửa nhanh loại NL ở hộp thêm dòng (useQuickCatalogEdit của màn, theo TÊN). */
  materialTypeEdit?: { openEdit: (v: string) => void; canEdit: (v: string) => boolean; editLabel: string };
  daysCollapsed: boolean;
  onToggleDays: () => void;
}) {
  const {
    date: dates,
    inputs: materialInRows,
    materialRows,
    pendingImports: importsToPull,
    otherTypeImports,
    otherPeriodImports,
    importDiagnostics: importDiagnosis,
    saveInputs: saveMaterials,
    pullImports,
    saveImportDayCells: saveImportsMultiDay,
    frozenStock: stockRows,
    leftoverByDay: leftoverByDate,
    domesticSales: productionDomesticSales,
  } = grid;
  const allowed = useCan("balancing");
  const canViewPrice = allowed["view-price"];
  const [isManualEditOpen, setIsManualEditOpen] = useState(false);
  /* ---------- Chuyến nhập NGAY TRONG lưới (chỉ đọc) ----------
     Ô ngày của dòng lấy từ sổ nhập có nút "n chuyến" (đại lý → chuyến của ô đó);
     dòng loại NL mở ra dòng con theo ĐẠI LÝ (kg theo ngày, cộng lại = dòng cha).
     Không đi qua đường ghi: dữ liệu là chính các dòng sổ nhập đã lấy vào kỳ. */
  const [shipmentList] = useImportShipments();
  const lotCodes = useMemo(
    () => new Map(shipmentList.filter((c) => c.lotCode).map((c) => [c.id, c.lotCode ?? ""])),
    [shipmentList]
  );
  const importById = useMemo(() => new Map(grid.assignedImports.map((r) => [r.id, r])), [grid.assignedImports]);
  const importRowsOf = (h: MaterialGridRow): MaterialImportItem[] =>
    h.fromImports ? h.sourceIds.flatMap((id) => importById.get(id) ?? []) : [];
  /** Thành tiền thật của từng dòng con đại lý (id dòng con → đ). */
  const childRowAmount = new Map<string, number>();
  /** Dòng loại NL đang mở dòng con theo đại lý. */
  const [expandedSuppliers, setExpandedSuppliers] = useState<ReadonlySet<string>>(() => new Set());
  /** Dòng loại NL có dòng sổ nhập (mở được theo đại lý) — cho nút mở/gập tất cả. */
  const idsWithSupplier = materialRows.filter((h) => h.fromImports && h.sourceIds.length > 0).map((h) => h.id);
  const hasSupplierRows = idsWithSupplier.length > 0;
  const allSuppliersExpanded = hasSupplierRows && idsWithSupplier.every((id) => expandedSuppliers.has(id));
  const toggleSupplierOpen = (id: string) =>
    setExpandedSuppliers((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const [addingGroup, setAddingGroup] = useState<InputGroup | "decrease" | null>(null);
  const [isImportPickerOpen, setIsImportPickerOpen] = useState(false);
  /** id dòng kho ẢO (chưa lưu) — dòng thật tạo ra DÙNG LẠI đúng id này, nên ô đang gõ
      không bị dựng lại (mất con trỏ, rơi các phím sau) khi phím đầu biến nó thành thật.
      Suy từ id kỳ ⇒ không bao giờ trùng giữa hai kỳ. */
  const idAo = (lineKind: BalancingStockLineKind) => `${grid.periodId}-${lineKind}`;

  const theoId = useMemo(() => new Map(materialInRows.map((r) => [r.id, r])), [materialInRows]);

  /* ---------- Hai dòng kho cố định: Lấy xả đông (đầu) · Gửi đông (cuối) ----------
     Kỳ chưa có dòng nào thì hiện dòng ẢO; gõ số / giá vào là thành dòng thật. Tồn
     kho đông đọc từ engine sổ NXT nên cộng trừ ngay theo từng phím. */
  /** Đơn giá bình quân NL thủy sản của kỳ — gợi ý giá cho phần gửi đông. */
  const avgMaterialPrice = useMemo(() => {
    const ts = materialRows.filter((h) => !h.stockLineKind && !h.isDecrease && h.group === "Thủy sản" && h.unitPrice != null);
    const kg = ts.reduce((s, h) => s + h.total, 0);
    return kg > 0 ? Math.round(ts.reduce((s, h) => s + h.total * (h.unitPrice ?? 0), 0) / kg) : null;
  }, [materialRows]);

  const stockLineTemplate = (lineKind: BalancingStockLineKind): BalancingInputItem => ({
    id: idAo(lineKind),
    periodId: grid.periodId,
    groupName: "Xả đông",
    name: BALANCING_STOCK_LINE_NAMES[lineKind],
    quantityKg: 0,
    unitPrice: lineKind === "thaw-out" ? grid.lastFreezeDepositPrice : avgMaterialPrice,
    ratioPercentage: null,
    sourceWarehouse: OWN_WAREHOUSE,
    dailyQuantities: {},
    carryOverKg: 0,
    isReduction: lineKind === "freeze-deposit",
    reductionWarehouseId: lineKind === "freeze-deposit" ? (WORKSHOP_WAREHOUSES[0]?.id ?? "") : "",
    autoSource: "",
    /* Gửi đông mặc định SẴN kho (kho lần gửi gần nhất, chưa có ⇒ Kho 1500 tấn) — gõ số là
       ghi được ngay, khỏi bị chặn "Chọn kho gửi" (yêu cầu 2026-10-16: mặc định cả kho lẫn NL). */
    ...(lineKind === "freeze-deposit" ? { stockLocation: grid.defaultDepositLocation } : {}),
  });
  const hangAo = (lineKind: BalancingStockLineKind): MaterialGridRow => {
    const m = stockLineTemplate(lineKind);
    return {
      id: m.id,
      name: m.name,
      stockLineKind: lineKind,
      group: m.groupName,
      dailyQuantities: {},
      carryOverKg: 0,
      total: 0,
      unitPrice: m.unitPrice,
      ratio: null,
      isDecrease: m.isReduction ?? false,
      decreaseTarget: m.reductionWarehouseId ?? "",
      fromImports: false,
      sourceIds: [],
    };
  };
  const thawRows = materialRows.filter((h) => h.stockLineKind === "thaw-out");
  const freezeDepositRows = materialRows.filter((h) => h.stockLineKind === "freeze-deposit");
  const thawGridRows = thawRows.length ? thawRows : [hangAo("thaw-out")];
  const freezeDepositGridRows = freezeDepositRows.length ? freezeDepositRows : [hangAo("freeze-deposit")];
  const aoTheoId = new Map<string, BalancingInputItem>(
    (["thaw-out", "freeze-deposit"] as BalancingStockLineKind[])
      .filter((l) => (l === "thaw-out" ? !thawRows.length : !freezeDepositRows.length))
      .map((l) => [idAo(l), stockLineTemplate(l)])
  );
  const getOriginal = (id: string) => theoId.get(id) ?? aoTheoId.get(id);

  /** Dòng ảo ⇒ dựng dòng thật (giữ id ảo) từ mẫu + patch. */
  const tuAo = (ao: BalancingInputItem, patch: Partial<BalancingInputItem>): BalancingInputItem => {
    const updated = { ...ao, ...patch };
    updated.quantityKg = sumGridRow(updated.dailyQuantities, updated.carryOverKg);
    return updated;
  };

  /** Sửa một dòng lưới + giữ `quantityKg` khớp tổng (công thức đọc trường này). */
  /** Ghi một dòng; trả false nếu bị từ chối (VD Gửi đông chưa chọn kho — lỗi đã báo). */
  const writeRow = (id: string, patch: Partial<BalancingInputItem>): boolean => {
    const ao = aoTheoId.get(id);
    if (ao) return saveMaterials([...materialInRows, tuAo(ao, patch)]);
    return saveMaterials(
      materialInRows.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...patch };
        /* Dòng hút lấy ngày từ sổ nhập → tổng tính ở chỗ khác, đừng đè. */
        if (updated.autoSource !== "imports") {
          updated.quantityKg = sumGridRow(updated.dailyQuantities, updated.carryOverKg);
        }
        return updated;
      })
    );
  };

  /** Gõ vào ô ngày. Dòng hút thì ghi thẳng về sổ Nhập hàng, dòng tay thì ghi tại chỗ. */
  const writeDayCell = (r: BalancingInputItem, iso: string, v: number | null) => {
    const kg = v ?? 0;
    if (r.autoSource === "imports") {
      saveImportsMultiDay([{ rowKey: r.name, date: iso, kg }]);
      return;
    }
    const daily: DailyQuantities = { ...(r.dailyQuantities ?? {}) };
    if (kg === 0) delete daily[iso];
    /* Dòng Giảm / Gửi đông: người dùng gõ số dương, hệ ghi số ÂM — bắt tổ trưởng
       gõ dấu trừ ở xưởng lạnh là cách chắc chắn nhất để có số sai. */
    else daily[iso] = r.isReduction ? -Math.abs(kg) : kg;
    writeRow(r.id, { dailyQuantities: daily });
  };

  /**
   * Gõ thẳng SỐ LƯỢNG (khi đang thu cột ngày). Tổng vẫn là Σ ngày (+ chuyển kỳ cũ),
   * nên phần chênh được dồn vào NGÀY CUỐI đang có số (chưa có ngày nào ⇒ ngày đầu
   * kỳ). Giữ nguyên các ngày khác ⇒ mở cột ngày ra vẫn thấy đúng số đã gõ theo ngày.
   */
  const writeQuantity = (r: BalancingInputItem, h: MaterialGridRow, v: number | null) => {
    if (!dates.length) {
      notify.error("Kỳ chưa có ngày tiếp nhận — sửa ngày của kỳ trước khi nhập số lượng.");
      return;
    }
    const targetTotal = r.isReduction ? -Math.abs(v ?? 0) : (v ?? 0);
    const datesWithValues = dates.filter((iso) => (h.dailyQuantities[iso] ?? 0) !== 0);
    const iso = datesWithValues.length ? datesWithValues[datesWithValues.length - 1] : dates[0];
    const updated = (h.dailyQuantities[iso] ?? 0) + (targetTotal - h.total);
    /* Đã tính dấu ở trên ⇒ gọi thẳng, không qua lớp "dương → âm" của ghiONgay. */
    if (r.autoSource === "imports") {
      saveImportsMultiDay([{ rowKey: r.name, date: iso, kg: updated }]);
      return;
    }
    const daily: DailyQuantities = { ...(r.dailyQuantities ?? {}) };
    if (updated === 0) delete daily[iso];
    else daily[iso] = updated;
    writeRow(r.id, { dailyQuantities: daily });
  };

  /* ---------- Bán nội địa (mig 0054): dòng GIẢM "Bán nội địa" ⇄ sổ /wip ----------
     NL bán thẳng cho khách trong nước (bảng giấy: −987). Tổ trưởng ghi ở Sản xuất;
     ở đây chỉ điền / đối chiếu theo từng ngày — dòng giảm âm sẵn đúng công thức. */
  const isDomesticSale = (h: MaterialGridRow) => h.isDecrease && isDomesticSaleRow({ name: h.name });
  const domesticSaleRow = materialInRows.find((r) => isDomesticSaleRow(r));
  const fillDomesticSales = () => {
    const daily = negateDailyQuantities(productionDomesticSales.dailyQuantities);
    if (domesticSaleRow) {
      // Dòng cũ (Thủy sản kg âm thường) chuyển luôn thành dòng giảm — một dòng, không trừ đôi.
      writeRow(domesticSaleRow.id, {
        dailyQuantities: daily,
        unitPrice: productionDomesticSales.averagePrice ?? domesticSaleRow.unitPrice,
        isReduction: true,
        reductionWarehouseId: "",
      });
    } else {
      saveMaterials([
        ...materialInRows,
        {
          id: uid(),
          periodId: grid.periodId,
          groupName: "Thủy sản",
          name: DOMESTIC_SALE_ROW_NAME,
          quantityKg: sumGridRow(daily, 0),
          unitPrice: productionDomesticSales.averagePrice,
          ratioPercentage: null,
          sourceWarehouse: "",
          dailyQuantities: daily,
          carryOverKg: 0,
          isReduction: true,
          reductionWarehouseId: "", // bán đi, không vào kho nào
          autoSource: "",
        },
      ]);
    }
    notify.saved(`Đã ghi Bán nội địa ${num(productionDomesticSales.totalKg)} kg theo sổ Sản xuất`);
  };
  const domesticSaleSubtext = (h: MaterialGridRow) => {
    if (productionDomesticSales.totalKg <= 0) return undefined;
    const result = compareDomesticSales(h.dailyQuantities, productionDomesticSales.dailyQuantities);
    if (result === "match") return <Tag variant="done" className="mt-0.5">khớp sổ SX</Tag>;
    return (
      <span className="mt-0.5 inline-flex flex-wrap items-center gap-1">
        {result === "mismatch" && (
          <Tag variant="warning">
            SX ghi {num(productionDomesticSales.totalKg)} · lệch {num(Math.abs(h.total) - productionDomesticSales.totalKg)}
          </Tag>
        )}
        {!grid.isLocked && (
          <Button
            variant="outline"
            size="sm"
            onClick={fillDomesticSales}
            title="Điền dòng Bán nội địa đúng từng ngày bằng số tổ trưởng ghi ở màn Sản xuất thành phẩm (ghi đè số đang có của dòng này)."
          >
            {result === "mismatch" ? "Lấy lại từ SX" : `Lấy ${num(productionDomesticSales.totalKg)} kg từ SX`}
          </Button>
        )}
      </span>
    );
  };

  /* ---------- Thứ tự dòng trên màn = thứ tự dán khối ----------
     Lấy xả đông → các nhóm (Thủy sản · Xả đông mua về · Bột) → Giảm → Gửi đông. */
  const groupsWithRows = INPUT_GROUPS.map((group) => ({
    group,
    rows: materialRows.filter((h) => !h.stockLineKind && h.group === group && !h.isDecrease),
  })).filter((g) => g.rows.length > 0);
  const reductionRows = materialRows.filter((h) => !h.stockLineKind && h.isDecrease);
  const visibleRows: MaterialGridRow[] = [
    ...thawGridRows,
    ...groupsWithRows.flatMap((g) => g.rows),
    ...reductionRows,
    ...freezeDepositGridRows,
  ];

  const writeCell = (rowId: string, colKey: string, v: number | null) => {
    /* Hàng phụ "Giá gửi": ô ngày = giá gửi của ngày đó (mig 0071) — lô GĐ-ngày đổi giá theo. */
    if (rowId.endsWith(PRICE_ROW_SUFFIX)) {
      const parentId = rowId.slice(0, -PRICE_ROW_SUFFIX.length);
      const parent = getOriginal(parentId);
      if (parent && colKey.startsWith("ngay:")) writeRow(parentId, setDepositPricesOn(parent, { [colKey.slice(5)]: v }));
      return;
    }
    const r = getOriginal(rowId);
    if (!r) return;
    if (colKey === "soLuong") {
      const h = visibleRows.find((x) => x.id === rowId);
      if (h) writeQuantity(r, h, v);
      return;
    }
    if (colKey === "chuyenKy") return writeRow(rowId, { carryOverKg: v ?? 0 });
    /* Gửi đông: gõ Đơn giá của dòng = MỘT giá cho mọi ngày gửi (giá riêng từng ngày gõ ở hàng phụ). */
    if (colKey === "donGia")
      return writeRow(rowId, getBalancingStockLineKind(r) === "freeze-deposit" ? setDepositPriceAllDays(r, v) : { unitPrice: v });
    if (colKey === "tyLe") return writeRow(rowId, { ratioPercentage: v });
    if (colKey.startsWith("ngay:")) writeDayCell(r, colKey.slice(5), v);
  };

  /**
   * Dán một khối số từ Excel. Gộp mọi ô vào MỘT lần ghi cho mỗi đích — dán 5×10
   * ô rồi gọi 50 lần thì 49 lần đầu bị ghi đè, chỉ ô cuối sống. Dòng tính theo
   * THỨ TỰ TRÊN MÀN (hangHien), không theo thứ tự lưu.
   */
  const pasteBlock = (rowId: string, colKey: string, block: (number | null)[][]) => {
    if (!colKey.startsWith("ngay:")) return;
    const dateColumns = dates.map((iso) => `ngay:${iso}`);
    /* Dòng theo THỨ TỰ TRÊN MÀN kể cả dòng con đại lý đang mở — dán đè lên dòng con
       (chỉ đọc) thì bỏ qua ô đó, không trượt số sang dòng dưới. */
    const orderedIds = gridRows.map((x) => x.id);
    const iH = orderedIds.indexOf(rowId);
    const iC = dateColumns.indexOf(colKey);
    if (iH < 0 || iC < 0) return;

    const importCells: DayCell[] = [];
    const manualEdits = new Map<string, DailyQuantities>();
    /** Giá gửi theo ngày dán vào hàng phụ "Giá gửi": id dòng Gửi đông → ngày → giá. */
    const priceEdits = new Map<string, Record<string, number | null>>();
    block.forEach((row, i) =>
      row.forEach((v, j) => {
        if (v == null) return;
        const targetId = orderedIds[iH + i];
        const column = dateColumns[iC + j];
        if (targetId?.endsWith(PRICE_ROW_SUFFIX) && column) {
          const parentId = targetId.slice(0, -PRICE_ROW_SUFFIX.length);
          // Ngày chưa gửi kg ⇒ ô giá khoá, bỏ qua như ô khoá khác.
          if (!getOriginal(parentId)?.dailyQuantities?.[column.slice(5)]) return;
          priceEdits.set(parentId, { ...priceEdits.get(parentId), [column.slice(5)]: v });
          return;
        }
        const h = visibleRows.find((x) => x.id === targetId);
        if (!h || !column) return;
        const original = getOriginal(h.id);
        if (!original) return;
        const iso = column.slice(5);
        if (original.autoSource === "imports") {
          importCells.push({ rowKey: original.name, date: iso, kg: v });
          return;
        }
        const daily = manualEdits.get(h.id) ?? { ...(original.dailyQuantities ?? {}) };
        if (v === 0) delete daily[iso];
        else daily[iso] = original.isReduction ? -Math.abs(v) : v;
        manualEdits.set(h.id, daily);
      })
    );

    if (manualEdits.size > 0 || priceEdits.size > 0) {
      const createdFromVirtual = [...aoTheoId.entries()]
        .filter(([id]) => manualEdits.has(id))
        .map(([id, ao]) => tuAo(ao, { dailyQuantities: manualEdits.get(id)! }));
      saveMaterials([
        ...materialInRows.map((r) => {
          const daily = manualEdits.get(r.id);
          const prices = priceEdits.get(r.id);
          if (!daily && !prices) return r;
          const updated = daily ? { ...r, dailyQuantities: daily, quantityKg: sumGridRow(daily, r.carryOverKg) } : r;
          return prices ? { ...updated, ...setDepositPricesOn(updated, prices) } : updated;
        }),
        ...createdFromVirtual,
      ]);
    }
    if (importCells.length > 0) saveImportsMultiDay(importCells);
  };

  const addRow = (group: InputGroup | "decrease", names: string) => {
    const isReduction = group === "decrease";
    saveMaterials([
      ...materialInRows,
      {
        id: uid(),
        periodId: grid.periodId,
        groupName: isReduction ? "Thủy sản" : group,
        name: names,
        quantityKg: 0,
        unitPrice: null,
        ratioPercentage: null,
        sourceWarehouse: "",
        dailyQuantities: {},
        carryOverKg: 0,
        isReduction,
        reductionWarehouseId: isReduction ? (WORKSHOP_WAREHOUSES[0]?.id ?? "") : "",
        autoSource: "",
      },
    ]);
    setAddingGroup(null);
    notify.saved(isReduction ? `Đã thêm dòng giảm "${names}"` : `Đã thêm "${names}"`);
  };

  const removeRow = (id: string) => {
    const prevRows = materialInRows;
    const d = theoId.get(id);
    saveMaterials(materialInRows.filter((r) => r.id !== id));
    notify.deleted(`Đã xóa dòng "${d?.name ?? ""}"`, () => saveMaterials(prevRows));
  };

  /* Các dòng nhập TAY cùng HỌ (2 da lớn + nhỏ) — để bật nút "Gộp cùng loại". */
  const mergeableGroups = useMemo(() => {
    const m = new Map<string, BalancingInputItem[]>();
    for (const r of materialInRows) {
      if (r.autoSource === "imports") continue; // dòng hút đã một-dòng-mỗi-họ
      if (getBalancingStockLineKind(r)) continue; // dòng kho mỗi dòng một lô / một kho — không gộp
      const k = `${r.groupName} ${r.isReduction ? 1 : 0} ${r.sourceWarehouse ?? ""} ${mergeFamily(r.name).toLowerCase()}`;
      const g = m.get(k);
      if (g) g.push(r);
      else m.set(k, [r]);
    }
    return [...m.values()].filter((g) => g.length > 1);
  }, [materialInRows]);

  /**
   * GỘP MỘT LẦN (bấm nút): dồn các dòng nhập tay cùng họ thành một dòng — cộng kg
   * + chuyển kỳ, đơn giá BÌNH QUÂN GIA QUYỀN nên Giá trị NL (Σ kg×giá) giữ nguyên.
   * Một lần ghi (atomic), có Hoàn tác. KHÔNG chạy tự động lúc mở kỳ để tránh đua
   * ghi bất đồng bộ làm cộng đôi (đã thử auto → bỏ).
   */
  const mergeSizes = () => {
    if (mergeableGroups.length === 0) {
      notify.saved("Không có dòng cùng loại để gộp");
      return;
    }
    const prevRows = materialInRows;
    const droppedIds = new Set<string>();
    const toAdd: BalancingInputItem[] = [];
    let oldRowCount = 0;
    for (const g of mergeableGroups) {
      oldRowCount += g.length;
      const neo = g[0];
      const daily: DailyQuantities = {};
      let totalKg = 0;
      let value = 0;
      let carry = 0;
      for (const r of g) {
        for (const [d, v] of Object.entries(r.dailyQuantities ?? {}))
          daily[d] = (daily[d] ?? 0) + v;
        // Cân theo TỔNG mỗi dòng (kể cả chuyển kỳ) để Σ kg×giá GIỮ NGUYÊN chính xác.
        const kg = sumGridRow(r.dailyQuantities ?? {}, r.carryOverKg ?? 0);
        totalKg += kg;
        value += kg * (r.unitPrice ?? 0);
        carry += r.carryOverKg ?? 0;
        droppedIds.add(r.id);
      }
      toAdd.push({
        ...neo,
        name: mergeFamily(neo.name),
        dailyQuantities: daily,
        carryOverKg: carry,
        quantityKg: sumGridRow(daily, carry),
        // Bình quân gia quyền, KHÔNG làm tròn ⇒ Giá trị NL (Σ kg×giá) không lệch.
        unitPrice: totalKg !== 0 ? value / totalKg : neo.unitPrice,
      });
    }
    saveMaterials([...materialInRows.filter((r) => !droppedIds.has(r.id)), ...toAdd]);
    notify.saved(`Đã gộp ${oldRowCount} dòng thành ${toAdd.length} dòng cùng loại`, () =>
      saveMaterials(prevRows)
    );
  };

  /* Cột "Chuyển kỳ" đã bỏ khỏi khối NL (ra/vào kho đi bằng hai dòng kho). Chỉ còn
     hiện khi kỳ CŨ lỡ có số ở đó — giấu đi thì Số lượng ≠ Σ ngày mà không ai hiểu vì sao. */
  const hasLegacyCarryOver = materialRows.some((h) => h.carryOverKg !== 0);

  /* Thứ tự cột theo file cân đối của kế toán (cột A–E): Loại hàng · Số lượng · Đơn giá
     VNĐ · T.tiền · tỷ lệ đứng SÁT tên — số chính luôn thấy, không phải cuộn ngang; phần
     chia ngày (khi mở) dời ra SAU CÙNG như cột ngày của bảng giấy. */
  const gridColumns: GridColumn<MaterialGridRow>[] = [
    /* Hai cột "Số lượng" loại trừ nhau: đang MỞ ngày ⇒ ô tính (Σ ngày, gõ ở ô ngày);
       đang THU ngày ⇒ gõ thẳng (ghiSoLuong). */
    { key: "tong", header: "Số lượng", label: "Số lượng", kind: "computed", group: DAY_COLUMN_GROUPS.daysExpandedOnly, minWidth: 104, getValue: (h) => h.total || null },
    { key: "soLuong", header: "Số lượng", label: "Số lượng", kind: "input", group: DAY_COLUMN_GROUPS.daysCollapsedOnly, minWidth: 104, getValue: (h) => (h.isDecrease ? Math.abs(h.total) : h.total) || null },
    {
      key: "donGia",
      header: "Đơn giá VNĐ",
      label: "Đơn giá",
      kind: "input",
      minWidth: 104,
      /* Gửi đông: đơn giá lưu là bình quân KHÔNG làm tròn (T.tiền khớp Σ kg×giá ngày) — chỉ
         HIỆN tròn đồng. Ô chỉ ghi khi người dùng gõ nên số hiện tròn không đè số lưu. */
      getValue: (h) => (h.stockLineKind === "freeze-deposit" && h.unitPrice != null ? Math.round(h.unitPrice) : h.unitPrice),
      /* Gửi đông có giá KHÁC nhau theo ngày ⇒ ô này là bình quân, KHOÁ: ô ghi theo từng phím
         (Esc trả số bình quân) nên để gõ được thì lỡ tay là san phẳng giá từng ngày. Giá cùng
         một mức ⇒ gõ được = một giá cho mọi ngày gửi. */
      isLocked: (h) => {
        if (h.priceRowOf) return true;
        const original = h.stockLineKind === "freeze-deposit" ? getOriginal(h.id) : undefined;
        return Boolean(original && hasVaryingDepositPrices(original));
      },
      lockReason: (h) =>
        h.priceRowOf
          ? "Giá gửi gõ theo từng ngày ở hàng này; đơn giá bình quân nằm ở dòng Gửi đông ngay trên."
          : "Giá gửi khác nhau theo ngày — đây là bình quân theo kg. Sửa giá ở hàng Giá gửi ngay dưới (mở cột ngày nếu đang thu).",
      renderCellNote: (h) => {
        const original = h.stockLineKind === "freeze-deposit" ? getOriginal(h.id) : undefined;
        return original && hasVaryingDepositPrices(original) ? (
          <span className="text-sm text-muted-foreground">BQ theo ngày</span>
        ) : null;
      },
    },
    {
      key: "thanhTien",
      header: "T.tiền (đồng)",
      label: "Thành tiền",
      kind: "computed",
      minWidth: 136,
      // Dòng con đại lý: tiền THẬT của các chuyến (đơn giá hiện đã làm tròn).
      getValue: (h) => childRowAmount.get(h.id) ?? (h.total * (h.unitPrice ?? 0) || null),
    },
    { key: "tyLe", header: "Tỷ lệ", label: "Tỷ lệ phần trăm", kind: "input", minWidth: 72, getValue: (h) => h.ratio, isLocked: (h) => Boolean(h.priceRowOf) },
    ...dates.map<GridColumn<MaterialGridRow>>((iso) => ({
      key: `ngay:${iso}`,
      header: formatDayLabel(iso),
      label: `Ngày ${formatDateVN(iso)}`,
      kind: "input",
      group: DAY_COLUMN_GROUPS.days,
      minWidth: 88,
      getValue: (h) => h.dailyQuantities[iso] ?? null,
      // Hàng "Giá gửi": chỉ ngày đã gửi kg mới gõ được giá.
      isLocked: (h) => Boolean(h.priceRowOf) && !getOriginal(h.priceRowOf!)?.dailyQuantities?.[iso],
      lockReason: () => "Ngày này chưa gửi kg nào — gõ kg ở dòng Gửi đông trước rồi mới gõ giá.",
      // Ngay dưới số kg: "n chuyến" → đại lý/chuyến làm nên đúng ô này.
      renderCellNote: (h) => (h.priceRowOf ? null : <CellShipments imports={importRowsOf(h)} date={iso} lotCodes={lotCodes} />),
    })),
    ...(hasLegacyCarryOver
      ? [
          {
            key: "chuyenKy",
            header: "Chuyển kỳ (cũ)",
            label: "Chuyển kỳ (số cũ)",
            kind: "input",
            group: DAY_COLUMN_GROUPS.days,
            tint: "carry-over",
            minWidth: 112,
            getValue: (h) => h.carryOverKg || null,
          } satisfies GridColumn<MaterialGridRow>,
        ]
      : []),
    /* Ghi chú dòng (mig 0067) — cột GIÃN cuối lưới: các cột số co vừa nội dung, ghi chú ăn
       phần bề ngang còn lại (người dùng chốt 2026-10-16). Dòng con đại lý / loại: chỉ đọc. */
    {
      key: "ghiChu",
      header: "Ghi chú",
      label: "Ghi chú",
      kind: "input",
      fill: true,
      align: "left",
      minWidth: 160,
      getValue: () => null,
      renderValue: (h) => getOriginal(h.id)?.note ?? "",
      isLocked: (h) => !getOriginal(h.id),
      renderCell: (h) => {
        const original = getOriginal(h.id);
        return original ? (
          <RowNoteCell value={original.note ?? ""} rowLabel={h.name} onCommit={(note) => writeRow(h.id, { note })} />
        ) : null;
      },
    },
  ];

  /* Kỳ đã chốt ⇒ khoá TOÀN BỘ ô + gỡ ô điều khiển. Khoá ở một chỗ thay vì rải
     `disabled` khắp nơi: thêm cột mới về sau tự động được khoá theo. */
  const visibleColumns = canViewPrice ? gridColumns : gridColumns.filter((c) => !PRICE_COLUMN_KEYS.has(c.key));
  const displayColumns: GridColumn<MaterialGridRow>[] = grid.isLocked
    ? visibleColumns.map((c) => ({
        ...c,
        renderCell: undefined,
        isLocked: () => true,
        lockReason: () =>
          grid.isReadOnly
            ? "Bạn chỉ có quyền xem cân đối — cần sửa thì báo quản trị viên"
            : "Kỳ đã chốt — mở lại ở cuối màn mới sửa được",
      }))
    : visibleColumns;

  /* Gửi đông ⇄ còn dở khai ở Sản xuất: cả hai cùng ghi, màn đối chiếu. Gửi đông có
     số thì là số chuẩn của tồn kho đông; chưa có thì tồn tạm lấy còn dở SX. */
  const productionLeftover = stockRows?.productionLeftoverKg ?? 0;
  const balancingFreezeDeposit = stockRows?.balancingFreezeDepositKg ?? 0;
  const fillFromProduction = () => {
    const daily: DailyQuantities = {};
    for (const [iso, kg] of Object.entries(leftoverByDate)) if (kg) daily[iso] = -Math.abs(kg);
    // Bị từ chối (chưa chọn kho…) thì lỗi đã báo — KHÔNG báo "Đã ghi" chồng lên (lỗi 2026-10-16).
    if (!writeRow(freezeDepositGridRows[0].id, { dailyQuantities: daily })) return;
    notify.saved(`Đã ghi Gửi đông ${num(productionLeftover)} kg theo còn dở của sổ Sản xuất`);
  };

  /* Chọn ĐÍCH DANH lô để lấy / kho để gửi — gõ số là Sổ kho tháng đổi ngay theo lựa
     chọn này (cột xuất của lô · lô gửi đông theo ngày, xem lib/balancingStockLines.ts). Đổi lô khi
     đã có số ⇒ trả lô cũ, trừ lô mới; lô mới không đủ ⇒ chặn, không ghi gì. */
  const pickLot = (h: MaterialGridRow, lotId: string) => {
    const original = getOriginal(h.id);
    if (!original) return;
    const lot = grid.lotOptions([lotId]).find((x) => x.value === lotId);
    /* Giá lấy xả đông = đơn giá của lô (đúng giá vốn); lô chưa có giá thì giữ giá đang có,
       chưa có nữa thì lấy bình quân NL mua vào của kỳ — không để 700 kg xả đông mang giá 0
       kéo tụt giá thành (lỗi 2026-10-16). */
    writeRow(h.id, { stockLineId: lotId, unitPrice: lot?.price ?? original.unitPrice ?? avgMaterialPrice });
  };

  /* Dòng có kg mà chưa có giá ⇒ cảnh báo + giá gợi ý (lib/balancingGrid.suggestMaterialPrices). */
  const unpricedRows = useMemo(() => findUnpricedMaterialRows(materialRows), [materialRows]);
  const priceSuggestions = useMemo(
    () => suggestMaterialPrices(materialRows, grid.assignedImports),
    [materialRows, grid.assignedImports]
  );
  /** Dòng kho ghi kèm lô / kho (hai dòng "Lấy xả đông" khác lô không trùng tên). */
  const unpricedRowLabel = (h: MaterialGridRow) => {
    const original = h.stockLineKind ? getOriginal(h.id) : undefined;
    const detail = original ? grid.describeStockLine(original) : "";
    return detail ? `${h.name} (${detail})` : h.name;
  };
  const fillSuggestedPrices = () => {
    const ok = saveMaterials(
      materialInRows.map((r) => (priceSuggestions.has(r.id) ? { ...r, unitPrice: priceSuggestions.get(r.id)! } : r))
    );
    if (ok) notify.saved(`Đã điền giá gợi ý cho ${priceSuggestions.size} dòng nguyên liệu`, grid.undo);
  };

  /** Gửi đông: NGUYÊN LIỆU nào gửi (lưu ở `name` của dòng — tên lô trong Sổ kho tháng).
   *  Loại NL cùng họ với kỳ lên đầu. Chốt 2026-10-16. */
  const periodFamily = getMaterialFamily(grid.periodMaterialType);
  const depositMaterialOptions = useMemo(() => {
    const same = catalogMaterialTypes.filter((l) => getMaterialFamily(l.name) === periodFamily);
    const rest = catalogMaterialTypes.filter((l) => getMaterialFamily(l.name) !== periodFamily);
    return [...same, ...rest].map((l) => ({ value: l.name, label: l.name, subLabel: l.category || undefined }));
  }, [catalogMaterialTypes, periodFamily]);

  /* Ô kho nhãn tắt: "Kho 1000 tấn" ⇒ K1000, tên đủ ở dòng phụ (vẫn gõ tên đủ để tìm). */
  const shortLocationOptions = useMemo(
    () =>
      grid.depositLocationOptions.map((o) => ({
        ...o,
        label: shortWarehouseLabel(o.label),
        subLabel: o.subLabel ? `${o.label} · ${o.subLabel}` : o.label,
      })),
    [grid.depositLocationOptions]
  );
  /** Tên NL gửi của dòng; chưa chọn ⇒ tên họ NL của kỳ (mặc định). */
  const depositMaterialName = (original: BalancingInputItem | undefined) =>
    original && original.name !== BALANCING_STOCK_LINE_NAMES["freeze-deposit"] ? original.name : periodFamily;
  /** Bảng của Sổ kho tháng lô gửi vào: đã chọn ⇒ nhóm đó; dòng cũ ⇒ nhóm lô đã ghi; còn lại ⇒ mặc định. */
  const depositCategoryLabel = (rowId: string, original: BalancingInputItem | undefined) =>
    original?.stockCategory || grid.depositLotCategory(rowId) || DEFAULT_DEPOSIT_CATEGORY;
  const [depositRowId, setDepositRowId] = useState<string | null>(null);
  const saveDepositTarget = (rowId: string, v: DepositTargetValue) => {
    if (
      writeRow(rowId, {
        name: v.name.trim() && v.name.trim() !== periodFamily ? v.name.trim() : BALANCING_STOCK_LINE_NAMES["freeze-deposit"],
        stockCategory: v.category,
        stockLocation: v.stockLocation,
      })
    )
      notify.saved(`Đã lưu chỗ gửi: ${v.name || periodFamily} → ${v.category}`, grid.undo);
  };
  const depositDialogRow = depositRowId ? getOriginal(depositRowId) : undefined;
  /* Sổ kho của THÁNG lô gửi vào: tháng ngày gửi cuối của dòng; chưa gõ ngày ⇒ tháng ngày cuối kỳ. */
  const depositDialogMonth = useMemo(() => {
    const sentDates = Object.entries(depositDialogRow?.dailyQuantities ?? {})
      .filter(([, v]) => v)
      .map(([iso]) => iso)
      .sort();
    return (sentDates[sentDates.length - 1] ?? dates[dates.length - 1] ?? "").slice(0, 7);
  }, [depositDialogRow, dates]);

  /**
   * Lấy xả đông: giá gửi đã LƯU ở lô (kế toán yêu cầu 2026-10-19: giá lưu để biết, sửa được khi
   * lấy). Sửa đơn giá dòng lấy KHÔNG đổi giá lô; khác giá lô thì báo "đã sửa" + nút trả về.
   */
  const thawLotPriceNote = (h: MaterialGridRow, original: BalancingInputItem | undefined) => {
    const lotId = original?.stockLineId;
    const lotPrice = lotId ? (grid.lotOptions([lotId]).find((x) => x.value === lotId)?.price ?? null) : null;
    if (lotPrice == null) return null;
    if (h.unitPrice != null && Math.abs(h.unitPrice - lotPrice) < 0.5)
      return <span className="block">giá gửi lô {num(lotPrice)} đ/kg</span>;
    return (
      <span className="flex flex-wrap items-center gap-1">
        <Tag variant="warning">đã sửa · giá lô {num(lotPrice)} đ</Tag>
        <Button
          variant="outline"
          size="sm"
          onClick={() => writeRow(h.id, { unitPrice: lotPrice })}
          title="Đặt lại đơn giá dòng Lấy xả đông bằng giá gửi đã lưu ở lô."
        >
          Dùng giá lô
        </Button>
      </span>
    );
  };

  const stockRowSubtext = (h: MaterialGridRow, isGroupHead: boolean, isLast: boolean) => {
    const original = getOriginal(h.id);
    if (grid.isLocked) {
      const mt = original ? grid.describeStockLine(original) : "";
      return mt ? <span className="mt-0.5 block">{mt}</span> : undefined;
    }
    return (
      <span className="mt-1 block space-y-1">
        {h.stockLineKind === "thaw-out" ? (
          <>
            <Combobox
              label={`Lô lấy xả đông — ${h.name}`}
              hideLabel
              value={original?.stockLineId ?? ""}
              onChange={(v) => pickLot(h, v)}
              options={grid.lotOptions(original?.stockLineId ? [original.stockLineId] : [])}
              placeholder="Chọn lô"
              emptyText="Sổ kho tháng không còn lô nào có tồn."
              clearable={false}
            />
            {canViewPrice && thawLotPriceNote(h, original)}
          </>
        ) : (
          /* Gọn MỘT hàng (yêu cầu kế toán 2026-10-16): ô kho nhỏ nhãn tắt (K1000) đứng trước,
             rồi nút NL gửi → mở hộp "Gửi vào sổ kho" chọn bảng của Sổ kho tháng ngay tại đây. */
          <span className="flex items-center gap-1">
            <Combobox
              label={`Kho gửi đông — ${h.name}`}
              hideLabel
              className="max-w-32 shrink-0"
              value={original?.stockLocation ?? ""}
              onChange={(v) => writeRow(h.id, { stockLocation: v })}
              options={shortLocationOptions}
              placeholder="Kho"
              clearable={false}
            />
            <Button
              variant="outline"
              size="sm"
              className="min-w-0 flex-1 justify-start"
              onClick={() => setDepositRowId(h.id)}
              title="Chọn nguyên liệu gửi và bảng của Sổ kho tháng để gửi vào — xem sổ kho ngay tại đây. Giá gửi gõ theo ngày ở hàng Giá gửi ngay dưới."
            >
              <span className="truncate">
                {depositMaterialName(original)} → {depositCategoryLabel(h.id, original)}
              </span>
            </Button>
          </span>
        )}
        {/* Thêm dòng ngay dưới dòng kho cuối (trước chỉ có nút ở đáy lưới — người dùng không thấy). */}
        {isLast && h.stockLineKind === "thaw-out" && hasAllLots && (
          <Button
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={() => addStockRow("thaw-out")}
            title="Lấy xả đông thêm từ một lô khác — thêm một dòng Lấy xả đông nữa ngay dưới."
          >
            <Plus />
            Lấy thêm lô
          </Button>
        )}
        {isLast && h.stockLineKind === "freeze-deposit" && hasAllLocations && (
          <Button
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={() => addStockRow("freeze-deposit")}
            title="Gửi đông thêm vào kho khác / nguyên liệu khác — thêm một dòng Gửi đông nữa ngay dưới."
          >
            <Plus />
            Gửi thêm
          </Button>
        )}
        {h.stockLineKind === "freeze-deposit" && isGroupHead && productionLeftover > 0 && (
          <span className="inline-flex flex-wrap items-center gap-1">
            {balancingFreezeDeposit === 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={fillFromProduction}
                title="Điền dòng Gửi đông đúng từng ngày bằng số NL còn dở tổ trưởng khai khi chốt ngày ở Sản xuất."
              >
                Lấy {num(productionLeftover)} kg còn dở SX
              </Button>
            ) : balancingFreezeDeposit === productionLeftover ? (
              <Tag variant="done">khớp còn dở SX</Tag>
            ) : (
              <Tag variant="warning">
                SX còn dở {num(productionLeftover)} · lệch {num(balancingFreezeDeposit - productionLeftover)}
              </Tag>
            )}
          </span>
        )}
      </span>
    );
  };

  /** Thêm một dòng kho nữa (lấy thêm lô khác / gửi thêm kho khác). */
  const addStockRow = (lineKind: BalancingStockLineKind) => {
    if (saveMaterials([...materialInRows, { ...stockLineTemplate(lineKind), id: uid() }]))
      notify.saved(lineKind === "thaw-out" ? "Đã thêm dòng Lấy xả đông — chọn lô" : "Đã thêm dòng Gửi đông — chọn kho");
  };
  const hasAllLots = thawRows.length > 0 && thawRows.every((h) => getOriginal(h.id)?.stockLineId);
  const hasAllLocations = freezeDepositRows.length > 0 && freezeDepositRows.every((h) => getOriginal(h.id)?.stockLocation);

  /**
   * Hàng phụ "Giá gửi" dưới mỗi dòng Gửi đông (kế toán yêu cầu 2026-10-19: giá gửi THEO NGÀY,
   * gõ ngay trên bảng): ô ngày = giá gửi ngày đó, chỉ ngày đã gửi kg mới gõ được. Đang thu
   * cột ngày ⇒ không hiện (gõ ô Đơn giá của dòng = một giá cho mọi ngày).
   */
  const depositPriceGridRow = (h: MaterialGridRow): GridRow<MaterialGridRow> | null => {
    const original = getOriginal(h.id);
    if (!original || isDateColumnsCollapsed || !canViewPrice) return null;
    const prices: DailyQuantities = {};
    for (const [iso, kg] of Object.entries(original.dailyQuantities ?? {})) {
      const p = kg ? depositPriceOn(original, iso) : null;
      if (p != null) prices[iso] = p;
    }
    const id = priceRowId(h.id);
    return {
      id,
      data: { ...h, id, stockLineKind: null, priceRowOf: h.id, dailyQuantities: prices, total: 0, unitPrice: null, ratio: null, carryOverKg: 0, sourceIds: [] },
      label: "Giá gửi (đ/kg)",
      kind: "detail",
      // Ngắn: ở 360px cột tên dính trái hẹp, câu dài bị cắt (lô GĐ-ngày lưu giá — xem tooltip nút NL gửi).
      subLabel: grid.isLocked ? undefined : "Gõ giá từng ngày",
    };
  };

  const stockGridRows = (items: MaterialGridRow[]): GridRow<MaterialGridRow>[] =>
    items.flatMap((h, i) => {
      const row: GridRow<MaterialGridRow> = {
        id: h.id,
        data: h,
        /* Chuỗi (không JSX) để nhãn đọc của từng ô mang tên dòng. */
        label: h.name === BALANCING_STOCK_LINE_NAMES[h.stockLineKind!] ? h.name : `${BALANCING_STOCK_LINE_NAMES[h.stockLineKind!]} · ${h.name}`,
        kind: h.stockLineKind === "freeze-deposit" ? "decrease" : undefined,
        subLabel: stockRowSubtext(h, i === 0, i === items.length - 1),
      };
      const priceRow = h.stockLineKind === "freeze-deposit" ? depositPriceGridRow(h) : null;
      return priceRow ? [row, priceRow] : [row];
    });

  /* Không có dòng tiêu đề nhóm — bảng giấy cũng không: tên loại hàng tự nói nhóm
     ("x.đ Cò May", "Bột 24v"), dòng Giảm tô đỏ nhạt. Thứ tự vẫn theo nhóm. */
  const gridRows: GridRow<MaterialGridRow>[] = [...stockGridRows(thawGridRows)];
  for (const g of groupsWithRows) {
    for (const h of g.rows) {
      const rowImports = h.fromImports ? importRowsOf(h) : [];
      const suppliers = rowImports.length ? groupImportsBySupplier(rowImports) : [];
      /* Dòng gộp họ (VD "Bạch tuộc 2 da" = 2 da lớn + 2 da nhỏ) ⇒ vẫn mở ra theo ĐẠI LÝ (mỗi
         đại lý MỘT dòng), dưới tên đại lý ghi rõ phần từng loại: "2 da lớn 3.091 · 2 da nhỏ
         3.757" (người dùng chốt 2026-10-16 — không tách thêm dòng theo loại). */
      const types = rowImports.length ? groupImportsByMaterialType(rowImports) : [];
      const bySupplierOnly = types.length <= 1;
      const open = expandedSuppliers.has(h.id);
      gridRows.push({
        id: h.id,
        data: h,
        label: h.name,
        subLabel:
          suppliers.length > 0 ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggleSupplierOpen(h.id)}
              title={
                open
                  ? "Thu gọn các dòng chi tiết của loại này."
                  : bySupplierOnly
                    ? `Tách dòng này theo ${suppliers.length} đại lý — mỗi đại lý một dòng, kg theo từng ngày (chỉ xem).`
                    : `Tách dòng này theo ${types.length} loại (${types.map((t) => t.materialTypeName).join(", ")}), mỗi loại kèm đại lý — kg theo từng ngày (chỉ xem).`
              }
              className="mt-0.5 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden />
              {suppliers.length} đại lý{bySupplierOnly ? "" : ` · ${types.length} loại`}
            </button>
          ) : undefined,
      });
      if (!open) continue;
      /** Một dòng con chỉ xem (loại hoặc đại lý) — kg theo ngày, giá bình quân, tiền thật. */
      const pushChild = (
        id: string,
        label: string,
        d: { dailyAmounts: Record<string, number>; kg: number; amount: number; ids: string[] },
        subLabel?: string
      ) => {
        const childRow: MaterialGridRow = {
          ...h,
          id,
          name: label,
          dailyQuantities: d.dailyAmounts,
          total: d.kg,
          // Giá bình quân trong kỳ, làm tròn đồng; thành tiền lấy số thật.
          unitPrice: d.kg > 0 && d.amount > 0 ? Math.round(d.amount / d.kg) : null,
          ratio: null,
          carryOverKg: 0,
          sourceIds: d.ids,
        };
        childRowAmount.set(childRow.id, d.amount);
        gridRows.push({ id: childRow.id, data: childRow, label, kind: "child", subLabel });
      };
      /* Tên loại ngắn dưới tên đại lý: bỏ phần LOÀI đứng đầu tên dòng cha ("Bạch tuộc") —
         "Bạch tuộc 2 da lớn (80↑)" ⇒ "2 da lớn (80↑)". */
      const species = h.name.split(/\s+(?=\S*\d)/)[0] ?? "";
      const shortType = (t: string) =>
        species && t.toLowerCase().startsWith(species.toLowerCase() + " ") ? t.slice(species.length + 1) : t;
      for (const d of suppliers) {
        const parts = bySupplierOnly
          ? undefined
          : types
              .map((t) => ({ name: shortType(t.materialTypeName), kg: t.suppliers.find((x) => x.supplier === d.supplier)?.kg ?? 0 }))
              .filter((x) => x.kg !== 0)
              .map((x) => `${x.name} ${num(x.kg)}`)
              .join(" · ");
        pushChild(`${h.id}::dl::${d.supplier}`, d.supplier, d, parts);
      }
    }
  }
  if (reductionRows.length > 0) {
    for (const h of reductionRows) {
      gridRows.push({
        id: h.id,
        data: h,
        label: h.name,
        kind: "decrease",
        subLabel: isDomesticSale(h) ? domesticSaleSubtext(h) : WORKSHOP_WAREHOUSES.some((k) => k.id === h.decreaseTarget) ? undefined : (
          <Tag variant="error" className="mt-0.5">
            chưa chọn kho
          </Tag>
        ),
      });
    }
  }
  gridRows.push(...stockGridRows(freezeDepositGridRows));

  /* Dòng lệch tên + dòng đang thuộc kỳ khác đều chọn tay được từ một chỗ. */
  const pickableRows = useMemo(
    () => [...otherTypeImports, ...otherPeriodImports],
    [otherTypeImports, otherPeriodImports]
  );

  const materialTotalKg = materialRows.reduce((s, h) => s + h.total, 0);
  const totalAmount = materialRows.reduce((s, h) => s + h.total * (h.unitPrice ?? 0), 0);

  /** Gợi ý cho hộp thêm dòng: danh mục + tên các dòng đã có trong kỳ. */
  const typeSuggestions = useMemo(() => {
    const names = new Set<string>([
      ...catalogMaterialTypes.map((l) => l.name),
      ...materialRows.filter((h) => !h.isDecrease && !h.stockLineKind).map((h) => h.name),
    ]);
    return [...names].filter(Boolean).map((t) => ({ value: t, label: t }));
  }, [catalogMaterialTypes, materialRows]);

  /* Chẩn đoán sổ nhập — chỉ nói khi có việc cần làm (chuyến khác loại / thuộc kỳ khác);
     số "chờ lấy" đã nằm trên nút Lấy. */
  const diffReasons = [
    importDiagnosis.nameMismatchCount > 0 && `${importDiagnosis.nameMismatchCount} chuyến khác loại`,
    importDiagnosis.otherPeriodCount > 0 && `${importDiagnosis.otherPeriodCount} chuyến thuộc kỳ khác`,
  ].filter(Boolean);

  return (
    <section className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Nguyên liệu vào</h2>
        <div className="flex flex-wrap gap-2">
          {!grid.isReadOnly && importsToPull.length > 0 && (
            <Button
              title="Hút mọi dòng nhập nguyên liệu trong khoảng ngày của kỳ từ sổ nhập hàng vào lưới này." onClick={() => pullImports()}>
              <Download />
              Lấy {importsToPull.length} dòng từ sổ nhập
            </Button>
          )}
          {!grid.isLocked && !domesticSaleRow?.isReduction && productionDomesticSales.totalKg > 0 && (
            <Button
              title="Tạo dòng giảm Bán nội địa và điền đúng từng ngày bằng số tổ trưởng ghi ở màn Sản xuất thành phẩm (NL bán thẳng, không chế biến)."
              variant="outline"
              size="lg"
              onClick={fillDomesticSales}
            >
              <Download />
              Lấy bán nội địa từ SX ({num(productionDomesticSales.totalKg)} kg)
            </Button>
          )}
          {!grid.isReadOnly && pickableRows.length > 0 && (
            <Button
              title="Tự chọn từng dòng nhập muốn đưa vào kỳ, thay vì lấy hết." variant="outline" onClick={() => setIsImportPickerOpen(true)}>
              <ListChecks />
              Chọn dòng nhập ({pickableRows.length})
            </Button>
          )}
          {!grid.isLocked && mergeableGroups.length > 0 && (
            <Button
              title="Gộp các dòng cùng loại nguyên liệu lại thành một dòng cho gọn bảng." variant="outline" onClick={mergeSizes}>
              <Combine />
              Gộp cùng loại ({mergeableGroups.reduce((s, g) => s + g.length, 0)})
            </Button>
          )}
          <Button
            title="Ẩn / hiện các cột chia theo ngày. Ẩn đi thì bảng gọn, gõ thẳng cột Số lượng." variant="outline" onClick={onToggleDayColumns}>
            <ChevronsLeftRight />
            {isDateColumnsCollapsed ? "Mở cột ngày" : "Thu cột ngày"}
          </Button>
          {hasSupplierRows && (
            <Button
              variant="outline"
              aria-pressed={allSuppliersExpanded}
              title={
                allSuppliersExpanded
                  ? "Thu gọn mọi dòng đại lý — lưới về lại mỗi loại nguyên liệu một dòng."
                  : "Tách mọi loại nguyên liệu lấy từ sổ nhập theo đại lý — mỗi đại lý một dòng, kg theo từng ngày (chỉ xem)."
              }
              onClick={() => setExpandedSuppliers(allSuppliersExpanded ? new Set() : new Set(idsWithSupplier))}
            >
              <Users />
              {allSuppliersExpanded ? "Gộp đại lý" : "Tách theo đại lý"}
            </Button>
          )}
        </div>
      </div>

      {/* Màn trống phải nói được vì sao trống — nhưng chỉ nói khi có chuyện. */}
      {diffReasons.length > 0 && (
        <p className="mb-3 text-sm text-muted-foreground">
          Sổ nhập trong khoảng ngày còn {diffReasons.join(" · ")} — bấm “Chọn dòng nhập” nếu cần lấy.
        </p>
      )}
      {/* Sổ kho tháng bị sửa / nạp lại ngoài cân đối ⇒ phần lấy-gửi của kỳ không còn khớp. */}
      {grid.stockLedgerMismatches > 0 && !grid.isLocked && (
        <p className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-warning-surface px-4 py-2 text-sm font-medium text-destructive">
          ⚠ Sổ kho tháng lệch {grid.stockLedgerMismatches} chỗ so với dòng Lấy xả đông / Gửi đông của kỳ.
          <Button
            size="sm"
            variant="save"
            onClick={grid.resyncStockLedger}
            title="Ghi lại phần lấy xả đông / gửi đông của kỳ vào Sổ kho tháng cho khớp (có Hoàn tác)."
          >
            Ghi lại vào sổ kho
          </Button>
        </p>
      )}
      {canViewPrice && unpricedRows.length > 0 && (
        <p
          role="status"
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-warning-surface px-4 py-2 text-sm font-medium text-destructive"
        >
          ⚠ Chưa có đơn giá: {unpricedRows.map(unpricedRowLabel).join(" · ")} — giá trị NL, giá thành và lãi/lỗ đang tính
          thiếu phần này.
          {priceSuggestions.size > 0 && !grid.isLocked && !grid.isReadOnly && (
            <Button
              size="sm"
              onClick={fillSuggestedPrices}
              title="Điền giá gợi ý cho các dòng chưa có giá: dòng nhập gộp = bình quân gia quyền giá các chuyến; dòng xả đông / gửi đông = bình quân NL mua vào của kỳ. Sửa tay lại được, có Hoàn tác."
            >
              Điền giá gợi ý
            </Button>
          )}
        </p>
      )}
      {grid.overlappingPeriods.length > 0 && (
        <p className="mb-3 rounded-lg bg-warning-surface px-4 py-2 text-sm font-medium text-destructive">
          ⚠ Trùng ngày với kỳ {getMaterialFamily(grid.periodMaterialType)}{" "}
          {grid.overlappingPeriods.map((k) => k.dateRangeDescription || `${k.startDate} – ${k.endDate}`).join("; ")}
          {" "}— chuyến nhập những ngày đó đã thuộc kỳ kia.
        </p>
      )}
      {importDiagnosis.inRangeCount === 0 && dates.length > 0 && materialTotalKg === 0 && (
        <p className="mb-3 rounded-lg bg-warning-surface px-4 py-2 text-sm text-warning">
          Sổ nhập không có chuyến nào ngày {formatDayLabel(dates[0])}–{formatDayLabel(dates[dates.length - 1])} —
          kiểm lại ngày của kỳ (theo ngày hàng về xưởng).
        </p>
      )}

      <EditableGrid
        description="Lưới nguyên liệu vào theo ngày trong kỳ"
        rowHeaderLabel="Loại hàng"
        columns={displayColumns}
        rows={gridRows}
        rowMarkKey="can-doi-nl"
        collapsedGroups={collapsedDayGroups(isDateColumnsCollapsed)}
        onCellCommit={writeCell}
        onPasteBlock={pasteBlock}
        footer={
          <tr className="bg-muted font-semibold">
            <th
              scope="row"
              className="sticky left-0 z-10 border-t-2 border-r-2 border-border bg-muted px-4 py-3 text-left"
            >
              T. CỘNG
            </th>
            <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
              {num(materialTotalKg)}
            </td>
            {canViewPrice && (
              <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                {materialTotalKg > 0 ? num(Math.round(totalAmount / materialTotalKg)) : "—"}
              </td>
            )}
            {canViewPrice && (
              <td className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                {num(totalAmount)}
              </td>
            )}
            <td className="border-t-2 border-l border-border" />
            {!isDateColumnsCollapsed &&
              dates.map((iso) => (
                <td key={iso} className="tnum border-t-2 border-l border-border px-3 py-3 text-right">
                  {num(materialRows.reduce((s, h) => s + (h.dailyQuantities[iso] ?? 0), 0)) || "—"}
                </td>
              ))}
            {!isDateColumnsCollapsed && hasLegacyCarryOver && (
              <td className="tnum border-t-2 border-l border-border bg-warning-surface px-3 py-3 text-right">
                {num(materialRows.reduce((s, h) => s + h.carryOverKg, 0)) || "—"}
              </td>
            )}
            {/* ô dưới cột Ghi chú */}
            <td className="border-t-2 border-l border-border" />
          </tr>
        }
      />

      {!grid.isLocked && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            title="Thêm dòng xả đông hàng mua về (cấp đông ở kho khác). Xả đông hàng kho mình gõ thẳng vào dòng Lấy xả đông." variant="outline" onClick={() => setAddingGroup("Xả đông")}>
            <Plus />
            Xả đông mua về
          </Button>
          <Button
            title="Thêm dòng bột / phụ gia dùng trong kỳ." variant="outline" onClick={() => setAddingGroup("Bột phụ gia")}>
            <Plus />
            Bột phụ gia
          </Button>
          <Button
            title="Thêm một dòng giảm trừ nguyên liệu (bán nội địa, hao hụt, trả lại…)." variant="outline" onClick={() => setAddingGroup("decrease")}>
            <Plus />
            Dòng giảm
          </Button>
          {materialRows.some((h) => !h.fromImports) && (
            <Button
              title="Xoá dòng nhập tay hoặc đổi kho nhận của dòng giảm."
              variant="edit"
              onClick={() => setIsManualEditOpen(true)}
            >
              <Pencil />
              Sửa / xoá dòng tay
            </Button>
          )}
        </div>
      )}


      {isManualEditOpen && (
        <ManualRowsDialog
          rows={materialRows.filter((h) => !h.fromImports)}
          getRowName={(h) => (h.stockLineKind ? BALANCING_STOCK_LINE_NAMES[h.stockLineKind] : h.name)}
          workshopWarehouses={WORKSHOP_WAREHOUSES.map((k) => ({ value: k.id, label: k.name }))}
          hasWarehouse={(h) => !isDomesticSale(h)}
          onChangeWarehouse={(id, warehouse) => writeRow(id, { reductionWarehouseId: warehouse })}
          onDelete={allowed.delete ? removeRow : undefined}
          onClose={() => setIsManualEditOpen(false)}
        />
      )}

      {addingGroup && (
        <AddMaterialRowDialog
          isDecrease={addingGroup === "decrease"}
          title={addingGroup === "decrease" ? "Thêm dòng giảm" : `Thêm dòng ${addingGroup}`}
          suggestions={
            addingGroup === "decrease" && !domesticSaleRow
              ? [{ value: DOMESTIC_SALE_ROW_NAME, label: DOMESTIC_SALE_ROW_NAME }, ...typeSuggestions]
              : typeSuggestions
          }
          onCreateMaterialType={onAddMaterialType}
          materialTypeEdit={materialTypeEditor}
          onClose={() => setAddingGroup(null)}
          onSave={(names) => addRow(addingGroup, names)}
        />
      )}

      {isImportPickerOpen && (
        <PickImportRowsDialog
          imports={pickableRows}
          otherPeriodIds={new Set(otherPeriodImports.map((r) => r.id))}
          isSameFamily={grid.isPeriodFamily}
          periodMaterialType={getMaterialFamily(grid.periodMaterialType)}
          onClose={() => setIsImportPickerOpen(false)}
          onSave={(ids) => {
            pullImports(ids);
            setIsImportPickerOpen(false);
          }}
        />
      )}

      {depositRowId && depositDialogRow && (
        <DepositTargetDialog
          key={depositRowId}
          open
          onOpenChange={(o) => !o && setDepositRowId(null)}
          month={depositDialogMonth}
          groups={grid.depositTargetsFor(depositDialogMonth)}
          initial={{
            name: depositMaterialName(depositDialogRow),
            category: depositCategoryLabel(depositRowId, depositDialogRow),
            stockLocation: depositDialogRow.stockLocation || grid.defaultDepositLocation,
          }}
          materialOptions={depositMaterialOptions}
          locationOptions={shortLocationOptions}
          onCreateMaterial={onAddMaterialType}
          onEditMaterial={materialTypeEditor?.openEdit}
          canEditMaterial={materialTypeEditor?.canEdit}
          editMaterialLabel={materialTypeEditor?.editLabel}
          onSave={(v) => saveDepositTarget(depositRowId, v)}
        />
      )}
    </section>
  );
}
