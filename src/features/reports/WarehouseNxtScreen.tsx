// ============================================================
// Tên file: src/features/reports/WarehouseNxtScreen.tsx
// Tên tiếng Việt: Màn hình Báo cáo Xuất – Nhập – Tồn kho (sổ sống, số thật)
// Description: Warehouse Import-Export-Inventory — live ledger from real data
// ============================================================
import { useMemo, useRef, useState } from "react";
import type { NxtSnapshotLine, StorageLocation } from "@/types";
import { DEFAULT_STORAGE_LOCATION, STORAGE_KIND_LABELS } from "@/types";
import { useNxtSnapshots, useStorageLocations } from "@/lib/catalogRepo";
import {
  parseNxtExcelFile,
  exportNxtToExcel,
  inferCategory,
  type NxtExcelRow,
} from "@/lib/nxtExcel";
import {
  Tag,
  SummaryTable,
  Button,
  RequiredLegend,
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
  EditableGrid,
  PrintSheet,
  PrintTd,
  PrintTh,
  StatCardGrid,
  ReadOnlyBadge,
  todayIso,
  notify,
  type TableSelection,
  type GridColumn,
  type SummaryTableColumn,
  type GridRow,
  type FieldError,
  type ComboboxOption,
  type StatCardData,
  RowMarkActions,
  useRowMarkTools,
} from "@/design-system";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { useCan } from "@/features/shared/PermissionProvider";
import { num, formatDateVN } from "@/lib/format";
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

