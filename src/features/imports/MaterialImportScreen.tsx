// ============================================================
// Tên file cũ: src/features/imports/NhapNguyenLieu.tsx
// Tên tiếng Việt: Màn hình Nhập Nguyên Liệu ngày
// Description: Material Import Management Screen
// ============================================================
import { useEffect, useMemo, useState } from "react";
import type {
  DailyLock,
  ImportShipment,
  MaterialImportItem,
  Workshop,
  Category,
} from "@/types";
import { isBackdatedImport, calculateImportAmount } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import {
  useDailyLocks,
  useImportShipments,
  useSuppliers,
  useMaterialTypes,
  useMaterialImports,
  useScraps,
} from "@/lib/catalogRepo";
import {
  Badge,
  ChuThichBatBuoc,
  Button,
  ChoiceGroup,
  Combobox,
  ConfirmDelete,
  DateField,
  DateRangeField,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  SkeletonBang,
  ErrorSummary,
  Field,
  Input,
  RecordTable,
  ThongKe,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { kg, num, todayISO, viDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { DailyTaskReminder, QrTemLoIn, PhieuTrongNhapNL } from "@/features/shared";
import { OcrPhieuNhap } from "./OcrPhieuNhap";
import { coOcr, type DanhMucOcr } from "@/lib/ocr";
import { coLuuAnh, urlAnh } from "@/lib/storage";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import {
  CalendarRange,
  Camera,
  ChevronDown,
  FileText,
  Lock,
  LockOpen,
  Pencil,
  QrCode,
  Plus,
  Printer,
  Save,
  Scale,
  SlidersHorizontal,
  TriangleAlert,
  Truck,
  Warehouse,
  X,
  Replace,
} from "lucide-react";
import PhieuNLNgay from "@/features/imports/DailyImportInvoice";
import BaoCaoNhap from "@/features/imports/ImportReport";
import { cn } from "@/lib/utils";

import { HopDoiLoaiHangLoat } from "./BulkTypeChange";

import { BangDongHang } from "./BangDongHang";
import { KhoiPheLieuNgay } from "./KhoiPheLieuNgay";
import {
  LOAI_MAC_DINH,
  PHAN_XUONG,
  dongBangRong,
  dongCoData,
  dongDayDu,
  gomChuyen,
  loiDauChuyen,
  sinhMaLo,
  type DauChuyen,
  type DongBang,
  type NhomChuyen,
} from "./importHelpers";

export default function NhapNguyenLieuScreen() {
  // Người đang đăng nhập → gắn làm "người ghi" của chuyến khi lưu.
  const { nguoiDung } = useAuth();
  const nguoiThaoTac = nguoiDung?.fullName || nguoiDung?.username || "";
  // kỳ xem sổ: ngày/tuần/tháng/năm/khoảng tự chọn
  const [rows, persist, { trangThai }] = useMaterialImports();
  const dangTai = trangThai === "dang-tai" && rows.length === 0;
  const [chuyen, persistChuyen] = useImportShipments();
  const [chot, persistChot] = useDailyLocks();
  const [pheLieu, persistPheLieu] = useScraps();

  const [ky, setKy] = useState<KyXem>("ngay");
  const [ngay, setNgay] = useState(todayISO()); // ngày neo cho ngày/tuần/tháng/năm
  const [tuNgay, setTuNgay] = useState(todayISO());
  const [denNgay, setDenNgay] = useState(todayISO());
  const [phanXuong, setPhanXuong] = useState<Workshop | "Tất cả">("Đông");
  const [locDaiLy, setLocDaiLy] = useState("");
  const [locLoaiNL, setLocLoaiNL] = useState("");
  const [locGia, setLocGia] = useState<"tat-ca" | "thieu-gia">("tat-ca");
  const [moLocThem, setMoLocThem] = useState(false);
  const [doiLoaiMo, setDoiLoaiMo] = useState(false);
  const [xemPhieu, setXemPhieu] = useState(false);
  const [inPhieuTrong, setInPhieuTrong] = useState(false);

  const [daiLy, setDaiLy] = useSuppliers();
  const [loaiNL, setLoaiNL] = useMaterialTypes();

  /* Ghi chuyến: đầu chuyến ở trên, cả BẢNG loại hàng điền một lượt rồi lưu. */
  const [phien, setPhien] = useState<DauChuyen | null>(null);
  /** Ba chế độ phẳng: "nhap" = form ghi (mặc định); "so" = sổ ngày; "bao-cao" = báo cáo tổng hợp. */
  const [cheDo, setCheDo] = useState<"nhap" | "so" | "bao-cao">("nhap");
  const [ocrMo, setOcrMo] = useState(false); // modal nhận diện ảnh phiếu (OCR)
  const [chuyenInTem, setChuyenInTem] = useState<ImportShipment | null>(null);
  const [chuyenIdPhien, setChuyenIdPhien] = useState<string | null>(null);
  const [dongBang, setDongBang] = useState<DongBang[]>([]);
  /** Loài dùng gần nhất trong phiên — làm mặc định cho chuyến/dòng mới thay vì
   *  luôn nhảy về "Bạch tuộc" (sai ở xưởng Khô/Cá). */
  const [loaiGanNhat, setLoaiGanNhat] = useState<Category>(LOAI_MAC_DINH);
  const [loiPhien, setLoiPhien] = useState<LoiNhap[]>([]);
  // Khối "Xe và ghi chú" (tài xế/biển số) mở sẵn — hầu hết chuyến đều có.
  const [moPhuPhien, setMoPhuPhien] = useState(true);

  /* Đang sửa một chuyến đã ghi: id các dòng của chuyến đó (null = đang tạo mới).
     Dùng id-set thay vì chỉ chuyenId để sửa được CẢ dữ liệu cũ (không có chuyenId). */
  const [suaRowIds, setSuaRowIds] = useState<string[] | null>(null);

  /* Chốt ngày */
  const [hoiChot, setHoiChot] = useState(false);
  /** Nhắc "còn dòng nhập chưa lưu" trước khi mở hộp chốt. */
  const [nhacLuu, setNhacLuu] = useState(false);
  const [ghiChuChot, setGhiChuChot] = useState("");
  const [hoiMoLai, setHoiMoLai] = useState(false);
  const [lyDoMoLai, setLyDoMoLai] = useState("");
  const [loiChot, setLoiChot] = useState<LoiNhap[]>([]);

  /** [từ, đến] của kỳ đang xem — mọi lọc/tổng tính theo khoảng này. */
  const [tuHieuLuc, denHieuLuc] = phamViKy(ky, ngay, tuNgay, denNgay);
  /** Kỳ chỉ gồm đúng một ngày ⇒ mới có nghĩa để chốt / phế liệu ngày. */
  const laMotNgay = tuHieuLuc === denHieuLuc;

  const view = useMemo(
    () =>
      rows
        .filter((r) => {
          const hopNgay =
            r.deliveryDate >= tuHieuLuc && r.deliveryDate <= denHieuLuc;
          const hopXuong = phanXuong === "Tất cả" || r.workshop === phanXuong;
          const hopDaiLy = !locDaiLy || r.supplierName === locDaiLy;
          const hopLoai = !locLoaiNL || r.materialTypeName === locLoaiNL;
          const hopGia = locGia === "tat-ca" || r.unitPrice == null;
          return hopNgay && hopXuong && hopDaiLy && hopLoai && hopGia;
        })
        .sort(
          (a, b) =>
            a.deliveryDate.localeCompare(b.deliveryDate) ||
            a.id.localeCompare(b.id)
        ),
    [rows, tuHieuLuc, denHieuLuc, phanXuong, locDaiLy, locLoaiNL, locGia]
  );

  const nhomView = useMemo(() => gomChuyen(view, chuyen), [view, chuyen]);

  /** Ngày / xưởng mặc định khi ghi chuyến mới — theo bộ lọc đang xem. */
  const ngayGhi = laMotNgay ? tuHieuLuc : denHieuLuc;
  const xuongGhi: Workshop = phanXuong === "Tất cả" ? "Đông" : phanXuong;

  const moTaPhamVi = laMotNgay
    ? viDate(tuHieuLuc)
    : `${viDate(tuHieuLuc)} – ${viDate(denHieuLuc)}`;

  const tong = useMemo(
    () => view.reduce((s, r) => s + (r.quantityKg || 0), 0),
    [view]
  );
  const tongTien = useMemo(
    () => view.reduce((s, r) => s + calculateImportAmount(r), 0),
    [view]
  );
  const soThieuGia = useMemo(
    () => view.filter((r) => r.unitPrice == null).length,
    [view]
  );

  /** Số bộ lọc phụ đang bật (đại lý / loại NL / đơn giá) — hiện lên nút gom. */
  const soLocThem =
    (locDaiLy ? 1 : 0) + (locLoaiNL ? 1 : 0) + (locGia !== "tat-ca" ? 1 : 0);

  /* ---- Chốt ngày ---- */

  /** Bản ghi chốt của một (ngày + xưởng) — kể cả bản đã mở lại. */
  const banGhiChot = (n: string, x: Workshop): DailyLock | undefined =>
    chot.find((c) => c.lockDate === n && c.workshop === x);

  const daChot = (n: string, x: Workshop): boolean =>
    Boolean(banGhiChot(n, x)?.isLocked);

  /* Nhắc daily-task: hôm nay (xưởng đang chọn) đã chốt nhập chưa. */
  const daChotNhapHomNay = daChot(todayISO(), xuongGhi);

  /** Tổng kg thực tế của một (ngày + xưởng), không phụ thuộc bộ lọc đang xem. */
  const tongNgayXuong = (n: string, x: Workshop): number =>
    rows
      .filter((r) => r.deliveryDate === n && r.workshop === x)
      .reduce((s, r) => s + (r.quantityKg || 0), 0);

  /* Thanh chốt chỉ có nghĩa khi đang xem MỘT ngày của MỘT xưởng. */
  const xemMotNgayMotXuong = laMotNgay && phanXuong !== "Tất cả";
  const xuongDangXem = phanXuong === "Tất cả" ? "Đông" : phanXuong;
  const chotHienTai = xemMotNgayMotXuong
    ? banGhiChot(tuHieuLuc, xuongDangXem)
    : undefined;
  const dangKhoa = Boolean(chotHienTai?.isLocked);
  const tongThucTe = xemMotNgayMotXuong
    ? tongNgayXuong(tuHieuLuc, xuongDangXem)
    : 0;
  const lechSauChot =
    chotHienTai?.isLocked && tongThucTe !== chotHienTai.totalKgAtLock
      ? tongThucTe - chotHienTai.totalKgAtLock
      : 0;

  /* ---- Danh mục: chọn sẵn, thiếu thì tạo ngay tại chỗ ----
     Lưu theo TÊN (không phải id) để dữ liệu cũ trong localStorage vẫn đọc được. */

  /** Dòng phụ của đại lý: gộp các thông tin nhận diện, ngăn bởi dấu gạch ngang.
   *  Vừa hiện dưới tên trong dropdown, vừa nằm trong chuỗi tìm kiếm của Combobox. */
  const moTaDaiLy = (d: (typeof daiLy)[number]): string | undefined =>
    [d.code, d.billingName, d.phone, d.address]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(" – ") || undefined;

  const optDaiLy: MucChon[] = daiLy.map((d) => ({
    value: d.shortName,
    label: d.code ? `${d.code} · ${d.shortName}` : d.shortName,
    phu: moTaDaiLy(d),
  }));

  const themDaiLy = (ten: string) => {
    setDaiLy([
      ...daiLy,
      {
        id: uid(),
        code: "",
        shortName: ten,
        billingName: "",
        address: "",
        nationalId: "",
        issuedDate: "",
        issuedPlace: "",
        phone: "",
        note: "",
      },
    ]);
    notify.daLuu(`Đã thêm đại lý "${ten}" vào danh mục`);
    return ten;
  };

  /** Tất cả loại NL — dùng cho BỘ LỌC (xem theo loại, không ràng loài). */
  const optLoaiNL: MucChon[] = loaiNL.map((l) => ({
    value: l.name,
    label: l.name,
    phu: l.category || undefined,
  }));

  /** Loại NL lọc theo loài: mục chưa gán loài (loai rỗng) hiện cho mọi loài;
      mục đã gán chỉ hiện đúng loài đang chọn. Chọn loài trước, loại NL sau. */
  const optLoaiNLTheoLoai = (loai: string): MucChon[] =>
    loaiNL
      .filter((l) => !l.category || l.category === loai)
      .map((l) => ({
        value: l.name,
        label: l.name,
        phu: l.category || undefined,
      }));

  const themLoaiNL = (ten: string, loai = "") => {
    setLoaiNL([...loaiNL, { id: uid(), name: ten, category: loai, note: "" }]);
    notify.daLuu(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
    return ten;
  };

  /* ---- Ghi chuyến ---- */

  const moThem = () => {
    setPhien({
      deliveryDate: ngayGhi,
      postingDate: todayISO(),
      backdateReason: "",
      workshop: xuongGhi,
      // Đang lọc theo một đại lý → điền sẵn đại lý đó, khỏi chọn lại.
      supplierName: locDaiLy,
      driverName: "",
      licensePlate: "",
      note: "",
      ssccCode: "",
      scanPath: "",
    });
    setChuyenIdPhien(null);
    setSuaRowIds(null);
    setDongBang([dongBangRong(loaiGanNhat)]);
    setLoiPhien([]);
    // Auto mở khối "Xe và ghi chú" — hầu hết chuyến đều có tài xế/biển số.
    setMoPhuPhien(true);
  };

  // Form-first: vào "Ghi nhập" mà chưa có phiếu → tự mở phiếu trống (không modal).
  useEffect(() => {
    if (cheDo === "nhap" && phien === null && !dangTai) moThem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheDo, phien, dangTai]);

  // Trong "Ghi nhập", ngày+xưởng của PHIẾU là ngữ cảnh → đồng bộ về bộ lọc để
  // sổ/phế liệu/chốt/tổng ngày bám đúng ngày đang ghi.
  useEffect(() => {
    if (cheDo === "nhap" && phien) {
      setKy("ngay");
      setNgay(phien.deliveryDate);
      setPhanXuong(phien.workshop);
    }
  }, [cheDo, phien?.deliveryDate, phien?.workshop]);

  /** Mở lại một chuyến đã ghi để sửa — dùng CHUNG dialog với ghi chuyến mới. */
  const moSuaChuyen = (n: NhomChuyen) => {
    setPhien({
      deliveryDate: n.deliveryDate,
      postingDate: n.postingDate || n.deliveryDate,
      backdateReason: n.backdateReason,
      workshop: n.workshop,
      supplierName: n.supplierName,
      driverName: n.driverName,
      licensePlate: n.licensePlate,
      note: n.note,
      ssccCode: n.chuyen?.ssccCode ?? "",
      scanPath: n.chuyen?.scanPath ?? "",
    });
    setChuyenIdPhien(n.chuyen?.id ?? null);
    setSuaRowIds(n.dong.map((r) => r.id));
    // Nạp mọi dòng đã ghi vào bảng (giữ id để cập nhật đúng bản ghi). Muốn thêm
    // loại mới thì bấm nút "Thêm loại hàng" — không tự sinh dòng.
    setDongBang(
      n.dong.map((r) => ({
        key: r.id,
        id: r.id,
        category: r.category,
        materialTypeName: r.materialTypeName,
        quantityKg: r.quantityKg,
        unitPrice: r.unitPrice,
      }))
    );
    setLoiPhien([]);
    setMoPhuPhien(true);
    setCheDo("nhap"); // sửa chuyến mở trong form inline (chế độ Ghi nhập)
  };

  const datPhien = <K extends keyof DauChuyen>(k: K, v: DauChuyen[K]) =>
    setPhien((p) => (p ? { ...p, [k]: v } : p));

  /** Đổi ngày ghi sổ: LUÔN kéo ngày hàng về nhảy theo (chủ động). Muốn hàng về
   *  ngày khác (ghi bù) thì sửa tay ô "Ngày hàng về xưởng" sau đó. */
  const doiNgayGhiSo = (v: string) =>
    setPhien((p) => (p ? { ...p, postingDate: v, deliveryDate: v } : p));

  /** Chỉnh tay ngày hàng về ⇒ khác ngày ghi sổ (ghi bù). Đổi lại ngày ghi sổ sau
   *  đó thì ngày hàng về vẫn nhảy theo như thường. */
  const doiNgayVe = (v: string) => datPhien("deliveryDate", v);

  /** Đang sửa chuyến đã ghi (khác với tạo chuyến mới). */
  const dangSuaChuyen = suaRowIds !== null;
  /** Các dòng trong bảng đủ để lưu (có loại + số lượng). */
  const dongHopLe = dongBang.filter(dongDayDu);
  const tongChuyen = dongHopLe.reduce((s, d) => s + d.quantityKg, 0);
  const tienChuyen = dongHopLe.reduce(
    (s, d) => s + d.quantityKg * (d.unitPrice ?? 0),
    0
  );
  /** Số dòng ĐÃ LƯU đang mở trong bảng — cho câu "sửa đầu chuyến áp cho N dòng". */
  const soDongDaLuu = dongBang.filter((d) => d.id).length;
  /** Đang ở "Ghi nhập" và còn dòng hợp lệ CHƯA lưu vào sổ (dòng mới id=null) —
   *  để nhắc trước khi chốt ngày, kẻo số vừa gõ chưa tính vào tổng chốt. */
  const coDongChuaLuu = cheDo === "nhap" && dongHopLe.some((d) => !d.id);
  const chotPhien = phien ? daChot(phien.deliveryDate, phien.workshop) : false;

  /** Dòng đã lưu thuộc chuyến đang mở (id-set khi sửa; tạo mới thì chưa có gì). */
  const thuocPhienDaLuu = (r: MaterialImportItem) =>
    suaRowIds ? suaRowIds.includes(r.id) : false;
  /** Tổng ngày = số đã lưu của ngày/xưởng (trừ chuyến đang mở, khỏi đếm đôi) +
   *  số đang gõ trong bảng ⇒ xem trước tổng ngày ngay cả khi chưa lưu. */
  const tongNgayNgoaiChuyen = phien
    ? rows
        .filter(
          (r) =>
            r.deliveryDate === phien.deliveryDate &&
            r.workshop === phien.workshop &&
            !thuocPhienDaLuu(r)
        )
        .reduce((s, r) => s + (r.quantityKg || 0), 0)
    : 0;
  const tongNgayPhien = tongNgayNgoaiChuyen + tongChuyen;

  /** Sửa một ô trong bảng (không tự sinh/xô dòng — thêm dòng bằng nút riêng). */
  const capNhatDong = (key: string, patch: Partial<DongBang>) =>
    setDongBang((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  /** Bỏ một dòng; luôn còn ít nhất một dòng để nhập. */
  const boDong = (key: string) =>
    setDongBang((ds) => {
      const con = ds.filter((d) => d.key !== key);
      return con.length ? con : [dongBangRong(loaiGanNhat)];
    });

  /** Thêm một dòng trống ở CUỐI bảng (mặc định loài theo dòng cuối cho nhanh). */
  const themDongMoi = () =>
    setDongBang((ds) => [
      ...ds,
      dongBangRong(ds[ds.length - 1]?.category ?? loaiGanNhat),
    ]);

  /* ---- OCR: chụp ảnh phiếu → gợi ý điền form (nháp, người soát lại) ---- */

  /** Danh mục để OCR dò khớp tên trên phiếu (đại lý theo tên tắt, loại NL). */
  const danhMucOcr: DanhMucOcr = useMemo(
    () => ({
      daiLy: daiLy.map((d) => ({ name: d.shortName, code: d.code })),
      loaiNL: loaiNL.map((l) => ({ name: l.name })),
    }),
    [daiLy, loaiNL]
  );

  /** OCR đề xuất một dòng: nối vào bảng (thay dòng trống đầu nếu bảng chưa có data). */
  const themDongTuOcr = (ten: string, soKg: number) =>
    setDongBang((ds) => {
      const mt = loaiNL.find((l) => l.name === ten);
      const cat = (mt?.category || ds[ds.length - 1]?.category || loaiGanNhat) as Category;
      const moi: DongBang = { ...dongBangRong(cat), materialTypeName: ten, quantityKg: soKg };
      return ds.some(dongCoData) ? [...ds, moi] : [moi];
    });

  /** Mở ảnh phiếu đã đính (signed URL có hạn) để đối chiếu tay. */
  const xemAnhPhieu = async () => {
    if (!phien?.scanPath) return;
    const url = await urlAnh(phien.scanPath);
    if (url) window.open(url, "_blank", "noopener");
    else notify.loi("Chưa xem được ảnh (cần đăng nhập máy chủ).");
  };

  /**
   * Lưu cả chuyến MỘT LẦN: tạo/ghi chuyến + mọi dòng hợp lệ trong bảng, một lần
   * persist. Giữ nguyên bất biến "đầu chuyến áp cho mọi dòng", "chuyến chỉ tạo
   * khi có dòng", "dữ liệu cũ không tự sinh chuyến".
   *
   * `imLang` = đóng nhanh bằng X / Esc / bấm ra ngoài: có dòng đủ thì vẫn lưu
   * (không để mất số đã gõ), chưa đủ thì bỏ qua lặng lẽ, không nài lỗi.
   * Trả về true nếu đóng được dialog (đã lưu, hoặc không có gì để lưu khi imLang).
   */
  const luuPhien = (imLang: boolean): boolean => {
    if (!phien) return true;
    const hopLe = dongBang.filter(dongDayDu);
    const ls: LoiNhap[] = [...loiDauChuyen(phien, chotPhien)];
    if (hopLe.length === 0)
      ls.push({
        truong: "Loại hàng",
        thongBao: "Thêm ít nhất một loại hàng vào chuyến",
      });
    // Dòng dở dang (có loại thiếu số, hoặc có số chưa chọn loại): chỉ chặn khi
    // người dùng bấm Lưu — đóng nhanh bằng X thì lặng lẽ bỏ dòng dở, giữ dòng đủ.
    if (!imLang)
      dongBang.forEach((d, i) => {
        if (dongCoData(d) && !dongDayDu(d))
          ls.push({
            truong: `Dòng ${i + 1}`,
            thongBao: !d.materialTypeName.trim()
              ? "Chưa chọn loại hàng"
              : "Số lượng phải lớn hơn 0 kg",
          });
      });

    if (ls.length > 0) {
      if (!imLang) setLoiPhien(ls);
      return false;
    }

    // Sửa dữ liệu cũ (không có bản ghi chuyến) → giữ chuyenId rỗng, gom nhóm nhờ
    // (ngày + xưởng + đại lý + xe). KHÔNG tự sinh chuyến cho dữ liệu cũ.
    const suaDuLieuCu = dangSuaChuyen && !chuyenIdPhien;
    let idChuyen = chuyenIdPhien;
    let chuyenSau = chuyen;
    if (chuyenIdPhien) {
      chuyenSau = chuyen.map((c) =>
        c.id === chuyenIdPhien ? { ...c, ...phien, id: c.id } : c
      );
    } else if (!suaDuLieuCu) {
      idChuyen = newId();
      chuyenSau = [
        ...chuyen,
        {
          id: idChuyen,
          ...phien,
          lotCode: sinhMaLo(phien.deliveryDate, phien.workshop, chuyen),
          operator: nguoiThaoTac,
        },
      ];
    }

    // Dòng của chuyến = các dòng hợp lệ trong bảng: dòng cũ giữ id (cập nhật),
    // dòng mới cấp id mới; dòng đã bỏ khỏi bảng không đưa lại (tức là xóa).
    const rowsGiuLai = rows.filter((r) => !thuocPhienDaLuu(r));
    const rowsChuyen: MaterialImportItem[] = hopLe.map((d) => ({
      id: d.id ?? newId(),
      shipmentId: idChuyen ?? "",
      deliveryDate: phien.deliveryDate,
      workshop: phien.workshop,
      category: d.category,
      supplierName: phien.supplierName,
      materialTypeName: d.materialTypeName,
      quantityKg: d.quantityKg,
      unitPrice: d.unitPrice,
      driverName: phien.driverName,
      licensePlate: phien.licensePlate,
      note: phien.note,
    }));
    persistChuyen(chuyenSau);
    persist([...rowsGiuLai, ...rowsChuyen]);

    const tongMoi = hopLe.reduce((s, d) => s + d.quantityKg, 0);
    notify.daLuu(
      `Đã lưu chuyến ${phien.supplierName} — ${hopLe.length} loại · ${kg(tongMoi)}`
    );
    // Ngày đã chốt mà ghi thêm → báo ngay tổng ngày lệch bao nhiêu so với lúc chốt.
    const bg = banGhiChot(phien.deliveryDate, phien.workshop);
    if (bg?.isLocked)
      notify.canhBao(
        `Ngày ${viDate(phien.deliveryDate)} đã chốt ${kg(bg.totalKgAtLock)} — sau khi ghi bù thành ${kg(tongNgayNgoaiChuyen + tongMoi)}`
      );

    // Nhớ loài cuối để chuyến/dòng sau khỏi nhảy về "Bạch tuộc".
    setLoaiGanNhat(hopLe[hopLe.length - 1].category);

    // Ghi ngày ngoài kỳ đang lọc → kéo bộ lọc về chuyến vừa ghi (khỏi tưởng mất).
    if (phien.deliveryDate < tuHieuLuc || phien.deliveryDate > denHieuLuc) {
      setKy("ngay");
      setNgay(phien.deliveryDate);
    }
    if (phanXuong !== "Tất cả" && phanXuong !== phien.workshop)
      setPhanXuong(phien.workshop);
    if (locDaiLy && locDaiLy !== phien.supplierName) setLocDaiLy("");
    if (locGia === "thieu-gia") setLocGia("tat-ca");
    return true;
  };

  const datLaiPhien = () => {
    setPhien(null);
    setChuyenIdPhien(null);
    setSuaRowIds(null);
    setDongBang([]);
    setLoiPhien([]);
  };

  /** Lưu xong, đóng dialog. */
  const xongChuyen = () => {
    if (luuPhien(false)) datLaiPhien();
  };

  /** Lưu xong, dọn bảng nhưng GIỮ ngày + xưởng + đại lý cho chuyến kế (một đại
   *  lý hay giao nhiều lượt trong ngày) — chỉ làm mới xe + bảng loại hàng. */
  const luuThemChuyenKhac = () => {
    if (!luuPhien(false)) return;
    const catCuoi = dongHopLe.length
      ? dongHopLe[dongHopLe.length - 1].category
      : loaiGanNhat;
    setPhien((p) =>
      p
        ? { ...p, driverName: "", licensePlate: "", note: "", ssccCode: "", scanPath: "" }
        : p
    );
    setChuyenIdPhien(null);
    setSuaRowIds(null);
    setDongBang([dongBangRong(catCuoi)]);
    setLoiPhien([]);
  };


  /* ---- Xóa cả chuyến đang sửa (nút trong dialog) ---- */

  const xoaChuyenDangSua = () => {
    if (!suaRowIds) return;
    const truocRows = rows;
    const truocChuyen = chuyen;
    const ids = new Set(suaRowIds);
    persist(rows.filter((r) => !ids.has(r.id)));
    if (chuyenIdPhien)
      persistChuyen(chuyen.filter((c) => c.id !== chuyenIdPhien));
    notify.daXoa(
      `Đã xóa chuyến ${phien?.supplierName || ""} — ${suaRowIds.length} dòng`,
      () => {
        persist(truocRows);
        persistChuyen(truocChuyen);
      }
    );
    datLaiPhien();
  };

  /* ---- Chốt / mở lại ngày ---- */

  const chotNgay = () => {
    const bg = banGhiChot(tuHieuLuc, xuongDangXem);
    const ban: DailyLock = {
      id: bg?.id ?? newId(),
      lockDate: tuHieuLuc,
      workshop: xuongDangXem,
      isLocked: true,
      lockedAt: new Date().toISOString(),
      totalKgAtLock: tongThucTe,
      reopenReason: "",
      note: ghiChuChot,
    };
    persistChot(
      bg ? chot.map((c) => (c.id === bg.id ? ban : c)) : [...chot, ban]
    );
    notify.daLuu(
      `Đã chốt ngày ${viDate(tuHieuLuc)} · xưởng ${xuongDangXem} — ${kg(tongThucTe)}`
    );
    setHoiChot(false);
    setGhiChuChot("");
  };

  const moLaiNgay = () => {
    const bg = banGhiChot(tuHieuLuc, xuongDangXem);
    if (!bg) return;
    if (!lyDoMoLai.trim()) {
      setLoiChot([
        { truong: "Lý do mở lại", thongBao: "Phải ghi rõ vì sao mở lại ngày" },
      ]);
      return;
    }
    persistChot(
      chot.map((c) =>
        c.id === bg.id ? { ...c, isLocked: false, reopenReason: lyDoMoLai } : c
      )
    );
    notify.canhBao(
      `Đã mở lại ngày ${viDate(tuHieuLuc)} · xưởng ${xuongDangXem} — sửa xong nhớ chốt lại`
    );
    setHoiMoLai(false);
    setLyDoMoLai("");
    setLoiChot([]);
  };

  /* ---- Cột bảng dòng hàng trong một chuyến ---- */

  const cotDong = (khoaChuyen: boolean): Cot<MaterialImportItem>[] => [
    {
      key: "materialTypeName",
      header: "Loại nguyên liệu",
      chinh: true,
      render: (r) => r.materialTypeName,
      sapXep: (r) => r.materialTypeName,
    },
    {
      key: "category",
      header: "Loài",
      render: (r) => <Badge>{r.category}</Badge>,
      sapXep: (r) => r.category,
    },
    {
      key: "sl",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => num(r.quantityKg),
      sapXep: (r) => r.quantityKg,
    },
    {
      key: "gia",
      header: "Đơn giá (đ)",
      so: true,
      render: (r) =>
        r.unitPrice != null ? (
          num(r.unitPrice)
        ) : (
          <Badge variant="outline">Chưa có giá</Badge>
        ),
      sapXep: (r) => r.unitPrice ?? 0,
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      render: (r) => num(calculateImportAmount(r)),
      sapXep: (r) => calculateImportAmount(r),
    },
    ...(khoaChuyen
      ? [
          {
            key: "khoa",
            header: "Trạng thái",
            render: () => <Badge variant="secondary">Đã chốt</Badge>,
          } as Cot<MaterialImportItem>,
        ]
      : []),
  ];

  // FORM NHẬP (form-first) — trước đây trong Dialog, nay render INLINE ở chế độ
  // "Ghi nhập": điền như tờ giấy (đầu chuyến · loại hàng · phế liệu), không modal.
  const formGhi = phien && (
    <div className="space-y-6 rounded-xl border-2 border-border bg-card p-4 md:p-6">
      <ErrorSummary loi={loiPhien} />
      <ChuThichBatBuoc />

      {/* OCR: chụp ảnh phiếu tay → máy đọc chữ gợi ý điền (soát lại trước khi lưu). */}
      {coOcr && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            title="Chụp hoặc chọn ảnh phiếu nhập viết tay, máy tự đọc ra ngày · đại lý · các dòng loại NL và kg. Kết quả là NHÁP — soát lại rồi mới lưu."
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => setOcrMo(true)}
          >
            <Camera />
            Nhận diện từ ảnh phiếu
          </Button>
          {phien.scanPath && (
            <span className="flex items-center gap-1">
              <Badge variant="secondary">Đã đính ảnh phiếu</Badge>
              {coLuuAnh && (
                <Button
                  title="Mở lại ảnh phiếu tay đã lưu kèm chuyến này." type="button" variant="link" size="sm" onClick={xemAnhPhieu}>
                  Xem
                </Button>
              )}
            </span>
          )}
        </div>
      )}

      {chotPhien && (
        <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
          <Lock className="mt-0.5 size-6 shrink-0" aria-hidden />
          <span>
            Ngày {viDate(phien.deliveryDate)} · xưởng {phien.workshop}{" "}
            <strong>đã chốt</strong>. Vẫn ghi được nhưng là <strong>ghi bù</strong>{" "}
            — bắt buộc ghi rõ lý do.
          </span>
        </p>
      )}

      {dangSuaChuyen && soDongDaLuu > 0 && (
        <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
          <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
          <span>
            Sửa đầu chuyến sẽ áp cho <strong>{soDongDaLuu} dòng</strong> đã ghi
            trong chuyến này.
          </span>
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <DateField
          label="Ngày ghi sổ"
          required
          info="Ngày ghi vào hệ thống. Chọn ngày này thì ngày hàng về tự nhảy theo. Cần khác thì sửa ô ngày hàng về bên cạnh."
          value={phien.postingDate}
          onChange={doiNgayGhiSo}
        />
        <DateField
          label="Ngày hàng về xưởng"
          required
          info="Ngày xe đổ hàng thật — mọi tổng hợp tính theo ngày này. Mặc định nhảy theo ngày ghi sổ; sửa tay ô này khi hàng về hôm khác (ghi bù)."
          value={phien.deliveryDate}
          onChange={doiNgayVe}
        />
      </div>

      {(isBackdatedImport(phien) || chotPhien) && (
        <Field
          label="Lý do ghi bù"
          required
          hint="VD: đại lý chưa xuất hóa đơn, 31/7 mới có chứng từ."
        >
          <Input
            value={phien.backdateReason}
            onChange={(e) => datPhien("backdateReason", e.target.value)}
            placeholder="Vì sao tới hôm nay mới ghi?"
          />
        </Field>
      )}

      {/* Đại lý lên đầu — khớp cột TÊN ĐẠI LÝ mở đầu tờ báo cáo giấy của chị Trúc. */}
      <Combobox
        label="Đại lý giao hàng"
        required
        hint="Chọn trong danh mục. Chưa có thì gõ tên rồi bấm Thêm mới."
        value={phien.supplierName}
        onChange={(v) => datPhien("supplierName", v)}
        options={optDaiLy}
        onCreate={themDaiLy}
        emptyText="Chưa có đại lý nào trong danh mục."
      />

      <Combobox
        label="Phân xưởng"
        required
        choPhepXoa={false}
        value={phien.workshop}
        onChange={(v) => datPhien("workshop", v as Workshop)}
        options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
      />

      <div className="rounded-xl border-2 border-border">
        <button
          title="Mở / thu phần ghi thêm về xe và ghi chú của chuyến (không bắt buộc)."
          type="button"
          onClick={() => setMoPhuPhien((v) => !v)}
          aria-expanded={moPhuPhien}
          className="flex min-h-14 w-full items-center justify-between px-4 text-base font-semibold"
        >
          Xe và ghi chú của chuyến (không bắt buộc)
          <ChevronDown
            className={`size-6 transition-transform ${moPhuPhien ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {moPhuPhien && (
          <div className="space-y-5 border-t-2 border-border p-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Tài xế">
                <Input
                  value={phien.driverName}
                  onChange={(e) => datPhien("driverName", e.target.value)}
                  placeholder="Tên tài xế"
                />
              </Field>
              <Field label="Biển số xe">
                <Input
                  value={phien.licensePlate}
                  onChange={(e) => datPhien("licensePlate", e.target.value)}
                  placeholder="VD: 86C 19555"
                />
              </Field>
            </div>
            <Field label="Ghi chú">
              <Input
                value={phien.note}
                onChange={(e) => datPhien("note", e.target.value)}
                placeholder="Ghi chú thêm (nếu có)"
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Mã SSCC (nhà nước)"
                hint="Để trống nếu chưa được cấp — điền sau."
              >
                <Input
                  value={phien.ssccCode}
                  onChange={(e) => datPhien("ssccCode", e.target.value)}
                  placeholder="Chưa có — điền sau"
                />
              </Field>
              <Field label="Mã lô nội bộ" hint="Tự sinh, dùng để truy xuất.">
                <div className="flex min-h-11 items-center tnum text-base text-muted-foreground">
                  {chuyenIdPhien
                    ? chuyen.find((c) => c.id === chuyenIdPhien)?.lotCode ||
                      "— (dữ liệu cũ)"
                    : sinhMaLo(phien.deliveryDate, phien.workshop, chuyen)}
                </div>
              </Field>
            </div>
          </div>
        )}
      </div>

      <div className="border-t-2 border-border pt-1" />

      {/* Bảng loại hàng — nhập cả chuyến một lượt, lưu một lần */}
      <div className="space-y-4 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-base font-semibold">Các loại hàng trong chuyến</p>
          <p className="text-sm text-muted-foreground">
            Mỗi loại một dòng. Cần thêm loại nữa thì bấm “Thêm loại hàng” ở cuối.
            Đơn giá để trống nếu chưa có hóa đơn.
          </p>
        </div>

        <BangDongHang
          dong={dongBang}
          onSua={capNhatDong}
          onBo={boDong}
          onThem={themDongMoi}
          optLoaiTheoLoai={optLoaiNLTheoLoai}
          onTaoLoai={themLoaiNL}
        />

        {dongHopLe.length > 0 && (
          <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1">
            <span className="text-base text-muted-foreground">
              {dongHopLe.length} loại · chuyến này
            </span>
            <span className="tnum text-lg font-semibold">{kg(tongChuyen)}</span>
            {tienChuyen > 0 && (
              <span className="tnum text-base text-muted-foreground">
                {num(tienChuyen)} đ
              </span>
            )}
          </div>
        )}
      </div>

      {/* Phế liệu cân trong ngày — GỘP CHUNG một chỗ với nguyên liệu */}
      <KhoiPheLieuNgay
        ngay={phien.deliveryDate}
        phanXuong={phien.workshop}
        rows={pheLieu}
        onChange={persistPheLieu}
        khoa={chotPhien}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-base text-muted-foreground">
          Tổng ngày {viDate(phien.deliveryDate)} · xưởng {phien.workshop}:{" "}
          <span className="tnum text-xl font-semibold text-foreground">
            {kg(tongNgayPhien)}
          </span>
        </span>
        <div className="flex flex-wrap gap-2">
          {dangSuaChuyen ? (
            <ConfirmDelete
              moTaBanGhi={`Chuyến ${phien?.supplierName || "(chưa có đại lý)"} — ${viDate(phien?.deliveryDate ?? "")} — ${soDongDaLuu} dòng — ${kg(tongChuyen)}`}
              onConfirm={xoaChuyenDangSua}
              tieuDe="Xóa cả chuyến này?"
              nhanNut="Xóa chuyến"
            />
          ) : (
            <Button
              title="Ghi chuyến đang gõ vào sổ rồi mở form trống nhập tiếp chuyến kế — khỏi bấm ra bấm vào." variant="outline" size="lg" onClick={luuThemChuyenKhac}>
              <Truck />
              Lưu &amp; thêm chuyến khác
            </Button>
          )}
          <Button
            title="Ghi chuyến đang gõ vào sổ rồi quay về danh sách chuyến trong ngày." size="lg" onClick={xongChuyen}>
            {dangSuaChuyen ? "Lưu chuyến" : "Lưu vào sổ"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Nhập hàng về xưởng
          </h1>
        </div>
        {/* Tách rõ NHẬP với TRA CỨU: một màn làm một việc. */}
        <div className="flex w-full overflow-hidden rounded-xl border-2 border-border sm:w-auto">
          <button
            title="Sang chế độ Ghi nhập để gõ chuyến nguyên liệu mới."
            type="button"
            onClick={() => setCheDo("nhap")}
            className={cn(
              "flex-1 px-4 py-2.5 text-base font-semibold transition-colors sm:flex-none",
              cheDo === "nhap"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            📝 Ghi nhập
          </button>
          <button
            title="Xem sổ các chuyến đã ghi trong ngày, sửa hoặc chốt ngày tại đây."
            type="button"
            onClick={() => setCheDo("so")}
            className={cn(
              "flex-1 border-l-2 border-border px-4 py-2.5 text-base font-semibold transition-colors sm:flex-none",
              cheDo === "so"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            📖 Sổ ngày
          </button>
          <button
            title="Xem báo cáo nhập hàng theo khoảng ngày, xuất Excel hoặc in."
            type="button"
            onClick={() => setCheDo("bao-cao")}
            className={cn(
              "flex-1 border-l-2 border-border px-4 py-2.5 text-base font-semibold transition-colors sm:flex-none",
              cheDo === "bao-cao"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            📊 Báo cáo
          </button>
        </div>
      </div>

      {cheDo === "bao-cao" && <BaoCaoNhap />}

      {doiLoaiMo && (
        <HopDoiLoaiHangLoat
          rows={rows}
          loaiNL={loaiNL}
          onThemLoaiNL={themLoaiNL}
          onClose={() => setDoiLoaiMo(false)}
          onLuu={(ids, loaiDich) => {
            const bo = new Set(ids);
            const truoc = rows;
            persist(
              rows.map((r) => (bo.has(r.id) ? { ...r, materialTypeName: loaiDich } : r))
            );
            notify.daLuu(`Đã đổi ${ids.length} chuyến sang "${loaiDich}"`, () =>
              persist(truoc)
            );
            setDoiLoaiMo(false);
          }}
        />
      )}

      {cheDo !== "bao-cao" && (
        <DailyTaskReminder daChot={daChotNhapHomNay} viec={`chuyến nhập nguyên liệu hôm nay — xưởng ${xuongGhi}`} />
      )}

      {cheDo === "nhap" && formGhi}

      {cheDo === "so" && (
        <>
      <div className="flex flex-wrap gap-2">
        <Button
          title="Xem trước bản in A4 báo cáo nhập hàng của ngày đang chọn." variant="outline" size="lg" onClick={() => setXemPhieu(true)}>
          <FileText />
          Xem báo cáo
        </Button>
        <Button
          title="In tờ phiếu trống để tổ trưởng ghi tay ngoài xưởng, tối về nhập lại vào máy." variant="outline" size="lg" onClick={() => setInPhieuTrong(true)}>
          <Printer />
          In phiếu trống
        </Button>
        <Button
          title="Đổi loại nguyên liệu cho nhiều chuyến cùng lúc — dùng khi gõ nhầm loại cho cả loạt dòng." variant="outline" size="lg" onClick={() => setDoiLoaiMo(true)}>
          <Replace />
          Đổi loại hàng loạt
        </Button>
      </div>

      <ThongKe
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        the={[
          { nhan: "Đang xem", giaTri: moTaPhamVi, icon: CalendarRange, mau: "trung-tinh" },
          { nhan: "Phân xưởng", giaTri: phanXuong, icon: Warehouse, mau: "trung-tinh" },
          { nhan: "Số chuyến", giaTri: nhomView.length, so: true, icon: Truck, mau: "brand" },
          { nhan: "Số dòng", giaTri: view.length, so: true, icon: FileText, mau: "brand" },
          { nhan: "Tổng nhập", giaTri: kg(tong), so: true, icon: Scale, mau: "success" },
        ]}
      />

      {/* Bộ lọc — toolbar một hàng; lọc ít dùng gom vào "Bộ lọc thêm" để sổ
          hiện ngay, không phải cuộn qua cả khối lọc */}
      <div className="space-y-4 rounded-xl border-2 border-border p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Combobox
            label="Kỳ xem sổ"
            anNhanBatBuoc
            choPhepXoa={false}
            value={ky}
            onChange={(v) => setKy(v as KyXem)}
            options={KY_OPT}
            className="min-w-[13rem]"
          />

          <div className="min-w-[220px] flex-1">
            {ky === "tuy-chon" ? (
              <DateRangeField
                label="Khoảng ngày hàng về xưởng"
                anNhanBatBuoc
                presets={false}
                startDate={tuNgay}
                endDate={denNgay}
                onChange={(tu, den) => {
                  setTuNgay(tu);
                  setDenNgay(den);
                }}
              />
            ) : (
              <DateField
                label={
                  ky === "ngay"
                    ? "Ngày hàng về xưởng"
                    : ky === "tuan"
                      ? "Ngày bất kỳ trong tuần"
                      : ky === "thang"
                        ? "Ngày bất kỳ trong tháng"
                        : "Ngày bất kỳ trong năm"
                }
                anNhanBatBuoc
                hint={
                  ky === "ngay"
                    ? undefined
                    : `Kỳ đang xem: ${viDate(tuHieuLuc)} – ${viDate(denHieuLuc)}`
                }
                value={ngay}
                onChange={setNgay}
              />
            )}
          </div>

          <Combobox
            label="Phân xưởng"
            anNhanBatBuoc
            choPhepXoa={false}
            value={phanXuong}
            onChange={(v) => setPhanXuong(v as Workshop | "Tất cả")}
            options={[
              ...PHAN_XUONG.map((p) => ({ value: p, label: p })),
              { value: "Tất cả", label: "Tất cả" },
            ]}
            className="min-w-[220px] flex-1"
          />

          <Button
            title="Mở thêm bộ lọc theo đại lý · loại nguyên liệu · đã có giá hay chưa."
            variant="outline"
            size="lg"
            aria-expanded={moLocThem}
            onClick={() => setMoLocThem((v) => !v)}
          >
            <SlidersHorizontal />
            Bộ lọc thêm{soLocThem > 0 ? ` (${soLocThem})` : ""}
            <ChevronDown
              className={`transition-transform ${moLocThem ? "rotate-180" : ""}`}
              aria-hidden
            />
          </Button>
        </div>

        {moLocThem && (
          <div className="space-y-4 border-t-2 border-border pt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Combobox
                label="Đại lý"
                anNhanBatBuoc
                value={locDaiLy}
                onChange={setLocDaiLy}
                options={optDaiLy}
                placeholder="Tất cả đại lý"
              />
              <Combobox
                label="Loại nguyên liệu"
                anNhanBatBuoc
                value={locLoaiNL}
                onChange={setLocLoaiNL}
                options={optLoaiNL}
                placeholder="Tất cả loại"
              />
            </div>

            <ChoiceGroup
              label="Trạng thái giá"
              anNhanBatBuoc
              hint={
                soThieuGia > 0
                  ? `Có ${soThieuGia} dòng chưa điền đơn giá — thường là hàng chờ hóa đơn.`
                  : undefined
              }
              value={locGia}
              onChange={(v) => setLocGia(v as "tat-ca" | "thieu-gia")}
              options={[
                { value: "tat-ca", label: "Tất cả" },
                { value: "thieu-gia", label: "Chưa có giá" },
              ]}
              cot={2}
            />

            {(locDaiLy ||
              locLoaiNL ||
              locGia !== "tat-ca" ||
              phanXuong === "Tất cả") && (
              <div className="flex justify-end">
                <Button
                  title="Xóa hết bộ lọc đang đặt, về lại danh sách đầy đủ của xưởng Đông."
                  variant="outline"
                  onClick={() => {
                    setLocDaiLy("");
                    setLocLoaiNL("");
                    setLocGia("tat-ca");
                    setPhanXuong("Đông");
                  }}
                >
                  <X />
                  Bỏ hết bộ lọc
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sổ: mỗi chuyến một cụm, đúng như sổ giấy đánh STT theo đại lý */}
      {dangTai ? (
        <SkeletonBang />
      ) : nhomView.length === 0 ? (
        <EmptyState
          icon={Truck}
          tieuDe={`Chưa có chuyến nào trong ${moTaPhamVi}`}
          moTa={
            locGia === "thieu-gia"
              ? "Đang lọc “Chưa có giá”. Bỏ lọc để xem đủ sổ."
              : phanXuong === "Tất cả"
                ? "Chuyển sang “Ghi nhập” để ghi chuyến đầu tiên."
                : `Phân xưởng ${phanXuong}. Chuyển sang “Ghi nhập” để ghi chuyến.`
          }
          action={
            <Button
              title="Chuyển sang chế độ Ghi để nhập chuyến mới cho ngày này." size="lg" onClick={() => setCheDo("nhap")}>
              <Plus />
              Sang Ghi nhập
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-5">
            {nhomView.map((n, i) => {
              const khoaChuyen = daChot(n.deliveryDate, n.workshop);
              return (
                <section
                  key={n.khoa}
                  className="space-y-4 rounded-xl border-2 border-border p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="tnum text-base text-muted-foreground">
                          Chuyến {i + 1}
                        </span>
                        <span className="text-xl font-semibold text-foreground">
                          {n.supplierName || "(chưa có đại lý)"}
                        </span>
                        <span className="text-base text-muted-foreground">
                          {viDate(n.deliveryDate)} · xưởng {n.workshop}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {n.ghiBu && (
                          <Badge variant="outline">
                            Ghi bù {viDate(n.postingDate)}
                          </Badge>
                        )}
                        {khoaChuyen && (
                          <Badge variant="secondary">
                            <Lock aria-hidden />
                            Đã chốt
                          </Badge>
                        )}
                        {!n.chuyen && (
                          <Badge variant="outline">Dữ liệu cũ</Badge>
                        )}
                        {n.chuyen?.lotCode && (
                          <Badge variant="outline" className="tnum">
                            Lô {n.chuyen.lotCode}
                          </Badge>
                        )}
                        {n.chuyen?.ssccCode && (
                          <Badge variant="outline" className="tnum">
                            SSCC {n.chuyen.ssccCode}
                          </Badge>
                        )}
                        {[n.driverName, n.licensePlate].filter(Boolean).length > 0 && (
                          <span className="text-base text-muted-foreground">
                            {[n.driverName, n.licensePlate].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                      {n.ghiBu && n.backdateReason && (
                        <p className="text-base text-muted-foreground">
                          Lý do ghi bù: {n.backdateReason}
                        </p>
                      )}
                      {n.note && (
                        <p className="text-base text-muted-foreground">
                          Ghi chú: {n.note}
                        </p>
                      )}
                      {n.chuyen?.operator && (
                        <p className="text-base text-muted-foreground">
                          Người ghi: {n.chuyen.operator}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base text-muted-foreground">
                        Chuyến này
                      </span>
                      <span className="tnum text-xl font-semibold">
                        {kg(n.tongKg)}
                      </span>
                      {!khoaChuyen && (
                        <Button
                          title="Mở lại chuyến này để sửa dòng hàng, số kg hay giá. Ngày đã chốt thì phải mở khóa trước." variant="outline" onClick={() => moSuaChuyen(n)}>
                          <Pencil />
                          Sửa chuyến
                        </Button>
                      )}
                      {n.chuyen?.lotCode && (
                        <Button
                          title="In tem QR mã lô của chuyến này để dán lên kiện hàng, sau quét tra ngược được nguồn gốc."
                          variant="outline"
                          onClick={() => setChuyenInTem(n.chuyen)}
                        >
                          <QrCode />
                          In tem QR
                        </Button>
                      )}
                    </div>
                  </div>

                  <RecordTable
                    columns={cotDong(khoaChuyen)}
                    rows={n.dong}
                    getKey={(r) => r.id}
                  />
                </section>
              );
            })}
          </div>

          <div className="flex flex-wrap justify-end gap-x-10 gap-y-3 rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng khối lượng
              </span>
              <span className="tnum text-xl font-semibold">{kg(tong)}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng tiền hàng
              </span>
              <span className="tnum text-xl font-semibold">
                {num(tongTien)} đ
              </span>
            </div>
          </div>
        </>
      )}

      {/* Phế liệu cân gộp cuối ngày theo phân xưởng */}
      {xemMotNgayMotXuong && (
        <KhoiPheLieuNgay
          ngay={tuHieuLuc}
          phanXuong={xuongDangXem}
          rows={pheLieu}
          onChange={persistPheLieu}
          khoa={dangKhoa}
          chiXem
        />
      )}
        </>
      )}

      {/* Chốt số liệu ngày — đặt CUỐI: xem hết sổ + phế liệu rồi mới chốt (ẩn ở tab Báo cáo) */}
      {cheDo !== "bao-cao" && xemMotNgayMotXuong && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border-2 border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {dangKhoa ? (
              <Lock className="size-6 shrink-0 text-primary" aria-hidden />
            ) : (
              <LockOpen
                className="size-6 shrink-0 text-muted-foreground"
                aria-hidden
              />
            )}
            <span className="text-lg font-semibold text-foreground">
              {dangKhoa ? "Đã chốt" : "Chưa chốt"} {viDate(tuHieuLuc)} · xưởng{" "}
              {xuongDangXem}
            </span>
            <span className="text-base text-muted-foreground">
              Tổng{" "}
              <span className="tnum font-semibold text-foreground">
                {kg(tongThucTe)}
              </span>
              {dangKhoa && chotHienTai
                ? ` · lúc chốt ${kg(chotHienTai.totalKgAtLock)}`
                : ""}
            </span>
            {lechSauChot !== 0 && (
              <span className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-base text-accent-foreground">
                <TriangleAlert className="size-5 shrink-0" aria-hidden />
                Còn ghi bù{" "}
                <span className="tnum font-semibold">
                  {lechSauChot > 0 ? "+" : ""}
                  {num(lechSauChot)} kg
                </span>{" "}
                sau chốt
              </span>
            )}
          </div>
          {dangKhoa ? (
            <Button
              title="Mở khóa lại ngày đã chốt để sửa hoặc ghi bù. Phải ghi lý do, và việc mở khóa được lưu vết."
              variant="outline"
              size="lg"
              onClick={() => {
                setHoiMoLai(true);
                setLyDoMoLai("");
                setLoiChot([]);
              }}
            >
              <LockOpen />
              Mở lại ngày
            </Button>
          ) : (
            <Button
              title="Khóa sổ ngày này lại: chốt tổng nhập trong ngày. Sau khi chốt muốn sửa phải Mở lại ngày và ghi lý do."
              size="lg"
              onClick={() =>
                coDongChuaLuu ? setNhacLuu(true) : setHoiChot(true)
              }
            >
              <Lock />
              Chốt ngày
            </Button>
          )}
        </div>
      )}

      {/* Form ghi chuyến đã chuyển INLINE (chế độ "Ghi nhập" — biến formGhi ở trên). */}

      {/* ---- Hộp thoại: chốt ngày ---- */}
      <Dialog open={hoiChot} onOpenChange={setHoiChot}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Chốt số liệu ngày này?</DialogTitle>
            <DialogDescription className="text-base">
              Chốt xong ngày {viDate(tuHieuLuc)} · xưởng {xuongDangXem} sẽ khóa: không
              sửa, không xóa, không thêm chuyến thường. Ghi thêm chỉ còn đường
              ghi bù (bắt buộc ghi lý do) hoặc mở lại ngày.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="rounded-xl bg-muted px-5 py-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-base text-muted-foreground">
                  Tổng khối lượng chốt
                </span>
                <span className="tnum text-2xl font-semibold">
                  {kg(tongThucTe)}
                </span>
              </div>
            </div>
            <Field label="Ghi chú khi chốt">
              <Input
                value={ghiChuChot}
                onChange={(e) => setGhiChuChot(e.target.value)}
                placeholder="VD: đã đối chiếu với sổ giấy của chị Thủy"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              title="Chưa chốt vội — đóng hộp thoại, sổ ngày vẫn mở."
              variant="outline"
              size="lg"
              onClick={() => setHoiChot(false)}
            >
              Chưa chốt
            </Button>
            <Button
              title="Xác nhận khóa sổ ngày này." size="lg" onClick={chotNgay}>
              <Lock />
              Chốt ngày
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Hộp thoại: nhắc còn dòng nhập chưa lưu trước khi chốt ---- */}
      <Dialog open={nhacLuu} onOpenChange={setNhacLuu}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Còn dòng nhập chưa lưu vào sổ
            </DialogTitle>
            <DialogDescription className="text-base">
              Bạn đang gõ dở một chuyến nhập nhưng chưa bấm{" "}
              <strong>"Lưu vào sổ"</strong>. Chốt ngay thì số vừa gõ{" "}
              <strong>chưa được tính vào tổng chốt</strong>. Lưu vào sổ trước cho
              chắc.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-wrap gap-2">
            <Button
              title="Đóng nhắc nhở, về lại form để nhập nốt dòng đang gõ dở."
              variant="ghost"
              size="lg"
              onClick={() => setNhacLuu(false)}
            >
              Quay lại nhập tiếp
            </Button>
            <Button
              title="Chốt ngày luôn và BỎ dòng đang gõ dở — dòng đó sẽ không vào sổ."
              variant="outline"
              size="lg"
              onClick={() => {
                setNhacLuu(false);
                setHoiChot(true);
              }}
            >
              Vẫn chốt (bỏ dòng đang gõ)
            </Button>
            <Button
              title="Ghi dòng đang gõ vào sổ trước, rồi mới chốt ngày — không mất dữ liệu."
              size="lg"
              onClick={() => {
                if (luuPhien(false)) {
                  datLaiPhien();
                  setNhacLuu(false);
                  setHoiChot(true);
                }
              }}
            >
              <Save />
              Lưu vào sổ rồi chốt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Hộp thoại: mở lại ngày ---- */}
      <Dialog open={hoiMoLai} onOpenChange={setHoiMoLai}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Mở lại ngày đã chốt?</DialogTitle>
            <DialogDescription className="text-base">
              Ngày {viDate(tuHieuLuc)} · xưởng {xuongDangXem} đang khóa. Mở lại thì
              sửa/xóa được như thường — nhớ chốt lại sau khi sửa xong.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <ErrorSummary loi={loiChot} />
            <ChuThichBatBuoc />
            <Field label="Lý do mở lại" required>
              <Input
                value={lyDoMoLai}
                onChange={(e) => setLyDoMoLai(e.target.value)}
                placeholder="VD: đại lý báo lại số cân của chuyến chiều"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              title="Giữ nguyên khóa — không mở lại ngày."
              variant="outline"
              size="lg"
              onClick={() => setHoiMoLai(false)}
            >
              Giữ khóa
            </Button>
            <Button
              title="Xác nhận mở khóa ngày này để sửa hoặc ghi bù." size="lg" onClick={moLaiNgay}>
              <LockOpen />
              Mở lại ngày
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Phiếu báo cáo tổng hợp nguyên liệu (in A4 ngang, theo kỳ) ---- */}
      {xemPhieu && (
        <PhieuNLNgay
          ky={ky}
          ngay={ngay}
          startDate={tuNgay}
          endDate={denNgay}
          workshop={phanXuong}
          rows={rows}
          pheLieu={pheLieu}
          onClose={() => setXemPhieu(false)}
        />
      )}
      {chuyenInTem && (
        <QrTemLoIn chuyen={chuyenInTem} onClose={() => setChuyenInTem(null)} />
      )}
      {inPhieuTrong && (
        <PhieuTrongNhapNL onClose={() => setInPhieuTrong(false)} />
      )}

      {/* ---- Nhận diện ảnh phiếu (OCR) → gợi ý điền form Ghi nhập ---- */}
      {ocrMo && phien && (
        <OcrPhieuNhap
          danhMuc={danhMucOcr}
          onLuuAnh={(path) => datPhien("scanPath", path)}
          onApDaiLy={(name) => datPhien("supplierName", name)}
          onApNgay={(iso) => doiNgayVe(iso)}
          onThemDong={themDongTuOcr}
          onClose={() => setOcrMo(false)}
        />
      )}
    </div>
  );
}

