// ============================================================
// Tên file: src/features/production-orders/ProductionOrderScreen.tsx
// Tên tiếng Việt: Màn Phòng Kế hoạch · Lệnh sản xuất — danh sách theo tháng, hồ sơ lệnh, bản in
// Description: Production order screen (/planning-production): month list, order dossier, write dialogs
//              (create / edit / imported material / issue + link shipments / keep old revision / cancel),
//              A4 print. Every write has Undo. Recipients (view only) see issued orders only.
// ============================================================
// Oracle hành vi: docs/app-map/48-production-order.ba-spec.md · giao diện: 49-production-order-ui.design-spec.md.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, EmptyState, TableSkeleton, Tabs, TabsList, TabsTrigger, notify, todayIso } from "@/design-system";
import { useAuth } from "@/lib/auth";
import { useCan } from "@/features/shared/PermissionProvider";
import { usePageTour, usePageTourControl } from "@/features/shared/PageTourProvider";
import { ReasonDialog, type ReasonTarget } from "@/features/export-planning/RecordDialogs";
import { newId } from "@/lib/store";
import { cancelOrder, issueOrder, keepOldRevision, shipmentsWithLot, visibleOrders } from "@/lib/productionOrder";
import type { ProductionOrder, ProductionOrderMaterial, ProductionOrderShipment } from "@/types";
import { BarChart3, ClipboardList, FilePlus2, FolderLock, Route } from "lucide-react";
import { parseReportPeriod, type ReportPeriod } from "@/lib/exportReports";
import { buildOrderReport, buildOrderReportExcel } from "@/lib/productionOrderReports";
import { OrderReportView } from "./OrderReportView";
import { IssueDialog, MaterialDialog, OrderFormDialog, type IssueTarget, type MaterialTarget, type OrderFormTarget, type OrderSavePayload } from "./OrderDialogs";
import { OrderPrint } from "./OrderPrint";
import { OrderDossier, OrderListView } from "./OrderViews";
import { buildProductionOrderTour, pickTourOrder } from "./productionOrderTour";
import { useProductionOrderData, type ProductionOrderData } from "./useProductionOrderData";

/** Hai tab luôn nằm cạnh nhau, chữ được xuống dòng (khuôn Xuất khẩu / Nhập khẩu). */
const TAB_TRIGGER = "h-auto min-h-9 whitespace-normal px-3 max-sm:[&>svg]:hidden sm:whitespace-nowrap sm:px-4";

