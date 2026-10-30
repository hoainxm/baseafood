// ============================================================
// Tên file: src/features/production-orders/OrderViews.tsx
// Tên tiếng Việt: Danh sách lệnh sản xuất theo tháng + hồ sơ một lệnh
// Description: Month list (filters, 3 stat cards, table) and order dossier (summary, lines, imported
//              material, linked shipments, requirements) of /planning-production (design-spec 49).
// ============================================================
import { useState } from "react";
import {
  Button,
  ChoiceGroup,
  Combobox,
  EmptyState,
  Field,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RecordTable,
  StatCardGrid,
  Tag,
  formatNumber,
  type RecordTableColumn,
  type TagVariant,
} from "@/design-system";
import { MonthNav } from "@/features/import-planning/ImportViews";
import { formatDateVN } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  STALE_REVISION_LABEL,
  contractLineCoverage,
  expiryDate,
  issuedShipmentIds,
  lineCartons,
  linesOfOrder,
  lotMismatch,
  orderLineKg,
  orderMonth,
  orderTotals,
  reservationOf,
  staleRevision,
} from "@/lib/productionOrder";
import { effectiveRevision } from "@/lib/exportPlanning";
import type { ExportShipment, ProductionOrder } from "@/types";
import { ArrowLeft, Ban, ChevronDown, ClipboardList, Eye, Link2, Pencil, Printer, Send, ShieldCheck, Wheat } from "lucide-react";
import { monthText, shipmentLabel } from "./orderText";
import type { ProductionOrderData } from "./useProductionOrderData";

const STATUS_TONE: Record<ProductionOrder["status"], TagVariant> = { draft: "pending", issued: "done", cancelled: "muted" };
const STATUS_RANK: Record<ProductionOrder["status"], number> = { draft: 0, issued: 1, cancelled: 2 };

