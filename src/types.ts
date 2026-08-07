export interface ThanhPham {
  ma: string;
  ten: string;
  dvt: string;
  maTk: string;
  nhom: string;
}

export type PhanXuong = "Đông" | "Cá" | "Khô";

/* ---------- Người dùng & phân quyền ---------- */

/** Vai trò — `admin` full quyền; rỗng = chưa gán (chỉ đăng nhập được, chưa dùng gì). */
export type VaiTro = "admin" | "giam-doc" | "ke-toan" | "to-truong" | "";

export const VAI_TRO: { value: VaiTro; label: string }[] = [
  { value: "admin", label: "Quản trị (full quyền)" },
  { value: "giam-doc", label: "Giám đốc" },
  { value: "ke-toan", label: "Kế toán" },
  { value: "to-truong", label: "Tổ trưởng" },
];

/**
 * Hồ sơ người dùng — 1-1 với tài khoản Supabase Auth (`id` = auth user id).
 * Tài khoản đăng nhập (email tổng hợp `<username>@bsf1.local` + mật khẩu) tạo ở
 * Supabase Dashboard; app tự tạo hồ sơ này lần đầu đăng nhập, admin gán vai trò.
 */
export interface NguoiDung {
  id: string; // = auth.users.id
  hoTen: string;
  username: string;
  vaiTro: VaiTro;
}

/** Loài nguyên liệu — ghi rõ, không để mặc định ngầm "bạch tuộc". */
export const LOAI = [
  "Bạch tuộc",
  "Mực",
  "Cá",
  "Tôm",
  "Ghẹ",
  "Khác",
] as const;
export type Loai = (typeof LOAI)[number];

/**
 * Một chuyến hàng = MỘT đại lý đổ hàng MỘT lượt (một xe), gồm nhiều dòng loại
 * hàng. Trước đây chuyến chỉ được gom ngầm theo (ngày + đại lý + xe) nên cùng
 * một đại lý giao hai lượt trong ngày bị đếm thành một.
 *
 * Hai ngày tách riêng — kế toán vẫn phân biệt như vậy:
 *   - `ngayGiao`  : hàng thực về xưởng. MỌI tổng hợp (sổ ngày, cân đối, báo cáo
 *                   tháng) đều tính theo ngày này.
 *   - `ngayGhiSo` : ngày ghi vào hệ thống. Hàng về 29/7 mà 31/7 mới có chứng từ
 *                   thì ngayGiao = 29/7, ngayGhiSo = 31/7 → dòng mang nhãn
 *                   "Ghi bù", tổng ngày 29/7 vẫn đúng và giải trình được vì sao
 *                   khác bản đã chốt hôm 29/7.
 */
export interface ChuyenNhap {
  id: string;
  ngayGiao: string; // yyyy-mm-dd — hàng thực về xưởng
  ngayGhiSo: string; // yyyy-mm-dd — ngày ghi vào hệ thống
  lyDoGhiBu: string; // bắt buộc khi ngayGhiSo > ngayGiao
  phanXuong: PhanXuong;
  daiLy: string;
  taiXe: string;
  bienSoXe: string;
  ghiChu: string;
}

/** Chuyến ghi sau ngày hàng về ⇒ ghi bù (cần lý do, hiện nhãn trên sổ). */
export function laGhiBu(c: Pick<ChuyenNhap, "ngayGiao" | "ngayGhiSo">): boolean {
  return Boolean(c.ngayGhiSo) && c.ngayGhiSo > c.ngayGiao;
}

/** Một dòng nhập nguyên liệu hàng ngày — theo sổ "Báo cáo tổng hợp nguyên liệu hàng ngày". */
export interface DongNhapNL {
  id: string;
  chuyenId: string; // rỗng = dữ liệu cũ, gom ngầm theo (ngày + đại lý + xe)
  ngay: string; // yyyy-mm-dd — NGÀY GIAO (chép từ chuyến để tổng hợp nhanh)
  phanXuong: PhanXuong;
  loai: Loai; // loài: bạch tuộc / mực / cá… — ghi rõ
  daiLy: string;
  loaiNL: string; // quy cách/size, VD "2 da nl 80 trên"
  soLuongKg: number;
  donGia: number | null;
  taiXe: string;
  bienSoXe: string;
  ghiChu: string;
}

