// ============================================================
// THEO GIAI ĐOẠN — tab của màn /qr (truy xuất QR đợt 2b).
// Kiểm QR từng khâu ở MỘT chỗ: nhập NL → sản xuất → nhập kho → đóng gói → xuất/bán.
// Mỗi khâu liệt kê lô / dòng hàng ra trong khoảng ngày × xưởng, kèm trạng thái (tem,
// lô đã gắn, kho, quét kiểm) và nút làm NGAY tại đây: In tem · Gắn lô · Hộ chiếu ·
// Duyệt nhập kho / Kiểm lô (mở thẳng hộp ở màn Kho dự trữ / Đơn đặt).
// Thay cho tab "Độ phủ" (mỗi khâu đã có số đếm đã gắn / còn thiếu).
// Số lấy từ groupByTraceStage (lib/lotTraceability, hàm thuần có test).
// Thiết kế: docs/spec/qr-truy-xuat-lo.md §6d
// ============================================================
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { DomesticSaleItem, Packaging, SalesItem, WipProductionItem, Workshop } from "@/types";
import { LotInputPicker, LotDispatchPicker, LotQrLabels, useTraceData } from "@/features/shared";
import { kg, formatDateVN } from "@/lib/format";
import { TRACE_KIND_LABELS, isOutboundKind, formatWipLotLabel, formatFinishedGoodLotLabel, groupByTraceStage, type TraceStage, type TraceStageKey, type TraceStageItem, type LotNode } from "@/lib/lotTraceability";
import { Button, ChoiceGroup, DateRangeField, EmptyState, Tag, addDays, todayIso, toneByName } from "@/design-system";
import { ClipboardCheck, Link2, Printer, ScanLine, Search } from "lucide-react";

/** Màn gốc của từng khâu + đơn vị đếm. */
const STAGES: Record<TraceStageKey, { unit: string; man: { path: string; label: string }[] }> = {
  imports: { unit: "lô", man: [{ path: "/imports", label: "Nhập hàng" }] },
  production: { unit: "mẻ", man: [{ path: "/wip", label: "Sản xuất thành phẩm" }] },
  warehouse: { unit: "mẻ", man: [{ path: "/warehouse", label: "Kho dự trữ" }] },
  packaging: { unit: "phiếu", man: [{ path: "/packaging", label: "Đóng gói" }] },
  outbound: { unit: "dòng", man: [{ path: "/orders", label: "Đơn đặt" }, { path: "/sales", label: "Bán hàng" }] },
};

const describeNode = (n: LotNode) =>
  [
    n.description,
    n.date && formatDateVN(n.date),
    n.details.find((c) => c.label === "Đại lý" || c.label === "Khách")?.value,
    n.kg ? kg(n.kg) : "",
  ]
    .filter((x) => x && x !== "—")
    .join(" · ");

/** Một dòng: nhãn lô (bấm mở hộ chiếu) + mô tả, nhãn trạng thái, nút thao tác. */
function StageRow({ m, status, action: actions }: { m: TraceStageItem; status: ReactNode; action: ReactNode }) {
  const n = m.node;
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border py-2 last:border-b-0">
      <div className="min-w-0 flex-1 basis-64 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Tag variant="category" tone={toneByName(TRACE_KIND_LABELS[n.kind])}>{TRACE_KIND_LABELS[n.kind]}</Tag>
          {isOutboundKind(n.kind) || n.isMissing ? (
            <span className="tnum font-medium">{n.label}</span>
          ) : (
            <Link
              className="tnum font-medium text-primary underline-offset-4 hover:underline"
              title={`Mở hộ chiếu của lô ${n.label}: làm từ đâu, đã đi đâu, cân bằng kg.`}
              to={`/qr?lot=${n.kind}:${encodeURIComponent(n.id)}`}
            >
              {n.label}
            </Link>
          )}
        </div>
        <p className="text-muted-foreground">{describeNode(n)}</p>
        <div className="flex flex-wrap gap-1.5">{status}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </li>
  );
}

