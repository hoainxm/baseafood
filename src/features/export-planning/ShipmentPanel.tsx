// ============================================================
// Tên file: src/features/export-planning/ShipmentPanel.tsx
// Tên tiếng Việt: Một chuyến — 6 bước: hợp đồng · lệnh SX · bao bì · đóng cont · chứng từ · khác
// Description: Step cards of one shipment with sub-steps 4a–4d, document checklist, actuals and
//              step-6 entries; buttons gated by export-plans / .loading / .payments permissions.
// ============================================================
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  InlineConfirmDelete,
  Tag,
  formatNumber,
} from "@/design-system";
import { newId } from "@/lib/store";
import {
  ITEM_STATE_LABELS,
  LOADING_STEPS,
  STEP_TITLES,
  blankItem,
  containerIdentityOk,
  contractStepState,
  documentItems,
  filesOfItem,
  filesOfStep,
  isShipmentClosed,
  isShipmentLate,
  itemState,
  requiredDocumentLabel,
  shipmentActuals,
  shipmentDeliveryDate,
  shipmentKindLabel,
  shipmentPaymentSummary,
  stepItem,
  stepState,
  subStepState,
  SUB_STEP_LABELS,
  type ExportData,
  type StepNo,
} from "@/lib/exportPlanning";
import { formatDateVN } from "@/lib/format";
import type { ExportContract, ExportFile, ExportPayment, ExportShipment, ExportStep, ExportStepItem } from "@/types";
import { Ban, Camera, ClipboardList, FilePlus2, Pencil, Plus, Send, Trash2, Wallet } from "lucide-react";
import { FileChips, StateTag, StepDot, type PreviewTarget } from "./parts";
import type { LoadingUploadTarget, StepItemTarget } from "./ShipmentDialogs";
import type { PaymentTarget } from "./RecordDialogs";

export interface ShipmentPanelCan {
  update: boolean;
  delete: boolean;
  viewPrice: boolean;
  loadingCreate: boolean;
  paymentsView: boolean;
  paymentsWrite: boolean;
  paymentsDelete: boolean;
}

