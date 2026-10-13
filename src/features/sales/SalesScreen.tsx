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
  ChuThichBatBuoc,
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
  SkeletonBang,
  ErrorSummary,
  Field,
  Input,
  Nhan,
  NumberField,
  RecordTable,
  sacKenh,
  ThongKe,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { useSuaDanhMuc } from "@/features/catalog/SuaDanhMucNhanh";
import { GanLoXuat } from "@/features/shared";
import { kg, num, todayISO, formatDateVN } from "@/lib/format";
import { KY_OPT, getViewPeriodRange, type ViewPeriod } from "@/lib/periodUtils";
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
  nguon: string; // RETAIL_WAREHOUSE (block thô) | FG_WAREHOUSE (đóng gói)
}

const EMPTY_NEW_ROW: NewRow = {
  productId: "",
  spec: "",
  quantityKg: 0,
  unitPrice: null,
  nguon: RETAIL_WAREHOUSE,
};

/** Một phiếu bán hiện trên sổ, gom từ các dòng của nó. */
interface InvoiceGroup {
  phieu: SalesInvoice;
  dong: SalesItem[];
  tongKg: number;
  tongTien: number;
  ghiBu: boolean;
}

function groupByInvoice(rows: SalesItem[], salesInvoices: SalesInvoice[]): InvoiceGroup[] {
  const theoId = new Map(salesInvoices.map((p) => [p.id, p]));
  const nhoms = new Map<string, InvoiceGroup>();

  for (const r of rows) {
    const p = theoId.get(r.invoiceId);
    if (!p) continue; // dòng mồ côi (phiếu đã xóa) — bỏ qua
    let nhom = nhoms.get(p.id);
    if (!nhom) {
      nhom = {
        phieu: p,
        dong: [],
        tongKg: 0,
        tongTien: 0,
        ghiBu: isBackdatedSales(p),
      };
      nhoms.set(p.id, nhom);
    }
    nhom.dong.push(r);
    nhom.tongKg += r.quantityKg || 0;
    nhom.tongTien += calculateSalesAmount(r);
  }

  return [...nhoms.values()].sort(
    (a, b) =>
      a.phieu.deliveryDate.localeCompare(b.phieu.deliveryDate) ||
      a.phieu.id.localeCompare(b.phieu.id)
  );
}

/** Kiểm đầu phiếu — dùng chung lúc ghi mới và lúc sửa. */
function invoiceHeaderErrors(d: InvoiceHeader): LoiNhap[] {
  const ls: LoiNhap[] = [];
  if (d.postingDate < d.deliveryDate)
    ls.push({
      truong: "Ngày ghi sổ",
      thongBao: "Ngày ghi sổ không thể trước ngày xuất bán",
    });
  if (isBackdatedSales(d) && !d.backdateReason.trim())
    ls.push({
      truong: "Lý do ghi bù",
      thongBao: "Ghi sau ngày xuất bán — phải ghi rõ lý do",
    });
  return ls;
}

