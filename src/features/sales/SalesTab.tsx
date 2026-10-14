// ============================================================
// Tên file cũ: src/features/sales/SalesTab.tsx
// Tên tiếng Việt: Tab chức năng Bán hàng
// Description: Sales Management Tab
// ============================================================
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import SalesScreen from "./SalesScreen";
import SalesReport from "./SalesReport";

/**
 * Bọc màn Bán hàng trong 2 tab: "Sổ bán hàng" (ghi/sửa phiếu) và "Báo cáo"
 * (tổng bán theo kỳ). Không đụng ruột màn ghi.
 */
export default function SalesTab() {
  return (
    <Tabs defaultValue="ledger" className="space-y-6">
      <TabsList>
        <TabsTrigger value="ledger">Sổ bán hàng</TabsTrigger>
        <TabsTrigger value="report">Báo cáo</TabsTrigger>
      </TabsList>
      <TabsContent value="ledger">
        <SalesScreen />
      </TabsContent>
      <TabsContent value="report">
        <SalesReport />
      </TabsContent>
    </Tabs>
  );
}
