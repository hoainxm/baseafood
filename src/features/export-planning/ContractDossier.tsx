// ============================================================
// Tên file: src/features/export-planning/ContractDossier.tsx
// Tên tiếng Việt: Hồ sơ một hợp đồng — điều khoản, dòng hàng, các bản + duyệt, gia hạn, chuyến
// Description: Contract dossier page: header + state, terms, lines, revision / approval history,
//              deadline extensions, tolerance closure, shipments (1 shipment ⇒ shown inline).
// ============================================================
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  openShipmentsOf,
  pendingRevision,
  requiredDocumentLabel,
  revisionsOf,
  shipmentKindLabel,
  stepState,
  STEP_NOS,
  workingRevision,
  type ExportData,
  type StepNo,
} from "@/lib/exportPlanning";
import { formatDateVN } from "@/lib/format";
import type { ExportContract, ExportContractLine, ExportItemState, ExportShipment } from "@/types";
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  FilePen,
  FileSignature,
  Pencil,
  Plus,
  Ship,
  Trash2,
  Wallet,
} from "lucide-react";
import { StepDots, type PreviewTarget } from "./parts";

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

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="outline" onClick={onBack} title="Quay lại danh sách.">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Quay lại
        </Button>
        <div className="grid min-w-0 flex-1 gap-1">
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
      </div>

      {isOpen && (can.create || can.update || can.delete || can.paymentsWrite) && (
        <div className="flex flex-wrap gap-2">
          {can.update && needsApproval && (
            <Button onClick={onApprove} title="Ghi kết quả BGĐ ký giấy cho bản đang chờ duyệt (đồng ý / yêu cầu sửa / từ chối).">
              <FileSignature className="mr-2 h-4 w-4" aria-hidden />
              Ghi kết quả duyệt
            </Button>
          )}
          {can.update && (pending || !eff) && (
            <Button variant="edit" onClick={onEditPending} title="Sửa bản đang chờ duyệt (chưa có hiệu lực nên sửa thẳng).">
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              Sửa bản chờ duyệt
            </Button>
          )}
          {can.update && eff && !pending && (
            <Button variant="outline" onClick={onRevise} title="Ghi bản sửa (rvs / phụ kiện / tu chỉnh L/C) — bản đang hiệu lực giữ nguyên tới khi bản sửa được duyệt.">
              <FilePen className="mr-2 h-4 w-4" aria-hidden />
              Ghi bản sửa
            </Button>
          )}
          {can.update && (
            <Button variant="outline" onClick={onExtend} title="Ghi hạn giao mới khách đã xác nhận — không cần BGĐ duyệt lại.">
              <CalendarClock className="mr-2 h-4 w-4" aria-hidden />
              Gia hạn
            </Button>
          )}
          {can.create && (
            <Button variant="outline" onClick={onAddShipment} title="Lên một chuyến (một container) cho hợp đồng này.">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Lên chuyến
            </Button>
          )}
          {can.paymentsWrite && (
            <Button variant="outline" onClick={onDeposit} title="Ghi tiền cọc / tiền về ở cấp hợp đồng.">
              <Wallet className="mr-2 h-4 w-4" aria-hidden />
              Ghi tiền cọc
            </Button>
          )}
          {can.update && eff && !closure.closed && (
            <Button variant="outline" onClick={onCloseManually} title="Đóng hợp đồng bằng tay kèm lý do (VD khách xác nhận giảm lượng).">
              <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
              Đóng tay
            </Button>
          )}
          {can.update && canCancel && (
            <Button variant="outline" onClick={onCancelContract} title="Hủy hợp đồng kèm lý do — các chuyến chưa đóng cont hủy theo. Dữ liệu giữ nguyên.">
              <Ban className="mr-2 h-4 w-4" aria-hidden />
              Hủy hợp đồng
            </Button>
          )}
          {can.delete && canDelete && (
            <Button variant="danger" onClick={onDeleteContract} title="Xóa hợp đồng nháp chưa duyệt, chưa có chuyến (có Hoàn tác).">
              <Trash2 className="mr-2 h-4 w-4" aria-hidden />
              Xóa hợp đồng
            </Button>
          )}
        </div>
      )}
      {contract.status === "closed" && can.update && (
        <div>
          <Button variant="outline" onClick={onReopen} title="Bỏ đóng tay — hợp đồng tính khép kín lại theo số.">
            Bỏ đóng tay
          </Button>
        </div>
      )}

      {terms && totals && (
        <Card>
          <CardHeader>
            <CardTitle>Điều khoản {eff ? `(bản ${eff.revisionNo} đang hiệu lực)` : "(chờ duyệt)"}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-4">
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
              <Info
                label="Hạn giao"
                value={`${formatDateVN(deadline)}${extensions.length ? ` (gia hạn từ ${formatDateVN(terms.latestShipmentDate)})` : ""}`}
              />
              <Info label="Dung sai" value={`±${formatNumber(terms.tolerancePct ?? 0)}% (lượng và tiền)`} />
              <Info label="Container" value={[terms.containerCount != null && `${terms.containerCount} cont`, terms.containerType].filter(Boolean).join(" ")} />
              <Info
                label="Tổng"
                value={`${formatNumber(totals.units)} thùng/kiện · ${formatNumber(totals.cartons)} thùng · ${formatNumber(totals.kg)} kg${can.viewPrice ? ` · ${formatNumber(totals.amount)} ${currency}` : ""}`}
              />
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
            {(closure.actuals.kg > 0 || pay.received > 0) && (
              <p className="tnum text-sm">
                Thực xuất: {formatNumber(closure.actuals.kg)} / {formatNumber(closure.target.kg || totals.kg)} kg
                {can.viewPrice ? ` · ${formatNumber(closure.actuals.amount)} / ${formatNumber(closure.target.amount || totals.amount)} ${currency} · tiền về ${formatNumber(pay.received)}` : ""}
              </p>
            )}
            {contract.note && <p className="text-sm text-muted-foreground">{contract.note}</p>}
          </CardContent>
        </Card>
      )}

      {working && (
        <RecordTable
          columns={lineColumns}
          rows={working.lines}
          getKey={(l) => l.id}
          rowMarkKey={`export-contract-lines:${contract.id}`}
          emptyText="Hợp đồng chưa có dòng hàng."
        />
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-3">
          <Ship className="h-5 w-5 text-muted-foreground" aria-hidden />
          <CardTitle className="min-w-0 flex-1">Chuyến ({openShipmentsOf(data, contract.id).length})</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {!shipments.length && <p className="text-sm text-muted-foreground">Chưa lên chuyến nào.{can.create && isOpen ? " Bấm Lên chuyến để thêm." : ""}</p>}
          {shipments.length > 1 &&
            shipments.map((s) => (
              <ShipmentRow key={s.id} data={data} shipment={s} selected={s.id === selectedShipmentId} onSelect={() => onSelectShipment(s.id)} filesAvailable={filesAvailable} />
            ))}
        </CardContent>
      </Card>

      {children}

      <Card>
        <CardHeader>
          <CardTitle>Các bản hợp đồng và kết quả duyệt</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {[...revisions].reverse().map((r) => {
            const st = approvalState(data, r.id);
            return (
              <div key={r.id} className="grid gap-2 rounded-lg border border-border p-3 text-sm">
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
                <div className="flex flex-wrap gap-2">
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
            <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
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
        </CardContent>
      </Card>
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
  const steps = Object.fromEntries(STEP_NOS.map((n) => [n, stepState(data, shipment, n, { filesAvailable })])) as Record<StepNo, ExportItemState>;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 text-left ${selected ? "border-primary bg-accent" : "border-border hover:bg-muted"}`}
      title="Mở các bước của chuyến này."
    >
      <span className="grid min-w-0 flex-1 gap-0.5">
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
      {shipment.status === "open" && <StepDots steps={steps} />}
    </button>
  );
}
