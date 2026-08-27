// ============================================================
// Tên file: src/features/reports/WarehouseNxtScreen.tsx
// Tên tiếng Việt: Màn hình Báo cáo Xuất – Nhập – Tồn kho (số thật)
// Description: Warehouse Import-Export-Inventory report from real snapshots
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
  Combobox,
  EmptyState,
  PhieuIn,
  ThIn,
  TdIn,
  ThongKe,
  homNay,
  notify,
  type CotTong,
  type MucChon,
  type TheThongTin,
} from "@/design-system";
import { num, viDate } from "@/lib/format";
import {
  ArrowDownToLine,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Printer,
  Scale,
  Ship,
  Snowflake,
  Upload,
  Warehouse,
} from "lucide-react";

/** Dòng đã suy tồn cuối (đầu + nhập − xuất). */
interface RowTinh extends NxtSnapshotLine {
  closingKg: number;
}

const keyKy = (r: { periodFrom: string; periodTo: string }) => `${r.periodFrom}|${r.periodTo}`;

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
 * Báo cáo Xuất–Nhập–Tồn kho theo SỐ THẬT của xí nghiệp. Nguồn là snapshot nhập
 * thẳng từ báo cáo NXT xuất từ hệ thống đang dùng (Kho × Mã hàng × Kỳ) — dựng lại
 * khớp 100% con số gốc TRƯỚC khi nối giao dịch sống. Tồn cuối = tồn đầu + nhập −
 * xuất (suy tại đây nên bất biến luôn đúng). Có thể nạp thêm kỳ/kho bằng nút Nhập
 * Excel (mẫu mau-bao-cao-nhap-xuat-ton.xlsx).
 */
export default function WarehouseNxtScreen() {
  const [snapshots, ghiSnapshots] = useNxtSnapshots();
  const fileRef = useRef<HTMLInputElement>(null);

  // Danh sách kho + kỳ có trong dữ liệu
  const khoOpts: MucChon[] = useMemo(() => {
    const set = new Map<string, number>();
    for (const r of snapshots) set.set(r.warehouseCode, (set.get(r.warehouseCode) ?? 0) + 1);
    return [...set.keys()].sort().map((k) => ({ value: k, label: k }));
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

  const [tuNgay, denNgay] = kyChon.split("|");
  const batBienDung = Math.abs(tong.tonDau + tong.nhap - tong.xuat - tong.tonCuoi) < 0.001;

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

  // ----- In A4 -----
  const [moIn, setMoIn] = useState(false);

  // ----- Xuất Excel (10 cột chuẩn) -----
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

  // ----- Nhập Excel báo cáo thật -----
  const chonFile = () => fileRef.current?.click();

  const napFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại cùng file
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
        id: `nxt|${khoFile}|${from}|${to}|${it.code}`,
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
      // Thay trọn kỳ+kho này bằng dữ liệu mới (nhập lại = ghi đè, không nhân đôi).
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
              onChange={setKy}
              options={kyOpts}
            />
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          tieuDe="Chưa có số liệu Xuất–Nhập–Tồn"
          moTa="Bấm 'Nhập Excel báo cáo' để nạp file NXT xuất từ hệ thống đang dùng (theo mẫu 10 cột: Mã · Tên · Tồn đầu · Nhập · Xuất · Tồn cuối + giá trị). Số sẽ hiện đúng theo file."
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

          <BangTong rows={rows} cot={cot} getKey={(r) => r.id} />

          <p className="text-sm text-muted-foreground">
            Kho <span className="font-semibold text-foreground">{khoChon}</span> · kỳ {viDate(tuNgay)} –{" "}
            {viDate(denNgay)}. Cột giá trị (tiền) giữ theo file gốc và có trong bản Xuất Excel / In A4.
          </p>
        </>
      )}

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
