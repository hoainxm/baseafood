import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import BanHangScreen from "./BanHang";
import BaoCaoBan from "./BaoCaoBan";

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
