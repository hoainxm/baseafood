// ============================================================
// Tên file cũ: src/features/sales/BanHangTab.tsx
// Tên tiếng Việt: Tab chức năng Bán hàng
// Description: Sales Management Tab
// ============================================================
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import BanHangScreen from "./SalesScreen";
import BaoCaoBan from "./SalesReport";

/**
 * Bọc màn Bán hàng trong 2 tab: "Sổ bán hàng" (ghi/sửa phiếu) và "Báo cáo"
 * (tổng bán theo kỳ). Không đụng ruột màn ghi.
 */
export default function BanHangTab() {
  return (
    <Tabs defaultValue="so" className="space-y-6">
      <TabsList>
        <TabsTrigger value="so">Sổ bán hàng</TabsTrigger>
        <TabsTrigger value="bao-cao">Báo cáo</TabsTrigger>
      </TabsList>
      <TabsContent value="so">
        <BanHangScreen />
      </TabsContent>
      <TabsContent value="bao-cao">
        <BaoCaoBan />
      </TabsContent>
    </Tabs>
  );
}
