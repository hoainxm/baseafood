// ============================================================
// Tên file: src/features/production/WipProductionScreen.tsx
// Tên tiếng Việt: Màn hình Ghi Thành Phẩm ngày (sản xuất)
// Description: Daily finished-goods production entry (v1: product · qty · customer)
// ============================================================
import { Fragment, useEffect, useMemo, useState } from "react";
import type {
  DailyLock,
  WipProductionItem,
  Product,
  Workshop,
} from "@/types";
import { isBackdatedWip, laCoTach, quyCachBlock } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import {
  useProductionLocks,
  useProducts,
  useWipProductions,
  useCustomers,
  useMaterialTypes,
} from "@/lib/catalogRepo";
import {
  Badge,
  ChuThichBatBuoc,
  Button,
  Combobox,
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
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { ghiNhatKy } from "@/lib/audit";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/periodUtils";
import { DailyTaskReminder, PhieuTrongTPNgay } from "@/features/shared";
import {
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Factory,
  Hourglass,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Printer,
  Scale,
  Send,
  Trash2,
  TriangleAlert,
  Users,
  Warehouse,
  X,
} from "lucide-react";

const PHAN_XUONG: Workshop[] = ["Đông", "Cá", "Khô"];
const KEY_WIP_REPORT = "bsf.wip-report-sent.v1";
/** Nhớ phân xưởng gần nhất THEO MÁY (device pref, không phải số liệu) để lần
 *  sau khỏi chọn lại — cùng nhóm với mốc "đã gửi báo cáo", không đụng repo. */
const KEY_WIP_XUONG = "bsf.wip-xuong.v1";
const docXuongNho = (): Workshop => {
  try {
    const v = localStorage.getItem(KEY_WIP_XUONG);
    if (v && (PHAN_XUONG as string[]).includes(v)) return v as Workshop;
  } catch {
    /* chặn cookie — mặc định Đông */
  }
  return "Đông";
};

/** Đầu phiên ghi — chọn một lần, đổ nhiều thành phẩm bên dưới. */
interface DauPhien {
  productionDate: string;
  postingDate: string;
  backdateReason: string;
  workshop: Workshop;
}

/**
 * Một dòng thành phẩm trong BẢNG nhập (nhập cả phiên rồi lưu một lần).
 *  - `groupId`: định danh NHÓM ổn định trong phiên — chỉ là state form, KHÔNG
 *    lưu xuống DB. Ổn định để sửa nhãn "kiểu chế biến × khách" ở đầu nhóm không
 *    làm React remount cả nhóm (mất focus). Dữ liệu lưu vẫn là processingType +
 *    customerName trên TỪNG dòng như cũ.
 *  - `tach`: thành phẩm cắt chần tách 2 thành phần cùng giá (râu + bao tử);
 *    khi bật, tổng khối lượng = râu + bao tử (khoá, tự cộng).
 */
interface DongSX {
  key: string;
  groupId: string; // nhóm ổn định (state form, không lưu DB)
  processingType: string; // KIỂU CHẾ BIẾN (luộc/chần/cắt…) — nhãn nhóm, lưu theo dòng
  customerName: string; // KHÁCH — nhãn nhóm, lưu theo dòng
  productId: string;
  moRong: boolean; // dòng con (râu/bao tử) đang mở — trạng thái hiển thị
  quantityKg: number; // dùng khi KHÔNG tách
  rauKg: number;
  baoTuKg: number;
  blocksCount: number;
  blockSpecKg: number; // quy cách kg/khối — nhập ngay trên dòng, nhớ về mặt hàng
}

const dongSXRong = (
  groupId: string,
  processingType = "",
  customerName = ""
): DongSX => ({
  key: newId(),
  groupId,
  processingType,
  customerName,
  productId: "",
  moRong: false,
  quantityKg: 0,
  rauKg: 0,
  baoTuKg: 0,
  blocksCount: 0,
  blockSpecKg: 0,
});

/** Dòng có tách râu/bao tử = đã nhập ít nhất một trong hai thành phần. */
const laTach = (d: DongSX): boolean =>
  (d.rauKg || 0) > 0 || (d.baoTuKg || 0) > 0;

/** Tổng khối lượng một dòng (tách thì cộng 2 thành phần). */
const tongDong = (d: DongSX): number =>
  laTach(d) ? (d.rauKg || 0) + (d.baoTuKg || 0) : d.quantityKg || 0;

/** Dòng đủ để lưu: có thành phẩm + tổng > 0. */
const dongDayDu = (d: DongSX): boolean => Boolean(d.productId) && tongDong(d) > 0;

/**
 * Dòng CÒN TRỐNG = chưa nhập cả thành phẩm lẫn kg. Bỏ qua khi lưu (kể cả khi
 * đã mang nhãn nhóm chế biến/khách) — đây là "dòng trống chờ gõ" của bảng.
 */
const dongTrong = (d: DongSX): boolean => !d.productId && tongDong(d) <= 0;

export default function SanXuatBTPScreen() {
  const [rows, persist, { trangThai }] = useWipProductions();
  const dangTai = trangThai === "dang-tai" && rows.length === 0;
  const [chot, persistChot] = useProductionLocks();
  const [matHang, setMatHang] = useProducts();
  const [khach, setKhach] = useCustomers();
  const [loaiNL, setLoaiNL] = useMaterialTypes();

  // Người thao tác = tài khoản đang đăng nhập — gắn vào dòng khi lưu để lưu vết ai gửi.
  const { nguoiDung } = useAuth();
  const nguoiThaoTac = nguoiDung?.fullName || nguoiDung?.username || "";

  const [ky, setKy] = useState<KyXem>("ngay");
  const [ngay, setNgay] = useState(todayISO());
  const [tuNgay, setTuNgay] = useState(todayISO());
  const [denNgay, setDenNgay] = useState(todayISO());
  const [phanXuong, setPhanXuong] = useState<Workshop | "Tất cả">(docXuongNho);

  /* Ghi cả bảng một lượt: đầu phiên chọn 1 lần, đổ nhiều thành phẩm. */
  const [phien, setPhien] = useState<DauPhien | null>(null);
  const [ngayLienNhau, setNgayLienNhau] = useState(true);
  const [dongBang, setDongBang] = useState<DongSX[]>([]);
  const [loiPhien, setLoiPhien] = useState<LoiNhap[]>([]);
  /** Nhóm (kiểu chế biến × khách) của phiên trước → phiếu mới tự điền sẵn nhóm
   *  đầu, gõ thành phẩm ngay, khỏi tạo nhóm lại. Chỉ sống trong phiên làm việc. */
  const [nhomGanNhat, setNhomGanNhat] = useState<{ pt: string; cust: string }>({
    pt: "",
    cust: "",
  });

  /* Sửa một dòng đã ghi (từ bảng sổ). */
  const [sua, setSua] = useState<WipProductionItem | null>(null);
  const [loiSua, setLoiSua] = useState<LoiNhap[]>([]);
  /** Dòng đang sửa có tách không = đã nhập râu/bao tử (ô tách luôn có sẵn). */
  const suaTach =
    (sua?.componentRauKg ?? 0) > 0 || (sua?.componentBaoTuKg ?? 0) > 0;

  /** Hai chế độ: "nhap" = form ghi (mặc định, form-first cho tổ xưởng); "so" = sổ + báo cáo. */
  const [cheDo, setCheDo] = useState<"nhap" | "so">("nhap");
  const [inPhieuTrong, setInPhieuTrong] = useState(false);

  const [hoiChot, setHoiChot] = useState(false);
  const [ghiChuChot, setGhiChuChot] = useState("");
  /** Còn dở cuối ngày SX tách theo loại NL (khép vòng G1) — nhập khi chốt ngày. */
  const [conDo, setConDo] = useState<{ id: string; ten: string; kg: number | null }[]>([]);
  const tongConDoNhap = conDo.reduce((s, d) => s + (d.kg ?? 0), 0);

  /** A4: mốc "đã gửi báo cáo" theo (phạm vi·xưởng), lưu theo máy để phản hồi tại chỗ. */
  const [daGui, setDaGui] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY_WIP_REPORT) || "{}");
    } catch {
      return {};
    }
  });
  const [hoiMoLai, setHoiMoLai] = useState(false);
  const [lyDoMoLai, setLyDoMoLai] = useState("");
  const [loiChot, setLoiChot] = useState<LoiNhap[]>([]);

  const [tuHieuLuc, denHieuLuc] = phamViKy(ky, ngay, tuNgay, denNgay);
  const laMotNgay = tuHieuLuc === denHieuLuc;

  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";

  /** Danh mục thành phẩm — gõ để tìm, thêm mới tại chỗ. */
  const optMatHang: MucChon[] = matHang.map((m) => ({
    value: m.id,
    label: m.code ? `${m.code} · ${m.name}` : m.name,
    phu: [m.code, m.category].filter(Boolean).join(" · ") || undefined,
  }));

  /** Danh mục khách hàng — chọn/ thêm mới tại chỗ (lưu theo TÊN). */
  const optKhach: MucChon[] = khach.map((c) => ({
    value: c.name,
    label: c.name,
    phu: c.market || undefined,
  }));

  const themMatHang = (ten: string, processingType = ""): string => {
    const m: Product = {
      id: uid(),
      code: "",
      name: ten,
      finishedGoodCode: "",
      category: "Bạch tuộc", // xưởng Đông; loài chỉnh sau ở Danh mục nếu cần
      processingType, // gắn KIỂU CHẾ BIẾN của nhóm để mã mới nằm đúng nhóm
    };
    setMatHang([...matHang, m]);
    notify.daLuu(`Đã thêm thành phẩm "${ten}"`);
    return m.id;
  };

  const themKhach = (ten: string): string => {
    setKhach([...khach, { id: uid(), code: "", name: ten, market: "" }]);
    notify.daLuu(`Đã thêm khách hàng "${ten}"`);
    return ten;
  };

  const view = useMemo(
    () =>
      rows
        .filter(
          (r) =>
            r.productionDate >= tuHieuLuc &&
            r.productionDate <= denHieuLuc &&
            (phanXuong === "Tất cả" || r.workshop === phanXuong)
        )
        .sort(
          (a, b) =>
            a.productionDate.localeCompare(b.productionDate) ||
            a.id.localeCompare(b.id)
        ),
    [rows, tuHieuLuc, denHieuLuc, phanXuong]
  );

  const tong = view.reduce((s, r) => s + (r.quantityKg || 0), 0);
  const tongBlock = view.reduce((s, r) => s + (r.blocksCount || 0), 0);
  const soChoNhap = view.filter((r) => r.status === "cho-nhap").length;

  /* ---- A4: gom báo cáo TP ngày theo (xưởng × người thao tác) ---- */
  const baoCaoNguoi = useMemo(() => {
    const m = new Map<
      string,
      { workshop: Workshop; operator: string; soDong: number; kg: number }
    >();
    for (const r of view) {
      const op = (r.operator ?? "").trim() || "(không rõ)";
      const k = `${r.workshop}·${op}`;
      const cur = m.get(k) ?? { workshop: r.workshop, operator: op, soDong: 0, kg: 0 };
      cur.soDong += 1;
      cur.kg += r.quantityKg || 0;
      m.set(k, cur);
    }
    return [...m.values()].sort(
      (a, b) =>
        a.workshop.localeCompare(b.workshop) || a.operator.localeCompare(b.operator)
    );
  }, [view]);

  const moTaPhamVi = laMotNgay
    ? viDate(tuHieuLuc)
    : `${viDate(tuHieuLuc)} – ${viDate(denHieuLuc)}`;

  /* ---- Chốt ngày SX ---- */
  const xemMotNgayMotXuong = laMotNgay && phanXuong !== "Tất cả";
  const xuong: Workshop = phanXuong === "Tất cả" ? "Đông" : phanXuong;
  const banGhiChot = (n: string, x: Workshop): DailyLock | undefined =>
    chot.find((c) => c.lockDate === n && c.workshop === x);
  const chotHienTai = xemMotNgayMotXuong
    ? banGhiChot(tuHieuLuc, xuong)
    : undefined;
  const dangKhoa = Boolean(chotHienTai?.isLocked);
  const tongNgayXuong = (n: string, x: Workshop) =>
    rows
      .filter((r) => r.productionDate === n && r.workshop === x)
      .reduce((s, r) => s + (r.quantityKg || 0), 0);
  const tongThucTe = xemMotNgayMotXuong ? tongNgayXuong(tuHieuLuc, xuong) : 0;
  const lechSauChot =
    chotHienTai?.isLocked && tongThucTe !== chotHienTai.totalKgAtLock
      ? tongThucTe - chotHienTai.totalKgAtLock
      : 0;
  const daChot = (n: string, x: Workshop) => Boolean(banGhiChot(n, x)?.isLocked);

  const ngayGhi = laMotNgay ? tuHieuLuc : denHieuLuc;
  const xuongGhi: Workshop = phanXuong === "Tất cả" ? "Đông" : phanXuong;

  /* Nhắc daily-task: hôm nay (xưởng đang chọn) đã chốt sản xuất chưa. */
  const daChotSXHomNay = chot.some(
    (c) => c.lockDate === todayISO() && c.workshop === xuongGhi && c.isLocked
  );

  /* ---- Phiên ghi cả bảng ---- */
  const moThem = () => {
    setPhien({
      productionDate: ngayGhi,
      postingDate: todayISO(),
      backdateReason: "",
      workshop: xuongGhi,
    });
    setNgayLienNhau(ngayGhi === todayISO());
    // Mở sẵn MỘT nhóm + một dòng trống (điền sẵn nhóm gần nhất) để gõ thành phẩm
    // ngay, khỏi phải bấm "Thêm nhóm" trước.
    setDongBang([dongSXRong(newId(), nhomGanNhat.pt, nhomGanNhat.cust)]);
    setLoiPhien([]);
  };
  const datPhien = <K extends keyof DauPhien>(k: K, v: DauPhien[K]) =>
    setPhien((p) => (p ? { ...p, [k]: v } : p));

  /** Đổi ngày ghi sổ: kéo ngày sản xuất theo khi hai ngày đang đi liền. */
  const doiNgayGhiSo = (v: string) =>
    setPhien((p) =>
      !p
        ? p
        : ngayLienNhau
          ? { ...p, postingDate: v, productionDate: v }
          : { ...p, postingDate: v }
    );
  /** Chỉnh tay ngày sản xuất ⇒ tách khỏi ngày ghi sổ (ghi bù). */
  const doiNgaySX = (v: string) => {
    setNgayLienNhau(false);
    datPhien("productionDate", v);
  };

  // Form-first: vào chế độ "Ghi nhập" mà chưa có phiếu → tự mở một phiếu trống
  // (không cần bấm nút, không modal). Lưu xong phiếu về null → tự mở phiếu mới.
  useEffect(() => {
    if (cheDo === "nhap" && phien === null && !dangTai) moThem();
    // moThem đọc bộ lọc hiện tại; guard theo phien===null nên không lặp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheDo, phien, dangTai]);

  // Trong "Ghi nhập", ngày+xưởng của PHIẾU là ngữ cảnh: đồng bộ về bộ lọc để
  // "đã ghi hôm nay", tổng ngày, chốt ngày, báo cáo A4 bám đúng ngày đang ghi.
  useEffect(() => {
    if (cheDo === "nhap" && phien) {
      setKy("ngay");
      setNgay(phien.productionDate);
      setPhanXuong(phien.workshop);
    }
  }, [cheDo, phien?.productionDate, phien?.workshop]);

  // Nhớ phân xưởng đang chọn theo MÁY → reload khỏi phải chọn lại (device pref).
  useEffect(() => {
    if (phanXuong !== "Tất cả") {
      try {
        localStorage.setItem(KEY_WIP_XUONG, phanXuong);
      } catch {
        /* chặn cookie — bỏ qua */
      }
    }
  }, [phanXuong]);

  // Bảng-tính: mỗi nhóm luôn chừa MỘT dòng trống ở cuối để gõ tiếp — khỏi bấm
  // "Thêm thành phẩm" từng dòng. "Trống" = chưa có SP lẫn kg (nhãn nhóm không
  // tính). Sau khi thêm, nhóm có dòng trống → lần chạy sau không thêm nữa (ổn định).
  useEffect(() => {
    if (cheDo !== "nhap" || !phien) return;
    const theoNhom = new Map<string, DongSX[]>();
    for (const d of dongBang) {
      const g = theoNhom.get(d.groupId) ?? [];
      g.push(d);
      theoNhom.set(d.groupId, g);
    }
    const them: DongSX[] = [];
    for (const [gid, ds] of theoNhom)
      // Nhóm ĐÃ ĐỦ hết (mọi dòng có SP + kg) → chừa thêm một dòng trống để gõ tiếp.
      // Dòng đang gõ dở (mới chọn mã, chưa có kg) chưa tính → không nhảy dòng non.
      if (ds.length > 0 && ds.every((d) => dongDayDu(d)))
        them.push(dongSXRong(gid, ds[0].processingType, ds[0].customerName));
    if (them.length) setDongBang((ds) => [...ds, ...them]);
  }, [dongBang, cheDo, phien]);

  const dongHopLe = dongBang.filter(dongDayDu);
  const tongPhien = dongHopLe.reduce((s, d) => s + tongDong(d), 0);
  const chotDangGhi = phien
    ? daChot(phien.productionDate, phien.workshop)
    : false;
  const canLyDoPhien =
    phien &&
    (isBackdatedWip({
      productionDate: phien.productionDate,
      postingDate: phien.postingDate,
    }) ||
      chotDangGhi);

  const capNhatDong = (key: string, patch: Partial<DongSX>) =>
    setDongBang((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const boDong = (key: string) =>
    setDongBang((ds) => ds.filter((d) => d.key !== key));
  /** Thêm một dòng thành phẩm vào NHÓM đang có (giữ nhãn chế biến × khách). */
  const themDong = (
    groupId: string,
    processingType: string,
    customerName: string
  ) => setDongBang((ds) => [...ds, dongSXRong(groupId, processingType, customerName)]);
  /** Thêm một NHÓM mới (groupId mới) kèm một dòng trống để nhập ngay. */
  const themNhom = (processingType = "", customerName = "") =>
    setDongBang((ds) => [...ds, dongSXRong(newId(), processingType, customerName)]);
  /** Sửa nhãn (kiểu chế biến / khách) của cả một nhóm — mọi dòng cùng groupId. */
  const doiNhom = (
    groupId: string,
    patch: Partial<Pick<DongSX, "processingType" | "customerName">>
  ) =>
    setDongBang((ds) =>
      ds.map((d) => (d.groupId === groupId ? { ...d, ...patch } : d))
    );

  /** Kiểm đầu phiên (ngày + lý do ghi bù). */
  const loiDauPhien = (p: DauPhien): LoiNhap[] => {
    const ls: LoiNhap[] = [];
    if (p.postingDate < p.productionDate)
      ls.push({
        truong: "Ngày ghi sổ",
        thongBao: "Không thể trước ngày sản xuất",
      });
    const canLyDo =
      isBackdatedWip({
        productionDate: p.productionDate,
        postingDate: p.postingDate,
      }) || daChot(p.productionDate, p.workshop);
    if (canLyDo && !p.backdateReason.trim())
      ls.push({
        truong: "Lý do ghi bù",
        thongBao: "Ghi sau ngày SX / ngày đã chốt — ghi rõ lý do",
      });
    return ls;
  };

  /**
   * Lưu cả phiên MỘT LẦN: mọi dòng hợp lệ trong bảng thành một dòng sản lượng.
   * `imLang` (đóng bằng X): đủ thì vẫn lưu, chưa đủ thì bỏ qua, không nài lỗi.
   */
  const luuPhien = (imLang: boolean): boolean => {
    if (!phien) return true;
    const hopLe = dongBang.filter(dongDayDu);
    const ls: LoiNhap[] = [...loiDauPhien(phien)];
    if (hopLe.length === 0)
      ls.push({
        truong: "Thành phẩm",
        thongBao: "Thêm ít nhất một thành phẩm vào phiên",
      });
    if (!imLang)
      dongBang.forEach((d, i) => {
        if (!dongTrong(d) && !dongDayDu(d))
          ls.push({
            truong: `Dòng ${i + 1}`,
            thongBao: !d.productId
              ? "Chưa chọn thành phẩm"
              : "Số lượng phải lớn hơn 0 kg",
          });
      });
    if (ls.length > 0) {
      if (!imLang) setLoiPhien(ls);
      return false;
    }

    const moi: WipProductionItem[] = hopLe.map((d) => ({
      id: newId(),
      productionDate: phien.productionDate,
      postingDate: phien.postingDate,
      backdateReason: phien.backdateReason,
      workshop: phien.workshop,
      productId: d.productId,
      spec: "",
      quantityKg: tongDong(d),
      blocksCount: d.blocksCount || 0,
      warehouse: "",
      status: "cho-nhap",
      note: "",
      customerName: d.customerName.trim(),
      processingType: d.processingType.trim(),
      componentRauKg: laTach(d) ? d.rauKg || 0 : null,
      componentBaoTuKg: laTach(d) ? d.baoTuKg || 0 : null,
      operator: nguoiThaoTac,
    }));
    persist([...rows, ...moi]);

    // Nhớ quy cách block về MẶT HÀNG (đúng ý "gắn trên mặt hàng") — lần sau tự điền.
    const qcMoi = new Map<string, number>();
    for (const d of hopLe)
      if (d.productId && d.blockSpecKg > 0) {
        const p = matHang.find((m) => m.id === d.productId);
        if (p && quyCachBlock(p) !== d.blockSpecKg)
          qcMoi.set(d.productId, d.blockSpecKg);
      }
    if (qcMoi.size > 0)
      setMatHang(
        matHang.map((m) =>
          qcMoi.has(m.id) ? { ...m, blockSpecKg: qcMoi.get(m.id)! } : m
        )
      );

    const tongMoi = moi.reduce((s, r) => s + r.quantityKg, 0);
    notify.daLuu(`Đã lưu ${moi.length} thành phẩm · ${kg(tongMoi)}`);

    const bg = banGhiChot(phien.productionDate, phien.workshop);
    if (bg?.isLocked)
      notify.canhBao(
        `Ngày ${viDate(phien.productionDate)} đã chốt ${kg(bg.totalKgAtLock)} — sau khi ghi bù thành ${kg(tongNgayXuong(phien.productionDate, phien.workshop) + tongMoi)}`
      );

    // Ghi ngày ngoài kỳ đang lọc → kéo bộ lọc về đúng phiên vừa ghi.
    if (
      phien.productionDate < tuHieuLuc ||
      phien.productionDate > denHieuLuc
    ) {
      setKy("ngay");
      setNgay(phien.productionDate);
    }
    if (phanXuong !== "Tất cả" && phanXuong !== phien.workshop)
      setPhanXuong(phien.workshop);
    return true;
  };

  const datLaiPhien = () => {
    setPhien(null);
    setDongBang([]);
    setLoiPhien([]);
  };
  const xongPhien = () => {
    // Nhớ nhóm cuối để phiếu mới điền sẵn (lặp cùng chế biến/khách = 0 thao tác).
    const cuoi = dongBang.filter(dongDayDu).at(-1);
    // Lưu xong → reset phiếu; effect form-first tự mở phiếu trống mới.
    if (luuPhien(false)) {
      if (cuoi)
        setNhomGanNhat({ pt: cuoi.processingType, cust: cuoi.customerName });
      datLaiPhien();
    }
  };

  /* ---- Sửa / xóa một dòng đã ghi ---- */
  const moSua = (r: WipProductionItem) => {
    setSua({ ...r });
    setLoiSua([]);
  };
  const datSua = (patch: Partial<WipProductionItem>) =>
    setSua((d) => (d ? { ...d, ...patch } : d));
  const luuSua = () => {
    if (!sua) return;
    const ls: LoiNhap[] = [];
    if (!sua.productId)
      ls.push({ truong: "Thành phẩm", thongBao: "Chưa chọn thành phẩm" });
    const tong = suaTach
      ? (sua.componentRauKg || 0) + (sua.componentBaoTuKg || 0)
      : sua.quantityKg;
    if (!(tong > 0))
      ls.push({ truong: "Khối lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoiSua(ls);
    if (ls.length > 0) return;
    const banGhi: WipProductionItem = {
      ...sua,
      quantityKg: tong,
      componentRauKg: suaTach ? sua.componentRauKg ?? 0 : null,
      componentBaoTuKg: suaTach ? sua.componentBaoTuKg ?? 0 : null,
    };
    persist(rows.map((r) => (r.id === sua.id ? banGhi : r)));
    notify.daLuu("Đã lưu thay đổi");
    setSua(null);
  };
  const xoa = (r: WipProductionItem) => {
    const truoc = rows;
    persist(rows.filter((x) => x.id !== r.id));
    notify.daXoa(`Đã xóa ${tenMH(r.productId)} — ${kg(r.quantityKg)}`, () =>
      persist(truoc)
    );
  };

  /* ---- A4: gửi báo cáo TP lên hệ thống (tách khỏi chốt ngày) ---- */
  const baoCaoKey = `${tuHieuLuc}${laMotNgay ? "" : `..${denHieuLuc}`}·${phanXuong}`;
  const guiBaoCao = () => {
    const dong = baoCaoNguoi
      .map((b) => `${b.workshop}/${b.operator}: ${b.soDong} dòng · ${kg(b.kg)}`)
      .join("; ");
    ghiNhatKy([
      {
        action: "gui",
        entity: "production_report",
        entityKey: baoCaoKey,
        summary: `Gửi báo cáo thành phẩm ${moTaPhamVi} · ${phanXuong} — tổng ${kg(tong)} (${view.length} dòng). ${dong}`,
        diff: { nguoiGui: nguoiThaoTac, tong, theoNguoi: baoCaoNguoi },
      },
    ]);
    const luc = new Date().toLocaleString("vi-VN");
    const next = { ...daGui, [baoCaoKey]: luc };
    setDaGui(next);
    try {
      localStorage.setItem(KEY_WIP_REPORT, JSON.stringify(next));
    } catch {
      /* hết quota / chặn cookie — mốc "đã gửi" chỉ là phản hồi tại chỗ, bỏ qua */
    }
    notify.daLuu(
      `Đã gửi báo cáo thành phẩm ${moTaPhamVi} · ${phanXuong} lên hệ thống`
    );
  };

  /* ---- Chốt / mở lại ngày ---- */
  const chotNgay = () => {
    const bg = banGhiChot(tuHieuLuc, xuong);
    // Gom còn dở theo tên loại NL (cộng dồn trùng, bỏ dòng trống / ≤ 0).
    const leftoverByMaterial: Record<string, number> = {};
    for (const d of conDo) {
      const ten = d.ten.trim();
      const kgv = d.kg ?? 0;
      if (!ten || kgv <= 0) continue;
      leftoverByMaterial[ten] = (leftoverByMaterial[ten] ?? 0) + kgv;
    }
    const tongConDo = Object.values(leftoverByMaterial).reduce((s, v) => s + v, 0);
    const ban: DailyLock = {
      id: bg?.id ?? newId(),
      lockDate: tuHieuLuc,
      workshop: xuong,
      isLocked: true,
      lockedAt: todayISO(),
      totalKgAtLock: tongThucTe,
      reopenReason: "",
      note: ghiChuChot,
      leftoverKg: tongConDo,
      leftoverByMaterial,
    };
    persistChot(bg ? chot.map((c) => (c.id === bg.id ? ban : c)) : [...chot, ban]);
    notify.daLuu(
      `Đã chốt SX ${viDate(tuHieuLuc)} · xưởng ${xuong} — ${kg(tongThucTe)}` +
        (tongConDo > 0 ? ` · còn dở ${kg(tongConDo)}` : "")
    );
    setHoiChot(false);
    setGhiChuChot("");
    setConDo([]);
  };
  const moLaiNgay = () => {
    const bg = banGhiChot(tuHieuLuc, xuong);
    if (!bg) return;
    if (!lyDoMoLai.trim()) {
      setLoiChot([{ truong: "Lý do mở lại", thongBao: "Ghi rõ vì sao mở lại" }]);
      return;
    }
    persistChot(
      chot.map((c) =>
        c.id === bg.id ? { ...c, isLocked: false, reopenReason: lyDoMoLai } : c
      )
    );
    notify.canhBao(`Đã mở lại SX ${viDate(tuHieuLuc)} · xưởng ${xuong}`);
    setHoiMoLai(false);
    setLyDoMoLai("");
    setLoiChot([]);
  };

  const cols: Cot<WipProductionItem>[] = [
    {
      key: "mh",
      header: "Thành phẩm",
      chinh: true,
      render: (r) => tenMH(r.productId),
      sapXep: (r) => tenMH(r.productId),
    },
    {
      key: "kg",
      header: "Số lượng (kg)",
      so: true,
      render: (r) =>
        r.componentRauKg != null || r.componentBaoTuKg != null ? (
          <span>
            {num(r.quantityKg)}
            <span className="block text-sm text-muted-foreground">
              râu {num(r.componentRauKg ?? 0)} · bao tử{" "}
              {num(r.componentBaoTuKg ?? 0)}
            </span>
          </span>
        ) : (
          num(r.quantityKg)
        ),
      sapXep: (r) => r.quantityKg,
    },
    {
      key: "bl",
      header: "Block",
      so: true,
      render: (r) =>
        r.blocksCount ? num(r.blocksCount) : <span className="text-muted-foreground">—</span>,
      sapXep: (r) => r.blocksCount,
    },
    {
      key: "cb",
      header: "Chế biến",
      render: (r) => r.processingType || <span className="text-muted-foreground">—</span>,
      sapXep: (r) => r.processingType ?? "",
    },
    {
      key: "kh",
      header: "Khách hàng",
      render: (r) => r.customerName || <span className="text-muted-foreground">—</span>,
      sapXep: (r) => r.customerName ?? "",
    },
    {
      key: "tt",
      header: "Trạng thái",
      render: (r) =>
        r.status === "da-nhap" ? (
          <Badge variant="secondary">
            Đã nhập kho{r.warehouse ? ` · ${r.warehouse}` : ""}
          </Badge>
        ) : (
          <Badge variant="outline">Chờ nhập kho</Badge>
        ),
      sapXep: (r) => r.status,
    },
    {
      key: "nguoi",
      header: "Người ghi",
      anTrenDienThoai: true,
      render: (r) => r.operator || <span className="text-muted-foreground">—</span>,
      sapXep: (r) => r.operator ?? "",
    },
  ];

  const suaTong = suaTach
    ? (sua?.componentRauKg || 0) + (sua?.componentBaoTuKg || 0)
    : sua?.quantityKg || 0;

  // FORM NHẬP (form-first) — trước đây nằm trong Dialog, nay render INLINE ở chế độ
  // "Ghi nhập": điền như tờ giấy, không phải mở modal trong trang quản lý.
  const formGhi = phien && (
    <div className="space-y-6 rounded-xl border-2 border-border bg-card p-4 md:p-6">
      <ErrorSummary loi={loiPhien} />
      <ChuThichBatBuoc />

      {chotDangGhi && (
        <p className="flex items-start gap-3 rounded-lg bg-accent px-4 py-3 text-base text-accent-foreground">
          <Lock className="mt-0.5 size-6 shrink-0" aria-hidden />
          <span>
            Ngày {viDate(phien.productionDate)} · xưởng {phien.workshop}{" "}
            <strong>đã chốt</strong> — ghi thêm là <strong>ghi bù</strong>, bắt
            buộc lý do.
          </span>
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <DateField
          label="Ngày ghi sổ"
          required
          info="Ngày ghi vào hệ thống. Chọn ngày này thì ngày SX tự nhảy theo (tới khi bạn tự sửa)."
          value={phien.postingDate}
          onChange={doiNgayGhiSo}
        />
        <DateField
          label="Ngày sản xuất"
          required
          info="Ngày làm ra thật — mọi tổng hợp tính theo ngày này. Sửa tay khi làm hôm khác (ghi bù)."
          value={phien.productionDate}
          onChange={doiNgaySX}
        />
      </div>

      {canLyDoPhien && (
        <Field label="Lý do ghi bù" required hint="VD: cuối ca mới cân xong.">
          <Input
            value={phien.backdateReason}
            onChange={(e) => datPhien("backdateReason", e.target.value)}
            placeholder="Vì sao ghi sau ngày SX?"
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

      <div className="border-t-2 border-border pt-1" />

      {/* Bảng thành phẩm — nhập cả phiên một lượt, lưu một lần */}
      <div className="space-y-4 rounded-xl border-2 border-primary/40 bg-accent/40 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-base font-semibold">Thành phẩm làm ra trong ngày</p>
          <p className="text-sm text-muted-foreground">
            Gõ thẳng thành phẩm + kg vào bảng — dòng trống kế tiếp tự hiện. Đặt
            kiểu chế biến / khách ở đầu mỗi nhóm. Bấm ▸ đầu dòng để tách râu + bao tử.
          </p>
        </div>

        <BangDongSX
          dong={dongBang}
          matHang={matHang}
          onSua={capNhatDong}
          onBo={boDong}
          onThemDong={themDong}
          onThemNhom={themNhom}
          onDoiNhom={doiNhom}
          onTaoMatHang={themMatHang}
          optKhach={optKhach}
          onTaoKhach={themKhach}
        />

        {dongHopLe.length > 0 && (
          <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1">
            <span className="text-base text-muted-foreground">
              {dongHopLe.length} thành phẩm · phiên này
            </span>
            <span className="tnum text-lg font-semibold">{kg(tongPhien)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-base text-muted-foreground">
          Tổng ngày {viDate(phien.productionDate)} · xưởng {phien.workshop}:{" "}
          <span className="tnum text-xl font-semibold text-foreground">
            {kg(
              rows
                .filter(
                  (r) =>
                    r.productionDate === phien.productionDate &&
                    r.workshop === phien.workshop
                )
                .reduce((s, r) => s + (r.quantityKg || 0), 0) + tongPhien
            )}
          </span>
        </span>
        <Button size="lg" onClick={xongPhien} className="w-full sm:w-auto">
          <Plus />
          Lưu vào sổ
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Sản xuất thành phẩm
          </h1>
        </div>
        {/* Tách rõ NHẬP với TRA CỨU: một màn làm một việc. */}
        <div className="flex w-full overflow-hidden rounded-xl border-2 border-border sm:w-auto">
          <button
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
            type="button"
            onClick={() => setCheDo("so")}
            className={cn(
              "flex-1 border-l-2 border-border px-4 py-2.5 text-base font-semibold transition-colors sm:flex-none",
              cheDo === "so"
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            📖 Sổ ngày & báo cáo
          </button>
        </div>
      </div>

      <DailyTaskReminder
        daChot={daChotSXHomNay}
        viec={`thành phẩm làm ra hôm nay — xưởng ${xuongGhi}`}
      />

      {cheDo === "nhap" && formGhi}

      {cheDo === "so" && (
        <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="lg" onClick={() => setInPhieuTrong(true)}>
          <Printer />
          In phiếu trống
        </Button>
      </div>
      <ThongKe
        className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        the={[
          { nhan: "Đang xem", giaTri: moTaPhamVi, icon: CalendarRange, mau: "trung-tinh" },
          { nhan: "Phân xưởng", giaTri: phanXuong, icon: Warehouse, mau: "trung-tinh" },
          { nhan: "Số dòng", giaTri: view.length, so: true, icon: ClipboardList, mau: "brand" },
          { nhan: "Chờ nhập kho", giaTri: soChoNhap, so: true, icon: Hourglass, mau: "warning" },
          { nhan: "Tổng sản lượng", giaTri: kg(tong), so: true, icon: Scale, mau: "success" },
        ]}
      />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-border p-4">
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
              label="Khoảng ngày sản xuất"
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
              label="Ngày sản xuất"
              anNhanBatBuoc
              hint={
                ky === "ngay"
                  ? undefined
                  : `Kỳ: ${viDate(tuHieuLuc)} – ${viDate(denHieuLuc)}`
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
      </div>

      {dangTai ? (
        <SkeletonBang />
      ) : view.length === 0 ? (
        <EmptyState
          icon={Factory}
          tieuDe={`Chưa ghi thành phẩm trong ${moTaPhamVi}`}
          moTa={`Phân xưởng ${phanXuong}. Chuyển sang "Ghi nhập" để ghi.`}
          action={
            <Button size="lg" onClick={() => setCheDo("nhap")}>
              <Plus />
              Sang Ghi nhập
            </Button>
          }
        />
      ) : (
        <>
          <RecordTable
            columns={cols}
            rows={view}
            getKey={(r) => r.id}
            timKiem={(r) => `${tenMH(r.productId)} ${r.customerName ?? ""}`}
            nhanTimKiem="Tìm theo thành phẩm / khách…"
            actions={(r) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => moSua(r)}>
                  <Pencil />
                  Sửa
                </Button>
                <Button variant="outline" size="sm" onClick={() => xoa(r)}>
                  Bỏ
                </Button>
              </div>
            )}
          />
          <div className="flex flex-wrap justify-end gap-x-10 gap-y-2 rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">Tổng block</span>
              <span className="tnum text-xl font-semibold">{num(tongBlock)}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">
                Tổng sản lượng
              </span>
              <span className="tnum text-xl font-semibold">{kg(tong)}</span>
            </div>
          </div>
        </>
      )}
        </>
      )}

      {xemMotNgayMotXuong && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border-2 border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {dangKhoa ? (
              <Lock className="size-6 shrink-0 text-primary" aria-hidden />
            ) : (
              <LockOpen className="size-6 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="text-lg font-semibold text-foreground">
              {dangKhoa ? "Đã chốt" : "Chưa chốt"} {viDate(tuHieuLuc)} · xưởng {xuong}
            </span>
            <span className="text-base text-muted-foreground">
              Tổng{" "}
              <span className="tnum font-semibold text-foreground">
                {kg(tongThucTe)}
              </span>
            </span>
            {lechSauChot !== 0 && (
              <span className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-base text-accent-foreground">
                <TriangleAlert className="size-5 shrink-0" aria-hidden />
                Còn ghi bù {lechSauChot > 0 ? "+" : ""}
                {num(lechSauChot)} kg sau chốt
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
            <Button
              size="lg"
              onClick={() => {
                setGhiChuChot(chotHienTai?.note ?? "");
                const lb = chotHienTai?.leftoverByMaterial ?? {};
                setConDo(
                  Object.entries(lb).map(([ten, v]) => ({
                    id: uid(),
                    ten,
                    kg: Number(v) || null,
                  }))
                );
                setHoiChot(true);
              }}
            >
              <Lock />
              Chốt ngày
            </Button>
          )}
        </div>
      )}

      {/* A4 — Báo cáo công việc ngày: gom theo (xưởng × người thao tác) + Gửi lên
          hệ thống (lưu vết audit), TÁCH khỏi "Chốt ngày" (khoá sửa). */}
      {view.length > 0 && (
        <div className="space-y-3 rounded-xl border-2 border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Users className="size-icon shrink-0" aria-hidden />
                Báo cáo công việc ngày
              </h2>
              <p className="text-sm text-muted-foreground">
                Gom theo xưởng × người thao tác cho {moTaPhamVi} · {phanXuong}.
                <b> Gửi</b> báo lên hệ thống (lưu vết) — khác với <b>Chốt ngày</b>{" "}
                (khoá sửa).
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button onClick={guiBaoCao}>
                <Send />
                Gửi báo cáo lên hệ thống
              </Button>
              {daGui[baoCaoKey] && (
                <span className="text-sm text-success">
                  Đã gửi lúc {daGui[baoCaoKey]}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-base">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-3 py-2 font-semibold">Xưởng</th>
                  <th className="px-3 py-2 font-semibold">Người thao tác</th>
                  <th className="px-3 py-2 text-right font-semibold">Số dòng</th>
                  <th className="px-3 py-2 text-right font-semibold">Tổng kg</th>
                </tr>
              </thead>
              <tbody>
                {baoCaoNguoi.map((b) => (
                  <tr key={`${b.workshop}·${b.operator}`} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">{b.workshop}</td>
                    <td className="px-3 py-2">{b.operator}</td>
                    <td className="tnum px-3 py-2 text-right">{num(b.soDong)}</td>
                    <td className="tnum px-3 py-2 text-right font-semibold">{kg(b.kg)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2" colSpan={2}>
                    Tổng cộng
                  </td>
                  <td className="tnum px-3 py-2 text-right">{num(view.length)}</td>
                  <td className="tnum px-3 py-2 text-right">{kg(tong)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Form ghi thành phẩm đã chuyển INLINE (chế độ "Ghi nhập" — biến formGhi ở trên). */}

      {/* Dialog sửa một dòng */}
      <Dialog open={sua !== null} onOpenChange={(o) => !o && setSua(null)}>
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sửa dòng thành phẩm</DialogTitle>
          </DialogHeader>
          {sua && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loiSua} />
              <ChuThichBatBuoc />
              <div className="grid gap-6 sm:grid-cols-2">
                <DateField
                  label="Ngày ghi sổ"
                  required
                  value={sua.postingDate || sua.productionDate}
                  onChange={(v) => datSua({ postingDate: v })}
                />
                <DateField
                  label="Ngày sản xuất"
                  required
                  value={sua.productionDate}
                  onChange={(v) => datSua({ productionDate: v })}
                />
              </div>
              <Combobox
                label="Phân xưởng"
                required
                choPhepXoa={false}
                value={sua.workshop}
                onChange={(v) => datSua({ workshop: v as Workshop })}
                options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
              />
              <Combobox
                label="Thành phẩm"
                required
                value={sua.productId}
                onChange={(v) => datSua({ productId: v })}
                options={optMatHang}
                onCreate={(ten) => themMatHang(ten)}
                emptyText="Chưa có thành phẩm — gõ tên rồi Thêm mới."
              />
              <Combobox
                label="Khách hàng"
                value={sua.customerName ?? ""}
                onChange={(v) => datSua({ customerName: v })}
                options={optKhach}
                onCreate={(ten) => themKhach(ten)}
                placeholder="Chọn khách hàng (nếu có)"
                emptyText="Chưa có khách — gõ tên rồi Thêm mới."
              />

              {suaTach ? (
                <Field label="Số lượng (tổng râu + bao tử)">
                  <div className="tnum flex h-10 items-center rounded-md bg-muted px-3 text-base font-semibold">
                    {num(suaTong)} kg
                  </div>
                </Field>
              ) : (
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={sua.quantityKg || null}
                  onChange={(v) => datSua({ quantityKg: v ?? 0 })}
                />
              )}

              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-sm text-muted-foreground">
                  Tách râu + bao tử (cùng giá) — bỏ trống nếu không tách. Nhập
                  vào thì Số lượng = tổng hai ô.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    label="Râu"
                    unit="kg"
                    value={sua.componentRauKg ?? null}
                    onChange={(v) => datSua({ componentRauKg: v ?? 0 })}
                  />
                  <NumberField
                    label="Bao tử"
                    unit="kg"
                    value={sua.componentBaoTuKg ?? null}
                    onChange={(v) => datSua({ componentBaoTuKg: v ?? 0 })}
                  />
                </div>
              </div>

              <NumberField
                label="Số block"
                unit="block"
                value={sua.blocksCount || null}
                onChange={(v) => datSua({ blocksCount: v ?? 0 })}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setSua(null)}>
              Hủy
            </Button>
            <Button size="lg" onClick={luuSua}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog chốt ngày */}
      <Dialog open={hoiChot} onOpenChange={setHoiChot}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Chốt ngày sản xuất</DialogTitle>
            <DialogDescription className="text-base">
              Khoá {viDate(tuHieuLuc)} · xưởng {xuong} — tổng {kg(tongThucTe)}. Ghi
              thêm sau khi chốt phải ghi bù.
            </DialogDescription>
          </DialogHeader>
          <Field label="Ghi chú chốt">
            <Input
              value={ghiChuChot}
              onChange={(e) => setGhiChuChot(e.target.value)}
              placeholder="Ghi chú (nếu có)"
            />
          </Field>

          {/* Còn dở cuối ngày (khép vòng G1): NL chưa chế biến hết đem lưu kho →
              sổ Tồn kho NL cộng vào "đông gửi" kỳ tương ứng. Tách theo loại NL. */}
          <div className="min-w-0 space-y-2 rounded-lg border-2 border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-foreground">
                Nguyên liệu còn dở đem lưu kho
              </p>
              {tongConDoNhap > 0 && (
                <span className="tnum text-base font-semibold text-primary">
                  {kg(tongConDoNhap)}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              NL chưa chế biến hết trong ngày, đem cấp đông lưu kho. Ghi ở đây để
              sổ Tồn kho NL cộng vào <b>đông gửi</b> — bỏ trống nếu không còn dở.
            </p>
            {conDo.length > 0 && (
              <div className="space-y-2">
                {conDo.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-0 flex-1 basis-40">
                      <Combobox
                        label="Loại nguyên liệu"
                        anNhan
                        value={d.ten}
                        onChange={(v) =>
                          setConDo((rs) =>
                            rs.map((x) => (x.id === d.id ? { ...x, ten: v } : x))
                          )
                        }
                        options={loaiNL.map((l) => ({
                          value: l.name,
                          label: l.name,
                          phu: l.category || undefined,
                        }))}
                        onCreate={(ten) => {
                          setLoaiNL([
                            ...loaiNL,
                            { id: uid(), name: ten, category: "", note: "" },
                          ]);
                          return ten;
                        }}
                        placeholder="— Chọn loại NL —"
                      />
                    </div>
                    <div className="w-28 shrink-0">
                      <NumberField
                        label="Kg còn dở"
                        anNhan
                        unit="kg"
                        value={d.kg}
                        onChange={(v) =>
                          setConDo((rs) =>
                            rs.map((x) => (x.id === d.id ? { ...x, kg: v } : x))
                          )
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      aria-label="Xóa dòng còn dở"
                      onClick={() =>
                        setConDo((rs) => rs.filter((x) => x.id !== d.id))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setConDo((rs) => [...rs, { id: uid(), ten: "", kg: null }])
              }
            >
              <Plus />
              Thêm loại còn dở
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setHoiChot(false)}>
              Hủy
            </Button>
            <Button size="lg" onClick={chotNgay}>
              <Lock />
              Chốt ngày
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog mở lại ngày */}
      <Dialog open={hoiMoLai} onOpenChange={setHoiMoLai}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Mở lại ngày đã chốt</DialogTitle>
            <DialogDescription className="text-base">
              {viDate(tuHieuLuc)} · xưởng {xuong}. Sửa xong nhớ chốt lại.
            </DialogDescription>
          </DialogHeader>
          <ErrorSummary loi={loiChot} />
          <ChuThichBatBuoc />
          <Field label="Lý do mở lại" required>
            <Input
              value={lyDoMoLai}
              onChange={(e) => setLyDoMoLai(e.target.value)}
              placeholder="Vì sao mở lại ngày đã chốt?"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setHoiMoLai(false)}>
              Hủy
            </Button>
            <Button size="lg" onClick={moLaiNgay}>
              <LockOpen />
              Mở lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {inPhieuTrong && (
        <PhieuTrongTPNgay onClose={() => setInPhieuTrong(false)} />
      )}
    </div>
  );
}

/* ---------- Bảng thành phẩm của một phiên (nhập nhiều dòng một lượt) ---------- */

/**
 * BẢNG nhập NHÓM THEO LOÀI: mỗi loài một cụm (Bạch tuộc, Mực, Cá…), dưới là bảng
 * thành phẩm của loài đó (cột ngang kiểu bảng tính, nhãn đi bằng tiêu đề cột).
 * Gom theo LOÀI vì loài có sẵn trên mọi mặt hàng (141 mã seed) và gộp lớn/nhỏ tự
 * nhiên — "Bạch tuộc 2 da lớn/nhỏ" đều là loài Bạch tuộc. Mã có cờ "tách râu/bao
 * tử" (Danh mục) mới hiện mũi tên đầu dòng để mở ô râu + bao tử. Mã có "quy cách
 * block" thì nhập số block tự tính kg gợi ý. Thêm nhóm bằng ô "Thêm loài" ở cuối.
 */
function BangDongSX({
  dong,
  matHang,
  onSua,
  onBo,
  onThemDong,
  onThemNhom,
  onDoiNhom,
  onTaoMatHang,
  optKhach,
  onTaoKhach,
}: {
  dong: DongSX[];
  matHang: Product[];
  onSua: (key: string, patch: Partial<DongSX>) => void;
  onBo: (key: string) => void;
  onThemDong: (
    groupId: string,
    processingType: string,
    customerName: string
  ) => void;
  onThemNhom: (processingType?: string, customerName?: string) => void;
  onDoiNhom: (
    groupId: string,
    patch: Partial<Pick<DongSX, "processingType" | "customerName">>
  ) => void;
  onTaoMatHang: (ten: string, processingType: string) => string;
  optKhach: MucChon[];
  onTaoKhach: (ten: string) => string;
}) {
  const th =
    "border-b-2 border-border bg-card px-2 py-2 text-left text-sm font-semibold whitespace-nowrap";
  const td = "border-b border-border px-2 py-2 align-middle";

  // Nhóm theo groupId ỔN ĐỊNH (giữ thứ tự xuất hiện) — sửa nhãn không remount.
  const nhomKeys: string[] = [];
  const nhomRows = new Map<string, DongSX[]>();
  for (const d of dong) {
    if (!nhomRows.has(d.groupId)) {
      nhomRows.set(d.groupId, []);
      nhomKeys.push(d.groupId);
    }
    nhomRows.get(d.groupId)!.push(d);
  }

  // Gợi ý kiểu chế biến = các giá trị đã có trên mặt hàng (thêm mới tại chỗ được).
  const optCheBien: MucChon[] = [
    ...new Set(
      matHang.map((m) => (m.processingType || "").trim()).filter(Boolean)
    ),
  ]
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((v) => ({ value: v, label: v }));

  // Mọi mặt hàng (gõ tên để tìm) — không giới hạn theo loài.
  const optMatHangTatCa: MucChon[] = matHang.map((m) => ({
    value: m.id,
    label: m.code ? `${m.code} · ${m.name}` : m.name,
    phu: [m.code, m.processingType, m.category].filter(Boolean).join(" · ") || undefined,
  }));

  return (
    <div className="space-y-4">
      {nhomKeys.map((gid) => {
        const rows = nhomRows.get(gid)!;
        const info = { pt: rows[0].processingType, cust: rows[0].customerName };
        const soThat = rows.filter((d) => !dongTrong(d)).length;
        return (
          <div
            key={gid}
            className="overflow-hidden rounded-lg border-2 border-border"
          >
            {/* Đầu nhóm SỬA ĐƯỢC tại chỗ: kiểu chế biến × khách — cập nhật mọi dòng
                cùng groupId (nhãn vẫn lưu theo từng dòng khi Lưu vào sổ). */}
            <div className="flex flex-wrap items-end gap-3 bg-muted px-3 py-2.5">
              <div className="min-w-[10rem] flex-1">
                <Combobox
                  label="Kiểu chế biến"
                  value={info.pt}
                  onChange={(v) => onDoiNhom(gid, { processingType: v })}
                  options={optCheBien}
                  onCreate={(ten) => ten}
                  placeholder="VD: 2 da chần, luộc…"
                  emptyText="Chưa có — gõ tên rồi Thêm mới."
                />
              </div>
              <div className="min-w-[10rem] flex-1">
                <Combobox
                  label="Khách hàng"
                  value={info.cust}
                  onChange={(v) => onDoiNhom(gid, { customerName: v })}
                  options={optKhach}
                  onCreate={(ten) => onTaoKhach(ten)}
                  placeholder="VD: Peacock…"
                  emptyText="Chưa có — gõ tên rồi Thêm mới."
                />
              </div>
              <span className="pb-2.5 text-sm text-muted-foreground">
                {soThat} thành phẩm
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={`${th} w-10`} aria-label="Mở tách" />
                    <th className={`${th} min-w-[13rem]`}>
                      Thành phẩm <span className="text-destructive">*</span>
                    </th>
                    <th className={`${th} min-w-[8.5rem]`}>
                      Số lượng (kg) <span className="text-destructive">*</span>
                    </th>
                    <th className={`${th} min-w-[13rem]`}>
                      Số block × quy cách
                    </th>
                    <th className={`${th} w-12`} aria-label="Bỏ dòng" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    // Mũi tên tách hiện ở MỌI dòng; tách "tính" khi đã nhập
                    // râu/bao tử. Mã đánh dấu "Có tách" chỉ để tự mở sẵn.
                    const tach = laTach(d);
                    return (
                      <Fragment key={d.key}>
                        <tr>
                          <td className={`${td} text-center`}>
                            <button
                              type="button"
                              onClick={() => onSua(d.key, { moRong: !d.moRong })}
                              aria-expanded={d.moRong}
                              aria-label="Mở/đóng ô râu + bao tử"
                              title="Tách râu + bao tử (cùng giá)"
                              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                            >
                              <ChevronDown
                                className={`size-5 transition-transform ${d.moRong ? "" : "-rotate-90"}`}
                                aria-hidden
                              />
                            </button>
                          </td>
                          <td className={td}>
                            <Combobox
                              anNhan
                              label="Thành phẩm"
                              required
                              value={d.productId}
                              onChange={(v) => {
                                const p = matHang.find((m) => m.id === v);
                                onSua(d.key, {
                                  productId: v,
                                  // Mã đánh dấu "Có tách" → tự mở ô tách.
                                  moRong: laCoTach(p) ? true : d.moRong,
                                  // Có quy cách đã gắn ở mặt hàng → tự điền kg/khối.
                                  blockSpecKg: quyCachBlock(p) ?? d.blockSpecKg,
                                });
                              }}
                              options={optMatHangTatCa}
                              onCreate={(ten) => onTaoMatHang(ten, info.pt)}
                              emptyText="Chưa có mặt hàng — gõ tên rồi Thêm mới."
                            />
                          </td>
                          <td className={td}>
                            {tach ? (
                              <div
                                className="tnum flex h-10 items-center rounded-md bg-muted px-3 font-semibold"
                                title="Tổng = râu + bao tử"
                              >
                                {num(tongDong(d))}
                              </div>
                            ) : (
                              <NumberField
                                anNhan
                                label="Số lượng"
                                required
                                unit="kg"
                                value={d.quantityKg || null}
                                onChange={(v) =>
                                  onSua(d.key, { quantityKg: v ?? 0 })
                                }
                              />
                            )}
                          </td>
                          <td className={td}>
                            <div className="flex items-center gap-1.5">
                              <NumberField
                                anNhan
                                anNhanBatBuoc
                                label="Số block"
                                unit="block"
                                className="min-w-[5.5rem] flex-1"
                                value={d.blocksCount || null}
                                onChange={(v) => {
                                  const b = v ?? 0;
                                  const s = d.blockSpecKg || 0;
                                  // Có quy cách & chưa tách → tự tính kg = block × quy cách.
                                  onSua(
                                    d.key,
                                    s > 0 && !tach
                                      ? { blocksCount: b, quantityKg: b * s }
                                      : { blocksCount: b }
                                  );
                                }}
                              />
                              <span className="text-sm text-muted-foreground">
                                ×
                              </span>
                              <NumberField
                                anNhan
                                anNhanBatBuoc
                                label="Quy cách kg/khối"
                                unit="kg/khối"
                                className="min-w-[6rem] flex-1"
                                value={d.blockSpecKg || null}
                                onChange={(v) => {
                                  const s = v ?? 0;
                                  const b = d.blocksCount || 0;
                                  onSua(
                                    d.key,
                                    b > 0 && s > 0 && !tach
                                      ? { blockSpecKg: s, quantityKg: b * s }
                                      : { blockSpecKg: s }
                                  );
                                }}
                              />
                            </div>
                          </td>
                          <td className={`${td} text-center`}>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label="Bỏ dòng"
                              onClick={() => onBo(d.key)}
                            >
                              <X />
                            </Button>
                          </td>
                        </tr>

                        {d.moRong && (
                          <tr className="bg-accent/30">
                            <td className="border-b border-border" />
                            <td
                              className="border-b border-border px-2 pb-3"
                              colSpan={4}
                            >
                              <p className="mb-2 text-sm text-muted-foreground">
                                Tách râu + bao tử (cùng giá) — Số lượng = tổng
                                hai ô.
                              </p>
                              <div className="flex flex-wrap items-end gap-4">
                                <NumberField
                                  label="Râu"
                                  unit="kg"
                                  className="min-w-[8rem] flex-1"
                                  value={d.rauKg || null}
                                  onChange={(v) =>
                                    onSua(d.key, { rauKg: v ?? 0 })
                                  }
                                />
                                <NumberField
                                  label="Bao tử"
                                  unit="kg"
                                  className="min-w-[8rem] flex-1"
                                  value={d.baoTuKg || null}
                                  onChange={(v) =>
                                    onSua(d.key, { baoTuKg: v ?? 0 })
                                  }
                                />
                                <div className="pb-2 text-base text-muted-foreground">
                                  Tổng ={" "}
                                  <span className="tnum font-semibold text-foreground">
                                    {num(tongDong(d))}
                                  </span>{" "}
                                  kg
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-2">
              <Button
                type="button"
                variant="outline"
                className="border-dashed"
                onClick={() => onThemDong(gid, info.pt, info.cust)}
              >
                <Plus />
                Thêm thành phẩm
              </Button>
            </div>
          </div>
        );
      })}

      {/* Thêm NHÓM mới — nhãn kiểu chế biến × khách đặt ngay ở đầu nhóm sau khi thêm */}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed sm:w-auto"
        onClick={() => onThemNhom()}
      >
        <Plus />
        Thêm nhóm (kiểu chế biến × khách)
      </Button>
    </div>
  );
}
