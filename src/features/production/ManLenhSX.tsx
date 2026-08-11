// src/features/production/ManLenhSX.tsx
import { useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Combobox,
  DateField,
  DuLieuMau,
  EmptyState,
  Field,
  FormDialog,
  Input,
  NumberField,
  NutDong,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  StatusChip,
  ThongKe,
  notify,
  type TrangThaiSX,
} from "@/design-system";
import { cn } from "@/lib/utils";
import {
  Check,
  CirclePause,
  ClipboardList,
  Clock,
  Eye,
  FileSpreadsheet,
  Filter,
  Gauge,
  MoreVertical,
  Plus,
  Printer,
  Search,
  Target,
} from "lucide-react";

/**
 * ManLenhSX — quản lý lệnh sản xuất: tabs trạng thái có số đếm · tìm/lọc/xuất ·
 * bảng 12 cột cuộn ngang (cột Thao tác dính phải) · chọn nhiều · phân trang ·
 * drawer lọc · các dialog chi tiết/cập nhật/tạm dừng/tạo mới.
 *
 * Màn TRƯNG BÀY: số liệu là dữ liệu mẫu, chưa nối bảng thật. Không emoji: trạng
 * thái dùng StatusChip (chấm màu + nhãn chữ).
 */

interface LenhSX {
  id: string;
  sp: string;
  kh: string;
  ke: number;
  thuc: number;
  line: string | null;
  batDau: string | null;
  han: string;
  trang: TrangLenh;
}

type TrangLenh = "dang-chay" | "cho-xu-ly" | "hoan-thanh" | "tam-dung";

const LSX_ROWS: LenhSX[] = [
  { id: "LSX-240810-001", sp: "Mực ống đông IQF 1 kg", kh: "Maruha Nichiro (JP)", ke: 5000, thuc: 3750, line: "Line 1", batDau: "08/08/2026", han: "15/08/2026", trang: "dang-chay" },
  { id: "LSX-240810-002", sp: "Bạch tuộc hấp nguyên con", kh: "Dongwon (KR)", ke: 3000, thuc: 3000, line: "Line 2", batDau: "05/08/2026", han: "10/08/2026", trang: "hoan-thanh" },
  { id: "LSX-240810-003", sp: "Cá ngừ loin đông −60 °C", kh: "Sysco (US)", ke: 8000, thuc: 2100, line: "Line 4", batDau: "09/08/2026", han: "20/08/2026", trang: "dang-chay" },
  { id: "LSX-240810-004", sp: "Tôm mũ ni HOSO size 8–12", kh: "Metro AG (DE)", ke: 2000, thuc: 0, line: null, batDau: null, han: "18/08/2026", trang: "cho-xu-ly" },
  { id: "LSX-240810-005", sp: "Mực nang fillet 500 g", kh: "Al-Futtaim (AE)", ke: 4500, thuc: 1800, line: "Line 1", batDau: "07/08/2026", han: "14/08/2026", trang: "tam-dung" },
  { id: "LSX-240809-011", sp: "Bạch tuộc 2 da nguyên con", kh: "Hansung Trading (KR)", ke: 3500, thuc: 3220, line: "Line 2", batDau: "06/08/2026", han: "11/08/2026", trang: "dang-chay" },
  { id: "LSX-240809-008", sp: "Cá thu cắt khúc đông lạnh", kh: "Siêu thị nội địa", ke: 1500, thuc: 1500, line: "Line 4", batDau: "04/08/2026", han: "09/08/2026", trang: "hoan-thanh" },
  { id: "LSX-240809-004", sp: "Ghẹ xanh hấp cấp đông", kh: "Ocean Fresh (EU)", ke: 2600, thuc: 640, line: "Line 3", batDau: "09/08/2026", han: "12/08/2026", trang: "dang-chay" },
  { id: "LSX-240808-015", sp: "Tôm sú vỏ đông block 2 kg", kh: "Daiwa Seafood (JP)", ke: 4000, thuc: 0, line: null, batDau: null, han: "22/08/2026", trang: "cho-xu-ly" },
  { id: "LSX-240808-002", sp: "Mực ống làm sạch đông block", kh: "Maruha Nichiro (JP)", ke: 6000, thuc: 5400, line: "Line 1", batDau: "03/08/2026", han: "13/08/2026", trang: "dang-chay" },
];

