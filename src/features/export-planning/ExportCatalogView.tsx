// ============================================================
// Tên file: src/features/export-planning/ExportCatalogView.tsx
// Tên tiếng Việt: Tab Danh mục của trang Xuất khẩu — danh sách chọn, loại chứng từ, loại hàng
// Description: Export-planning catalog tab: option lists (mig 0095) + document kinds (0081) + goods types (0089)
// ============================================================
// Chị Thảo chọn (ba-spec 62 Q1 = B): mọi danh sách của Xuất khẩu quản lý ở MỘT tab riêng của trang, Loại
// chứng từ và Loại hàng chuyển từ màn Danh mục chung sang đây. Danh sách đổi bằng `?list=` (replace).
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import { CatalogCrudFor } from "@/features/catalog/CatalogCrudFor";
import { exportOptionListConfig, useCatalogConfigs } from "@/features/catalog/catalogConfig";
import { EXPORT_OPTION_LISTS } from "@/lib/exportOptions";
import type { ExportOptionListKind } from "@/types";

export type ExportCatalogList = ExportOptionListKind | "document-kinds" | "goods-types";

export const EXPORT_CATALOG_LISTS: readonly { value: ExportCatalogList; label: string; hint: string }[] = [
  ...EXPORT_OPTION_LISTS.map((l) => ({ value: l.kind, label: l.title, hint: l.description })),
  { value: "document-kinds", label: "Loại chứng từ", hint: "Loại chứng từ xuất khẩu (Commercial Invoice, B/L, H/C, C/O…) — thêm loại khách mới yêu cầu, đổi tên loại có sẵn." },
  { value: "goods-types", label: "Loại hàng", hint: "Loại hàng của dòng hàng hợp đồng xuất / nhập (1 da, 2 da, mada, cá khô…) — để lọc khi xuất Excel." },
];

export const normalizeExportCatalogList = (v: string | null): ExportCatalogList =>
  EXPORT_CATALOG_LISTS.find((l) => l.value === v)?.value ?? "loading-port";

export function ExportCatalogView({ list, onListChange }: { list: ExportCatalogList; onListChange: (v: ExportCatalogList) => void }) {
  const c = useCatalogConfigs();
  return (
    <Tabs value={list} onValueChange={(v) => onListChange(normalizeExportCatalogList(v))}>
      <TabsList data-tour="export-catalog-lists" className="w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto">
        {EXPORT_CATALOG_LISTS.map((l) => (
          <TabsTrigger key={l.value} value={l.value} title={l.hint}>
            {l.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {EXPORT_OPTION_LISTS.map((l) => (
        <TabsContent key={l.kind} value={l.kind} data-tour={`export-catalog-${l.kind}`} className="pt-4">
          <CatalogCrudFor cfg={exportOptionListConfig(c.exportOption, l.kind)} rowMarkKey={`export-options-${l.kind}`} resource="export-plans" />
        </TabsContent>
      ))}
      {/* Khóa tô màu dòng giữ như ở màn Danh mục cũ — không mất dấu đã tô. */}
      <TabsContent value="document-kinds" data-tour="export-catalog-document-kinds" className="pt-4">
        <CatalogCrudFor cfg={c.documentKind} rowMarkKey="export-document-kinds" resource="export-plans" />
      </TabsContent>
      <TabsContent value="goods-types" data-tour="export-catalog-goods-types" className="pt-4">
        <CatalogCrudFor cfg={c.goodsType} rowMarkKey="goods-types" resource="export-plans" />
      </TabsContent>
    </Tabs>
  );
}