export default function BanHangScreen() {
  const [rows, persist] = useSalesItems();
  const [salesInvoices, persistSalesInvoices, { trangThai }] = useSalesInvoices();

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
    saleLotKind(r) ? (
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
  const isLoading = trangThai === "dang-tai" && salesInvoices.length === 0;
  const [products, setProducts] = useProducts();
  const [customers, setCustomers] = useCustomers();

  // Kỳ xem sổ: ngày/tuần/tháng/năm/khoảng tự chọn
  const [ky, setKy] = useState<ViewPeriod>("ngay");
  const [date, setDate] = useState(todayISO());
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [workshop, setWorkshop] = useState<Workshop | "Tất cả">("Đông");

  /* Phiên ghi phiếu: đầu phiếu + đổ từng dòng mặt hàng. */
  const [phien, setPhien] = useState<InvoiceHeader | null>(null);
  const [sessionInvoiceId, setSessionInvoiceId] = useState<string | null>(null);
  const [editRowIds, setEditRowIds] = useState<string[] | null>(null);
  const [newRows, setNewRows] = useState<NewRow>(EMPTY_NEW_ROW);
  const newRowAvailable = newRows.productId
    ? newRows.nguon === FG_WAREHOUSE
      ? getAvailableFinishedGoodKg(finishedGoodStock, newRows.productId, newRows.spec.trim())
      : getAvailableKg(wipStock, newRows.productId, newRows.spec.trim())
    : null;
  const isOversold = newRowAvailable != null && newRows.quantityKg > newRowAvailable;
  /** Kênh bán dùng gần nhất trong phiên — làm mặc định cho phiếu mới thay vì
   *  luôn về "Xuất khẩu" (người bán Nội địa khỏi lật kênh mỗi phiếu). */
  const [lastChannel, setLastChannel] = useState<SalesChannel>("Xuất khẩu");
  const [loiPhien, setLoiPhien] = useState<LoiNhap[]>([]);

  /* Sửa MỘT dòng mặt hàng — chỉ mặt hàng / quy cách / kg / giá. */
  const [editing, setEditing] = useState<SalesItem | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const [tuHieuLuc, denHieuLuc] = getViewPeriodRange(ky, date, fromDate, toDate);
  const isSingleDay = tuHieuLuc === denHieuLuc;

  const productName = (id: string) =>
    products.find((m) => m.id === id)?.name || "—";
  const customerName = (id: string) => customers.find((k) => k.id === id)?.name || "";

  const view = useMemo(
    () =>
      rows.filter((r) => {
        const p = salesInvoices.find((x) => x.id === r.invoiceId);
        if (!p) return false;
        const matchesDate = p.deliveryDate >= tuHieuLuc && p.deliveryDate <= denHieuLuc;
        const matchesWorkshop = workshop === "Tất cả" || p.workshop === workshop;
        return matchesDate && matchesWorkshop;
      }),
    [rows, salesInvoices, tuHieuLuc, denHieuLuc, workshop]
  );

  const nhomView = useMemo(() => groupByInvoice(view, salesInvoices), [view, salesInvoices]);

  const rangeDescription = isSingleDay
    ? formatDateVN(tuHieuLuc)
    : `${formatDateVN(tuHieuLuc)} – ${formatDateVN(denHieuLuc)}`;

  const total = useMemo(
    () => view.reduce((s, r) => s + (r.quantityKg || 0), 0),
    [view]
  );
  const totalAmount = useMemo(
    () => view.reduce((s, r) => s + calculateSalesAmount(r), 0),
    [view]
  );

  const postingDate = isSingleDay ? tuHieuLuc : denHieuLuc;
  const recordWorkshop: Workshop = workshop === "Tất cả" ? "Đông" : workshop;

  /* ---- Danh mục: chọn sẵn, thiếu thì tạo ngay tại chỗ ---- */

  const productOptions: MucChon[] = products.map((m) => ({
    value: m.id,
    label: m.code ? `${m.code} · ${m.name}` : m.name,
    phu: m.code || undefined,
  }));
  const customerOptions: MucChon[] = customers.map((k) => ({
    value: k.id,
    label: k.code ? `${k.code} · ${k.name}` : k.name,
    phu: [k.code, k.market].map((s) => s?.trim()).filter(Boolean).join(" – ") || undefined,
  }));

  /** Sửa nhanh khách hàng / mặt hàng tại chỗ (cả hai nối theo id ở phiếu bán). */
  const customerEditor = useSuaDanhMuc("khachHang", customers, setCustomers);
  const productEditor = useSuaDanhMuc("matHang", products, setProducts);

  // Nhãn có mã số ("12 · tên") nên ô chọn không tự nhận ra tên trùng ⇒ tự dò,
  // trùng tên (không phân hoa thường) thì dùng lại bản có sẵn.
  const addProduct = (ten: string) => {
    const co = products.find((m) => m.name.trim().toLowerCase() === ten.trim().toLowerCase());
    if (co) return co.id;
    const m: Product = { id: uid(), code: "", name: ten, finishedGoodCode: "" };
    setProducts([...products, m]);
    notify.daLuu(`Đã thêm mặt hàng "${ten}" vào danh mục`);
    return m.id;
  };
  const addCustomer = (ten: string) => {
    const co = customers.find((k) => k.name.trim().toLowerCase() === ten.trim().toLowerCase());
    if (co) return co.id;
    const k: Customer = { id: uid(), code: "", name: ten, market: "" };
    setCustomers([...customers, k]);
    notify.daLuu(`Đã thêm khách hàng "${ten}" vào danh mục`);
    return k.id;
  };

  /* ---- Ghi phiếu ---- */

  const openAdd = () => {
    setPhien({
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
    setLoiPhien([]);
  };

  const openInvoiceEdit = (n: InvoiceGroup) => {
    setPhien({
      deliveryDate: n.phieu.deliveryDate,
      postingDate: n.phieu.postingDate || n.phieu.deliveryDate,
      backdateReason: n.phieu.backdateReason,
      workshop: n.phieu.workshop,
      customerId: n.phieu.customerId,
      channel: n.phieu.channel,
      note: n.phieu.note,
    });
    setSessionInvoiceId(n.phieu.id);
    setEditRowIds(n.dong.map((r) => r.id));
    setNewRows(EMPTY_NEW_ROW);
    setLoiPhien([]);
  };

  const setSessionField = <K extends keyof InvoiceHeader>(k: K, v: InvoiceHeader[K]) =>
    setPhien((p) => (p ? { ...p, [k]: v } : p));

  const dongPhien = useMemo(() => {
    if (editRowIds) return rows.filter((r) => editRowIds.includes(r.id));
    if (sessionInvoiceId) return rows.filter((r) => r.invoiceId === sessionInvoiceId);
    return [];
  }, [rows, editRowIds, sessionInvoiceId]);

  const isEditingInvoice = editRowIds !== null;
  const sessionTotal = dongPhien.reduce((s, r) => s + (r.quantityKg || 0), 0);

  const setDong = <K extends keyof NewRow>(k: K, v: NewRow[K]) =>
    setNewRows((d) => ({ ...d, [k]: v }));

  /** Thêm một dòng mặt hàng — LƯU NGAY thành một dòng ban_hang. */
  const addRow = () => {
    if (!phien) return;
    const ls: LoiNhap[] = [...invoiceHeaderErrors(phien)];
    if (!newRows.productId)
      ls.push({ truong: "Mặt hàng", thongBao: "Chưa chọn mặt hàng" });
    if (!(newRows.quantityKg > 0))
      ls.push({ truong: "Lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoiPhien(ls);
    if (ls.length > 0) return;

    let invoiceId = sessionInvoiceId;
    if (sessionInvoiceId) {
      // Phiếu đang tạo dở hoặc đang sửa → áp đầu phiếu vào bản ghi.
      persistSalesInvoices(
        salesInvoices.map((p) =>
          p.id === sessionInvoiceId ? { ...p, ...phien, id: p.id } : p
        )
      );
    } else {
      // Phiếu mới: chỉ tạo khi có dòng đầu tiên — không để lại phiếu rỗng.
      invoiceId = newId();
      persistSalesInvoices([...salesInvoices, { id: invoiceId, ...phien }]);
      setSessionInvoiceId(invoiceId);
    }

    const dong: SalesItem = {
      id: newId(),
      invoiceId: invoiceId ?? "",
      deliveryDate: phien.deliveryDate,
      productId: newRows.productId,
      spec: newRows.spec.trim(),
      quantityKg: newRows.quantityKg,
      unitPrice: newRows.unitPrice,
      sourceWarehouse: newRows.nguon, // RETAIL_WAREHOUSE ⇒ trừ tồn BTP; FG_WAREHOUSE ⇒ trừ tồn TP đóng gói
    };
    // Đồng bộ đầu phiếu cho MỌI dòng của phiếu (khách/ngày/kênh có thể vừa đổi
    // tại chỗ) rồi thêm dòng mới — giữ bất biến "đầu phiếu áp cả phiếu".
    const belongsToInvoice = (r: SalesItem) =>
      editRowIds ? editRowIds.includes(r.id) : r.invoiceId === invoiceId;
    persist([
      ...rows.map((r) =>
        belongsToInvoice(r) ? { ...r, deliveryDate: phien.deliveryDate } : r
      ),
      dong,
    ]);
    if (editRowIds) setEditRowIds([...editRowIds, dong.id]);
    notify.daLuu(`Đã vào sổ: ${productName(dong.productId)} — ${kg(dong.quantityKg)}`);

    // Nhớ kênh vừa bán để phiếu sau khỏi lật lại.
    setLastChannel(phien.channel);
    // Giữ quy cách cho dòng kế (một lô thường cùng size); xóa mặt hàng / kg / giá.
    setNewRows((d) => ({ ...EMPTY_NEW_ROW, spec: d.spec, nguon: d.nguon }));
    setLoiPhien([]);
  };

  const removeSessionRow = (r: SalesItem) => {
    const prevRows = rows;
    const prevIds = editRowIds;
    persist(rows.filter((x) => x.id !== r.id));
    if (editRowIds) setEditRowIds(editRowIds.filter((id) => id !== r.id));
    notify.daXoa(`Đã bỏ ${productName(r.productId)} — ${kg(r.quantityKg)}`, () => {
      persist(prevRows);
      if (prevIds) setEditRowIds(prevIds);
    });
  };

  /** Đóng phiếu: bỏ phiếu rỗng, áp đầu phiếu lần cuối, kéo bộ lọc về phiếu vừa ghi. */
  const closeSession = (mo: "dong" | "phieu-khac") => {
    const p = phien;
    if (p && sessionInvoiceId && dongPhien.length === 0) {
      persistSalesInvoices(salesInvoices.filter((x) => x.id !== sessionInvoiceId));
    }
    if (p && dongPhien.length > 0 && sessionInvoiceId) {
      persistSalesInvoices(
        salesInvoices.map((x) => (x.id === sessionInvoiceId ? { ...x, ...p, id: x.id } : x))
      );
      const thuoc = (r: SalesItem) =>
        editRowIds ? editRowIds.includes(r.id) : r.invoiceId === sessionInvoiceId;
      persist(rows.map((r) => (thuoc(r) ? { ...r, deliveryDate: p.deliveryDate } : r)));
    }
    if (p && dongPhien.length > 0) {
      if (p.deliveryDate < tuHieuLuc || p.deliveryDate > denHieuLuc) {
        setKy("ngay");
        setDate(p.deliveryDate);
      }
      if (workshop !== "Tất cả" && workshop !== p.workshop)
        setWorkshop(p.workshop);
    }

    if (mo === "dong") {
      setPhien(null);
      setSessionInvoiceId(null);
      setEditRowIds(null);
      return;
    }
    // Ghi phiếu khác: giữ ngày + xưởng, làm mới khách.
    setPhien(p ? { ...p, customerId: "", note: "" } : null);
    setSessionInvoiceId(null);
    setEditRowIds(null);
    setNewRows(EMPTY_NEW_ROW);
    setLoiPhien([]);
  };

  const deleteEditingInvoice = () => {
    if (!editRowIds) return;
    const prevRows = rows;
    const prevInvoices = salesInvoices;
    const ids = new Set(editRowIds);
    persist(rows.filter((r) => !ids.has(r.id)));
    if (sessionInvoiceId) persistSalesInvoices(salesInvoices.filter((x) => x.id !== sessionInvoiceId));
    notify.daXoa(
      `Đã xóa phiếu ${customerName(phien?.customerId ?? "") || "(chưa có khách)"} — ${editRowIds.length} dòng`,
      () => {
        persist(prevRows);
        persistSalesInvoices(prevInvoices);
      }
    );
    setPhien(null);
    setSessionInvoiceId(null);
    setEditRowIds(null);
  };

  /* ---- Sửa một dòng mặt hàng ---- */

  const save = () => {
    if (!editing) return;
    const ls: LoiNhap[] = [];
    if (!editing.productId)
      ls.push({ truong: "Mặt hàng", thongBao: "Chưa chọn mặt hàng" });
    if (!(editing.quantityKg > 0))
      ls.push({ truong: "Lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    persist(rows.map((r) => (r.id === editing.id ? editing : r)));
    notify.daLuu("Đã lưu thay đổi");
    setEditing(null);
  };

  const set = <K extends keyof SalesItem>(k: K, v: SalesItem[K]) =>
    setEditing((d) => (d ? { ...d, [k]: v } : d));

  /** Kênh của phiếu đang mở — quyết định đơn vị đơn giá. */
  const priceUnit = phien?.channel === "Nội địa" ? "đ" : "USD";
  const priceUnitFor = (kenh: SalesChannel) => (kenh === "Nội địa" ? "đ" : "USD");

  const itemColumns = (kenh: SalesChannel): Cot<SalesItem>[] => [
    {
      key: "mh",
      header: "Mặt hàng",
      chinh: true,
      render: (r) => productName(r.productId),
      sapXep: (r) => productName(r.productId),
    },
    {
      key: "qc",
      header: "Quy cách",
      render: (r) =>
        r.spec || <span className="text-muted-foreground">—</span>,
      sapXep: (r) => r.spec,
    },
    {
      key: "sl",
      header: "Lượng (kg)",
      so: true,
      render: (r) => num(r.quantityKg),
      sapXep: (r) => r.quantityKg,
    },
    {
      key: "gia",
      header: `Đơn giá (${priceUnitFor(kenh)})`,
      so: true,
      render: (r) =>
        r.unitPrice != null ? (
          num(r.unitPrice)
        ) : (
          <Nhan loai="loi">Chưa có giá</Nhan>
        ),
      sapXep: (r) => r.unitPrice ?? 0,
    },
    {
      key: "tien",
      header: `Thành tiền (${priceUnitFor(kenh)})`,
      so: true,
      render: (r) => num(calculateSalesAmount(r)),
      sapXep: (r) => calculateSalesAmount(r),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Bán hàng</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            title="Mở form ghi một phiếu bán mới: chọn khách, kênh bán, rồi thêm từng dòng mặt hàng." size="lg" onClick={openAdd}>
            <Plus />
            Ghi phiếu bán
          </Button>
        </div>
      </div>

      <ThongKe
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        the={[
          { nhan: "Đang xem", giaTri: rangeDescription, icon: CalendarRange, mau: "trung-tinh" },
          { nhan: "Phân xưởng", giaTri: workshop, icon: Warehouse, mau: "trung-tinh" },
          { nhan: "Số phiếu", giaTri: nhomView.length, so: true, icon: Truck, mau: "brand" },
          { nhan: "Số dòng", giaTri: view.length, so: true, icon: FileText, mau: "brand" },
          { nhan: "Tổng bán", giaTri: kg(total), so: true, icon: Scale, mau: "success" },
        ]}
      />

      {/* Bộ lọc — toolbar một hàng */}
      <div className="rounded-xl border-2 border-border p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Combobox
            label="Kỳ xem sổ"
            anNhanBatBuoc
            choPhepXoa={false}
            value={ky}
            onChange={(v) => setKy(v as ViewPeriod)}
            options={KY_OPT}
            className="min-w-[13rem]"
          />

          <div className="min-w-[220px] flex-1">
            {ky === "tuy-chon" ? (
              <DateRangeField
                label="Khoảng ngày xuất bán"
                anNhanBatBuoc
                presets={false}
                startDate={fromDate}
                endDate={toDate}
                onChange={(tu, den) => {
                  setFromDate(tu);
                  setToDate(den);
                }}
              />
            ) : (
              <DateField
                label={
                  ky === "ngay"
                    ? "Ngày xuất bán"
                    : ky === "tuan"
                      ? "Ngày bất kỳ trong tuần"
                      : ky === "thang"
                        ? "Ngày bất kỳ trong tháng"
                        : "Ngày bất kỳ trong năm"
                }
                anNhanBatBuoc
                hint={
                  ky === "ngay"
                    ? undefined
                    : `Kỳ đang xem: ${formatDateVN(tuHieuLuc)} – ${formatDateVN(denHieuLuc)}`
                }
                value={date}
                onChange={setDate}
              />
            )}
          </div>

          <Combobox
            label="Phân xưởng"
            anNhanBatBuoc
            choPhepXoa={false}
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
        <SkeletonBang />
      ) : nhomView.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          tieuDe={`Chưa có phiếu bán nào trong ${rangeDescription}`}
          moTa={
            workshop === "Tất cả"
              ? "Bấm nút dưới để ghi phiếu bán đầu tiên."
              : `Phân xưởng ${workshop}. Bấm nút dưới để ghi phiếu bán đầu tiên.`
          }
          action={
            <Button
              title="Mở form ghi phiếu bán đầu tiên cho ngày này." size="lg" onClick={openAdd}>
              <Plus />
              Ghi phiếu bán
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-5">
            {nhomView.map((n, i) => (
              <section
                key={n.phieu.id}
                className="space-y-4 rounded-xl border-2 border-border p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="tnum text-base text-muted-foreground">
                        Phiếu {i + 1}
                      </span>
                      <span className="text-xl font-semibold text-foreground">
                        {customerName(n.phieu.customerId) || "(chưa có khách)"}
                      </span>
                      <span className="text-base text-muted-foreground">
                        {formatDateVN(n.phieu.deliveryDate)} · xưởng {n.phieu.workshop}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Nhan loai="phan-loai" sac={sacKenh(n.phieu.channel)}>
                        {n.phieu.channel}
                      </Nhan>
                      {n.ghiBu && (
                        <Nhan loai="luu-y">
                          Ghi bù {formatDateVN(n.phieu.postingDate)}
                        </Nhan>
                      )}
                    </div>
                    {n.ghiBu && n.phieu.backdateReason && (
                      <p className="text-base text-muted-foreground">
                        Lý do ghi bù: {n.phieu.backdateReason}
                      </p>
                    )}
                    {n.phieu.note && (
                      <p className="text-base text-muted-foreground">
                        Ghi chú: {n.phieu.note}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base text-muted-foreground">
                      Phiếu này
                    </span>
                    <span className="tnum text-xl font-semibold">
                      {kg(n.tongKg)}
                    </span>
                    <Button
                      title="Mở lại phiếu bán này để sửa khách hàng, kênh bán hay các dòng hàng." variant="outline" onClick={() => openInvoiceEdit(n)}>
                      <Pencil />
                      Sửa phiếu
                    </Button>
                  </div>
                </div>

                <RecordTable
                  columns={itemColumns(n.phieu.channel)}
                  rows={n.dong}
                  getKey={(r) => r.id}
                  toMau="ban-hang"
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
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng tiền bán
              </span>
              <span className="tnum text-xl font-semibold">
                {num(totalAmount)}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ---- Hộp thoại: ghi phiếu bán ---- */}
      <Dialog
        open={phien !== null}
        onOpenChange={(o) => {
          if (!o) closeSession("dong");
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

          {phien && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loiPhien} />
              <ChuThichBatBuoc />

              <div className="grid gap-6 sm:grid-cols-2">
                <DateField
                  label="Ngày ghi sổ"
                  required
                  info="Ngày ghi vào hệ thống. Khác ngày xuất bán ⇒ ghi bù."
                  value={phien.postingDate}
                  onChange={(v) => setSessionField("postingDate", v)}
                />
                <DateField
                  label="Ngày xuất bán"
                  required
                  info="Ngày hàng thực xuất bán — mọi tổng hợp tính theo ngày này."
                  value={phien.deliveryDate}
                  onChange={(v) => setSessionField("deliveryDate", v)}
                />
              </div>

              {isBackdatedSales(phien) && (
                <Field
                  label="Lý do ghi bù"
                  required
                  hint="VD: xuất bán 29/7, 31/7 mới ghi sổ."
                >
                  <Input
                    value={phien.backdateReason}
                    onChange={(e) => setSessionField("backdateReason", e.target.value)}
                    placeholder="Vì sao tới hôm nay mới ghi?"
                  />
                </Field>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                <Combobox
                  label="Phân xưởng"
                  required
                  choPhepXoa={false}
                  value={phien.workshop}
                  onChange={(v) => setSessionField("workshop", v as Workshop)}
                  options={WORKSHOPS.map((p) => ({ value: p, label: p }))}
                />
                <ChoiceGroup
                  label="Kênh bán"
                  value={phien.channel}
                  onChange={(v) => setSessionField("channel", v as SalesChannel)}
                  options={SALES_CHANNELS.map((k) => ({ value: k, label: k }))}
                  cot={2}
                />
              </div>

              <Combobox
                label="Khách hàng"
                hint="Chọn trong danh mục. Chưa có thì gõ tên rồi bấm Thêm mới. Bỏ trống nếu chưa xác định khách."
                value={phien.customerId}
                onChange={(v) => setSessionField("customerId", v)}
                options={customerOptions}
                onCreate={addCustomer}
                emptyText="Chưa có khách hàng nào trong danh mục."
                onSuaMuc={customerEditor.moSua}
                nhanSua={customerEditor.nhanSua}
              />

              <Field label="Ghi chú phiếu">
                <Input
                  value={phien.note}
                  onChange={(e) => setSessionField("note", e.target.value)}
                  placeholder="Ghi chú thêm (nếu có)"
                />
              </Field>

              <div className="border-t-2 border-border pt-1" />

              {/* Đã vào sổ */}
              {dongPhien.length > 0 && (
                <div className="space-y-3 rounded-xl border-2 border-border p-4">
                  <p className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <CircleCheck className="size-6 text-primary" aria-hidden />
                    Đã vào sổ {dongPhien.length} mặt hàng — phiếu này{" "}
                    <span className="tnum">{kg(sessionTotal)}</span>
                  </p>
                  <ul className="divide-y divide-border">
                    {dongPhien.map((r, i) => (
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
                          <Button
                            title="Sửa dòng bán này (mặt hàng · quy cách · số kg · đơn giá)."
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditing({ ...r });
                              setLoi([]);
                            }}
                          >
                            <Pencil />
                            Sửa
                          </Button>
                          <Button
                            title="Bỏ dòng bán này khỏi phiếu đang gõ."
                            variant="outline"
                            size="sm"
                            onClick={() => removeSessionRow(r)}
                          >
                            <X />
                            Bỏ
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Thêm một mặt hàng — nút chính duy nhất trong thân */}
              <div className="space-y-5 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
                <p className="text-base font-semibold">Thêm mặt hàng</p>

                <Combobox
                  label="Mặt hàng"
                  required
                  hint="Chưa có trong danh mục thì gõ tên rồi bấm Thêm mới."
                  value={newRows.productId}
                  onChange={(v) => setDong("productId", v)}
                  options={productOptions}
                  onCreate={addProduct}
                  emptyText="Chưa có mặt hàng nào trong danh mục."
                  onSuaMuc={productEditor.moSua}
                  nhanSua={productEditor.nhanSua}
                />

                <ChoiceGroup
                  label="Nguồn bán"
                  value={newRows.nguon}
                  onChange={(v) => setDong("nguon", v)}
                  options={[
                    { value: RETAIL_WAREHOUSE, label: "Block thô (kho dự trữ)" },
                    { value: FG_WAREHOUSE, label: "Đóng gói (kho thành phẩm)" },
                  ]}
                  cot={2}
                />

                <Field
                  label="Quy cách"
                  hint="Size/grade của thành phẩm. VD: 18-20, 1000-1300, 1.5g."
                >
                  <Input
                    value={newRows.spec}
                    onChange={(e) => setDong("spec", e.target.value)}
                    placeholder="VD: 18-20"
                  />
                </Field>

                <div className="grid gap-6 sm:grid-cols-2">
                  <NumberField
                    label="Lượng"
                    required
                    unit="kg"
                    value={newRows.quantityKg || null}
                    onChange={(v) => setDong("quantityKg", v ?? 0)}
                  />
                  <NumberField
                    label="Đơn giá"
                    unit={priceUnit}
                    value={newRows.unitPrice}
                    onChange={(v) => setDong("unitPrice", v)}
                    hint="Bỏ trống nếu chưa chốt giá."
                  />
                </div>

                {newRowAvailable != null ? (
                  <div
                    className={
                      isOversold
                        ? "rounded-lg bg-warning-surface px-4 py-3 text-base text-warning"
                        : "rounded-lg bg-muted px-4 py-3 text-base text-muted-foreground"
                    }
                  >
                    Tồn khả dụng ({newRows.nguon === FG_WAREHOUSE ? "kho thành phẩm" : "kho dự trữ"}):{" "}
                    <span className="tnum font-semibold">{kg(newRowAvailable)}</span>
                    {isOversold
                      ? " — bán vượt tồn, kiểm lại (vẫn ghi được, tồn sẽ báo âm)."
                      : ""}
                  </div>
                ) : null}

                {newRows.quantityKg > 0 && newRows.unitPrice ? (
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

              {/* Tổng phiếu */}
              <div className="flex flex-wrap items-baseline justify-end gap-x-8 gap-y-2 rounded-xl bg-muted px-5 py-4">
                <span className="text-base text-muted-foreground">
                  Tổng phiếu {formatDateVN(phien.deliveryDate)} · xưởng {phien.workshop}
                </span>
                <span className="tnum text-2xl font-semibold">
                  {kg(sessionTotal)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            {isEditingInvoice ? (
              <ConfirmDelete
                moTaBanGhi={`Phiếu ${customerName(phien?.customerId ?? "") || "(chưa có khách)"} — ${formatDateVN(phien?.deliveryDate ?? "")} — ${dongPhien.length} dòng — ${kg(sessionTotal)}`}
                onConfirm={deleteEditingInvoice}
                tieuDe="Xóa cả phiếu này?"
                nhanNut="Xóa phiếu"
              />
            ) : (
              <Button
                title="Ghi phiếu đang gõ vào sổ rồi mở phiếu trống để bán tiếp cho khách khác."
                variant="outline"
                size="lg"
                onClick={() => closeSession("phieu-khac")}
              >
                <Truck />
                Lưu &amp; thêm phiếu khác
              </Button>
            )}
            <Button
              title="Ghi phiếu đang gõ vào sổ rồi quay về danh sách phiếu bán." size="lg" onClick={() => closeSession("dong")}>
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
              <ErrorSummary loi={loi} />
              <ChuThichBatBuoc />

              <Combobox
                label="Mặt hàng"
                required
                hint="Chưa có trong danh mục thì gõ tên rồi bấm Thêm mới."
                value={editing.productId}
                onChange={(v) => set("productId", v)}
                options={productOptions}
                onCreate={addProduct}
                emptyText="Chưa có mặt hàng nào trong danh mục."
                onSuaMuc={productEditor.moSua}
                nhanSua={productEditor.nhanSua}
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
                <NumberField
                  label="Đơn giá"
                  unit={priceUnit}
                  value={editing.unitPrice}
                  onChange={(v) => set("unitPrice", v)}
                  hint="Bỏ trống nếu chưa chốt giá."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setEditing(null)}>
              Hủy
            </Button>
            <Button
              title="Ghi đè dòng bán này bằng số vừa sửa." size="lg" onClick={save}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {customerEditor.hop}
      {productEditor.hop}
      {lotSalesItem && saleLotKind(lotSalesItem) && (
        <GanLoXuat
          docKind="sales_item"
          docId={lotSalesItem.id}
          docNhan={`${productName(lotSalesItem.productId)} · ${kg(lotSalesItem.quantityKg)} · ${formatDateVN(lotSalesItem.deliveryDate)}`}
          loaiLo={saleLotKind(lotSalesItem)!}
          xuong={salesInvoices.find((p) => p.id === lotSalesItem.invoiceId)?.workshop ?? "Đông"}
          ngay={lotSalesItem.deliveryDate}
          matHangId={lotSalesItem.productId}
          onClose={() => setLotSalesItem(null)}
        />
      )}
    </div>
  );
}
