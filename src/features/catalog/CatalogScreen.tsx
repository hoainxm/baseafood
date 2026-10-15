// ============================================================
// Tên file cũ: src/features/catalog/DanhMuc.tsx
// Tên tiếng Việt: Màn hình Quản lý Danh mục chung
// Description: Master Catalog Management Screen
// ============================================================
import { useSearchParams } from "react-router-dom";
import {
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

/** Tab ⇄ tài nguyên phân quyền (lib/permissions.ts) — mỗi tab quyền riêng. */
const TAB_RESOURCE: Record<string, string> = {
  products: "catalog.products",
  customers: "catalog.customers",
  suppliers: "catalog.suppliers",
  "material-types": "catalog.material-types",
  batters: "catalog.batters",
  "storage-locations": "catalog.storage-locations",
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

  const c = useCatalogConfigs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Danh mục</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        {/* 6 tab: hẹp thì XUỐNG HÀNG thay vì cuộn ngang khuất tab cuối. */}
        <TabsList className="w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto">
          {canViewTab("products") && <TabsTrigger value="products" title="Danh mục mặt hàng thực tế của xưởng — dùng khi ghi sản lượng, đóng gói và bán hàng.">Mặt hàng</TabsTrigger>}
          {canViewTab("customers") && <TabsTrigger value="customers" title="Khách mua thành phẩm, kèm thị trường (Nhật, EU, nội địa…).">Khách hàng</TabsTrigger>}
          {canViewTab("suppliers") && <TabsTrigger value="suppliers" title="Đại lý cung cấp nguyên liệu — dùng khi ghi chuyến nhập hàng.">Đại lý</TabsTrigger>}
          {canViewTab("material-types") && <TabsTrigger value="material-types" title="Quy cách / size nguyên liệu, có gắn loài (bạch tuộc, mực, cá…).">Loại nguyên liệu</TabsTrigger>}
          {canViewTab("batters") && <TabsTrigger value="batters" title="Các loại bột tẩm (24V, 18V, 220H, 232, 20802…) — gắn vào mặt hàng tẩm bột để ghi kg bột theo từng loại.">Bột tẩm</TabsTrigger>}
          {canViewTab("storage-locations") && <TabsTrigger value="storage-locations" title="Nơi hàng đang nằm: kho nhà và các kho lạnh thuê ngoài.">Kho lưu trữ</TabsTrigger>}
          {canViewTab("finished-goods") && <TabsTrigger value="finished-goods" title="141 mã thành phẩm kế toán (TK 1551) — chỉ đọc, không sửa ở đây.">Thành phẩm (141 mã)</TabsTrigger>}
        </TabsList>

        <TabsContent value="products" className="pt-6">
          <CatalogCrudFor cfg={c.product} rowMarkKey="danh-muc-mat-hang" resource={TAB_RESOURCE["products"]} />
        </TabsContent>

        <TabsContent value="customers" className="pt-6">
          <CatalogCrudFor cfg={c.customer} rowMarkKey="danh-muc-khach-hang" resource={TAB_RESOURCE["customers"]} />
        </TabsContent>

        <TabsContent value="suppliers" className="pt-6">
          <CatalogCrudFor cfg={c.supplier} rowMarkKey="danh-muc-dai-ly" resource={TAB_RESOURCE["suppliers"]} />
        </TabsContent>

        <TabsContent value="material-types" className="pt-6">
          <CatalogCrudFor cfg={c.materialType} rowMarkKey="danh-muc-loai-nl" resource={TAB_RESOURCE["material-types"]} />
        </TabsContent>

        <TabsContent value="batters" className="pt-6">
          <CatalogCrudFor cfg={c.batter} rowMarkKey="danh-muc-bot-tam" resource={TAB_RESOURCE["batters"]} />
        </TabsContent>

        <TabsContent value="storage-locations" className="pt-6">
          <CatalogCrudFor cfg={c.storageLocation} rowMarkKey="danh-muc-kho-luu" resource={TAB_RESOURCE["storage-locations"]} />
        </TabsContent>

        <TabsContent value="finished-goods" className="pt-6">
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
}: {
  cfg: CatalogConfig<T>;
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
    />
  );
}
