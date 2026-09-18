// ============================================================
// Tên file: src/features/monthly-stock/MonthlyStockScreen.tsx
// Tên tiếng Việt: Sổ kho theo THÁNG — dồn tồn cuối kỳ → đầu kỳ sau
// Description: Monthly stock ledger — carry closing balance into next month
// ============================================================
import { useMemo, useRef, useState } from "react";
import type { MonthlyStockLine, MaterialType, Product } from "@/types";
import { MONTHLY_STOCK_CATEGORIES, BSF1_WAREHOUSES, STORAGE_KIND_LABELS } from "@/types";
import { useMonthlyStock, useMaterialTypes, useProducts, useStorageLocations } from "@/lib/catalogRepo";
import { uid } from "@/lib/db";
import { num, viDate } from "@/lib/format";
import { parseBangKeKhoFile, namTuTenFile, type BangKeKhoSheet } from "@/lib/monthlyStockExcel";
import {
  suyDong,
  tongDong,
  gomNhom,
  donSangThang,
  danhSachThang,
  thangHienTai,
  thangTruoc,
  thangSau,
  nhanThang,
  soLechDonKy,
  coLechDonKy,
  doiChieuDonKy,
  phanTichDongBoDanhMuc,
  suyNhomNguyenLieu,
  khoaLo,
  theKhoMatHang,
  laDongTrong,
  apThaoTacLo,
  type KieuThaoTac,
  type MonthlyStockRow,
  type DoiChieuDong,
  type DichDanhMuc,
  type DongBoDong,
} from "@/lib/monthlyStock";
import {
  Badge,
  BangTong,
  Button,
  ChuThichBatBuoc,
  Combobox,
  ConfirmDelete,
  DateField,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorSummary,
  Field,
  Input,
  LuoiNhap,
  NumberField,
  PhieuIn,
  TdIn,
  ThIn,
  ThongKe,
  homNay,
  notify,
  type ChonBang,
  type CotLuoi,
  type CotTong,
  type HangLuoi,
  type LoiNhap,
  type MucChon,
  type TheThongTin,
} from "@/design-system";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRightLeft,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Coins,
  Eye,
  EyeOff,
  PackageMinus,
  FileSpreadsheet,
  Pencil,
  Plus,
  Printer,
  Scale,
  Ship,
  Snowflake,
  Trash2,
  Upload,
  Wrench,
  Library,
  ListChecks,
  MapPin,
  History,
  Sigma,
  Sparkles,
} from "lucide-react";

const TAT_CA_KHO = "__tat_ca__";

/** 5 kho hệ thống (BSF1_WAREHOUSES) — chọn chuẩn, không gõ tự do. Lưu theo TÊN kho. */
const KHO_HE_THONG: MucChon[] = BSF1_WAREHOUSES.map((w) => ({ value: w.name, label: `${w.name} · ${w.code}` }));
const MA_KHO = new Map(BSF1_WAREHOUSES.map((w) => [w.name, w.code]));
/** Token ASCII ổn định của kho cho id nhập (mã kho nếu là kho hệ thống). */
const maKho = (ten: string) => MA_KHO.get(ten) ?? ten.replace(/[|\s]+/g, "-");
const KHO_MAC_DINH = BSF1_WAREHOUSES.find((w) => w.code === "K1500T")?.name ?? BSF1_WAREHOUSES[0].name;

/** Form thêm/sửa một dòng (phần mô tả + số liệu đầy đủ). */
interface DongForm {
  id: string | null; // null = thêm mới
  category: string;
  warehouse: string;
  itemName: string;
  size: string;
  origin: string; // số Invoice (cột DB `origin`)
  importDate: string;
  storageLocation: string;
  kgPerCtn: number | null;
  unitPrice: number | null;
  openCtn: number | null;
  openKg: number | null;
  inCtn: number | null;
  inKg: number | null;
  outCtn: number | null;
  outKg: number | null;
}

const formRong = (category: string, warehouse: string): DongForm => ({
  id: null,
  category,
  warehouse,
  itemName: "",
  size: "",
  origin: "",
  importDate: "",
  storageLocation: "",
  kgPerCtn: null,
  unitPrice: null,
  openCtn: null,
  openKg: null,
  inCtn: null,
  inKg: null,
  outCtn: null,
  outKg: null,
});

const soHoacGach = (v: number) => (v ? num(v) : "—");

/**
 * Sổ kho theo THÁNG DƯƠNG LỊCH. Số hoá đúng "bảng kê kho" kế toán đang giữ trên
 * Excel (mỗi sheet một tháng). Bất biến: Tồn cuối = tồn đầu + nhập − xuất (kiện &
 * kg); Tiền còn lại = tồn cuối kg × đơn giá — suy ở tầng app nên luôn khớp. Tồn
 * ĐẦU kỳ được LƯU (snapshot kế thừa từ tháng trước, đóng băng). Nút "Dồn sang
 * tháng sau" tự chuyển tồn cuối → tồn đầu kỳ sau; hết chép tay chỗ hay sai số.
 */
