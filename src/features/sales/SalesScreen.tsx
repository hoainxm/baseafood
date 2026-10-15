// ============================================================
// Tên file cũ: src/features/sales/BanHang.tsx
// Tên tiếng Việt: Màn hình Quản lý Bán hàng & Xuất kho
// Description: Sales Invoice & Export Management Screen
// ============================================================
import { useMemo, useState } from "react";
import type { SalesItem, Customer, Product, Workshop, SalesChannel, SalesInvoice } from "@/types";
import { SALES_CHANNELS, isBackdatedSales, calculateSalesAmount } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import {
  useSalesItems,
  useCustomers,
  useProducts,
  useSalesInvoices,
  useWipProductions,
  useExportItems,
  usePackagings,
  useLotInputs,
  useLotDispatches,
} from "@/lib/catalogRepo";
import {
  computeWipStock,
  getAvailableKg,
  RETAIL_WAREHOUSE,
  FG_WAREHOUSE,
  filterRetailSales,
  collectWipDeductions,
  computeFinishedGoodStock,
  getAvailableFinishedGoodKg,
} from "@/lib/inventory";
import {
  RequiredLegend,
  Button,
  ChoiceGroup,
  Combobox,
  ConfirmDelete,
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
  Tag,
  NumberField,
  ReadOnlyBadge,
  RecordTable,
  channelTone,
  StatCardGrid,
  notify,
  type RecordTableColumn,
  type FieldError,
  type ComboboxOption,
} from "@/design-system";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { LotDispatchPicker } from "@/features/shared";
import { useCan } from "@/features/shared/PermissionProvider";
import { kg, num, todayISO, formatDateVN } from "@/lib/format";
import { PERIOD_OPTIONS, getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
import {
  CalendarRange,
  CircleCheck,
  FileText,
  Link2,
  Pencil,
  Plus,
  Scale,
  ShoppingCart,
  Truck,
  Warehouse,
  X,
} from "lucide-react";

const WORKSHOPS: Workshop[] = ["Đông", "Cá", "Khô"];

/** Đầu phiếu bán đang nhập — dùng chung cho mọi dòng mặt hàng của phiếu. */
interface InvoiceHeader {
  deliveryDate: string;
  postingDate: string;
  backdateReason: string;
  workshop: Workshop;
  customerId: string;
  channel: SalesChannel;
  note: string;
}

/** Một dòng mặt hàng đang nhập trong phiếu. */
interface NewRow {
  productId: string;
  spec: string;
  quantityKg: number;
  unitPrice: number | null;
  source: string; // RETAIL_WAREHOUSE (block thô) | FG_WAREHOUSE (đóng gói)
}

const EMPTY_NEW_ROW: NewRow = {
  productId: "",
  spec: "",
  quantityKg: 0,
  unitPrice: null,
  source: RETAIL_WAREHOUSE,
};

/** Một phiếu bán hiện trên sổ, gom từ các dòng của nó. */
interface InvoiceGroup {
  invoice: SalesInvoice;
  items: SalesItem[];
  totalKg: number;
  totalAmount: number;
  isBackdated: boolean;
}

function groupByInvoice(rows: SalesItem[], salesInvoices: SalesInvoice[]): InvoiceGroup[] {
  const theoId = new Map(salesInvoices.map((p) => [p.id, p]));
  const nhoms = new Map<string, InvoiceGroup>();

  for (const r of rows) {
    const p = theoId.get(r.invoiceId);
    if (!p) continue; // dòng mồ côi (phiếu đã xóa) — bỏ qua
    let group = nhoms.get(p.id);
    if (!group) {
      group = {
        invoice: p,
        items: [],
        totalKg: 0,
        totalAmount: 0,
        isBackdated: isBackdatedSales(p),
      };
      nhoms.set(p.id, group);
    }
    group.items.push(r);
    group.totalKg += r.quantityKg || 0;
    group.totalAmount += calculateSalesAmount(r);
  }

  return [...nhoms.values()].sort(
    (a, b) =>
      a.invoice.deliveryDate.localeCompare(b.invoice.deliveryDate) ||
      a.invoice.id.localeCompare(b.invoice.id)
  );
}

/** Kiểm đầu phiếu — dùng chung lúc ghi mới và lúc sửa. */
function invoiceHeaderErrors(d: InvoiceHeader): FieldError[] {
  const ls: FieldError[] = [];
  if (d.postingDate < d.deliveryDate)
    ls.push({
      field: "Ngày ghi sổ",
      message: "Ngày ghi sổ không thể trước ngày xuất bán",
    });
  if (isBackdatedSales(d) && !d.backdateReason.trim())
    ls.push({
      field: "Lý do ghi bù",
      message: "Ghi sau ngày xuất bán — phải ghi rõ lý do",
    });
  return ls;
}

export default function SalesScreen() {
  // Phân quyền lớp 2 (spec role-permissions §5): không quyền ⇒ ẩn nút; có xem mà
  // không thêm/sửa ⇒ chỉ xem; không xem giá ⇒ ẩn cột/ô giá và thành tiền.
  const allowed = useCan("sales");
  const canViewPrice = allowed["view-price"];
  const isReadOnly = !allowed.create && !allowed.update;
  const [rows, persist] = useSalesItems();
  const [salesInvoices, persistSalesInvoices, { status }] = useSalesInvoices();

  /* Tồn khả dụng để bán: trừ SUY từ chính các dòng bán (theo marker nguồn).
   * - Block thô (RETAIL_WAREHOUSE) trừ tồn BTP; đóng gói (FG_WAREHOUSE) trừ tồn TP.
   * - Handoff Đơn đặt ("Lưu trữ") đã trừ qua lệnh xuất → không đưa vào đây. */
  const [wips] = useWipProductions();
  const [exportItems] = useExportItems();
  const [packagings] = usePackagings();
  const [lotInputs] = useLotInputs();
  const [lotDispatches] = useLotDispatches();
  // Truy xuất lô (đợt 2b): dòng bán lẻ ghi lấy từ lô nào ⇒ hộ chiếu lô thấy được khách,
  // sổ tồn trừ đúng lô đó. Block thô ⇒ lô BTP (W) · đóng gói ⇒ lô TP (P).
  const [lotSalesItem, setLotSalesItem] = useState<SalesItem | null>(null);
  const saleLotKind = (r: SalesItem) => (r.sourceWarehouse === FG_WAREHOUSE ? "P" : r.sourceWarehouse === RETAIL_WAREHOUSE ? "W" : null);
  const countSalesLots = (id: string) => lotDispatches.filter((d) => d.docKind === "sales_item" && d.docId === id).length;
  const lotInputButton = (r: SalesItem) =>
    saleLotKind(r) && (allowed.create || allowed.update) ? (
      <Button
        title={`Ghi dòng bán này lấy từ ${saleLotKind(r) === "P" ? "lô thành phẩm" : "lô bán thành phẩm"} nào (quét tem thùng, gõ mã, hoặc chọn lô còn tồn). Có lô thì thu hồi mới tới được khách.`}
        variant={countSalesLots(r.id) ? "outline" : "default"}
        size="sm"
        onClick={() => setLotSalesItem(r)}
      >
        <Link2 />
        {countSalesLots(r.id) ? `Lô (${countSalesLots(r.id)})` : "Gắn lô"}
      </Button>
    ) : null;
  const wipDeductions = useMemo(
    () => collectWipDeductions(rows, packagings, lotInputs, lotDispatches),
    [rows, packagings, lotInputs, lotDispatches]
  );
  const wipStock = useMemo(
    () => computeWipStock(wips, exportItems, wipDeductions),
    [wips, exportItems, wipDeductions]
  );
  const finishedGoodStock = useMemo(
    () => computeFinishedGoodStock(packagings, filterRetailSales(rows, FG_WAREHOUSE)),
    [packagings, rows]
  );
  const isLoading = status === "loading" && salesInvoices.length === 0;
  const [products, setProducts] = useProducts();
  const [customers, setCustomers] = useCustomers();

  // Kỳ xem sổ: ngày/tuần/tháng/năm/khoảng tự chọn
  const [period, setPeriod] = useState<ViewPeriod>("day");
  const [date, setDate] = useState(todayISO());
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [workshop, setWorkshop] = useState<Workshop | "Tất cả">("Đông");

  /* Phiên ghi phiếu: đầu phiếu + đổ từng dòng mặt hàng. */
  const [session, setSession] = useState<InvoiceHeader | null>(null);
  const [sessionInvoiceId, setSessionInvoiceId] = useState<string | null>(null);
  const [editRowIds, setEditRowIds] = useState<string[] | null>(null);
  const [newRows, setNewRows] = useState<NewRow>(EMPTY_NEW_ROW);
  const newRowAvailable = newRows.productId
    ? newRows.source === FG_WAREHOUSE
      ? getAvailableFinishedGoodKg(finishedGoodStock, newRows.productId, newRows.spec.trim())
      : getAvailableKg(wipStock, newRows.productId, newRows.spec.trim())
    : null;
  const isOversold = newRowAvailable != null && newRows.quantityKg > newRowAvailable;
  /** Kênh bán dùng gần nhất trong phiên — làm mặc định cho phiếu mới thay vì
   *  luôn về "Xuất khẩu" (người bán Nội địa khỏi lật kênh mỗi phiếu). */
  const [lastChannel, setLastChannel] = useState<SalesChannel>("Xuất khẩu");
  const [sessionErrors, setSessionErrors] = useState<FieldError[]>([]);

  /* Sửa MỘT dòng mặt hàng — chỉ mặt hàng / quy cách / kg / giá. */
  const [editing, setEditing] = useState<SalesItem | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);

  const [effectiveFrom, effectiveTo] = getViewPeriodRange(period, date, fromDate, toDate);
  const isSingleDay = effectiveFrom === effectiveTo;

  const productName = (id: string) =>
    products.find((m) => m.id === id)?.name || "—";
  const customerName = (id: string) => customers.find((k) => k.id === id)?.name || "";

  const view = useMemo(
    () =>
      rows.filter((r) => {
        const p = salesInvoices.find((x) => x.id === r.invoiceId);
        if (!p) return false;
        const matchesDate = p.deliveryDate >= effectiveFrom && p.deliveryDate <= effectiveTo;
        const matchesWorkshop = workshop === "Tất cả" || p.workshop === workshop;
        return matchesDate && matchesWorkshop;
      }),
    [rows, salesInvoices, effectiveFrom, effectiveTo, workshop]
  );

  const groupedView = useMemo(() => groupByInvoice(view, salesInvoices), [view, salesInvoices]);

  const rangeDescription = isSingleDay
    ? formatDateVN(effectiveFrom)
    : `${formatDateVN(effectiveFrom)} – ${formatDateVN(effectiveTo)}`;

  const total = useMemo(
    () => view.reduce((s, r) => s + (r.quantityKg || 0), 0),
    [view]
  );
  const totalAmount = useMemo(
    () => view.reduce((s, r) => s + calculateSalesAmount(r), 0),
    [view]
  );

  const postingDate = isSingleDay ? effectiveFrom : effectiveTo;
  const recordWorkshop: Workshop = workshop === "Tất cả" ? "Đông" : workshop;

  /* ---- Danh mục: chọn sẵn, thiếu thì tạo ngay tại chỗ ---- */

  const productOptions: ComboboxOption[] = products.map((m) => ({
    value: m.id,
    label: m.code ? `${m.code} · ${m.name}` : m.name,
    subLabel: m.code || undefined,
  }));
  const customerOptions: ComboboxOption[] = customers.map((k) => ({
    value: k.id,
    label: k.code ? `${k.code} · ${k.name}` : k.name,
    subLabel: [k.code, k.market].map((s) => s?.trim()).filter(Boolean).join(" – ") || undefined,
  }));

  /** Sửa nhanh khách hàng / mặt hàng tại chỗ (cả hai nối theo id ở phiếu bán). */
  const customerEditor = useQuickCatalogEdit("customer", customers, setCustomers);
  const productEditor = useQuickCatalogEdit("product", products, setProducts);

  // Nhãn có mã số ("12 · tên") nên ô chọn không tự nhận ra tên trùng ⇒ tự dò,
  // trùng tên (không phân hoa thường) thì dùng lại bản có sẵn.
  const addProduct = (name: string) => {
    const existing = products.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const m: Product = { id: uid(), code: "", name, finishedGoodCode: "" };
    setProducts([...products, m]);
    notify.saved(`Đã thêm mặt hàng "${name}" vào danh mục`);
    return m.id;
  };
  const addCustomer = (name: string) => {
    const existing = customers.find((k) => k.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const k: Customer = { id: uid(), code: "", name, market: "" };
    setCustomers([...customers, k]);
    notify.saved(`Đã thêm khách hàng "${name}" vào danh mục`);
    return k.id;
  };

  /* ---- Ghi phiếu ---- */

  const openAdd = () => {
    setSession({
      deliveryDate: postingDate,
      postingDate: todayISO(),
      backdateReason: "",
      workshop: recordWorkshop,
      customerId: "",
      channel: lastChannel,
      note: "",
    });
    setSessionInvoiceId(null);
    setEditRowIds(null);
    setNewRows(EMPTY_NEW_ROW);
    setSessionErrors([]);
  };

  const openInvoiceEdit = (n: InvoiceGroup) => {
    setSession({
      deliveryDate: n.invoice.deliveryDate,
      postingDate: n.invoice.postingDate || n.invoice.deliveryDate,
      backdateReason: n.invoice.backdateReason,
      workshop: n.invoice.workshop,
      customerId: n.invoice.customerId,
      channel: n.invoice.channel,
      note: n.invoice.note,
    });
    setSessionInvoiceId(n.invoice.id);
    setEditRowIds(n.items.map((r) => r.id));
    setNewRows(EMPTY_NEW_ROW);
    setSessionErrors([]);
  };

  const setSessionField = <K extends keyof InvoiceHeader>(k: K, v: InvoiceHeader[K]) =>
    setSession((p) => (p ? { ...p, [k]: v } : p));

  const sessionRows = useMemo(() => {
    if (editRowIds) return rows.filter((r) => editRowIds.includes(r.id));
    if (sessionInvoiceId) return rows.filter((r) => r.invoiceId === sessionInvoiceId);
    return [];
  }, [rows, editRowIds, sessionInvoiceId]);

  const isEditingInvoice = editRowIds !== null;
  const sessionTotal = sessionRows.reduce((s, r) => s + (r.quantityKg || 0), 0);

  const setRowField = <K extends keyof NewRow>(k: K, v: NewRow[K]) =>
    setNewRows((d) => ({ ...d, [k]: v }));

  /** Thêm một dòng mặt hàng — LƯU NGAY thành một dòng ban_hang. */
  const addRow = () => {
    if (!session) return;
    const ls: FieldError[] = [...invoiceHeaderErrors(session)];
    if (!newRows.productId)
      ls.push({ field: "Mặt hàng", message: "Chưa chọn mặt hàng" });
    if (!(newRows.quantityKg > 0))
      ls.push({ field: "Lượng", message: "Phải lớn hơn 0 kg" });
    setSessionErrors(ls);
    if (ls.length > 0) return;

    let invoiceId = sessionInvoiceId;
    if (sessionInvoiceId) {
      // Phiếu đang tạo dở hoặc đang sửa → áp đầu phiếu vào bản ghi.
      persistSalesInvoices(
        salesInvoices.map((p) =>
          p.id === sessionInvoiceId ? { ...p, ...session, id: p.id } : p
        )
      );
    } else {
      // Phiếu mới: chỉ tạo khi có dòng đầu tiên — không để lại phiếu rỗng.
      invoiceId = newId();
      persistSalesInvoices([...salesInvoices, { id: invoiceId, ...session }]);
      setSessionInvoiceId(invoiceId);
    }

    const row: SalesItem = {
      id: newId(),
      invoiceId: invoiceId ?? "",
      deliveryDate: session.deliveryDate,
      productId: newRows.productId,
      spec: newRows.spec.trim(),
      quantityKg: newRows.quantityKg,
      unitPrice: newRows.unitPrice,
      sourceWarehouse: newRows.source, // RETAIL_WAREHOUSE ⇒ trừ tồn BTP; FG_WAREHOUSE ⇒ trừ tồn TP đóng gói
    };
    // Đồng bộ đầu phiếu cho MỌI dòng của phiếu (khách/ngày/kênh có thể vừa đổi
    // tại chỗ) rồi thêm dòng mới — giữ bất biến "đầu phiếu áp cả phiếu".
    const belongsToInvoice = (r: SalesItem) =>
      editRowIds ? editRowIds.includes(r.id) : r.invoiceId === invoiceId;
    persist([
      ...rows.map((r) =>
        belongsToInvoice(r) ? { ...r, deliveryDate: session.deliveryDate } : r
      ),
      row,
    ]);
    if (editRowIds) setEditRowIds([...editRowIds, row.id]);
    notify.saved(`Đã vào sổ: ${productName(row.productId)} — ${kg(row.quantityKg)}`);

    // Nhớ kênh vừa bán để phiếu sau khỏi lật lại.
    setLastChannel(session.channel);
    // Giữ quy cách cho dòng kế (một lô thường cùng size); xóa mặt hàng / kg / giá.
    setNewRows((d) => ({ ...EMPTY_NEW_ROW, spec: d.spec, source: d.source }));
    setSessionErrors([]);
  };

  const removeSessionRow = (r: SalesItem) => {
    const prevRows = rows;
    const prevIds = editRowIds;
    persist(rows.filter((x) => x.id !== r.id));
    if (editRowIds) setEditRowIds(editRowIds.filter((id) => id !== r.id));
    notify.deleted(`Đã bỏ ${productName(r.productId)} — ${kg(r.quantityKg)}`, () => {
      persist(prevRows);
      if (prevIds) setEditRowIds(prevIds);
    });
  };

  /** Đóng phiếu: bỏ phiếu rỗng, áp đầu phiếu lần cuối, kéo bộ lọc về phiếu vừa ghi. */
  const closeSession = (open: "close" | "another") => {
    const p = session;
    if (p && sessionInvoiceId && sessionRows.length === 0) {
      persistSalesInvoices(salesInvoices.filter((x) => x.id !== sessionInvoiceId));
    }
    if (p && sessionRows.length > 0 && sessionInvoiceId) {
      persistSalesInvoices(
        salesInvoices.map((x) => (x.id === sessionInvoiceId ? { ...x, ...p, id: x.id } : x))
      );
      const thuoc = (r: SalesItem) =>
        editRowIds ? editRowIds.includes(r.id) : r.invoiceId === sessionInvoiceId;
      persist(rows.map((r) => (thuoc(r) ? { ...r, deliveryDate: p.deliveryDate } : r)));
    }
    if (p && sessionRows.length > 0) {
      if (p.deliveryDate < effectiveFrom || p.deliveryDate > effectiveTo) {
        setPeriod("day");
        setDate(p.deliveryDate);
      }
      if (workshop !== "Tất cả" && workshop !== p.workshop)
        setWorkshop(p.workshop);
    }

    if (open === "close") {
      setSession(null);
      setSessionInvoiceId(null);
      setEditRowIds(null);
      return;
    }
    // Ghi phiếu khác: giữ ngày + xưởng, làm mới khách.
    setSession(p ? { ...p, customerId: "", note: "" } : null);
    setSessionInvoiceId(null);
    setEditRowIds(null);
    setNewRows(EMPTY_NEW_ROW);
    setSessionErrors([]);
  };

  const deleteEditingInvoice = () => {
    if (!editRowIds) return;
    const prevRows = rows;
    const prevInvoices = salesInvoices;
    const ids = new Set(editRowIds);
    persist(rows.filter((r) => !ids.has(r.id)));
    if (sessionInvoiceId) persistSalesInvoices(salesInvoices.filter((x) => x.id !== sessionInvoiceId));
    notify.deleted(
      `Đã xóa phiếu ${customerName(session?.customerId ?? "") || "(chưa có khách)"} — ${editRowIds.length} dòng`,
      () => {
        persist(prevRows);
        persistSalesInvoices(prevInvoices);
      }
    );
    setSession(null);
    setSessionInvoiceId(null);
    setEditRowIds(null);
  };

  /* ---- Sửa một dòng mặt hàng ---- */

  const save = () => {
    if (!editing) return;
    const ls: FieldError[] = [];
    if (!editing.productId)
      ls.push({ field: "Mặt hàng", message: "Chưa chọn mặt hàng" });
    if (!(editing.quantityKg > 0))
      ls.push({ field: "Lượng", message: "Phải lớn hơn 0 kg" });
    setErrors(ls);
    if (ls.length > 0) return;
    persist(rows.map((r) => (r.id === editing.id ? editing : r)));
    notify.saved("Đã lưu thay đổi");
    setEditing(null);
  };

  const set = <K extends keyof SalesItem>(k: K, v: SalesItem[K]) =>
    setEditing((d) => (d ? { ...d, [k]: v } : d));

  /** Kênh của phiếu đang mở — quyết định đơn vị đơn giá. */
  const priceUnit = session?.channel === "Nội địa" ? "đ" : "USD";
  const priceUnitFor = (channel: SalesChannel) => (channel === "Nội địa" ? "đ" : "USD");

  const itemColumns = (channel: SalesChannel): RecordTableColumn<SalesItem>[] => [
    {
      key: "mh",
      header: "Mặt hàng",
      primary: true,
      render: (r) => productName(r.productId),
      getSortValue: (r) => productName(r.productId),
    },
    {
      key: "qc",
      header: "Quy cách",
      render: (r) =>
        r.spec || <span className="text-muted-foreground">—</span>,
      getSortValue: (r) => r.spec,
    },
    {
      key: "sl",
      header: "Lượng (kg)",
      numeric: true,
      render: (r) => num(r.quantityKg),
      getSortValue: (r) => r.quantityKg,
    },
    ...priceColumns(channel),
  ];

  const priceColumns = (channel: SalesChannel): RecordTableColumn<SalesItem>[] =>
    canViewPrice ? [
    {
      key: "gia",
      header: `Đơn giá (${priceUnitFor(channel)})`,
      numeric: true,
      render: (r) =>
        r.unitPrice != null ? (
          num(r.unitPrice)
        ) : (
          <Tag variant="error">Chưa có giá</Tag>
        ),
      getSortValue: (r) => r.unitPrice ?? 0,
    },
    {
      key: "tien",
      header: `Thành tiền (${priceUnitFor(channel)})`,
      numeric: true,
      render: (r) => num(calculateSalesAmount(r)),
      getSortValue: (r) => calculateSalesAmount(r),
    },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">Bán hàng</h1>
            {isReadOnly && <ReadOnlyBadge />}
          </div>
        </div>
        {allowed.create && (
        <div className="flex flex-wrap gap-2">
          <Button
            title="Mở form ghi một phiếu bán mới: chọn khách, kênh bán, rồi thêm từng dòng mặt hàng." size="lg" onClick={openAdd}>
            <Plus />
            Ghi phiếu bán
          </Button>
        </div>
        )}
      </div>

      <StatCardGrid
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        cards={[
          { label: "Đang xem", value: rangeDescription, icon: CalendarRange, color: "neutral" },
          { label: "Phân xưởng", value: workshop, icon: Warehouse, color: "neutral" },
          { label: "Số phiếu", value: groupedView.length, numeric: true, icon: Truck, color: "brand" },
          { label: "Số dòng", value: view.length, numeric: true, icon: FileText, color: "brand" },
          { label: "Tổng bán", value: kg(total), numeric: true, icon: Scale, color: "success" },
        ]}
      />

      {/* Bộ lọc — toolbar một hàng */}
      <div className="rounded-xl border-2 border-border p-4">
        <div className="flex flex-wrap items-end gap-4">
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
                label="Khoảng ngày xuất bán"
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
                label={
                  period === "day"
                    ? "Ngày xuất bán"
                    : period === "week"
                      ? "Ngày bất kỳ trong tuần"
                      : period === "month"
                        ? "Ngày bất kỳ trong tháng"
                        : "Ngày bất kỳ trong năm"
                }
                hideRequiredMark
                hint={
                  period === "day"
                    ? undefined
                    : `Kỳ đang xem: ${formatDateVN(effectiveFrom)} – ${formatDateVN(effectiveTo)}`
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
      </div>

      {/* Sổ: mỗi phiếu một cụm */}
      {isLoading ? (
        <TableSkeleton />
      ) : groupedView.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={`Chưa có phiếu bán nào trong ${rangeDescription}`}
          description={
            !allowed.create
              ? workshop === "Tất cả"
                ? undefined
                : `Phân xưởng ${workshop}.`
              : workshop === "Tất cả"
              ? "Bấm nút dưới để ghi phiếu bán đầu tiên."
              : `Phân xưởng ${workshop}. Bấm nút dưới để ghi phiếu bán đầu tiên.`
          }
          action={
            allowed.create && <Button
              title="Mở form ghi phiếu bán đầu tiên cho ngày này." size="lg" onClick={openAdd}>
              <Plus />
              Ghi phiếu bán
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-5">
            {groupedView.map((n, i) => (
              <section
                key={n.invoice.id}
                className="space-y-4 rounded-xl border-2 border-border p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="tnum text-base text-muted-foreground">
                        Phiếu {i + 1}
                      </span>
                      <span className="text-xl font-semibold text-foreground">
                        {customerName(n.invoice.customerId) || "(chưa có khách)"}
                      </span>
                      <span className="text-base text-muted-foreground">
                        {formatDateVN(n.invoice.deliveryDate)} · xưởng {n.invoice.workshop}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag variant="category" tone={channelTone(n.invoice.channel)}>
                        {n.invoice.channel}
                      </Tag>
                      {n.isBackdated && (
                        <Tag variant="warning">
                          Ghi bù {formatDateVN(n.invoice.postingDate)}
                        </Tag>
                      )}
                    </div>
                    {n.isBackdated && n.invoice.backdateReason && (
                      <p className="text-base text-muted-foreground">
                        Lý do ghi bù: {n.invoice.backdateReason}
                      </p>
                    )}
                    {n.invoice.note && (
                      <p className="text-base text-muted-foreground">
                        Ghi chú: {n.invoice.note}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base text-muted-foreground">
                      Phiếu này
                    </span>
                    <span className="tnum text-xl font-semibold">
                      {kg(n.totalKg)}
                    </span>
                    {allowed.update && (
                    <Button
                      title="Mở lại phiếu bán này để sửa khách hàng, kênh bán hay các dòng hàng." variant="edit" onClick={() => openInvoiceEdit(n)}>
                      <Pencil />
                      Sửa phiếu
                    </Button>
                    )}
                  </div>
                </div>

                <RecordTable
                  columns={itemColumns(n.invoice.channel)}
                  rows={n.items}
                  getKey={(r) => r.id}
                  rowMarkKey="ban-hang"
                  actions={(r) => lotInputButton(r)}
                />
              </section>
            ))}
          </div>

          <div className="flex flex-wrap justify-end gap-x-10 gap-y-3 rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng khối lượng
              </span>
              <span className="tnum text-xl font-semibold">{kg(total)}</span>
            </div>
            {canViewPrice && (
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng tiền bán
              </span>
              <span className="tnum text-xl font-semibold">
                {num(totalAmount)}
              </span>
            </div>
            )}
          </div>
        </>
      )}

      {/* ---- Hộp thoại: ghi phiếu bán ---- */}
      <Dialog
        open={session !== null}
        onOpenChange={(o) => {
          if (!o) closeSession("close");
        }}
      >
        <DialogContent className="max-h-[92dvh] w-full overflow-y-auto sm:max-w-3xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {isEditingInvoice ? "Sửa phiếu bán" : "Ghi phiếu bán"}
            </DialogTitle>
            <DialogDescription className="text-base">
              {isEditingInvoice
                ? "Sửa đầu phiếu (áp cho mọi dòng), thêm hoặc bỏ mặt hàng ngay bên dưới."
                : "Điền đầu phiếu (khách, kênh, ngày) rồi đổ từng mặt hàng ngay bên dưới — mỗi mặt hàng bấm “Thêm mặt hàng vào sổ” là vào sổ ngay."}
            </DialogDescription>
          </DialogHeader>

          {session && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={sessionErrors} />
              <RequiredLegend />

              <div className="grid gap-6 sm:grid-cols-2">
                <DateField
                  label="Ngày ghi sổ"
                  required
                  info="Ngày ghi vào hệ thống. Khác ngày xuất bán ⇒ ghi bù."
                  value={session.postingDate}
                  onChange={(v) => setSessionField("postingDate", v)}
                />
                <DateField
                  label="Ngày xuất bán"
                  required
                  info="Ngày hàng thực xuất bán — mọi tổng hợp tính theo ngày này."
                  value={session.deliveryDate}
                  onChange={(v) => setSessionField("deliveryDate", v)}
                />
              </div>

              {isBackdatedSales(session) && (
                <Field
                  label="Lý do ghi bù"
                  required
                  hint="VD: xuất bán 29/7, 31/7 mới ghi sổ."
                >
                  <Input
                    value={session.backdateReason}
                    onChange={(e) => setSessionField("backdateReason", e.target.value)}
                    placeholder="Vì sao tới hôm nay mới ghi?"
                  />
                </Field>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                <Combobox
                  label="Phân xưởng"
                  required
                  clearable={false}
                  value={session.workshop}
                  onChange={(v) => setSessionField("workshop", v as Workshop)}
                  options={WORKSHOPS.map((p) => ({ value: p, label: p }))}
                />
                <ChoiceGroup
                  label="Kênh bán"
                  value={session.channel}
                  onChange={(v) => setSessionField("channel", v as SalesChannel)}
                  options={SALES_CHANNELS.map((k) => ({ value: k, label: k }))}
                  columns={2}
                />
              </div>

              <Combobox
                label="Khách hàng"
                hint="Chọn trong danh mục. Chưa có thì gõ tên rồi bấm Thêm mới. Bỏ trống nếu chưa xác định khách."
                value={session.customerId}
                onChange={(v) => setSessionField("customerId", v)}
                options={customerOptions}
                onCreate={customerEditor.canCreate ? addCustomer : undefined}
                emptyText="Chưa có khách hàng nào trong danh mục."
                onEditItem={customerEditor.openEdit}
                canEdit={customerEditor.canEdit}
                editLabel={customerEditor.editLabel}
              />

              <Field label="Ghi chú phiếu">
                <Input
                  value={session.note}
                  onChange={(e) => setSessionField("note", e.target.value)}
                  placeholder="Ghi chú thêm (nếu có)"
                />
              </Field>

              <div className="border-t-2 border-border pt-1" />

              {/* Đã vào sổ */}
              {sessionRows.length > 0 && (
                <div className="space-y-3 rounded-xl border-2 border-border p-4">
                  <p className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <CircleCheck className="size-6 text-primary" aria-hidden />
                    Đã vào sổ {sessionRows.length} mặt hàng — phiếu này{" "}
                    <span className="tnum">{kg(sessionTotal)}</span>
                  </p>
                  <ul className="divide-y divide-border">
                    {sessionRows.map((r, i) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-base">
                          <span className="tnum text-muted-foreground">
                            {i + 1}.
                          </span>{" "}
                          {productName(r.productId)}
                          {r.spec ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {r.spec}
                            </span>
                          ) : null}{" "}
                          —{" "}
                          <span className="tnum font-semibold">
                            {num(r.quantityKg)}
                          </span>{" "}
                          kg
                        </span>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {lotInputButton(r)}
                          {allowed.update && (
                          <Button
                            title="Sửa dòng bán này (mặt hàng · quy cách · số kg · đơn giá)."
                            variant="edit"
                            size="sm"
                            onClick={() => {
                              setEditing({ ...r });
                              setErrors([]);
                            }}
                          >
                            <Pencil />
                            Sửa
                          </Button>
                          )}
                          {allowed.delete && (
                          <Button
                            title="Bỏ dòng bán này khỏi phiếu đang gõ."
                            variant="danger"
                            size="sm"
                            onClick={() => removeSessionRow(r)}
                          >
                            <X />
                            Bỏ
                          </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Thêm một mặt hàng — nút chính duy nhất trong thân */}
              {allowed.create && (
              <div className="space-y-5 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
                <p className="text-base font-semibold">Thêm mặt hàng</p>

                <Combobox
                  label="Mặt hàng"
                  required
                  hint="Chưa có trong danh mục thì gõ tên rồi bấm Thêm mới."
                  value={newRows.productId}
                  onChange={(v) => setRowField("productId", v)}
                  options={productOptions}
                  onCreate={productEditor.canCreate ? addProduct : undefined}
                  emptyText="Chưa có mặt hàng nào trong danh mục."
                  onEditItem={productEditor.openEdit}
                  canEdit={productEditor.canEdit}
                  editLabel={productEditor.editLabel}
                />

                <ChoiceGroup
                  label="Nguồn bán"
                  value={newRows.source}
                  onChange={(v) => setRowField("source", v)}
                  options={[
                    { value: RETAIL_WAREHOUSE, label: "Block thô (kho dự trữ)" },
                    { value: FG_WAREHOUSE, label: "Đóng gói (kho thành phẩm)" },
                  ]}
                  columns={2}
                />

                <Field
                  label="Quy cách"
                  hint="Size/grade của thành phẩm. VD: 18-20, 1000-1300, 1.5g."
                >
                  <Input
                    value={newRows.spec}
                    onChange={(e) => setRowField("spec", e.target.value)}
                    placeholder="VD: 18-20"
                  />
                </Field>

                <div className="grid gap-6 sm:grid-cols-2">
                  <NumberField
                    label="Lượng"
                    required
                    unit="kg"
                    value={newRows.quantityKg || null}
                    onChange={(v) => setRowField("quantityKg", v ?? 0)}
                  />
                  {canViewPrice && (
                  <NumberField
                    label="Đơn giá"
                    unit={priceUnit}
                    value={newRows.unitPrice}
                    onChange={(v) => setRowField("unitPrice", v)}
                    hint="Bỏ trống nếu chưa chốt giá."
                  />
                  )}
                </div>

                {newRowAvailable != null ? (
                  <div
                    className={
                      isOversold
                        ? "rounded-lg bg-warning-surface px-4 py-3 text-base text-warning"
                        : "rounded-lg bg-muted px-4 py-3 text-base text-muted-foreground"
                    }
                  >
                    Tồn khả dụng ({newRows.source === FG_WAREHOUSE ? "kho thành phẩm" : "kho dự trữ"}):{" "}
                    <span className="tnum font-semibold">{kg(newRowAvailable)}</span>
                    {isOversold
                      ? " — bán vượt tồn, kiểm lại (vẫn ghi được, tồn sẽ báo âm)."
                      : ""}
                  </div>
                ) : null}

                {canViewPrice && newRows.quantityKg > 0 && newRows.unitPrice ? (
                  <div className="rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                    Thành tiền:{" "}
                    <span className="tnum text-lg font-semibold">
                      {num(newRows.quantityKg * newRows.unitPrice)} {priceUnit}
                    </span>
                  </div>
                ) : null}

                <Button
                  title="Thêm dòng hàng vừa chọn vào phiếu bán đang gõ. Một phiếu bán được nhiều mặt hàng." size="lg" className="w-full" onClick={addRow}>
                  <Plus />
                  Thêm mặt hàng vào sổ
                </Button>
              </div>
              )}

              {/* Tổng phiếu */}
              <div className="flex flex-wrap items-baseline justify-end gap-x-8 gap-y-2 rounded-xl bg-muted px-5 py-4">
                <span className="text-base text-muted-foreground">
                  Tổng phiếu {formatDateVN(session.deliveryDate)} · xưởng {session.workshop}
                </span>
                <span className="tnum text-2xl font-semibold">
                  {kg(sessionTotal)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            {isEditingInvoice ? (
              allowed.delete && <ConfirmDelete
                recordDescription={`Phiếu ${customerName(session?.customerId ?? "") || "(chưa có khách)"} — ${formatDateVN(session?.deliveryDate ?? "")} — ${sessionRows.length} dòng — ${kg(sessionTotal)}`}
                onConfirm={deleteEditingInvoice}
                title="Xóa cả phiếu này?"
                confirmLabel="Xóa phiếu"
              />
            ) : (
              <Button
                title="Ghi phiếu đang gõ vào sổ rồi mở phiếu trống để bán tiếp cho khách khác."
                variant="save"
                size="lg"
                onClick={() => closeSession("another")}
              >
                <Truck />
                Lưu &amp; thêm phiếu khác
              </Button>
            )}
            <Button
              title="Ghi phiếu đang gõ vào sổ rồi quay về danh sách phiếu bán." size="lg" onClick={() => closeSession("close")}>
              {isEditingInvoice ? "Xong" : "Xong phiếu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Hộp thoại: sửa một dòng mặt hàng ---- */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[92dvh] w-full overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sửa dòng mặt hàng</DialogTitle>
            <DialogDescription className="text-base">
              Khách, kênh, ngày và xưởng thuộc về cả phiếu — sửa ở nút "Sửa
              phiếu" trên đầu cụm.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={errors} />
              <RequiredLegend />

              <Combobox
                label="Mặt hàng"
                required
                hint="Chưa có trong danh mục thì gõ tên rồi bấm Thêm mới."
                value={editing.productId}
                onChange={(v) => set("productId", v)}
                options={productOptions}
                onCreate={productEditor.canCreate ? addProduct : undefined}
                emptyText="Chưa có mặt hàng nào trong danh mục."
                onEditItem={productEditor.openEdit}
                canEdit={productEditor.canEdit}
                editLabel={productEditor.editLabel}
              />

              <Field
                label="Quy cách"
                hint="Size/grade của thành phẩm. VD: 18-20, 1000-1300."
              >
                <Input
                  value={editing.spec}
                  onChange={(e) => set("spec", e.target.value)}
                  placeholder="VD: 18-20"
                />
              </Field>

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Lượng"
                  required
                  unit="kg"
                  value={editing.quantityKg || null}
                  onChange={(v) => set("quantityKg", v ?? 0)}
                />
                {canViewPrice && (
                <NumberField
                  label="Đơn giá"
                  unit={priceUnit}
                  value={editing.unitPrice}
                  onChange={(v) => set("unitPrice", v)}
                  hint="Bỏ trống nếu chưa chốt giá."
                />
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setEditing(null)}>
              Hủy
            </Button>
            {allowed.update && (
            <Button variant="save"
              title="Ghi đè dòng bán này bằng số vừa sửa." size="lg" onClick={save}>
              Lưu thay đổi
            </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {customerEditor.dialog}
      {productEditor.dialog}
      {lotSalesItem && saleLotKind(lotSalesItem) && (
        <LotDispatchPicker
          docKind="sales_item"
          docId={lotSalesItem.id}
          docLabel={`${productName(lotSalesItem.productId)} · ${kg(lotSalesItem.quantityKg)} · ${formatDateVN(lotSalesItem.deliveryDate)}`}
          lotKind={saleLotKind(lotSalesItem)!}
          workshop={salesInvoices.find((p) => p.id === lotSalesItem.invoiceId)?.workshop ?? "Đông"}
          date={lotSalesItem.deliveryDate}
          productId={lotSalesItem.productId}
          onClose={() => setLotSalesItem(null)}
        />
      )}
    </div>
  );
}
