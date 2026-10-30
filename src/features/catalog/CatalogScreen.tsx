// ============================================================
// Tên file cũ: src/features/catalog/DanhMuc.tsx
// Tên tiếng Việt: Màn hình Quản lý Danh mục chung
// Description: Master Catalog Management Screen
// ============================================================
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  CatalogCrud,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/design-system";
import { useCatalogConfigs, type CatalogConfig } from "./catalogConfig";
import FinishedGoodScreen from "./FinishedGoodScreen";
import { normalizeCatalogTab } from "@/lib/legacyUrls";
import { useCan, usePermissions } from "@/features/shared/PermissionProvider";
import { can } from "@/lib/permissions";
import { useCustomerProductNameStore, useExportContractApprovals, useExportContractRevisions, useExportContracts, useExportFiles, useExportStepItems } from "@/lib/catalogRepo";
import { namesOfCustomer } from "@/lib/customerProductNames";
import type { Customer } from "@/types";
import { Languages } from "lucide-react";
import { CustomerProductNamesDialog } from "./CustomerProductNamesDialog";
import { usePageTour } from "@/features/shared/PageTourProvider";
import { buildCatalogTour } from "./catalogTour";

/** Tab ⇄ tài nguyên phân quyền (lib/permissions.ts) — mỗi tab quyền riêng. */
const TAB_RESOURCE: Record<string, string> = {
  products: "catalog.products",
  customers: "catalog.customers",
  suppliers: "catalog.suppliers",
  // NCC nhập khẩu (mig 0083, ba-spec 45 v2) — khác Đại lý của Nhập hàng.
  "import-suppliers": "catalog.import-suppliers",
  "material-types": "catalog.material-types",
  batters: "catalog.batters",
  "storage-locations": "catalog.storage-locations",
  // Loại chứng từ xuất khẩu (mig 0081) — thuộc khu Xuất khẩu, quyền theo export-plans.
  "document-kinds": "export-plans",
  // Loại hàng (mig 0089) — dòng hàng HĐ xuất / nhập, quyền theo export-plans.
  "goods-types": "export-plans",
  "finished-goods": "catalog.finished-goods",
};



/**
 * Một trang "Danh mục" cho tất cả danh sách dùng chung.
 *
 * Trước đây mỗi danh mục một mục điều hướng riêng → thanh điều hướng dài,
 * tên trang gần giống nhau, người dùng phải nhớ cái nào ở đâu.
 * Gộp lại: điều hướng còn 3 mục, mỗi mục là MỘT VIỆC rõ ràng.
 */

