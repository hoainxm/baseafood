// ============================================================
// Tên file cũ: src/features/orders/DonDat.tsx
// Tên tiếng Việt: Màn hình Quản lý Đơn đặt hàng & Gom hàng
// Description: Sales Order Management & Consolidation Screen
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  OrderItem,
  ExportItem,
  SalesOrder,
  ExportOrder,
  SalesInvoice,
  SalesItem,
} from "@/types";
import { newId } from "@/lib/store";
import {
  useSalesItems,
  useSalesOrders,
  useOrderItems,
  useExportItems,
  useCustomers,
  useExportOrders,
  useProducts,
  useSalesInvoices,
  useWipProductions,
  usePackagings,
  useLotInputs,
  useLotDispatches,
  useBalancingOutputs,
  isServerConnected,
} from "@/lib/catalogRepo";
import {
  canReopenOrder,
  checkExportReversal,
  checkOrderDelete,
  isCancelledExport,
  reverseExportOrder,
  ORDER_HANDOFF_SOURCE,
  type ExportReversalData,
} from "@/lib/orderExportReversal";
import { listLotsWithStock, computeWipStock, collectWipDeductions } from "@/lib/inventory";
import { ALL, activeFilterCount, countedLabel, filterRows, matchesSearch, matchesValue, statusOptions } from "@/lib/recordFilters";
import {
  RequiredLegend,
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FilterBar,
  NoMatchState,
  SearchField,
  TableSkeleton,
  ErrorSummary,
  Field,
  Input,
  Tag,
  NumberField,
  RecordTable,
  StatCardGrid,
  ConfirmAction,
  ConfirmDelete,
  ReadOnlyBadge,
  notify,
  type RecordTableColumn,
  type FieldError,
  type ComboboxOption,
} from "@/design-system";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { useCan } from "@/features/shared/PermissionProvider";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useDialogDraft, useFormDraft } from "@/lib/formDraft";
import { recordName } from "@/lib/personName";
import { useAuth } from "@/lib/auth";
import { kg, num, todayISO, formatDateVN } from "@/lib/format";
import { Ban, CheckCircle, ClipboardList, Package, PackageCheck, Plus, ScanLine, Trash2, Truck, Undo2 } from "lucide-react";
import { ExportLotCheck } from "./ExportLotCheck";
import { readParam } from "@/lib/legacyUrls";
import { usePageTour } from "@/features/shared/PageTourProvider";
import { buildOrdersTour, pickTourOrder } from "./ordersTour";

interface NewWeighRow {
  productId: string;
  spec: string;
  requiredQuantityKg: number;
  requiredBlocksCount: number;
}
interface NewOrder {
  customerId: string;
  orderDate: string;
  note: string;
  rows: NewWeighRow[];
}
/** Hộp Hủy lệnh xuất — lý do bắt buộc, có nháp (quy tắc 17). */
interface CancelExportForm {
  exportId: string;
  reason: string;
}

const STATUS_LABELS: Record<SalesOrder["status"], string> = {
  collecting: "Đang gom",
  complete: "Đủ",
  closed: "Đã xuất",
};