export function ShipmentPanel({
  data,
  shipment,
  contract,
  currency,
  can,
  filesAvailable,
  canDeleteShipment,
  onEdit,
  onCancel,
  onDelete,
  onOpenItem,
  onUploadLoading,
  onPayment,
  onDeletePayment,
  onPreview,
  onRemoveFile,
}: {
  data: ExportData;
  shipment: ExportShipment;
  contract: ExportContract;
  currency: string;
  can: ShipmentPanelCan;
  filesAvailable: boolean;
  canDeleteShipment: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onOpenItem: (t: StepItemTarget) => void;
  onUploadLoading: (t: LoadingUploadTarget) => void;
  onPayment: (t: PaymentTarget) => void;
  onDeletePayment: (p: ExportPayment) => void;
  onPreview: (f: PreviewTarget) => void;
  onRemoveFile: (f: ExportFile) => void;
}) {
  const opts = { filesAvailable };
  const label = [shipment.lotCode && `Lô ${shipment.lotCode}`, shipmentKindLabel(shipment.kind), shipment.containerNo].filter(Boolean).join(" · ");
  const closed = isShipmentClosed(data, shipment, opts);
  const late = isShipmentLate(data, shipment);
  const actuals = shipmentActuals(data, shipment.id);
  const pay = shipmentPaymentSummary(data, shipment);
  const isCancelled = shipment.status === "cancelled";

  const openStep = (step: ExportStep) => {
    const existing = stepItem(data, shipment.id, step);
    onOpenItem({ shipment, contractId: contract.id, item: existing ?? blankItem(shipment.id, step, newId()), isNew: !existing });
  };

  const stepHead = (n: StepNo) => (
    <CardHeader className="flex flex-row items-center gap-3">
      <StepDot step={n} state={n === 1 ? contractStepState(data, contract.id, opts) : stepState(data, shipment, n, opts)} />
      <CardTitle className="min-w-0 flex-1">
        {n}. {STEP_TITLES[n - 1]}
      </CardTitle>
    </CardHeader>
  );

  /** Mục con dạng một dòng: nhãn · trạng thái · file · nút cập nhật. */
  const subRow = (step: ExportStep, extra?: React.ReactNode) => {
    const it = stepItem(data, shipment.id, step);
    const st = subStepState(data, shipment.id, step);
    const isUpload = step === "loading-plan" || step === "loading-photos";
    const files = isUpload ? filesOfStep(data, shipment.id, step) : it ? filesOfItem(data, it.id) : [];
    return (
      <div key={step} className="grid gap-2 rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 font-semibold">{SUB_STEP_LABELS[step]}</span>
          <StateTag state={st} />
          {it?.sharedFromId && <Tag variant="source">Dùng chung</Tag>}
        </div>
        {it?.number && (
          <p className="text-sm">
            Số {it.number}
            {it.issuedOn ? ` · ${formatDateVN(it.issuedOn)}` : ""}
          </p>
        )}
        {it?.note && <p className="text-sm text-muted-foreground">{it.note}</p>}
        {st === "not-applicable" && it?.naReason && <p className="text-sm text-muted-foreground">Không áp dụng: {it.naReason}</p>}
        <FileChips files={files} onPreview={onPreview} caption={`${label} · ${SUB_STEP_LABELS[step]}`} />
        {extra}
        {!isCancelled && (
          <div className="flex flex-wrap gap-2">
            {isUpload && filesAvailable && (can.loadingCreate || can.update) && (
              <Button
                size="sm"
                onClick={() => onUploadLoading({ shipment, contractId: contract.id, step, label })}
                title={step === "loading-photos" ? "Chụp / chọn ảnh từng lớp hàng, seal, số cont." : "Đính file sơ đồ xếp hàng trong container."}
              >
                {step === "loading-photos" ? <Camera className="mr-1 h-4 w-4" aria-hidden /> : <FilePlus2 className="mr-1 h-4 w-4" aria-hidden />}
                {step === "loading-photos" ? "Đính ảnh" : "Đính sơ đồ"}
              </Button>
            )}
            {can.update && (!isUpload || !files.length) && (
              <Button size="sm" variant="outline" onClick={() => openStep(step)} title={isUpload ? "Đánh dấu không áp dụng (VD đóng ghép không có sơ đồ riêng)." : "Cập nhật trạng thái, số, file của mục này."}>
                <ClipboardList className="mr-1 h-4 w-4" aria-hidden />
                {isUpload ? "Không áp dụng…" : "Cập nhật"}
              </Button>
            )}
            {isUpload && can.update && files.length > 0 && (
              <span className="flex flex-wrap gap-1">
                {files.map((f) => (
                  <Button key={f.id} size="sm" variant="ghost" onClick={() => onRemoveFile(f)} title={`Gỡ file "${f.fileName}" (có Hoàn tác).`}>
                    Gỡ {f.layerNo != null ? `lớp ${f.layerNo}` : f.fileName}
                  </Button>
                ))}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const docs = documentItems(data, shipment.id);
  const payments = data.payments.filter((p) => p.shipmentId === shipment.id).sort((a, b) => a.date.localeCompare(b.date));
  const deliveredOn = shipmentDeliveryDate(data, shipment);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div className="grid min-w-0 gap-1">
          <p className="font-semibold">{label || "Chuyến chưa có mã lô"}</p>
          <p className="tnum text-sm text-muted-foreground">
            {[
              shipment.bookingNo ? `Booking ${shipment.bookingNo}` : "Chờ booking",
              shipment.loadingDate && `Đóng ${formatDateVN(shipment.loadingDate)}`,
              shipment.etd && `ETD ${formatDateVN(shipment.etd)}`,
              shipment.eta && `ETA ${formatDateVN(shipment.eta)}`,
              shipment.vesselVoyage,
              shipment.sealNo && `Seal ${shipment.sealNo}`,
              shipment.plannedKg != null && `KH ${formatNumber(shipment.plannedKg)} kg`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="flex flex-wrap gap-1">
            {isCancelled ? (
              <Tag variant="muted">Đã hủy: {shipment.cancelReason}</Tag>
            ) : closed ? (
              <Tag variant="done">Chuyến đã khép kín</Tag>
            ) : (
              <Tag variant="pending">Đang làm</Tag>
            )}
            {late && !isCancelled && <Tag variant="error">Trễ hạn giao{deliveredOn ? ` (${formatDateVN(deliveredOn)})` : ""}</Tag>}
          </div>
        </div>
        {!isCancelled && (can.update || can.delete) && (
          <div className="flex flex-wrap gap-2">
            {can.update && (
              <Button size="sm" variant="edit" onClick={onEdit} title="Sửa thông tin chuyến: booking, ngày đóng, ETD, số cont, seal…">
                <Pencil className="mr-1 h-4 w-4" aria-hidden />
                Sửa chuyến
              </Button>
            )}
            {can.update && (
              <Button size="sm" variant="outline" onClick={onCancel} title="Hủy chuyến này (giữ dữ liệu, ghi lý do).">
                <Ban className="mr-1 h-4 w-4" aria-hidden />
                Hủy chuyến
              </Button>
            )}
            {can.delete && canDeleteShipment && (
              <Button size="sm" variant="danger" onClick={onDelete} title="Xóa chuyến chưa có file, chưa bước nào xong (có Hoàn tác).">
                <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                Xóa chuyến
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card>
          {stepHead(1)}
          <CardContent className="text-sm">
            {contractStepState(data, contract.id, opts) === "done"
              ? `Hợp đồng đã có bản BGĐ đồng ý${filesAvailable ? " kèm file ký" : ""}.`
              : "Chờ ghi kết quả BGĐ duyệt (và file ký) ở phần hợp đồng phía trên."}
          </CardContent>
        </Card>
        <Card>
          {stepHead(2)}
          <CardContent>{subRow("production-order")}</CardContent>
        </Card>
        <Card>
          {stepHead(3)}
          <CardContent>{subRow("packaging")}</CardContent>
        </Card>
        <Card>
          {stepHead(4)}
          <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {!containerIdentityOk(shipment) && (
              <p className="rounded-lg bg-warning-surface px-3 py-2 text-sm">
                {shipment.kind === "truck" ? "Chưa có biển số xe" : "Chưa có số container + seal"} — điền ở Sửa chuyến (nhìn ảnh seal / cửa cont).
              </p>
            )}
            {LOADING_STEPS.map((s) => subRow(s))}
          </CardContent>
        </Card>
      </div>

      <Card>
        {stepHead(5)}
        <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {actuals.kg > 0 && (
            <p className="tnum text-sm">
              Thực xuất (theo Commercial Invoice): {formatNumber(actuals.cartons)} thùng · {formatNumber(actuals.kg)} kg
              {can.viewPrice ? ` · ${formatNumber(actuals.amount)} ${currency}` : ""}
            </p>
          )}
          {!docs.length && <p className="text-sm text-muted-foreground">Chưa có mục chứng từ.</p>}
          <div className="grid gap-2">
            {docs.map((d) => {
              const st = itemState(data, d);
              return (
                <DocRow
                  key={d.id}
                  item={d}
                  state={st}
                  files={filesOfItem(data, d.id)}
                  onPreview={onPreview}
                  canUpdate={can.update && !isCancelled}
                  showAmount={can.viewPrice}
                  onOpen={() => onOpenItem({ shipment, contractId: contract.id, item: d, isNew: false })}
                />
              );
            })}
          </div>
          {can.update && !isCancelled && (
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onOpenItem({ shipment, contractId: contract.id, item: { ...blankItem(shipment.id, "document", newId()), docKind: "other" }, isNew: true })
                }
                title="Thêm một chứng từ ngoài danh sách hợp đồng yêu cầu (VD hóa đơn hàng mẫu, kết quả vi sinh)."
              >
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                Thêm chứng từ
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {can.paymentsView && (
        <Card>
          {stepHead(6)}
          <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-3">
            <p className="tnum text-sm">
              {pay.documentsSentOn ? `Đã gửi bộ chứng từ ${formatDateVN(pay.documentsSentOn)}` : "Chưa ghi gửi bộ chứng từ"}
              {can.viewPrice ? ` · Tiền về ${formatNumber(pay.received)} / ${formatNumber(pay.expected)} ${currency}` : ""}
            </p>
            {payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm">
                <span className="min-w-0 flex-1">
                  {p.kind === "documents-sent" ? "Gửi bộ chứng từ" : "Tiền về"} · {formatDateVN(p.date)}
                  {p.kind === "payment" && can.viewPrice ? ` · ${formatNumber(p.amount)} ${p.currency}` : ""}
                  {p.method ? ` · ${p.method}` : ""}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                {p.filePath && (
                  <Button size="sm" variant="ghost" onClick={() => onPreview({ path: p.filePath, name: p.fileName, caption: label })} title="Xem file đính kèm.">
                    Xem file
                  </Button>
                )}
                {can.paymentsWrite && (
                  <Button
                    size="sm"
                    variant="edit"
                    onClick={() => onPayment({ contractId: contract.id, shipmentId: shipment.id, label, kind: p.kind, currency, existing: p })}
                    title="Sửa dòng này."
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Sửa</span>
                  </Button>
                )}
                {can.paymentsDelete && (
                  <InlineConfirmDelete
                    onConfirm={() => onDeletePayment(p)}
                    recordDescription={`${p.kind === "documents-sent" ? "Gửi bộ chứng từ" : "Tiền về"} ${formatDateVN(p.date)}${p.kind === "payment" && can.viewPrice ? ` — ${formatNumber(p.amount)} ${p.currency}` : ""}`}
                  />
                )}
              </div>
            ))}
            {can.paymentsWrite && !isCancelled && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onPayment({ contractId: contract.id, shipmentId: shipment.id, label, kind: "documents-sent", currency })} title="Ghi ngày gửi bộ chứng từ cho khách.">
                  <Send className="mr-1 h-4 w-4" aria-hidden />
                  Ghi gửi chứng từ
                </Button>
                <Button size="sm" variant="outline" onClick={() => onPayment({ contractId: contract.id, shipmentId: shipment.id, label, kind: "payment", currency })} title="Ghi một lần tiền về của chuyến này.">
                  <Wallet className="mr-1 h-4 w-4" aria-hidden />
                  Ghi tiền về
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DocRow({
  item,
  state,
  files,
  onPreview,
  canUpdate,
  showAmount,
  onOpen,
}: {
  item: ExportStepItem;
  state: ReturnType<typeof itemState>;
  files: ExportFile[];
  onPreview: (f: PreviewTarget) => void;
  canUpdate: boolean;
  showAmount: boolean;
  onOpen: () => void;
}) {
  const title = requiredDocumentLabel({ kind: item.docKind, form: item.docForm, issuer: item.docIssuer });
  return (
    <div className="grid gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 font-semibold">{title}</span>
        <StateTag state={state} />
        {item.sharedFromId && <Tag variant="source">Dùng chung</Tag>}
      </div>
      {(item.number || item.issuedOn) && (
        <p className="tnum text-sm">
          {item.number && `Số ${item.number}`}
          {item.issuedOn && ` · ${formatDateVN(item.issuedOn)}`}
          {item.docKind === "commercial-invoice" && item.netKg != null && ` · ${formatNumber(item.cartons)} thùng · ${formatNumber(item.netKg)} kg`}
          {item.docKind === "commercial-invoice" && showAmount && item.amount != null && ` · ${formatNumber(item.amount)}`}
          {item.docKind === "bill-of-lading" && item.onBoardDate && ` · on board ${formatDateVN(item.onBoardDate)}`}
        </p>
      )}
      {state === "not-applicable" && item.naReason && <p className="text-sm text-muted-foreground">Không áp dụng: {item.naReason}</p>}
      <FileChips files={files} onPreview={onPreview} caption={title} />
      {canUpdate && (
        <div>
          <Button size="sm" variant="outline" onClick={onOpen} title={`Cập nhật ${title}: số, ngày, file, trạng thái (${ITEM_STATE_LABELS[state]}).`}>
            <ClipboardList className="mr-1 h-4 w-4" aria-hidden />
            Cập nhật
          </Button>
        </div>
      )}
    </div>
  );
}
