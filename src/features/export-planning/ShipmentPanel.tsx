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
  bookingFilesOf,
  STEP_TITLES,
  SUB_STEP_LABELS,
  blankItem,
  containerIdentityOk,
  documentItems,
  filesOfItem,
  effectiveRevision,
  filesOfStep,
  shipmentLateInfo,
  itemState,
  requiredDocumentLabel,
  shipmentActuals,
  shipmentKindLabel,
  shipmentPaymentSummary,
  shipmentFilesOf,
  sharedSource,
  stepItem,
  subStepState,
  shippingInstructionState,
  type ExportData,
  type StepNo,
} from "@/lib/exportPlanning";
import { formatDateTimeVN, formatDateVN, formatMoney } from "@/lib/format";
import { BOOKING_LABELS, TRANSPORT_LABELS, cutoffOverdue, hasTransport, localNowMinute } from "@/lib/exportBooking";
import type { ExportContract, ExportFile, ExportItemState, ExportLoadingExtraStep, ExportPayment, ExportShipment, ExportStep, ExportStepItem } from "@/types";
import { Ban, Boxes, Camera, ClipboardCheck, ClipboardList, Download, FilePlus2, FileSpreadsheet, FileText, Pencil, Plus, RotateCcw, Send, Ship, Trash2, Truck, Wallet } from "lucide-react";
import { loadingCountSummary, shipmentLinesOf } from "@/lib/exportInvoice";
import { ShipmentLineSummary } from "./ShipmentGoods";
import { EXTRA_PHOTO_TEXT } from "./shipmentGoodsLogic";
import { loadingCountText } from "./shipmentGoodsLogic";
import { FileList, StateTag, StepDot, StepStepper, type PreviewTarget } from "./parts";
import { progressText, shipmentProgress, stepMissing } from "./progress";
import type { LoadingUploadTarget, StepItemTarget } from "./ShipmentDialogs";
import type { BookingTarget, TransportTarget } from "./BookingDialogs";
import type { PaymentTarget } from "./RecordDialogs";
import { ShipmentOrders } from "@/features/production-orders/ShipmentOrders";

