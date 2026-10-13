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
import ThanhPham141 from "./FinishedGoodScreen";
import { normalizeCatalogTab } from "@/lib/legacyUrls";



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
  const tab = normalizeCatalogTab(tabParam) ?? "products";
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
          <TabsTrigger value="products" title="Danh mục mặt hàng thực tế của xưởng — dùng khi ghi sản lượng, đóng gói và bán hàng.">Mặt hàng</TabsTrigger>
          <TabsTrigger value="customers" title="Khách mua thành phẩm, kèm thị trường (Nhật, EU, nội địa…).">Khách hàng</TabsTrigger>
          <TabsTrigger value="suppliers" title="Đại lý cung cấp nguyên liệu — dùng khi ghi chuyến nhập hàng.">Đại lý</TabsTrigger>
          <TabsTrigger value="material-types" title="Quy cách / size nguyên liệu, có gắn loài (bạch tuộc, mực, cá…).">Loại nguyên liệu</TabsTrigger>
          <TabsTrigger value="batters" title="Các loại bột tẩm (24V, 18V, 220H, 232, 20802…) — gắn vào mặt hàng tẩm bột để ghi kg bột theo từng loại.">Bột tẩm</TabsTrigger>
          <TabsTrigger value="storage-locations" title="Nơi hàng đang nằm: kho nhà và các kho lạnh thuê ngoài.">Kho lưu trữ</TabsTrigger>
          <TabsTrigger value="finished-goods" title="141 mã thành phẩm kế toán (TK 1551) — chỉ đọc, không sửa ở đây.">Thành phẩm (141 mã)</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="pt-6">
          <CatalogCrudFor cfg={c.matHang} rowMarkKey="danh-muc-mat-hang" />
        </TabsContent>

        <TabsContent value="customers" className="pt-6">
          <CatalogCrudFor cfg={c.khachHang} rowMarkKey="danh-muc-khach-hang" />
        </TabsContent>

        <TabsContent value="suppliers" className="pt-6">
          <CatalogCrudFor cfg={c.daiLy} rowMarkKey="danh-muc-dai-ly" />
        </TabsContent>

        <TabsContent value="material-types" className="pt-6">
          <CatalogCrudFor cfg={c.loaiNL} rowMarkKey="danh-muc-loai-nl" />
        </TabsContent>

        <TabsContent value="batters" className="pt-6">
          <CatalogCrudFor cfg={c.botTam} rowMarkKey="danh-muc-bot-tam" />
        </TabsContent>

        <TabsContent value="storage-locations" className="pt-6">
          <CatalogCrudFor cfg={c.khoLuu} rowMarkKey="danh-muc-kho-luu" />
        </TabsContent>

        <TabsContent value="finished-goods" className="pt-6">
          <ThanhPham141 />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Dựng CatalogCrud từ một cấu hình danh mục (giữ nguyên mọi prop cũ). */
function CatalogCrudFor<T extends { id: string }>({
  cfg,
  rowMarkKey,
}: {
  cfg: CatalogConfig<T>;
  /** Khoá bảng tô màu dòng — một khoá cho mỗi tab, đừng đổi (mất dấu cũ). */
  rowMarkKey: string;
}) {
  return (
    <CatalogCrud
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
