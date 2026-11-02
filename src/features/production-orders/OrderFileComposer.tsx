// ============================================================
// Tên file: src/features/production-orders/OrderFileComposer.tsx
// Tên tiếng Việt: Soạn file Lệnh sản xuất (Word / PDF) từ lệnh trên app
// Description: Wires one production order into the generic document composer (ba-spec 54): source = the order + its
//              lines (R2), "previous" = same customer + product of line 1, cancelled order ⇒ read-only (R11).
// ============================================================
import { useCallback, useMemo } from "react";
import { DocumentComposerView } from "@/features/document-composer";
import { newComposedDocument, previousKeyOf, productionOrderForm } from "@/lib/documentTypes/productionOrderForm";
import { linesOfOrder } from "@/lib/productionOrder";
import type { ProductionOrder } from "@/types";
import type { ProductionOrderData } from "./useProductionOrderData";

export function OrderFileComposer({
  data,
  order,
  canWrite,
  isAdmin,
  by,
  onBack,
}: {
  data: ProductionOrderData;
  order: ProductionOrder;
  canWrite: boolean;
  isAdmin: boolean;
  by: string;
  onBack: () => void;
}) {
  const source = useMemo(() => ({ order, lines: [...linesOfOrder(data.lines, order.id)].sort((a, b) => a.lineNo - b.lineNo) }), [data.lines, order]);
  const key = useMemo(() => previousKeyOf(source), [source]);
  const previousKey = useMemo(() => ({ customerKey: key.customerKey, productId: key.productId }), [key.customerKey, key.productId]);
  const isSourceLive = useCallback((id: string) => data.orders.some((o) => o.id === id && o.status !== "cancelled"), [data.orders]);
  return (
    <DocumentComposerView
      type={productionOrderForm}
      source={source}
      sourceId={order.id}
      sourceTitle={`Lệnh sản xuất ${order.orderNo}`}
      sourceRevisionNo={order.revisionNo}
      sourceLive={order.status !== "cancelled"}
      previousKey={previousKey}
      isSourceLive={isSourceLive}
      newDocument={(state, meta) => newComposedDocument(source, state, meta)}
      canWrite={canWrite}
      isAdmin={isAdmin}
      by={by}
      onBack={onBack}
    />
  );
}
