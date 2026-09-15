// ============================================================
// Tên file: src/features/reports/WarehouseNxtScreen.tsx
// Tên tiếng Việt: Màn hình Báo cáo Xuất – Nhập – Tồn kho (sổ sống, số thật)
// Description: Warehouse Import-Export-Inventory — live ledger from real data
// ============================================================
import { useMemo, useRef, useState } from "react";
import type { NxtSnapshotLine } from "@/types";
import { KHO_LUU_MAC_DINH, STORAGE_KIND_LABELS } from "@/types";
import { useNxtSnapshots, useStorageLocations } from "@/lib/catalogRepo";
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
  type ChonBang,
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
  PackageOpen,
} from "lucide-react";

/** Dòng đã suy tồn cuối (đầu + nhập − xuất). */
interface RowTinh extends NxtSnapshotLine {
  closingKg: number;
}

const TAT_CA = "__tat_ca__";

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
  const [khoLuuDM] = useStorageLocations();
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

  /** Dòng của kho/kỳ đang xem — TRƯỚC khi lọc theo kho lưu (để cộng theo kho lưu). */
  const rowsKy: RowTinh[] = useMemo(() => {
    return snapshots
      .filter((r) => r.warehouseCode === khoChon && keyKy(r) === kyChon)
      .map((r) => ({ ...r, closingKg: r.openingKg + r.inKg - r.outKg }))
      .sort((a, b) => b.closingKg - a.closingKg);
  }, [snapshots, khoChon, kyChon]);

  // ---------- Chiều KHO LƯU (kho nhà / kho lạnh thuê ngoài) ----------
  /** Tên kho lưu hiển thị của một dòng — rỗng nghĩa là chưa gán ⇒ kho nhà. */
  const khoLuuCua = (r: { storageLocation: string }) => r.storageLocation || KHO_LUU_MAC_DINH;

  const khoLuuOpts: MucChon[] = useMemo(() => {
    const set = new Set<string>([KHO_LUU_MAC_DINH]);
    for (const k of khoLuuDM) if (k.name.trim()) set.add(k.name.trim());
    for (const r of snapshots) if (r.storageLocation) set.add(r.storageLocation);
    const loai = new Map(khoLuuDM.map((k) => [k.name.trim(), k.kind]));
    return [...set].sort().map((n) => ({
      value: n,
      label: n,
      phu: loai.has(n) ? STORAGE_KIND_LABELS[loai.get(n)!] : undefined,
    }));
  }, [khoLuuDM, snapshots]);

  const [khoLuuLoc, setKhoLuuLoc] = useState(TAT_CA);

  /** Cộng tồn cuối theo từng kho lưu (dải chip dưới thẻ số liệu). */
  const theoKhoLuu = useMemo(() => {
    const m = new Map<string, { tonCuoi: number; soMa: number }>();
    for (const r of rowsKy) {
      const k = khoLuuCua(r);
      const g = m.get(k) ?? { tonCuoi: 0, soMa: 0 };
      g.tonCuoi += r.closingKg;
      g.soMa += 1;
      m.set(k, g);
    }
    return [...m.entries()].sort((a, b) => b[1].tonCuoi - a[1].tonCuoi);
  }, [rowsKy]);

  const rows: RowTinh[] = useMemo(
    () => (khoLuuLoc === TAT_CA ? rowsKy : rowsKy.filter((r) => khoLuuCua(r) === khoLuuLoc)),
    [rowsKy, khoLuuLoc]
  );

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

  // ---------- Tick dòng: cộng tổng + gán kho lưu theo lô ----------
  const [daChon, setDaChon] = useState<Set<string>>(new Set());
  const chonBang: ChonBang<RowTinh> = {
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
        for (const k of keys) if (bat) next.add(k);
          else next.delete(k);
        return next;
      }),
    nhanDong: (r) => `${r.itemName} · ${r.itemCode}`,
  };
  const rowsChon = useMemo(() => rows.filter((r) => daChon.has(r.id)), [rows, daChon]);
  const tongChon = useMemo(() => {
    const t = { tonDau: 0, nhap: 0, xuat: 0, tonCuoi: 0 };
    for (const r of rowsChon) {
      t.tonDau += r.openingKg;
      t.nhap += r.inKg;
      t.xuat += r.outKg;
      t.tonCuoi += r.closingKg;
    }
    return t;
  }, [rowsChon]);

  const [ganForm, setGanForm] = useState<string | null>(null); // kho lưu sắp gán

  /** Gán kho lưu cho các dòng đang tick (một lần ghi, hoàn tác được bằng gán lại). */
  const ganKhoLuu = () => {
    const dich = (ganForm ?? "").trim();
    if (!dich) {
      notify.canhBao("Chưa chọn kho lưu để gán.");
      return;
    }
    const ids = new Set(rowsChon.map((r) => r.id));
    if (!ids.size) {
      notify.canhBao("Chưa tick dòng nào.");
      return;
    }
    ghiSnapshots(snapshots.map((l) => (ids.has(l.id) ? { ...l, storageLocation: dich } : l)));
    setGanForm(null);
    setDaChon(new Set());
    notify.daLuu(`Đã gán ${ids.size} mã về ${dich}`);
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
      storageLocation: khoLuuLoc === TAT_CA ? KHO_LUU_MAC_DINH : khoLuuLoc,
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
      storageLocation: r.storageLocation,
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
    {
      key: "khoLuu",
      header: "Kho lưu",
      render: (r) => (
        <Badge variant={r.storageLocation && r.storageLocation !== KHO_LUU_MAC_DINH ? "default" : "outline"}>
          {khoLuuCua(r)}
        </Badge>
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
            <Button
              title="Xóa mã hàng này khỏi kỳ đang xem." size="sm" variant="ghost" aria-label={`Xóa ${r.itemCode}`}>
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
      // Báo cáo của xí nghiệp KHÔNG có chiều kho lưu ⇒ nạp về kho nhà; gán lại
      // các lô gửi kho thuê ngoài bằng nút "Gán kho lưu" (tick dòng rồi gán theo lô).
      const moi: NxtSnapshotLine[] = data.items.map((it) => ({
        id: idDong(khoFile, from, to, it.code),
        warehouseCode: khoFile,
        storageLocation: KHO_LUU_MAC_DINH,
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
          <Button variant="outline" onClick={chonFile} title="Đọc file Excel báo cáo Xuất–Nhập–Tồn xuất từ hệ thống xí nghiệp (mẫu 10 cột). Nạp lại cùng kho + cùng kỳ chỉ cập nhật, không nhân đôi dòng.">
            <Upload className="mr-2 h-4 w-4" />
            Nhập Excel báo cáo
          </Button>
          <Button variant="outline" onClick={xuatExcel} disabled={!rows.length} title="Tải kỳ đang xem ra file Excel đúng mẫu báo cáo của xí nghiệp, để gửi kế toán hoặc lưu hồ sơ.">
            <Download className="mr-2 h-4 w-4" />
            Xuất Excel
          </Button>
          <Button onClick={() => setMoIn(true)} disabled={!rows.length} title="Xem trước bản in A4 của kỳ đang xem, rồi in giấy hoặc lưu PDF.">
            <Printer className="mr-2 h-4 w-4" />
            In A4
          </Button>
        </div>
      </div>

      {coDuLieu && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 sm:min-w-[16rem]">
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
                setDaChon(new Set());
              }}
              options={kyOpts}
            />
          </div>
          <div className="min-w-0 sm:min-w-[14rem]">
            <Combobox
              label="Kho lưu"
              anNhanBatBuoc
              choPhepXoa={false}
              value={khoLuuLoc}
              onChange={(v) => {
                setKhoLuuLoc(v);
                setDaChon(new Set());
              }}
              options={[{ value: TAT_CA, label: "Tất cả kho lưu" }, ...khoLuuOpts]}
            />
          </div>
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={ghiMode ? "default" : "outline"}
                onClick={() => setGhiMode((v) => !v)}
                title={
                  ghiMode
                    ? "Thoát chế độ ghi, quay về bảng xem."
                    : "Bật lưới gõ tồn đầu / nhập / xuất từng mã. Tồn cuối tự tính, dán được cả khối từ Excel."
                }
              >
                {ghiMode ? <Eye className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
                {ghiMode ? "Xong · xem lại" : "Ghi nhập/xuất"}
              </Button>
              <Button
                variant="outline"
                title="Mở một kỳ báo cáo mới và lấy tồn cuối kỳ này làm tồn đầu kỳ đó (kèm cả kho lưu) — khỏi gõ lại từ đầu."
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

          {/* Tồn cuối theo từng KHO LƯU — trả lời "hàng đang nằm ở kho nào" */}
          {theoKhoLuu.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <PackageOpen className="h-4 w-4 text-primary" aria-hidden />
                Tồn cuối theo kho lưu:
              </span>
              {theoKhoLuu.map(([ten, g]) => (
                <button
                  title="Chỉ xem các mã đang nằm ở kho này. Bấm lần nữa để xem lại tất cả kho."
                  key={ten}
                  type="button"
                  onClick={() => {
                    setKhoLuuLoc(khoLuuLoc === ten ? TAT_CA : ten);
                    setDaChon(new Set());
                  }}
                  className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted"
                  aria-pressed={khoLuuLoc === ten}
                >
                  <span className="font-medium text-foreground">{ten}</span>{" "}
                  <span className="tnum text-muted-foreground">
                    {num(g.tonCuoi)} kg · {g.soMa} mã
                  </span>
                </button>
              ))}
              {khoLuuLoc !== TAT_CA && (
                <Button size="sm" variant="ghost" onClick={() => setKhoLuuLoc(TAT_CA)} title="Bỏ lọc theo kho lưu — xem lại toàn bộ mã của kỳ này.">
                  Xem tất cả kho lưu
                </Button>
              )}
            </div>
          )}

          {/* Thanh dòng đã tick: cộng tổng + gán kho lưu theo lô */}
          {rowsChon.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
              <span className="font-semibold text-foreground">Đã chọn {rowsChon.length} mã</span>
              <span className="tnum text-sm text-muted-foreground">
                tồn đầu {num(tongChon.tonDau)} · nhập {num(tongChon.nhap)} · xuất {num(tongChon.xuat)} ·{" "}
                <span className="font-semibold text-foreground">tồn cuối {num(tongChon.tonCuoi)} kg</span>
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setGanForm(khoLuuLoc === TAT_CA ? KHO_LUU_MAC_DINH : khoLuuLoc)}
                  title="Ghi lại các mã đang tick là đang nằm ở một kho khác (kho nhà hay kho lạnh thuê ngoài). Sửa danh sách kho ở Danh mục → Kho lưu trữ."
                >
                  <PackageOpen className="mr-2 h-4 w-4" />
                  Gán kho lưu
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDaChon(new Set())} title="Bỏ tick toàn bộ các mã đang chọn.">
                  Bỏ chọn
                </Button>
              </div>
            </div>
          )}

          {ghiMode ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Gõ nhập/xuất từng mã — tồn cuối tự tính. Dán được cả khối từ Excel. Enter/Tab để sang ô.
                </p>
                <Button
                  variant="outline"
                  title="Thêm một mã hàng chưa có trong kỳ này (VD mã mới phát sinh giữa kỳ). Số liệu gõ ở lưới bên dưới."
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
            <BangTong rows={rows} cot={cot} getKey={(r) => r.id} chon={chonBang} />
          )}

          <p className="text-sm text-muted-foreground">
            Kho <span className="font-semibold text-foreground">{khoChon}</span> · kỳ {viDate(tuNgay)} –{" "}
            {viDate(denNgay)}
            {khoLuuLoc === TAT_CA ? " · tất cả kho lưu" : ` · kho lưu ${khoLuuLoc}`}. Tick dòng để cộng tổng
            hoặc gán kho lưu theo lô. "Tạo kỳ kế tiếp" kế thừa tồn cuối kỳ này (kèm kho lưu) thành tồn đầu kỳ
            sau. Nối tự động với sổ nhập/SX/bán là bước sau (cần bảng ánh xạ mã).
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
            <Button onClick={luuThemMa} title="Thêm mã này vào kỳ đang xem với tồn đầu / nhập / xuất = 0.">
              <Plus className="mr-1 h-4 w-4" />
              Thêm mã
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog gán kho lưu cho các dòng đã tick */}
      <Dialog open={ganForm !== null} onOpenChange={(o) => !o && setGanForm(null)}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Gán kho lưu</DialogTitle>
            <DialogDescription className="text-base">
              {rowsChon.length} mã đang chọn ({num(tongChon.tonCuoi)} kg tồn cuối) sẽ được ghi là đang nằm ở
              kho dưới đây. Sửa danh sách kho ở Danh mục → Kho lưu trữ.
            </DialogDescription>
          </DialogHeader>
          {ganForm !== null && (
            <div className="space-y-4 py-2">
              <ChuThichBatBuoc />
              <Combobox
                label="Kho lưu"
                required
                value={ganForm}
                onChange={(v) => setGanForm(v)}
                options={khoLuuOpts}
                choPhepXoa={false}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGanForm(null)}>
              Hủy
            </Button>
            <Button onClick={ganKhoLuu} title="Ghi kho lưu vừa chọn cho tất cả mã đang tick.">
              <PackageOpen className="mr-1 h-4 w-4" />
              Gán {rowsChon.length} mã
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
            <Button onClick={luuKyMoi} title="Tạo kỳ mới và ghi tồn cuối kỳ hiện tại thành tồn đầu kỳ đó. Nhập/xuất để trống chờ ghi.">
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
          phuDe={`${khoChon} · từ ${viDate(tuNgay)} đến ${viDate(denNgay)}${
            khoLuuLoc === TAT_CA ? "" : ` · kho lưu ${khoLuuLoc}`
          }`}
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
                <ThIn>Kho lưu</ThIn>
                <ThIn right>Tồn đầu</ThIn>
                <ThIn right>Nhập</ThIn>
                <ThIn right>Xuất</ThIn>
                <ThIn right>Tồn cuối</ThIn>
              </tr>
            </thead>
            <tbody>
              <tr>
                <TdIn dam colSpan={3}>
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
                  <TdIn>{khoLuuCua(r)}</TdIn>
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
