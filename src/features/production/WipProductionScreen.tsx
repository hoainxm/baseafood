// ============================================================
// Tên file: src/features/production/WipProductionScreen.tsx
// Tên tiếng Việt: Màn hình Ghi Thành Phẩm ngày (sản xuất)
// Description: Daily finished-goods production entry (v1: product · qty · customer)
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { parseDayLink, withoutDayLink } from "@/lib/dataFlow";
import type {
  DailyLock,
  DomesticSaleItem,
  MonthlyStockLine,
  WipProductionItem,
  Product,
  Workshop,
} from "@/types";
import { isBackdatedWip, hasSplitComponents, blockSpec, BSF1_WAREHOUSES } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import {
  useBatterTypes,
  useDomesticSales,
  useProductionLocks,
  useProducts,
  useWipProductions,
  useCustomers,
  useMaterialTypes,
  useLotInputs,
  useLotDispatches,
  useLotWaivers,
  useImportShipments,
  useMaterialImports,
  useMonthlyStock,
  isServerConnected,
} from "@/lib/catalogRepo";
import {
  getProductBatterIds,
  sumBatterByType,
  sanitizeBatterKg,
  isBatteredProduct,
  toShortBatterLabel,
  findOrCreateBatter,
  getProductBatterNames,
  sumBatterKg,
} from "@/lib/batter";
import {
  HorizontalScroll,
  RequiredLegend,
  Button,
  ConfirmDelete,
  Combobox,
  DateField,
  DateRangeField,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  TableSkeleton,
  ErrorSummary,
  Field,
  Input,
  ReadOnlyBadge,
  Tag,
  NumberField,
  RecordTable,
  StatCardGrid,
  notify,
  type RecordTableColumn,
  type FieldError,
  type ComboboxOption,
} from "@/design-system";
import { kg, num, todayISO, formatDateVN } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { appendAuditEntries } from "@/lib/audit";
import { PERIOD_OPTIONS, getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
import { DailyTaskReminder, LotInputPicker, LotDispatchPicker, BlankDailyWipSlip, LotQrLabels } from "@/features/shared";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { useQuickProductDelete } from "@/features/catalog/QuickProductDelete";
import {
  DEFAULT_FROZEN_WAREHOUSE,
  TEMPORARY_GOODS_CATEGORY,
  addFrozenStockToLedger,
  buildFrozenStockLines,
  frozenLineRemovalBlocker,
  frozenLinesOf,
  isFrozenEntryComplete,
  removeFrozenLot,
} from "@/lib/frozenStockLines";
import { useCan, useCanOnRow } from "@/features/shared/PermissionProvider";
import { assignSessionLots, findBatchesWithoutLot, formatWipLotLabel, buildLotNode, type TraceData } from "@/lib/lotTraceability";
import {
  CalendarRange,
  ClipboardList,
  Factory,
  Hourglass,
  Link2,
  QrCode,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Printer,
  Scale,
  Send,
  Trash2,
  TriangleAlert,
  Users,
  Warehouse,
  Wheat,
  Store,
  Snowflake,
} from "lucide-react";
import { ProductionLinesTable } from "./ProductionLinesTable";
import { BatterSection } from "./BatterSection";
import { DomesticSaleSection } from "./DomesticSaleSection";
import { FrozenStockSection, createEmptyFrozenDraft, isFrozenDraftEmpty, type FrozenStockDraft } from "./FrozenStockSection";
import { readDevicePref, writeDevicePref } from "@/lib/devicePrefs";
import { SessionLotsSection, type SessionLot } from "./SessionLotsSection";
import {
  WORKSHOPS,
  isDomesticSaleLineComplete,
  isDomesticSaleLineEmpty,
  createEmptyDomesticSaleLine,
  isLineComplete,
  createEmptyProductionLine,
  isLineEmpty,
  isSplitLine,
  getLineTotalKg,
  type SessionHeader,
  type DomesticSaleLine,
  type ProductionLine,
} from "./wipHelpers";
import { duplicateProductNameKeys, normalizeProductName } from "@/lib/productMerge";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useFormDraft } from "@/lib/formDraft";

const KEY_WIP_REPORT = "bsf.wip-report-sent.v1";
/** Nhớ phân xưởng gần nhất THEO MÁY (device pref, không phải số liệu) để lần
 *  sau khỏi chọn lại — cùng nhóm với mốc "đã gửi báo cáo", không đụng repo. */
const KEY_WIP_WORKSHOP = "bsf.wip-xuong.v1";
const readSavedWorkshop = (): Workshop => {
  const v = readDevicePref(KEY_WIP_WORKSHOP);
  if (v && (WORKSHOPS as string[]).includes(v)) return v as Workshop;
  return "Đông";
};

