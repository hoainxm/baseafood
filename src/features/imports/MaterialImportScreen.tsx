// ============================================================
// Tên file cũ: src/features/imports/NhapNguyenLieu.tsx
// Tên tiếng Việt: Màn hình Nhập Nguyên Liệu ngày
// Description: Material Import Management Screen
// ============================================================
import { useMemo, useState } from "react";
import type {
  DailyLock,
  ImportShipment,
  MaterialImportItem,
  ScrapItem,
  Workshop,
  Category,
} from "@/types";
import { CATEGORIES, isBackdatedImport, calculateImportAmount } from "@/types";
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
  NumberField,
  RecordTable,
  ThongKe,
  notify,
  type Cot,
  type LoiNhap,
  type MucChon,
} from "@/design-system";
import { kg, num, todayISO, viDate } from "@/lib/format";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import {
  CalendarRange,
  ChevronDown,
  CircleCheck,
  FileText,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Scale,
  SlidersHorizontal,
  TriangleAlert,
  Truck,
  Warehouse,
  X,
  Replace,
} from "lucide-react";
import PhieuNLNgay from "@/features/imports/DailyImportInvoice";

import { HopDoiLoaiHangLoat } from "./BulkTypeChange";

const PHAN_XUONG: Workshop[] = ["Đông", "Cá", "Khô"];

/** Loại phế liệu hay gặp — vẫn thêm mới tại chỗ được. */
const PHE_LIEU_GOI_Y = ["Nội tạng", "Dạt"];

/** Đầu chuyến đang nhập — dùng chung cho mọi dòng loại hàng trong chuyến. */
interface DauChuyen {
  deliveryDate: string;
  postingDate: string;
  backdateReason: string;
  workshop: Workshop;
  supplierName: string;
  driverName: string;
  licensePlate: string;
  note: string;
}

/** Một dòng loại hàng đang nhập trong chuyến. */
interface DongMoi {
  category: Category;
  materialTypeName: string;
  quantityKg: number;
  unitPrice: number | null;
}

const DONG_MOI_RONG: DongMoi = {
  category: "Bạch tuộc",
  materialTypeName: "",
  quantityKg: 0,
  unitPrice: null,
};

/**
 * Một chuyến hiện trên sổ. Có hai nguồn:
 *  - chuyến THẬT (bảng `chuyen_nhap`) — mọi chuyến ghi từ nay;
 *  - nhóm NGẦM của dữ liệu cũ (dòng chưa có `chuyenId`) — gom theo
 *    (ngày + xưởng + đại lý + xe) đúng như cách màn cũ đếm.
 */
interface NhomChuyen {
  khoa: string;
  chuyen: ImportShipment | null;
  deliveryDate: string;
  postingDate: string;
  backdateReason: string;
  workshop: Workshop;
  supplierName: string;
  driverName: string;
  licensePlate: string;
  note: string;
  dong: MaterialImportItem[];
  tongKg: number;
  tongTien: number;
  ghiBu: boolean;
}

function gomChuyen(
  rows: MaterialImportItem[],
  chuyen: ImportShipment[]
): NhomChuyen[] {
  const theoId = new Map(chuyen.map((c) => [c.id, c]));
  const nhoms = new Map<string, NhomChuyen>();

  for (const r of rows) {
    const c = r.shipmentId ? theoId.get(r.shipmentId) : undefined;
    const khoa = c
      ? c.id
      : `ngam|${r.deliveryDate}|${r.workshop}|${r.supplierName}|${r.driverName}|${r.licensePlate}`;
    let nhom = nhoms.get(khoa);
    if (!nhom) {
      nhom = {
        khoa,
        chuyen: c ?? null,
        deliveryDate: c?.deliveryDate ?? r.deliveryDate,
        postingDate: c?.postingDate ?? r.deliveryDate,
        backdateReason: c?.backdateReason ?? "",
        workshop: c?.workshop ?? r.workshop,
        supplierName: c?.supplierName ?? r.supplierName,
        driverName: c?.driverName ?? r.driverName,
        licensePlate: c?.licensePlate ?? r.licensePlate,
        note: c?.note ?? r.note,
        dong: [],
        tongKg: 0,
        tongTien: 0,
        ghiBu: false,
      };
      nhom.ghiBu = isBackdatedImport(nhom);
      nhoms.set(khoa, nhom);
    }
    nhom.dong.push(r);
    nhom.tongKg += r.quantityKg || 0;
    nhom.tongTien += calculateImportAmount(r);
  }

  return [...nhoms.values()].sort(
    (a, b) =>
      a.deliveryDate.localeCompare(b.deliveryDate) ||
      a.supplierName.localeCompare(b.supplierName, "vi") ||
      a.khoa.localeCompare(b.khoa)
  );
}

