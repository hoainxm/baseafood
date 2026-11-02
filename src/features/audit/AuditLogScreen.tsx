// ============================================================
// Tên file: src/features/audit/AuditLogScreen.tsx
// Tên tiếng Việt: Màn hình Nhật ký thao tác (audit log) — chỉ Admin
// Description: User action audit-log viewer (admin only)
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { readAuditLog, type AuditEntry } from "@/lib/audit";
import {
  Tag,
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
  TableSkeleton,
  StatCardGrid,
  todayIso,
  notify,
  type RecordTableColumn,
  type TagVariant,
  type ComboboxOption,
  type StatCardData,
} from "@/design-system";
import { exportAoaToXlsx, type OExcel } from "@/lib/reportXlsx";
import { TABLE_LABELS } from "@/lib/catalogRepo";
import { FileSpreadsheet, History, RefreshCw, Users } from "lucide-react";
import { formatDateTimeVN } from "@/lib/format";

/** Nhãn tiếng Việt của bảng: lấy chung từ tầng dữ liệu (mọi bảng đang đồng bộ) + vài nhãn chỉ có ở nhật ký. */
const AUDIT_ONLY_LABELS: Record<string, string> = {
  finished_goods: "Thành phẩm (danh mục)",
  user_profiles: "Người dùng",
  auth: "Đăng nhập / xuất",
};
const ENTITY_LABELS: Record<string, string> = { ...TABLE_LABELS, ...AUDIT_ONLY_LABELS };
const tableLabel = (e: string) => ENTITY_LABELS[e] ?? e;

const ACTION_LABELS: Record<string, string> = {
  create: "Thêm",
  update: "Sửa",
  delete: "Xóa",
  login: "Đăng nhập",
  logout: "Đăng xuất",
  submit: "Gửi báo cáo",
  "change-password": "Đổi mật khẩu",
  "reset-password": "Đặt lại mật khẩu",
  "disable-account": "Tạm ngưng tài khoản",
  "enable-account": "Mở lại tài khoản",
};
const ACTION_OPTIONS: ComboboxOption[] = [
  { value: "", label: "Tất cả thao tác" },
  { value: "create", label: "Thêm" },
  { value: "update", label: "Sửa" },
  { value: "delete", label: "Xóa" },
  { value: "login", label: "Đăng nhập" },
  { value: "logout", label: "Đăng xuất" },
  { value: "submit", label: "Gửi báo cáo" },
  { value: "change-password", label: "Đổi mật khẩu" },
  { value: "reset-password", label: "Đặt lại mật khẩu" },
  { value: "disable-account", label: "Tạm ngưng tài khoản" },
  { value: "enable-account", label: "Mở lại tài khoản" },
];

function formatDate(iso: string): string {
  if (!iso) return "";
  return formatDateTimeVN(iso) || iso;
}

