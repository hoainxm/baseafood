// ============================================================
// Tên file: src/features/production-orders/useOrderCoverage.ts
// Tên tiếng Việt: Số kg đã ra lệnh sản xuất của từng dòng hàng HĐ xuất (cột "Đã ra lệnh")
// Description: Hook for the export contract dossier (ba-spec 48 R4): ordered vs contract kg per contract
//              line from non-cancelled production orders. Null when the viewer cannot see orders.
// ============================================================
import { useCallback } from "react";
import { useCan } from "@/features/shared/PermissionProvider";
import { useProductionOrderLines, useProductionOrders } from "@/lib/catalogRepo";
import { contractLineCoverage, visibleOrders, type ContractLineCoverage } from "@/lib/productionOrder";
import type { ExportContractLine } from "@/types";

export function useOrderCoverage(): ((line: ExportContractLine, tolerancePct: number | null) => ContractLineCoverage) | null {
  const can = useCan("production-orders");
  const [orders] = useProductionOrders();
  const [lines] = useProductionOrderLines();
  const coverage = useCallback(
    (line: ExportContractLine, tolerancePct: number | null) => contractLineCoverage(line, tolerancePct, visibleOrders(orders, can.create || can.update), lines),
    [orders, lines, can.create, can.update],
  );
  return can.view ? coverage : null;
}
