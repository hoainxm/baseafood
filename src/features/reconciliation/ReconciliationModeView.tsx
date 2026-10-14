// ============================================================
// Tên file: src/features/reconciliation/ReconciliationModeView.tsx
// Tên tiếng Việt tương đương: Các kiểu đối soát trên màn /doi-soat
// Description: Bộ chọn "việc cần soát" + 3 khung xem ngoài chiều hóa đơn ⇄ sổ:
//   so hai bản HĐĐT · kiểm cộng cột bảng kê · hóa đơn cùng MST cùng ngày.
//   Trước đây ba việc này CHỈ ra trong file Excel; nay xem + lọc ngay trên màn.
//   Mọi số lấy từ hàm thuần ở lib (doiSoatHaiBan / canDoiCot của engine) — màn
//   không tự tính lại gì, nên số trên màn và số trong file xuất là một.
// ============================================================
import { useMemo, useState } from "react";
import {
  HorizontalScroll,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  RecordTable,
  Tag,
  StatCardGrid,
  type RecordTableColumn,
  type StatCardData,
} from "@/design-system";
import {
  SUM_MISMATCH_LABELS,
  aoaToExcelColumn,
  type FlowWarning,
  type SumMismatchRow,
  type InvoiceSheet,
} from "@/lib/einvoiceReconciliation";
import {
  columnIndexToLetter,
  type SideSplitMethod,
  type TwoVersionRow,
  type TwoVersionResult,
  type SameDayGroup,
} from "@/lib/twoVersionReconciliation";
import { num } from "@/lib/format";
import type { ReconciliationMode } from "./reconciliationMode";
import {
  BookOpenCheck,
  Calculator,
  CalendarSearch,
  ChevronDown,
  ChevronRight,
  Files,
  ListChecks,
  RotateCcw,
} from "lucide-react";

const MODES: { id: ReconciliationMode; label: string; description: string; icon: typeof Files }[] = [
  {
    id: "ledger",
    label: "Hóa đơn ⇄ sổ kế toán",
    description: "Hóa đơn nào chưa vào sổ, lệch tiền, lệch thuế; dòng sổ nào không có hóa đơn.",
    icon: BookOpenCheck,
  },
  {
    id: "twoVersion",
    label: "So hai bản hóa đơn",
    description: "Bản cơ quan thuế gửi ⇄ bản kế toán tự tải: hóa đơn chỉ một bên có, hóa đơn lệch tiền.",
    icon: Files,
  },
  {
    id: "columnSum",
    label: "Kiểm cộng cột bảng kê",
    description: "Chưa thuế + thuế có bằng tổng thanh toán không; lệch ở dòng nào, do phí / chiết khấu / làm tròn hay sai thật.",
    icon: Calculator,
  },
  {
    id: "sameDay",
    label: "Cùng MST cùng ngày",
    description: "Một người bán xuất nhiều hóa đơn trong một ngày — lọc ra nhóm trùng khít số tiền (dễ kê hai lần).",
    icon: CalendarSearch,
  },
];

