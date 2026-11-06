// ============================================================
// Tên file: src/features/production-orders/ShipmentOrders.tsx
// Tên tiếng Việt: Lệnh sản xuất ở bước 2 của chuyến xuất — lệnh đã gắn, Lập lệnh, Gắn / bỏ gắn lệnh
// Description: Block shown inside step 2 of an export shipment (ba-spec 48 R6, design-spec 49): lists
//              the production orders linked to the shipment, opens the order page to create one for this
//              contract + shipment, or links an existing order of the same contract (MSL copied when the
//              shipment has none), or unlinks a linked order — any status, cancelled included (audit
//              2026-11-06 B6). Every write has Undo.
// ============================================================
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, FormDialog, InlineConfirmDelete, formatNumber, notify } from "@/design-system";
import { useCan } from "@/features/shared/PermissionProvider";
import { useExportContracts, useExportShipmentLines, useExportShipments, useProductionOrderLines, useProductionOrderShipments, useProductionOrders } from "@/lib/catalogRepo";
import { shipmentContractIds, unlinkShipmentOrder } from "@/lib/exportPlanning";
import { newId } from "@/lib/store";
import { linesOfOrder, orderTotals, shipmentsWithLot, visibleOrders } from "@/lib/productionOrder";
import type { ExportShipment } from "@/types";
import { ClipboardList, FilePlus2, Link2 } from "lucide-react";
import { OrderStatusTag } from "./OrderViews";
import { contractInput, shipmentLabel } from "./useContractActivity";
import { usePlanningActivityLog } from "@/features/shared/activityLog";
import { useAuth } from "@/lib/auth";

