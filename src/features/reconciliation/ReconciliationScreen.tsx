// ============================================================
// Tên file: src/features/reconciliation/ReconciliationScreen.tsx
// Tên tiếng Việt tương đương: Màn Đối soát Hóa đơn điện tử ⇄ Phần mềm kế toán (v2)
// Description: Upload invoice workbook → reconcile e-invoices vs accounting rows.
//   v2: khối tự kiểm, cầu nối số liệu, nghi vấn 6 nhóm (không tự sửa — người dùng
//   bấm Sửa từng dòng, giữ giá trị cũ), chọn sổ chuẩn khi có nhiều sheet sổ.
// ============================================================
import { useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDelete,
  EmptyState,
  InfoTip,
  Input,
  NumberField,
  RecordTable,
  Tag,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  StatCardGrid,
  notify,
  toneByName,
  type RecordTableColumn,
  type StatCardData,
} from "@/design-system";
import {
  reconcile,
  readWorkbook,
  buildResultFileName,
  exportReconciliationExcel,
  exportReconciliationTemplate,
  fileToBase64,
  sheetsFromBase64,
  type ReconciliationBridge,
  type InvoiceRow,
  type LedgerRow,
  type ReconciliationResult,
  type SuspectItem,
  type MergedSuspect,
  type TrialCheck,
  type InvoiceSheet,
  type LedgerSheet,
  type InvoiceMatchStatus,
} from "@/lib/einvoiceReconciliation";
import { groupSameTaxCodeSameDay, resolveTaxSideSheets, compareTwoInvoiceVersions } from "@/lib/twoVersionReconciliation";
import { num } from "@/lib/format";
import {
  ReconciliationModePicker,
  SameDayView,
  ColumnSumCheckView,
  ReconciliationRulesBox,
  TwoVersionView,
} from "./ReconciliationModeView";
import { RECONCILIATION_MODES, getDefaultReconciliationMode, type ReconciliationMode } from "./reconciliationMode";
import { useReconciliationRuns } from "@/lib/catalogRepo";
import { useAuth } from "@/lib/auth";
import type { ReconciliationRun } from "@/types";
import {
  Upload,
  FileSpreadsheet,
  FileDown,
  Download,
  AlertTriangle,
  ScanSearch,
  ShieldCheck,
  Wrench,
  Undo2,
  ChevronDown,
  ChevronRight,
  Save,
  FolderOpen,
  History,
} from "lucide-react";

type Workbook = Awaited<ReturnType<typeof readWorkbook>>;
const LEDGER_TAB = "__phan-mem__";
const editKey = (nv: SuspectItem) => `${nv.sheet}#${nv.rowIndex}#${nv.column}`;

function invoiceChip(r: InvoiceRow) {
  if (r.status === "MATCHED") return <Tag variant="done">Khớp</Tag>;
  if (r.status === "MISMATCHED")
    return r.conclusion === "LỆCH THUẾ" ? <Tag variant="warning">Lệch thuế</Tag> : <Tag variant="error">Lệch tiền</Tag>;
  // Hóa đơn đã bị thay thế / hủy: không có trong sổ là ĐÚNG — đừng tô đỏ như việc phải làm.
  if (r.notRequiredInLedger) return <Tag variant="warning">Không cần vào sổ</Tag>;
  return <Tag variant="error">Chưa vào sổ</Tag>;
}

/** Suy kỳ "T02-2026" / "T3" từ tên file. */
function inferPeriod(name: string): string {
  const m = name.match(/T\s?0?(\d{1,2})(?:[-_ ]?(\d{4}))?/i);
  if (!m) return "";
  return m[2] ? `T${m[1].padStart(2, "0")}-${m[2]}` : `T${m[1]}`;
}
function formatDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Cuộn mượt tới một khối theo id (drill-down từ thẻ tổng) — dùng DOM id, không ref. */
function scrollToId(id: string) {
  requestAnimationFrame(() =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  );
}