// ---------- Bộ chọn kiểu đối soát ----------
export function ReconciliationModePicker({
  mode,
  setMode,
  counts,
}: {
  mode: ReconciliationMode;
  setMode: (c: ReconciliationMode) => void;
  /** Dòng tóm tắt dưới mỗi nút (VD "56 chưa vào sổ"), hoặc lý do chưa áp dụng được. */
  counts: Record<ReconciliationMode, { text: string; applicable: boolean }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Việc cần soát">
      {MODES.map((c) => {
        const isSelected = mode === c.id;
        const Icon = c.icon;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            title={`Xem kết quả kiểu "${c.label}": ${c.description}`}
            onClick={() => setMode(c.id)}
            className={`flex min-h-11 flex-col gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              isSelected ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted/40"
            }`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              {c.label}
              {isSelected && <span className="ml-auto shrink-0 text-sm font-medium text-primary">Đang xem</span>}
            </span>
            <span className="text-sm text-muted-foreground">{c.description}</span>
            <span className={`text-sm font-medium ${counts[c.id].applicable ? "text-foreground" : "text-muted-foreground"}`}>
              {counts[c.id].text}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Quy tắc máy đang áp dụng ----------
/** Quy tắc đã chốt qua các đợt đối soát thật (doc 37). Giữ câu ngắn, lời thường. */
const RULES: { name: string; content: string }[] = [
  { name: "Khóa ghép", content: "MST người bán + ký hiệu + số hóa đơn. MST chỉ so phần chữ số (0301234567-001 = 0301234567001), MST mất số 0 đầu được bù lại; số hóa đơn bỏ số 0 ở đầu (00060568 = 60568); ký hiệu bỏ chữ số mẫu số gộp đầu (1C26TTN = C26TTN)." },
  { name: "Cộng dồn", content: "Một hóa đơn tách nhiều dòng sổ (theo thuế suất / theo mặt hàng) được cộng lại rồi mới so." },
  { name: "So đủ 3 cột", content: "So trước thuế, thuế và tổng ở từng hóa đơn. Tổng lệch ⇒ LỆCH TIỀN; tổng khớp mà thuế lệch ⇒ LỆCH THUẾ; chỉ trước thuế lệch ⇒ vẫn khớp (thường do chiết khấu / phí)." },
  { name: "Ngoại tệ", content: "Máy tự dò bản xuất để tiền ở nguyên tệ (phải nhân tỷ giá) hay đã quy sẵn VND, bằng cách so với các hóa đơn đã khớp sổ. Không mặc định nhân. Ngoại tệ thiếu tỷ giá thì máy báo, không tự coi là VND." },
  { name: "Không cần vào sổ", content: "Hóa đơn đã bị thay thế / xóa bỏ / hủy không phải kê. Hóa đơn đã bị ĐIỀU CHỈNH vẫn phải kê — không gộp chung." },
  { name: "Hóa đơn bán hàng (mẫu số 2)", content: "Không có thuế GTGT: ô thuế trống là đúng, chưa thuế phải bằng tổng thanh toán." },
  { name: "Làm tròn", content: "Lệch ±1 đ là làm tròn của bên phát hành, không phải sai. Hóa đơn để nguyên tệ thì chỉ ±1 xu (0,01) mới là làm tròn — lệch 1 USD là lệch thật." },
  { name: "Gần khớp", content: "Hóa đơn chưa vào sổ nhưng sổ có dòng cùng MST + cùng số tiền ⇒ nghi gõ sai số hóa đơn ở sổ, tách riêng để khỏi kê hai lần." },
  { name: "Ghi chú tay", content: "Dòng ghi chú kế toán gõ dưới bảng (không có ký hiệu, không có MST hợp lệ) bị bỏ qua, không bị coi là hóa đơn." },
  { name: "Hai bản", content: "Sheet có chữ “thuế” trong tên là bản thuế gửi; không có thì sheet mang chữ “tải” là bản tự tải. Nhận sai thì chọn lại ở mục So hai bản. File có sổ mà hai bản gối nhau thì chỉ bản thuế gửi được đối chiếu sổ (khỏi đếm hai lần)." },
  { name: "Không sửa số", content: "Máy chỉ báo. Số chỉ đổi khi bạn bấm Sửa từng dòng; file xuất giữ nguyên định dạng và địa chỉ ô của file gốc." },
];

export function ReconciliationRulesBox({ warnings }: { warnings: FlowWarning[] }) {
  const [mo, setMo] = useState(false);
  const fxWarnings = warnings.filter((c) => c.kind === "Đơn vị tiền tệ ngoại tệ");
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        title="Mở / thu danh sách quy tắc máy đang dùng để ghép và kết luận."
        aria-expanded={mo}
        onClick={() => setMo((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {mo ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
        <ListChecks className="size-4 text-muted-foreground" aria-hidden />
        Quy tắc máy đang áp dụng ({RULES.length})
      </button>
      {mo && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <ul className="space-y-2 text-sm">
            {RULES.map((q) => (
              <li key={q.name}>
                <span className="font-medium">{q.name}: </span>
                <span className="text-muted-foreground">{q.content}</span>
              </li>
            ))}
          </ul>
          {fxWarnings.length > 0 && (
            <p className="rounded-lg border border-warning/30 bg-warning-surface p-2 text-sm">
              <b>Ngoại tệ ở file này:</b> {fxWarnings.map((c) => c.detail).join(" ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Chia bên thuế gửi / tự tải ----------
const METHOD_LABELS: Record<SideSplitMethod, string> = {
  "chi-dinh": "bạn đã tự chọn",
  "ten-thue": "máy nhận theo chữ “thuế” trong tên sheet",
  "ten-tai": "máy nhận theo chữ “tải” trong tên sheet",
  "khong-ro": "máy chưa nhận ra — hãy chọn",
};

function SideSplitBox({
  sheetNames,
  taxSheets: taxSides,
  method,
  onChange,
  onAutoDetect,
}: {
  sheetNames: string[];
  taxSheets: ReadonlySet<string>;
  method: SideSplitMethod;
  onChange: (ten: string, isTaxSide: boolean) => void;
  onAutoDetect: () => void;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Sheet nào là bản nào? <span className="font-normal text-muted-foreground">({METHOD_LABELS[method]})</span>
        </p>
        {method === "chi-dinh" && (
          <Button title="Bỏ lựa chọn tay, để máy tự nhận bản thuế / bản tự tải theo tên sheet." variant="outline" size="sm" onClick={onAutoDetect}>
            <RotateCcw /> Để máy tự nhận
          </Button>
        )}
      </div>
      <ul className="mt-2 space-y-2">
        {sheetNames.map((t) => {
          const isTaxSide = taxSides.has(t);
          return (
            <li key={t} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0 break-words font-medium">{t}</span>
              <span className="flex shrink-0 gap-2">
                <Button
                  title={`Đánh dấu sheet "${t}" là bản CƠ QUAN THUẾ gửi.`}
                  size="sm"
                  variant={isTaxSide ? "default" : "outline"}
                  aria-pressed={isTaxSide}
                  onClick={() => onChange(t, true)}
                >
                  Thuế gửi
                </Button>
                <Button
                  title={`Đánh dấu sheet "${t}" là bản kế toán TỰ TẢI từ cổng.`}
                  size="sm"
                  variant={!isTaxSide ? "default" : "outline"}
                  aria-pressed={!isTaxSide}
                  onClick={() => onChange(t, false)}
                >
                  Tự tải
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- 1. So hai bản ----------
type TwoVersionFilter = "all" | "CHI_THUE" | "CHI_TAI" | "LECH" | "KHONG_SO";

function twoVersionChip(d: TwoVersionRow) {
  if (d.ben === "CHI_THUE") return <Tag variant="loi">Chỉ bản thuế có</Tag>;
  if (d.ben === "CHI_TAI") return <Tag variant="luu-y">Chỉ bản tự tải có</Tag>;
  if (d.amountUncomparable) return <Tag variant="luu-y">Không so được tiền</Tag>;
  if (d.amountMismatch) return <Tag variant="loi">Lệch tiền</Tag>;
  return <Tag variant="xong">Khớp</Tag>;
}

export function TwoVersionView({
  result,
  sheetNames,
  taxSheets: taxSides,
  method,
  onChangeSide,
  onAutoDetect,
}: {
  result: TwoVersionResult | null;
  sheetNames: string[];
  taxSheets: ReadonlySet<string>;
  method: SideSplitMethod;
  onChangeSide: (ten: string, isTaxSide: boolean) => void;
  onAutoDetect: () => void;
}) {
  const [filter, setFilter] = useState<TwoVersionFilter>("all");
  const rows = useMemo(() => {
    if (!result) return [];
    if (filter === "all") return result.rows;
    if (filter === "LECH") return result.rows.filter((d) => d.amountMismatch);
    if (filter === "KHONG_SO") return result.rows.filter((d) => d.amountUncomparable);
    return result.rows.filter((d) => d.ben === filter);
  }, [result, filter]);

  const sideSplitBox = (
    <SideSplitBox sheetNames={sheetNames} taxSheets={taxSides} method={method} onChange={onChangeSide} onAutoDetect={onAutoDetect} />
  );

  if (sheetNames.length < 2)
    return (
      <EmptyState
        icon={Files}
        title="File chỉ có một sheet hóa đơn"
        description="So hai bản cần ít nhất hai sheet hóa đơn: một bản cơ quan thuế gửi và một bản kế toán tự tải. Dán hai bản vào hai sheet của cùng một file rồi chạy lại."
      />
    );
  if (!result)
    return (
      <div className="space-y-4">
        {sideSplitBox}
        <EmptyState
          icon={Files}
          title="Chưa chia được hai bên"
          description="Cần ít nhất một sheet ở mỗi bên. Bấm “Thuế gửi” / “Tự tải” cho từng sheet ở trên."
        />
      </div>
    );

  const t = result.totals;
  const the: StatCardData[] = [
    { label: "Bản thuế gửi", value: num(t.sentCount), numeric: true, color: "brand", subtext: `${num(t.sentAmount)} đ`, onSelect: () => setFilter("all"), selectHint: "Xem tất cả hóa đơn" },
    { label: "Bản tự tải", value: num(t.downloadedCount), numeric: true, color: "brand", subtext: `${num(t.downloadedAmount)} đ`, onSelect: () => setFilter("all"), selectHint: "Xem tất cả hóa đơn" },
    { label: "Chỉ bản thuế có", value: num(t.sentOnlyCount), numeric: true, color: t.sentOnlyCount ? "danger" : "success", subtext: `${num(t.sentOnlyAmount)} đ — bản tự tải thiếu`, onSelect: () => setFilter("CHI_THUE"), selectHint: "Xem hóa đơn bản tự tải thiếu" },
    { label: "Chỉ bản tự tải có", value: num(t.downloadedOnlyCount), numeric: true, color: t.downloadedOnlyCount ? "warning" : "success", subtext: `${num(t.downloadedOnlyAmount)} đ`, onSelect: () => setFilter("CHI_TAI"), selectHint: "Xem hóa đơn bản thuế không có" },
    { label: "Có cả hai, lệch tiền", value: num(t.amountMismatchCount), numeric: true, color: t.amountMismatchCount ? "warning" : "success", onSelect: () => setFilter("LECH"), selectHint: "Xem hóa đơn lệch tiền giữa hai bản" },
    { label: "Không so được tiền", value: num(t.uncomparableCount), numeric: true, color: "trung-tinh", subtext: "sheet trộn hai bố cục cột", onSelect: () => setFilter("KHONG_SO"), selectHint: "Xem hóa đơn không so được tiền" },
  ];
  const TWO_VERSION_FILTERS: { id: TwoVersionFilter; label: string; n: number }[] = [
    { id: "all", label: "Tất cả", n: result.rows.length },
    { id: "CHI_THUE", label: "Chỉ bản thuế có", n: t.sentOnlyCount },
    { id: "CHI_TAI", label: "Chỉ bản tự tải có", n: t.downloadedOnlyCount },
    { id: "LECH", label: "Lệch tiền", n: t.amountMismatchCount },
    { id: "KHONG_SO", label: "Không so được", n: t.uncomparableCount },
  ];
  const columns: RecordTableColumn<TwoVersionRow>[] = [
    { key: "kq", header: "Kết quả", primary: true, render: twoVersionChip },
    { key: "kh", header: "Ký hiệu", render: (d) => d.series, getSortValue: (d) => d.series },
    { key: "so", header: "Số HĐ", render: (d) => d.invoiceNumber },
    { key: "ngay", header: "Ngày lập", render: (d) => d.issueDate, getSortValue: (d) => d.issueDate },
    { key: "ban", header: "Người bán", render: (d) => d.sellerName },
    { key: "tT", header: "Tổng bản thuế", numeric: true, render: (d) => (d.totalSent == null ? "—" : num(d.totalSent)), getSortValue: (d) => d.totalSent ?? 0 },
    { key: "tX", header: "Tổng bản tự tải", numeric: true, render: (d) => (d.totalDownloaded == null ? "—" : num(d.totalDownloaded)), getSortValue: (d) => d.totalDownloaded ?? 0 },
    { key: "chenh", header: "Chênh (thuế − tải)", numeric: true, render: (d) => (d.totalDiff == null ? "—" : num(d.totalDiff)), getSortValue: (d) => Math.abs(d.totalDiff ?? 0) },
    { key: "vt", header: "Ở đâu", render: (d) => [d.sentLocation, d.downloadedLocation].filter(Boolean).join(" · "), hideOnMobile: true },
    { key: "gc", header: "Ghi chú", render: (d) => d.note },
  ];
  return (
    <div className="space-y-4">
      {sideSplitBox}
      <StatCardGrid cards={the} />
      <div className="flex flex-wrap gap-2">
        {TWO_VERSION_FILTERS.map((l) => (
          <Button key={l.id} title={`Lọc danh sách: ${l.label}.`} size="sm" variant={filter === l.id ? "default" : "outline"} onClick={() => setFilter(l.id)}>
            {l.label} <span className="tnum ml-1">({num(l.n)})</span>
          </Button>
        ))}
      </div>
      <RecordTable
        columns={columns}
        rows={rows}
        getKey={(d) => d.key}
        getSearchText={(d) => `${d.series} ${d.invoiceNumber} ${d.sellerName} ${d.sellerTaxCode}`}
        searchLabel="Tìm ký hiệu / số HĐ / người bán / MST…"
        emptyText="Không có hóa đơn nào ở mục này."
      />
    </div>
  );
}

// ---------- 2. Kiểm cộng cột bảng kê ----------
function SheetSumCheck({ sh }: { sh: InvoiceSheet }) {
  const cd = sh.columnSum;
  const [onlyReal, setOnlyReal] = useState(cd.rowCounts.realDiff > 0);
  const rows = useMemo(() => (onlyReal ? cd.mismatchRows.filter((d) => d.kind === "that") : cd.mismatchRows), [cd, onlyReal]);
  const columnLetter = (c: number) => (c >= 0 ? columnIndexToLetter(aoaToExcelColumn(sh.origin, c)) : "");
  const columnName = (c: number, ten: string) => (c >= 0 ? `${ten} (cột ${columnLetter(c)})` : ten);
  const isMatch = Math.abs(cd.diff) < 0.5;
  const o = cd.userDiffCell;

  const bang: [string, number, number | null][] = [
    ["Phí (hợp lệ)", cd.breakdown.fee, cd.rowCounts.fee],
    ["Chiết khấu (hợp lệ)", cd.breakdown.discount, cd.rowCounts.discount],
    ["Làm tròn ±1 đ", cd.breakdown.rounding, cd.rowCounts.rounding],
    ["LỆCH THẬT — phải sửa", cd.breakdown.realDiff, cd.rowCounts.realDiff],
  ];
  const columns: RecordTableColumn<SumMismatchRow>[] = [
    { key: "d", header: "Dòng", primary: true, render: (d) => `dòng ${d.fileRow}`, getSortValue: (d) => d.fileRow },
    { key: "loai", header: "Nguyên nhân", render: (d) => (d.kind === "that" ? <Tag variant="loi">Lệch thật</Tag> : <Tag variant="luu-y">{SUM_MISMATCH_LABELS[d.kind]}</Tag>) },
    { key: "ma", header: "Hóa đơn", render: (d) => d.invoice },
    { key: "ngay", header: "Ngày", render: (d) => d.date, hideOnMobile: true },
    { key: "ban", header: "Người bán", render: (d) => d.seller, hideOnMobile: true },
    { key: "chua", header: "Chưa thuế", numeric: true, render: (d) => num(d.preTax) },
    { key: "thue", header: "Thuế", numeric: true, render: (d) => num(d.tax) },
    { key: "tong", header: "Tổng TT", numeric: true, render: (d) => num(d.total) },
    { key: "lech", header: "Lệch", numeric: true, render: (d) => num(d.diff), getSortValue: (d) => Math.abs(d.diff) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Sheet {sh.name}
          {isMatch ? <Tag variant="xong">Cộng khớp</Tag> : cd.rowCounts.realDiff ? <Tag variant="loi">{`${num(cd.rowCounts.realDiff)} dòng lệch thật`}</Tag> : <Tag variant="luu-y">Lệch bình thường</Tag>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">
          Tổng {columnName(cd.totalColumn, cd.totalName || "tổng thanh toán")} <span className="tnum font-medium">{num(cd.totalSum)}</span> − (
          {columnName(cd.preTaxColumn, cd.preTaxName || "chưa thuế")} <span className="tnum font-medium">{num(cd.preTaxSum)}</span> +{" "}
          {columnName(cd.taxColumn, cd.taxName || "thuế")} <span className="tnum font-medium">{num(cd.taxSum)}</span>) ={" "}
          <span className={`tnum font-bold ${isMatch ? "text-success" : "text-foreground"}`}>{num(cd.diff)} đ</span>
        </p>
        {o && (
          <p className="rounded-lg border border-border bg-muted/40 p-2 text-sm">
            Ô bạn tự đặt dưới bảng: <b>{columnIndexToLetter(aoaToExcelColumn(sh.origin, o.column))}{o.fileRow}</b> ={" "}
            <span className="tnum font-medium">{num(o.value)} đ</span>
            {o.addsFee ? " — công thức đã cộng phí" : ""}
            {o.subtractsDiscount ? ", đã trừ chiết khấu" : ""}. File xuất sẽ chỉ ra ô này gồm những dòng nào.
          </p>
        )}
        {!isMatch && (
          <HorizontalScroll>
            <table className="w-full min-w-80 text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Phần lệch do</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Số dòng</th>
                  <th className="py-1.5 text-right font-medium">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {bang.map(([ten, amount, n]) => (
                  <tr key={ten} className="border-b border-border/60">
                    <td className="py-1.5 pr-3">{ten}</td>
                    <td className="tnum py-1.5 pr-3 text-right">{num(n ?? 0)}</td>
                    <td className="tnum py-1.5 text-right">{num(amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5 pr-3">Cộng = phần lệch</td>
                  <td />
                  <td className="tnum py-1.5 text-right">{num(cd.diff)}</td>
                </tr>
              </tbody>
            </table>
          </HorizontalScroll>
        )}
        {cd.mismatchRows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button title="Chỉ xem dòng lệch không giải thích được — chỗ phải mở hóa đơn gốc ra sửa." size="sm" variant={onlyReal ? "default" : "outline"} onClick={() => setOnlyReal(true)}>
                Chỉ lệch thật <span className="tnum ml-1">({num(cd.rowCounts.realDiff)})</span>
              </Button>
              <Button title="Xem mọi dòng có chưa thuế + thuế khác tổng thanh toán, kể cả phí / chiết khấu / làm tròn." size="sm" variant={!onlyReal ? "default" : "outline"} onClick={() => setOnlyReal(false)}>
                Mọi dòng lệch <span className="tnum ml-1">({num(cd.mismatchRows.length)})</span>
              </Button>
            </div>
            <RecordTable
              columns={columns}
              rows={rows}
              getKey={(d) => `${d.fileRow}`}
              getSearchText={(d) => `${d.invoice} ${d.seller} ${d.fileRow}`}
              searchLabel="Tìm hóa đơn / người bán / số dòng…"
              emptyText="Không có dòng lệch thật — phần lệch đều do phí, chiết khấu hoặc làm tròn."
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ColumnSumCheckView({ sheets }: { sheets: InvoiceSheet[] }) {
  const items = sheets.filter((s) => !s.isSubset && s.columnSum.totalColumn >= 0);
  if (!items.length)
    return (
      <EmptyState
        icon={Calculator}
        title="Không tìm thấy cột tiền để cộng"
        description="Cần sheet hóa đơn có cột chưa thuế, thuế và tổng thanh toán."
      />
    );
  const the: StatCardData[] = items.map((s) => {
    const cd = s.columnSum;
    const isMatch = Math.abs(cd.diff) < 0.5;
    return {
      label: s.name,
      value: `${num(cd.diff)} đ`,
      so: true,
      color: isMatch ? "success" : cd.rowCounts.realDiff ? "danger" : "warning",
      phu: isMatch ? "cộng khớp" : cd.rowCounts.realDiff ? `${num(cd.rowCounts.realDiff)} dòng lệch thật · ${num(cd.breakdown.realDiff)} đ` : "chỉ phí / chiết khấu / làm tròn",
    };
  });
  return (
    <div className="space-y-4">
      <StatCardGrid cards={the} />
      {items.map((s) => (
        <SheetSumCheck key={s.name} sh={s} />
      ))}
    </div>
  );
}

// ---------- 3. Cùng MST cùng ngày ----------
export function SameDayView({ groups }: { groups: SameDayGroup[] }) {
  const sameAmountCount = groups.filter((g) => g.sameAmount).length;
  const [onlyDuplicates, setOnlyDuplicates] = useState(sameAmountCount > 0);
  const rows = useMemo(() => (onlyDuplicates ? groups.filter((g) => g.sameAmount) : groups), [groups, onlyDuplicates]);
  if (!groups.length)
    return (
      <EmptyState
        icon={CalendarSearch}
        title="Không có nhóm nào"
        description="Không người bán nào xuất từ 2 hóa đơn trở lên trong cùng một ngày."
      />
    );
  const the: StatCardData[] = [
    { label: "Nhóm cùng MST cùng ngày", value: num(groups.length), numeric: true, color: "brand", onSelect: () => setOnlyDuplicates(false), selectHint: "Xem mọi nhóm" },
    { label: "Hóa đơn trong các nhóm", value: num(groups.reduce((s, g) => s + g.invoiceCount, 0)), numeric: true, color: "trung-tinh" },
    { label: "Nhóm trùng khít số tiền", value: num(sameAmountCount), numeric: true, color: sameAmountCount ? "warning" : "success", subtext: "dễ kê hai lần — soát trước", onSelect: () => setOnlyDuplicates(true), selectHint: "Xem nhóm trùng khít số tiền" },
  ];
  const columns: RecordTableColumn<SameDayGroup>[] = [
    { key: "ban", header: "Người bán", primary: true, render: (g) => g.sellerName || g.sellerTaxCode, getSortValue: (g) => g.sellerName },
    { key: "mst", header: "MST", render: (g) => g.sellerTaxCode, hideOnMobile: true },
    { key: "ngay", header: "Ngày", render: (g) => g.date, getSortValue: (g) => g.date },
    { key: "n", header: "Số HĐ", numeric: true, render: (g) => num(g.invoiceCount), getSortValue: (g) => g.invoiceCount },
    { key: "tien", header: "Tổng tiền", numeric: true, render: (g) => num(g.totalAmount), getSortValue: (g) => g.totalAmount },
    { key: "trung", header: "Trùng tiền", render: (g) => (g.sameAmount ? <span className="font-medium text-warning">{g.duplicateNote}</span> : "—") },
    {
      key: "ds",
      header: "Các hóa đơn",
      render: (g) => g.rows.map((d) => `${d.series}-${d.invoiceNumber} (${num(d.totalVnd)})`).join(" · "),
    },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Nhiều hóa đơn cùng người bán trong một ngày <b>chưa chắc là sai</b> (xăng dầu, siêu thị, phí ngân hàng…). Nhóm có hóa
        đơn trùng khít số tiền mới đáng soát trước.
      </p>
      <StatCardGrid cards={the} />
      <div className="flex flex-wrap gap-2">
        <Button title="Chỉ xem nhóm có hóa đơn trùng khít số tiền." size="sm" variant={onlyDuplicates ? "default" : "outline"} onClick={() => setOnlyDuplicates(true)}>
          Trùng khít số tiền <span className="tnum ml-1">({num(sameAmountCount)})</span>
        </Button>
        <Button title="Xem mọi nhóm cùng người bán cùng ngày." size="sm" variant={!onlyDuplicates ? "default" : "outline"} onClick={() => setOnlyDuplicates(false)}>
          Tất cả <span className="tnum ml-1">({num(groups.length)})</span>
        </Button>
      </div>
      <RecordTable
        columns={columns}
        rows={rows}
        getKey={(g) => `${g.sellerTaxCode}#${g.date}`}
        getSearchText={(g) => `${g.sellerName} ${g.sellerTaxCode} ${g.date} ${g.rows.map((d) => d.invoiceNumber).join(" ")}`}
        searchLabel="Tìm người bán / MST / ngày / số HĐ…"
        emptyText="Không có nhóm nào ở mục này."
      />
    </div>
  );
}