export default function CatalogScreen() {
  // Tab điều khiển bằng URL (?tab=) để deep-link từ nav module mở đúng tab —
  // vẫn MỘT nguồn danh mục duy nhất, chỉ đổi tab đang xem.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") ?? "";
  // Tab cũ tiếng Việt (?tab=dai-ly…) vẫn mở đúng tab — lib/legacyUrls.
  const perms = usePermissions();
  const canViewTab = (t: string) => can(perms, TAB_RESOURCE[t], "view");
  // Tab không có quyền xem ⇒ ẩn; mở link tới tab đó thì về tab đầu tiên được xem.
  const requestedTab = normalizeCatalogTab(tabParam) ?? "products";
  const tab = canViewTab(requestedTab) ? requestedTab : (Object.keys(TAB_RESOURCE).find(canViewTab) ?? requestedTab);
  const setTab = (t: string) =>
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        // Xoá RIÊNG key "tab" (mặc định products), giữ nguyên param khác nếu sau này có.
        if (t === "products") p.delete("tab");
        else p.set("tab", t);
        return p;
      },
      { replace: true }
    );

  // Hướng dẫn thao tác (ba-spec 43): bước của từng tab chỉ đổi ?tab= (replace), không ghi.
  // Tour chụp lúc bắt đầu ⇒ đổi tab qua ref luôn trỏ hàm MỚI NHẤT (giữ đúng tham số khác).
  const setTabRef = useRef(setTab);
  useEffect(() => {
    setTabRef.current = setTab;
  });
  const canWriteAny = Object.values(TAB_RESOURCE).some((r) => can(perms, r, "create") || can(perms, r, "update") || can(perms, r, "delete"));
  const tour = useMemo(() => buildCatalogTour({ canWrite: canWriteAny, setTab: (t) => setTabRef.current(t) }), [canWriteAny]);
  usePageTour(tour);

  const c = useCatalogConfigs();
  // Tên hàng trên chứng từ theo khách (mig 0077, ba-spec 41 v6) — nút riêng ở mỗi dòng khách.
  const nameStore = useCustomerProductNameStore();
  const customerCan = useCan("catalog.customers");
  const [namesFor, setNamesFor] = useState<Customer | null>(null);
  // Hợp đồng xuất khẩu — nguồn của "Trích xuất từ chứng từ" (người không xem được Xuất khẩu ⇒ mảng rỗng).
  const [exportContracts] = useExportContracts();
  const [exportRevisions] = useExportContractRevisions();
  const [exportApprovals] = useExportContractApprovals();
  // Mục Commercial Invoice + file đã đính — "Trích xuất từ chứng từ" đọc thêm invoice Excel / PDF (R27).
  const [exportItems] = useExportStepItems();
  const [exportFiles] = useExportFiles();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Danh mục</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        {/* 6 tab: hẹp thì XUỐNG HÀNG thay vì cuộn ngang khuất tab cuối. */}
        <TabsList data-tour="catalog-tabs" className="w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto">
          {canViewTab("products") && <TabsTrigger value="products" title="Danh mục mặt hàng thực tế của xưởng — dùng khi ghi sản lượng, đóng gói và bán hàng.">Mặt hàng</TabsTrigger>}
          {canViewTab("customers") && <TabsTrigger value="customers" title="Khách mua thành phẩm, kèm thị trường (Nhật, EU, nội địa…).">Khách hàng</TabsTrigger>}
          {canViewTab("suppliers") && <TabsTrigger value="suppliers" title="Đại lý cung cấp nguyên liệu — dùng khi ghi chuyến nhập hàng.">Đại lý</TabsTrigger>}
          {canViewTab("import-suppliers") && <TabsTrigger value="import-suppliers" title="Nhà cung cấp nước ngoài (và bên thuê gia công) của mảng Nhập khẩu — khác Đại lý của Nhập hàng.">NCC nhập khẩu</TabsTrigger>}
          {canViewTab("material-types") && <TabsTrigger value="material-types" title="Quy cách / size nguyên liệu, có gắn loài (bạch tuộc, mực, cá…).">Loại nguyên liệu</TabsTrigger>}
          {canViewTab("batters") && <TabsTrigger value="batters" title="Các loại bột tẩm (24V, 18V, 220H, 232, 20802…) — gắn vào mặt hàng tẩm bột để ghi kg bột theo từng loại.">Bột tẩm</TabsTrigger>}
          {canViewTab("storage-locations") && <TabsTrigger value="storage-locations" title="Nơi hàng đang nằm: kho nhà và các kho lạnh thuê ngoài.">Kho lưu trữ</TabsTrigger>}
          {canViewTab("document-kinds") && <TabsTrigger value="document-kinds" title="Loại chứng từ xuất khẩu (Commercial Invoice, B/L, H/C, C/O…) — thêm loại khách mới yêu cầu, đổi tên loại có sẵn.">Loại chứng từ</TabsTrigger>}
          {canViewTab("goods-types") && <TabsTrigger value="goods-types" title="Loại hàng của dòng hàng hợp đồng (1 da, 2 da, mada, cá khô…) — để lọc khi xuất Excel.">Loại hàng</TabsTrigger>}
          {canViewTab("finished-goods") && <TabsTrigger value="finished-goods" title="141 mã thành phẩm kế toán (TK 1551) — chỉ đọc, không sửa ở đây.">Thành phẩm (141 mã)</TabsTrigger>}
        </TabsList>

        <TabsContent value="products" data-tour="catalog-products" className="pt-6">
          <CatalogCrudFor cfg={c.product} rowMarkKey="danh-muc-mat-hang" resource={TAB_RESOURCE["products"]} />
        </TabsContent>

        <TabsContent value="customers" data-tour="catalog-customers" className="pt-6">
          <CatalogCrudFor
            cfg={c.customer}
            rowMarkKey="danh-muc-khach-hang"
            resource={TAB_RESOURCE["customers"]}
            rowActions={(k) => (
              <Button size="sm" variant="outline" onClick={() => setNamesFor(k)} title={`Xem / sửa tên hàng ${k.name} dùng trên hợp đồng, invoice xuất khẩu (theo từng mặt hàng, size).`}>
                <Languages />
                Tên hàng ({namesOfCustomer(nameStore.names, k.id).length})
              </Button>
            )}
          />
          <CustomerProductNamesDialog
            customer={namesFor}
            names={nameStore.names}
            setNames={nameStore.setNames}
            products={c.product.rows}
            setProducts={c.product.onChange}
            isAvailable={nameStore.isAvailable}
            canWrite={customerCan.create || customerCan.update}
            canDelete={customerCan.delete}
            extractSource={{ contracts: exportContracts, revisions: exportRevisions, approvals: exportApprovals, items: exportItems, files: exportFiles }}
            onClose={() => setNamesFor(null)}
          />
        </TabsContent>

        <TabsContent value="suppliers" data-tour="catalog-suppliers" className="pt-6">
          <CatalogCrudFor cfg={c.supplier} rowMarkKey="danh-muc-dai-ly" resource={TAB_RESOURCE["suppliers"]} />
        </TabsContent>
        <TabsContent value="import-suppliers" data-tour="catalog-import-suppliers" className="pt-6">
          <CatalogCrudFor cfg={c.importSupplier} rowMarkKey="import-suppliers" resource={TAB_RESOURCE["import-suppliers"]} />
        </TabsContent>

        <TabsContent value="material-types" data-tour="catalog-material-types" className="pt-6">
          <CatalogCrudFor cfg={c.materialType} rowMarkKey="danh-muc-loai-nl" resource={TAB_RESOURCE["material-types"]} />
        </TabsContent>

        <TabsContent value="batters" data-tour="catalog-batters" className="pt-6">
          <CatalogCrudFor cfg={c.batter} rowMarkKey="danh-muc-bot-tam" resource={TAB_RESOURCE["batters"]} />
        </TabsContent>

        <TabsContent value="storage-locations" data-tour="catalog-storage-locations" className="pt-6">
          <CatalogCrudFor cfg={c.storageLocation} rowMarkKey="danh-muc-kho-luu" resource={TAB_RESOURCE["storage-locations"]} />
        </TabsContent>

        <TabsContent value="document-kinds" data-tour="catalog-document-kinds" className="pt-6">
          <CatalogCrudFor cfg={c.documentKind} rowMarkKey="export-document-kinds" resource={TAB_RESOURCE["document-kinds"]} />
        </TabsContent>

        <TabsContent value="goods-types" data-tour="catalog-goods-types" className="pt-6">
          <CatalogCrudFor cfg={c.goodsType} rowMarkKey="goods-types" resource={TAB_RESOURCE["goods-types"]} />
        </TabsContent>

        <TabsContent value="finished-goods" data-tour="catalog-finished-goods" className="pt-6">
          <FinishedGoodScreen />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Dựng CatalogCrud từ một cấu hình danh mục (giữ nguyên mọi prop cũ). */
function CatalogCrudFor<T extends { id: string }>({
  cfg,
  rowMarkKey,
  resource,
  rowActions,
}: {
  cfg: CatalogConfig<T>;
  /** Nút riêng của từng dòng (VD "Tên hàng" của khách). */
  rowActions?: (row: T) => ReactNode;
  /** Khoá bảng tô màu dòng — một khoá cho mỗi tab, đừng đổi (mất dấu cũ). */
  rowMarkKey: string;
  /** Tài nguyên phân quyền của tab (catalog.*). */
  resource: string;
}) {
  const allowed = useCan(resource);
  return (
    <CatalogCrud
      canCreate={allowed.create}
      canUpdate={allowed.update}
      canDelete={allowed.delete}
      canDeleteRow={cfg.canDeleteRow}
      rowMarkKey={rowMarkKey}
      loading={cfg.loading}
      title={cfg.title}
      description={cfg.description}
      entityName={cfg.entityName}
      rows={cfg.rows}
      onChange={cfg.onChange}
      fields={cfg.fields}
      validate={cfg.validate}
      createEmpty={cfg.createEmpty}
      getSearchText={cfg.getSearchText}
      getRecordDescription={cfg.getRecordDescription}
      rowActions={rowActions}
    />
  );
}
