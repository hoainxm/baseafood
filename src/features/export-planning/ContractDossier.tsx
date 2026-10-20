// ============================================================
// Tên file: src/features/export-planning/ContractDossier.tsx
// Tên tiếng Việt: Hồ sơ một hợp đồng — điều khoản, dòng hàng, các bản + duyệt, gia hạn, chuyến
// Description: Contract dossier page: header + state, terms, lines, revision / approval history,
//              deadline extensions, tolerance closure, shipments (1 shipment ⇒ shown inline).
// ============================================================
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RecordTable,
  Tag,
  formatNumber,
  type RecordTableColumn,
} from "@/design-system";
import {
  APPROVAL_LABELS,
  CONTRACT_STATE_LABELS,
  PAYMENT_METHODS,
  approvalState,
  approvalsOf,
  contractClosure,
  contractCoverage,
  contractPaymentSummary,
  contractState,
  contractTotals,
  effectiveDeadline,
  effectiveRevision,
  lineAmount,
  lineCartons,
  lineKg,
  pendingRevision,
  requiredDocumentLabel,
  revisionsOf,
  shipmentKindLabel,
  workingRevision,
  type ExportData,
} from "@/lib/exportPlanning";
import { formatDateVN } from "@/lib/format";
import type { ExportContract, ExportContractLine, ExportShipment } from "@/types";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  FilePen,
  FileSignature,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { CollapsibleSection, StepBar, type PreviewTarget } from "./parts";
import { progressText, shipmentProgress } from "./progress";

export interface DossierCan {
  create: boolean;
  update: boolean;
  delete: boolean;
  viewPrice: boolean;
  paymentsWrite: boolean;
}

const STATE_TAG = { pending: "pending", approved: "source", closed: "done", cancelled: "muted" } as const;

