// ============================================================
// Tên file: src/features/audit/AuditLogScreen.tsx
// Tên tiếng Việt: Màn hình Nhật ký thao tác (audit log) — chỉ Admin
// Description: User action audit-log viewer (admin only)
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { docNhatKy, type NhatKy } from "@/lib/audit";
import {
  Badge,
  Button,
  Combobox,
  DateField,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  EmptyState,
  Field,
  Input,
  RecordTable,
  SkeletonBang,
  ThongKe,
  homNay,
  notify,
  type Cot,
  type MucChon,
  type TheThongTin,
} from "@/design-system";
import { exportAoaToXlsx, type OExcel } from "@/lib/reportXlsx";
import { FileSpreadsheet, History, RefreshCw, Users } from "lucide-react";

/** Nhãn tiếng Việt của bảng (đối tượng bị tác động). */
const NHAN_BANG: Record<string, string> = {
  material_imports: "Nhập nguyên liệu",
  import_shipments: "Chuyến nhập",
  daily_locks: "Chốt ngày nhập",
  scraps: "Phế liệu",
  production_wips: "Sản xuất BTP",
  production_locks: "Chốt ngày sản xuất",
  balancing_periods: "Kỳ cân đối",
  balancing_inputs: "Nguyên liệu vào (cân đối)",
  balancing_outputs: "Thành phẩm ra (cân đối)",
  sales_invoices: "Phiếu bán",
  sales_items: "Dòng bán",
  sales_orders: "Đơn đặt",
  order_items: "Dòng đơn đặt",
  export_orders: "Lệnh xuất",
  export_items: "Dòng lệnh xuất",
  products: "Mặt hàng",
  customers: "Khách hàng",
  suppliers: "Đại lý",
  material_types: "Loại nguyên liệu",
  finished_goods: "Thành phẩm (danh mục)",
  user_profiles: "Người dùng",
  material_opening_stock: "Tồn đầu nguyên liệu",
  finished_goods_opening_stock: "Tồn đầu thành phẩm",
  auth: "Đăng nhập / xuất",
};
const nhanBang = (e: string) => NHAN_BANG[e] ?? e;

const NHAN_LOAI: Record<string, string> = {
  them: "Thêm",
  sua: "Sửa",
  xoa: "Xóa",
  "dang-nhap": "Đăng nhập",
  "dang-xuat": "Đăng xuất",
};
const LOAI_OPT: MucChon[] = [
  { value: "", label: "Tất cả thao tác" },
  { value: "them", label: "Thêm" },
  { value: "sua", label: "Sửa" },
  { value: "xoa", label: "Xóa" },
  { value: "dang-nhap", label: "Đăng nhập" },
  { value: "dang-xuat", label: "Đăng xuất" },
];

function bienNgay(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("vi-VN");
}

function batDauThang(): string {
  const t = homNay();
  return `${t.slice(0, 7)}-01`;
}

/**
 * Nhật ký thao tác — chỉ Admin. Đọc audit_log (server) hoặc buffer (localStorage).
 * Lọc theo khoảng ngày / loại thao tác / bảng ở tầng đọc; lọc người + tìm chữ ở
 * client. Xem chi tiết trước→sau trong hộp thoại. Xuất Excel.
 */
