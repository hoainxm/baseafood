// ============================================================
// Tên file: src/features/export-planning/ExportOrderComposer.tsx
// Tên tiếng Việt: Lập Lệnh xuất hàng (Word mẫu QTI-KH-01-07) từ một chuyến xuất
// Description: Wires one export shipment into the generic document composer (ba-spec 72 NV1): source = issued
//              production orders of the shipment (fallback: shipment goods lines) + booking; "previous" = same
//              customer (workshops + Có / Không notes carry over); exporting Word attaches the file to "Lệnh xuất".
// ============================================================
import { useCallback, useMemo } from "react";
import { DocumentComposerView } from "@/features/document-composer";
import { useProductionOrderLines, useProductionOrderShipments, useProductionOrders } from "@/lib/catalogRepo";
import { buildExportOrderLines, exportOrderForm, exportOrderPreviousKey, newExportOrderDocument, type ExportOrderFormSource } from "@/lib/documentTypes/exportOrderForm";
import { currentContractLineId, workingRevision, type ExportData } from "@/lib/exportPlanning";
import type { DocumentValues, ExportContract, ExportShipment } from "@/types";

export function ExportOrderComposer({
  data,
  shipment,
  contract,
  customerName,
  canWrite,
  isAdmin,
  by,
  onBack,
  onExported,
}: {
  data: ExportData;
  shipment: ExportShipment;
  contract: ExportContract;
  customerName: string;
  canWrite: boolean;
  isAdmin: boolean;
  by: string;
  onBack: () => void;
  onExported: (file: Uint8Array, fileName: string, values: DocumentValues) => void;
}) {
  const [orders] = useProductionOrders();
  const [orderLines] = useProductionOrderLines();
  const [links] = useProductionOrderShipments();
  const { source, notices } = useMemo((): { source: ExportOrderFormSource; notices: string[] } => {
    const linked = new Set(links.filter((l) => l.shipmentId === shipment.id).map((l) => l.orderId));
    // Dòng HĐ của mọi HĐ có hàng trên chuyến (chuyến gộp — ba-spec 70) để tra size + HS code.
    const linkedOrders = orders.filter((o) => linked.has(o.id));
    const contractIds = new Set([
      shipment.contractId,
      ...(data.shipmentLines ?? []).filter((l) => l.shipmentId === shipment.id).map((l) => l.contractId),
      ...linkedOrders.map((o) => o.contractId),
    ]);
    const contractLines = [...contractIds].flatMap((id) => workingRevision(data, id)?.lines ?? []);
    const built = buildExportOrderLines({
      shipment,
      orders: linkedOrders,
      // Dòng lệnh trỏ id dòng của bản HĐ lúc lập lệnh ⇒ nối sang bản đang dùng, cùng id với Hàng của chuyến.
      orderLines: orderLines.map((l) => {
        const o = linkedOrders.find((x) => x.id === l.orderId);
        const to = o ? currentContractLineId(data, o.contractId, l.contractLineId) : l.contractLineId;
        return to === l.contractLineId ? l : { ...l, contractLineId: to };
      }),
      contractLines,
      shipmentLines: data.shipmentLines ?? [],
    });
    const source = {
      shipment,
      contractNo: contract.contractNo,
      customerName,
      rows: built.rows,
    };
    return { source, notices: built.notices };
  }, [links, orders, orderLines, shipment, contract.contractNo, customerName, data]);
  const previousKey = useMemo(() => exportOrderPreviousKey(source), [source]);
  const isSourceLive = useCallback((id: string) => data.shipments.some((s) => s.id === id && s.status !== "cancelled"), [data.shipments]);
  const label = [contract.contractNo && `HĐ ${contract.contractNo}`, shipment.lotCode && `lô ${shipment.lotCode}`].filter(Boolean).join(" · ");
  return (
    <DocumentComposerView
      type={exportOrderForm}
      source={source}
      sourceId={shipment.id}
      sourceTitle={label || "Chuyến chưa có mã lô"}
      sourceRevisionNo={0}
      sourceLive={shipment.status !== "cancelled"}
      previousKey={previousKey}
      isSourceLive={isSourceLive}
      newDocument={(state, meta) => newExportOrderDocument(source, state, meta)}
      onExported={onExported}
      notices={notices}
      canWrite={canWrite}
      isAdmin={isAdmin}
      by={by}
      onBack={onBack}
    />
  );
}
