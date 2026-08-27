// ============================================================
// Tên file: src/features/reports/WarehouseNxtScreen.tsx
// Tên tiếng Việt: Màn hình Báo cáo Xuất – Nhập – Tồn kho (sổ sống, số thật)
// Description: Warehouse Import-Export-Inventory — live ledger from real data
// ============================================================
import { useMemo, useRef, useState } from "react";
import type { NxtSnapshotLine } from "@/types";
import { useNxtSnapshots } from "@/lib/catalogRepo";
import {
  parseNxtExcelFile,
  exportNxtToExcel,
  inferCategory,
  type NxtExcelRow,
} from "@/lib/nxtExcel";
import {
  Badge,
  BangTong,
  Button,
  ChuThichBatBuoc,
  Combobox,
  ConfirmDelete,
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
  LuoiNhap,
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
import { num, viDate } from "@/lib/format";
import {
  ArrowDownToLine,
  CalendarPlus,
  CheckCircle2,
  Download,
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
  Warehouse,
} from "lucide-react";

/** Dòng đã suy tồn cuối (đầu + nhập − xuất). */
interface RowTinh extends NxtSnapshotLine {
  closingKg: number;
}

const keyKy = (r: { periodFrom: string; periodTo: string }) => `${r.periodFrom}|${r.periodTo}`;
const idDong = (kho: string, from: string, to: string, code: string) => `nxt|${kho}|${from}|${to}|${code}`;

/** "Từ ngày 01/07/2026 đến ngày 31/07/2026" → ["2026-07-01","2026-07-31"]. */
function parseKhoangNgay(text: string): [string, string] | null {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return [`${m[3]}-${m[2]}-${m[1]}`, `${m[6]}-${m[5]}-${m[4]}`];
}

/** "Chi nhánh: KHO TP - KHO 1000" → "KHO TP - KHO 1000". */
function parseKho(text: string): string {
  return text.replace(/^\s*Chi nh[aá]nh\s*:\s*/i, "").trim();
}

/**
 * Báo cáo Xuất–Nhập–Tồn kho theo SỐ THẬT (Kho × Mã hàng × Kỳ). Nguồn là snapshot
 * nhập thẳng từ báo cáo của hệ thống xí nghiệp. SỔ SỐNG: (1) tồn cuối = tồn đầu +
 * nhập − xuất, suy tại đây nên bất biến luôn đúng; (2) "Tạo kỳ kế tiếp" tự kế thừa
 * tồn cuối kỳ này thành tồn đầu kỳ sau (hết re-key); (3) chế độ Ghi cho nhập/xuất
 * từng mã ngay trên lưới. Nối tự động với sổ nhập/SX/bán là bước sau (P5-B).
 */
export default function WarehouseNxtScreen() {
  const [snapshots, ghiSnapshots] = useNxtSnapshots();
  const fileRef = useRef<HTMLInputElement>(null);

  const khoOpts: MucChon[] = useMemo(() => {
    const set = new Set<string>();
    for (const r of snapshots) set.add(r.warehouseCode);
    return [...set].sort().map((k) => ({ value: k, label: k }));
  }, [snapshots]);

  const [kho, setKho] = useState("");
  const khoChon = kho || khoOpts[0]?.value || "";

  const kyOpts: MucChon[] = useMemo(() => {
    const set = new Map<string, { from: string; to: string }>();
    for (const r of snapshots) {
      if (khoChon && r.warehouseCode !== khoChon) continue;
      set.set(keyKy(r), { from: r.periodFrom, to: r.periodTo });
    }
    return [...set.entries()]
      .sort((a, b) => b[1].from.localeCompare(a[1].from))
      .map(([k, v]) => ({ value: k, label: `${viDate(v.from)} – ${viDate(v.to)}` }));
  }, [snapshots, khoChon]);

  const [ky, setKy] = useState("");
  const kyChon = ky || kyOpts[0]?.value || "";
  const [tuNgay, denNgay] = kyChon.split("|");

  const rows: RowTinh[] = useMemo(() => {
    return snapshots
      .filter((r) => r.warehouseCode === khoChon && keyKy(r) === kyChon)
      .map((r) => ({ ...r, closingKg: r.openingKg + r.inKg - r.outKg }))
      .sort((a, b) => b.closingKg - a.closingKg);
  }, [snapshots, khoChon, kyChon]);

  const tong = useMemo(() => {
    const t = { tonDau: 0, nhap: 0, xuat: 0, tonCuoi: 0 };
    for (const r of rows) {
      t.tonDau += r.openingKg;
      t.nhap += r.inKg;
      t.xuat += r.outKg;
      t.tonCuoi += r.closingKg;
    }
    return t;
  }, [rows]);

  const batBienDung = Math.abs(tong.tonDau + tong.nhap - tong.xuat - tong.tonCuoi) < 0.001;

  // ---------- Chế độ: xem / ghi ----------
  const [ghiMode, setGhiMode] = useState(false);

  const suaDong = (id: string, patch: Partial<NxtSnapshotLine>) => {
    ghiSnapshots(snapshots.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const xoaDong = (id: string, ten: string) => {
    ghiSnapshots(snapshots.filter((l) => l.id !== id));
    notify.daXoa(`Đã xóa dòng ${ten}`);
  };

  // ---------- Thêm mã ----------
  const [themForm, setThemForm] = useState<{ code: string; name: string } | null>(null);
  const [loiThem, setLoiThem] = useState<LoiNhap[]>([]);

  const luuThemMa = () => {
    if (!themForm) return;
    const ls: LoiNhap[] = [];
    const code = themForm.code.trim();
    const name = themForm.name.trim();
    if (!code) ls.push({ truong: "Mã hàng", thongBao: "Chưa nhập mã hàng" });
    if (!name) ls.push({ truong: "Tên hàng", thongBao: "Chưa nhập tên hàng" });
    if (code && rows.some((r) => r.itemCode === code))
      ls.push({ truong: "Mã hàng", thongBao: "Mã này đã có trong kỳ" });
    setLoiThem(ls);
    if (ls.length) return;
    const moi: NxtSnapshotLine = {
      id: idDong(khoChon, tuNgay, denNgay, code),
      warehouseCode: khoChon,
      periodFrom: tuNgay,
      periodTo: denNgay,
      itemCode: code,
      itemName: name,
      unit: "KG",
      openingKg: 0,
      inKg: 0,
      outKg: 0,
      openingValue: 0,
      inValue: 0,
      outValue: 0,
      note: "",
    };
    ghiSnapshots([...snapshots, moi]);
    setThemForm(null);
    notify.daLuu(`Đã thêm mã ${code}`);
  };

  // ---------- Tạo kỳ kế tiếp (kế thừa tồn) ----------
  const [kyForm, setKyForm] = useState<{ from: string; to: string } | null>(null);
  const [loiKy, setLoiKy] = useState<LoiNhap[]>([]);

  const luuKyMoi = () => {
    if (!kyForm) return;
    const ls: LoiNhap[] = [];
    if (!kyForm.from || !kyForm.to) ls.push({ truong: "Khoảng ngày", thongBao: "Chưa chọn kỳ mới" });
    if (kyForm.from && kyForm.to && kyForm.to < kyForm.from)
      ls.push({ truong: "Khoảng ngày", thongBao: "Đến ngày phải sau từ ngày" });
    if (kyForm.from === tuNgay && kyForm.to === denNgay)
      ls.push({ truong: "Khoảng ngày", thongBao: "Kỳ mới trùng kỳ đang xem" });
    setLoiKy(ls);
    if (ls.length) return;
    const { from, to } = kyForm;
    // Kế thừa: tồn cuối kỳ đang xem → tồn đầu kỳ mới. Nhập/xuất = 0 (chờ ghi).
    const carried: NxtSnapshotLine[] = rows.map((r) => ({
      id: idDong(khoChon, from, to, r.itemCode),
      warehouseCode: khoChon,
      periodFrom: from,
      periodTo: to,
      itemCode: r.itemCode,
      itemName: r.itemName,
      unit: r.unit || "KG",
      openingKg: r.closingKg,
      inKg: 0,
      outKg: 0,
      openingValue: 0,
      inValue: 0,
      outValue: 0,
      note: "",
    }));
    const idMoi = new Set(carried.map((x) => x.id));
    const giuLai = snapshots.filter(
      (r) => !(r.warehouseCode === khoChon && r.periodFrom === from && r.periodTo === to) && !idMoi.has(r.id)
    );
    ghiSnapshots([...giuLai, ...carried]);
    setKyForm(null);
    setKy(`${from}|${to}`);
    setGhiMode(true);
    notify.daLuu(`Đã tạo kỳ ${viDate(from)}–${viDate(to)} · kế thừa tồn đầu ${num(tong.tonCuoi)} kg`);
  };

  const the: TheThongTin[] = [
    { nhan: "Tồn đầu kỳ", giaTri: `${num(tong.tonDau)} kg`, so: true, icon: Snowflake, mau: "trung-tinh" },
    { nhan: "Nhập trong kỳ", giaTri: `${num(tong.nhap)} kg`, so: true, icon: ArrowDownToLine, mau: "brand" },
    { nhan: "Xuất trong kỳ", giaTri: `${num(tong.xuat)} kg`, so: true, icon: Ship, mau: "warning" },
    { nhan: "Tồn cuối kỳ", giaTri: `${num(tong.tonCuoi)} kg`, so: true, icon: Scale, mau: "success" },
  ];

  const cot: CotTong<RowTinh>[] = [
    {
      key: "ma",
      header: "Mã hàng · tên hàng",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{r.itemName}</div>
          <div className="font-mono text-sm text-muted-foreground">{r.itemCode}</div>
        </div>
      ),
    },
    { key: "tonDau", header: "Tồn đầu (kg)", so: true, render: (r) => num(r.openingKg), tong: () => num(tong.tonDau) },
    {
      key: "nhap",
      header: "Nhập (kg)",
      so: true,
      render: (r) => (r.inKg ? <span className="font-semibold text-success">+{num(r.inKg)}</span> : "—"),
      tong: () => num(tong.nhap),
    },
    {
      key: "xuat",
      header: "Xuất (kg)",
      so: true,
      render: (r) => (r.outKg ? <span className="font-semibold text-warning">−{num(r.outKg)}</span> : "—"),
      tong: () => num(tong.xuat),
    },
    {
      key: "tonCuoi",
      header: "Tồn cuối (kg)",
      so: true,
      render: (r) => <span className="tnum font-bold text-foreground">{num(r.closingKg)}</span>,
      tong: () => num(tong.tonCuoi),
    },
  ];

  // ---------- Lưới ghi (chế độ Ghi) ----------
  const cotLuoi: CotLuoi<RowTinh>[] = [
    { key: "tonDau", header: "Tồn đầu", nhan: "Tồn đầu (kg)", kieu: "so", lay: (r) => r.openingKg || null, rong: 110 },
    { key: "nhap", header: "Nhập", nhan: "Nhập (kg)", kieu: "so", lay: (r) => r.inKg || null, rong: 110 },
    { key: "xuat", header: "Xuất", nhan: "Xuất (kg)", kieu: "so", lay: (r) => r.outKg || null, rong: 110 },
    { key: "tonCuoi", header: "Tồn cuối", nhan: "Tồn cuối (kg)", kieu: "tinh", lay: (r) => r.closingKg, rong: 120 },
    {
      key: "xoa",
      header: "",
      nhan: "Xóa dòng",
      kieu: "chu",
      lay: () => null,
      rong: 64,
      oRieng: (r) => (
        <ConfirmDelete
          moTaBanGhi={`${r.itemName} · ${r.itemCode}`}
          onConfirm={() => xoaDong(r.id, r.itemCode)}
          trigger={
            <Button size="sm" variant="ghost" aria-label={`Xóa ${r.itemCode}`}>
              <Trash2 className="size-4" />
            </Button>
          }
        />
      ),
    },
  ];

  const hangLuoi: HangLuoi<RowTinh>[] = rows.map((r) => ({
    id: r.id,
    du: r,
    ten: r.itemName,
    phu: <span className="font-mono">{r.itemCode}</span>,
  }));

  const ghiO = (rowId: string, colKey: string, giaTri: number | null) => {
    const v = giaTri == null ? 0 : giaTri;
    if (colKey === "tonDau") suaDong(rowId, { openingKg: v });
    else if (colKey === "nhap") suaDong(rowId, { inKg: v });
    else if (colKey === "xuat") suaDong(rowId, { outKg: v });
  };

  // ---------- In A4 ----------
  const [moIn, setMoIn] = useState(false);

  // ---------- Excel ----------
  const xuatExcel = () => {
    if (!rows.length) {
      notify.canhBao("Không có số liệu để xuất");
      return;
    }
    const items: NxtExcelRow[] = rows.map((r) => ({
      code: r.itemCode,
      name: r.itemName,
      category: inferCategory(r.itemCode, r.itemName),
      tonDauKg: r.openingKg,
      giaTriDau: r.openingValue,
      nhapKg: r.inKg,
      giaTriNhap: r.inValue,
      xuatKg: r.outKg,
      giaTriXuat: r.outValue,
      tonCuoiKg: r.closingKg,
      giaTriCuoi: r.openingValue + r.inValue - r.outValue,
    }));
    exportNxtToExcel(
      {
        createdDateText: `Ngày lập: ${viDate(homNay())}`,
        title: "Báo cáo xuất nhập tồn",
        dateRangeText: `Từ ngày ${viDate(tuNgay)} đến ngày ${viDate(denNgay)}`,
        warehouseText: `Chi nhánh: ${khoChon}`,
        items,
        totalItemCount: items.length,
        totalTonDauKg: tong.tonDau,
        totalGiaTriDau: rows.reduce((s, r) => s + r.openingValue, 0),
        totalNhapKg: tong.nhap,
        totalGiaTriNhap: rows.reduce((s, r) => s + r.inValue, 0),
        totalXuatKg: tong.xuat,
        totalGiaTriXuat: rows.reduce((s, r) => s + r.outValue, 0),
        totalTonCuoiKg: tong.tonCuoi,
        totalGiaTriCuoi: rows.reduce((s, r) => s + (r.openingValue + r.inValue - r.outValue), 0),
      },
      `Bao-Cao-NXT-Kho-${tuNgay}-${denNgay}.xlsx`
    );
    notify.daLuu("Đã xuất Excel báo cáo Xuất–Nhập–Tồn");
  };

  const chonFile = () => fileRef.current?.click();

  const napFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = await parseNxtExcelFile(file);
      const range = parseKhoangNgay(data.dateRangeText);
      if (!range) {
        notify.canhBao("Không đọc được khoảng ngày trong file (dòng 'Từ ngày… đến ngày…').");
        return;
      }
      const khoFile = parseKho(data.warehouseText) || "KHO (không rõ)";
      const [from, to] = range;
      const moi: NxtSnapshotLine[] = data.items.map((it) => ({
        id: idDong(khoFile, from, to, it.code),
        warehouseCode: khoFile,
        periodFrom: from,
        periodTo: to,
        itemCode: it.code,
        itemName: it.name,
        unit: "KG",
        openingKg: it.tonDauKg,
        inKg: it.nhapKg,
        outKg: it.xuatKg,
        openingValue: it.giaTriDau,
        inValue: it.giaTriNhap,
        outValue: it.giaTriXuat,
        note: "",
      }));
      if (!moi.length) {
        notify.canhBao("File không có dòng dữ liệu nào đọc được.");
        return;
      }
      const idMoi = new Set(moi.map((x) => x.id));
      const giuLai = snapshots.filter(
        (r) => !(r.warehouseCode === khoFile && r.periodFrom === from && r.periodTo === to) && !idMoi.has(r.id)
      );
      ghiSnapshots([...giuLai, ...moi]);
      setKho(khoFile);
      setKy(`${from}|${to}`);
      const sd = moi.reduce((s, r) => s + r.openingKg, 0);
      const sn = moi.reduce((s, r) => s + r.inKg, 0);
      const sx = moi.reduce((s, r) => s + r.outKg, 0);
      notify.daLuu(
        `Đã nạp ${moi.length} mã · ${khoFile} · ${viDate(from)}–${viDate(to)} — tồn cuối ${num(sd + sn - sx)} kg`
      );
    } catch (err) {
      notify.loi(`Không đọc được file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const coDuLieu = snapshots.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Warehouse className="h-8 w-8 text-primary" />
            Báo cáo Xuất – Nhập – Tồn kho
          </h1>
          <p className="mt-1 text-muted-foreground">
            Số thật theo báo cáo của xí nghiệp (Kho × Mã hàng × Kỳ). Tồn cuối = tồn đầu + nhập − xuất.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={napFile} />
          <Button variant="outline" onClick={chonFile}>
            <Upload className="mr-2 h-4 w-4" />
            Nhập Excel báo cáo
          </Button>
          <Button variant="outline" onClick={xuatExcel} disabled={!rows.length}>
            <Download className="mr-2 h-4 w-4" />
            Xuất Excel
          </Button>
          <Button onClick={() => setMoIn(true)} disabled={!rows.length}>
            <Printer className="mr-2 h-4 w-4" />
            In A4
          </Button>
        </div>
      </div>

      {coDuLieu && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[16rem]">
            <Combobox
              label="Kho / chi nhánh"
              anNhanBatBuoc
              choPhepXoa={false}
              value={khoChon}
              onChange={(v) => {
                setKho(v);
                setKy("");
                setGhiMode(false);
              }}
              options={khoOpts}
            />
          </div>
          <div className="min-w-[14rem]">
            <Combobox
              label="Kỳ báo cáo"
              anNhanBatBuoc
              choPhepXoa={false}
              value={kyChon}
              onChange={(v) => {
                setKy(v);
                setGhiMode(false);
              }}
              options={kyOpts}
            />
          </div>
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant={ghiMode ? "default" : "outline"} onClick={() => setGhiMode((v) => !v)}>
                {ghiMode ? <Eye className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
                {ghiMode ? "Xong · xem lại" : "Ghi nhập/xuất"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setKyForm({ from: denNgay, to: "" });
                  setLoiKy([]);
                }}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                Tạo kỳ kế tiếp
              </Button>
            </div>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          tieuDe="Chưa có số liệu Xuất–Nhập–Tồn"
          moTa="Bấm 'Nhập Excel báo cáo' để nạp file NXT xuất từ hệ thống đang dùng (mẫu 10 cột). Số sẽ hiện đúng theo file, rồi bấm 'Tạo kỳ kế tiếp' để kế thừa tồn sang kỳ sau."
        />
      ) : (
        <>
          <ThongKe the={the} />

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
            {batBienDung ? (
              <span className="flex items-center gap-2 text-base font-semibold text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                Khớp bất biến: {num(tong.tonDau)} + {num(tong.nhap)} − {num(tong.xuat)} = {num(tong.tonCuoi)} kg
              </span>
            ) : (
              <span className="text-base font-semibold text-destructive">
                Lệch bất biến — kiểm lại số liệu nguồn (đầu + nhập − xuất ≠ tồn cuối).
              </span>
            )}
            <Badge variant="outline" className="ml-auto">
              SL mặt hàng: {rows.length}
            </Badge>
          </div>

          {ghiMode ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Gõ nhập/xuất từng mã — tồn cuối tự tính. Dán được cả khối từ Excel. Enter/Tab để sang ô.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setThemForm({ code: "", name: "" });
                    setLoiThem([]);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm mã
                </Button>
              </div>
              <LuoiNhap
                moTa={`Sổ Xuất–Nhập–Tồn ${khoChon} kỳ ${viDate(tuNgay)}–${viDate(denNgay)}`}
                cot={cotLuoi}
                hang={hangLuoi}
                onGhiO={ghiO}
                cuoiBang={
                  <tr className="bg-muted font-semibold">
                    <th scope="row" className="sticky left-0 z-10 border-r-2 border-b border-border bg-muted px-4 py-2 text-left">
                      Tổng cộng — {rows.length} mặt hàng
                    </th>
                    <td className="tnum border-b border-l border-border px-3 py-2 text-right">{num(tong.tonDau)}</td>
                    <td className="tnum border-b border-l border-border px-3 py-2 text-right">{num(tong.nhap)}</td>
                    <td className="tnum border-b border-l border-border px-3 py-2 text-right">{num(tong.xuat)}</td>
                    <td className="tnum border-b border-l border-border px-3 py-2 text-right">{num(tong.tonCuoi)}</td>
                    <td className="border-b border-l border-border" />
                  </tr>
                }
              />
            </div>
          ) : (
            <BangTong rows={rows} cot={cot} getKey={(r) => r.id} />
          )}

          <p className="text-sm text-muted-foreground">
            Kho <span className="font-semibold text-foreground">{khoChon}</span> · kỳ {viDate(tuNgay)} –{" "}
            {viDate(denNgay)}. "Tạo kỳ kế tiếp" kế thừa tồn cuối kỳ này thành tồn đầu kỳ sau. Nối tự động
            với sổ nhập/SX/bán là bước sau (cần bảng ánh xạ mã).
          </p>
        </>
      )}

      {/* Dialog thêm mã */}
      <Dialog open={!!themForm} onOpenChange={(o) => !o && setThemForm(null)}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Thêm mã hàng vào kỳ</DialogTitle>
            <DialogDescription className="text-base">
              Thêm một mặt hàng kho vào {khoChon} · kỳ {viDate(tuNgay)}–{viDate(denNgay)}. Tồn đầu/nhập/xuất
              ghi ở lưới.
            </DialogDescription>
          </DialogHeader>
          {themForm && (
            <div className="space-y-4 py-2">
              <ErrorSummary loi={loiThem} />
              <ChuThichBatBuoc />
              <Field label="Mã hàng" required>
                <Input
                  value={themForm.code}
                  onChange={(e) => setThemForm((f) => (f ? { ...f, code: e.target.value } : f))}
                  placeholder="VD: PXĐ.BTNL.TĐ 1001"
                />
              </Field>
              <Field label="Tên hàng" required>
                <Input
                  value={themForm.name}
                  onChange={(e) => setThemForm((f) => (f ? { ...f, name: e.target.value } : f))}
                  placeholder="VD: 2 DA NGUYÊN LIỆU 100-UP F34"
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setThemForm(null)}>
              Hủy
            </Button>
            <Button onClick={luuThemMa}>
              <Plus className="mr-1 h-4 w-4" />
              Thêm mã
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog tạo kỳ kế tiếp */}
      <Dialog open={!!kyForm} onOpenChange={(o) => !o && setKyForm(null)}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tạo kỳ kế tiếp (kế thừa tồn)</DialogTitle>
            <DialogDescription className="text-base">
              Kho {khoChon}. Tồn cuối kỳ đang xem ({num(tong.tonCuoi)} kg · {rows.length} mặt hàng) sẽ thành
              tồn đầu kỳ mới; nhập/xuất để trống chờ ghi.
            </DialogDescription>
          </DialogHeader>
          {kyForm && (
            <div className="space-y-4 py-2">
              <ErrorSummary loi={loiKy} />
              <ChuThichBatBuoc />
              <DateRangeField
                label="Kỳ mới"
                anNhanBatBuoc
                presets={false}
                startDate={kyForm.from}
                endDate={kyForm.to}
                onChange={(a, b) => setKyForm((f) => (f ? { ...f, from: a, to: b } : f))}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKyForm(null)}>
              Hủy
            </Button>
            <Button onClick={luuKyMoi}>
              <CalendarPlus className="mr-1 h-4 w-4" />
              Tạo kỳ · kế thừa tồn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In A4 */}
      {moIn && rows.length > 0 && (
        <PhieuIn
          tieuDe="Báo cáo xuất nhập tồn"
          phuDe={`${khoChon} · từ ${viDate(tuNgay)} đến ${viDate(denNgay)}`}
          onClose={() => setMoIn(false)}
        >
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>Ngày lập: {viDate(homNay())}</span>
            <span>SL mặt hàng: {rows.length}</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <ThIn>Mã hàng</ThIn>
                <ThIn>Tên hàng</ThIn>
                <ThIn right>Tồn đầu</ThIn>
                <ThIn right>Nhập</ThIn>
                <ThIn right>Xuất</ThIn>
                <ThIn right>Tồn cuối</ThIn>
              </tr>
            </thead>
            <tbody>
              <tr>
                <TdIn dam colSpan={2}>
                  Tổng cộng — {rows.length} mặt hàng
                </TdIn>
                <TdIn dam right>{num(tong.tonDau)}</TdIn>
                <TdIn dam right>{num(tong.nhap)}</TdIn>
                <TdIn dam right>{num(tong.xuat)}</TdIn>
                <TdIn dam right>{num(tong.tonCuoi)}</TdIn>
              </tr>
              {rows.map((r) => (
                <tr key={r.id}>
                  <TdIn className="font-mono">{r.itemCode}</TdIn>
                  <TdIn>{r.itemName}</TdIn>
                  <TdIn right>{num(r.openingKg)}</TdIn>
                  <TdIn right>{r.inKg ? num(r.inKg) : ""}</TdIn>
                  <TdIn right>{r.outKg ? num(r.outKg) : ""}</TdIn>
                  <TdIn right>{num(r.closingKg)}</TdIn>
                </tr>
              ))}
            </tbody>
          </table>
        </PhieuIn>
      )}
    </div>
  );
}
