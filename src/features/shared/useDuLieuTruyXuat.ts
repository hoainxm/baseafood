// ============================================================
// Gom các bảng mà truy xuất lô cần thành MỘT đối tượng `DuLieuTruyXuat`
// (lib/truyXuatLo.ts là hàm thuần, nhận dữ liệu qua tham số).
// ============================================================
import { useMemo } from "react";
import {
  useCustomers,
  useExportItems,
  useExportOrders,
  useImportShipments,
  useLotInputs,
  useMaterialImports,
  usePackagings,
  useProducts,
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

  const dl: DuLieuTruyXuat = useMemo(
    () => ({
      shipments, imports, wips, packagings, lotInputs,
      exportItems, exportOrders, salesOrders, products, customers,
    }),
    [shipments, imports, wips, packagings, lotInputs, exportItems, exportOrders, salesOrders, products, customers]
  );
  return { dl, lotInputs, luuLotInputs };
}
