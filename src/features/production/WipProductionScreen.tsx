// ============================================================
// Tên file: src/features/production/WipProductionScreen.tsx
// Tên tiếng Việt: Màn hình Ghi Thành Phẩm ngày (sản xuất)
// Description: Daily finished-goods production entry (v1: product · qty · customer)
// ============================================================
import { useEffect, useMemo, useState } from "react";
import type {
  DailyLock,
  DomesticSaleItem,
  WipProductionItem,
  Product,
  Workshop,
} from "@/types";
import { isBackdatedWip, laCoTach, quyCachBlock } from "@/types";
import { newId } from "@/lib/store";
import { uid } from "@/lib/db";
import {
  useBatterTypes,
  useDomesticSales,
  useProductionLocks,
  useProducts,
  useWipProductions,
  useCustomers,
  useMaterialTypes,
  useLotInputs,
} from "@/lib/catalogRepo";
import {
  botDiKemIds,
  congBotTheoLoai,
  lamSachBot,
  laMatHangTamBot,
  nhanBotNgan,
  taoHoacLayBot,
  tenBotDiKem,
  tongBot,
} from "@/lib/botTam";
import {
  ChuThichBatBuoc,
  Button,
  ConfirmDelete,
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
  Nhan,
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
import { DailyTaskReminder, GanLoDauVao, PhieuTrongTPNgay, TemLoQr } from "@/features/shared";
import { useSuaDanhMuc } from "@/features/catalog/SuaDanhMucNhanh";
import { nhanLoBtp, nutLo } from "@/lib/truyXuatLo";
import {
  CalendarRange,
  ClipboardList,
  Factory,
  Hourglass,
  Link2,
  QrCode,
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
  Wheat,
  Store,
} from "lucide-react";
import { BangDongSX } from "./BangDongSX";
import { KhoiBotTam } from "./KhoiBotTam";
import { KhoiBanNoiDia } from "./KhoiBanNoiDia";
import {
  PHAN_XUONG,
  banNoiDiaDayDu,
  banNoiDiaTrong,
  dongBanNoiDiaRong,
  dongDayDu,
  dongSXRong,
  dongTrong,
  laTach,
  tongDong,
  type DauPhien,
  type DongBanNoiDia,
  type DongSX,
} from "./wipHelpers";

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

export default function SanXuatBTPScreen() {
  const [rows, persist, { trangThai }] = useWipProductions();
  const dangTai = trangThai === "dang-tai" && rows.length === 0;
  const [chot, persistChot] = useProductionLocks();
  const [matHang, setMatHang] = useProducts();
  const [khach, setKhach] = useCustomers();
  const [loaiNL, setLoaiNL] = useMaterialTypes();
  const [botTam, setBotTam] = useBatterTypes();
  /** Sổ BÁN NỘI ĐỊA (mig 0054) — NL bán thẳng, sổ riêng (không lẫn sản lượng TP). */
  const [banNoiDia, persistBanNoiDia] = useDomesticSales();

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
  /** Dòng bán nội địa của phiên đang gõ — mặc định trống, bấm "Thêm dòng" mới hiện. */
  const [dongBND, setDongBND] = useState<DongBanNoiDia[]>([]);
  const [loiPhien, setLoiPhien] = useState<LoiNhap[]>([]);
  /** Nhóm (kiểu chế biến × khách) của phiên trước → phiếu mới tự điền sẵn nhóm
   *  đầu, gõ thành phẩm ngay, khỏi tạo nhóm lại. Chỉ sống trong phiên làm việc. */
  const [nhomGanNhat, setNhomGanNhat] = useState<{ pt: string; cust: string }>({
    pt: "",
    cust: "",
  });

  /* Sửa một dòng đã ghi (từ bảng sổ). */
  const [sua, setSua] = useState<WipProductionItem | null>(null);
  /* Sửa một dòng BÁN NỘI ĐỊA đã ghi. */
  const [suaBND, setSuaBND] = useState<DomesticSaleItem | null>(null);
  const [loiSuaBND, setLoiSuaBND] = useState<LoiNhap[]>([]);
  const [loiSua, setLoiSua] = useState<LoiNhap[]>([]);
  /** Dòng đang sửa có tách không = đã nhập râu/bao tử (ô tách luôn có sẵn). */
  const suaTach =
    (sua?.componentRauKg ?? 0) > 0 || (sua?.componentBaoTuKg ?? 0) > 0;

  /** Hai chế độ: "nhap" = form ghi (mặc định, form-first cho tổ xưởng); "so" = sổ + báo cáo. */
  const [cheDo, setCheDo] = useState<"nhap" | "so">("nhap");
  const [inPhieuTrong, setInPhieuTrong] = useState(false);
  // Truy xuất lô (docs/spec/qr-truy-xuat-lo.md): gắn lô NL cho mẻ + in tem lô BTP.
  const [lotInputs] = useLotInputs();
  const [ganLo, setGanLo] = useState<WipProductionItem | null>(null);
  const [temLo, setTemLo] = useState<WipProductionItem[] | null>(null);
  const soLoGan = (id: string) => lotInputs.filter((l) => l.outputKind === "W" && l.outputId === id).length;

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

  /** Sửa nhanh thành phẩm ngay tại màn (ghi thẳng Danh mục mặt hàng). */
  const suaMH = useSuaDanhMuc("matHang", matHang, setMatHang, {
    // Ô "Bột đi kèm" trong hộp sửa thấy + tạo loại bột qua đúng danh mục của màn.
    nguonBot: { rows: botTam, them: (ten) => themBotBanGhi(ten).id },
    moTa: (m) => {
      const n = rows.filter((r) => r.productId === m.id).length;
      return n > 0
        ? `Sửa ở đây là sửa trong Danh mục — ${n} dòng sản lượng đã ghi với thành phẩm này sẽ hiện theo thông tin mới.`
        : "Sửa ở đây là sửa trong Danh mục — áp cho mọi màn dùng thành phẩm này.";
    },
    // Dòng đang gõ dở cũng ăn theo cờ tách / quy cách mới — trừ dòng mà người
    // dùng đã tự gõ quy cách khác với quy cách cũ của thành phẩm.
    onDaLuu: (p, cu) => {
      const qcCu = quyCachBlock(cu) ?? 0;
      setDongBang((ds) =>
        ds.map((d) =>
          d.productId === p.id
            ? {
                ...d,
                moRong: laCoTach(p) ? true : d.moRong,
                blockSpecKg:
                  !d.blockSpecKg || d.blockSpecKg === qcCu
                    ? quyCachBlock(p) ?? d.blockSpecKg
                    : d.blockSpecKg,
              }
            : d
        )
      );
    },
  });
  const moSuaTP = suaMH.moSua;
  /** Ô khách ở /wip lưu theo TÊN (customerName). */
  const suaKH = useSuaDanhMuc("khachHang", khach, setKhach, { theo: "ten" });
  const suaNL = useSuaDanhMuc("loaiNL", loaiNL, setLoaiNL, { theo: "ten" });

  const themKhach = (ten: string): string => {
    setKhach([...khach, { id: uid(), code: "", name: ten, market: "" }]);
    notify.daLuu(`Đã thêm khách hàng "${ten}"`);
    return ten;
  };

  /* ---- Ô chọn danh mục cho khối Bán nội địa: value = TÊN, thêm mới + bút chì ---- */
  const themLoaiNLTen = (ten: string): string => {
    const sach = ten.trim();
    const co = loaiNL.find((l) => l.name.trim().toLowerCase() === sach.toLowerCase());
    if (co) return co.name;
    setLoaiNL([...loaiNL, { id: uid(), name: sach, category: "", note: "" }]);
    notify.daLuu(`Đã thêm loại nguyên liệu "${sach}"`);
    return sach;
  };
  const oLoaiNL = {
    options: loaiNL.map((l) => ({ value: l.name, label: l.name, phu: l.category || undefined })),
    onCreate: themLoaiNLTen,
    onSuaMuc: suaNL.moSua,
    suaDuoc: suaNL.suaDuoc,
    nhanSua: suaNL.nhanSua,
  };
  const oKhach = {
    options: optKhach,
    onCreate: themKhach,
    onSuaMuc: suaKH.moSua,
    suaDuoc: suaKH.suaDuoc,
    nhanSua: suaKH.nhanSua,
  };

  /* ---- Bột tẩm (mig 0051): danh mục loại bột — dòng sản lượng lưu theo TÊN ---- */
  const optBot: MucChon[] = botTam.map((b) => ({
    value: b.name,
    label: b.name,
    phu: [b.code && `Mã ${b.code}`, b.note].filter(Boolean).join(" · ") || undefined,
  }));
  /** Tạo loại bột tại chỗ (trùng tên ⇒ dùng lại loại có sẵn). Trả về bản ghi. */
  const themBotBanGhi = (ten: string) => {
    const kq = taoHoacLayBot(botTam, ten);
    if (kq.moi) {
      setBotTam(kq.rows);
      notify.daLuu(`Đã thêm loại bột "${kq.bot.name}" vào danh mục`);
    }
    return kq.bot;
  };
  const themBot = (ten: string): string => themBotBanGhi(ten).name;
  const suaBot = useSuaDanhMuc("botTam", botTam, setBotTam, { theo: "ten" });
  /** Tên bột đi kèm của một mặt hàng (theo danh mục bột hiện có). */
  const diKemCua = (productId: string) =>
    tenBotDiKem(
      matHang.find((m) => m.id === productId),
      botTam
    );
  /** "24V 12 · 18V 30" — nhãn gọn cho ô hẹp. */
  const moTaBot = (m: Record<string, number> | undefined) =>
    Object.entries(lamSachBot(m))
      .map(([ten, v]) => `${nhanBotNgan(ten)} ${num(v)}`)
      .join(" · ");

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
  /** Bột tẩm đã dùng trong phạm vi đang xem, cộng theo loại (mig 0051). */
  const botTheoLoai = useMemo(() => congBotTheoLoai(view.map((r) => r.batterKg)), [view]);
  const tongBotView = botTheoLoai.reduce((s, b) => s + b.kg, 0);
  /** Bán nội địa (mig 0054) trong phạm vi đang xem — sổ riêng, không vào tổng sản lượng. */
  const bndView = useMemo(
    () =>
      banNoiDia
        .filter(
          (r) =>
            r.saleDate >= tuHieuLuc &&
            r.saleDate <= denHieuLuc &&
            (phanXuong === "Tất cả" || r.workshop === phanXuong)
        )
        .sort((a, b) => a.saleDate.localeCompare(b.saleDate) || a.id.localeCompare(b.id)),
    [banNoiDia, tuHieuLuc, denHieuLuc, phanXuong]
  );
  const tongBNDView = bndView.reduce((s, r) => s + (r.quantityKg || 0), 0);

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
  /** Mẻ của ngày đang chốt CHƯA gắn lô NL — nhắc khi chốt (không chặn: §7 câu 4 spec QR còn treo). */
  const meChuaGanLo = xemMotNgayMotXuong
    ? rows.filter((r) => r.productionDate === tuHieuLuc && r.workshop === xuong && !soLoGan(r.id))
    : [];
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
  // Chỉ bám ngày + xưởng (không bám cả phiếu) để gõ các ô khác không kéo bộ lọc.
  const ngayPhien = phien?.productionDate;
  const xuongPhien = phien?.workshop;
  useEffect(() => {
    if (cheDo === "nhap" && ngayPhien !== undefined && xuongPhien !== undefined) {
      setKy("ngay");
      setNgay(ngayPhien);
      setPhanXuong(xuongPhien);
    }
  }, [cheDo, ngayPhien, xuongPhien]);

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
  const botPhien = dongHopLe.reduce((s, d) => s + tongBot(d.botKg), 0);
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
    const bndHopLe = dongBND.filter(banNoiDiaDayDu);
    const ls: LoiNhap[] = [...loiDauPhien(phien)];
    if (hopLe.length === 0 && bndHopLe.length === 0)
      ls.push({
        truong: "Thành phẩm",
        thongBao: "Thêm ít nhất một thành phẩm (hoặc một dòng bán nội địa) vào phiên",
      });
    if (!imLang)
      dongBND.forEach((d, i) => {
        if (!banNoiDiaTrong(d) && !banNoiDiaDayDu(d))
          ls.push({
            truong: `Bán nội địa dòng ${i + 1}`,
            thongBao: !d.materialTypeName.trim()
              ? "Chưa chọn loại nguyên liệu"
              : "Số lượng phải lớn hơn 0 kg",
          });
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
      batterKg: lamSachBot(d.botKg),
    }));
    if (moi.length > 0) persist([...rows, ...moi]);

    // Bán nội địa → sổ riêng (cùng ngày / xưởng / lý do ghi bù của phiên).
    const moiBND: DomesticSaleItem[] = bndHopLe.map((d) => ({
      id: newId(),
      saleDate: phien.productionDate,
      postingDate: phien.postingDate,
      backdateReason: phien.backdateReason,
      workshop: phien.workshop,
      materialTypeName: d.materialTypeName.trim(),
      quantityKg: d.quantityKg,
      unitPrice: d.unitPrice,
      customerName: d.customerName.trim(),
      note: "",
      operator: nguoiThaoTac,
    }));
    if (moiBND.length > 0) persistBanNoiDia([...banNoiDia, ...moiBND]);

    // Nhớ về MẶT HÀNG (đúng ý "gắn trên mặt hàng") — lần sau tự điền:
    //  - quy cách block (kg/khối) vừa nhập;
    //  - bộ BỘT ĐI KÈM: mã CHƯA gắn bột mà dòng có ghi bột ⇒ gắn các loại vừa dùng.
    //    Mã đã gắn thì KHÔNG đổi (bột nhập thêm tại chỗ chỉ là của dòng đó).
    // Gộp vào MỘT lần setMatHang — gọi hai lần sẽ lấy cùng `matHang` cũ, lần sau đè lần trước.
    const idBotTheoTen = new Map(botTam.map((b) => [b.name.trim(), b.id]));
    const vaMH = new Map<string, Partial<Product>>();
    for (const d of hopLe) {
      const p = matHang.find((m) => m.id === d.productId);
      if (!p) continue;
      const va: Partial<Product> = { ...vaMH.get(p.id) };
      if (d.blockSpecKg > 0 && quyCachBlock(p) !== d.blockSpecKg)
        va.blockSpecKg = d.blockSpecKg;
      const idsBot = Object.keys(lamSachBot(d.botKg))
        .map((ten) => idBotTheoTen.get(ten) ?? "")
        .filter(Boolean);
      if (botDiKemIds(p).length === 0 && idsBot.length > 0 && !va.batterIds)
        va.batterIds = idsBot;
      if (Object.keys(va).length > 0) vaMH.set(p.id, va);
    }
    if (vaMH.size > 0)
      setMatHang(matHang.map((m) => (vaMH.has(m.id) ? { ...m, ...vaMH.get(m.id) } : m)));

    const tongMoi = moi.reduce((s, r) => s + r.quantityKg, 0);
    const botMoi = moi.reduce((s, r) => s + tongBot(r.batterKg), 0);
    const bndMoi = moiBND.reduce((s, r) => s + r.quantityKg, 0);
    notify.daLuu(
      [
        moi.length > 0 && `Đã lưu ${moi.length} thành phẩm · ${kg(tongMoi)}`,
        botMoi > 0 && `bột tẩm ${kg(botMoi)}`,
        moiBND.length > 0 &&
          `${moi.length > 0 ? "bán nội địa" : "Đã lưu bán nội địa"} ${kg(bndMoi)}`,
      ]
        .filter(Boolean)
        .join(" · "),
      undefined,
      moi.length > 0
        ? {
            label: moi.length > 1 ? `In ${moi.length} tem` : "In tem",
            onClick: () => setTemLo(moi),
          }
        : undefined
    );

    const bg = banGhiChot(phien.productionDate, phien.workshop);
    if (bg?.isLocked && moi.length > 0)
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
    setDongBND([]);
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
      batterKg: lamSachBot(sua.batterKg),
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

  /* ---- Sửa / bỏ một dòng BÁN NỘI ĐỊA đã ghi ---- */
  const moSuaBND = (r: DomesticSaleItem) => {
    setSuaBND({ ...r });
    setLoiSuaBND([]);
  };
  const datSuaBND = (patch: Partial<DomesticSaleItem>) =>
    setSuaBND((d) => (d ? { ...d, ...patch } : d));
  const luuSuaBND = () => {
    if (!suaBND) return;
    const ls: LoiNhap[] = [];
    if (!suaBND.materialTypeName.trim())
      ls.push({ truong: "Loại nguyên liệu", thongBao: "Chưa chọn loại nguyên liệu" });
    if (!(suaBND.quantityKg > 0))
      ls.push({ truong: "Số lượng", thongBao: "Phải lớn hơn 0 kg" });
    setLoiSuaBND(ls);
    if (ls.length > 0) return;
    const banGhi: DomesticSaleItem = {
      ...suaBND,
      materialTypeName: suaBND.materialTypeName.trim(),
      customerName: suaBND.customerName.trim(),
    };
    persistBanNoiDia(banNoiDia.map((r) => (r.id === banGhi.id ? banGhi : r)));
    notify.daLuu("Đã lưu thay đổi bán nội địa");
    setSuaBND(null);
  };
  const xoaBND = (r: DomesticSaleItem) => {
    const truoc = banNoiDia;
    persistBanNoiDia(banNoiDia.filter((x) => x.id !== r.id));
    notify.daXoa(`Đã bỏ bán nội địa ${r.materialTypeName} — ${kg(r.quantityKg)}`, () =>
      persistBanNoiDia(truoc)
    );
  };
  const cotBND: Cot<DomesticSaleItem>[] = [
    {
      key: "ngay",
      header: "Ngày",
      render: (r) => viDate(r.saleDate),
      sapXep: (r) => r.saleDate,
    },
    {
      key: "loai",
      header: "Loại nguyên liệu",
      chinh: true,
      render: (r) => r.materialTypeName,
      sapXep: (r) => r.materialTypeName,
    },
    {
      key: "kg",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => num(r.quantityKg),
      sapXep: (r) => r.quantityKg,
    },
    {
      key: "gia",
      header: "Đơn giá (đ/kg)",
      so: true,
      render: (r) =>
        r.unitPrice != null ? num(r.unitPrice) : <span className="text-muted-foreground">—</span>,
      sapXep: (r) => r.unitPrice ?? 0,
    },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      anTrenDienThoai: true,
      render: (r) =>
        r.unitPrice != null ? (
          num(r.quantityKg * r.unitPrice)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sapXep: (r) => r.quantityKg * (r.unitPrice ?? 0),
    },
    {
      key: "kh",
      header: "Khách hàng",
      render: (r) => r.customerName || <span className="text-muted-foreground">—</span>,
      sapXep: (r) => r.customerName,
    },
    {
      key: "nguoi",
      header: "Người ghi",
      anTrenDienThoai: true,
      render: (r) => r.operator || <span className="text-muted-foreground">—</span>,
      sapXep: (r) => r.operator,
    },
  ];

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
        diff: {
          nguoiGui: nguoiThaoTac,
          tong,
          theoNguoi: baoCaoNguoi,
          botTam: botTheoLoai,
          banNoiDia: { kg: tongBNDView, soDong: bndView.length },
        },
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
      key: "bot",
      header: "Bột tẩm (kg)",
      anTrenDienThoai: true,
      render: (r) => {
        const t = tongBot(r.batterKg);
        return t > 0 ? (
          <span>
            <span className="tnum">{num(t)}</span>
            <span className="block text-sm text-muted-foreground">{moTaBot(r.batterKg)}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      sapXep: (r) => tongBot(r.batterKg),
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
          <Nhan loai="xong">
            Đã nhập kho{r.warehouse ? ` · ${r.warehouse}` : ""}
          </Nhan>
        ) : (
          <Nhan loai="cho">Chờ nhập kho</Nhan>
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
          onSuaMatHang={moSuaTP}
          onSuaKhach={suaKH.moSua}
          optKhach={optKhach}
          onTaoKhach={themKhach}
          botTam={botTam}
          optBot={optBot}
          onTaoBot={themBot}
          onSuaBot={suaBot.moSua}
        />

        {dongHopLe.length > 0 && (
          <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1">
            <span className="text-base text-muted-foreground">
              {dongHopLe.length} thành phẩm · phiên này
            </span>
            {botPhien > 0 && (
              <span className="text-base text-muted-foreground">
                Bột tẩm <span className="tnum font-semibold text-foreground">{kg(botPhien)}</span>
              </span>
            )}
            <span className="tnum text-lg font-semibold">{kg(tongPhien)}</span>
          </div>
        )}
      </div>

      {/* Bán nội địa (mig 0054): NL bán thẳng — sổ riêng, không cộng vào thành phẩm. */}
      <KhoiBanNoiDia
        dong={dongBND}
        onSua={(key, patch) =>
          setDongBND((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)))
        }
        onBo={(key) => setDongBND((ds) => ds.filter((d) => d.key !== key))}
        onThem={() => setDongBND((ds) => [...ds, dongBanNoiDiaRong(ds.at(-1)?.materialTypeName ?? "")])}
        loaiNL={oLoaiNL}
        khach={oKhach}
      />

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
        <Button
          title="Ghi toàn bộ sản lượng đang gõ vào sổ sản xuất của ngày và xưởng đang chọn." size="lg" onClick={xongPhien} className="w-full sm:w-auto">
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
            title="Sang chế độ Ghi nhập để gõ sản lượng thành phẩm."
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
            title="Xem sổ sản lượng đã ghi trong ngày và báo cáo theo xưởng, chốt ngày tại đây."
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
        <Button
          title="In tờ phiếu trống để ghi tay sản lượng ngoài xưởng, tối về nhập lại vào máy." variant="outline" size="lg" onClick={() => setInPhieuTrong(true)}>
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
            <Button
              title="Chuyển sang chế độ Ghi để nhập sản lượng cho ngày này." size="lg" onClick={() => setCheDo("nhap")}>
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
            toMau="san-xuat-tp"
            timKiem={(r) => `${tenMH(r.productId)} ${r.customerName ?? ""}`}
            nhanTimKiem="Tìm theo thành phẩm / khách…"
            actions={(r) => (
              <div className="flex flex-wrap gap-2">
                <Button
                  title="Ghi mẻ này đã dùng lô nguyên liệu nào (quét tem, gõ mã, hoặc chọn). Có lô thì mới truy được nguồn của mẻ."
                  variant={soLoGan(r.id) ? "outline" : "default"}
                  size="sm"
                  onClick={() => setGanLo(r)}
                >
                  <Link2 />
                  {soLoGan(r.id) ? `Lô NL (${soLoGan(r.id)})` : "Gắn lô NL"}
                </Button>
                <Button
                  title="In tem QR lô bán thành phẩm của mẻ này để dán lên block/thùng. Quét tem là ra nguồn gốc."
                  variant="outline"
                  size="sm"
                  onClick={() => setTemLo([r])}
                >
                  <QrCode />
                  Tem
                </Button>
                <Button
                  title="Mở lại dòng sản lượng này để sửa số kg hoặc mặt hàng." variant="outline" size="sm" onClick={() => moSua(r)}>
                  <Pencil />
                  Sửa
                </Button>
                <Button
                  title="Bỏ dòng sản lượng này khỏi sổ. Có hỏi xác nhận và còn nút Hoàn tác." variant="outline" size="sm" onClick={() => xoa(r)}>
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

          {/* Bột tẩm đã dùng (mig 0051) — cộng theo loại cho phạm vi đang xem; là số
              kế toán điền nhóm "Bột phụ gia" (Khối 1) ở Cân đối. */}
          {botTheoLoai.length > 0 && (
            <div className="space-y-3 rounded-xl border-2 border-border p-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Wheat className="size-icon shrink-0" aria-hidden />
                  Bột tẩm đã dùng
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cộng theo loại bột cho {moTaPhamVi} · {phanXuong}. Bột là phụ gia —
                  không nằm trong tổng sản lượng; dùng số này cho nhóm "Bột phụ gia" ở
                  Cân đối.
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-base">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left">
                      <th className="px-3 py-2 font-semibold">Loại bột</th>
                      <th className="px-3 py-2 text-right font-semibold">Số dòng TP</th>
                      <th className="px-3 py-2 text-right font-semibold">Tổng kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {botTheoLoai.map((b) => (
                      <tr key={b.ten} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{b.ten}</td>
                        <td className="tnum px-3 py-2 text-right">{num(b.soDong)}</td>
                        <td className="tnum px-3 py-2 text-right font-semibold">{kg(b.kg)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-semibold">
                      <td className="px-3 py-2" colSpan={2}>
                        Tổng bột tẩm
                      </td>
                      <td className="tnum px-3 py-2 text-right">{kg(tongBotView)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Bán nội địa (mig 0054) — sổ riêng; hiện cả khi ngày không có thành phẩm. */}
      {bndView.length > 0 && (
        <div className="space-y-3 rounded-xl border-2 border-border p-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Store className="size-icon shrink-0" aria-hidden />
              Bán nội địa
            </h2>
            <p className="text-sm text-muted-foreground">
              Nguyên liệu bán thẳng cho khách trong nước — {moTaPhamVi} · {phanXuong}. Không
              nằm trong tổng sản lượng; Cân đối lấy số này cho dòng “Bán nội địa”.
            </p>
          </div>
          <RecordTable
            columns={cotBND}
            rows={bndView}
            getKey={(r) => r.id}
            toMau="ban-noi-dia"
            actions={(r) => (
              <div className="flex flex-wrap gap-2">
                <Button
                  title="Mở lại dòng bán nội địa này để sửa ngày, loại nguyên liệu, số lượng, giá hoặc khách."
                  variant="outline"
                  size="sm"
                  onClick={() => moSuaBND(r)}
                >
                  <Pencil />
                  Sửa
                </Button>
                <ConfirmDelete
                  moTaBanGhi={`Bán nội địa ${r.materialTypeName} — ${kg(r.quantityKg)} (${viDate(r.saleDate)})`}
                  onConfirm={() => xoaBND(r)}
                  trigger={
                    <Button
                      title="Bỏ dòng bán nội địa này khỏi sổ. Có hỏi xác nhận và còn nút Hoàn tác."
                      variant="outline"
                      size="sm"
                    >
                      Bỏ
                    </Button>
                  }
                />
              </div>
            )}
          />
          <div className="flex flex-wrap justify-end gap-x-10 gap-y-2 rounded-xl bg-muted px-5 py-4">
            <div className="flex items-baseline gap-3">
              <span className="text-base text-muted-foreground">Tổng bán nội địa</span>
              <span className="tnum text-xl font-semibold">{kg(tongBNDView)}</span>
            </div>
          </div>
        </div>
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
              title="Mở khóa lại ngày sản xuất đã chốt để sửa hoặc ghi bù. Phải ghi lý do, và việc mở khóa được lưu vết."
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
              title="Khóa sổ sản xuất ngày này và khai phần nguyên liệu CÒN DỞ tách theo từng loại. Số còn dở đó thành đông gửi ở sổ tồn kho nguyên liệu."
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
              <Button
                title="Gửi báo cáo sản lượng ngày (gom theo xưởng × người ghi) lên hệ thống. Khác với chốt ngày: gửi báo cáo không khóa sổ." onClick={guiBaoCao}>
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
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Combobox
                    label="Thành phẩm"
                    required
                    value={sua.productId}
                    onChange={(v) => datSua({ productId: v })}
                    options={optMatHang}
                    onCreate={(ten) => themMatHang(ten)}
                    emptyText="Chưa có thành phẩm — gõ tên rồi Thêm mới."
                    onSuaMuc={moSuaTP}
                    nhanSua={suaMH.nhanSua}
                  />
                </div>
                {sua.productId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Sửa thành phẩm này"
                    title="Sửa thông tin thành phẩm đang chọn (tên, mã số, loài, kiểu chế biến, quy cách) — lưu thẳng vào Danh mục."
                    onClick={() => moSuaTP(sua.productId)}
                  >
                    <Pencil />
                  </Button>
                )}
              </div>
              <Combobox
                label="Khách hàng"
                value={sua.customerName ?? ""}
                onChange={(v) => datSua({ customerName: v })}
                options={optKhach}
                onCreate={(ten) => themKhach(ten)}
                placeholder="Chọn khách hàng (nếu có)"
                emptyText="Chưa có khách — gõ tên rồi Thêm mới."
                onSuaMuc={suaKH.moSua}
                nhanSua={suaKH.nhanSua}
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

              {(laMatHangTamBot(matHang.find((m) => m.id === sua.productId)) ||
                /bột/i.test(sua.processingType ?? "") ||
                tongBot(sua.batterKg) > 0) && (
                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-base font-semibold">Bột tẩm</p>
                  <KhoiBotTam
                    diKem={diKemCua(sua.productId)}
                    botKg={sua.batterKg ?? {}}
                    onDoi={(batterKg) => datSua({ batterKg })}
                    optBot={optBot}
                    onTaoBot={themBot}
                    onSuaBot={suaBot.moSua}
                    kgThanhPham={suaTong}
                  />
                </div>
              )}

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
            <Button
              title="Ghi đè dòng sản lượng này bằng số vừa sửa." size="lg" onClick={luuSua}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog sửa một dòng bán nội địa */}
      <Dialog open={suaBND !== null} onOpenChange={(o) => !o && setSuaBND(null)}>
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Sửa dòng bán nội địa</DialogTitle>
            <DialogDescription>
              Nguyên liệu bán thẳng cho khách trong nước — không cộng vào sản lượng thành phẩm.
            </DialogDescription>
          </DialogHeader>
          {suaBND && (
            <div className="space-y-6 py-2">
              <ErrorSummary loi={loiSuaBND} />
              <ChuThichBatBuoc />
              <div className="grid gap-6 sm:grid-cols-2">
                <DateField
                  label="Ngày bán"
                  required
                  value={suaBND.saleDate}
                  onChange={(v) => datSuaBND({ saleDate: v })}
                />
                <Combobox
                  label="Phân xưởng"
                  required
                  choPhepXoa={false}
                  value={suaBND.workshop}
                  onChange={(v) => datSuaBND({ workshop: v as Workshop })}
                  options={PHAN_XUONG.map((p) => ({ value: p, label: p }))}
                />
              </div>
              <Combobox
                label="Loại nguyên liệu"
                required
                value={suaBND.materialTypeName}
                onChange={(v) => datSuaBND({ materialTypeName: v })}
                options={oLoaiNL.options}
                onCreate={oLoaiNL.onCreate}
                onSuaMuc={oLoaiNL.onSuaMuc}
                suaDuoc={oLoaiNL.suaDuoc}
                nhanSua={oLoaiNL.nhanSua}
                placeholder="— Chọn loại NL —"
                emptyText="Chưa có loại này — gõ tên rồi Thêm mới."
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <NumberField
                  label="Số lượng"
                  required
                  unit="kg"
                  value={suaBND.quantityKg || null}
                  onChange={(v) => datSuaBND({ quantityKg: v ?? 0 })}
                />
                <NumberField
                  label="Đơn giá"
                  unit="đ/kg"
                  value={suaBND.unitPrice}
                  onChange={(v) => datSuaBND({ unitPrice: v })}
                />
              </div>
              <Combobox
                label="Khách hàng"
                value={suaBND.customerName}
                onChange={(v) => datSuaBND({ customerName: v })}
                options={oKhach.options}
                onCreate={oKhach.onCreate}
                onSuaMuc={oKhach.onSuaMuc}
                suaDuoc={oKhach.suaDuoc}
                nhanSua={oKhach.nhanSua}
                placeholder="— Chọn khách (nếu có) —"
                emptyText="Chưa có khách này — gõ tên rồi Thêm mới."
              />
              <Field label="Ghi chú">
                <Input
                  value={suaBND.note}
                  onChange={(e) => datSuaBND({ note: e.target.value })}
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setSuaBND(null)}>
              Hủy
            </Button>
            <Button title="Ghi đè dòng bán nội địa này bằng số vừa sửa." size="lg" onClick={luuSuaBND}>
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

          {/* Nhắc gắn lô NL (đợt 2 truy xuất QR): mẻ chưa gắn lô thì quét tem thành phẩm
              không truy ngược được về nguyên liệu. CHỈ NHẮC, không chặn chốt. */}
          {meChuaGanLo.length > 0 && (
            <div className="min-w-0 space-y-2 rounded-lg border-2 border-warning/60 bg-warning/10 p-3">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
                <Nhan loai="luu-y">Chưa gắn lô</Nhan>
                {meChuaGanLo.length} mẻ chưa ghi đã dùng lô nguyên liệu nào
              </p>
              <p className="text-muted-foreground">
                Không gắn thì quét tem thành phẩm sẽ không truy ngược được về nguyên liệu. Vẫn chốt được — gắn sau cũng được.
              </p>
              <ul className="space-y-1">
                {meChuaGanLo.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0">
                      {tenMH(r.productId)} · <span className="tnum">{kg(r.quantityKg || 0)}</span>
                    </span>
                    <Button
                      title="Đóng hộp chốt và mở hộp gắn lô nguyên liệu cho mẻ này (quét tem, gõ mã hoặc chọn)."
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setHoiChot(false);
                        setGanLo(r);
                      }}
                    >
                      <Link2 />
                      Gắn lô NL
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                        onSuaMuc={suaNL.moSua}
                        nhanSua={suaNL.nhanSua}
                        suaDuoc={suaNL.suaDuoc}
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
                      title="Bỏ dòng nguyên liệu còn dở này khỏi phần khai."
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
              title="Thêm một loại nguyên liệu còn dở nữa. Khai tách theo loại thì sổ tồn kho nguyên liệu mới cộng đúng."
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
            <Button
              title="Xác nhận khóa sổ sản xuất ngày này kèm phần còn dở đã khai." size="lg" onClick={chotNgay}>
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
            <Button
              title="Xác nhận mở khóa ngày sản xuất này để sửa hoặc ghi bù." size="lg" onClick={moLaiNgay}>
              <LockOpen />
              Mở lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {suaMH.hop}
      {suaKH.hop}
      {suaNL.hop}
      {suaBot.hop}
      {ganLo && (
        <GanLoDauVao
          outputKind="W"
          outputId={ganLo.id}
          outputNhan={`mẻ ${nhanLoBtp(ganLo)} · ${tenMH(ganLo.productId)}`}
          xuong={ganLo.workshop}
          ngay={ganLo.productionDate}
          onClose={() => setGanLo(null)}
        />
      )}
      {temLo && (
        <TemLoQr
          nuts={temLo.map((w) =>
            nutLo("W", w.id, {
              shipments: [], imports: [], wips: [...rows, ...temLo.filter((t) => !rows.some((r) => r.id === t.id))],
              packagings: [], lotInputs, exportItems: [], exportOrders: [], salesOrders: [], products: matHang, customers: [],
            })
          )}
          onClose={() => setTemLo(null)}
        />
      )}
      {inPhieuTrong && (
        <PhieuTrongTPNgay onClose={() => setInPhieuTrong(false)} />
      )}
    </div>
  );
}

/* ---------- Bảng thành phẩm của một phiên (nhập nhiều dòng một lượt) ---------- */