export default function ProductionOrderScreen() {
  const today = todayIso();
  const { profile } = useAuth();
  const by = profile?.fullName || profile?.username || "Máy này";
  const can = useCan("production-orders");
  const store = useProductionOrderData();
  const d = store.data;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const canWrite = (can.create || can.update) && store.isAvailable;
  const isRecipient = !can.create && !can.update;
  const orders = useMemo(() => visibleOrders(d.orders, !isRecipient), [d.orders, isRecipient]);

  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? (params.get("month") as string) : today.slice(0, 7);
  // Tab Báo cáo (ba-spec 50 RP2): `?view=reports&report=<kỳ>`, mặc định tháng hiện tại.
  const view = params.get("view") === "reports" ? "reports" : "orders";
  const reportPeriod = parseReportPeriod(params.get("report"), today, "month");
  const orderId = params.get("order") ?? "";
  const printing = params.get("print") === "1";
  const setParam = (patch: Record<string, string>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace });
  };
  const setParamRef = useRef(setParam);
  useEffect(() => {
    setParamRef.current = setParam;
  });

  const [formTarget, setFormTarget] = useState<OrderFormTarget | null>(null);
  const [materialTarget, setMaterialTarget] = useState<MaterialTarget | null>(null);
  const [issueTarget, setIssueTarget] = useState<IssueTarget | null>(null);
  const [reason, setReason] = useState<ReasonTarget | null>(null);

  // Mở từ Xuất khẩu (bước 2 của chuyến / dòng hàng HĐ): `?new=1&contract=…&shipment=…` ⇒ mở hộp lập lệnh chọn sẵn.
  const newContract = params.get("new") === "1" ? (params.get("contract") ?? "") : null;
  const newShipment = params.get("shipment") ?? "";
  const [handledNew, setHandledNew] = useState("");
  const newKey = newContract === null ? "" : `${newContract}|${newShipment}`;
  if (newKey && canWrite && handledNew !== newKey) {
    setHandledNew(newKey);
    setFormTarget({ mode: "create", contractId: newContract ?? "", shipmentId: newShipment });
  }
  useEffect(() => {
    if (newKey && handledNew === newKey) setParamRef.current({ new: "", contract: "", shipment: "" }, true);
  }, [newKey, handledNew]);

  const order = orderId ? orders.find((o) => o.id === orderId) : undefined;

  // Ref giữ bản MỚI NHẤT — Hoàn tác chạy từ toast cũ, hai lượt ghi cùng lúc không đè nhau.
  const dataRef = useRef<ProductionOrderData>(d);
  useEffect(() => {
    dataRef.current = d;
  }, [d]);
  const upsert = <T extends { id: string }>(rows: readonly T[], row: T) => (rows.some((x) => x.id === row.id) ? rows.map((x) => (x.id === row.id ? row : x)) : [...rows, row]);

  /* ---------- Ghi (mọi lượt ghi có Hoàn tác — luật 6 / 13) ---------- */

  const saveOrder = (p: OrderSavePayload): boolean => {
    const prev = dataRef.current;
    const order = p.isNew ? { ...p.order, createdBy: by } : p.order;
    if (!store.saveOrders(upsert(prev.orders, order))) return false;
    store.saveLines([...prev.lines.filter((l) => l.orderId !== order.id), ...p.lines]);
    // Dòng bị bỏ ⇒ bỏ NL dự kiến của dòng đó.
    const keep = new Set(p.lines.map((l) => l.id));
    const orphan = prev.materials.filter((m) => m.orderId === order.id && !keep.has(m.orderLineId));
    if (orphan.length) store.saveMaterials(prev.materials.filter((m) => !orphan.includes(m)));
    const undo = () => {
      store.saveOrders(prev.orders);
      store.saveLines(prev.lines);
      store.saveMaterials(prev.materials);
    };
    notify.saved(
      p.isNew
        ? `Đã lập lệnh ${order.orderNo} (Nháp) — việc tiếp: gắn NL nhập khẩu, rồi Phát hành`
        : order.revisionNo > (prev.orders.find((o) => o.id === order.id)?.revisionNo ?? 0)
          ? `Đã lưu lần sửa ${order.revisionNo} của lệnh ${order.orderNo}${p.changes.length ? `: ${p.changes.join("; ")}` : ""}`
          : `Đã lưu lệnh ${order.orderNo}`,
      undo,
    );
    setFormTarget(null);
    if (p.isNew) {
      setParam({ order: order.id, month: "" });
      if (p.shipmentId) setIssueTarget({ order, mode: "issue", preselect: [p.shipmentId] });
    }
    return true;
  };

  const saveMaterials = (orderLineId: string, rows: ProductionOrderMaterial[]): boolean => {
    const prev = dataRef.current;
    if (!store.saveMaterials([...prev.materials.filter((m) => m.orderLineId !== orderLineId), ...rows])) return false;
    notify.saved(`Đã lưu NL nhập khẩu dự kiến (${rows.length} lần nhập)`, () => store.saveMaterials(prev.materials));
    setMaterialTarget(null);
    return true;
  };

  const saveIssue = (o: ProductionOrder, mode: "issue" | "link", shipmentIds: string[]): boolean => {
    const prev = dataRef.current;
    const next = mode === "issue" ? issueOrder(o, by, new Date().toISOString()) : o;
    if (mode === "issue" && !store.saveOrders(upsert(prev.orders, next))) return false;
    const kept = prev.links.filter((l) => l.orderId === o.id && shipmentIds.includes(l.shipmentId));
    const added: ProductionOrderShipment[] = shipmentIds
      .filter((sid) => !kept.some((l) => l.shipmentId === sid))
      .map((sid) => ({ id: newId(), orderId: o.id, shipmentId: sid, createdAt: new Date().toISOString() }));
    if (!store.saveLinks([...prev.links.filter((l) => l.orderId !== o.id), ...kept, ...added])) return false;
    // MSL của lệnh chép sang chuyến chưa có MSL (AC-9).
    const changed = shipmentsWithLot(next, prev.exportData.shipments.filter((s) => shipmentIds.includes(s.id)));
    if (changed.length) store.saveShipments(prev.exportData.shipments.map((s) => changed.find((c) => c.id === s.id) ?? s));
    notify.saved(
      mode === "issue" ? `Đã phát hành lệnh ${o.orderNo}${shipmentIds.length ? ` · gắn ${shipmentIds.length} chuyến` : ""}` : `Đã lưu chuyến gắn của lệnh ${o.orderNo}`,
      () => {
        store.saveOrders(prev.orders);
        store.saveLinks(prev.links);
        if (changed.length) store.saveShipments(prev.exportData.shipments);
      },
    );
    return true;
  };

  const saveStatus = (next: ProductionOrder, message: string) => {
    const prev = dataRef.current;
    if (!store.saveOrders(upsert(prev.orders, next))) return;
    notify.saved(message, () => store.saveOrders(prev.orders));
  };

  /* ---------- Báo cáo: xuất Excel (không toast — QT 13) ---------- */

  const exportReportExcel = async (p: ReportPeriod, customerName: string) => {
    const cur = dataRef.current;
    const report = buildOrderReport({ orders, lines: cur.lines, materials: cur.materials, links: cur.links, receiptLines: cur.receiptLines, exportData: cur.exportData }, p, { customerName, today });
    const aoa = buildOrderReportExcel(report, { periodLabel: p.label, customerName });
    const { exportAoaToXlsx } = await import("@/lib/reportXlsx"); // nạp động — xlsx không vào chunk chính
    exportAoaToXlsx({ sheetName: `Báo cáo LSX ${p.key}`, aoa, colWidths: [32, 14, 14, 12, 12, 12, 12, 14, 22], fileName: `bao-cao-lenh-san-xuat-${p.key}.xlsx` });
  };

  /* ---------- Hướng dẫn thao tác ---------- */

  const tourOrderId = pickTourOrder(orders);
  const tour = useMemo(
    () =>
      buildProductionOrderTour({
        orderId: tourOrderId,
        can: { write: canWrite },
        openOrder: (id) => setParamRef.current({ order: id, print: "" }),
        backToList: () => setParamRef.current({ order: "", print: "" }),
      }),
    [tourOrderId, canWrite],
  );
  usePageTour(can.view && !store.isLoading ? tour : null);
  const pageTour = usePageTourControl();

  if (!can.view) {
    return (
      <EmptyState
        icon={FolderLock}
        title="Chưa được cấp quyền Lệnh sản xuất"
        description="Hỏi quản trị viên cấp quyền Kế hoạch · Lệnh sản xuất (Phòng Kế hoạch ghi; quản đốc, thủ kho, ban giám đốc, kế toán xem)."
      />
    );
  }

  if (printing && order) return <OrderPrint order={order} allLines={d.lines} onClose={() => setParam({ print: "" })} />;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      {!store.isAvailable && (
        <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
          Máy chủ chưa có bảng Lệnh sản xuất (chưa chạy migration 0088) — chưa ghi được. Báo quản trị.
        </p>
      )}
      {order ? (
        <OrderDossier
          data={d}
          order={order}
          canWrite={canWrite}
          isRecipient={isRecipient}
          actions={{
            onBack: () => setParam({ order: "" }),
            onEdit: () => setFormTarget({ mode: "edit", order }),
            onIssue: () => setIssueTarget({ order, mode: "issue" }),
            onLinkShipments: () => setIssueTarget({ order, mode: "link" }),
            onKeepOld: () =>
              setReason({
                title: `Giữ lệnh ${order.orderNo} theo bản hợp đồng cũ?`,
                description: "Dòng lệnh không đổi. Cờ Theo bản HĐ trước hết cho tới khi hợp đồng có bản mới nữa.",
                confirmLabel: "Giữ nguyên",
                onConfirm: (why) => {
                  const res = keepOldRevision(order, d.exportData, why);
                  if (res.ok) saveStatus(res.order, `Đã giữ lệnh ${order.orderNo} theo bản cũ`);
                },
              }),
            onCancel: () =>
              setReason({
                title: `Hủy lệnh ${order.orderNo}?`,
                description: "Lệnh đã hủy không tính vào số đã ra lệnh; chuyến gắn kèm và NL đã dành được nhả. Dữ liệu vẫn giữ để tra.",
                confirmLabel: "Hủy lệnh",
                destructive: true,
                onConfirm: (why) => {
                  const res = cancelOrder(order, why);
                  if (res.ok) saveStatus(res.order, `Đã hủy lệnh ${order.orderNo}`);
                },
              }),
            onPrint: () => setParam({ print: "1" }),
            onMaterials: (lineId) => {
              const line = d.lines.find((l) => l.id === lineId);
              if (line) setMaterialTarget({ order, line });
            },
            onOpenContract: () => navigate(`/planning-export?contract=${encodeURIComponent(order.contractId)}`),
          }}
        />
      ) : orderId && !store.isLoading ? (
        <EmptyState
          icon={ClipboardList}
          title={isRecipient ? "Lệnh chưa phát hành hoặc không còn" : "Không thấy lệnh này"}
          description="Quay lại danh sách để chọn lệnh khác."
          action={
            <Button variant="outline" onClick={() => setParam({ order: "" })} title="Về danh sách lệnh sản xuất.">
              Quay lại
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid min-w-0 flex-1 basis-64 grid-cols-[minmax(0,1fr)] gap-3">
              <p className="max-w-3xl text-muted-foreground">Lệnh sản xuất ra từ dòng hàng hợp đồng xuất, gửi Ban quản đốc phân xưởng và Thủ kho.</p>
              <Tabs value={view} onValueChange={(v) => setParam({ view: v === "reports" ? v : "" }, true)}>
                <TabsList data-tour="order-tabs" className="grid w-full grid-cols-2 items-stretch group-data-horizontal/tabs:h-auto sm:inline-flex sm:w-fit">
                  <TabsTrigger value="orders" className={TAB_TRIGGER} title="Danh sách lệnh sản xuất theo tháng.">
                    <ClipboardList className="mr-2 h-4 w-4" aria-hidden />
                    Lệnh
                  </TabsTrigger>
                  <TabsTrigger value="reports" className={TAB_TRIGGER} title="Số lệnh sản xuất theo tháng / quý / năm: thùng, kg, khách, mặt hàng, NL nhập khẩu đã dành, lệnh cần chú ý.">
                    <BarChart3 className="mr-2 h-4 w-4" aria-hidden />
                    Báo cáo
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pageTour.available && (
                <Button variant="outline" data-tour-start onClick={pageTour.start} title="Mở hướng dẫn thao tác: lần lượt chỉ từng khu vực trên trang theo thứ tự công việc. Hướng dẫn không thay đổi dữ liệu.">
                  <Route className="mr-2 h-4 w-4" aria-hidden />
                  Hướng dẫn thao tác
                </Button>
              )}
              {canWrite && can.create && (
                <Button data-tour="create-production-order" onClick={() => setFormTarget({ mode: "create" })} title="Lập lệnh sản xuất mới từ dòng hàng hợp đồng xuất: số thùng, mã số lô, ngày sản xuất, ngày giao.">
                  <FilePlus2 className="mr-2 h-4 w-4" aria-hidden />
                  Lập lệnh sản xuất
                </Button>
              )}
            </div>
          </div>
          {store.isLoading ? (
            <TableSkeleton />
          ) : store.loadError ? (
            <EmptyState icon={ClipboardList} title="Chưa đọc được Lệnh sản xuất" description={`Lỗi đồng bộ với máy chủ: ${store.loadError}. Kiểm đèn kết nối rồi tải lại trang.`} />
          ) : view === "reports" ? (
            <OrderReportView
              data={d}
              orders={orders}
              period={reportPeriod}
              today={today}
              canExport={can.view}
              onPeriodChange={(p) => setParam({ report: p.key === today.slice(0, 7) ? "" : p.key }, true)}
              onOpenOrder={(id) => setParam({ order: id })}
              onExportExcel={(p, c) => void exportReportExcel(p, c)}
            />
          ) : (
            <OrderListView
              data={d}
              orders={orders}
              month={month}
              today={today}
              isRecipient={isRecipient}
              onMonthChange={(m) => setParam({ month: m === today.slice(0, 7) ? "" : m }, true)}
              onOpen={(id) => setParam({ order: id })}
            />
          )}
        </>
      )}

      <OrderFormDialog target={formTarget} data={d} today={today} onClose={() => setFormTarget(null)} onSave={saveOrder} />
      <MaterialDialog target={materialTarget} data={d} onClose={() => setMaterialTarget(null)} onSave={saveMaterials} />
      <IssueDialog target={issueTarget} data={d} onClose={() => setIssueTarget(null)} onSave={saveIssue} />
      <ReasonDialog target={reason} onClose={() => setReason(null)} />
    </div>
  );
}
