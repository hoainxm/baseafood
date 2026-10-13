// ============================================================
// Tên file: src/features/monthly-stock/MonthlyStockScreen.tsx
// Tên tiếng Việt: Sổ kho theo THÁNG — dồn tồn cuối kỳ → đầu kỳ sau
// Description: Monthly stock ledger — carry closing balance into next month
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MonthlyStockLine, MaterialType, Product } from "@/types";
import { MONTHLY_STOCK_CATEGORIES, BSF1_WAREHOUSES, STORAGE_KIND_LABELS } from "@/types";
import { useMonthlyStock, useMaterialTypes, useProducts, useStorageLocations } from "@/lib/catalogRepo";
import { uid } from "@/lib/db";
import { chuan0, num, formatDateVN } from "@/lib/format";
import {
  parseStockStatementFile,
  parseYearFromFileName,
  parseWarehouseFromTitle,
  findWarehouseByText,
  buildNewWarehouseName,
  toWarehouseKey,
  idDongNap,
  ghepNapLai,
  type StockStatementSheet,
} from "@/lib/monthlyStockExcel";
import {
  suyDong,
  sumMonthlyStockRows,
  groupByCategory,
  buildCarryForwardLines,
  carryForwardIntoLedger,
  listMonths,
  getCurrentMonth,
  getPrevMonth,
  getNextMonth,
  formatMonthLabel,
  measureCarryForwardGap,
  hasCarryForwardGap,
  compareCarryForward,
  analyzeCatalogSync,
  inferMaterialCategory,
  stockLineKey,
  buildProductStockCard,
  isEmptyLine,
  applyLotAction,
  type LotActionKind,
  type MonthlyStockRow,
  type CarryForwardDiff,
  type CatalogTarget,
  type CatalogSyncItem,
} from "@/lib/monthlyStock";
import {
  HorizontalScroll,
  SummaryTable,
  Button,
  RequiredLegend,
  Combobox,
  ConfirmDelete,
  DateField,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorSummary,
  Field,
  Input,
  Tag,
  NumberField,
  NumberInput,
  PrintSheet,
  PrintTd,
  PrintTh,
  StatCardGrid,
  RowMarkActions,
  useRowMarkTools,
  todayIso,
  notify,
  parseVnNumber,
  type TableSelection,
  type SummaryTableColumn,
  type FieldError,
  type ComboboxOption,
  type StatCardData,
} from "@/design-system";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRightLeft,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Coins,
  Eye,
  EyeOff,
  PackageMinus,
  FileSpreadsheet,
  Pencil,
  Plus,
  Printer,
  Redo2,
  Scale,
  Ship,
  Snowflake,
  Trash2,
  Undo2,
  Upload,
  Wrench,
  Library,
  ListChecks,
  MapPin,
  History,
  Sigma,
  Sparkles,
} from "lucide-react";

const ALL_WAREHOUSES = "__tat_ca__";

/** 5 kho hệ thống (BSF1_WAREHOUSES) — chọn chuẩn, không gõ tự do. Lưu theo TÊN kho. */
const SYSTEM_WAREHOUSES: ComboboxOption[] = BSF1_WAREHOUSES.map((w) => ({ value: w.name, label: `${w.name} · ${w.code}` }));
const WAREHOUSE_CODES = new Map(BSF1_WAREHOUSES.map((w) => [w.name, w.code]));
/** Token ASCII ổn định của kho cho id nhập (mã kho nếu là kho hệ thống). */
const warehouseCode = (ten: string) => WAREHOUSE_CODES.get(ten) ?? ten.replace(/[|\s]+/g, "-");
const DEFAULT_WAREHOUSE = BSF1_WAREHOUSES.find((w) => w.code === "K1500T")?.name ?? BSF1_WAREHOUSES[0].name;

/** Form thêm/sửa một dòng (phần mô tả + số liệu đầy đủ). */
interface DongForm {
  id: string | null; // null = thêm mới
  category: string;
  warehouse: string;
  itemName: string;
  size: string;
  origin: string; // số Invoice (cột DB `origin`)
  importDate: string;
  storageLocation: string;
  kgPerCtn: number | null;
  unitPrice: number | null;
  openCtn: number | null;
  openKg: number | null;
  inCtn: number | null;
  inKg: number | null;
  outCtn: number | null;
  outKg: number | null;
}

const emptyForm = (category: string, warehouse: string): DongForm => ({
  id: null,
  category,
  warehouse,
  itemName: "",
  size: "",
  origin: "",
  importDate: "",
  storageLocation: "",
  kgPerCtn: null,
  unitPrice: null,
  openCtn: null,
  openKg: null,
  inCtn: null,
  inKg: null,
  outCtn: null,
  outKg: null,
});

const soHoacGach = (v: number) => (chuan0(v) ? num(v) : "—");

/**
 * Sổ kho theo THÁNG DƯƠNG LỊCH. Số hoá đúng "bảng kê kho" kế toán đang giữ trên
 * Excel (mỗi sheet một tháng). Bất biến: Tồn cuối = tồn đầu + nhập − xuất (kiện &
 * kg); Tiền còn lại = tồn cuối kg × đơn giá — suy ở tầng app nên luôn khớp. Tồn
 * ĐẦU kỳ được LƯU (snapshot kế thừa từ tháng trước, đóng băng). Nút "Dồn sang
 * tháng sau" tự chuyển tồn cuối → tồn đầu kỳ sau; hết chép tay chỗ hay sai số.
 */
