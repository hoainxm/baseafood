import { useMemo, useState } from "react";
import type {
  ChotNgay,
  ChuyenNhap,
  DongNhapNL,
  DongPheLieu,
  PhanXuong,
  Loai,
} from "@/types";
import { LOAI, laGhiBu, thanhTien } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import {
  useChotNgay,
  useChuyenNhap,
  useDaiLy,
  useLoaiNL,
  useNhapNL,
  usePheLieu,
} from "@/lib/danhMuc";
import {
  Badge,
  Button,
  ChoiceGroup,
  Combobox,
  ConfirmDelete,
  ContextBar,
  DateField,
  DateRangeField,
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
  NumberField,
  RecordTable,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { kg, num, todayISO, viDate } from "@/lib/format";
import {
  ChevronDown,
  CircleCheck,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Scale,
  TriangleAlert,
  Truck,
  X,
} from "lucide-react";

const PHAN_XUONG: PhanXuong[] = ["Đông", "Cá", "Khô"];

/** Loại phế liệu hay gặp — vẫn thêm mới tại chỗ được. */
const PHE_LIEU_GOI_Y = ["Nội tạng", "Dạt"];

/** Xem sổ theo một ngày, hay theo cả khoảng ngày. */
type CheDoXem = "mot-ngay" | "khoang-ngay";

/** Đầu chuyến đang nhập — dùng chung cho mọi dòng loại hàng trong chuyến. */
interface DauChuyen {
  ngayGiao: string;
  ngayGhiSo: string;
  lyDoGhiBu: string;
  phanXuong: PhanXuong;
  daiLy: string;
  taiXe: string;
  bienSoXe: string;
  ghiChu: string;
}

/** Một dòng loại hàng đang nhập trong chuyến. */
interface DongMoi {
  loai: Loai;
  loaiNL: string;
  soLuongKg: number;
  donGia: number | null;
}

const DONG_MOI_RONG: DongMoi = {
  loai: "Bạch tuộc",
  loaiNL: "",
  soLuongKg: 0,
  donGia: null,
};

/**
 * Một chuyến hiện trên sổ. Có hai nguồn:
 *  - chuyến THẬT (bảng `chuyen_nhap`) — mọi chuyến ghi từ nay;
 *  - nhóm NGẦM của dữ liệu cũ (dòng chưa có `chuyenId`) — gom theo
 *    (ngày + xưởng + đại lý + xe) đúng như cách màn cũ đếm.
 */
interface NhomChuyen {
  khoa: string;
  chuyen: ChuyenNhap | null;
  ngayGiao: string;
  ngayGhiSo: string;
  lyDoGhiBu: string;
  phanXuong: PhanXuong;
  daiLy: string;
  taiXe: string;
  bienSoXe: string;
  ghiChu: string;
  dong: DongNhapNL[];
  tongKg: number;
  tongTien: number;
  ghiBu: boolean;
}

function gomChuyen(rows: DongNhapNL[], chuyen: ChuyenNhap[]): NhomChuyen[] {
  const theoId = new Map(chuyen.map((c) => [c.id, c]));
  const nhoms = new Map<string, NhomChuyen>();

  for (const r of rows) {
    const c = r.chuyenId ? theoId.get(r.chuyenId) : undefined;
    const khoa = c
      ? c.id
      : `ngam|${r.ngay}|${r.phanXuong}|${r.daiLy}|${r.taiXe}|${r.bienSoXe}`;
    let nhom = nhoms.get(khoa);
    if (!nhom) {
      nhom = {
        khoa,
        chuyen: c ?? null,
        ngayGiao: c?.ngayGiao ?? r.ngay,
        ngayGhiSo: c?.ngayGhiSo ?? r.ngay,
        lyDoGhiBu: c?.lyDoGhiBu ?? "",
        phanXuong: c?.phanXuong ?? r.phanXuong,
        daiLy: c?.daiLy ?? r.daiLy,
        taiXe: c?.taiXe ?? r.taiXe,
        bienSoXe: c?.bienSoXe ?? r.bienSoXe,
        ghiChu: c?.ghiChu ?? r.ghiChu,
        dong: [],
        tongKg: 0,
        tongTien: 0,
        ghiBu: false,
      };
      nhom.ghiBu = laGhiBu(nhom);
      nhoms.set(khoa, nhom);
    }
    nhom.dong.push(r);
    nhom.tongKg += r.soLuongKg || 0;
    nhom.tongTien += thanhTien(r);
  }

  return [...nhoms.values()].sort(
    (a, b) =>
      a.ngayGiao.localeCompare(b.ngayGiao) ||
      a.daiLy.localeCompare(b.daiLy, "vi") ||
      a.khoa.localeCompare(b.khoa)
  );
}

/** Kiểm tra đầu chuyến — dùng chung cho lúc ghi mới và lúc sửa. */
function loiDauChuyen(d: DauChuyen, daChot: boolean): LoiNhap[] {
  const ls: LoiNhap[] = [];
  if (!d.daiLy.trim())
    ls.push({ truong: "Đại lý", thongBao: "Chưa chọn đại lý giao hàng" });
  if (d.ngayGhiSo < d.ngayGiao)
    ls.push({
      truong: "Ngày ghi sổ",
      thongBao: "Ngày ghi sổ không thể trước ngày hàng về xưởng",
    });
  const canLyDo = laGhiBu(d) || daChot;
  if (canLyDo && !d.lyDoGhiBu.trim())
    ls.push({
      truong: "Lý do ghi bù",
      thongBao: daChot
        ? "Ngày này đã chốt — phải ghi rõ vì sao ghi thêm"
        : "Ghi sau ngày hàng về — phải ghi rõ lý do (VD: chờ hóa đơn)",
    });
  return ls;
}

export default function NhapNguyenLieuScreen() {
  const [rows, persist] = useNhapNL();
  const [chuyen, persistChuyen] = useChuyenNhap();
  const [chot, persistChot] = useChotNgay();
  const [pheLieu, persistPheLieu] = usePheLieu();

  const [cheDo, setCheDo] = useState<CheDoXem>("mot-ngay");
  const [ngay, setNgay] = useState(todayISO());
  const [tuNgay, setTuNgay] = useState(todayISO());
  const [denNgay, setDenNgay] = useState(todayISO());
  const [phanXuong, setPhanXuong] = useState<PhanXuong | "Tất cả">("Đông");
  const [locDaiLy, setLocDaiLy] = useState("");
  const [locLoaiNL, setLocLoaiNL] = useState("");
  const [locGia, setLocGia] = useState<"tat-ca" | "thieu-gia">("tat-ca");

  const [daiLy, setDaiLy] = useDaiLy();
  const [loaiNL, setLoaiNL] = useLoaiNL();

  /* Ghi chuyến: bước 1 điền đầu chuyến, bước 2 đổ từng loại hàng. */
  const [phien, setPhien] = useState<DauChuyen | null>(null);
  const [buoc, setBuoc] = useState<"dau" | "hang">("dau");
  const [chuyenIdPhien, setChuyenIdPhien] = useState<string | null>(null);
  const [dongMoi, setDongMoi] = useState<DongMoi>(DONG_MOI_RONG);
  const [loiPhien, setLoiPhien] = useState<LoiNhap[]>([]);
  const [moPhuPhien, setMoPhuPhien] = useState(false);

  /* Sửa đầu chuyến của một chuyến đã ghi */
  const [suaDau, setSuaDau] = useState<NhomChuyen | null>(null);

  /* Sửa MỘT dòng hàng — chỉ loại / loài / kg / giá */
  const [dang, setDang] = useState<DongNhapNL | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  /* Chốt ngày */
  const [hoiChot, setHoiChot] = useState(false);
  const [ghiChuChot, setGhiChuChot] = useState("");
  const [hoiMoLai, setHoiMoLai] = useState(false);
  const [lyDoMoLai, setLyDoMoLai] = useState("");
  const [loiChot, setLoiChot] = useState<LoiNhap[]>([]);

  const view = useMemo(
    () =>
      rows
        .filter((r) => {
          const hopNgay =
            cheDo === "mot-ngay"
              ? r.ngay === ngay
              : r.ngay >= tuNgay && r.ngay <= denNgay;
          const hopXuong = phanXuong === "Tất cả" || r.phanXuong === phanXuong;
          const hopDaiLy = !locDaiLy || r.daiLy === locDaiLy;
          const hopLoai = !locLoaiNL || r.loaiNL === locLoaiNL;
          const hopGia = locGia === "tat-ca" || r.donGia == null;
          return hopNgay && hopXuong && hopDaiLy && hopLoai && hopGia;
        })
        .sort(
          (a, b) => a.ngay.localeCompare(b.ngay) || a.id.localeCompare(b.id)
        ),
    [rows, cheDo, ngay, tuNgay, denNgay, phanXuong, locDaiLy, locLoaiNL, locGia]
  );

  const nhomView = useMemo(() => gomChuyen(view, chuyen), [view, chuyen]);

  /** Ngày / xưởng mặc định khi ghi chuyến mới — theo bộ lọc đang xem. */
  const ngayGhi = cheDo === "mot-ngay" ? ngay : denNgay;
  const xuongGhi: PhanXuong = phanXuong === "Tất cả" ? "Đông" : phanXuong;

  const moTaPhamVi =
    cheDo === "mot-ngay"
      ? viDate(ngay)
      : `${viDate(tuNgay)} – ${viDate(denNgay)}`;

  const tong = useMemo(
    () => view.reduce((s, r) => s + (r.soLuongKg || 0), 0),
    [view]
  );
  const tongTien = useMemo(
    () => view.reduce((s, r) => s + thanhTien(r), 0),
    [view]
  );
  const soThieuGia = useMemo(
    () => view.filter((r) => r.donGia == null).length,
    [view]
  );

  /* ---- Chốt ngày ---- */

  /** Bản ghi chốt của một (ngày + xưởng) — kể cả bản đã mở lại. */
  const banGhiChot = (n: string, x: PhanXuong): ChotNgay | undefined =>
    chot.find((c) => c.ngay === n && c.phanXuong === x);

  const daChot = (n: string, x: PhanXuong): boolean =>
    Boolean(banGhiChot(n, x)?.daChot);

  /** Tổng kg thực tế của một (ngày + xưởng), không phụ thuộc bộ lọc đang xem. */
  const tongNgayXuong = (n: string, x: PhanXuong): number =>
    rows
      .filter((r) => r.ngay === n && r.phanXuong === x)
      .reduce((s, r) => s + (r.soLuongKg || 0), 0);

  /* Thanh chốt chỉ có nghĩa khi đang xem MỘT ngày của MỘT xưởng. */
  const xemMotNgayMotXuong = cheDo === "mot-ngay" && phanXuong !== "Tất cả";
  const xuongDangXem = phanXuong === "Tất cả" ? "Đông" : phanXuong;
  const chotHienTai = xemMotNgayMotXuong
    ? banGhiChot(ngay, xuongDangXem)
    : undefined;
  const dangKhoa = Boolean(chotHienTai?.daChot);
  const tongThucTe = xemMotNgayMotXuong ? tongNgayXuong(ngay, xuongDangXem) : 0;
  const lechSauChot =
    chotHienTai?.daChot && tongThucTe !== chotHienTai.tongKgLucChot
      ? tongThucTe - chotHienTai.tongKgLucChot
      : 0;

  /* ---- Danh mục: chọn sẵn, thiếu thì tạo ngay tại chỗ ----
     Lưu theo TÊN (không phải id) để dữ liệu cũ trong localStorage vẫn đọc được. */

  const optDaiLy: MucChon[] = daiLy.map((d) => ({
    value: d.ten,
    label: d.ten,
    phu: d.dienThoai || undefined,
  }));

  const themDaiLy = (ten: string) => {
    setDaiLy([...daiLy, { id: uid(), ma: "", ten, dienThoai: "", ghiChu: "" }]);
    notify.daLuu(`Đã thêm đại lý "${ten}" vào danh mục`);
    return ten;
  };

  const optLoaiNL: MucChon[] = loaiNL.map((l) => ({
    value: l.ten,
    label: l.ten,
    phu: l.loai || undefined,
  }));

  const themLoaiNL = (ten: string) => {
    setLoaiNL([...loaiNL, { id: uid(), ten, loai: "", ghiChu: "" }]);
    notify.daLuu(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
    return ten;
  };

  /* ---- Ghi chuyến ---- */

  const moThem = () => {
    setPhien({
      ngayGiao: ngayGhi,
      ngayGhiSo: todayISO(),
      lyDoGhiBu: "",
      phanXuong: xuongGhi,
      daiLy: "",
      taiXe: "",
      bienSoXe: "",
      ghiChu: "",
    });
    setBuoc("dau");
    setChuyenIdPhien(null);
    setDongMoi(DONG_MOI_RONG);
    setLoiPhien([]);
    setMoPhuPhien(false);
  };

  const datPhien = <K extends keyof DauChuyen>(k: K, v: DauChuyen[K]) =>
    setPhien((p) => (p ? { ...p, [k]: v } : p));

  /** Dòng đã ghi trong chuyến đang mở. */
  const dongPhien = useMemo(
    () => (chuyenIdPhien ? rows.filter((r) => r.chuyenId === chuyenIdPhien) : []),
    [rows, chuyenIdPhien]
  );
  const tongChuyen = dongPhien.reduce((s, r) => s + (r.soLuongKg || 0), 0);
  const tongNgayPhien = phien
    ? tongNgayXuong(phien.ngayGiao, phien.phanXuong)
    : 0;
  const chotPhien = phien
    ? daChot(phien.ngayGiao, phien.phanXuong)
    : false;

  /** Xong bước 1 → sang bước đổ hàng. */
  const xongDauChuyen = () => {
    if (!phien) return;
    const ls = loiDauChuyen(phien, chotPhien);
    setLoiPhien(ls);
    if (ls.length > 0) return;
    setBuoc("hang");
  };

  /** Sửa đầu chuyến giữa chừng → áp cho MỌI dòng đã ghi của chuyến này. */
  const luuSuaDauPhien = () => {
    if (!phien) return;
    const ls = loiDauChuyen(phien, chotPhien);
    setLoiPhien(ls);
    if (ls.length > 0) return;

    if (chuyenIdPhien) {
      persistChuyen(
        chuyen.map((c) =>
          c.id === chuyenIdPhien ? { ...c, ...phien, id: c.id } : c
        )
      );
      persist(
        rows.map((r) =>
          r.chuyenId === chuyenIdPhien
            ? {
                ...r,
                ngay: phien.ngayGiao,
                phanXuong: phien.phanXuong,
                daiLy: phien.daiLy,
                taiXe: phien.taiXe,
                bienSoXe: phien.bienSoXe,
                ghiChu: phien.ghiChu,
              }
            : r
        )
      );
      notify.daLuu(
        `Đã sửa đầu chuyến — áp cho ${dongPhien.length} dòng đã ghi`
      );
    }
    setBuoc("hang");
  };

  const setDong = <K extends keyof DongMoi>(k: K, v: DongMoi[K]) =>
    setDongMoi((d) => ({ ...d, [k]: v }));

  /** Thêm một loại vào sổ — LƯU NGAY thành một dòng nhap_nguyen_lieu. */
  const themDong = () => {
    if (!phien) return;
    const ls: LoiNhap[] = [];
    if (!dongMoi.loaiNL.trim())
      ls.push({ truong: "Loại nguyên liệu", thongBao: "Chưa chọn loại hàng" });
    if (!(dongMoi.soLuongKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoiPhien(ls);
    if (ls.length > 0) return;

    // Chuyến chỉ được tạo khi có dòng đầu tiên — không để lại chuyến rỗng.
    let idChuyen = chuyenIdPhien;
    if (!idChuyen) {
      idChuyen = newId();
      persistChuyen([...chuyen, { id: idChuyen, ...phien }]);
      setChuyenIdPhien(idChuyen);
    }

    const dong: DongNhapNL = {
      id: newId(),
      chuyenId: idChuyen,
      ngay: phien.ngayGiao,
      phanXuong: phien.phanXuong,
      loai: dongMoi.loai,
      daiLy: phien.daiLy,
      loaiNL: dongMoi.loaiNL,
      soLuongKg: dongMoi.soLuongKg,
      donGia: dongMoi.donGia,
      taiXe: phien.taiXe,
      bienSoXe: phien.bienSoXe,
      ghiChu: phien.ghiChu,
    };
    persist([...rows, dong]);
    notify.daLuu(`Đã vào sổ: ${dong.loaiNL} — ${kg(dong.soLuongKg)}`);

    // Ngày đã chốt mà ghi bù → nói ngay tổng ngày lệch bao nhiêu so với lúc chốt.
    const bg = banGhiChot(phien.ngayGiao, phien.phanXuong);
    if (bg?.daChot) {
      const moi = tongNgayXuong(phien.ngayGiao, phien.phanXuong) + dong.soLuongKg;
      notify.canhBao(
        `Ngày ${viDate(phien.ngayGiao)} đã chốt ${kg(bg.tongKgLucChot)} — sau khi ghi bù thành ${kg(moi)}`
      );
    }

    // Giữ loài để đổ tiếp loại sau cho nhanh; xóa loại / kg / giá.
    setDongMoi((d) => ({ ...DONG_MOI_RONG, loai: d.loai }));
    setLoiPhien([]);
  };

  const boDongPhien = (r: DongNhapNL) => {
    const truoc = rows;
    persist(rows.filter((x) => x.id !== r.id));
    notify.daXoa(`Đã bỏ ${r.loaiNL} — ${kg(r.soLuongKg)}`, () =>
      persist(truoc)
    );
  };

  /** Đóng chuyến: bỏ chuyến rỗng, kéo bộ lọc về đúng ngày/xưởng vừa ghi. */
  const dongPhienLai = (mo: "dong" | "chuyen-khac") => {
    const p = phien;
    if (p && chuyenIdPhien && dongPhien.length === 0) {
      persistChuyen(chuyen.filter((c) => c.id !== chuyenIdPhien));
    }
    if (p && dongPhien.length > 0) {
      // Điểm hay mất hàng nhất: ghi ngày khác bộ lọc rồi tưởng mất.
      if (cheDo === "mot-ngay" && ngay !== p.ngayGiao) setNgay(p.ngayGiao);
      if (cheDo === "khoang-ngay" && (p.ngayGiao < tuNgay || p.ngayGiao > denNgay)) {
        setCheDo("mot-ngay");
        setNgay(p.ngayGiao);
      }
      if (phanXuong !== "Tất cả" && phanXuong !== p.phanXuong)
        setPhanXuong(p.phanXuong);
      if (locDaiLy && locDaiLy !== p.daiLy) setLocDaiLy("");
      if (locGia === "thieu-gia") setLocGia("tat-ca");
    }

    if (mo === "dong") {
      setPhien(null);
      setChuyenIdPhien(null);
      return;
    }
    // Ghi chuyến khác: giữ ngày + xưởng, làm mới đại lý / xe.
    setPhien(
      p
        ? {
            ...p,
            daiLy: "",
            taiXe: "",
            bienSoXe: "",
            ghiChu: "",
          }
        : null
    );
    setChuyenIdPhien(null);
    setBuoc("dau");
    setDongMoi(DONG_MOI_RONG);
    setLoiPhien([]);
  };

  /* ---- Sửa đầu chuyến của chuyến đã ghi (từ sổ) ---- */

  const luuSuaDau = (d: DauChuyen) => {
    if (!suaDau) return;
    const ids = new Set(suaDau.dong.map((r) => r.id));
    if (suaDau.chuyen) {
      persistChuyen(
        chuyen.map((c) =>
          c.id === suaDau.chuyen?.id ? { ...c, ...d, id: c.id } : c
        )
      );
    }
    persist(
      rows.map((r) =>
        ids.has(r.id)
          ? {
              ...r,
              ngay: d.ngayGiao,
              phanXuong: d.phanXuong,
              daiLy: d.daiLy,
              taiXe: d.taiXe,
              bienSoXe: d.bienSoXe,
              ghiChu: d.ghiChu,
            }
          : r
      )
    );
    notify.daLuu(`Đã sửa chuyến — áp cho ${suaDau.dong.length} dòng`);
    setSuaDau(null);
  };

  const xoaChuyen = (n: NhomChuyen) => {
    const truocRows = rows;
    const truocChuyen = chuyen;
    const ids = new Set(n.dong.map((r) => r.id));
    persist(rows.filter((r) => !ids.has(r.id)));
    if (n.chuyen) persistChuyen(chuyen.filter((c) => c.id !== n.chuyen?.id));
    notify.daXoa(
      `Đã xóa chuyến ${n.daiLy} — ${n.dong.length} dòng, ${kg(n.tongKg)}`,
      () => {
        persist(truocRows);
        persistChuyen(truocChuyen);
      }
    );
  };

  /* ---- Sửa / xóa một dòng hàng ---- */

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.loaiNL.trim())
      ls.push({ truong: "Loại nguyên liệu", thongBao: "Chưa chọn loại hàng" });
    if (!(dang.soLuongKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    persist(rows.map((r) => (r.id === dang.id ? dang : r)));
    notify.daLuu("Đã lưu thay đổi");
    setDang(null);
  };

  const xoaDong = (r: DongNhapNL) => {
    const truoc = rows;
    persist(rows.filter((x) => x.id !== r.id));
    notify.daXoa(`Đã xóa ${r.loaiNL} — ${kg(r.soLuongKg)}`, () =>
      persist(truoc)
    );
  };

  const set = <K extends keyof DongNhapNL>(k: K, v: DongNhapNL[K]) =>
    setDang((d) => (d ? { ...d, [k]: v } : d));

  /* ---- Chốt / mở lại ngày ---- */

  const chotNgay = () => {
    const bg = banGhiChot(ngay, xuongDangXem);
    const ban: ChotNgay = {
      id: bg?.id ?? newId(),
      ngay,
      phanXuong: xuongDangXem,
      daChot: true,
      chotLuc: new Date().toISOString(),
      tongKgLucChot: tongThucTe,
      lyDoMoLai: "",
      ghiChu: ghiChuChot,
    };
    persistChot(
      bg ? chot.map((c) => (c.id === bg.id ? ban : c)) : [...chot, ban]
    );
    notify.daLuu(
      `Đã chốt ngày ${viDate(ngay)} · xưởng ${xuongDangXem} — ${kg(tongThucTe)}`
    );
    setHoiChot(false);
    setGhiChuChot("");
  };

  const moLaiNgay = () => {
    const bg = banGhiChot(ngay, xuongDangXem);
    if (!bg) return;
    if (!lyDoMoLai.trim()) {
      setLoiChot([
        { truong: "Lý do mở lại", thongBao: "Phải ghi rõ vì sao mở lại ngày" },
      ]);
      return;
    }
    persistChot(
      chot.map((c) =>
        c.id === bg.id ? { ...c, daChot: false, lyDoMoLai } : c
      )
    );
    notify.canhBao(
      `Đã mở lại ngày ${viDate(ngay)} · xưởng ${xuongDangXem} — sửa xong nhớ chốt lại`
    );
    setHoiMoLai(false);
    setLyDoMoLai("");
    setLoiChot([]);
  };

  /* ---- Cột bảng dòng hàng trong một chuyến ---- */

  const cotDong = (khoaChuyen: boolean): Cot<DongNhapNL>[] => [
    {
      key: "loaiNL",
      header: "Loại nguyên liệu",
      chinh: true,
      render: (r) => r.loaiNL,
      sapXep: (r) => r.loaiNL,
    },
    {
      key: "loai",
      header: "Loài",
      render: (r) => <Badge>{r.loai}</Badge>,
      sapXep: (r) => r.loai,
    },
    {
      key: "sl",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => num(r.soLuongKg),
      sapXep: (r) => r.soLuongKg,
    },
    {
      key: "gia",
      header: "Đơn giá (đ)",
      so: true,
      render: (r) =>
        r.donGia != null ? (
          num(r.donGia)
        ) : (
          <Badge variant="outline">Chưa có giá</Badge>
        ),
      sapXep: (r) => r.donGia ?? 0,
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      render: (r) => num(thanhTien(r)),
      sapXep: (r) => thanhTien(r),
    },
    ...(khoaChuyen
      ? [
          {
            key: "khoa",
            header: "Trạng thái",
            render: () => <Badge variant="secondary">Đã chốt</Badge>,
          } as Cot<DongNhapNL>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">
          Nhập hàng về xưởng
        </h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Ghi theo sổ "Báo cáo tổng hợp nguyên liệu hàng ngày": mỗi chuyến là một
          đại lý, đổ nhiều loại hàng — mỗi loại một dòng.
        </p>
      </div>

      <ContextBar
        items={[
          { nhan: "Đang xem", giaTri: moTaPhamVi },
          { nhan: "Phân xưởng", giaTri: phanXuong },
          { nhan: "Số chuyến", giaTri: nhomView.length, so: true },
          { nhan: "Số dòng", giaTri: view.length, so: true },
          { nhan: "Tổng", giaTri: kg(tong), so: true },
        ]}
        actions={
          <Button size="lg" onClick={moThem}>
            <Plus />
            Ghi chuyến hàng
          </Button>
        }
      />

      {/* Chốt số liệu ngày — mốc "số ngày này đã đúng, khóa lại" */}
      {xemMotNgayMotXuong && (
        <div className="space-y-4 rounded-xl border-2 border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
            <div className="flex items-start gap-3">
              {dangKhoa ? (
                <Lock className="mt-1 size-6 text-primary" aria-hidden />
              ) : (
                <LockOpen className="mt-1 size-6 text-muted-foreground" aria-hidden />
              )}
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {dangKhoa
                    ? `Đã chốt ngày ${viDate(ngay)} · xưởng ${xuongDangXem}`
                    : `Chưa chốt ngày ${viDate(ngay)} · xưởng ${xuongDangXem}`}
                </p>
                <p className="text-base text-muted-foreground">
                  Tổng hiện tại{" "}
                  <span className="tnum font-semibold text-foreground">
                    {kg(tongThucTe)}
                  </span>
                  {dangKhoa && chotHienTai
                    ? ` · lúc chốt ${kg(chotHienTai.tongKgLucChot)}`
                    : " · chốt xong sẽ khóa sửa, xóa và thêm chuyến"}
                </p>
              </div>
            </div>
            {dangKhoa ? (
              <Button
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
              <Button size="lg" onClick={() => setHoiChot(true)}>
                <Lock />
                Chốt ngày
              </Button>
            )}
          </div>

          {lechSauChot !== 0 && (
            <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
              <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
              <span>
                Sau khi chốt còn ghi bù{" "}
                <span className="tnum font-semibold">
                  {lechSauChot > 0 ? "+" : ""}
                  {num(lechSauChot)} kg
                </span>{" "}
                — bản đã gửi đi ghi {kg(chotHienTai?.tongKgLucChot ?? 0)}, số
                đúng hiện nay là {kg(tongThucTe)}.
              </span>
            </p>
          )}
        </div>
      )}

      {/* Bộ lọc — mỗi hàng một câu hỏi, các ô cùng chiều cao nên thẳng hàng */}
      <div className="space-y-5 rounded-xl border-2 border-border p-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <ChoiceGroup
            label="Xem theo"
            anNhanBatBuoc
            value={cheDo}
            onChange={(v) => setCheDo(v as CheDoXem)}
            options={[
              { value: "mot-ngay", label: "Một ngày" },
              { value: "khoang-ngay", label: "Khoảng ngày" },
            ]}
            cot={2}
          />
          <ChoiceGroup
            label="Phân xưởng"
            anNhanBatBuoc
            value={phanXuong}
            onChange={(v) => setPhanXuong(v as PhanXuong | "Tất cả")}
            options={[
              ...PHAN_XUONG.map((p) => ({ value: p, label: p })),
              { value: "Tất cả", label: "Tất cả" },
            ]}
            cot={4}
          />
        </div>

        {cheDo === "mot-ngay" ? (
          <DateField
            label="Ngày hàng về xưởng"
            anNhanBatBuoc
            value={ngay}
            onChange={setNgay}
          />
        ) : (
          <DateRangeField
            label="Khoảng ngày hàng về xưởng"
            anNhanBatBuoc
            tuNgay={tuNgay}
            denNgay={denNgay}
            onChange={(tu, den) => {
              setTuNgay(tu);
              setDenNgay(den);
            }}
          />
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <Combobox
            label="Chỉ xem đại lý"
            anNhanBatBuoc
            value={locDaiLy}
            onChange={setLocDaiLy}
            options={optDaiLy}
            placeholder="Tất cả đại lý"
          />
          <Combobox
            label="Chỉ xem loại nguyên liệu"
            anNhanBatBuoc
            value={locLoaiNL}
            onChange={setLocLoaiNL}
            options={optLoaiNL}
            placeholder="Tất cả loại"
          />
        </div>

        <ChoiceGroup
          label="Đơn giá"
          anNhanBatBuoc
          hint={
            soThieuGia > 0
              ? `Có ${soThieuGia} dòng chưa điền đơn giá — thường là hàng chờ hóa đơn.`
              : undefined
          }
          value={locGia}
          onChange={(v) => setLocGia(v as "tat-ca" | "thieu-gia")}
          options={[
            { value: "tat-ca", label: "Tất cả dòng" },
            { value: "thieu-gia", label: "Chỉ dòng chưa có giá" },
          ]}
          cot={2}
        />

        {(locDaiLy ||
          locLoaiNL ||
          locGia !== "tat-ca" ||
          phanXuong === "Tất cả") && (
          <div className="flex justify-end">
            <Button
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

      {/* Sổ: mỗi chuyến một cụm, đúng như sổ giấy đánh STT theo đại lý */}
      {nhomView.length === 0 ? (
        <EmptyState
          icon={Truck}
          tieuDe={`Chưa có chuyến nào trong ${moTaPhamVi}`}
          moTa={
            locGia === "thieu-gia"
              ? "Đang lọc “chỉ dòng chưa có giá”. Bỏ lọc để xem đủ sổ."
              : phanXuong === "Tất cả"
                ? "Bấm nút dưới để ghi chuyến đầu tiên."
                : `Phân xưởng ${phanXuong}. Bấm nút dưới để ghi chuyến đầu tiên.`
          }
          action={
            <Button size="lg" onClick={moThem}>
              <Plus />
              Ghi chuyến hàng
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-5">
            {nhomView.map((n, i) => {
              const khoaChuyen = daChot(n.ngayGiao, n.phanXuong);
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
                          {n.daiLy || "(chưa có đại lý)"}
                        </span>
                        <span className="text-base text-muted-foreground">
                          {viDate(n.ngayGiao)} · xưởng {n.phanXuong}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {n.ghiBu && (
                          <Badge variant="outline">
                            Ghi bù {viDate(n.ngayGhiSo)}
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
                        {[n.taiXe, n.bienSoXe].filter(Boolean).length > 0 && (
                          <span className="text-base text-muted-foreground">
                            {[n.taiXe, n.bienSoXe].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                      {n.ghiBu && n.lyDoGhiBu && (
                        <p className="text-base text-muted-foreground">
                          Lý do ghi bù: {n.lyDoGhiBu}
                        </p>
                      )}
                      {n.ghiChu && (
                        <p className="text-base text-muted-foreground">
                          Ghi chú: {n.ghiChu}
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
                        <>
                          <Button
                            variant="outline"
                            onClick={() => setSuaDau(n)}
                          >
                            <Pencil />
                            Sửa chuyến
                          </Button>
                          <ConfirmDelete
                            moTaBanGhi={`Chuyến ${n.daiLy} — ${viDate(n.ngayGiao)} — ${n.dong.length} dòng — ${kg(n.tongKg)}`}
                            onConfirm={() => xoaChuyen(n)}
                            tieuDe="Xóa cả chuyến này?"
                            nhanNut="Xóa chuyến"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <RecordTable
                    columns={cotDong(khoaChuyen)}
                    rows={n.dong}
                    getKey={(r) => r.id}
                    actions={
                      khoaChuyen
                        ? undefined
                        : (r) => (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setDang({ ...r });
                                  setLoi([]);
                                }}
                              >
                                <Pencil />
                                Sửa
                              </Button>
                              <ConfirmDelete
                                moTaBanGhi={`${r.loaiNL} — ${kg(r.soLuongKg)} — đại lý ${r.daiLy} — ngày ${viDate(r.ngay)}`}
                                onConfirm={() => xoaDong(r)}
                                tieuDe="Xóa dòng hàng này?"
                                nhanNut="Xóa dòng"
                              />
                            </>
                          )
                    }
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
          ngay={ngay}
          phanXuong={xuongDangXem}
          rows={pheLieu}
          onChange={persistPheLieu}
          khoa={dangKhoa}
        />
      )}

      {/* ---- Hộp thoại: ghi chuyến ---- */}
      <Dialog
        open={phien !== null}
        onOpenChange={(o) => {
          if (!o) dongPhienLai("dong");
        }}
      >
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-3xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {buoc === "dau" ? "Chuyến của ai, ngày nào" : "Đổ hàng vào sổ"}
            </DialogTitle>
            <DialogDescription className="text-base">
              {buoc === "dau"
                ? "Điền đầu chuyến trước: ngày hàng về, phân xưởng, đại lý. Xong mới đổ từng loại hàng."
                : "Mỗi loại bấm “Thêm loại này vào sổ” là VÀO SỔ NGAY. Xong cả chuyến thì bấm “Xong chuyến”."}
            </DialogDescription>
          </DialogHeader>

          {phien && (
            <div className="space-y-6 py-2">
              {buoc === "dau" ? (
                <>
                  <ErrorSummary loi={loiPhien} />

                  {chotPhien && (
                    <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                      <Lock className="mt-0.5 size-6 shrink-0" aria-hidden />
                      <span>
                        Ngày {viDate(phien.ngayGiao)} · xưởng {phien.phanXuong}{" "}
                        <strong>đã chốt</strong>. Vẫn ghi được nhưng là{" "}
                        <strong>ghi bù</strong> — bắt buộc ghi rõ lý do.
                      </span>
                    </p>
                  )}

                  {chuyenIdPhien && dongPhien.length > 0 && (
                    <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                      <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
                      <span>
                        Sửa đầu chuyến sẽ áp cho{" "}
                        <strong>{dongPhien.length} dòng</strong> đã ghi trong
                        chuyến này.
                      </span>
                    </p>
                  )}

                  <div className="grid gap-6 sm:grid-cols-2">
                    <DateField
                      label="Ngày hàng về xưởng"
                      required
                      hint="Ngày xe đổ hàng thật — mọi tổng hợp tính theo ngày này."
                      value={phien.ngayGiao}
                      onChange={(v) => datPhien("ngayGiao", v)}
                    />
                    <DateField
                      label="Ngày ghi sổ"
                      required
                      hint="Ngày ghi vào hệ thống. Khác ngày hàng về ⇒ ghi bù."
                      value={phien.ngayGhiSo}
                      onChange={(v) => datPhien("ngayGhiSo", v)}
                    />
                  </div>

                  {(laGhiBu(phien) || chotPhien) && (
                    <Field
                      label="Lý do ghi bù"
                      required
                      hint="VD: đại lý chưa xuất hóa đơn, 31/7 mới có chứng từ."
                    >
                      <Input
                        value={phien.lyDoGhiBu}
                        onChange={(e) => datPhien("lyDoGhiBu", e.target.value)}
                        placeholder="Vì sao tới hôm nay mới ghi?"
                      />
                    </Field>
                  )}

                  <ChoiceGroup
                    label="Phân xưởng"
                    required
                    value={phien.phanXuong}
                    onChange={(v) => datPhien("phanXuong", v as PhanXuong)}
                    options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
                    cot={3}
                  />

                  <Combobox
                    label="Đại lý giao hàng"
                    required
                    hint="Chọn trong danh mục. Chưa có thì gõ tên rồi bấm Thêm mới."
                    value={phien.daiLy}
                    onChange={(v) => datPhien("daiLy", v)}
                    options={optDaiLy}
                    onCreate={themDaiLy}
                    emptyText="Chưa có đại lý nào trong danh mục."
                  />

                  <div className="rounded-xl border-2 border-border">
                    <button
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
                              value={phien.taiXe}
                              onChange={(e) => datPhien("taiXe", e.target.value)}
                              placeholder="Tên tài xế"
                            />
                          </Field>
                          <Field label="Biển số xe">
                            <Input
                              value={phien.bienSoXe}
                              onChange={(e) =>
                                datPhien("bienSoXe", e.target.value)
                              }
                              placeholder="VD: 86C 19555"
                            />
                          </Field>
                        </div>
                        <Field label="Ghi chú">
                          <Input
                            value={phien.ghiChu}
                            onChange={(e) => datPhien("ghiChu", e.target.value)}
                            placeholder="Ghi chú thêm (nếu có)"
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Đầu chuyến đã xong → thu thành một thanh tóm tắt */}
                  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl bg-muted px-5 py-4">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-foreground">
                        {viDate(phien.ngayGiao)} · xưởng {phien.phanXuong} ·{" "}
                        {phien.daiLy}
                      </p>
                      <p className="text-base text-muted-foreground">
                        {[phien.taiXe, phien.bienSoXe].filter(Boolean).join(" · ") ||
                          "Chưa ghi tài xế / biển số"}
                        {laGhiBu(phien)
                          ? ` · ghi bù ${viDate(phien.ngayGhiSo)}`
                          : ""}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setBuoc("dau")}>
                      <Pencil />
                      Sửa đầu chuyến
                    </Button>
                  </div>

                  {/* Đã vào sổ */}
                  {dongPhien.length > 0 && (
                    <div className="space-y-3 rounded-xl border-2 border-border p-4">
                      <p className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <CircleCheck className="size-6 text-primary" aria-hidden />
                        Đã vào sổ {dongPhien.length} loại — chuyến này{" "}
                        <span className="tnum">{kg(tongChuyen)}</span>
                      </p>
                      <ul className="divide-y divide-border">
                        {dongPhien.map((r, i) => (
                          <li
                            key={r.id}
                            className="flex items-center justify-between gap-3 py-2"
                          >
                            <span className="min-w-0 flex-1 truncate text-base">
                              <span className="tnum text-muted-foreground">
                                {i + 1}.
                              </span>{" "}
                              {r.loaiNL} —{" "}
                              <span className="tnum font-semibold">
                                {num(r.soLuongKg)}
                              </span>{" "}
                              kg
                              {r.donGia != null ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {num(r.donGia)} đ
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · chưa có giá
                                </span>
                              )}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => boDongPhien(r)}
                            >
                              <X />
                              Bỏ
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Thêm một loại hàng — NÚT CHÍNH DUY NHẤT trong thân */}
                  <div className="space-y-5 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
                    <p className="text-base font-semibold">Thêm loại hàng</p>
                    <ErrorSummary loi={loiPhien} />

                    <Combobox
                      label="Loại nguyên liệu"
                      required
                      hint="Quy cách / size hàng về, VD: 2 da nguyên liệu."
                      value={dongMoi.loaiNL}
                      onChange={(v) => setDong("loaiNL", v)}
                      options={optLoaiNL}
                      onCreate={themLoaiNL}
                    />

                    <ChoiceGroup
                      label="Loài"
                      required
                      value={dongMoi.loai}
                      onChange={(v) => setDong("loai", v as Loai)}
                      options={LOAI.map((l) => ({ value: l, label: l }))}
                      cot={3}
                    />

                    <div className="grid gap-6 sm:grid-cols-2">
                      <NumberField
                        label="Số lượng"
                        required
                        unit="kg"
                        value={dongMoi.soLuongKg || null}
                        onChange={(v) => setDong("soLuongKg", v ?? 0)}
                      />
                      <NumberField
                        label="Đơn giá"
                        unit="đ"
                        value={dongMoi.donGia}
                        onChange={(v) => setDong("donGia", v)}
                        hint="Bỏ trống nếu chưa chốt giá / chưa có hóa đơn."
                      />
                    </div>

                    {dongMoi.soLuongKg > 0 && dongMoi.donGia ? (
                      <div className="rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                        Thành tiền:{" "}
                        <span className="tnum text-lg font-semibold">
                          {num(dongMoi.soLuongKg * dongMoi.donGia)} đ
                        </span>
                      </div>
                    ) : null}

                    <Button size="lg" className="w-full" onClick={themDong}>
                      <Plus />
                      Thêm loại này vào sổ
                    </Button>
                  </div>

                  {/* Tổng ngày — như "TỔNG CỘNG" cuối sổ giấy */}
                  <div className="flex flex-wrap items-baseline justify-end gap-x-8 gap-y-2 rounded-xl bg-muted px-5 py-4">
                    <span className="text-base text-muted-foreground">
                      Tổng ngày {viDate(phien.ngayGiao)} · xưởng{" "}
                      {phien.phanXuong}
                    </span>
                    <span className="tnum text-2xl font-semibold">
                      {kg(tongNgayPhien)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {buoc === "dau" ? (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => dongPhienLai("dong")}
                >
                  Đóng
                </Button>
                <Button
                  size="lg"
                  onClick={
                    chuyenIdPhien && dongPhien.length > 0
                      ? luuSuaDauPhien
                      : xongDauChuyen
                  }
                >
                  {chuyenIdPhien && dongPhien.length > 0
                    ? "Lưu đầu chuyến"
                    : "Bắt đầu đổ hàng"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => dongPhienLai("chuyen-khac")}
                >
                  <Truck />
                  Ghi chuyến khác
                </Button>
                <Button size="lg" onClick={() => dongPhienLai("dong")}>
                  Xong chuyến
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Hộp thoại: sửa đầu chuyến của chuyến đã ghi ---- */}
      <HopThoaiDauChuyen
        nhom={suaDau}
        onDong={() => setSuaDau(null)}
        onLuu={luuSuaDau}
        optDaiLy={optDaiLy}
        onThemDaiLy={themDaiLy}
        daChot={daChot}
      />

      {/* ---- Hộp thoại: sửa một dòng hàng ---- */}
      <Dialog
        open={dang !== null}
        onOpenChange={(o) => {
          if (!o) setDang(null);
        }}
      >
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sửa dòng hàng</DialogTitle>
            <DialogDescription className="text-base">
              Ngày, phân xưởng, đại lý và xe thuộc về cả chuyến — sửa ở nút "Sửa
              chuyến" trên đầu cụm.
            </DialogDescription>
          </DialogHeader>

          {dang && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />

              <div className="rounded-xl bg-muted px-5 py-4">
                <p className="text-base text-muted-foreground">Thuộc chuyến</p>
                <p className="text-lg font-semibold text-foreground">
                  {viDate(dang.ngay)} · xưởng {dang.phanXuong} · {dang.daiLy}
                </p>
              </div>

              <Combobox
                label="Loại nguyên liệu"
                required
                hint="Quy cách / size hàng về, VD: 2 da nguyên liệu."
                value={dang.loaiNL}
                onChange={(v) => set("loaiNL", v)}
                options={optLoaiNL}
                onCreate={themLoaiNL}
              />

              <ChoiceGroup
                label="Loài"
                required
                value={dang.loai}
                onChange={(v) => set("loai", v as Loai)}
                options={LOAI.map((l) => ({ value: l, label: l }))}
                cot={3}
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={dang.soLuongKg || null}
                  onChange={(v) => set("soLuongKg", v ?? 0)}
                />
                <NumberField
                  label="Đơn giá"
                  unit="đ"
                  value={dang.donGia}
                  onChange={(v) => set("donGia", v)}
                  hint="Bỏ trống nếu chưa chốt giá / chưa có hóa đơn."
                />
              </div>

              {dang.soLuongKg > 0 && dang.donGia ? (
                <div className="rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                  Thành tiền:{" "}
                  <span className="tnum text-lg font-semibold">
                    {num(dang.soLuongKg * dang.donGia)} đ
                  </span>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setDang(null)}>
              Hủy
            </Button>
            <Button size="lg" onClick={luu}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Hộp thoại: chốt ngày ---- */}
      <Dialog open={hoiChot} onOpenChange={setHoiChot}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Chốt số liệu ngày này?</DialogTitle>
            <DialogDescription className="text-base">
              Chốt xong ngày {viDate(ngay)} · xưởng {xuongDangXem} sẽ khóa: không
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
              variant="outline"
              size="lg"
              onClick={() => setHoiChot(false)}
            >
              Chưa chốt
            </Button>
            <Button size="lg" onClick={chotNgay}>
              <Lock />
              Chốt ngày
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
              Ngày {viDate(ngay)} · xưởng {xuongDangXem} đang khóa. Mở lại thì
              sửa/xóa được như thường — nhớ chốt lại sau khi sửa xong.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <ErrorSummary loi={loiChot} />
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
              variant="outline"
              size="lg"
              onClick={() => setHoiMoLai(false)}
            >
              Giữ khóa
            </Button>
            <Button size="lg" onClick={moLaiNgay}>
              <LockOpen />
              Mở lại ngày
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Hộp thoại sửa đầu chuyến (chuyến đã ghi trong sổ) ---------- */

function HopThoaiDauChuyen({
  nhom,
  onDong,
  onLuu,
  optDaiLy,
  onThemDaiLy,
  daChot,
}: {
  nhom: NhomChuyen | null;
  onDong: () => void;
  onLuu: (d: DauChuyen) => void;
  optDaiLy: MucChon[];
  onThemDaiLy: (ten: string) => string;
  daChot: (ngay: string, xuong: PhanXuong) => boolean;
}) {
  const [d, setD] = useState<DauChuyen | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);
  const [khoaNhom, setKhoaNhom] = useState<string | null>(null);

  // Đồng bộ khi mở cụm khác — không dùng useEffect cho một phép gán đơn giản.
  if (nhom && nhom.khoa !== khoaNhom) {
    setKhoaNhom(nhom.khoa);
    setD({
      ngayGiao: nhom.ngayGiao,
      ngayGhiSo: nhom.ngayGhiSo || nhom.ngayGiao,
      lyDoGhiBu: nhom.lyDoGhiBu,
      phanXuong: nhom.phanXuong,
      daiLy: nhom.daiLy,
      taiXe: nhom.taiXe,
      bienSoXe: nhom.bienSoXe,
      ghiChu: nhom.ghiChu,
    });
    setLoi([]);
  }
  if (!nhom && khoaNhom !== null) {
    setKhoaNhom(null);
    setD(null);
  }

  const dat = <K extends keyof DauChuyen>(k: K, v: DauChuyen[K]) =>
    setD((x) => (x ? { ...x, [k]: v } : x));

  const luu = () => {
    if (!d) return;
    const ls = loiDauChuyen(d, daChot(d.ngayGiao, d.phanXuong));
    setLoi(ls);
    if (ls.length > 0) return;
    onLuu(d);
  };

  return (
    <Dialog
      open={nhom !== null}
      onOpenChange={(o) => {
        if (!o) onDong();
      }}
    >
      <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Sửa đầu chuyến</DialogTitle>
          <DialogDescription className="text-base">
            Ngày, phân xưởng, đại lý và xe áp cho cả chuyến.
          </DialogDescription>
        </DialogHeader>

        {nhom && d && (
          <div className="space-y-6 py-2">
            <ErrorSummary loi={loi} />

            <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
              <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
              <span>
                Sửa xong sẽ áp cho <strong>{nhom.dong.length} dòng</strong> của
                chuyến này.
              </span>
            </p>

            <div className="grid gap-6 sm:grid-cols-2">
              <DateField
                label="Ngày hàng về xưởng"
                required
                value={d.ngayGiao}
                onChange={(v) => dat("ngayGiao", v)}
              />
              <DateField
                label="Ngày ghi sổ"
                required
                value={d.ngayGhiSo}
                onChange={(v) => dat("ngayGhiSo", v)}
              />
            </div>

            {(laGhiBu(d) || daChot(d.ngayGiao, d.phanXuong)) && (
              <Field label="Lý do ghi bù" required>
                <Input
                  value={d.lyDoGhiBu}
                  onChange={(e) => dat("lyDoGhiBu", e.target.value)}
                  placeholder="Vì sao ghi sau ngày hàng về?"
                />
              </Field>
            )}

            <ChoiceGroup
              label="Phân xưởng"
              required
              value={d.phanXuong}
              onChange={(v) => dat("phanXuong", v as PhanXuong)}
              options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
              cot={3}
            />

            <Combobox
              label="Đại lý giao hàng"
              required
              value={d.daiLy}
              onChange={(v) => dat("daiLy", v)}
              options={optDaiLy}
              onCreate={onThemDaiLy}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Tài xế">
                <Input
                  value={d.taiXe}
                  onChange={(e) => dat("taiXe", e.target.value)}
                  placeholder="Tên tài xế"
                />
              </Field>
              <Field label="Biển số xe">
                <Input
                  value={d.bienSoXe}
                  onChange={(e) => dat("bienSoXe", e.target.value)}
                  placeholder="VD: 86C 19555"
                />
              </Field>
            </div>

            <Field label="Ghi chú">
              <Input
                value={d.ghiChu}
                onChange={(e) => dat("ghiChu", e.target.value)}
                placeholder="Ghi chú thêm (nếu có)"
              />
            </Field>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onDong}>
            Hủy
          </Button>
          <Button size="lg" onClick={luu}>
            Lưu đầu chuyến
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Phế liệu cân gộp cuối ngày (nội tạng / dạt) ---------- */

function KhoiPheLieuNgay({
  ngay,
  phanXuong,
  rows,
  onChange,
  khoa,
}: {
  ngay: string;
  phanXuong: PhanXuong;
  rows: DongPheLieu[];
  onChange: (n: DongPheLieu[]) => void;
  khoa: boolean;
}) {
  const [dang, setDang] = useState<DongPheLieu | null>(null);
  const [laThem, setLaThem] = useState(false);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const cuaNgay = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.nguon === "Nhập hàng" && r.ngay === ngay && r.phanXuong === phanXuong
      ),
    [rows, ngay, phanXuong]
  );

  const tongKg = cuaNgay.reduce((s, r) => s + (r.soLuongKg || 0), 0);
  const tongTien = cuaNgay.reduce(
    (s, r) => s + r.soLuongKg * (r.donGiaBan ?? 0),
    0
  );

  const optLoai: MucChon[] = PHE_LIEU_GOI_Y.map((t) => ({
    value: t,
    label: t,
  }));

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.loai.trim())
      ls.push({ truong: "Loại phế liệu", thongBao: "Chưa chọn loại phế liệu" });
    if (!(dang.soLuongKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    onChange(
      laThem ? [...rows, dang] : rows.map((r) => (r.id === dang.id ? dang : r))
    );
    notify.daLuu(
      laThem
        ? `Đã ghi phế liệu ${dang.loai} — ${kg(dang.soLuongKg)}`
        : "Đã lưu thay đổi"
    );
    setDang(null);
  };

  const cols: Cot<DongPheLieu>[] = [
    {
      key: "loai",
      header: "Loại phế liệu",
      chinh: true,
      render: (r) => r.loai,
      sapXep: (r) => r.loai,
    },
    {
      key: "sl",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => num(r.soLuongKg),
      sapXep: (r) => r.soLuongKg,
    },
    {
      key: "gia",
      header: "Đơn giá bán (đ)",
      so: true,
      render: (r) =>
        r.donGiaBan != null ? (
          num(r.donGiaBan)
        ) : (
          <Badge variant="outline">Chưa có giá</Badge>
        ),
      sapXep: (r) => r.donGiaBan ?? 0,
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      render: (r) => num(r.soLuongKg * (r.donGiaBan ?? 0)),
      sapXep: (r) => r.soLuongKg * (r.donGiaBan ?? 0),
    },
    {
      key: "ky",
      header: "Kỳ cân đối",
      render: (r) =>
        r.kyId ? (
          <Badge variant="secondary">Đã vào kỳ</Badge>
        ) : (
          <Badge variant="outline">Chưa vào kỳ</Badge>
        ),
    },
  ];

  return (
    <section className="space-y-4 rounded-xl border-2 border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="flex items-start gap-3">
          <Scale className="mt-1 size-6 text-muted-foreground" aria-hidden />
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Phế liệu cân trong ngày (nội tạng, dạt)
            </h2>
            <p className="text-base text-muted-foreground">
              Cân gộp cuối ngày cho xưởng {phanXuong}, ngày {viDate(ngay)}. Màn
              Cân đối lấy lại số này — không nhập lại lần nữa.
            </p>
          </div>
        </div>
        {khoa ? (
          <Badge variant="secondary">
            <Lock aria-hidden />
            Ngày đã chốt
          </Badge>
        ) : (
          <Button
            size="lg"
            onClick={() => {
              setDang({
                id: newId(),
                kyId: "",
                loai: "",
                soLuongKg: 0,
                donGiaBan: null,
                ngay,
                phanXuong,
                nguon: "Nhập hàng",
              });
              setLaThem(true);
              setLoi([]);
            }}
          >
            <Plus />
            Thêm phế liệu
          </Button>
        )}
      </div>

      <RecordTable
        columns={cols}
        rows={cuaNgay}
        getKey={(r) => r.id}
        emptyText="Chưa cân phế liệu cho ngày này."
        actions={
          khoa
            ? undefined
            : (r) => (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDang({ ...r });
                      setLaThem(false);
                      setLoi([]);
                    }}
                  >
                    <Pencil />
                    Sửa
                  </Button>
                  <ConfirmDelete
                    moTaBanGhi={`${r.loai} — ${kg(r.soLuongKg)} — ngày ${viDate(r.ngay)}`}
                    onConfirm={() => {
                      const truoc = rows;
                      onChange(rows.filter((x) => x.id !== r.id));
                      notify.daXoa(`Đã xóa phế liệu ${r.loai}`, () =>
                        onChange(truoc)
                      );
                    }}
                    tieuDe="Xóa dòng phế liệu này?"
                    nhanNut="Xóa dòng"
                  />
                </>
              )
        }
      />

      {cuaNgay.length > 0 && (
        <div className="flex flex-wrap justify-end gap-x-10 gap-y-3 rounded-xl bg-muted px-5 py-4">
          <div className="flex items-baseline gap-3">
            <span className="text-base text-muted-foreground">
              Tổng phế liệu
            </span>
            <span className="tnum text-xl font-semibold">{kg(tongKg)}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-base text-muted-foreground">Tổng tiền</span>
            <span className="tnum text-xl font-semibold">
              {num(tongTien)} đ
            </span>
          </div>
        </div>
      )}

      <Dialog
        open={dang !== null}
        onOpenChange={(o) => {
          if (!o) setDang(null);
        }}
      >
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {laThem ? "Thêm phế liệu" : "Sửa phế liệu"}
            </DialogTitle>
            <DialogDescription className="text-base">
              Ngày {viDate(ngay)} · xưởng {phanXuong}.
            </DialogDescription>
          </DialogHeader>

          {dang && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />

              <Combobox
                label="Loại phế liệu"
                required
                hint="Chưa có trong danh sách thì gõ tên rồi bấm Thêm mới."
                value={dang.loai}
                onChange={(v) => setDang((d) => (d ? { ...d, loai: v } : d))}
                options={optLoai}
                onCreate={(ten) => ten}
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={dang.soLuongKg || null}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, soLuongKg: v ?? 0 } : d))
                  }
                />
                <NumberField
                  label="Đơn giá bán"
                  unit="đ"
                  value={dang.donGiaBan}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, donGiaBan: v } : d))
                  }
                  hint="Bỏ trống nếu chưa chốt giá bán."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setDang(null)}>
              Hủy
            </Button>
            <Button size="lg" onClick={luu}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