const LSX_TRANG: Record<TrangLenh, { nhan: string; chip: TrangThaiSX }> = {
  "dang-chay": { nhan: "Đang chạy", chip: "running" },
  "cho-xu-ly": { nhan: "Chờ xử lý", chip: "idle" },
  "hoan-thanh": { nhan: "Hoàn thành", chip: "running" },
  "tam-dung": { nhan: "Tạm dừng", chip: "stopped" },
};

const LSX_TAB: { value: string; label: string; dem: number }[] = [
  { value: "tat-ca", label: "Tất cả", dem: 45 },
  { value: "dang-chay", label: "Đang chạy", dem: 12 },
  { value: "cho-xu-ly", label: "Chờ xử lý", dem: 8 },
  { value: "hoan-thanh", label: "Hoàn thành", dem: 23 },
  { value: "tam-dung", label: "Tạm dừng", dem: 2 },
];

const LSX_LINE = ["Line 1", "Line 2", "Line 3", "Line 4"];
const HOM_NAY = new Date(2026, 7, 10);

const so = (n: number) => n.toLocaleString("vi-VN");

function soNgayConLai(han: string | null): number | null {
  if (!han) return null;
  const [d, m, y] = han.split("/").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - HOM_NAY.getTime()) / 86400000);
}

/** Tiến độ: xanh khi bám kế hoạch, vàng khi chậm, đỏ khi đã trễ hạn. */
function mauTienDo(r: LenhSX): string {
  const con = soNgayConLai(r.han);
  const pct = r.ke ? (r.thuc / r.ke) * 100 : 0;
  if (pct >= 100) return "bg-success";
  if (con != null && con < 0) return "bg-destructive";
  if (con != null && con <= 5 && pct < 70) return "bg-warning";
  return "bg-primary";
}

interface BoLoc {
  trang: string[];
  line: string;
  kh: string;
  sp: string;
  tu: string;
  den: string;
}

const BO_LOC_RONG: BoLoc = { trang: [], line: "", kh: "", sp: "", tu: "", den: "" };

function ThanhTienDoLSX({ pct, mau }: { pct: number; mau: string }) {
  return (
    <span className="flex min-w-[156px] items-center gap-2.5">
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
        <span
          className={cn("block h-full rounded-full", mau)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </span>
      <span className="font-mono text-sm font-semibold tnum">
        {Math.round(pct)}%
      </span>
    </span>
  );
}

function OHanGiao({ han }: { han: string }) {
  const con = soNgayConLai(han);
  if (con == null) return <span className="text-muted-foreground">—</span>;
  const gap = con <= 2;
  const sap = con > 2 && con <= 5;
  if (!gap && !sap) return <span>{han}</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-lg border px-2.5 py-1 font-semibold",
        gap
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-warning/40 bg-warning-surface text-warning"
      )}
    >
      <Clock className="size-5" aria-hidden />
      {han}
      <span className="font-mono">
        · {con < 0 ? `trễ ${-con}` : `còn ${con}`} ngày
      </span>
    </span>
  );
}

const THAO_TAC = [
  { id: "xem", nhan: "Xem chi tiết", icon: Eye },
  { id: "capnhat", nhan: "Cập nhật tiến độ", icon: Gauge },
  { id: "tamdung", nhan: "Tạm dừng lệnh", icon: CirclePause },
  { id: "in", nhan: "In phiếu sản xuất", icon: Printer },
] as const;

