// ============================================================
// Tên file cũ: src/features/catalog/DanhMuc.tsx
// Tên tiếng Việt: Màn hình Quản lý Danh mục chung
// Description: Master Catalog Management Screen
// ============================================================
import { useMemo, useState } from "react";
import type { Supplier, Customer, MaterialType, Product } from "@/types";
import { CATEGORIES } from "@/types";
import { uid } from "@/lib/db";
import {
  useSuppliers,
  useCustomers,
  useMaterialTypes,
  useProducts,
  useFinishedGoods,
} from "@/lib/catalogRepo";
import {
  Combobox,
  DanhMucCrud,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type TruongDanhMuc,
} from "@/design-system";
import ThanhPham141 from "./FinishedGoodScreen";

const THI_TRUONG = ["Nhật", "EU", "Mỹ", "Hàn Quốc", "Trung Quốc", "Nội địa"];

/** Nhóm/loài của thành phẩm 141 — dùng cho ô Loài của mặt hàng. */
const NHOM_TP = ["Bạch tuộc", "Mực", "Cá", "Tôm", "Bào ngư", "Khác"];

/**
 * Một trang "Danh mục" cho tất cả danh sách dùng chung.
 *
 * Trước đây mỗi danh mục một mục điều hướng riêng → thanh điều hướng dài,
 * tên trang gần giống nhau, người dùng phải nhớ cái nào ở đâu.
 * Gộp lại: điều hướng còn 3 mục, mỗi mục là MỘT VIỆC rõ ràng.
 */
