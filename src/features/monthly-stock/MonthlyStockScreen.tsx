// ============================================================
// Tên file: src/features/monthly-stock/MonthlyStockScreen.tsx
// Tên tiếng Việt: Sổ kho theo THÁNG — dồn tồn cuối kỳ → đầu kỳ sau
// Description: Monthly stock ledger — carry closing balance into next month
// ============================================================
import { useMemo, useRef, useState } from "react";
import type { MonthlyStockLine } from "@/types";
import { MONTHLY_STOCK_CATEGORIES } from "@/types";
import { useMonthlyStock } from "@/lib/catalogRepo";
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
  type MonthlyStockRow,
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
  type CotLuoi,
  type CotTong,
  type HangLuoi,
  type LoiNhap,
  type MucChon,
  type TheThongTin,
} from "@/design-system";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Coins,
  Eye,
  FileSpreadsheet,
  Pencil,
  Plus,
  Printer,
  Scale,
  Ship,
  Snowflake,
  Trash2,
  Upload,
} from "lucide-react";

const TAT_CA_KHO = "__tat_ca__";

/** Form thêm/sửa một dòng (phần mô tả + số liệu đầy đủ). */
interface DongForm {
  id: string | null; // null = thêm mới
  category: string;
  warehouse: string;
  itemName: string;
  size: string;
  origin: string;
  importDate: string;
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

