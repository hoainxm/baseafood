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
import { buildExportOrderRows, exportOrderForm, exportOrderPreviousKey, newExportOrderDocument, type ExportOrderFormSource } from "@/lib/documentTypes/exportOrderForm";
import { workingRevision, type ExportData } from "@/lib/exportPlanning";
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
  const source: ExportOrderFormSource = useMemo(() => {
    const linked = new Set(links.filter((l) => l.shipmentId === shipment.id).map((l) => l.orderId));
    // Dòng HĐ của mọi HĐ có hàng trên chuyến (chuyến gộp — ba-spec 70) để tra size + HS code.
    const contractIds = new Set([shipment.contractId, ...(data.shipmentLines ?? []).filter((l) => l.shipmentId === shipment.id).map((l) => l.contractId)]);
    const contractLines = [...contractIds].flatMap((id) => workingRevision(data, id)?.lines ?? []);
    return {
      shipment,
      contractNo: contract.contractNo,
      customerName,
      rows: buildExportOrderRows({
        shipment,
        orders: orders.filter((o) => linked.has(o.id)),
        orderLines,
        contractLines,
        shipmentLines: data.shipmentLines ?? [],
      }),
    };
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
      canWrite={canWrite}
      isAdmin={isAdmin}
      by={by}
      onBack={onBack}
    />
  );
}