export function ShipmentOrders({ shipment, isCancelled }: { shipment: ExportShipment; isCancelled: boolean }) {
  const can = useCan("production-orders");
  const navigate = useNavigate();
  const [orders] = useProductionOrders();
  const [lines] = useProductionOrderLines();
  const [links, setLinks] = useProductionOrderShipments();
  const [shipments, setShipments] = useExportShipments();
  const [shipmentLines] = useExportShipmentLines();
  const [contracts] = useExportContracts();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const { profile } = useAuth();
  // Nhật ký nhóm Kế hoạch (ba-spec 56): dòng của hồ sơ HĐ xuất + dòng của từng lệnh vừa gắn.
  const planningLog = usePlanningActivityLog(profile?.fullName || profile?.username || "Máy này");
  if (!can.view) return null;

  const canWrite = can.create || can.update;
  const mine = visibleOrders(orders, canWrite);
  const linked = links
    .filter((l) => l.shipmentId === shipment.id)
    .map((l) => mine.find((o) => o.id === l.orderId))
    .filter((o): o is NonNullable<typeof o> => !!o && o.status !== "cancelled");
  // Chuyến gộp (ba-spec 70): lệnh của mọi HĐ có hàng trên chuyến (ba-spec 48 LS3).
  const contractIds = shipmentContractIds({ shipmentLines }, shipment);
  const isMulti = contractIds.length > 1;
  const contractNo = (id: string) => contracts.find((c) => c.id === id)?.contractNo || "(chưa có số)";
  // Mọi lệnh đang gắn chuyến (kể cả Đã hủy — link cũ vẫn còn) ⇒ bỏ gắn được trong hộp (audit B6).
  const linkedAll = links
    .filter((l) => l.shipmentId === shipment.id)
    .map((l) => orders.find((o) => o.id === l.orderId))
    .filter((o, i, arr): o is NonNullable<typeof o> => !!o && arr.findIndex((x) => x?.id === o.id) === i);
  const cancelledLinked = linkedAll.filter((o) => o.status === "cancelled").length;
  const candidates = mine.filter((o) => contractIds.includes(o.contractId) && o.status !== "cancelled" && !linked.some((x) => x.id === o.id));
  const open = (id: string) => navigate(`/planning-production?order=${encodeURIComponent(id)}`);

  const saveLinks = () => {
    if (!picked.length) return setPicking(false);
    const prevLinks = links;
    const prevShipments = shipments;
    const now = new Date().toISOString();
    if (!setLinks([...links, ...picked.map((orderId) => ({ id: newId(), orderId, shipmentId: shipment.id, createdAt: now }))])) return;
    // Chuyến chưa có MSL nhận MSL của lệnh đầu tiên được gắn (AC-9).
    const first = orders.find((o) => o.id === picked[0]);
    const changed = first ? shipmentsWithLot(first, [shipment]) : [];
    if (changed.length) setShipments(shipments.map((s) => changed.find((c) => c.id === s.id) ?? s));
    // Nhật ký HĐ xuất (mig 0079): gắn lệnh ở chuyến cũng là việc trên hồ sơ HĐ.
    const nos = picked.map((id) => orders.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o);
    const what = `Gắn lệnh sản xuất ${nos.map((o) => o.orderNo).join(", ")} vào chuyến ${shipmentLabel(shipment)}${nos.some((o) => o.status === "issued") ? " — bước Lệnh sản xuất xong" : ""}${changed.length && first ? ` · chuyến nhận mã số lô ${first.lotCode}` : ""}`;
    planningLog.log([
      contractInput({ contractId: shipment.contractId, shipmentId: shipment.id, action: "attach", summary: what }),
      ...nos.map((o) => ({ recordType: "production-order" as const, recordId: o.id, action: "attach" as const, summary: `Gắn chuyến ${shipmentLabel(shipment)} (từ hồ sơ chuyến xuất)` })),
    ]);
    notify.saved(`Đã gắn ${picked.length} lệnh sản xuất vào chuyến`, () => {
      setLinks([...prevLinks]);
      if (changed.length) setShipments([...prevShipments]);
      planningLog.log([
        contractInput({ contractId: shipment.contractId, shipmentId: shipment.id, action: "undo", summary: `Hoàn tác: ${what}` }),
        ...nos.map((o) => ({ recordType: "production-order" as const, recordId: o.id, action: "undo" as const, summary: `Hoàn tác: gắn chuyến ${shipmentLabel(shipment)}` })),
      ]);
    });
    setPicking(false);
  };

  /** Bỏ gắn một lệnh khỏi chuyến (hỏi lại tại dòng trong hộp, có Hoàn tác, nhật ký HĐ + nhật ký lệnh). MSL chuyến giữ nguyên. */
  const unlink = (orderId: string) => {
    const o = orders.find((x) => x.id === orderId);
    const out = unlinkShipmentOrder(links, shipment.id, orderId);
    if (!o || !out.removed.length) return;
    const prevLinks = links;
    if (!setLinks(out.links)) return;
    const what = `Bỏ gắn lệnh sản xuất ${o.orderNo}${o.status === "cancelled" ? " (đã hủy)" : ""} khỏi chuyến ${shipmentLabel(shipment)}${o.status === "issued" ? " — bước Lệnh sản xuất của chuyến tính lại" : ""}`;
    planningLog.log([
      contractInput({ contractId: shipment.contractId, shipmentId: shipment.id, action: "detach", summary: what }),
      { recordType: "production-order" as const, recordId: o.id, action: "detach" as const, summary: `Bỏ gắn chuyến ${shipmentLabel(shipment)} (từ hồ sơ chuyến xuất)` },
    ]);
    notify.deleted(`Đã bỏ gắn lệnh ${o.orderNo} khỏi chuyến`, () => {
      setLinks([...prevLinks]);
      planningLog.log([
        contractInput({ contractId: shipment.contractId, shipmentId: shipment.id, action: "undo", summary: `Hoàn tác: ${what}` }),
        { recordType: "production-order" as const, recordId: o.id, action: "undo" as const, summary: `Hoàn tác: bỏ gắn chuyến ${shipmentLabel(shipment)}` },
      ]);
    });
    // Hết lệnh để bỏ gắn và hết lệnh để gắn ⇒ đóng hộp.
    if (linkedAll.length <= 1 && !candidates.length) setPicking(false);
  };

  return (
    <div className="grid min-w-0 gap-2 rounded-md bg-muted/40 px-3 py-2">
      {linked.length ? (
        <ul className="grid gap-1">
          {linked.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" className="h-auto px-0 font-semibold" onClick={() => open(o.id)} title="Mở hồ sơ lệnh sản xuất.">
                <ClipboardList className="mr-1 h-4 w-4" aria-hidden />
                Lệnh {o.orderNo}
              </Button>
              {isMulti && <span className="text-sm text-muted-foreground">HĐ {contractNo(o.contractId)}</span>}
              <OrderStatusTag order={o} />
              <span className="tnum text-sm text-muted-foreground">{formatNumber(orderTotals(linesOfOrder(lines, o.id)).kg)} kg</span>
              {o.status === "draft" && <span className="text-sm text-muted-foreground">— phát hành thì bước này tự xong</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Chưa có Lệnh sản xuất gắn chuyến này. Lệnh phát hành gắn chuyến thì bước này tự xong.</p>
      )}
      {cancelledLinked > 0 && (
        <p className="text-sm text-muted-foreground">
          {cancelledLinked} lệnh đã hủy vẫn gắn chuyến này (không tính cho bước) — chọn Gắn / bỏ gắn lệnh để bỏ gắn.
        </p>
      )}
      {canWrite && !isCancelled && (
        <div className="flex flex-wrap gap-2">
          {contractIds.map((id) => (
            <Button
              key={id}
              size="sm"
              onClick={() => navigate(`/planning-production?new=1&contract=${encodeURIComponent(id)}&shipment=${encodeURIComponent(shipment.id)}`)}
              title={isMulti ? `Lập lệnh sản xuất cho hợp đồng ${contractNo(id)}; phát hành xong thì lệnh gắn chuyến này.` : "Lập lệnh sản xuất cho hợp đồng này; phát hành xong thì lệnh gắn chuyến này."}
            >
              <FilePlus2 className="mr-1 h-4 w-4" aria-hidden />
              {isMulti ? `Lập lệnh sản xuất · HĐ ${contractNo(id)}` : "Lập lệnh sản xuất"}
            </Button>
          ))}
          {(candidates.length > 0 || (can.update && linkedAll.length > 0)) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => (setPicked([]), setPicking(true))}
              title={`${isMulti ? "Gắn lệnh sản xuất đã lập của các hợp đồng có hàng trên chuyến này" : "Gắn lệnh sản xuất đã lập của cùng hợp đồng vào chuyến này"}; gắn nhầm thì bỏ gắn ngay trong hộp (kể cả lệnh đã hủy).`}
            >
              <Link2 className="mr-1 h-4 w-4" aria-hidden />
              Gắn / bỏ gắn lệnh
            </Button>
          )}
        </div>
      )}
      <FormDialog
        open={picking}
        onOpenChange={(v) => !v && setPicking(false)}
        title="Gắn / bỏ gắn lệnh sản xuất"
        description={`${isMulti ? "Chọn lệnh sản xuất của các hợp đồng có hàng trên chuyến." : "Chọn lệnh sản xuất của cùng hợp đồng."} Lệnh đã phát hành thì bước Lệnh sản xuất của chuyến xong ngay. Gắn nhầm ⇒ bỏ gắn ở mục Đang gắn (hỏi lại, có Hoàn tác).`}
        icon={Link2}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setPicking(false)}>
              Hủy
            </Button>
            {candidates.length > 0 && (
              <Button variant="save" onClick={saveLinks} title="Gắn các lệnh đã chọn vào chuyến này.">
                <Link2 className="mr-2 h-4 w-4" aria-hidden />
                Gắn lệnh
              </Button>
            )}
          </>
        }
      >
        {can.update && linkedAll.length > 0 && (
          <div className="grid gap-2 py-2">
            <p className="text-sm font-semibold">Đang gắn chuyến này</p>
            <ul className="grid gap-2">
              {linkedAll.map((o) => (
                <li key={o.id} className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2">
                  <span className="min-w-0 flex-1 break-words">
                    Lệnh {o.orderNo}{isMulti ? ` · HĐ ${contractNo(o.contractId)}` : ""} · {formatNumber(orderTotals(linesOfOrder(lines, o.id)).kg)} kg <OrderStatusTag order={o} />
                  </span>
                  <InlineConfirmDelete
                    recordDescription={`Bỏ gắn lệnh ${o.orderNo} khỏi chuyến${o.status === "issued" ? " — bước Lệnh sản xuất của chuyến tính lại" : ""}`}
                    title={`Bỏ gắn lệnh ${o.orderNo} khỏi chuyến này (gắn nhầm / lệnh đã hủy). Lệnh và mã số lô của chuyến giữ nguyên. Hỏi lại trước, có Hoàn tác.`}
                    onConfirm={() => unlink(o.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
        <fieldset className="grid gap-2 py-2">
          <legend className={linkedAll.length && can.update ? "text-sm font-semibold" : "sr-only"}>{candidates.length ? "Gắn thêm lệnh" : "Không còn lệnh nào để gắn thêm"}</legend>
          {candidates.map((o) => (
            <label key={o.id} className="flex min-h-10 items-center gap-3 rounded-md border border-border px-3 py-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={picked.includes(o.id)}
                onChange={() => setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))}
              />
              <span className="min-w-0 break-words">
                Lệnh {o.orderNo}{isMulti ? ` · HĐ ${contractNo(o.contractId)}` : ""} · {formatNumber(orderTotals(linesOfOrder(lines, o.id)).kg)} kg
                <span className="block text-sm text-muted-foreground">
                  {o.lotCode ? `MSL ${o.lotCode}` : "Chưa có MSL"} · <OrderStatusTag order={o} />
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </FormDialog>
    </div>
  );
}