export default function MonthlyStockScreen() {
  const [lines, ghiLines] = useMonthlyStock();
  const [mtypes, ghiMtypes] = useMaterialTypes();
  const [products, ghiProducts] = useProducts();
  const [khoLuuDM, ghiKhoLuuDM] = useStorageLocations();

  const [thang, setThang] = useState(thangHienTai());
  const [kho, setKho] = useState(TAT_CA_KHO);
  const [ghiMode, setGhiMode] = useState(false);
  const [locMatHang, setLocMatHang] = useState(""); // lọc lưới Ghi theo 1 mặt hàng (từ đối chiếu)
  const [moIn, setMoIn] = useState(false);
  const [timKiem, setTimKiem] = useState(""); // tìm nhanh trong tháng (tên · size · xuất xứ · nhóm)
  const [daChon, setDaChon] = useState<Set<string>>(new Set()); // dòng đang tick (cộng tổng / thao tác lô)
  const [xemThe, setXemThe] = useState<MonthlyStockRow | null>(null); // thẻ kho của 1 mặt hàng
  const [anDongTrong, setAnDongTrong] = useState(false); // ẩn dòng tồn đầu = nhập = xuất = 0

  // ---------- Nhập Excel bảng kê (seed số cũ) ----------
  const fileRef = useRef<HTMLInputElement>(null);
  const [napForm, setNapForm] = useState<{ sheets: BangKeKhoSheet[]; nam: number; kho: string } | null>(null);

  // ---------- Tuỳ chọn tháng / kho ----------
  const thangCoData = useMemo(
    () => [...new Set(lines.map((l) => l.period).filter(Boolean))],
    [lines]
  );
  const thangOpts: MucChon[] = useMemo(
    () => danhSachThang([...thangCoData, thang]).map((p) => ({ value: p, label: nhanThang(p) })),
    [thangCoData, thang]
  );

  const khoOpts: MucChon[] = useMemo(() => {
    // 5 kho hệ thống luôn chọn được + kho lạ đã có trong dữ liệu (nếu import tự tạo).
    const set = new Set<string>(BSF1_WAREHOUSES.map((w) => w.name));
    for (const l of lines) if (l.warehouse) set.add(l.warehouse);
    return [
      { value: TAT_CA_KHO, label: "Tất cả kho" },
      ...[...set].sort().map((k) => ({ value: k, label: MA_KHO.has(k) ? `${k} · ${MA_KHO.get(k)}` : k })),
    ];
  }, [lines]);

  // ---------- Dòng của tháng đang xem ----------
  /** Dòng ĐÃ LƯU của tháng + kho đang chọn (chưa lọc theo ô tìm). */
  const rowsLuu: MonthlyStockRow[] = useMemo(() => {
    return lines
      .filter((l) => l.period === thang && (kho === TAT_CA_KHO || l.warehouse === kho))
      .map(suyDong);
  }, [lines, thang, kho]);

  // Tháng liền trước (mọi kho — dồn kỳ không bỏ sót kho nào).
  const thangTr = thangTruoc(thang);
  const rowsTruoc = useMemo(
    () => lines.filter((l) => l.period === thangTr).map(suyDong),
    [lines, thangTr]
  );

  /**
   * XEM TRƯỚC dồn kỳ: tháng đang xem chưa có dòng nào nhưng tháng trước còn tồn ⇒
   * dựng SẴN tồn đầu kế thừa để màn hình không "trống trơn" (đây là chỗ hay bị
   * hiểu là mất số liệu). Dòng xem trước CHƯA LƯU — người dùng bấm "Kế thừa & lưu"
   * mới ghi. Cố ý không tự ghi: dồn kỳ phải đi qua bước đối chiếu khi lô tách/đổi
   * mã (xem `doiChieuDonKy`), tự ghi đè dễ cộng đôi.
   */
  const rowsXemTruoc: MonthlyStockRow[] = useMemo(() => {
    if (rowsLuu.length > 0) return [];
    const nguon = rowsTruoc.filter((r) => kho === TAT_CA_KHO || r.warehouse === kho);
    return donSangThang(nguon, thang).map(suyDong);
  }, [rowsLuu.length, rowsTruoc, kho, thang]);

  const laXemTruoc = rowsLuu.length === 0 && rowsXemTruoc.length > 0;

  /** Dòng đang HIỂN THỊ = dòng đã lưu, hoặc bản xem trước khi tháng còn trống. */
  const rowsGoc = laXemTruoc ? rowsXemTruoc : rowsLuu;

  /** Số dòng không có số liệu trong phạm vi đang xem (để ghi trên nút ẩn/hiện). */
  const soDongTrong = useMemo(() => rowsGoc.filter(laDongTrong).length, [rowsGoc]);

  /** Ô tìm nhanh: tên · size · invoice · nhóm · kho · vị trí (không phân biệt hoa thường) + ẩn dòng trống. */
  const rowsThang: MonthlyStockRow[] = useMemo(() => {
    const q = timKiem.trim().toLowerCase();
    const nguon = anDongTrong ? rowsGoc.filter((r) => !laDongTrong(r)) : rowsGoc;
    if (!q) return nguon;
    return nguon.filter((r) =>
      `${r.itemName} ${r.size} ${r.origin} ${r.category} ${r.warehouse} ${r.storageLocation}`.toLowerCase().includes(q)
    );
  }, [rowsGoc, timKiem, anDongTrong]);

  const nhomList = useMemo(() => gomNhom(rowsThang), [rowsThang]);
  const tong = useMemo(() => tongDong(rowsThang), [rowsThang]);
  const batBienDung = Math.abs(tong.openKg + tong.inKg - tong.outKg - tong.closeKg) < 0.001;

  // Dồn sang tháng sau dùng TOÀN BỘ dòng của tháng (mọi kho), không theo bộ lọc.
  const rowsThangDayDu = useMemo(
    () => lines.filter((l) => l.period === thang).map(suyDong),
    [lines, thang]
  );
  const coTonSang = rowsThangDayDu.some(
    (r) => Math.abs(r.closeKg) > 1e-9 || Math.abs(r.closeCtn) > 1e-9
  );

  // Cờ lệch dồn kỳ: tồn đầu tháng này (mọi kho) vs tồn cuối tháng trước.
  const lech = useMemo(() => soLechDonKy(rowsTruoc, rowsThangDayDu), [rowsTruoc, rowsThangDayDu]);
  // Đang XEM TRƯỚC thì "lệch" chính là phần chưa dồn — banner xem trước đã nói rồi,
  // hiện thêm cảnh báo đỏ chỉ làm người dùng tưởng sai số liệu.
  const canhBaoLech = rowsTruoc.length > 0 && coLechDonKy(lech) && !laXemTruoc;

  // Đối chiếu lệch theo MẶT HÀNG (chẩn đoán — người dùng tự sửa ở lưới Ghi).
  const dsDoiChieu = useMemo(() => doiChieuDonKy(rowsTruoc, rowsThangDayDu), [rowsTruoc, rowsThangDayDu]);
  const [moDoiChieu, setMoDoiChieu] = useState(false);

  // Đồng bộ tên trong sổ ↔ CẢ HAI danh mục (loại NL + mặt hàng), định tuyến TỪNG DÒNG.
  // Thành phẩm (141 mã kế toán) CỐ ĐỊNH — không thêm ở đây.
  const dongBo = useMemo(
    () =>
      phanTichDongBoDanhMuc(
        [...new Set(lines.map((l) => l.itemName))],
        mtypes.map((m) => m.name),
        products.map((p) => p.name)
      ),
    [lines, mtypes, products]
  );
  const [moDongBo, setMoDongBo] = useState(false);
  const [dichDB, setDichDB] = useState<Record<string, DichDanhMuc>>({}); // đích từng dòng (đè gợi ý)
  const [mapDB, setMapDB] = useState<Record<string, string>>({}); // ánh xạ tên file → tên chuẩn trong danh mục

  // ---------- Ghi ô lưới ----------
  const suaSo = (id: string, patch: Partial<MonthlyStockLine>) => {
    ghiLines(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };
  const ghiO = (rowId: string, colKey: string, giaTri: number | null) => {
    const v = giaTri == null ? 0 : giaTri;
    const map: Record<string, keyof MonthlyStockLine> = {
      openCtn: "openCtn",
      openKg: "openKg",
      inCtn: "inCtn",
      inKg: "inKg",
      outCtn: "outCtn",
      outKg: "outKg",
    };
    const field = map[colKey];
    if (field) suaSo(rowId, { [field]: v } as Partial<MonthlyStockLine>);
  };

  const xoaDong = (r: MonthlyStockRow) => {
    const truoc = lines;
    ghiLines(lines.filter((l) => l.id !== r.id));
    notify.daXoa(`Đã xóa dòng ${r.itemName}`, () => ghiLines(truoc));
  };

  // ---------- Thêm / sửa dòng ----------
  const [form, setForm] = useState<DongForm | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const moThem = () => {
    // Đang XEM TRƯỚC (tháng chưa lưu dòng nào, đang hiện bản kế thừa từ tháng trước):
    // thêm rồi lưu 1 dòng sẽ khiến rowsLuu ≠ rỗng ⇒ tắt xem trước ⇒ cả bảng kế thừa
    // (chưa lưu) biến mất khỏi màn — dễ tưởng mất số liệu. Bắt kế thừa & lưu trước.
    if (laXemTruoc) {
      notify.canhBao(
        `${nhanThang(thang)} đang XEM TRƯỚC (chưa lưu). Bấm "Kế thừa & lưu vào sổ" trước, rồi mới thêm dòng — kẻo bảng kế thừa đang xem bị trôi mất.`
      );
      return;
    }
    const catGoiY = nhomList[0]?.category || MONTHLY_STOCK_CATEGORIES[0];
    const khoGoiY = kho !== TAT_CA_KHO ? kho : KHO_MAC_DINH;
    setForm(formRong(catGoiY, khoGoiY));
    setLoi([]);
  };
  const moSua = (r: MonthlyStockRow) => {
    setForm({
      id: r.id,
      category: r.category,
      warehouse: r.warehouse,
      itemName: r.itemName,
      size: r.size,
      origin: r.origin,
      importDate: r.importDate,
      storageLocation: r.storageLocation,
      kgPerCtn: r.kgPerCtn,
      unitPrice: r.unitPrice,
      openCtn: r.openCtn || null,
      openKg: r.openKg || null,
      inCtn: r.inCtn || null,
      inKg: r.inKg || null,
      outCtn: r.outCtn || null,
      outKg: r.outKg || null,
    });
    setLoi([]);
  };

  const luuDong = () => {
    if (!form) return;
    const ls: LoiNhap[] = [];
    if (!form.category.trim()) ls.push({ truong: "Nhóm hàng", thongBao: "Chưa chọn nhóm" });
    if (!form.itemName.trim()) ls.push({ truong: "Tên hàng", thongBao: "Chưa nhập tên hàng" });
    setLoi(ls);
    if (ls.length) return;

    const cu = form.id ? lines.find((l) => l.id === form.id) : undefined;
    const dong: MonthlyStockLine = {
      id: form.id ?? `msl|${thang}|${uid()}`,
      period: cu?.period ?? thang,
      category: form.category.trim(),
      warehouse: form.warehouse.trim(),
      itemName: form.itemName.trim(),
      size: form.size.trim(),
      origin: form.origin.trim(),
      importDate: form.importDate,
      storageLocation: form.storageLocation.trim(),
      kgPerCtn: form.kgPerCtn,
      unitPrice: form.unitPrice,
      openCtn: form.openCtn ?? 0,
      openKg: form.openKg ?? 0,
      inCtn: form.inCtn ?? 0,
      inKg: form.inKg ?? 0,
      outCtn: form.outCtn ?? 0,
      outKg: form.outKg ?? 0,
      carriedFromId: cu?.carriedFromId ?? "",
      sortOrder: cu?.sortOrder ?? lines.filter((l) => l.period === thang).length,
      note: cu?.note ?? "",
    };
    ghiLines(form.id ? lines.map((l) => (l.id === dong.id ? dong : l)) : [...lines, dong]);
    setForm(null);
    notify.daLuu(form.id ? `Đã sửa dòng ${dong.itemName}` : `Đã thêm dòng ${dong.itemName}`);
  };

  // ---------- Dồn kỳ ----------
  const donTuThangTruoc = () => {
    const carried = donSangThang(rowsTruoc, thang);
    if (!carried.length) {
      notify.canhBao(`${nhanThang(thangTr)} không có tồn để dồn sang.`);
      return;
    }
    const idMoi = new Set(carried.map((x) => x.id));
    const giuLai = lines.filter((l) => !idMoi.has(l.id));
    ghiLines([...giuLai, ...carried]);
    const skg = carried.reduce((s, r) => s + r.openKg, 0);
    notify.daLuu(`Đã kế thừa ${carried.length} dòng · ${num(skg)} kg từ ${nhanThang(thangTr)}`);
  };

  const donSangThangSau = () => {
    const dich = thangSau(thang);
    const carried = donSangThang(rowsThangDayDu, dich);
    if (!carried.length) {
      notify.canhBao("Tháng này không còn tồn cuối để dồn sang.");
      return;
    }
    const idMoi = new Set(carried.map((x) => x.id));
    const giuLai = lines.filter((l) => !idMoi.has(l.id));
    ghiLines([...giuLai, ...carried]);
    setThang(dich);
    setKho(TAT_CA_KHO);
    setGhiMode(false);
    notify.daLuu(`Đã dồn tồn cuối sang ${nhanThang(dich)} · ${carried.length} dòng`);
  };

  // ---------- Tick dòng: cộng tổng · in riêng · xóa theo lô ----------
  /**
   * Phần mềm kế toán kho nào cũng có: tick vài dòng → thấy NGAY tổng của đúng mấy
   * dòng đó (không phải tổng cả tháng), rồi in riêng / xử theo lô. Chỉ giữ tập KHÓA
   * dòng ở state — không sửa dữ liệu.
   */
  const chonBang: ChonBang<MonthlyStockRow> = {
    daChon,
    doi: (k) =>
      setDaChon((cu) => {
        const next = new Set(cu);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      }),
    doiTatCa: (keys, bat) =>
      setDaChon((cu) => {
        const next = new Set(cu);
        for (const k of keys) {
          if (bat) next.add(k);
          else next.delete(k);
        }
        return next;
      }),
    nhanDong: (r) => `${r.itemName}${r.size ? " · " + r.size : ""}`,
  };
  const rowsChon = useMemo(() => rowsThang.filter((r) => daChon.has(r.id)), [rowsThang, daChon]);
  const tongChon = useMemo(() => tongDong(rowsChon), [rowsChon]);
  const boChon = () => setDaChon(new Set());

  /** Bản in: có tick thì in đúng mấy dòng đó, không thì in cả tháng đang xem. */
  const rowsIn = rowsChon.length ? rowsChon : rowsThang;
  const nhomIn = useMemo(() => gomNhom(rowsIn), [rowsIn]);
  const tongIn = useMemo(() => tongDong(rowsIn), [rowsIn]);

  /** Chọn hết các dòng đang hiện (mọi nhóm) — nút ở thanh công cụ. */
  const chonTatCa = () => setDaChon(new Set(rowsThang.map((r) => r.id)));

  /** Xóa các dòng đã tick — có xác nhận + hoàn tác (không xóa lặng lẽ). */
  const xoaDaChon = () => {
    const ids = new Set(rowsChon.map((r) => r.id));
    if (!ids.size) return;
    const truoc = lines;
    ghiLines(lines.filter((l) => !ids.has(l.id)));
    boChon();
    notify.daXoa(`Đã xóa ${ids.size} dòng ${nhanThang(thang)}`, () => ghiLines(truoc));
  };

  // ---------- Vị trí hàng đang nằm (kho nhà + kho thuê ngoài) ----------
  /** Kho hệ thống + danh mục kho lưu (`storage_locations`) + tên đã dùng trong sổ. */
  const viTriOpts: MucChon[] = useMemo(() => {
    const phu = new Map<string, string>(BSF1_WAREHOUSES.map((w) => [w.name, `Kho xí nghiệp · ${w.code}`]));
    for (const k of khoLuuDM) if (k.name.trim() && !phu.has(k.name.trim())) phu.set(k.name.trim(), STORAGE_KIND_LABELS[k.kind]);
    for (const l of lines) if (l.storageLocation && !phu.has(l.storageLocation)) phu.set(l.storageLocation, "");
    return [...phu].map(([n, ghiChu]) => ({ value: n, label: n, phu: ghiChu || undefined }));
  }, [khoLuuDM, lines]);

  /** Gõ vị trí chưa có ⇒ lưu ngay vào danh mục kho lưu (mặc định kho thuê ngoài). */
  const themViTri = (ten: string) => {
    const name = ten.trim();
    if (name && !viTriOpts.some((o) => o.value.toLowerCase() === name.toLowerCase())) {
      ghiKhoLuuDM([...khoLuuDM, { id: uid(), code: "", name, kind: "thue-ngoai", address: "", phone: "", note: "Từ sổ kho theo tháng" }]);
    }
    return name;
  };

  const [ganViTri, setGanViTri] = useState<string | null>(null); // vị trí sắp gán cho dòng tick
  /** Gán vị trí cho các dòng đang tick (một lần ghi, có Hoàn tác). */
  const ganViTriDaChon = () => {
    const dich = (ganViTri ?? "").trim();
    const ids = new Set(rowsChon.map((r) => r.id));
    if (!dich || !ids.size) {
      notify.canhBao(!dich ? "Chưa chọn vị trí để gán." : "Chưa tick dòng nào.");
      return;
    }
    const truoc = lines;
    ghiLines(lines.map((l) => (ids.has(l.id) ? { ...l, storageLocation: dich } : l)));
    setGanViTri(null);
    notify.daLuu(`Đã gửi ${ids.size} dòng tới ${dich}`, () => ghiLines(truoc));
  };

  // ---------- Thao tác một dòng: lấy ra dùng · nhập thêm · chuyển vị trí ----------
  const [thaoTac, setThaoTac] = useState<{
    row: MonthlyStockRow;
    kieu: KieuThaoTac;
    kg: number | null;
    viTri: string;
    ngay: string;
    lyDo: string;
  } | null>(null);
  const [loiTT, setLoiTT] = useState<LoiNhap[]>([]);

  const moThaoTac = (row: MonthlyStockRow, kieu: KieuThaoTac = "xuat") => {
    setThaoTac({ row, kieu, kg: null, viTri: "", ngay: homNay(), lyDo: "" });
    setLoiTT([]);
  };

  const luuThaoTac = () => {
    if (!thaoTac) return;
    const { row, kieu, kg, viTri, ngay, lyDo } = thaoTac;
    const ls: LoiNhap[] = [];
    const tonCuoi = row.closeKg;
    if (!kg || kg <= 0) ls.push({ truong: "Số kg", thongBao: "Chưa nhập số kg (phải lớn hơn 0)" });
    else if (kieu !== "nhap" && kg > tonCuoi + 1e-6)
      ls.push({ truong: "Số kg", thongBao: `Vượt tồn cuối của dòng (${num(tonCuoi)} kg)` });
    if (kieu === "chuyen") {
      if (!viTri.trim()) ls.push({ truong: "Chuyển tới", thongBao: "Chưa chọn vị trí đích" });
      else if (viTri.trim() === viTriCua(row)) ls.push({ truong: "Chuyển tới", thongBao: "Vị trí đích trùng vị trí hiện tại" });
    }
    setLoiTT(ls);
    if (ls.length || !kg) return;

    const viec =
      kieu === "xuat"
        ? `Lấy ra sử dụng ${num(kg)} kg`
        : kieu === "nhap"
          ? `Nhập thêm ${num(kg)} kg`
          : `Gửi ${num(kg)} kg từ ${viTriCua(row) || "(chưa rõ)"} tới ${viTri.trim()}`;
    const ghiChu = `${viDate(ngay || homNay())}: ${viec}${lyDo.trim() ? ` — ${lyDo.trim()}` : ""}`;
    const goc = lines.find((l) => l.id === row.id);
    if (!goc) return;
    const kq = apThaoTacLo(goc, kieu, kg, { viTriDich: viTri, ghiChu, idMoi: `msl|${thang}|${uid()}` });
    const truoc = lines;
    const sau = lines.map((l) => (l.id === kq.dong.id ? kq.dong : l));
    ghiLines(kq.dongTach ? [...sau, kq.dongTach] : sau);
    setThaoTac(null);
    notify.daLuu(`${row.itemName}: ${viec}`, () => ghiLines(truoc));
  };

  // ---------- Thẻ kho: lịch sử một mặt hàng qua các tháng ----------
  const dsTheKho = useMemo(
    () => (xemThe ? theKhoMatHang(lines, khoaLo(xemThe)) : []),
    [lines, xemThe]
  );

  // Mở lưới Ghi lọc theo một mặt hàng để sửa tay lệch dồn kỳ.
  const suaTayMatHang = (d: DoiChieuDong) => {
    setKho(d.warehouse);
    setLocMatHang(d.itemName);
    setGhiMode(true);
    setMoDoiChieu(false);
  };

  // ---------- Đồng bộ danh mục loại nguyên liệu ----------
  // Danh sách tên CHUẨN để ánh xạ tới (gõ tìm / thêm mới).
  const matHangOpts: MucChon[] = useMemo(
    () => [...products].map((p) => p.name).sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n })),
    [products]
  );
  const loaiNLOpts: MucChon[] = useMemo(
    () => [...mtypes].map((m) => m.name).sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n })),
    [mtypes]
  );

  const moDongBoDialog = () => {
    setDichDB({}); // rỗng = dùng đích GỢI Ý mỗi dòng
    setMapDB({}); // rỗng = giữ nguyên tên file (chưa ánh xạ)
    setMoDongBo(true);
  };
  // Tách: MÃ KHÓ cần người quyết vs tên RÕ RÀNG (tự nhận loài, khỏi bận tâm).
  const canDongBo = dongBo.chuaCo.filter((x) => !x.roRang);
  const dsRoRang = dongBo.chuaCo.filter((x) => x.roRang);
  const dichCua = (x: { name: string; dichGoiY: DichDanhMuc }): DichDanhMuc => dichDB[x.name] ?? x.dichGoiY;
  // Tên chuẩn được ánh xạ tới (mặc định = tên file nếu chưa chọn).
  const mapCua = (x: { name: string }) => (mapDB[x.name] ?? x.name).trim();
  const chuan = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  // Đếm trên TOÀN BỘ (cả mã khó lẫn rõ ràng) — mỗi dòng tự chọn đích.
  const soMH = dongBo.chuaCo.filter((x) => dichCua(x) === "product").length;
  const soNL = dongBo.chuaCo.filter((x) => dichCua(x) === "material").length;

  /**
   * Áp đồng bộ: mỗi mã (đích ≠ bỏ qua) NỐI vào tên chuẩn (mapCua). Tên chuẩn chưa
   * có trong danh mục đích ⇒ thêm mới; và ĐỔI TÊN mọi dòng sổ mang tên file cũ
   * sang tên chuẩn (đồng bộ sổ + gộp trùng cách ghi).
   */
  const apDongBo = () => {
    const coNL = new Set(mtypes.map((m) => chuan(m.name)));
    const coMH = new Set(products.map((p) => chuan(p.name)));
    const themNL: MaterialType[] = [];
    const themMH: Product[] = [];
    const doiTen = new Map<string, string>(); // tên file → tên chuẩn (khi khác nhau)
    for (const x of dongBo.chuaCo) {
      const d = dichCua(x);
      if (d === "skip") continue;
      const canon = mapCua(x);
      if (!canon) continue;
      if (d === "material" && !coNL.has(chuan(canon))) {
        themNL.push({ id: uid(), name: canon, category: suyNhomNguyenLieu(canon), note: "Từ sổ kho theo tháng" });
        coNL.add(chuan(canon));
      } else if (d === "product" && !coMH.has(chuan(canon))) {
        themMH.push({ id: uid(), code: "", name: canon, finishedGoodCode: "", category: suyNhomNguyenLieu(canon), processingType: "" });
        coMH.add(chuan(canon));
      }
      if (chuan(canon) !== chuan(x.name)) doiTen.set(x.name, canon);
    }
    if (!themNL.length && !themMH.length && !doiTen.size) {
      notify.canhBao("Chưa ánh xạ/chọn đích dòng nào.");
      return;
    }
    if (themNL.length) ghiMtypes([...mtypes, ...themNL]);
    if (themMH.length) ghiProducts([...products, ...themMH]);
    if (doiTen.size) ghiLines(lines.map((l) => (doiTen.has(l.itemName) ? { ...l, itemName: doiTen.get(l.itemName)! } : l)));
    setMoDongBo(false);
    notify.daLuu(
      `Đồng bộ: +${themMH.length} mặt hàng · +${themNL.length} loại NL · đổi tên ${doiTen.size} mã trong sổ`
    );
  };

  /** Đặt đích cho một NHÓM dòng (bulk theo section). */
  const datDich = (list: DongBoDong[], d: DichDanhMuc | "goiY") => {
    setDichDB((m) => {
      const next = { ...m };
      for (const x of list) {
        if (d === "goiY") delete next[x.name];
        else next[x.name] = d;
      }
      return next;
    });
  };

  /** Một dòng: tên file · đích (Mặt hàng/Loại NL/Bỏ qua) · ánh xạ tới tên CHUẨN. */
  const dongRow = (x: DongBoDong) => {
    const d = dichCua(x);
    const opts = d === "product" ? matHangOpts : loaiNLOpts;
    return (
      <div key={x.name} className="flex flex-wrap items-center gap-2 rounded p-1 hover:bg-muted/50">
        <span className="min-w-0 flex-1 truncate text-foreground" title={x.name}>
          {x.name}
        </span>
        <select
          className="h-9 shrink-0 rounded-md border border-border bg-background px-2"
          value={d}
          onChange={(e) => setDichDB((m) => ({ ...m, [x.name]: e.target.value as DichDanhMuc }))}
          aria-label={`Đích ${x.name}`}
        >
          <option value="product">→ Mặt hàng</option>
          <option value="material">→ Loại NL</option>
          <option value="skip">Bỏ qua</option>
        </select>
        <div className="w-64 shrink-0">
          <Combobox
            anNhan
            label={`Ánh xạ ${x.name} tới`}
            value={mapCua(x)}
            onChange={(v) => setMapDB((m) => ({ ...m, [x.name]: v }))}
            options={opts}
            onCreate={(t) => t}
            choPhepXoa={false}
            placeholder={d === "skip" ? "— bỏ qua —" : "Gõ tìm tên chuẩn / thêm mới"}
          />
        </div>
      </div>
    );
  };

  // ---------- Nhập Excel bảng kê ----------
  const chonFile = () => fileRef.current?.click();
  const napFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const sheets = await parseBangKeKhoFile(file);
      if (!sheets.length) {
        notify.canhBao("File không có sheet dữ liệu nào đọc được (mẫu 'bảng kê kho').");
        return;
      }
      setNapForm({ sheets, nam: namTuTenFile(file.name), kho: KHO_MAC_DINH });
    } catch (err) {
      notify.loi(`Không đọc được file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  const soDongNap = napForm
    ? napForm.sheets.reduce((s, sh) => s + (sh.monthNum ? sh.rows.length : 0), 0)
    : 0;
  const xacNhanNap = () => {
    if (!napForm) return;
    const { sheets, nam, kho: khoNap } = napForm;
    if (nam < 2000 || nam > 2100) {
      notify.canhBao("Năm không hợp lệ (2000–2100).");
      return;
    }
    const moi: MonthlyStockLine[] = [];
    // File bảng kê không có cột vị trí ⇒ nạp lại GIỮ vị trí người dùng đã gán cho dòng cùng id.
    const viTriCu = new Map(lines.map((l) => [l.id, l.storageLocation]));
    for (const sh of sheets) {
      if (sh.monthNum == null) continue;
      const period = `${nam}-${String(sh.monthNum).padStart(2, "0")}`;
      sh.rows.forEach((r, idx) => {
        const id = `xlsx|${maKho(khoNap.trim())}|${sh.sheetName}|${nam}|${r.rowIndex}`;
        moi.push({
          id,
          period,
          category: r.category,
          warehouse: khoNap.trim(),
          itemName: r.itemName,
          size: r.size,
          origin: r.origin,
          importDate: r.importDate,
          storageLocation: viTriCu.get(id) ?? "",
          kgPerCtn: r.kgPerCtn,
          unitPrice: r.unitPrice,
          openCtn: r.openCtn,
          openKg: r.openKg,
          inCtn: r.inCtn,
          inKg: r.inKg,
          outCtn: r.outCtn,
          outKg: r.outKg,
          carriedFromId: "",
          sortOrder: idx,
          note: "",
        });
      });
    }
    if (!moi.length) {
      notify.canhBao("Không nạp được tháng nào — tên sheet phải là số tháng (1–12).");
      return;
    }
    const idMoi = new Set(moi.map((x) => x.id));
    const giuLai = lines.filter((l) => !idMoi.has(l.id));
    // Dòng đã TÁCH khi chuyển kho một phần: nạp lại trả dòng gốc về số trong file ⇒ phần tách bị đếm 2 lần.
    const soTach = giuLai.filter((l) => [...idMoi].some((id) => l.note.includes(`(tách từ dòng ${id})`))).length;
    ghiLines([...giuLai, ...moi]);
    if (soTach) notify.canhBao(`${soTach} dòng từng tách khi chuyển kho một phần vẫn còn — dòng gốc đã về số trong file, kiểm lại kẻo cộng đôi.`);
    const dauKy = [...new Set(moi.map((m) => m.period))].sort()[0];
    setThang(dauKy);
    setKho(TAT_CA_KHO);
    setGhiMode(false);
    setNapForm(null);
    notify.daLuu(`Đã nạp ${moi.length} dòng · ${new Set(moi.map((m) => m.period)).size} tháng từ Excel bảng kê`);
  };

  // ---------- Thẻ số liệu ----------
  const the: TheThongTin[] = [
    { nhan: "Tồn đầu kỳ", giaTri: `${num(tong.openKg)} kg`, so: true, icon: Snowflake, mau: "trung-tinh" },
    { nhan: "Nhập trong kỳ", giaTri: `${num(tong.inKg)} kg`, so: true, icon: ArrowDownToLine, mau: "brand" },
    { nhan: "Xuất trong kỳ", giaTri: `${num(tong.outKg)} kg`, so: true, icon: Ship, mau: "warning" },
    { nhan: "Tồn cuối kỳ", giaTri: `${num(tong.closeKg)} kg`, so: true, icon: Scale, mau: "success" },
    { nhan: "Tiền còn lại", giaTri: `${num(Math.round(tong.remainingValue))} đ`, so: true, icon: Coins, mau: "brand" },
  ];

  // ---------- Cột bảng xem (theo kg — kiện vẫn lưu nhưng không hiện) ----------
  /** Vị trí hiển thị: đã gán thì tên kho lưu, chưa gán ⇒ hàng đang ở chính kho của sổ. */
  const viTriCua = (r: MonthlyStockLine) => r.storageLocation || r.warehouse;
  /** Vị trí là KHO NGOÀI (thuê ngoài, VD Ánh Dương/HP) — không phải 5 kho hệ thống. */
  const laKhoNgoai = (loc: string) => !!loc.trim() && !MA_KHO.has(loc.trim());
  /** Nhãn cột Vị trí: hàng gửi kho ngoài ghi rõ "Gửi: <kho>" cho kế toán thấy ngay. */
  const nhanViTri = (r: MonthlyStockLine) => (laKhoNgoai(r.storageLocation) ? `Gửi: ${r.storageLocation}` : viTriCua(r));
  const cot = (t: ReturnType<typeof tongDong>): CotTong<MonthlyStockRow>[] => [
    {
      key: "ngay",
      header: "Ngày nhập",
      render: (r) => <span className="tnum whitespace-nowrap">{r.importDate ? viDate(r.importDate) : "—"}</span>,
    },
    {
      key: "ten",
      header: "Mặt hàng",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{r.itemName}</div>
          {r.size && <div className="text-sm text-muted-foreground">Size {r.size}</div>}
        </div>
      ),
    },
    { key: "invoice", header: "Invoice", render: (r) => r.origin || "—" },
    { key: "gia", header: "Đơn giá (đ)", so: true, render: (r) => soHoacGach(r.unitPrice ?? 0) },
    { key: "odKg", header: "Tồn đầu kỳ (kg)", so: true, render: (r) => soHoacGach(r.openKg), tong: () => num(t.openKg) },
    {
      key: "inKg", header: "Nhập trong kỳ (kg)", so: true,
      render: (r) => (r.inKg ? <span className="font-semibold text-success">+{num(r.inKg)}</span> : "—"),
      tong: () => num(t.inKg),
    },
    {
      key: "outKg", header: "Xuất trong kỳ (kg)", so: true,
      render: (r) => (r.outKg ? <span className="font-semibold text-warning">−{num(r.outKg)}</span> : "—"),
      tong: () => num(t.outKg),
    },
    {
      key: "ocKg", header: "Tồn cuối kỳ (kg)", so: true,
      render: (r) => <span className="tnum font-bold text-foreground">{num(r.closeKg)}</span>,
      tong: () => num(t.closeKg),
    },
    {
      key: "tien", header: "Tiền còn lại (đ)", so: true,
      render: (r) => (r.remainingValue ? num(Math.round(r.remainingValue)) : "—"),
      tong: () => num(Math.round(t.remainingValue)),
    },
    {
      key: "viTri",
      header: "Vị trí",
      render: (r) => (
        <span
          className={
            laKhoNgoai(r.storageLocation)
              ? "whitespace-nowrap font-semibold text-primary"
              : r.storageLocation
                ? "whitespace-nowrap font-medium text-foreground"
                : "whitespace-nowrap text-muted-foreground"
          }
        >
          {nhanViTri(r) || "—"}
        </span>
      ),
    },
    {
      key: "thaotac", header: "", render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Thẻ kho ${r.itemName}`}
            title="Thẻ kho — lịch sử mặt hàng này qua các tháng"
            onClick={() => setXemThe(r)}
          >
            <History className="size-4" />
          </Button>
          {!laXemTruoc && (
            <>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Lấy ra / gửi kho ${r.itemName}`}
                title="Lấy hàng ra sử dụng, nhập thêm, hoặc gửi ra kho ngoài (Ánh Dương, HP…) — nhập số kg rồi lưu."
                onClick={() => moThaoTac(r)}
              >
                <PackageMinus className="size-4" />
              </Button>
              <Button
                title="Sửa dòng: ngày nhập · tên hàng · size · invoice · đơn giá · số kg · vị trí." size="sm" variant="ghost" aria-label={`Sửa ${r.itemName}`} onClick={() => moSua(r)}>
                <Pencil className="size-4" />
              </Button>
              <ConfirmDelete
                moTaBanGhi={`${r.itemName}${r.size ? " · " + r.size : ""}`}
                onConfirm={() => xoaDong(r)}
                trigger={
                  <Button
                    title="Xóa dòng này khỏi tháng. Có hỏi xác nhận, xóa xong vẫn còn nút Hoàn tác." size="sm" variant="ghost" aria-label={`Xóa ${r.itemName}`}>
                    <Trash2 className="size-4" />
                  </Button>
                }
              />
            </>
          )}
        </div>
      ),
    },
  ];

  // ---------- Lưới ghi (nhập/xuất từng mã) ----------
  const cotLuoi: CotLuoi<MonthlyStockRow>[] = [
    { key: "openKg", header: "Tồn đầu (kg)", nhan: "Tồn đầu (kg)", kieu: "so", lay: (r) => r.openKg || null, rong: 120 },
    { key: "inKg", header: "Nhập (kg)", nhan: "Nhập (kg)", kieu: "so", lay: (r) => r.inKg || null, rong: 120 },
    { key: "outKg", header: "Xuất (kg)", nhan: "Xuất (kg)", kieu: "so", lay: (r) => r.outKg || null, rong: 120 },
    { key: "ocKg", header: "Tồn cuối (kg)", nhan: "Tồn cuối (kg)", kieu: "tinh", lay: (r) => r.closeKg, rong: 130 },
    {
      key: "xoa", header: "", nhan: "Xóa dòng", kieu: "chu", lay: () => null, rong: 60,
      oRieng: (r) => (
        <ConfirmDelete
          moTaBanGhi={`${r.itemName}${r.size ? " · " + r.size : ""}`}
          onConfirm={() => xoaDong(r)}
          trigger={
            <Button
              title="Xóa dòng này khỏi tháng. Có hỏi xác nhận, xóa xong vẫn còn nút Hoàn tác." size="sm" variant="ghost" aria-label={`Xóa ${r.itemName}`}>
              <Trash2 className="size-4" />
            </Button>
          }
        />
      ),
    },
  ];
  const rowsGrid = locMatHang ? rowsThang.filter((r) => r.itemName === locMatHang) : rowsThang;
  const hangLuoi: HangLuoi<MonthlyStockRow>[] = rowsGrid.map((r) => ({
    id: r.id,
    du: r,
    ten: r.itemName,
    phu: (
      <span className="text-muted-foreground">
        {[r.importDate ? viDate(r.importDate) : "", r.size, r.origin ? `Invoice ${r.origin}` : ""].filter(Boolean).join(" · ") || r.category}
      </span>
    ),
  }));

  const coDuLieu = rowsGoc.length > 0;
  /** Có dòng gốc nhưng ô tìm không khớp gì — phân biệt với "tháng chưa có số liệu". */
  const timKhongRa = coDuLieu && rowsThang.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <CalendarRange className="h-8 w-8 text-primary" />
            Sổ kho theo tháng
          </h1>
          <p className="mt-1 text-muted-foreground">
            Kỳ = tháng dương lịch. Tồn cuối = tồn đầu + nhập − xuất. Hết tháng, bấm "Dồn sang tháng sau" để tồn
            cuối kỳ này thành tồn đầu kỳ sau — hết chép tay.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={napFile} />
          <Button
            variant="outline"
            onClick={chonFile}
            title="Đọc file Excel 'bảng kê kho' của kế toán — mỗi sheet một tháng. Nạp lại cùng file + cùng kho chỉ cập nhật, không nhân đôi dòng."
          >
            <Upload className="mr-2 h-4 w-4" />
            Nhập Excel bảng kê
          </Button>
          <Button
            variant="outline"
            onClick={moDongBoDialog}
            title="Đối chiếu tên hàng trong sổ với danh mục Loại nguyên liệu và Mặt hàng, rồi ánh xạ từng tên về tên chuẩn. Không đụng 141 mã thành phẩm kế toán."
          >
            <Library className="mr-2 h-4 w-4" />
            Đồng bộ danh mục{canDongBo.length ? ` (${canDongBo.length})` : ""}
          </Button>
          <Button
            onClick={() => setMoIn(true)}
            disabled={!coDuLieu}
            title="Xem trước bản in A4. Có tick dòng thì chỉ in đúng mấy dòng đó kèm tổng của chúng."
          >
            <Printer className="mr-2 h-4 w-4" />
            In A4{rowsChon.length ? ` (${rowsChon.length} dòng chọn)` : ""}
          </Button>
        </div>
      </div>

      {/* Bộ lọc: tháng + kho */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full items-end gap-1 sm:w-auto">
          <Button
            title="Lùi về tháng liền trước."
            variant="outline"
            size="icon"
            aria-label="Tháng trước"
            onClick={() => setThang(thangTruoc(thang))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1 sm:min-w-[12rem] sm:flex-none">
            <Combobox
              label="Kỳ (tháng)"
              anNhanBatBuoc
              choPhepXoa={false}
              value={thang}
              onChange={setThang}
              options={thangOpts}
            />
          </div>
          <Button
            title="Tới tháng liền sau."
            variant="outline"
            size="icon"
            aria-label="Tháng sau"
            onClick={() => setThang(thangSau(thang))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-w-0 flex-1 sm:min-w-[12rem] sm:flex-none">
          <Combobox
            label="Kho"
            anNhanBatBuoc
            choPhepXoa={false}
            value={kho}
            onChange={(v) => {
              setKho(v);
              boChon();
            }}
            options={khoOpts}
          />
        </div>
        <div className="min-w-0 flex-1 sm:min-w-[16rem] sm:flex-none">
          <Field label="Tìm mặt hàng">
            <Input
              value={timKiem}
              onChange={(e) => setTimKiem(e.target.value)}
              placeholder="Gõ tên · size · invoice · vị trí"
              aria-label="Tìm mặt hàng trong tháng"
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {coDuLieu && !laXemTruoc && (
            <Button
              variant={ghiMode ? "default" : "outline"}
              title={
                ghiMode
                  ? "Thoát chế độ ghi, quay về bảng xem theo nhóm."
                  : "Bật lưới gõ tồn đầu / nhập / xuất (kg) từng mã. Tồn cuối tự tính, dán được cả khối từ Excel."
              }
              onClick={() => {
                if (ghiMode) setLocMatHang("");
                setGhiMode((v) => !v);
              }}
            >
              {ghiMode ? <Eye className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
              {ghiMode ? "Xong · xem lại" : "Ghi nhập/xuất"}
            </Button>
          )}
          {coDuLieu && !laXemTruoc && !ghiMode && (
            <Button
              variant="outline"
              onClick={rowsChon.length ? boChon : chonTatCa}
              title={rowsChon.length ? "Bỏ tick toàn bộ dòng đang chọn." : "Tick hết các dòng đang hiện để xem tổng của cả tháng, hoặc in / xóa theo lô."}
            >
              <ListChecks className="mr-2 h-4 w-4" />
              {rowsChon.length ? "Bỏ chọn hết" : "Chọn tất cả"}
            </Button>
          )}
          {coDuLieu && (soDongTrong > 0 || anDongTrong) && (
            <Button
              variant={anDongTrong ? "default" : "outline"}
              aria-pressed={anDongTrong}
              onClick={() => {
                setAnDongTrong((v) => !v);
                boChon();
              }}
              title={
                anDongTrong
                  ? "Đang ẩn các dòng không có số liệu. Bấm để hiện lại toàn bộ dòng."
                  : "Ẩn các dòng không có số liệu (tồn đầu, nhập, xuất đều bằng 0) cho bảng gọn."
              }
            >
              {anDongTrong ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
              {anDongTrong ? `Hiện dòng trống (${soDongTrong})` : `Ẩn dòng trống (${soDongTrong})`}
            </Button>
          )}
          {coTonSang && (
            <Button
              variant="outline"
              onClick={donSangThangSau}
              title="Lấy tồn cuối tháng này làm tồn đầu tháng sau, cho MỌI kho (bỏ qua bộ lọc kho). Chạy lại chỉ cập nhật, không nhân đôi dòng."
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Dồn sang {nhanThang(thangSau(thang))}
            </Button>
          )}
        </div>
      </div>

      {!coDuLieu ? (
        <EmptyState
          icon={FileSpreadsheet}
          tieuDe={`${nhanThang(thang)} chưa có số liệu`}
          moTa={
            rowsTruoc.length
              ? `Bấm "Kế thừa tồn cuối ${nhanThang(thangTr)}" để dồn tồn cuối tháng trước thành tồn đầu tháng này, hoặc "Thêm dòng" để nhập tay.`
              : `Bấm "Thêm dòng" để nhập bảng kê kho của ${nhanThang(thang)} (tồn đầu · nhập · xuất theo từng mặt hàng).`
          }
          action={
            rowsTruoc.length ? (
              <Button
                onClick={donTuThangTruoc}
                title="Lấy tồn cuối tháng trước làm tồn đầu tháng này và GHI vào sổ. Chạy lại chỉ cập nhật, không nhân đôi dòng."
              >
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Kế thừa tồn cuối {nhanThang(thangTr)}
              </Button>
            ) : (
              <Button onClick={moThem} title="Thêm tay dòng đầu tiên cho tháng này (tên hàng · tồn đầu · nhập · xuất).">
                <Plus className="mr-2 h-4 w-4" />
                Thêm dòng
              </Button>
            )
          }
        />
      ) : (
        <>
          {laXemTruoc && (
            <div className="space-y-2 rounded-xl border border-primary/50 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">
                    Xem trước tồn đầu {nhanThang(thang)} — kế thừa từ tồn cuối {nhanThang(thangTr)} (
                    {rowsXemTruoc.length} dòng · {num(tong.closeKg)} kg). CHƯA LƯU.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tháng này chưa có dòng nào trong sổ nên số dưới đây là tồn đầu DỰ KIẾN, tính ngay từ
                    tháng trước để không phải nhìn trang trống. Bấm "Kế thừa & lưu" để ghi vào sổ (rồi mới ghi
                    được nhập/xuất); chạy lại chỉ cập nhật, không nhân đôi.
                  </p>
                  <div className="pt-1">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={donTuThangTruoc}
                      title="Ghi bảng xem trước này vào sổ làm tồn đầu tháng. Ghi xong mới gõ được nhập/xuất. Chạy lại chỉ cập nhật, không nhân đôi."
                    >
                      <ArrowDownToLine className="mr-2 h-4 w-4" />
                      Kế thừa &amp; lưu vào sổ
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <ThongKe the={the} />

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
            {batBienDung ? (
              <span className="flex items-center gap-2 text-base font-semibold text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                Khớp bất biến: {num(tong.openKg)} + {num(tong.inKg)} − {num(tong.outKg)} = {num(tong.closeKg)} kg
              </span>
            ) : (
              <span className="text-base font-semibold text-destructive">
                Lệch bất biến — kiểm lại số liệu (tồn đầu + nhập − xuất ≠ tồn cuối).
              </span>
            )}
            <Badge variant="outline" className="ml-auto">
              {rowsThang.length} mặt hàng · {nhomList.length} nhóm
            </Badge>
          </div>

          {!laXemTruoc && !ghiMode && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Cách thao tác:</span>
              <span>
                lấy hàng ra dùng · nhập thêm · gửi kho ngoài một dòng → bấm{" "}
                <PackageMinus className="inline size-4 align-text-bottom" aria-label="nút Lấy ra / gửi kho" /> cuối dòng;
              </span>
              <span>gửi nhiều dòng một lúc → tick dòng rồi bấm "Gửi kho ngoài";</span>
              <span>gõ số cả bảng → "Ghi nhập/xuất". Hướng dẫn đầy đủ ở nút ? trên đầu trang.</span>
            </p>
          )}

          {/* Cộng tổng các dòng đang tick — kiểu bảng kê kế toán */}
          {rowsChon.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <Sigma className="h-5 w-5 text-primary" aria-hidden />
                Đã chọn {rowsChon.length} dòng
              </span>
              <span className="tnum text-sm text-muted-foreground">
                tồn đầu {num(tongChon.openKg)} kg
              </span>
              <span className="tnum text-sm text-muted-foreground">
                nhập {num(tongChon.inKg)} kg
              </span>
              <span className="tnum text-sm text-muted-foreground">
                xuất {num(tongChon.outKg)} kg
              </span>
              <span className="tnum text-sm font-semibold text-foreground">
                tồn cuối {num(tongChon.closeKg)} kg
              </span>
              <span className="tnum text-sm text-muted-foreground">
                tiền còn lại {num(Math.round(tongChon.remainingValue))} đ
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {!laXemTruoc && (
                  <Button size="sm" variant="outline" onClick={() => setGanViTri("")} title="Đánh dấu các dòng đang tick là GỬI ra kho ngoài (VD Kho Ánh Dương, HP). Chỉ ghi nơi để hàng, không đổi số kg.">
                    <MapPin className="mr-2 h-4 w-4" />
                    Gửi kho ngoài
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setMoIn(true)} title="In riêng các dòng đang tick, kèm dòng tổng của đúng mấy dòng đó.">
                  <Printer className="mr-2 h-4 w-4" />
                  In {rowsChon.length} dòng
                </Button>
                {!laXemTruoc && (
                  <ConfirmDelete
                    moTaBanGhi={`${rowsChon.length} dòng ${nhanThang(thang)}`}
                    onConfirm={xoaDaChon}
                    trigger={
                      <Button size="sm" variant="ghost" title="Xóa các dòng đang tick khỏi tháng này. Có hỏi xác nhận, và xóa xong vẫn còn nút Hoàn tác.">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Xóa dòng đã chọn
                      </Button>
                    }
                  />
                )}
                <Button size="sm" variant="ghost" onClick={boChon} title="Bỏ tick toàn bộ dòng đang chọn.">
                  Bỏ chọn
                </Button>
              </div>
            </div>
          )}

          {timKhongRa && (
            <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {timKiem.trim()
                ? `Không có mặt hàng nào khớp "${timKiem}" trong ${nhanThang(thang)}.`
                : `Mọi dòng của ${nhanThang(thang)} đều không có số liệu và đang bị ẩn.`}{" "}
              <button
                title="Xóa ô tìm và hiện lại dòng trống để thấy toàn bộ mặt hàng của tháng." type="button" className="underline" onClick={() => { setTimKiem(""); setAnDongTrong(false); }}>
                Hiện tất cả
              </button>
            </p>
          )}

          {canhBaoLech && (
            <div className="space-y-2 rounded-xl border border-warning/50 bg-warning/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">
                    Lệch dồn kỳ: tồn đầu {nhanThang(thang)} ({num(lech.openNay)} kg) ≠ tồn cuối{" "}
                    {nhanThang(thangTr)} ({num(lech.closeTruoc)} kg) — lệch{" "}
                    <span className="text-warning">
                      {lech.lech > 0 ? "+" : ""}
                      {num(lech.lech)} kg
                    </span>
                    .
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Vòng gối đầu đúng thì tồn đầu tháng này phải bằng tồn cuối tháng trước. Chênh = ghi
                    chép dồn kỳ sai — soi các nhóm dưới rồi sửa lô ghi lệch (giữ số theo sổ, không ghi đè
                    tự động).
                  </p>
                  {lech.theoNhom.length > 0 && (
                    <ul className="text-sm text-muted-foreground">
                      {lech.theoNhom.map((g) => (
                        <li key={g.category}>
                          • <span className="font-medium text-foreground">{g.category}</span>: cuối{" "}
                          {num(g.closeTruoc)} → đầu {num(g.openNay)} ({g.lech > 0 ? "+" : ""}
                          {num(g.lech)} kg)
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="pt-1">
                    <Button size="sm" onClick={() => setMoDoiChieu(true)} title="Liệt kê từng mặt hàng có tồn đầu tháng này lệch tồn cuối tháng trước, để tự sửa. Chỉ soi — không tự ghi đè số.">
                      <Wrench className="mr-2 h-4 w-4" />
                      Đối chiếu & sửa lệch ({dsDoiChieu.length} mặt hàng)
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {ghiMode ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Gõ tồn đầu / nhập / xuất (kg) từng mã — tồn cuối tự tính. Dán được cả khối từ Excel.
                Enter/Tab sang ô. Sửa mô tả (ngày nhập, tên, invoice, đơn giá, vị trí) bằng nút ✎ ở chế độ xem.
              </p>
              {locMatHang && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-2 text-sm">
                  <span>
                    Đang lọc mặt hàng: <span className="font-semibold text-foreground">{locMatHang}</span> ({rowsGrid.length} dòng)
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setLocMatHang("")} title="Bỏ lọc một mặt hàng — hiện lại toàn bộ dòng của tháng trong lưới ghi.">
                    Bỏ lọc
                  </Button>
                </div>
              )}
              <LuoiNhap
                moTa={`Sổ kho ${nhanThang(thang)}`}
                cot={cotLuoi}
                hang={hangLuoi}
                onGhiO={ghiO}
              />
            </div>
          ) : (
            <div className="space-y-8">
              {nhomList.map((g) => (
                <section key={g.category} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{g.category}</h2>
                    <Badge variant="outline">
                      Tồn cuối {num(g.tong.closeKg)} kg · {g.rows.length} mặt hàng
                    </Badge>
                  </div>
                  <BangTong
                    rows={g.rows}
                    cot={cot(g.tong)}
                    getKey={(r) => r.id}
                    nhanTong={`Cộng ${g.category}`}
                    chon={chonBang}
                    dinhDau
                  />
                </section>
              ))}
            </div>
          )}

          {!laXemTruoc && (
            <div className="flex">
              <Button
                variant="outline"
                onClick={moThem}
                className="w-full sm:w-auto"
                title="Thêm tay một dòng hàng vào tháng đang xem (ngày nhập · tên · invoice · đơn giá · tồn đầu/nhập/xuất · vị trí)."
              >
                <Plus className="mr-2 h-4 w-4" />
                Thêm dòng
              </Button>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {nhanThang(thang)}
            {kho !== TAT_CA_KHO ? ` · kho ${kho}` : " · tất cả kho"}. "Dồn sang tháng sau" kế thừa tồn cuối
            (mọi kho) thành tồn đầu kỳ sau; chạy lại chỉ cập nhật, không nhân đôi.
          </p>
        </>
      )}

      {/* Dialog thêm / sửa dòng */}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">{form?.id ? "Sửa dòng kho" : "Thêm dòng kho"}</DialogTitle>
            <DialogDescription className="text-base">
              {nhanThang(thang)} — nhập tồn đầu · nhập · xuất theo kg. Tồn cuối và tiền còn lại tự tính.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto py-2 pr-1">
              <ErrorSummary loi={loi} />
              <ChuThichBatBuoc />
              <div className="grid gap-4 sm:grid-cols-2">
                <Combobox
                  label="Nhóm hàng"
                  required
                  value={form.category}
                  onChange={(v) => setForm((f) => (f ? { ...f, category: v } : f))}
                  options={[
                    ...new Set(
                      [
                        ...MONTHLY_STOCK_CATEGORIES,
                        ...lines.map((l) => l.category),
                        form.category,
                      ].filter(Boolean)
                    ),
                  ].map((c) => ({ value: c, label: c }))}
                  onCreate={(t) => t}
                />
                <Combobox
                  label="Kho"
                  value={form.warehouse}
                  onChange={(v) => setForm((f) => (f ? { ...f, warehouse: v } : f))}
                  options={KHO_HE_THONG}
                  onCreate={(t) => t}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField
                  label="Ngày nhập"
                  value={form.importDate}
                  onChange={(v) => setForm((f) => (f ? { ...f, importDate: v } : f))}
                />
                <Field label="Tên hàng" required>
                  <Input
                    value={form.itemName}
                    onChange={(e) => setForm((f) => (f ? { ...f, itemName: e.target.value } : f))}
                    placeholder="VD: CÁ SÒNG"
                  />
                </Field>
                <Field label="Size">
                  <Input
                    value={form.size}
                    onChange={(e) => setForm((f) => (f ? { ...f, size: e.target.value } : f))}
                    placeholder="VD: 80↑"
                  />
                </Field>
                <Field label="Invoice">
                  <Input
                    value={form.origin}
                    onChange={(e) => setForm((f) => (f ? { ...f, origin: e.target.value } : f))}
                    placeholder="Số invoice"
                  />
                </Field>
                <NumberField
                  label="Đơn giá"
                  unit="đ"
                  value={form.unitPrice}
                  onChange={(v) => setForm((f) => (f ? { ...f, unitPrice: v } : f))}
                />
                <Combobox
                  label="Vị trí"
                  value={form.storageLocation}
                  onChange={(v) => setForm((f) => (f ? { ...f, storageLocation: v } : f))}
                  options={viTriOpts}
                  onCreate={themViTri}
                  placeholder={form.warehouse ? `Để trống = ${form.warehouse}` : "Chọn kho đang giữ hàng"}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField label="Tồn đầu kỳ" unit="kg" value={form.openKg} onChange={(v) => setForm((f) => (f ? { ...f, openKg: v } : f))} />
                <NumberField label="Nhập trong kỳ" unit="kg" value={form.inKg} onChange={(v) => setForm((f) => (f ? { ...f, inKg: v } : f))} />
                <NumberField label="Xuất trong kỳ" unit="kg" value={form.outKg} onChange={(v) => setForm((f) => (f ? { ...f, outKg: v } : f))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Hủy
            </Button>
            <Button onClick={luuDong} title="Ghi dòng này vào sổ tháng đang xem. Tồn cuối và tiền còn lại tự tính, không phải gõ.">
              <Plus className="mr-1 h-4 w-4" />
              {form?.id ? "Lưu dòng" : "Thêm dòng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog thao tác một dòng: lấy ra dùng · nhập thêm · chuyển vị trí */}
      <Dialog open={!!thaoTac} onOpenChange={(o) => !o && setThaoTac(null)}>
        <DialogContent className="w-full sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {thaoTac?.row.itemName}
              {thaoTac?.row.size ? ` · ${thaoTac.row.size}` : ""}
            </DialogTitle>
            <DialogDescription className="text-base">
              {thaoTac
                ? `Đang ở ${viTriCua(thaoTac.row) || "(chưa rõ)"} · tồn cuối ${num(thaoTac.row.closeKg)} kg${thaoTac.row.origin ? ` · invoice ${thaoTac.row.origin}` : ""}.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {thaoTac && (
            <div className="space-y-4 py-2">
              <ErrorSummary loi={loiTT} />
              <div role="radiogroup" aria-label="Việc cần làm" className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["xuat", "Lấy ra sử dụng", "Xuất đi sản xuất / bán — trừ vào tồn."],
                    ["chuyen", "Gửi kho ngoài", "Gửi ra kho ngoài (Ánh Dương, HP…) hoặc đổi chỗ — tồn không đổi."],
                    ["nhap", "Nhập thêm", "Hàng về thêm cho đúng lô này."],
                  ] as const
                ).map(([k, nhan, moTa]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={thaoTac.kieu === k}
                    title={moTa}
                    onClick={() => setThaoTac((s) => (s ? { ...s, kieu: k } : s))}
                    className={
                      thaoTac.kieu === k
                        ? "min-h-11 rounded-lg border-2 border-primary bg-primary/10 px-3 py-2 text-left"
                        : "min-h-11 rounded-lg border-2 border-border px-3 py-2 text-left hover:bg-muted"
                    }
                  >
                    <div className="font-semibold text-foreground">{nhan}</div>
                    <div className="text-sm text-muted-foreground">{moTa}</div>
                  </button>
                ))}
              </div>
              <ChuThichBatBuoc />
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField
                  label="Số kg"
                  required
                  unit="kg"
                  value={thaoTac.kg}
                  onChange={(v) => setThaoTac((s) => (s ? { ...s, kg: v } : s))}
                />
                <DateField
                  label="Ngày thực hiện"
                  value={thaoTac.ngay}
                  onChange={(v) => setThaoTac((s) => (s ? { ...s, ngay: v } : s))}
                />
              </div>
              {thaoTac.kieu === "chuyen" && (
                <Combobox
                  label="Gửi tới kho (VD Kho Ánh Dương, HP)"
                  required
                  value={thaoTac.viTri}
                  onChange={(v) => setThaoTac((s) => (s ? { ...s, viTri: v } : s))}
                  options={viTriOpts}
                  onCreate={themViTri}
                  choPhepXoa={false}
                />
              )}
              {thaoTac.kieu !== "nhap" && thaoTac.row.closeKg > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setThaoTac((s) => (s ? { ...s, kg: s.row.closeKg } : s))}
                  title="Điền sẵn toàn bộ tồn cuối của dòng vào ô Số kg."
                >
                  Lấy hết {num(thaoTac.row.closeKg)} kg
                </Button>
              )}
              <Field label="Ghi chú (không bắt buộc)">
                <Input
                  value={thaoTac.lyDo}
                  onChange={(e) => setThaoTac((s) => (s ? { ...s, lyDo: e.target.value } : s))}
                  placeholder="VD: xuất xưởng Cá, lệnh SX…"
                />
              </Field>
              <p className="text-sm text-muted-foreground">
                {thaoTac.kieu === "xuat" &&
                  "Số kg được CỘNG vào cột Xuất trong kỳ của dòng này; tồn cuối tự giảm."}
                {thaoTac.kieu === "nhap" &&
                  "Số kg được CỘNG vào cột Nhập trong kỳ. Hàng lô khác (ngày nhập / invoice khác) thì dùng nút Thêm dòng."}
                {thaoTac.kieu === "chuyen" &&
                  "Gửi HẾT tồn cuối ⇒ chỉ đổi Vị trí của dòng (cột Vị trí ghi \"Gửi: <kho>\"). Gửi MỘT PHẦN ⇒ tách thành dòng mới ở kho nhận. Tổng nhập / xuất / tồn của tháng không đổi."}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setThaoTac(null)}>
              Hủy
            </Button>
            <Button onClick={luuThaoTac} title="Ghi thao tác này vào sổ tháng đang xem, kèm ghi chú ngày và số kg ở nhật ký dòng. Có nút Hoàn tác sau khi lưu.">
              <PackageMinus className="mr-1 h-4 w-4" />
              Lưu thao tác
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog gán vị trí cho dòng đang tick */}
      <Dialog open={ganViTri !== null} onOpenChange={(o) => !o && setGanViTri(null)}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Gửi kho ngoài · {rowsChon.length} dòng</DialogTitle>
            <DialogDescription className="text-base">
              Chọn kho đang giữ hàng (VD Kho Ánh Dương, HP). Gõ tên mới sẽ tự lưu vào danh mục kho thuê ngoài. Chỉ ghi cột Vị trí, không đổi số kg hay sổ kho.
            </DialogDescription>
          </DialogHeader>
          {ganViTri !== null && (
            <div className="space-y-4 py-2">
              <ChuThichBatBuoc />
              <Combobox
                label="Kho nhận (VD Kho Ánh Dương, HP)"
                required
                value={ganViTri}
                onChange={(v) => setGanViTri(v)}
                options={viTriOpts}
                onCreate={themViTri}
                choPhepXoa={false}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGanViTri(null)}>
              Hủy
            </Button>
            <Button onClick={ganViTriDaChon} title="Ghi vị trí vừa chọn cho tất cả dòng đang tick. Có nút Hoàn tác sau khi lưu.">
              <MapPin className="mr-1 h-4 w-4" />
              Gán vị trí
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog nhập Excel bảng kê */}
      <Dialog open={!!napForm} onOpenChange={(o) => !o && setNapForm(null)}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Nhập Excel bảng kê kho</DialogTitle>
            <DialogDescription className="text-base">
              Mỗi sheet = một tháng. Nạp tồn đầu · nhập · xuất đúng theo file — tồn cuối &
              tiền còn lại app tự suy. Nạp lại cùng file chỉ cập nhật, không nhân đôi.
            </DialogDescription>
          </DialogHeader>
          {napForm && (
            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Năm (cho mọi sheet)">
                  <Input
                    inputMode="numeric"
                    value={String(napForm.nam)}
                    onChange={(e) => {
                      const n = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                      setNapForm((f) => (f ? { ...f, nam: n } : f));
                    }}
                  />
                </Field>
                <Combobox
                  label="Kho (chọn đúng kho cho cả file)"
                  value={napForm.kho}
                  onChange={(v) => setNapForm((f) => (f ? { ...f, kho: v } : f))}
                  options={KHO_HE_THONG}
                  onCreate={(t) => t}
                />
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                      <th className="px-3 py-2">Sheet</th>
                      <th className="px-3 py-2">Tháng</th>
                      <th className="px-3 py-2 text-right">Số dòng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {napForm.sheets.map((sh) => (
                      <tr key={sh.sheetName} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono">{sh.sheetName}</td>
                        <td className="px-3 py-2">
                          {sh.monthNum ? (
                            nhanThang(`${napForm.nam}-${String(sh.monthNum).padStart(2, "0")}`)
                          ) : (
                            <span className="text-warning">bỏ (tên sheet không phải số tháng)</span>
                          )}
                        </td>
                        <td className="tnum px-3 py-2 text-right">{sh.rows.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">
                Nạp trung thực theo sổ cũ (kể cả lệch dồn kỳ trong file). Sau khi nạp, mở tháng đầu rồi
                bấm "Dồn sang tháng sau" lần lượt để chuẩn hóa tồn đầu các tháng kế.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNapForm(null)}>
              Hủy
            </Button>
            <Button onClick={xacNhanNap} disabled={soDongNap === 0} title="Nạp các sheet đã xem trước vào sổ, theo đúng năm và kho đã chọn. Chọn nhầm kho sẽ tạo bản sao ở kho khác — kiểm lại trước khi bấm.">
              <Upload className="mr-1 h-4 w-4" />
              Nạp {soDongNap} dòng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog đối chiếu lệch dồn kỳ (chẩn đoán theo mặt hàng) */}
      <Dialog open={moDoiChieu} onOpenChange={setMoDoiChieu}>
        <DialogContent className="w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Đối chiếu lệch dồn kỳ theo mặt hàng</DialogTitle>
            <DialogDescription className="text-base">
              So tồn cuối {nhanThang(thangTr)} ↔ tồn đầu {nhanThang(thang)} theo MẶT HÀNG (đã gộp các
              tách size để bỏ báo động giả). Đây là chẩn đoán — bấm "Sửa tay" để mở lưới Ghi lọc đúng mặt
              hàng đó rồi chỉnh số theo phán đoán (không tự sửa để tránh cộng đôi khi lô bị tách/đổi mã).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {dsDoiChieu.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-success/50 bg-success/10 p-3 text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                <span className="font-semibold">Khớp — không còn mặt hàng lệch giữa hai tháng.</span>
              </div>
            ) : (
              <div className="max-h-[55vh] overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr className="text-left">
                      <th className="px-3 py-2">Mặt hàng · kho · nhóm</th>
                      <th className="px-3 py-2 text-right">Cuối {nhanThang(thangTr).replace("Tháng ", "T")}</th>
                      <th className="px-3 py-2 text-right">Đầu {nhanThang(thang).replace("Tháng ", "T")}</th>
                      <th className="px-3 py-2 text-right">Lệch (kg)</th>
                      <th className="px-3 py-2 text-right">Sửa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dsDoiChieu.map((d) => (
                      <tr key={d.key} className="border-t border-border align-top">
                        <td className="px-3 py-2">
                          <div className="font-medium text-foreground">{d.itemName}</div>
                          <div className="text-xs text-muted-foreground">
                            {[d.warehouse, d.category].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td className="tnum px-3 py-2 text-right">{num(d.closeTruocKg)}</td>
                        <td className="tnum px-3 py-2 text-right">{num(d.openNayKg)}</td>
                        <td className="tnum px-3 py-2 text-right font-semibold text-warning">
                          {d.lechKg > 0 ? "+" : ""}
                          {num(d.lechKg)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => suaTayMatHang(d)} title="Mở lưới ghi đã lọc sẵn đúng mặt hàng này, để tự chỉnh tồn đầu / nhập / xuất cho khớp tháng trước.">
                            <Pencil className="mr-1 h-4 w-4" />
                            Sửa tay
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Lệch = ghi chép dồn kỳ chưa khớp (tồn đầu tháng này ≠ tồn cuối tháng trước). "Sửa tay" mở
              lưới Ghi đã lọc mặt hàng để bạn chỉnh tồn đầu/nhập/xuất; hoặc dùng "Dồn sang tháng sau" từ
              tháng trước cho tháng còn TRỐNG.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoDoiChieu(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog đồng bộ danh mục loại nguyên liệu */}
      <Dialog open={moDongBo} onOpenChange={setMoDongBo}>
        <DialogContent className="w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Đồng bộ danh mục</DialogTitle>
            <DialogDescription className="text-base">
              Với mỗi mã khó (2 DA RÂU NGẮN…): chọn ĐÍCH (Mặt hàng / Loại NL) rồi **ánh xạ tới tên CHUẨN
              có sẵn** trong danh mục (gõ tìm) — hoặc gõ thêm mới nếu chưa có. Áp xong: tên chuẩn được thêm
              (nếu mới) và MỌI dòng sổ mang tên cũ được đổi sang tên chuẩn (đồng bộ + gộp trùng cách ghi).
              Tên tự rõ loài (CÁ THU…) gom ở mục "rõ ràng". Thành phẩm 141 mã kế toán cố định — không thêm ở đây.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{dongBo.tongTen} tên trong sổ</Badge>
              <Badge variant="outline">
                đã có: {dongBo.daCoMH} mặt hàng · {dongBo.daCoNL} loại NL
              </Badge>
              <Badge variant="secondary">{canDongBo.length} mã khó cần đồng bộ</Badge>
              <Badge variant="outline">{dsRoRang.length} tên rõ ràng</Badge>
              <Badge variant="outline">{dongBo.nhomTrung.length} nhóm trùng cách ghi</Badge>
            </div>

            {canDongBo.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-semibold text-foreground">
                    <ListChecks className="h-4 w-4" /> {canDongBo.length} mã khó — chọn ĐÍCH từng dòng
                  </h3>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => datDich(canDongBo, "goiY")} title="Trả mọi mã khó về đích mà hệ thống gợi ý (đoán từ tên: có size/dấu chế biến → Mặt hàng, còn lại → Loại NL).">
                      Theo gợi ý
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => datDich(canDongBo, "product")} title="Đặt toàn bộ mã khó về danh mục Mặt hàng.">
                      Tất cả → Mặt hàng
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => datDich(canDongBo, "material")} title="Đặt toàn bộ mã khó về danh mục Loại nguyên liệu.">
                      Tất cả → Loại NL
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => datDich(canDongBo, "skip")} title="Bỏ qua toàn bộ mã khó lần này — không thêm vào danh mục nào.">
                      Bỏ qua hết
                    </Button>
                  </div>
                </div>
                <div className="max-h-[38vh] space-y-1 overflow-auto rounded-lg border border-border p-2">
                  {canDongBo.map(dongRow)}
                </div>
              </div>
            )}

            {dsRoRang.length > 0 && (
              <details className="rounded-lg border border-border">
                <summary className="cursor-pointer px-3 py-2 font-medium text-foreground">
                  Tên rõ ràng — tự nhận loài ({dsRoRang.length}) · CÁ THU/SANMA… (mặc định → Loại NL, đổi được)
                </summary>
                <div className="space-y-2 px-3 pb-3">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => datDich(dsRoRang, "goiY")} title="Trả các tên rõ ràng về đích hệ thống gợi ý.">
                      Theo gợi ý
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => datDich(dsRoRang, "material")} title="Đặt toàn bộ tên rõ ràng (cá, tôm, mực nguyên con…) về danh mục Loại nguyên liệu.">
                      Tất cả → Loại NL
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => datDich(dsRoRang, "product")} title="Đặt toàn bộ tên rõ ràng về danh mục Mặt hàng.">
                      Tất cả → Mặt hàng
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => datDich(dsRoRang, "skip")} title="Bỏ qua toàn bộ tên rõ ràng lần này.">
                      Bỏ qua hết
                    </Button>
                  </div>
                  <div className="max-h-[30vh] space-y-1 overflow-auto rounded-lg border border-border p-2">
                    {dsRoRang.map(dongRow)}
                  </div>
                </div>
              </details>
            )}

            {(canDongBo.length > 0 || dsRoRang.length > 0) && (
              <Button onClick={apDongBo} disabled={soMH + soNL === 0} title="Thêm các tên chưa có vào danh mục đã chọn, và đổi tên các dòng sổ mang tên cũ sang tên chuẩn đã ánh xạ.">
                <Library className="mr-2 h-4 w-4" />
                Đồng bộ: {soMH} → Mặt hàng · {soNL} → Loại NL
              </Button>
            )}

            {dongBo.nhomTrung.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Tên chỉ khác nhau cách ghi (nên gộp về một)</h3>
                <div className="max-h-[28vh] space-y-1 overflow-auto rounded-lg border border-warning/40 bg-warning/5 p-2 text-sm">
                  {dongBo.nhomTrung.map((g) => (
                    <div key={g.variants.join("|")} className="text-muted-foreground">
                      • {g.variants.map((v) => `"${v}"`).join("  ·  ")}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Các tên trên bị đếm THÀNH NHIỀU mặt hàng khi tổng hợp. Sửa về một cách ghi ở lưới Ghi
                  (nút ✎) để sổ gộp đúng.
                </p>
              </div>
            )}

            {dongBo.chuaCo.length === 0 && dongBo.nhomTrung.length === 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-success/50 bg-success/10 p-3 text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                <span className="font-semibold">Tên trong sổ đã khớp danh mục, không có tên trùng cách ghi.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoDongBo(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Thẻ kho: lịch sử một mặt hàng qua các tháng (sổ chi tiết vật tư) */}
      <Dialog open={!!xemThe} onOpenChange={(o) => !o && setXemThe(null)}>
        <DialogContent className="w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Thẻ kho — {xemThe?.itemName}</DialogTitle>
            <DialogDescription className="text-base">
              {xemThe
                ? `${xemThe.warehouse || "(chưa rõ kho)"} · nhóm ${xemThe.category || "(chưa phân nhóm)"}. Gộp mọi lô/size của mặt hàng này (cùng cách đối chiếu dồn kỳ) — mỗi tháng một dòng, mới nhất trước.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {xemThe && (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto py-2 pr-1">
              <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm sm:grid-cols-2">
                <div>
                  Size: <span className="font-medium text-foreground">{xemThe.size || "—"}</span>
                </div>
                <div>
                  Invoice: <span className="font-medium text-foreground">{xemThe.origin || "—"}</span>
                </div>
                <div>
                  Vị trí: <span className="font-medium text-foreground">{viTriCua(xemThe) || "—"}</span>
                </div>
                <div>
                  Đơn giá:{" "}
                  <span className="tnum font-medium text-foreground">
                    {soHoacGach(xemThe.unitPrice ?? 0)} đ
                  </span>
                </div>
                <div>
                  Ngày nhập:{" "}
                  <span className="font-medium text-foreground">
                    {xemThe.importDate ? viDate(xemThe.importDate) : "—"}
                  </span>
                </div>
                {xemThe.note && (
                  <div className="sm:col-span-2">
                    Nhật ký thao tác:
                    <div className="mt-1 whitespace-pre-line font-medium text-foreground">{xemThe.note}</div>
                  </div>
                )}
                <div>
                  Dòng này sinh ra do dồn kỳ:{" "}
                  <span className="font-medium text-foreground">{xemThe.carriedFromId ? "có" : "không"}</span>
                </div>
              </div>

              <div className="scroll-nice-x overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th scope="col" className="border-b border-border px-3 py-2 text-left">Kỳ</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-right">Tồn đầu (kg)</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-right">Nhập (kg)</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-right">Xuất (kg)</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-right">Tồn cuối (kg)</th>
                      <th scope="col" className="border-b border-border px-3 py-2 text-right">SL dòng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dsTheKho.map((t) => (
                      <tr key={t.period} className={t.period === thang ? "bg-primary/5" : undefined}>
                        <td className="border-b border-border px-3 py-2 font-medium text-foreground">
                          {nhanThang(t.period)}
                        </td>
                        <td className="tnum border-b border-border px-3 py-2 text-right">{soHoacGach(t.openKg)}</td>
                        <td className="tnum border-b border-border px-3 py-2 text-right text-success">
                          {t.inKg ? `+${num(t.inKg)}` : "—"}
                        </td>
                        <td className="tnum border-b border-border px-3 py-2 text-right text-warning">
                          {t.outKg ? `−${num(t.outKg)}` : "—"}
                        </td>
                        <td className="tnum border-b border-border px-3 py-2 text-right font-bold text-foreground">
                          {num(t.closeKg)}
                        </td>
                        <td className="tnum border-b border-border px-3 py-2 text-right">{t.soDong}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dsTheKho.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Mặt hàng này chưa có dòng nào đã LƯU trong sổ (đang xem trước dồn kỳ).
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Vòng gối đầu đúng thì tồn cuối kỳ trên = tồn đầu kỳ dưới liền kề. Lệch ⇒ soi bằng "Đối chiếu &
                sửa lệch" ở banner cảnh báo.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setXemThe(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In A4 — có tick dòng thì in ĐÚNG mấy dòng đó (kèm tổng của chúng) */}
      {moIn && coDuLieu && (
        <PhieuIn
          tieuDe="Bảng kê kho theo tháng"
          phuDe={`${nhanThang(thang)}${kho !== TAT_CA_KHO ? ` · kho ${kho}` : ""}${
            rowsChon.length ? ` · ${rowsChon.length} dòng đã chọn` : ""
          }${laXemTruoc ? " · XEM TRƯỚC (chưa lưu)" : ""}`}
          onClose={() => setMoIn(false)}
        >
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>Ngày lập: {viDate(homNay())}</span>
            <span>SL mặt hàng: {rowsIn.length}</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <ThIn>Nhóm · mặt hàng</ThIn>
                <ThIn right>Tồn đầu (kg)</ThIn>
                <ThIn right>Nhập (kg)</ThIn>
                <ThIn right>Xuất (kg)</ThIn>
                <ThIn right>Tồn cuối (kg)</ThIn>
                <ThIn right>Tiền còn lại (đ)</ThIn>
              </tr>
            </thead>
            <tbody>
              <tr>
                <TdIn dam>Tổng cộng — {rowsIn.length} mặt hàng</TdIn>
                <TdIn dam right>{num(tongIn.openKg)}</TdIn>
                <TdIn dam right>{num(tongIn.inKg)}</TdIn>
                <TdIn dam right>{num(tongIn.outKg)}</TdIn>
                <TdIn dam right>{num(tongIn.closeKg)}</TdIn>
                <TdIn dam right>{num(Math.round(tongIn.remainingValue))}</TdIn>
              </tr>
              {nhomIn.map((g) => (
                <FragmentGroup key={g.category} group={g} />
              ))}
            </tbody>
          </table>
        </PhieuIn>
      )}
    </div>
  );
}

/** Một nhóm trên bản in: dòng tiêu đề nhóm + các mặt hàng + dòng cộng nhóm. */
function FragmentGroup({ group }: { group: ReturnType<typeof gomNhom>[number] }) {
  return (
    <>
      <tr>
        <TdIn dam colSpan={6}>{group.category}</TdIn>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.id}>
          <TdIn>
            {r.itemName}
            {r.size ? ` · ${r.size}` : ""}
          </TdIn>
          <TdIn right>{num(r.openKg)}</TdIn>
          <TdIn right>{r.inKg ? num(r.inKg) : ""}</TdIn>
          <TdIn right>{r.outKg ? num(r.outKg) : ""}</TdIn>
          <TdIn right>{num(r.closeKg)}</TdIn>
          <TdIn right>{r.remainingValue ? num(Math.round(r.remainingValue)) : ""}</TdIn>
        </tr>
      ))}
      <tr>
        <TdIn dam>Cộng {group.category}</TdIn>
        <TdIn dam right>{num(group.tong.openKg)}</TdIn>
        <TdIn dam right>{num(group.tong.inKg)}</TdIn>
        <TdIn dam right>{num(group.tong.outKg)}</TdIn>
        <TdIn dam right>{num(group.tong.closeKg)}</TdIn>
        <TdIn dam right>{num(Math.round(group.tong.remainingValue))}</TdIn>
      </tr>
    </>
  );
}
