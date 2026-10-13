// ============================================================
// Tên file: src/features/reports/WarehouseNxtScreen.tsx
// Tên tiếng Việt: Màn hình Báo cáo Xuất – Nhập – Tồn kho (sổ sống, số thật)
// Description: Warehouse Import-Export-Inventory — live ledger from real data
// ============================================================
import { useMemo, useRef, useState } from "react";
import type { NxtSnapshotLine, StorageLocation } from "@/types";
import { KHO_LUU_MAC_DINH, STORAGE_KIND_LABELS } from "@/types";
import { useNxtSnapshots, useStorageLocations } from "@/lib/catalogRepo";
import {
  parseNxtExcelFile,
  exportNxtToExcel,
  inferCategory,
  type NxtExcelRow,
} from "@/lib/nxtExcel";
import {
  Nhan,
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
  NutToMauChon,
  useToMau,
} from "@/design-system";
import { useSuaDanhMuc } from "@/features/catalog/SuaDanhMucNhanh";
import { num, viDate } from "@/lib/format";
import { newId } from "@/lib/store";
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
interface ComputedRow extends NxtSnapshotLine {
  closingKg: number;
}

const ALL = "__tat_ca__";

const keyKy = (r: { periodFrom: string; periodTo: string }) => `${r.periodFrom}|${r.periodTo}`;
const idDong = (warehouse: string, from: string, to: string, code: string) => `nxt|${warehouse}|${from}|${to}|${code}`;
/** yyyy-mm-dd → ngày hôm sau (tính theo UTC, không lệch múi giờ). */
const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** "Từ ngày 01/07/2026 đến ngày 31/07/2026" → ["2026-07-01","2026-07-31"]. */
function parseDateRange(text: string): [string, string] | null {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return [`${m[3]}-${m[2]}-${m[1]}`, `${m[6]}-${m[5]}-${m[4]}`];
}