/** Thành tiền = số lượng × đơn giá. */
export function thanhTien(r: Pick<DongNhapNL, "soLuongKg" | "donGia">): number {
  return r.soLuongKg * (r.donGia ?? 0);
}

/**
 * Chốt số liệu nhập hàng của một (ngày + phân xưởng) — thay mốc "cộng tay xong
 * là số ngày này đúng". Đã chốt thì không sửa/xóa/thêm chuyến thường nữa; chỉ
 * còn hai đường: **ghi bù** (có lý do) hoặc **mở lại** cả ngày.
 *
 * `tongKgLucChot` giữ con số tại thời điểm chốt để đối chiếu: ghi bù xong hệ
 * thống chỉ ngay ra tổng ngày đã đổi bao nhiêu so với bản đã gửi đi.
 */
export interface ChotNgay {
  id: string;
  ngay: string; // yyyy-mm-dd — ngày giao
  phanXuong: PhanXuong;
  daChot: boolean; // mở lại thì để false, KHÔNG xóa bản ghi
  chotLuc: string; // ISO datetime
  tongKgLucChot: number;
  lyDoMoLai: string;
  ghiChu: string;
}

/* ---------- Cân đối 5 ngày (xưởng Đông) ---------- */

/** Danh mục mặt hàng cân đối — mở, người dùng thêm khi thiếu; ánh xạ mã TP 141 nếu có. */
export interface MatHang {
  id: string;
  ma: string;
  ten: string;
  maTP: string; // mã trong danh mục 141 (nếu có)
}

/** Khách hàng (đầu ra) — tách riêng đại lý (đầu vào). */
export interface KhachHang {
  id: string;
  ma: string;
  ten: string;
  thiTruong: string; // VD Nhật, EU, Nội địa
}

/** Đại lý cung cấp nguyên liệu (đầu vào). */
export interface DaiLy {
  id: string;
  ma: string;
  ten: string;
  dienThoai: string;
  ghiChu: string;
}

/**
 * Loại nguyên liệu (quy cách/size) — VD "2 da nguyên liệu", "Mực ống 7cm".
 * Có danh mục để chống gõ tự do mỗi lần một kiểu → tổng hợp cuối kỳ mới đúng.
 */
export interface LoaiNguyenLieu {
  id: string;
  ten: string;
  loai: string; // thuộc loài nào: Bạch tuộc / Mực / Cá…
  ghiChu: string;
}

export type NhomNL = "Thủy sản" | "Xả đông" | "Bột phụ gia";
export const NHOM_NL: NhomNL[] = ["Thủy sản", "Xả đông", "Bột phụ gia"];

export type Kenh = "Xuất khẩu" | "Nội địa";
export const KENH: Kenh[] = ["Xuất khẩu", "Nội địa"];

/** Một kỳ cân đối = một lô nguyên liệu theo loại, theo tập ngày tiếp nhận. */
export interface KyCanDoi {
  id: string;
  loaiNL: string; // VD "Bạch tuộc 2 da", "Mực ống khay"
  ngayList: string; // chuỗi hiển thị/in, sinh từ tuNgay–denNgay hoặc gõ tay (bản cũ)
  tuNgay?: string; // ISO yyyy-mm-dd — chọn bằng lịch
  denNgay?: string; // ISO yyyy-mm-dd
  tongNLNhan: number | null; // tổng NL nhận cả kỳ (bảng phụ) — để tính tỉ lệ thu hồi
  tiGia: number | null; // VND/USD (VD 26.000)
  chiPhiCB: number | null; // chi phí chế biến / kg TP (VND)
  createdAt: string;
}

export interface DongNLVao {
  id: string;
  kyId: string;
  nhom: NhomNL;
  ten: string;
  soLuongKg: number;
  donGia: number | null; // VND
  tyLe: number | null; // % (dùng cho bột phụ gia)
}

/** Phế liệu cân ở màn Nhập hàng (gộp cuối ngày) hay nhập tay trong kỳ cân đối. */
export type NguonPheLieu = "Nhập hàng" | "Cân đối";