export default function SalesOrderScreen() {
  // Phân quyền lớp 2 (spec role-permissions §5): không quyền ⇒ ẩn nút; có xem mà
  // không thêm/sửa ⇒ nhãn "Chỉ xem".
  const allowed = useCan("orders");
  const isReadOnly = !allowed.create && !allowed.update;
  // Hủy lệnh xuất gỡ cả phiếu ở sổ Bán hàng ⇒ cần quyền xóa ở CẢ hai khu.
  const salesAllowed = useCan("sales");
  const canCancelExport = allowed.delete && salesAllowed.delete;
  const [don, persistDon, { status }] = useSalesOrders();
  const isLoading = status === "loading" && don.length === 0;
  const [orderItems, persistOrderItems] = useOrderItems();
  const [exportOrders, persistExportOrders] = useExportOrders();
  const [exportItems, persistExportItems] = useExportItems();
  const [wips] = useWipProductions();
  const [products, setProducts] = useProducts();
  const [customers, setCustomers] = useCustomers();
  /** Bút chì sửa nhanh danh mục ngay trong ô chọn. */
  const customerEditor = useQuickCatalogEdit("customer", customers, setCustomers);
  const productEditor = useQuickCatalogEdit("product", products, setProducts);
  const [salesInvoices, persistSalesInvoices] = useSalesInvoices();
  const [salesItems, persistBan] = useSalesItems();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState<NewOrder | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [lotCheckOrder, setLotCheckOrder] = useState<ExportOrder | null>(null);

  // Link từ /qr "Theo giai đoạn" (`?order=<id>&check=<id lệnh xuất>`; link cũ `?don=&kiem=`) ⇒ mở đơn và hộp kiểm
  // lô của lệnh đó. Chờ dữ liệu nạp xong mới xử lý, xong gỡ tham số khỏi link.
  const [searchParams, setSearchParams] = useSearchParams();
  const donUrl = readParam(searchParams, "order");
  const checkParam = readParam(searchParams, "check");
  useEffect(() => {
    if (!donUrl || !don.some((d) => d.id === donUrl)) return;
    setSelectedId(donUrl);
    const l = checkParam ? exportOrders.find((x) => x.id === checkParam) : undefined;
    if (l) setLotCheckOrder(l);
    setSearchParams({}, { replace: true });
  }, [donUrl, checkParam, don, exportOrders, setSearchParams]);

  const productNameOf = (id: string) => products.find((m) => m.id === id)?.name || "—";
  const tenKH = (id: string) => customers.find((k) => k.id === id)?.name || "—";

  // Bộ lọc đơn (ba-spec 53 đợt 1): trạng thái · khách · ô tra — không lưu, không toast.
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [customerFilter, setCustomerFilter] = useState(ALL);
  const [query, setQuery] = useState("");
  const filterCount = activeFilterCount([statusFilter, customerFilter, query]);
  const clearFilters = () => {
    setStatusFilter(ALL);
    setCustomerFilter(ALL);
    setQuery("");
  };
  const statusChoices = statusOptions(don, (d) => d.status, (Object.keys(STATUS_LABELS) as SalesOrder["status"][]).map((v) => ({ value: v, label: STATUS_LABELS[v] })));
  const customerChoices = [
    { value: ALL, label: "Tất cả khách" },
    ...[...new Set(don.map((d) => d.customerId))].filter(Boolean).map((id) => ({ value: id, label: tenKH(id) })).sort((a, b) => a.label.localeCompare(b.label, "vi")),
  ];
  const shownOrders = filterRows(don, [
    (d) => matchesValue(statusFilter, d.status),
    (d) => matchesValue(customerFilter, d.customerId),
    (d) => matchesSearch(query, tenKH(d.customerId), d.note, ...orderItems.filter((x) => x.orderId === d.id).flatMap((x) => [productNameOf(x.productId), x.spec])),
  ]);

  const [packagings] = usePackagings();
  const [lotInputs] = useLotInputs();
  const [lotDispatches, persistLotDispatches] = useLotDispatches();
  const [balancingOutputs] = useBalancingOutputs();
  // Trừ đúng lô đã gắn (truy xuất QR) trước khi lập lệnh FIFO — lệnh không lấy lô đã đi.
  const retailSales = useMemo(
    () => collectWipDeductions(salesItems, packagings, lotInputs, lotDispatches),
    [salesItems, packagings, lotInputs, lotDispatches]
  );
  const stock = useMemo(() => computeWipStock(wips, exportItems, retailSales), [wips, exportItems, retailSales]);

  const productOptions: ComboboxOption[] = products.map((m) => ({
    value: m.id,
    label: m.name,
    subLabel: m.code || undefined,
  }));
  const customerOptions: ComboboxOption[] = customers.map((k) => ({
    value: k.id,
    label: k.name,
    subLabel: k.market || undefined,
  }));
  /** kg đã xuất cho (đơn × mặt hàng × quy cách) — gom dòng lệnh của lệnh thuộc đơn. */
  const exportedKg = (orderId: string, productId: string, qc: string) => {
    const orderExportIds = new Set(
      exportOrders.filter((l) => l.orderId === orderId).map((l) => l.id)
    );
    return exportItems
      .filter(
        (d) =>
          orderExportIds.has(d.exportId) && d.productId === productId && d.spec === qc
      )
      .reduce((s, d) => s + (d.quantityKg || 0), 0);
  };

  const selectedOrder = selectedId ? don.find((d) => d.id === selectedId) : undefined;
  const selectedOrderItems = useMemo(
    () => (selectedId ? orderItems.filter((d) => d.orderId === selectedId) : []),
    [orderItems, selectedId]
  );

  /* Tự lưu NHÁP đơn đang tạo (quy tắc 17, lib/formDraft.ts). Đóng ngang hộp (bấm ra ngoài
     / Esc) vẫn giữ — mở lại "Tạo đơn" là số cũ quay về; chỉ Hủy / Lưu mới bỏ. */
  const { profile } = useAuth();
  const [keptCreating, setKeptCreating] = useState<NewOrder | null>(null);
  const orderDraft = useFormDraft({
    form: "orders",
    account: profile?.username ?? "",
    accountReady: profile !== null || !isServerConnected,
    value: creating ?? keptCreating,
    isEmpty: (t) =>
      !t || (!t.customerId && !t.note.trim() && t.rows.every((d) => !d.productId && !d.requiredQuantityKg && !d.requiredBlocksCount)),
    onRestore: (t) => {
      setCreating(t);
      setErrors([]);
    },
  });
  const cancelCreate = () => {
    setCreating(null);
    setKeptCreating(null);
    orderDraft.discard();
  };

  /* ---- Tạo đơn ---- */
  const openCreate = () => {
    if (keptCreating) {
      setCreating(keptCreating);
      setKeptCreating(null);
      setErrors([]);
      return;
    }
    setCreating({
      customerId: "",
      orderDate: todayISO(),
      note: "",
      rows: [{ productId: "", spec: "", requiredQuantityKg: 0, requiredBlocksCount: 0 }],
    });
    setErrors([]);
  };
  const addProduct = (name: string) => {
    const trimmedName = name.trim();
    const existing = products.find((m) => m.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (existing) return existing.id; // trùng tên (không phân hoa thường) ⇒ dùng lại bản có sẵn
    const m = { id: newId(), code: "", name: trimmedName, finishedGoodCode: "" };
    setProducts([...products, m]);
    notify.saved(`Đã thêm mặt hàng "${trimmedName}" vào danh mục`);
    return m.id;
  };
  const addCustomer = (name: string) => {
    const trimmedName = name.trim();
    const existing = customers.find((k) => k.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (existing) return existing.id; // trùng tên (không phân hoa thường) ⇒ dùng lại bản có sẵn
    const k = { id: newId(), code: "", name: trimmedName, market: "" };
    setCustomers([...customers, k]);
    notify.saved(`Đã thêm khách hàng "${trimmedName}" vào danh mục`);
    return k.id;
  };
  const updateRow = (i: number, patch: Partial<NewWeighRow>) =>
    setCreating((t) =>
      t
        ? { ...t, rows: t.rows.map((d, j) => (j === i ? { ...d, ...patch } : d)) }
        : t
    );

  const saveCreate = () => {
    if (!creating) return;
    const ls: FieldError[] = [];
    if (!creating.customerId) ls.push({ field: "Khách", message: "Chưa chọn khách" });
    const validRows = creating.rows.filter((d) => d.productId && d.requiredQuantityKg > 0);
    if (validRows.length === 0)
      ls.push({ field: "Dòng cần", message: "Thêm ít nhất 1 mặt hàng cần" });
    setErrors(ls);
    if (ls.length > 0) return;
    const donId = newId();
    const newOrder: SalesOrder = {
      id: donId,
      customerId: creating.customerId,
      orderDate: creating.orderDate,
      status: "collecting",
      note: creating.note,
    };
    const newOrderItems: OrderItem[] = validRows.map((d) => ({
      id: newId(),
      orderId: donId,
      productId: d.productId,
      spec: d.spec.trim(),
      requiredQuantityKg: d.requiredQuantityKg,
      requiredBlocksCount: d.requiredBlocksCount,
    }));
    persistDon([...don, newOrder]);
    persistOrderItems([...orderItems, ...newOrderItems]);
    notify.saved(`Đã tạo đơn cho ${tenKH(creating.customerId)}`);
    setCreating(null);
    setKeptCreating(null);
    setSelectedId(donId);
  };

  /* ---- Tạo lệnh xuất (FIFO, cho xuất một phần) + handoff sổ Bán hàng ---- */
  const createExportOrder = (d: SalesOrder) => {
    const orderLines = orderItems.filter((x) => x.orderId === d.id);
    const currentStock = computeWipStock(wips, exportItems, retailSales);
    const exportOrderId = newId();
    const newExportItems: ExportItem[] = [];
    for (const dc of orderLines) {
      let conCan = dc.requiredQuantityKg - exportedKg(d.id, dc.productId, dc.spec);
      if (conCan <= 0) continue;
      const los = listLotsWithStock(currentStock, dc.productId, dc.spec);
      for (const lot of los) {
        if (conCan <= 0) break;
        const take = Math.min(conCan, lot.remainingKg);
        if (take <= 0) continue;
        const share = lot.remainingKg > 0 ? take / lot.remainingKg : 0;
        newExportItems.push({
          id: newId(),
          exportId: exportOrderId,
          wipId: lot.wipId,
          productId: dc.productId,
          spec: dc.spec,
          quantityKg: take,
          blocksCount: Math.round(lot.remainingBlocks * share),
        });
        lot.remainingKg -= take; // trừ tồn trong bộ nhớ để lô sau tính đúng
        conCan -= take;
      }
    }
    if (newExportItems.length === 0) {
      notify.warning("Chưa có tồn khả dụng để xuất cho đơn này");
      return;
    }
    const newExportOrder: ExportOrder = {
      id: exportOrderId,
      orderId: d.id,
      exportDate: todayISO(),
      status: "closed",
      note: "",
    };
    // Handoff sổ Bán hàng: 1 phiếu bán (kênh Xuất khẩu), mỗi dòng lệnh = 1 dòng bán.
    // Phiếu mang ĐÚNG id của lệnh ⇒ Hủy lệnh xuất tìm lại đúng phiếu mà khỏi thêm cột
    // (lib/orderExportReversal.ts#findLinkedSalesInvoice; lệnh cũ dò theo nội dung).
    const salesInvoiceId = exportOrderId;
    const salesInvoice: SalesInvoice = {
      id: salesInvoiceId,
      deliveryDate: todayISO(),
      postingDate: todayISO(),
      backdateReason: "",
      workshop: "Đông",
      customerId: d.customerId,
      channel: "Xuất khẩu",
      note: `Xuất container từ đơn ${tenKH(d.customerId)}`,
    };
    const newSalesItems: SalesItem[] = newExportItems.map((item) => ({
      id: newId(),
      invoiceId: salesInvoiceId,
      deliveryDate: todayISO(),
      productId: item.productId,
      spec: item.spec,
      quantityKg: item.quantityKg,
      unitPrice: null,
      sourceWarehouse: ORDER_HANDOFF_SOURCE, // đánh dấu handoff — NXT/tồn kho không đếm hai lần
    }));

    persistExportItems([...exportItems, ...newExportItems]);
    persistExportOrders([...exportOrders, newExportOrder]);
    persistSalesInvoices([...salesInvoices, salesInvoice]);
    persistBan([...salesItems, ...newSalesItems]);

    // Cập nhật trạng thái đơn: đủ hết → "closed", còn thiếu → "collecting".
    const hasMissing = orderLines.some(
      (dc) =>
        dc.requiredQuantityKg -
          (exportedKg(d.id, dc.productId, dc.spec) +
            newExportItems
              .filter(
                (item) => item.productId === dc.productId && item.spec === dc.spec
              )
              .reduce((s, item) => s + item.quantityKg, 0)) >
        0.001
    );
    persistDon(
      don.map((x) =>
        x.id === d.id ? { ...x, status: hasMissing ? "collecting" : "closed" } : x
      )
    );
    const totalOut = newExportItems.reduce((s, item) => s + item.quantityKg, 0);
    notify.saved(
      `Đã xuất ${kg(totalOut)} → sổ Bán hàng (phiếu ${tenKH(d.customerId)})` +
        (hasMissing ? " · đơn còn thiếu, vẫn mở" : " · đơn đóng")
    );
  };

  const confirmFulfilled = (d: SalesOrder) => {
    persistDon(don.map((x) => (x.id === d.id ? { ...x, status: "complete" } : x)));
    notify.saved("Đã đánh dấu đơn đủ — bấm Lệnh xuất để xuất container");
  };

  /** Mở lại đơn đã "Xác nhận đủ" về Đang gom (bấm nhầm Xác nhận đủ). */
  const reopenOrder = (d: SalesOrder) => {
    if (!canReopenOrder(d)) return;
    const prevOrders = don;
    persistDon(don.map((x) => (x.id === d.id ? { ...x, status: "collecting" } : x)));
    notify.saved(`Đã mở lại đơn ${tenKH(d.customerId)} — về Đang gom`, () => persistDon(prevOrders));
  };

  /* ---- Xóa đơn: chỉ khi không còn lệnh xuất hiệu lực (còn thì hủy lệnh trước) ---- */
  const [deletingOrder, setDeletingOrder] = useState<SalesOrder | null>(null);
  const requestDeleteOrder = (d: SalesOrder) => {
    const c = checkOrderDelete(d.id, exportOrders);
    if (!c.ok) {
      notify.warning(c.reason);
      return;
    }
    setDeletingOrder(d);
  };
  const deleteOrder = (d: SalesOrder) => {
    const c = checkOrderDelete(d.id, exportOrders);
    if (!c.ok) {
      notify.warning(c.reason);
      return;
    }
    const prevOrders = don;
    const prevRows = orderItems;
    const prevExportOrders = exportOrders;
    const cancelledIds = new Set(c.cancelledExportIds);
    persistDon(don.filter((x) => x.id !== d.id));
    persistOrderItems(orderItems.filter((x) => x.orderId !== d.id));
    if (cancelledIds.size) persistExportOrders(exportOrders.filter((x) => !cancelledIds.has(x.id)));
    if (selectedId === d.id) setSelectedId(null);
    notify.deleted(`Đã xóa đơn ${tenKH(d.customerId)}`, () => {
      persistDon(prevOrders);
      persistOrderItems(prevRows);
      if (cancelledIds.size) persistExportOrders(prevExportOrders);
    });
  };

  /* ---- Hủy lệnh xuất: trả tồn về đúng lô, gỡ phiếu bán đi kèm, giữ đầu lệnh làm dấu vết ---- */
  const [cancelling, setCancelling] = useState<CancelExportForm | null>(null);
  const [cancelErrors, setCancelErrors] = useState<FieldError[]>([]);
  const cancelDraft = useDialogDraft<CancelExportForm>({
    form: "orders-export-cancel",
    value: cancelling,
    setValue: setCancelling,
    isEmpty: (v) => !v.reason.trim(),
  });
  const reversalData: ExportReversalData = {
    salesOrders: don,
    orderItems,
    exportOrders,
    exportItems,
    salesInvoices,
    salesItems,
    lotDispatches,
    balancingOutputs,
  };
  const cancelCheck = cancelling ? checkExportReversal(cancelling.exportId, reversalData) : null;
  const openCancelExport = (l: ExportOrder) => {
    const c = checkExportReversal(l.id, reversalData);
    if (!c.ok) {
      notify.warning(c.reason);
      return;
    }
    const kept = cancelDraft.takeKept();
    setCancelling(kept && kept.exportId === l.id ? kept : { exportId: l.id, reason: "" });
    setCancelErrors([]);
  };
  const confirmCancelExport = () => {
    if (!cancelling) return;
    if (!cancelling.reason.trim()) {
      setCancelErrors([{ field: "Lý do hủy", message: "Ghi lý do hủy lệnh xuất (VD xuất nhầm đơn, nhầm ngày)" }]);
      return;
    }
    const c = checkExportReversal(cancelling.exportId, reversalData);
    if (!c.ok) {
      notify.warning(c.reason);
      cancelDraft.cancel();
      return;
    }
    const prev = { don, exportOrders, exportItems, salesInvoices, salesItems, lotDispatches };
    const r = reverseExportOrder(cancelling.exportId, reversalData, {
      reason: cancelling.reason,
      cancelledBy: recordName(profile),
      cancelledAt: new Date().toISOString(),
    });
    persistExportItems(r.exportItems);
    persistExportOrders(r.exportOrders);
    if (r.preview.invoice) {
      persistSalesInvoices(r.salesInvoices);
      persistBan(r.salesItems);
    }
    if (r.preview.checkCount) persistLotDispatches(r.lotDispatches);
    persistDon(r.salesOrders);
    cancelDraft.done();
    notify.deleted(
      `Đã hủy lệnh xuất ${formatDateVN(r.preview.exportOrder.exportDate)} — trả ${kg(r.preview.totalKg)} về kho` +
        (r.preview.invoice ? ", gỡ phiếu bán đi kèm" : ""),
      () => {
        persistExportItems(prev.exportItems);
        persistExportOrders(prev.exportOrders);
        if (r.preview.invoice) {
          persistSalesInvoices(prev.salesInvoices);
          persistBan(prev.salesItems);
        }
        if (r.preview.checkCount) persistLotDispatches(prev.lotDispatches);
        persistDon(prev.don);
      }
    );
  };

  // Hướng dẫn thao tác (ba-spec 43): đơn minh họa chọn từ dữ liệu đang có; bước chỉ đổi đơn đang
  // mở (không ghi gì). Tour chụp lúc bắt đầu ⇒ `selectedId` trong lời gọi trả về chính là đơn đang
  // mở lúc bắt đầu — bước danh sách và lời kết trả chi tiết về đúng đơn đó.
  const tourPick = useMemo(() => pickTourOrder(don, orderItems, exportOrders), [don, orderItems, exportOrders]);
  const tour = useMemo(
    () =>
      buildOrdersTour({
        pick: tourPick,
        can: { create: allowed.create, update: allowed.update, delete: allowed.delete, cancelExport: canCancelExport },
        openOrder: (id) => setSelectedId(id),
        restoreView: () => setSelectedId(selectedId),
      }),
    [tourPick, allowed.create, allowed.update, allowed.delete, canCancelExport, selectedId],
  );
  usePageTour(isLoading ? null : tour);

  const colsDon: RecordTableColumn<SalesOrder>[] = [
    { key: "kh", header: "Khách", primary: true, render: (r) => tenKH(r.customerId), getSortValue: (r) => tenKH(r.customerId) },
    { key: "ngay", header: "Ngày đặt", render: (r) => formatDateVN(r.orderDate), getSortValue: (r) => r.orderDate },
    {
      key: "sd",
      header: "Số dòng",
      numeric: true,
      render: (r) => num(orderItems.filter((d) => d.orderId === r.id).length),
    },
    {
      key: "tt",
      header: "Trạng thái",
      render: (r) => (
        <Tag variant={r.status === "collecting" ? "pending" : "done"}>{STATUS_LABELS[r.status]}</Tag>
      ),
      getSortValue: (r) => r.status,
    },
  ];

  // Nút Tạo đơn: có đơn ⇒ cuối hàng lọc; chưa có đơn ⇒ hàng gọn dạt phải (README § Đầu trang gọn).
  const createButton = (
    <Button
      data-tour="orders-create"
      title="Tạo một đơn đặt hàng xuất khẩu: khách, hạn giao, và các mặt hàng cần bao nhiêu kg." onClick={openCreate}>
      <Plus />
      Tạo đơn
    </Button>
  );

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Đơn đặt &amp; lệnh xuất</h1>
      {(isReadOnly || (allowed.create && don.length === 0)) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {isReadOnly && <ReadOnlyBadge />}
          {allowed.create && don.length === 0 && <div className="ml-auto">{createButton}</div>}
        </div>
      )}
      {don.length > 0 && (
        <FilterBar
          data-tour="orders-filter"
          actions={allowed.create && createButton}
          activeCount={filterCount}
          onClearAll={clearFilters}
          resultText={`Đang hiện ${shownOrders.length.toLocaleString("vi-VN")} / ${don.length.toLocaleString("vi-VN")} đơn`}
        >
          <Combobox
            label="Trạng thái"
            hideRequiredMark
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusChoices.map((o) => ({ value: o.value, label: countedLabel(o) }))}
            clearable={false}
            className="min-w-[14rem] flex-1"
          />
          <Combobox
            label="Khách hàng"
            hideRequiredMark
            clearable={false}
            value={customerFilter}
            onChange={(v) => setCustomerFilter(v || ALL)}
            options={customerChoices}
            className="min-w-[220px] flex-1"
          />
          <SearchField label="Tra khách, mặt hàng, quy cách, ghi chú" value={query} onChange={setQuery} />
        </FilterBar>
      )}

      <div data-tour="orders-stats">
      <StatCardGrid
        className="grid-cols-1 sm:grid-cols-3"
        cards={[
          { label: filterCount ? "Số đơn · theo bộ lọc" : "Tổng số đơn", value: shownOrders.length, numeric: true, icon: ClipboardList, color: "neutral" },
          { label: filterCount ? "Đang gom · theo bộ lọc" : "Đang gom hàng", value: shownOrders.filter((d) => d.status === "collecting").length, numeric: true, icon: Package, color: "brand" },
          { label: filterCount ? "Đã xuất · theo bộ lọc" : "Đã xuất xong", value: shownOrders.filter((d) => d.status === "closed").length, numeric: true, icon: CheckCircle, color: "success" },
        ]}
      />
      </div>

      <div data-tour="orders-table">
      {isLoading ? (
        <TableSkeleton />
      ) : don.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Chưa có đơn đặt nào"
          description={
            allowed.create
              ? "Bấm Tạo đơn để khai đơn khách đặt (mặt hàng, quy cách, số lượng cần)."
              : undefined
          }
          action={
            allowed.create && <Button
              title="Tạo đơn đặt đầu tiên." size="lg" onClick={openCreate}>
              <Plus />
              Tạo đơn
            </Button>
          }
        />
      ) : shownOrders.length === 0 ? (
        <NoMatchState onClearAll={clearFilters} />
      ) : (
        <RecordTable
          columns={colsDon}
          rows={shownOrders}
          getKey={(r) => r.id}
          rowMarkKey="don-dat"
          actions={(r) => (
            <Button
              data-tour="orders-view"
              title="Mở đơn này để xem chi tiết các mặt hàng cần, đối chiếu tồn kho, lập / hủy lệnh xuất hoặc xóa đơn." variant="outline" size="sm" onClick={() => setSelectedId(r.id)}>
              Xem
            </Button>
          )}
        />
      )}
      </div>

      {/* Chi tiết đơn được chọn */}
      {selectedOrder && (
        <div className="space-y-4 rounded-xl border-2 border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xl font-semibold text-foreground">
                {tenKH(selectedOrder.customerId)}
              </p>
              <p className="text-base text-muted-foreground">
                Đặt {formatDateVN(selectedOrder.orderDate)} · {STATUS_LABELS[selectedOrder.status]}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              {selectedOrder.status !== "closed" && (
                <div data-tour="orders-detail-actions" className="flex min-w-0 flex-wrap gap-2">
                  {allowed.update && selectedOrder.status === "collecting" && (
                  <Button
                    title="Đánh dấu đơn này đã gom đủ hàng — chuyển trạng thái, chưa xuất kho." variant="outline" onClick={() => confirmFulfilled(selectedOrder)}>
                    <PackageCheck />
                    Xác nhận đủ
                  </Button>
                  )}
                  {allowed.update && canReopenOrder(selectedOrder) && (
                  <Button
                    title="Bấm nhầm Xác nhận đủ? Đưa đơn về Đang gom. Không đụng tồn kho; vẫn còn nút Hoàn tác."
                    variant="edit"
                    onClick={() => reopenOrder(selectedOrder)}
                  >
                    <Undo2 />
                    Mở lại đơn
                  </Button>
                  )}
                  {/* Lệnh xuất TRỪ TỒN KHO + đẻ phiếu ở sổ Bán hàng — chạm hai
                      sổ cùng lúc. Phải hỏi lại; gỡ bằng Hủy lệnh xuất ở danh sách lệnh. */}
                  {allowed.create && (
                  <ConfirmAction
                    title="Xuất hàng cho đơn này?"
                    description="Sẽ trừ tồn kho dự trữ theo FIFO và tạo một phiếu bán (kênh Xuất khẩu) ở sổ Bán hàng. Làm nhầm thì bấm Hủy lệnh xuất ở mục Lệnh xuất đã lập: tồn trả về đúng lô, phiếu bán đi kèm được gỡ."
                    detail={`${tenKH(selectedOrder.customerId)} · đặt ${formatDateVN(selectedOrder.orderDate)} · ${selectedOrderItems.length} dòng hàng`}
                    confirmLabel="Xuất hàng"
                    icon={Truck}
                    onConfirm={() => createExportOrder(selectedOrder)}
                    trigger={
                      <Button
                        className="h-auto min-h-10 max-w-full shrink whitespace-normal text-left"
                        title="Tạo lệnh xuất lấy hàng theo FIFO từ tồn kho dự trữ, lấy được tới đâu xuất tới đó.">
                        <Truck />
                        Lệnh xuất (một phần được)
                      </Button>
                    }
                  />
                  )}
                </div>
              )}
              {allowed.delete && (
              <Button
                data-tour="orders-delete"
                title="Xóa đơn đặt này. Có hỏi xác nhận trước, xóa xong vẫn Hoàn tác được. Đơn còn lệnh xuất thì phải Hủy lệnh xuất trước."
                variant="danger"
                onClick={() => requestDeleteOrder(selectedOrder)}
              >
                <Trash2 />
                Xóa đơn
              </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedId(null)}>
                Đóng
              </Button>
            </div>
          </div>

          <ul data-tour="orders-detail-lines" className="divide-y divide-border">
            {selectedOrderItems.map((dc) => {
              const exportedQty = exportedKg(selectedOrder.id, dc.productId, dc.spec);
              const kd = stock
                .filter(
                  (t) => t.productId === dc.productId && t.spec === dc.spec
                )
                .reduce((s, t) => s + Math.max(0, t.remainingKg), 0);
              const remainingKg = dc.requiredQuantityKg - exportedQty;
              const isComplete = remainingKg <= 0.001;
              return (
                <li
                  key={dc.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0 flex-1 text-base">
                    {productNameOf(dc.productId)}
                    {dc.spec ? ` · ${dc.spec}` : ""}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-base">
                    <span className="text-muted-foreground">
                      Cần <span className="tnum font-semibold text-foreground">{num(dc.requiredQuantityKg)}</span> kg
                    </span>
                    <span className="text-muted-foreground">
                      Đã xuất <span className="tnum">{num(exportedQty)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Khả dụng <span className="tnum">{num(kd)}</span>
                    </span>
                    {isComplete ? (
                      <Tag variant="done">Đủ</Tag>
                    ) : (
                      <Tag variant="warning">Còn thiếu {num(remainingKg)} kg</Tag>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Lệnh xuất đã lập của đơn — kiểm lô bằng quét tem khi xếp container. */}
          {(() => {
            const exportOrderList = exportOrders
              .filter((l) => l.orderId === selectedOrder.id)
              .sort((a, b) => b.exportDate.localeCompare(a.exportDate));
            if (!exportOrderList.length) return null;
            return (
              <div data-tour="orders-export-list" className="space-y-2 border-t-2 border-border pt-4">
                <p className="font-semibold text-foreground">Lệnh xuất đã lập</p>
                <ul className="divide-y divide-border">
                  {exportOrderList.map((l) => {
                    const items = exportItems.filter((d) => d.exportId === l.id);
                    const lotCount = new Set(items.map((d) => d.wipId)).size;
                    if (isCancelledExport(l)) {
                      return (
                        <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                          <span className="min-w-0 text-base text-muted-foreground">
                            {formatDateVN(l.exportDate)} · {l.note || "Đã hủy"}
                          </span>
                          <Tag variant="muted">Đã hủy</Tag>
                        </li>
                      );
                    }
                    return (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                        <span className="min-w-0 text-base">
                          {formatDateVN(l.exportDate)} ·{" "}
                          <span className="tnum font-semibold">{kg(items.reduce((t, d) => t + (d.quantityKg || 0), 0))}</span>
                          <span className="text-muted-foreground"> · {lotCount} lô</span>
                        </span>
                        <div className="flex flex-wrap gap-2">
                        {allowed.update && (
                        <Button
                          title="Quét tem từng block khi xếp container: đúng lô của lệnh thì đánh dấu, sai lô thì báo ngay."
                          variant="outline"
                          size="sm"
                          onClick={() => setLotCheckOrder(l)}
                        >
                          <ScanLine />
                          Kiểm lô bằng quét
                        </Button>
                        )}
                        {canCancelExport && (
                        <Button
                          data-tour="orders-export-cancel"
                          title="Lập nhầm lệnh xuất? Hủy để trả tồn về đúng lô và gỡ phiếu bán Xuất khẩu đi kèm. Có hỏi lý do, xong vẫn Hoàn tác được."
                          variant="danger"
                          size="sm"
                          onClick={() => openCancelExport(l)}
                        >
                          <Ban />
                          Hủy lệnh xuất
                        </Button>
                        )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}
        </div>
      )}

      {lotCheckOrder && allowed.update && (
        <ExportLotCheck
          exportOrder={lotCheckOrder}
          orderItems={exportItems.filter((d) => d.exportId === lotCheckOrder.id)}
          allOrderItems={exportItems}
          onSaveOrderItems={persistExportItems}
          lotStock={stock}
          wips={wips}
          products={products}
          onClose={() => setLotCheckOrder(null)}
        />
      )}

      {/* Hủy lệnh xuất — hỏi lý do, nói rõ gỡ những gì */}
      <Dialog open={cancelling !== null} onOpenChange={(o) => !o && cancelDraft.dismiss()}>
        <DialogContent className="w-full sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Hủy lệnh xuất này?</DialogTitle>
            <DialogDescription className="text-base">
              Tồn kho dự trữ trả về đúng các lô lệnh đã lấy, phiếu bán Xuất khẩu đẻ từ lệnh bị gỡ khỏi sổ Bán hàng. Đầu lệnh vẫn
              giữ trong danh sách với nhãn Đã hủy và lý do. Hủy xong vẫn Hoàn tác được trong vài giây.
            </DialogDescription>
          </DialogHeader>
          <DraftRestoredNotice savedAt={cancelDraft.restoredAt} onDiscard={cancelDraft.cancel} />
          {cancelling && cancelCheck && (
            <div className="space-y-4 py-2">
              <ErrorSummary errors={cancelErrors} />
              {cancelCheck.ok ? (
                <ul className="space-y-1 rounded-lg bg-muted px-4 py-3 text-base">
                  <li>
                    Lệnh {formatDateVN(cancelCheck.preview.exportOrder.exportDate)} · {tenKH(cancelCheck.preview.order.customerId)}
                  </li>
                  <li>
                    Trả về kho <span className="tnum font-semibold">{kg(cancelCheck.preview.totalKg)}</span> ·{" "}
                    <span className="tnum">{cancelCheck.preview.lotCount}</span> lô
                  </li>
                  <li>
                    {cancelCheck.preview.invoice
                      ? `Gỡ phiếu bán ${formatDateVN(cancelCheck.preview.invoice.deliveryDate)} — ${cancelCheck.preview.invoiceLines.length} dòng`
                      : "Không thấy phiếu bán đi kèm (có thể đã xóa ở Bán hàng) — chỉ trả tồn"}
                  </li>
                  {cancelCheck.preview.pricedLineCount > 0 && (
                    <li className="text-warning">
                      {cancelCheck.preview.pricedLineCount} dòng bán đã ghi giá — giá mất theo phiếu (Hoàn tác vẫn trả lại)
                    </li>
                  )}
                  {cancelCheck.preview.checkCount > 0 && (
                    <li>Bỏ {cancelCheck.preview.checkCount} dấu đã quét kiểm lô của lệnh</li>
                  )}
                </ul>
              ) : (
                <p className="rounded-lg bg-warning-surface px-4 py-3 text-base text-warning">{cancelCheck.reason}</p>
              )}
              <Field label="Lý do hủy" required>
                <Input
                  value={cancelling.reason}
                  onChange={(e) => setCancelling((c) => (c ? { ...c, reason: e.target.value } : c))}
                  placeholder="VD xuất nhầm đơn, nhầm ngày"
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={cancelDraft.cancel}>
              Quay lại
            </Button>
            <Button
              variant="destructive"
              size="lg"
              title="Hủy lệnh xuất: trả tồn về lô, gỡ phiếu bán đi kèm, ghi lý do vào lệnh."
              onClick={confirmCancelExport}
            >
              <Ban />
              Hủy lệnh xuất
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={deletingOrder !== null}
        onOpenChange={(o) => !o && setDeletingOrder(null)}
        title="Xóa đơn đặt này?"
        confirmLabel="Xóa đơn"
        recordDescription={
          deletingOrder
            ? `${tenKH(deletingOrder.customerId)} — đặt ${formatDateVN(deletingOrder.orderDate)} — ${orderItems.filter((x) => x.orderId === deletingOrder.id).length} dòng hàng`
            : ""
        }
        onConfirm={() => {
          if (deletingOrder) deleteOrder(deletingOrder);
          setDeletingOrder(null);
        }}
      />

      {/* Dialog tạo đơn */}
      <Dialog
        open={creating !== null}
        onOpenChange={(o) => {
          // Đóng ngang ⇒ giữ đơn đang gõ làm nháp (quy tắc 17).
          if (!o) {
            setKeptCreating(creating);
            setCreating(null);
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] w-full overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tạo đơn đặt</DialogTitle>
            <DialogDescription className="text-base">
              Khách và các mặt hàng cần (mặt hàng · quy cách · kg · block).
            </DialogDescription>
          </DialogHeader>
          <DraftRestoredNotice savedAt={orderDraft.restoredAt} onDiscard={cancelCreate} />
          {creating && (
            <div className="space-y-6 py-2">
              <ErrorSummary errors={errors} />
              <RequiredLegend />
              <Combobox
                label="Khách hàng"
                required
                value={creating.customerId}
                onChange={(v) => setCreating((t) => (t ? { ...t, customerId: v } : t))}
                options={customerOptions}
                onCreate={customerEditor.canCreate ? addCustomer : undefined}
                onEditItem={customerEditor.openEdit}
                canEdit={customerEditor.canEdit}
                editLabel={customerEditor.editLabel}
                emptyText="Chưa có khách nào — gõ tên rồi bấm Thêm mới."
              />
              <div className="space-y-4">
                <p className="text-base font-semibold">Mặt hàng cần</p>
                {creating.rows.map((dc, i) => (
                  <div
                    key={i}
                    className="space-y-4 rounded-xl border-2 border-border p-4"
                  >
                    <Combobox
                      label="Thành phẩm"
                      required
                      value={dc.productId}
                      onChange={(v) => updateRow(i, { productId: v })}
                      options={productOptions}
                      onEditItem={productEditor.openEdit}
                      canEdit={productEditor.canEdit}
                      editLabel={productEditor.editLabel}
                      onCreate={productEditor.canCreate ? addProduct : undefined}
                    />
                    <Field
                      label="Quy cách"
                      hint="Size/quy cách phải khớp hàng trong kho (VD 18-20). Để trống nếu không tách size."
                    >
                      <Input
                        value={dc.spec}
                        onChange={(e) => updateRow(i, { spec: e.target.value })}
                        placeholder="VD 18-20"
                      />
                    </Field>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <NumberField
                        label="Khối lượng cần"
                        required
                        unit="kg"
                        value={dc.requiredQuantityKg || null}
                        onChange={(v) => updateRow(i, { requiredQuantityKg: v ?? 0 })}
                      />
                      <NumberField
                        label="Block cần"
                        unit="block"
                        value={dc.requiredBlocksCount || null}
                        onChange={(v) => updateRow(i, { requiredBlocksCount: v ?? 0 })}
                      />
                    </div>
                    {creating.rows.length > 1 && (
                      <Button
                        title="Bỏ dòng mặt hàng này khỏi đơn đang tạo."
                        variant="danger"
                        onClick={() =>
                          setCreating((t) =>
                            t ? { ...t, rows: t.rows.filter((_, j) => j !== i) } : t
                          )
                        }
                      >
                        Bỏ dòng này
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  title="Thêm một mặt hàng nữa mà khách đặt trong đơn này."
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() =>
                    setCreating((t) =>
                      t
                        ? {
                            ...t,
                            rows: [
                              ...t.rows,
                              { productId: "", spec: "", requiredQuantityKg: 0, requiredBlocksCount: 0 },
                            ],
                          }
                        : t
                    )
                  }
                >
                  <Plus />
                  Thêm mặt hàng cần
                </Button>
              </div>
              <Field label="Ghi chú">
                <Input
                  value={creating.note}
                  onChange={(e) =>
                    setCreating((t) => (t ? { ...t, note: e.target.value } : t))
                  }
                  placeholder="Ghi chú đơn (nếu có)"
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={cancelCreate}>
              Hủy
            </Button>
            <Button variant="save"
              title="Ghi đơn đặt này vào sổ." size="lg" onClick={saveCreate}>
              Tạo đơn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {customerEditor.dialog}
      {productEditor.dialog}
    </div>
  );
}
