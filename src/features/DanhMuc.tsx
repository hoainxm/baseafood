import { useMemo, useState } from "react";
import type { DaiLy, KhachHang, LoaiNguyenLieu, MatHang } from "@/types";
import { LOAI } from "@/types";
import { uid } from "@/lib/db";
import {
  useDaiLy,
  useKhachHang,
  useLoaiNL,
  useMatHang,
  useThanhPham,
} from "@/lib/danhMuc";
import {
  Combobox,
  DanhMucCrud,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type TruongDanhMuc,
} from "@/design-system";
import ThanhPham141 from "@/features/ThanhPham";

const THI_TRUONG = ["Nhật", "EU", "Mỹ", "Hàn Quốc", "Trung Quốc", "Nội địa"];

/**
 * Một trang "Danh mục" cho tất cả danh sách dùng chung.
 *
 * Trước đây mỗi danh mục một mục điều hướng riêng → thanh điều hướng dài,
 * tên trang gần giống nhau, người dùng phải nhớ cái nào ở đâu.
 * Gộp lại: điều hướng còn 3 mục, mỗi mục là MỘT VIỆC rõ ràng.
 */
export default function DanhMucScreen() {
  const [tab, setTab] = useState("mat-hang");

  const [matHang, setMatHang] = useMatHang();
  const [khachHang, setKhachHang] = useKhachHang();
  const [daiLy, setDaiLy] = useDaiLy();
  const [loaiNL, setLoaiNL] = useLoaiNL();
  const [thanhPham] = useThanhPham();

  const optTP141 = useMemo(
    () =>
      thanhPham.map((t) => ({
        value: t.ma,
        label: t.ten,
        phu: `Mã ${t.ma} · ${t.nhom}`,
      })),
    [thanhPham]
  );

  const fMatHang: TruongDanhMuc<MatHang>[] = [
    {
      key: "ten",
      nhan: "Tên mặt hàng",
      batBuoc: true,
      viDu: "VD: 2 da cắt luộc 1000-1300",
    },
    { key: "ma", nhan: "Mã nội bộ", viDu: "Tự đặt (nếu cần)" },
    {
      key: "maTP",
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
        r.maTP ? (
          <span className="tnum">{r.maTP}</span>
        ) : (
          <span className="text-muted-foreground">Chưa ánh xạ</span>
        ),
    },
  ];

  const fKhachHang: TruongDanhMuc<KhachHang>[] = [
    { key: "ten", nhan: "Tên khách hàng", batBuoc: true, viDu: "VD: Lucky" },
    { key: "ma", nhan: "Mã nội bộ", viDu: "Tự đặt (nếu cần)" },
    {
      key: "thiTruong",
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

  const fDaiLy: TruongDanhMuc<DaiLy>[] = [
    { key: "ten", nhan: "Tên đại lý (gọi tắt)", batBuoc: true, viDu: "VD: Hồng Phú" },
    {
      key: "tenGhiPhieu",
      nhan: "Tên ghi phiếu (đầy đủ)",
      viDu: "VD: Công ty TNHH TM Hồng Phú",
    },
    {
      key: "diaChi",
      nhan: "Địa chỉ",
      anTrenDienThoai: true,
      viDu: "Số nhà, đường, phường, tỉnh",
    },
    {
      key: "cmnd",
      nhan: "CMND / CCCD / MST",
      anTrenDienThoai: true,
      viDu: "VD: 3500424848",
    },
    { key: "ngayCap", nhan: "Ngày cấp", anTrenDienThoai: true, viDu: "VD: 12/05/2015" },
    {
      key: "noiCap",
      nhan: "Nơi cấp",
      anTrenDienThoai: true,
      viDu: "VD: CA Bà Rịa - Vũng Tàu",
    },
    { key: "ma", nhan: "Mã nội bộ", anTrenDienThoai: true, viDu: "Tự đặt (nếu cần)" },
    {
      key: "dienThoai",
      nhan: "Điện thoại",
      anTrenDienThoai: true,
      viDu: "VD: 0913 xxx xxx",
    },
    { key: "ghiChu", nhan: "Ghi chú", anTrenDienThoai: true, viDu: "Ghi chú thêm" },
  ];

  const fLoaiNL: TruongDanhMuc<LoaiNguyenLieu>[] = [
    {
      key: "ten",
      nhan: "Tên loại nguyên liệu",
      batBuoc: true,
      viDu: "VD: 2 da nguyên liệu",
    },
    {
      key: "loai",
      nhan: "Loài",
      render: (giaTri, doiGiaTri) => (
        <Combobox
          label="Loài"
          hint="Bạch tuộc, Mực, Cá…"
          value={giaTri}
          onChange={doiGiaTri}
          options={LOAI.map((l) => ({ value: l, label: l }))}
          placeholder="— Chọn loài —"
        />
      ),
    },
    { key: "ghiChu", nhan: "Ghi chú", anTrenDienThoai: true, viDu: "Ghi chú thêm" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Danh mục</h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Các danh sách dùng chung cho toàn hệ thống. Khai đúng ở đây một lần thì
          mọi màn nhập liệu chỉ việc chọn — không ai gõ tay mỗi lần một kiểu nữa.
        </p>
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
            taoMoi={() => ({ id: uid(), ma: "", ten: "", maTP: "" })}
            timTheo={(r) => `${r.ma} ${r.ten} ${r.maTP}`}
            moTaBanGhi={(r) => `${r.ten}${r.ma ? ` (mã ${r.ma})` : ""}`}
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
            taoMoi={() => ({ id: uid(), ma: "", ten: "", thiTruong: "" })}
            timTheo={(r) => `${r.ma} ${r.ten} ${r.thiTruong}`}
            moTaBanGhi={(r) =>
              `${r.ten}${r.thiTruong ? ` — thị trường ${r.thiTruong}` : ""}`
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
              ma: "",
              ten: "",
              tenGhiPhieu: "",
              diaChi: "",
              cmnd: "",
              ngayCap: "",
              noiCap: "",
              dienThoai: "",
              ghiChu: "",
            })}
            timTheo={(r) =>
              `${r.ma} ${r.ten} ${r.tenGhiPhieu} ${r.diaChi} ${r.dienThoai}`
            }
            moTaBanGhi={(r) => r.ten}
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
            taoMoi={() => ({ id: uid(), ten: "", loai: "", ghiChu: "" })}
            timTheo={(r) => `${r.ten} ${r.loai}`}
            moTaBanGhi={(r) => `${r.ten}${r.loai ? ` (${r.loai})` : ""}`}
          />
        </TabsContent>

        <TabsContent value="tp-141" className="pt-6">
          <ThanhPham141 />
        </TabsContent>
      </Tabs>
    </div>
  );
}