export default function NhatKyScreen() {
  const [tu, setTu] = useState(batDauThang());
  const [den, setDen] = useState(homNay());
  const [loai, setLoai] = useState("");
  const [bang, setBang] = useState("");
  const [nguoi, setNguoi] = useState("");
  const [timKiem, setTimKiem] = useState("");

  const [rows, setRows] = useState<NhatKy[]>([]);
  const [dangTai, setDangTai] = useState(true);
  const [chiTiet, setChiTiet] = useState<NhatKy | null>(null);

  useEffect(() => {
    let huy = false;
    setDangTai(true);
    docNhatKy({ tu, den, loai: loai || undefined, bang: bang || undefined, gioiHan: 1000 })
      .then((r) => {
        if (!huy) setRows(r);
      })
      .finally(() => {
        if (!huy) setDangTai(false);
      });
    return () => {
      huy = true;
    };
  }, [tu, den, loai, bang]);

  const taiLai = () => {
    setDangTai(true);
    docNhatKy({ tu, den, loai: loai || undefined, bang: bang || undefined, gioiHan: 1000 })
      .then(setRows)
      .finally(() => setDangTai(false));
  };

  // Tùy chọn người + bảng suy từ dữ liệu đang có.
  const optNguoi: MucChon[] = useMemo(() => {
    const set = new Set(rows.map((r) => r.actorUsername).filter(Boolean));
    return [{ value: "", label: "Tất cả người" }, ...[...set].sort().map((u) => ({ value: u, label: u }))];
  }, [rows]);

  const optBang: MucChon[] = useMemo(() => {
    const set = new Set(rows.map((r) => r.entity).filter(Boolean));
    return [
      { value: "", label: "Tất cả đối tượng" },
      ...[...set].sort().map((e) => ({ value: e, label: nhanBang(e) })),
    ];
  }, [rows]);

  const view = useMemo(() => {
    const t = timKiem.trim().toLowerCase();
    return rows.filter((r) => {
      if (nguoi && r.actorUsername !== nguoi) return false;
      if (t) {
        const hay = `${r.actorUsername} ${nhanBang(r.entity)} ${r.entityKey} ${r.summary}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [rows, nguoi, timKiem]);

  const soNguoi = useMemo(() => new Set(view.map((r) => r.actorUsername).filter(Boolean)).size, [view]);

  const the: TheThongTin[] = [
    { nhan: "Khoảng ngày", giaTri: `${tu} → ${den}`, icon: History, mau: "trung-tinh" },
    { nhan: "Số thao tác", giaTri: view.length, so: true, icon: History, mau: "brand" },
    { nhan: "Số người", giaTri: soNguoi, so: true, icon: Users, mau: "success" },
  ];

  const bienLoai = (a: string) => NHAN_LOAI[a] ?? a;
  const mauLoai = (a: string): "secondary" | "outline" | "destructive" | "default" =>
    a === "xoa" ? "destructive" : a === "them" ? "default" : a === "sua" ? "secondary" : "outline";

  const cols: Cot<NhatKy>[] = [
    { key: "at", header: "Thời gian", chinh: true, render: (r) => bienNgay(r.at), sapXep: (r) => r.at },
    { key: "nguoi", header: "Người", render: (r) => r.actorUsername || "—", sapXep: (r) => r.actorUsername },
    {
      key: "loai",
      header: "Thao tác",
      render: (r) => <Badge variant={mauLoai(r.action)}>{bienLoai(r.action)}</Badge>,
      sapXep: (r) => r.action,
    },
    { key: "doiTuong", header: "Đối tượng", render: (r) => nhanBang(r.entity), sapXep: (r) => r.entity },
    { key: "tomTat", header: "Tóm tắt", render: (r) => r.summary },
  ];

  const xuatExcel = () => {
    if (!view.length) {
      notify.canhBao("Không có nhật ký để xuất");
      return;
    }
    const aoa: OExcel[][] = [];
    aoa.push(["Nhật ký thao tác"]);
    aoa.push([`Khoảng: ${tu} → ${den}`]);
    aoa.push([]);
    aoa.push(["Thời gian", "Người", "Thao tác", "Đối tượng", "Khóa bản ghi", "Tóm tắt", "Chi tiết"]);
    for (const r of view)
      aoa.push([
        bienNgay(r.at),
        r.actorUsername,
        bienLoai(r.action),
        nhanBang(r.entity),
        r.entityKey,
        r.summary,
        r.diff ? JSON.stringify(r.diff) : "",
      ]);
    exportAoaToXlsx({
      sheetName: "Nhật ký",
      aoa,
      colWidths: [20, 16, 12, 24, 22, 30, 50],
      fileName: `nhat-ky-thao-tac_${tu}_${den}.xlsx`,
    });
    notify.daLuu("Đã xuất Excel nhật ký thao tác");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Nhật ký thao tác</h1>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" variant="outline" onClick={taiLai}>
            <RefreshCw />
            Tải lại
          </Button>
          <Button size="lg" variant="outline" onClick={xuatExcel} disabled={!view.length}>
            <FileSpreadsheet />
            Xuất Excel
          </Button>
        </div>
      </div>

      <ThongKe the={the} />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border-2 border-border p-4">
        <div className="min-w-[10rem]">
          <DateField label="Từ ngày" anNhanBatBuoc value={tu} onChange={setTu} />
        </div>
        <div className="min-w-[10rem]">
          <DateField label="Đến ngày" anNhanBatBuoc value={den} onChange={setDen} />
        </div>
        <div className="min-w-[12rem]">
          <Combobox label="Thao tác" anNhanBatBuoc choPhepXoa={false} value={loai} onChange={setLoai} options={LOAI_OPT} />
        </div>
        <div className="min-w-[12rem]">
          <Combobox label="Đối tượng" anNhanBatBuoc choPhepXoa={false} value={bang} onChange={setBang} options={optBang} />
        </div>
        <div className="min-w-[12rem]">
          <Combobox label="Người" anNhanBatBuoc choPhepXoa={false} value={nguoi} onChange={setNguoi} options={optNguoi} />
        </div>
        <div className="min-w-[12rem] flex-1">
          <Field label="Tìm nhanh">
            <Input
              value={timKiem}
              onChange={(e) => setTimKiem(e.target.value)}
              placeholder="Tìm theo người, đối tượng, khóa, tóm tắt…"
            />
          </Field>
        </div>
      </div>

      {dangTai ? (
        <SkeletonBang />
      ) : view.length === 0 ? (
        <EmptyState
          icon={History}
          tieuDe="Chưa có nhật ký trong khoảng này"
          moTa="Đổi khoảng ngày / bộ lọc. Nhật ký ghi các thao tác thêm/sửa/xóa dữ liệu và đăng nhập/xuất."
        />
      ) : (
        <RecordTable
          columns={cols}
          rows={view}
          getKey={(r) => r.id}
          timKiem={(r) => `${r.actorUsername} ${nhanBang(r.entity)} ${r.summary}`}
          nhanTimKiem="Tìm trong nhật ký…"
          actions={(r) => (
            <Button variant="outline" size="sm" onClick={() => setChiTiet(r)}>
              Chi tiết
            </Button>
          )}
        />
      )}

      {/* Hộp chi tiết trước → sau */}
      <Dialog open={chiTiet !== null} onOpenChange={(o) => !o && setChiTiet(null)}>
        <DialogContent className="max-h-[92vh] w-full overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Chi tiết thao tác</DialogTitle>
            {chiTiet && (
              <DialogDescription className="text-base">
                {bienNgay(chiTiet.at)} · {chiTiet.actorUsername || "—"} · {bienLoai(chiTiet.action)}{" "}
                {nhanBang(chiTiet.entity)}
              </DialogDescription>
            )}
          </DialogHeader>
          {chiTiet && <ChiTietDiff r={chiTiet} />}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setChiTiet(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Hiển thị diff: bản ghi mới ({_new}) hoặc các trường đổi ({field:[trước,sau]}). */
function ChiTietDiff({ r }: { r: NhatKy }) {
  const val = (v: unknown) =>
    v == null || v === "" ? "(trống)" : typeof v === "object" ? JSON.stringify(v) : String(v);
  const diff = r.diff as Record<string, unknown> | undefined;

  if (!diff) {
    return (
      <p className="rounded-lg border-2 border-border p-4 text-base text-muted-foreground">
        Khóa bản ghi: <span className="font-mono">{r.entityKey || "—"}</span>. Không có chi tiết trường.
      </p>
    );
  }

  if ("_new" in diff) {
    const row = (diff._new ?? {}) as Record<string, unknown>;
    return (
      <div className="space-y-2 py-2">
        <p className="text-base font-semibold text-foreground">Bản ghi mới</p>
        <ul className="divide-y divide-border rounded-lg border-2 border-border">
          {Object.entries(row).map(([k, v]) => (
            <li key={k} className="flex flex-wrap gap-2 p-2 text-sm">
              <span className="min-w-[10rem] font-medium text-muted-foreground">{k}</span>
              <span className="tnum break-all">{val(v)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const cap = Object.entries(diff) as [string, [unknown, unknown]][];
  return (
    <div className="space-y-2 py-2">
      <p className="text-base font-semibold text-foreground">Trường đã đổi ({cap.length})</p>
      <ul className="divide-y divide-border rounded-lg border-2 border-border">
        {cap.map(([k, pair]) => (
          <li key={k} className="flex flex-wrap items-center gap-2 p-2 text-sm">
            <span className="min-w-[10rem] font-medium text-muted-foreground">{k}</span>
            <span className="break-all text-destructive line-through">{val(pair?.[0])}</span>
            <span aria-hidden>→</span>
            <span className="break-all font-semibold text-success">{val(pair?.[1])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
