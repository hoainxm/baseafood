// ============================================================
// Gom các bảng mà truy xuất lô cần thành MỘT đối tượng `TraceData`
// (lib/lotTraceability.ts là hàm thuần, nhận dữ liệu qua tham số).
// ============================================================
import { useMemo } from "react";
import {
  useCustomers,
  useDomesticSales,
  useExportItems,
  useExportOrders,
  useImportShipments,
  useLabelPrints,
  useLotDispatches,
  useLotInputs,
  useLotWaivers,
  useMaterialImports,
  useMaterialTypes,
  usePackagings,
  useProducts,
  useSalesInvoices,
  useSalesItems,
  useSalesOrders,
  useWipProductions,
} from "@/lib/catalogRepo";
import type { TraceData } from "@/lib/lotTraceability";

export function useDuLieuTruyXuat() {
  const [shipments] = useImportShipments();
  const [imports] = useMaterialImports();
  const [wips] = useWipProductions();
  const [packagings] = usePackagings();
  const [lotInputs, saveLotInputs] = useLotInputs();
  const [exportItems] = useExportItems();
  const [exportOrders] = useExportOrders();
  const [salesOrders] = useSalesOrders();
  const [products] = useProducts();
  const [customers] = useCustomers();
  const [salesItems] = useSalesItems();
  const [salesInvoices] = useSalesInvoices();
  const [domesticSales] = useDomesticSales();
  const [lotDispatches, saveLotDispatches] = useLotDispatches();
  const [lotWaivers, saveLotWaivers] = useLotWaivers();
  const [labelPrints] = useLabelPrints();
  const [materialTypes] = useMaterialTypes();

  const dl: TraceData = useMemo(
    () => ({
      shipments, imports, wips, packagings, lotInputs,
      exportItems, exportOrders, salesOrders, products, customers,
      salesItems, salesInvoices, domesticSales, lotDispatches, lotWaivers, labelPrints, materialTypes,
    }),
    [
      shipments, imports, wips, packagings, lotInputs, exportItems, exportOrders, salesOrders, products, customers,
      salesItems, salesInvoices, domesticSales, lotDispatches, lotWaivers, labelPrints, materialTypes,
    ]
  );
  return { dl, lotInputs, luuLotInputs: saveLotInputs, lotDispatches, luuLotDispatches: saveLotDispatches, lotWaivers, luuLotWaivers: saveLotWaivers };
}
