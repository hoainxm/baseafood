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

export function useTraceData() {
  const [shipments, , { status: shipmentsStatus }] = useImportShipments();
  const [imports, , { status: importsStatus }] = useMaterialImports();
  const [wips, , { status: wipsStatus }] = useWipProductions();
  const [packagings, , { status: packagingsStatus }] = usePackagings();
  const [lotInputs, saveLotInputs, { status: lotInputsStatus }] = useLotInputs();
  const [exportItems, , { status: exportItemsStatus }] = useExportItems();
  const [exportOrders, , { status: exportOrdersStatus }] = useExportOrders();
  const [salesOrders, , { status: salesOrdersStatus }] = useSalesOrders();
  const [products, , { status: productsStatus }] = useProducts();
  const [customers, , { status: customersStatus }] = useCustomers();
  const [salesItems, , { status: salesItemsStatus }] = useSalesItems();
  const [salesInvoices, , { status: salesInvoicesStatus }] = useSalesInvoices();
  const [domesticSales, , { status: domesticSalesStatus }] = useDomesticSales();
  const [lotDispatches, saveLotDispatches, { status: lotDispatchesStatus }] = useLotDispatches();
  const [lotWaivers, saveLotWaivers, { status: lotWaiversStatus }] = useLotWaivers();
  const [labelPrints, , { status: labelPrintsStatus }] = useLabelPrints();
  const [materialTypes, , { status: materialTypesStatus }] = useMaterialTypes();

  const traceData: TraceData = useMemo(
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
  /**
   * Mọi sổ đã nạp xong từ máy chủ (không còn đang tải, không lỗi). Màn nào SUY RA rồi GHI
   * (vd "Việc của tôi" tự đóng việc đã sửa xong) phải đợi cờ này — đang tải dở thì sổ trống,
   * suy ra sai.
   */
  const isReady = [shipmentsStatus, importsStatus, wipsStatus, packagingsStatus, lotInputsStatus, exportItemsStatus, exportOrdersStatus, salesOrdersStatus, productsStatus, customersStatus, salesItemsStatus, salesInvoicesStatus, domesticSalesStatus, lotDispatchesStatus, lotWaiversStatus, labelPrintsStatus, materialTypesStatus].every((x) => x === "ready");
  return { traceData, isReady, lotInputs, saveLotInputs, lotDispatches, saveLotDispatches, lotWaivers, saveLotWaivers };
}
