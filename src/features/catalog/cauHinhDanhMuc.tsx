// ============================================================
// Tên file: src/features/catalog/cauHinhDanhMuc.tsx
// Tên tiếng Việt: Cấu hình 5 danh mục (trường, kiểm tra, bản ghi rỗng) — MỘT nguồn
// Dùng chung cho màn Danh mục (DanhMucCrud) và hộp SỬA NHANH ở các màn nghiệp vụ
// (bút chì trong ô chọn — xem SuaDanhMucNhanh.tsx). Tách khỏi CatalogScreen.tsx
// ngày 2026-10-02, KHÔNG đổi trường / luật kiểm tra của màn Danh mục.
// ============================================================
import { useMemo } from "react";
import type { FinishedGood, Supplier, Customer, MaterialType, Product, StorageLocation } from "@/types";
import { CATEGORIES, KIEU_CHE_BIEN, STORAGE_KIND_LABELS, laCoTach, quyCachBlock } from "@/types";
import { newId as uid } from "@/lib/store";
import { num } from "@/lib/format";
import {
  useSuppliers,
  useCustomers,
  useMaterialTypes,
  useProducts,
  useFinishedGoods,
  useStorageLocations,
} from "@/lib/catalogRepo";
import {
  ChoiceGroup,
  Combobox,
  NumberField,
  type LoiNhap,
  type TruongDanhMuc,
} from "@/design-system";

const THI_TRUONG = ["Nhật", "EU", "Mỹ", "Hàn Quốc", "Trung Quốc", "Nội địa"];

export type LoaiDanhMuc = "matHang" | "khachHang" | "daiLy" | "loaiNL" | "khoLuu";

/** Đủ thứ để dựng màn CRUD một danh mục HOẶC hộp sửa nhanh một bản ghi. */
export interface CauHinhDanhMuc<T extends { id: string }> {
  tieuDe: string;
  moTa: string;
  tenDonVi: string;
  rows: T[];
  onChange: (next: T[]) => void;
  fields: TruongDanhMuc<T>[];
  taoMoi: () => T;
  timTheo: (r: T) => string;
  moTaBanGhi: (r: T) => string;
  kiemTraThem?: (dang: T, rows: T[], laThem: boolean) => LoiNhap[];
  dangTai: boolean;
  /** Trường TÊN của bản ghi. */
  truongTen: keyof T & string;
  /**
   * Sổ đã ghi nối với danh mục này bằng TÊN (không phải id) — đổi tên ở đây
   * KHÔNG đổi các dòng đã ghi. Hộp sửa nhanh khoá ô tên của loại này.
   * matHang nối bằng id ⇒ false.
   */
  noiTheoTen: boolean;
}

export interface BoCauHinhDanhMuc {
  matHang: CauHinhDanhMuc<Product>;
  khachHang: CauHinhDanhMuc<Customer>;
  daiLy: CauHinhDanhMuc<Supplier>;
  loaiNL: CauHinhDanhMuc<MaterialType>;
  khoLuu: CauHinhDanhMuc<StorageLocation>;
}

/** Cảnh báo khi mã số trùng với bản ghi khác (khách hàng / đại lý). Mã trống thì bỏ qua. */
export function trungMaSo<T extends { id: string; code: string }>(
  dang: T,
  rows: T[],
  tenDonVi: string
): { truong: string; thongBao: string }[] {
  const ma = (dang.code ?? "").trim();
  if (!ma) return [];
  const trung = rows.some((r) => r.id !== dang.id && (r.code ?? "").trim() === ma);
  return trung
    ? [
        {
          truong: "Mã số",
          thongBao: `Mã số "${ma}" đã dùng cho ${tenDonVi} khác — đổi số khác hoặc để trống.`,
        },
      ]
    : [];
}

