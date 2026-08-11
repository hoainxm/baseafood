// ============================================================
// Tên file cũ: src/features/imports/NhapHangTab.tsx
// Tên tiếng Việt: Tab chức năng Nhập hàng
// Description: Material Import Management Tab
// ============================================================
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import NhapNguyenLieuScreen from "./MaterialImportScreen";
import BaoCaoNhap from "./ImportReport";

/**
 * Bọc màn Nhập hàng trong 2 tab: "Sổ nhập hàng" (ghi/sửa) và "Báo cáo" (tổng
 * hợp theo kỳ). Tách phần nhập liệu khỏi phần xem tổng — không đụng ruột màn ghi.
 */
export default function NhapHangTab() {
  return (
    <Tabs defaultValue="so" className="space-y-6">
      <TabsList>
        <TabsTrigger value="so">Sổ nhập hàng</TabsTrigger>
        <TabsTrigger value="bao-cao">Báo cáo</TabsTrigger>
      </TabsList>
      <TabsContent value="so">
        <NhapNguyenLieuScreen />
      </TabsContent>
      <TabsContent value="bao-cao">
        <BaoCaoNhap />
      </TabsContent>
    </Tabs>
  );
}
