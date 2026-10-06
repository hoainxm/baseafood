// ============================================================
// Tên file: src/features/monthly-stock/MonthlyStockScreen.tsx
// Tên tiếng Việt: Sổ kho theo THÁNG — dồn tồn cuối kỳ → đầu kỳ sau
// Description: Monthly stock ledger — carry closing balance into next month
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MonthlyStockLine, MaterialType, Product } from "@/types";
import { MONTHLY_STOCK_CATEGORIES, BSF1_WAREHOUSES, STORAGE_KIND_LABELS } from "@/types";
import { useMonthlyStock, useMaterialTypes, useProducts, useStorageLocations } from "@/lib/catalogRepo";
import { uid } from "@/lib/db";
import { num, viDate } from "@/lib/format";
import {
  parseBangKeKhoFile,
  namTuTenFile,
  khoTuTieuDe,
  timKhoTheoGhi,
  tenKhoMoi,
  khoaKho,
  type BangKeKhoSheet,
} from "@/lib/monthlyStockExcel";
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
  KhungCuonNgang,
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
  Nhan,
  NumberField,
  ONhapSo,
  PhieuIn,
  TdIn,
  ThIn,
  ThongKe,
  NutToMauChon,
  useToMau,
  homNay,
  notify,
  parseSo,
  type ChonBang,
  type CotTong,
  type LoiNhap,
  type MucChon,
  type TheThongTin,
} from "@/design-system";
import { useSuaDanhMuc } from "@/features/catalog/SuaDanhMucNhanh";
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
  Redo2,
  Scale,
  Ship,
  Snowflake,
  Trash2,
  Undo2,
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
  const [lines, ghiLinesGoc] = useMonthlyStock();
  const [mtypes, ghiMtypes] = useMaterialTypes();
  const [products, ghiProducts] = useProducts();
  const [khoLuuDM, ghiKhoLuuDM] = useStorageLocations();

  const [thang, setThang] = useState(thangHienTai());
  const [kho, setKho] = useState(TAT_CA_KHO);
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

  // Đối chiếu lệch theo MẶT HÀNG (chẩn đoán — người dùng tự sửa thẳng trên bảng).
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

  // ---------- Hoàn tác / làm lại (Ctrl+Z / Ctrl+Y) — như lưới Cân đối ----------
  /* Người dùng quen Excel: Ctrl+Z lùi MỌI thứ vừa ghi vào sổ, không riêng ô số. Mỗi
     lần ghi chụp lại sổ TRƯỚC khi ghi; gõ liên tiếp vào CÙNG một ô (cùng `nhom`) chỉ
     là MỘT bước lùi. Lịch sử theo phiên mở màn — rời màn là mất. */
  const lui = useRef<{ nhom: string; lines: MonthlyStockLine[] }[]>([]);
  const tien = useRef<{ nhom: string; lines: MonthlyStockLine[] }[]>([]);
  const [lichSu, setLichSu] = useState({ lui: 0, tien: 0 });
  const demLichSu = () => setLichSu({ lui: lui.current.length, tien: tien.current.length });

  /** MỌI lần ghi sổ của màn đi qua đây (thao tác dòng, dồn kỳ, nạp Excel, gõ ô…). */
  const ghiLines = (next: MonthlyStockLine[], nhom?: string) => {
    const dinh = lui.current[lui.current.length - 1];
    if (!nhom || !dinh || dinh.nhom !== nhom) {
      lui.current.push({ nhom: nhom ?? uid(), lines });
      if (lui.current.length > 100) lui.current.shift();
    }
    tien.current = [];
    demLichSu();
    ghiLinesGoc(next);
  };
  const hoanTac = useCallback(() => {
    const m = lui.current.pop();
    if (!m) return;
    tien.current.push({ nhom: m.nhom, lines });
    ghiLinesGoc(m.lines);
    setLichSu({ lui: lui.current.length, tien: tien.current.length });
    notify.daLuu("Đã hoàn tác");
  }, [lines, ghiLinesGoc]);
  const lamLai = useCallback(() => {
    const m = tien.current.pop();
    if (!m) return;
    lui.current.push({ nhom: m.nhom, lines });
    ghiLinesGoc(m.lines);
    setLichSu({ lui: lui.current.length, tien: tien.current.length });
    notify.daLuu("Đã làm lại");
  }, [lines, ghiLinesGoc]);
  useEffect(() => {
    const nghe = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      // Đang gõ trong hộp thoại (thêm/sửa dòng…) ⇒ để ô tự hoàn tác chữ của nó.
      if ((e.target as HTMLElement | null)?.closest?.('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        hoanTac();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        lamLai();
      }
    };
    window.addEventListener("keydown", nghe);
    return () => window.removeEventListener("keydown", nghe);
  }, [hoanTac, lamLai]);

  // ---------- Ghi THẲNG trên bảng ----------
  /* Sửa một dòng ngay tại ô — đi qua chốt audit của repo.ts như mọi đường ghi (lưu vết
     người · thiết bị · thời điểm · cũ→mới). `nhom` = ô đang gõ ⇒ một bước Ctrl+Z. */
  /**
   * Sổ làm nền cho một lần gõ trên bảng. Tháng đang XEM TRƯỚC (chưa có dòng nào) ⇒ gõ
   * vào ô nào là tự KẾ THỪA tồn cuối tháng trước (mọi kho — y nút "Kế thừa & lưu vào
   * sổ") rồi ghi số vừa gõ, CÙNG một lần ghi ⇒ Ctrl+Z lùi cả hai. id dòng kế thừa
   * `carry|<id nguồn>` = đúng id dòng đang xem trước ⇒ ô đang gõ không mất con trỏ.
   * Cùng quy tắc "tháng chưa mở thì tự kế thừa" của Cân đối (chốt 2026-10-06).
   */
  const soNenDeGhi = (): { nen: MonthlyStockLine[]; keThua: number } => {
    if (!laXemTruoc) return { nen: lines, keThua: 0 };
    const carried = donSangThang(rowsTruoc, thang);
    const idMoi = new Set(carried.map((c) => c.id));
    return { nen: [...lines.filter((l) => !idMoi.has(l.id)), ...carried], keThua: carried.length };
  };
  const baoKeThua = (n: number) => {
    if (n) notify.daLuu(`Đã kế thừa ${n} dòng tồn cuối ${nhanThang(thangTr)} vào sổ ${nhanThang(thang)} rồi ghi số vừa gõ`);
  };

  const suaSo = (id: string, patch: Partial<MonthlyStockLine>, nhom?: string) => {
    const { nen, keThua } = soNenDeGhi();
    ghiLines(
      nen.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      nhom ?? `${id}|${Object.keys(patch).join(",")}`
    );
    baoKeThua(keThua);
  };

  /* ---------- Ghi DÒNG MỚI ngay trên bảng ----------
     Cuối mỗi bảng nhóm có ô "Dòng mới": gõ / chọn tên hàng là dòng hiện luôn trong bảng
     (nhóm của bảng, tháng đang xem, kho đang lọc — "Tất cả kho" thì kho mặc định), con
     trỏ nhảy sang ô Nhập của dòng đó để gõ số tiếp. Tháng đang xem trước ⇒ tự kế thừa
     & lưu trước (soNenDeGhi). Cần điền nhiều ô một lần thì vẫn có hộp "Thêm đủ thông tin". */
  const tenHangOpts = (category: string): MucChon[] => {
    const cungNhom = new Set<string>();
    const khac = new Set<string>();
    for (const l of lines) (l.category === category ? cungNhom : khac).add(l.itemName);
    for (const m of mtypes) khac.add(m.name);
    for (const sp of products) khac.add(sp.name);
    const ra: MucChon[] = [];
    const daCo = new Set<string>();
    for (const [ds, phu] of [
      [cungNhom, category],
      [khac, undefined],
    ] as const) {
      for (const t of [...ds].filter(Boolean).sort((a, b) => a.localeCompare(b, "vi"))) {
        const k = t.trim().toLowerCase();
        if (daCo.has(k)) continue;
        daCo.add(k);
        ra.push({ value: t, label: t, phu });
      }
    }
    return ra;
  };
  const themDongNhanh = (category: string, ten: string) => {
    const t = ten.trim();
    if (!t) return;
    const { nen, keThua } = soNenDeGhi();
    const dong: MonthlyStockLine = {
      id: `msl|${thang}|${uid()}`,
      period: thang,
      category,
      warehouse: kho !== TAT_CA_KHO ? kho : KHO_MAC_DINH,
      itemName: t,
      size: "",
      origin: "",
      importDate: "",
      storageLocation: "",
      kgPerCtn: null,
      unitPrice: null,
      openCtn: 0,
      openKg: 0,
      inCtn: 0,
      inKg: 0,
      outCtn: 0,
      outKg: 0,
      carriedFromId: "",
      sortOrder: nen.filter((l) => l.period === thang).length,
      note: "",
    };
    ghiLines([...nen, dong]);
    baoKeThua(keThua);
    notify.daLuu(`Đã thêm dòng ${t} vào ${category} — gõ số ngay trên bảng`);
    /* Dòng mới đang ẩn vì ô tìm / ẩn dòng trống ⇒ bỏ lọc để thấy nó. */
    if (timKiem.trim() && !`${t} ${category}`.toLowerCase().includes(timKiem.trim().toLowerCase())) setTimKiem("");
    if (anDongTrong) setAnDongTrong(false);
    setTimeout(() => {
      const o = document.querySelector<HTMLInputElement>(
        `input[data-dong="${CSS.escape(dong.id)}"][data-navcol="inKg"]`
      );
      o?.focus();
      o?.select();
    }, 60);
  };

  /** Cột số gõ được trên bảng — đúng thứ tự cột hiển thị (để dán khối từ Excel). */
  const COT_SO: (keyof Pick<MonthlyStockLine, "unitPrice" | "openKg" | "inKg" | "outKg">)[] = [
    "unitPrice",
    "openKg",
    "inKg",
    "outKg",
  ];

  /**
   * Dán một KHỐI số từ Excel (TSV) vào bảng, bắt đầu từ ô đang đứng: dòng theo thứ tự
   * đang hiện (qua các nhóm), cột theo `COT_SO`. Hiểu `(2.000)` = −2.000 kiểu kế toán;
   * ô rỗng giữ nguyên số cũ. Gom MỘT lần ghi (dán 5×10 ô không thành 50 lần ghi đè).
   */
  const danKhoi = (e: React.ClipboardEvent<HTMLInputElement>, rowId: string, cot: (typeof COT_SO)[number]) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || !/[\t\n\r]/.test(text)) return; // một ô — để ô tự xử lý
    e.preventDefault();
    const khoi = text
      .replace(/\r\n?/g, "\n")
      .replace(/\n+$/, "")
      .split("\n")
      .map((dong) =>
        dong.split("\t").map((o) => {
          const t = o.trim();
          if (!t) return null;
          const am = /^\(.*\)$/.test(t);
          const so = parseSo(am ? t.slice(1, -1) : t);
          return so == null ? null : am ? -so : so;
        })
      );
    const dsDong = nhomList.flatMap((g) => g.rows);
    const iH = dsDong.findIndex((r) => r.id === rowId);
    const iC = COT_SO.indexOf(cot);
    if (iH < 0 || iC < 0) return;
    const doi = new Map<string, Partial<MonthlyStockLine>>();
    let soO = 0;
    khoi.forEach((dong, i) =>
      dong.forEach((v, j) => {
        const r = dsDong[iH + i];
        const c = COT_SO[iC + j];
        if (v == null || !r || !c) return;
        doi.set(r.id, { ...(doi.get(r.id) ?? {}), [c]: v });
        soO++;
      })
    );
    if (!soO) return;
    const { nen, keThua } = soNenDeGhi();
    ghiLines(nen.map((l) => (doi.has(l.id) ? { ...l, ...doi.get(l.id) } : l)));
    baoKeThua(keThua);
    notify.daLuu(`Đã dán ${soO} ô vào ${doi.size} dòng — Ctrl+Z để hoàn tác`);
  };

  const xoaDong = (r: MonthlyStockRow) => {
    const truoc = lines;
    ghiLines(lines.filter((l) => l.id !== r.id));
    notify.daXoa(`Đã xóa dòng ${r.itemName}`, () => ghiLines(truoc));
  };

  // ---------- Thêm / sửa dòng ----------
  const [form, setForm] = useState<DongForm | null>(null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);

  const moThem = (catChon?: string) => {
    // Đang XEM TRƯỚC: lưu dòng mới sẽ TỰ kế thừa & lưu bảng kế thừa trước (luuDong →
    // soNenDeGhi) — trước đây chặn vì lưu riêng 1 dòng làm bảng kế thừa chưa lưu trôi mất.
    // catChon = nhóm của bảng bấm nút (điền sẵn nhóm, khỏi chọn lại). Không có ⇒ nhóm đầu.
    const catGoiY = catChon || nhomList[0]?.category || MONTHLY_STOCK_CATEGORIES[0];
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
    const { nen, keThua } = form.id ? { nen: lines, keThua: 0 } : soNenDeGhi();
    ghiLines(form.id ? lines.map((l) => (l.id === dong.id ? dong : l)) : [...nen, dong]);
    baoKeThua(keThua);
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
  // Tô màu dòng "đã dò" — cùng khoá với BangTong toMau="ton-kho-thang" bên dưới:
  // tick dòng → nút Tô màu / In đậm / Bỏ tô ở thanh "Đã chọn N dòng".
  const toMau = useToMau("ton-kho-thang");
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

  /**
   * Gõ vị trí chưa có ⇒ lưu ngay vào danh mục kho lưu (mặc định kho thuê ngoài).
   * Trùng tên (không phân hoa thường) với kho đã có ⇒ dùng lại tên có sẵn.
   */
  const themViTri = (ten: string) => {
    const name = ten.trim();
    const co = viTriOpts.find((o) => o.value.toLowerCase() === name.toLowerCase());
    if (co) return co.value;
    if (name) {
      ghiKhoLuuDM([...khoLuuDM, { id: uid(), code: "", name, kind: "thue-ngoai", address: "", phone: "", note: "Từ sổ kho theo tháng" }]);
      notify.daLuu(`Đã thêm kho lưu "${name}" vào danh mục`);
    }
    return name;
  };
  /** Bút chì sửa nhanh kho lưu ngay trong ô Vị trí — chỉ kho CÓ trong danh mục (kho hệ thống thì không). */
  const suaKL = useSuaDanhMuc("khoLuu", khoLuuDM, ghiKhoLuuDM, { theo: "ten" });

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

  // Lọc bảng về đúng mặt hàng lệch (ô Tìm) để sửa tay ngay trên bảng.
  const suaTayMatHang = (d: DoiChieuDong) => {
    setKho(d.warehouse);
    setTimKiem(d.itemName);
    setAnDongTrong(false);
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

  /**
   * Bút chì sửa nhanh mặt hàng / loại NL trong ô "Ánh xạ … tới" (value là TÊN).
   * Đổi tên mặt hàng ở hộp sửa ⇒ dời luôn các ánh xạ đang trỏ tên cũ sang tên mới,
   * kẻo bấm Đồng bộ lại đẻ ra một mặt hàng mang tên cũ. (Loại NL khoá ô tên.)
   */
  const suaMH = useSuaDanhMuc("matHang", products, ghiProducts, {
    theo: "ten",
    onDaLuu: (moi, cu) => {
      const tenCu = cu.name.trim().toLowerCase();
      if (moi.name.trim().toLowerCase() === tenCu) return;
      setMapDB((m) =>
        Object.fromEntries(
          Object.entries(m).map(([k, v]) => [k, v.trim().toLowerCase() === tenCu ? moi.name.trim() : v])
        )
      );
    },
  });
  const suaNL = useSuaDanhMuc("loaiNL", mtypes, ghiMtypes, { theo: "ten" });

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

  /**
   * Gõ tên chưa có trong ô "Ánh xạ … tới" ⇒ LƯU NGAY vào danh mục đích của dòng (luật
   * ô chọn danh mục — chốt 2026-10-06; trước đây chờ bấm Đồng bộ mới thêm). Trùng tên
   * (không phân hoa thường) ⇒ dùng lại bản có sẵn. Trả về TÊN (value của ô).
   */
  const themTenChuan = (d: DichDanhMuc, t: string): string => {
    const ten = t.trim();
    if (d === "product") {
      const co = products.find((p) => chuan(p.name) === chuan(ten));
      if (co) return co.name;
      ghiProducts([
        ...products,
        { id: uid(), code: "", name: ten, finishedGoodCode: "", category: suyNhomNguyenLieu(ten), processingType: "" },
      ]);
      notify.daLuu(`Đã thêm mặt hàng "${ten}" vào danh mục`);
    } else if (d === "material") {
      const co = mtypes.find((m) => chuan(m.name) === chuan(ten));
      if (co) return co.name;
      ghiMtypes([...mtypes, { id: uid(), name: ten, category: suyNhomNguyenLieu(ten), note: "Từ sổ kho theo tháng" }]);
      notify.daLuu(`Đã thêm loại nguyên liệu "${ten}" vào danh mục`);
    }
    return ten;
  };

  /** Một dòng: tên file · đích (Mặt hàng/Loại NL/Bỏ qua) · ánh xạ tới tên CHUẨN. */
  const dongRow = (x: DongBoDong) => {
    const d = dichCua(x);
    const goc = d === "product" ? matHangOpts : loaiNLOpts;
    const sua = d === "product" ? suaMH : d === "material" ? suaNL : null;
    // Tên đang ánh xạ (tên file, hoặc tên vừa gõ "thêm mới") chưa có trong danh mục ⇒ vẫn phải HIỆN
    // trong ô, kèm nhãn "mới"; không thì Combobox rơi về placeholder, trông như chưa thêm được.
    const ten = mapCua(x);
    const opts =
      ten && !goc.some((o) => chuan(o.value) === chuan(ten))
        ? [{ value: ten, label: ten, phu: `mới — thêm vào ${d === "product" ? "Mặt hàng" : "Loại NL"} khi bấm Đồng bộ` }, ...goc]
        : goc;
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
        <div className="w-full min-w-0 sm:w-64 sm:shrink-0">
          <Combobox
            anNhan
            label={`Ánh xạ ${x.name} tới`}
            value={mapCua(x)}
            onChange={(v) => setMapDB((m) => ({ ...m, [x.name]: v }))}
            options={opts}
            onCreate={d === "skip" ? undefined : (t) => themTenChuan(d, t)}
            onSuaMuc={sua?.moSua}
            nhanSua={sua?.nhanSua}
            suaDuoc={sua?.suaDuoc}
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
      const nam = namTuTenFile(file.name);
      // Kho mặc định: kho của bản đã nạp cùng năm (nạp lại chỉ CẬP NHẬT) → kho khớp số ở tiêu đề sheet → K1500T.
      const daNap = lines.find((l) => l.id.startsWith("xlsx|") && l.id.split("|")[3] === String(nam));
      const so = khoTuTieuDe(sheets[0]?.tieuDe ?? "");
      const theoTieuDe = so ? BSF1_WAREHOUSES.find((w) => w.code.includes(so) || w.name.includes(so))?.name : undefined;
      setNapForm({ sheets, nam, kho: daNap?.warehouse ?? theoTieuDe ?? KHO_MAC_DINH });
    } catch (err) {
      notify.loi(`Không đọc được file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  const soDongNap = napForm
    ? napForm.sheets.reduce((s, sh) => s + (sh.monthNum ? sh.rows.length : 0), 0)
    : 0;
  /** Soát trước khi nạp: số kho ở tiêu đề sheet + bản nạp cũ của cùng năm ở kho KHÁC (nạp nhầm = cộng đôi). */
  const soatNap = useMemo(() => {
    if (!napForm) return null;
    const soTieuDe = [...new Set(napForm.sheets.map((sh) => khoTuTieuDe(sh.tieuDe)).filter(Boolean))];
    const ma = maKho(napForm.kho.trim());
    const khacKho = new Map<string, number>();
    for (const l of lines) {
      const p = l.id.split("|");
      if (p[0] === "xlsx" && p[3] === String(napForm.nam) && p[1] !== ma) khacKho.set(l.warehouse, (khacKho.get(l.warehouse) ?? 0) + 1);
    }
    const tieuDeLech = soTieuDe.length > 0 && !soTieuDe.some((so) => napForm.kho.includes(so) || ma.includes(so));
    const nhom = new Map<string, number>();
    const gui = new Map<string, number>();
    for (const sh of napForm.sheets)
      for (const r of sh.rows) {
        nhom.set(r.category, (nhom.get(r.category) ?? 0) + 1);
        if (r.khoGhi) {
          const ten = timKhoTheoGhi(r.khoGhi, khoLuuDM) ?? `${tenKhoMoi(r.khoGhi)} (mới)`;
          gui.set(ten, (gui.get(ten) ?? 0) + 1);
        }
      }
    return { soTieuDe, tieuDeLech, khacKho: [...khacKho], nhom: [...nhom], gui: [...gui] };
  }, [napForm, lines, khoLuuDM]);

  const xacNhanNap = () => {
    if (!napForm) return;
    const { sheets, nam, kho: khoNap } = napForm;
    if (nam < 2000 || nam > 2100) {
      notify.canhBao("Năm không hợp lệ (2000–2100).");
      return;
    }
    const moi: MonthlyStockLine[] = [];
    // Cột R "GỬI KHO HP / Á D…" ⇒ vị trí = kho trong danh mục kho lưu (khớp mã KHP/KAD hoặc tên);
    // viết tắt lạ ⇒ tạo mục kho thuê ngoài mới. Dòng KHÔNG ghi kho ⇒ giữ vị trí đã gán tay (trống = kho của sổ).
    const viTriCu = new Map(lines.map((l) => [l.id, l.storageLocation]));
    const noteCu = new Map(lines.map((l) => [l.id, l.note]));
    const dmKho = [...khoLuuDM];
    const khoThem: string[] = [];
    const tenKho = (ghi: string) => {
      const co = timKhoTheoGhi(ghi, dmKho);
      if (co) return co;
      const name = tenKhoMoi(ghi);
      dmKho.push({ id: uid(), code: `K${khoaKho(ghi)}`, name, kind: "thue-ngoai", address: "", phone: "", note: "Từ bảng kê kho (cột ghi chú)" });
      khoThem.push(name);
      return name;
    };
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
          storageLocation: r.khoGhi ? tenKho(r.khoGhi) : (viTriCu.get(id) ?? ""),
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
          note: r.ghiChu ? `Bảng kê: ${r.ghiChu}` : (noteCu.get(id) ?? ""),
        });
      });
    }
    if (!moi.length) {
      notify.canhBao("Không nạp được tháng nào — tên sheet phải là số tháng (1–12).");
      return;
    }
    const idMoi = new Set(moi.map((x) => x.id));
    // Dòng của CÙNG sheet/kho/năm mà file mới không còn (VD dòng tiêu đề "HÀNG TẠM" parser cũ nạp nhầm
    // thành mặt hàng): toàn số 0 ⇒ bỏ; còn số ⇒ giữ + cảnh báo (không xoá lặng lẽ số liệu).
    const tienTo = new Set(sheets.filter((sh) => sh.monthNum != null).map((sh) => `xlsx|${maKho(khoNap.trim())}|${sh.sheetName}|${nam}|`));
    const laCuCuaFile = (l: MonthlyStockLine) => !idMoi.has(l.id) && tienTo.has(l.id.slice(0, l.id.lastIndexOf("|") + 1));
    const cuRong = lines.filter((l) => laCuCuaFile(l) && laDongTrong(l));
    const cuConSo = lines.filter((l) => laCuCuaFile(l) && !laDongTrong(l));
    const idBo = new Set(cuRong.map((l) => l.id));
    const giuLai = lines.filter((l) => !idMoi.has(l.id) && !idBo.has(l.id));
    // Dòng đã TÁCH khi chuyển kho một phần: nạp lại trả dòng gốc về số trong file ⇒ phần tách bị đếm 2 lần.
    const soTach = giuLai.filter((l) => [...idMoi].some((id) => l.note.includes(`(tách từ dòng ${id})`))).length;
    ghiLines([...giuLai, ...moi]);
    if (khoThem.length) ghiKhoLuuDM(dmKho);
    if (cuConSo.length)
      notify.canhBao(`${cuConSo.length} dòng nạp lần trước không còn trong file mới nhưng còn số — giữ nguyên, kiểm lại: ${cuConSo.slice(0, 5).map((l) => l.itemName).join(", ")}${cuConSo.length > 5 ? "…" : ""}`);
    if (soTach) notify.canhBao(`${soTach} dòng từng tách khi chuyển kho một phần vẫn còn — dòng gốc đã về số trong file, kiểm lại kẻo cộng đôi.`);
    const dauKy = [...new Set(moi.map((m) => m.period))].sort()[0];
    setThang(dauKy);
    setKho(TAT_CA_KHO);
    setNapForm(null);
    const soGui = moi.filter((m) => m.storageLocation && m.storageLocation !== m.warehouse).length;
    notify.daLuu(
      `Đã nạp ${moi.length} dòng · ${new Set(moi.map((m) => m.period)).size} tháng từ Excel bảng kê` +
        (soGui ? ` · ${soGui} dòng gửi kho ngoài` : "") +
        (khoThem.length ? ` · thêm kho mới: ${khoThem.join(", ")}` : ""),
    );
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
  /* Ô gõ thẳng trên bảng (quy tắc bảng tự dựng — design-system README §5d): ô số là
     `ONhapSo` (gõ biểu thức, Esc trả số cũ, ghi theo phím) có `navCol` ⇒ ↑/↓/Enter đi
     dọc cột trong khung `[data-luoi-phim]`; Tab đi ngang. Bản XEM TRƯỚC dồn kỳ cũng gõ
     được: lần gõ đầu tự kế thừa & lưu (xem `soNenDeGhi`). Tên · nhóm đổi ở nút ✎. */
  const sua = true;
  const oChu =
    "h-9 rounded-md border border-input bg-background px-2 text-sm focus:border-ring focus:ring-2 focus:ring-ring/40 focus:outline-none";
  const oSo = (r: MonthlyStockRow, c: (typeof COT_SO)[number], nhan: string, mau?: string) => (
    <ONhapSo
      value={r[c] || null}
      onChange={(v) => suaSo(r.id, { [c]: v ?? 0 } as Partial<MonthlyStockLine>)}
      rong0
      navCol={c}
      data-dong={r.id}
      onPaste={(e) => danKhoi(e, r.id, c)}
      aria-label={`${nhan} — ${r.itemName}${r.size ? " " + r.size : ""}`}
      title={`${nhan}: gõ số hoặc phép tính (VD 1200+350). Enter / ↑ / ↓ sang dòng khác, dán được cả khối từ Excel.`}
      khungClassName="ml-auto w-24"
      className={`${oChu} w-full ${mau ?? ""}`}
    />
  );
  const cot = (t: ReturnType<typeof tongDong>): CotTong<MonthlyStockRow>[] => [
    {
      key: "ngay",
      header: "Ngày nhập",
      render: (r) =>
        sua ? (
          <input
            type="date"
            value={r.importDate || ""}
            onChange={(e) => suaSo(r.id, { importDate: e.target.value })}
            aria-label={`Ngày nhập — ${r.itemName}`}
            title="Ngày nhập lô — sửa thẳng tại đây."
            className={`${oChu} w-36`}
          />
        ) : (
          <span className="tnum whitespace-nowrap">{r.importDate ? viDate(r.importDate) : "—"}</span>
        ),
    },
    {
      key: "ten",
      header: "Mặt hàng",
      // Tên dài xuống dòng trong khung ≤ 13rem thay vì kéo cả bảng rộng ra.
      render: (r) => (
        <span className="block max-w-52 min-w-28 font-semibold whitespace-normal text-foreground">{r.itemName}</span>
      ),
    },
    // Size là CỘT RIÊNG (theo bảng kê của kế toán), không còn là dòng phụ dưới tên hàng.
    {
      key: "size",
      header: "Size",
      render: (r) =>
        sua ? (
          <input
            value={r.size}
            onChange={(e) => suaSo(r.id, { size: e.target.value })}
            aria-label={`Size — ${r.itemName}`}
            title="Size — sửa thẳng tại đây."
            className={`${oChu} w-20`}
          />
        ) : (
          <span className="whitespace-nowrap">{r.size || "—"}</span>
        ),
    },
    {
      key: "invoice",
      header: "Invoice",
      render: (r) =>
        sua ? (
          <input
            value={r.origin}
            onChange={(e) => suaSo(r.id, { origin: e.target.value })}
            aria-label={`Invoice — ${r.itemName}`}
            title="Số invoice của lô — sửa thẳng tại đây."
            className={`${oChu} w-28`}
          />
        ) : (
          r.origin || "—"
        ),
    },
    {
      key: "gia", header: "Đơn giá (đ)", so: true,
      render: (r) => (sua ? oSo(r, "unitPrice", "Đơn giá") : soHoacGach(r.unitPrice ?? 0)),
    },
    {
      key: "odKg", header: "Tồn đầu kỳ (kg)", so: true,
      render: (r) => (sua ? oSo(r, "openKg", "Tồn đầu kỳ") : soHoacGach(r.openKg)),
      tong: () => num(t.openKg),
    },
    {
      key: "inKg", header: "Nhập trong kỳ (kg)", so: true,
      render: (r) =>
        sua ? (
          oSo(r, "inKg", "Nhập trong kỳ", r.inKg ? "font-semibold text-success" : "")
        ) : r.inKg ? (
          <span className="font-semibold text-success">+{num(r.inKg)}</span>
        ) : (
          "—"
        ),
      tong: () => num(t.inKg),
    },
    {
      key: "outKg", header: "Xuất trong kỳ (kg)", so: true,
      render: (r) =>
        sua ? (
          oSo(r, "outKg", "Xuất trong kỳ", r.outKg ? "font-semibold text-warning" : "")
        ) : r.outKg ? (
          <span className="font-semibold text-warning">−{num(r.outKg)}</span>
        ) : (
          "—"
        ),
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
      render: (r) =>
        sua ? (
          <div className="w-40">
            <Combobox
              anNhan
              label={`Vị trí — ${r.itemName}`}
              value={r.storageLocation}
              onChange={(v) => suaSo(r.id, { storageLocation: v })}
              options={viTriOpts}
              onCreate={themViTri}
              onSuaMuc={suaKL.moSua}
              nhanSua={suaKL.nhanSua}
              suaDuoc={suaKL.suaDuoc}
              choPhepXoa={false}
              placeholder={r.warehouse ? `= ${r.warehouse}` : "Chọn kho"}
            />
          </div>
        ) : laKhoNgoai(r.storageLocation) ? (
          <Nhan loai="vi-tri">{nhanViTri(r)}</Nhan>
        ) : (
          <span
            className={
              r.storageLocation
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
        <div className="flex items-center justify-end gap-0.5">
          <Button
            size="icon-sm"
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
                size="icon-sm"
                variant="ghost"
                aria-label={`Lấy ra / gửi kho ${r.itemName}`}
                title="Lấy hàng ra sử dụng, nhập thêm, hoặc gửi ra kho ngoài (Ánh Dương, HP…) — nhập số kg rồi lưu."
                onClick={() => moThaoTac(r)}
              >
                <PackageMinus className="size-4" />
              </Button>
              <Button
                title="Sửa dòng: ngày nhập · tên hàng · size · invoice · đơn giá · số kg · vị trí." size="icon-sm" variant="ghost" aria-label={`Sửa ${r.itemName}`} onClick={() => moSua(r)}>
                <Pencil className="size-4" />
              </Button>
              <ConfirmDelete
                moTaBanGhi={`${r.itemName}${r.size ? " · " + r.size : ""}`}
                onConfirm={() => xoaDong(r)}
                trigger={
                  <Button
                    title="Xóa dòng này khỏi tháng. Có hỏi xác nhận, xóa xong vẫn còn nút Hoàn tác." size="icon-sm" variant="ghost" aria-label={`Xóa ${r.itemName}`}>
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
            <>
              <Button
                variant="outline"
                onClick={hoanTac}
                disabled={!lichSu.lui}
                title="Hoàn tác lần ghi vừa rồi trên sổ (Ctrl+Z)."
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Hoàn tác
              </Button>
              <Button
                variant="outline"
                onClick={lamLai}
                disabled={!lichSu.tien}
                title="Làm lại thao tác vừa hoàn tác (Ctrl+Y)."
              >
                <Redo2 className="mr-2 h-4 w-4" />
                Làm lại
              </Button>
            </>
          )}
          {coDuLieu && !laXemTruoc && (
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
              className="h-auto min-h-10 max-w-full whitespace-normal text-left"
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
              <Button onClick={() => moThem()} title="Thêm tay dòng đầu tiên cho tháng này (tên hàng · tồn đầu · nhập · xuất).">
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
                    Tháng này chưa có dòng nào nên số dưới đây là tồn đầu DỰ KIẾN tính từ tháng trước.
                    Gõ thẳng vào bảng là tự kế thừa &amp; lưu rồi ghi số vừa gõ (Ctrl+Z lùi cả hai), hoặc bấm
                    "Kế thừa &amp; lưu vào sổ". Chạy lại chỉ cập nhật, không nhân đôi.
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
            <Nhan loai="phu" className="ml-auto">
              {rowsThang.length} mặt hàng · {nhomList.length} nhóm
            </Nhan>
          </div>

          {coDuLieu && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Cách thao tác:</span>
              <span>gõ thẳng vào ô trên bảng (Enter / ↑ / ↓ đi dọc cột, dán được khối từ Excel, Ctrl+Z hoàn tác); thêm dòng ở ô "Dòng mới" cuối mỗi bảng;</span>
              <span>
                lấy ra dùng · nhập thêm · gửi kho ngoài theo số kg → bấm{" "}
                <PackageMinus className="inline size-4 align-text-bottom" aria-label="nút Lấy ra / gửi kho" /> cuối dòng;
              </span>
              <span>đổi tên · nhóm → nút ✎.</span>
            </p>
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

          {/* Một khung phím cho mọi nhóm: ↓ ở dòng cuối nhóm trên nhảy sang dòng đầu nhóm dưới. */}
          <div className="space-y-8" data-luoi-phim>
            {nhomList.map((g) => (
              <section key={g.category} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-foreground">{g.category}</h2>
                  {/* Hai nhãn ngắn thay một nhãn dài — điện thoại + chữ 130% tự xuống dòng, không bị cắt số. */}
                  <span className="flex flex-wrap gap-1">
                    <Nhan loai="phu">Tồn cuối {num(g.tong.closeKg)} kg</Nhan>
                    <Nhan loai="phu">{g.rows.length} mặt hàng</Nhan>
                  </span>
                </div>
                <BangTong
                  rows={g.rows}
                  cot={cot(g.tong)}
                  getKey={(r) => r.id}
                  nhanTong={`Cộng ${g.category}`}
                  chon={chonBang}
                  xoRa
                  toMau="ton-kho-thang"
                  dongThem={
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                        <Plus className="size-4" aria-hidden />
                        Dòng mới
                      </span>
                      <div className="w-full sm:w-72">
                        <Combobox
                          anNhan
                          label={`Tên hàng — dòng mới vào ${g.category}`}
                          value=""
                          onChange={(v) => themDongNhanh(g.category, v)}
                          onCreate={(t) => t}
                          options={tenHangOpts(g.category)}
                          placeholder="Gõ / chọn tên hàng để thêm dòng"
                          choPhepXoa={false}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moThem(g.category)}
                        title={`Mở hộp thêm dòng vào nhóm "${g.category}" để điền nhiều ô một lần (ngày nhập · size · invoice · đơn giá · số kg · vị trí).`}
                      >
                        Thêm đủ thông tin…
                      </Button>
                    </div>
                  }
                />
              </section>
            ))}
          </div>

          {/* Cộng tổng + tô màu các dòng đang tick — kiểu bảng kê kế toán. Đặt SAU các
              bảng và DÍNH ĐÁY màn hình từ md (bottom-8: nằm trên thanh cuộn ngang dính đáy
              của bảng xổ): tick dòng cuối bảng vẫn thấy nút, khỏi lăn ngược lên đầu trang.
              Điện thoại KHÔNG dính — đủ nút + số tổng thì thanh cao ~3/4 màn (360px, chữ
              130%); thanh nằm ngay dưới bảng nên kéo xuống chút là tới. */}
          {rowsChon.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary/40 bg-card p-3 print:hidden md:sticky md:bottom-8 md:z-30 md:shadow-lg">
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
                <NutToMauChon to={toMau} khoa={rowsChon.map((r) => r.id)} />
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
                  onSuaMuc={suaKL.moSua}
                  nhanSua={suaKL.nhanSua}
                  suaDuoc={suaKL.suaDuoc}
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
                  onSuaMuc={suaKL.moSua}
                  nhanSua={suaKL.nhanSua}
                  suaDuoc={suaKL.suaDuoc}
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
                onSuaMuc={suaKL.moSua}
                nhanSua={suaKL.nhanSua}
                suaDuoc={suaKL.suaDuoc}
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
                            <Nhan loai="luu-y">bỏ (tên sheet không phải số tháng)</Nhan>
                          )}
                        </td>
                        <td className="tnum px-3 py-2 text-right">{sh.rows.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {soatNap && (
                <div className="space-y-2 text-sm">
                  {soatNap.soTieuDe.length > 0 && (
                    <p className={soatNap.tieuDeLech ? "font-semibold text-warning" : "text-muted-foreground"}>
                      Tiêu đề sheet ghi: KHO {soatNap.soTieuDe.join(", ")}
                      {soatNap.tieuDeLech && ` — khác kho đang chọn (${napForm.kho}). Kiểm lại trước khi nạp.`}
                    </p>
                  )}
                  {soatNap.khacKho.length > 0 && (
                    <p className="font-semibold text-destructive">
                      Năm {napForm.nam} đã có bản nạp ở{" "}
                      {soatNap.khacKho.map(([k, n]) => `${k} (${n} dòng)`).join(", ")}. Nạp vào {napForm.kho} sẽ
                      tạo BẢN SAO ⇒ "Tất cả kho" cộng đôi. Muốn nạp lại cùng sổ thì chọn đúng kho cũ.
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Nhóm theo mục trong file: {soatNap.nhom.map(([c, n]) => `${c} (${n})`).join(" · ")}
                  </p>
                  {soatNap.gui.length > 0 && (
                    <p className="text-muted-foreground">
                      Vị trí đọc từ cột ghi chú kho: {soatNap.gui.map(([k, n]) => `${k} (${n})`).join(" · ")}. Dòng
                      không ghi kho ⇒ nằm ở chính {napForm.kho}.
                    </p>
                  )}
                </div>
              )}
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
            <Button onClick={xacNhanNap} title="Nạp các sheet đã xem trước vào sổ, theo đúng năm và kho đã chọn. Chọn nhầm kho sẽ tạo bản sao ở kho khác — kiểm lại trước khi bấm.">
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
              tách size để bỏ báo động giả). Đây là chẩn đoán — bấm "Sửa tay" để lọc bảng về đúng mặt
              hàng đó rồi gõ số thẳng trên bảng theo phán đoán (không tự sửa để tránh cộng đôi khi lô bị tách/đổi mã).
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
              Lệch = ghi chép dồn kỳ chưa khớp (tồn đầu tháng này ≠ tồn cuối tháng trước). "Sửa tay" lọc
              bảng về đúng mặt hàng để bạn gõ thẳng tồn đầu/nhập/xuất; hoặc dùng "Dồn sang tháng sau" từ
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
              <Nhan loai="phu">{dongBo.tongTen} tên trong sổ</Nhan>
              <Nhan loai="phu">
                đã có: {dongBo.daCoMH} mặt hàng · {dongBo.daCoNL} loại NL
              </Nhan>
              <Nhan loai={canDongBo.length > 0 ? "loi" : "phu"}>{canDongBo.length} mã khó cần đồng bộ</Nhan>
              <Nhan loai="phu">{dsRoRang.length} tên rõ ràng</Nhan>
              <Nhan loai={dongBo.nhomTrung.length > 0 ? "loi" : "phu"}>{dongBo.nhomTrung.length} nhóm trùng cách ghi</Nhan>
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
                  Các tên trên bị đếm THÀNH NHIỀU mặt hàng khi tổng hợp. Sửa về một cách ghi bằng nút ✎
                  ở bảng để sổ gộp đúng.
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
          {/* Nút xác nhận ở CHÂN (dính đáy khi thân cuộn) — trước nằm giữa thân, dưới các danh sách
              dài nên bị cuộn mất. Không disabled (luật §5): chưa chọn gì ⇒ apDongBo tự báo. */}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoDongBo(false)}>
              Đóng
            </Button>
            {(canDongBo.length > 0 || dsRoRang.length > 0) && (
              <Button onClick={apDongBo} className="h-auto min-h-11 whitespace-normal" title="Thêm các tên chưa có vào danh mục đã chọn, và đổi tên các dòng sổ mang tên cũ sang tên chuẩn đã ánh xạ.">
                <Library className="mr-2 h-4 w-4" />
                Đồng bộ: {soMH} → Mặt hàng · {soNL} → Loại NL
              </Button>
            )}
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

              <KhungCuonNgang>
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
              </KhungCuonNgang>
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
                <ThIn>Size</ThIn>
                <ThIn right>Tồn đầu (kg)</ThIn>
                <ThIn right>Nhập (kg)</ThIn>
                <ThIn right>Xuất (kg)</ThIn>
                <ThIn right>Tồn cuối (kg)</ThIn>
                <ThIn right>Tiền còn lại (đ)</ThIn>
              </tr>
            </thead>
            <tbody>
              <tr>
                <TdIn dam colSpan={2}>Tổng cộng — {rowsIn.length} mặt hàng</TdIn>
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

      {suaKL.hop}
      {suaMH.hop}
      {suaNL.hop}
    </div>
  );
}

/** Một nhóm trên bản in: dòng tiêu đề nhóm + các mặt hàng + dòng cộng nhóm. */
function FragmentGroup({ group }: { group: ReturnType<typeof gomNhom>[number] }) {
  return (
    <>
      <tr>
        <TdIn dam colSpan={7}>{group.category}</TdIn>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.id}>
          <TdIn>{r.itemName}</TdIn>
          <TdIn>{r.size}</TdIn>
          <TdIn right>{num(r.openKg)}</TdIn>
          <TdIn right>{r.inKg ? num(r.inKg) : ""}</TdIn>
          <TdIn right>{r.outKg ? num(r.outKg) : ""}</TdIn>
          <TdIn right>{num(r.closeKg)}</TdIn>
          <TdIn right>{r.remainingValue ? num(Math.round(r.remainingValue)) : ""}</TdIn>
        </tr>
      ))}
      <tr>
        <TdIn dam colSpan={2}>Cộng {group.category}</TdIn>
        <TdIn dam right>{num(group.tong.openKg)}</TdIn>
        <TdIn dam right>{num(group.tong.inKg)}</TdIn>
        <TdIn dam right>{num(group.tong.outKg)}</TdIn>
        <TdIn dam right>{num(group.tong.closeKg)}</TdIn>
        <TdIn dam right>{num(Math.round(group.tong.remainingValue))}</TdIn>
      </tr>
    </>
  );
}