const labelBadge = (m: TraceStageItem) =>
  m.printedCount === undefined ? null : m.printedCount > 0 ? <Tag variant="done">Đã in {m.printedCount} tem</Tag> : <Tag variant="pending">Chưa in tem</Tag>;

const lotBadge = (m: TraceStageItem, name: string) =>
  (m.lotCount ?? 0) > 0 ? (
    <Tag variant="done">
      {name} ({m.lotCount})
    </Tag>
  ) : m.reason ? (
    <Tag variant="warning" title={`Lý do chưa gắn lô: ${m.reason}`}>
      Chưa gắn lô · có lý do
    </Tag>
  ) : (
    <Tag variant="error">Chưa gắn lô</Tag>
  );

export function TraceStagesView() {
  const { traceData } = useTraceData();
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(() => addDays(todayIso(), -6));
  const [toDate, setToDate] = useState(todayIso);
  const [workshop, setWorkshop] = useState<Workshop | "">("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const [lotLabel, setLotLabel] = useState<LotNode | null>(null);
  const [lotForBatch, setLotForBatch] = useState<WipProductionItem | null>(null);
  const [lotForPackaging, setLotForPackaging] = useState<Packaging | null>(null);
  const [lotForSalesItem, setLotForSalesItem] = useState<{ salesItem: SalesItem; lotKind: "W" | "P" } | null>(null);
  const [lotForDomesticSale, setLotForDomesticSale] = useState<DomesticSaleItem | null>(null);

  const items = useMemo(() => groupByTraceStage(traceData, { fromDate, toDate, workshop }), [traceData, fromDate, toDate, workshop]);
  const productNameOf = (id: string) => traceData.products.find((p) => p.id === id)?.name || "—";

  /** Nút: việc còn thiếu thì nổi (default), còn lại viền (outline). */
  const taskButton = (isMissing: boolean, title: string, onClick: () => void, icon: ReactNode, label: string) => (
    <Button size="sm" variant={isMissing ? "default" : "outline"} title={title} onClick={onClick}>
      {icon}
      {label}
    </Button>
  );
  const labelButton = (m: TraceStageItem) =>
    taskButton(m.missing.includes("label"), `In tem QR cho lô ${m.node.label} (mặc định mỗi block / thùng một tem).`, () => setLotLabel(m.node), <Printer aria-hidden />, "In tem");

  const renderItemRow = (g: TraceStage, m: TraceStageItem): ReactNode => {
    const n = m.node;
    if (g.key === "imports")
      return (
        <StageRow
          key={n.id}
          m={m}
          status={
            <>
              {labelBadge(m)}
              {(m.usedKg ?? 0) > 0 ? <Tag variant="source">Đã dùng cho {m.usedKg} mẻ / dòng bán</Tag> : <Tag variant="muted">Chưa dùng</Tag>}
            </>
          }
          action={labelButton(m)}
        />
      );
    if (g.key === "production") {
      const w = traceData.wips.find((x) => x.id === n.id);
      return (
        <StageRow
          key={n.id}
          m={m}
          status={
            <>
              {lotBadge(m, "Lô NL")}
              {labelBadge(m)}
            </>
          }
          action={
            <>
              {w &&
                taskButton(m.missing.includes("lot"), `Ghi mẻ ${n.label} đã dùng lô nguyên liệu nào (quét tem, gõ mã hoặc chọn).`, () => setLotForBatch(w), <Link2 aria-hidden />, (m.lotCount ?? 0) > 0 ? "Lô NL" : "Gắn lô NL")}
              {labelButton(m)}
            </>
          }
        />
      );
    }
    if (g.key === "warehouse")
      return (
        <StageRow
          key={n.id}
          m={m}
          status={
            m.warehouseStatus === "pending" ? (
              <Tag variant="pending">Chờ nhập kho</Tag>
            ) : (
              <Tag variant="done">Đã nhập kho{m.stockKg != null ? ` · tồn ${kg(m.stockKg)}` : ""}</Tag>
            )
          }
          action={
            m.warehouseStatus === "pending"
              ? taskButton(true, `Mở màn Kho dự trữ với hộp duyệt nhập kho của mẻ ${n.label}.`, () => navigate(`/warehouse?approve=W:${encodeURIComponent(n.id)}`), <ClipboardCheck aria-hidden />, "Duyệt nhập kho")
              : null
          }
        />
      );
    if (g.key === "packaging") {
      const p = traceData.packagings.find((x) => x.id === n.id);
      return (
        <StageRow
          key={n.id}
          m={m}
          status={
            <>
              {lotBadge(m, "Lô BTP")}
              {labelBadge(m)}
              {m.stockKg != null && <Tag variant="location">Tồn {kg(m.stockKg)}</Tag>}
            </>
          }
          action={
            <>
              {p &&
                taskButton(m.missing.includes("lot"), `Ghi phiếu ${n.label} đã dùng lô bán thành phẩm nào.`, () => setLotForPackaging(p), <Link2 aria-hidden />, (m.lotCount ?? 0) > 0 ? "Lô BTP" : "Gắn lô BTP")}
              {labelButton(m)}
            </>
          }
        />
      );
    }
    // Xuất & bán
    if (n.kind === "X")
      return (
        <StageRow
          key={`X:${n.id}`}
          m={m}
          status={m.isScanned ? <Tag variant="done">Đã quét kiểm</Tag> : <Tag variant="pending">Chưa quét kiểm</Tag>}
          action={
            m.salesOrderId && m.exportOrderId
              ? taskButton(!m.isScanned, "Mở màn Đơn đặt với hộp kiểm lô bằng quét của lệnh xuất này.", () => navigate(`/orders?order=${encodeURIComponent(m.salesOrderId!)}&check=${encodeURIComponent(m.exportOrderId!)}`), <ScanLine aria-hidden />, "Kiểm lô")
              : null
          }
        />
      );
    if (n.kind === "B") {
      const b = (traceData.salesItems ?? []).find((x) => x.id === n.id);
      return (
        <StageRow
          key={`B:${n.id}`}
          m={m}
          status={lotBadge(m, m.soldLotKind === "P" ? "Lô TP" : "Lô BTP")}
          action={
            b && m.soldLotKind
              ? taskButton(m.missing.includes("lot"), "Ghi dòng bán này lấy từ lô nào — để thu hồi tới được khách.", () => setLotForSalesItem({ salesItem: b, lotKind: m.soldLotKind! }), <Link2 aria-hidden />, (m.lotCount ?? 0) > 0 ? "Lô" : "Gắn lô")
              : null
          }
        />
      );
    }
    const r = (traceData.domesticSales ?? []).find((x) => x.id === n.id);
    return (
      <StageRow
        key={`N:${n.id}`}
        m={m}
        status={lotBadge(m, "Lô NL")}
        action={r ? taskButton(m.missing.includes("lot"), "Ghi nguyên liệu bán này lấy từ lô NL nào.", () => setLotForDomesticSale(r), <Link2 aria-hidden />, (m.lotCount ?? 0) > 0 ? "Lô NL" : "Gắn lô NL") : null}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-xl border-2 border-border p-4">
        <DateRangeField
          label="Khoảng ngày"
          hint="Ngày hàng về · ngày sản xuất · ngày đóng gói · ngày xuất / bán."
          startDate={fromDate}
          endDate={toDate}
          onChange={(a, b) => {
            setFromDate(a);
            setToDate(b);
          }}
          hideRequiredMark
        />
        <ChoiceGroup
          label="Phân xưởng"
          value={workshop}
          onChange={(v) => setWorkshop(v as Workshop | "")}
          options={[{ value: "", label: "Tất cả" }, ...(["Đông", "Cá", "Khô"] as const).map((x) => ({ value: x, label: x }))]}
          columns={4}
          hideRequiredMark
        />
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" className="size-5 shrink-0" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          <span>
            Chỉ hiện mục <b>còn thiếu</b> (chưa in tem, chưa gắn lô, chờ duyệt, chưa quét kiểm)
          </span>
        </label>
      </div>

      <ol className="space-y-4">
        {items.map((g, i) => {
          const missingCount = g.items.filter((m) => m.missing.length > 0).length;
          const isVisible = onlyMissing ? g.items.filter((m) => m.missing.length > 0) : g.items;
          return (
            <li key={g.key} className="space-y-2 rounded-xl border-2 border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  <span className="tnum">{i + 1}.</span> {g.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tnum text-muted-foreground">
                    {g.items.length} {STAGES[g.key].unit}
                  </span>
                  {g.items.length > 0 &&
                    (missingCount > 0 ? <Tag variant="error">Còn thiếu {missingCount}</Tag> : <Tag variant="done">Đủ</Tag>)}
                </div>
              </div>
              <p className="text-muted-foreground">
                Làm ở{" "}
                {STAGES[g.key].man.map((x, k) => (
                  <span key={x.path}>
                    {k > 0 && " · "}
                    <Link className="text-primary underline-offset-4 hover:underline" to={x.path}>
                      {x.label}
                    </Link>
                  </span>
                ))}
                , hoặc bấm nút ngay ở từng dòng.
              </p>
              {isVisible.length > 0 ? (
                <ul>{isVisible.map((m) => renderItemRow(g, m))}</ul>
              ) : (
                <p className="text-muted-foreground">
                  {g.items.length ? "Khâu này không còn mục thiếu." : `Không có ${STAGES[g.key].unit} nào trong khoảng này.`}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {items.every((g) => g.items.length === 0) && (
        <EmptyState title="Chưa có dữ liệu trong khoảng này" description="Nới khoảng ngày hoặc đổi phân xưởng." />
      )}
      <p className="flex items-center gap-2 text-muted-foreground">
        <Search aria-hidden className="size-4 shrink-0" /> Bấm vào mã lô để mở hộ chiếu: làm từ đâu, đã đi đâu, danh sách thu hồi.
      </p>

      {lotLabel && <LotQrLabels node={lotLabel} onClose={() => setLotLabel(null)} />}
      {lotForBatch && (
        <LotInputPicker
          outputKind="W"
          outputId={lotForBatch.id}
          outputLabel={`mẻ ${formatWipLotLabel(lotForBatch)} · ${productNameOf(lotForBatch.productId)}`}
          workshop={lotForBatch.workshop}
          date={lotForBatch.productionDate}
          onClose={() => setLotForBatch(null)}
        />
      )}
      {lotForPackaging && (
        <LotInputPicker
          outputKind="P"
          outputId={lotForPackaging.id}
          outputLabel={`phiếu ${formatFinishedGoodLotLabel(lotForPackaging)} · ${productNameOf(lotForPackaging.toProductId)}`}
          workshop={lotForPackaging.workshop}
          date={lotForPackaging.date}
          productId={lotForPackaging.fromProductId}
          onClose={() => setLotForPackaging(null)}
        />
      )}
      {lotForSalesItem && (
        <LotDispatchPicker
          docKind="sales_item"
          docId={lotForSalesItem.salesItem.id}
          docLabel={`${productNameOf(lotForSalesItem.salesItem.productId)} · ${kg(lotForSalesItem.salesItem.quantityKg)} · ${formatDateVN(lotForSalesItem.salesItem.deliveryDate)}`}
          lotKind={lotForSalesItem.lotKind}
          workshop={(traceData.salesInvoices ?? []).find((v) => v.id === lotForSalesItem.salesItem.invoiceId)?.workshop ?? "Đông"}
          date={lotForSalesItem.salesItem.deliveryDate}
          productId={lotForSalesItem.salesItem.productId}
          onClose={() => setLotForSalesItem(null)}
        />
      )}
      {lotForDomesticSale && (
        <LotDispatchPicker
          docKind="domestic_sale"
          docId={lotForDomesticSale.id}
          docLabel={`bán nội địa ${lotForDomesticSale.materialTypeName} · ${kg(lotForDomesticSale.quantityKg)} · ${formatDateVN(lotForDomesticSale.saleDate)}`}
          lotKind="S"
          workshop={lotForDomesticSale.workshop}
          date={lotForDomesticSale.saleDate}
          onClose={() => setLotForDomesticSale(null)}
        />
      )}
    </div>
  );
}