  const [thang, setThang] = useState(thangHienTai());
  const [kho, setKho] = useState(TAT_CA_KHO);
  const [ghiMode, setGhiMode] = useState(false);
  const [moIn, setMoIn] = useState(false);

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
    const set = new Set<string>();
    for (const l of lines) if (l.warehouse) set.add(l.warehouse);
    return [
      { value: TAT_CA_KHO, label: "Tất cả kho" },
      ...[...set].sort().map((k) => ({ value: k, label: k })),
    ];
  }, [lines]);

  // ---------- Dòng của tháng đang xem ----------
  const rowsThang: MonthlyStockRow[] = useMemo(() => {
    return lines
      .filter((l) => l.period === thang && (kho === TAT_CA_KHO || l.warehouse === kho))
      .map(suyDong);
  }, [lines, thang, kho]);

  const nhomList = useMemo(() => gomNhom(rowsThang), [rowsThang]);
  const tong = useMemo(() => tongDong(rowsThang), [rowsThang]);
  const batBienDung = Math.abs(tong.openKg + tong.inKg - tong.outKg - tong.closeKg) < 0.001;

  // Tháng liền trước (mọi kho — dồn kỳ không bỏ sót kho nào).
  const thangTr = thangTruoc(thang);
  const rowsTruoc = useMemo(
    () => lines.filter((l) => l.period === thangTr).map(suyDong),
    [lines, thangTr]
  );

  // Dồn sang tháng sau dùng TOÀN BỘ dòng của tháng (mọi kho), không theo bộ lọc.
  const rowsThangDayDu = useMemo(
    () => lines.filter((l) => l.period === thang).map(suyDong),
    [lines, thang]
  );
  const coTonSang = rowsThangDayDu.some(
    (r) => Math.abs(r.closeKg) > 1e-9 || Math.abs(r.closeCtn) > 1e-9
  );

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
    const catGoiY = nhomList[0]?.category || MONTHLY_STOCK_CATEGORIES[0];
    const khoGoiY = kho !== TAT_CA_KHO ? kho : khoOpts[1]?.value ?? "";
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
      setNapForm({ sheets, nam: namTuTenFile(file.name), kho: "Kho 1500T" });
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
    for (const sh of sheets) {
      if (sh.monthNum == null) continue;
      const period = `${nam}-${String(sh.monthNum).padStart(2, "0")}`;
      sh.rows.forEach((r, idx) => {
        moi.push({
          id: `xlsx|${sh.sheetName}|${nam}|${r.rowIndex}`,
          period,
          category: r.category,
          warehouse: khoNap.trim(),
          itemName: r.itemName,
          size: r.size,
          origin: r.origin,
          importDate: r.importDate,
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
    ghiLines([...giuLai, ...moi]);
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

  // ---------- Cột bảng xem (đầy đủ như bảng kê) ----------
  const cot = (t: ReturnType<typeof tongDong>): CotTong<MonthlyStockRow>[] => [
    {
      key: "ten",
      header: "Mặt hàng",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{r.itemName}</div>
          <div className="text-sm text-muted-foreground">
            {[r.size, r.origin, r.importDate ? `nhập ${viDate(r.importDate)}` : ""].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      ),
    },
    { key: "kgCtn", header: "KG/kiện", so: true, render: (r) => soHoacGach(r.kgPerCtn ?? 0) },
    { key: "gia", header: "Đơn giá (đ)", so: true, render: (r) => soHoacGach(r.unitPrice ?? 0) },
    { key: "odCtn", header: "Tồn đầu (kiện)", so: true, render: (r) => soHoacGach(r.openCtn), tong: () => num(t.openCtn) },
    { key: "odKg", header: "Tồn đầu (kg)", so: true, render: (r) => soHoacGach(r.openKg), tong: () => num(t.openKg) },
    {
      key: "inCtn", header: "Nhập (kiện)", so: true,
      render: (r) => soHoacGach(r.inCtn), tong: () => num(t.inCtn),
    },
    {
      key: "inKg", header: "Nhập (kg)", so: true,
      render: (r) => (r.inKg ? <span className="font-semibold text-success">+{num(r.inKg)}</span> : "—"),
      tong: () => num(t.inKg),
    },
    { key: "outCtn", header: "Xuất (kiện)", so: true, render: (r) => soHoacGach(r.outCtn), tong: () => num(t.outCtn) },
    {
      key: "outKg", header: "Xuất (kg)", so: true,
      render: (r) => (r.outKg ? <span className="font-semibold text-warning">−{num(r.outKg)}</span> : "—"),
      tong: () => num(t.outKg),
    },
    { key: "ocCtn", header: "Tồn cuối (kiện)", so: true, render: (r) => soHoacGach(r.closeCtn), tong: () => num(t.closeCtn) },
    {
      key: "ocKg", header: "Tồn cuối (kg)", so: true,
      render: (r) => <span className="tnum font-bold text-foreground">{num(r.closeKg)}</span>,
      tong: () => num(t.closeKg),
    },
    {
      key: "tien", header: "Tiền còn lại (đ)", so: true,
      render: (r) => (r.remainingValue ? num(Math.round(r.remainingValue)) : "—"),
      tong: () => num(Math.round(t.remainingValue)),
    },
    {
      key: "thaotac", header: "", render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" aria-label={`Sửa ${r.itemName}`} onClick={() => moSua(r)}>
            <Pencil className="size-4" />
          </Button>
          <ConfirmDelete
            moTaBanGhi={`${r.itemName}${r.size ? " · " + r.size : ""}`}
            onConfirm={() => xoaDong(r)}
            trigger={
              <Button size="sm" variant="ghost" aria-label={`Xóa ${r.itemName}`}>
                <Trash2 className="size-4" />
              </Button>
            }
          />
        </div>
      ),
    },
  ];

  // ---------- Lưới ghi (nhập/xuất từng mã) ----------
  const cotLuoi: CotLuoi<MonthlyStockRow>[] = [
    { key: "openCtn", header: "Tồn đầu (kiện)", nhan: "Tồn đầu (kiện)", kieu: "so", lay: (r) => r.openCtn || null, rong: 110 },
    { key: "openKg", header: "Tồn đầu (kg)", nhan: "Tồn đầu (kg)", kieu: "so", lay: (r) => r.openKg || null, rong: 120 },
    { key: "inCtn", header: "Nhập (kiện)", nhan: "Nhập (kiện)", kieu: "so", lay: (r) => r.inCtn || null, rong: 110 },
    { key: "inKg", header: "Nhập (kg)", nhan: "Nhập (kg)", kieu: "so", lay: (r) => r.inKg || null, rong: 120 },
    { key: "outCtn", header: "Xuất (kiện)", nhan: "Xuất (kiện)", kieu: "so", lay: (r) => r.outCtn || null, rong: 110 },
    { key: "outKg", header: "Xuất (kg)", nhan: "Xuất (kg)", kieu: "so", lay: (r) => r.outKg || null, rong: 120 },
    { key: "ocKg", header: "Tồn cuối (kg)", nhan: "Tồn cuối (kg)", kieu: "tinh", lay: (r) => r.closeKg, rong: 130 },
    {
      key: "xoa", header: "", nhan: "Xóa dòng", kieu: "chu", lay: () => null, rong: 60,
      oRieng: (r) => (
        <ConfirmDelete
          moTaBanGhi={`${r.itemName}${r.size ? " · " + r.size : ""}`}
          onConfirm={() => xoaDong(r)}
          trigger={
            <Button size="sm" variant="ghost" aria-label={`Xóa ${r.itemName}`}>
              <Trash2 className="size-4" />
            </Button>
          }
        />
      ),
    },
  ];
  const hangLuoi: HangLuoi<MonthlyStockRow>[] = rowsThang.map((r) => ({
    id: r.id,
    du: r,
    ten: r.itemName,
    phu: <span className="text-muted-foreground">{[r.category, r.size].filter(Boolean).join(" · ")}</span>,
  }));

  const coDuLieu = rowsThang.length > 0;

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
          <Button variant="outline" onClick={chonFile}>
            <Upload className="mr-2 h-4 w-4" />
            Nhập Excel bảng kê
          </Button>
          <Button variant="outline" onClick={moThem}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm dòng
          </Button>
          <Button onClick={() => setMoIn(true)} disabled={!coDuLieu}>
            <Printer className="mr-2 h-4 w-4" />
            In A4
          </Button>
        </div>
      </div>

      {/* Bộ lọc: tháng + kho */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-full items-end gap-1 sm:w-auto">
          <Button
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
            onChange={setKho}
            options={khoOpts}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {coDuLieu && (
            <Button variant={ghiMode ? "default" : "outline"} onClick={() => setGhiMode((v) => !v)}>
              {ghiMode ? <Eye className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
              {ghiMode ? "Xong · xem lại" : "Ghi nhập/xuất"}
            </Button>
          )}
          {coTonSang && (
            <Button variant="outline" onClick={donSangThangSau}>
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
              <Button onClick={donTuThangTruoc}>
                <ArrowDownToLine className="mr-2 h-4 w-4" />
                Kế thừa tồn cuối {nhanThang(thangTr)}
              </Button>
            ) : (
              <Button onClick={moThem}>
                <Plus className="mr-2 h-4 w-4" />
                Thêm dòng
              </Button>
            )
          }
        />
      ) : (
        <>
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

          {ghiMode ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Gõ tồn đầu / nhập / xuất từng mã (kiện & kg) — tồn cuối tự tính. Dán được cả khối từ Excel.
                Enter/Tab sang ô. Sửa mô tả (tên, size, đơn giá) bằng nút ✎ ở chế độ xem.
              </p>
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
                  <BangTong rows={g.rows} cot={cot(g.tong)} getKey={(r) => r.id} nhanTong={`Cộng ${g.category}`} />
                </section>
              ))}
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
              {nhanThang(thang)} — nhập đủ tồn đầu · nhập · xuất (kiện & kg). Tồn cuối và tiền còn lại tự tính.
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
                <Field label="Kho">
                  <Input
                    value={form.warehouse}
                    onChange={(e) => setForm((f) => (f ? { ...f, warehouse: e.target.value } : f))}
                    placeholder="VD: Kho 1500T"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
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
                <Field label="Xuất xứ">
                  <Input
                    value={form.origin}
                    onChange={(e) => setForm((f) => (f ? { ...f, origin: e.target.value } : f))}
                    placeholder="VD: SB"
                  />
                </Field>
                <DateField
                  label="Ngày nhập"
                  value={form.importDate}
                  onChange={(v) => setForm((f) => (f ? { ...f, importDate: v } : f))}
                />
                <NumberField
                  label="KG/kiện"
                  unit="kg"
                  value={form.kgPerCtn}
                  onChange={(v) => setForm((f) => (f ? { ...f, kgPerCtn: v } : f))}
                />
                <NumberField
                  label="Đơn giá"
                  unit="đ"
                  value={form.unitPrice}
                  onChange={(v) => setForm((f) => (f ? { ...f, unitPrice: v } : f))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField label="Tồn đầu (kiện)" unit="kiện" value={form.openCtn} onChange={(v) => setForm((f) => (f ? { ...f, openCtn: v } : f))} />
                <NumberField label="Nhập (kiện)" unit="kiện" value={form.inCtn} onChange={(v) => setForm((f) => (f ? { ...f, inCtn: v } : f))} />
                <NumberField label="Xuất (kiện)" unit="kiện" value={form.outCtn} onChange={(v) => setForm((f) => (f ? { ...f, outCtn: v } : f))} />
                <NumberField label="Tồn đầu (kg)" unit="kg" value={form.openKg} onChange={(v) => setForm((f) => (f ? { ...f, openKg: v } : f))} />
                <NumberField label="Nhập (kg)" unit="kg" value={form.inKg} onChange={(v) => setForm((f) => (f ? { ...f, inKg: v } : f))} />
                <NumberField label="Xuất (kg)" unit="kg" value={form.outKg} onChange={(v) => setForm((f) => (f ? { ...f, outKg: v } : f))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Hủy
            </Button>
            <Button onClick={luuDong}>
              <Plus className="mr-1 h-4 w-4" />
              {form?.id ? "Lưu dòng" : "Thêm dòng"}
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
              Mỗi sheet = một tháng. Nạp tồn đầu · nhập · xuất (kiện & kg) đúng theo file — tồn cuối &
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
                <Field label="Kho">
                  <Input
                    value={napForm.kho}
                    onChange={(e) => setNapForm((f) => (f ? { ...f, kho: e.target.value } : f))}
                    placeholder="VD: Kho 1500T"
                  />
                </Field>
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
            <Button onClick={xacNhanNap} disabled={soDongNap === 0}>
              <Upload className="mr-1 h-4 w-4" />
              Nạp {soDongNap} dòng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In A4 */}
      {moIn && coDuLieu && (
        <PhieuIn
          tieuDe="Bảng kê kho theo tháng"
          phuDe={`${nhanThang(thang)}${kho !== TAT_CA_KHO ? ` · kho ${kho}` : ""}`}
          onClose={() => setMoIn(false)}
        >
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>Ngày lập: {viDate(homNay())}</span>
            <span>SL mặt hàng: {rowsThang.length}</span>
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
                <TdIn dam>Tổng cộng — {rowsThang.length} mặt hàng</TdIn>
                <TdIn dam right>{num(tong.openKg)}</TdIn>
                <TdIn dam right>{num(tong.inKg)}</TdIn>
                <TdIn dam right>{num(tong.outKg)}</TdIn>
                <TdIn dam right>{num(tong.closeKg)}</TdIn>
                <TdIn dam right>{num(Math.round(tong.remainingValue))}</TdIn>
              </tr>
              {nhomList.map((g) => (
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