export default function MonthlyStockScreen() {
  const [lines, writeLinesRaw] = useMonthlyStock();
  const [mtypes, setMtypes] = useMaterialTypes();
  const [products, setProducts] = useProducts();
  const [storageLocationCatalog, setStorageLocationCatalog] = useStorageLocations();

  const [month, setMonth] = useState(getCurrentMonth());
  const [warehouse, setWarehouse] = useState(ALL_WAREHOUSES);
  const [moIn, setMoIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); // tìm nhanh trong tháng (tên · size · xuất xứ · nhóm)
  const [selected, setSelected] = useState<Set<string>>(new Set()); // dòng đang tick (cộng tổng / thao tác lô)
  const [viewedCard, setViewedCard] = useState<MonthlyStockRow | null>(null); // thẻ kho của 1 mặt hàng
  const [hideEmptyRows, setHideEmptyRows] = useState(false); // ẩn dòng tồn đầu = nhập = xuất = 0

  // ---------- Nhập Excel bảng kê (seed số cũ) ----------
  const fileRef = useRef<HTMLInputElement>(null);
  const [napForm, setNapForm] = useState<{ sheets: StockStatementSheet[]; nam: number; warehouse: string } | null>(null);

  // ---------- Tuỳ chọn tháng / kho ----------
  const monthsWithData = useMemo(
    () => [...new Set(lines.map((l) => l.period).filter(Boolean))],
    [lines]
  );
  const monthOptions: ComboboxOption[] = useMemo(
    () => listMonths([...monthsWithData, month]).map((p) => ({ value: p, label: formatMonthLabel(p) })),
    [monthsWithData, month]
  );

  const warehouseOpts: ComboboxOption[] = useMemo(() => {
    // 5 kho hệ thống luôn chọn được + kho lạ đã có trong dữ liệu (nếu import tự tạo).
    const set = new Set<string>(BSF1_WAREHOUSES.map((w) => w.name));
    for (const l of lines) if (l.warehouse) set.add(l.warehouse);
    return [
      { value: ALL_WAREHOUSES, label: "Tất cả kho" },
      ...[...set].sort().map((k) => ({ value: k, label: WAREHOUSE_CODES.has(k) ? `${k} · ${WAREHOUSE_CODES.get(k)}` : k })),
    ];
  }, [lines]);

  // ---------- Dòng của tháng đang xem ----------
  /** Dòng ĐÃ LƯU của tháng + kho đang chọn (chưa lọc theo ô tìm). */
  const savedRows: MonthlyStockRow[] = useMemo(() => {
    return lines
      .filter((l) => l.period === month && (warehouse === ALL_WAREHOUSES || l.warehouse === warehouse))
      .map(suyDong);
  }, [lines, month, warehouse]);

  // Tháng liền trước (mọi kho — dồn kỳ không bỏ sót kho nào).
  const prevMonth = getPrevMonth(month);
  const priorRows = useMemo(
    () => lines.filter((l) => l.period === prevMonth).map(suyDong),
    [lines, prevMonth]
  );

  /**
   * XEM TRƯỚC dồn kỳ: tháng đang xem chưa có dòng nào nhưng tháng trước còn tồn ⇒
   * dựng SẴN tồn đầu kế thừa để màn hình không "trống trơn" (đây là chỗ hay bị
   * hiểu là mất số liệu). Dòng xem trước CHƯA LƯU — người dùng bấm "Kế thừa & lưu"
   * mới ghi. Cố ý không tự ghi: dồn kỳ phải đi qua bước đối chiếu khi lô tách/đổi
   * mã (xem `compareCarryForward`), tự ghi đè dễ cộng đôi.
   */
  const previewRows: MonthlyStockRow[] = useMemo(() => {
    if (savedRows.length > 0) return [];
    const source = priorRows.filter((r) => warehouse === ALL_WAREHOUSES || r.warehouse === warehouse);
    return buildCarryForwardLines(source, month).map(suyDong);
  }, [savedRows.length, priorRows, warehouse, month]);

  // Theo kho đang lọc (lọc một kho còn trống vẫn xem trước được); phần GHI chỉ dồn
  // đúng phạm vi `khoDon` nên kho khác trong tháng không bị đặt lại.
  const isPreview = savedRows.length === 0 && previewRows.length > 0;

  /** Dòng đang HIỂN THỊ = dòng đã lưu, hoặc bản xem trước khi tháng còn trống. */
  const sourceRows = isPreview ? previewRows : savedRows;

  /** Số dòng không có số liệu trong phạm vi đang xem (để ghi trên nút ẩn/hiện). */
  const emptyRowCount = useMemo(() => sourceRows.filter(isEmptyLine).length, [sourceRows]);

  /** Ô tìm nhanh: tên · size · invoice · nhóm · kho · vị trí (không phân biệt hoa thường) + ẩn dòng trống. */
  const monthRows: MonthlyStockRow[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const source = hideEmptyRows ? sourceRows.filter((r) => !isEmptyLine(r)) : sourceRows;
    if (!q) return source;
    return source.filter((r) =>
      `${r.itemName} ${r.size} ${r.origin} ${r.category} ${r.warehouse} ${r.storageLocation}`.toLowerCase().includes(q)
    );
  }, [sourceRows, searchQuery, hideEmptyRows]);

  const nhomList = useMemo(() => groupByCategory(monthRows), [monthRows]);
  const total = useMemo(() => sumMonthlyStockRows(monthRows), [monthRows]);
  const invariantHolds = Math.abs(total.openKg + total.inKg - total.outKg - total.closeKg) < 0.001;

  // Dồn sang tháng sau dùng TOÀN BỘ dòng của tháng (mọi kho), không theo bộ lọc.
  const fullMonthRows = useMemo(
    () => lines.filter((l) => l.period === month).map(suyDong),
    [lines, month]
  );
  // Theo KG (đơn vị ghi sổ) — cùng điều kiện lọc của `buildCarryForwardLines`.
  const hasCarryForward = fullMonthRows.some((r) => Math.abs(r.closeKg) > 1e-9);

  /** Phạm vi kho khi kéo tồn tháng trước về (gõ ở xem trước / "Kế thừa"): tháng còn trống
   *  hẳn ⇒ mọi kho (không bỏ sót kho nào); tháng đã có dòng ở kho KHÁC (đang lọc một kho
   *  còn trống) ⇒ CHỈ kho đang lọc — không đặt lại dòng carry của kho kia. */
  const carryWarehouse = () => (fullMonthRows.length === 0 || warehouse === ALL_WAREHOUSES ? undefined : warehouse);

  // Cờ lệch dồn kỳ: tồn đầu tháng này (mọi kho) vs tồn cuối tháng trước.
  const carryGap = useMemo(() => measureCarryForwardGap(priorRows, fullMonthRows), [priorRows, fullMonthRows]);
  // Đang XEM TRƯỚC thì "lệch" chính là phần chưa dồn — banner xem trước đã nói rồi,
  // hiện thêm cảnh báo đỏ chỉ làm người dùng tưởng sai số liệu.
  const showDiffWarning = priorRows.length > 0 && hasCarryForwardGap(carryGap) && !isPreview;

  // Đối chiếu lệch theo MẶT HÀNG (chẩn đoán — người dùng tự sửa thẳng trên bảng).
  const carryComparison = useMemo(() => compareCarryForward(priorRows, fullMonthRows), [priorRows, fullMonthRows]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Đồng bộ tên trong sổ ↔ CẢ HAI danh mục (loại NL + mặt hàng), định tuyến TỪNG DÒNG.
  // Thành phẩm (141 mã kế toán) CỐ ĐỊNH — không thêm ở đây.
  const catalogSync = useMemo(
    () =>
      analyzeCatalogSync(
        [...new Set(lines.map((l) => l.itemName))],
        mtypes.map((m) => m.name),
        products.map((p) => p.name)
      ),
    [lines, mtypes, products]
  );
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [savedTargets, setSavedTargets] = useState<Record<string, CatalogTarget>>({}); // đích từng dòng (đè gợi ý)
  const [mapDB, setMapDB] = useState<Record<string, string>>({}); // ánh xạ tên file → tên chuẩn trong danh mục

  // ---------- Hoàn tác / làm lại (Ctrl+Z / Ctrl+Y) — như lưới Cân đối ----------
  /* Người dùng quen Excel: Ctrl+Z lùi MỌI thứ vừa ghi vào sổ, không riêng ô số. Mỗi
     lần ghi chụp lại sổ TRƯỚC khi ghi; gõ liên tiếp vào CÙNG một ô (cùng `nhom`) chỉ
     là MỘT bước lùi. Lịch sử theo phiên mở màn — rời màn là mất. */
  const lui = useRef<{ nhom: string; lines: MonthlyStockLine[] }[]>([]);
  const amount = useRef<{ nhom: string; lines: MonthlyStockLine[] }[]>([]);
  const [lichSu, setLichSu] = useState({ lui: 0, tien: 0 });
  const demLichSu = () => setLichSu({ lui: lui.current.length, tien: amount.current.length });

  /** MỌI lần ghi sổ của màn đi qua đây (thao tác dòng, dồn kỳ, nạp Excel, gõ ô…). */
  const writeLines = (next: MonthlyStockLine[], nhom?: string) => {
    const topSnapshot = lui.current[lui.current.length - 1];
    if (!nhom || !topSnapshot || topSnapshot.nhom !== nhom) {
      lui.current.push({ nhom: nhom ?? uid(), lines });
      if (lui.current.length > 100) lui.current.shift();
    }
    amount.current = [];
    demLichSu();
    writeLinesRaw(next);
  };
  const undo = useCallback(() => {
    const m = lui.current.pop();
    if (!m) return;
    amount.current.push({ nhom: m.nhom, lines });
    writeLinesRaw(m.lines);
    setLichSu({ lui: lui.current.length, tien: amount.current.length });
    notify.saved("Đã hoàn tác");
  }, [lines, writeLinesRaw]);
  const redo = useCallback(() => {
    const m = amount.current.pop();
    if (!m) return;
    lui.current.push({ nhom: m.nhom, lines });
    writeLinesRaw(m.lines);
    setLichSu({ lui: lui.current.length, tien: amount.current.length });
    notify.saved("Đã làm lại");
  }, [lines, writeLinesRaw]);
  useEffect(() => {
    const nghe = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      // Đang gõ trong hộp thoại (thêm/sửa dòng…) ⇒ để ô tự hoàn tác chữ của nó.
      if ((e.target as HTMLElement | null)?.closest?.('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", nghe);
    return () => window.removeEventListener("keydown", nghe);
  }, [undo, redo]);

  // ---------- Ghi THẲNG trên bảng ----------
  /* Sửa một dòng ngay tại ô — đi qua chốt audit của repo.ts như mọi đường ghi (lưu vết
     người · thiết bị · thời điểm · cũ→mới). `nhom` = ô đang gõ ⇒ một bước Ctrl+Z. */
  /**
   * Sổ làm nền cho một lần gõ trên bảng. Tháng đang XEM TRƯỚC (chưa có dòng nào) ⇒ gõ
   * vào ô nào là tự KẾ THỪA tồn cuối tháng trước (mọi kho — y nút "Kế thừa & lưu vào
   * sổ") rồi ghi số vừa gõ, CÙNG một lần ghi ⇒ Ctrl+Z lùi cả hai. id dòng kế thừa
   * `carry|<id nguồn>` = đúng id dòng đang xem trước ⇒ ô đang gõ không mất con trỏ.
   * Cùng quy tắc "tháng chưa mở thì tự kế thừa" của Cân đối (chốt 2026-10-06).
   */
  const baseLinesForWrite = (): { baseLines: MonthlyStockLine[]; carriedCount: number } => {
    if (!isPreview) return { baseLines: lines, carriedCount: 0 };
    const result = carryForwardIntoLedger(lines, month, carryWarehouse());
    return { baseLines: result.lines, carriedCount: result.soDong };
  };
  const notifyCarried = (n: number) => {
    if (n) notify.saved(`Đã kế thừa ${n} dòng tồn cuối ${formatMonthLabel(prevMonth)} vào sổ ${formatMonthLabel(month)} rồi ghi số vừa gõ`);
  };

  const editLedger = (id: string, patch: Partial<MonthlyStockLine>, nhom?: string) => {
    const { baseLines, carriedCount } = baseLinesForWrite();
    writeLines(
      baseLines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      nhom ?? `${id}|${Object.keys(patch).join(",")}`
    );
    notifyCarried(carriedCount);
  };

  /* ---------- Ghi DÒNG MỚI ngay trên bảng ----------
     Cuối mỗi bảng nhóm có ô "Dòng mới": gõ / chọn tên hàng là dòng hiện luôn trong bảng
     (nhóm của bảng, tháng đang xem, kho đang lọc — "Tất cả kho" thì kho mặc định), con
     trỏ nhảy sang ô Nhập của dòng đó để gõ số tiếp. Tháng đang xem trước ⇒ tự kế thừa
     & lưu trước (soNenDeGhi). Cần điền nhiều ô một lần thì vẫn có hộp "Thêm đủ thông tin". */
  const productNameOptions = (category: string): ComboboxOption[] => {
    const sameGroup = new Set<string>();
    const otherNames = new Set<string>();
    for (const l of lines) (l.category === category ? sameGroup : otherNames).add(l.itemName);
    for (const m of mtypes) otherNames.add(m.name);
    for (const sp of products) otherNames.add(sp.name);
    const ra: ComboboxOption[] = [];
    const existing = new Set<string>();
    for (const [items, phu] of [
      [sameGroup, category],
      [otherNames, undefined],
    ] as const) {
      for (const t of [...items].filter(Boolean).sort((a, b) => a.localeCompare(b, "vi"))) {
        const k = t.trim().toLowerCase();
        if (existing.has(k)) continue;
        existing.add(k);
        ra.push({ value: t, label: t, subLabel: phu });
      }
    }
    return ra;
  };
  const quickAddRow = (category: string, ten: string) => {
    const t = ten.trim();
    if (!t) return;
    const { baseLines, carriedCount } = baseLinesForWrite();
    const dong: MonthlyStockLine = {
      id: `msl|${month}|${uid()}`,
      period: month,
      category,
      warehouse: warehouse !== ALL_WAREHOUSES ? warehouse : DEFAULT_WAREHOUSE,
      itemName: t,
      size: "",
      origin: "",
      importDate: "",
      storageLocation: "",
      kgPerCtn: null,
      unitPrice: null,
      openCtn: 0,
      openKg: 0,
      inCtn: 0,
      inKg: 0,
      outCtn: 0,
      outKg: 0,
      carriedFromId: "",
      sortOrder: baseLines.filter((l) => l.period === month).length,
      note: "",
    };
    writeLines([...baseLines, dong]);
    notifyCarried(carriedCount);
    notify.saved(`Đã thêm dòng ${t} vào ${category} — gõ số ngay trên bảng`);
    /* Dòng mới đang ẩn vì ô tìm / ẩn dòng trống ⇒ bỏ lọc để thấy nó. */
    if (searchQuery.trim() && !`${t} ${category}`.toLowerCase().includes(searchQuery.trim().toLowerCase())) setSearchQuery("");
    if (hideEmptyRows) setHideEmptyRows(false);
    setTimeout(() => {
      const o = document.querySelector<HTMLInputElement>(
        `input[data-row="${CSS.escape(dong.id)}"][data-navcol="inKg"]`
      );
      o?.focus();
      o?.select();
    }, 60);
  };

  /** Cột số gõ được trên bảng — đúng thứ tự cột hiển thị (để dán khối từ Excel). */
  const NUMERIC_COLS: (keyof Pick<MonthlyStockLine, "unitPrice" | "openKg" | "inKg" | "outKg">)[] = [
    "unitPrice",
    "openKg",
    "inKg",
    "outKg",
  ];

  /**
   * Dán một KHỐI số từ Excel (TSV) vào bảng, bắt đầu từ ô đang đứng: dòng theo thứ tự
   * đang hiện (qua các nhóm), cột theo `COT_SO`. Hiểu `(2.000)` = −2.000 kiểu kế toán;
   * ô rỗng giữ nguyên số cũ. Gom MỘT lần ghi (dán 5×10 ô không thành 50 lần ghi đè).
   */
  const pasteBlock = (e: React.ClipboardEvent<HTMLInputElement>, rowId: string, columns: (typeof NUMERIC_COLS)[number]) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || !/[\t\n\r]/.test(text)) return; // một ô — để ô tự xử lý
    e.preventDefault();
    const block = text
      .replace(/\r\n?/g, "\n")
      .replace(/\n+$/, "")
      .split("\n")
      .map((dong) =>
        dong.split("\t").map((o) => {
          const t = o.trim();
          if (!t) return null;
          const am = /^\(.*\)$/.test(t);
          const so = parseVnNumber(am ? t.slice(1, -1) : t);
          return so == null ? null : am ? -so : so;
        })
      );
    const allRows = nhomList.flatMap((g) => g.rows);
    const iH = allRows.findIndex((r) => r.id === rowId);
    const iC = NUMERIC_COLS.indexOf(columns);
    if (iH < 0 || iC < 0) return;
    const doi = new Map<string, Partial<MonthlyStockLine>>();
    let soO = 0;
    block.forEach((dong, i) =>
      dong.forEach((v, j) => {
        const r = allRows[iH + i];
        const c = NUMERIC_COLS[iC + j];
        if (v == null || !r || !c) return;
        doi.set(r.id, { ...(doi.get(r.id) ?? {}), [c]: v });
        soO++;
      })
    );
    if (!soO) return;
    const { baseLines, carriedCount } = baseLinesForWrite();
    writeLines(baseLines.map((l) => (doi.has(l.id) ? { ...l, ...doi.get(l.id) } : l)));
    notifyCarried(carriedCount);
    notify.saved(`Đã dán ${soO} ô vào ${doi.size} dòng — Ctrl+Z để hoàn tác`);
  };

  const removeRow = (r: MonthlyStockRow) => {
    const prevRows = lines;
    writeLines(lines.filter((l) => l.id !== r.id));
    notify.deleted(`Đã xóa dòng ${r.itemName}`, () => writeLines(prevRows));
  };

  // ---------- Thêm / sửa dòng ----------
  const [form, setForm] = useState<DongForm | null>(null);
  const [loi, setLoi] = useState<FieldError[]>([]);

  const openAdd = (pickedCategory?: string) => {
    // Đang XEM TRƯỚC: lưu dòng mới sẽ TỰ kế thừa & lưu bảng kế thừa trước (luuDong →
    // soNenDeGhi) — trước đây chặn vì lưu riêng 1 dòng làm bảng kế thừa chưa lưu trôi mất.
    // catChon = nhóm của bảng bấm nút (điền sẵn nhóm, khỏi chọn lại). Không có ⇒ nhóm đầu.
    const suggestedCategory = pickedCategory || nhomList[0]?.category || MONTHLY_STOCK_CATEGORIES[0];
    const suggestedWarehouse = warehouse !== ALL_WAREHOUSES ? warehouse : DEFAULT_WAREHOUSE;
    setForm(emptyForm(suggestedCategory, suggestedWarehouse));
    setLoi([]);
  };
  const openEdit = (r: MonthlyStockRow) => {
    setForm({
      id: r.id,
      category: r.category,
      warehouse: r.warehouse,
      itemName: r.itemName,
      size: r.size,
      origin: r.origin,
      importDate: r.importDate,
      storageLocation: r.storageLocation,
      kgPerCtn: r.kgPerCtn,
      unitPrice: r.unitPrice,
      openCtn: r.openCtn || null,
      openKg: r.openKg || null,
      inCtn: r.inCtn || null,
      inKg: r.inKg || null,
      outCtn: r.outCtn || null,
      outKg: r.outKg || null,
    });
    setLoi([]);
  };

  const saveRow = () => {
    if (!form) return;
    const ls: FieldError[] = [];
    if (!form.category.trim()) ls.push({ field: "Nhóm hàng", message: "Chưa chọn nhóm" });
    if (!form.itemName.trim()) ls.push({ field: "Tên hàng", message: "Chưa nhập tên hàng" });
    setLoi(ls);
    if (ls.length) return;

    const prev = form.id ? lines.find((l) => l.id === form.id) : undefined;
    const dong: MonthlyStockLine = {
      id: form.id ?? `msl|${month}|${uid()}`,
      period: prev?.period ?? month,
      category: form.category.trim(),
      warehouse: form.warehouse.trim(),
      itemName: form.itemName.trim(),
      size: form.size.trim(),
      origin: form.origin.trim(),
      importDate: form.importDate,
      storageLocation: form.storageLocation.trim(),
      kgPerCtn: form.kgPerCtn,
      unitPrice: form.unitPrice,
      openCtn: form.openCtn ?? 0,
      openKg: form.openKg ?? 0,
      inCtn: form.inCtn ?? 0,
      inKg: form.inKg ?? 0,
      outCtn: form.outCtn ?? 0,
      outKg: form.outKg ?? 0,
      carriedFromId: prev?.carriedFromId ?? "",
      sortOrder: prev?.sortOrder ?? lines.filter((l) => l.period === month).length,
      note: prev?.note ?? "",
    };
    const { baseLines, carriedCount } = form.id ? { baseLines: lines, carriedCount: 0 } : baseLinesForWrite();
    writeLines(form.id ? lines.map((l) => (l.id === dong.id ? dong : l)) : [...baseLines, dong]);
    notifyCarried(carriedCount);
    setForm(null);
    notify.saved(form.id ? `Đã sửa dòng ${dong.itemName}` : `Đã thêm dòng ${dong.itemName}`);
  };

  // ---------- Dồn kỳ ----------
  /* Ghi qua `carryForwardIntoLedger` (hàm thuần): dòng carry đã có chỉ đổi tồn đầu, giữ nhập/xuất,
     vị trí, ghi chú, vết Cân đối; dòng carry mất nguồn về tồn đầu 0. */
  const describeZeroedLines = (result: { veKhong: number; bo: number }) =>
    (result.veKhong ? ` · ${result.veKhong} dòng về tồn đầu 0 (tháng trước đã hết)` : "") +
    (result.bo ? ` · bỏ ${result.bo} dòng trống` : "");

  const carryFromPrevMonth = () => {
    const result = carryForwardIntoLedger(lines, month, carryWarehouse());
    if (!result.soDong && !result.veKhong && !result.bo) {
      notify.warning(`${formatMonthLabel(prevMonth)} không có tồn để dồn sang.`);
      return;
    }
    writeLines(result.lines);
    notify.saved(`Đã kế thừa ${result.soDong} dòng · ${num(result.tongKg)} kg từ ${formatMonthLabel(prevMonth)}${describeZeroedLines(result)}`);
  };

  const carryToNextMonth = () => {
    const target = getNextMonth(month);
    const result = carryForwardIntoLedger(lines, target);
    if (!result.soDong && !result.veKhong && !result.bo) {
      notify.warning("Tháng này không còn tồn cuối để dồn sang.");
      return;
    }
    writeLines(result.lines);
    setMonth(target);
    setWarehouse(ALL_WAREHOUSES);
    notify.saved(
      `Đã dồn tồn cuối sang ${formatMonthLabel(target)} · ${result.soDong} dòng (${result.them} mới, ${result.capNhat} cập nhật tồn đầu, giữ nguyên nhập/xuất đã ghi)${describeZeroedLines(result)}`
    );
  };

  // ---------- Tick dòng: cộng tổng · in riêng · xóa theo lô ----------
  /**
   * Phần mềm kế toán kho nào cũng có: tick vài dòng → thấy NGAY tổng của đúng mấy
   * dòng đó (không phải tổng cả tháng), rồi in riêng / xử theo lô. Chỉ giữ tập KHÓA
   * dòng ở state — không sửa dữ liệu.
   */
  const tableSelection: TableSelection<MonthlyStockRow> = {
    selectedKeys: selected,
    toggle: (k) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      }),
    toggleAll: (keys, bat) =>
      setSelected((prev) => {
        const next = new Set(prev);
        for (const k of keys) {
          if (bat) next.add(k);
          else next.delete(k);
        }
        return next;
      }),
    getRowLabel: (r) => `${r.itemName}${r.size ? " · " + r.size : ""}`,
  };
  const selectedRows = useMemo(() => monthRows.filter((r) => selected.has(r.id)), [monthRows, selected]);
  // Tô màu dòng "đã dò" — cùng khoá với SummaryTable rowMarkKey="ton-kho-thang" bên dưới:
  // tick dòng → nút Tô màu / In đậm / Bỏ tô ở thanh "Đã chọn N dòng".
  const rowMark = useRowMarkTools("ton-kho-thang");
  const selectedTotal = useMemo(() => sumMonthlyStockRows(selectedRows), [selectedRows]);
  const clearSelection = () => setSelected(new Set());

  /** Bản in: có tick thì in đúng mấy dòng đó, không thì in cả tháng đang xem. */
  const rowsIn = selectedRows.length ? selectedRows : monthRows;
  const nhomIn = useMemo(() => groupByCategory(rowsIn), [rowsIn]);
  const printTotal = useMemo(() => sumMonthlyStockRows(rowsIn), [rowsIn]);

  /** Chọn hết các dòng đang hiện (mọi nhóm) — nút ở thanh công cụ. */
  const selectAll = () => setSelected(new Set(monthRows.map((r) => r.id)));

  /** Xóa các dòng đã tick — có xác nhận + hoàn tác (không xóa lặng lẽ). */
  const deleteSelected = () => {
    const ids = new Set(selectedRows.map((r) => r.id));
    if (!ids.size) return;
    const prevRows = lines;
    writeLines(lines.filter((l) => !ids.has(l.id)));
    clearSelection();
    notify.deleted(`Đã xóa ${ids.size} dòng ${formatMonthLabel(month)}`, () => writeLines(prevRows));
  };

  // ---------- Vị trí hàng đang nằm (kho nhà + kho thuê ngoài) ----------
  /** Kho hệ thống + danh mục kho lưu (`storage_locations`) + tên đã dùng trong sổ. */
  const locationOptions: ComboboxOption[] = useMemo(() => {
    const phu = new Map<string, string>(BSF1_WAREHOUSES.map((w) => [w.name, `Kho xí nghiệp · ${w.code}`]));
    for (const k of storageLocationCatalog) if (k.name.trim() && !phu.has(k.name.trim())) phu.set(k.name.trim(), STORAGE_KIND_LABELS[k.kind]);
    for (const l of lines) if (l.storageLocation && !phu.has(l.storageLocation)) phu.set(l.storageLocation, "");
    return [...phu].map(([n, note]) => ({ value: n, label: n, phu: note || undefined }));
  }, [storageLocationCatalog, lines]);

  /**
   * Gõ vị trí chưa có ⇒ lưu ngay vào danh mục kho lưu (mặc định kho thuê ngoài).
   * Trùng tên (không phân hoa thường) với kho đã có ⇒ dùng lại tên có sẵn.
   */
  const addLocation = (ten: string) => {
    const name = ten.trim();
    const co = locationOptions.find((o) => o.value.toLowerCase() === name.toLowerCase());
    if (co) return co.value;
    if (name) {
      setStorageLocationCatalog([...storageLocationCatalog, { id: uid(), code: "", name, kind: "thue-ngoai", address: "", phone: "", note: "Từ sổ kho theo tháng" }]);
      notify.saved(`Đã thêm kho lưu "${name}" vào danh mục`);
    }
    return name;
  };
  /** Bút chì sửa nhanh kho lưu ngay trong ô Vị trí — chỉ kho CÓ trong danh mục (kho hệ thống thì không). */
  const storageLocationEditor = useQuickCatalogEdit("khoLuu", storageLocationCatalog, setStorageLocationCatalog, { theo: "ten" });

  const [assignLocation, setAssignLocation] = useState<string | null>(null); // vị trí sắp gán cho dòng tick
  /** Gán vị trí cho các dòng đang tick (một lần ghi, có Hoàn tác). */
  const assignLocationToSelected = () => {
    const target = (assignLocation ?? "").trim();
    const ids = new Set(selectedRows.map((r) => r.id));
    if (!target || !ids.size) {
      notify.warning(!target ? "Chưa chọn vị trí để gán." : "Chưa tick dòng nào.");
      return;
    }
    const prevRows = lines;
    writeLines(lines.map((l) => (ids.has(l.id) ? { ...l, storageLocation: target } : l)));
    setAssignLocation(null);
    notify.saved(`Đã gửi ${ids.size} dòng tới ${target}`, () => writeLines(prevRows));
  };

  // ---------- Thao tác một dòng: lấy ra dùng · nhập thêm · chuyển vị trí ----------
  const [action, setAction] = useState<{
    row: MonthlyStockRow;
    kind: LotActionKind;
    kg: number | null;
    location: string;
    date: string;
    reason: string;
  } | null>(null);
  const [loiTT, setLoiTT] = useState<FieldError[]>([]);

  const openAction = (row: MonthlyStockRow, kind: LotActionKind = "xuat") => {
    setAction({ row, kind, kg: null, location: "", date: todayIso(), reason: "" });
    setLoiTT([]);
  };

  const saveAction = () => {
    if (!action) return;
    const { row, kind, kg, location: targetLocation, date, reason } = action;
    const ls: FieldError[] = [];
    const closingKg = row.closeKg;
    if (!kg || kg <= 0) ls.push({ field: "Số kg", message: "Chưa nhập số kg (phải lớn hơn 0)" });
    else if (kind !== "nhap" && kg > closingKg + 1e-6)
      ls.push({ field: "Số kg", message: `Vượt tồn cuối của dòng (${num(closingKg)} kg)` });
    if (kind === "chuyen") {
      if (!targetLocation.trim()) ls.push({ field: "Chuyển tới", message: "Chưa chọn vị trí đích" });
      else if (targetLocation.trim() === locationOf(row)) ls.push({ field: "Chuyển tới", message: "Vị trí đích trùng vị trí hiện tại" });
    }
    setLoiTT(ls);
    if (ls.length || !kg) return;

    const actionText =
      kind === "xuat"
        ? `Lấy ra sử dụng ${num(kg)} kg`
        : kind === "nhap"
          ? `Nhập thêm ${num(kg)} kg`
          : `Gửi ${num(kg)} kg từ ${locationOf(row) || "(chưa rõ)"} tới ${targetLocation.trim()}`;
    const note = `${formatDateVN(date || todayIso())}: ${actionText}${reason.trim() ? ` — ${reason.trim()}` : ""}`;
    const original = lines.find((l) => l.id === row.id);
    if (!original) return;
    const result = applyLotAction(original, kind, kg, { viTriDich: targetLocation, ghiChu: note, idMoi: `msl|${month}|${uid()}` });
    const prevRows = lines;
    const updatedLines = lines.map((l) => (l.id === result.dong.id ? result.dong : l));
    writeLines(result.dongTach ? [...updatedLines, result.dongTach] : updatedLines);
    setAction(null);
    notify.saved(`${row.itemName}: ${actionText}`, () => writeLines(prevRows));
  };

  // ---------- Thẻ kho: lịch sử một mặt hàng qua các tháng ----------
  const stockCardList = useMemo(
    () => (viewedCard ? buildProductStockCard(lines, stockLineKey(viewedCard)) : []),
    [lines, viewedCard]
  );

  // Lọc bảng về đúng mặt hàng lệch (ô Tìm) để sửa tay ngay trên bảng.
  const manualFixProduct = (d: CarryForwardDiff) => {
    setWarehouse(d.warehouse);
    setSearchQuery(d.itemName);
    setHideEmptyRows(false);
    setIsCompareOpen(false);
  };

  // ---------- Đồng bộ danh mục loại nguyên liệu ----------
  // Danh sách tên CHUẨN để ánh xạ tới (gõ tìm / thêm mới).
  const productOpts: ComboboxOption[] = useMemo(
    () => [...products].map((p) => p.name).sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n })),
    [products]
  );
  const materialTypeOpts: ComboboxOption[] = useMemo(
    () => [...mtypes].map((m) => m.name).sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n })),
    [mtypes]
  );

  /**
   * Bút chì sửa nhanh mặt hàng / loại NL trong ô "Ánh xạ … tới" (value là TÊN).
   * Đổi tên mặt hàng ở hộp sửa ⇒ dời luôn các ánh xạ đang trỏ tên cũ sang tên mới,
   * kẻo bấm Đồng bộ lại đẻ ra một mặt hàng mang tên cũ. (Loại NL khoá ô tên.)
   */
  const productEditor = useQuickCatalogEdit("matHang", products, setProducts, {
    theo: "ten",
    onSaved: (newLines, prev) => {
      const oldName = prev.name.trim().toLowerCase();
      if (newLines.name.trim().toLowerCase() === oldName) return;
      setMapDB((m) =>
        Object.fromEntries(
          Object.entries(m).map(([k, v]) => [k, v.trim().toLowerCase() === oldName ? newLines.name.trim() : v])
        )
      );
    },
  });
  const materialTypeEditor = useQuickCatalogEdit("loaiNL", mtypes, setMtypes, { theo: "ten" });

  const openSyncDialog = () => {
    setSavedTargets({}); // rỗng = dùng đích GỢI Ý mỗi dòng
    setMapDB({}); // rỗng = giữ nguyên tên file (chưa ánh xạ)
    setIsSyncOpen(true);
  };
  // Tách: MÃ KHÓ cần người quyết vs tên RÕ RÀNG (tự nhận loài, khỏi bận tâm).
  const needsSync = catalogSync.chuaCo.filter((x) => !x.roRang);
  const clearNames = catalogSync.chuaCo.filter((x) => x.roRang);
  const targetOf = (x: { name: string; dichGoiY: CatalogTarget }): CatalogTarget => savedTargets[x.name] ?? x.dichGoiY;
  // Tên chuẩn được ánh xạ tới (mặc định = tên file nếu chưa chọn).
  const mappedName = (x: { name: string }) => (mapDB[x.name] ?? x.name).trim();
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  // Đếm trên TOÀN BỘ (cả mã khó lẫn rõ ràng) — mỗi dòng tự chọn đích.
  const productCount = catalogSync.chuaCo.filter((x) => targetOf(x) === "product").length;
  const materialCount = catalogSync.chuaCo.filter((x) => targetOf(x) === "material").length;

  /**
   * Áp đồng bộ: mỗi mã (đích ≠ bỏ qua) NỐI vào tên chuẩn (mapCua). Tên chuẩn chưa
   * có trong danh mục đích ⇒ thêm mới; và ĐỔI TÊN mọi dòng sổ mang tên file cũ
   * sang tên chuẩn (đồng bộ sổ + gộp trùng cách ghi).
   */
  const applySync = () => {
    const materialNames = new Set(mtypes.map((m) => normalize(m.name)));
    const productNames = new Set(products.map((p) => normalize(p.name)));
    const materialsToAdd: MaterialType[] = [];
    const productsToAdd: Product[] = [];
    const renames = new Map<string, string>(); // tên file → tên chuẩn (khi khác nhau)
    for (const x of catalogSync.chuaCo) {
      const d = targetOf(x);
      if (d === "skip") continue;
      const canon = mappedName(x);
      if (!canon) continue;
      if (d === "material" && !materialNames.has(normalize(canon))) {
        materialsToAdd.push({ id: uid(), name: canon, category: inferMaterialCategory(canon), note: "Từ sổ kho theo tháng" });
        materialNames.add(normalize(canon));
      } else if (d === "product" && !productNames.has(normalize(canon))) {
        productsToAdd.push({ id: uid(), code: "", name: canon, finishedGoodCode: "", category: inferMaterialCategory(canon), processingType: "" });
        productNames.add(normalize(canon));
      }
      if (normalize(canon) !== normalize(x.name)) renames.set(x.name, canon);
    }
    if (!materialsToAdd.length && !productsToAdd.length && !renames.size) {
      notify.warning("Chưa ánh xạ/chọn đích dòng nào.");
      return;
    }
    if (materialsToAdd.length) setMtypes([...mtypes, ...materialsToAdd]);
    if (productsToAdd.length) setProducts([...products, ...productsToAdd]);
    if (renames.size) writeLines(lines.map((l) => (renames.has(l.itemName) ? { ...l, itemName: renames.get(l.itemName)! } : l)));
    setIsSyncOpen(false);
    notify.saved(
      `Đồng bộ: +${productsToAdd.length} mặt hàng · +${materialsToAdd.length} loại NL · đổi tên ${renames.size} mã trong sổ`
    );
  };

  /** Đặt đích cho một NHÓM dòng (bulk theo section). */
  const setTarget = (list: CatalogSyncItem[], d: CatalogTarget | "goiY") => {
    setSavedTargets((m) => {
      const next = { ...m };
      for (const x of list) {
        if (d === "goiY") delete next[x.name];
        else next[x.name] = d;
      }
      return next;
    });
  };

  /**
   * Gõ tên chưa có trong ô "Ánh xạ … tới" ⇒ LƯU NGAY vào danh mục đích của dòng (luật
   * ô chọn danh mục — chốt 2026-10-06; trước đây chờ bấm Đồng bộ mới thêm). Trùng tên
   * (không phân hoa thường) ⇒ dùng lại bản có sẵn. Trả về TÊN (value của ô).
   */
  const addCanonicalName = (d: CatalogTarget, t: string): string => {
    const ten = t.trim();
    if (d === "product") {
      const co = products.find((p) => normalize(p.name) === normalize(ten));
      if (co) return co.name;
      setProducts([
        ...products,
        { id: uid(), code: "", name: ten, finishedGoodCode: "", category: inferMaterialCategory(ten), processingType: "" },
      ]);
      notify.saved(`Đã thêm mặt hàng "${ten}" vào danh mục`);
    } else if (d === "material") {
      const co = mtypes.find((m) => normalize(m.name) === normalize(ten));
      if (co) return co.name;
      setMtypes([...mtypes, { id: uid(), name: ten, category: inferMaterialCategory(ten), note: "Từ sổ kho theo tháng" }]);
      notify.saved(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
    }
    return ten;
  };

  /** Một dòng: tên file · đích (Mặt hàng/Loại NL/Bỏ qua) · ánh xạ tới tên CHUẨN. */
  const dongRow = (x: CatalogSyncItem) => {
    const d = targetOf(x);
    const original = d === "product" ? productOpts : materialTypeOpts;
    const edit = d === "product" ? productEditor : d === "material" ? materialTypeEditor : null;
    // Tên đang ánh xạ (tên file, hoặc tên vừa gõ "thêm mới") chưa có trong danh mục ⇒ vẫn phải HIỆN
    // trong ô, kèm nhãn "mới"; không thì Combobox rơi về placeholder, trông như chưa thêm được.
    const ten = mappedName(x);
    const opts =
      ten && !original.some((o) => normalize(o.value) === normalize(ten))
        ? [{ value: ten, label: ten, phu: `mới — thêm vào ${d === "product" ? "Mặt hàng" : "Loại NL"} khi bấm Đồng bộ` }, ...original]
        : original;
    return (
      <div key={x.name} className="flex flex-wrap items-center gap-2 rounded p-1 hover:bg-muted/50">
        <span className="min-w-0 flex-1 truncate text-foreground" title={x.name}>
          {x.name}
        </span>
        <select
          className="h-9 shrink-0 rounded-md border border-border bg-background px-2"
          value={d}
          onChange={(e) => setSavedTargets((m) => ({ ...m, [x.name]: e.target.value as CatalogTarget }))}
          aria-label={`Đích ${x.name}`}
        >
          <option value="product">→ Mặt hàng</option>
          <option value="material">→ Loại NL</option>
          <option value="skip">Bỏ qua</option>
        </select>
        <div className="w-full min-w-0 sm:w-64 sm:shrink-0">
          <Combobox
            hideLabel
            label={`Ánh xạ ${x.name} tới`}
            value={mappedName(x)}
            onChange={(v) => setMapDB((m) => ({ ...m, [x.name]: v }))}
            options={opts}
            onCreate={d === "skip" ? undefined : (t) => addCanonicalName(d, t)}
            onEditItem={edit?.openEdit}
            editLabel={edit?.editLabel}
            canEdit={edit?.canEdit}
            clearable={false}
            placeholder={d === "skip" ? "— bỏ qua —" : "Gõ tìm tên chuẩn / thêm mới"}
          />
        </div>
      </div>
    );
  };

  // ---------- Nhập Excel bảng kê ----------
  const pickFile = () => fileRef.current?.click();
  const napFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const sheets = await parseStockStatementFile(file);
      if (!sheets.length) {
        notify.warning("File không có sheet dữ liệu nào đọc được (mẫu 'bảng kê kho').");
        return;
      }
      const nam = parseYearFromFileName(file.name);
      // Kho mặc định: kho của bản đã nạp cùng năm (nạp lại chỉ CẬP NHẬT) → kho khớp số ở tiêu đề sheet → K1500T.
      const daNap = lines.find((l) => l.id.startsWith("xlsx|") && l.id.split("|")[3] === String(nam));
      const so = parseWarehouseFromTitle(sheets[0]?.tieuDe ?? "");
      const titleWarehouse = so ? BSF1_WAREHOUSES.find((w) => w.code.includes(so) || w.name.includes(so))?.name : undefined;
      setNapForm({ sheets, nam, warehouse: daNap?.warehouse ?? titleWarehouse ?? DEFAULT_WAREHOUSE });
    } catch (err) {
      notify.error(`Không đọc được file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  const importRowCount = napForm
    ? napForm.sheets.reduce((s, sh) => s + (sh.monthNum ? sh.rows.length : 0), 0)
    : 0;
  /** Soát trước khi nạp: số kho ở tiêu đề sheet + bản nạp cũ của cùng năm ở kho KHÁC (nạp nhầm = cộng đôi). */
  const importCheck = useMemo(() => {
    if (!napForm) return null;
    const titleWarehouses = [...new Set(napForm.sheets.map((sh) => parseWarehouseFromTitle(sh.tieuDe)).filter(Boolean))];
    const ma = warehouseCode(napForm.warehouse.trim());
    const otherWarehouses = new Map<string, number>();
    for (const l of lines) {
      const p = l.id.split("|");
      if (p[0] === "xlsx" && p[3] === String(napForm.nam) && p[1] !== ma) otherWarehouses.set(l.warehouse, (otherWarehouses.get(l.warehouse) ?? 0) + 1);
    }
    const titleMismatch = titleWarehouses.length > 0 && !titleWarehouses.some((so) => napForm.warehouse.includes(so) || ma.includes(so));
    const nhom = new Map<string, number>();
    const noteWarehouses = new Map<string, number>();
    for (const sh of napForm.sheets)
      for (const r of sh.rows) {
        nhom.set(r.category, (nhom.get(r.category) ?? 0) + 1);
        if (r.khoGhi) {
          const ten = findWarehouseByText(r.khoGhi, storageLocationCatalog) ?? `${buildNewWarehouseName(r.khoGhi)} (mới)`;
          noteWarehouses.set(ten, (noteWarehouses.get(ten) ?? 0) + 1);
        }
      }
    return { soTieuDe: titleWarehouses, tieuDeLech: titleMismatch, khacKho: [...otherWarehouses], nhom: [...nhom], gui: [...noteWarehouses] };
  }, [napForm, lines, storageLocationCatalog]);

  const confirmImport = () => {
    if (!napForm) return;
    const { sheets, nam, warehouse: targetWarehouse } = napForm;
    if (nam < 2000 || nam > 2100) {
      notify.warning("Năm không hợp lệ (2000–2100).");
      return;
    }
    // Hai sheet cùng một tháng (VD "8" và "T8") ⇒ cùng id ⇒ không nạp được, bắt sửa file.
    const duplicateMonths = sheets
      .filter((sh) => sh.monthNum != null)
      .map((sh) => sh.monthNum)
      .filter((m, i, a) => a.indexOf(m) !== i);
    if (duplicateMonths.length) {
      notify.warning(`File có nhiều sheet cùng tháng ${[...new Set(duplicateMonths)].join(", ")} — giữ một sheet mỗi tháng rồi nạp lại.`);
      return;
    }
    const maNap = warehouseCode(targetWarehouse.trim());
    const newLines: MonthlyStockLine[] = [];
    // Cột R "GỬI KHO HP / Á D…" ⇒ vị trí = kho trong danh mục kho lưu (khớp mã KHP/KAD hoặc tên);
    // viết tắt lạ ⇒ tạo mục kho thuê ngoài mới. Dòng KHÔNG ghi kho ⇒ để "" — `ghepNapLai` giữ vị trí
    // đã gán tay của dòng cũ khớp (cùng tên hàng), trống = kho của sổ.
    const warehouseCatalog = [...storageLocationCatalog];
    const addedWarehouses: string[] = [];
    const resolveWarehouse = (rawText: string) => {
      const co = findWarehouseByText(rawText, warehouseCatalog);
      if (co) return co;
      const name = buildNewWarehouseName(rawText);
      warehouseCatalog.push({ id: uid(), code: `K${toWarehouseKey(rawText)}`, name, kind: "thue-ngoai", address: "", phone: "", note: "Từ bảng kê kho (cột ghi chú)" });
      addedWarehouses.push(name);
      return name;
    };
    for (const sh of sheets) {
      const monthNum = sh.monthNum;
      if (monthNum == null) continue;
      const period = `${nam}-${String(monthNum).padStart(2, "0")}`;
      sh.rows.forEach((r, idx) => {
        // id theo SỐ tháng, không theo tên sheet (đổi "8" → "T8" vẫn cùng id) — xem idDongNap.
        const id = idDongNap(maNap, monthNum, nam, r.rowIndex);
        newLines.push({
          id,
          period,
          category: r.category,
          warehouse: targetWarehouse.trim(),
          itemName: r.itemName,
          size: r.size,
          origin: r.origin,
          importDate: r.importDate,
          storageLocation: r.khoGhi ? resolveWarehouse(r.khoGhi) : "",
          kgPerCtn: r.kgPerCtn,
          unitPrice: r.unitPrice,
          openCtn: r.openCtn,
          openKg: r.openKg,
          inCtn: r.inCtn,
          inKg: r.inKg,
          outCtn: r.outCtn,
          outKg: r.outKg,
          carriedFromId: "",
          sortOrder: idx,
          note: r.ghiChu ? `Bảng kê: ${r.ghiChu}` : "",
        });
      });
    }
    if (!newLines.length) {
      notify.warning("Không nạp được tháng nào — tên sheet phải là số tháng (1–12).");
      return;
    }
    // Dòng nạp lần trước của CÙNG kho + tháng (theo `period` của dòng, nhận cả id dạng cũ theo tên
    // sheet) mà file mới không còn: toàn số 0 ⇒ bỏ; còn số ⇒ giữ + cảnh báo (không xoá lặng lẽ).
    // Dòng đã TÁCH khi chuyển kho một phần: nạp lại trả dòng gốc về số trong file ⇒ phần tách đếm 2 lần.
    const result = ghepNapLai(lines, newLines, maNap);
    const { cuConSo: staleWithQty, soTach: splitCount, lechTen: nameMismatches } = result;
    writeLines(result.lines);
    if (addedWarehouses.length) setStorageLocationCatalog(warehouseCatalog);
    if (nameMismatches.length)
      notify.warning(
        `${nameMismatches.length} dòng đổi tên hàng so với lần nạp trước (file chèn/xoá dòng?) — không giữ vị trí/ghi chú cũ cho các dòng này: ${nameMismatches
          .slice(0, 3)
          .map((x) => `${x.cu.itemName} → ${x.moi.itemName}`)
          .join(", ")}${nameMismatches.length > 3 ? "…" : ""}`
      );
    if (staleWithQty.length)
      notify.warning(`${staleWithQty.length} dòng nạp lần trước không còn trong file mới nhưng còn số — giữ nguyên, kiểm lại: ${staleWithQty.slice(0, 5).map((l) => l.itemName).join(", ")}${staleWithQty.length > 5 ? "…" : ""}`);
    if (splitCount) notify.warning(`${splitCount} dòng từng tách khi chuyển kho một phần vẫn còn — dòng gốc đã về số trong file, kiểm lại kẻo cộng đôi.`);
    const firstPeriod = [...new Set(newLines.map((m) => m.period))].sort()[0];
    setMonth(firstPeriod);
    setWarehouse(ALL_WAREHOUSES);
    setNapForm(null);
    const idNap = new Set(newLines.map((m) => m.id));
    const depositedCount = result.lines.filter((m) => idNap.has(m.id) && m.storageLocation && m.storageLocation !== m.warehouse).length;
    notify.saved(
      `Đã nạp ${newLines.length} dòng · ${new Set(newLines.map((m) => m.period)).size} tháng từ Excel bảng kê` +
        (depositedCount ? ` · ${depositedCount} dòng gửi kho ngoài` : "") +
        (result.thayIdCu ? ` · thay ${result.thayIdCu} dòng nạp cũ (tên sheet cũ)` : "") +
        (addedWarehouses.length ? ` · thêm kho mới: ${addedWarehouses.join(", ")}` : ""),
    );
  };

  // ---------- Thẻ số liệu ----------
  const the: StatCardData[] = [
    { label: "Tồn đầu kỳ", value: `${num(total.openKg)} kg`, numeric: true, icon: Snowflake, color: "trung-tinh" },
    { label: "Nhập trong kỳ", value: `${num(total.inKg)} kg`, numeric: true, icon: ArrowDownToLine, color: "brand" },
    { label: "Xuất trong kỳ", value: `${num(total.outKg)} kg`, numeric: true, icon: Ship, color: "warning" },
    { label: "Tồn cuối kỳ", value: `${num(total.closeKg)} kg`, numeric: true, icon: Scale, color: "success" },
    { label: "Tiền còn lại", value: `${num(Math.round(total.remainingValue))} đ`, numeric: true, icon: Coins, color: "brand" },
  ];

  // ---------- Cột bảng xem (theo kg — kiện vẫn lưu nhưng không hiện) ----------
  /** Vị trí hiển thị: đã gán thì tên kho lưu, chưa gán ⇒ hàng đang ở chính kho của sổ. */
  const locationOf = (r: MonthlyStockLine) => r.storageLocation || r.warehouse;
  /** Vị trí là KHO NGOÀI (thuê ngoài, VD Ánh Dương/HP) — không phải 5 kho hệ thống. */
  const isExternalStorage = (location: string) => !!location.trim() && !WAREHOUSE_CODES.has(location.trim());
  /** Nhãn cột Vị trí: hàng gửi kho ngoài ghi rõ "Gửi: <kho>" cho kế toán thấy ngay. */
  const locationLabel = (r: MonthlyStockLine) => (isExternalStorage(r.storageLocation) ? `Gửi: ${r.storageLocation}` : locationOf(r));
  /* Ô gõ thẳng trên bảng (quy tắc bảng tự dựng — design-system README §5d): ô số là
     `NumberInput` (gõ biểu thức, Esc trả số cũ, ghi theo phím) có `navCol` ⇒ ↑/↓/Enter đi
     dọc cột trong khung `[data-grid-nav]`; Tab đi ngang. Bản XEM TRƯỚC dồn kỳ cũng gõ
     được: lần gõ đầu tự kế thừa & lưu (xem `soNenDeGhi`). Tên · nhóm đổi ở nút ✎. */
  const canEdit = true;
  const oChu =
    "h-9 rounded-md border border-input bg-background px-2 text-sm focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none";
  const oSo = (r: MonthlyStockRow, c: (typeof NUMERIC_COLS)[number], label: string, template?: string) => (
    <NumberInput
      value={r[c] || null}
      onChange={(v) => editLedger(r.id, { [c]: v ?? 0 } as Partial<MonthlyStockLine>)}
      emptyIsZero
      navCol={c}
      data-row={r.id}
      onPaste={(e) => pasteBlock(e, r.id, c)}
      aria-label={`${label} — ${r.itemName}${r.size ? " " + r.size : ""}`}
      title={`${label}: gõ số hoặc phép tính (VD 1200+350). Enter / ↑ / ↓ sang dòng khác, dán được cả khối từ Excel.`}
      wrapperClassName="ml-auto w-24"
      className={`${oChu} w-full ${template ?? ""}`}
    />
  );
  const summaryColumns = (t: ReturnType<typeof sumMonthlyStockRows>): SummaryTableColumn<MonthlyStockRow>[] => [
    {
      key: "ngay",
      header: "Ngày nhập",
      render: (r) =>
        canEdit ? (
          <input
            type="date"
            value={r.importDate || ""}
            onChange={(e) => editLedger(r.id, { importDate: e.target.value })}
            aria-label={`Ngày nhập — ${r.itemName}`}
            title="Ngày nhập lô — sửa thẳng tại đây."
            className={`${oChu} w-36`}
          />
        ) : (
          <span className="tnum whitespace-nowrap">{r.importDate ? formatDateVN(r.importDate) : "—"}</span>
        ),
    },
    {
      key: "ten",
      header: "Mặt hàng",
      // Tên dài xuống dòng trong khung ≤ 13rem thay vì kéo cả bảng rộng ra.
      render: (r) => (
        <span className="block max-w-52 min-w-28 font-semibold whitespace-normal text-foreground">{r.itemName}</span>
      ),
    },
    // Size là CỘT RIÊNG (theo bảng kê của kế toán), không còn là dòng phụ dưới tên hàng.
    {
      key: "size",
      header: "Size",
      render: (r) =>
        canEdit ? (
          <input
            value={r.size}
            onChange={(e) => editLedger(r.id, { size: e.target.value })}
            aria-label={`Size — ${r.itemName}`}
            title="Size — sửa thẳng tại đây."
            className={`${oChu} w-20`}
          />
        ) : (
          <span className="whitespace-nowrap">{r.size || "—"}</span>
        ),
    },
    {
      key: "invoice",
      header: "Invoice",
      render: (r) =>
        canEdit ? (
          <input
            value={r.origin}
            onChange={(e) => editLedger(r.id, { origin: e.target.value })}
            aria-label={`Invoice — ${r.itemName}`}
            title="Số invoice của lô — sửa thẳng tại đây."
            className={`${oChu} w-28`}
          />
        ) : (
          r.origin || "—"
        ),
    },
    {
      key: "gia", header: "Đơn giá (đ)", numeric: true,
      render: (r) => (canEdit ? oSo(r, "unitPrice", "Đơn giá") : soHoacGach(r.unitPrice ?? 0)),
    },
    {
      key: "odKg", header: "Tồn đầu kỳ (kg)", numeric: true,
      render: (r) => (canEdit ? oSo(r, "openKg", "Tồn đầu kỳ") : soHoacGach(r.openKg)),
      total: () => num(t.openKg),
    },
    {
      key: "inKg", header: "Nhập trong kỳ (kg)", numeric: true,
      render: (r) =>
        canEdit ? (
          oSo(r, "inKg", "Nhập trong kỳ", r.inKg ? "font-semibold text-success" : "")
        ) : r.inKg ? (
          <span className="font-semibold text-success">+{num(r.inKg)}</span>
        ) : (
          "—"
        ),
      total: () => num(t.inKg),
    },
    {
      key: "outKg", header: "Xuất trong kỳ (kg)", numeric: true,
      render: (r) =>
        canEdit ? (
          oSo(r, "outKg", "Xuất trong kỳ", r.outKg ? "font-semibold text-warning" : "")
        ) : r.outKg ? (
          <span className="font-semibold text-warning">−{num(r.outKg)}</span>
        ) : (
          "—"
        ),
      total: () => num(t.outKg),
    },
    {
      key: "ocKg", header: "Tồn cuối kỳ (kg)", numeric: true,
      render: (r) => <span className="tnum font-bold text-foreground">{num(r.closeKg)}</span>,
      total: () => num(t.closeKg),
    },
    {
      key: "tien", header: "Tiền còn lại (đ)", numeric: true,
      render: (r) => (r.remainingValue ? num(Math.round(r.remainingValue)) : "—"),
      total: () => num(Math.round(t.remainingValue)),
    },
    {
      key: "viTri",
      header: "Vị trí",
      render: (r) =>
        canEdit ? (
          <div className="w-40">
            <Combobox
              hideLabel
              label={`Vị trí — ${r.itemName}`}
              value={r.storageLocation}
              onChange={(v) => editLedger(r.id, { storageLocation: v })}
              options={locationOptions}
              onCreate={addLocation}
              onEditItem={storageLocationEditor.openEdit}
              editLabel={storageLocationEditor.editLabel}
              canEdit={storageLocationEditor.canEdit}
              clearable={false}
              placeholder={r.warehouse ? `= ${r.warehouse}` : "Chọn kho"}
            />
          </div>
        ) : isExternalStorage(r.storageLocation) ? (
          <Tag variant="vi-tri">{locationLabel(r)}</Tag>
        ) : (
          <span
            className={
              r.storageLocation
                ? "whitespace-nowrap font-medium text-foreground"
                : "whitespace-nowrap text-muted-foreground"
            }
          >
            {locationLabel(r) || "—"}
          </span>
        ),
    },
    {
      key: "thaotac", header: "", render: (r) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Thẻ kho ${r.itemName}`}
            title="Thẻ kho — lịch sử mặt hàng này qua các tháng"
            onClick={() => setViewedCard(r)}
          >
            <History className="size-4" />
          </Button>
          {!isPreview && (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Lấy ra / gửi kho ${r.itemName}`}
                title="Lấy hàng ra sử dụng, nhập thêm, hoặc gửi ra kho ngoài (Ánh Dương, HP…) — nhập số kg rồi lưu."
                onClick={() => openAction(r)}
              >
                <PackageMinus className="size-4" />
              </Button>
              <Button
                title="Sửa dòng: ngày nhập · tên hàng · size · invoice · đơn giá · số kg · vị trí." size="icon-sm" variant="ghost" aria-label={`Sửa ${r.itemName}`} onClick={() => openEdit(r)}>
                <Pencil className="size-4" />
              </Button>
              <ConfirmDelete
                recordDescription={`${r.itemName}${r.size ? " · " + r.size : ""}`}
                onConfirm={() => removeRow(r)}
                trigger={
                  <Button
                    title="Xóa dòng này khỏi tháng. Có hỏi xác nhận, xóa xong vẫn còn nút Hoàn tác." size="icon-sm" variant="ghost" aria-label={`Xóa ${r.itemName}`}>
                    <Trash2 className="size-4" />
                  </Button>
                }
              />
            </>
          )}
        </div>
      ),
    },
  ];

  const hasData = sourceRows.length > 0;
  /** Có dòng gốc nhưng ô tìm không khớp gì — phân biệt với "tháng chưa có số liệu". */
  const noSearchMatch = hasData && monthRows.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <CalendarRange className="h-8 w-8 text-primary" />
            Sổ kho theo tháng
          </h1>
          <p className="mt-1 text-muted-foreground">
            Kỳ = tháng dương lịch. Tồn cuối = tồn đầu + nhập − xuất. Hết tháng, bấm "Dồn sang tháng sau" để tồn
            cuối kỳ này thành tồn đầu kỳ sau — hết chép tay.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={napFile} />
          <Button
            variant="outline"
            onClick={pickFile}
            title="Đọc file Excel 'bảng kê kho' của kế toán — mỗi sheet một tháng. Nạp lại cùng file + cùng kho chỉ cập nhật, không nhân đôi dòng."
          >
            <Upload className="mr-2 h-4 w-4" />
            Nhập Excel bảng kê
          </Button>
          <Button
            variant="outline"
            onClick={openSyncDialog}
            title="Đối chiếu tên hàng trong sổ với danh mục Loại nguyên liệu và Mặt hàng, rồi ánh xạ từng tên về tên chuẩn. Không đụng 141 mã thành phẩm kế toán."
          >
            <Library className="mr-2 h-4 w-4" />
            Đồng bộ danh mục{needsSync.length ? ` (${needsSync.length})` : ""}
          </Button>
          <Button
            onClick={() => setMoIn(true)}
            disabled={!hasData}
            title="Xem trước bản in A4. Có tick dòng thì chỉ in đúng mấy dòng đó kèm tổng của chúng."
          >
            <Printer className="mr-2 h-4 w-4" />
            In A4{selectedRows.length ? ` (${selectedRows.length} dòng chọn)` : ""}
          </Button>
        </div>
      </div>

      {/* Bộ lọc: tháng + kho */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full items-end gap-1 sm:w-auto">
          <Button
            title="Lùi về tháng liền trước."
            variant="outline"
            size="icon"
            aria-label="Tháng trước"
            onClick={() => setMonth(getPrevMonth(month))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1 sm:min-w-[12rem] sm:flex-none">
            <Combobox
              label="Kỳ (tháng)"
              hideRequiredMark
              clearable={false}
              value={month}
              onChange={setMonth}
              options={monthOptions}
            />
          </div>
          <Button
            title="Tới tháng liền sau."
            variant="outline"
            size="icon"
            aria-label="Tháng sau"
            onClick={() => setMonth(getNextMonth(month))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-w-0 flex-1 sm:min-w-[12rem] sm:flex-none">
          <Combobox
            label="Kho"
            hideRequiredMark
            clearable={false}
            value={warehouse}
            onChange={(v) => {
              setWarehouse(v);
              clearSelection();
            }}
            options={warehouseOpts}
          />
        </div>
        <div className="min-w-0 flex-1 sm:min-w-[16rem] sm:flex-none">
          <Field label="Tìm mặt hàng">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Gõ tên · size · invoice · vị trí"
              aria-label="Tìm mặt hàng trong tháng"
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {hasData && !isPreview && (
            <>
              <Button
                variant="outline"
                onClick={undo}
                disabled={!lichSu.lui}
                title="Hoàn tác lần ghi vừa rồi trên sổ (Ctrl+Z)."
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Hoàn tác
              </Button>
              <Button
                variant="outline"
                onClick={redo}
                disabled={!lichSu.tien}
                title="Làm lại thao tác vừa hoàn tác (Ctrl+Y)."
              >
                <Redo2 className="mr-2 h-4 w-4" />
                Làm lại
              </Button>
            </>
          )}
          {hasData && !isPreview && (
            <Button
              variant="outline"
              onClick={selectedRows.length ? clearSelection : selectAll}
              title={selectedRows.length ? "Bỏ tick toàn bộ dòng đang chọn." : "Tick hết các dòng đang hiện để xem tổng của cả tháng, hoặc in / xóa theo lô."}
            >
              <ListChecks className="mr-2 h-4 w-4" />
              {selectedRows.length ? "Bỏ chọn hết" : "Chọn tất cả"}
            </Button>
          )}
          {hasData && (emptyRowCount > 0 || hideEmptyRows) && (
            <Button
              variant={hideEmptyRows ? "default" : "outline"}
              aria-pressed={hideEmptyRows}
              onClick={() => {
                setHideEmptyRows((v) => !v);
                clearSelection();
              }}
              title={
                hideEmptyRows
                  ? "Đang ẩn các dòng không có số liệu. Bấm để hiện lại toàn bộ dòng."
                  : "Ẩn các dòng không có số liệu (tồn đầu, nhập, xuất đều bằng 0) cho bảng gọn."
              }
            >
              {hideEmptyRows ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
              {hideEmptyRows ? `Hiện dòng trống (${emptyRowCount})` : `Ẩn dòng trống (${emptyRowCount})`}
            </Button>
          )}
          {hasCarryForward && (
            <Button
              variant="outline"
              className="h-auto min-h-10 max-w-full whitespace-normal text-left"
              onClick={carryToNextMonth}
              title="Lấy tồn cuối tháng này làm tồn đầu tháng sau, cho MỌI kho (bỏ qua bộ lọc kho). Chạy lại chỉ cập nhật, không nhân đôi dòng."
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Dồn sang {formatMonthLabel(getNextMonth(month))}
            </Button>
          )}
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          icon={FileSpreadsheet}
          title={`${formatMonthLabel(month)} chưa có số liệu`}
          description={
            priorRows.length
              ? `Bấm "Kế thừa tồn cuối ${formatMonthLabel(prevMonth)}" để dồn tồn cuối tháng trước thành tồn đầu tháng này, hoặc "Thêm dòng" để nhập tay.`
              : `Bấm "Thêm dòng" để nhập bảng kê kho của ${formatMonthLabel(month)} (tồn đầu · nhập · xuất theo từng mặt hàng).`
          }
          action={
            priorRows.length ? (
              <Button
                onClick={carryFromPrevMonth}
                title="Lấy tồn cuối tháng trước làm tồn đầu tháng này và GHI vào sổ. Chạy lại chỉ cập nhật, không nhân đôi dòng."
              >
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Kế thừa tồn cuối {formatMonthLabel(prevMonth)}
              </Button>
            ) : (
              <Button onClick={() => openAdd()} title="Thêm tay dòng đầu tiên cho tháng này (tên hàng · tồn đầu · nhập · xuất).">
                <Plus className="mr-2 h-4 w-4" />
                Thêm dòng
              </Button>
            )
          }
        />
      ) : (
        <>
          {isPreview && (
            <div className="space-y-2 rounded-xl border border-primary/50 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">
                    Xem trước tồn đầu {formatMonthLabel(month)} — kế thừa từ tồn cuối {formatMonthLabel(prevMonth)} (
                    {previewRows.length} dòng · {num(total.closeKg)} kg). CHƯA LƯU.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tháng này chưa có dòng nào nên số dưới đây là tồn đầu DỰ KIẾN tính từ tháng trước.
                    Gõ thẳng vào bảng là tự kế thừa &amp; lưu rồi ghi số vừa gõ (Ctrl+Z lùi cả hai), hoặc bấm
                    "Kế thừa &amp; lưu vào sổ". Chạy lại chỉ cập nhật, không nhân đôi.
                  </p>
                  <div className="pt-1">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={carryFromPrevMonth}
                      title="Ghi bảng xem trước này vào sổ làm tồn đầu tháng. Ghi xong mới gõ được nhập/xuất. Chạy lại chỉ cập nhật, không nhân đôi."
                    >
                      <ArrowDownToLine className="mr-2 h-4 w-4" />
                      Kế thừa &amp; lưu vào sổ
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <StatCardGrid cards={the} />

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
            {invariantHolds ? (
              <span className="flex items-center gap-2 text-base font-semibold text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                Khớp bất biến: {num(total.openKg)} + {num(total.inKg)} − {num(total.outKg)} = {num(total.closeKg)} kg
              </span>
            ) : (
              <span className="text-base font-semibold text-destructive">
                Lệch bất biến — kiểm lại số liệu (tồn đầu + nhập − xuất ≠ tồn cuối).
              </span>
            )}
            <Tag variant="phu" className="ml-auto">
              {monthRows.length} mặt hàng · {nhomList.length} nhóm
            </Tag>
          </div>

          {hasData && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Cách thao tác:</span>
              <span>gõ thẳng vào ô trên bảng (Enter / ↑ / ↓ đi dọc cột, dán được khối từ Excel, Ctrl+Z hoàn tác); thêm dòng ở ô "Dòng mới" cuối mỗi bảng;</span>
              <span>
                lấy ra dùng · nhập thêm · gửi kho ngoài theo số kg → bấm{" "}
                <PackageMinus className="inline size-4 align-text-bottom" aria-label="nút Lấy ra / gửi kho" /> cuối dòng;
              </span>
              <span>đổi tên · nhóm → nút ✎.</span>
            </p>
          )}

          {noSearchMatch && (
            <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {searchQuery.trim()
                ? `Không có mặt hàng nào khớp "${searchQuery}" trong ${formatMonthLabel(month)}.`
                : `Mọi dòng của ${formatMonthLabel(month)} đều không có số liệu và đang bị ẩn.`}{" "}
              <button
                title="Xóa ô tìm và hiện lại dòng trống để thấy toàn bộ mặt hàng của tháng." type="button" className="underline" onClick={() => { setSearchQuery(""); setHideEmptyRows(false); }}>
                Hiện tất cả
              </button>
            </p>
          )}

          {showDiffWarning && (
            <div className="space-y-2 rounded-xl border border-warning/50 bg-warning/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">
                    Lệch dồn kỳ: tồn đầu {formatMonthLabel(month)} ({num(carryGap.openNay)} kg) ≠ tồn cuối{" "}
                    {formatMonthLabel(prevMonth)} ({num(carryGap.closeTruoc)} kg) — lệch{" "}
                    <span className="text-warning">
                      {carryGap.lech > 0 ? "+" : ""}
                      {num(carryGap.lech)} kg
                    </span>
                    .
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Vòng gối đầu đúng thì tồn đầu tháng này phải bằng tồn cuối tháng trước. Chênh = ghi
                    chép dồn kỳ sai — soi các nhóm dưới rồi sửa lô ghi lệch (giữ số theo sổ, không ghi đè
                    tự động).
                  </p>
                  {carryGap.theoNhom.length > 0 && (
                    <ul className="text-sm text-muted-foreground">
                      {carryGap.theoNhom.map((g) => (
                        <li key={g.category}>
                          • <span className="font-medium text-foreground">{g.category}</span>: cuối{" "}
                          {num(g.closeTruoc)} → đầu {num(g.openNay)} ({g.lech > 0 ? "+" : ""}
                          {num(g.lech)} kg)
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="pt-1">
                    <Button size="sm" onClick={() => setIsCompareOpen(true)} title="Liệt kê từng mặt hàng có tồn đầu tháng này lệch tồn cuối tháng trước, để tự sửa. Chỉ soi — không tự ghi đè số.">
                      <Wrench className="mr-2 h-4 w-4" />
                      Đối chiếu & sửa lệch ({carryComparison.length} mặt hàng)
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Một khung phím cho mọi nhóm: ↓ ở dòng cuối nhóm trên nhảy sang dòng đầu nhóm dưới. */}
          <div className="space-y-8" data-grid-nav>
            {nhomList.map((g) => (
              <section key={g.category} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-foreground">{g.category}</h2>
                  {/* Hai nhãn ngắn thay một nhãn dài — điện thoại + chữ 130% tự xuống dòng, không bị cắt số. */}
                  <span className="flex flex-wrap gap-1">
                    <Tag variant="phu">Tồn cuối {num(g.tong.closeKg)} kg</Tag>
                    <Tag variant="phu">{g.rows.length} mặt hàng</Tag>
                  </span>
                </div>
                <SummaryTable
                  rows={g.rows}
                  columns={summaryColumns(g.tong)}
                  getKey={(r) => r.id}
                  totalLabel={`Cộng ${g.category}`}
                  selection={tableSelection}
                  fullHeight
                  rowMarkKey="ton-kho-thang"
                  addRow={
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                        <Plus className="size-4" aria-hidden />
                        Dòng mới
                      </span>
                      <div className="w-full sm:w-72">
                        <Combobox
                          hideLabel
                          label={`Tên hàng — dòng mới vào ${g.category}`}
                          value=""
                          onChange={(v) => quickAddRow(g.category, v)}
                          onCreate={(t) => t}
                          options={productNameOptions(g.category)}
                          placeholder="Gõ / chọn tên hàng để thêm dòng"
                          clearable={false}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openAdd(g.category)}
                        title={`Mở hộp thêm dòng vào nhóm "${g.category}" để điền nhiều ô một lần (ngày nhập · size · invoice · đơn giá · số kg · vị trí).`}
                      >
                        Thêm đủ thông tin…
                      </Button>
                    </div>
                  }
                />
              </section>
            ))}
          </div>

          {/* Cộng tổng + tô màu các dòng đang tick — kiểu bảng kê kế toán. Đặt SAU các
              bảng và DÍNH ĐÁY màn hình từ md (bottom-8: nằm trên thanh cuộn ngang dính đáy
              của bảng xổ): tick dòng cuối bảng vẫn thấy nút, khỏi lăn ngược lên đầu trang.
              Điện thoại KHÔNG dính — đủ nút + số tổng thì thanh cao ~3/4 màn (360px, chữ
              130%); thanh nằm ngay dưới bảng nên kéo xuống chút là tới. */}
          {selectedRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary/40 bg-card p-3 print:hidden md:sticky md:bottom-8 md:z-30 md:shadow-lg">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <Sigma className="h-5 w-5 text-primary" aria-hidden />
                Đã chọn {selectedRows.length} dòng
              </span>
              <span className="tnum text-sm text-muted-foreground">
                tồn đầu {num(selectedTotal.openKg)} kg
              </span>
              <span className="tnum text-sm text-muted-foreground">
                nhập {num(selectedTotal.inKg)} kg
              </span>
              <span className="tnum text-sm text-muted-foreground">
                xuất {num(selectedTotal.outKg)} kg
              </span>
              <span className="tnum text-sm font-semibold text-foreground">
                tồn cuối {num(selectedTotal.closeKg)} kg
              </span>
              <span className="tnum text-sm text-muted-foreground">
                tiền còn lại {num(Math.round(selectedTotal.remainingValue))} đ
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {!isPreview && (
                  <Button size="sm" variant="outline" onClick={() => setAssignLocation("")} title="Đánh dấu các dòng đang tick là GỬI ra kho ngoài (VD Kho Ánh Dương, HP). Chỉ ghi nơi để hàng, không đổi số kg.">
                    <MapPin className="mr-2 h-4 w-4" />
                    Gửi kho ngoài
                  </Button>
                )}
                <RowMarkActions marker={rowMark} selectedKeys={selectedRows.map((r) => r.id)} />
                <Button size="sm" variant="outline" onClick={() => setMoIn(true)} title="In riêng các dòng đang tick, kèm dòng tổng của đúng mấy dòng đó.">
                  <Printer className="mr-2 h-4 w-4" />
                  In {selectedRows.length} dòng
                </Button>
                {!isPreview && (
                  <ConfirmDelete
                    recordDescription={`${selectedRows.length} dòng ${formatMonthLabel(month)}`}
                    onConfirm={deleteSelected}
                    trigger={
                      <Button size="sm" variant="ghost" title="Xóa các dòng đang tick khỏi tháng này. Có hỏi xác nhận, và xóa xong vẫn còn nút Hoàn tác.">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Xóa dòng đã chọn
                      </Button>
                    }
                  />
                )}
                <Button size="sm" variant="ghost" onClick={clearSelection} title="Bỏ tick toàn bộ dòng đang chọn.">
                  Bỏ chọn
                </Button>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {formatMonthLabel(month)}
            {warehouse !== ALL_WAREHOUSES ? ` · kho ${warehouse}` : " · tất cả kho"}. "Dồn sang tháng sau" kế thừa tồn cuối
            (mọi kho) thành tồn đầu kỳ sau; chạy lại chỉ cập nhật, không nhân đôi.
          </p>
        </>
      )}

      {/* Dialog thêm / sửa dòng */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">{form?.id ? "Sửa dòng kho" : "Thêm dòng kho"}</DialogTitle>
            <DialogDescription className="text-base">
              {formatMonthLabel(month)} — nhập tồn đầu · nhập · xuất theo kg. Tồn cuối và tiền còn lại tự tính.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="max-h-[70dvh] space-y-4 overflow-y-auto py-2 pr-1">
              <ErrorSummary errors={loi} />
              <RequiredLegend />
              <div className="grid gap-4 sm:grid-cols-2">
                <Combobox
                  label="Nhóm hàng"
                  required
                  value={form.category}
                  onChange={(v) => setForm((f) => (f ? { ...f, category: v } : f))}
                  options={[
                    ...new Set(
                      [
                        ...MONTHLY_STOCK_CATEGORIES,
                        ...lines.map((l) => l.category),
                        form.category,
                      ].filter(Boolean)
                    ),
                  ].map((c) => ({ value: c, label: c }))}
                  onCreate={(t) => t}
                />
                <Combobox
                  label="Kho"
                  value={form.warehouse}
                  onChange={(v) => setForm((f) => (f ? { ...f, warehouse: v } : f))}
                  options={SYSTEM_WAREHOUSES}
                  onCreate={(t) => t}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField
                  label="Ngày nhập"
                  value={form.importDate}
                  onChange={(v) => setForm((f) => (f ? { ...f, importDate: v } : f))}
                />
                <Field label="Tên hàng" required>
                  <Input
                    value={form.itemName}
                    onChange={(e) => setForm((f) => (f ? { ...f, itemName: e.target.value } : f))}
                    placeholder="VD: CÁ SÒNG"
                  />
                </Field>
                <Field label="Size">
                  <Input
                    value={form.size}
                    onChange={(e) => setForm((f) => (f ? { ...f, size: e.target.value } : f))}
                    placeholder="VD: 80↑"
                  />
                </Field>
                <Field label="Invoice">
                  <Input
                    value={form.origin}
                    onChange={(e) => setForm((f) => (f ? { ...f, origin: e.target.value } : f))}
                    placeholder="Số invoice"
                  />
                </Field>
                <NumberField
                  label="Đơn giá"
                  unit="đ"
                  value={form.unitPrice}
                  onChange={(v) => setForm((f) => (f ? { ...f, unitPrice: v } : f))}
                />
                <Combobox
                  label="Vị trí"
                  value={form.storageLocation}
                  onChange={(v) => setForm((f) => (f ? { ...f, storageLocation: v } : f))}
                  options={locationOptions}
                  onCreate={addLocation}
                  onEditItem={storageLocationEditor.openEdit}
                  editLabel={storageLocationEditor.editLabel}
                  canEdit={storageLocationEditor.canEdit}
                  placeholder={form.warehouse ? `Để trống = ${form.warehouse}` : "Chọn kho đang giữ hàng"}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField label="Tồn đầu kỳ" unit="kg" value={form.openKg} onChange={(v) => setForm((f) => (f ? { ...f, openKg: v } : f))} />
                <NumberField label="Nhập trong kỳ" unit="kg" value={form.inKg} onChange={(v) => setForm((f) => (f ? { ...f, inKg: v } : f))} />
                <NumberField label="Xuất trong kỳ" unit="kg" value={form.outKg} onChange={(v) => setForm((f) => (f ? { ...f, outKg: v } : f))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Hủy
            </Button>
            <Button onClick={saveRow} title="Ghi dòng này vào sổ tháng đang xem. Tồn cuối và tiền còn lại tự tính, không phải gõ.">
              <Plus className="mr-1 h-4 w-4" />
              {form?.id ? "Lưu dòng" : "Thêm dòng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog thao tác một dòng: lấy ra dùng · nhập thêm · chuyển vị trí */}
      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="w-full sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {action?.row.itemName}
              {action?.row.size ? ` · ${action.row.size}` : ""}
            </DialogTitle>
            <DialogDescription className="text-base">
              {action
                ? `Đang ở ${locationOf(action.row) || "(chưa rõ)"} · tồn cuối ${num(action.row.closeKg)} kg${action.row.origin ? ` · invoice ${action.row.origin}` : ""}.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {action && (
            <div className="space-y-4 py-2">
              <ErrorSummary errors={loiTT} />
              <div role="radiogroup" aria-label="Việc cần làm" className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["xuat", "Lấy ra sử dụng", "Xuất đi sản xuất / bán — trừ vào tồn."],
                    ["chuyen", "Gửi kho ngoài", "Gửi ra kho ngoài (Ánh Dương, HP…) hoặc đổi chỗ — tồn không đổi."],
                    ["nhap", "Nhập thêm", "Hàng về thêm cho đúng lô này."],
                  ] as const
                ).map(([k, label, description]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={action.kind === k}
                    title={description}
                    onClick={() => setAction((s) => (s ? { ...s, kind: k } : s))}
                    className={
                      action.kind === k
                        ? "min-h-11 rounded-lg border-2 border-primary bg-primary/10 px-3 py-2 text-left"
                        : "min-h-11 rounded-lg border-2 border-border px-3 py-2 text-left hover:bg-muted"
                    }
                  >
                    <div className="font-semibold text-foreground">{label}</div>
                    <div className="text-sm text-muted-foreground">{description}</div>
                  </button>
                ))}
              </div>
              <RequiredLegend />
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Số kg"
                  required
                  unit="kg"
                  value={action.kg}
                  onChange={(v) => setAction((s) => (s ? { ...s, kg: v } : s))}
                />
                <DateField
                  label="Ngày thực hiện"
                  value={action.date}
                  onChange={(v) => setAction((s) => (s ? { ...s, date: v } : s))}
                />
              </div>
              {action.kind === "chuyen" && (
                <Combobox
                  label="Gửi tới kho (VD Kho Ánh Dương, HP)"
                  required
                  value={action.location}
                  onChange={(v) => setAction((s) => (s ? { ...s, location: v } : s))}
                  options={locationOptions}
                  onCreate={addLocation}
                  onEditItem={storageLocationEditor.openEdit}
                  editLabel={storageLocationEditor.editLabel}
                  canEdit={storageLocationEditor.canEdit}
                  clearable={false}
                />
              )}
              {action.kind !== "nhap" && action.row.closeKg > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAction((s) => (s ? { ...s, kg: s.row.closeKg } : s))}
                  title="Điền sẵn toàn bộ tồn cuối của dòng vào ô Số kg."
                >
                  Lấy hết {num(action.row.closeKg)} kg
                </Button>
              )}
              <Field label="Ghi chú (không bắt buộc)">
                <Input
                  value={action.reason}
                  onChange={(e) => setAction((s) => (s ? { ...s, reason: e.target.value } : s))}
                  placeholder="VD: xuất xưởng Cá, lệnh SX…"
                />
              </Field>
              <p className="text-sm text-muted-foreground">
                {action.kind === "xuat" &&
                  "Số kg được CỘNG vào cột Xuất trong kỳ của dòng này; tồn cuối tự giảm."}
                {action.kind === "nhap" &&
                  "Số kg được CỘNG vào cột Nhập trong kỳ. Hàng lô khác (ngày nhập / invoice khác) thì dùng nút Thêm dòng."}
                {action.kind === "chuyen" &&
                  "Gửi HẾT tồn cuối ⇒ chỉ đổi Vị trí của dòng (cột Vị trí ghi \"Gửi: <kho>\"). Gửi MỘT PHẦN ⇒ tách thành dòng mới ở kho nhận. Tổng nhập / xuất / tồn của tháng không đổi."}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              Hủy
            </Button>
            <Button onClick={saveAction} title="Ghi thao tác này vào sổ tháng đang xem, kèm ghi chú ngày và số kg ở nhật ký dòng. Có nút Hoàn tác sau khi lưu.">
              <PackageMinus className="mr-1 h-4 w-4" />
              Lưu thao tác
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog gán vị trí cho dòng đang tick */}
      <Dialog open={assignLocation !== null} onOpenChange={(o) => !o && setAssignLocation(null)}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Gửi kho ngoài · {selectedRows.length} dòng</DialogTitle>
            <DialogDescription className="text-base">
              Chọn kho đang giữ hàng (VD Kho Ánh Dương, HP). Gõ tên mới sẽ tự lưu vào danh mục kho thuê ngoài. Chỉ ghi cột Vị trí, không đổi số kg hay sổ kho.
            </DialogDescription>
          </DialogHeader>
          {assignLocation !== null && (
            <div className="space-y-4 py-2">
              <RequiredLegend />
              <Combobox
                label="Kho nhận (VD Kho Ánh Dương, HP)"
                required
                value={assignLocation}
                onChange={(v) => setAssignLocation(v)}
                options={locationOptions}
                onCreate={addLocation}
                onEditItem={storageLocationEditor.openEdit}
                editLabel={storageLocationEditor.editLabel}
                canEdit={storageLocationEditor.canEdit}
                clearable={false}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignLocation(null)}>
              Hủy
            </Button>
            <Button onClick={assignLocationToSelected} title="Ghi vị trí vừa chọn cho tất cả dòng đang tick. Có nút Hoàn tác sau khi lưu.">
              <MapPin className="mr-1 h-4 w-4" />
              Gán vị trí
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog nhập Excel bảng kê */}
      <Dialog open={!!napForm} onOpenChange={(o) => !o && setNapForm(null)}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Nhập Excel bảng kê kho</DialogTitle>
            <DialogDescription className="text-base">
              Mỗi sheet = một tháng. Nạp tồn đầu · nhập · xuất đúng theo file — tồn cuối &
              tiền còn lại app tự suy. Nạp lại cùng file chỉ cập nhật, không nhân đôi.
            </DialogDescription>
          </DialogHeader>
          {napForm && (
            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Năm (cho mọi sheet)">
                  <Input
                    inputMode="numeric"
                    value={String(napForm.nam)}
                    onChange={(e) => {
                      const n = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                      setNapForm((f) => (f ? { ...f, nam: n } : f));
                    }}
                  />
                </Field>
                <Combobox
                  label="Kho (chọn đúng kho cho cả file)"
                  value={napForm.warehouse}
                  onChange={(v) => setNapForm((f) => (f ? { ...f, warehouse: v } : f))}
                  options={SYSTEM_WAREHOUSES}
                  onCreate={(t) => t}
                />
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                      <th className="px-3 py-2">Sheet</th>
                      <th className="px-3 py-2">Tháng</th>
                      <th className="px-3 py-2 text-right">Số dòng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {napForm.sheets.map((sh) => (
                      <tr key={sh.sheetName} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono">{sh.sheetName}</td>
                        <td className="px-3 py-2">
                          {sh.monthNum ? (
                            formatMonthLabel(`${napForm.nam}-${String(sh.monthNum).padStart(2, "0")}`)
                          ) : (
                            <Tag variant="luu-y">bỏ (tên sheet không phải số tháng)</Tag>
                          )}
                        </td>
                        <td className="tnum px-3 py-2 text-right">{sh.rows.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importCheck && (
                <div className="space-y-2 text-sm">
                  {importCheck.soTieuDe.length > 0 && (
                    <p className={importCheck.tieuDeLech ? "font-semibold text-warning" : "text-muted-foreground"}>
                      Tiêu đề sheet ghi: KHO {importCheck.soTieuDe.join(", ")}
                      {importCheck.tieuDeLech && ` — khác kho đang chọn (${napForm.warehouse}). Kiểm lại trước khi nạp.`}
                    </p>
                  )}
                  {importCheck.khacKho.length > 0 && (
                    <p className="font-semibold text-destructive">
                      Năm {napForm.nam} đã có bản nạp ở{" "}
                      {importCheck.khacKho.map(([k, n]) => `${k} (${n} dòng)`).join(", ")}. Nạp vào {napForm.warehouse} sẽ
                      tạo BẢN SAO ⇒ "Tất cả kho" cộng đôi. Muốn nạp lại cùng sổ thì chọn đúng kho cũ.
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Nhóm theo mục trong file: {importCheck.nhom.map(([c, n]) => `${c} (${n})`).join(" · ")}
                  </p>
                  {importCheck.gui.length > 0 && (
                    <p className="text-muted-foreground">
                      Vị trí đọc từ cột ghi chú kho: {importCheck.gui.map(([k, n]) => `${k} (${n})`).join(" · ")}. Dòng
                      không ghi kho ⇒ nằm ở chính {napForm.warehouse}.
                    </p>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Nạp trung thực theo sổ cũ (kể cả lệch dồn kỳ trong file). Sau khi nạp, mở tháng đầu rồi
                bấm "Dồn sang tháng sau" lần lượt để chuẩn hóa tồn đầu các tháng kế.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNapForm(null)}>
              Hủy
            </Button>
            <Button onClick={confirmImport} title="Nạp các sheet đã xem trước vào sổ, theo đúng năm và kho đã chọn. Chọn nhầm kho sẽ tạo bản sao ở kho khác — kiểm lại trước khi bấm.">
              <Upload className="mr-1 h-4 w-4" />
              Nạp {importRowCount} dòng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog đối chiếu lệch dồn kỳ (chẩn đoán theo mặt hàng) */}
      <Dialog open={isCompareOpen} onOpenChange={setIsCompareOpen}>
        <DialogContent className="w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Đối chiếu lệch dồn kỳ theo mặt hàng</DialogTitle>
            <DialogDescription className="text-base">
              So tồn cuối {formatMonthLabel(prevMonth)} ↔ tồn đầu {formatMonthLabel(month)} theo MẶT HÀNG (đã gộp các
              tách size để bỏ báo động giả). Đây là chẩn đoán — bấm "Sửa tay" để lọc bảng về đúng mặt
              hàng đó rồi gõ số thẳng trên bảng theo phán đoán (không tự sửa để tránh cộng đôi khi lô bị tách/đổi mã).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {carryComparison.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-success/50 bg-success/10 p-3 text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                <span className="font-semibold">Khớp — không còn mặt hàng lệch giữa hai tháng.</span>
              </div>
            ) : (
              <div className="max-h-[55dvh] overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="text-left">
                      <th className="px-3 py-2">Mặt hàng · kho · nhóm</th>
                      <th className="px-3 py-2 text-right">Cuối {formatMonthLabel(prevMonth).replace("Tháng ", "T")}</th>
                      <th className="px-3 py-2 text-right">Đầu {formatMonthLabel(month).replace("Tháng ", "T")}</th>
                      <th className="px-3 py-2 text-right">Lệch (kg)</th>
                      <th className="px-3 py-2 text-right">Sửa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carryComparison.map((d) => (
                      <tr key={d.key} className="border-t border-border align-top">
                        <td className="px-3 py-2">
                          <div className="font-medium text-foreground">{d.itemName}</div>
                          <div className="text-xs text-muted-foreground">
                            {[d.warehouse, d.category].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td className="tnum px-3 py-2 text-right">{num(d.closeTruocKg)}</td>
                        <td className="tnum px-3 py-2 text-right">{num(d.openNayKg)}</td>
                        <td className="tnum px-3 py-2 text-right font-semibold text-warning">
                          {d.lechKg > 0 ? "+" : ""}
                          {num(d.lechKg)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => manualFixProduct(d)} title="Mở lưới ghi đã lọc sẵn đúng mặt hàng này, để tự chỉnh tồn đầu / nhập / xuất cho khớp tháng trước.">
                            <Pencil className="mr-1 h-4 w-4" />
                            Sửa tay
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Lệch = ghi chép dồn kỳ chưa khớp (tồn đầu tháng này ≠ tồn cuối tháng trước). "Sửa tay" lọc
              bảng về đúng mặt hàng để bạn gõ thẳng tồn đầu/nhập/xuất; hoặc dùng "Dồn sang tháng sau" từ
              tháng trước cho tháng còn TRỐNG.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompareOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog đồng bộ danh mục loại nguyên liệu */}
      <Dialog open={isSyncOpen} onOpenChange={setIsSyncOpen}>
        <DialogContent className="w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Đồng bộ danh mục</DialogTitle>
            <DialogDescription className="text-base">
              Với mỗi mã khó (2 DA RÂU NGẮN…): chọn ĐÍCH (Mặt hàng / Loại NL) rồi **ánh xạ tới tên CHUẨN
              có sẵn** trong danh mục (gõ tìm) — hoặc gõ thêm mới nếu chưa có. Áp xong: tên chuẩn được thêm
              (nếu mới) và MỌI dòng sổ mang tên cũ được đổi sang tên chuẩn (đồng bộ + gộp trùng cách ghi).
              Tên tự rõ loài (CÁ THU…) gom ở mục "rõ ràng". Thành phẩm 141 mã kế toán cố định — không thêm ở đây.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-wrap gap-2 text-sm">
              <Tag variant="phu">{catalogSync.tongTen} tên trong sổ</Tag>
              <Tag variant="phu">
                đã có: {catalogSync.daCoMH} mặt hàng · {catalogSync.daCoNL} loại NL
              </Tag>
              <Tag variant={needsSync.length > 0 ? "loi" : "phu"}>{needsSync.length} mã khó cần đồng bộ</Tag>
              <Tag variant="phu">{clearNames.length} tên rõ ràng</Tag>
              <Tag variant={catalogSync.nhomTrung.length > 0 ? "loi" : "phu"}>{catalogSync.nhomTrung.length} nhóm trùng cách ghi</Tag>
            </div>

            {needsSync.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <ListChecks className="h-4 w-4" /> {needsSync.length} mã khó — chọn ĐÍCH từng dòng
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setTarget(needsSync, "goiY")} title="Trả mọi mã khó về đích mà hệ thống gợi ý (đoán từ tên: có size/dấu chế biến → Mặt hàng, còn lại → Loại NL).">
                      Theo gợi ý
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setTarget(needsSync, "product")} title="Đặt toàn bộ mã khó về danh mục Mặt hàng.">
                      Tất cả → Mặt hàng
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setTarget(needsSync, "material")} title="Đặt toàn bộ mã khó về danh mục Loại nguyên liệu.">
                      Tất cả → Loại NL
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setTarget(needsSync, "skip")} title="Bỏ qua toàn bộ mã khó lần này — không thêm vào danh mục nào.">
                      Bỏ qua hết
                    </Button>
                  </div>
                </div>
                <div className="max-h-[38dvh] space-y-1 overflow-auto rounded-lg border border-border p-2">
                  {needsSync.map(dongRow)}
                </div>
              </div>
            )}

            {clearNames.length > 0 && (
              <details className="rounded-lg border border-border">
                <summary className="cursor-pointer px-3 py-2 font-medium text-foreground">
                  Tên rõ ràng — tự nhận loài ({clearNames.length}) · CÁ THU/SANMA… (mặc định → Loại NL, đổi được)
                </summary>
                <div className="space-y-2 px-3 pb-3">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setTarget(clearNames, "goiY")} title="Trả các tên rõ ràng về đích hệ thống gợi ý.">
                      Theo gợi ý
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setTarget(clearNames, "material")} title="Đặt toàn bộ tên rõ ràng (cá, tôm, mực nguyên con…) về danh mục Loại nguyên liệu.">
                      Tất cả → Loại NL
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setTarget(clearNames, "product")} title="Đặt toàn bộ tên rõ ràng về danh mục Mặt hàng.">
                      Tất cả → Mặt hàng
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setTarget(clearNames, "skip")} title="Bỏ qua toàn bộ tên rõ ràng lần này.">
                      Bỏ qua hết
                    </Button>
                  </div>
                  <div className="max-h-[30dvh] space-y-1 overflow-auto rounded-lg border border-border p-2">
                    {clearNames.map(dongRow)}
                  </div>
                </div>
              </details>
            )}

            {catalogSync.nhomTrung.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Tên chỉ khác nhau cách ghi (nên gộp về một)</h3>
                <div className="max-h-[28dvh] space-y-1 overflow-auto rounded-lg border border-warning/40 bg-warning/5 p-2 text-sm">
                  {catalogSync.nhomTrung.map((g) => (
                    <div key={g.variants.join("|")} className="text-muted-foreground">
                      • {g.variants.map((v) => `"${v}"`).join("  ·  ")}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Các tên trên bị đếm THÀNH NHIỀU mặt hàng khi tổng hợp. Sửa về một cách ghi bằng nút ✎
                  ở bảng để sổ gộp đúng.
                </p>
              </div>
            )}

            {catalogSync.chuaCo.length === 0 && catalogSync.nhomTrung.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-success/50 bg-success/10 p-3 text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                <span className="font-semibold">Tên trong sổ đã khớp danh mục, không có tên trùng cách ghi.</span>
              </div>
            )}
          </div>
          {/* Nút xác nhận ở CHÂN (dính đáy khi thân cuộn) — trước nằm giữa thân, dưới các danh sách
              dài nên bị cuộn mất. Không disabled (luật §5): chưa chọn gì ⇒ apDongBo tự báo. */}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSyncOpen(false)}>
              Đóng
            </Button>
            {(needsSync.length > 0 || clearNames.length > 0) && (
              <Button onClick={applySync} className="h-auto min-h-11 whitespace-normal" title="Thêm các tên chưa có vào danh mục đã chọn, và đổi tên các dòng sổ mang tên cũ sang tên chuẩn đã ánh xạ.">
                <Library className="mr-2 h-4 w-4" />
                Đồng bộ: {productCount} → Mặt hàng · {materialCount} → Loại NL
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Thẻ kho: lịch sử một mặt hàng qua các tháng (sổ chi tiết vật tư) */}
      <Dialog open={!!viewedCard} onOpenChange={(o) => !o && setViewedCard(null)}>
        <DialogContent className="w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Thẻ kho — {viewedCard?.itemName}</DialogTitle>
            <DialogDescription className="text-base">
              {viewedCard
                ? `${viewedCard.warehouse || "(chưa rõ kho)"} · nhóm ${viewedCard.category || "(chưa phân nhóm)"}. Gộp mọi lô/size của mặt hàng này (cùng cách đối chiếu dồn kỳ) — mỗi tháng một dòng, mới nhất trước.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {viewedCard && (
            <div className="max-h-[70dvh] space-y-4 overflow-y-auto py-2 pr-1">
              <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm sm:grid-cols-2">
                <div>
                  Size: <span className="font-medium text-foreground">{viewedCard.size || "—"}</span>
                </div>
                <div>
                  Invoice: <span className="font-medium text-foreground">{viewedCard.origin || "—"}</span>
                </div>
                <div>
                  Vị trí: <span className="font-medium text-foreground">{locationOf(viewedCard) || "—"}</span>
                </div>
                <div>
                  Đơn giá:{" "}
                  <span className="tnum font-medium text-foreground">
                    {soHoacGach(viewedCard.unitPrice ?? 0)} đ
                  </span>
                </div>
                <div>
                  Ngày nhập:{" "}
                  <span className="font-medium text-foreground">
                    {viewedCard.importDate ? formatDateVN(viewedCard.importDate) : "—"}
                  </span>
                </div>
                {viewedCard.note && (
                  <div className="sm:col-span-2">
                    Nhật ký thao tác:
                    <div className="mt-1 whitespace-pre-line font-medium text-foreground">{viewedCard.note}</div>
                  </div>
                )}
                <div>
                  Dòng này sinh ra do dồn kỳ:{" "}
                  <span className="font-medium text-foreground">{viewedCard.carriedFromId ? "có" : "không"}</span>
                </div>
              </div>

              <HorizontalScroll>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th scope="col" className="border-b border-border px-3 py-2 text-left">Kỳ</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-right">Tồn đầu (kg)</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-right">Nhập (kg)</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-right">Xuất (kg)</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-right">Tồn cuối (kg)</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-right">SL dòng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockCardList.map((t) => (
                      <tr key={t.period} className={t.period === month ? "bg-primary/5" : undefined}>
                        <td className="border-b border-border px-3 py-2 font-medium text-foreground">
                          {formatMonthLabel(t.period)}
                        </td>
                        <td className="tnum border-b border-border px-3 py-2 text-right">{soHoacGach(t.openKg)}</td>
                        <td className="tnum border-b border-border px-3 py-2 text-right text-success">
                          {t.inKg ? `+${num(t.inKg)}` : "—"}
                        </td>
                        <td className="tnum border-b border-border px-3 py-2 text-right text-warning">
                          {t.outKg ? `−${num(t.outKg)}` : "—"}
                        </td>
                        <td className="tnum border-b border-border px-3 py-2 text-right font-bold text-foreground">
                          {num(t.closeKg)}
                        </td>
                        <td className="tnum border-b border-border px-3 py-2 text-right">{t.soDong}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </HorizontalScroll>
              {stockCardList.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Mặt hàng này chưa có dòng nào đã LƯU trong sổ (đang xem trước dồn kỳ).
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Vòng gối đầu đúng thì tồn cuối kỳ trên = tồn đầu kỳ dưới liền kề. Lệch ⇒ soi bằng "Đối chiếu &
                sửa lệch" ở banner cảnh báo.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewedCard(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In A4 — có tick dòng thì in ĐÚNG mấy dòng đó (kèm tổng của chúng) */}
      {moIn && hasData && (
        <PrintSheet
          title="Bảng kê kho theo tháng"
          subtitle={`${formatMonthLabel(month)}${warehouse !== ALL_WAREHOUSES ? ` · kho ${warehouse}` : ""}${
            selectedRows.length ? ` · ${selectedRows.length} dòng đã chọn` : ""
          }${isPreview ? " · XEM TRƯỚC (chưa lưu)" : ""}`}
          onClose={() => setMoIn(false)}
        >
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>Ngày lập: {formatDateVN(todayIso())}</span>
            <span>SL mặt hàng: {rowsIn.length}</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <PrintTh>Nhóm · mặt hàng</PrintTh>
                <PrintTh>Size</PrintTh>
                <PrintTh right>Tồn đầu (kg)</PrintTh>
                <PrintTh right>Nhập (kg)</PrintTh>
                <PrintTh right>Xuất (kg)</PrintTh>
                <PrintTh right>Tồn cuối (kg)</PrintTh>
                <PrintTh right>Tiền còn lại (đ)</PrintTh>
              </tr>
            </thead>
            <tbody>
              <tr>
                <PrintTd bold colSpan={2}>Tổng cộng — {rowsIn.length} mặt hàng</PrintTd>
                <PrintTd bold right>{num(printTotal.openKg)}</PrintTd>
                <PrintTd bold right>{num(printTotal.inKg)}</PrintTd>
                <PrintTd bold right>{num(printTotal.outKg)}</PrintTd>
                <PrintTd bold right>{num(printTotal.closeKg)}</PrintTd>
                <PrintTd bold right>{num(Math.round(printTotal.remainingValue))}</PrintTd>
              </tr>
              {nhomIn.map((g) => (
                <FragmentGroup key={g.category} group={g} />
              ))}
            </tbody>
          </table>
        </PrintSheet>
      )}

      {storageLocationEditor.dialog}
      {productEditor.dialog}
      {materialTypeEditor.dialog}
    </div>
  );
}

/** Một nhóm trên bản in: dòng tiêu đề nhóm + các mặt hàng + dòng cộng nhóm. */
function FragmentGroup({ group }: { group: ReturnType<typeof groupByCategory>[number] }) {
  return (
    <>
      <tr>
        <PrintTd bold colSpan={7}>{group.category}</PrintTd>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.id}>
          <PrintTd>{r.itemName}</PrintTd>
          <PrintTd>{r.size}</PrintTd>
          <PrintTd right>{num(r.openKg)}</PrintTd>
          <PrintTd right>{r.inKg ? num(r.inKg) : ""}</PrintTd>
          <PrintTd right>{r.outKg ? num(r.outKg) : ""}</PrintTd>
          <PrintTd right>{num(r.closeKg)}</PrintTd>
          <PrintTd right>{r.remainingValue ? num(Math.round(r.remainingValue)) : ""}</PrintTd>
        </tr>
      ))}
      <tr>
        <PrintTd bold colSpan={2}>Cộng {group.category}</PrintTd>
        <PrintTd bold right>{num(group.tong.openKg)}</PrintTd>
        <PrintTd bold right>{num(group.tong.inKg)}</PrintTd>
        <PrintTd bold right>{num(group.tong.outKg)}</PrintTd>
        <PrintTd bold right>{num(group.tong.closeKg)}</PrintTd>
        <PrintTd bold right>{num(Math.round(group.tong.remainingValue))}</PrintTd>
      </tr>
    </>
  );
}