const periodKey = (r: { periodFrom: string; periodTo: string }) => `${r.periodFrom}|${r.periodTo}`;
const snapshotRowId = (warehouse: string, from: string, to: string, code: string) => `nxt|${warehouse}|${from}|${to}|${code}`;
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
  // Phân quyền lớp 2: tài nguyên `nxt-warehouse` chỉ có view / import / export — mọi
  // thao tác ghi sổ NXT (nạp file, lưới ghi, thêm mã, gán kho lưu, tạo kỳ) theo `import`.
  const allowed = useCan("nxt-warehouse");
  const canWrite = allowed.import;
  const [snapshots, setSnapshots] = useNxtSnapshots();
  const [storageLocationCatalog, setStorageLocationCatalog] = useStorageLocations();
  /** Bút chì sửa nhanh danh mục ngay trong ô chọn. */
  const storageLocationEditor = useQuickCatalogEdit("storageLocation", storageLocationCatalog, setStorageLocationCatalog, { matchBy: "name" });
  const fileRef = useRef<HTMLInputElement>(null);

  const warehouseOpts: ComboboxOption[] = useMemo(() => {
    const set = new Set<string>();
    for (const r of snapshots) set.add(r.warehouseCode);
    return [...set].sort().map((k) => ({ value: k, label: k }));
  }, [snapshots]);

  const [warehouse, setWarehouse] = useState("");
  const selectedWarehouse = warehouse || warehouseOpts[0]?.value || "";

  const periodOptions: ComboboxOption[] = useMemo(() => {
    const set = new Map<string, { from: string; to: string }>();
    for (const r of snapshots) {
      if (selectedWarehouse && r.warehouseCode !== selectedWarehouse) continue;
      set.set(periodKey(r), { from: r.periodFrom, to: r.periodTo });
    }
    return [...set.entries()]
      .sort((a, b) => b[1].from.localeCompare(a[1].from))
      .map(([k, v]) => ({ value: k, label: `${formatDateVN(v.from)} – ${formatDateVN(v.to)}` }));
  }, [snapshots, selectedWarehouse]);

  const [period, setPeriod] = useState("");
  const selectedPeriod = period || periodOptions[0]?.value || "";
  const [fromDate, toDate] = selectedPeriod.split("|");

  /** Dòng của kho/kỳ đang xem — TRƯỚC khi lọc theo kho lưu (để cộng theo kho lưu). */
  const periodRows: ComputedRow[] = useMemo(() => {
    return snapshots
      .filter((r) => r.warehouseCode === selectedWarehouse && periodKey(r) === selectedPeriod)
      .map((r) => ({ ...r, closingKg: r.openingKg + r.inKg - r.outKg }))
      .sort((a, b) => b.closingKg - a.closingKg);
  }, [snapshots, selectedWarehouse, selectedPeriod]);

  // ---------- Chiều KHO LƯU (kho nhà / kho lạnh thuê ngoài) ----------
  /** Tên kho lưu hiển thị của một dòng — rỗng nghĩa là chưa gán ⇒ kho nhà. */
  const storageLocationOf = (r: { storageLocation: string }) => r.storageLocation || DEFAULT_STORAGE_LOCATION;

  const storageLocationOpts: ComboboxOption[] = useMemo(() => {
    const set = new Set<string>([DEFAULT_STORAGE_LOCATION]);
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
  const addStorageLocation = (name: string) => {
    const trimmedName = name.trim();
    const nameKey = trimmedName.toLowerCase();
    const existing =
      storageLocationCatalog.find((k) => k.name.trim().toLowerCase() === nameKey)?.name.trim() ??
      storageLocationOpts.find((o) => o.value.toLowerCase() === nameKey)?.value;
    if (existing) return existing;
    const k: StorageLocation = {
      id: newId(),
      code: "",
      name: trimmedName,
      kind: "external",
      address: "",
      phone: "",
      note: "",
    };
    setStorageLocationCatalog([...storageLocationCatalog, k]);
    notify.saved(`Đã thêm kho lưu "${trimmedName}" vào danh mục`);
    return trimmedName;
  };

  const [storageLocationFilter, setStorageLocationFilter] = useState(ALL);

  /** Cộng tồn cuối theo từng kho lưu (dải chip dưới thẻ số liệu). */
  const byStorageLocation = useMemo(() => {
    const m = new Map<string, { closingKg: number; itemCount: number }>();
    for (const r of periodRows) {
      const k = storageLocationOf(r);
      const g = m.get(k) ?? { closingKg: 0, itemCount: 0 };
      g.closingKg += r.closingKg;
      g.itemCount += 1;
      m.set(k, g);
    }
    return [...m.entries()].sort((a, b) => b[1].closingKg - a[1].closingKg);
  }, [periodRows]);

  const rows: ComputedRow[] = useMemo(
    () => (storageLocationFilter === ALL ? periodRows : periodRows.filter((r) => storageLocationOf(r) === storageLocationFilter)),
    [periodRows, storageLocationFilter]
  );

  const total = useMemo(() => {
    const t = { openingKg: 0, inKg: 0, outKg: 0, closingKg: 0 };
    for (const r of rows) {
      t.openingKg += r.openingKg;
      t.inKg += r.inKg;
      t.outKg += r.outKg;
      t.closingKg += r.closingKg;
    }
    return t;
  }, [rows]);

  const invariantHolds = Math.abs(total.openingKg + total.inKg - total.outKg - total.closingKg) < 0.001;

  // ---------- Chế độ: xem / ghi ----------
  const [isEditMode, setIsEditMode] = useState(false);

  const editRow = (id: string, patch: Partial<NxtSnapshotLine>) => {
    setSnapshots(snapshots.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeRow = (id: string, name: string) => {
    setSnapshots(snapshots.filter((l) => l.id !== id));
    notify.deleted(`Đã xóa dòng ${name}`);
  };

  // ---------- Tick dòng: cộng tổng + gán kho lưu theo lô ----------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const tableSelection: TableSelection<ComputedRow> = {
    selectedKeys: selected,
    toggle: (k) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      }),
    toggleAll: (keys, bat) =>
      setSelected((prev) => {
        const next = new Set(prev);
        for (const k of keys) if (bat) next.add(k);
          else next.delete(k);
        return next;
      }),
    getRowLabel: (r) => `${r.itemName} · ${r.itemCode}`,
  };
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  // Tô màu dòng đang tick — cùng khoá với SummaryTable/EditableGrid rowMarkKey="nxt-kho".
  const rowMark = useRowMarkTools("nxt-kho");
  const selectedTotal = useMemo(() => {
    const t = { openingKg: 0, inKg: 0, outKg: 0, closingKg: 0 };
    for (const r of selectedRows) {
      t.openingKg += r.openingKg;
      t.inKg += r.inKg;
      t.outKg += r.outKg;
      t.closingKg += r.closingKg;
    }
    return t;
  }, [selectedRows]);

  const [assignLocation, setAssignLocation] = useState<string | null>(null); // kho lưu sắp gán

  /** Gán kho lưu cho các dòng đang tick (một lần ghi, hoàn tác được bằng gán lại). */
  const assignStorageLocation = () => {
    const target = (assignLocation ?? "").trim();
    if (!target) {
      notify.warning("Chưa chọn kho lưu để gán.");
      return;
    }
    const ids = new Set(selectedRows.map((r) => r.id));
    if (!ids.size) {
      notify.warning("Chưa tick dòng nào.");
      return;
    }
    setSnapshots(snapshots.map((l) => (ids.has(l.id) ? { ...l, storageLocation: target } : l)));
    setAssignLocation(null);
    setSelected(new Set());
    notify.saved(`Đã gán ${ids.size} mã về ${target}`);
  };

  // ---------- Thêm mã ----------
  const [addForm, setAddForm] = useState<{ code: string; name: string } | null>(null);
  const [addErrors, setAddErrors] = useState<FieldError[]>([]);

  const saveAddCode = () => {
    if (!addForm) return;
    const ls: FieldError[] = [];
    const code = addForm.code.trim();
    const name = addForm.name.trim();
    if (!code) ls.push({ field: "Mã hàng", message: "Chưa nhập mã hàng" });
    if (!name) ls.push({ field: "Tên hàng", message: "Chưa nhập tên hàng" });
    if (code && rows.some((r) => r.itemCode === code))
      ls.push({ field: "Mã hàng", message: "Mã này đã có trong kỳ" });
    setAddErrors(ls);
    if (ls.length) return;
    const newLines: NxtSnapshotLine = {
      id: snapshotRowId(selectedWarehouse, fromDate, toDate, code),
      warehouseCode: selectedWarehouse,
      storageLocation: storageLocationFilter === ALL ? DEFAULT_STORAGE_LOCATION : storageLocationFilter,
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
    notify.saved(`Đã thêm mã ${code}`);
  };

  // ---------- Tạo kỳ kế tiếp (kế thừa tồn) ----------
  const [periodForm, setPeriodForm] = useState<{ from: string; to: string } | null>(null);
  const [periodErrors, setPeriodErrors] = useState<FieldError[]>([]);

  const saveNewPeriod = () => {
    if (!periodForm) return;
    const ls: FieldError[] = [];
    if (!periodForm.from || !periodForm.to) ls.push({ field: "Khoảng ngày", message: "Chưa chọn kỳ mới" });
    if (periodForm.from && periodForm.to && periodForm.to < periodForm.from)
      ls.push({ field: "Khoảng ngày", message: "Đến ngày phải sau từ ngày" });
    if (periodForm.from === fromDate && periodForm.to === toDate)
      ls.push({ field: "Khoảng ngày", message: "Kỳ mới trùng kỳ đang xem" });
    setPeriodErrors(ls);
    if (ls.length) return;
    const { from, to } = periodForm;
    // Kế thừa: tồn cuối kỳ đang xem → tồn đầu kỳ mới. Nhập/xuất = 0 (chờ ghi). Lấy MỌI dòng
    // của kỳ (`periodRows`), KHÔNG theo chip kho lưu đang lọc — lọc chỉ để xem, dồn mà thiếu dòng
    // là mất tồn. Giá trị đầu kỳ mới = giá trị cuối kỳ này (đầu + nhập − xuất).
    const carried: NxtSnapshotLine[] = periodRows.map((r) => ({
      id: snapshotRowId(selectedWarehouse, from, to, r.itemCode),
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
    setPeriodForm(null);
    setPeriod(`${from}|${to}`);
    setStorageLocationFilter(ALL);
    setIsEditMode(true);
    const totalKg = carried.reduce((t, c) => t + c.openingKg, 0);
    notify.saved(
      `Đã tạo kỳ ${formatDateVN(from)}–${formatDateVN(to)} · kế thừa tồn đầu ${num(totalKg)} kg · ${carried.length} mã` +
        (existing.size ? ` (${existing.size} mã đã có: chỉ cập nhật tồn đầu, giữ nhập/xuất)` : "")
    );
  };

  const cards: StatCardData[] = [
    { label: "Tồn đầu kỳ", value: `${num(total.openingKg)} kg`, numeric: true, icon: Snowflake, color: "neutral" },
    { label: "Nhập trong kỳ", value: `${num(total.inKg)} kg`, numeric: true, icon: ArrowDownToLine, color: "brand" },
    { label: "Xuất trong kỳ", value: `${num(total.outKg)} kg`, numeric: true, icon: Ship, color: "warning" },
    { label: "Tồn cuối kỳ", value: `${num(total.closingKg)} kg`, numeric: true, icon: Scale, color: "success" },
  ];

  const columns: SummaryTableColumn<ComputedRow>[] = [
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
        <Tag variant={r.storageLocation && r.storageLocation !== DEFAULT_STORAGE_LOCATION ? "location" : "muted"}>
          {storageLocationOf(r)}
        </Tag>
      ),
    },
    { key: "tonDau", header: "Tồn đầu (kg)", numeric: true, render: (r) => num(r.openingKg), total: () => num(total.openingKg) },
    {
      key: "nhap",
      header: "Nhập (kg)",
      numeric: true,
      render: (r) => (r.inKg ? <span className="font-semibold text-success">+{num(r.inKg)}</span> : "—"),
      total: () => num(total.inKg),
    },
    {
      key: "xuat",
      header: "Xuất (kg)",
      numeric: true,
      render: (r) => (r.outKg ? <span className="font-semibold text-warning">−{num(r.outKg)}</span> : "—"),
      total: () => num(total.outKg),
    },
    {
      key: "tonCuoi",
      header: "Tồn cuối (kg)",
      numeric: true,
      render: (r) => <span className="tnum font-bold text-foreground">{num(r.closingKg)}</span>,
      total: () => num(total.closingKg),
    },
  ];

  // ---------- Lưới ghi (chế độ Ghi) ----------
  const gridColumns: GridColumn<ComputedRow>[] = [
    { key: "tonDau", header: "Tồn đầu", label: "Tồn đầu (kg)", kind: "input", getValue: (r) => r.openingKg || null, minWidth: 110 },
    { key: "nhap", header: "Nhập", label: "Nhập (kg)", kind: "input", getValue: (r) => r.inKg || null, minWidth: 110 },
    { key: "xuat", header: "Xuất", label: "Xuất (kg)", kind: "input", getValue: (r) => r.outKg || null, minWidth: 110 },
    { key: "tonCuoi", header: "Tồn cuối", label: "Tồn cuối (kg)", kind: "computed", getValue: (r) => r.closingKg, minWidth: 120 },
    {
      key: "xoa",
      header: "",
      label: "Xóa dòng",
      kind: "text",
      getValue: () => null,
      minWidth: 64,
      renderCell: (r) => (
        <ConfirmDelete
          recordDescription={`${r.itemName} · ${r.itemCode}`}
          onConfirm={() => removeRow(r.id, r.itemCode)}
          trigger={
            <Button
              title="Xóa mã hàng này khỏi kỳ đang xem." size="sm" variant="danger" aria-label={`Xóa ${r.itemCode}`}>
              <Trash2 className="size-4" />
            </Button>
          }
        />
      ),
    },
  ];

  const gridRows: GridRow<ComputedRow>[] = rows.map((r) => ({
    id: r.id,
    data: r,
    label: r.itemName,
    subLabel: <span className="font-mono">{r.itemCode}</span>,
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
      notify.warning("Không có số liệu để xuất");
      return;
    }
    const items: NxtExcelRow[] = rows.map((r) => ({
      code: r.itemCode,
      name: r.itemName,
      category: inferCategory(r.itemCode, r.itemName),
      openingKg: r.openingKg,
      openingValue: r.openingValue,
      inKg: r.inKg,
      inValue: r.inValue,
      outKg: r.outKg,
      outValue: r.outValue,
      closingKg: r.closingKg,
      closingValue: r.openingValue + r.inValue - r.outValue,
    }));
    exportNxtToExcel(
      {
        createdDateText: `Ngày lập: ${formatDateVN(todayIso())}`,
        title: "Báo cáo xuất nhập tồn",
        dateRangeText: `Từ ngày ${formatDateVN(fromDate)} đến ngày ${formatDateVN(toDate)}`,
        warehouseText: `Chi nhánh: ${selectedWarehouse}`,
        items,
        totalItemCount: items.length,
        totalOpeningKg: total.openingKg,
        totalOpeningValue: rows.reduce((s, r) => s + r.openingValue, 0),
        totalInKg: total.inKg,
        totalInValue: rows.reduce((s, r) => s + r.inValue, 0),
        totalOutKg: total.outKg,
        totalOutValue: rows.reduce((s, r) => s + r.outValue, 0),
        totalClosingKg: total.closingKg,
        totalClosingValue: rows.reduce((s, r) => s + (r.openingValue + r.inValue - r.outValue), 0),
      },
      `Bao-Cao-NXT-Kho-${fromDate}-${toDate}.xlsx`
    );
    // Không toast: trình duyệt đã tự báo tải file xong (README luật 8 — xuất file là thao tác không đổi số).
  };

  const pickFile = () => fileRef.current?.click();

  const loadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = await parseNxtExcelFile(file);
      const range = parseDateRange(data.dateRangeText);
      if (!range) {
        notify.warning("Không đọc được khoảng ngày trong file (dòng 'Từ ngày… đến ngày…').");
        return;
      }
      const fileWarehouse = parseWarehouse(data.warehouseText) || "KHO (không rõ)";
      const [from, to] = range;
      // Báo cáo của xí nghiệp KHÔNG có chiều kho lưu ⇒ nạp về kho nhà; gán lại
      // các lô gửi kho thuê ngoài bằng nút "Gán kho lưu" (tick dòng rồi gán theo lô).
      const newLines: NxtSnapshotLine[] = data.items.map((it) => ({
        id: snapshotRowId(fileWarehouse, from, to, it.code),
        warehouseCode: fileWarehouse,
        storageLocation: DEFAULT_STORAGE_LOCATION,
        periodFrom: from,
        periodTo: to,
        itemCode: it.code,
        itemName: it.name,
        unit: "KG",
        openingKg: it.openingKg,
        inKg: it.inKg,
        outKg: it.outKg,
        openingValue: it.openingValue,
        inValue: it.inValue,
        outValue: it.outValue,
        note: "",
      }));
      if (!newLines.length) {
        notify.warning("File không có dòng dữ liệu nào đọc được.");
        return;
      }
      const newIds = new Set(newLines.map((x) => x.id));
      const kept = snapshots.filter(
        (r) => !(r.warehouseCode === fileWarehouse && r.periodFrom === from && r.periodTo === to) && !newIds.has(r.id)
      );
      setSnapshots([...kept, ...newLines]);
      setWarehouse(fileWarehouse);
      setPeriod(`${from}|${to}`);
      const sd = newLines.reduce((s, r) => s + r.openingKg, 0);
      const sn = newLines.reduce((s, r) => s + r.inKg, 0);
      const productionKg = newLines.reduce((s, r) => s + r.outKg, 0);
      notify.saved(
        `Đã nạp ${newLines.length} mã · ${fileWarehouse} · ${formatDateVN(from)}–${formatDateVN(to)} — tồn cuối ${num(sd + sn - productionKg)} kg`
      );
    } catch (err) {
      notify.error(`Không đọc được file: ${err instanceof Error ? err.message : String(err)}`);
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
            {!canWrite && <ReadOnlyBadge />}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Số thật theo báo cáo của xí nghiệp (Kho × Mã hàng × Kỳ). Tồn cuối = tồn đầu + nhập − xuất.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={loadFile} />
          {canWrite && (
            <Button variant="outline" onClick={pickFile} title="Đọc file Excel báo cáo Xuất–Nhập–Tồn xuất từ hệ thống xí nghiệp (mẫu 10 cột). Nạp lại cùng kho + cùng kỳ chỉ cập nhật, không nhân đôi dòng.">
              <Upload className="mr-2 h-4 w-4" />
              Nhập Excel báo cáo
            </Button>
          )}
          {allowed.export && (
            <>
              <Button variant="outline" onClick={exportExcel} disabled={!rows.length} title="Tải kỳ đang xem ra file Excel đúng mẫu báo cáo của xí nghiệp, để gửi kế toán hoặc lưu hồ sơ.">
                <Download className="mr-2 h-4 w-4" />
                Xuất Excel
              </Button>
              <Button onClick={() => setMoIn(true)} disabled={!rows.length} title="Xem trước bản in A4 của kỳ đang xem, rồi in giấy hoặc lưu PDF.">
                <Printer className="mr-2 h-4 w-4" />
                In A4
              </Button>
            </>
          )}
        </div>
      </div>

      {hasData && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 sm:min-w-[16rem]">
            <Combobox
              label="Kho / chi nhánh"
              hideRequiredMark
              clearable={false}
              value={selectedWarehouse}
              onChange={(v) => {
                setWarehouse(v);
                setPeriod("");
                setIsEditMode(false);
              }}
              options={warehouseOpts}
            />
          </div>
          <div className="min-w-[14rem]">
            <Combobox
              label="Kỳ báo cáo"
              hideRequiredMark
              clearable={false}
              value={selectedPeriod}
              onChange={(v) => {
                setPeriod(v);
                setIsEditMode(false);
                setSelected(new Set());
              }}
              options={periodOptions}
            />
          </div>
          <div className="min-w-0 sm:min-w-[14rem]">
            <Combobox
              label="Kho lưu"
              hideRequiredMark
              clearable={false}
              value={storageLocationFilter}
              onChange={(v) => {
                setStorageLocationFilter(v);
                setSelected(new Set());
              }}
              options={[{ value: ALL, label: "Tất cả kho lưu" }, ...storageLocationOpts]}
            />
          </div>
          {rows.length > 0 && canWrite && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant={isEditMode ? "default" : "edit"}
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
                  setPeriodForm({ from: nextDay(toDate), to: "" });
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
          title="Chưa có số liệu Xuất–Nhập–Tồn"
          description="Bấm 'Nhập Excel báo cáo' để nạp file NXT xuất từ hệ thống đang dùng (mẫu 10 cột). Số sẽ hiện đúng theo file, rồi bấm 'Tạo kỳ kế tiếp' để kế thừa tồn sang kỳ sau."
        />
      ) : (
        <>
          <StatCardGrid cards={cards} />

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
            {invariantHolds ? (
              <span className="flex items-center gap-2 text-base font-semibold text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                Khớp bất biến: {num(total.openingKg)} + {num(total.inKg)} − {num(total.outKg)} = {num(total.closingKg)} kg
              </span>
            ) : (
              <span className="text-base font-semibold text-destructive">
                Lệch bất biến — kiểm lại số liệu nguồn (đầu + nhập − xuất ≠ tồn cuối).
              </span>
            )}
            <Tag variant="muted" className="ml-auto">
              SL mặt hàng: {rows.length}
            </Tag>
          </div>

          {/* Tồn cuối theo từng KHO LƯU — trả lời "hàng đang nằm ở kho nào" */}
          {byStorageLocation.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <PackageOpen className="h-4 w-4 text-primary" aria-hidden />
                Tồn cuối theo kho lưu:
              </span>
              {byStorageLocation.map(([name, g]) => (
                <button
                  title="Chỉ xem các mã đang nằm ở kho này. Bấm lần nữa để xem lại tất cả kho."
                  key={name}
                  type="button"
                  onClick={() => {
                    setStorageLocationFilter(storageLocationFilter === name ? ALL : name);
                    setSelected(new Set());
                  }}
                  className="min-h-9 rounded-full border border-border px-3 py-1 text-sm hover:bg-muted"
                  aria-pressed={storageLocationFilter === name}
                >
                  <span className="font-medium text-foreground">{name}</span>{" "}
                  <span className="tnum text-muted-foreground">
                    {num(g.closingKg)} kg · {g.itemCount} mã
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

          {isEditMode && canWrite ? (
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
              <EditableGrid
                description={`Sổ Xuất–Nhập–Tồn ${selectedWarehouse} kỳ ${formatDateVN(fromDate)}–${formatDateVN(toDate)}`}
                columns={gridColumns}
                rows={gridRows}
                rowMarkKey="nxt-kho"
                onCellCommit={writeCell}
                footer={
                  <tr className="bg-muted font-semibold">
                    <th scope="row" className="sticky left-0 z-10 border-r-2 border-b border-border bg-muted px-4 py-2 text-left">
                      Tổng cộng — {rows.length} mặt hàng
                    </th>
                    <td className="tnum border-b border-l border-border px-3 py-2 text-right">{num(total.openingKg)}</td>
                    <td className="tnum border-b border-l border-border px-3 py-2 text-right">{num(total.inKg)}</td>
                    <td className="tnum border-b border-l border-border px-3 py-2 text-right">{num(total.outKg)}</td>
                    <td className="tnum border-b border-l border-border px-3 py-2 text-right">{num(total.closingKg)}</td>
                    <td className="border-b border-l border-border" />
                  </tr>
                }
              />
            </div>
          ) : (
            <SummaryTable rows={rows} columns={columns} getKey={(r) => r.id} selection={tableSelection} stickyHeader rowMarkKey="nxt-kho" />
          )}

          {/* Thanh dòng đã tick: cộng tổng + tô màu + gán kho lưu theo lô. Đặt SAU bảng và
              DÍNH ĐÁY màn hình từ md: tick dòng cuối bảng vẫn thấy nút, khỏi lăn ngược lên
              (điện thoại không dính — thanh nhiều nút sẽ che gần hết màn). */}
          {selectedRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-card p-3 print:hidden md:sticky md:bottom-3 md:z-30 md:shadow-lg">
              <span className="font-semibold text-foreground">Đã chọn {selectedRows.length} mã</span>
              <span className="tnum text-sm text-muted-foreground">
                tồn đầu {num(selectedTotal.openingKg)} · nhập {num(selectedTotal.inKg)} · xuất {num(selectedTotal.outKg)} ·{" "}
                <span className="font-semibold text-foreground">tồn cuối {num(selectedTotal.closingKg)} kg</span>
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <RowMarkActions marker={rowMark} selectedKeys={selectedRows.map((r) => r.id)} />
                {canWrite && (
                  <Button
                    size="sm"
                    onClick={() => setAssignLocation(storageLocationFilter === ALL ? DEFAULT_STORAGE_LOCATION : storageLocationFilter)}
                    title="Ghi lại các mã đang tick là đang nằm ở một kho khác (kho nhà hay kho lạnh thuê ngoài). Sửa danh sách kho ở Danh mục → Kho lưu trữ."
                  >
                    <PackageOpen className="mr-2 h-4 w-4" />
                    Gán kho lưu
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} title="Bỏ tick toàn bộ các mã đang chọn.">
                  Bỏ chọn
                </Button>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Kho <span className="font-semibold text-foreground">{selectedWarehouse}</span> · kỳ {formatDateVN(fromDate)} –{" "}
            {formatDateVN(toDate)}
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
              Thêm một mặt hàng kho vào {selectedWarehouse} · kỳ {formatDateVN(fromDate)}–{formatDateVN(toDate)}. Tồn đầu/nhập/xuất
              ghi ở lưới.
            </DialogDescription>
          </DialogHeader>
          {addForm && (
            <div className="space-y-4 py-2">
              <ErrorSummary errors={addErrors} />
              <RequiredLegend />
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
            <Button variant="save" onClick={saveAddCode} title="Thêm mã này vào kỳ đang xem với tồn đầu / nhập / xuất = 0.">
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
              {selectedRows.length} mã đang chọn ({num(selectedTotal.closingKg)} kg tồn cuối) sẽ được ghi là đang nằm ở
              kho dưới đây. Chưa có kho thì gõ tên rồi bấm Thêm mới; bút chì để sửa thông tin kho.
            </DialogDescription>
          </DialogHeader>
          {assignLocation !== null && (
            <div className="space-y-4 py-2">
              <RequiredLegend />
              <Combobox
                label="Kho lưu"
                required
                value={assignLocation}
                onChange={(v) => setAssignLocation(v)}
                options={storageLocationOpts}
                onCreate={storageLocationEditor.canCreate ? addStorageLocation : undefined}
                onEditItem={storageLocationEditor.openEdit}
                editLabel={storageLocationEditor.editLabel}
                canEdit={storageLocationEditor.canEdit}
                clearable={false}
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
      <Dialog open={!!periodForm} onOpenChange={(o) => !o && setPeriodForm(null)}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tạo kỳ kế tiếp (kế thừa tồn)</DialogTitle>
            <DialogDescription className="text-base">
              Kho {selectedWarehouse}. Tồn cuối kỳ đang xem ({num(periodRows.reduce((t, r) => t + r.closingKg, 0))} kg ·{" "}
              {periodRows.length} mặt hàng, mọi kho lưu — không theo chip đang lọc) sẽ thành tồn đầu kỳ mới; nhập/xuất
              để trống chờ ghi. Kỳ mới đã có mã nào thì chỉ cập nhật tồn đầu mã đó, giữ số đã ghi.
            </DialogDescription>
          </DialogHeader>
          {periodForm && (
            <div className="space-y-4 py-2">
              <ErrorSummary errors={periodErrors} />
              <RequiredLegend />
              <DateRangeField
                label="Kỳ mới"
                hideRequiredMark
                presets={false}
                startDate={periodForm.from}
                endDate={periodForm.to}
                onChange={(a, b) => setPeriodForm((f) => (f ? { ...f, from: a, to: b } : f))}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPeriodForm(null)}>
              Hủy
            </Button>
            <Button variant="save" onClick={saveNewPeriod} title="Tạo kỳ mới và ghi tồn cuối kỳ hiện tại thành tồn đầu kỳ đó. Nhập/xuất để trống chờ ghi.">
              <CalendarPlus className="mr-1 h-4 w-4" />
              Tạo kỳ · kế thừa tồn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In A4 */}
      {moIn && rows.length > 0 && (
        <PrintSheet
          title="Báo cáo xuất nhập tồn"
          subtitle={`${selectedWarehouse} · từ ${formatDateVN(fromDate)} đến ${formatDateVN(toDate)}${
            storageLocationFilter === ALL ? "" : ` · kho lưu ${storageLocationFilter}`
          }`}
          onClose={() => setMoIn(false)}
        >
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>Ngày lập: {formatDateVN(todayIso())}</span>
            <span>SL mặt hàng: {rows.length}</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <PrintTh>Mã hàng</PrintTh>
                <PrintTh>Tên hàng</PrintTh>
                <PrintTh>Kho lưu</PrintTh>
                <PrintTh right>Tồn đầu</PrintTh>
                <PrintTh right>Nhập</PrintTh>
                <PrintTh right>Xuất</PrintTh>
                <PrintTh right>Tồn cuối</PrintTh>
              </tr>
            </thead>
            <tbody>
              <tr>
                <PrintTd bold colSpan={3}>
                  Tổng cộng — {rows.length} mặt hàng
                </PrintTd>
                <PrintTd bold right>{num(total.openingKg)}</PrintTd>
                <PrintTd bold right>{num(total.inKg)}</PrintTd>
                <PrintTd bold right>{num(total.outKg)}</PrintTd>
                <PrintTd bold right>{num(total.closingKg)}</PrintTd>
              </tr>
              {rows.map((r) => (
                <tr key={r.id}>
                  <PrintTd className="font-mono">{r.itemCode}</PrintTd>
                  <PrintTd>{r.itemName}</PrintTd>
                  <PrintTd>{storageLocationOf(r)}</PrintTd>
                  <PrintTd right>{num(r.openingKg)}</PrintTd>
                  <PrintTd right>{r.inKg ? num(r.inKg) : ""}</PrintTd>
                  <PrintTd right>{r.outKg ? num(r.outKg) : ""}</PrintTd>
                  <PrintTd right>{num(r.closingKg)}</PrintTd>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSheet>
      )}
      {storageLocationEditor.dialog}
    </div>
  );
}
