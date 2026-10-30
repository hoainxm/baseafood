// ============================================================
// Tên file: src/features/production-orders/useProductionOrderData.ts
// Tên tiếng Việt: Gom dữ liệu màn Lệnh sản xuất — 4 bảng lệnh + HĐ / chuyến xuất + lần nhập khẩu
// Description: Loads the 4 production-order tables (mig 0088) plus the export (contracts, revisions,
//              shipments) and import (receipts, receipt lines) data the order screen reads.
// ============================================================
import { useMemo } from "react";
import {
  isMissingTableError,
  isServerConnected,
  useCustomers,
  useProductionOrderLines,
  useProductionOrderMaterials,
  useProductionOrderShipments,
  useProductionOrders,
  useProducts,
} from "@/lib/catalogRepo";
import { useExportData } from "@/features/export-planning/useExportData";
import { useImportData } from "@/features/import-planning/useImportData";

const ro =
  <T,>(write: (rows: T[]) => boolean) =>
  (rows: readonly T[]): boolean =>
    write([...rows]);

export function useProductionOrderData() {
  const [orders, saveOrders, ordersMeta] = useProductionOrders();
  const [lines, saveLines] = useProductionOrderLines();
  const [materials, saveMaterials] = useProductionOrderMaterials();
  const [links, saveLinks] = useProductionOrderShipments();
  const exportStore = useExportData();
  const importStore = useImportData();
  const [products, setProducts] = useProducts();
  const [customers] = useCustomers();

  const data = useMemo(
    () => ({
      orders,
      lines,
      materials,
      links,
      exportData: exportStore.data,
      receipts: importStore.data.receipts,
      receiptLines: importStore.data.receiptLines,
      importLines: importStore.data.lines,
      products,
      customers,
    }),
    [orders, lines, materials, links, exportStore.data, importStore.data, products, customers],
  );

  return {
    data,
    /** Máy chủ chưa chạy 0088 ⇒ không ghi (khỏi kẹt hàng chờ). */
    isAvailable: !isServerConnected || (ordersMeta.status !== "loading" && !isMissingTableError(ordersMeta.error)),
    isLoading: ordersMeta.status === "loading" && orders.length === 0,
    loadError: isMissingTableError(ordersMeta.error) ? null : (ordersMeta.error ?? null),
    saveOrders: ro(saveOrders),
    saveLines: ro(saveLines),
    saveMaterials: ro(saveMaterials),
    saveLinks: ro(saveLinks),
    saveShipments: exportStore.saveShipments,
    setProducts,
  };
}

export type ProductionOrderStore = ReturnType<typeof useProductionOrderData>;
export type ProductionOrderData = ProductionOrderStore["data"];