// ---------- Bản đã lưu (theo tài khoản) ----------
function SavedRunsBox({
  runs,
  openRunId,
  laAdmin,
  onOpen,
  onDownload,
  onDelete,
}: {
  runs: ReconciliationRun[];
  openRunId: string | null;
  laAdmin: boolean;
  onOpen: (r: ReconciliationRun) => void;
  onDownload: (r: ReconciliationRun) => void;
  onDelete: (r: ReconciliationRun) => void;
}) {
  const columns: RecordTableColumn<ReconciliationRun>[] = [
    {
      key: "ten",
      header: "Tên bản",
      primary: true,
      render: (r) => (
        <span>
          {r.title}
          {r.id === openRunId && <span className="ml-2 text-sm text-primary">(đang mở)</span>}
        </span>
      ),
    },
    {
      key: "tt",
      header: "Trạng thái",
      render: (r) =>
        r.status === "official" ? (
          <Tag variant="done">Chính thức</Tag>
        ) : (
          <Tag variant="pending">Nháp</Tag>
        ),
    },
    { key: "ky", header: "Kỳ", render: (r) => r.period || "—" },
    {
      key: "tom",
      header: "Kết quả (lúc lưu)",
      render: (r) =>
        `${num(r.summary?.matched ?? 0)} khớp · ${num(r.summary?.mismatched ?? 0)} lệch · ${num(r.summary?.missing ?? 0)} chưa`,
    },
    { key: "luc", header: "Lưu lúc", render: (r) => formatDateTime(r.updatedAt), hideOnMobile: true },
    ...(laAdmin
      ? [{ key: "nguoi", header: "Người lưu", render: (r: ReconciliationRun) => r.ownerName || r.ownerUsername || "—" }]
      : []),
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-5" aria-hidden />
          Bản đã lưu ({runs.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RecordTable
          columns={columns}
          rows={runs}
          getKey={(r) => r.id}
          rowMarkKey="doi-soat-ban-luu"
          getSearchText={(r) => `${r.title} ${r.period} ${r.ownerName}`}
          searchLabel="Tìm theo tên / kỳ…"
          emptyText="Chưa có bản đối soát nào được lưu. Chạy đối soát rồi bấm Lưu."
          actions={(r) => (
            <>
              <Button
                title="Mở lại bản đối soát đã lưu và chạy lại trên chính file gốc của nó." size="sm" onClick={() => onOpen(r)}>
                <FolderOpen /> Mở lại
              </Button>
              <Button
                title="Tải kết quả của bản đối soát này ra file Excel." variant="outline" size="sm" onClick={() => onDownload(r)}>
                <Download /> Tải Excel
              </Button>
              <ConfirmDelete
                recordDescription={`${r.title} — ${r.period || "không rõ kỳ"} — ${r.status === "official" ? "Chính thức" : "Nháp"}`}
                title="Xóa bản đối soát này?"
                confirmLabel="Xóa bản"
                onConfirm={() => onDelete(r)}
              />
            </>
          )}
        />
      </CardContent>
    </Card>
  );
}

// ---------- Khối tự kiểm (§6) ----------
function SelfCheckBox({ checks: trialChecks }: { checks: TrialCheck[] }) {
  const passedCount = trialChecks.filter((p) => p.passed).length;
  const allPassed = passedCount === trialChecks.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5" aria-hidden />
          Máy tự kiểm tra lại{" "}
          <span className={allPassed ? "text-success" : "text-destructive"}>
            {allPassed ? `Đạt ${passedCount}/${trialChecks.length}` : `Có ${trialChecks.length - passedCount} phép không đạt`}
          </span>
          <InfoTip label="Máy tự kiểm tra lại">
            Máy tự chạy vài phép tính đối chứng để chắc chắn kết quả đối soát không sai.
            <b> Đáng lẽ</b> = con số đúng phải ra; <b>Thực tế</b> = con số máy đang tính được.
            Hai số bằng nhau ⇒ Đạt. Lệch nhau ⇒ có chỗ cần xem lại (bấm xuống bảng để dò).
          </InfoTip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {trialChecks.map((p, i) => (
            <li key={i} className="flex flex-col gap-1 border-b border-border/60 pb-3 last:border-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {p.passed ? (
                    <Tag variant="done">Đạt</Tag>
                  ) : (
                    <Tag variant="error">Không đạt</Tag>
                  )}
                  <span>{p.name}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Bắt lỗi: {p.catches}</p>
              </div>
              <div className="shrink-0 text-sm sm:text-right">
                <div>Đáng lẽ: <span className="tnum font-medium">{p.expected}</span></div>
                <div>Thực tế: <span className="tnum font-medium">{p.actual}</span></div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------- Cầu nối số liệu (§5) ----------
function BridgeBox({ bridge }: { bridge: ReconciliationBridge }) {
  const abDiff = bridge.missingInLedger - bridge.missingInLedgerDirect;
  const sumBoc = bridge.breakdown.reduce((s, x) => s + x.amount, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Kiểm tra tổng số tiền chưa vào sổ
          <InfoTip label="Kiểm tra tổng số tiền chưa vào sổ">
            Tính số tiền hóa đơn <b>chưa có trong sổ kế toán</b> bằng hai cách khác nhau. Nếu
            hai cách ra cùng một số ⇒ số liệu đáng tin. Đây chỉ là bước tự đối chứng, bạn không
            cần thao tác gì.
          </InfoTip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-medium text-muted-foreground">Cách 1 — lấy tổng hóa đơn trừ phần đã khớp</p>
            <p className="mt-1 text-sm">
              Tổng hóa đơn <span className="tnum">{num(bridge.fileTotal)}</span> − đã khớp{" "}
              <span className="tnum">{num(bridge.fileMatched)}</span> − lệch tiền{" "}
              <span className="tnum">{num(bridge.fileMismatched)}</span>
            </p>
            <p className="mt-1 text-lg font-bold tnum">= {num(bridge.missingInLedger)} đ</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-sm font-medium text-muted-foreground">Cách 2 — cộng thẳng các hóa đơn chưa vào sổ</p>
            <p className="mt-1 text-lg font-bold tnum">= {num(bridge.missingInLedgerDirect)} đ</p>
            <p className="mt-2 text-sm">
              Hai cách lệch nhau:{" "}
              <span className={Math.abs(abDiff) < 0.5 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                {num(abDiff)} đ {Math.abs(abDiff) < 0.5 ? "✓ bằng 0 — khớp" : "✗ đang lệch, cần soát"}
              </span>
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning-surface p-3">
          <p className="text-sm font-medium">
            Chênh nhỏ giữa hóa đơn và sổ ở các dòng đã khớp:{" "}
            <span className="tnum font-bold">{num(bridge.crossOffset)} đ</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <b>Đây KHÔNG phải hóa đơn bị bỏ sót</b> — chỉ là chênh lệch nhỏ do hóa đơn và sổ tách
            tiền hàng/thuế/chiết khấu khác nhau. Máy đã tách rõ theo từng hóa đơn (tổng cộng{" "}
            <span className="tnum">{num(sumBoc)}</span> đ):
          </p>
          {bridge.breakdown.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {bridge.breakdown.slice(0, 8).map((b, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate">{b.label}</span>
                  <span className="tnum shrink-0">{num(b.amount)} đ</span>
                </li>
              ))}
              {bridge.breakdown.length > 8 && (
                <li className="text-muted-foreground">… và {num(bridge.breakdown.length - 8)} hóa đơn nữa</li>
              )}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Nghi vấn ----------
const GROUP_NAMES: Record<number, string> = {
  1: "Cộng không khớp",
  2: "Thiếu ô chưa thuế/thuế",
  3: "Gần khớp",
  4: "Thiếu cả cụm",
  5: "Tổng bị xóa",
  6: "Cột quy đổi phụ",
  7: "Sheet trùng lặp",
};

function SuspectBox({
  suspects,
  mergedSuspects: groupedSuspects,
  edits,
  onEdit,
  onUndo,
  editLog,
}: {
  suspects: SuspectItem[];
  mergedSuspects: MergedSuspect[];
  edits: Record<string, number>;
  onEdit: (nv: SuspectItem) => void;
  onUndo: (key: string) => void;
  editLog: Record<string, { location: string; previous: string; next: string }>;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const editedKeys = Object.keys(editLog);

  const columns: RecordTableColumn<SuspectItem>[] = [
    {
      key: "nhom",
      header: "Nhóm",
      primary: true,
      render: (r) => <Tag variant="category" tone={toneByName(GROUP_NAMES[r.group])}>Nhóm {r.group} · {GROUP_NAMES[r.group]}</Tag>,
    },
    { key: "vitri", header: "Vị trí", render: (r) => r.location },
    { key: "dangco", header: "Số đang có", numeric: true, render: (r) => r.currentValue },
    { key: "doichung", header: "Số đối chứng", numeric: true, render: (r) => r.expectedValue },
    { key: "nguon", header: "Nguồn đối chứng", render: (r) => r.expectedSource },
    { key: "sai", header: "Sai ở chỗ nào", render: (r) => r.wrongAt },
    { key: "anhhuong", header: "Ảnh hưởng nếu sửa", render: (r) => r.impact },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <AlertTriangle className="size-5" aria-hidden />
          Chỗ cần soát lại — máy KHÔNG tự sửa số của bạn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {editedKeys.length > 0 && (
          <div className="rounded-xl border border-success/30 bg-success-surface p-3">
            <p className="text-sm font-medium">Đã sửa trong phiên ({editedKeys.length}) — giá trị cũ được giữ, vào file xuất:</p>
            <ul className="mt-2 space-y-1 text-sm">
              {editedKeys.map((k) => (
                <li key={k} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {editLog[k].location}: <span className="tnum">{editLog[k].previous}</span> →{" "}
                    <span className="tnum font-medium">{editLog[k].next}</span>
                  </span>
                  <Button
                    title="Bỏ thao tác gộp / sửa vừa làm cho dòng này, trả về như file gốc." variant="outline" size="sm" onClick={() => onUndo(k)}>
                    <Undo2 /> Hoàn tác
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {suspects.length === 0 && groupedSuspects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không phát hiện nghi vấn nào.</p>
        ) : (
          <>
            {suspects.length > 0 && (
              <RecordTable
                columns={columns}
                rows={suspects}
                getKey={(r) => `${r.group}-${r.location}`}
                actions={(r) =>
                  r.correctValue != null ? (
                    edits[editKey(r)] != null ? (
                      <Button
                        title="Bỏ phần sửa tay ở dòng này, trả số về như trong file gốc." variant="outline" size="sm" onClick={() => onUndo(editKey(r))}>
                        <Undo2 /> Hoàn tác
                      </Button>
                    ) : (
                      <Button
                        title="Sửa tay số hoặc ký hiệu của dòng này để hai bên khớp nhau." size="sm" onClick={() => onEdit(r)}>
                        <Wrench /> Sửa
                      </Button>
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">chưa xác định</span>
                  )
                }
                emptyText="Không có nghi vấn per dòng."
              />
            )}

            {groupedSuspects.map((g) => {
              const gk = `${g.group}-${g.name}`;
              const open = expandedGroups[gk];
              return (
                <div key={gk} className="rounded-xl border border-border p-3">
                  <button
                    title="Mở / thu nhóm dòng này để xem chi tiết từng hóa đơn trong nhóm."
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                    onClick={() => setExpandedGroups((m) => ({ ...m, [gk]: !m[gk] }))}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      <Tag variant="category" tone={toneByName(GROUP_NAMES[g.group])}>Nhóm {g.group}</Tag>
                      {g.name}
                    </span>
                    <span className="shrink-0 text-sm">
                      <span className="tnum font-semibold">{num(g.rowCount)}</span> dòng ·{" "}
                      <span className="tnum">{num(g.totalAmount)}</span> đ
                    </span>
                  </button>
                  <p className="mt-2 text-sm text-muted-foreground">{g.warning}</p>
                  {open && g.items.length > 0 && (
                    <ul className="mt-3 space-y-2 text-sm">
                      {g.items.slice(0, 200).map((nv, i) => (
                        <li key={i} className="flex flex-col gap-1 border-t border-border/60 pt-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="min-w-0">
                            {nv.location} — {nv.wrongAt}
                            {nv.correctValue != null && (
                              <> · đối chứng <span className="tnum font-medium">{nv.expectedValue}</span></>
                            )}
                          </span>
                          {nv.correctValue != null &&
                            (edits[editKey(nv)] != null ? (
                              <Button
                                title="Bỏ phần sửa tay ở dòng nghi vấn này." variant="outline" size="sm" onClick={() => onUndo(editKey(nv))}>
                                <Undo2 /> Hoàn tác
                              </Button>
                            ) : (
                              <Button
                                title="Sửa tay dòng nghi vấn này cho khớp." size="sm" onClick={() => onEdit(nv)}>
                                <Wrench /> Sửa
                              </Button>
                            ))}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Bảng HĐĐT ----------
const INVOICE_FILTERS: { id: InvoiceMatchStatus | "all"; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "MATCHED", label: "Khớp" },
  { id: "MISMATCHED", label: "Lệch tiền / thuế" },
  { id: "MISSING", label: "Chưa vào sổ" },
];

function InvoiceTable({
  sheet,
  filter: statusFilter,
  setFilter: setStatusFilter,
}: {
  sheet: InvoiceSheet;
  filter: InvoiceMatchStatus | "all";
  setFilter: (v: InvoiceMatchStatus | "all") => void;
}) {
  const counts = useMemo(() => {
    const d = { MATCHED: 0, MISMATCHED: 0, MISSING: 0 } as Record<InvoiceMatchStatus, number>;
    for (const r of sheet.rows) d[r.status]++;
    return d;
  }, [sheet]);
  const rows = useMemo(
    () => (statusFilter === "all" ? sheet.rows : sheet.rows.filter((r) => r.status === statusFilter)),
    [sheet, statusFilter]
  );
  const columns: RecordTableColumn<InvoiceRow>[] = [
    { key: "kq", header: "Kết quả", primary: true, render: (r) => invoiceChip(r) },
    { key: "kh", header: "Ký hiệu", render: (r) => r.series, getSortValue: (r) => r.series },
    { key: "so", header: "Số HĐ", render: (r) => r.invoiceNumber, getSortValue: (r) => r.normalizedNumber },
    { key: "ngay", header: "Ngày lập", render: (r) => r.issueDate, getSortValue: (r) => r.issueDate },
    { key: "ban", header: "Người bán", render: (r) => r.sellerName },
    { key: "tt", header: "Tổng TT (VND)", numeric: true, render: (r) => num(r.totalVnd), getSortValue: (r) => r.totalVnd },
    { key: "pm", header: "Tổng trên sổ", numeric: true, render: (r) => (r.status === "MISSING" ? "—" : num(r.ledgerTotal)) },
    { key: "chenh", header: "Chênh", numeric: true, render: (r) => (r.difference == null ? "—" : num(r.difference)), getSortValue: (r) => (r.difference == null ? 0 : Math.abs(r.difference)) },
    { key: "bc", header: "Bằng chứng đối chiếu", render: (r) => r.evidence },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {INVOICE_FILTERS.map((l) => (
          <Button
            title="Lọc danh sách hóa đơn theo trạng thái khớp này." key={l.id} variant={statusFilter === l.id ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(l.id)}>
            {l.label}
            {l.id !== "all" && <span className="tnum ml-1">({num(counts[l.id as InvoiceMatchStatus])})</span>}
          </Button>
        ))}
      </div>
      <RecordTable
        columns={columns}
        rows={rows}
        getKey={(r) => `${r.sheet}#${r.rowIndex}`}
        getSearchText={(r) => `${r.series} ${r.invoiceNumber} ${r.sellerName} ${r.evidence}`}
        searchLabel="Tìm ký hiệu / số HĐ / người bán…"
        emptyText="Không có dòng nào ở trạng thái này."
      />
    </div>
  );
}

function LedgerTable({
  sheet,
  missingOnly: showMissingOnly,
  setMissingOnly: setShowMissingOnly,
}: {
  sheet: LedgerSheet;
  missingOnly: boolean;
  setMissingOnly: (v: boolean) => void;
}) {
  const counts = useMemo(() => {
    let missingCount = 0;
    for (const r of sheet.rows) if (r.status === "MISSING") missingCount++;
    return { missing: missingCount };
  }, [sheet]);
  const rows = useMemo(
    () => (showMissingOnly ? sheet.rows.filter((r) => r.status === "MISSING") : sheet.rows),
    [sheet, showMissingOnly]
  );
  const columns: RecordTableColumn<LedgerRow>[] = [
    {
      key: "kq",
      header: "Kết quả",
      primary: true,
      render: (r) =>
        r.status === "FOUND" ? <Tag variant="done">Đã có hóa đơn</Tag> : <Tag variant="error">Chưa có hóa đơn</Tag>,
    },
    { key: "phieu", header: "Phiếu", render: (r) => r.voucher },
    { key: "ctgs", header: "CTGS", render: (r) => r.ctgs },
    { key: "kh", header: "Ký hiệu", render: (r) => r.series, getSortValue: (r) => r.series },
    { key: "so", header: "Số HĐ", render: (r) => r.invoiceNumber, getSortValue: (r) => r.normalizedNumber },
    { key: "ban", header: "Người bán", render: (r) => r.sellerName },
    { key: "tong", header: "Tổng cộng", numeric: true, render: (r) => num(r.total), getSortValue: (r) => r.total },
    { key: "bc", header: "Bằng chứng đối chiếu", render: (r) => r.evidence },
  ];
  return (
    <div className="space-y-4">
      {sheet.isSubset && (
        <div className="rounded-xl border border-warning/30 bg-warning-surface p-3 text-sm">
          Sheet sổ phụ (là một phần của sổ chính) — <b>KHÔNG cộng vào tổng</b>, chỉ để tra cứu (tránh đếm hai lần).
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          title="Xem toàn bộ dòng của sổ phần mềm." variant={!showMissingOnly ? "default" : "outline"} size="sm" onClick={() => setShowMissingOnly(false)}>
          Tất cả <span className="tnum ml-1">({num(sheet.rows.length)})</span>
        </Button>
        <Button
          title="Chỉ xem các dòng phần mềm chưa tìm được hóa đơn tương ứng." variant={showMissingOnly ? "default" : "outline"} size="sm" onClick={() => setShowMissingOnly(true)}>
          Chưa có hóa đơn <span className="tnum ml-1">({num(counts.missing)})</span>
        </Button>
      </div>
      <RecordTable
        columns={columns}
        rows={rows}
        getKey={(r) => `${r.sheet}#${r.rowIndex}`}
        getSearchText={(r) => `${r.voucher} ${r.ctgs} ${r.series} ${r.invoiceNumber} ${r.sellerName} ${r.evidence}`}
        searchLabel="Tìm phiếu / CTGS / số HĐ / người bán…"
        emptyText="Không có dòng nào ở trạng thái này."
      />
    </div>
  );
}

export default function ReconciliationScreen() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [wb, setWb] = useState<Workbook | null>(null);
  const [threshold, setThreshold] = useState<number | null>(1);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [editLog, setEditLog] = useState<Record<string, { location: string; previous: string; next: string }>>({});
  const [initialSuspectCount, setInitialSuspectCount] = useState<number | null>(null);
  const [ledgerSheetName, setLedgerSheetName] = useState<string | undefined>(undefined);
  const [isRunning, setIsRunning] = useState(false);
  const [tab, setTab] = useState<string>("");
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceMatchStatus | "all">("all"); // lọc bảng HĐĐT (điều khiển được từ thẻ tổng)
  const [ledgerMissingOnly, setLedgerMissingOnly] = useState(false); // lọc bảng sổ: chỉ dòng chưa có hóa đơn
  const [isCheckOpen, setIsCheckOpen] = useState(false); // mở khối "Kiểm tra chi tiết"
  const [mode, setMode] = useState<ReconciliationMode>("ledger"); // kiểu đối soát đang xem
  // Sheet thuộc bản thuế gửi do người dùng chỉ định; null = để máy tự nhận theo tên sheet.
  const [pickedTaxSides, setPickedTaxSides] = useState<string[] | null>(null);
  // Lưu theo tài khoản (v4)
  const [b64, setB64] = useState<string>(""); // base64 file gốc hiện hành (để lưu / mở lại)
  const [displayName, setDisplayName] = useState<string>(""); // tên file / tên bản đang mở
  const [savedRunName, setSavedRunName] = useState<string>(""); // ô nhập tên bản lưu
  const [openRunId, setOpenRunId] = useState<string | null>(null); // id bản đã lưu đang mở (lưu = cập nhật)
  const auth = useAuth();
  const [runs, setRuns] = useReconciliationRuns();

  const myRuns = useMemo(() => {
    const list = auth.isAdmin
      ? runs
      : runs.filter((r) => !r.userId || r.userId === auth.profile?.id);
    return [...list].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [runs, auth.isAdmin, auth.profile]);

  const reconResult: ReconciliationResult | null = useMemo(() => {
    if (!wb) return null;
    return reconcile(wb, {
      threshold: threshold ?? 0,
      edits,
      initialSuspectCount: initialSuspectCount ?? undefined,
      ledgerSheetName,
      // Có sổ + hai bản gối nhau thì engine chỉ đối soát bản thuế gửi ⇒ phải biết bên nào.
      taxSideSheets: pickedTaxSides ?? undefined,
    });
  }, [wb, threshold, edits, initialSuspectCount, ledgerSheetName, pickedTaxSides]);

  // Ba chiều soát ngoài "hóa đơn ⇄ sổ" — cùng hàm thuần lớp xuất dùng, nên số trên màn = số trong file.
  const invoiceSheetNames = useMemo(() => reconResult?.invoiceSheets.map((s) => s.name) ?? [], [reconResult]);
  const sideSplit = useMemo(() => resolveTaxSideSheets(invoiceSheetNames, pickedTaxSides), [invoiceSheetNames, pickedTaxSides]);
  const versionCompare = useMemo(
    () => (reconResult ? compareTwoInvoiceVersions(reconResult.invoiceSheets, reconResult.threshold, sideSplit.taxSide) : null),
    [reconResult, sideSplit]
  );
  const sameDayGroups = useMemo(
    () => (reconResult ? groupSameTaxCodeSameDay(reconResult.invoiceSheets.filter((s) => !s.isSubset), sideSplit.taxSide) : []),
    [reconResult, sideSplit]
  );
  const changeSide = (name: string, isTaxSide: boolean) => {
    const s = new Set(sideSplit.taxSide);
    if (isTaxSide) s.add(name);
    else s.delete(name);
    setPickedTaxSides(invoiceSheetNames.filter((t) => s.has(t)));
  };
  /** Kiểu mặc định theo nội dung file, tính trên kết quả vừa chạy. */
  const modeForFile = (result: ReconciliationResult, pickedSides: string[] | null) =>
    getDefaultReconciliationMode(
      !!result.ledgerSheet,
      !!compareTwoInvoiceVersions(result.invoiceSheets, result.threshold, resolveTaxSideSheets(result.invoiceSheets.map((s) => s.name), pickedSides).taxSide)
    );

  const pickFile = () => fileRef.current?.click();
  const loadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setWb(null);
    setEdits({});
    setEditLog({});
    setInitialSuspectCount(null);
    setLedgerSheetName(undefined);
    setPickedTaxSides(null);
    setB64("");
    setDisplayName(f?.name ?? "");
    setOpenRunId(null);
    e.target.value = "";
  };

  const runReconcile = async () => {
    if (!file) {
      notify.warning("Chưa chọn file Excel để đối soát.");
      return;
    }
    setIsRunning(true);
    try {
      // MỘT bộ bytes cho cả đọc lẫn xuất (đã chuẩn hoá .xls → .xlsx): hai lần đọc
      // riêng dễ lệch toạ độ dòng/cột, mà toạ độ là thứ cột "Vị trí" dựa vào.
      const originalB64 = await fileToBase64(file);
      const raw = sheetsFromBase64(originalB64);
      const kq0 = reconcile(raw, { threshold: threshold ?? 0 });
      const baseline = kq0.suspects.length + kq0.mergedSuspects.reduce((s, g) => s + g.rowCount, 0);
      setEdits({});
      setEditLog({});
      setInitialSuspectCount(baseline);
      setLedgerSheetName(undefined);
      setB64(originalB64);
      setDisplayName(file.name);
      setSavedRunName(file.name.replace(/\.xls[xmb]?$/i, ""));
      setOpenRunId(null);
      setWb(raw);
      setTab(kq0.invoiceSheets[0]?.name ?? (kq0.ledgerSheet ? LEDGER_TAB : ""));
      setInvoiceFilter("all");
      setLedgerMissingOnly(false);
      setPickedTaxSides(null);
      setMode(modeForFile(kq0, null));
      notify.saved(
        kq0.ledgerSheet
          ? `Đối soát xong: ${kq0.totals.matched} khớp · ${kq0.totals.mismatched + kq0.totals.taxMismatched} lệch tiền/thuế · ${kq0.totals.missing} chưa vào sổ · ${baseline} chỗ cần soát.`
          : `Đã đọc ${kq0.totals.invoiceCount} hóa đơn ở ${kq0.invoiceSheets.length} sheet (file không có sổ kế toán) — chọn việc cần soát bên dưới.`
      );
    } catch (err) {
      notify.error(`Không đọc được file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * Xuất Excel: ƯU TIÊN sửa tại chỗ trên chính file gốc (giữ nguyên font/khung/ô
   * gộp/định dạng số để kế toán soi song song được). Không còn bytes file gốc
   * hoặc thư viện nạp hụt thì mới lùi về bản dựng-mới.
   */
  const exportFile = async (
    result: ReconciliationResult,
    name: string,
    originalFileB64: string,
    versionEdits: Record<string, number> | undefined
  ) => {
    const tenFile = buildResultFileName(name);
    if (originalFileB64) {
      try {
        const { exportExcelPreserveFormat } = await import("@/lib/reconciliationExport");
        await exportExcelPreserveFormat(result, originalFileB64, tenFile, versionEdits);
        notify.saved("Đã xuất Excel — giữ nguyên định dạng file gốc, chỉ thêm cột đối soát và tô màu dòng.");
        return;
      } catch (err) {
        notify.error(
          `Không giữ được định dạng gốc (${err instanceof Error ? err.message : String(err)}) — xuất bản dựng mới.`
        );
      }
    }
    exportReconciliationExcel(result, tenFile);
    notify.saved("Đã xuất Excel (tô màu + cột phân tích + nhật ký sửa nếu có).");
  };

  const downloadExcel = () => {
    if (!reconResult) return;
    // Chở cách chia bên thuế/tự tải sang lớp xuất để sheet SO HAI BẢN giống màn hình.
    void exportFile({ ...reconResult, taxSideSheets: pickedTaxSides ?? undefined }, displayName || file?.name || "doi-soat", b64, edits);
  };

  const applyFix = (nv: SuspectItem) => {
    if (nv.correctValue == null || nv.sheet == null || nv.rowIndex == null || nv.column == null) return;
    const k = editKey(nv);
    setEdits((e) => ({ ...e, [k]: nv.correctValue! }));
    setEditLog((l) => ({
      ...l,
      [k]: { location: nv.location, previous: nv.oldValue == null ? "(trống)" : num(nv.oldValue), next: num(nv.correctValue!) },
    }));
    notify.saved("Đã áp sửa trong phiên. Giá trị cũ được giữ, sẽ vào file xuất.");
  };
  const undoEdit = (k: string) => {
    setEdits((e) => {
      const n = { ...e };
      delete n[k];
      return n;
    });
    setEditLog((l) => {
      const n = { ...l };
      delete n[k];
      return n;
    });
  };

  // ---- Lưu / mở lại / xóa bản đối soát theo tài khoản ----
  const saveRun = (status: "draft" | "official") => {
    if (!reconResult || !b64) {
      notify.warning("Chưa có kết quả để lưu — hãy chọn file và bấm Đối soát.");
      return;
    }
    const nd = auth.profile;
    const now = new Date().toISOString();
    const t = reconResult.totals;
    const id = openRunId ?? crypto.randomUUID();
    const prev = openRunId ? runs.find((r) => r.id === openRunId) : null;
    const run: ReconciliationRun = {
      id,
      userId: nd?.id ?? "",
      ownerUsername: nd?.username ?? "",
      ownerName: nd?.fullName || nd?.username || "",
      title: savedRunName.trim() || displayName || "Bản đối soát",
      period: inferPeriod(displayName),
      status,
      // Đúng ngưỡng đã tính ra kết quả đang thấy (ô trống = 0), mở lại không đổi kết quả.
      threshold: reconResult.threshold,
      fileName: displayName,
      fileB64: b64,
      options: { ledgerSheetName, edits, taxSideSheets: pickedTaxSides ?? undefined, mode },
      summary: {
        invoiceCount: t.invoiceCount, matched: t.matched, mismatched: t.mismatched, missing: t.missing, nearMatched: t.nearMatched,
        ledgerRowCount: t.ledgerRowCount, ledgerMatched: t.ledgerMatched, ledgerMissing: t.ledgerMissing, totalDifference: t.totalDifference,
        threshold: reconResult.threshold, savedAt: now,
      },
      createdAt: prev?.createdAt || now,
      updatedAt: now,
    };
    setRuns([...runs.filter((r) => r.id !== id), run]);
    setOpenRunId(id);
    notify.saved(`Đã lưu bản ${status === "official" ? "CHÍNH THỨC" : "nháp"}: "${run.title}".`);
  };

  const openRun = (run: ReconciliationRun) => {
    try {
      const raw = sheetsFromBase64(run.fileB64);
      const kq0 = reconcile(raw, {
        threshold: run.threshold,
        edits: run.options?.edits,
        ledgerSheetName: run.options?.ledgerSheetName,
        taxSideSheets: run.options?.taxSideSheets,
      });
      const baseline = kq0.suspects.length + kq0.mergedSuspects.reduce((s, g) => s + g.rowCount, 0);
      setFile(null);
      setB64(run.fileB64);
      setDisplayName(run.fileName || run.title);
      setSavedRunName(run.title);
      setThreshold(run.threshold);
      setEdits(run.options?.edits ?? {});
      setEditLog({});
      setLedgerSheetName(run.options?.ledgerSheetName);
      setInitialSuspectCount(baseline);
      setOpenRunId(run.id);
      setWb(raw);
      setTab(kq0.invoiceSheets[0]?.name ?? (kq0.ledgerSheet ? LEDGER_TAB : ""));
      setInvoiceFilter("all");
      setLedgerMissingOnly(false);
      const savedSides = run.options?.taxSideSheets ?? null;
      setPickedTaxSides(savedSides);
      const savedMode = run.options?.mode as ReconciliationMode | undefined;
      setMode(savedMode && RECONCILIATION_MODES.includes(savedMode) ? savedMode : modeForFile(kq0, savedSides));
      notify.saved(`Đã mở lại "${run.title}" (${run.status === "official" ? "chính thức" : "nháp"}).`);
    } catch (err) {
      notify.error(`Không mở lại được: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const removeRun = (run: ReconciliationRun) => {
    const remaining = runs.filter((r) => r.id !== run.id);
    setRuns(remaining);
    if (openRunId === run.id) setOpenRunId(null);
    notify.deleted(`Đã xóa bản "${run.title}".`, () => setRuns([...remaining, run]));
  };

  const downloadRunExcel = (run: ReconciliationRun) => {
    try {
      const raw = sheetsFromBase64(run.fileB64);
      const result = reconcile(raw, {
        threshold: run.threshold,
        edits: run.options?.edits,
        ledgerSheetName: run.options?.ledgerSheetName,
        taxSideSheets: run.options?.taxSideSheets,
      });
      void exportFile({ ...result, taxSideSheets: run.options?.taxSideSheets }, run.title || "doi-soat", run.fileB64, run.options?.edits);
    } catch (err) {
      notify.error(`Không xuất được: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Drill-down: bấm thẻ tổng → nhảy xuống đúng bảng + lọc sẵn theo trạng thái đó.
  const firstInvoiceTab = reconResult?.invoiceSheets[0]?.name ?? "";
  const goToInvoices = (statusFilter: InvoiceMatchStatus | "all") => {
    if (firstInvoiceTab) setTab(firstInvoiceTab);
    setInvoiceFilter(statusFilter);
    scrollToId("ds-bang");
  };
  const goToLedger = (onlyMissing: boolean) => {
    if (reconResult?.ledgerSheet) setTab(LEDGER_TAB);
    setLedgerMissingOnly(onlyMissing);
    scrollToId("ds-bang");
  };

  const cards: StatCardData[] = [];
  if (reconResult) {
    const t = reconResult.totals;
    const suspectCount = reconResult.suspects.length + reconResult.mergedSuspects.reduce((s, g) => s + g.rowCount, 0);
    cards.push(
      { label: "Hóa đơn điện tử", value: num(t.invoiceCount), numeric: true, color: "brand", icon: FileSpreadsheet, onSelect: () => goToInvoices("all"), selectHint: "Xem tất cả hóa đơn điện tử" },
      { label: "Khớp", value: num(t.matched), numeric: true, color: "success", onSelect: () => goToInvoices("MATCHED"), selectHint: "Xem hóa đơn đã khớp sổ" },
      // tong.lech và tong.lechThue là HAI nhóm rời (cùng trạng thái LECH) — thẻ cộng cả hai cho khớp số ở bộ lọc bảng.
      { label: "Lệch tiền / thuế", value: num(t.mismatched + t.taxMismatched), numeric: true, color: "warning", subtext: `${num(t.mismatched)} lệch tiền · ${num(t.taxMismatched)} lệch thuế`, onSelect: () => goToInvoices("MISMATCHED"), selectHint: "Xem hóa đơn lệch tiền / lệch thuế" },
      {
        label: "Chưa vào sổ",
        value: num(t.missing),
        numeric: true,
        color: "danger",
        subtext: [t.missingNotRequired ? `${num(t.missingNotRequired)} không cần vào sổ` : "", t.nearMatched ? `${num(t.nearMatched)} gần khớp` : ""].filter(Boolean).join(" · ") || undefined,
        onSelect: () => goToInvoices("MISSING"),
        selectHint: "Xem hóa đơn chưa có trong sổ",
      },
      { label: "Dòng sổ kế toán", value: num(t.ledgerRowCount), numeric: true, color: "brand", onSelect: () => goToLedger(false), selectHint: "Xem tất cả dòng sổ kế toán" },
      { label: "Dòng sổ thiếu hóa đơn", value: num(t.ledgerMissing), numeric: true, color: "danger", onSelect: () => goToLedger(true), selectHint: "Xem dòng sổ chưa có hóa đơn" },
      { label: "Tổng tiền lệch", value: num(t.totalDifference), numeric: true, color: "warning", subtext: "ở các hóa đơn lệch tiền", onSelect: () => goToInvoices("MISMATCHED"), selectHint: "Xem hóa đơn lệch tiền" },
      { label: "Cần soát lại", value: num(suspectCount), numeric: true, color: suspectCount ? "warning" : "success", onSelect: suspectCount ? () => scrollToId("ds-nghivan") : undefined, selectHint: suspectCount ? "Xuống mục cần soát lại" : undefined }
    );
  }

  const modeCounts: Record<ReconciliationMode, { text: string; applicable: boolean }> = {
    ledger: reconResult?.ledgerSheet
      ? { text: `${num(reconResult.totals.missing)} chưa vào sổ · ${num(reconResult.totals.mismatched)} lệch tiền · ${num(reconResult.totals.taxMismatched)} lệch thuế`, applicable: true }
      : { text: "File không có sheet sổ kế toán", applicable: false },
    twoVersion: versionCompare
      ? { text: `${num(versionCompare.totals.sentOnlyCount)} bản tự tải thiếu · ${num(versionCompare.totals.amountMismatchCount)} lệch tiền`, applicable: true }
      : { text: invoiceSheetNames.length < 2 ? "Cần 2 sheet hóa đơn (thuế gửi + tự tải)" : "Chưa chia được hai bên — bấm để chọn", applicable: false },
    columnSum: (() => {
      const items = reconResult?.invoiceSheets.filter((s) => !s.isSubset) ?? [];
      const that = items.reduce((n, s) => n + s.columnSum.rowCounts.realDiff, 0);
      return { text: that ? `${num(that)} dòng lệch thật` : "Không có dòng lệch thật", applicable: items.length > 0 };
    })(),
    sameDay: sameDayGroups.length
      ? { text: `${num(sameDayGroups.length)} nhóm · ${num(sameDayGroups.filter((g) => g.sameAmount).length)} trùng khít tiền`, applicable: true }
      : { text: "Không có nhóm nào", applicable: false },
  };

  const ledgerSheets = reconResult ? [reconResult.ledgerSheet, ...reconResult.extraLedgerSheets].filter(Boolean) as LedgerSheet[] : [];
  const selfCheckFailed = reconResult ? reconResult.trialChecks.some((p) => !p.passed) : false;
  const isCheckOpenEffective = isCheckOpen || selfCheckFailed; // luôn mở khi có phép tự kiểm chưa đạt

  return (
    <div className="space-y-6">
      {/* Tiêu đề cấp 1 cho trình đọc màn hình — thanh đầu AppShell không còn là h1. */}
      <h1 className="sr-only">Đối soát hóa đơn điện tử</h1>
      <Card>
        <CardHeader>
          <CardTitle>Đối soát hóa đơn điện tử với phần mềm kế toán</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tải một file Excel có các sheet hóa đơn điện tử (cổng thuế), kèm sheet sổ kế toán nếu có. Máy
            chạy một lần rồi cho xem theo <b>việc bạn cần soát</b>: hóa đơn ⇄ sổ · so hai bản hóa đơn (thuế
            gửi ⇄ tự tải) · kiểm cộng cột bảng kê · cùng MST cùng ngày. Ghép theo <b>MST người bán · ký hiệu ·
            số hóa đơn</b>. Hệ thống <b>KHÔNG tự sửa số liệu</b> — chỗ nghi sai chỉ được báo, bạn tự bấm Sửa từng dòng.
          </p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={loadFile} />
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
            <Button
              title="Chọn file Excel hóa đơn điện tử để đối soát với sổ phần mềm." variant="outline" onClick={pickFile} className="w-full md:w-auto">
              <Upload />
              {file ? "Chọn file khác" : "Chọn file Excel"}
            </Button>
            <Button
              title="Tải về file Excel mẫu đúng định dạng. Hệ thống vẫn đọc được file khác, đây chỉ là bản chuẩn cho dễ."
              variant="outline"
              onClick={() => {
                exportReconciliationTemplate();
                notify.saved("Đã tải file mẫu — làm theo format này (hệ thống vẫn đọc file khác).");
              }}
              className="w-full md:w-auto"
            >
              <FileDown />
              Tải file mẫu
            </Button>
            <div className="w-full md:w-56">
              <NumberField
                label="Ngưỡng khớp"
                unit="đ"
                value={threshold}
                onChange={setThreshold}
                hint="Chênh ≤ ngưỡng vẫn coi là khớp (nuốt sai số làm tròn)."
              />
            </div>
            <Button
              title="Chạy đối soát trên file đã chọn — sau đó chọn việc cần soát: đối chiếu sổ, so hai bản, kiểm cộng cột, cùng MST cùng ngày." onClick={runReconcile} disabled={isRunning} className="w-full md:w-auto">
              <ScanSearch />
              {isRunning ? "Đang đối soát…" : "Đối soát"}
            </Button>
            {reconResult && (
              <Button
                title="Tải toàn bộ kết quả đối soát ra file Excel để gửi kế toán." variant="outline" onClick={downloadExcel} className="w-full md:w-auto">
                <Download />
                Tải Excel kết quả
              </Button>
            )}
          </div>
          {file && (
            <p className="text-sm text-muted-foreground">
              File đang chọn: <span className="font-medium text-foreground">{file.name}</span>
            </p>
          )}
          {/* Chọn sổ chuẩn khi có nhiều sheet sổ (§4) */}
          {ledgerSheets.length > 1 && (
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-medium">
                Có {ledgerSheets.length} sheet sổ. Chọn bản CHUẨN (chỉ bản này vào tổng):
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ledgerSheets.map((s) => (
                  <Button
                    title="Chọn sheet này làm sổ phần mềm chuẩn để đối chiếu."
                    key={s.name}
                    size="sm"
                    variant={reconResult?.ledgerSheet?.name === s.name ? "default" : "outline"}
                    onClick={() => setLedgerSheetName(s.name)}
                  >
                    {s.name}
                    {reconResult?.ledgerSheet?.name === s.name && " ✓"}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {/* Lưu bản đối soát theo tài khoản (v4) */}
          {reconResult && (
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-medium">Lưu bản đối soát này theo tài khoản</p>
              <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end">
                <div className="w-full md:flex-1">
                  <Input
                    value={savedRunName}
                    onChange={(e) => setSavedRunName(e.target.value)}
                    placeholder="Tên bản (VD: Đối soát T02-2026)"
                    aria-label="Tên bản lưu"
                  />
                </div>
                <Button
                  title="Lưu lần đối soát này dưới dạng NHÁP — mở lại sửa tiếp được, số chưa đóng băng." variant="outline" onClick={() => saveRun("draft")} className="w-full md:w-auto">
                  <Save /> Lưu nháp
                </Button>
                <Button
                  title="Lưu lần đối soát này thành bản CHÍNH THỨC — tóm tắt kết quả được đóng băng để đối chiếu về sau." onClick={() => saveRun("official")} className="w-full md:w-auto">
                  <Save /> Lưu chính thức
                </Button>
              </div>
              {openRunId && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Đang mở một bản đã lưu — bấm Lưu sẽ CẬP NHẬT bản đó (không tạo bản mới).
                </p>
              )}
              {!auth.session && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Chưa đăng nhập máy chủ → bản lưu chỉ nằm trên MÁY NÀY. Đăng nhập để lưu theo tài khoản, xem trên máy khác.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <SavedRunsBox
        runs={myRuns}
        openRunId={openRunId}
        laAdmin={auth.isAdmin}
        onOpen={openRun}
        onDownload={downloadRunExcel}
        onDelete={removeRun}
      />

      {!reconResult ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="Chưa có kết quả đối soát"
          description="Chọn file Excel rồi bấm Đối soát. File cần ít nhất một sheet hóa đơn điện tử; có thêm sheet sổ kế toán thì đối chiếu được với sổ, có hai bản hóa đơn thì so được hai bản."
          action={
            <Button
              title="Chọn file Excel hóa đơn điện tử để bắt đầu." variant="outline" onClick={pickFile}>
              <Upload /> Chọn file Excel
            </Button>
          }
        />
      ) : (
        <>
          <section className="space-y-3" aria-label="Việc cần soát">
            <h2 className="font-semibold">Bạn cần soát việc gì?</h2>
            <ReconciliationModePicker mode={mode} setMode={setMode} counts={modeCounts} />
            <ReconciliationRulesBox warnings={reconResult.warnings} />
          </section>

          {mode === "twoVersion" && (
            <TwoVersionView
              result={versionCompare}
              sheetNames={invoiceSheetNames}
              taxSheets={sideSplit.taxSide}
              method={sideSplit.method}
              onChangeSide={changeSide}
              onAutoDetect={() => setPickedTaxSides(null)}
            />
          )}
          {mode === "columnSum" && <ColumnSumCheckView sheets={reconResult.invoiceSheets} />}
          {mode === "sameDay" && <SameDayView groups={sameDayGroups} />}

          {mode === "ledger" && (
          <>
          {!reconResult.ledgerSheet && (
            <div className="rounded-xl border border-warning/30 bg-warning-surface p-3 text-sm">
              File này <b>không có sheet sổ kế toán</b> (PHẦN MỀM / PMEM) nên mọi hóa đơn sẽ hiện “chưa vào sổ”.
              Nếu bạn chỉ cần kiểm cộng cột hay so hai bản hóa đơn, chọn kiểu tương ứng ở trên.
            </div>
          )}
          <StatCardGrid cards={cards} columns={4} />
          <p className="text-sm text-muted-foreground">
            Bấm vào một thẻ số ở trên để nhảy thẳng xuống danh sách tương ứng bên dưới.
          </p>

          {reconResult.removedOldColumns && (
            <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Đã tự gỡ cột đối soát của lần chạy trước (KẾT QUẢ + các cột phân tích) để chạy lại sạch — file gốc của bạn không bị đổi.
            </p>
          )}

          {(reconResult.suspects.length > 0 || reconResult.mergedSuspects.length > 0 || Object.keys(editLog).length > 0) && (
            <div id="ds-nghivan">
              <SuspectBox
                suspects={reconResult.suspects}
                mergedSuspects={reconResult.mergedSuspects}
                edits={edits}
                onEdit={applyFix}
                onUndo={undoEdit}
                editLog={editLog}
              />
            </div>
          )}

          <div id="ds-bang">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex-wrap">
                {reconResult.invoiceSheets.map((s) => (
                  <TabsTrigger key={s.name} value={s.name}>
                    {s.name}
                  </TabsTrigger>
                ))}
                {reconResult.ledgerSheet && <TabsTrigger value={LEDGER_TAB}>{reconResult.ledgerSheet.name}</TabsTrigger>}
                {reconResult.extraLedgerSheets.map((s) => (
                  <TabsTrigger key={s.name} value={`phu-${s.name}`}>
                    {s.name} (phụ)
                  </TabsTrigger>
                ))}
              </TabsList>
              {reconResult.invoiceSheets.map((s) => (
                <TabsContent key={s.name} value={s.name} className="mt-4">
                  <InvoiceTable sheet={s} filter={invoiceFilter} setFilter={setInvoiceFilter} />
                </TabsContent>
              ))}
              {reconResult.ledgerSheet && (
                <TabsContent value={LEDGER_TAB} className="mt-4">
                  <LedgerTable sheet={reconResult.ledgerSheet} missingOnly={ledgerMissingOnly} setMissingOnly={setLedgerMissingOnly} />
                </TabsContent>
              )}
              {reconResult.extraLedgerSheets.map((s) => (
                <TabsContent key={s.name} value={`phu-${s.name}`} className="mt-4">
                  <LedgerTable sheet={s} missingOnly={ledgerMissingOnly} setMissingOnly={setLedgerMissingOnly} />
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Kiểm tra chi tiết — gập cho gọn; tự mở khi có phép chưa đạt hoặc có cảnh báo */}
          <div className="space-y-4">
            <button
              title="Mở / thu phần máy tự kiểm tra và đối chiếu số liệu."
              type="button"
              onClick={() => setIsCheckOpen((v) => !v)}
              aria-expanded={isCheckOpenEffective}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex items-center gap-2 font-semibold">
                {isCheckOpenEffective ? <ChevronDown className="size-5" aria-hidden /> : <ChevronRight className="size-5" aria-hidden />}
                <ShieldCheck className="size-5 text-muted-foreground" aria-hidden />
                Máy tự kiểm tra &amp; đối chiếu số liệu
              </span>
              <span className={`shrink-0 text-sm font-medium ${selfCheckFailed ? "text-destructive" : "text-success"}`}>
                {selfCheckFailed ? "⚠ có chỗ chưa đạt — mở xem" : "✓ đã tự kiểm, khớp"}
              </span>
            </button>
            {isCheckOpenEffective && (
              <>
                <SelfCheckBox checks={reconResult.trialChecks} />
                <BridgeBox bridge={reconResult.bridge} />
                {reconResult.warnings.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-warning">
                        <AlertTriangle className="size-5" aria-hidden />
                        Cảnh báo khác ({reconResult.warnings.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5 text-sm">
                        {reconResult.warnings.slice(0, 40).map((c, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="font-medium whitespace-nowrap text-muted-foreground">{c.kind}:</span>
                            <span>{c.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
          </>
          )}
        </>
      )}
    </div>
  );
}
