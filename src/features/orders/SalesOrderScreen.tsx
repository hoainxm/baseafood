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
} from "@/lib/catalogRepo";
import { listLotsWithStock, computeWipStock, collectWipDeductions } from "@/lib/inventory";
import {
  ChuThichBatBuoc,
  Button,
  Combobox,
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
  ThongKe,
  XacNhan,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { useSuaDanhMuc } from "@/features/catalog/SuaDanhMucNhanh";
import { kg, num, todayISO, formatDateVN } from "@/lib/format";
import { CheckCircle, ClipboardList, Package, PackageCheck, Plus, ScanLine, Truck } from "lucide-react";
import { KiemLoXuat } from "./KiemLoXuat";

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
  dong: NewWeighRow[];
}

const STATUS_LABELS: Record<SalesOrder["status"], string> = {
  "dang-gom": "Đang gom",
  du: "Đủ",
  dong: "Đã xuất",
};

export default function DonDatScreen() {
  const [don, persistDon, { trangThai }] = useSalesOrders();
  const isLoading = trangThai === "dang-tai" && don.length === 0;
  const [dongDon, persistDongDon] = useOrderItems();
  const [exportOrders, persistExportOrders] = useExportOrders();
  const [exportItems, persistExportItems] = useExportItems();
  const [wips] = useWipProductions();
  const [products, setProducts] = useProducts();
  const [customers, setCustomers] = useCustomers();
  /** Bút chì sửa nhanh danh mục ngay trong ô chọn. */
  const customerEditor = useSuaDanhMuc("khachHang", customers, setCustomers);
  const productEditor = useSuaDanhMuc("matHang", products, setProducts);
  const [salesInvoices, persistSalesInvoices] = useSalesInvoices();
  const [salesItems, persistBan] = useSalesItems();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState<NewOrder | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);
  const [lotCheckOrder, setLotCheckOrder] = useState<ExportOrder | null>(null);

  // Link từ /qr "Theo giai đoạn" (`?don=<id>&kiem=<id lệnh xuất>`) ⇒ mở đơn và hộp kiểm
  // lô của lệnh đó. Chờ dữ liệu nạp xong mới xử lý, xong gỡ tham số khỏi link.
  const [searchParams, setSearchParams] = useSearchParams();
  const donUrl = searchParams.get("don");
  const checkParam = searchParams.get("kiem");
  useEffect(() => {
    if (!donUrl || !don.some((d) => d.id === donUrl)) return;
    setSelectedId(donUrl);
    const l = checkParam ? exportOrders.find((x) => x.id === checkParam) : undefined;
    if (l) setLotCheckOrder(l);
    setSearchParams({}, { replace: true });
  }, [donUrl, checkParam, don, exportOrders, setSearchParams]);

  const tenMH = (id: string) => products.find((m) => m.id === id)?.name || "—";
  const tenKH = (id: string) => customers.find((k) => k.id === id)?.name || "—";

  const [packagings] = usePackagings();
  const [lotInputs] = useLotInputs();
  const [lotDispatches] = useLotDispatches();
  // Trừ đúng lô đã gắn (truy xuất QR) trước khi lập lệnh FIFO — lệnh không lấy lô đã đi.
  const retailSales = useMemo(
    () => collectWipDeductions(salesItems, packagings, lotInputs, lotDispatches),
    [salesItems, packagings, lotInputs, lotDispatches]
  );
  const stock = useMemo(() => computeWipStock(wips, exportItems, retailSales), [wips, exportItems, retailSales]);

  const productOptions: MucChon[] = products.map((m) => ({
    value: m.id,
    label: m.name,
    phu: m.code || undefined,
  }));
  const customerOptions: MucChon[] = customers.map((k) => ({
    value: k.id,
    label: k.name,
    phu: k.market || undefined,
  }));
  /** kg đã xuất cho (đơn × mặt hàng × quy cách) — gom dòng lệnh của lệnh thuộc đơn. */
  const exportedKg = (orderId: string, mh: string, qc: string) => {
    const orderExportIds = new Set(
      exportOrders.filter((l) => l.orderId === orderId).map((l) => l.id)
    );
    return exportItems
      .filter(
        (d) =>
          orderExportIds.has(d.exportId) && d.productId === mh && d.spec === qc
      )
      .reduce((s, d) => s + (d.quantityKg || 0), 0);
  };

  const selectedOrder = selectedId ? don.find((d) => d.id === selectedId) : undefined;
  const selectedOrderItems = useMemo(
    () => (selectedId ? dongDon.filter((d) => d.orderId === selectedId) : []),
    [dongDon, selectedId]
  );

  /* ---- Tạo đơn ---- */
  const openCreate = () => {
    setCreating({
      customerId: "",
      orderDate: todayISO(),
      note: "",
      dong: [{ productId: "", spec: "", requiredQuantityKg: 0, requiredBlocksCount: 0 }],
    });
    setLoi([]);
  };
  const addProduct = (ten: string) => {
    const sach = ten.trim();
    const co = products.find((m) => m.name.trim().toLowerCase() === sach.toLowerCase());
    if (co) return co.id; // trùng tên (không phân hoa thường) ⇒ dùng lại bản có sẵn
    const m = { id: newId(), code: "", name: sach, finishedGoodCode: "" };
    setProducts([...products, m]);
    notify.daLuu(`Đã thêm mặt hàng "${sach}" vào danh mục`);
    return m.id;
  };
  const addCustomer = (ten: string) => {
    const sach = ten.trim();
    const co = customers.find((k) => k.name.trim().toLowerCase() === sach.toLowerCase());
    if (co) return co.id; // trùng tên (không phân hoa thường) ⇒ dùng lại bản có sẵn
    const k = { id: newId(), code: "", name: sach, market: "" };
    setCustomers([...customers, k]);
    notify.daLuu(`Đã thêm khách hàng "${sach}" vào danh mục`);
    return k.id;
  };
  const updateRow = (i: number, patch: Partial<NewWeighRow>) =>
    setCreating((t) =>
      t
        ? { ...t, dong: t.dong.map((d, j) => (j === i ? { ...d, ...patch } : d)) }
        : t
    );

  const saveCreate = () => {
    if (!creating) return;
    const ls: LoiNhap[] = [];
    if (!creating.customerId) ls.push({ truong: "Khách", thongBao: "Chưa chọn khách" });
    const validRows = creating.dong.filter((d) => d.productId && d.requiredQuantityKg > 0);
    if (validRows.length === 0)
      ls.push({ truong: "Dòng cần", thongBao: "Thêm ít nhất 1 mặt hàng cần" });
    setLoi(ls);
    if (ls.length > 0) return;
    const donId = newId();
    const newOrder: SalesOrder = {
      id: donId,
      customerId: creating.customerId,
      orderDate: creating.orderDate,
      status: "dang-gom",
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
    persistDongDon([...dongDon, ...newOrderItems]);
    notify.daLuu(`Đã tạo đơn cho ${tenKH(creating.customerId)}`);
    setCreating(null);
    setSelectedId(donId);
  };

  /* ---- Tạo lệnh xuất (FIFO, cho xuất một phần) + handoff sổ Bán hàng ---- */
  const createExportOrder = (d: SalesOrder) => {
    const dsDong = dongDon.filter((x) => x.orderId === d.id);
    const currentStock = computeWipStock(wips, exportItems, retailSales);
    const exportOrderId = newId();
    const newExportItems: ExportItem[] = [];
    for (const dc of dsDong) {
      let conCan = dc.requiredQuantityKg - exportedKg(d.id, dc.productId, dc.spec);
      if (conCan <= 0) continue;
      const los = listLotsWithStock(currentStock, dc.productId, dc.spec);
      for (const lo of los) {
        if (conCan <= 0) break;
        const lay = Math.min(conCan, lo.conLai);
        if (lay <= 0) continue;
        const tyLe = lo.conLai > 0 ? lay / lo.conLai : 0;
        newExportItems.push({
          id: newId(),
          exportId: exportOrderId,
          wipId: lo.wipId,
          productId: dc.productId,
          spec: dc.spec,
          quantityKg: lay,
          blocksCount: Math.round(lo.blockConLai * tyLe),
        });
        lo.conLai -= lay; // trừ tồn trong bộ nhớ để lô sau tính đúng
        conCan -= lay;
      }
    }
    if (newExportItems.length === 0) {
      notify.canhBao("Chưa có tồn khả dụng để xuất cho đơn này");
      return;
    }
    const newExportOrder: ExportOrder = {
      id: exportOrderId,
      orderId: d.id,
      exportDate: todayISO(),
      status: "dong",
      note: "",
    };
    // Handoff sổ Bán hàng: 1 phiếu bán (kênh Xuất khẩu), mỗi dòng lệnh = 1 dòng bán.
    const salesInvoiceId = newId();
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
    const newSalesItems: SalesItem[] = newExportItems.map((dl) => ({
      id: newId(),
      invoiceId: salesInvoiceId,
      deliveryDate: todayISO(),
      productId: dl.productId,
      spec: dl.spec,
      quantityKg: dl.quantityKg,
      unitPrice: null,
      sourceWarehouse: "Đơn đặt", // đánh dấu handoff — NXT/tồn kho không đếm hai lần
    }));

    persistExportItems([...exportItems, ...newExportItems]);
    persistExportOrders([...exportOrders, newExportOrder]);
    persistSalesInvoices([...salesInvoices, salesInvoice]);
    persistBan([...salesItems, ...newSalesItems]);

    // Cập nhật trạng thái đơn: đủ hết → "dong", còn thiếu → "dang-gom".
    const conThieu = dsDong.some(
      (dc) =>
        dc.requiredQuantityKg -
          (exportedKg(d.id, dc.productId, dc.spec) +
            newExportItems
              .filter(
                (dl) => dl.productId === dc.productId && dl.spec === dc.spec
              )
              .reduce((s, dl) => s + dl.quantityKg, 0)) >
        0.001
    );
    persistDon(
      don.map((x) =>
        x.id === d.id ? { ...x, status: conThieu ? "dang-gom" : "dong" } : x
      )
    );
    const totalOut = newExportItems.reduce((s, dl) => s + dl.quantityKg, 0);
    notify.daLuu(
      `Đã xuất ${kg(totalOut)} → sổ Bán hàng (phiếu ${tenKH(d.customerId)})` +
        (conThieu ? " · đơn còn thiếu, vẫn mở" : " · đơn đóng")
    );
  };

  const confirmFulfilled = (d: SalesOrder) => {
    persistDon(don.map((x) => (x.id === d.id ? { ...x, status: "du" } : x)));
    notify.daLuu("Đã đánh dấu đơn đủ — bấm Lệnh xuất để xuất container");
  };

  const deleteOrder = (d: SalesOrder) => {
    const prevOrders = don;
    const prevRows = dongDon;
    persistDon(don.filter((x) => x.id !== d.id));
    persistDongDon(dongDon.filter((x) => x.orderId !== d.id));
    if (selectedId === d.id) setSelectedId(null);
    notify.daXoa(`Đã xóa đơn ${tenKH(d.customerId)}`, () => {
      persistDon(prevOrders);
      persistDongDon(prevRows);
    });
  };

  const colsDon: Cot<SalesOrder>[] = [
    { key: "kh", header: "Khách", chinh: true, render: (r) => tenKH(r.customerId), sapXep: (r) => tenKH(r.customerId) },
    { key: "ngay", header: "Ngày đặt", render: (r) => formatDateVN(r.orderDate), sapXep: (r) => r.orderDate },
    {
      key: "sd",
      header: "Số dòng",
      so: true,
      render: (r) => num(dongDon.filter((d) => d.orderId === r.id).length),
    },
    {
      key: "tt",
      header: "Trạng thái",
      render: (r) => (
        <Nhan loai={r.status === "dang-gom" ? "cho" : "xong"}>{STATUS_LABELS[r.status]}</Nhan>
      ),
      sapXep: (r) => r.status,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Đơn đặt &amp; lệnh xuất
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            title="Tạo một đơn đặt hàng xuất khẩu: khách, hạn giao, và các mặt hàng cần bao nhiêu kg." size="lg" onClick={openCreate}>
            <Plus />
            Tạo đơn
          </Button>
        </div>
      </div>

      <ThongKe
        className="grid-cols-1 sm:grid-cols-3"
        the={[
          { nhan: "Tổng số đơn", giaTri: don.length, so: true, icon: ClipboardList, mau: "trung-tinh" },
          { nhan: "Đang gom hàng", giaTri: don.filter((d) => d.status === "dang-gom").length, so: true, icon: Package, mau: "brand" },
          { nhan: "Đã xuất xong", giaTri: don.filter((d) => d.status === "dong").length, so: true, icon: CheckCircle, mau: "success" },
        ]}
      />

      {isLoading ? (
        <SkeletonBang />
      ) : don.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          tieuDe="Chưa có đơn đặt nào"
          moTa="Bấm Tạo đơn để khai đơn khách đặt (mặt hàng, quy cách, số lượng cần)."
          action={
            <Button
              title="Tạo đơn đặt đầu tiên." size="lg" onClick={openCreate}>
              <Plus />
              Tạo đơn
            </Button>
          }
        />
      ) : (
        <RecordTable
          columns={colsDon}
          rows={don}
          getKey={(r) => r.id}
          toMau="don-dat"
          timKiem={(r) => tenKH(r.customerId)}
          nhanTimKiem="Tìm theo khách…"
          actions={(r) => (
            <div className="flex flex-wrap gap-2">
              <Button
                title="Mở đơn này để xem chi tiết các mặt hàng cần và đối chiếu với tồn kho hiện có." variant="outline" size="sm" onClick={() => setSelectedId(r.id)}>
                Xem
              </Button>
              <Button
                title="Xóa đơn đặt này. Có hỏi xác nhận trước." variant="outline" size="sm" onClick={() => deleteOrder(r)}>
                Bỏ
              </Button>
            </div>
          )}
        />
      )}

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
              {selectedOrder.status !== "dong" && (
                <>
                  <Button
                    title="Đánh dấu đơn này đã gom đủ hàng — chuyển trạng thái, chưa xuất kho." variant="outline" onClick={() => confirmFulfilled(selectedOrder)}>
                    <PackageCheck />
                    Xác nhận đủ
                  </Button>
                  {/* Lệnh xuất TRỪ TỒN KHO + đẻ phiếu ở sổ Bán hàng — chạm hai
                      sổ cùng lúc, không có nút hoàn tác. Phải hỏi lại. */}
                  <XacNhan
                    tieuDe="Xuất hàng cho đơn này?"
                    moTa="Sẽ trừ tồn kho dự trữ theo FIFO và tạo một phiếu bán (kênh Xuất khẩu) ở sổ Bán hàng. Không hoàn tác được — sai thì phải sửa tay ở cả hai sổ."
                    chiTiet={`${tenKH(selectedOrder.customerId)} · đặt ${formatDateVN(selectedOrder.orderDate)} · ${selectedOrderItems.length} dòng hàng`}
                    nhanNut="Xuất hàng"
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
                </>
              )}
              <Button variant="outline" onClick={() => setSelectedId(null)}>
                Đóng
              </Button>
            </div>
          </div>

          <ul className="divide-y divide-border">
            {selectedOrderItems.map((dc) => {
              const exportedQty = exportedKg(selectedOrder.id, dc.productId, dc.spec);
              const kd = stock
                .filter(
                  (t) => t.productId === dc.productId && t.spec === dc.spec
                )
                .reduce((s, t) => s + Math.max(0, t.conLai), 0);
              const con = dc.requiredQuantityKg - exportedQty;
              const du = con <= 0.001;
              return (
                <li
                  key={dc.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0 flex-1 text-base">
                    {tenMH(dc.productId)}
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
                    {du ? (
                      <Nhan loai="xong">Đủ</Nhan>
                    ) : (
                      <Nhan loai="luu-y">Còn thiếu {num(con)} kg</Nhan>
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
              <div className="space-y-2 border-t-2 border-border pt-4">
                <p className="font-semibold text-foreground">Lệnh xuất đã lập</p>
                <ul className="divide-y divide-border">
                  {exportOrderList.map((l) => {
                    const ds = exportItems.filter((d) => d.exportId === l.id);
                    const lotCount = new Set(ds.map((d) => d.wipId)).size;
                    return (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                        <span className="min-w-0 text-base">
                          {formatDateVN(l.exportDate)} ·{" "}
                          <span className="tnum font-semibold">{kg(ds.reduce((t, d) => t + (d.quantityKg || 0), 0))}</span>
                          <span className="text-muted-foreground"> · {lotCount} lô</span>
                        </span>
                        <Button
                          title="Quét tem từng block khi xếp container: đúng lô của lệnh thì đánh dấu, sai lô thì báo ngay."
                          variant="outline"
                          size="sm"
                          onClick={() => setLotCheckOrder(l)}
                        >
                          <ScanLine />
                          Kiểm lô bằng quét
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}
        </div>
      )}

      {lotCheckOrder && (
        <KiemLoXuat
          lenh={lotCheckOrder}
          dongLenh={exportItems.filter((d) => d.exportId === lotCheckOrder.id)}
          tatCaDongLenh={exportItems}
          onLuuDongLenh={persistExportItems}
          ton={stock}
          sanXuat={wips}
          matHang={products}
          onClose={() => setLotCheckOrder(null)}
        />
      )}

      {/* Dialog tạo đơn */}
      <Dialog open={creating !== null} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent className="max-h-[92dvh] w-full overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tạo đơn đặt</DialogTitle>
            <DialogDescription className="text-base">
              Khách và các mặt hàng cần (mặt hàng · quy cách · kg · block).
            </DialogDescription>
          </DialogHeader>
          {creating && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />
              <ChuThichBatBuoc />
              <Combobox
                label="Khách hàng"
                required
                value={creating.customerId}
                onChange={(v) => setCreating((t) => (t ? { ...t, customerId: v } : t))}
                options={customerOptions}
                onCreate={addCustomer}
                onSuaMuc={customerEditor.moSua}
                nhanSua={customerEditor.nhanSua}
                emptyText="Chưa có khách nào — gõ tên rồi bấm Thêm mới."
              />
              <div className="space-y-4">
                <p className="text-base font-semibold">Mặt hàng cần</p>
                {creating.dong.map((dc, i) => (
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
                      onSuaMuc={productEditor.moSua}
                      nhanSua={productEditor.nhanSua}
                      onCreate={addProduct}
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
                    {creating.dong.length > 1 && (
                      <Button
                        title="Bỏ dòng mặt hàng này khỏi đơn đang tạo."
                        variant="outline"
                        onClick={() =>
                          setCreating((t) =>
                            t ? { ...t, dong: t.dong.filter((_, j) => j !== i) } : t
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
                            dong: [
                              ...t.dong,
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
            <Button variant="outline" size="lg" onClick={() => setCreating(null)}>
              Hủy
            </Button>
            <Button
              title="Ghi đơn đặt này vào sổ." size="lg" onClick={saveCreate}>
              Tạo đơn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {customerEditor.hop}
      {productEditor.hop}
    </div>
  );
}
