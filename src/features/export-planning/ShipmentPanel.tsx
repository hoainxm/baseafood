// ============================================================
// Tên file: src/features/export-planning/ShipmentPanel.tsx
// Tên tiếng Việt: Một chuyến — thẻ thông tin, stepper 6 bước, checklist từng bước
// Description: Shipment view (design-spec 42): fact card + actions, labelled 6-step stepper,
//              one block per step with flat checklist rows (state · name · number/date · files ·
//              action) instead of nested cards. Buttons gated by export-plans / .loading / .payments.
// ============================================================
import type { ReactNode } from "react";
import { Button, InlineConfirmDelete, Tag, formatNumber, AbbrHint } from "@/design-system";
import { newId } from "@/lib/store";
import {
  ITEM_STATE_LABELS,
  LOADING_STEPS,
  STEP_TITLES,
  SUB_STEP_LABELS,
  blankItem,
  containerIdentityOk,
  documentItems,
  filesOfItem,
  filesOfStep,
  shipmentLateInfo,
  itemState,
  requiredDocumentLabel,
  shipmentActuals,
  shipmentKindLabel,
  shipmentPaymentSummary,
  sharedSource,
  stepItem,
  subStepState,
  type ExportData,
  type StepNo,
} from "@/lib/exportPlanning";
import { formatDateVN, formatMoney } from "@/lib/format";
import type { ExportContract, ExportFile, ExportItemState, ExportPayment, ExportShipment, ExportStep, ExportStepItem } from "@/types";
import { Ban, Camera, ClipboardList, FilePlus2, Pencil, Plus, RotateCcw, Send, Trash2, Wallet } from "lucide-react";
import { FileList, StateTag, StepDot, StepStepper, type PreviewTarget } from "./parts";
import { progressText, shipmentProgress, stepMissing } from "./progress";
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

const settled = (s: ExportItemState) => s === "done" || s === "not-applicable";

