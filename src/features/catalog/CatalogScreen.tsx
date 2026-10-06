// ============================================================
// Tên file cũ: src/features/catalog/DanhMuc.tsx
// Tên tiếng Việt: Màn hình Quản lý Danh mục chung
// Description: Master Catalog Management Screen
// ============================================================
import { useSearchParams } from "react-router-dom";
import {
  DanhMucCrud,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/design-system";
import { useCauHinhDanhMuc, type CauHinhDanhMuc } from "./cauHinhDanhMuc";
import ThanhPham141 from "./FinishedGoodScreen";



/**
 * Một trang "Danh mục" cho tất cả danh sách dùng chung.
 *
 * Trước đây mỗi danh mục một mục điều hướng riêng → thanh điều hướng dài,
 * tên trang gần giống nhau, người dùng phải nhớ cái nào ở đâu.
 * Gộp lại: điều hướng còn 3 mục, mỗi mục là MỘT VIỆC rõ ràng.
 */
/** Tab hợp lệ — deep-link từ nav module (VD /catalog?tab=dai-ly) mở đúng tab. */
const TABS = ["mat-hang", "khach-hang", "dai-ly", "loai-nl", "bot-tam", "kho-luu", "tp-141"];

export default function DanhMucScreen() {
  // Tab điều khiển bằng URL (?tab=) để deep-link từ nav module mở đúng tab —
  // vẫn MỘT nguồn danh mục duy nhất, chỉ đổi tab đang xem.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") ?? "";
  const tab = TABS.includes(tabParam) ? tabParam : "mat-hang";
  const setTab = (t: string) =>
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        // Xoá RIÊNG key "tab" (mặc định mat-hang), giữ nguyên param khác nếu sau này có.
        if (t === "mat-hang") p.delete("tab");
        else p.set("tab", t);
        return p;
      },
      { replace: true }
    );

  const c = useCauHinhDanhMuc();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Danh mục</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        {/* 6 tab: hẹp thì XUỐNG HÀNG thay vì cuộn ngang khuất tab cuối. */}
        <TabsList className="w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto">
          <TabsTrigger value="mat-hang" title="Danh mục mặt hàng thực tế của xưởng — dùng khi ghi sản lượng, đóng gói và bán hàng.">Mặt hàng</TabsTrigger>
          <TabsTrigger value="khach-hang" title="Khách mua thành phẩm, kèm thị trường (Nhật, EU, nội địa…).">Khách hàng</TabsTrigger>
          <TabsTrigger value="dai-ly" title="Đại lý cung cấp nguyên liệu — dùng khi ghi chuyến nhập hàng.">Đại lý</TabsTrigger>
          <TabsTrigger value="loai-nl" title="Quy cách / size nguyên liệu, có gắn loài (bạch tuộc, mực, cá…).">Loại nguyên liệu</TabsTrigger>
          <TabsTrigger value="bot-tam" title="Các loại bột tẩm (24V, 18V, 220H, 232, 20802…) — gắn vào mặt hàng tẩm bột để ghi kg bột theo từng loại.">Bột tẩm</TabsTrigger>
          <TabsTrigger value="kho-luu" title="Nơi hàng đang nằm: kho nhà và các kho lạnh thuê ngoài.">Kho lưu trữ</TabsTrigger>
          <TabsTrigger value="tp-141" title="141 mã thành phẩm kế toán (TK 1551) — chỉ đọc, không sửa ở đây.">Thành phẩm (141 mã)</TabsTrigger>
        </TabsList>

        <TabsContent value="mat-hang" className="pt-6">
          <DanhMucCrudTheo cfg={c.matHang} />
        </TabsContent>

        <TabsContent value="khach-hang" className="pt-6">
          <DanhMucCrudTheo cfg={c.khachHang} />
        </TabsContent>

        <TabsContent value="dai-ly" className="pt-6">
          <DanhMucCrudTheo cfg={c.daiLy} />
        </TabsContent>

        <TabsContent value="loai-nl" className="pt-6">
          <DanhMucCrudTheo cfg={c.loaiNL} />
        </TabsContent>

        <TabsContent value="bot-tam" className="pt-6">
          <DanhMucCrudTheo cfg={c.botTam} />
        </TabsContent>

        <TabsContent value="kho-luu" className="pt-6">
          <DanhMucCrudTheo cfg={c.khoLuu} />
        </TabsContent>

        <TabsContent value="tp-141" className="pt-6">
          <ThanhPham141 />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Dựng DanhMucCrud từ một cấu hình danh mục (giữ nguyên mọi prop cũ). */
function DanhMucCrudTheo<T extends { id: string }>({ cfg }: { cfg: CauHinhDanhMuc<T> }) {
  return (
    <DanhMucCrud
      dangTai={cfg.dangTai}
      tieuDe={cfg.tieuDe}
      moTa={cfg.moTa}
      tenDonVi={cfg.tenDonVi}
      rows={cfg.rows}
      onChange={cfg.onChange}
      fields={cfg.fields}
      kiemTraThem={cfg.kiemTraThem}
      taoMoi={cfg.taoMoi}
      timTheo={cfg.timTheo}
      moTaBanGhi={cfg.moTaBanGhi}
    />
  );
}
