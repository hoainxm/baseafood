// ============================================================
// Tên file: src/features/export-planning/ContractListView.tsx
// Tên tiếng Việt: Danh sách hợp đồng xuất khẩu (mọi tháng) — lọc trạng thái, tìm số HĐ
// Description: Contract list across months with state filter, coverage / tolerance hints.
// ============================================================
import { useState } from "react";
import { Button, ChoiceGroup, Field, Input, RecordTable, Tag, formatNumber, type RecordTableColumn } from "@/design-system";
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
  CONTRACT_STATE_LABELS,
  isLiveContractState,
  type ExportData,
} from "@/lib/exportPlanning";
import { formatDateVN, formatMoney } from "@/lib/format";
import type { Customer, ExportContract } from "@/types";
import { Eye } from "lucide-react";
import { CONTRACT_STATE_TAG } from "./progress";

type Filter = "open" | ContractState | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Đang mở (mọi chặng)" },
  { value: "pending", label: CONTRACT_STATE_LABELS.pending },
  { value: "attaching", label: CONTRACT_STATE_LABELS.attaching },
  { value: "shipping", label: CONTRACT_STATE_LABELS.shipping },
  { value: "final-review", label: CONTRACT_STATE_LABELS["final-review"] },
  { value: "closed", label: CONTRACT_STATE_LABELS.closed },
  { value: "cancelled", label: CONTRACT_STATE_LABELS.cancelled },
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
  const [query, setQuery] = useState("");
  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name || "(khách chưa rõ)";
  const stateOf = (c: ExportContract) => contractState(data, c.id, opts);
  const rows = data.contracts
    .filter((c) => {
      const st = stateOf(c);
      return filter === "all" || (filter === "open" ? isLiveContractState(st) : st === filter);
    })
    .filter((c) => {
      const q = query.trim().toLowerCase();
      return !q || `${c.contractNo} ${c.orderRef} ${nameOf(c.customerId)}`.toLowerCase().includes(q);
    })
    .sort((a, b) => effectiveDeadline(data, b.id).localeCompare(effectiveDeadline(data, a.id)));

  const columns: RecordTableColumn<ExportContract>[] = [
    { key: "no", header: "Số HĐ", primary: true, render: (c) => <span className="font-semibold break-words @3xl:whitespace-nowrap">{c.contractNo}</span>, getSortValue: (c) => c.contractNo },
    { key: "customer", header: "Khách", render: (c) => nameOf(c.customerId), getSortValue: (c) => nameOf(c.customerId) },
    {
      key: "deadline",
      header: "Hạn giao · ngày ký",
      // Ngày ký là dòng phụ dưới hạn giao — cột riêng làm bảng tràn ngang ở 1366 px (che thẻ trạng thái).
      render: (c) => (
        <span className="tnum grid">
          <span>{formatDateVN(effectiveDeadline(data, c.id))}</span>
          {c.signedOn && <span className="text-sm text-muted-foreground">ký {formatDateVN(c.signedOn)}</span>}
        </span>
      ),
      getSortValue: (c) => effectiveDeadline(data, c.id),
    },
    {
      key: "size",
      header: canSeePrice ? "Kg · tiền" : "Kg",
      numeric: true,
      render: (c) => {
        const r = workingRevision(data, c.id);
        if (!r) return "—";
        const t = contractTotals(r.lines);
        // Kg trên, tiền dưới — một dòng "12.050 · 97.755,00 USD" làm bảng tràn ngang ở 1366 px.
        return (
          <span className="grid justify-items-end">
            <span>{formatNumber(t.kg)} kg</span>
            {canSeePrice && (
              <span className="text-sm text-muted-foreground">
                {formatMoney(t.amount)} {r.terms.currency}
              </span>
            )}
          </span>
        );
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
          <div className="flex min-w-36 flex-wrap gap-1 whitespace-normal">
            <Tag variant={CONTRACT_STATE_TAG[st]}>{contractStateLabel(st, c)}</Tag>
            {pendingRevision(data, c.id) && st !== "pending" && <Tag variant="warning">Bản sửa chờ duyệt</Tag>}
            {isLiveContractState(st) && st !== "final-review" && !cov.covered && <Tag variant="warning">Chưa ghi đủ chuyến</Tag>}
            {isLiveContractState(st) && st !== "final-review" && effectiveDeadline(data, c.id) < today && (!openShipmentsOf(data, c.id).length || !cov.covered) && <Tag variant="error">Quá hạn giao</Tag>}
            {cl.reason === "out-of-tolerance" && <Tag variant="error">Ngoài dung sai: kg {deviationText(cl.kgDeviationPct)}</Tag>}
          </div>
        );
      },
    },
  ];

  return (
    <div className="grid min-w-0 gap-4">
      <ChoiceGroup label="Trạng thái" hideRequiredMark value={filter} onChange={(v) => setFilter(v as Filter)} options={FILTERS} columns={3} />
      {/* Nhãn luôn hiện (luật 5) — ô tìm mặc định của bảng chỉ có chữ mờ. */}
      <Field label="Tra hợp đồng (số HĐ · số PO · tên khách)">
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} title="Gõ một phần số hợp đồng, số PO của khách hoặc tên khách — lọc ngay danh sách." />
      </Field>
      <RecordTable
        columns={columns}
        rows={rows}
        getKey={(c) => c.id}
        rowMarkKey="export-contracts"
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
