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
  useMaterialImports,
  useMaterialOpeningStock,
  useMonthlyStock,
  useProductionLocks,
  useStorageLocations,
  useWipProductions,
} from "@/lib/catalogRepo";
import {
  listDepositLocationOptions,
  listThawLotOptions,
  syncMonthlyStockLedger,
  countMonthlyStockMismatches,
  splitDepositLocation,
  monthOfDate,
  type LotOption,
} from "@/lib/balancingStockLines";
import { sumLeftoverByDay, computeMaterialNxt, type MaterialPeriodNxtRow } from "@/lib/inventoryMaterial";
import { getPeriodDomesticSales, type PeriodDomesticSales } from "@/lib/domesticSales";

/** Một ô ngày cần ghi về sổ nguồn. */
export interface ONgay {
  /** Khoá dòng lưới: tên loại NL (khối 1) hoặc mặt hàng|quy cách (khối 2). */
  khoa: string;
  ngay: string;
  kg: number;
}

export interface PeriodGrid {
  kyId: string;
  ngay: string[];
  /* --- khối 1 --- */
  nlVao: BalancingInputItem[];
  hangNL: MaterialGridRow[];
  nhapDaGan: MaterialImportItem[];
  nhapChoHut: MaterialImportItem[];
  /** Dòng sổ nhập trong khoảng ngày nhưng KHÁC họ nguyên liệu — chọn tay. */
  nhapKhacLoai: MaterialImportItem[];
  /** Dòng trong khoảng ngày nhưng ĐANG thuộc kỳ khác — giải thích + kéo về. */
  nhapKyKhac: MaterialImportItem[];
  /** Tên loại NL của kỳ. */
  tenLoaiKy: string;
  /** Kỳ KHÁC cùng họ NL có khoảng ngày chồng lên kỳ này (tạo trùng kỳ). */
  kyTrungNgay: BalancingPeriod[];
  /** Dòng sổ nhập có cùng họ nguyên liệu với kỳ không (để hộp chọn tay chỉ tick sẵn dòng đúng loại). */
  cungHoKy: (r: MaterialImportItem) => boolean;
  /** Đếm để màn hình nói được vì sao trống. */
  chanDoanNhap: { tongTrongKhoang: number; chuaGan: number; kyKhac: number; lechTen: number };
  /** Ghi khối NL (kèm đồng bộ Sổ kho tháng cho 2 dòng kho). false = bị chặn (đã báo lỗi). */
  ghiNL: (rows: BalancingInputItem[]) => boolean;
  hutNhapHang: (ids?: string[]) => void;
  /** Ghi nhiều ô ngày về sổ Nhập hàng. Trả về false nếu bị từ chối. */
  ghiNhapNhieuNgay: (dsO: ONgay[]) => boolean;
  /** Tồn kho đông của họ NL này qua kỳ (tồn đầu · gửi đông · xả đông · tồn cuối) — sống theo từng phím gõ. */
  tonKhoDong: MaterialPeriodNxtRow | null;
  /** Còn dở SX theo ngày chốt trong kỳ (cùng họ) — đối chiếu / điền nhanh dòng Gửi đông. */
  conDoSXTheoNgay: DailyQuantities;
  /** Đơn giá dòng Gửi đông gần nhất (kỳ trước, cùng họ) — gợi ý giá cho Lấy xả đông. */
  giaGuiDongTruoc: number | null;
  /** Lô (Sổ kho tháng) để chọn ĐÍCH DANH cho dòng Lấy xả đông — tháng của ngày đầu kỳ. */
  luaChonLo: (selected: string[]) => LotOption[];
  /** Kho nhận cho dòng Gửi đông: "<sổ kho>|<vị trí>". */
  luaChonKhoGui: { value: string; label: string; phu?: string }[];
  /** Mô tả lô / kho của một dòng kho (bản in, nhãn). */
  moTaDongKho: (r: BalancingInputItem) => string;
  /** Số chỗ Sổ kho tháng lệch phần kho của kỳ (VD sổ bị nạp lại đè) — 0 là khớp. */
  lechSoKho: number;
  /** Ghi lại toàn bộ phần kho của kỳ vào Sổ kho tháng (sửa lệch). */
  ghiLaiSoKho: () => void;
  /** Bán nội địa tổ trưởng ghi ở /wip (sổ domestic_sales, mig 0054) trong kỳ, cùng họ —
   *  điền / đối chiếu dòng giảm "Bán nội địa". kg DƯƠNG theo ngày. */
  banNoiDiaSX: PeriodDomesticSales;
  /* --- khối 2 --- */
  tp: BalancingOutputItem[];
  hangTP: FinishedGoodGridRow[];
  sanXuatDaGan: WipProductionItem[];
  sanXuatChoHut: WipProductionItem[];
  ghiTP: (rows: BalancingOutputItem[]) => void;
  hutSanXuat: () => void;
  /** Kỳ làm mẫu cho khối 2 (kỳ gần nhất cùng họ NL có dòng) — null nếu chưa có. */
  kyMau: BalancingPeriod | null;
  /** Dòng mẫu CHƯA có trong kỳ — hiện ảo, gõ vào mới thành dòng thật. */
  mauConThieu: FinishedGoodTemplateRow[];
  /** Toàn bộ dòng mẫu (để so "giá = kỳ trước"). */
  mauTP: FinishedGoodTemplateRow[];
  /** Gợi ý khách · kênh · giá cho một mặt hàng mới vào kỳ (mẫu → kỳ gần nhất). */
  goiY: (productId: string, spec: string) => Pick<FinishedGoodTemplateRow, "customerId" | "channel" | "unitPrice"> | null;
  /** Hút cả sổ nhập + sổ sản xuất trong một chạm (KHÔNG đụng sổ bán). */
  hutTatCaNguon: () => void;
  ghiSanXuatNhieuNgay: (dsO: ONgay[], backdateReason: string) => boolean;
  ngayDaChot: Set<string>;
  /* --- chuyển kỳ --- */
  kyTruoc: BalancingPeriod | null;
  soDongChuyenKy: number;
  nhanChuyenKy: () => void;
  /* --- chốt kỳ --- */
  daChot: boolean;
  /* --- hoàn tác --- */
  hoanTacDuoc: boolean;
  lamLaiDuoc: boolean;
  hoanTac: () => void;
  lamLai: () => void;
  /* --- kết quả --- */
  kq: BalancingResult;
}