/** Mặc định xem 30 ngày gần nhất (gồm hôm nay) — đầu tháng vẫn thấy việc của tháng trước. */
function daysAgo(n: number): string {
  const d = new Date(`${todayIso()}T00:00:00`);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Mỗi lần tải / tải thêm. */
const PAGE = 1000;

/**
 * Nhật ký thao tác — chỉ Admin. Đọc audit_log (server) hoặc buffer (localStorage).
 * Lọc theo khoảng ngày / loại thao tác / bảng ở tầng đọc; lọc người + tìm chữ ở
 * client. Xem chi tiết trước→sau trong hộp thoại. Xuất Excel.
 */
export default function AuditLogScreen() {
  const [fromDate, setFromDate] = useState(daysAgo(29));
  const [toDate, setToDate] = useState(todayIso());
  const [actionFilter, setActionFilter] = useState("");
  const [entity, setEntity] = useState("");
  const [user, setUser] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<AuditEntry | null>(null);
  // Tải thêm: số dòng đọc tăng theo từng 1000, đổi bộ lọc thì về 1000 (khóa theo bộ lọc, không cần effect).
  const filterKey = [fromDate, toDate, actionFilter, entity].join("|");
  const [limitFor, setLimitFor] = useState({ key: filterKey, n: PAGE });
  const limit = limitFor.key === filterKey ? limitFor.n : PAGE;

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    readAuditLog({ fromDate, toDate, action: actionFilter || undefined, entity: entity || undefined, limit })
      .then((r) => {
        if (!isCancelled) setRows(r);
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [fromDate, toDate, actionFilter, entity, limit]);
  /** Đọc đủ số dòng giới hạn ⇒ có thể còn thao tác cũ hơn chưa hiện. */
  const isTruncated = rows.length >= limit;

  const reload = () => {
    setIsLoading(true);
    readAuditLog({ fromDate, toDate, action: actionFilter || undefined, entity: entity || undefined, limit })
      .then(setRows)
      .finally(() => setIsLoading(false));
  };

  // Tùy chọn người + bảng suy từ dữ liệu đang có.
  const userOptions: ComboboxOption[] = useMemo(() => {
    const set = new Set(rows.map((r) => r.actorUsername).filter(Boolean));
    return [{ value: "", label: "Tất cả người" }, ...[...set].sort().map((u) => ({ value: u, label: u }))];
  }, [rows]);

  // Đối tượng: MỌI bảng có nhật ký (không chỉ bảng có trong số dòng đang tải — lỗi cũ: 1000 dòng mới nhất
  // không có Hợp đồng xuất khẩu thì không lọc được Hợp đồng xuất khẩu) + bảng lạ có trong nhật ký.
  const entityOptions: ComboboxOption[] = useMemo(() => {
    const set = new Set([...Object.keys(ENTITY_LABELS), ...rows.map((r) => r.entity).filter(Boolean)]);
    return [
      { value: "", label: "Tất cả đối tượng" },
      ...[...set].map((e) => ({ value: e, label: tableLabel(e) })).sort((a, b) => a.label.localeCompare(b.label, "vi")),
    ];
  }, [rows]);

  const view = useMemo(() => {
    const t = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (user && r.actorUsername !== user) return false;
      if (t) {
        const hay = `${r.actorUsername} ${tableLabel(r.entity)} ${r.entityKey} ${r.summary}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [rows, user, searchQuery]);

  const userCount = useMemo(() => new Set(view.map((r) => r.actorUsername).filter(Boolean)).size, [view]);

  const cards: StatCardData[] = [
    { label: "Khoảng ngày", value: `${fromDate} → ${toDate}`, icon: History, color: "neutral" },
    { label: "Số thao tác", value: view.length, numeric: true, icon: History, color: "brand" },
    { label: "Số người", value: userCount, numeric: true, icon: Users, color: "success" },
  ];

  const actionLabel = (a: string) => ACTION_LABELS[a] ?? a;
  const badgeKind = (a: string): TagVariant =>
    a === "delete" ? "error" : a === "create" ? "done" : a === "update" ? "warning" : "muted";

  const cols: RecordTableColumn<AuditEntry>[] = [
    { key: "at", header: "Thời gian", primary: true, render: (r) => formatDate(r.at), getSortValue: (r) => r.at },
    { key: "nguoi", header: "Người", render: (r) => r.actorUsername || "—", getSortValue: (r) => r.actorUsername },
    {
      key: "loai",
      header: "Thao tác",
      render: (r) => <Tag variant={badgeKind(r.action)}>{actionLabel(r.action)}</Tag>,
      getSortValue: (r) => r.action,
    },
    { key: "doiTuong", header: "Đối tượng", render: (r) => tableLabel(r.entity), getSortValue: (r) => r.entity },
    { key: "tomTat", header: "Tóm tắt", render: (r) => r.summary },
  ];

  const exportExcel = () => {
    if (!view.length) {
      notify.warning("Không có nhật ký để xuất");
      return;
    }
    const aoa: OExcel[][] = [];
    aoa.push(["Nhật ký thao tác"]);
    aoa.push([`Khoảng: ${fromDate} → ${toDate}`]);
    aoa.push([]);
    aoa.push(["Thời gian", "Người", "Thao tác", "Đối tượng", "Khóa bản ghi", "Tóm tắt", "Chi tiết"]);
    for (const r of view)
      aoa.push([
        formatDate(r.at),
        r.actorUsername,
        actionLabel(r.action),
        tableLabel(r.entity),
        r.entityKey,
        r.summary,
        r.diff ? JSON.stringify(r.diff) : "",
      ]);
    exportAoaToXlsx({
      sheetName: "Nhật ký",
      aoa,
      colWidths: [20, 16, 12, 24, 22, 30, 50],
      fileName: `nhat-ky-thao-tac_${fromDate}_${toDate}.xlsx`,
    });
    // Không toast: trình duyệt đã tự báo tải file xong (README luật 8 — xuất file là thao tác không đổi số).
  };

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Nhật ký thao tác</h1>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border-2 border-border p-3">
        <div className="min-w-[10rem]">
          <DateField label="Từ ngày" hideRequiredMark value={fromDate} onChange={setFromDate} />
        </div>
        <div className="min-w-[10rem]">
          <DateField label="Đến ngày" hideRequiredMark value={toDate} onChange={setToDate} />
        </div>
        <div className="min-w-[12rem]">
          <Combobox label="Thao tác" hideRequiredMark clearable={false} value={actionFilter} onChange={setActionFilter} options={ACTION_OPTIONS} />
        </div>
        <div className="min-w-[12rem]">
          <Combobox label="Đối tượng" hideRequiredMark clearable={false} value={entity} onChange={setEntity} options={entityOptions} />
        </div>
        <div className="min-w-[12rem]">
          <Combobox label="Người" hideRequiredMark clearable={false} value={user} onChange={setUser} options={userOptions} />
        </div>
        <div className="min-w-[12rem] flex-1">
          <Field label="Tìm nhanh">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo người, đối tượng, khóa, tóm tắt…"
            />
          </Field>
        </div>
        {/* Nút của trang cuối hàng lọc (README § Đầu trang gọn) */}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            title="Nạp lại nhật ký từ máy chủ để thấy thao tác vừa xảy ra." variant="outline" onClick={reload}>
            <RefreshCw />
            Tải lại
          </Button>
          <Button
            title="Tải nhật ký đang lọc ra file Excel." variant="outline" onClick={exportExcel} disabled={!view.length}>
            <FileSpreadsheet />
            Xuất Excel
          </Button>
        </div>
      </div>

      <StatCardGrid cards={cards} />

      {!isLoading && isTruncated && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warning-surface px-4 py-2 text-sm">
          <span>
            Đang hiện {limit.toLocaleString("vi-VN")} thao tác mới nhất trong khoảng ngày này — còn thao tác cũ hơn chưa hiện. Tải thêm, hoặc thu hẹp khoảng ngày / chọn Đối tượng.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLimitFor({ key: filterKey, n: limit + PAGE })}
            title="Đọc thêm 1.000 thao tác cũ hơn trong cùng khoảng ngày và bộ lọc."
          >
            Tải thêm 1.000
          </Button>
        </div>
      )}
      {isLoading ? (
        <TableSkeleton />
      ) : view.length === 0 ? (
        <EmptyState
          icon={History}
          title="Chưa có nhật ký trong khoảng này"
          description="Đổi khoảng ngày / bộ lọc. Nhật ký ghi các thao tác thêm/sửa/xóa dữ liệu và đăng nhập/xuất."
        />
      ) : (
        <RecordTable
          columns={cols}
          rows={view}
          getKey={(r) => r.id}
          rowMarkKey="nhat-ky"
          getSearchText={(r) => `${r.actorUsername} ${tableLabel(r.entity)} ${r.summary}`}
          searchLabel="Tìm trong nhật ký…"
          actions={(r) => (
            <Button
              title="Xem đầy đủ những trường đã đổi trong thao tác này (giá trị trước → sau)." variant="outline" size="sm" onClick={() => setDetail(r)}>
              Chi tiết
            </Button>
          )}
        />
      )}

      {/* Hộp chi tiết trước → sau */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[92dvh] w-full overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Chi tiết thao tác</DialogTitle>
            {detail && (
              <DialogDescription className="text-base">
                {formatDate(detail.at)} · {detail.actorUsername || "—"} · {actionLabel(detail.action)}{" "}
                {tableLabel(detail.entity)}
              </DialogDescription>
            )}
          </DialogHeader>
          {detail && <DiffDetail r={detail} />}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setDetail(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Hiển thị diff: bản ghi mới ({_new}) hoặc các trường đổi ({field:[trước,sau]}). */
function DiffDetail({ r }: { r: AuditEntry }) {
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
