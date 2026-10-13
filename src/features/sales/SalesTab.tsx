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
    <Tabs defaultValue="so" className="space-y-6">
      <TabsList>
        <TabsTrigger value="so">Sổ bán hàng</TabsTrigger>
        <TabsTrigger value="bao-cao">Báo cáo</TabsTrigger>
      </TabsList>
      <TabsContent value="so">
        <SalesScreen />
      </TabsContent>
      <TabsContent value="bao-cao">
        <SalesReport />
      </TabsContent>
    </Tabs>
  );
}