export function ContractDossier({
  data,
  contract,
  customerName,
  can,
  filesAvailable,
  selectedShipmentId,
  canDelete,
  canCancel,
  onBack,
  onSelectShipment,
  onEditPending,
  onRevise,
  onApprove,
  onExtend,
  onAddShipment,
  onCancelContract,
  onCloseManually,
  onReopen,
  onDeleteContract,
  onDeposit,
  onPreview,
  children,
}: {
  data: ExportData;
  contract: ExportContract;
  customerName: string;
  can: DossierCan;
  filesAvailable: boolean;
  selectedShipmentId: string;
  canDelete: boolean;
  canCancel: boolean;
  onBack: () => void;
  onSelectShipment: (id: string) => void;
  onEditPending: () => void;
  onRevise: () => void;
  onApprove: () => void;
  onExtend: () => void;
  onAddShipment: () => void;
  onCancelContract: () => void;
  onCloseManually: () => void;
  onReopen: () => void;
  onDeleteContract: () => void;
  onDeposit: () => void;
  onPreview: (f: PreviewTarget) => void;
  /** Khung chuyến đang chọn (ShipmentPanel) — màn truyền vào. */
  children?: React.ReactNode;
}) {
  const opts = { filesAvailable };
  const eff = effectiveRevision(data, contract.id);
  const pending = pendingRevision(data, contract.id);
  const working = workingRevision(data, contract.id);
  const terms = working?.terms;
  const totals = working ? contractTotals(working.lines) : null;
  const state = contractState(data, contract.id, opts);
  const closure = contractClosure(data, contract.id, opts);
  const coverage = contractCoverage(data, contract.id);
  const deadline = effectiveDeadline(data, contract.id);
  const revisions = revisionsOf(data, contract.id);
  const extensions = data.extensions.filter((e) => e.contractId === contract.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const shipments = data.shipments.filter((s) => s.contractId === contract.id).sort((a, b) => (a.loadingDate || a.etd || a.planMonth).localeCompare(b.loadingDate || b.etd || b.planMonth));
  const isOpen = contract.status === "open";
  const currency = terms?.currency || "USD";
  const pay = contractPaymentSummary(data, contract.id);
  const needsApproval = !!pending || (!eff && !!working);

  const lineColumns: RecordTableColumn<ExportContractLine>[] = [
    { key: "description", header: "Tên hàng", primary: true, render: (l) => <span className="font-semibold">{l.description}</span> },
    { key: "size", header: "Size", render: (l) => l.size || "—" },
    { key: "packing", header: "Quy cách", render: (l) => l.packing || "—", hideOnMobile: true },
    {
      key: "qty",
      header: "Số lượng",
      numeric: true,
      render: (l) => `${formatNumber(l.quantity)} ${l.unitKind === "bundle" ? `kiện (${formatNumber(lineCartons(l))} thùng)` : "thùng"}`,
    },
    { key: "kg", header: "Kg", numeric: true, render: (l) => formatNumber(lineKg(l)) },
    ...(can.viewPrice
      ? [
          { key: "price", header: `Đơn giá (${currency}/kg)`, numeric: true, render: (l: ExportContractLine) => formatNumber(l.unitPrice) },
          { key: "amount", header: `Tiền (${currency})`, numeric: true, render: (l: ExportContractLine) => formatNumber(lineAmount(l)) },
        ]
      : []),
    { key: "hs", header: "Mã HS", render: (l) => l.hsCode || "—", secondary: true },
    { key: "micro", header: "Vi sinh / kỹ thuật", render: (l) => l.microSpec || "—", secondary: true },
  ];

  /** Việc làm tiếp của HĐ — MỘT nút chính (design-spec 42): duyệt → lên chuyến → không có. */
  const primary: "approve" | "ship" | null = !isOpen
    ? null
    : can.update && needsApproval
      ? "approve"
      : can.create && (!shipments.some((s) => s.status === "open") || !coverage.covered)
        ? "ship"
        : null;

  const menuItems: { key: string; node: React.ReactNode }[] = [];
  const menuBtn = (key: string, node: React.ReactNode) => menuItems.push({ key, node });
  if (isOpen) {
    if (can.update && needsApproval && primary !== "approve")
      menuBtn("approve", (
        <Button variant="ghost" className="w-full justify-start" onClick={onApprove} title="Ghi kết quả BGĐ ký giấy cho bản đang chờ duyệt.">
          <FileSignature className="mr-2 h-4 w-4" aria-hidden />
          Ghi kết quả duyệt
        </Button>
      ));
    if (can.update && (pending || !eff))
      menuBtn("edit", (
        <Button variant="edit" className="w-full justify-start" onClick={onEditPending} title="Sửa bản đang chờ duyệt (chưa có hiệu lực nên sửa thẳng).">
          <Pencil className="mr-2 h-4 w-4" aria-hidden />
          Sửa bản chờ duyệt
        </Button>
      ));
    if (can.update && eff && !pending)
      menuBtn("revise", (
        <Button variant="ghost" className="w-full justify-start" onClick={onRevise} title="Ghi bản sửa (rvs / phụ kiện / tu chỉnh L/C) — bản đang hiệu lực giữ nguyên tới khi bản sửa được duyệt.">
          <FilePen className="mr-2 h-4 w-4" aria-hidden />
          Ghi bản sửa
        </Button>
      ));
    if (can.update)
      menuBtn("extend", (
        <Button variant="ghost" className="w-full justify-start" onClick={onExtend} title="Ghi hạn giao mới khách đã xác nhận — không cần BGĐ duyệt lại.">
          <CalendarClock className="mr-2 h-4 w-4" aria-hidden />
          Gia hạn giao hàng
        </Button>
      ));
    if (can.create && primary !== "ship")
      menuBtn("ship", (
        <Button variant="ghost" className="w-full justify-start" onClick={onAddShipment} title="Lên thêm một chuyến (một container) cho hợp đồng này.">
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Lên thêm chuyến
        </Button>
      ));
    if (can.paymentsWrite)
      menuBtn("deposit", (
        <Button variant="ghost" className="w-full justify-start" onClick={onDeposit} title="Ghi tiền cọc / tiền về ở cấp hợp đồng.">
          <Wallet className="mr-2 h-4 w-4" aria-hidden />
          Ghi tiền cọc
        </Button>
      ));
    if (can.update && eff && !closure.closed)
      menuBtn("close", (
        <Button variant="ghost" className="w-full justify-start" onClick={onCloseManually} title="Đóng hợp đồng bằng tay kèm lý do (VD khách xác nhận giảm lượng).">
          <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
          Đóng tay
        </Button>
      ));
    if (can.update && canCancel)
      menuBtn("cancel", (
        <Button variant="ghost" className="w-full justify-start" onClick={onCancelContract} title="Hủy hợp đồng kèm lý do — các chuyến chưa đóng cont hủy theo. Dữ liệu giữ nguyên.">
          <Ban className="mr-2 h-4 w-4" aria-hidden />
          Hủy hợp đồng
        </Button>
      ));
    if (can.delete && canDelete)
      menuBtn("delete", (
        <Button variant="danger" className="w-full justify-start" onClick={onDeleteContract} title="Xóa hợp đồng nháp chưa duyệt, chưa có chuyến (có Hoàn tác).">
          <Trash2 className="mr-2 h-4 w-4" aria-hidden />
          Xóa hợp đồng
        </Button>
      ));
  }

  const openShipments = shipments.filter((s) => s.status === "open");
  const termsFirst = !eff || !openShipments.length;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="outline" onClick={onBack} title="Quay lại danh sách.">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Quay lại
        </Button>
        <div className="grid min-w-0 flex-1 basis-64 gap-1">
          <h2 className="font-semibold">
            HĐ {contract.contractNo} · {customerName}
          </h2>
          <div className="flex min-w-0 flex-wrap gap-1 [&>*]:max-w-full [&>*]:whitespace-normal">
            <Tag variant={STATE_TAG[state]}>{CONTRACT_STATE_LABELS[state]}</Tag>
            {pending && eff && <Tag variant="warning">Bản sửa {pending.revisionNo} chờ duyệt</Tag>}
            {isOpen && !coverage.covered && (
              <Tag variant="warning">
                Còn {coverage.missingKg > 0 ? `${formatNumber(coverage.missingKg)} kg` : ""}
                {coverage.missingKg > 0 && coverage.missingContainers > 0 ? " / " : ""}
                {coverage.missingContainers > 0 ? `${coverage.missingContainers} cont` : ""} chưa lên chuyến
              </Tag>
            )}
            {isOpen && closure.reason === "out-of-tolerance" && (
              <Tag variant="error">
                Lệch dung sai: kg {closure.kgDeviationPct >= 0 ? "+" : ""}
                {formatNumber(Math.round(closure.kgDeviationPct * 10) / 10)}%
                {can.viewPrice ? ` · tiền ${closure.amountDeviationPct >= 0 ? "+" : ""}${formatNumber(Math.round(closure.amountDeviationPct * 10) / 10)}%` : ""}
              </Tag>
            )}
            {contract.status === "cancelled" && contract.cancelReason && <Tag variant="muted">Lý do hủy: {contract.cancelReason}</Tag>}
            {contract.status === "closed" && contract.closeReason && <Tag variant="muted">Đóng tay: {contract.closeReason}</Tag>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {primary === "approve" && (
            <Button onClick={onApprove} title="Việc tiếp: ghi kết quả BGĐ ký giấy cho bản đang chờ duyệt (đồng ý / yêu cầu sửa / từ chối).">
              <FileSignature className="mr-2 h-4 w-4" aria-hidden />
              Ghi kết quả duyệt
            </Button>
          )}
          {primary === "ship" && (
            <Button onClick={onAddShipment} title="Việc tiếp: lên một chuyến (một container) cho hợp đồng này.">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Lên chuyến
            </Button>
          )}
          {menuItems.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" title="Các thao tác khác của hợp đồng: bản sửa, gia hạn, tiền cọc, đóng tay, hủy…">
                  <MoreHorizontal className="mr-2 h-4 w-4" aria-hidden />
                  Thao tác khác
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="grid w-64 gap-1 p-2">
                {menuItems.map((m) => (
                  <div key={m.key}>{m.node}</div>
                ))}
              </PopoverContent>
            </Popover>
          )}
          {contract.status === "closed" && can.update && (
            <Button variant="outline" onClick={onReopen} title="Bỏ đóng tay — hợp đồng tính khép kín lại theo số.">
              Bỏ đóng tay
            </Button>
          )}
        </div>
      </div>

      {terms && totals && (
        <dl className="grid gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <Info label="Hạn giao" value={`${formatDateVN(deadline)}${extensions.length ? " (đã gia hạn)" : ""}`} />
          <Info label="Tổng hợp đồng" value={`${formatNumber(totals.kg)} kg${can.viewPrice ? ` · ${formatNumber(totals.amount)} ${currency}` : ""}`} />
          <Info label="Dung sai" value={`±${formatNumber(terms.tolerancePct ?? 0)}% lượng và tiền`} />
          <Info label="Chuyến" value={`${openShipments.length}${terms.containerCount != null ? ` / ${terms.containerCount} cont` : ""}`} />
          <Info
            label="Thực xuất"
            value={closure.actuals.kg > 0 ? `${formatNumber(closure.actuals.kg)} kg${can.viewPrice ? ` · tiền về ${formatNumber(pay.received)}` : ""}` : "chưa có invoice"}
          />
        </dl>
      )}

      {openShipments.length === 0 && (
        <div className="grid justify-items-start gap-2 rounded-xl border border-dashed border-border px-4 py-5">
          <p className="font-semibold">Chưa lên chuyến nào</p>
          <p className="text-sm text-muted-foreground">
            Mỗi chuyến là một container: lệnh sản xuất, bao bì, đóng cont và bộ chứng từ ghi theo từng chuyến.
            {needsApproval ? " Lên chuyến kế hoạch được ngay, lệnh sản xuất chỉ xong sau khi BGĐ duyệt." : ""}
          </p>
        </div>
      )}
      {shipments.length > 1 && (
        <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
          <h3 className="font-semibold">Chuyến của hợp đồng — chọn để xem các bước</h3>
          {shipments.map((s) => (
            <ShipmentRow key={s.id} data={data} shipment={s} selected={s.id === selectedShipmentId} onSelect={() => onSelectShipment(s.id)} filesAvailable={filesAvailable} />
          ))}
        </section>
      )}

      {children}

      {terms && totals && (
        <CollapsibleSection
          title={`Điều khoản ${eff ? `· bản ${eff.revisionNo} đang hiệu lực` : "· chờ duyệt"}`}
          summary={[terms.incoterm, terms.portOfDischarge, PAYMENT_METHODS.find((p) => p.value === terms.paymentMethod)?.label].filter(Boolean).join(" · ")}
          defaultOpen={termsFirst}
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Ngày ký" value={formatDateVN(contract.signedOn)} />
            <Info label="Order" value={contract.orderRef} />
            <Info label="Incoterm · cảng" value={[terms.incoterm, terms.portOfLoading && `${terms.portOfLoading} → ${terms.portOfDischarge}`].filter(Boolean).join(" · ") || terms.portOfDischarge} />
            <Info
              label="Thanh toán"
              value={[
                PAYMENT_METHODS.find((p) => p.value === terms.paymentMethod)?.label,
                terms.depositPct != null && `cọc ${formatNumber(terms.depositPct)}%`,
                terms.paymentMethod === "lc" && terms.lcNo && `L/C ${terms.lcNo}`,
                terms.lcExpiry && `hết hạn ${formatDateVN(terms.lcExpiry)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
            <Info label="Hạn giao" value={`${formatDateVN(deadline)}${extensions.length ? ` (gia hạn từ ${formatDateVN(terms.latestShipmentDate)})` : ""}`} />
            <Info label="Container" value={[terms.containerCount != null && `${terms.containerCount} cont`, terms.containerType].filter(Boolean).join(" ")} />
            <Info
              label="Tổng"
              value={`${formatNumber(totals.units)} thùng/kiện · ${formatNumber(totals.cartons)} thùng · ${formatNumber(totals.kg)} kg${can.viewPrice ? ` · ${formatNumber(totals.amount)} ${currency}` : ""}`}
            />
            <Info label="Ghi chú" value={contract.note} />
          </dl>
          {terms.requiredDocuments.length > 0 && (
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
              <p className="text-sm text-muted-foreground">Chứng từ khách yêu cầu</p>
              <div className="flex flex-wrap gap-1">
                {terms.requiredDocuments.map((d, i) => (
                  <Tag key={i} variant="category" tone="blue" className="max-w-full whitespace-normal">
                    {requiredDocumentLabel(d)}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {working && (
        <CollapsibleSection
          title={`Dòng hàng (${working.lines.length})`}
          summary={totals ? `${formatNumber(totals.cartons)} thùng · ${formatNumber(totals.kg)} kg${can.viewPrice ? ` · ${formatNumber(totals.amount)} ${currency}` : ""}` : undefined}
          defaultOpen={termsFirst}
        >
          <RecordTable columns={lineColumns} rows={working.lines} getKey={(l) => l.id} rowMarkKey={`export-contract-lines:${contract.id}`} emptyText="Hợp đồng chưa có dòng hàng." />
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Các bản hợp đồng và kết quả duyệt"
        summary={`${revisions.length} bản${extensions.length ? ` · ${extensions.length} lần gia hạn` : ""}`}
        defaultOpen={needsApproval}
      >
        {[...revisions].reverse().map((r) => {
          const st = approvalState(data, r.id);
          return (
            <div key={r.id} className="grid gap-2 border-b border-border pb-3 text-sm last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Bản {r.revisionNo}</span>
                <span className="text-muted-foreground">{formatDateVN(r.revisedOn)}</span>
                <Tag variant={st === "approved" ? "done" : st === "rejected" ? "error" : "pending"}>{APPROVAL_LABELS[st]}</Tag>
                {eff?.id === r.id && <Tag variant="source">Đang hiệu lực</Tag>}
              </div>
              {r.changeSummary && <p>{r.changeSummary}</p>}
              <p className="tnum text-muted-foreground">
                {formatNumber(contractTotals(r.lines).kg)} kg{can.viewPrice ? ` · ${formatNumber(contractTotals(r.lines).amount)} ${r.terms.currency}` : ""} · hạn giao{" "}
                {formatDateVN(r.terms.latestShipmentDate)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {r.filePath && (
                  <Button size="sm" variant="outline" onClick={() => onPreview({ path: r.filePath, name: r.fileName, caption: `HĐ ${contract.contractNo} · bản ${r.revisionNo}` })} title="Xem file hợp đồng của bản này.">
                    File hợp đồng
                  </Button>
                )}
                {approvalsOf(data, r.id).map((a) => (
                  <span key={a.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {APPROVAL_LABELS[a.decision]} · {a.approverName} · {formatDateVN(a.decidedOn)}
                      {a.reason ? ` · ${a.reason}` : ""}
                    </span>
                    {a.filePath && (
                      <Button size="sm" variant="ghost" onClick={() => onPreview({ path: a.filePath, name: a.fileName, caption: `Bản ký · HĐ ${contract.contractNo} · bản ${r.revisionNo}` })} title="Xem bản ký (scan).">
                        Bản ký
                      </Button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {extensions.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
            <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              Gia hạn tới {formatDateVN(e.newDeadline)} · khách xác nhận {formatDateVN(e.confirmedOn)}
              {e.note ? ` · ${e.note}` : ""}
            </span>
            {e.filePath && (
              <Button size="sm" variant="ghost" onClick={() => onPreview({ path: e.filePath, name: e.fileName, caption: `Gia hạn · HĐ ${contract.contractNo}` })} title="Xem xác nhận của khách.">
                Xác nhận
              </Button>
            )}
          </div>
        ))}
      </CollapsibleSection>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tnum break-words font-medium">{value || "—"}</dd>
    </div>
  );
}

function ShipmentRow({
  data,
  shipment,
  selected,
  onSelect,
  filesAvailable,
}: {
  data: ExportData;
  shipment: ExportShipment;
  selected: boolean;
  onSelect: () => void;
  filesAvailable: boolean;
}) {
  const p = shipmentProgress(data, shipment, { filesAvailable });
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid min-w-0 gap-2 rounded-lg border p-3 text-left sm:grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)] sm:items-center ${selected ? "border-primary bg-accent" : "border-border hover:bg-muted"}`}
      title="Mở các bước của chuyến này."
    >
      <span className="grid min-w-0 gap-0.5">
        <span className="font-semibold">
          {[shipment.lotCode && `Lô ${shipment.lotCode}`, shipmentKindLabel(shipment.kind), shipment.containerNo].filter(Boolean).join(" · ")}
        </span>
        <span className="tnum text-sm text-muted-foreground">
          {shipment.status === "cancelled"
            ? `Đã hủy · ${shipment.cancelReason}`
            : [shipment.loadingDate && `Đóng ${formatDateVN(shipment.loadingDate)}`, shipment.etd && `ETD ${formatDateVN(shipment.etd)}`, shipment.bookingNo || "chờ booking"]
                .filter(Boolean)
                .join(" · ")}
        </span>
      </span>
      {shipment.status === "open" && (
        <span className="grid min-w-0 gap-1">
          <StepBar steps={p.steps} />
          <span className={`text-sm ${p.next === null ? "font-semibold text-success" : ""}`}>{progressText(p)}</span>
        </span>
      )}
    </button>
  );
}
