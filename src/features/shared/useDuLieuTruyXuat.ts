// ============================================================
// Gom các bảng mà truy xuất lô cần thành MỘT đối tượng `DuLieuTruyXuat`
// (lib/truyXuatLo.ts là hàm thuần, nhận dữ liệu qua tham số).
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
import type { DuLieuTruyXuat } from "@/lib/truyXuatLo";

export function useDuLieuTruyXuat() {
  const [shipments] = useImportShipments();
  const [imports] = useMaterialImports();
  const [wips] = useWipProductions();
  const [packagings] = usePackagings();
  const [lotInputs, luuLotInputs] = useLotInputs();
  const [exportItems] = useExportItems();
  const [exportOrders] = useExportOrders();
  const [salesOrders] = useSalesOrders();
  const [products] = useProducts();
  const [customers] = useCustomers();
  const [salesItems] = useSalesItems();
  const [salesInvoices] = useSalesInvoices();
  const [domesticSales] = useDomesticSales();
  const [lotDispatches, luuLotDispatches] = useLotDispatches();
  const [lotWaivers, luuLotWaivers] = useLotWaivers();
  const [labelPrints] = useLabelPrints();
  const [materialTypes] = useMaterialTypes();

  const dl: DuLieuTruyXuat = useMemo(
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
  return { dl, lotInputs, luuLotInputs, lotDispatches, luuLotDispatches, lotWaivers, luuLotWaivers };
}