export interface ShipmentPanelCan {
  /** Xem được Xuất khẩu (`export-plans.view`) — người chỉ đóng hàng không thấy file booking (ba-spec 60 R4). */
  view: boolean;
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
  wide,
}: {
  label: string;
  /** Bỏ trống = hàng chỉ để xem (vd File booking — ba-spec 60 R3), không có thẻ trạng thái. */
  state?: ExportItemState;
  extraTag?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Hàng thuộc bước đang làm ⇒ thẻ trạng thái + nút là mốc "Trạng thái mục" / "Cập nhật mục" của hướng dẫn thao tác. */
  tourMark?: boolean;
  /** Chi tiết là lưới nhiều ô (Booking, Thông tin xe) ⇒ trải hết bề ngang, nằm dưới tên + nút. */
  wide?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 border-t border-border py-3 first:border-t-0 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] sm:items-start sm:gap-4">
      {/* Thẻ trạng thái LUÔN nằm dưới tên — tên ngắn hay dài thì hàng nào cũng cùng khuôn. */}
      <div className="grid min-w-0 justify-items-start gap-1">
        {label && <span className="font-semibold break-words">{label}</span>}
        {(state || extraTag) && (
          <span data-tour={tourMark ? "item-status" : undefined} className="flex flex-wrap gap-1">
            {state && <StateTag state={state} />}
            {extraTag}
          </span>
        )}
      </div>
      <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 text-sm ${wide ? "sm:order-last sm:col-span-3" : ""}`}>{children}</div>
      {actions && (
        <div data-tour={tourMark ? "step-update" : undefined} className={`flex min-w-0 flex-wrap gap-2 sm:justify-end ${wide ? "sm:col-start-3" : ""}`}>
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
  bookingFilesEnabled,
  bookingDetailsEnabled,
  onBooking,
  onTransport,
  siEnabled,
  onComposeExportOrder,
  onShippingInstruction,
  goodsEnabled,
  extraPhotosEnabled,
  onEditLines,
  onLoadingCount,
  onDownloadInvoice,
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
  /** Máy chủ đã chạy 0094 + có kho file ⇒ đính được file booking (ba-spec 60 R6). */
  bookingFilesEnabled: boolean;
  /** Máy chủ đã chạy 0101 ⇒ khối Booking (12 trường) + Thông tin xe vận chuyển thay hàng File booking (ba-spec 71). */
  bookingDetailsEnabled: boolean;
  onBooking: (t: BookingTarget) => void;
  onTransport: (t: TransportTarget) => void;
  /** Máy chủ đã chạy 0103 ⇒ hàng SI + ảnh cont / seal (ba-spec 72). */
  siEnabled: boolean;
  /** Mở bộ soạn Lệnh xuất hàng (ba-spec 72 NV1). */
  onComposeExportOrder: () => void;
  onShippingInstruction: () => void;
  /** Máy chủ đã chạy 0096 ⇒ có khối Hàng của chuyến, Số thực đóng, Tải invoice (ba-spec 63). */
  goodsEnabled: boolean;
  /** Máy chủ đã chạy 0097 ⇒ đính ảnh kèm số lượng thực đóng + hàng "Hình ảnh bao bì + cân gross". */
  extraPhotosEnabled: boolean;
  onEditLines: () => void;
  onLoadingCount: () => void;
  onDownloadInvoice: (format: "xlsx" | "pdf" | "docx") => void;
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
  const singleRow = (step: ExportStep, n: StepNo, extra?: ReactNode) => {
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
        actions={
          extra ? (
            <>
              {extra}
              {updateButton(() => openStep(step), `Cập nhật ${SUB_STEP_LABELS[step].toLowerCase()}: trạng thái, số, file.`)}
            </>
          ) : (
            updateButton(() => openStep(step), `Cập nhật ${SUB_STEP_LABELS[step].toLowerCase()}: trạng thái, số, file.`)
          )
        }
      >
        {itemDetail(it, files, `${label} · ${SUB_STEP_LABELS[step]}`)}
      </ChecklistRow>
    );
  };

  /** File booking của chuyến (ba-spec 60 NV2, NV3): chỉ để xem, không trạng thái, bản mới nhất đầu. */
  const bookingFilesRow = () => {
    const files = bookingFilesOf(data, shipment.id);
    return (
      <ChecklistRow
        key="booking"
        label="File booking"
        actions={
          !isCancelled &&
          bookingFilesEnabled &&
          can.update && (
            <Button size="sm" variant="outline" onClick={() => onUploadLoading({ shipment, contractId: contract.id, step: "booking", label })} title="Đính bản xác nhận booking của hãng tàu (booking sửa đổi thì đính thêm).">
              <FilePlus2 className="mr-1 h-4 w-4" aria-hidden />
              Đính file booking
            </Button>
          )
        }
      >
        {files.length ? (
          <>
            <span className="text-muted-foreground">
              {shipment.bookingNo ? `Booking ${shipment.bookingNo} · ` : ""}
              {files.length} file — bản mới nhất ở đầu
            </span>
            <FileList files={files} onPreview={onPreview} caption={`${label} · File booking`} onRemove={can.update && !isCancelled ? onRemoveFile : undefined} />
          </>
        ) : (
          <span className="text-muted-foreground">Chưa có file booking{shipment.bookingNo ? ` (số booking ${shipment.bookingNo})` : ""}.</span>
        )}
      </ChecklistRow>
    );
  };

  /**
   * Khối Booking (ba-spec 71 R1): 12 trường theo thứ tự chủ dự án, số booking + đại lý từ Ghi chuyến; file booking ở
   * dưới (người xem được Xuất khẩu). Không trạng thái (R7). Người đóng hàng xem được, không sửa (R9).
   */
  const bookingRow = () => {
    const b = shipment.booking;
    const files = can.view ? bookingFilesOf(data, shipment.id) : [];
    const now = localNowMinute();
    const cutoff = (v: string | undefined) =>
      v ? (
        <span className="flex flex-wrap items-center gap-1">
          {formatDateTimeVN(v)}
          {cutoffOverdue(v, now, shipment) && <Tag variant="warning">Đã qua hạn</Tag>}
        </span>
      ) : (
        ""
      );
    const hasAny = !!(b && (b.placeOfReceipt || b.portOfLoading || b.placeOfDelivery || b.returnYard || b.docCutoff || b.vgmCutoff || b.cargoCutoff));
    return (
      <ChecklistRow
        key="booking"
        label="Booking"
        wide
        actions={
          canWrite && (
            <Button
              size="sm"
              variant={hasAny ? "edit" : "outline"}
              onClick={() => onBooking({ shipment, files, label })}
              title="Chọn file booking của hãng tàu — app đọc ra tàu, cảng, nơi hạ bãi, hạn cut-off; soát rồi lưu."
            >
              <Ship className="mr-1 h-4 w-4" aria-hidden />
              Cập nhật booking
            </Button>
          )
        }
      >
        <dl data-tour="shipment-booking" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
          <Fact label={BOOKING_LABELS.bookingNo} value={shipment.bookingNo} />
          <Fact label={BOOKING_LABELS.forwarder} value={b?.forwarder} />
          <Fact label={BOOKING_LABELS.vesselVoyage} value={shipment.vesselVoyage} />
          <Fact label={BOOKING_LABELS.placeOfReceipt} value={b?.placeOfReceipt} />
          <Fact label={BOOKING_LABELS.portOfLoading} value={b?.portOfLoading} />
          <Fact label={BOOKING_LABELS.portOfDischarge} value={shipment.portOfDischarge} />
          <Fact label={BOOKING_LABELS.placeOfDelivery} value={b?.placeOfDelivery} />
          <Fact label={BOOKING_LABELS.kind} value={shipmentKindLabel(shipment.kind)} />
          <Fact label={BOOKING_LABELS.returnYard} value={b?.returnYard} />
          <Fact label={BOOKING_LABELS.docCutoff} value={cutoff(b?.docCutoff)} />
          <Fact label={BOOKING_LABELS.vgmCutoff} value={cutoff(b?.vgmCutoff)} />
          <Fact label={BOOKING_LABELS.cargoCutoff} value={cutoff(b?.cargoCutoff)} />
        </dl>
        {can.view &&
          (files.length ? (
            <div className="grid gap-1 border-t border-border pt-2">
              <span className="text-muted-foreground">File booking · {files.length} file — bản mới nhất ở đầu</span>
              <FileList files={files} onPreview={onPreview} caption={`${label} · File booking`} onRemove={can.update && !isCancelled ? onRemoveFile : undefined} />
            </div>
          ) : (
            <span className="text-muted-foreground">Chưa có file booking.</span>
          ))}
      </ChecklistRow>
    );
  };

  /** Thông tin xe vận chuyển (ba-spec 71 NV4): 4 ô bắt buộc khi lưu, không trạng thái (R7). */
  const transportRow = () => {
    const t = shipment.transport;
    const done = hasTransport(t);
    const driver = t ? [t.driverName, t.driverPhone, t.driverIdNo && `CCCD ${t.driverIdNo}`, t.truckPlate].filter(Boolean).join(" · ") : "";
    return (
      <ChecklistRow
        key="transport"
        label="Thông tin xe vận chuyển"
        wide
        actions={
          canWrite && (
            <Button size="sm" variant={done ? "edit" : "outline"} onClick={() => onTransport({ shipment, label })} title="Ghi công ty vận chuyển, tài xế, nơi lấy container rỗng, nơi đóng, nơi hạ bãi.">
              <Truck className="mr-1 h-4 w-4" aria-hidden />
              {done ? "Sửa thông tin xe" : "Ghi thông tin xe"}
            </Button>
          )
        }
      >
        {done && t ? (
          <dl data-tour="shipment-transport" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
            <Fact label={TRANSPORT_LABELS.haulier} value={t.haulier} />
            <Fact label="Tài xế · SĐT · CCCD · biển số" value={driver} />
            <Fact label={TRANSPORT_LABELS.emptyPickupPlace} value={t.emptyPickupPlace} />
            <Fact label={TRANSPORT_LABELS.stuffingPlace} value={t.stuffingPlace} />
            <Fact label={TRANSPORT_LABELS.returnYard} value={t.returnYard} />
          </dl>
        ) : (
          <span data-tour="shipment-transport" className="text-muted-foreground">
            Chưa ghi thông tin xe — không bắt buộc để xong bước, ghi khi đã thuê xe.
          </span>
        )}
      </ChecklistRow>
    );
  };

  const containerPhotos = shipmentFilesOf(data, shipment.id, "container-seal-photos")
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  /** Mục SI (ba-spec 72 R10–R14): Xong khi có file SI; xe tải / đóng ghép / chuyến cũ ⇒ Không áp dụng. */
  const siRow = () => {
    const st = shippingInstructionState(data, shipment);
    const files = shipmentFilesOf(data, shipment.id, "shipping-instruction")
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return (
      <ChecklistRow
        key="shipping-instruction"
        label="SI"
        state={st}
        tourMark={isTourStep(4)}
        actions={
          canWrite &&
          st !== "not-applicable" && (
            <Button size="sm" variant={files.length ? "edit" : "default"} onClick={onShippingInstruction} title="Lập Shipping Instruction gửi hãng tàu: ô lấy từ booking, cont / seal, hàng của chuyến; xuất Excel theo mẫu SI FORM là mục Xong.">
              <FileSpreadsheet className="mr-1 h-4 w-4" aria-hidden />
              {files.length ? "Sửa SI" : "Lập SI"}
            </Button>
          )
        }
      >
        {files.length ? (
          <FileList files={files} onPreview={onPreview} caption={`${label} · SI`} onRemove={can.update && !isCancelled ? onRemoveFile : undefined} />
        ) : (
          <span className="text-muted-foreground">
            {st === "not-applicable"
              ? shipment.kind === "truck" || shipment.kind === "consolidated"
                ? "Không áp dụng — chuyến xe tải / đóng ghép không có SI."
                : "Không áp dụng — chuyến xong trước khi có mục SI."
              : "Chưa lập SI — lập sau khi có số cont / seal, gửi hãng tàu để ra B/L."}
          </span>
        )}
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

  const goods = shipmentLinesOf(data.shipmentLines ?? [], shipment.id);
  const counted = loadingCountSummary(goods);
  /** Hàng Số lượng thực đóng (bước 4) — kho điền sau khi đóng cont; KHÔNG chặn bước 4 xong (ba-spec 63 R4). */
  /** Nút "Đính ảnh" cho ảnh thêm của bước 4 (mig 0097) — người đóng hàng hoặc người ghi Xuất khẩu. */
  const extraPhotoButton = (step: ExportLoadingExtraStep) =>
    !isCancelled &&
    extraPhotosEnabled &&
    filesAvailable &&
    (can.loadingCreate || can.update) && (
      <Button size="sm" variant="outline" onClick={() => onUploadLoading({ shipment, contractId: contract.id, step, label })} title={EXTRA_PHOTO_TEXT[step].description}>
        <Camera className="mr-1 h-4 w-4" aria-hidden />
        Đính ảnh
      </Button>
    );
  const extraPhotos = (step: ExportLoadingExtraStep) => {
    const files = shipmentFilesOf(data, shipment.id, step);
    return files.length ? (
      <FileList files={files} onPreview={onPreview} caption={`${label} · ${EXTRA_PHOTO_TEXT[step].title}`} onRemove={can.update && !isCancelled ? onRemoveFile : undefined} />
    ) : null;
  };
  const loadingCountRow = () => (
    <ChecklistRow
      key="loading-count"
      label="Số lượng thực đóng"
      state={counted.complete ? "done" : counted.filledCount ? "in-progress" : "not-started"}
      actions={
        !isCancelled &&
        (can.loadingCreate || can.update) && (
          <>
            {/* Không chờ Phòng KH nhập Hàng của chuyến: chưa có dòng thì hộp lấy dòng hàng của HĐ (feedback 2026-11-03). */}
            <Button size="sm" variant={counted.filledCount ? "edit" : "default"} onClick={onLoadingCount} title="Đóng cont xong: ghi số kiện thực đã đóng của từng dòng hàng (lấy từ dòng hàng của hợp đồng nếu chuyến chưa có hàng).">
              <ClipboardCheck className="mr-1 h-4 w-4" aria-hidden />
              {counted.filledCount ? "Sửa số thực đóng" : "Điền số thực đóng"}
            </Button>
            {extraPhotoButton("loading-count-photos")}
          </>
        )
      }
    >
      <span className="tnum">{loadingCountText(goods)}</span>
      {extraPhotos("loading-count-photos")}
    </ChecklistRow>
  );
  /** Hình ảnh bao bì + cân gross (mig 0097): có ảnh ⇒ Xong; KHÔNG chặn bước 4 (như số lượng thực đóng). */
  const packageWeightRow = () => {
    const n = shipmentFilesOf(data, shipment.id, "package-weight-photos").length;
    return (
      <ChecklistRow key="package-weight" label="Hình ảnh bao bì + cân gross" state={n ? "done" : "not-started"} actions={extraPhotoButton("package-weight-photos")}>
        {n ? <span className="text-muted-foreground">{n} ảnh</span> : <span className="text-muted-foreground">Chưa có ảnh — chụp thùng / nhãn bao bì và ảnh cân kg cả bì.</span>}
        {extraPhotos("package-weight-photos")}
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
          {/* basis-64 + cột minmax(0,1fr): tên chuyến / thẻ dài xuống dòng, không đẩy trang tràn ngang ở 360 px × 130 %. */}
          <div className="grid min-w-0 flex-1 basis-64 grid-cols-[minmax(0,1fr)] gap-1">
            <p className="font-semibold break-words">{label || "Chuyến chưa có mã lô"}</p>
            <div className="flex min-w-0 flex-wrap gap-1 [&>*]:max-w-full [&>*]:whitespace-normal">
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

      {goodsEnabled && (
        <section data-tour="shipment-goods" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="grid min-w-0 flex-1 basis-56 gap-0.5">
              <p className="flex items-center gap-2 font-semibold">
                <Boxes className="h-4 w-4" aria-hidden />
                Hàng của chuyến
              </p>
              <p className="text-sm text-muted-foreground">
                {goods.length
                  ? `${goods.length} dòng${goods.some((l) => l.plannedUnits != null) ? ` · kế hoạch ${formatNumber(counted.plannedUnits)} kiện` : " · chưa có kế hoạch"}${counted.filledCount ? ` · thực đóng ${formatNumber(counted.loadedUnits)} (${counted.filledCount}/${goods.length} dòng)` : ""}`
                  : "Chưa nhập kế hoạch (không bắt buộc) — bộ phận đóng cont vẫn điền được số thực đóng theo dòng hàng của hợp đồng ở bước Đóng cont."}
              </p>
            </div>
            {canWrite && (
              <Button size="sm" variant={goods.length ? "edit" : "default"} onClick={onEditLines} title="Chọn dòng hàng của hợp đồng đóng vào chuyến này, ghi số kiện, kg cả bì, hạn dùng.">
                <Boxes className="mr-1 h-4 w-4" aria-hidden />
                {goods.length ? "Sửa hàng của chuyến" : "Nhập hàng của chuyến"}
              </Button>
            )}
          </div>
          {goods.length > 0 && (
            <div className="grid min-w-0 border-t border-border">
              {goods.map((l) => (
                <ShipmentLineSummary key={l.id} line={l} />
              ))}
            </div>
          )}
        </section>
      )}

      <StepBlock n={1} state={progress.steps[1]} summary={summaryOf(1)} isCurrent={progress.next === 1}>
        <p className="py-3 text-sm text-muted-foreground">
          {settled(progress.steps[1])
            ? `Hợp đồng có bản hiệu lực${filesAvailable ? " và đủ hồ sơ đính kèm" : ""}.`
            : effectiveRevision(data, contract.id)
              ? "Còn thiếu hồ sơ đính kèm của hợp đồng — đính kèm ở khối Hồ sơ đính kèm của hồ sơ hợp đồng."
              : "Hợp đồng chưa có bản hiệu lực (mọi bản đã bị từ chối) — ghi bản sửa ở đầu hồ sơ."}
        </p>
      </StepBlock>

      <StepBlock n={2} state={progress.steps[2]} summary={summaryOf(2)} isCurrent={progress.next === 2}>
        {singleRow("production-order", 2)}
        {/* Lệnh sản xuất có cấu trúc (ba-spec 48 R6): lệnh phát hành gắn chuyến ⇒ bước 2 xong; file cũ vẫn tính. */}
        <ShipmentOrders shipment={shipment} isCancelled={isCancelled} />
      </StepBlock>

      <StepBlock n={3} state={progress.steps[3]} summary={summaryOf(3)} isCurrent={progress.next === 3}>
        {singleRow("packaging", 3)}
      </StepBlock>

      <StepBlock n={4} state={progress.steps[4]} summary={summaryOf(4)} isCurrent={progress.next === 4}>
        {/* Thứ tự theo trình tự đóng cont thật (chị Vi 2026-11-03, SI chị Thảo 2026-11-04): booking → thông tin xe →
            lệnh xuất → số cont / seal → SI → số lượng thực đóng → sơ đồ → hình ảnh → tờ khai. */}
        {bookingDetailsEnabled ? bookingRow() : can.view && bookingFilesRow()}
        {bookingDetailsEnabled && transportRow()}
        {singleRow(
          "export-order",
          4,
          canWrite && (
            <Button size="sm" onClick={onComposeExportOrder} title="Lập Lệnh xuất hàng mẫu QTI-KH-01-07: hàng lấy từ Lệnh sản xuất, giao hàng lấy từ booking; xuất Word là mục Xong.">
              <FileText className="mr-1 h-4 w-4" aria-hidden />
              Lập lệnh xuất
            </Button>
          ),
        )}
        <ChecklistRow
          label={shipment.kind === "truck" ? "Biển số xe" : "Số cont + seal"}
          state={shipment.kind === "consolidated" ? "not-applicable" : containerIdentityOk(shipment) ? "done" : "not-started"}
          tourMark={isTourStep(4)}
          actions={
            !isCancelled &&
            shipment.kind !== "consolidated" && (
              <>
                {siEnabled && filesAvailable && (can.update || can.loadingCreate) && (
                  <Button size="sm" variant="outline" onClick={() => onUploadLoading({ shipment, contractId: contract.id, step: "container-seal-photos", label })} title="Chụp / chọn ảnh số container và seal (không bắt buộc).">
                    <Camera className="mr-1 h-4 w-4" aria-hidden />
                    Ảnh cont / seal
                  </Button>
                )}
                {canWrite && (
                  <Button size="sm" variant="edit" onClick={onEdit} title="Điền số container và seal (nhìn ảnh seal / cửa cont).">
                    <Pencil className="mr-1 h-4 w-4" aria-hidden />
                    Sửa số cont
                  </Button>
                )}
              </>
            )
          }
        >
          <span className="tnum">
            {shipment.kind === "consolidated"
              ? <span className="text-muted-foreground">Không cần — hàng đóng ghép chung cont của chuyến khác</span>
              : [shipment.containerNo, shipment.sealNo].filter(Boolean).join(" · ") || <span className="text-muted-foreground">Chưa điền</span>}
          </span>
          {/* Ảnh cont / seal (ba-spec 72 R8): mới nhất đầu, không đổi điều kiện Xong. */}
          {siEnabled && containerPhotos.length > 0 && <FileList files={containerPhotos} onPreview={onPreview} caption={`${label} · Ảnh cont / seal`} onRemove={can.update && !isCancelled ? onRemoveFile : undefined} />}
        </ChecklistRow>
        {/* SI ngay sau số cont + seal (chị Thảo 2026-11-04: làm SI khi đã có cont / seal). */}
        {siEnabled && siRow()}
        {goodsEnabled && loadingCountRow()}
        {extraPhotosEnabled && packageWeightRow()}
        {uploadRow("loading-plan")}
        {uploadRow("loading-photos")}
        {singleRow("customs-declaration", 4)}
      </StepBlock>

      <StepBlock n={5} state={progress.steps[5]} summary={summaryOf(5)} isCurrent={progress.next === 5}>
        {actuals.kg > 0 && (
          <p className="tnum border-b border-border py-3 text-sm">
            Thực xuất (theo Commercial Invoice): {formatNumber(actuals.cartons)} thùng · {formatNumber(actuals.kg)} kg
            {can.viewPrice ? ` · ${formatMoney(actuals.amount)} ${currency}` : ""}
          </p>
        )}
        {goodsEnabled && goods.length > 0 && can.viewPrice && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3">
            <span className="text-sm text-muted-foreground">Bộ Invoice · Packing list lập từ hàng của chuyến (tài khoản, đơn giá, ghi chú riêng sửa ở mục Commercial Invoice).</span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => onDownloadInvoice("pdf")} title="Tải bản PDF Invoice, Packing list (và Expiry date list khi có hạn dùng) của chuyến này — mỗi chứng từ một trang A4.">
                <Download className="mr-1 h-4 w-4" aria-hidden />
                Tải PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDownloadInvoice("docx")} title="Tải file Word Invoice, Packing list (và Expiry date list khi có hạn dùng) của chuyến này để sửa tiếp chữ.">
                <Download className="mr-1 h-4 w-4" aria-hidden />
                Tải Word
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDownloadInvoice("xlsx")} title="Tải file Excel Invoice, Packing list (và Expiry date list khi có hạn dùng) của chuyến này để sửa tiếp.">
                <Download className="mr-1 h-4 w-4" aria-hidden />
                Tải Excel
              </Button>
            </div>
          </div>
        )}
        {!docs.length && <p className="py-3 text-sm text-muted-foreground">Chưa có mục chứng từ.</p>}
        {docs.map((d) => {
          const title = requiredDocumentLabel({ kind: d.docKind, form: d.docForm, issuer: d.docIssuer }, data.documentKinds);
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
