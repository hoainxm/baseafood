// ============================================================
// Tên file: src/features/production-orders/ShipmentOrders.tsx
// Tên tiếng Việt: Lệnh sản xuất ở bước 2 của chuyến xuất — lệnh đã gắn, Lập lệnh, Gắn lệnh có sẵn
// Description: Block shown inside step 2 of an export shipment (ba-spec 48 R6, design-spec 49): lists
//              the production orders linked to the shipment, opens the order page to create one for this
//              contract + shipment, or links an existing order of the same contract (MSL copied when the
//              shipment has none). Every write has Undo.
// ============================================================
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, FormDialog, formatNumber, notify } from "@/design-system";
import { useCan } from "@/features/shared/PermissionProvider";
import { useExportShipments, useProductionOrderLines, useProductionOrderShipments, useProductionOrders } from "@/lib/catalogRepo";
import { newId } from "@/lib/store";
import { linesOfOrder, orderTotals, shipmentsWithLot, visibleOrders } from "@/lib/productionOrder";
import type { ExportShipment } from "@/types";
import { ClipboardList, FilePlus2, Link2 } from "lucide-react";
import { OrderStatusTag } from "./OrderViews";

export function ShipmentOrders({ shipment, isCancelled }: { shipment: ExportShipment; isCancelled: boolean }) {
  const can = useCan("production-orders");
  const navigate = useNavigate();
  const [orders] = useProductionOrders();
  const [lines] = useProductionOrderLines();
  const [links, setLinks] = useProductionOrderShipments();
  const [shipments, setShipments] = useExportShipments();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  if (!can.view) return null;

  const canWrite = can.create || can.update;
  const mine = visibleOrders(orders, canWrite);
  const linked = links
    .filter((l) => l.shipmentId === shipment.id)
    .map((l) => mine.find((o) => o.id === l.orderId))
    .filter((o): o is NonNullable<typeof o> => !!o && o.status !== "cancelled");
  const candidates = mine.filter((o) => o.contractId === shipment.contractId && o.status !== "cancelled" && !linked.some((x) => x.id === o.id));
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
    notify.saved(`Đã gắn ${picked.length} lệnh sản xuất vào chuyến`, () => {
      setLinks([...prevLinks]);
      if (changed.length) setShipments([...prevShipments]);
    });
    setPicking(false);
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
              <OrderStatusTag order={o} />
              <span className="tnum text-sm text-muted-foreground">{formatNumber(orderTotals(linesOfOrder(lines, o.id)).kg)} kg</span>
              {o.status === "draft" && <span className="text-sm text-muted-foreground">— phát hành thì bước này tự xong</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Chưa có Lệnh sản xuất gắn chuyến này. Lệnh phát hành gắn chuyến thì bước này tự xong.</p>
      )}
      {canWrite && !isCancelled && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => navigate(`/planning-production?new=1&contract=${encodeURIComponent(shipment.contractId)}&shipment=${encodeURIComponent(shipment.id)}`)}
            title="Lập lệnh sản xuất cho hợp đồng này; phát hành xong thì lệnh gắn chuyến này."
          >
            <FilePlus2 className="mr-1 h-4 w-4" aria-hidden />
            Lập lệnh sản xuất
          </Button>
          {candidates.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => (setPicked([]), setPicking(true))} title="Gắn lệnh sản xuất đã lập của cùng hợp đồng vào chuyến này.">
              <Link2 className="mr-1 h-4 w-4" aria-hidden />
              Gắn lệnh có sẵn
            </Button>
          )}
        </div>
      )}
      <FormDialog
        open={picking}
        onOpenChange={(v) => !v && setPicking(false)}
        title="Gắn lệnh có sẵn"
        description="Chọn lệnh sản xuất của cùng hợp đồng. Lệnh đã phát hành thì bước Lệnh sản xuất của chuyến xong ngay."
        icon={Link2}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setPicking(false)}>
              Hủy
            </Button>
            <Button variant="save" onClick={saveLinks} title="Gắn các lệnh đã chọn vào chuyến này.">
              <Link2 className="mr-2 h-4 w-4" aria-hidden />
              Gắn lệnh
            </Button>
          </>
        }
      >
        <fieldset className="grid gap-2 py-2">
          <legend className="sr-only">Lệnh sản xuất của hợp đồng</legend>
          {candidates.map((o) => (
            <label key={o.id} className="flex min-h-10 items-center gap-3 rounded-md border border-border px-3 py-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={picked.includes(o.id)}
                onChange={() => setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))}
              />
              <span className="min-w-0 break-words">
                Lệnh {o.orderNo} · {formatNumber(orderTotals(linesOfOrder(lines, o.id)).kg)} kg
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