/** Ảnh chụp bốn bảng mà một kỳ có quyền đụng tới. */
interface MocLichSu {
  nhom: string;
  nl: BalancingInputItem[];
  tp: BalancingOutputItem[];
  nhap: MaterialImportItem[];
  sanXuat: WipProductionItem[];
  /** Sổ kho tháng — hai dòng kho ghi thẳng vào đây nên hoàn tác phải trả cả sổ. */
  kho: MonthlyStockLine[];
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
export function usePeriodGrid(ky: BalancingPeriod): PeriodGrid {
  const [allMaterialRows, writeAllMaterials, { trangThai: ttNL }] = useBalancingInputs();
  const [allOutputs, writeAllFinishedGoods, { trangThai: ttTP }] = useBalancingOutputs();
  const [allImports, writeAllImports, { trangThai: ttNhap }] = useMaterialImports();
  const [allWips, writeAllProductions, { trangThai: ttSanXuat }] = useWipProductions();
  const [productionLocks] = useProductionLocks();
  const [domesticSales] = useDomesticSales();
  const [allPeriods] = useBalancingPeriods();
  const [manualOpeningStock] = useMaterialOpeningStock();
  const [monthlyStock, writeStockLedger, { trangThai: ttSoKho }] = useMonthlyStock();
  const [storageLocations] = useStorageLocations();

  /** Kỳ đã chốt ⇒ mọi ô khoá, mọi nút ghi ẩn. Mở lại ở thanh cuối màn. */
  const isLocked = Boolean(ky.isLocked);

  const dates = useMemo(() => getPeriodDates(ky), [ky]);

  /* ---------- Ngăn xếp hoàn tác (Ctrl+Z / Ctrl+Y) ----------
     Người dùng đến từ Excel, ở đó Ctrl+Z lùi được MỌI thứ vừa làm chứ không chỉ
     ô số. Nút "Hoàn tác" trên toast vẫn còn cho người dùng chuột; hai đường
     cùng khôi phục từ ảnh chụp nên không đá nhau.

     Gộp theo `nhom`: gõ liên tiếp vào CÙNG một ô chỉ tạo MỘT mốc, nếu không mỗi
     phím là một bước lùi và Ctrl+Z thành vô dụng. */
  const lui = useRef<MocLichSu[]>([]);
  const redoStack = useRef<MocLichSu[]>([]);
  /* `lui`/`tien` là ref (không gây render, không được đọc lúc render), nên
     số mốc được chép sang state sau mỗi lần đổi để nút Hoàn tác / Làm lại
     bật-tắt đúng lúc. */
  const [demLichSu, setDemLichSu] = useState({ lui: 0, tien: 0 });
  const syncHistoryCount = useCallback(
    () => setDemLichSu({ lui: lui.current.length, tien: redoStack.current.length }),
    []
  );

  const snapshotCurrent = useCallback(
    (nhom: string): MocLichSu => ({
      nhom,
      nl: allMaterialRows,
      tp: allOutputs,
      nhap: allImports,
      sanXuat: allWips,
      kho: monthlyStock,
    }),
    [allMaterialRows, allOutputs, allImports, allWips, monthlyStock]
  );

  /** Đánh dấu "trước khi đổi" — gọi TRƯỚC mọi lần ghi. */
  const saveCheckpoint = useCallback(
    (nhom: string) => {
      if (!nhom) return; // ghi tự động (đồng bộ tổng) — không phải việc người dùng làm
      const topSnapshot = lui.current[lui.current.length - 1];
      if (topSnapshot && topSnapshot.nhom === nhom) return; // gõ tiếp cùng ô — không tạo mốc mới
      lui.current.push(snapshotCurrent(nhom));
      if (lui.current.length > MAX_HISTORY_STEPS) lui.current.shift();
      redoStack.current = [];
      syncHistoryCount();
    },
    [snapshotCurrent, syncHistoryCount]
  );

  const apMoc = useCallback(
    (m: MocLichSu) => {
      writeAllMaterials(m.nl);
      writeAllFinishedGoods(m.tp);
      writeAllImports(m.nhap);
      writeAllProductions(m.sanXuat);
      if (m.kho !== monthlyStock) writeStockLedger(m.kho);
    },
    [writeAllMaterials, writeAllFinishedGoods, writeAllImports, writeAllProductions, writeStockLedger, monthlyStock]
  );

  const undo = useCallback(() => {
    const m = lui.current.pop();
    if (!m) return;
    redoStack.current.push(snapshotCurrent(m.nhom));
    apMoc(m);
    syncHistoryCount();
    notify.saved("Đã hoàn tác");
  }, [apMoc, snapshotCurrent, syncHistoryCount]);

  const redo = useCallback(() => {
    const m = redoStack.current.pop();
    if (!m) return;
    lui.current.push(snapshotCurrent(m.nhom));
    apMoc(m);
    syncHistoryCount();
    notify.saved("Đã làm lại");
  }, [apMoc, snapshotCurrent, syncHistoryCount]);

  /* Repo trả về dòng của MỌI kỳ. Ghi mà quên ghép lại với kỳ khác = xoá sạch
     các kỳ đó (xem 04-tang-du-lieu.md). Bọc một lần ở đây. */
  const materialInRows = useMemo(() => allMaterialRows.filter((r) => r.periodId === ky.id), [allMaterialRows, ky.id]);
  const finishedGoods = useMemo(() => allOutputs.filter((r) => r.periodId === ky.id), [allOutputs, ky.id]);

  /* Nhãn kỳ + họ NL để ghi vết / đặt tên lô gửi đông trong Sổ kho tháng. */
  const ngucanh = useMemo(
    () => ({
      nhanKy: `${ky.materialTypeName} ${ky.dateRangeDescription ?? ""}`.trim(),
      hoNL: getMaterialFamily(ky.materialTypeName),
    }),
    [ky.materialTypeName, ky.dateRangeDescription]
  );

  /* MỘT chốt cho mọi lần ghi khối NL (gõ ô, dán khối, xoá dòng, gộp…): hai dòng kho
     (Lấy xả đông / Gửi đông) ghi THẲNG vào Sổ kho tháng theo kiểu đặt giá trị — xem
     lib/balancingStockLines.ts. Sổ kho từ chối (vượt tồn lô, chưa chọn lô/kho) ⇒ KHÔNG ghi gì. */
  const writeMaterials = useCallback(
    (rows: BalancingInputItem[], nhom = "nl"): boolean => {
      const kq = syncMonthlyStockLedger(monthlyStock, materialInRows, rows, ngucanh);
      if (kq.loi) {
        notify.error(kq.loi);
        return false;
      }
      saveCheckpoint(nhom);
      writeAllMaterials([...allMaterialRows.filter((r) => r.periodId !== ky.id), ...rows]);
      if (kq.doi) writeStockLedger(kq.lines);
      if (kq.keThua > 0)
        notify.saved(`Sổ kho tháng: đã tự kế thừa ${kq.keThua} dòng tồn sang tháng mới`);
      return true;
    },
    [writeAllMaterials, allMaterialRows, ky.id, saveCheckpoint, monthlyStock, materialInRows, ngucanh, writeStockLedger]
  );
  const writeFinishedGoods = useCallback(
    (rows: BalancingOutputItem[], nhom = "tp") => {
      saveCheckpoint(nhom);
      writeAllFinishedGoods([...allOutputs.filter((r) => r.periodId !== ky.id), ...rows]);
    },
    [writeAllFinishedGoods, allOutputs, ky.id, saveCheckpoint]
  );

  /* ---------- Sổ Nhập hàng ---------- */

  const assignedImports = useMemo(
    () => allImports.filter((r) => r.balancingPeriodId === ky.id),
    [allImports, ky.id]
  );
  const importsToPull = useMemo(
    () => filterEligibleImports(ky, allImports).filter((r) => !r.balancingPeriodId),
    [ky, allImports]
  );
  /* Khớp theo tên loại NL hay trượt vì sổ nhập ghi tên tự do. Giữ sẵn danh sách
     "trong khoảng ngày nhưng khác loại" để người dùng tự tick, thay vì màn hình
     báo "không có gì để lấy" trong khi sổ đầy số. */
  const otherTypeImports = useMemo(() => {
    const suggestedIds = new Set(importsToPull.map((r) => r.id));
    return filterFreeImportsInPeriod(ky, allImports).filter((r) => !suggestedIds.has(r.id));
  }, [ky, allImports, importsToPull]);

  /* Dòng đang bị kỳ KHÁC giữ. Không đếm được nhóm này thì khi người dùng lỡ hút
     vào nhầm kỳ, mọi kỳ sau chỉ thấy màn trống và không có manh mối nào. */
  const otherPeriodImports = useMemo(
    () =>
      filterAllImportsInPeriod(ky, allImports).filter(
        (r) => r.balancingPeriodId && r.balancingPeriodId !== ky.id
      ),
    [ky, allImports]
  );

  const overlappingPeriods = useMemo(
    () => findOverlappingFamilyPeriods(ky, allPeriods) as BalancingPeriod[],
    [ky, allPeriods]
  );
  const isSamePeriodFamily = useCallback(
    (r: MaterialImportItem) => isSameMaterialFamily(r.materialTypeName, ky.materialTypeName),
    [ky.materialTypeName]
  );

  const importDiagnosis = useMemo(() => {
    const trong = filterAllImportsInPeriod(ky, allImports);
    return {
      tongTrongKhoang: trong.length,
      chuaGan: importsToPull.length,
      kyKhac: otherPeriodImports.length,
      lechTen: otherTypeImports.length,
    };
  }, [ky, allImports, importsToPull, otherPeriodImports, otherTypeImports]);

  const pullImports = useCallback(
    (ids?: string[]) => {
      /* Có `ids` = người dùng tự tick, kể cả dòng đang thuộc kỳ khác ⇒ KÉO VỀ
         kỳ này. Không có `ids` = lấy tự động, chỉ đụng dòng chưa kỳ nào giữ. */
      const selectedIds = ids
        ? allImports.filter((r) => ids.includes(r.id) && r.balancingPeriodId !== ky.id)
        : importsToPull;
      if (selectedIds.length === 0) return;
      const prevImports = allImports;
      const prevMaterials = allMaterialRows;
      saveCheckpoint(`hut-nhap:${selectedIds.length}:${selectedIds[0].id}`);
      const bo = new Set(selectedIds.map((r) => r.id));
      writeAllImports(
        allImports.map((r) => (bo.has(r.id) ? { ...r, balancingPeriodId: ky.id } : r))
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
          periodId: ky.id,
          groupName: "Thủy sản",
          name: materialType,
          quantityKg: Object.values(o.theoNgay).reduce((s, v) => s + v, 0),
          unitPrice: o.donGia,
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
    [allImports, importsToPull, allMaterialRows, materialInRows, assignedImports, writeAllImports, writeAllMaterials, writeMaterials, saveCheckpoint, ky.id]
  );

  /**
   * Ghi nhiều ô ngày về sổ Nhập hàng trong MỘT lần. Khoá dòng là TÊN loại
   * nguyên liệu vì sổ nhập lưu theo tên (xem 30-nhap-hang.md).
   */
  const writeImportsMultiDay = useCallback(
    (dsO: ONgay[]): boolean => {
      if (dsO.length === 0) return true;
      const edits = new Map<string, number>();
      const toAdd: MaterialImportItem[] = [];
      let current = assignedImports;
      for (const o of dsO) {
        // Dòng lưới mang tên HỌ (lớn/nhỏ gộp) ⇒ tìm chuyến nhập theo HỌ; sửa ô
        // ngày gộp sẽ chỉnh chuyến size cuối cùng của ngày cho khớp tổng.
        const sameDayRows = current.filter(
          (r) => getMaterialFamily(r.materialTypeName) === o.khoa && r.deliveryDate === o.ngay
        );
        const kq = writeBackDailyImport(sameDayRows, o.kg);
        if (kq.loai === "tuChoi") {
          notify.error(kq.lyDo);
          return false;
        }
        if (kq.loai === "sua") {
          edits.set(kq.id, kq.kg);
          current = current.map((r) => (r.id === kq.id ? { ...r, quantityKg: kq.kg } : r));
        } else {
          if (kq.kg === 0) continue;
          const template = assignedImports.find((r) => getMaterialFamily(r.materialTypeName) === o.khoa);
          const created: MaterialImportItem = {
            id: uid(),
            shipmentId: "",
            deliveryDate: o.ngay,
            workshop: template?.workshop ?? "Đông",
            category: template?.category ?? "Khác",
            supplierName: template?.supplierName ?? "",
            // Giữ tên size của chuyến mẫu để sổ Nhập hàng vẫn có size; chưa có mẫu
            // (thêm ngày mới) thì đành dùng tên họ.
            materialTypeName: template?.materialTypeName ?? o.khoa,
            quantityKg: kq.kg,
            unitPrice: template?.unitPrice ?? null,
            driverName: "",
            licensePlate: "",
            note: "Ghi từ lưới cân đối",
            balancingPeriodId: ky.id,
          };
          toAdd.push(created);
          current = [...current, created];
        }
      }
      if (edits.size === 0 && toAdd.length === 0) return true;
      const prevRows = allImports;
      /* Gõ tiếp vào cùng một ô ⇒ cùng nhóm ⇒ một bước lùi cho cả lần gõ. */
      saveCheckpoint(
        dsO.length === 1 ? `nhap:${dsO[0].khoa}:${dsO[0].ngay}` : `nhap-khoi:${dsO.length}`
      );
      writeAllImports([
        ...allImports.map((r) => {
          const kg = edits.get(r.id);
          return kg == null ? r : { ...r, quantityKg: kg };
        }),
        ...toAdd,
      ]);
      notify.saved(
        dsO.length === 1
          ? `Đã ghi ${num(dsO[0].kg)} kg ngày ${formatDateVN(dsO[0].ngay)} vào sổ nhập hàng`
          : `Đã ghi ${dsO.length} ô vào sổ nhập hàng`,
        () => writeAllImports(prevRows)
      );
      return true;
    },
    [assignedImports, allImports, writeAllImports, saveCheckpoint, ky.id]
  );

  /* ---------- Sổ Sản xuất ---------- */

  const assignedWips = useMemo(
    () => allWips.filter((r) => r.balancingPeriodId === ky.id),
    [allWips, ky.id]
  );
  const pendingWips = useMemo(
    () => filterEligibleWips(ky, allWips).filter((r) => !r.balancingPeriodId),
    [ky, allWips]
  );

  /* ---------- Dòng mẫu khối 2 (A) + gợi ý khách/giá (B) ---------- */
  const templatePeriod = useMemo(() => (isLocked ? null : pickTemplatePeriod(ky, allPeriods, allOutputs)), [isLocked, ky, allPeriods, allOutputs]);
  const finishedGoodTemplates = useMemo(
    () => (templatePeriod ? buildFinishedGoodTemplateRows(allOutputs.filter((r) => r.periodId === templatePeriod.id)) : []),
    [templatePeriod, allOutputs]
  );
  const missingTemplates = useMemo(() => findMissingTemplateRows(finishedGoodTemplates, finishedGoods), [finishedGoodTemplates, finishedGoods]);
  const goiY = useCallback(
    (productId: string, spec: string) => suggestCustomerPrice(productId, spec, finishedGoodTemplates, allOutputs, allPeriods, ky.id),
    [finishedGoodTemplates, allOutputs, allPeriods, ky.id]
  );

  const pullProduction = useCallback(() => {
    if (pendingWips.length === 0) return;
    const prevProduction = allWips;
    const prevFinishedGoods = allOutputs;
    saveCheckpoint(`hut-sx:${pendingWips.length}:${pendingWips[0].id}`);
    const bo = new Set(pendingWips.map((r) => r.id));
    writeAllProductions(
      allWips.map((r) => (bo.has(r.id) ? { ...r, balancingPeriodId: ky.id } : r))
    );
    const existing = new Set(
      finishedGoods
        .filter((r) => r.autoSource === "production")
        .map((r) => productSpecKey(r.productId, r.spec ?? ""))
    );
    const toAdd: BalancingOutputItem[] = [];
    for (const [khoa, o] of groupWipsByProduct([...assignedWips, ...pendingWips])) {
      if (existing.has(khoa)) continue;
      const [productId, spec] = khoa.split("|");
      /* (B) Khách · kênh · giá lấy theo dòng mẫu / kỳ gần nhất — trước đây để trống
         nên kỳ nào cũng phải chọn khách + gõ giá lại từ đầu. Không có gợi ý ⇒ trống. */
      const g = goiY(productId, spec ?? "");
      toAdd.push({
        id: uid(),
        periodId: ky.id,
        productId,
        customerId: g?.customerId ?? "",
        channel: g?.channel ?? "Xuất khẩu",
        quantityKg: Object.values(o.theoNgay).reduce((s, v) => s + v, 0),
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
    ky.id,
    goiY,
  ]);

  /* Một chạm kéo CẢ HAI nguồn tự động (nhập + sản xuất) vào kỳ. KHÔNG gộp sổ bán
     — bán là seam đầu ra thay thế, kéo nhầm sẽ sai nguồn. Chỉ một nguồn có dòng
     thì uỷ thẳng cho hàm chuyên trách (giữ nguyên toast + undo của nó); cả hai
     thì chạy tuần tự — bốn bảng ghi RỜI nhau nên số không đè, Ctrl+Z một lần
     trả cả hai vì ảnh chụp lấy trước cả hai thao tác. */
  const pullAllSources = useCallback(() => {
    const hasImports = importsToPull.length > 0;
    const hasProduction = pendingWips.length > 0;
    if (hasImports) pullImports();
    if (hasProduction) pullProduction();
  }, [importsToPull.length, pendingWips.length, pullImports, pullProduction]);

  const lockedDates = useMemo(
    () => new Set(productionLocks.filter((c) => c.isLocked).map((c) => c.lockDate)),
    [productionLocks]
  );

  const writeProductionsMultiDay = useCallback(
    (dsO: ONgay[], backdateReason: string): boolean => {
      if (dsO.length === 0) return true;
      const edits = new Map<string, number>();
      const toAdd: WipProductionItem[] = [];
      let current = assignedWips;
      for (const o of dsO) {
        const [productId, quyCach = ""] = o.khoa.split("|");
        const sameDayRows = current.filter(
          (r) =>
            r.productId === productId && r.spec === quyCach && r.productionDate === o.ngay
        );
        const kq = writeBackDailyOutput(sameDayRows, o.kg);
        if (kq.loai === "tuChoi") {
          notify.error(kq.lyDo);
          return false;
        }
        if (kq.loai === "sua") {
          edits.set(kq.id, kq.kg);
          current = current.map((r) => (r.id === kq.id ? { ...r, quantityKg: kq.kg } : r));
        } else {
          if (kq.kg === 0) continue;
          const created: WipProductionItem = {
            id: uid(),
            productionDate: o.ngay,
            postingDate: todayISO(),
            backdateReason,
            workshop: "Đông",
            productId,
            spec: quyCach,
            quantityKg: kq.kg,
            blocksCount: 0,
            warehouse: "",
            status: "cho-nhap",
            note: "Ghi từ lưới cân đối",
            balancingPeriodId: ky.id,
          };
          toAdd.push(created);
          current = [...current, created];
        }
      }
      if (edits.size === 0 && toAdd.length === 0) return true;
      const prevRows = allWips;
      saveCheckpoint(dsO.length === 1 ? `sx:${dsO[0].khoa}:${dsO[0].ngay}` : `sx-khoi:${dsO.length}`);
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
        dsO.length === 1
          ? `Đã ghi ${num(dsO[0].kg)} kg ngày ${formatDateVN(dsO[0].ngay)} vào sổ sản xuất`
          : `Đã ghi ${dsO.length} ô vào sổ sản xuất`,
        () => writeAllProductions(prevRows)
      );
      return true;
    },
    [assignedWips, allWips, writeAllProductions, saveCheckpoint, ky.id]
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
        return h && h.tong !== r.quantityKg ? { ...r, quantityKg: h.tong } : r;
      }),
    [materialInRows, materialRows]
  );
  const finishedGoodsToCalc = useMemo(
    () =>
      finishedGoods.map((r) => {
        const h = finishedGoodRows.find((x) => x.id === r.id);
        return h && h.tong !== r.quantityKg ? { ...r, quantityKg: h.tong } : r;
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
  const materialSourcesReady = ttNL === "san-sang" && ttNhap === "san-sang" && ttSoKho === "san-sang";
  const finishedGoodSourcesReady = ttTP === "san-sang" && ttSanXuat === "san-sang";
  useEffect(() => {
    if (isLocked || !materialSourcesReady) return;
    if (materialsForCalc.some((r, i) => r !== materialInRows[i])) writeMaterials(materialsForCalc, "");
  }, [materialsForCalc, materialInRows, writeMaterials, isLocked, materialSourcesReady]);
  useEffect(() => {
    if (isLocked || !finishedGoodSourcesReady) return;
    if (finishedGoodsToCalc.some((r, i) => r !== finishedGoods[i])) writeFinishedGoods(finishedGoodsToCalc, "");
  }, [finishedGoodsToCalc, finishedGoods, writeFinishedGoods, isLocked, finishedGoodSourcesReady]);

  /* Phế liệu không còn là đầu vào của kỳ (xem 31-can-doi-ky.md) — truyền []. */
  const kq = useMemo(
    () => calculateBalancing(ky, materialsForCalc, [], finishedGoodsToCalc),
    [ky, materialsForCalc, finishedGoodsToCalc]
  );

  /* ---------- Kho đông: dòng Lấy xả đông / Gửi đông ---------- */

  /* Cùng engine với sổ /nxt-nl (computeMaterialNxt) — gõ vào hai dòng kho là tồn đổi
     ngay, không có bản sao số nào phải đồng bộ. Nhập tươi không cần ở đây ⇒ []. */
  const stockRows = useMemo(
    () =>
      computeMaterialNxt(allPeriods, allMaterialRows, [], manualOpeningStock, productionLocks).find(
        (r) => r.periodId === ky.id
      ) ?? null,
    [allPeriods, allMaterialRows, manualOpeningStock, productionLocks, ky.id]
  );
  const productionLeftoverByDate = useMemo(() => sumLeftoverByDay(productionLocks, ky), [productionLocks, ky]);
  const periodDomesticSales = useMemo(() => getPeriodDomesticSales(domesticSales, ky), [domesticSales, ky]);

  const prevFreezePrice = useMemo(() => {
    const ho = getMaterialFamily(ky.materialTypeName);
    const kyTheoId = new Map(allPeriods.map((k) => [k.id, k]));
    let latest: { ngay: string; gia: number } | null = null;
    for (const r of allMaterialRows) {
      if (r.periodId === ky.id || r.unitPrice == null || getBalancingStockLineKind(r) !== "gui-dong") continue;
      const k = kyTheoId.get(r.periodId);
      if (!k || getMaterialFamily(k.materialTypeName) !== ho) continue;
      const d = k.endDate || k.startDate || "";
      if (ky.startDate && d >= ky.startDate) continue;
      if (!latest || d > latest.ngay) latest = { ngay: d, gia: r.unitPrice };
    }
    return latest?.gia ?? null;
  }, [allMaterialRows, allPeriods, ky.id, ky.materialTypeName, ky.startDate]);

  /* Sổ kho tháng: lô để Lấy xả đông (tháng của ngày đầu kỳ; tháng chưa mở ⇒ xem trước
     phần kế thừa) + kho nhận để Gửi đông + kiểm khớp. */
  const periodMonth = monthOfDate(dates[0] ?? ky.startDate ?? "");
  const selectLot = useCallback(
    (selected: string[]) => (periodMonth ? listThawLotOptions(monthlyStock, periodMonth, ngucanh.hoNL, selected) : []),
    [monthlyStock, periodMonth, ngucanh.hoNL]
  );
  const storageOptions = useMemo(
    () =>
      listDepositLocationOptions(
        monthlyStock,
        BSF1_WAREHOUSES.filter((w) => w.type === "xi-nghiep").map((w) => w.name),
        storageLocations.map((k) => k.name)
      ),
    [monthlyStock, storageLocations]
  );
  const describeStockLine = useCallback(
    (r: BalancingInputItem) => {
      if (r.stockLineId) {
        const lo = selectLot([r.stockLineId]).find((x) => x.value === r.stockLineId);
        return lo ? lo.label : "lô đã chọn không còn trong sổ kho";
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
    const kq = syncMonthlyStockLedger(monthlyStock, [], materialInRows, ngucanh);
    if (kq.loi) {
      notify.error(kq.loi);
      return;
    }
    if (!kq.doi) return;
    saveCheckpoint(`ghi-lai-so-kho:${ky.id}`);
    writeStockLedger(kq.lines);
    notify.saved("Đã ghi lại phần lấy xả đông / gửi đông của kỳ vào Sổ kho tháng", () =>
      writeStockLedger(prevRows)
    );
  }, [monthlyStock, materialInRows, ngucanh, saveCheckpoint, ky.id, writeStockLedger]);

  /* ---------- Chuyển kỳ từ kỳ liền trước ---------- */

  const prevPeriod = useMemo(() => findPreviousPeriod(ky, allPeriods), [ky, allPeriods]);

  const materialCarryOver = useMemo(() => {
    if (!prevPeriod) return [];
    const dong = allMaterialRows.filter((r) => r.periodId === prevPeriod.id);
    return listPendingCarryOvers(dong, (r) => r.name);
  }, [prevPeriod, allMaterialRows]);

  const finishedGoodCarryOver = useMemo(() => {
    if (!prevPeriod) return [];
    const dong = allOutputs.filter((r) => r.periodId === prevPeriod.id);
    return listPendingCarryOvers(dong, (r) => r.productId);
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

    const receivedMaterialIds = new Set(materialCarryOver.map((d) => d.nguonId));
    const materialsToAdd: BalancingInputItem[] = materialCarryOver.map((d) => ({
      id: uid(),
      periodId: ky.id,
      /* Hàng kỳ trước cất kho, kỳ này lấy ra dùng ⇒ đúng nhóm Xả đông. */
      groupName: "Xả đông",
      name: d.ten,
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

    const receivedFinishedIds = new Set(finishedGoodCarryOver.map((d) => d.nguonId));
    const finishedGoodTemplates = new Map(allOutputs.map((r) => [r.id, r]));
    const finishedGoodsToAdd: BalancingOutputItem[] = finishedGoodCarryOver.map((d) => {
      const template = finishedGoodTemplates.get(d.nguonId);
      return {
        id: uid(),
        periodId: ky.id,
        productId: d.ten,
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
        receivedMaterialIds.has(r.id) ? { ...r, carryOverPeriodId: ky.id } : r
      ),
      ...materialsToAdd,
    ]);
    writeAllFinishedGoods([
      ...allOutputs.map((r) =>
        receivedFinishedIds.has(r.id) ? { ...r, carryOverPeriodId: ky.id } : r
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
  }, [prevPeriod, materialCarryOver, finishedGoodCarryOver, allMaterialRows, allOutputs, writeAllMaterials, writeAllFinishedGoods, saveCheckpoint, ky.id]);

  return {
    kyId: ky.id,
    ngay: dates,
    nlVao: materialInRows,
    hangNL: materialRows,
    nhapDaGan: assignedImports,
    nhapChoHut: importsToPull,
    nhapKhacLoai: otherTypeImports,
    nhapKyKhac: otherPeriodImports,
    tenLoaiKy: ky.materialTypeName,
    kyTrungNgay: overlappingPeriods,
    cungHoKy: isSamePeriodFamily,
    chanDoanNhap: importDiagnosis,
    ghiNL: writeMaterials,
    hutNhapHang: pullImports,
    ghiNhapNhieuNgay: writeImportsMultiDay,
    tonKhoDong: stockRows,
    conDoSXTheoNgay: productionLeftoverByDate,
    giaGuiDongTruoc: prevFreezePrice,
    luaChonLo: selectLot,
    luaChonKhoGui: storageOptions,
    moTaDongKho: describeStockLine,
    lechSoKho: stockLedgerDiff,
    ghiLaiSoKho: rewriteStockLedger,
    banNoiDiaSX: periodDomesticSales,
    tp: finishedGoods,
    hangTP: finishedGoodRows,
    sanXuatDaGan: assignedWips,
    sanXuatChoHut: pendingWips,
    ghiTP: writeFinishedGoods,
    hutSanXuat: pullProduction,
    kyMau: templatePeriod,
    mauConThieu: missingTemplates,
    mauTP: finishedGoodTemplates,
    goiY,
    hutTatCaNguon: pullAllSources,
    ghiSanXuatNhieuNgay: writeProductionsMultiDay,
    ngayDaChot: lockedDates,
    kyTruoc: prevPeriod,
    soDongChuyenKy: materialCarryOver.length + finishedGoodCarryOver.length,
    nhanChuyenKy: receiveCarryOver,
    daChot: isLocked,
    hoanTacDuoc: demLichSu.lui > 0,
    lamLaiDuoc: demLichSu.tien > 0,
    hoanTac: undo,
    lamLai: redo,
    kq,
  };
}