function MenuThaoTac({ onChon }: { onChon: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Thao tác với lệnh này"
          className="inline-flex size-11 items-center justify-center rounded-lg border-2 border-border bg-background transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <MoreVertical className="size-5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        {THAO_TAC.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onChon(m.id);
              }}
              className={cn(
                "flex min-h-12 w-full items-center gap-2.5 rounded-md px-3 text-left text-base transition-colors hover:bg-muted",
                m.id === "tamdung" ? "text-destructive" : "text-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {m.nhan}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

function DrawerLoc({
  open,
  onClose,
  boLoc,
  onApDung,
}: {
  open: boolean;
  onClose: () => void;
  boLoc: BoLoc;
  onApDung: (b: BoLoc) => void;
}) {
  const [tam, setTam] = useState<BoLoc>(boLoc);
  // Đồng bộ khi mở lại — nhận bộ lọc hiện hành làm điểm bắt đầu.
  const [oldOpen, setOldOpen] = useState(false);
  if (open !== oldOpen) {
    setOldOpen(open);
    if (open) setTam(boLoc);
  }
  if (!open) return null;

  const doiTrang = (k: string) =>
    setTam((t) => ({
      ...t,
      trang: t.trang.includes(k)
        ? t.trang.filter((x) => x !== k)
        : [...t.trang, k],
    }));

  return (
    <div
      className="fixed inset-0 z-[120] flex justify-end bg-[var(--overlay)]"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Lọc lệnh sản xuất"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col bg-card shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-border px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Lọc lệnh sản xuất
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bộ lọc áp cho cả danh sách, không chỉ trang đang xem.
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng bộ lọc"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-background transition-colors hover:bg-muted"
          >
            <span aria-hidden className="text-lg">
              ✕
            </span>
          </button>
        </div>

        <div className="scroll-nice grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-6 py-5">
          <fieldset className="grid gap-2.5 border-0 p-0">
            <legend className="mb-1 text-base font-semibold">Trạng thái</legend>
            {(Object.entries(LSX_TRANG) as [string, { nhan: string }][]).map(
              ([k, v]) => {
                const chon = tam.trang.includes(k);
                return (
                  <label
                    key={k}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-3.5 text-base font-semibold",
                      chon
                        ? "border-primary bg-accent"
                        : "border-input bg-background"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={chon}
                      onChange={() => doiTrang(k)}
                      className="size-5 cursor-pointer accent-primary"
                    />
                    {v.nhan}
                  </label>
                );
              }
            )}
          </fieldset>

          <Combobox
            label="Dây chuyền"
            anNhanBatBuoc
            value={tam.line}
            onChange={(v) => setTam({ ...tam, line: v })}
            options={LSX_LINE.map((l) => ({ value: l, label: l }))}
            placeholder="Tất cả dây chuyền"
          />
          <Combobox
            label="Khách hàng"
            anNhanBatBuoc
            value={tam.kh}
            onChange={(v) => setTam({ ...tam, kh: v })}
            options={[...new Set(LSX_ROWS.map((r) => r.kh))].map((k) => ({
              value: k,
              label: k,
            }))}
            placeholder="Tất cả khách hàng"
          />
          <Combobox
            label="Sản phẩm"
            anNhanBatBuoc
            value={tam.sp}
            onChange={(v) => setTam({ ...tam, sp: v })}
            options={[...new Set(LSX_ROWS.map((r) => r.sp))].map((s) => ({
              value: s,
              label: s,
            }))}
            placeholder="Tất cả sản phẩm"
          />
          <div className="grid gap-4">
            <p className="text-base font-semibold">Khoảng hạn giao</p>
            <DateField
              label="Từ ngày"
              anNhanBatBuoc
              value={tam.tu}
              onChange={(v) => setTam({ ...tam, tu: v })}
            />
            <DateField
              label="Đến ngày"
              anNhanBatBuoc
              value={tam.den}
              onChange={(v) => setTam({ ...tam, den: v })}
            />
          </div>
        </div>

        <div className="flex shrink-0 justify-between gap-3 border-t-2 border-border bg-muted/40 px-6 py-4">
          <Button variant="outline" size="lg" onClick={() => setTam(BO_LOC_RONG)}>
            Bỏ hết lọc
          </Button>
          <Button size="lg" onClick={() => onApDung(tam)}>
            <Filter className="size-5" aria-hidden />
            Áp dụng lọc
          </Button>
        </div>
      </aside>
    </div>
  );
}

export default function ManLenhSX() {
  const [tab, setTab] = useState("tat-ca");
  const [q, setQ] = useState("");
  const [chon, setChon] = useState<string[]>([]);
  const [trang, setTrang] = useState(1);
  const [moLoc, setMoLoc] = useState(false);
  const [boLoc, setBoLoc] = useState<BoLoc>(BO_LOC_RONG);
  const [chiTiet, setChiTiet] = useState<LenhSX | null>(null);
  const [capNhat, setCapNhat] = useState<LenhSX | null>(null);
  const [tamDung, setTamDung] = useState<LenhSX | null>(null);
  const [taoMoi, setTaoMoi] = useState(false);
  const [rows, setRows] = useState<LenhSX[]>(LSX_ROWS);

  const soBoLoc =
    boLoc.trang.length +
    (["line", "kh", "sp", "tu", "den"] as const).filter((k) => boLoc[k]).length;

  const loc = useMemo(
    () =>
      rows.filter((r) => {
        if (tab !== "tat-ca" && r.trang !== tab) return false;
        if (boLoc.trang.length && !boLoc.trang.includes(r.trang)) return false;
        if (boLoc.line && r.line !== boLoc.line) return false;
        if (boLoc.kh && r.kh !== boLoc.kh) return false;
        if (boLoc.sp && r.sp !== boLoc.sp) return false;
        const kw = q.trim().toLowerCase();
        if (kw && !`${r.id} ${r.sp} ${r.kh}`.toLowerCase().includes(kw))
          return false;
        return true;
      }),
    [rows, tab, boLoc, q]
  );

  const moiTrang = 10;
  const tongTrang = Math.max(1, Math.ceil(loc.length / moiTrang));
  const trangHienTai = Math.min(trang, tongTrang);
  const hienThi = loc.slice(
    (trangHienTai - 1) * moiTrang,
    trangHienTai * moiTrang
  );
  const tatCaChon = hienThi.length > 0 && hienThi.every((r) => chon.includes(r.id));

  const luuTienDo = () => {
    if (!capNhat) return;
    const c = capNhat;
    setRows((rs) => rs.map((r) => (r.id === c.id ? { ...r, thuc: c.thuc } : r)));
    notify.daLuu(`Đã cập nhật tiến độ · ${c.id} — ${so(c.thuc)} / ${so(c.ke)} kg`);
    setCapNhat(null);
  };

  const xacNhanTamDung = () => {
    if (!tamDung) return;
    const t = tamDung;
    setRows((rs) => rs.map((r) => (r.id === t.id ? { ...r, trang: "tam-dung" } : r)));
    notify.daLuu(`Đã tạm dừng lệnh · ${t.id} — ${t.sp}`);
    setTamDung(null);
  };

  const thaoTac = (r: LenhSX, id: string) => {
    if (id === "xem") setChiTiet(r);
    else if (id === "capnhat") setCapNhat({ ...r });
    else if (id === "tamdung") setTamDung(r);
    else notify.daLuu(`Đã gửi lệnh in phiếu · ${r.id} — máy in xưởng Đông`);
  };

  return (
    <div className="grid gap-6">
      <DuLieuMau ghiChu="Lệnh sản xuất chưa số hóa." />

      {/* Tabs có số đếm */}
      <div className="flex flex-wrap gap-2 border-b-2 border-border pb-1">
        {LSX_TAB.map((t) => {
          const active = t.value === tab;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(t.value);
                setTrang(1);
              }}
              className={cn(
                "inline-flex h-14 items-center gap-2 whitespace-nowrap border-b-[3px] px-4 text-base font-semibold transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "inline-flex h-6 min-w-7 items-center justify-center rounded-full px-2 font-mono text-xs font-bold",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                )}
              >
                {t.dem}
              </span>
            </button>
          );
        })}
      </div>

      {/* Thanh công cụ */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1 basis-80">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted-foreground"
          >
            <Search className="size-5" aria-hidden />
          </span>
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setTrang(1);
            }}
            aria-label="Tìm lệnh sản xuất"
            placeholder="Tìm mã LSX, sản phẩm, khách hàng…"
            className="pl-12"
          />
        </div>
        <Button variant="outline" onClick={() => setMoLoc(true)}>
          <Filter className="size-5" aria-hidden />
          Lọc{soBoLoc > 0 ? ` (${soBoLoc})` : ""}
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            notify.daLuu(`Đang xuất Excel · ${loc.length} lệnh theo bộ lọc`)
          }
        >
          <FileSpreadsheet className="size-5" aria-hidden />
          Xuất Excel
        </Button>
        <Button onClick={() => setTaoMoi(true)}>
          <Plus className="size-5" aria-hidden />
          Tạo LSX mới
        </Button>
      </div>

      {/* Thanh chọn nhiều */}
      {chon.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-primary bg-accent px-5 py-3">
          <span className="text-base font-semibold text-accent-foreground">
            Đã chọn <span className="font-mono">{chon.length}</span> lệnh
          </span>
          <span className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                notify.daLuu(`Đã gửi lệnh in phiếu · ${chon.length} phiếu`)
              }
            >
              <Printer className="size-5" aria-hidden />
              In phiếu
            </Button>
            <Button variant="outline" size="sm" onClick={() => setChon([])}>
              Bỏ chọn
            </Button>
          </span>
        </div>
      )}

      {/* Bảng */}
      {hienThi.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          tieuDe="Không có lệnh nào khớp"
          moTa="Bỏ bớt bộ lọc hoặc đổi từ khóa tìm để thấy lệnh sản xuất."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQ("");
                setBoLoc(BO_LOC_RONG);
                setTab("tat-ca");
              }}
            >
              Bỏ hết lọc
            </Button>
          }
        />
      ) : (
        <div className="scroll-nice w-full max-w-full overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[1480px] border-collapse text-base">
            <thead>
              <tr>
                <th className="h-14 w-14 border-b border-border bg-muted px-4 text-center font-semibold">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả lệnh trên trang này"
                    checked={tatCaChon}
                    onChange={() =>
                      setChon(tatCaChon ? [] : hienThi.map((r) => r.id))
                    }
                    className="size-5 cursor-pointer accent-primary"
                  />
                </th>
                {["Mã LSX", "Sản phẩm", "Khách hàng"].map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
                <Th right>SL kế hoạch</Th>
                <Th right>SL thực tế</Th>
                <Th>Tiến độ</Th>
                <Th>Dây chuyền</Th>
                <Th>Ngày bắt đầu</Th>
                <Th>Hạn giao</Th>
                <Th>Trạng thái</Th>
                <th className="sticky right-0 h-14 whitespace-nowrap border-b border-border bg-muted px-4 text-right font-semibold shadow-[-1px_0_0_var(--border)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {hienThi.map((r, i) => {
                const daChon = chon.includes(r.id);
                const pct = r.ke ? (r.thuc / r.ke) * 100 : 0;
                const nen = daChon
                  ? "bg-accent"
                  : i % 2 === 1
                    ? "bg-muted/40"
                    : "bg-background";
                return (
                  <tr key={r.id} className={cn("border-b border-border", nen)}>
                    <td className="h-14 px-4 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Chọn lệnh ${r.id}`}
                        checked={daChon}
                        onChange={() =>
                          setChon((cs) =>
                            daChon ? cs.filter((x) => x !== r.id) : [...cs, r.id]
                          )
                        }
                        className="size-5 cursor-pointer accent-primary"
                      />
                    </td>
                    <Td className="font-mono font-semibold">{r.id}</Td>
                    <Td className="font-medium">{r.sp}</Td>
                    <Td>{r.kh}</Td>
                    <Td right mono>
                      {so(r.ke)}
                    </Td>
                    <Td right mono>
                      {so(r.thuc)}
                    </Td>
                    <Td>
                      <ThanhTienDoLSX pct={pct} mau={mauTienDo(r)} />
                    </Td>
                    <Td>
                      {r.line ? (
                        <Badge variant="secondary">{r.line}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Chưa phân</span>
                      )}
                    </Td>
                    <Td>
                      {r.batDau ?? <span className="text-muted-foreground">—</span>}
                    </Td>
                    <Td>
                      <OHanGiao han={r.han} />
                    </Td>
                    <Td>
                      {r.trang === "hoan-thanh" ? (
                        <StatusChip trangThai="running" nhan="Hoàn thành" />
                      ) : (
                        <StatusChip
                          trangThai={LSX_TRANG[r.trang].chip}
                          nhan={LSX_TRANG[r.trang].nhan}
                        />
                      )}
                    </Td>
                    <td
                      className={cn(
                        "sticky right-0 h-14 px-4 text-right shadow-[-1px_0_0_var(--border)]",
                        nen
                      )}
                    >
                      <MenuThaoTac onChon={(id) => thaoTac(r, id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Phân trang */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-muted-foreground">
          Hiển thị{" "}
          <span className="font-mono font-semibold text-foreground">
            {loc.length === 0 ? 0 : (trangHienTai - 1) * moiTrang + 1}–
            {Math.min(trangHienTai * moiTrang, loc.length)}
          </span>{" "}
          / <span className="font-mono font-semibold text-foreground">45</span>{" "}
          lệnh
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={trangHienTai === 1}
            onClick={() => setTrang(trangHienTai - 1)}
          >
            ← Trước
          </Button>
          {Array.from({ length: tongTrang }).map((_, k) => (
            <button
              key={k}
              type="button"
              aria-current={k + 1 === trangHienTai ? "page" : undefined}
              onClick={() => setTrang(k + 1)}
              className={cn(
                "size-11 rounded-lg border-2 font-mono text-base font-semibold transition-colors",
                k + 1 === trangHienTai
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border bg-background hover:bg-muted"
              )}
            >
              {k + 1}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={trangHienTai === tongTrang}
            onClick={() => setTrang(trangHienTai + 1)}
          >
            Sau →
          </Button>
        </div>
      </div>

      <DrawerLoc
        open={moLoc}
        onClose={() => setMoLoc(false)}
        boLoc={boLoc}
        onApDung={(b) => {
          setBoLoc(b);
          setTrang(1);
          setMoLoc(false);
        }}
      />

      {/* Chi tiết lệnh */}
      {chiTiet && (
        <FormDialog
          open
          onOpenChange={() => setChiTiet(null)}
          rong="rong"
          icon={ClipboardList}
          tieuDe={`Lệnh sản xuất ${chiTiet.id}`}
          moTa={`${chiTiet.sp} · khách ${chiTiet.kh}`}
          chan={
            <>
              <NutDong>Đóng</NutDong>
              <Button
                size="lg"
                onClick={() => {
                  setCapNhat({ ...chiTiet });
                  setChiTiet(null);
                }}
              >
                <Gauge className="size-5" aria-hidden />
                Cập nhật tiến độ
              </Button>
            </>
          }
        >
          <div className="grid gap-5">
            <ThongKe
              cot={3}
              the={[
                { nhan: "SL kế hoạch", giaTri: `${so(chiTiet.ke)} kg`, so: true, icon: Target, mau: "trung-tinh" },
                { nhan: "SL thực tế", giaTri: `${so(chiTiet.thuc)} kg`, so: true, icon: Gauge, mau: "brand" },
                { nhan: "Còn lại", giaTri: `${so(Math.max(0, chiTiet.ke - chiTiet.thuc))} kg`, so: true, icon: Clock, mau: "warning" },
              ]}
            />
            <ThanhTienDoLSX
              pct={chiTiet.ke ? (chiTiet.thuc / chiTiet.ke) * 100 : 0}
              mau={mauTienDo(chiTiet)}
            />
            <Separator />
            <dl className="grid grid-cols-2 gap-4">
              {(
                [
                  ["Dây chuyền", chiTiet.line ?? "Chưa phân"],
                  ["Trạng thái", LSX_TRANG[chiTiet.trang].nhan],
                  ["Ngày bắt đầu", chiTiet.batDau ?? "Chưa bắt đầu"],
                  ["Hạn giao", chiTiet.han],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-muted-foreground">{k}</dt>
                  <dd className="text-base font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </FormDialog>
      )}

      {/* Cập nhật tiến độ */}
      {capNhat && (
        <FormDialog
          open
          onOpenChange={() => setCapNhat(null)}
          rong="vua"
          icon={Gauge}
          tieuDe="Cập nhật tiến độ"
          moTa={`${capNhat.id} · ${capNhat.sp}`}
          chan={
            <>
              <NutDong>Đóng</NutDong>
              <Button size="lg" onClick={luuTienDo}>
                <Check className="size-5" aria-hidden />
                Ghi tiến độ
              </Button>
            </>
          }
        >
          <div className="grid gap-5">
            <NumberField
              label="SL thực tế lũy kế"
              required
              unit="kg"
              value={capNhat.thuc}
              onChange={(v) => setCapNhat({ ...capNhat, thuc: v ?? 0 })}
              hint={`Kế hoạch ${so(capNhat.ke)} kg`}
            />
            <ThanhTienDoLSX
              pct={capNhat.ke ? (capNhat.thuc / capNhat.ke) * 100 : 0}
              mau={mauTienDo(capNhat)}
            />
            <Field label="Ghi chú ca">
              <Input placeholder="VD: đổi ca lúc 14:00, máy IQF chạy chậm" />
            </Field>
          </div>
        </FormDialog>
      )}

      {/* Tạm dừng */}
      {tamDung && (
        <FormDialog
          open
          onOpenChange={() => setTamDung(null)}
          rong="sm"
          icon={CirclePause}
          tieuDe="Tạm dừng lệnh này?"
          chan={
            <>
              <Button variant="outline" size="lg" onClick={() => setTamDung(null)}>
                Không dừng
              </Button>
              <Button variant="destructive" size="lg" onClick={xacNhanTamDung}>
                Tạm dừng lệnh
              </Button>
            </>
          }
        >
          <p className="text-base">Sắp tạm dừng:</p>
          <p className="mt-2 rounded-lg bg-muted px-4 py-3 text-base font-semibold">
            {tamDung.id} — {tamDung.sp} — {tamDung.line ?? "chưa phân dây chuyền"}
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            Dây chuyền sẽ trống cho lệnh khác. Chạy lại được bất cứ lúc nào.
          </p>
        </FormDialog>
      )}

      {/* Tạo LSX mới */}
      {taoMoi && (
        <FormDialog
          open
          onOpenChange={setTaoMoi}
          rong="rong"
          icon={Plus}
          tieuDe="Tạo lệnh sản xuất mới"
          moTa="Mã lệnh sinh tự động theo ngày sau khi lưu."
          chan={
            <>
              <NutDong>Đóng</NutDong>
              <Button
                size="lg"
                onClick={() => {
                  setTaoMoi(false);
                  notify.daLuu(
                    "Đã tạo lệnh sản xuất · LSX-240810-006 — chờ phân dây chuyền"
                  );
                }}
              >
                <Check className="size-5" aria-hidden />
                Tạo lệnh
              </Button>
            </>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Combobox
              label="Sản phẩm"
              required
              value=""
              onChange={() => {}}
              options={[...new Set(LSX_ROWS.map((r) => r.sp))].map((s) => ({
                value: s,
                label: s,
              }))}
              onCreate={(t) => t}
            />
            <Combobox
              label="Khách hàng"
              required
              value=""
              onChange={() => {}}
              options={[...new Set(LSX_ROWS.map((r) => r.kh))].map((k) => ({
                value: k,
                label: k,
              }))}
              onCreate={(t) => t}
            />
            <NumberField label="SL kế hoạch" required unit="kg" value={null} onChange={() => {}} />
            <Combobox
              label="Dây chuyền"
              value=""
              onChange={() => {}}
              options={LSX_LINE.map((l) => ({ value: l, label: l }))}
              placeholder="Phân sau"
            />
            <DateField label="Ngày bắt đầu" value="" onChange={() => {}} />
            <DateField label="Hạn giao" required value="" onChange={() => {}} />
          </div>
        </FormDialog>
      )}
    </div>
  );
}

function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "h-14 whitespace-nowrap border-b border-border bg-muted px-4 font-semibold",
        right ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  mono,
  className,
}: {
  children: ReactNode;
  right?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "h-14 whitespace-nowrap px-4",
        right && "text-right",
        mono && "font-mono tnum",
        className
      )}
    >
      {children}
    </td>
  );
}