/** Trùng TÊN (không phân hoa thường) với bản ghi khác — chỉ xét khi tên mới / vừa đổi. */
function trungTen<T extends { id: string }>(
  dang: T,
  rows: T[],
  truong: keyof T & string,
  nhan: string,
  tenDonVi: string
): LoiNhap[] {
  const ten = String(dang[truong] ?? "").trim().toLowerCase();
  if (!ten) return [];
  const cu = rows.find((r) => r.id === dang.id);
  if (cu && String(cu[truong] ?? "").trim().toLowerCase() === ten) return []; // không đổi tên
  return rows.some((r) => r.id !== dang.id && String(r[truong] ?? "").trim().toLowerCase() === ten)
    ? [
        {
          truong: nhan,
          thongBao: `Đã có ${tenDonVi} khác tên "${String(dang[truong]).trim()}" — chọn ${tenDonVi} đó thay vì đặt trùng tên.`,
        },
      ]
    : [];
}

/**
 * Bộ trường của 5 danh mục — hàm THUẦN (không hook): cần danh sách loại NL và
 * 141 mã TK 1551 để dựng ô chọn trong form mặt hàng.
 */
export function taoTruongDanhMuc(loaiNL: MaterialType[], thanhPham: FinishedGood[]) {
  const optTP141 = thanhPham.map((t) => ({
    value: t.code,
    label: t.name,
    phu: `Mã ${t.code} · ${t.groupName}`,
  }));

  const fMatHang: TruongDanhMuc<Product>[] = [
    {
      key: "name",
      nhan: "Tên mặt hàng",
      batBuoc: true,
      viDu: "VD: 2 da cắt luộc 1000-1300",
    },
    {
      key: "materialTypeId",
      anTrenBang: true,
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
          hint="Bạch tuộc, Mực, Cá… Đây là cấp gom nhóm khi ghi thành phẩm."
          value={giaTri}
          onChange={doiGiaTri}
          options={CATEGORIES.map((l) => ({ value: l, label: l }))}
          onCreate={(t) => t}
          placeholder="— Chọn loài —"
        />
      ),
      anTrenDienThoai: true,
    },
    {
      key: "processingType",
      nhan: "Kiểu chế biến",
      render: (giaTri, doiGiaTri) => (
        <Combobox
          label="Kiểu chế biến"
          hint="Luộc, chần, cắt, tẩm bột… Chưa có thì gõ rồi Thêm mới."
          value={giaTri}
          onChange={doiGiaTri}
          options={KIEU_CHE_BIEN.map((k) => ({ value: k, label: k }))}
          onCreate={(t) => t}
          placeholder="— Chọn kiểu chế biến —"
        />
      ),
      hienThi: (r) =>
        r.processingType || <span className="text-muted-foreground">—</span>,
      anTrenDienThoai: true,
    },
    {
      key: "splitComponents",
      anTrenBang: true,
      nhan: "Tách râu + bao tử",
      render: (giaTri, doiGiaTri) => {
        const on = giaTri === "1" || giaTri === "true";
        return (
          <ChoiceGroup
            label="Tách râu + bao tử (cùng giá)"
            hint="Bật nếu mã này khi làm ra tách 2 thành phần râu + bao tử cùng 1 giá — màn ghi thành phẩm sẽ hiện ô tách. Mã thường để 'Không tách'."
            value={on ? "1" : "0"}
            onChange={(v) => doiGiaTri(v === "1" ? "1" : "")}
            options={[
              { value: "1", label: "Có tách" },
              { value: "0", label: "Không tách" },
            ]}
            cot={2}
          />
        );
      },
      hienThi: (r) =>
        laCoTach(r) ? (
          "Có tách"
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      anTrenDienThoai: true,
    },
    {
      key: "blockSpecKg",
      anTrenBang: true,
      nhan: "Quy cách block (kg/khối)",
      render: (giaTri, doiGiaTri) => (
        <NumberField
          label="Quy cách mỗi block"
          unit="kg"
          hint="Kg mỗi khối khi đóng gói (VD 2, 5). Để trống nếu không cố định — màn ghi tính kg gợi ý = số block × quy cách."
          value={Number(giaTri) > 0 ? Number(giaTri) : null}
          onChange={(v) => doiGiaTri(v == null ? "" : String(v))}
        />
      ),
      hienThi: (r) => {
        const q = quyCachBlock(r);
        return q ? (
          `${num(q)} kg/khối`
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      anTrenDienThoai: true,
    },
    {
      key: "code",
      anTrenBang: true,
      nhan: "Mã số",
      anTrenDienThoai: true,
      goiY: "Nhập số để gọi nhanh. Gõ số này khi chọn mặt hàng là ra tên.",
      viDu: "VD: 12",
    },
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
    {
      key: "code",
      nhan: "Mã số",
      goiY: "Nhập số để gọi nhanh (VD: 1 = Hanwha). Gõ số này ở màn Bán hàng là ra tên.",
      viDu: "VD: 1",
    },
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
      anTrenBang: true,
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
    { key: "issuedDate", anTrenBang: true, nhan: "Ngày cấp", anTrenDienThoai: true, viDu: "VD: 12/05/2015" },
    {
      key: "issuedPlace",
      anTrenBang: true,
      nhan: "Nơi cấp",
      anTrenDienThoai: true,
      viDu: "VD: CA Bà Rịa - Vũng Tàu",
    },
    {
      key: "code",
      anTrenBang: true,
      nhan: "Mã số",
      anTrenDienThoai: true,
      goiY: "Nhập số để gọi nhanh. Gõ số này ở màn Nhập hàng là ra tên.",
      viDu: "VD: 1",
    },
    {
      key: "phone",
      nhan: "Điện thoại",
      anTrenDienThoai: true,
      viDu: "VD: 0913 xxx xxx",
    },
    { key: "note", anTrenBang: true, nhan: "Ghi chú", anTrenDienThoai: true, viDu: "Ghi chú thêm" },
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

  const fKhoLuu: TruongDanhMuc<StorageLocation>[] = [
    { key: "code", nhan: "Mã số", viDu: "VD: KHP" },
    {
      key: "name",
      nhan: "Tên kho",
      batBuoc: true,
      viDu: "VD: Kho Hồng Phú",
      goiY: "Tên này là chỗ nối dữ liệu — đổi tên ở đây KHÔNG tự đổi các dòng đã gán.",
    },
    {
      key: "kind",
      nhan: "Loại kho",
      render: (giaTri, doiGiaTri) => (
        <Combobox
          label="Loại kho"
          hint="Kho nhà = kho của xí nghiệp; kho thuê ngoài = kho lạnh gửi hàng."
          value={giaTri || "noi-bo"}
          onChange={doiGiaTri}
          choPhepXoa={false}
          options={(Object.keys(STORAGE_KIND_LABELS) as (keyof typeof STORAGE_KIND_LABELS)[]).map(
            (k) => ({ value: k, label: STORAGE_KIND_LABELS[k] })
          )}
        />
      ),
      hienThi: (r) => STORAGE_KIND_LABELS[r.kind] ?? r.kind,
    },
    { key: "address", nhan: "Địa chỉ", anTrenDienThoai: true, viDu: "VD: Hồng Phú, Bà Rịa" },
    { key: "phone", anTrenBang: true, nhan: "Điện thoại", anTrenDienThoai: true, viDu: "VD: 0254 123 456" },
    { key: "note", anTrenBang: true, nhan: "Ghi chú", anTrenDienThoai: true, viDu: "Ghi chú thêm" },
  ];

  return {
    matHang: fMatHang,
    khachHang: fKhachHang,
    daiLy: fDaiLy,
    loaiNL: fLoaiNL,
    khoLuu: fKhoLuu,
  };
}

/** Nguồn dữ liệu của một danh mục — PHẢI là đúng instance `useBang` của màn đang mở. */
export interface NguonDanhMuc<T> {
  rows: T[];
  onChange: (next: T[]) => void;
  dangTai: boolean;
}

/** Ráp cấu hình đầy đủ từ bộ trường + nguồn dữ liệu của từng danh mục. */
export function taoCauHinhDanhMuc(
  truong: ReturnType<typeof taoTruongDanhMuc>,
  n: {
    matHang: NguonDanhMuc<Product>;
    khachHang: NguonDanhMuc<Customer>;
    daiLy: NguonDanhMuc<Supplier>;
    loaiNL: NguonDanhMuc<MaterialType>;
    khoLuu: NguonDanhMuc<StorageLocation>;
  }
): BoCauHinhDanhMuc {
  return {
    matHang: {
      tieuDe: "Mặt hàng cân đối",
      moTa: "Mặt hàng dùng khi ghi bán thành phẩm sản xuất trong bảng cân đối.",
      tenDonVi: "mặt hàng",
      rows: n.matHang.rows,
      onChange: n.matHang.onChange,
      fields: truong.matHang,
      dangTai: n.matHang.dangTai,
      kiemTraThem: (dang, rows) => [
        ...trungMaSo(dang, rows, "mặt hàng"),
        ...trungTen(dang, rows, "name", "Tên mặt hàng", "mặt hàng"),
      ],
      taoMoi: () => ({
        id: uid(),
        code: "",
        name: "",
        finishedGoodCode: "",
        category: "",
        materialTypeId: "",
        processingType: "",
        splitComponents: false,
        blockSpecKg: null,
      }),
      timTheo: (r) => `${r.code} ${r.name} ${r.finishedGoodCode}`,
      moTaBanGhi: (r) => `${r.name}${r.code ? ` (mã ${r.code})` : ""}`,
      truongTen: "name",
      noiTheoTen: false,
    },
    khachHang: {
      tieuDe: "Khách hàng",
      moTa: "Khách mua thành phẩm (đầu ra) — khác với đại lý cung cấp nguyên liệu.",
      tenDonVi: "khách hàng",
      rows: n.khachHang.rows,
      onChange: n.khachHang.onChange,
      fields: truong.khachHang,
      dangTai: n.khachHang.dangTai,
      kiemTraThem: (dang, rows) => trungMaSo(dang, rows, "khách hàng"),
      taoMoi: () => ({ id: uid(), code: "", name: "", market: "" }),
      timTheo: (r) => `${r.code} ${r.name} ${r.market}`,
      moTaBanGhi: (r) => `${r.name}${r.market ? ` — thị trường ${r.market}` : ""}`,
      truongTen: "name",
      // Bán hàng/đơn đặt nối theo id, nhưng sản lượng /wip lưu customerName.
      noiTheoTen: true,
    },
    daiLy: {
      tieuDe: "Đại lý cung cấp nguyên liệu",
      moTa: "Nơi giao hàng về xưởng — dùng khi ghi chuyến nguyên liệu hàng ngày.",
      tenDonVi: "đại lý",
      rows: n.daiLy.rows,
      onChange: n.daiLy.onChange,
      fields: truong.daiLy,
      dangTai: n.daiLy.dangTai,
      kiemTraThem: (dang, rows) => trungMaSo(dang, rows, "đại lý"),
      taoMoi: () => ({
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
      }),
      timTheo: (r) => `${r.code} ${r.shortName} ${r.billingName} ${r.address} ${r.phone}`,
      moTaBanGhi: (r) => r.shortName,
      truongTen: "shortName",
      noiTheoTen: true, // import_shipments.supplier_name
    },
    loaiNL: {
      tieuDe: "Loại nguyên liệu",
      moTa: "Quy cách / size nguyên liệu. Đã nạp sẵn các loại thường gặp trong sổ.",
      tenDonVi: "loại nguyên liệu",
      rows: n.loaiNL.rows,
      onChange: n.loaiNL.onChange,
      fields: truong.loaiNL,
      dangTai: n.loaiNL.dangTai,
      taoMoi: () => ({ id: uid(), name: "", category: "", note: "" }),
      timTheo: (r) => `${r.name} ${r.category}`,
      moTaBanGhi: (r) => `${r.name}${r.category ? ` (${r.category})` : ""}`,
      truongTen: "name",
      noiTheoTen: true, // dòng nhập lưu materialTypeName
    },
    khoLuu: {
      tieuDe: "Kho lưu trữ",
      moTa: "Nơi hàng đang nằm: kho nhà (Kho Baseafood — tổng trong kho) và các kho lạnh thuê ngoài (Kho Hồng Phú, Kho Ánh Dương…). Dùng ở cột 'Kho lưu' của báo cáo Xuất–Nhập–Tồn.",
      tenDonVi: "kho lưu trữ",
      rows: n.khoLuu.rows,
      onChange: n.khoLuu.onChange,
      fields: truong.khoLuu,
      dangTai: n.khoLuu.dangTai,
      kiemTraThem: (dang, rows) => [
        ...trungMaSo(dang, rows, "kho lưu trữ"),
        ...(rows.some(
          (r) =>
            r.id !== dang.id &&
            r.name.trim().toLowerCase() === (dang.name ?? "").trim().toLowerCase()
        )
          ? [
              {
                truong: "Tên kho",
                thongBao: `Tên "${dang.name}" đã có kho khác dùng — tên là chỗ nối dữ liệu nên không được trùng.`,
              },
            ]
          : []),
      ],
      taoMoi: (): StorageLocation => ({
        id: uid(),
        code: "",
        name: "",
        kind: "thue-ngoai",
        address: "",
        phone: "",
        note: "",
      }),
      timTheo: (r) => `${r.code} ${r.name} ${r.address} ${r.phone}`,
      moTaBanGhi: (r) => `${r.name} (${STORAGE_KIND_LABELS[r.kind] ?? r.kind})`,
      truongTen: "name",
      noiTheoTen: true, // storageLocation lưu theo tên
    },
  };
}

/** Cấu hình 5 danh mục cho màn Danh mục — gọi trong component (dùng hook catalogRepo). */
export function useCauHinhDanhMuc(): BoCauHinhDanhMuc {
  const [matHang, setMatHang, { trangThai: ttMH }] = useProducts();
  const [khachHang, setKhachHang, { trangThai: ttKH }] = useCustomers();
  const [daiLy, setDaiLy, { trangThai: ttDL }] = useSuppliers();
  const [loaiNL, setLoaiNL, { trangThai: ttNL }] = useMaterialTypes();
  const [khoLuu, setKhoLuu, { trangThai: ttKL }] = useStorageLocations();
  const [thanhPham] = useFinishedGoods();

  const taiMH = ttMH === "dang-tai" && matHang.length === 0;
  const taiKH = ttKH === "dang-tai" && khachHang.length === 0;
  const taiDL = ttDL === "dang-tai" && daiLy.length === 0;
  const taiNL = ttNL === "dang-tai" && loaiNL.length === 0;
  const taiKL = ttKL === "dang-tai" && khoLuu.length === 0;

  const truong = useMemo(() => taoTruongDanhMuc(loaiNL, thanhPham), [loaiNL, thanhPham]);
  return taoCauHinhDanhMuc(truong, {
    matHang: { rows: matHang, onChange: setMatHang, dangTai: taiMH },
    khachHang: { rows: khachHang, onChange: setKhachHang, dangTai: taiKH },
    daiLy: { rows: daiLy, onChange: setDaiLy, dangTai: taiDL },
    loaiNL: { rows: loaiNL, onChange: setLoaiNL, dangTai: taiNL },
    khoLuu: { rows: khoLuu, onChange: setKhoLuu, dangTai: taiKL },
  });
}