/** Kiểm tra đầu chuyến — dùng chung cho lúc ghi mới và lúc sửa. */
function loiDauChuyen(d: DauChuyen, daChot: boolean): LoiNhap[] {
  const ls: LoiNhap[] = [];
  if (!d.supplierName.trim())
    ls.push({ truong: "Đại lý", thongBao: "Chưa chọn đại lý giao hàng" });
  if (d.postingDate < d.deliveryDate)
    ls.push({
      truong: "Ngày ghi sổ",
      thongBao: "Ngày ghi sổ không thể trước ngày hàng về xưởng",
    });
  const canLyDo = isBackdatedImport(d) || daChot;
  if (canLyDo && !d.backdateReason.trim())
    ls.push({
      truong: "Lý do ghi bù",
      thongBao: daChot
        ? "Ngày này đã chốt — phải ghi rõ vì sao ghi thêm"
        : "Ghi sau ngày hàng về — phải ghi rõ lý do (VD: chờ hóa đơn)",
    });
  return ls;
}

export default function NhapNguyenLieuScreen() {
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

  const [daiLy, setDaiLy] = useSuppliers();
  const [loaiNL, setLoaiNL] = useMaterialTypes();

  /* Ghi chuyến: bước 1 điền đầu chuyến, bước 2 đổ từng loại hàng. */
  const [phien, setPhien] = useState<DauChuyen | null>(null);
  const [chuyenIdPhien, setChuyenIdPhien] = useState<string | null>(null);
  const [dongMoi, setDongMoi] = useState<DongMoi>(DONG_MOI_RONG);
  const [loiPhien, setLoiPhien] = useState<LoiNhap[]>([]);
  const [moPhuPhien, setMoPhuPhien] = useState(false);

  /* Đang sửa một chuyến đã ghi: id các dòng của chuyến đó (null = đang tạo mới).
     Dùng id-set thay vì chỉ chuyenId để sửa được CẢ dữ liệu cũ (không có chuyenId). */
  const [suaRowIds, setSuaRowIds] = useState<string[] | null>(null);

  /* Sửa MỘT dòng hàng — chỉ loại / loài / kg / giá */
  const [dang, setDang] = useState<MaterialImportItem | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  /* Chốt ngày */
  const [hoiChot, setHoiChot] = useState(false);
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

  const optDaiLy: MucChon[] = daiLy.map((d) => ({
    value: d.shortName,
    label: d.shortName,
    phu: d.phone || undefined,
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
      supplierName: "",
      driverName: "",
      licensePlate: "",
      note: "",
    });
    setChuyenIdPhien(null);
    setSuaRowIds(null);
    setDongMoi(DONG_MOI_RONG);
    setLoiPhien([]);
    setMoPhuPhien(false);
  };

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
    });
    setChuyenIdPhien(n.chuyen?.id ?? null);
    setSuaRowIds(n.dong.map((r) => r.id));
    setDongMoi(DONG_MOI_RONG);
    setLoiPhien([]);
    setMoPhuPhien(false);
  };

  const datPhien = <K extends keyof DauChuyen>(k: K, v: DauChuyen[K]) =>
    setPhien((p) => (p ? { ...p, [k]: v } : p));

  /** Dòng đã ghi trong chuyến đang mở (tạo mới: theo chuyenId; sửa: theo id-set). */
  const dongPhien = useMemo(() => {
    if (suaRowIds) return rows.filter((r) => suaRowIds.includes(r.id));
    if (chuyenIdPhien) return rows.filter((r) => r.shipmentId === chuyenIdPhien);
    return [];
  }, [rows, suaRowIds, chuyenIdPhien]);

  /** Đang sửa chuyến đã ghi (khác với tạo chuyến mới). */
  const dangSuaChuyen = suaRowIds !== null;
  const tongChuyen = dongPhien.reduce((s, r) => s + (r.quantityKg || 0), 0);
  const tongNgayPhien = phien
    ? tongNgayXuong(phien.deliveryDate, phien.workshop)
    : 0;
  const chotPhien = phien
    ? daChot(phien.deliveryDate, phien.workshop)
    : false;

  const setDong = <K extends keyof DongMoi>(k: K, v: DongMoi[K]) =>
    setDongMoi((d) => ({ ...d, [k]: v }));

  /** Thêm một loại vào sổ — LƯU NGAY thành một dòng nhap_nguyen_lieu. */
  const themDong = () => {
    if (!phien) return;
    // Đầu chuyến giờ sửa tại chỗ cùng màn đổ hàng (gộp một bước) → kiểm luôn
    // đầu chuyến ở đây, tránh tạo chuyến thiếu đại lý / sai ngày.
    const ls: LoiNhap[] = [...loiDauChuyen(phien, chotPhien)];
    if (!dongMoi.materialTypeName.trim())
      ls.push({ truong: "Loại nguyên liệu", thongBao: "Chưa chọn loại hàng" });
    if (!(dongMoi.quantityKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoiPhien(ls);
    if (ls.length > 0) return;

    // Sửa dữ liệu cũ (không có bản ghi chuyến) → dòng mới cũng để chuyenId rỗng,
    // gom lại cùng nhóm nhờ (ngày + xưởng + đại lý + xe). KHÔNG tự sinh chuyến.
    const suaDuLieuCu = dangSuaChuyen && !chuyenIdPhien;

    let idChuyen = chuyenIdPhien;
    if (chuyenIdPhien) {
      // Chuyến thật (đang tạo dở hoặc đang sửa) → áp đầu chuyến vào bản ghi.
      persistChuyen(
        chuyen.map((c) =>
          c.id === chuyenIdPhien ? { ...c, ...phien, id: c.id } : c
        )
      );
    } else if (!suaDuLieuCu) {
      // Chuyến mới: chỉ tạo khi có dòng đầu tiên — không để lại chuyến rỗng.
      idChuyen = newId();
      persistChuyen([...chuyen, { id: idChuyen, ...phien }]);
      setChuyenIdPhien(idChuyen);
    }

    const dong: MaterialImportItem = {
      id: newId(),
      shipmentId: idChuyen ?? "",
      deliveryDate: phien.deliveryDate,
      workshop: phien.workshop,
      category: dongMoi.category,
      supplierName: phien.supplierName,
      materialTypeName: dongMoi.materialTypeName,
      quantityKg: dongMoi.quantityKg,
      unitPrice: dongMoi.unitPrice,
      driverName: phien.driverName,
      licensePlate: phien.licensePlate,
      note: phien.note,
    };
    // Đồng bộ đầu chuyến cho MỌI dòng của chuyến (đại lý/ngày/xe có thể vừa đổi
    // tại chỗ) rồi thêm dòng mới — một lần persist, đúng bất biến "sửa đầu chuyến
    // áp cho cả chuyến". Nhóm theo id-set khi sửa, theo chuyenId khi tạo mới.
    const thuocChuyen = (r: MaterialImportItem) =>
      suaRowIds ? suaRowIds.includes(r.id) : r.shipmentId === idChuyen;
    persist([
      ...rows.map((r) =>
        thuocChuyen(r)
          ? {
              ...r,
              deliveryDate: phien.deliveryDate,
              workshop: phien.workshop,
              supplierName: phien.supplierName,
              driverName: phien.driverName,
              licensePlate: phien.licensePlate,
              note: phien.note,
            }
          : r
      ),
      dong,
    ]);
    if (suaRowIds) setSuaRowIds([...suaRowIds, dong.id]);
    notify.daLuu(`Đã vào sổ: ${dong.materialTypeName} — ${kg(dong.quantityKg)}`);

    // Ngày đã chốt mà ghi bù → nói ngay tổng ngày lệch bao nhiêu so với lúc chốt.
    const bg = banGhiChot(phien.deliveryDate, phien.workshop);
    if (bg?.isLocked) {
      const moi =
        tongNgayXuong(phien.deliveryDate, phien.workshop) + dong.quantityKg;
      notify.canhBao(
        `Ngày ${viDate(phien.deliveryDate)} đã chốt ${kg(bg.totalKgAtLock)} — sau khi ghi bù thành ${kg(moi)}`
      );
    }

    // Giữ loài để đổ tiếp loại sau cho nhanh; xóa loại / kg / giá.
    setDongMoi((d) => ({ ...DONG_MOI_RONG, category: d.category }));
    setLoiPhien([]);
  };

  const boDongPhien = (r: MaterialImportItem) => {
    const truoc = rows;
    const truocIds = suaRowIds;
    persist(rows.filter((x) => x.id !== r.id));
    if (suaRowIds) setSuaRowIds(suaRowIds.filter((id) => id !== r.id));
    notify.daXoa(`Đã bỏ ${r.materialTypeName} — ${kg(r.quantityKg)}`, () => {
      persist(truoc);
      if (truocIds) setSuaRowIds(truocIds);
    });
  };

  /** Đóng chuyến: bỏ chuyến rỗng, kéo bộ lọc về đúng ngày/xưởng vừa ghi. */
  const dongPhienLai = (mo: "dong" | "chuyen-khac") => {
    const p = phien;
    if (p && chuyenIdPhien && dongPhien.length === 0) {
      persistChuyen(chuyen.filter((c) => c.id !== chuyenIdPhien));
    }
    // Đầu chuyến có thể vừa sửa tại chỗ mà chưa thêm dòng mới → áp cho chuyến
    // + mọi dòng trước khi đóng, giữ đúng bất biến "đầu chuyến áp cả chuyến".
    if (p && dongPhien.length > 0 && (chuyenIdPhien || suaRowIds)) {
      if (chuyenIdPhien)
        persistChuyen(
          chuyen.map((c) =>
            c.id === chuyenIdPhien ? { ...c, ...p, id: c.id } : c
          )
        );
      const thuoc = (r: MaterialImportItem) =>
        suaRowIds ? suaRowIds.includes(r.id) : r.shipmentId === chuyenIdPhien;
      persist(
        rows.map((r) =>
          thuoc(r)
            ? {
                ...r,
                deliveryDate: p.deliveryDate,
                workshop: p.workshop,
                supplierName: p.supplierName,
                driverName: p.driverName,
                licensePlate: p.licensePlate,
                note: p.note,
              }
            : r
        )
      );
    }
    if (p && dongPhien.length > 0) {
      // Điểm hay mất hàng nhất: ghi ngày ngoài kỳ đang lọc rồi tưởng mất.
      if (p.deliveryDate < tuHieuLuc || p.deliveryDate > denHieuLuc) {
        setKy("ngay");
        setNgay(p.deliveryDate);
      }
      if (phanXuong !== "Tất cả" && phanXuong !== p.workshop)
        setPhanXuong(p.workshop);
      if (locDaiLy && locDaiLy !== p.supplierName) setLocDaiLy("");
      if (locGia === "thieu-gia") setLocGia("tat-ca");
    }

    if (mo === "dong") {
      setPhien(null);
      setChuyenIdPhien(null);
      setSuaRowIds(null);
      return;
    }
    // Ghi chuyến khác: giữ ngày + xưởng, làm mới đại lý / xe.
    setPhien(
      p
        ? {
            ...p,
            supplierName: "",
            driverName: "",
            licensePlate: "",
            note: "",
          }
        : null
    );
    setChuyenIdPhien(null);
    setSuaRowIds(null);
    setDongMoi(DONG_MOI_RONG);
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
    setPhien(null);
    setChuyenIdPhien(null);
    setSuaRowIds(null);
  };

  /* ---- Sửa / xóa một dòng hàng ---- */

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.materialTypeName.trim())
      ls.push({ truong: "Loại nguyên liệu", thongBao: "Chưa chọn loại hàng" });
    if (!(dang.quantityKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    persist(rows.map((r) => (r.id === dang.id ? dang : r)));
    notify.daLuu("Đã lưu thay đổi");
    setDang(null);
  };

  const set = <K extends keyof MaterialImportItem>(
    k: K,
    v: MaterialImportItem[K]
  ) =>
    setDang((d) => (d ? { ...d, [k]: v } : d));

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Nhập hàng về xưởng
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setXemPhieu(true)}
          >
            <FileText />
            Xem báo cáo
          </Button>
          <Button variant="outline" size="lg" onClick={() => setDoiLoaiMo(true)}>
            <Replace />
            Đổi loại hàng loạt
          </Button>
          <Button size="lg" onClick={moThem}>
            <Plus />
            Ghi chuyến hàng
          </Button>
        </div>
      </div>

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
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-base text-muted-foreground">
                        Chuyến này
                      </span>
                      <span className="tnum text-xl font-semibold">
                        {kg(n.tongKg)}
                      </span>
                      {!khoaChuyen && (
                        <Button variant="outline" onClick={() => moSuaChuyen(n)}>
                          <Pencil />
                          Sửa chuyến
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
        />
      )}

      {/* Chốt số liệu ngày — đặt CUỐI: xem hết sổ + phế liệu rồi mới chốt */}
      {xemMotNgayMotXuong && (
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
              {dangSuaChuyen ? "Sửa chuyến" : "Ghi chuyến hàng"}
            </DialogTitle>
            <DialogDescription className="text-base">
              {dangSuaChuyen
                ? "Sửa đầu chuyến (áp cho mọi dòng), thêm hoặc bỏ loại hàng ngay bên dưới."
                : "Điền đầu chuyến (đại lý, ngày, xe) rồi đổ từng loại ngay bên dưới — mỗi loại bấm “Thêm loại này vào sổ” là vào sổ ngay."}
            </DialogDescription>
          </DialogHeader>

          {phien && (
            <div className="space-y-6 py-2">
                  <ErrorSummary loi={loiPhien} />
                  <ChuThichBatBuoc />

                  {chotPhien && (
                    <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                      <Lock className="mt-0.5 size-6 shrink-0" aria-hidden />
                      <span>
                        Ngày {viDate(phien.deliveryDate)} · xưởng {phien.workshop}{" "}
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
                      label="Ngày ghi sổ"
                      required
                      info="Ngày ghi vào hệ thống. Khác ngày hàng về ⇒ ghi bù."
                      value={phien.postingDate}
                      onChange={(v) => datPhien("postingDate", v)}
                    />
                    <DateField
                      label="Ngày hàng về xưởng"
                      required
                      info="Ngày xe đổ hàng thật — mọi tổng hợp tính theo ngày này."
                      value={phien.deliveryDate}
                      onChange={(v) => datPhien("deliveryDate", v)}
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

                  <Combobox
                    label="Phân xưởng"
                    required
                    choPhepXoa={false}
                    value={phien.workshop}
                    onChange={(v) => datPhien("workshop", v as Workshop)}
                    options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
                  />

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
                              value={phien.driverName}
                              onChange={(e) => datPhien("driverName", e.target.value)}
                              placeholder="Tên tài xế"
                            />
                          </Field>
                          <Field label="Biển số xe">
                            <Input
                              value={phien.licensePlate}
                              onChange={(e) =>
                                datPhien("licensePlate", e.target.value)
                              }
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
                      </div>
                    )}
                  </div>

                  <div className="border-t-2 border-border pt-1" />

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
                              {r.materialTypeName} —{" "}
                              <span className="tnum font-semibold">
                                {num(r.quantityKg)}
                              </span>{" "}
                              kg
                              {r.unitPrice != null ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {num(r.unitPrice)} đ
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · chưa có giá
                                </span>
                              )}
                            </span>
                            <div className="flex shrink-0 items-center gap-2">
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => boDongPhien(r)}
                              >
                                <X />
                                Bỏ
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Thêm một loại hàng — NÚT CHÍNH DUY NHẤT trong thân */}
                  <div className="space-y-5 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
                    <p className="text-base font-semibold">Thêm loại hàng</p>

                    <Combobox
                      label="Loài"
                      required
                      choPhepXoa={false}
                      value={dongMoi.category}
                      onChange={(v) => {
                        setDong("category", v as Category);
                        setDong("materialTypeName", "");
                      }}
                      options={CATEGORIES.map((l) => ({ value: l, label: l }))}
                    />

                    <Combobox
                      label="Loại nguyên liệu"
                      required
                      hint="Chọn loài trước — danh sách chỉ hiện loại của loài đó."
                      value={dongMoi.materialTypeName}
                      onChange={(v) => setDong("materialTypeName", v)}
                      options={optLoaiNLTheoLoai(dongMoi.category)}
                      onCreate={(ten) => themLoaiNL(ten, dongMoi.category)}
                    />

                    <div className="grid gap-6 sm:grid-cols-2">
                      <NumberField
                        label="Số lượng"
                        required
                        unit="kg"
                        value={dongMoi.quantityKg || null}
                        onChange={(v) => setDong("quantityKg", v ?? 0)}
                      />
                      <NumberField
                        label="Đơn giá"
                        unit="đ"
                        value={dongMoi.unitPrice}
                        onChange={(v) => setDong("unitPrice", v)}
                        hint="Bỏ trống nếu chưa chốt giá / chưa có hóa đơn."
                      />
                    </div>

                    {dongMoi.quantityKg > 0 && dongMoi.unitPrice ? (
                      <div className="rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                        Thành tiền:{" "}
                        <span className="tnum text-lg font-semibold">
                          {num(dongMoi.quantityKg * dongMoi.unitPrice)} đ
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
                      Tổng ngày {viDate(phien.deliveryDate)} · xưởng{" "}
                      {phien.workshop}
                    </span>
                    <span className="tnum text-2xl font-semibold">
                      {kg(tongNgayPhien)}
                    </span>
                  </div>
            </div>
          )}

          <DialogFooter>
            {dangSuaChuyen ? (
              <ConfirmDelete
                moTaBanGhi={`Chuyến ${phien?.supplierName || "(chưa có đại lý)"} — ${viDate(phien?.deliveryDate ?? "")} — ${dongPhien.length} dòng — ${kg(tongChuyen)}`}
                onConfirm={xoaChuyenDangSua}
                tieuDe="Xóa cả chuyến này?"
                nhanNut="Xóa chuyến"
              />
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={() => dongPhienLai("chuyen-khac")}
              >
                <Truck />
                Lưu &amp; thêm chuyến khác
              </Button>
            )}
            <Button size="lg" onClick={() => dongPhienLai("dong")}>
              {dangSuaChuyen ? "Xong" : "Xong chuyến"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Hộp thoại: sửa một dòng hàng (mở từ trong dialog chuyến) ---- */}
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
              <ChuThichBatBuoc />

              <div className="rounded-xl bg-muted px-5 py-4">
                <p className="text-base text-muted-foreground">Thuộc chuyến</p>
                <p className="text-lg font-semibold text-foreground">
                  {viDate(dang.deliveryDate)} · xưởng {dang.workshop} · {dang.supplierName}
                </p>
              </div>

              <Combobox
                label="Loài"
                required
                choPhepXoa={false}
                value={dang.category}
                onChange={(v) => {
                  set("category", v as Category);
                  set("materialTypeName", "");
                }}
                options={CATEGORIES.map((l) => ({ value: l, label: l }))}
              />

              <Combobox
                label="Loại nguyên liệu"
                required
                hint="Chọn loài trước — danh sách chỉ hiện loại của loài đó."
                value={dang.materialTypeName}
                onChange={(v) => set("materialTypeName", v)}
                options={optLoaiNLTheoLoai(dang.category)}
                onCreate={(ten) => themLoaiNL(ten, dang.category)}
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={dang.quantityKg || null}
                  onChange={(v) => set("quantityKg", v ?? 0)}
                />
                <NumberField
                  label="Đơn giá"
                  unit="đ"
                  value={dang.unitPrice}
                  onChange={(v) => set("unitPrice", v)}
                  hint="Bỏ trống nếu chưa chốt giá / chưa có hóa đơn."
                />
              </div>

              {dang.quantityKg > 0 && dang.unitPrice ? (
                <div className="rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
                  Thành tiền:{" "}
                  <span className="tnum text-lg font-semibold">
                    {num(dang.quantityKg * dang.unitPrice)} đ
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
    </div>
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
  phanXuong: Workshop;
  rows: ScrapItem[];
  onChange: (n: ScrapItem[]) => void;
  khoa: boolean;
}) {
  const [dang, setDang] = useState<ScrapItem | null>(null);
  const [laThem, setLaThem] = useState(false);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const cuaNgay = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.source === "Nhập hàng" && r.date === ngay && r.workshop === phanXuong
      ),
    [rows, ngay, phanXuong]
  );

  const tongKg = cuaNgay.reduce((s, r) => s + (r.quantityKg || 0), 0);
  const tongTien = cuaNgay.reduce(
    (s, r) => s + r.quantityKg * (r.sellingPrice ?? 0),
    0
  );

  const optLoai: MucChon[] = PHE_LIEU_GOI_Y.map((t) => ({
    value: t,
    label: t,
  }));

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [];
    if (!dang.name.trim())
      ls.push({ truong: "Loại phế liệu", thongBao: "Chưa chọn loại phế liệu" });
    if (!(dang.quantityKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoi(ls);
    if (ls.length > 0) return;
    onChange(
      laThem ? [...rows, dang] : rows.map((r) => (r.id === dang.id ? dang : r))
    );
    notify.daLuu(
      laThem
        ? `Đã ghi phế liệu ${dang.name} — ${kg(dang.quantityKg)}`
        : "Đã lưu thay đổi"
    );
    if (laThem) {
      // Thêm được NHIỀU loại trong một lần: reset form, giữ hộp thoại mở.
      setDang({
        id: newId(),
        periodId: "",
        name: "",
        quantityKg: 0,
        sellingPrice: null,
        date: ngay,
        workshop: phanXuong,
        source: "Nhập hàng",
      });
      setLoi([]);
    } else {
      setDang(null);
    }
  };

  const cols: Cot<ScrapItem>[] = [
    {
      key: "category",
      header: "Loại phế liệu",
      chinh: true,
      render: (r) => r.name,
      sapXep: (r) => r.name,
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
      header: "Đơn giá bán (đ)",
      so: true,
      render: (r) =>
        r.sellingPrice != null ? (
          num(r.sellingPrice)
        ) : (
          <Badge variant="outline">Chưa có giá</Badge>
        ),
      sapXep: (r) => r.sellingPrice ?? 0,
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      render: (r) => num(r.quantityKg * (r.sellingPrice ?? 0)),
      sapXep: (r) => r.quantityKg * (r.sellingPrice ?? 0),
    },
    {
      key: "ky",
      header: "Kỳ cân đối",
      render: (r) =>
        r.periodId ? (
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
                periodId: "",
                name: "",
                quantityKg: 0,
                sellingPrice: null,
                date: ngay,
                workshop: phanXuong,
                source: "Nhập hàng",
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
                    moTaBanGhi={`${r.name} — ${kg(r.quantityKg)} — ngày ${viDate(r.date)}`}
                    onConfirm={() => {
                      const truoc = rows;
                      onChange(rows.filter((x) => x.id !== r.id));
                      notify.daXoa(`Đã xóa phế liệu ${r.name}`, () =>
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
              {laThem
                ? " Thêm được nhiều loại — mỗi loại bấm “Thêm loại này”, xong bấm “Xong”."
                : ""}
            </DialogDescription>
          </DialogHeader>

          {dang && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loi} />
              <ChuThichBatBuoc />

              <Combobox
                label="Loại phế liệu"
                required
                hint="Chưa có trong danh sách thì gõ tên rồi bấm Thêm mới."
                value={dang.name}
                onChange={(v) => setDang((d) => (d ? { ...d, loai: v } : d))}
                options={optLoai}
                onCreate={(ten) => ten}
              />

              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={dang.quantityKg || null}
                  onChange={(v) =>
                    setDang((d) => (d ? { ...d, quantityKg: v ?? 0 } : d))
                  }
                />
                <NumberField
                  label="Đơn giá bán"
                  unit="đ"
                  value={dang.sellingPrice}
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
              {laThem ? "Xong" : "Hủy"}
            </Button>
            <Button size="lg" onClick={luu}>
              {laThem ? <Plus /> : null}
              {laThem ? "Thêm loại này" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