/**
 * Phế liệu bán giá riêng (nội tạng, dạt).
 *
 * Nghiệp vụ thật: cân gộp cuối ngày theo phân xưởng, ngay lúc nhận hàng — nên
 * nhập ở màn Nhập hàng (`nguon = "Nhập hàng"`, có `ngay`/`phanXuong`, chưa gắn
 * kỳ). Màn Cân đối hút các dòng đó vào kỳ (gán `kyId`) thay vì nhập lại —
 * một số liệu chỉ một nguồn chuẩn.
 */
export interface DongPheLieu {
  id: string;
  kyId: string; // rỗng = chưa gắn kỳ cân đối nào
  loai: string; // nội tạng / dạt…
  soLuongKg: number;
  donGiaBan: number | null; // VND
  ngay: string; // yyyy-mm-dd — ngày cân (dòng nhập từ màn Nhập hàng)
  phanXuong: PhanXuong | ""; // "" = dòng nhập tay trong kỳ, không gắn xưởng
  nguon: NguonPheLieu;
}

export interface DongTP {
  id: string;
  kyId: string;
  matHangId: string;
  khachId: string;
  kenh: Kenh;
  luongKg: number;
  donGia: number | null; // USD nếu Xuất khẩu, VND nếu Nội địa
  quyCach?: string; // quy cách/size khi hút từ sổ bán (VD "18-20") — dòng nhập tay để trống
  banHangId?: string; // id dòng bán nguồn nếu hút từ sổ bán — chống hút trùng vào kỳ
}

/* ---------- Bán thành phẩm hằng ngày ---------- */

/**
 * Một phiếu bán = MỘT khách nhận hàng MỘT lượt, gồm nhiều dòng mặt hàng
 * (song song với chuyến nhập: một đại lý đổ nhiều loại).
 *
 * Hai ngày tách như nhập:
 *   - `ngayGiao`  : hàng thực xuất bán. MỌI tổng hợp (sổ bán, hút vào cân đối)
 *                   tính theo ngày này.
 *   - `ngayGhiSo` : ngày ghi vào hệ thống → nhãn "Ghi bù" khi ghi sau.
 *
 * Kênh nằm ở phiếu: Xuất khẩu ⇒ đơn giá USD, Nội địa ⇒ đơn giá VND. Quy tỉ giá
 * lúc tính giá trị, KHÔNG cộng thẳng hai kênh (bẫy kinh điển của cân đối).
 */
export interface PhieuBan {
  id: string;
  ngayGiao: string; // yyyy-mm-dd — ngày xuất bán
  ngayGhiSo: string; // yyyy-mm-dd — ngày ghi vào hệ thống
  lyDoGhiBu: string; // bắt buộc khi ngayGhiSo > ngayGiao
  phanXuong: PhanXuong;
  khachId: string; // khách hàng (danh mục đầu ra)
  kenh: Kenh;
  ghiChu: string;
}

/** Phiếu ghi sau ngày xuất bán ⇒ ghi bù (cần lý do). */
export function laGhiBuBan(p: Pick<PhieuBan, "ngayGiao" | "ngayGhiSo">): boolean {
  return Boolean(p.ngayGhiSo) && p.ngayGhiSo > p.ngayGiao;
}

/**
 * Một dòng bán trong phiếu. `matHangId` trỏ danh mục mặt hàng (mở); `quyCach`
 * là size/grade của thành phẩm (VD "18-20", "1000-1300") — tên sổ mẫu ẩn bớt
 * phần thành phẩm vì cả bảng là một loại. `khoNguon` để dành cho tồn kho tương
 * lai (xuất từ kho SX / kho lưu trữ), v1 chưa dùng — luôn "".
 */
export interface DongBan {
  id: string;
  phieuId: string;
  ngay: string; // yyyy-mm-dd — chép từ phiếu.ngayGiao để lọc/tổng hợp nhanh
  matHangId: string;
  quyCach: string;
  luongKg: number;
  donGia: number | null; // USD nếu kênh Xuất khẩu, VND nếu Nội địa
  khoNguon: string; // "" | "SX" | "Lưu trữ" — seam tồn kho, v1 để trống
}

/** Thành tiền một dòng bán = lượng × đơn giá (đơn vị theo kênh của phiếu). */
export function thanhTienBan(r: Pick<DongBan, "luongKg" | "donGia">): number {
  return r.luongKg * (r.donGia ?? 0);
}