/** "Chi nhánh: KHO TP - KHO 1000" → "KHO TP - KHO 1000". */
function parseWarehouse(text: string): string {
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
  const [snapshots, setSnapshots] = useNxtSnapshots();
  const [storageLocationCatalog, setStorageLocationCatalog] = useStorageLocations();
  /** Bút chì sửa nhanh danh mục ngay trong ô chọn. */
  const storageLocationEditor = useSuaDanhMuc("khoLuu", storageLocationCatalog, setStorageLocationCatalog, { theo: "ten" });
  const fileRef = useRef<HTMLInputElement>(null);

  const warehouseOpts: MucChon[] = useMemo(() => {
    const set = new Set<string>();
    for (const r of snapshots) set.add(r.warehouseCode);
    return [...set].sort().map((k) => ({ value: k, label: k }));
  }, [snapshots]);

  const [warehouse, setWarehouse] = useState("");
  const selectedWarehouse = warehouse || warehouseOpts[0]?.value || "";

  const kyOpts: MucChon[] = useMemo(() => {
    const set = new Map<string, { from: string; to: string }>();
    for (const r of snapshots) {
      if (selectedWarehouse && r.warehouseCode !== selectedWarehouse) continue;
      set.set(keyKy(r), { from: r.periodFrom, to: r.periodTo });
    }
    return [...set.entries()]
      .sort((a, b) => b[1].from.localeCompare(a[1].from))
      .map(([k, v]) => ({ value: k, label: `${viDate(v.from)} – ${viDate(v.to)}` }));
  }, [snapshots, selectedWarehouse]);

  const [ky, setKy] = useState("");
  const selectedPeriod = ky || kyOpts[0]?.value || "";
  const [fromDate, toDate] = selectedPeriod.split("|");

  /** Dòng của kho/kỳ đang xem — TRƯỚC khi lọc theo kho lưu (để cộng theo kho lưu). */
  const rowsKy: ComputedRow[] = useMemo(() => {
    return snapshots
      .filter((r) => r.warehouseCode === selectedWarehouse && keyKy(r) === selectedPeriod)
      .map((r) => ({ ...r, closingKg: r.openingKg + r.inKg - r.outKg }))
      .sort((a, b) => b.closingKg - a.closingKg);
  }, [snapshots, selectedWarehouse, selectedPeriod]);

  // ---------- Chiều KHO LƯU (kho nhà / kho lạnh thuê ngoài) ----------
  /** Tên kho lưu hiển thị của một dòng — rỗng nghĩa là chưa gán ⇒ kho nhà. */
  const storageLocationOf = (r: { storageLocation: string }) => r.storageLocation || KHO_LUU_MAC_DINH;

  const storageLocationOpts: MucChon[] = useMemo(() => {
    const set = new Set<string>([KHO_LUU_MAC_DINH]);
    for (const k of storageLocationCatalog) if (k.name.trim()) set.add(k.name.trim());
    for (const r of snapshots) if (r.storageLocation) set.add(r.storageLocation);
    const kindByName = new Map(storageLocationCatalog.map((k) => [k.name.trim(), k.kind]));
    return [...set].sort().map((n) => ({
      value: n,
      label: n,
      phu: kindByName.has(n) ? STORAGE_KIND_LABELS[kindByName.get(n)!] : undefined,
    }));
  }, [storageLocationCatalog, snapshots]);

  /**
   * Thêm kho lưu tại chỗ (ô "Kho lưu" ở hộp Gán) — lưu ngay vào Danh mục → Kho lưu
   * trữ, mặc định loại "thuê ngoài" (kho nhà đã có sẵn). Value của ô là TÊN.
   * Trùng tên (không phân hoa thường) ⇒ dùng lại kho có sẵn.
   */
  const addStorageLocation = (ten: string) => {
    const sach = ten.trim();
    const khoa = sach.toLowerCase();
    const co =
      storageLocationCatalog.find((k) => k.name.trim().toLowerCase() === khoa)?.name.trim() ??
      storageLocationOpts.find((o) => o.value.toLowerCase() === khoa)?.value;
    if (co) return co;
    const k: StorageLocation = {
      id: newId(),
      code: "",
      name: sach,
      kind: "thue-ngoai",
      address: "",
      phone: "",
      note: "",
    };
    setStorageLocationCatalog([...storageLocationCatalog, k]);
    notify.daLuu(`Đã thêm kho lưu "${sach}" vào danh mục`);
    return sach;
  };

  const [storageLocationFilter, setStorageLocationFilter] = useState(ALL);

  /** Cộng tồn cuối theo từng kho lưu (dải chip dưới thẻ số liệu). */
  const byStorageLocation = useMemo(() => {
    const m = new Map<string, { tonCuoi: number; soMa: number }>();
    for (const r of rowsKy) {
      const k = storageLocationOf(r);
      const g = m.get(k) ?? { tonCuoi: 0, soMa: 0 };
      g.tonCuoi += r.closingKg;
      g.soMa += 1;
      m.set(k, g);
    }
    return [...m.entries()].sort((a, b) => b[1].tonCuoi - a[1].tonCuoi);
  }, [rowsKy]);

  const rows: ComputedRow[] = useMemo(
    () => (storageLocationFilter === ALL ? rowsKy : rowsKy.filter((r) => storageLocationOf(r) === storageLocationFilter)),
    [rowsKy, storageLocationFilter]
  );

  const total = useMemo(() => {
    const t = { tonDau: 0, nhap: 0, xuat: 0, tonCuoi: 0 };
    for (const r of rows) {
      t.tonDau += r.openingKg;
      t.nhap += r.inKg;
      t.xuat += r.outKg;
      t.tonCuoi += r.closingKg;
    }
    return t;
  }, [rows]);

  const invariantHolds = Math.abs(total.tonDau + total.nhap - total.xuat - total.tonCuoi) < 0.001;

  // ---------- Chế độ: xem / ghi ----------
  const [isEditMode, setIsEditMode] = useState(false);

  const editRow = (id: string, patch: Partial<NxtSnapshotLine>) => {
    setSnapshots(snapshots.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeRow = (id: string, ten: string) => {
    setSnapshots(snapshots.filter((l) => l.id !== id));
    notify.daXoa(`Đã xóa dòng ${ten}`);
  };

  // ---------- Tick dòng: cộng tổng + gán kho lưu theo lô ----------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const tableSelection: ChonBang<ComputedRow> = {
    daChon: selected,
    doi: (k) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      }),
    doiTatCa: (keys, bat) =>
      setSelected((prev) => {
        const next = new Set(prev);
        for (const k of keys) if (bat) next.add(k);
          else next.delete(k);
        return next;
      }),
    nhanDong: (r) => `${r.itemName} · ${r.itemCode}`,
  };
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  // Tô màu dòng đang tick — cùng khoá với BangTong/LuoiNhap toMau="nxt-kho".
  const rowMark = useToMau("nxt-kho");
  const selectedTotal = useMemo(() => {
    const t = { tonDau: 0, nhap: 0, xuat: 0, tonCuoi: 0 };
    for (const r of selectedRows) {
      t.tonDau += r.openingKg;
      t.nhap += r.inKg;
      t.xuat += r.outKg;
      t.tonCuoi += r.closingKg;
    }
    return t;
  }, [selectedRows]);

  const [assignLocation, setAssignLocation] = useState<string | null>(null); // kho lưu sắp gán

  /** Gán kho lưu cho các dòng đang tick (một lần ghi, hoàn tác được bằng gán lại). */
  const assignStorageLocation = () => {
    const target = (assignLocation ?? "").trim();
    if (!target) {
      notify.canhBao("Chưa chọn kho lưu để gán.");
      return;
    }
    const ids = new Set(selectedRows.map((r) => r.id));
    if (!ids.size) {
      notify.canhBao("Chưa tick dòng nào.");
      return;
    }
    setSnapshots(snapshots.map((l) => (ids.has(l.id) ? { ...l, storageLocation: target } : l)));
    setAssignLocation(null);
    setSelected(new Set());
    notify.daLuu(`Đã gán ${ids.size} mã về ${target}`);
  };

  // ---------- Thêm mã ----------
  const [addForm, setAddForm] = useState<{ code: string; name: string } | null>(null);
  const [addErrors, setAddErrors] = useState<LoiNhap[]>([]);

  const saveAddCode = () => {
    if (!addForm) return;
    const ls: LoiNhap[] = [];
    const code = addForm.code.trim();
    const name = addForm.name.trim();
    if (!code) ls.push({ truong: "Mã hàng", thongBao: "Chưa nhập mã hàng" });
    if (!name) ls.push({ truong: "Tên hàng", thongBao: "Chưa nhập tên hàng" });
    if (code && rows.some((r) => r.itemCode === code))
      ls.push({ truong: "Mã hàng", thongBao: "Mã này đã có trong kỳ" });
    setAddErrors(ls);
    if (ls.length) return;
    const newLines: NxtSnapshotLine = {
      id: idDong(selectedWarehouse, fromDate, toDate, code),
      warehouseCode: selectedWarehouse,
      storageLocation: storageLocationFilter === ALL ? KHO_LUU_MAC_DINH : storageLocationFilter,
      periodFrom: fromDate,
      periodTo: toDate,
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
    setSnapshots([...snapshots, newLines]);
    setAddForm(null);
    notify.daLuu(`Đã thêm mã ${code}`);
  };

  // ---------- Tạo kỳ kế tiếp (kế thừa tồn) ----------
  const [kyForm, setKyForm] = useState<{ from: string; to: string } | null>(null);
  const [periodErrors, setPeriodErrors] = useState<LoiNhap[]>([]);

  const saveNewPeriod = () => {
    if (!kyForm) return;
    const ls: LoiNhap[] = [];
    if (!kyForm.from || !kyForm.to) ls.push({ truong: "Khoảng ngày", thongBao: "Chưa chọn kỳ mới" });
    if (kyForm.from && kyForm.to && kyForm.to < kyForm.from)
      ls.push({ truong: "Khoảng ngày", thongBao: "Đến ngày phải sau từ ngày" });
    if (kyForm.from === fromDate && kyForm.to === toDate)
      ls.push({ truong: "Khoảng ngày", thongBao: "Kỳ mới trùng kỳ đang xem" });
    setPeriodErrors(ls);
    if (ls.length) return;
    const { from, to } = kyForm;
    // Kế thừa: tồn cuối kỳ đang xem → tồn đầu kỳ mới. Nhập/xuất = 0 (chờ ghi). Lấy MỌI dòng
    // của kỳ (`rowsKy`), KHÔNG theo chip kho lưu đang lọc — lọc chỉ để xem, dồn mà thiếu dòng
    // là mất tồn. Giá trị đầu kỳ mới = giá trị cuối kỳ này (đầu + nhập − xuất).
    const carried: NxtSnapshotLine[] = rowsKy.map((r) => ({
      id: idDong(selectedWarehouse, from, to, r.itemCode),
      warehouseCode: selectedWarehouse,
      storageLocation: r.storageLocation,
      periodFrom: from,
      periodTo: to,
      itemCode: r.itemCode,
      itemName: r.itemName,
      unit: r.unit || "KG",
      openingKg: r.closingKg,
      inKg: 0,
      outKg: 0,
      openingValue: (r.openingValue ?? 0) + (r.inValue ?? 0) - (r.outValue ?? 0),
      inValue: 0,
      outValue: 0,
      note: "",
    }));
    // Kỳ đích đã có dòng (tạo lại / đã gõ nhập-xuất): CHỈ đổi tồn đầu của đúng mã đang dồn,
    // giữ nhập/xuất, kho lưu, ghi chú; dòng khác của kỳ đích (thêm tay) để nguyên — trước đây
    // xoá cả kỳ đích ⇒ mất số đã gõ (cùng tinh thần dồn kỳ Sổ kho tháng).
    const theoId = new Map(carried.map((c) => [c.id, c]));
    const existing = new Set<string>();
    const updatedLines = snapshots.map((l) => {
      const c = theoId.get(l.id);
      if (!c) return l;
      existing.add(l.id);
      return { ...l, openingKg: c.openingKg, openingValue: c.openingValue };
    });
    setSnapshots([...updatedLines, ...carried.filter((c) => !existing.has(c.id))]);
    setKyForm(null);
    setKy(`${from}|${to}`);
    setStorageLocationFilter(ALL);
    setIsEditMode(true);
    const totalKg = carried.reduce((t, c) => t + c.openingKg, 0);
    notify.daLuu(
      `Đã tạo kỳ ${viDate(from)}–${viDate(to)} · kế thừa tồn đầu ${num(totalKg)} kg · ${carried.length} mã` +
        (existing.size ? ` (${existing.size} mã đã có: chỉ cập nhật tồn đầu, giữ nhập/xuất)` : "")
    );
  };

  const the: TheThongTin[] = [
    { nhan: "Tồn đầu kỳ", giaTri: `${num(total.tonDau)} kg`, so: true, icon: Snowflake, mau: "trung-tinh" },
    { nhan: "Nhập trong kỳ", giaTri: `${num(total.nhap)} kg`, so: true, icon: ArrowDownToLine, mau: "brand" },
    { nhan: "Xuất trong kỳ", giaTri: `${num(total.xuat)} kg`, so: true, icon: Ship, mau: "warning" },
    { nhan: "Tồn cuối kỳ", giaTri: `${num(total.tonCuoi)} kg`, so: true, icon: Scale, mau: "success" },
  ];

  const columns: CotTong<ComputedRow>[] = [
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
        <Nhan loai={r.storageLocation && r.storageLocation !== KHO_LUU_MAC_DINH ? "vi-tri" : "phu"}>
          {storageLocationOf(r)}
        </Nhan>
      ),
    },
    { key: "tonDau", header: "Tồn đầu (kg)", so: true, render: (r) => num(r.openingKg), tong: () => num(total.tonDau) },
    {
      key: "nhap",
      header: "Nhập (kg)",
      so: true,
      render: (r) => (r.inKg ? <span className="font-semibold text-success">+{num(r.inKg)}</span> : "—"),
      tong: () => num(total.nhap),
    },
    {
      key: "xuat",
      header: "Xuất (kg)",
      so: true,
      render: (r) => (r.outKg ? <span className="font-semibold text-warning">−{num(r.outKg)}</span> : "—"),
      tong: () => num(total.xuat),
    },
    {
      key: "tonCuoi",
      header: "Tồn cuối (kg)",
      so: true,
      render: (r) => <span className="tnum font-bold text-foreground">{num(r.closingKg)}</span>,
      tong: () => num(total.tonCuoi),
    },
  ];

  // ---------- Lưới ghi (chế độ Ghi) ----------
  const gridColumns: CotLuoi<ComputedRow>[] = [
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
          onConfirm={() => removeRow(r.id, r.itemCode)}
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

  const gridRows: HangLuoi<ComputedRow>[] = rows.map((r) => ({
    id: r.id,
    du: r,
    ten: r.itemName,
    phu: <span className="font-mono">{r.itemCode}</span>,
  }));

  const writeCell = (rowId: string, colKey: string, value: number | null) => {
    const v = value == null ? 0 : value;
    if (colKey === "tonDau") editRow(rowId, { openingKg: v });
    else if (colKey === "nhap") editRow(rowId, { inKg: v });
    else if (colKey === "xuat") editRow(rowId, { outKg: v });
  };

  // ---------- In A4 ----------
  const [moIn, setMoIn] = useState(false);

  // ---------- Excel ----------
  const exportExcel = () => {
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
        dateRangeText: `Từ ngày ${viDate(fromDate)} đến ngày ${viDate(toDate)}`,
        warehouseText: `Chi nhánh: ${selectedWarehouse}`,
        items,
        totalItemCount: items.length,
        totalTonDauKg: total.tonDau,
        totalGiaTriDau: rows.reduce((s, r) => s + r.openingValue, 0),
        totalNhapKg: total.nhap,
        totalGiaTriNhap: rows.reduce((s, r) => s + r.inValue, 0),
        totalXuatKg: total.xuat,
        totalGiaTriXuat: rows.reduce((s, r) => s + r.outValue, 0),
        totalTonCuoiKg: total.tonCuoi,
        totalGiaTriCuoi: rows.reduce((s, r) => s + (r.openingValue + r.inValue - r.outValue), 0),
      },
      `Bao-Cao-NXT-Kho-${fromDate}-${toDate}.xlsx`
    );
    // Không toast: trình duyệt đã tự báo tải file xong (README luật 8 — xuất file là thao tác không đổi số).
  };

  const pickFile = () => fileRef.current?.click();

  const napFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = await parseNxtExcelFile(file);
      const range = parseDateRange(data.dateRangeText);
      if (!range) {
        notify.canhBao("Không đọc được khoảng ngày trong file (dòng 'Từ ngày… đến ngày…').");
        return;
      }
      const fileWarehouse = parseWarehouse(data.warehouseText) || "KHO (không rõ)";
      const [from, to] = range;
      // Báo cáo của xí nghiệp KHÔNG có chiều kho lưu ⇒ nạp về kho nhà; gán lại
      // các lô gửi kho thuê ngoài bằng nút "Gán kho lưu" (tick dòng rồi gán theo lô).
      const newLines: NxtSnapshotLine[] = data.items.map((it) => ({
        id: idDong(fileWarehouse, from, to, it.code),
        warehouseCode: fileWarehouse,
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
      if (!newLines.length) {
        notify.canhBao("File không có dòng dữ liệu nào đọc được.");
        return;
      }
      const newIds = new Set(newLines.map((x) => x.id));
      const giuLai = snapshots.filter(
        (r) => !(r.warehouseCode === fileWarehouse && r.periodFrom === from && r.periodTo === to) && !newIds.has(r.id)
      );
      setSnapshots([...giuLai, ...newLines]);
      setWarehouse(fileWarehouse);
      setKy(`${from}|${to}`);
      const sd = newLines.reduce((s, r) => s + r.openingKg, 0);
      const sn = newLines.reduce((s, r) => s + r.inKg, 0);
      const productionKg = newLines.reduce((s, r) => s + r.outKg, 0);
      notify.daLuu(
        `Đã nạp ${newLines.length} mã · ${fileWarehouse} · ${viDate(from)}–${viDate(to)} — tồn cuối ${num(sd + sn - productionKg)} kg`
      );
    } catch (err) {
      notify.loi(`Không đọc được file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const hasData = snapshots.length > 0;

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
          <Button variant="outline" onClick={pickFile} title="Đọc file Excel báo cáo Xuất–Nhập–Tồn xuất từ hệ thống xí nghiệp (mẫu 10 cột). Nạp lại cùng kho + cùng kỳ chỉ cập nhật, không nhân đôi dòng.">
            <Upload className="mr-2 h-4 w-4" />
            Nhập Excel báo cáo
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={!rows.length} title="Tải kỳ đang xem ra file Excel đúng mẫu báo cáo của xí nghiệp, để gửi kế toán hoặc lưu hồ sơ.">
            <Download className="mr-2 h-4 w-4" />
            Xuất Excel
          </Button>
          <Button onClick={() => setMoIn(true)} disabled={!rows.length} title="Xem trước bản in A4 của kỳ đang xem, rồi in giấy hoặc lưu PDF.">
            <Printer className="mr-2 h-4 w-4" />
            In A4
          </Button>
        </div>
      </div>

      {hasData && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 sm:min-w-[16rem]">
            <Combobox
              label="Kho / chi nhánh"
              anNhanBatBuoc
              choPhepXoa={false}
              value={selectedWarehouse}
              onChange={(v) => {
                setWarehouse(v);
                setKy("");
                setIsEditMode(false);
              }}
              options={warehouseOpts}
            />
          </div>
          <div className="min-w-[14rem]">
            <Combobox
              label="Kỳ báo cáo"
              anNhanBatBuoc
              choPhepXoa={false}
              value={selectedPeriod}
              onChange={(v) => {
                setKy(v);
                setIsEditMode(false);
                setSelected(new Set());
              }}
              options={kyOpts}
            />
          </div>
          <div className="min-w-0 sm:min-w-[14rem]">
            <Combobox
              label="Kho lưu"
              anNhanBatBuoc
              choPhepXoa={false}
              value={storageLocationFilter}
              onChange={(v) => {
                setStorageLocationFilter(v);
                setSelected(new Set());
              }}
              options={[{ value: ALL, label: "Tất cả kho lưu" }, ...storageLocationOpts]}
            />
          </div>
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={isEditMode ? "default" : "outline"}
                onClick={() => setIsEditMode((v) => !v)}
                title={
                  isEditMode
                    ? "Thoát chế độ ghi, quay về bảng xem."
                    : "Bật lưới gõ tồn đầu / nhập / xuất từng mã. Tồn cuối tự tính, dán được cả khối từ Excel."
                }
              >
                {isEditMode ? <Eye className="mr-2 h-4 w-4" /> : <Pencil className="mr-2 h-4 w-4" />}
                {isEditMode ? "Xong · xem lại" : "Ghi nhập/xuất"}
              </Button>
              <Button
                variant="outline"
                title="Mở một kỳ báo cáo mới và lấy tồn cuối kỳ này làm tồn đầu kỳ đó (kèm cả kho lưu) — khỏi gõ lại từ đầu."
                onClick={() => {
                  setKyForm({ from: nextDay(toDate), to: "" });
                  setPeriodErrors([]);
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
            {invariantHolds ? (
              <span className="flex items-center gap-2 text-base font-semibold text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                Khớp bất biến: {num(total.tonDau)} + {num(total.nhap)} − {num(total.xuat)} = {num(total.tonCuoi)} kg
              </span>
            ) : (
              <span className="text-base font-semibold text-destructive">
                Lệch bất biến — kiểm lại số liệu nguồn (đầu + nhập − xuất ≠ tồn cuối).
              </span>
            )}
            <Nhan loai="phu" className="ml-auto">
              SL mặt hàng: {rows.length}
            </Nhan>
          </div>

          {/* Tồn cuối theo từng KHO LƯU — trả lời "hàng đang nằm ở kho nào" */}
          {byStorageLocation.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <PackageOpen className="h-4 w-4 text-primary" aria-hidden />
                Tồn cuối theo kho lưu:
              </span>
              {byStorageLocation.map(([ten, g]) => (
                <button
                  title="Chỉ xem các mã đang nằm ở kho này. Bấm lần nữa để xem lại tất cả kho."
                  key={ten}
                  type="button"
                  onClick={() => {
                    setStorageLocationFilter(storageLocationFilter === ten ? ALL : ten);
                    setSelected(new Set());
                  }}
                  className="min-h-9 rounded-full border border-border px-3 py-1 text-sm hover:bg-muted"
                  aria-pressed={storageLocationFilter === ten}
                >
                  <span className="font-medium text-foreground">{ten}</span>{" "}
                  <span className="tnum text-muted-foreground">
                    {num(g.tonCuoi)} kg · {g.soMa} mã
                  </span>
                </button>
              ))}
              {storageLocationFilter !== ALL && (
                <Button size="sm" variant="ghost" onClick={() => setStorageLocationFilter(ALL)} title="Bỏ lọc theo kho lưu — xem lại toàn bộ mã của kỳ này.">
                  Xem tất cả kho lưu
                </Button>
              )}
            </div>
          )}

          {isEditMode ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Gõ nhập/xuất từng mã — tồn cuối tự tính. Dán được cả khối từ Excel. Enter/Tab để sang ô.
                </p>
                <Button
                  variant="outline"
                  title="Thêm một mã hàng chưa có trong kỳ này (VD mã mới phát sinh giữa kỳ). Số liệu gõ ở lưới bên dưới."
                  onClick={() => {
                    setAddForm({ code: "", name: "" });
                    setAddErrors([]);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm mã
                </Button>
              </div>
              <LuoiNhap
                moTa={`Sổ Xuất–Nhập–Tồn ${selectedWarehouse} kỳ ${viDate(fromDate)}–${viDate(toDate)}`}
                cot={gridColumns}
                hang={gridRows}
                toMau="nxt-kho"
                onGhiO={writeCell}
                cuoiBang={
                  <tr className="bg-muted font-semibold">
                    <th scope="row" className="sticky left-0 z-10 border-r-2 border-b border-border bg-muted px-4 py-2 text-left">
                      Tổng cộng — {rows.length} mặt hàng
                    </th>
                    <td className="tnum border-b border-l border-border px-3 py-2 text-right">{num(total.tonDau)}</td>
                    <td className="tnum border-b border-l border-border px-3 py-2 text-right">{num(total.nhap)}</td>
                    <td className="tnum border-b border-l border-border px-3 py-2 text-right">{num(total.xuat)}</td>
                    <td className="tnum border-b border-l border-border px-3 py-2 text-right">{num(total.tonCuoi)}</td>
                    <td className="border-b border-l border-border" />
                  </tr>
                }
              />
            </div>
          ) : (
            <BangTong rows={rows} cot={columns} getKey={(r) => r.id} chon={tableSelection} dinhDau toMau="nxt-kho" />
          )}

          {/* Thanh dòng đã tick: cộng tổng + tô màu + gán kho lưu theo lô. Đặt SAU bảng và
              DÍNH ĐÁY màn hình từ md: tick dòng cuối bảng vẫn thấy nút, khỏi lăn ngược lên
              (điện thoại không dính — thanh nhiều nút sẽ che gần hết màn). */}
          {selectedRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-card p-3 print:hidden md:sticky md:bottom-3 md:z-30 md:shadow-lg">
              <span className="font-semibold text-foreground">Đã chọn {selectedRows.length} mã</span>
              <span className="tnum text-sm text-muted-foreground">
                tồn đầu {num(selectedTotal.tonDau)} · nhập {num(selectedTotal.nhap)} · xuất {num(selectedTotal.xuat)} ·{" "}
                <span className="font-semibold text-foreground">tồn cuối {num(selectedTotal.tonCuoi)} kg</span>
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <NutToMauChon to={rowMark} khoa={selectedRows.map((r) => r.id)} />
                <Button
                  size="sm"
                  onClick={() => setAssignLocation(storageLocationFilter === ALL ? KHO_LUU_MAC_DINH : storageLocationFilter)}
                  title="Ghi lại các mã đang tick là đang nằm ở một kho khác (kho nhà hay kho lạnh thuê ngoài). Sửa danh sách kho ở Danh mục → Kho lưu trữ."
                >
                  <PackageOpen className="mr-2 h-4 w-4" />
                  Gán kho lưu
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} title="Bỏ tick toàn bộ các mã đang chọn.">
                  Bỏ chọn
                </Button>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Kho <span className="font-semibold text-foreground">{selectedWarehouse}</span> · kỳ {viDate(fromDate)} –{" "}
            {viDate(toDate)}
            {storageLocationFilter === ALL ? " · tất cả kho lưu" : ` · kho lưu ${storageLocationFilter}`}. Tick dòng để cộng tổng
            hoặc gán kho lưu theo lô. "Tạo kỳ kế tiếp" kế thừa tồn cuối kỳ này (kèm kho lưu) thành tồn đầu kỳ
            sau. Nối tự động với sổ nhập/SX/bán là bước sau (cần bảng ánh xạ mã).
          </p>
        </>
      )}

      {/* Dialog thêm mã */}
      <Dialog open={!!addForm} onOpenChange={(o) => !o && setAddForm(null)}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Thêm mã hàng vào kỳ</DialogTitle>
            <DialogDescription className="text-base">
              Thêm một mặt hàng kho vào {selectedWarehouse} · kỳ {viDate(fromDate)}–{viDate(toDate)}. Tồn đầu/nhập/xuất
              ghi ở lưới.
            </DialogDescription>
          </DialogHeader>
          {addForm && (
            <div className="space-y-4 py-2">
              <ErrorSummary loi={addErrors} />
              <ChuThichBatBuoc />
              <Field label="Mã hàng" required>
                <Input
                  value={addForm.code}
                  onChange={(e) => setAddForm((f) => (f ? { ...f, code: e.target.value } : f))}
                  placeholder="VD: PXĐ.BTNL.TĐ 1001"
                />
              </Field>
              <Field label="Tên hàng" required>
                <Input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => (f ? { ...f, name: e.target.value } : f))}
                  placeholder="VD: 2 DA NGUYÊN LIỆU 100-UP F34"
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddForm(null)}>
              Hủy
            </Button>
            <Button onClick={saveAddCode} title="Thêm mã này vào kỳ đang xem với tồn đầu / nhập / xuất = 0.">
              <Plus className="mr-1 h-4 w-4" />
              Thêm mã
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog gán kho lưu cho các dòng đã tick */}
      <Dialog open={assignLocation !== null} onOpenChange={(o) => !o && setAssignLocation(null)}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Gán kho lưu</DialogTitle>
            <DialogDescription className="text-base">
              {selectedRows.length} mã đang chọn ({num(selectedTotal.tonCuoi)} kg tồn cuối) sẽ được ghi là đang nằm ở
              kho dưới đây. Chưa có kho thì gõ tên rồi bấm Thêm mới; bút chì để sửa thông tin kho.
            </DialogDescription>
          </DialogHeader>
          {assignLocation !== null && (
            <div className="space-y-4 py-2">
              <ChuThichBatBuoc />
              <Combobox
                label="Kho lưu"
                required
                value={assignLocation}
                onChange={(v) => setAssignLocation(v)}
                options={storageLocationOpts}
                onCreate={addStorageLocation}
                onSuaMuc={storageLocationEditor.moSua}
                nhanSua={storageLocationEditor.nhanSua}
                suaDuoc={storageLocationEditor.suaDuoc}
                choPhepXoa={false}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignLocation(null)}>
              Hủy
            </Button>
            <Button onClick={assignStorageLocation} title="Ghi kho lưu vừa chọn cho tất cả mã đang tick.">
              <PackageOpen className="mr-1 h-4 w-4" />
              Gán {selectedRows.length} mã
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
              Kho {selectedWarehouse}. Tồn cuối kỳ đang xem ({num(rowsKy.reduce((t, r) => t + r.closingKg, 0))} kg ·{" "}
              {rowsKy.length} mặt hàng, mọi kho lưu — không theo chip đang lọc) sẽ thành tồn đầu kỳ mới; nhập/xuất
              để trống chờ ghi. Kỳ mới đã có mã nào thì chỉ cập nhật tồn đầu mã đó, giữ số đã ghi.
            </DialogDescription>
          </DialogHeader>
          {kyForm && (
            <div className="space-y-4 py-2">
              <ErrorSummary loi={periodErrors} />
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
            <Button onClick={saveNewPeriod} title="Tạo kỳ mới và ghi tồn cuối kỳ hiện tại thành tồn đầu kỳ đó. Nhập/xuất để trống chờ ghi.">
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
          phuDe={`${selectedWarehouse} · từ ${viDate(fromDate)} đến ${viDate(toDate)}${
            storageLocationFilter === ALL ? "" : ` · kho lưu ${storageLocationFilter}`
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
                <TdIn dam right>{num(total.tonDau)}</TdIn>
                <TdIn dam right>{num(total.nhap)}</TdIn>
                <TdIn dam right>{num(total.xuat)}</TdIn>
                <TdIn dam right>{num(total.tonCuoi)}</TdIn>
              </tr>
              {rows.map((r) => (
                <tr key={r.id}>
                  <TdIn className="font-mono">{r.itemCode}</TdIn>
                  <TdIn>{r.itemName}</TdIn>
                  <TdIn>{storageLocationOf(r)}</TdIn>
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
      {storageLocationEditor.hop}
    </div>
  );
}