/** Một hàng của checklist: trạng thái + tên · chi tiết (số, ngày, file) · nút. */
function ChecklistRow({
  label,
  state,
  extraTag,
  children,
  actions,
  tourMark,
}: {
  label: string;
  state: ExportItemState;
  extraTag?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Hàng thuộc bước đang làm ⇒ thẻ trạng thái + nút là mốc "Trạng thái mục" / "Cập nhật mục" của hướng dẫn thao tác. */
  tourMark?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 border-t border-border py-3 first:border-t-0 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] sm:items-start sm:gap-4">
      {/* Thẻ trạng thái LUÔN nằm dưới tên — tên ngắn hay dài thì hàng nào cũng cùng khuôn. */}
      <div className="grid min-w-0 justify-items-start gap-1">
        {label && <span className="font-semibold break-words">{label}</span>}
        <span data-tour={tourMark ? "item-status" : undefined} className="flex flex-wrap gap-1">
          <StateTag state={state} />
          {extraTag}
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 text-sm">{children}</div>
      {actions && (
        <div data-tour={tourMark ? "step-update" : undefined} className="flex min-w-0 flex-wrap gap-2 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

/** Khối một bước: đầu (chấm · tên · tóm tắt) + thân là các hàng checklist. */
function StepBlock({ n, state, summary, isCurrent, children }: { n: StepNo; state: ExportItemState; summary: string; isCurrent: boolean; children: ReactNode }) {
  return (
    <section
      id={`ship-step-${n}`}
      data-tour={isCurrent ? "current-step" : n === 6 ? "payments" : undefined}
      className={`grid min-w-0 scroll-mt-24 grid-cols-[minmax(0,1fr)] rounded-xl border bg-card ${isCurrent ? "border-primary" : "border-border"}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-3">
        <StepDot step={n} state={state} alert={isCurrent && state !== "done"} />
        {/* Số bước đã nằm trong chấm (hoặc ✓) — tên không lặp "n." (khớp stepper). */}
        <h3 className="font-semibold">{STEP_TITLES[n - 1]}</h3>
        <span className={`min-w-0 basis-full text-sm break-words sm:flex-1 sm:basis-0 sm:text-right ${settled(state) ? "text-success" : isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{summary}</span>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] border-t border-border px-4">{children}</div>
    </section>
  );
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
  onRestore,
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
  /** Khôi phục chuyến đã hủy (HĐ còn mở) — XK-10. */
  onRestore: () => void;
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
  const progress = shipmentProgress(data, shipment, opts);
  const lateInfo = shipmentLateInfo(data, shipment);
  const actuals = shipmentActuals(data, shipment.id);
  const pay = shipmentPaymentSummary(data, shipment);
  const isCancelled = shipment.status === "cancelled";
  const canWrite = can.update && !isCancelled;

  const summaryOf = (n: StepNo): string => {
    const st = progress.steps[n];
    if (st === "done") return "Xong";
    if (st === "not-applicable") return "Không áp dụng";
    if (n === 6) return pay.documentsSentOn ? `Đã gửi chứng từ ${formatDateVN(pay.documentsSentOn)}` : "Chưa ghi — không tính vào đủ hồ sơ";
    const miss = stepMissing(data, shipment, n);
    // Bước một mục (Lệnh SX, Bao bì): "Còn thiếu: lệnh sản xuất" chỉ lặp tên bước ⇒ nói trạng thái mục.
    if (miss.length === 1 && miss[0] === STEP_TITLES[n - 1].toLowerCase()) return ITEM_STATE_LABELS[st];
    return miss.length ? `Còn thiếu: ${miss.join(", ")}` : ITEM_STATE_LABELS[st];
  };

  const openStep = (step: ExportStep) => {
    const existing = stepItem(data, shipment.id, step);
    onOpenItem({ shipment, contractId: contract.id, item: existing ?? blankItem(shipment.id, step, newId()), isNew: !existing });
  };
  const updateButton = (onClick: () => void, title: string) =>
    canWrite && (
      <Button size="sm" variant="outline" onClick={onClick} title={title}>
        <ClipboardList className="mr-1 h-4 w-4" aria-hidden />
        Cập nhật
      </Button>
    );
  /** Mục dùng chung: nói rõ dùng của chuyến nào, số chứng từ nào (XK-12). */
  const sharedText = (it: ExportStepItem | undefined) => {
    if (!it?.sharedFromId) return "";
    const src = sharedSource(data, it);
    if (!src) return "Chuyến được dùng chung đã hủy hoặc mục gốc chưa xong";
    const sh = data.shipments.find((x) => x.id === src.shipmentId);
    const who = sh ? [sh.lotCode && `lô ${sh.lotCode}`, shipmentKindLabel(sh.kind), sh.containerNo].filter(Boolean).join(" · ") : "chuyến khác";
    return `Dùng chung với ${who}${src.number ? ` · số ${src.number}` : ""}${src.issuedOn ? ` · ${formatDateVN(src.issuedOn)}` : ""}`;
  };
  const itemDetail = (it: ExportStepItem | undefined, files: readonly ExportFile[], caption: string) => (
    <>
      {it?.sharedFromId && <span>{sharedText(it)}</span>}
      {it?.number && (
        <span className="tnum">
          Số {it.number}
          {it.issuedOn ? ` · ${formatDateVN(it.issuedOn)}` : ""}
        </span>
      )}
      {it?.note && <span className="text-muted-foreground">{it.note}</span>}
      {it?.naReason && <span className="text-muted-foreground">Không áp dụng: {it.naReason}</span>}
      <FileList files={files} onPreview={onPreview} caption={caption} />
      {!it?.sharedFromId && !it?.number && !it?.note && !it?.naReason && !files.length && <span className="text-muted-foreground">Chưa có gì</span>}
    </>
  );

  /** Hàng của một mục đơn (bước 2, 3, 4c, 4d). */
  /** Bước n là bước đang làm ⇒ nút của hàng là mốc "Cập nhật một mục" (hướng dẫn từng bước). */
  const isTourStep = (n: StepNo) => progress.next === n;
  const singleRow = (step: ExportStep, n: StepNo) => {
    const it = stepItem(data, shipment.id, step);
    const files = it ? filesOfItem(data, it.id) : [];
    return (
      <ChecklistRow
        key={step}
        // Mục trùng tên bước (Lệnh SX, Bao bì) ⇒ không lặp tên — đầu khối đã ghi.
        label={SUB_STEP_LABELS[step] === STEP_TITLES[n - 1] ? "" : SUB_STEP_LABELS[step]}
        state={subStepState(data, shipment.id, step)}
        extraTag={it?.sharedFromId ? <Tag variant="source">Dùng chung</Tag> : undefined}
        tourMark={isTourStep(n)}
        actions={updateButton(() => openStep(step), `Cập nhật ${SUB_STEP_LABELS[step].toLowerCase()}: trạng thái, số, file.`)}
      >
        {itemDetail(it, files, `${label} · ${SUB_STEP_LABELS[step]}`)}
      </ChecklistRow>
    );
  };

  /** Hàng ảnh / sơ đồ đóng cont (4a, 4b) — tự xong khi có file. */
  const uploadRow = (step: "loading-plan" | "loading-photos") => {
    const it = stepItem(data, shipment.id, step);
    const files = filesOfStep(data, shipment.id, step);
    const isPhotos = step === "loading-photos";
    return (
      <ChecklistRow
        key={step}
        label={SUB_STEP_LABELS[step]}
        state={subStepState(data, shipment.id, step)}
        tourMark={isTourStep(4)}
        actions={
          !isCancelled && (
            <>
              {filesAvailable && (can.loadingCreate || can.update) && (
                <Button size="sm" onClick={() => onUploadLoading({ shipment, contractId: contract.id, step, label })} title={isPhotos ? "Chụp / chọn ảnh từng lớp hàng, seal, số cont." : "Đính file sơ đồ xếp hàng trong container."}>
                  {isPhotos ? <Camera className="mr-1 h-4 w-4" aria-hidden /> : <FilePlus2 className="mr-1 h-4 w-4" aria-hidden />}
                  {isPhotos ? "Đính ảnh" : "Đính sơ đồ"}
                </Button>
              )}
              {can.update && !files.length && (
                <Button size="sm" variant="ghost" onClick={() => openStep(step)} title="Đánh dấu không áp dụng (VD đóng ghép không có sơ đồ riêng).">
                  Không áp dụng…
                </Button>
              )}
            </>
          )
        }
      >
        {files.length ? (
          <>
            <span className="text-muted-foreground">{isPhotos ? `${files.length} ảnh` : `${files.length} file`}</span>
            <FileList files={files} onPreview={onPreview} caption={`${label} · ${SUB_STEP_LABELS[step]}`} onRemove={can.update ? onRemoveFile : undefined} />
          </>
        ) : (
          itemDetail(it, [], "")
        )}
      </ChecklistRow>
    );
  };

  const docs = documentItems(data, shipment.id);
  const payments = data.payments.filter((p) => p.shipmentId === shipment.id).sort((a, b) => a.date.localeCompare(b.date));
  const goTo = (n: StepNo) => document.getElementById(`ship-step-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <section data-tour="shipment-card" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <p className="font-semibold">{label || "Chuyến chưa có mã lô"}</p>
            <div className="flex flex-wrap gap-1">
              {isCancelled ? (
                <Tag variant="muted">Đã hủy: {shipment.cancelReason}</Tag>
              ) : progress.next === null ? (
                <Tag variant="done">Đủ hồ sơ</Tag>
              ) : (
                <Tag variant="pending">Đang làm · xong {progress.settledCount}/5 bước bắt buộc</Tag>
              )}
              {lateInfo.late && !isCancelled && (
                <Tag variant="error" title={`Hạn giao ${formatDateVN(lateInfo.deadline)} · ngày giao (on board / ETD) ${formatDateVN(lateInfo.deliveredOn)}`}>
                  Trễ hạn giao {lateInfo.days} ngày
                </Tag>
              )}
            </div>
          </div>
          {isCancelled && can.update && contract.status === "open" && (
            <Button size="sm" variant="edit" onClick={onRestore} title="Khôi phục chuyến đã hủy về đang làm (mục dùng chung ở chuyến khác không tự quay lại).">
              <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
              Khôi phục chuyến
            </Button>
          )}
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
        {/* Lưới tự chia theo bề ngang: điện thoại 2 cột, desktop 6 cột một hàng; phóng chữ 130 % tự bớt cột. */}
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-3 text-sm">
          <Fact label="Booking" value={shipment.bookingNo || (shipment.containerNo ? "" : "Chờ booking")} />
          <Fact label="Đóng cont" value={shipment.loadingDate ? formatDateVN(shipment.loadingDate) : ""} />
          <Fact label="ETD · ETA" value={[shipment.etd && formatDateVN(shipment.etd), shipment.eta && formatDateVN(shipment.eta)].filter(Boolean).join(" → ")} />
          <Fact label="Tàu / chuyến" value={shipment.vesselVoyage} />
          <Fact label={shipment.kind === "truck" ? "Biển số" : "Cont · seal"} value={[shipment.containerNo, shipment.sealNo].filter(Boolean).join(" · ")} />
          <Fact label="Kg kế hoạch · thực xuất" value={`${formatNumber(shipment.plannedKg) || "—"}${actuals.kg ? ` · ${formatNumber(actuals.kg)}` : ""}`} />
        </dl>
        {!isCancelled && (
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 border-t border-border pt-3">
            <StepStepper steps={progress.steps} current={progress.next} onSelect={goTo} />
            <p className={`text-sm ${progress.next === null ? "font-semibold text-success" : "text-foreground"}`}>{progressText(progress)}</p>
          </div>
        )}
      </section>

      <StepBlock n={1} state={progress.steps[1]} summary={summaryOf(1)} isCurrent={progress.next === 1}>
        <p className="py-3 text-sm text-muted-foreground">
          {settled(progress.steps[1])
            ? `Hợp đồng đã có bản BGĐ đồng ý${filesAvailable ? " kèm file ký" : ""}.`
            : "Ghi kết quả BGĐ duyệt (và file ký) bằng nút ở đầu hồ sơ hợp đồng."}
        </p>
      </StepBlock>

      <StepBlock n={2} state={progress.steps[2]} summary={summaryOf(2)} isCurrent={progress.next === 2}>
        {singleRow("production-order", 2)}
      </StepBlock>

      <StepBlock n={3} state={progress.steps[3]} summary={summaryOf(3)} isCurrent={progress.next === 3}>
        {singleRow("packaging", 3)}
      </StepBlock>

      <StepBlock n={4} state={progress.steps[4]} summary={summaryOf(4)} isCurrent={progress.next === 4}>
        <ChecklistRow
          label={shipment.kind === "truck" ? "Biển số xe" : "Số cont + seal"}
          state={shipment.kind === "consolidated" ? "not-applicable" : containerIdentityOk(shipment) ? "done" : "not-started"}
          tourMark={isTourStep(4)}
          actions={
            canWrite && shipment.kind !== "consolidated" && (
              <Button size="sm" variant="edit" onClick={onEdit} title="Điền số container và seal (nhìn ảnh seal / cửa cont).">
                <Pencil className="mr-1 h-4 w-4" aria-hidden />
                Sửa số cont
              </Button>
            )
          }
        >
          <span className="tnum">
            {shipment.kind === "consolidated"
              ? <span className="text-muted-foreground">Không cần — hàng đóng ghép chung cont của chuyến khác</span>
              : [shipment.containerNo, shipment.sealNo].filter(Boolean).join(" · ") || <span className="text-muted-foreground">Chưa điền</span>}
          </span>
        </ChecklistRow>
        {LOADING_STEPS.map((st) => (st === "loading-plan" || st === "loading-photos" ? uploadRow(st) : singleRow(st, 4)))}
      </StepBlock>

      <StepBlock n={5} state={progress.steps[5]} summary={summaryOf(5)} isCurrent={progress.next === 5}>
        {actuals.kg > 0 && (
          <p className="tnum border-b border-border py-3 text-sm">
            Thực xuất (theo Commercial Invoice): {formatNumber(actuals.cartons)} thùng · {formatNumber(actuals.kg)} kg
            {can.viewPrice ? ` · ${formatMoney(actuals.amount)} ${currency}` : ""}
          </p>
        )}
        {!docs.length && <p className="py-3 text-sm text-muted-foreground">Chưa có mục chứng từ.</p>}
        {docs.map((d) => {
          const title = requiredDocumentLabel({ kind: d.docKind, form: d.docForm, issuer: d.docIssuer });
          const st = itemState(data, d);
          return (
            <ChecklistRow
              key={d.id}
              label={title}
              state={st}
              extraTag={d.sharedFromId ? <Tag variant="source">Dùng chung</Tag> : undefined}
              tourMark={isTourStep(5)}
              actions={updateButton(() => onOpenItem({ shipment, contractId: contract.id, item: d, isNew: false }), `Cập nhật ${title}: số, ngày, file, trạng thái (${ITEM_STATE_LABELS[st]}).`)}
            >
              {itemDetail(d, filesOfItem(data, d.id), title)}
              {d.docKind === "commercial-invoice" && d.netKg != null && (
                <span className="tnum">
                  {formatNumber(d.cartons)} thùng · {formatNumber(d.netKg)} kg{can.viewPrice && d.amount != null ? ` · ${formatMoney(d.amount)} ${currency}` : ""}
                </span>
              )}
              {d.docKind === "bill-of-lading" && d.onBoardDate && <span className="tnum">On board {formatDateVN(d.onBoardDate)}</span>}
            </ChecklistRow>
          );
        })}
        {canWrite && (
          <div className="border-t border-border py-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenItem({ shipment, contractId: contract.id, item: { ...blankItem(shipment.id, "document", newId()), docKind: "other" }, isNew: true })}
              title="Thêm một chứng từ ngoài danh sách hợp đồng yêu cầu (VD hóa đơn hàng mẫu, kết quả vi sinh)."
            >
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Thêm chứng từ
            </Button>
          </div>
        )}
      </StepBlock>

      {can.paymentsView && (
        <StepBlock n={6} state={progress.steps[6]} summary={summaryOf(6)} isCurrent={false}>
          {can.viewPrice && (
            <p className="tnum border-b border-border py-3 text-sm">
              Tiền về {formatMoney(pay.received)} / {formatMoney(pay.expected)} {currency}
            </p>
          )}
          {payments.map((p) => (
            <ChecklistRow
              key={p.id}
              label={p.kind === "documents-sent" ? "Gửi bộ chứng từ" : "Tiền về"}
              state="done"
              actions={
                <>
                  {p.filePath && (
                    <Button size="sm" variant="ghost" onClick={() => onPreview({ path: p.filePath, name: p.fileName, caption: label })} title="Xem file đính kèm.">
                      Xem file
                    </Button>
                  )}
                  {can.paymentsWrite && (
                    <Button size="sm" variant="edit" onClick={() => onPayment({ contractId: contract.id, shipmentId: shipment.id, label, kind: p.kind, currency, existing: p })} title="Sửa dòng này.">
                      <Pencil className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Sửa</span>
                    </Button>
                  )}
                  {can.paymentsDelete && (
                    <InlineConfirmDelete
                      onConfirm={() => onDeletePayment(p)}
                      recordDescription={`${p.kind === "documents-sent" ? "Gửi bộ chứng từ" : "Tiền về"} ${formatDateVN(p.date)}${p.kind === "payment" && can.viewPrice ? ` — ${formatMoney(p.amount)} ${p.currency}` : ""}`}
                    />
                  )}
                </>
              }
            >
              <span className="tnum">
                {formatDateVN(p.date)}
                {p.kind === "payment" && can.viewPrice ? ` · ${formatMoney(p.amount)} ${p.currency}` : ""}
                {p.method ? ` · ${p.method}` : ""}
              </span>
              {p.note && <span className="text-muted-foreground">{p.note}</span>}
            </ChecklistRow>
          ))}
          {can.paymentsWrite && !isCancelled && (
            <div className="flex flex-wrap gap-2 border-t border-border py-3 first:border-t-0">
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
        </StepBlock>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-0.5">
      <dt className="flex items-center gap-1 text-muted-foreground">
        {label}
        <AbbrHint label={label} />
      </dt>
      <dd className="tnum break-words font-medium">{value || "—"}</dd>
    </div>
  );
}