export default function DanhMucScreen() {
  const [tab, setTab] = useState("mat-hang");

  const [matHang, setMatHang] = useProducts();
  const [khachHang, setKhachHang] = useCustomers();
  const [daiLy, setDaiLy] = useSuppliers();
  const [loaiNL, setLoaiNL] = useMaterialTypes();
  const [thanhPham] = useFinishedGoods();

  const optTP141 = useMemo(
    () =>
      thanhPham.map((t) => ({
        value: t.code,
        label: t.name,
        phu: `Mã ${t.code} · ${t.groupName}`,
      })),
    [thanhPham]
  );

  const fMatHang: TruongDanhMuc<Product>[] = [
    {
      key: "name",
      nhan: "Tên mặt hàng",
      batBuoc: true,
      viDu: "VD: 2 da cắt luộc 1000-1300",
    },
    {
      key: "materialTypeId",
      nhan: "Loại nguyên liệu",
      render: (giaTri, doiGiaTri) => (
        <Combobox
          label="Loại nguyên liệu"
          hint="Thành phẩm này thuộc loại NL nào (VD Bạch tuộc 2 da) — để lọc khi ghi sản lượng."
          value={giaTri}
          onChange={doiGiaTri}
          options={loaiNL.map((l) => ({
            value: l.id,
            label: l.name,
            phu: l.category || undefined,
          }))}
          placeholder="— Chọn loại nguyên liệu —"
          emptyText="Chưa có loại NL — thêm ở tab Loại nguyên liệu."
        />
      ),
      hienThi: (r) =>
        loaiNL.find((l) => l.id === r.materialTypeId)?.name || (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "category",
      nhan: "Loài",
      render: (giaTri, doiGiaTri) => (
        <Combobox
          label="Loài"
          hint="Bạch tuộc, Mực, Cá…"
          value={giaTri}
          onChange={doiGiaTri}
          options={NHOM_TP.map((n) => ({ value: n, label: n }))}
          onCreate={(t) => t}
          placeholder="— Chọn loài —"
        />
      ),
      anTrenDienThoai: true,
    },
    { key: "code", nhan: "Mã nội bộ", anTrenDienThoai: true, viDu: "Tự đặt (nếu cần)" },
    {
      key: "finishedGoodCode",
      nhan: "Mã thành phẩm (danh mục kế toán)",
      anTrenDienThoai: false,
      render: (giaTri, doiGiaTri) => (
        <Combobox
          label="Mã thành phẩm (danh mục kế toán)"
          hint={`Gõ tên hoặc mã để tìm trong ${thanhPham.length} mã. Bỏ trống nếu chưa ánh xạ.`}
          value={giaTri}
          onChange={doiGiaTri}
          options={optTP141}
          placeholder="— Chưa ánh xạ —"
          emptyText="Không có mã nào khớp."
        />
      ),
      hienThi: (r) =>
        r.finishedGoodCode ? (
          <span className="tnum">{r.finishedGoodCode}</span>
        ) : (
          <span className="text-muted-foreground">Chưa ánh xạ</span>
        ),
    },
  ];

  const fKhachHang: TruongDanhMuc<Customer>[] = [
    { key: "name", nhan: "Tên khách hàng", batBuoc: true, viDu: "VD: Lucky" },
    { key: "code", nhan: "Mã nội bộ", viDu: "Tự đặt (nếu cần)" },
    {
      key: "market",
      nhan: "Thị trường",
      render: (giaTri, doiGiaTri) => (
        <Combobox
          label="Thị trường"
          hint="Chọn trong danh sách, hoặc gõ tên mới rồi bấm Thêm mới."
          value={giaTri}
          onChange={doiGiaTri}
          options={THI_TRUONG.map((t) => ({ value: t, label: t }))}
          onCreate={(ten) => ten}
          placeholder="— Chọn thị trường —"
        />
      ),
    },
  ];

  const fDaiLy: TruongDanhMuc<Supplier>[] = [
    { key: "shortName", nhan: "Tên đại lý (gọi tắt)", batBuoc: true, viDu: "VD: Hồng Phú" },
    {
      key: "billingName",
      nhan: "Tên ghi phiếu (đầy đủ)",
      viDu: "VD: Công ty TNHH TM Hồng Phú",
    },
    {
      key: "address",
      nhan: "Địa chỉ",
      anTrenDienThoai: true,
      viDu: "Số nhà, đường, phường, tỉnh",
    },
    {
      key: "nationalId",
      nhan: "CMND / CCCD / MST",
      anTrenDienThoai: true,
      viDu: "VD: 3500424848",
    },
    { key: "issuedDate", nhan: "Ngày cấp", anTrenDienThoai: true, viDu: "VD: 12/05/2015" },
    {
      key: "issuedPlace",
      nhan: "Nơi cấp",
      anTrenDienThoai: true,
      viDu: "VD: CA Bà Rịa - Vũng Tàu",
    },
    { key: "code", nhan: "Mã nội bộ", anTrenDienThoai: true, viDu: "Tự đặt (nếu cần)" },
    {
      key: "phone",
      nhan: "Điện thoại",
      anTrenDienThoai: true,
      viDu: "VD: 0913 xxx xxx",
    },
    { key: "note", nhan: "Ghi chú", anTrenDienThoai: true, viDu: "Ghi chú thêm" },
  ];

  const fLoaiNL: TruongDanhMuc<MaterialType>[] = [
    {
      key: "name",
      nhan: "Tên loại nguyên liệu",
      batBuoc: true,
      viDu: "VD: 2 da nguyên liệu",
    },
    {
      key: "category",
      nhan: "Loài",
      render: (giaTri, doiGiaTri) => (
        <Combobox
          label="Loài"
          hint="Bạch tuộc, Mực, Cá…"
          value={giaTri}
          onChange={doiGiaTri}
          options={CATEGORIES.map((l) => ({ value: l, label: l }))}
          placeholder="— Chọn loài —"
        />
      ),
    },
    { key: "note", nhan: "Ghi chú", anTrenDienThoai: true, viDu: "Ghi chú thêm" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Danh mục</h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="mat-hang">Mặt hàng</TabsTrigger>
          <TabsTrigger value="khach-hang">Khách hàng</TabsTrigger>
          <TabsTrigger value="dai-ly">Đại lý</TabsTrigger>
          <TabsTrigger value="loai-nl">Loại nguyên liệu</TabsTrigger>
          <TabsTrigger value="tp-141">Thành phẩm (141 mã)</TabsTrigger>
        </TabsList>

        <TabsContent value="mat-hang" className="pt-6">
          <DanhMucCrud
            tieuDe="Mặt hàng cân đối"
            moTa="Mặt hàng dùng khi ghi bán thành phẩm sản xuất trong bảng cân đối."
            tenDonVi="mặt hàng"
            rows={matHang}
            onChange={setMatHang}
            fields={fMatHang}
            taoMoi={() => ({
              id: uid(),
              code: "",
              name: "",
              finishedGoodCode: "",
              category: "",
              materialTypeId: "",
            })}
            timTheo={(r) => `${r.code} ${r.name} ${r.finishedGoodCode}`}
            moTaBanGhi={(r) => `${r.name}${r.code ? ` (mã ${r.code})` : ""}`}
          />
        </TabsContent>

        <TabsContent value="khach-hang" className="pt-6">
          <DanhMucCrud
            tieuDe="Khách hàng"
            moTa="Khách mua thành phẩm (đầu ra) — khác với đại lý cung cấp nguyên liệu."
            tenDonVi="khách hàng"
            rows={khachHang}
            onChange={setKhachHang}
            fields={fKhachHang}
            taoMoi={() => ({ id: uid(), code: "", name: "", market: "" })}
            timTheo={(r) => `${r.code} ${r.name} ${r.market}`}
            moTaBanGhi={(r) =>
              `${r.name}${r.market ? ` — thị trường ${r.market}` : ""}`
            }
          />
        </TabsContent>

        <TabsContent value="dai-ly" className="pt-6">
          <DanhMucCrud
            tieuDe="Đại lý cung cấp nguyên liệu"
            moTa="Nơi giao hàng về xưởng — dùng khi ghi chuyến nguyên liệu hàng ngày."
            tenDonVi="đại lý"
            rows={daiLy}
            onChange={setDaiLy}
            fields={fDaiLy}
            taoMoi={() => ({
              id: uid(),
              code: "",
              shortName: "",
              billingName: "",
              address: "",
              nationalId: "",
              issuedDate: "",
              issuedPlace: "",
              phone: "",
              note: "",
            })}
            timTheo={(r) =>
              `${r.code} ${r.shortName} ${r.billingName} ${r.address} ${r.phone}`
            }
            moTaBanGhi={(r) => r.shortName}
          />
        </TabsContent>

        <TabsContent value="loai-nl" className="pt-6">
          <DanhMucCrud
            tieuDe="Loại nguyên liệu"
            moTa="Quy cách / size nguyên liệu. Đã nạp sẵn các loại thường gặp trong sổ."
            tenDonVi="loại nguyên liệu"
            rows={loaiNL}
            onChange={setLoaiNL}
            fields={fLoaiNL}
            taoMoi={() => ({ id: uid(), name: "", category: "", note: "" })}
            timTheo={(r) => `${r.name} ${r.category}`}
            moTaBanGhi={(r) => `${r.name}${r.category ? ` (${r.category})` : ""}`}
          />
        </TabsContent>

        <TabsContent value="tp-141" className="pt-6">
          <ThanhPham141 />
        </TabsContent>
      </Tabs>
    </div>
  );
}