export function OrderStatusTag({ order }: { order: ProductionOrder }) {
  return <Tag variant={STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Tag>;
}

const datesText = (ds: readonly string[]) => [...ds].sort().map((d) => formatDateVN(d).slice(0, 5)).join(", ");
const unitWord = (kind: "carton" | "bundle") => (kind === "bundle" ? "kiện" : "thùng");


type Filter = "live" | ProductionOrder["status"] | "all";
const FILTERS = [
  { value: "live", label: "Nháp + đã phát hành" },
  { value: "draft", label: ORDER_STATUS_LABELS.draft },
  { value: "issued", label: ORDER_STATUS_LABELS.issued },
  { value: "cancelled", label: ORDER_STATUS_LABELS.cancelled },
  { value: "all", label: "Tất cả" },
];

/* ---------- Danh sách theo tháng ---------- */

export function OrderListView({
  data,
  orders,
  month,
  today,
  isRecipient,
  onMonthChange,
  onOpen,
}: {
  data: ProductionOrderData;
  orders: readonly ProductionOrder[];
  month: string;
  today: string;
  /** Chỉ có quyền Xem (quản đốc, thủ kho…) — không cột HĐ, không lọc trạng thái. */
  isRecipient: boolean;
  onMonthChange: (m: string) => void;
  onOpen: (orderId: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("live");
  const [customer, setCustomer] = useState("");
  const [query, setQuery] = useState("");
  const linked = new Set(data.links.map((l) => l.orderId));
  const q = query.trim().toLowerCase();
  const searchText = (o: ProductionOrder) =>
    [o.orderNo, o.lotCode, o.contractNo, o.customerName, ...linesOfOrder(data.lines, o.id).map((l) => `${l.productName} ${l.description}`)].join(" ").toLowerCase();
  const inMonth = orders.filter((o) => orderMonth(o) === month);
  const rows = (q ? orders.filter((o) => searchText(o).includes(q)) : inMonth)
    .filter((o) => (filter === "all" ? true : filter === "live" ? o.status !== "cancelled" : o.status === filter))
    .filter((o) => !customer || o.customerName === customer)
    .sort((a, b) => orderMonth(a).localeCompare(orderMonth(b)) || (a.productionDates[0] ?? "").localeCompare(b.productionDates[0] ?? ""));

  const live = inMonth.filter((o) => o.status !== "cancelled");
  const drafts = live.filter((o) => o.status === "draft").length;
  const stale = live.filter((o) => staleRevision(o, data.exportData)).length;
  const unlinked = live.filter((o) => o.status === "issued" && !linked.has(o.id)).length;
  const customerOptions = [...new Set(orders.map((o) => o.customerName).filter(Boolean))].sort().map((c) => ({ value: c, label: c }));

  const columns: RecordTableColumn<ProductionOrder>[] = [
    { key: "no", header: "Số lệnh", primary: true, getSortValue: (o) => o.orderNo, render: (o) => <span className="font-semibold">{o.orderNo || "—"}</span> },
    { key: "date", header: "Ngày lệnh", sortKind: "date", getSortValue: (o) => o.orderDate, render: (o) => <span className="tnum">{formatDateVN(o.orderDate)}</span>, hideOnMobile: true },
    { key: "customer", header: "Khách", getSortValue: (o) => o.customerName, render: (o) => o.customerName || "—" },
    ...(isRecipient ? [] : [{ key: "contract", header: "HĐ", getSortValue: (o: ProductionOrder) => o.contractNo, render: (o: ProductionOrder) => o.contractNo || "—", hideOnMobile: true }]),
    {
      key: "goods",
      header: "Mặt hàng",
      getSortValue: (o) => linesOfOrder(data.lines, o.id)[0]?.productName ?? "",
      render: (o) => {
        const ls = linesOfOrder(data.lines, o.id);
        return (
          <span className="break-words">
            {ls[0]?.productName || ls[0]?.description || "—"}
            {ls.length > 1 && <span className="text-muted-foreground"> +{ls.length - 1} dòng</span>}
          </span>
        );
      },
    },
    { key: "cartons", header: "Thùng", numeric: true, sortKind: "number", getSortValue: (o) => orderTotals(linesOfOrder(data.lines, o.id)).cartons, render: (o) => formatNumber(orderTotals(linesOfOrder(data.lines, o.id)).cartons) },
    { key: "kg", header: "Kg", numeric: true, sortKind: "number", getSortValue: (o) => orderTotals(linesOfOrder(data.lines, o.id)).kg, render: (o) => formatNumber(orderTotals(linesOfOrder(data.lines, o.id)).kg) },
    { key: "lot", header: "MSL", getSortValue: (o) => o.lotCode, render: (o) => o.lotCode || "—" },
    { key: "prod", header: "Ngày SX", sortKind: "date", getSortValue: (o) => [...o.productionDates].sort()[0] ?? "", render: (o) => <span className="tnum">{datesText(o.productionDates) || "—"}</span> },
    { key: "delivery", header: "Ngày giao", sortKind: "date", getSortValue: (o) => o.deliveryDate, render: (o) => <span className="tnum">{formatDateVN(o.deliveryDate) || "—"}</span>, hideOnMobile: true },
    {
      key: "state",
      header: "Trạng thái",
      sortKind: "rank",
      getSortValue: (o) => STATUS_RANK[o.status],
      render: (o) => (
        <div className="flex min-w-32 flex-wrap gap-1 whitespace-normal">
          <OrderStatusTag order={o} />
          {o.revisionNo > 0 && <Tag variant="source">Đã sửa lần {o.revisionNo}</Tag>}
          {staleRevision(o, data.exportData) && <Tag variant="warning">{STALE_REVISION_LABEL}</Tag>}
          {!isRecipient && o.status === "issued" && !linked.has(o.id) && <Tag variant="muted">Chưa gắn chuyến</Tag>}
        </div>
      ),
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <MonthNav month={month} today={today} onChange={onMonthChange} />
        <div className="min-w-48 flex-1 basis-48">
          <Combobox label="Khách" hideRequiredMark value={customer} onChange={setCustomer} options={[{ value: "", label: "Mọi khách" }, ...customerOptions]} />
        </div>
        <div data-tour="order-search" className="min-w-56 flex-1 basis-56">
          <Field label="Tra số lệnh (số lệnh · MSL · số HĐ · tên hàng)">
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} title="Gõ một phần số — tra ở mọi tháng." />
          </Field>
        </div>
      </div>
      {!isRecipient && <ChoiceGroup label="Trạng thái" hideRequiredMark value={filter} onChange={(v) => setFilter(v as Filter)} options={FILTERS} columns={3} />}
      {!q && (
        <div data-tour="order-stats">
          <StatCardGrid
            columns={3}
            cards={[
              { label: "Lệnh của tháng", value: formatNumber(live.length), subtext: monthText(month), icon: ClipboardList },
              { label: "Đã phát hành", value: formatNumber(live.filter((o) => o.status === "issued").length), subtext: "đã gửi phân xưởng, thủ kho", color: "success" },
              {
                label: "Cần xử lý",
                value: formatNumber(drafts + stale + unlinked),
                subtext: `nháp ${drafts} · theo bản HĐ trước ${stale} · chưa gắn chuyến ${unlinked}`,
                color: drafts + stale + unlinked ? "warning" : undefined,
              },
            ]}
          />
        </div>
      )}
      {rows.length === 0 && !q ? (
        <EmptyState
          icon={ClipboardList}
          title={isRecipient ? `${monthText(month)} chưa có lệnh nào được phát hành` : `${monthText(month)} chưa có lệnh sản xuất`}
          description={isRecipient ? "Phòng Kế hoạch phát hành lệnh thì lệnh hiện ở đây." : "Lập lệnh từ dòng hàng hợp đồng xuất."}
        />
      ) : (
        <div data-tour="order-table">
          <RecordTable
            columns={columns}
            rows={rows}
            getKey={(o) => o.id}
            rowMarkKey="production-orders"
            emptyText="Không có lệnh nào khớp."
            actions={(o) => (
              <Button size="sm" variant="outline" onClick={() => onOpen(o.id)} title="Mở hồ sơ lệnh sản xuất.">
                <Eye className="mr-1 h-4 w-4" aria-hidden />
                Mở
              </Button>
            )}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- Hồ sơ lệnh ---------- */

export interface DossierActions {
  onBack: () => void;
  onEdit: () => void;
  onIssue: () => void;
  onLinkShipments: () => void;
  onKeepOld: () => void;
  onCancel: () => void;
  onPrint: () => void;
  onMaterials: (orderLineId: string) => void;
  onOpenContract: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function OrderDossier({
  data,
  order,
  canWrite,
  isRecipient,
  actions,
}: {
  data: ProductionOrderData;
  order: ProductionOrder;
  canWrite: boolean;
  isRecipient: boolean;
  actions: DossierActions;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const lines = linesOfOrder(data.lines, order.id);
  const totals = orderTotals(lines);
  const stale = staleRevision(order, data.exportData);
  const rev = effectiveRevision(data.exportData, order.contractId);
  const tolerance = rev?.terms.tolerancePct ?? null;
  const linkedShipments = data.links
    .filter((l) => l.orderId === order.id)
    .map((l) => data.exportData.shipments.find((s) => s.id === l.shipmentId))
    .filter((s): s is ExportShipment => !!s);
  const shipmentDone = issuedShipmentIds(data.orders, data.links);
  const isLive = order.status !== "cancelled";
  const expiry = expiryDate(order.productionDates, order.shelfLifeMonths);
  const req = order.requirements;
  const reqRows = [
    ["Bao bì", req.packagingReady === "ready" ? "Đã có sẵn" : req.packagingReady === "pending" ? "Chưa có" : ""],
    ["Thùng carton", req.cartonLayers],
    ["Đai dây", req.strapNote],
    ["Bao PE", req.peBagNote],
    ["Ghi trên thùng", req.cartonMarking],
    ["Ghi trên bao PE / rider", req.bagMarking],
    ["Kiểm Nafi", [req.nafiTests.join(", "), req.nafiNote].filter(Boolean).join(" · ")],
    ["Quy trình sản xuất", req.processNote],
    ["Các lưu ý khác", order.note],
  ].filter(([, v]) => v);

  const primary =
    !canWrite || !isLive
      ? null
      : order.status === "draft"
        ? { label: "Phát hành", icon: Send, onClick: actions.onIssue, title: "Phát hành lệnh: quản đốc, thủ kho đọc được lệnh trên app; chuyến gắn kèm xong bước Lệnh sản xuất." }
        : stale
          ? { label: "Sửa theo bản mới", icon: Pencil, onClick: actions.onEdit, title: "Hợp đồng đã có bản mới: sửa dòng lệnh theo bản mới (ghi lý do sửa)." }
          : !linkedShipments.length
            ? { label: "Gắn chuyến", icon: Link2, onClick: actions.onLinkShipments, title: "Gắn lệnh với chuyến xuất của hợp đồng — bước Lệnh sản xuất của chuyến tự xong." }
            : null;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={actions.onBack} title="Về danh sách lệnh sản xuất.">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Quay lại
          </Button>
          <h2 className="font-semibold">Lệnh sản xuất {order.orderNo}</h2>
          <span data-tour="order-status" className="flex flex-wrap gap-1">
            <OrderStatusTag order={order} />
            {order.revisionNo > 0 && <Tag variant="source">Đã sửa lần {order.revisionNo}</Tag>}
            {stale && <Tag variant="warning">{STALE_REVISION_LABEL}</Tag>}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {primary && (
            <Button variant={primary.icon === Pencil ? "edit" : "default"} onClick={primary.onClick} title={primary.title} data-tour="order-next-step">
              <primary.icon className="mr-2 h-4 w-4" aria-hidden />
              {primary.label}
            </Button>
          )}
          <Button variant="outline" onClick={actions.onPrint} title="In lệnh A4 đúng mẫu QTI-KH-01-04 (không in giá).">
            <Printer className="mr-2 h-4 w-4" aria-hidden />
            In lệnh
          </Button>
          {canWrite && isLive && (
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" title="Sửa, gắn chuyến, giữ nguyên theo bản cũ hoặc hủy lệnh.">
                  Thao tác khác
                  <ChevronDown className="ml-2 h-4 w-4" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="grid w-64 gap-1 p-2">
                <Button variant="edit" className="justify-start" onClick={() => (setMenuOpen(false), actions.onEdit())} title="Sửa lệnh. Lệnh đã phát hành phải ghi lý do sửa.">
                  <Pencil className="mr-2 h-4 w-4" aria-hidden />
                  Sửa lệnh
                </Button>
                <Button variant="ghost" className="justify-start" onClick={() => (setMenuOpen(false), actions.onLinkShipments())} title="Chọn chuyến xuất của hợp đồng mà lệnh này lo.">
                  <Link2 className="mr-2 h-4 w-4" aria-hidden />
                  Gắn chuyến
                </Button>
                {stale && (
                  <Button variant="ghost" className="justify-start" onClick={() => (setMenuOpen(false), actions.onKeepOld())} title="Giữ lệnh theo bản hợp đồng cũ (ghi lý do) — cờ cảnh báo hết.">
                    <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
                    Giữ nguyên theo bản cũ
                  </Button>
                )}
                <Button variant="ghost" className="justify-start" onClick={() => (setMenuOpen(false), actions.onCancel())} title="Hủy lệnh (ghi lý do). Chuyến gắn kèm và NL đã dành được nhả.">
                  <Ban className="mr-2 h-4 w-4" aria-hidden />
                  Hủy lệnh
                </Button>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {order.status === "cancelled" && (
        <p role="status" className="rounded-lg bg-muted px-4 py-2">
          Đã hủy{order.cancelReason ? ` · Lý do: ${order.cancelReason}` : ""}
        </p>
      )}
      {stale && (
        <p role="status" className="rounded-lg bg-warning-surface px-4 py-2">
          Hợp đồng {order.contractNo} đã có bản mới (phụ lục) sau khi lệnh phát hành. Dòng lệnh vẫn theo bản trước. Sửa lệnh theo bản mới, hoặc chọn Giữ nguyên theo bản cũ và ghi lý do.
        </p>
      )}
      {order.revisionNo > 0 && order.revisionReason && (
        <p className="text-sm text-muted-foreground">
          Lần sửa {order.revisionNo}: {order.revisionReason}
        </p>
      )}

      <dl data-tour="order-summary" className="grid gap-4 rounded-lg border border-border px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
        <Row label="Khách · thị trường">{[order.customerName, order.market].filter(Boolean).join(" · ") || "—"}</Row>
        {!isRecipient && (
          <Row label="Hợp đồng xuất">
            <Button variant="ghost" size="sm" className="h-auto px-0" onClick={actions.onOpenContract} title="Mở hồ sơ hợp đồng xuất ở trang Xuất khẩu.">
              {order.contractNo || "—"}
            </Button>
          </Row>
        )}
        <Row label="Ngày lệnh">
          <span className="tnum">{formatDateVN(order.orderDate) || "—"}</span>
        </Row>
        <Row label="Mã số lô (MSL)">{order.lotCode || "—"}</Row>
        <Row label="Ngày sản xuất">
          <span className="flex flex-wrap gap-1">
            {[...order.productionDates].sort().map((d) => (
              <Tag key={d} variant="category">
                {formatDateVN(d)}
              </Tag>
            ))}
          </span>
        </Row>
        <Row label="Ngày giao hàng">
          <span className="tnum">{formatDateVN(order.deliveryDate) || "—"}</span>
        </Row>
        <Row label="Hạn sử dụng">
          <span className="tnum">{expiry ? formatDateVN(expiry) : "—"}</span>
          <span className="block text-sm text-muted-foreground">{order.shelfLifeMonths} tháng từ tháng sản xuất đầu</span>
        </Row>
        <Row label="Phát hành">{order.issuedAt ? `${order.issuedBy || "—"} · ${formatDateVN(order.issuedAt.slice(0, 10))}` : "Chưa phát hành"}</Row>
      </dl>

      <section data-tour="order-lines" className="grid min-w-0 gap-2">
        <h3 className="font-semibold">Dòng hàng</h3>
        <RecordTable
          columns={[
            { key: "no", header: "STT", numeric: true, getSortValue: (l) => l.lineNo, render: (l) => l.lineNo },
            {
              key: "name",
              header: "Tên hàng",
              primary: true,
              getSortValue: (l) => l.productName,
              render: (l) => (
                <span className="grid">
                  <span className="font-semibold break-words">{l.productName || l.description}</span>
                  {l.description && l.productName && <span className="text-sm text-muted-foreground break-words">{l.description}</span>}
                </span>
              ),
            },
            { key: "spec", header: "Quy cách", getSortValue: (l) => l.spec, render: (l) => <span className="break-words">{l.spec || "—"}</span> },
            { key: "units", header: "Số lượng", numeric: true, sortKind: "number", getSortValue: (l) => lineCartons(l) ?? 0, render: (l) => `${formatNumber(l.units ?? 0)} ${unitWord(l.unitKind)}` },
            {
              key: "kg",
              header: "Kg",
              numeric: true,
              sortKind: "number",
              getSortValue: (l) => orderLineKg(l),
              render: (l) => {
                const cl = rev?.lines.find((x) => x.id === l.contractLineId);
                const cov = cl && !isRecipient ? contractLineCoverage(cl, tolerance, data.orders, data.lines) : null;
                return (
                  <span className="grid justify-items-end">
                    <span className="tnum">{formatNumber(orderLineKg(l))}</span>
                    {cov?.overTolerance && <span className="text-sm text-warning">HĐ {formatNumber(cov.contractKg)} kg · đã ra lệnh {formatNumber(cov.orderedKg)} kg (vượt dung sai)</span>}
                  </span>
                );
              },
            },
          ]}
          rows={lines}
          getKey={(l) => l.id}
          emptyText="Lệnh chưa có dòng hàng."
        />
        <p className="tnum text-sm">
          Tổng: <b>{formatNumber(totals.cartons)}</b> thùng · <b>{formatNumber(totals.kg)}</b> kg
        </p>
      </section>

      <section data-tour="order-materials" className="grid min-w-0 gap-2">
        <h3 className="font-semibold">NL nhập khẩu dự kiến</h3>
        <p className="text-sm text-muted-foreground">Chỉ dành NL cho lệnh — không trừ kho, không ghi vào Nhập khẩu hay sổ kho.</p>
        {lines.map((l) => {
          const mats = data.materials.filter((m) => m.orderLineId === l.id);
          return (
            <div key={l.id} className="grid min-w-0 gap-1 rounded-lg border border-border px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="break-words">{l.productName || l.description}</b>
                {canWrite && isLive && (
                  <Button size="sm" variant="outline" onClick={() => actions.onMaterials(l.id)} title="Chọn lần nhập khẩu và số kg NL dự kiến dùng cho dòng này.">
                    <Wheat className="mr-1 h-4 w-4" aria-hidden />
                    {mats.length ? "Sửa NL dự kiến" : "Gắn NL nhập khẩu"}
                  </Button>
                )}
              </div>
              {mats.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa gắn lần nhập nào.</p>
              ) : (
                <ul className="grid gap-1 text-sm">
                  {mats.map((m) => {
                    const rl = data.receiptLines.find((x) => x.receiptId === m.receiptId && x.contractLineId === m.importLineId);
                    const r = rl ? reservationOf(rl, data.materials, data.orders) : null;
                    return (
                      <li key={m.id} className="flex flex-wrap gap-x-2">
                        <span className="break-words">{m.label || "Lần nhập"}</span>
                        <span className="tnum font-semibold">{formatNumber(m.kg ?? 0)} kg</span>
                        {r && (
                          <span className={`tnum ${r.overReceived ? "text-warning" : "text-muted-foreground"}`}>
                            · đã dành {formatNumber(r.reservedKg)} / thực nhập {formatNumber(r.receivedKg)} kg{r.overReceived ? ` (vượt ${formatNumber(-r.freeKg)} kg)` : ""}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section data-tour="order-shipments" className="grid min-w-0 gap-2">
        <h3 className="font-semibold">Chuyến xuất</h3>
        {linkedShipments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa gắn chuyến. Gắn chuyến thì bước Lệnh sản xuất của chuyến tự xong khi lệnh đã phát hành.</p>
        ) : (
          <ul className="grid gap-1">
            {linkedShipments.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                <span className="break-words">{shipmentLabel(s)}</span>
                {s.lotCode && <span className="text-sm text-muted-foreground">MSL {s.lotCode}</span>}
                {lotMismatch(s, order) && <Tag variant="warning">Lệch MSL</Tag>}
                {shipmentDone.has(s.id) && <Tag variant="done">Bước Lệnh sản xuất xong</Tag>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {reqRows.length > 0 && (
        <section className="grid min-w-0 gap-2">
          <h3 className="font-semibold">Yêu cầu bao bì · kiểm Nafi · lưu ý</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {reqRows.map(([k, v]) => (
              <Row key={k} label={k}>
                {v}
              </Row>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