export default function WipProductionScreen() {
  const navigate = useNavigate();
  const [rows, persist, { status }] = useWipProductions();
  const isLoading = status === "loading" && rows.length === 0;
  const [locks, persistLocks, { status: lockStatus }] = useProductionLocks();
  const [products, setProducts] = useProducts();
  const [customers, setCustomers] = useCustomers();
  const [materialTypes, setMaterialTypes] = useMaterialTypes();
  const [batterTypes, setBatterTypes] = useBatterTypes();
  /** Sổ BÁN NỘI ĐỊA (mig 0054) — NL bán thẳng, sổ riêng (không lẫn sản lượng TP). */
  const [domesticSales, persistDomesticSales] = useDomesticSales();
  /** Sổ kho THÁNG — hàng đông lạnh (sơ chế cấp đông) ghi vào nhóm "Hàng tạm" (2026-10-15). */
  const [monthlyStock, setMonthlyStock] = useMonthlyStock();

  // Người thao tác = tài khoản đang đăng nhập — gắn vào dòng khi lưu để lưu vết ai gửi.
  const { profile } = useAuth();
  const operator = profile?.fullName || profile?.username || "";

  /** Phân quyền lớp 2 (spec role-permissions §5): ẩn nút không có quyền. Gắn lô /
   *  bán nội địa / bột tẩm là thêm-sửa trên "wip"; Gửi báo cáo + In tem = export. */
  const allowed = useCan("wip");
  const canWrite = allowed.create || allowed.update;
  const isReadOnly = !canWrite;
  /** Phạm vi Đợt 5 (spec §3c): quản đốc chỉ ghi / chốt xưởng mình, tổ trưởng chỉ sửa
   *  dòng mình ghi. Phạm vi "all" ⇒ trùng hệt `allowed`. */
  const canRow = useCanOnRow("wip");
  /** Gắn lô = thêm-sửa trên dòng ⇒ dòng phải trong phạm vi. */
  const canWriteRow = (r: { workshop?: unknown; operator?: unknown }) =>
    canRow("create", r) || canRow("update", r);
  /** Xưởng được GHI MỚI (form Ghi nhập). */
  const canCreateIn = (w: Workshop) => canRow("create", { workshop: w }, "create");
  const writableWorkshops = WORKSHOPS.filter(canCreateIn);

  const [period, setPeriod] = useState<ViewPeriod>("day");
  const [date, setDate] = useState(todayISO());
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [workshop, setWorkshop] = useState<Workshop | "Tất cả">(readSavedWorkshop);

  /* Ghi cả bảng một lượt: đầu phiên chọn 1 lần, đổ nhiều thành phẩm. */
  const [session, setSession] = useState<SessionHeader | null>(null);
  const [isConsecutiveDays, setIsConsecutiveDays] = useState(true);
  const [tableRows, setTableRows] = useState<ProductionLine[]>([]);
  /** Dòng bán nội địa của phiên đang gõ — mặc định trống, bấm "Thêm dòng" mới hiện. */
  const [domesticSaleLines, setDomesticSaleLines] = useState<DomesticSaleLine[]>([]);
  /** Dòng HÀNG ĐÔNG LẠNH của phiên (→ Hàng tạm ở Sổ kho tháng) — mặc định trống. */
  const [frozenLines, setFrozenLines] = useState<FrozenStockDraft[]>([]);
  const [sessionErrors, setSessionErrors] = useState<FieldError[]>([]);

  /* Sửa một dòng đã ghi (từ bảng sổ). */
  const [edit, setEdit] = useState<WipProductionItem | null>(null);
  /* Sửa một dòng BÁN NỘI ĐỊA đã ghi. */
  const [editingDomesticSale, setEditingDomesticSale] = useState<DomesticSaleItem | null>(null);
  const [domesticSaleEditErrors, setDomesticSaleEditErrors] = useState<FieldError[]>([]);
  const [editErrors, setEditErrors] = useState<FieldError[]>([]);
  /** Dòng đang sửa có tách không = đã nhập râu/bao tử (ô tách luôn có sẵn). */
  const isEditSplit =
    (edit?.tentacleKg ?? 0) > 0 || (edit?.stomachKg ?? 0) > 0;

  /** Hai chế độ: "nhap" = form ghi (mặc định, form-first cho tổ xưởng); "so" = sổ + báo cáo. */
  const [mode, setMode] = useState<"entry" | "ledger">("entry");
  /** Không có quyền thêm ⇒ không có form Ghi nhập, chỉ còn sổ ngày. */
  const canEnter = allowed.create && writableWorkshops.length > 0;
  const activeMode = canEnter ? mode : "ledger";
  const [isPrintingBlank, setIsPrintingBlank] = useState(false);
  // Truy xuất lô (docs/spec/qr-truy-xuat-lo.md): gắn lô NL cho mẻ + in tem lô BTP.
  const [lotInputs, saveLotInputs] = useLotInputs();
  const [lotDispatches, saveLotDispatches] = useLotDispatches();
  const [lotWaivers, saveLotWaivers] = useLotWaivers();
  const [shipments] = useImportShipments();
  const [imports] = useMaterialImports();
  const [lotTarget, setLotTarget] = useState<WipProductionItem | null>(null);
  const [lotDomesticSale, setLotDomesticSale] = useState<DomesticSaleItem | null>(null);
  const [lotLabel, setLotLabel] = useState<WipProductionItem[] | null>(null);
  const countLotInputs = (id: string) => lotInputs.filter((l) => l.outputKind === "W" && l.outputId === id).length;
  const countDomesticSaleLots = (id: string) => lotDispatches.filter((d) => d.docKind === "domestic_sale" && d.docId === id).length;
  /** Lô NL khai cho phiên (đợt 2b) — giữ cho các phiên sau CÙNG ngày · xưởng, đổi thì thôi. */
  const [declaredSessionLots, setDeclaredSessionLots] = useState<{ date: string; workshop: Workshop; lots: SessionLot[] }>({
    date: "",
    workshop: "Đông",
    lots: [],
  });
  /** Lý do chưa gắn lô cho các mẻ còn thiếu — bắt buộc khi chốt ngày (chốt 2026-10-08). */
  const [waiverReason, setWaiverReason] = useState("");
  /** Dữ liệu tối thiểu cho truy xuất ở màn này (không nạp cả 17 bảng như hộ chiếu lô). */
  const lightTraceData: TraceData = useMemo(
    () => ({
      shipments, imports, wips: rows, packagings: [], lotInputs, exportItems: [], exportOrders: [],
      salesOrders: [], products, customers, lotDispatches, lotWaivers, materialTypes,
    }),
    [shipments, imports, rows, lotInputs, products, customers, lotDispatches, lotWaivers, materialTypes]
  );

  const [isConfirmingLock, setIsConfirmingLock] = useState(false);
  const [lockNote, setLockNote] = useState("");
  /** Còn dở cuối ngày SX tách theo loại NL (khép vòng G1) — nhập khi chốt ngày. */
  const [leftover, setLeftover] = useState<{ id: string; name: string; kg: number | null }[]>([]);
  const leftoverDraftTotal = leftover.reduce((s, d) => s + (d.kg ?? 0), 0);

  /** A4: mốc "đã gửi báo cáo" theo (phạm vi·xưởng), lưu theo máy để phản hồi tại chỗ. */
  const [sentReports, setSentReports] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(readDevicePref(KEY_WIP_REPORT) || "{}");
    } catch {
      return {};
    }
  });
  const [isConfirmingReopen, setIsConfirmingReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [lockErrors, setLockErrors] = useState<FieldError[]>([]);

  const [effectiveFrom, effectiveTo] = getViewPeriodRange(period, date, fromDate, toDate);
  const isSingleDay = effectiveFrom === effectiveTo;

  const productNameOf = (id: string) => products.find((m) => m.id === id)?.name || "—";

  /** Danh mục thành phẩm — gõ để tìm, thêm mới tại chỗ. */
  const duplicateNames = duplicateProductNameKeys(products);
  const productOptions: ComboboxOption[] = products.map((m) => ({
    value: m.id,
    label: m.code ? `${m.code} · ${m.name}` : m.name,
    // Tên trùng mục khác ⇒ ghi mã kế toán để phân biệt.
    subLabel:
      [duplicateNames.has(normalizeProductName(m.name)) && m.finishedGoodCode ? `mã ${m.finishedGoodCode}` : "", m.code, m.category]
        .filter(Boolean)
        .join(" · ") || undefined,
  }));

  /** Danh mục khách hàng — chọn/ thêm mới tại chỗ (lưu theo TÊN). */
  const customerOptions: ComboboxOption[] = customers.map((c) => ({
    value: c.name,
    label: c.name,
    subLabel: c.market || undefined,
  }));

  const addProduct = (name: string): string => {
    const m: Product = {
      id: uid(),
      code: "",
      name,
      finishedGoodCode: "",
      category: "Bạch tuộc", // xưởng Đông; loài chỉnh sau ở Danh mục nếu cần
      processingType: "", // kiểu chế biến đặt ở Danh mục (bút chì) — không còn ô ở /wip
    };
    setProducts([...products, m]);
    notify.saved(`Đã thêm thành phẩm "${name}"`);
    return m.id;
  };

  /** Sửa nhanh thành phẩm ngay tại màn (ghi thẳng Danh mục mặt hàng). */
  const productEditor = useQuickCatalogEdit("product", products, setProducts, {
    // Ô "Bột đi kèm" trong hộp sửa thấy + tạo loại bột qua đúng danh mục của màn.
    batterSource: { rows: batterTypes, create: (name) => addBatterRecord(name).id },
    getDescription: (m) => {
      const n = rows.filter((r) => r.productId === m.id).length;
      return n > 0
        ? `Sửa ở đây là sửa trong Danh mục — ${n} dòng sản lượng đã ghi với thành phẩm này sẽ hiện theo thông tin mới.`
        : "Sửa ở đây là sửa trong Danh mục — áp cho mọi màn dùng thành phẩm này.";
    },
    // Dòng đang gõ dở cũng ăn theo cờ tách / quy cách mới — trừ dòng mà người
    // dùng đã tự gõ quy cách khác với quy cách cũ của thành phẩm.
    onSaved: (p, prev) => {
      const oldPackSpec = blockSpec(prev) ?? 0;
      setTableRows((items) =>
        items.map((d) =>
          d.productId === p.id
            ? {
                ...d,
                expanded: hasSplitComponents(p) ? true : d.expanded,
                blockSpecKg:
                  !d.blockSpecKg || d.blockSpecKg === oldPackSpec
                    ? blockSpec(p) ?? d.blockSpecKg
                    : d.blockSpecKg,
              }
            : d
        )
      );
    },
  });
  const openProductEdit = productEditor.openEdit;
  /** Ô khách ở /wip lưu theo TÊN (customerName). */
  const customerEditor = useQuickCatalogEdit("customer", customers, setCustomers, { matchBy: "name" });
  const materialTypeEditor = useQuickCatalogEdit("materialType", materialTypes, setMaterialTypes, { matchBy: "name" });
  /** Dọn danh mục mặt hàng ngay trong ô chọn (thùng rác) — kiểm đã dùng + hỏi + Hoàn tác. */
  const productDeleter = useQuickProductDelete(products, setProducts, {
    wips: rows,
    // Dòng đang gõ dở trỏ tới mặt hàng vừa xóa ⇒ trả ô về trống.
    // Gộp mục trùng ⇒ dòng đang gõ dở chuyển sang mục giữ lại (không bỏ trống).
    onDeleted: (id, replacedBy) =>
      setTableRows((items) => items.map((d) => (d.productId === id ? { ...d, productId: replacedBy ?? "" } : d))),
  });

  const addCustomer = (name: string): string => {
    setCustomers([...customers, { id: uid(), code: "", name, market: "" }]);
    notify.saved(`Đã thêm khách hàng "${name}"`);
    return name;
  };

  /* ---- Ô chọn danh mục cho khối Bán nội địa: value = TÊN, thêm mới + bút chì ---- */
  const addMaterialTypeName = (name: string): string => {
    const trimmedName = name.trim();
    const existing = materialTypes.find((l) => l.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (existing) return existing.name;
    setMaterialTypes([...materialTypes, { id: uid(), name: trimmedName, category: "", note: "" }]);
    notify.saved(`Đã thêm loại nguyên liệu "${trimmedName}"`);
    return trimmedName;
  };
  const materialTypeFieldProps = {
    options: materialTypes.map((l) => ({ value: l.name, label: l.name, subLabel: l.category || undefined })),
    onCreate: materialTypeEditor.canCreate ? addMaterialTypeName : undefined,
    onEditItem: materialTypeEditor.openEdit,
    canEdit: materialTypeEditor.canEdit,
    editLabel: materialTypeEditor.editLabel,
  };
  const customerFieldProps = {
    options: customerOptions,
    onCreate: customerEditor.canCreate ? addCustomer : undefined,
    onEditItem: customerEditor.openEdit,
    canEdit: customerEditor.canEdit,
    editLabel: customerEditor.editLabel,
  };

  /* ---- Hàng đông lạnh → Hàng tạm: tên hàng = tên Hàng tạm đã có trong sổ kho + loại NL ---- */
  const frozenItemOptions: ComboboxOption[] = useMemo(() => {
    const seen = new Set<string>();
    const out: ComboboxOption[] = [];
    const push = (name: string, subLabel: string) => {
      const k = name.trim().toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push({ value: name.trim(), label: name.trim(), subLabel });
    };
    // Tên đã dùng ở nhóm Hàng tạm lên đầu — cùng cách ghi với bảng kê kế toán.
    [...monthlyStock]
      .filter((l) => l.category === TEMPORARY_GOODS_CATEGORY)
      .map((l) => l.itemName)
      .sort((a, b) => a.localeCompare(b, "vi"))
      .forEach((n) => push(n, "Đã có ở Hàng tạm"));
    materialTypes.forEach((l) => push(l.name, l.category ? `Loại NL · ${l.category}` : "Loại NL"));
    return out;
  }, [monthlyStock, materialTypes]);
  const frozenItemCell = { ...materialTypeFieldProps, options: frozenItemOptions };
  const warehouseOptions: ComboboxOption[] = BSF1_WAREHOUSES.map((w) => ({ value: w.name, label: w.name, subLabel: w.code }));

  /* ---- Bột tẩm (mig 0051): danh mục loại bột — dòng sản lượng lưu theo TÊN ---- */
  const batterOptions: ComboboxOption[] = batterTypes.map((b) => ({
    value: b.name,
    label: b.name,
    subLabel: [b.code && `Mã ${b.code}`, b.note].filter(Boolean).join(" · ") || undefined,
  }));
  /** Tạo loại bột tại chỗ (trùng tên ⇒ dùng lại loại có sẵn). Trả về bản ghi. */
  const addBatterRecord = (name: string) => {
    const result = findOrCreateBatter(batterTypes, name);
    if (result.isNew) {
      setBatterTypes(result.rows);
      notify.saved(`Đã thêm loại bột "${result.batter.name}" vào danh mục`);
    }
    return result.batter;
  };
  const addBatter = (name: string): string => addBatterRecord(name).name;
  const batterEditor = useQuickCatalogEdit("batter", batterTypes, setBatterTypes, { matchBy: "name" });
  /** Tên bột đi kèm của một mặt hàng (theo danh mục bột hiện có). */
  const batterNamesOf = (productId: string) =>
    getProductBatterNames(
      products.find((m) => m.id === productId),
      batterTypes
    );
  /** "24V 12 · 18V 30" — nhãn gọn cho ô hẹp. */
  const describeBatter = (m: Record<string, number> | undefined) =>
    Object.entries(sanitizeBatterKg(m))
      .map(([name, v]) => `${toShortBatterLabel(name)} ${num(v)}`)
      .join(" · ");

  const view = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.productionDate >= effectiveFrom &&
            r.productionDate <= effectiveTo &&
            (workshop === "Tất cả" || r.workshop === workshop)
        )
        .sort(
          (a, b) =>
            a.productionDate.localeCompare(b.productionDate) ||
            a.id.localeCompare(b.id)
        ),
    [rows, effectiveFrom, effectiveTo, workshop]
  );

  const total = view.reduce((s, r) => s + (r.quantityKg || 0), 0);
  const totalBlocks = view.reduce((s, r) => s + (r.blocksCount || 0), 0);
  const pendingInCount = view.filter((r) => r.status === "pending").length;
  /** Bột tẩm đã dùng trong phạm vi đang xem, cộng theo loại (mig 0051). */
  const batterByType = useMemo(() => sumBatterByType(view.map((r) => r.batterKg)), [view]);
  const batterViewTotal = batterByType.reduce((s, b) => s + b.kg, 0);
  /** Bán nội địa (mig 0054) trong phạm vi đang xem — sổ riêng, không vào tổng sản lượng. */
  const bndView = useMemo(
    () =>
      domesticSales
        .filter(
          (r) =>
            r.saleDate >= effectiveFrom &&
            r.saleDate <= effectiveTo &&
            (workshop === "Tất cả" || r.workshop === workshop)
        )
        .sort((a, b) => a.saleDate.localeCompare(b.saleDate) || a.id.localeCompare(b.id)),
    [domesticSales, effectiveFrom, effectiveTo, workshop]
  );
  const domesticSaleViewTotal = bndView.reduce((s, r) => s + (r.quantityKg || 0), 0);
  /** Lô hàng đông lạnh ghi từ /wip (nhóm Hàng tạm ở Sổ kho tháng) trong phạm vi đang xem. */
  const frozenView = useMemo(
    () => frozenLinesOf(monthlyStock, effectiveFrom, effectiveTo, workshop),
    [monthlyStock, effectiveFrom, effectiveTo, workshop]
  );
  const frozenViewTotal = frozenView.reduce((s, l) => s + l.inKg, 0);

  /* ---- A4: gom báo cáo TP ngày theo (xưởng × người thao tác) ---- */
  const operatorReport = useMemo(() => {
    const m = new Map<
      string,
      { workshop: Workshop; operator: string; rowCount: number; kg: number }
    >();
    for (const r of view) {
      const op = (r.operator ?? "").trim() || "(không rõ)";
      const k = `${r.workshop}·${op}`;
      const cur = m.get(k) ?? { workshop: r.workshop, operator: op, rowCount: 0, kg: 0 };
      cur.rowCount += 1;
      cur.kg += r.quantityKg || 0;
      m.set(k, cur);
    }
    return [...m.values()].sort(
      (a, b) =>
        a.workshop.localeCompare(b.workshop) || a.operator.localeCompare(b.operator)
    );
  }, [view]);

  const rangeDescription = isSingleDay
    ? formatDateVN(effectiveFrom)
    : `${formatDateVN(effectiveFrom)} – ${formatDateVN(effectiveTo)}`;

  /* ---- Chốt ngày SX ---- */
  const isSingleDayWorkshop = isSingleDay && workshop !== "Tất cả";
  const activeWorkshop: Workshop = workshop === "Tất cả" ? "Đông" : workshop;
  const lockRecordOf = (n: string, x: Workshop): DailyLock | undefined =>
    locks.find((c) => c.lockDate === n && c.workshop === x);
  const currentLock = isSingleDayWorkshop
    ? lockRecordOf(effectiveFrom, activeWorkshop)
    : undefined;
  const isLocked = Boolean(currentLock?.isLocked);
  /** Mẻ của ngày đang chốt CHƯA gắn lô NL và CHƯA ghi lý do — chốt phải xử lý hết
   *  (chủ dự án chốt 2026-10-08: "chốt ngày phải gắn lô hoặc ghi lý do"). */
  const batchesWithoutLot = isSingleDayWorkshop
    ? findBatchesWithoutLot(rows.filter((r) => r.productionDate === effectiveFrom && r.workshop === activeWorkshop), lotInputs, lotWaivers)
    : [];
  const dayWorkshopTotal = (n: string, x: Workshop) =>
    rows
      .filter((r) => r.productionDate === n && r.workshop === x)
      .reduce((s, r) => s + (r.quantityKg || 0), 0);
  const actualTotal = isSingleDayWorkshop ? dayWorkshopTotal(effectiveFrom, activeWorkshop) : 0;
  const postLockDiff =
    currentLock?.isLocked && actualTotal !== currentLock.totalKgAtLock
      ? actualTotal - currentLock.totalKgAtLock
      : 0;
  const isLockedOn = (n: string, x: Workshop) => Boolean(lockRecordOf(n, x)?.isLocked);

  const postingDate = isSingleDay ? effectiveFrom : effectiveTo;
  const recordWorkshop: Workshop = workshop === "Tất cả" ? "Đông" : workshop;

  /* Nhắc daily-task: hôm nay (xưởng đang chọn) đã chốt sản xuất chưa. */
  const isProductionLockedToday = locks.some(
    (c) => c.lockDate === todayISO() && c.workshop === recordWorkshop && c.isLocked
  );

  /* ---- Phiên ghi cả bảng ---- */
  const openAdd = () => {
    setSession({
      productionDate: postingDate,
      postingDate: todayISO(),
      backdateReason: "",
      // Quản đốc: phiếu mới mở ở xưởng mình nếu xưởng đang chọn ngoài phạm vi.
      workshop: canCreateIn(recordWorkshop) ? recordWorkshop : (writableWorkshops[0] ?? recordWorkshop),
    });
    setIsConsecutiveDays(postingDate === todayISO());
    // Mở sẵn MỘT nhóm + một dòng trống (điền sẵn nhóm gần nhất) để gõ thành phẩm
    // ngay, khỏi phải bấm "Thêm nhóm" trước.
    setTableRows([createEmptyProductionLine(newId())]);
    setSessionErrors([]);
  };
  /* ---- Tự lưu NHÁP phiếu đang gõ (quy tắc 17, lib/formDraft.ts): sang trang khác, tải
     lại, đăng xuất rồi vào lại vẫn còn. Phiếu về trống (lưu xong / bỏ) ⇒ nháp tự xoá. ---- */
  const wipDraft = useFormDraft({
    form: "wip",
    account: profile?.username ?? "",
    accountReady: profile !== null || !isServerConnected,
    value: { session, isConsecutiveDays, tableRows, domesticSaleLines, frozenLines, declaredSessionLots },
    isEmpty: (d) =>
      !d.session ||
      (!d.session.backdateReason.trim() &&
        d.domesticSaleLines.length === 0 &&
        d.frozenLines.every((f) => !f.itemName.trim() && !f.kg) &&
        d.declaredSessionLots.lots.length === 0 &&
        d.tableRows.every((l) => !l.productId && !l.quantityKg && !l.tentacleKg && !l.stomachKg && !l.blocksCount)),
    onRestore: (d) => {
      setMode("entry");
      setSession(d.session);
      setIsConsecutiveDays(d.isConsecutiveDays);
      setTableRows(d.tableRows);
      setDomesticSaleLines(d.domesticSaleLines);
      setFrozenLines(d.frozenLines);
      setDeclaredSessionLots(d.declaredSessionLots);
    },
  });
  const discardWipDraft = () => {
    wipDraft.discard();
    setDeclaredSessionLots({ date: "", workshop: "Đông", lots: [] });
    resetSession();
  };
  const setSessionField = <K extends keyof SessionHeader>(k: K, v: SessionHeader[K]) =>
    setSession((p) => (p ? { ...p, [k]: v } : p));

  /** Đổi ngày ghi sổ: kéo ngày sản xuất theo khi hai ngày đang đi liền. */
  const changePostingDate = (v: string) =>
    setSession((p) =>
      !p
        ? p
        : isConsecutiveDays
          ? { ...p, postingDate: v, productionDate: v }
          : { ...p, postingDate: v }
    );
  /** Chỉnh tay ngày sản xuất ⇒ tách khỏi ngày ghi sổ (ghi bù). */
  const changeProductionDate = (v: string) => {
    setIsConsecutiveDays(false);
    setSessionField("productionDate", v);
  };

  // Form-first: vào chế độ "Ghi nhập" mà chưa có phiếu → tự mở một phiếu trống
  // (không cần bấm nút, không modal). Lưu xong phiếu về null → tự mở phiếu mới.
  useEffect(() => {
    // Đợi bước mở lại nháp xong (quy tắc 17) — kẻo phiếu trống đè lên nháp.
    if (activeMode === "entry" && session === null && !isLoading && wipDraft.isReady) openAdd();
    // moThem đọc bộ lọc hiện tại; guard theo phien===null nên không lặp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode, session, isLoading, wipDraft.isReady]);

  // Trong "Ghi nhập", ngày+xưởng của PHIẾU là ngữ cảnh: đồng bộ về bộ lọc để
  // "đã ghi hôm nay", tổng ngày, chốt ngày, báo cáo A4 bám đúng ngày đang ghi.
  // Chỉ bám ngày + xưởng (không bám cả phiếu) để gõ các ô khác không kéo bộ lọc.
  const sessionDate = session?.productionDate;
  const sessionWorkshop = session?.workshop;
  useEffect(() => {
    if (activeMode === "entry" && sessionDate !== undefined && sessionWorkshop !== undefined) {
      setPeriod("day");
      setDate(sessionDate);
      setWorkshop(sessionWorkshop);
    }
  }, [activeMode, sessionDate, sessionWorkshop]);

  // Link mở thẳng một ngày (`?date=&workshop=` — "Việc của tôi", Tổng quan): sang "Sổ ngày"
  // đúng ngày + xưởng. Đợi nháp mở lại xong (onRestore chuyển về "Ghi nhập") và PHẢI đứng sau
  // effect đồng bộ trên để ngày của link thắng. Nháp đang dở giữ nguyên; không có nháp thì
  // bỏ phiếu trống tự mở ⇒ "Ghi nhập" sau đó mở đúng ngày link. Xưởng của link KHÔNG ghi
  // đè xưởng nhớ theo máy (mở việc xưởng khác một lần không đổi thói quen của máy).
  const [searchParams, setSearchParams] = useSearchParams();
  const dayLink = parseDayLink(searchParams);
  const skipWorkshopPref = useRef(false);
  useEffect(() => {
    if (!wipDraft.isReady || !dayLink) return;
    if (dayLink.date) {
      setPeriod("day");
      setDate(dayLink.date);
    }
    if (dayLink.workshop) {
      skipWorkshopPref.current = true;
      setWorkshop(dayLink.workshop);
    }
    if (!wipDraft.restoredAt) setSession(null);
    setMode("ledger");
    setSearchParams(withoutDayLink(searchParams), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy một lần khi link mang ngày/xưởng và nháp đã mở lại
  }, [wipDraft.isReady, dayLink?.date, dayLink?.workshop]);

  // Nhớ phân xưởng đang chọn theo MÁY → reload khỏi phải chọn lại (device pref).
  useEffect(() => {
    if (skipWorkshopPref.current) {
      skipWorkshopPref.current = false;
      return;
    }
    if (workshop !== "Tất cả") {
      writeDevicePref(KEY_WIP_WORKSHOP, workshop);
    }
  }, [workshop]);

  // Bảng-tính: mỗi nhóm luôn chừa MỘT dòng trống ở cuối để gõ tiếp — khỏi bấm
  // "Thêm thành phẩm" từng dòng. "Trống" = chưa có SP lẫn kg (nhãn nhóm không
  // tính). Sau khi thêm, nhóm có dòng trống → lần chạy sau không thêm nữa (ổn định).
  useEffect(() => {
    if (mode !== "entry" || !session) return;
    const byGroup = new Map<string, ProductionLine[]>();
    for (const d of tableRows) {
      const g = byGroup.get(d.groupId) ?? [];
      g.push(d);
      byGroup.set(d.groupId, g);
    }
    const toAdd: ProductionLine[] = [];
    for (const [gid, items] of byGroup)
      // Nhóm ĐÃ ĐỦ hết (mọi dòng có SP + kg) → chừa thêm một dòng trống để gõ tiếp.
      // Dòng đang gõ dở (mới chọn mã, chưa có kg) chưa tính → không nhảy dòng non.
      if (items.length > 0 && items.every((d) => isLineComplete(d)))
        toAdd.push(createEmptyProductionLine(gid, "", items[0].customerName));
    if (toAdd.length) setTableRows((items) => [...items, ...toAdd]);
  }, [tableRows, mode, session]);

  const validRows = tableRows.filter(isLineComplete);
  const sessionTotal = validRows.reduce((s, d) => s + getLineTotalKg(d), 0);
  const sessionBatterKg = validRows.reduce((s, d) => s + sumBatterKg(d.batterKg), 0);
  const isSessionLocked = session
    ? isLockedOn(session.productionDate, session.workshop)
    : false;
  const sessionNeedsReason =
    session &&
    (isBackdatedWip({
      productionDate: session.productionDate,
      postingDate: session.postingDate,
    }) ||
      isSessionLocked);

  const updateRow = (key: string, patch: Partial<ProductionLine>) =>
    setTableRows((items) => items.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const removeRow = (key: string) =>
    setTableRows((items) => items.filter((d) => d.key !== key));

  /** Kiểm đầu phiên (ngày + lý do ghi bù). */
  const sessionHeaderErrors = (p: SessionHeader): FieldError[] => {
    const ls: FieldError[] = [];
    if (p.postingDate < p.productionDate)
      ls.push({
        field: "Ngày ghi sổ",
        message: "Không thể trước ngày sản xuất",
      });
    const needsReason =
      isBackdatedWip({
        productionDate: p.productionDate,
        postingDate: p.postingDate,
      }) || isLockedOn(p.productionDate, p.workshop);
    if (needsReason && !p.backdateReason.trim())
      ls.push({
        field: "Lý do ghi bù",
        message: "Ghi sau ngày SX / ngày đã chốt — ghi rõ lý do",
      });
    return ls;
  };

  /** Lô NL đã khai cho đúng ngày · xưởng của phiên (khai cho ngày khác thì không tính). */
  const sessionLotsOf = (p: SessionHeader | null): SessionLot[] =>
    p && declaredSessionLots.date === p.productionDate && declaredSessionLots.workshop === p.workshop ? declaredSessionLots.lots : [];

  /**
   * Lưu cả phiên MỘT LẦN: mọi dòng hợp lệ trong bảng thành một dòng sản lượng.
   * `imLang` (đóng bằng X): đủ thì vẫn lưu, chưa đủ thì bỏ qua, không nài lỗi.
   */
  const saveSession = (imLang: boolean): boolean => {
    if (!session) return true;
    const validRows = tableRows.filter(isLineComplete);
    const validDomesticRows = domesticSaleLines.filter(isDomesticSaleLineComplete);
    const validFrozenRows = frozenLines.filter(isFrozenEntryComplete);
    const ls: FieldError[] = [...sessionHeaderErrors(session)];
    if (validRows.length === 0 && validDomesticRows.length === 0 && validFrozenRows.length === 0)
      ls.push({
        field: "Thành phẩm",
        message: "Thêm ít nhất một thành phẩm (hoặc một dòng bán nội địa / hàng đông lạnh) vào phiên",
      });
    if (!imLang)
      frozenLines.forEach((d, i) => {
        if (!isFrozenDraftEmpty(d) && !isFrozenEntryComplete(d))
          ls.push({
            field: `Hàng đông lạnh dòng ${i + 1}`,
            message: !d.itemName.trim() ? "Chưa chọn tên hàng" : "Số lượng phải lớn hơn 0 kg",
          });
      });
    if (!imLang)
      domesticSaleLines.forEach((d, i) => {
        if (!isDomesticSaleLineEmpty(d) && !isDomesticSaleLineComplete(d))
          ls.push({
            field: `Bán nội địa dòng ${i + 1}`,
            message: !d.materialTypeName.trim()
              ? "Chưa chọn loại nguyên liệu"
              : "Số lượng phải lớn hơn 0 kg",
          });
      });
    if (!imLang)
      tableRows.forEach((d, i) => {
        if (!isLineEmpty(d) && !isLineComplete(d))
          ls.push({
            field: `Dòng ${i + 1}`,
            message: !d.productId
              ? "Chưa chọn thành phẩm"
              : "Số lượng phải lớn hơn 0 kg",
          });
      });
    if (ls.length > 0) {
      if (!imLang) setSessionErrors(ls);
      return false;
    }

    const newWips: WipProductionItem[] = validRows.map((d) => ({
      id: newId(),
      productionDate: session.productionDate,
      postingDate: session.postingDate,
      backdateReason: session.backdateReason,
      workshop: session.workshop,
      productId: d.productId,
      spec: "",
      quantityKg: getLineTotalKg(d),
      blocksCount: d.blocksCount || 0,
      warehouse: "",
      status: "pending",
      note: "",
      customerName: d.customerName.trim(),
      // Kiểu chế biến lấy từ MẶT HÀNG (bỏ ô riêng 2026-10-15) — sổ vẫn giữ để tra/truy xuất.
      processingType: (products.find((m) => m.id === d.productId)?.processingType ?? "").trim(),
      tentacleKg: isSplitLine(d) ? d.tentacleKg || 0 : null,
      stomachKg: isSplitLine(d) ? d.stomachKg || 0 : null,
      operator,
      batterKg: sanitizeBatterKg(d.batterKg),
    }));
    if (newWips.length > 0) persist([...rows, ...newWips]);

    // Bán nội địa → sổ riêng (cùng ngày / xưởng / lý do ghi bù của phiên).
    const newDomesticSales: DomesticSaleItem[] = validDomesticRows.map((d) => ({
      id: newId(),
      saleDate: session.productionDate,
      postingDate: session.postingDate,
      backdateReason: session.backdateReason,
      workshop: session.workshop,
      materialTypeName: d.materialTypeName.trim(),
      quantityKg: d.quantityKg,
      unitPrice: d.unitPrice,
      customerName: d.customerName.trim(),
      note: "",
      operator,
    }));
    if (newDomesticSales.length > 0) persistDomesticSales([...domesticSales, ...newDomesticSales]);

    // Hàng đông lạnh → lô nhập nhóm "Hàng tạm" ở Sổ kho tháng (tháng theo ngày SX).
    const newFrozenLines = buildFrozenStockLines(validFrozenRows, {
      productionDate: session.productionDate,
      workshop: session.workshop,
      operator,
      newId,
    });
    if (newFrozenLines.length > 0) setMonthlyStock(addFrozenStockToLedger(monthlyStock, newFrozenLines).lines);

    // Lô NL khai cho phiên ⇒ gắn cho mẻ cùng loài + bán nội địa cùng loại NL (kg để trống).
    const sessionLotResult = assignSessionLots({
      wips: newWips,
      domesticSales: newDomesticSales,
      materialLots: sessionLotsOf(session),
      traceData: lightTraceData,
      operator,
      recordedAt: new Date().toISOString(),
      newId,
    });
    if (sessionLotResult.lotInputs.length > 0) saveLotInputs([...lotInputs, ...sessionLotResult.lotInputs]);
    if (sessionLotResult.dispatches.length > 0) saveLotDispatches([...lotDispatches, ...sessionLotResult.dispatches]);
    const lottedBatchCount = new Set(sessionLotResult.lotInputs.map((l) => l.outputId)).size;

    // Nhớ về MẶT HÀNG (đúng ý "gắn trên mặt hàng") — lần sau tự điền:
    //  - quy cách block (kg/khối) vừa nhập;
    //  - bộ BỘT ĐI KÈM: mã CHƯA gắn bột mà dòng có ghi bột ⇒ gắn các loại vừa dùng.
    //    Mã đã gắn thì KHÔNG đổi (bột nhập thêm tại chỗ chỉ là của dòng đó).
    // Gộp vào MỘT lần setMatHang — gọi hai lần sẽ lấy cùng `product` cũ, lần sau đè lần trước.
    const batterIdByName = new Map(batterTypes.map((b) => [b.name.trim(), b.id]));
    const productPatches = new Map<string, Partial<Product>>();
    for (const d of validRows) {
      const p = products.find((m) => m.id === d.productId);
      if (!p) continue;
      const patch: Partial<Product> = { ...productPatches.get(p.id) };
      if (d.blockSpecKg > 0 && blockSpec(p) !== d.blockSpecKg)
        patch.blockSpecKg = d.blockSpecKg;
      const batterIds = Object.keys(sanitizeBatterKg(d.batterKg))
        .map((name) => batterIdByName.get(name) ?? "")
        .filter(Boolean);
      if (getProductBatterIds(p).length === 0 && batterIds.length > 0 && !patch.batterIds)
        patch.batterIds = batterIds;
      if (Object.keys(patch).length > 0) productPatches.set(p.id, patch);
    }
    if (productPatches.size > 0)
      setProducts(products.map((m) => (productPatches.has(m.id) ? { ...m, ...productPatches.get(m.id) } : m)));

    const newTotal = newWips.reduce((s, r) => s + r.quantityKg, 0);
    const newBatterKg = newWips.reduce((s, r) => s + sumBatterKg(r.batterKg), 0);
    const newDomesticKg = newDomesticSales.reduce((s, r) => s + r.quantityKg, 0);
    const newFrozenKg = newFrozenLines.reduce((s, r) => s + r.inKg, 0);
    notify.saved(
      [
        newWips.length > 0 && `Đã lưu ${newWips.length} thành phẩm · ${kg(newTotal)}`,
        newBatterKg > 0 && `bột tẩm ${kg(newBatterKg)}`,
        newDomesticSales.length > 0 &&
          `${newWips.length > 0 ? "bán nội địa" : "Đã lưu bán nội địa"} ${kg(newDomesticKg)}`,
        newFrozenLines.length > 0 &&
          `${newWips.length + newDomesticSales.length > 0 ? "hàng đông lạnh" : "Đã lưu hàng đông lạnh"} ${kg(newFrozenKg)} vào Hàng tạm (Sổ kho tháng)`,
        lottedBatchCount > 0 && `gắn lô NL cho ${lottedBatchCount} mẻ`,
      ]
        .filter(Boolean)
        .join(" · "),
      undefined,
      newWips.length > 0 && allowed.export
        ? {
            label: newWips.length > 1 ? `In ${newWips.length} tem` : "In tem",
            onClick: () => setLotLabel(newWips),
          }
        : undefined
    );

    if (sessionLotResult.mismatches.length > 0)
      notify.warning(
        `${sessionLotResult.mismatches.length} dòng không cùng loài với lô NL đã khai — chưa gắn lô. Gắn riêng ở sổ ngày ("Gắn lô NL").`
      );

    const bg = lockRecordOf(session.productionDate, session.workshop);
    if (bg?.isLocked && newWips.length > 0)
      notify.warning(
        `Ngày ${formatDateVN(session.productionDate)} đã chốt ${kg(bg.totalKgAtLock)} — sau khi ghi bù thành ${kg(dayWorkshopTotal(session.productionDate, session.workshop) + newTotal)}`
      );

    // Ghi ngày ngoài kỳ đang lọc → kéo bộ lọc về đúng phiên vừa ghi.
    if (
      session.productionDate < effectiveFrom ||
      session.productionDate > effectiveTo
    ) {
      setPeriod("day");
      setDate(session.productionDate);
    }
    if (workshop !== "Tất cả" && workshop !== session.workshop)
      setWorkshop(session.workshop);
    return true;
  };

  const resetSession = () => {
    setSession(null);
    setTableRows([]);
    setDomesticSaleLines([]);
    setFrozenLines([]);
    setSessionErrors([]);
  };
  const finishSession = () => {
    // Lưu xong → reset phiếu; effect form-first tự mở phiếu trống mới.
    if (saveSession(false)) resetSession();
  };

  /* ---- Sửa / xóa một dòng đã ghi ---- */
  const openEdit = (r: WipProductionItem) => {
    setEdit({ ...r });
    setEditErrors([]);
  };
  const patchEdit = (patch: Partial<WipProductionItem>) =>
    setEdit((d) => (d ? { ...d, ...patch } : d));
  const saveEdit = () => {
    if (!edit) return;
    const ls: FieldError[] = [];
    if (!edit.productId)
      ls.push({ field: "Thành phẩm", message: "Chưa chọn thành phẩm" });
    const total = isEditSplit
      ? (edit.tentacleKg || 0) + (edit.stomachKg || 0)
      : edit.quantityKg;
    if (!(total > 0))
      ls.push({ field: "Khối lượng", message: "Phải lớn hơn 0 kg" });
    setEditErrors(ls);
    if (ls.length > 0) return;
    const record: WipProductionItem = {
      ...edit,
      quantityKg: total,
      tentacleKg: isEditSplit ? edit.tentacleKg ?? 0 : null,
      stomachKg: isEditSplit ? edit.stomachKg ?? 0 : null,
      batterKg: sanitizeBatterKg(edit.batterKg),
      // Đổi mặt hàng ⇒ kiểu chế biến theo mặt hàng mới (không còn ô riêng).
      processingType:
        edit.productId === rows.find((r) => r.id === edit.id)?.productId
          ? edit.processingType
          : (products.find((m) => m.id === edit.productId)?.processingType ?? "").trim(),
    };
    persist(rows.map((r) => (r.id === edit.id ? record : r)));
    notify.saved("Đã lưu thay đổi");
    setEdit(null);
  };
  const remove = (r: WipProductionItem) => {
    const prevRows = rows;
    persist(rows.filter((x) => x.id !== r.id));
    notify.deleted(`Đã xóa ${productNameOf(r.productId)} — ${kg(r.quantityKg)}`, () =>
      persist(prevRows)
    );
  };

  /* ---- Sửa / bỏ một dòng BÁN NỘI ĐỊA đã ghi ---- */
  const openDomesticSaleEdit = (r: DomesticSaleItem) => {
    setEditingDomesticSale({ ...r });
    setDomesticSaleEditErrors([]);
  };
  const patchDomesticSaleEdit = (patch: Partial<DomesticSaleItem>) =>
    setEditingDomesticSale((d) => (d ? { ...d, ...patch } : d));
  const saveDomesticSaleEdit = () => {
    if (!editingDomesticSale) return;
    const ls: FieldError[] = [];
    if (!editingDomesticSale.materialTypeName.trim())
      ls.push({ field: "Loại nguyên liệu", message: "Chưa chọn loại nguyên liệu" });
    if (!(editingDomesticSale.quantityKg > 0))
      ls.push({ field: "Số lượng", message: "Phải lớn hơn 0 kg" });
    setDomesticSaleEditErrors(ls);
    if (ls.length > 0) return;
    const record: DomesticSaleItem = {
      ...editingDomesticSale,
      materialTypeName: editingDomesticSale.materialTypeName.trim(),
      customerName: editingDomesticSale.customerName.trim(),
    };
    persistDomesticSales(domesticSales.map((r) => (r.id === record.id ? record : r)));
    notify.saved("Đã lưu thay đổi bán nội địa");
    setEditingDomesticSale(null);
  };
  const removeDomesticSale = (r: DomesticSaleItem) => {
    const prevRows = domesticSales;
    persistDomesticSales(domesticSales.filter((x) => x.id !== r.id));
    notify.deleted(`Đã bỏ bán nội địa ${r.materialTypeName} — ${kg(r.quantityKg)}`, () =>
      persistDomesticSales(prevRows)
    );
  };
  /** Bỏ một lô hàng đông lạnh khỏi Sổ kho tháng — chỉ khi chưa lấy ra / chưa dồn tháng. */
  const removeFrozenLine = (l: MonthlyStockLine) => {
    const blocker = frozenLineRemovalBlocker(l, monthlyStock);
    if (blocker) {
      notify.warning(blocker);
      return;
    }
    const prevLedger = monthlyStock;
    setMonthlyStock(removeFrozenLot(monthlyStock, l.id));
    notify.deleted(`Đã bỏ ${l.itemName} — ${kg(l.inKg)} khỏi Hàng tạm (Sổ kho tháng)`, () => setMonthlyStock(prevLedger));
  };
  const frozenColumns: RecordTableColumn<MonthlyStockLine>[] = [
    { key: "ngay", header: "Ngày SX", render: (l) => formatDateVN(l.importDate), getSortValue: (l) => l.importDate },
    { key: "ten", header: "Tên hàng", primary: true, render: (l) => l.itemName, getSortValue: (l) => l.itemName },
    {
      key: "kg",
      header: "Số lượng",
      numeric: true,
      render: (l) => kg(l.inKg),
      getSortValue: (l) => l.inKg,
    },
    { key: "kho", header: "Nhập vào kho", render: (l) => l.warehouse, getSortValue: (l) => l.warehouse },
    {
      key: "tt",
      header: "Ở Sổ kho tháng",
      render: (l) => {
        const blocker = frozenLineRemovalBlocker(l, monthlyStock);
        return blocker ? <Tag variant="muted">Đã lấy ra ở sổ kho</Tag> : <Tag variant="done">Lô nhập Hàng tạm</Tag>;
      },
    },
  ];

  const domesticSaleColumns: RecordTableColumn<DomesticSaleItem>[] = [
    {
      key: "ngay",
      header: "Ngày",
      render: (r) => formatDateVN(r.saleDate),
      getSortValue: (r) => r.saleDate,
    },
    {
      key: "loai",
      header: "Loại nguyên liệu",
      primary: true,
      render: (r) => r.materialTypeName,
      getSortValue: (r) => r.materialTypeName,
    },
    {
      key: "kg",
      header: "Số lượng (kg)",
      numeric: true,
      render: (r) => num(r.quantityKg),
      getSortValue: (r) => r.quantityKg,
    },
    {
      key: "gia",
      header: "Đơn giá (đ/kg)",
      numeric: true,
      render: (r) =>
        r.unitPrice != null ? num(r.unitPrice) : <span className="text-muted-foreground">—</span>,
      getSortValue: (r) => r.unitPrice ?? 0,
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      numeric: true,
      hideOnMobile: true,
      render: (r) =>
        r.unitPrice != null ? (
          num(r.quantityKg * r.unitPrice)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      getSortValue: (r) => r.quantityKg * (r.unitPrice ?? 0),
    },
    {
      key: "kh",
      header: "Khách hàng",
      render: (r) => r.customerName || <span className="text-muted-foreground">—</span>,
      getSortValue: (r) => r.customerName,
    },
    {
      key: "nguoi",
      header: "Người ghi",
      hideOnMobile: true,
      render: (r) => r.operator || <span className="text-muted-foreground">—</span>,
      getSortValue: (r) => r.operator,
    },
  ];

  /* ---- A4: gửi báo cáo TP lên hệ thống (tách khỏi chốt ngày) ---- */
  const reportKey = `${effectiveFrom}${isSingleDay ? "" : `..${effectiveTo}`}·${workshop}`;
  const submitReport = () => {
    const row = operatorReport
      .map((b) => `${b.workshop}/${b.operator}: ${b.rowCount} dòng · ${kg(b.kg)}`)
      .join("; ");
    appendAuditEntries([
      {
        action: "submit",
        entity: "production_report",
        entityKey: reportKey,
        summary: `Gửi báo cáo thành phẩm ${rangeDescription} · ${workshop} — tổng ${kg(total)} (${view.length} dòng). ${row}`,
        diff: {
          sender: operator,
          total,
          byOperator: operatorReport,
          batterByType,
          domesticSale: { kg: domesticSaleViewTotal, rowCount: bndView.length },
        },
      },
    ]);
    const luc = new Date().toLocaleString("vi-VN");
    const next = { ...sentReports, [reportKey]: luc };
    setSentReports(next);
    // mốc "đã gửi" chỉ là phản hồi tại chỗ — lưu hụt (chặn cookie) thì thôi
    writeDevicePref(KEY_WIP_REPORT, JSON.stringify(next));
    notify.saved(
      `Đã gửi báo cáo thành phẩm ${rangeDescription} · ${workshop} lên hệ thống`
    );
  };

  /* ---- Chốt / mở lại ngày ---- */
  const lockDay = () => {
    /* Sổ chốt SX chưa nạp xong ⇒ chưa biết máy chủ đã có bản ghi (ngày, xưởng)
       chưa; tạo bản mới lúc này có thể trùng chỉ mục duy nhất ⇒ 23505. */
    if (lockStatus === "loading") {
      notify.error("Đang tải sổ chốt sản xuất từ máy chủ — đợi vài giây rồi bấm chốt lại");
      return;
    }
    // Mẻ chưa gắn lô NL: phải gắn, hoặc ghi lý do (lưu `lot_waivers` cho từng mẻ còn thiếu).
    if (batchesWithoutLot.length > 0 && !waiverReason.trim()) {
      setLockErrors([
        {
          field: "Lý do chưa gắn lô",
          message: `Còn ${batchesWithoutLot.length} mẻ chưa gắn lô nguyên liệu — bấm "Gắn lô NL" ở từng mẻ, hoặc ghi lý do chưa gắn`,
        },
      ]);
      return;
    }
    if (batchesWithoutLot.length > 0) {
      const luc = new Date().toISOString();
      saveLotWaivers([
        ...lotWaivers,
        ...batchesWithoutLot.map((r) => ({
          id: newId(),
          outputKind: "W" as const,
          outputId: r.id,
          reason: waiverReason.trim(),
          operator,
          recordedAt: luc,
        })),
      ]);
    }
    const bg = lockRecordOf(effectiveFrom, activeWorkshop);
    // Gom còn dở theo tên loại NL (cộng dồn trùng, bỏ dòng trống / ≤ 0).
    const leftoverByMaterial: Record<string, number> = {};
    for (const d of leftover) {
      const name = d.name.trim();
      const kgv = d.kg ?? 0;
      if (!name || kgv <= 0) continue;
      leftoverByMaterial[name] = (leftoverByMaterial[name] ?? 0) + kgv;
    }
    const leftoverTotal = Object.values(leftoverByMaterial).reduce((s, v) => s + v, 0);
    const sale: DailyLock = {
      /* Có bản ghi ⇒ dùng lại id; chưa có ⇒ id CỐ ĐỊNH ngày|xưởng (không newId()):
         hai máy cùng chốt ghi CÙNG một dòng, không đụng chỉ mục duy nhất
         (site, ngày, xưởng) rồi kẹt hàng chờ. */
      id: bg?.id ?? `${effectiveFrom}|${activeWorkshop}`,
      lockDate: effectiveFrom,
      workshop: activeWorkshop,
      isLocked: true,
      lockedAt: todayISO(),
      totalKgAtLock: actualTotal,
      reopenReason: "",
      note: lockNote,
      leftoverKg: leftoverTotal,
      leftoverByMaterial,
    };
    persistLocks(bg ? locks.map((c) => (c.id === bg.id ? sale : c)) : [...locks, sale]);
    notify.saved(
      `Đã chốt SX ${formatDateVN(effectiveFrom)} · xưởng ${activeWorkshop} — ${kg(actualTotal)}` +
        (leftoverTotal > 0 ? ` · còn dở ${kg(leftoverTotal)}` : "") +
        (batchesWithoutLot.length > 0 ? ` · ${batchesWithoutLot.length} mẻ chưa gắn lô (có lý do)` : "")
    );
    setIsConfirmingLock(false);
    setLockNote("");
    setLeftover([]);
    setWaiverReason("");
    setLockErrors([]);
  };
  const reopenDay = () => {
    const bg = lockRecordOf(effectiveFrom, activeWorkshop);
    if (!bg) return;
    if (!reopenReason.trim()) {
      setLockErrors([{ field: "Lý do mở lại", message: "Ghi rõ vì sao mở lại" }]);
      return;
    }
    persistLocks(
      locks.map((c) =>
        c.id === bg.id ? { ...c, isLocked: false, reopenReason } : c
      )
    );
    notify.warning(`Đã mở lại SX ${formatDateVN(effectiveFrom)} · xưởng ${activeWorkshop}`);
    setIsConfirmingReopen(false);
    setReopenReason("");
    setLockErrors([]);
  };

  const cols: RecordTableColumn<WipProductionItem>[] = [
    {
      key: "mh",
      header: "Thành phẩm",
      primary: true,
      render: (r) => productNameOf(r.productId),
      getSortValue: (r) => productNameOf(r.productId),
    },
    {
      key: "kg",
      header: "Số lượng (kg)",
      numeric: true,
      render: (r) =>
        r.tentacleKg != null || r.stomachKg != null ? (
          <span>
            {num(r.quantityKg)}
            <span className="block text-sm text-muted-foreground">
              râu {num(r.tentacleKg ?? 0)} · bao tử{" "}
              {num(r.stomachKg ?? 0)}
            </span>
          </span>
        ) : (
          num(r.quantityKg)
        ),
      getSortValue: (r) => r.quantityKg,
    },
    {
      key: "bl",
      header: "Block",
      numeric: true,
      render: (r) =>
        r.blocksCount ? num(r.blocksCount) : <span className="text-muted-foreground">—</span>,
      getSortValue: (r) => r.blocksCount,
    },
    {
      key: "bot",
      header: "Bột tẩm (kg)",
      hideOnMobile: true,
      render: (r) => {
        const t = sumBatterKg(r.batterKg);
        return t > 0 ? (
          <span>
            <span className="tnum">{num(t)}</span>
            <span className="block text-sm text-muted-foreground">{describeBatter(r.batterKg)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      getSortValue: (r) => sumBatterKg(r.batterKg),
    },
    {
      key: "cb",
      header: "Chế biến",
      render: (r) => r.processingType || <span className="text-muted-foreground">—</span>,
      getSortValue: (r) => r.processingType ?? "",
    },
    {
      key: "kh",
      header: "Khách hàng",
      render: (r) => r.customerName || <span className="text-muted-foreground">—</span>,
      getSortValue: (r) => r.customerName ?? "",
    },
    {
      key: "tt",
      header: "Trạng thái",
      render: (r) =>
        r.status === "stocked" ? (
          <Tag variant="done">
            Đã nhập kho{r.warehouse ? ` · ${r.warehouse}` : ""}
          </Tag>
        ) : (
          <Tag variant="pending">Chờ nhập kho</Tag>
        ),
      getSortValue: (r) => r.status,
    },
    {
      key: "nguoi",
      header: "Người ghi",
      hideOnMobile: true,
      render: (r) => r.operator || <span className="text-muted-foreground">—</span>,
      getSortValue: (r) => r.operator ?? "",
    },
  ];

  const editTotal = isEditSplit
    ? (edit?.tentacleKg || 0) + (edit?.stomachKg || 0)
    : edit?.quantityKg || 0;

  // FORM NHẬP (form-first) — trước đây nằm trong Dialog, nay render INLINE ở chế độ
  // "Ghi nhập": điền như tờ giấy, không phải mở modal trong trang quản lý.
  /** Nút của một dòng sổ sản xuất (gắn lô · tem · sửa · bỏ) — dùng chung cho Sổ ngày và
   *  khối "Đã ghi ngày …" dưới phiếu ghi. */
  const wipRowActions = (r: WipProductionItem) => (
    <div className="flex flex-wrap gap-2">
      {canWriteRow(r) && (
      <Button
        title="Ghi mẻ này đã dùng lô nguyên liệu nào (quét tem, gõ mã, hoặc chọn). Có lô thì mới truy được nguồn của mẻ."
        variant={countLotInputs(r.id) ? "outline" : "default"}
        size="sm"
        onClick={() => setLotTarget(r)}
      >
        <Link2 />
        {countLotInputs(r.id) ? `Lô NL (${countLotInputs(r.id)})` : "Gắn lô NL"}
      </Button>
      )}
      {allowed.export && (
      <Button
        title="In tem QR lô bán thành phẩm của mẻ này để dán lên block/thùng. Quét tem là ra nguồn gốc."
        variant="outline"
        size="sm"
        onClick={() => setLotLabel([r])}
      >
        <QrCode />
        Tem
      </Button>
      )}
      {canRow("update", r) && (
      <Button
        title="Mở lại dòng sản lượng này để sửa số kg hoặc mặt hàng." variant="edit" size="sm" onClick={() => openEdit(r)}>
        <Pencil />
        Sửa
      </Button>
      )}
      {canRow("delete", r) && (
      <Button
        title="Bỏ dòng sản lượng này khỏi sổ. Có hỏi xác nhận và còn nút Hoàn tác." variant="danger" size="sm" onClick={() => remove(r)}>
        Bỏ
      </Button>
      )}
    </div>
  );

  /* Dòng ĐÃ GHI của ngày · xưởng đang ghi — hiện ngay dưới phiếu (lỗi 2026-10-16: chốt
     rồi mở lại ngày, phiếu ghi trống trơn, không thấy số đã chốt để sửa). */
  const sessionDayRows = session
    ? rows.filter((r) => r.productionDate === session.productionDate && r.workshop === session.workshop)
    : [];
  const sessionDayKg = sessionDayRows.reduce((sum, r) => sum + (r.quantityKg || 0), 0);

  const entryForm = session && (
    <div className="space-y-6 rounded-xl border-2 border-border bg-card p-4 md:p-6">
      <ErrorSummary errors={sessionErrors} />
      <RequiredLegend />

      {isSessionLocked && (
        <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
          <Lock className="mt-0.5 size-6 shrink-0" aria-hidden />
          <span>
            Ngày {formatDateVN(session.productionDate)} · xưởng {session.workshop}{" "}
            <strong>đã chốt</strong> — ghi thêm là <strong>ghi bù</strong>, bắt
            buộc lý do.
          </span>
        </p>
      )}

      {/* Ba ô đầu phiên MỘT hàng (sm trở lên): ngày ghi sổ · ngày SX · phân xưởng. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <DateField
          label="Ngày ghi sổ"
          required
          info="Ngày ghi vào hệ thống. Chọn ngày này thì ngày SX tự nhảy theo (tới khi bạn tự sửa)."
          value={session.postingDate}
          onChange={changePostingDate}
        />
        <DateField
          label="Ngày sản xuất"
          required
          info="Ngày làm ra thật — mọi tổng hợp tính theo ngày này. Sửa tay khi làm hôm khác (ghi bù)."
          value={session.productionDate}
          onChange={changeProductionDate}
        />
        <Combobox
          label="Phân xưởng"
          required
          clearable={false}
          value={session.workshop}
          onChange={(v) => setSessionField("workshop", v as Workshop)}
          options={writableWorkshops.map((p) => ({ value: p, label: p }))}
        />
      </div>

      {sessionNeedsReason && (
        <Field label="Lý do ghi bù" required hint="VD: cuối ca mới cân xong.">
          <Input
            value={session.backdateReason}
            onChange={(e) => setSessionField("backdateReason", e.target.value)}
            placeholder="Vì sao ghi sau ngày SX?"
          />
        </Field>
      )}

      {!canCreateIn(session.workshop) ? (
        <p className="text-base text-muted-foreground">
          Bạn chỉ ghi được xưởng {writableWorkshops.join(", ")} — chọn lại phân xưởng ở trên để ghi.
        </p>
      ) : (
      <>
      <div className="border-t-2 border-border pt-1" />

      {/* Lô NL dùng cho phiên (truy xuất QR đợt 2b) — khai một lần, lưu là gắn cho mọi mẻ cùng loài. */}
      <SessionLotsSection
        traceData={lightTraceData}
        workshop={session.workshop}
        date={session.productionDate}
        sessionLots={sessionLotsOf(session)}
        onChange={(items) => setDeclaredSessionLots({ date: session.productionDate, workshop: session.workshop, lots: items })}
      />

      {/* Bảng thành phẩm — nhập cả phiên một lượt, lưu một lần. KHÔNG bọc thêm khung
          (đã nằm trong khung form) — nhường bề ngang cho cột tên ở tablet. */}
      <div className="space-y-3">
        {/* Câu hướng dẫn ngay dưới tiêu đề (không dạt sang mép phải ở màn rộng). */}
        <div>
          <p className="text-base font-semibold">Thành phẩm làm ra trong ngày</p>
          <p className="text-sm text-muted-foreground">
            Chọn thành phẩm, gõ số block hoặc kg — dòng mới tự hiện. Bấm ✂ để tách râu + bao tử.
          </p>
        </div>

        <ProductionLinesTable
          lines={tableRows}
          products={products}
          onUpdateRow={updateRow}
          onRemove={removeRow}
          onCreateProduct={productEditor.canCreate ? addProduct : undefined}
          onEditProduct={openProductEdit}
          canEditProduct={productEditor.canEdit}
          onDeleteProduct={productDeleter.requestDelete}
          canDeleteProduct={productDeleter.canDelete}
          deleteProductLabel={productDeleter.deleteLabel}
          batterTypes={batterTypes}
          batterOptions={batterOptions}
          onCreateBatter={batterEditor.canCreate ? addBatter : undefined}
          onEditBatter={batterEditor.openEdit}
          canEditBatter={batterEditor.canEdit}
        />

        {validRows.length > 0 && (
          <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1">
            <span className="text-base text-muted-foreground">
              {validRows.length} thành phẩm · phiên này
            </span>
            {sessionBatterKg > 0 && (
              <span className="text-base text-muted-foreground">
                Bột tẩm <span className="tnum font-semibold text-foreground">{kg(sessionBatterKg)}</span>
              </span>
            )}
            <span className="tnum text-lg font-semibold">{kg(sessionTotal)}</span>
          </div>
        )}
      </div>

      {/* Bán nội địa (mig 0054): NL bán thẳng — sổ riêng, không cộng vào thành phẩm. */}
      <DomesticSaleSection
        lines={domesticSaleLines}
        onUpdateRow={(key, patch) =>
          setDomesticSaleLines((items) => items.map((d) => (d.key === key ? { ...d, ...patch } : d)))
        }
        onRemove={(key) => setDomesticSaleLines((items) => items.filter((d) => d.key !== key))}
        onAddRow={() => setDomesticSaleLines((items) => [...items, createEmptyDomesticSaleLine(items.at(-1)?.materialTypeName ?? "")])}
        materialTypeCell={materialTypeFieldProps}
        customerField={customerFieldProps}
      />

      {/* Hàng đông lạnh (sơ chế cấp đông, chưa phải thành phẩm) → nhóm Hàng tạm ở Sổ kho tháng. */}
      <FrozenStockSection
        lines={frozenLines}
        onUpdateRow={(key, patch) => setFrozenLines((items) => items.map((d) => (d.key === key ? { ...d, ...patch } : d)))}
        onRemove={(key) => setFrozenLines((items) => items.filter((d) => d.key !== key))}
        onAddRow={() =>
          setFrozenLines((items) => [...items, createEmptyFrozenDraft(items.at(-1)?.warehouse || DEFAULT_FROZEN_WAREHOUSE)])
        }
        itemCell={frozenItemCell}
        warehouseOptions={warehouseOptions}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-base text-muted-foreground">
          Tổng ngày {formatDateVN(session.productionDate)} · xưởng {session.workshop}:{" "}
          <span className="tnum text-xl font-semibold text-foreground">
            {kg(
              rows
                .filter(
                  (r) =>
                    r.productionDate === session.productionDate &&
                    r.workshop === session.workshop
                )
                .reduce((s, r) => s + (r.quantityKg || 0), 0) + sessionTotal
            )}
          </span>
        </span>
        <Button variant="save"
          title="Ghi toàn bộ sản lượng đang gõ vào sổ sản xuất của ngày và xưởng đang chọn." size="lg" onClick={finishSession} className="w-full sm:w-auto">
          <Plus />
          Lưu vào sổ
        </Button>
      </div>
      </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-foreground">
            Sản xuất thành phẩm
            {isReadOnly && <ReadOnlyBadge />}
          </h1>
        </div>
        {/* Tách rõ NHẬP với TRA CỨU: một màn làm một việc. */}
        {canEnter && (
        <div className="flex w-full overflow-hidden rounded-xl border-2 border-border sm:w-auto">
          <button
            title="Sang chế độ Ghi nhập để gõ sản lượng thành phẩm."
            type="button"
            onClick={() => setMode("entry")}
            className={cn(
              "flex-1 px-4 py-2.5 text-base font-semibold transition-colors sm:flex-none",
              mode === "entry"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            📝 Ghi nhập
          </button>
          <button
            title="Xem sổ sản lượng đã ghi trong ngày và báo cáo theo xưởng, chốt ngày tại đây."
            type="button"
            onClick={() => setMode("ledger")}
            className={cn(
              "flex-1 border-l-2 border-border px-4 py-2.5 text-base font-semibold transition-colors sm:flex-none",
              mode === "ledger"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            📖 Sổ ngày & báo cáo
          </button>
        </div>
        )}
      </div>

      <DailyTaskReminder
        isLocked={isProductionLockedToday}
        task={`thành phẩm làm ra hôm nay — xưởng ${recordWorkshop}`}
      />

      {activeMode === "entry" && <DraftRestoredNotice savedAt={wipDraft.restoredAt} onDiscard={discardWipDraft} />}

      {activeMode === "entry" && entryForm}

      {activeMode === "entry" && session && sessionDayRows.length > 0 && (
        <section className="space-y-3 rounded-xl border-2 border-border p-4 md:p-6" aria-label="Thành phẩm đã ghi trong ngày">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Đã ghi ngày {formatDateVN(session.productionDate)} · xưởng {session.workshop}
              <span className="tnum font-normal text-muted-foreground">
                {" "}— {num(sessionDayRows.length)} dòng · {kg(sessionDayKg)}
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Số đã lưu vào sổ. Sửa / bỏ từng dòng ngay tại đây; ngày đã chốt thì bấm "Mở lại ngày" ở trên rồi mới sửa được.
            </p>
          </div>
          <RecordTable
            columns={cols}
            rows={sessionDayRows}
            getKey={(r) => r.id}
            rowMarkKey="san-xuat-tp"
            actions={wipRowActions}
          />
        </section>
      )}

      {activeMode === "ledger" && (
        <>
      {allowed.export && (
      <div className="flex flex-wrap gap-2">
        <Button
          title="In tờ phiếu trống để ghi tay sản lượng ngoài xưởng, tối về nhập lại vào máy." variant="outline" size="lg" onClick={() => setIsPrintingBlank(true)}>
          <Printer />
          In phiếu trống
        </Button>
      </div>
      )}
      <StatCardGrid
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        cards={[
          { label: "Đang xem", value: rangeDescription, icon: CalendarRange, color: "neutral" },
          { label: "Phân xưởng", value: workshop, icon: Warehouse, color: "neutral" },
          { label: "Số dòng", value: view.length, numeric: true, icon: ClipboardList, color: "brand" },
          { label: "Chờ nhập kho", value: pendingInCount, numeric: true, icon: Hourglass, color: "warning" },
          { label: "Tổng sản lượng", value: kg(total), numeric: true, icon: Scale, color: "success" },
        ]}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-border p-4">
        <Combobox
          label="Kỳ xem sổ"
          hideRequiredMark
          clearable={false}
          value={period}
          onChange={(v) => setPeriod(v as ViewPeriod)}
          options={PERIOD_OPTIONS}
          className="min-w-[13rem]"
        />
        <div className="min-w-[220px] flex-1">
          {period === "custom" ? (
            <DateRangeField
              label="Khoảng ngày sản xuất"
              hideRequiredMark
              presets={false}
              startDate={fromDate}
              endDate={toDate}
              onChange={(fromDate, toDate) => {
                setFromDate(fromDate);
                setToDate(toDate);
              }}
            />
          ) : (
            <DateField
              label="Ngày sản xuất"
              hideRequiredMark
              hint={
                period === "day"
                  ? undefined
                  : `Kỳ: ${formatDateVN(effectiveFrom)} – ${formatDateVN(effectiveTo)}`
              }
              value={date}
              onChange={setDate}
            />
          )}
        </div>
        <Combobox
          label="Phân xưởng"
          hideRequiredMark
          clearable={false}
          value={workshop}
          onChange={(v) => setWorkshop(v as Workshop | "Tất cả")}
          options={[
            ...WORKSHOPS.map((p) => ({ value: p, label: p })),
            { value: "Tất cả", label: "Tất cả" },
          ]}
          className="min-w-[220px] flex-1"
        />
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : view.length === 0 ? (
        <EmptyState
          icon={Factory}
          title={`Chưa ghi thành phẩm trong ${rangeDescription}`}
          description={`Phân xưởng ${workshop}. Chuyển sang "Ghi nhập" để ghi.`}
          action={
            canEnter ? (
            <Button
              title="Chuyển sang chế độ Ghi để nhập sản lượng cho ngày này." size="lg" onClick={() => setMode("entry")}>
              <Plus />
              Sang Ghi nhập
            </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <RecordTable
            columns={cols}
            rows={view}
            getKey={(r) => r.id}
            rowMarkKey="san-xuat-tp"
            getSearchText={(r) => `${productNameOf(r.productId)} ${r.customerName ?? ""}`}
            searchLabel="Tìm theo thành phẩm / khách…"
            actions={wipRowActions}
          />
          <div className="flex flex-wrap justify-end gap-x-10 gap-y-2 rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">Tổng block</span>
              <span className="tnum text-xl font-semibold">{num(totalBlocks)}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng sản lượng
              </span>
              <span className="tnum text-xl font-semibold">{kg(total)}</span>
            </div>
          </div>

          {/* Bột tẩm đã dùng (mig 0051) — cộng theo loại cho phạm vi đang xem; là số
              kế toán điền nhóm "Bột phụ gia" (Khối 1) ở Cân đối. */}
          {batterByType.length > 0 && (
            <div className="space-y-3 rounded-xl border-2 border-border p-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Wheat className="size-icon shrink-0" aria-hidden />
                  Bột tẩm đã dùng
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cộng theo loại bột cho {rangeDescription} · {workshop}. Bột là phụ gia —
                  không nằm trong tổng sản lượng; dùng số này cho nhóm "Bột phụ gia" ở
                  Cân đối.
                </p>
              </div>
              <HorizontalScroll viewportClassName="rounded-lg border border-border">
                <table className="w-full border-collapse text-base">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left">
                      <th className="px-3 py-2 font-semibold">Loại bột</th>
                      <th className="px-3 py-2 text-right font-semibold">Số dòng TP</th>
                      <th className="px-3 py-2 text-right font-semibold">Tổng kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batterByType.map((b) => (
                      <tr key={b.name} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{b.name}</td>
                        <td className="tnum px-3 py-2 text-right">{num(b.rowCount)}</td>
                        <td className="tnum px-3 py-2 text-right font-semibold">{kg(b.kg)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-semibold">
                      <td className="px-3 py-2" colSpan={2}>
                        Tổng bột tẩm
                      </td>
                      <td className="tnum px-3 py-2 text-right">{kg(batterViewTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </HorizontalScroll>
            </div>
          )}
        </>
      )}

      {/* Hàng đông lạnh → Hàng tạm (Sổ kho tháng) — hiện cả khi ngày không có thành phẩm. */}
      {frozenView.length > 0 && (
        <div className="space-y-3 rounded-xl border-2 border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Snowflake className="size-icon shrink-0" aria-hidden />
                Hàng đông lạnh nhập kho (Hàng tạm)
              </h2>
              <p className="text-sm text-muted-foreground">
                Hàng sơ chế cấp đông — {rangeDescription} · {workshop}. Mỗi dòng là một lô nhập nhóm Hàng
                tạm ở Sổ kho theo tháng; không nằm trong tổng sản lượng thành phẩm.
              </p>
            </div>
            <Button
              variant="outline"
              title="Mở Sổ kho theo tháng để xem các lô này trong nhóm Hàng tạm."
              onClick={() => navigate("/monthly-stock")}
            >
              <Warehouse />
              Mở Sổ kho tháng
            </Button>
          </div>
          <RecordTable
            columns={frozenColumns}
            rows={frozenView}
            getKey={(l) => l.id}
            rowMarkKey="hang-dong-lanh-sx"
            actions={(l) =>
              canRow("delete", { workshop: activeWorkshop }) && !frozenLineRemovalBlocker(l, monthlyStock) ? (
                <ConfirmDelete
                  recordDescription={`Hàng đông lạnh ${l.itemName} — ${kg(l.inKg)} (${formatDateVN(l.importDate)} · ${l.warehouse})`}
                  onConfirm={() => removeFrozenLine(l)}
                  trigger={
                    <Button
                      title="Bỏ lô này khỏi nhóm Hàng tạm ở Sổ kho tháng (ghi sai). Có hỏi xác nhận và còn nút Hoàn tác."
                      variant="danger"
                      size="sm"
                    >
                      Bỏ
                    </Button>
                  }
                />
              ) : null
            }
          />
          <div className="flex flex-wrap justify-end gap-x-10 gap-y-2 rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">Tổng hàng đông lạnh</span>
              <span className="tnum text-xl font-semibold">{kg(frozenViewTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bán nội địa (mig 0054) — sổ riêng; hiện cả khi ngày không có thành phẩm. */}
      {bndView.length > 0 && (
        <div className="space-y-3 rounded-xl border-2 border-border p-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Store className="size-icon shrink-0" aria-hidden />
              Bán nội địa
            </h2>
            <p className="text-sm text-muted-foreground">
              Nguyên liệu bán thẳng cho khách trong nước — {rangeDescription} · {workshop}. Không
              nằm trong tổng sản lượng; Cân đối lấy số này cho dòng “Bán nội địa”.
            </p>
          </div>
          <RecordTable
            columns={domesticSaleColumns}
            rows={bndView}
            getKey={(r) => r.id}
            rowMarkKey="ban-noi-dia"
            actions={(r) => (
              <div className="flex flex-wrap gap-2">
                {canWriteRow(r) && (
                <Button
                  title="Ghi nguyên liệu bán này lấy từ lô NL nào (quét tem, gõ mã, hoặc chọn) — để thu hồi tới được khách."
                  variant={countDomesticSaleLots(r.id) ? "outline" : "default"}
                  size="sm"
                  onClick={() => setLotDomesticSale(r)}
                >
                  <Link2 />
                  {countDomesticSaleLots(r.id) ? `Lô NL (${countDomesticSaleLots(r.id)})` : "Gắn lô NL"}
                </Button>
                )}
                {canRow("update", r) && (
                <Button
                  title="Mở lại dòng bán nội địa này để sửa ngày, loại nguyên liệu, số lượng, giá hoặc khách."
                  variant="edit"
                  size="sm"
                  onClick={() => openDomesticSaleEdit(r)}
                >
                  <Pencil />
                  Sửa
                </Button>
                )}
                {canRow("delete", r) && (
                <ConfirmDelete
                  recordDescription={`Bán nội địa ${r.materialTypeName} — ${kg(r.quantityKg)} (${formatDateVN(r.saleDate)})`}
                  onConfirm={() => removeDomesticSale(r)}
                  trigger={
                    <Button
                      title="Bỏ dòng bán nội địa này khỏi sổ. Có hỏi xác nhận và còn nút Hoàn tác."
                      variant="danger"
                      size="sm"
                    >
                      Bỏ
                    </Button>
                  }
                />
                )}
              </div>
            )}
          />
          <div className="flex flex-wrap justify-end gap-x-10 gap-y-2 rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">Tổng bán nội địa</span>
              <span className="tnum text-xl font-semibold">{kg(domesticSaleViewTotal)}</span>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {isSingleDayWorkshop && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border-2 border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {isLocked ? (
              <Lock className="size-6 shrink-0 text-primary" aria-hidden />
            ) : (
              <LockOpen className="size-6 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="text-lg font-semibold text-foreground">
              {isLocked ? "Đã chốt" : "Chưa chốt"} {formatDateVN(effectiveFrom)} · xưởng {activeWorkshop}
            </span>
            <span className="text-base text-muted-foreground">
              Tổng{" "}
              <span className="tnum font-semibold text-foreground">
                {kg(actualTotal)}
              </span>
            </span>
            {postLockDiff !== 0 && (
              <span className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-base text-accent-foreground">
                <TriangleAlert className="size-5 shrink-0" aria-hidden />
                Còn ghi bù {postLockDiff > 0 ? "+" : ""}
                {num(postLockDiff)} kg sau chốt
              </span>
            )}
          </div>
          {isLocked ? (
            canRow("unlock", { workshop: activeWorkshop }) && (
            <Button
              title="Mở khóa lại ngày sản xuất đã chốt để sửa hoặc ghi bù. Phải ghi lý do, và việc mở khóa được lưu vết."
              variant="edit"
              size="lg"
              onClick={() => {
                setIsConfirmingReopen(true);
                setReopenReason("");
                setLockErrors([]);
              }}
            >
              <LockOpen />
              Mở lại ngày
            </Button>
            )
          ) : (
            canRow("lock", { workshop: activeWorkshop }) && (
            <Button variant="lock"
              title="Khóa sổ sản xuất ngày này và khai phần nguyên liệu CÒN DỞ tách theo từng loại. Số còn dở đó thành đông gửi ở sổ tồn kho nguyên liệu."
              size="lg"
              onClick={() => {
                setLockNote(currentLock?.note ?? "");
                const lb = currentLock?.leftoverByMaterial ?? {};
                setLeftover(
                  Object.entries(lb).map(([name, v]) => ({
                    id: uid(),
                    name,
                    kg: Number(v) || null,
                  }))
                );
                setLockErrors([]);
                setIsConfirmingLock(true);
              }}
            >
              <Lock />
              Chốt ngày
            </Button>
            )
          )}
        </div>
      )}

      {/* A4 — Báo cáo công việc ngày: gom theo (xưởng × người thao tác) + Gửi lên
          hệ thống (lưu vết audit), TÁCH khỏi "Chốt ngày" (khoá sửa). */}
      {view.length > 0 && (
        <div className="space-y-3 rounded-xl border-2 border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Users className="size-icon shrink-0" aria-hidden />
                Báo cáo công việc ngày
              </h2>
              <p className="text-sm text-muted-foreground">
                Gom theo xưởng × người thao tác cho {rangeDescription} · {workshop}.
                <b> Gửi</b> báo lên hệ thống (lưu vết) — khác với <b>Chốt ngày</b>{" "}
                (khoá sửa).
              </p>
            </div>
            {/* Điện thoại: nút trải hết bề ngang, chữ được xuống dòng (360 px × 130 % không tràn). */}
            <div className="flex w-full min-w-0 flex-col items-stretch gap-1 sm:w-auto sm:items-end">
              {allowed.export && (
              <Button
                className="h-auto min-h-10 whitespace-normal"
                title="Gửi báo cáo sản lượng ngày (gom theo xưởng × người ghi) lên hệ thống. Khác với chốt ngày: gửi báo cáo không khóa sổ." onClick={submitReport}>
                <Send />
                Gửi báo cáo lên hệ thống
              </Button>
              )}
              {sentReports[reportKey] && (
                <span className="text-sm text-success">
                  Đã gửi lúc {sentReports[reportKey]}
                </span>
              )}
            </div>
          </div>

          <HorizontalScroll viewportClassName="rounded-lg border border-border">
            <table className="w-full border-collapse text-base">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-3 py-2 font-semibold">Xưởng</th>
                  <th className="px-3 py-2 font-semibold">Người thao tác</th>
                  <th className="px-3 py-2 text-right font-semibold">Số dòng</th>
                  <th className="px-3 py-2 text-right font-semibold">Tổng kg</th>
                </tr>
              </thead>
              <tbody>
                {operatorReport.map((b) => (
                  <tr key={`${b.workshop}·${b.operator}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{b.workshop}</td>
                    <td className="px-3 py-2">{b.operator}</td>
                    <td className="tnum px-3 py-2 text-right">{num(b.rowCount)}</td>
                    <td className="tnum px-3 py-2 text-right font-semibold">{kg(b.kg)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2" colSpan={2}>
                    Tổng cộng
                  </td>
                  <td className="tnum px-3 py-2 text-right">{num(view.length)}</td>
                  <td className="tnum px-3 py-2 text-right">{kg(total)}</td>
                </tr>
              </tfoot>
            </table>
          </HorizontalScroll>
        </div>
      )}

      {/* Form ghi thành phẩm đã chuyển INLINE (chế độ "Ghi nhập" — biến formGhi ở trên). */}

      {/* Dialog sửa một dòng */}
      <Dialog open={edit !== null} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[92dvh] w-full overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sửa dòng thành phẩm</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={editErrors} />
              <RequiredLegend />
              <div className="grid gap-6 sm:grid-cols-2">
                <DateField
                  label="Ngày ghi sổ"
                  required
                  value={edit.postingDate || edit.productionDate}
                  onChange={(v) => patchEdit({ postingDate: v })}
                />
                <DateField
                  label="Ngày sản xuất"
                  required
                  value={edit.productionDate}
                  onChange={(v) => patchEdit({ productionDate: v })}
                />
              </div>
              <Combobox
                label="Phân xưởng"
                required
                clearable={false}
                value={edit.workshop}
                onChange={(v) => patchEdit({ workshop: v as Workshop })}
                options={WORKSHOPS.filter((p) => p === edit.workshop || canRow("update", { ...edit, workshop: p })).map((p) => ({ value: p, label: p }))}
              />
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Combobox
                    label="Thành phẩm"
                    required
                    value={edit.productId}
                    onChange={(v) => patchEdit({ productId: v })}
                    options={productOptions}
                    onCreate={productEditor.canCreate ? (name) => addProduct(name) : undefined}
                    emptyText="Chưa có thành phẩm — gõ tên rồi Thêm mới."
                    onEditItem={openProductEdit}
                    canEdit={productEditor.canEdit}
                    editLabel={productEditor.editLabel}
                    onDeleteItem={productDeleter.requestDelete}
                    canDelete={productDeleter.canDelete}
                    deleteLabel={productDeleter.deleteLabel}
                  />
                </div>
                {edit.productId && productEditor.canEdit(edit.productId) && (
                  <Button
                    type="button"
                    variant="edit"
                    size="icon"
                    aria-label="Sửa thành phẩm này"
                    title="Sửa thông tin thành phẩm đang chọn (tên, mã số, loài, kiểu chế biến, quy cách) — lưu thẳng vào Danh mục."
                    onClick={() => openProductEdit(edit.productId)}
                  >
                    <Pencil />
                  </Button>
                )}
              </div>
              <Combobox
                label="Khách hàng"
                value={edit.customerName ?? ""}
                onChange={(v) => patchEdit({ customerName: v })}
                options={customerOptions}
                onCreate={customerEditor.canCreate ? (name) => addCustomer(name) : undefined}
                placeholder="Chọn khách hàng (nếu có)"
                emptyText="Chưa có khách — gõ tên rồi Thêm mới."
                onEditItem={customerEditor.openEdit}
                canEdit={customerEditor.canEdit}
                editLabel={customerEditor.editLabel}
              />

              {isEditSplit ? (
                <Field label="Số lượng (tổng râu + bao tử)">
                  <div className="tnum flex h-10 items-center rounded-md bg-muted px-3 text-base font-semibold">
                    {num(editTotal)} kg
                  </div>
                </Field>
              ) : (
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={edit.quantityKg || null}
                  onChange={(v) => patchEdit({ quantityKg: v ?? 0 })}
                />
              )}

              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-sm text-muted-foreground">
                  Tách râu + bao tử (cùng giá) — bỏ trống nếu không tách. Nhập
                  vào thì Số lượng = tổng hai ô.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Râu"
                    unit="kg"
                    value={edit.tentacleKg ?? null}
                    onChange={(v) => patchEdit({ tentacleKg: v ?? 0 })}
                  />
                  <NumberField
                    label="Bao tử"
                    unit="kg"
                    value={edit.stomachKg ?? null}
                    onChange={(v) => patchEdit({ stomachKg: v ?? 0 })}
                  />
                </div>
              </div>

              {(isBatteredProduct(products.find((m) => m.id === edit.productId)) ||
                /bột/i.test(edit.processingType ?? "") ||
                sumBatterKg(edit.batterKg) > 0) && (
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-base font-semibold">Bột tẩm</p>
                  <BatterSection
                    bundledIds={batterNamesOf(edit.productId)}
                    batterKg={edit.batterKg ?? {}}
                    onChange={(batterKg) => patchEdit({ batterKg })}
                    batterOptions={batterOptions}
                    onCreateBatter={batterEditor.canCreate ? addBatter : undefined}
                    onEditBatter={batterEditor.openEdit}
                    canEditBatter={batterEditor.canEdit}
                    productKg={editTotal}
                  />
                </div>
              )}

              <NumberField
                label="Số block"
                unit="block"
                value={edit.blocksCount || null}
                onChange={(v) => patchEdit({ blocksCount: v ?? 0 })}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setEdit(null)}>
              Hủy
            </Button>
            <Button variant="save"
              title="Ghi đè dòng sản lượng này bằng số vừa sửa." size="lg" onClick={saveEdit}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog sửa một dòng bán nội địa */}
      <Dialog open={editingDomesticSale !== null} onOpenChange={(o) => !o && setEditingDomesticSale(null)}>
        <DialogContent className="max-h-[92dvh] w-full overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sửa dòng bán nội địa</DialogTitle>
            <DialogDescription>
              Nguyên liệu bán thẳng cho khách trong nước — không cộng vào sản lượng thành phẩm.
            </DialogDescription>
          </DialogHeader>
          {editingDomesticSale && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={domesticSaleEditErrors} />
              <RequiredLegend />
              <div className="grid gap-6 sm:grid-cols-2">
                <DateField
                  label="Ngày bán"
                  required
                  value={editingDomesticSale.saleDate}
                  onChange={(v) => patchDomesticSaleEdit({ saleDate: v })}
                />
                <Combobox
                  label="Phân xưởng"
                  required
                  clearable={false}
                  value={editingDomesticSale.workshop}
                  onChange={(v) => patchDomesticSaleEdit({ workshop: v as Workshop })}
                  options={WORKSHOPS.filter(
                    (p) => p === editingDomesticSale.workshop || canRow("update", { ...editingDomesticSale, workshop: p })
                  ).map((p) => ({ value: p, label: p }))}
                />
              </div>
              <Combobox
                label="Loại nguyên liệu"
                required
                value={editingDomesticSale.materialTypeName}
                onChange={(v) => patchDomesticSaleEdit({ materialTypeName: v })}
                options={materialTypeFieldProps.options}
                onCreate={materialTypeFieldProps.onCreate}
                onEditItem={materialTypeFieldProps.onEditItem}
                canEdit={materialTypeFieldProps.canEdit}
                editLabel={materialTypeFieldProps.editLabel}
                placeholder="— Chọn loại NL —"
                emptyText="Chưa có loại này — gõ tên rồi Thêm mới."
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={editingDomesticSale.quantityKg || null}
                  onChange={(v) => patchDomesticSaleEdit({ quantityKg: v ?? 0 })}
                />
                <NumberField
                  label="Đơn giá"
                  unit="đ/kg"
                  value={editingDomesticSale.unitPrice}
                  onChange={(v) => patchDomesticSaleEdit({ unitPrice: v })}
                />
              </div>
              <Combobox
                label="Khách hàng"
                value={editingDomesticSale.customerName}
                onChange={(v) => patchDomesticSaleEdit({ customerName: v })}
                options={customerFieldProps.options}
                onCreate={customerFieldProps.onCreate}
                onEditItem={customerFieldProps.onEditItem}
                canEdit={customerFieldProps.canEdit}
                editLabel={customerFieldProps.editLabel}
                placeholder="— Chọn khách (nếu có) —"
                emptyText="Chưa có khách này — gõ tên rồi Thêm mới."
              />
              <Field label="Ghi chú">
                <Input
                  value={editingDomesticSale.note}
                  onChange={(e) => patchDomesticSaleEdit({ note: e.target.value })}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setEditingDomesticSale(null)}>
              Hủy
            </Button>
            <Button variant="save" title="Ghi đè dòng bán nội địa này bằng số vừa sửa." size="lg" onClick={saveDomesticSaleEdit}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog chốt ngày */}
      <Dialog open={isConfirmingLock} onOpenChange={setIsConfirmingLock}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Chốt ngày sản xuất</DialogTitle>
            <DialogDescription className="text-base">
              Khoá {formatDateVN(effectiveFrom)} · xưởng {activeWorkshop} — tổng {kg(actualTotal)}. Ghi
              thêm sau khi chốt phải ghi bù.
            </DialogDescription>
          </DialogHeader>
          <ErrorSummary errors={lockErrors} />
          <Field label="Ghi chú chốt">
            <Input
              value={lockNote}
              onChange={(e) => setLockNote(e.target.value)}
              placeholder="Ghi chú (nếu có)"
            />
          </Field>

          {/* Gắn lô NL (truy xuất QR): mẻ chưa gắn lô thì quét tem thành phẩm không truy
              ngược được về nguyên liệu. Chốt phải gắn hết, hoặc ghi lý do (lot_waivers). */}
          {batchesWithoutLot.length > 0 && (
            <div className="min-w-0 space-y-2 rounded-lg border-2 border-warning/60 bg-warning/10 p-3">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                <Tag variant="warning">Chưa gắn lô</Tag>
                {batchesWithoutLot.length} mẻ chưa ghi đã dùng lô nguyên liệu nào
              </p>
              <p className="text-muted-foreground">
                Không gắn thì quét tem thành phẩm sẽ không truy ngược được về nguyên liệu. Gắn lô cho từng mẻ, hoặc
                ghi lý do chưa gắn bên dưới (áp cho các mẻ còn lại) rồi mới chốt được.
              </p>
              <ul className="space-y-1">
                {batchesWithoutLot.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      {productNameOf(r.productId)} · <span className="tnum">{kg(r.quantityKg || 0)}</span>
                    </span>
                    {canWriteRow(r) && (
                    <Button
                      title="Đóng hộp chốt và mở hộp gắn lô nguyên liệu cho mẻ này (quét tem, gõ mã hoặc chọn)."
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsConfirmingLock(false);
                        setLotTarget(r);
                      }}
                    >
                      <Link2 />
                      Gắn lô NL
                    </Button>
                    )}
                  </li>
                ))}
              </ul>
              <Field
                label="Lý do chưa gắn lô"
                required
                hint="VD: NL tồn từ trước khi dùng tem QR · tem bong không còn mã. Lý do được lưu theo từng mẻ."
              >
                <Input value={waiverReason} onChange={(e) => setWaiverReason(e.target.value)} />
              </Field>
            </div>
          )}

          {/* Còn dở cuối ngày (khép vòng G1): NL chưa chế biến hết đem lưu kho →
              sổ Tồn kho NL cộng vào "đông gửi" kỳ tương ứng. Tách theo loại NL. */}
          <div className="min-w-0 space-y-2 rounded-lg border-2 border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-foreground">
                Nguyên liệu còn dở đem lưu kho
              </p>
              {leftoverDraftTotal > 0 && (
                <span className="tnum text-base font-semibold text-primary">
                  {kg(leftoverDraftTotal)}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              NL chưa chế biến hết trong ngày, đem cấp đông lưu kho. Ghi ở đây để
              sổ Tồn kho NL cộng vào <b>đông gửi</b> — bỏ trống nếu không còn dở.
            </p>
            {leftover.length > 0 && (
              <div className="space-y-2">
                {leftover.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1 basis-40">
                      <Combobox
                        label="Loại nguyên liệu"
                        hideLabel
                        value={d.name}
                        onChange={(v) =>
                          setLeftover((rs) =>
                            rs.map((x) => (x.id === d.id ? { ...x, name: v } : x))
                          )
                        }
                        options={materialTypes.map((l) => ({
                          value: l.name,
                          label: l.name,
                          subLabel: l.category || undefined,
                        }))}
                        onEditItem={materialTypeEditor.openEdit}
                        editLabel={materialTypeEditor.editLabel}
                        canEdit={materialTypeEditor.canEdit}
                        onCreate={
                          materialTypeEditor.canCreate
                            ? (name) => {
                                setMaterialTypes([
                                  ...materialTypes,
                                  { id: uid(), name, category: "", note: "" },
                                ]);
                                return name;
                              }
                            : undefined
                        }
                        placeholder="— Chọn loại NL —"
                      />
                    </div>
                    <div className="w-28 shrink-0">
                      <NumberField
                        label="Kg còn dở"
                        hideLabel
                        unit="kg"
                        value={d.kg}
                        onChange={(v) =>
                          setLeftover((rs) =>
                            rs.map((x) => (x.id === d.id ? { ...x, kg: v } : x))
                          )
                        }
                      />
                    </div>
                    <Button
                      title="Bỏ dòng nguyên liệu còn dở này khỏi phần khai."
                      variant="danger"
                      size="icon"
                      className="shrink-0"
                      aria-label="Xóa dòng còn dở"
                      onClick={() =>
                        setLeftover((rs) => rs.filter((x) => x.id !== d.id))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              title="Thêm một loại nguyên liệu còn dở nữa. Khai tách theo loại thì sổ tồn kho nguyên liệu mới cộng đúng."
              variant="outline"
              size="sm"
              onClick={() =>
                setLeftover((rs) => [...rs, { id: uid(), name: "", kg: null }])
              }
            >
              <Plus />
              Thêm loại còn dở
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setIsConfirmingLock(false)}>
              Hủy
            </Button>
            <Button variant="lock"
              title="Xác nhận khóa sổ sản xuất ngày này kèm phần còn dở đã khai." size="lg" onClick={lockDay}>
              <Lock />
              Chốt ngày
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog mở lại ngày */}
      <Dialog open={isConfirmingReopen} onOpenChange={setIsConfirmingReopen}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Mở lại ngày đã chốt</DialogTitle>
            <DialogDescription className="text-base">
              {formatDateVN(effectiveFrom)} · xưởng {activeWorkshop}. Sửa xong nhớ chốt lại.
            </DialogDescription>
          </DialogHeader>
          <ErrorSummary errors={lockErrors} />
          <RequiredLegend />
          <Field label="Lý do mở lại" required>
            <Input
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Vì sao mở lại ngày đã chốt?"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setIsConfirmingReopen(false)}>
              Hủy
            </Button>
            <Button variant="edit"
              title="Xác nhận mở khóa ngày sản xuất này để sửa hoặc ghi bù." size="lg" onClick={reopenDay}>
              <LockOpen />
              Mở lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {productEditor.dialog}
      {productDeleter.dialog}
      {customerEditor.dialog}
      {materialTypeEditor.dialog}
      {batterEditor.dialog}
      {lotTarget && (
        <LotInputPicker
          outputKind="W"
          outputId={lotTarget.id}
          outputLabel={`mẻ ${formatWipLotLabel(lotTarget)} · ${productNameOf(lotTarget.productId)}`}
          workshop={lotTarget.workshop}
          date={lotTarget.productionDate}
          canRemove={canRow("delete", lotTarget)}
          onClose={() => setLotTarget(null)}
        />
      )}
      {lotDomesticSale && (
        <LotDispatchPicker
          docKind="domestic_sale"
          docId={lotDomesticSale.id}
          docLabel={`bán nội địa ${lotDomesticSale.materialTypeName} · ${kg(lotDomesticSale.quantityKg)} · ${formatDateVN(lotDomesticSale.saleDate)}`}
          lotKind="S"
          workshop={lotDomesticSale.workshop}
          date={lotDomesticSale.saleDate}
          canRemove={canRow("delete", lotDomesticSale)}
          onClose={() => setLotDomesticSale(null)}
        />
      )}
      {lotLabel && (
        <LotQrLabels
          nuts={lotLabel.map((w) =>
            buildLotNode("W", w.id, {
              shipments: [], imports: [], wips: [...rows, ...lotLabel.filter((t) => !rows.some((r) => r.id === t.id))],
              packagings: [], lotInputs, exportItems: [], exportOrders: [], salesOrders: [], products, customers: [],
            })
          )}
          onClose={() => setLotLabel(null)}
        />
      )}
      {isPrintingBlank && (
        <BlankDailyWipSlip onClose={() => setIsPrintingBlank(false)} />
      )}
    </div>
  );
}

/* ---------- Bảng thành phẩm của một phiên (nhập nhiều dòng một lượt) ---------- */
