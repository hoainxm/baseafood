// ============================================================
// Tên file: src/features/import-planning/ImportViews.tsx
// Tên tiếng Việt: Bảng của Nhập khẩu — lô nhập theo tháng, danh sách hợp đồng, phần thủ kho
// Description: Read views of the import planning module (design-spec 46): month view grouped by
//              supplier with 3 stat cards + number search, contract list, warehouse-keeper list.
// ============================================================
import { useState } from "react";
import {
  Button,
  ChoiceGroup,
  Combobox,
  EmptyState,
  Field,
  Input,
  RecordTable,
  StatCardGrid,
  Tag,
  formatNumber,
  type RecordTableColumn,
} from "@/design-system";
import { formatDateVN, formatMoney } from "@/lib/format";
import {
  RECEIPT_STATE_LABELS,
  contractProgress,
  contractState,
  contractTotals,
  importMonth,
  importTypeLabel,
  linesOf,
  monthView,
  receiptLinesOf,
  receiptState,
  receiptsOf,
  searchImports,
  transportLabel,
  IMPORT_DOCUMENT_KINDS,
  type ImportContractState,
  type ImportData,
  type ReceiptState,
} from "@/lib/importPlanning";
import type { ImportContract, ImportDocumentKind, ImportReceipt } from "@/types";
import { ChevronLeft, ChevronRight, Eye, PackageCheck, Ship } from "lucide-react";
import { ContractStateTag, ReceiptStateTag } from "./parts";

const kindLabel = (k: ImportDocumentKind) => IMPORT_DOCUMENT_KINDS.find((x) => x.value === k)?.label ?? k;
const STATE_RANK: Record<ReceiptState, number> = { "missing-docs": 0, "awaiting-quantity": 1, complete: 2, cancelled: 3 };

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
const monthText = (month: string) => `Tháng ${month.slice(5, 7)}/${month.slice(0, 4)}`;

export function MonthNav({ month, today, onChange }: { month: string; today: string; onChange: (m: string) => void }) {
  return (
    <div data-tour="import-month" className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => onChange(shiftMonth(month, -1))} title="Xem tháng trước.">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        <span className="sr-only">Tháng trước</span>
      </Button>
      <span className="tnum min-w-32 text-center font-semibold">{monthText(month)}</span>
      <Button size="sm" variant="outline" onClick={() => onChange(shiftMonth(month, 1))} title="Xem tháng sau.">
        <ChevronRight className="h-4 w-4" aria-hidden />
        <span className="sr-only">Tháng sau</span>
      </Button>
      {month !== today.slice(0, 7) && (
        <Button size="sm" variant="ghost" onClick={() => onChange(today.slice(0, 7))} title="Về tháng hiện tại.">
          Nay
        </Button>
      )}
    </div>
  );
}

const receivedOf = (d: ImportData, r: ImportReceipt) => receiptLinesOf(d, r.id).reduce((s, x) => s + (x.kg ?? 0), 0);

/* ---------- Lô nhập theo tháng ---------- */

