// ============================================================
// Tên file: src/features/export-planning/ContractListView.tsx
// Tên tiếng Việt: Danh sách hợp đồng xuất khẩu (mọi tháng) — lọc trạng thái, tìm số HĐ
// Description: Contract list across months with state filter, coverage / tolerance hints.
// ============================================================
import { useState } from "react";
import { Button, ChoiceGroup, RecordTable, Tag, formatNumber, type RecordTableColumn } from "@/design-system";
import {
  contractClosure,
  contractStateLabel,
  deviationText,
  contractCoverage,
  contractState,
  contractTotals,
  effectiveDeadline,
  openShipmentsOf,
  pendingRevision,
  workingRevision,
  type ContractState,
  type ExportData,
} from "@/lib/exportPlanning";
import { formatDateVN, formatMoney } from "@/lib/format";
import type { Customer, ExportContract } from "@/types";
import { Eye } from "lucide-react";

const STATE_TAG = { pending: "pending", approved: "source", closed: "done", cancelled: "muted" } as const;
type Filter = "open" | ContractState | "all";
const FILTERS = [
  { value: "open", label: "Đang chạy" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "closed", label: "Đã xuất đủ · đã chốt" },
  { value: "cancelled", label: "Đã hủy" },
  { value: "all", label: "Tất cả" },
];

export function ContractListView({
  data,
  customers,
  filesAvailable,
  canSeePrice,
  today,
  onOpen,
}: {
  data: ExportData;
  customers: readonly Customer[];
  filesAvailable: boolean;
  canSeePrice: boolean;
  today: string;
  onOpen: (id: string) => void;
}) {
  const opts = { filesAvailable };
  const [filter, setFilter] = useState<Filter>("open");
  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name || "(khách chưa rõ)";
  const stateOf = (c: ExportContract) => contractState(data, c.id, opts);
  const rows = data.contracts
    .filter((c) => {
      const st = stateOf(c);
      return filter === "all" || (filter === "open" ? st === "pending" || st === "approved" : st === filter);
    })
    .sort((a, b) => effectiveDeadline(data, b.id).localeCompare(effectiveDeadline(data, a.id)));

  const columns: RecordTableColumn<ExportContract>[] = [
    { key: "no", header: "Số HĐ", primary: true, render: (c) => <span className="font-semibold">{c.contractNo}</span>, getSortValue: (c) => c.contractNo },
    { key: "customer", header: "Khách", render: (c) => nameOf(c.customerId), getSortValue: (c) => nameOf(c.customerId) },
    { key: "signed", header: "Ngày ký", render: (c) => <span className="tnum">{formatDateVN(c.signedOn)}</span>, getSortValue: (c) => c.signedOn, hideOnMobile: true },
    { key: "deadline", header: "Hạn giao", render: (c) => <span className="tnum">{formatDateVN(effectiveDeadline(data, c.id))}</span>, getSortValue: (c) => effectiveDeadline(data, c.id) },
    {
      key: "size",
      header: canSeePrice ? "Kg · tiền" : "Kg",
      numeric: true,
      render: (c) => {
        const r = workingRevision(data, c.id);
        if (!r) return "—";
        const t = contractTotals(r.lines);
        return `${formatNumber(t.kg)}${canSeePrice ? ` · ${formatMoney(t.amount)} ${r.terms.currency}` : ""}`;
      },
    },
    { key: "ships", header: "Chuyến", numeric: true, render: (c) => openShipmentsOf(data, c.id).length },
    {
      key: "state",
      header: "Trạng thái",
      render: (c) => {
        const st = stateOf(c);
        const cov = contractCoverage(data, c.id);
        const cl = contractClosure(data, c.id, opts);
        return (
          <div className="flex flex-wrap gap-1">
            <Tag variant={STATE_TAG[st]}>{contractStateLabel(st, c)}</Tag>
            {pendingRevision(data, c.id) && st !== "pending" && <Tag variant="warning">Bản sửa chờ duyệt</Tag>}
            {(st === "pending" || st === "approved") && !cov.covered && <Tag variant="warning">Chưa lên đủ chuyến</Tag>}
            {(st === "pending" || st === "approved") && effectiveDeadline(data, c.id) < today && (!openShipmentsOf(data, c.id).length || !cov.covered) && <Tag variant="error">Quá hạn giao</Tag>}
            {cl.reason === "out-of-tolerance" && <Tag variant="error">Ngoài dung sai: kg {deviationText(cl.kgDeviationPct)}</Tag>}
          </div>
        );
      },
    },
  ];

  return (
    <div className="grid min-w-0 gap-4">
      <ChoiceGroup label="Trạng thái" hideRequiredMark value={filter} onChange={(v) => setFilter(v as Filter)} options={FILTERS} columns={3} />
      <RecordTable
        columns={columns}
        rows={rows}
        getKey={(c) => c.id}
        rowMarkKey="export-contracts"
        getSearchText={(c) => `${c.contractNo} ${c.orderRef} ${nameOf(c.customerId)}`}
        searchLabel="Tìm số HĐ, số đơn, tên khách…"
        emptyText="Không có hợp đồng nào khớp."
        actions={(c) => (
          <Button size="sm" variant="outline" onClick={() => onOpen(c.id)} title="Mở hồ sơ hợp đồng.">
            <Eye className="mr-1 h-4 w-4" aria-hidden />
            Mở
          </Button>
        )}
      />
    </div>
  );
}