export function ImportMonthView({
  data,
  month,
  today,
  onMonthChange,
  onOpen,
}: {
  data: ImportData;
  month: string;
  today: string;
  onMonthChange: (m: string) => void;
  onOpen: (contractId: string, receiptId?: string) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [query, setQuery] = useState("");
  const view = monthView(data, month, supplierId);
  const awaiting = view.groups.flatMap((g) => g.receipts).filter((x) => x.state === "awaiting-quantity").length;
  const supplierOptions = [...new Map(data.contracts.map((c) => [c.supplierId, c.supplierName])).entries()]
    .filter(([id]) => id)
    .map(([value, label]) => ({ value, label: label || "(chưa rõ tên)" }));
  const hits = searchImports(data, query);

  const columns: RecordTableColumn<{ receipt: ImportReceipt; state: ReceiptState; missing: ImportDocumentKind[] }>[] = [
    {
      key: "date",
      header: "Ngày về",
      primary: true,
      sortKind: "date",
      getSortValue: (x) => x.receipt.arrivalDate || x.receipt.expectedDate,
      render: (x) => (
        <span className="tnum grid">
          <span>{x.receipt.arrivalDate ? formatDateVN(x.receipt.arrivalDate) : "Chưa về"}</span>
          {!x.receipt.arrivalDate && x.receipt.expectedDate && <span className="text-sm text-muted-foreground">dự kiến {formatDateVN(x.receipt.expectedDate)}</span>}
        </span>
      ),
    },
    { key: "contract", header: "Hợp đồng", getSortValue: (x) => x.receipt.contractNo, render: (x) => <span className="font-medium break-words">{x.receipt.contractNo}</span> },
    { key: "transport", header: "Vận chuyển", getSortValue: (x) => transportLabel(x.receipt.transport), render: (x) => transportLabel(x.receipt.transport), hideOnMobile: true },
    { key: "cont", header: "Số cont", getSortValue: (x) => x.receipt.containerNo, render: (x) => x.receipt.containerNo || "—", hideOnMobile: true },
    { key: "kg", header: "Kg thực nhập", numeric: true, sortKind: "number", getSortValue: (x) => receivedOf(data, x.receipt), render: (x) => formatNumber(receivedOf(data, x.receipt)) },
    {
      key: "state",
      header: "Trạng thái",
      sortKind: "rank",
      getSortValue: (x) => STATE_RANK[x.state],
      render: (x) => (
        <div className="grid min-w-36 gap-1 whitespace-normal">
          <div>
            <ReceiptStateTag state={x.state} />
          </div>
          {x.missing.length > 0 && <span className="text-sm text-muted-foreground">Còn thiếu: {x.missing.map(kindLabel).join(", ")}</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <MonthNav month={month} today={today} onChange={onMonthChange} />
        <div className="min-w-56 flex-1 basis-56">
          <Combobox label="Đối tác" hideRequiredMark value={supplierId} onChange={setSupplierId} options={[{ value: "", label: "Mọi đối tác" }, ...supplierOptions]} />
        </div>
        <div data-tour="import-search" className="min-w-56 flex-1 basis-56">
          <Field label="Tra số chứng từ (số HĐ · invoice · tờ khai · cont · B/L)">
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} title="Gõ một phần số — tra ở mọi tháng." />
          </Field>
        </div>
      </div>
      {query.trim() ? (
        <SearchResults data={data} hits={hits} onOpen={onOpen} />
      ) : (
        <>
          <div data-tour="import-stats">
            <StatCardGrid
              columns={3}
              cards={[
                { label: "Lô nhập của tháng", value: formatNumber(view.stats.total), subtext: monthText(month), icon: Ship },
                { label: "Đủ hồ sơ", value: formatNumber(view.stats.complete), subtext: "đủ 3 chứng từ bắt buộc + có thực nhập", color: "success" },
                {
                  label: "Còn thiếu",
                  value: formatNumber(view.stats.incomplete),
                  subtext: `thiếu chứng từ ${view.stats.incomplete - awaiting} · chờ thực nhập ${awaiting}`,
                  color: view.stats.incomplete ? "warning" : undefined,
                },
              ]}
            />
          </div>
          {view.groups.length === 0 ? (
            <EmptyState icon={Ship} title={`${monthText(month)} chưa có lô nhập nào`} description="Lập hợp đồng nhập, rồi ở hồ sơ hợp đồng chọn Ghi lần nhập khi hàng sắp về." />
          ) : (
            <div data-tour="import-receipts" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
              {view.groups.map((g) => (
                <section key={g.supplierName} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
                  <h3 className="font-semibold">
                    {g.supplierName} <span className="font-normal text-muted-foreground">· {g.receipts.length} lô</span>
                  </h3>
                  <RecordTable
                    columns={columns}
                    rows={g.receipts}
                    getKey={(x) => x.receipt.id}
                    rowMarkKey={`import-plan:${month}`}
                    emptyText="Không có lô nào."
                    actions={(x) => (
                      <Button size="sm" variant="outline" onClick={() => onOpen(x.receipt.contractId, x.receipt.id)} title="Mở hồ sơ hợp đồng, tới đúng lần nhập này.">
                        <Eye className="mr-1 h-4 w-4" aria-hidden />
                        Mở
                      </Button>
                    )}
                  />
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SearchResults({ data, hits, onOpen }: { data: ImportData; hits: ReturnType<typeof searchImports>; onOpen: (contractId: string, receiptId?: string) => void }) {
  if (!hits.length) return <EmptyState icon={Ship} title="Không thấy số này" description="Kiểm lại số đã gõ. Tra được số hợp đồng, số invoice, số tờ khai, số cont và số B/L ở mọi tháng." />;
  const rows = hits.map((h) => {
    const r = h.kind === "receipt" ? data.receipts.find((x) => x.id === h.id) : undefined;
    const c = data.contracts.find((x) => x.id === h.contractId);
    return { ...h, receipt: r, contract: c };
  });
  const columns: RecordTableColumn<(typeof rows)[number]>[] = [
    { key: "what", header: "Kết quả", primary: true, getSortValue: (x) => x.kind, render: (x) => (x.kind === "contract" ? "Hợp đồng" : "Lần nhập") },
    { key: "no", header: "Hợp đồng", getSortValue: (x) => x.contract?.contractNo ?? x.receipt?.contractNo ?? "", render: (x) => x.contract?.contractNo ?? x.receipt?.contractNo ?? "—" },
    { key: "supplier", header: "Đối tác", getSortValue: (x) => x.contract?.supplierName ?? "", render: (x) => x.contract?.supplierName ?? x.receipt?.supplierName ?? "—" },
    {
      key: "month",
      header: "Tháng",
      sortKind: "date",
      getSortValue: (x) => (x.receipt ? importMonth(x.receipt) : (x.contract?.signedDate ?? "")),
      render: (x) => (x.receipt ? importMonth(x.receipt).split("-").reverse().join("/") : x.contract?.signedDate ? `ký ${formatDateVN(x.contract.signedDate)}` : "—"),
    },
    {
      key: "state",
      header: "Trạng thái",
      sortKind: "text",
      getSortValue: (x) => (x.receipt ? RECEIPT_STATE_LABELS[receiptState(data, x.receipt)] : x.contract ? contractState(data, x.contract) : ""),
      render: (x) => (x.receipt ? <ReceiptStateTag state={receiptState(data, x.receipt)} /> : x.contract ? <ContractStateTag state={contractState(data, x.contract)} /> : null),
    },
  ];
  return (
    <RecordTable
      columns={columns}
      rows={rows}
      getKey={(x) => `${x.kind}:${x.id}`}
      rowMarkKey="import-search"
      emptyText="Không có kết quả."
      actions={(x) => (
        <Button size="sm" variant="outline" onClick={() => onOpen(x.contractId, x.kind === "receipt" ? x.id : undefined)} title="Mở hồ sơ hợp đồng.">
          <Eye className="mr-1 h-4 w-4" aria-hidden />
          Mở
        </Button>
      )}
    />
  );
}

/* ---------- Danh sách hợp đồng ---------- */

type Filter = "open" | "closed" | "cancelled" | "all";
const FILTERS = [
  { value: "open", label: "Đang mở" },
  { value: "closed", label: "Đã đóng" },
  { value: "cancelled", label: "Đã hủy" },
  { value: "all", label: "Tất cả" },
];
const CONTRACT_RANK: Record<ImportContractState, number> = { "no-receipts": 0, receiving: 1, closed: 2, cancelled: 3 };

export function ImportContractList({ data, canSeePrice, onOpen }: { data: ImportData; canSeePrice: boolean; onOpen: (contractId: string) => void }) {
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const rows = data.contracts
    .filter((c) => {
      const st = contractState(data, c);
      return filter === "all" || (filter === "open" ? st === "no-receipts" || st === "receiving" : st === filter);
    })
    .filter((c) => {
      const q = query.trim().toLowerCase();
      return !q || `${c.contractNo} ${c.supplierName}`.toLowerCase().includes(q);
    })
    .sort((a, b) => b.signedDate.localeCompare(a.signedDate));

  const columns: RecordTableColumn<ImportContract>[] = [
    { key: "no", header: "Số HĐ", primary: true, getSortValue: (c) => c.contractNo, render: (c) => <span className="font-semibold break-words">{c.contractNo}</span> },
    { key: "supplier", header: "Đối tác", getSortValue: (c) => c.supplierName, render: (c) => c.supplierName || "—" },
    { key: "signed", header: "Ngày ký", sortKind: "date", getSortValue: (c) => c.signedDate, render: (c) => <span className="tnum">{formatDateVN(c.signedDate)}</span> },
    { key: "type", header: "Loại hình", getSortValue: (c) => importTypeLabel(c.importType), render: (c) => importTypeLabel(c.importType) || "—", hideOnMobile: true },
    {
      key: "kg",
      header: "Đã về / HĐ",
      numeric: true,
      sortKind: "number",
      getSortValue: (c) => contractProgress(data, c.id).receivedKg,
      render: (c) => {
        const p = contractProgress(data, c.id);
        const t = contractTotals(linesOf(data, c.id), c.linePrices);
        return (
          <span className="grid justify-items-end">
            <span className="tnum">
              {formatNumber(p.receivedKg)} / {formatNumber(p.totalKg)} kg
            </span>
            {canSeePrice && t.totalAmount !== null && (
              <span className="tnum text-sm text-muted-foreground">
                {formatMoney(t.totalAmount)} {c.currency}
              </span>
            )}
          </span>
        );
      },
    },
    { key: "receipts", header: "Lần nhập", numeric: true, sortKind: "number", getSortValue: (c) => receiptsOf(data, c.id).length, render: (c) => receiptsOf(data, c.id).length },
    {
      key: "state",
      header: "Trạng thái",
      sortKind: "rank",
      getSortValue: (c) => CONTRACT_RANK[contractState(data, c)],
      render: (c) => {
        const p = contractProgress(data, c.id);
        const st = contractState(data, c);
        return (
          <div className="flex min-w-32 flex-wrap gap-1 whitespace-normal">
            <ContractStateTag state={st} />
            {st === "receiving" && p.shortKg > 0 && <Tag variant="warning">còn {formatNumber(p.shortKg)} kg</Tag>}
          </div>
        );
      },
    },
  ];

  return (
    <div className="grid min-w-0 gap-4">
      <ChoiceGroup label="Trạng thái" hideRequiredMark value={filter} onChange={(v) => setFilter(v as Filter)} options={FILTERS} columns={4} />
      <Field label="Tra hợp đồng (số HĐ · tên đối tác)">
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} title="Gõ một phần số hợp đồng hoặc tên đối tác — lọc ngay danh sách." />
      </Field>
      <RecordTable
        columns={columns}
        rows={rows}
        getKey={(c) => c.id}
        rowMarkKey="import-contracts"
        emptyText="Không có hợp đồng nhập nào khớp."
        actions={(c) => (
          <Button size="sm" variant="outline" onClick={() => onOpen(c.id)} title="Mở hồ sơ hợp đồng nhập.">
            <Eye className="mr-1 h-4 w-4" aria-hidden />
            Mở
          </Button>
        )}
      />
    </div>
  );
}

/* ---------- Phần thủ kho (chỉ quyền .receiving) ---------- */

export function ReceivingView({
  data,
  month,
  today,
  canRecord,
  onMonthChange,
  onRecord,
}: {
  data: ImportData;
  month: string;
  today: string;
  canRecord: boolean;
  onMonthChange: (m: string) => void;
  onRecord: (r: ImportReceipt) => void;
}) {
  const rows = data.receipts
    .filter((r) => r.status !== "cancelled" && importMonth(r) === month)
    .sort((a, b) => (a.arrivalDate || a.expectedDate).localeCompare(b.arrivalDate || b.expectedDate));
  const has = (r: ImportReceipt) => receiptLinesOf(data, r.id).some((x) => (x.kg ?? 0) > 0);
  const columns: RecordTableColumn<ImportReceipt>[] = [
    {
      key: "date",
      header: "Ngày về",
      primary: true,
      sortKind: "date",
      getSortValue: (r) => r.arrivalDate || r.expectedDate,
      render: (r) => <span className="tnum">{r.arrivalDate ? formatDateVN(r.arrivalDate) : `dự kiến ${formatDateVN(r.expectedDate)}`}</span>,
    },
    { key: "contract", header: "Hợp đồng", getSortValue: (r) => r.contractNo, render: (r) => r.contractNo },
    { key: "supplier", header: "Đối tác", getSortValue: (r) => r.supplierName, render: (r) => r.supplierName },
    { key: "cont", header: "Số cont", getSortValue: (r) => r.containerNo, render: (r) => r.containerNo || transportLabel(r.transport) },
    { key: "kg", header: "Kg thực nhập", numeric: true, sortKind: "number", getSortValue: (r) => receivedOf(data, r), render: (r) => formatNumber(receivedOf(data, r)) },
    {
      key: "state",
      header: "Đã ghi",
      sortKind: "rank",
      getSortValue: (r) => (has(r) ? 1 : 0),
      render: (r) => (has(r) ? <Tag variant="done">Đã ghi thực nhập</Tag> : <Tag variant="warning">Chưa ghi thực nhập</Tag>),
    },
  ];
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <p className="max-w-3xl text-muted-foreground">Lô hàng nhập khẩu về kho trong tháng. Hàng về rồi thì ghi số kg thực nhập theo invoice của từng dòng hàng.</p>
      <MonthNav month={month} today={today} onChange={onMonthChange} />
      <RecordTable
        columns={columns}
        rows={rows}
        getKey={(r) => r.id}
        rowMarkKey={`import-receiving:${month}`}
        emptyText={`${monthText(month)} chưa có lô nhập nào.`}
        actions={(r) =>
          canRecord ? (
            <Button size="sm" variant="save" onClick={() => onRecord(r)} title="Ghi số kg thực nhập của lô này.">
              <PackageCheck className="mr-1 h-4 w-4" aria-hidden />
              Ghi thực nhập
            </Button>
          ) : null
        }
      />
    </div>
  );
}

