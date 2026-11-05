// ============================================================
// Tên file: src/features/export-planning/ShipmentDialogs.tsx
// Tên tiếng Việt: Hộp lên chuyến / sửa chuyến · cập nhật một bước · đính ảnh & sơ đồ đóng cont
// Description: Shipment form (one container), step item form (state + evidence + shared source +
//              invoice / B/L numbers + files) and the loading photo / plan uploader for phones.
// ============================================================
// Luật: ba-spec 41 NV7 (tháng = ngày đóng ?? ETD ?? tháng kế hoạch, ngày đóng ≤ ETD ≤ ETA),
// NV8 (xong phải có bằng chứng, không áp dụng phải có lý do, dùng chung), NV9 (người đóng hàng
// chỉ THÊM file 4a / 4b). Kiểm ở lib/exportPlanning.ts (canMarkDone, validateShipment…).
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  ChoiceGroup,
  Combobox,
  DateField,
  ErrorSummary,
  Field,
  FormDialog,
  InlineConfirmDelete,
  Input,
  NumberField,
  Textarea,
  formatNumber,
  notify,
  type FieldError,
} from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useDocumentKindPicker, type DocumentKindSource } from "./documentKindPicker";
import { useExportOptionPicker } from "./exportOptionPicker";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import { EMPTY_BOOKING_DETAILS, EMPTY_TRANSPORT_INFO } from "@/lib/exportBooking";
import {
  ITEM_STATE_LABELS,
  MISSING_LABELS,
  SHIPMENT_KINDS,
  SUB_STEP_LABELS,
  canMarkDone,
  documentItems,
  filesOfStep,
  isContainerKind,
  normalizeContainerNo,
  isRequiredDocumentItem,
  termsOf,
  requiredDocumentLabel,
  shareCandidates,
  validateShipment,
  validateExtraContainers,
  workingRevision,
  type ExportData,
  type ScheduleRow,
  validateScheduleRows,
} from "@/lib/exportPlanning";
import { CONTAINER_KINDS, removeContainerGate } from "@/lib/exportContainers";
import { checkExportFile, exportFilePath, hasExportStorage, removeExportFiles, uploadExportFile } from "@/lib/exportFileStorage";
import { useCompanyProfileStore, useComposedDocuments } from "@/lib/catalogRepo";
import { companySellerOf } from "@/lib/companyProfile";
import { invoiceDocumentFor, packingListPdfFile } from "./invoiceDocument";
import { SHIPPING_INSTRUCTION_DOC, siFromValues, siTotals } from "@/lib/shippingInstruction";
import { invoiceNameLines } from "@/lib/invoiceReader";
import type { Customer, CustomerProductName, ExportContractLine, ExportLoadingExtraStep, ExportDocumentKind, ExportFile, ExportItemState, ExportShipment, ExportShipmentContainer, ExportShipmentKind, ExportShipmentLine, ExportContainerKind, ExportStep, ExportStepItem, Product } from "@/types";
import { CalendarPlus, Camera, ClipboardList, Container, FileText, Plus, Save, Trash2 } from "lucide-react";
import { FileList, FilePicker, type PreviewTarget } from "./parts";
import { InvoiceReadPanel, type InvoiceReadState } from "./InvoiceReadPanel";
import { InvoiceComposePanel } from "./InvoiceComposePanel";
import { EXTRA_PHOTO_TEXT } from "./shipmentGoodsLogic";

/** Tải nhiều file lên (theo thứ tự); lỗi giữa chừng ⇒ gỡ các file đã lên rồi báo. */
export async function uploadAll(files: File[], contractId: string, area: "shipment" | "loading", prefix: string): Promise<{ path: string; fileName: string }[]> {
  const done: { path: string; fileName: string }[] = [];
  for (const f of files) {
    const err = checkExportFile(f);
    if (err) {
      void removeExportFiles(done.map((d) => d.path));
      throw new Error(err);
    }
    const r = await uploadExportFile(exportFilePath(contractId, area, `${prefix}-${newId()}`, f.name), f);
    if ("error" in r) {
      void removeExportFiles(done.map((d) => d.path));
      throw new Error(r.error);
    }
    done.push(r);
  }
  return done;
}

/* ---------- Lên chuyến / sửa chuyến (NV7) ---------- */

export interface ShipmentTarget {
  contractId: string;
  contractNo: string;
  existing?: ExportShipment;
  defaults: { planMonth: string; portOfDischarge: string; kind: ExportShipmentKind; plannedKg: number | null };
  /** Cont thêm đang có của chuyến (ba-spec 73) + Hàng của chuyến (để chặn bỏ cont còn dòng). */
  extraContainers?: readonly ExportShipmentContainer[];
  shipmentLines?: readonly ExportShipmentLine[];
}

/** Một cont thêm trong hộp Ghi chuyến (ba-spec 73 NV1). */
interface ContainerDraft {
  id: string;
  kind: ExportContainerKind;
  containerNo: string;
  sealNo: string;
  loadingDate: string;
  note: string;
  createdAt: string;
}
const CONTAINER_KIND_OPTIONS = CONTAINER_KINDS.map((k) => ({ value: k, label: k }));

interface ShipmentForm extends Omit<ExportShipment, "createdAt" | "status" | "cancelReason"> {
  key: string;
  contractNo: string;
  /** Chuyến có sẵn (sửa) ⇒ giữ trạng thái + ngày tạo; null = lên chuyến mới. Nằm TRONG form để nháp mở lại sau tải trang vẫn lưu đúng. */
  existingMeta: Pick<ExportShipment, "status" | "cancelReason" | "createdAt"> | null;
  /** Cont 2…n (ba-spec 73). Nháp cũ không có ⇒ coi như []. */
  extras?: ContainerDraft[];
  initial: string;
}
const shipSnap = (f: ShipmentForm) =>
  JSON.stringify([
    f.planMonth, f.kind, f.goodsSummary, f.plannedKg, f.lotCode, f.portOfDischarge, f.bookingNo, f.booking?.forwarder ?? "", f.loadingDate, f.etd, f.eta, f.vesselVoyage, f.containerNo, f.sealNo, f.note,
    (f.extras ?? []).map((c) => [c.kind, c.containerNo, c.sealNo, c.loadingDate]),
  ]);

export function ShipmentFormDialog({
  target,
  onClose,
  onSave,
  recordedBy,
  bookingFilesEnabled,
  bookingDetailsEnabled,
  containersEnabled,
}: {
  target: ShipmentTarget | null;
  onClose: () => void;
  /** `bookingFiles`: file booking vừa tải lên (ba-spec 60 NV1) — lưu chuyến hỏng thì màn tự gỡ file đã tải. */
  onSave: (s: ExportShipment, isNew: boolean, bookingFiles: ExportFile[], extras: ExportShipmentContainer[] | null) => boolean;
  recordedBy: string;
  /** Máy chủ đã chạy 0106 ⇒ hiện khối Cont thêm (ba-spec 73). */
  containersEnabled: boolean;
  /** Máy chủ đã chạy 0094 + có kho file ⇒ hiện ô chọn file booking. */
  bookingFilesEnabled: boolean;
  /** Máy chủ đã chạy 0101 ⇒ hiện ô Đại lý (ba-spec 71 NV1). */
  bookingDetailsEnabled: boolean;
}) {
  const [form, setForm] = useState<ShipmentForm | null>(null);
  // Cảng đến chọn theo danh sách Cảng đích (ba-spec 62).
  const optionPicker = useExportOptionPicker();
  const [errors, setErrors] = useState<FieldError[]>([]);
  // File chọn không vào nháp (File không lưu được) — mở lại nháp thì chọn lại.
  const [bookingFiles, setBookingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = useDialogDraft({ form: "export-shipment", value: form, setValue: setForm, isEmpty: (f) => shipSnap(f) === f.initial });

  useEffect(() => {
    if (!target) return;
    const e = target.existing;
    const f: ShipmentForm = {
      key: e?.id ?? `new:${target.contractId}`,
      id: e?.id ?? newId(),
      contractId: target.contractId,
      contractNo: target.contractNo,
      existingMeta: e ? { status: e.status, cancelReason: e.cancelReason, createdAt: e.createdAt } : null,
      planMonth: e?.planMonth ?? target.defaults.planMonth,
      kind: e?.kind ?? target.defaults.kind,
      goodsSummary: e?.goodsSummary ?? "",
      plannedKg: e ? e.plannedKg : target.defaults.plannedKg,
      lotCode: e?.lotCode ?? "",
      portOfDischarge: e?.portOfDischarge ?? target.defaults.portOfDischarge,
      bookingNo: e?.bookingNo ?? "",
      loadingDate: e?.loadingDate ?? "",
      etd: e?.etd ?? "",
      eta: e?.eta ?? "",
      vesselVoyage: e?.vesselVoyage ?? "",
      containerNo: e?.containerNo ?? "",
      sealNo: e?.sealNo ?? "",
      note: e?.note ?? "",
      // ba-spec 71: giữ khối booking + xe của chuyến khi sửa (hộp chỉ đổi Đại lý).
      ...(bookingDetailsEnabled ? { booking: e?.booking ?? EMPTY_BOOKING_DETAILS, transport: e?.transport ?? EMPTY_TRANSPORT_INFO } : {}),
      extras: [...(target.extraContainers ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => ({ id: c.id, kind: c.kind, containerNo: c.containerNo, sealNo: c.sealNo, loadingDate: c.loadingDate, note: c.note, createdAt: c.createdAt })),
      initial: "",
    };
    const fresh = { ...f, initial: shipSnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setErrors([]);
    setBookingFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const set = <K extends keyof ShipmentForm>(k: K, v: ShipmentForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const extras = form?.extras ?? [];
  const setExtra = (id: string, patch: Partial<ContainerDraft>) => set("extras", extras.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addExtra = () => set("extras", [...extras, { id: newId(), kind: "20RF", containerNo: "", sealNo: "", loadingDate: "", note: "", createdAt: new Date().toISOString() }]);
  /** Bỏ cont thêm: còn dòng hàng gán cont đó ⇒ chặn, kể tên dòng (ba-spec 73 R4). */
  const removeExtra = (c: ContainerDraft, no: number) => {
    const gate = removeContainerGate({ shipmentLines: target?.shipmentLines ?? [] }, { id: c.id, shipmentId: form?.id ?? "" });
    if (!gate.ok) {
      notify.error(`Cont ${no} còn ${gate.blockingLines.length} dòng hàng (${gate.blockingLines.map((l) => l.description || "chưa có tên").join(", ")}) — chuyển các dòng sang cont khác ở Hàng của chuyến rồi bỏ cont.`);
      return;
    }
    set("extras", extras.filter((x) => x.id !== c.id));
  };

  const save = async () => {
    if (busy) return;
    // Không đòi `target`: hộp mở lại từ nháp sau tải trang thì target rỗng, mọi thứ cần đã nằm trong form.
    if (!form) return;
    const errs = validateShipment(form).map((i) => ({ field: i.label, message: i.message }));
    const keepExtras = containersEnabled && isContainerKind(form.kind);
    if (keepExtras) for (const i of validateExtraContainers(form, extras)) errs.push({ field: i.label, message: i.message });
    // ba-spec 73 R2: xe tải / đóng ghép không có cont thêm.
    if (containersEnabled && !isContainerKind(form.kind) && extras.length)
      errs.push({ field: "Cont thêm", message: "Xe tải / đóng ghép không có cont thêm — bỏ các cont thêm trước khi đổi loại chuyến" });
    // Nháp cũ (trước khi form mang existingMeta) không biết là sửa hay lên mới ⇒ không đoán, bắt mở lại.
    if (form.existingMeta === undefined) errs.push({ field: "Nháp cũ", message: "Bấm Bỏ bản nháp rồi mở lại chuyến để sửa" });
    for (const f of bookingFiles) {
      const err = checkExportFile(f);
      if (err) errs.push({ field: "File booking", message: err });
    }
    setErrors(errs);
    if (errs.length) return;
    const e = form.existingMeta;
    let uploaded: { path: string; fileName: string }[] = [];
    if (bookingFiles.length && bookingFilesEnabled) {
      setBusy(true);
      try {
        uploaded = await uploadAll(bookingFiles, form.contractId, "shipment", "booking");
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Không tải được file booking lên máy chủ");
        setBusy(false);
        return;
      }
    }
    const now = new Date().toISOString();
    const fileRows: ExportFile[] = uploaded.map((u) => ({
      id: newId(),
      contractId: form.contractId,
      shipmentId: form.id,
      stepItemId: "",
      step: "booking",
      path: u.path,
      fileName: u.fileName,
      layerNo: null,
      caption: "",
      uploadedBy: recordedBy,
      createdAt: now,
    }));
    const { key: _key, contractNo: _no, initial: _initial, existingMeta: _meta, extras: _extras, ...rest } = form;
    const savedExtras: ExportShipmentContainer[] | null = keepExtras
      ? extras.map((c, i) => ({
          ...c,
          shipmentId: form.id,
          sortOrder: i + 1,
          containerNo: normalizeContainerNo(c.containerNo),
          sealNo: c.sealNo.trim().toUpperCase(),
          note: c.note.trim(),
        }))
      : null;
    const ok = onSave(
      {
        ...rest,
        goodsSummary: form.goodsSummary.trim(),
        lotCode: form.lotCode.trim(),
        bookingNo: form.bookingNo.trim(),
        // Cont lạnh: bỏ khoảng trắng / gạch, viết hoa (ISO 6346); xe tải giữ biển số như gõ (chỉ viết hoa).
        containerNo: isContainerKind(form.kind) ? normalizeContainerNo(form.containerNo) : form.containerNo.trim().toUpperCase(),
        sealNo: form.sealNo.trim().toUpperCase(),
        note: form.note.trim(),
        ...(form.booking ? { booking: { ...form.booking, forwarder: form.booking.forwarder.trim() } } : {}),
        status: e?.status ?? "open",
        cancelReason: e?.cancelReason ?? "",
        createdAt: e?.createdAt ?? new Date().toISOString(),
      },
      !e,
      fileRows,
      savedExtras,
    );
    setBusy(false);
    if (!ok) {
      void removeExportFiles(uploaded.map((u) => u.path));
      return;
    }
    draft.done();
  };

  const isTruck = form?.kind === "truck";
  const isContainer = form ? isContainerKind(form.kind) : true;

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={(form ? form.existingMeta : target?.existing) ? `Sửa chuyến · HĐ ${form?.contractNo ?? ""}` : `Ghi chuyến · HĐ ${form?.contractNo ?? ""}`}
      description="Một chuyến là một booking. Booking nhiều cont (VD 1X20RF & 1X40RF) thì thêm cont 2, 3… ở khối Cont thêm. Chuyến hiện ở tháng của ngày đóng cont; chưa có thì theo ETD, rồi tới tháng kế hoạch."
      icon={Container}
      size="lg"
      hasRequiredFields
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              draft.cancel();
              onClose();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={() => void save()} title="Lưu chuyến này (kèm file booking đã chọn).">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {busy ? `Đang tải ${bookingFiles.length} file…` : "Lưu chuyến"}
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          <ChoiceGroup label="Loại chuyến" required value={form.kind} onChange={(v) => set("kind", v as ExportShipmentKind)} options={SHIPMENT_KINDS} columns={3} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tháng kế hoạch" required hint="Theo sổ kế hoạch tháng, VD 2026-10.">
              <Input type="month" value={form.planMonth} onChange={(e) => set("planMonth", e.target.value)} aria-required />
            </Field>
            <Field label="Mã lô (MSL)" hint="VD: 165 · cont gộp 2 lô ghi 216+006">
              <Input value={form.lotCode} onChange={(e) => set("lotCode", e.target.value)} />
            </Field>
            <NumberField label="Kg kế hoạch" value={form.plannedKg} onChange={(v) => set("plannedKg", v)} />
          </div>
          <Field label="Mặt hàng" hint="Mô tả ngắn như sổ kế hoạch, VD: bạch tuộc cắt luộc + tip">
            <Input value={form.goodsSummary} onChange={(e) => set("goodsSummary", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 content-start gap-2">
              <Field label="Số booking" hint="Trống = chờ booking">
                <Input value={form.bookingNo} onChange={(e) => set("bookingNo", e.target.value)} />
              </Field>
              {/* Đại lý (forwarder) — khối Booking ở bước Đóng cont lấy từ đây (ba-spec 71 NV1). */}
              {bookingDetailsEnabled && form.booking && (
                <Combobox
                  label="Đại lý"
                  hideRequiredMark
                  hint="Forwarder đặt booking"
                  {...optionPicker.fieldProps("forwarder", form.booking.forwarder)}
                  onChange={(v) => set("booking", { ...(form.booking ?? EMPTY_BOOKING_DETAILS), forwarder: v })}
                />
              )}
              {/* File booking (ba-spec 60 NV1): không bắt buộc; booking sửa đổi đính thêm ở khối Đóng cont. */}
              {bookingFilesEnabled && <FilePicker files={bookingFiles} onChange={setBookingFiles} label="Đính file booking" />}
            </div>
            <Combobox
              label="Cảng đến"
              hideRequiredMark
              {...optionPicker.fieldProps("discharge-port", form.portOfDischarge)}
              onChange={(v) => set("portOfDischarge", v)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <DateField label="Ngày đóng cont" value={form.loadingDate} onChange={(v) => set("loadingDate", v)} />
            <DateField label="ETD" value={form.etd} onChange={(v) => set("etd", v)} />
            <DateField label="ETA" value={form.eta} onChange={(v) => set("eta", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tàu / chuyến">
              <Input value={form.vesselVoyage} onChange={(e) => set("vesselVoyage", e.target.value)} />
            </Field>
            {form.kind !== "consolidated" && (
              <Field label={isTruck ? "Biển số xe" : "Số container"} hint={isTruck ? undefined : "11 ký tự: 4 chữ cái + 7 chữ số, VD SZLU2030326"}>
                <Input value={form.containerNo} onChange={(e) => set("containerNo", e.target.value)} />
              </Field>
            )}
            {isContainer && (
              <Field label="Số seal">
                <Input value={form.sealNo} onChange={(e) => set("sealNo", e.target.value)} />
              </Field>
            )}
          </div>
          {/* ba-spec 73 NV1: cont 1 = loại / số / seal ở trên; cont 2…n ở đây. */}
          {containersEnabled && isContainer && (
            <div className="grid min-w-0 gap-3 rounded-md border p-3" data-tour="shipment-extra-containers">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Cont thêm (cùng booking)</p>
                  <p className="text-sm text-muted-foreground">
                    {extras.length ? `Chuyến ${extras.length + 1} cont · cont 1 là Loại chuyến + Số container ở trên.` : "Booking có nhiều cont thì thêm cont 2, 3… Chuyến một cont để trống."}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={addExtra} title="Thêm một cont nữa vào chuyến (cùng booking, cùng bộ chứng từ).">
                  <Plus className="mr-1 h-4 w-4" aria-hidden />
                  Thêm cont
                </Button>
              </div>
              {extras.map((c, i) => (
                <div key={c.id} className="grid min-w-0 gap-3 border-t pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Cont {i + 2}</span>
                    <InlineConfirmDelete
                      recordDescription={`Cont ${i + 2}${c.containerNo ? ` · ${c.containerNo}` : ""}`}
                      title={`Bỏ cont ${i + 2} khỏi chuyến (còn dòng hàng gán cont này thì không bỏ được).`}
                      onConfirm={() => removeExtra(c, i + 2)}
                    />
                  </div>
                  <ChoiceGroup label="Loại cont" required value={c.kind} onChange={(v) => setExtra(c.id, { kind: v as ExportContainerKind })} options={CONTAINER_KIND_OPTIONS} columns={3} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Số container" hint="11 ký tự, gõ sau cũng được">
                      <Input value={c.containerNo} onChange={(e) => setExtra(c.id, { containerNo: e.target.value })} />
                    </Field>
                    <Field label="Số seal">
                      <Input value={c.sealNo} onChange={(e) => setExtra(c.id, { sealNo: e.target.value })} />
                    </Field>
                    <DateField label="Ngày đóng cont này" hint="Trống = theo ngày đóng của chuyến" value={c.loadingDate} onChange={(v) => setExtra(c.id, { loadingDate: v })} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <Field label="Ghi chú">
            <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
        </div>
      )}
      {optionPicker.dialogs}
    </FormDialog>
  );
}

/* ---------- Tạo lịch xuất hàng theo HĐ (NV19, ba-spec 41 §0d) ---------- */

export interface ScheduleTarget {
  contractId: string;
  contractNo: string;
  /** Lịch dựng sẵn theo R39 — người dùng sửa tháng / kg, thêm / bỏ chuyến. */
  rows: ScheduleRow[];
  totalKg: number;
  containerCount: number | null;
  deadline: string;
  /** Mở ngay sau khi lập HĐ mới ⇒ nút đóng là "Không tạo". */
  afterCreate: boolean;
}

interface ScheduleForm {
  key: string;
  contractId: string;
  contractNo: string;
  totalKg: number;
  containerCount: number | null;
  deadline: string;
  afterCreate: boolean;
  rows: ScheduleRowForm[];
  initial: string;
}
const scheduleSnap = (f: ScheduleForm) => JSON.stringify(f.rows.map(({ id: _id, ...r }) => r));

export type ScheduleRowForm = ScheduleRow & { id: string };

/** Bỏ khóa dòng trước khi ghi. */
export const scheduleRowsToSave = (rows: readonly ScheduleRowForm[]): ScheduleRow[] => rows.map(({ id: _id, ...r }) => r);

/**
 * Danh sách chuyến của lịch xuất hàng (NV19, ba-spec 41 R42 + R43) — dùng chung cho form Lập HĐ và hộp Tạo lịch
 * xuất hàng: tháng + kg kế hoạch, và tùy chọn Số booking · Ngày đóng cont · ETD · ETA (ô như Ghi chuyến). Gõ ngày
 * đóng / ETD thì tháng của chuyến đi theo ngày đó (R1).
 */
export function ScheduleRowsEditor({
  rows,
  onChange,
  totalKg,
  deadline,
}: {
  rows: readonly ScheduleRowForm[];
  onChange: (rows: ScheduleRowForm[]) => void;
  totalKg: number;
  deadline: string;
}) {
  const setRow = (id: string, patch: Partial<ScheduleRow>) =>
    onChange(
      rows.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        const dated = next.loadingDate || next.etd;
        return dated && ("loadingDate" in patch || "etd" in patch) ? { ...next, planMonth: dated.slice(0, 7) } : next;
      }),
    );
  const sumKg = Math.round(rows.reduce((t, r) => t + (r.plannedKg ?? 0), 0) * 100) / 100;
  const off = totalKg > 0 && Math.abs(sumKg - totalKg) >= 0.005;
  const hasShipmentInfo = rows.some((r) => r.bookingNo?.trim() || r.loadingDate || r.etd || r.eta);
  // grid-cols-[minmax(0,1fr)] ở MỌI khung lưới: thiếu nó cột tự giãn theo nội dung ⇒ ô tràn khỏi hộp ở 360px × 130%.
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
      {rows.map((r, i) => (
        <div key={r.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-border bg-card p-3">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Field label={`Chuyến ${i + 1} · tháng kế hoạch`} required>
              <Input type="month" value={r.planMonth} onChange={(e) => setRow(r.id, { planMonth: e.target.value })} aria-required />
            </Field>
            <NumberField label="Kg kế hoạch" unit="kg" value={r.plannedKg} onChange={(v) => setRow(r.id, { plannedKg: v })} />
            <Button variant="danger" size="sm" onClick={() => onChange(rows.filter((x) => x.id !== r.id))} title={`Bỏ chuyến ${i + 1} khỏi lịch.`}>
              <Trash2 className="mr-1 h-4 w-4" aria-hidden />
              Bỏ
            </Button>
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Số booking" hint="Trống = chờ booking">
              <Input value={r.bookingNo ?? ""} onChange={(e) => setRow(r.id, { bookingNo: e.target.value })} />
            </Field>
            <DateField label="Ngày đóng cont" value={r.loadingDate ?? ""} onChange={(v) => setRow(r.id, { loadingDate: v })} />
            <DateField label="ETD" value={r.etd ?? ""} onChange={(v) => setRow(r.id, { etd: v })} />
            <DateField label="ETA" value={r.eta ?? ""} onChange={(v) => setRow(r.id, { eta: v })} />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, { id: newId(), planMonth: rows.at(-1)?.planMonth ?? deadline.slice(0, 7), plannedKg: null }])}
          title="Thêm một chuyến dự kiến vào lịch."
        >
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          Thêm chuyến
        </Button>
        <span className={`tnum text-sm ${off ? "text-warning" : "text-muted-foreground"}`}>
          Tổng {formatNumber(sumKg)} kg{totalKg > 0 ? ` / hợp đồng ${formatNumber(totalKg)} kg` : ""}
          {off ? " — lệch hợp đồng, vẫn tạo được" : ""}
        </span>
      </div>
      {hasShipmentInfo && (
        <p className="text-sm text-muted-foreground">
          Chuyến đã có booking hoặc ngày thì không còn là chuyến trống: hợp đồng sẽ không sửa thẳng / xóa được nữa — sửa bằng Ghi bản sửa, bỏ bằng Hủy.
        </p>
      )}
    </div>
  );
}

export function ScheduleDialog({
  target,
  onClose,
  onSave,
}: {
  target: ScheduleTarget | null;
  onClose: () => void;
  onSave: (contractId: string, rows: ScheduleRow[]) => boolean;
}) {
  const [form, setForm] = useState<ScheduleForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const draft = useDialogDraft({ form: "export-schedule", value: form, setValue: setForm, isEmpty: (f) => scheduleSnap(f) === f.initial });

  useEffect(() => {
    if (!target) return;
    const f: ScheduleForm = {
      key: `schedule:${target.contractId}`,
      contractId: target.contractId,
      contractNo: target.contractNo,
      totalKg: target.totalKg,
      containerCount: target.containerCount,
      deadline: target.deadline,
      afterCreate: target.afterCreate,
      rows: target.rows.map((r) => ({ ...r, id: newId() })),
      initial: "",
    };
    const fresh = { ...f, initial: scheduleSnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);


  const close = () => {
    draft.cancel();
    onClose();
  };
  const save = () => {
    if (!form) return;
    const errs: FieldError[] = validateScheduleRows(form.rows).map((i) => ({ field: i.label, message: i.message }));
    setErrors(errs);
    if (errs.length) return;
    if (onSave(form.contractId, scheduleRowsToSave(form.rows))) draft.done();
  };

  const deadlineText = form?.deadline ? form.deadline.slice(0, 7).split("-").reverse().join("/") : "";
  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={`Tạo lịch xuất hàng · HĐ ${form?.contractNo ?? ""}`}
      description={
        form?.afterCreate
          ? "Đã lập hợp đồng. Tạo luôn các chuyến dự kiến để hợp đồng hiện trên lịch xuất hàng theo từng tháng? Chưa cần đủ hồ sơ — bước 1 của mỗi chuyến xong khi đính kèm đủ."
          : "Chia sẵn các chuyến dự kiến để hợp đồng hiện trên lịch xuất hàng theo từng tháng. Chưa cần đủ hồ sơ — bước 1 của mỗi chuyến xong khi đính kèm đủ."
      }
      icon={CalendarPlus}
      size="lg"
      hasRequiredFields
      footer={
        <>
          {form?.afterCreate ? (
            <Button variant="outline" onClick={close} title="Không tạo lịch lúc này — về sau vẫn tạo được ở hồ sơ hợp đồng khi chưa có chuyến nào.">
              Không tạo
            </Button>
          ) : (
            <Button variant="outline" onClick={close}>
              Hủy
            </Button>
          )}
          <Button variant="save" onClick={save} title="Ghi các chuyến dự kiến này lên lịch xuất hàng.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            Tạo {form?.rows.length ?? 0} chuyến
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          <p className="text-sm text-muted-foreground">
            Chia theo hợp đồng: {form.containerCount ? `${formatNumber(form.containerCount)} cont` : "không ghi số cont ⇒ 1 chuyến"}
            {form.totalKg > 0 ? ` · ${formatNumber(form.totalKg)} kg chia đều` : ""}
            {deadlineText ? ` · rải từ tháng sau ngày ký tới hạn giao ${deadlineText}` : ""}. Sửa tháng, kg từng chuyến nếu cần.
          </p>
          <ScheduleRowsEditor rows={form.rows} onChange={(rows) => setForm((f) => (f ? { ...f, rows } : f))} totalKg={form.totalKg} deadline={form.deadline} />
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Cập nhật một bước / một chứng từ (NV8) ---------- */

export interface StepItemTarget {
  shipment: ExportShipment;
  contractId: string;
  /** Mục có sẵn, hoặc mục mới (chưa lưu) cho bước / chứng từ thêm tay. */
  item: ExportStepItem;
  isNew: boolean;
}

interface StepItemForm {
  key: string;
  item: ExportStepItem;
  /** Chuyến + HĐ của mục — giữ trong form để nháp mở lại sau tải trang vẫn lưu được. */
  tg: StepItemTarget;
  initial: string;
}
const itemSnap = (i: ExportStepItem) => JSON.stringify(i);

/** Dòng invoice đã nối mặt hàng ⇒ trích xuất tên hàng của khách khi Lưu (R27). */
export interface InvoiceNameExtract {
  docNo: string;
  lines: Pick<ExportContractLine, "productId" | "description" | "size" | "packing" | "hsCode">[];
}

export function StepItemDialog({
  target,
  data,
  filesAvailable,
  recordedBy,
  canDelete,
  invoiceCatalog,
  documentKindSource,
  canViewPrice,
  customers,
  invoiceComposeEnabled,
  onClose,
  onSave,
  onRemoveFile,
  onDeleteItem,
  onPreview,
}: {
  target: StepItemTarget | null;
  data: ExportData;
  filesAvailable: boolean;
  recordedBy: string;
  canDelete: boolean;
  /** Danh mục cho khối Đọc invoice: nối dòng invoice với mặt hàng (luật 7 — tạo mới + bút chì). */
  invoiceCatalog: { products: Product[]; setProducts: (rows: Product[]) => boolean | void; customerNames: readonly CustomerProductName[] };
  /** Danh mục loại chứng từ (mig 0081) — ô Loại chứng từ thêm / sửa loại tại chỗ (luật 7). */
  documentKindSource: DocumentKindSource;
  canViewPrice: boolean;
  /** Khách của HĐ — tên + địa chỉ in trên invoice lập từ app. */
  customers: readonly Customer[];
  /** Máy chủ đã chạy 0096 + xem được giá ⇒ có khối Lập invoice từ app (ba-spec 63). */
  invoiceComposeEnabled: boolean;
  onClose: () => void;
  onSave: (item: ExportStepItem, newFiles: ExportFile[], isNew: boolean, extract?: InvoiceNameExtract) => boolean;
  onRemoveFile: (f: ExportFile) => void;
  onDeleteItem: (item: ExportStepItem) => void;
  onPreview: (f: PreviewTarget) => void;
}) {
  const [form, setForm] = useState<StepItemForm | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const [invoiceRead, setInvoiceRead] = useState<InvoiceReadState | null>(null);
  const draft = useDialogDraft({ form: "export-step-item", value: form, setValue: setForm, isEmpty: (f) => itemSnap(f.item) === f.initial });
  const kindPicker = useDocumentKindPicker(documentKindSource);

  useEffect(() => {
    if (!target) return;
    // Packing list lấy số + ngày theo Commercial Invoice của chuyến khi còn trống (Phòng KH 2026-11-04).
    const ci = target.item.docKind === "packing-list" ? documentItems(data, target.item.shipmentId).find((x) => x.docKind === "commercial-invoice") : undefined;
    const prefilled = ci ? { ...target.item, number: target.item.number || ci.number, issuedOn: target.item.issuedOn || ci.issuedOn } : target.item;
    const fresh: StepItemForm = { key: target.item.id, item: prefilled, tg: target, initial: itemSnap(target.item) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setFiles([]);
    setErrors([]);
    setInvoiceRead(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const item = form?.item;
  /** Đích của hộp: lúc mở bằng nút thì có `target`; mở lại từ nháp (tải trang) thì lấy trong form. */
  const tgt = target ?? form?.tg ?? null;
  const set = <K extends keyof ExportStepItem>(k: K, v: ExportStepItem[K]) => setForm((f) => (f ? { ...f, item: { ...f.item, [k]: v } } : f));
  const savedFiles = item ? data.files.filter((f) => f.stepItemId === item.id) : [];
  const candidates = useMemo(() => (tgt && item ? shareCandidates(data, tgt.shipment, item) : []), [data, tgt, item]);
  const shipLabel = (id: string) => {
    const s = data.shipments.find((x) => x.id === id);
    return s ? [s.lotCode && `lô ${s.lotCode}`, s.containerNo, s.bookingNo && `booking ${s.bookingNo}`].filter(Boolean).join(" · ") || "chuyến khác" : "chuyến khác";
  };

  const isDoc = item?.step === "document";
  const isInvoice = item?.docKind === "commercial-invoice";
  const isBl = item?.docKind === "bill-of-lading";
  const isPackingList = item?.docKind === "packing-list";
  const company = useCompanyProfileStore();
  const bankPicker = useExportOptionPicker();
  /** Tạo PDF Packing list theo invoice rồi đưa vào ô file (lưu khi chọn Lưu) — Phòng KH 2026-11-04. */
  const makePackingListFile = async () => {
    if (!item || !tgt) return;
    const ship = data.shipments.find((x) => x.id === item.shipmentId);
    const contract = data.contracts.find((c) => c.id === (ship?.contractId ?? tgt.contractId));
    const ci = documentItems(data, item.shipmentId).find((x) => x.docKind === "commercial-invoice");
    if (!ship || !contract || !ci) return;
    setBusy(true);
    try {
      const si = composedDocs.find((x) => x.docType === SHIPPING_INSTRUCTION_DOC && x.sourceId === ship.id) ?? null;
      const doc = invoiceDocumentFor(data, ship, contract, customers.find((c) => c.id === contract.customerId), ci, bankPicker.options, companySellerOf(company.profile), si);
      setFiles([await packingListPdfFile(doc, ci.number, company.profile.logoPath)]);
      if (item.state === "not-started") set("state", "done");
    } catch (e) {
      notify.error(`Không tạo được file Packing list: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  const [composedDocs] = useComposedDocuments();
  const packingRef = useMemo(() => {
    if (!isPackingList || !item) return null;
    const ci = documentItems(data, item.shipmentId).find((x) => x.docKind === "commercial-invoice");
    if (!ci) return null;
    const si = composedDocs.find((x) => x.docType === SHIPPING_INSTRUCTION_DOC && x.sourceId === item.shipmentId);
    const gross = si ? siTotals(siFromValues(si.values).goods).grossKg : 0;
    return { ci, grossKg: gross > 0 ? gross : null };
  }, [isPackingList, item, data, composedDocs]);
  const invoiceContract = isInvoice && tgt ? data.contracts.find((c) => c.id === tgt.contractId) : undefined;
  const title = item ? (isDoc ? requiredDocumentLabel({ kind: item.docKind, form: item.docForm, issuer: item.docIssuer }, data.documentKinds) : SUB_STEP_LABELS[item.step]) : "";

  const save = async () => {
    if (!form || !tgt || busy) return;
    const it = form.item;
    const errs: FieldError[] = [];
    if (it.state === "not-applicable" && !it.naReason.trim()) errs.push({ field: "Lý do không áp dụng", message: "Ghi lý do không áp dụng" });
    if (it.state === "done") {
      // Kiểm như khi file mới đã lên (tính cả file vừa chọn).
      const pending: ExportFile[] = files.map((f) => ({
        id: `pending-${f.name}`,
        contractId: tgt.contractId,
        shipmentId: it.shipmentId,
        stepItemId: it.id,
        step: it.step,
        path: "pending",
        fileName: f.name,
        layerNo: null,
        caption: "",
        uploadedBy: "",
        createdAt: "",
      }));
      const items = tgt.isNew ? [...data.items, it] : data.items.map((x) => (x.id === it.id ? it : x));
      const check = canMarkDone(it, { ...data, items, files: [...data.files, ...pending] }, { filesAvailable });
      if (!check.ok) {
        if (check.reason === "contract-not-approved") errs.push({ field: "Trạng thái", message: "Hợp đồng chưa có bản hiệu lực (mọi bản đã bị từ chối) — ghi bản sửa trước khi xong lệnh sản xuất (KH-R8)" });
        else if (check.reason === "lines-unmapped")
          errs.push({ field: "Dòng hàng", message: "Còn dòng hàng của hợp đồng chưa nối mặt hàng danh mục — bấm \"Nối mặt hàng\" ở khối Dòng hàng của hồ sơ HĐ" });
        else if (check.reason === "shared-source-not-done") errs.push({ field: "Dùng chung", message: "Mục được dùng chung chưa xong ở chuyến kia" });
        // 4a / 4b tự xong khi có file — chọn "Xong" mà không đính gì thì trước đây lưu lặng lẽ, mục vẫn "Chưa làm".
        else if (check.reason === "derived-from-files" && !files.length && !filesOfStep(data, it.shipmentId, it.step).length)
          errs.push({
            field: "Trạng thái",
            message: filesAvailable
              ? "Mục này tự xong khi đính file — chọn file ở dưới (hoặc dùng nút Đính ảnh / Đính file của chuyến)"
              : "Mục này tự xong khi đính file — đang chạy không nối máy chủ nên chưa đính được; chọn Không áp dụng kèm lý do",
          });
        else for (const m of check.missing) errs.push({ field: "Còn thiếu", message: `Chưa có ${MISSING_LABELS[m] ?? m}` });
      }
    }
    for (const f of files) {
      const e = checkExportFile(f);
      if (e) errs.push({ field: "File", message: e });
    }
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    let uploaded: { path: string; fileName: string }[] = [];
    try {
      if (files.length && hasExportStorage) uploaded = await uploadAll(files, tgt.contractId, "shipment", it.id);
      const rows: ExportFile[] = uploaded.map((u) => ({
        id: newId(),
        contractId: tgt.contractId,
        shipmentId: it.shipmentId,
        stepItemId: it.id,
        step: it.step,
        path: u.path,
        fileName: u.fileName,
        layerNo: null,
        caption: "",
        uploadedBy: recordedBy,
        createdAt: new Date().toISOString(),
      }));
      const clean: ExportStepItem = { ...it, naReason: it.state === "not-applicable" ? it.naReason.trim() : "", number: it.number.trim(), note: it.note.trim() };
      const inv = invoiceRead?.result?.ok ? invoiceRead.result.invoice : null;
      const extract: InvoiceNameExtract | undefined =
        inv && invoiceRead?.productIds.some(Boolean) ? { docNo: inv.invoiceNo || clean.number, lines: invoiceNameLines(inv.lines, invoiceRead.productIds) } : undefined;
      if (!onSave(clean, rows, tgt.isNew, extract)) {
        void removeExportFiles(uploaded.map((u) => u.path));
        return;
      }
      draft.done();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Không tải được file lên máy chủ");
    } finally {
      setBusy(false);
    }
  };

  const stateOptions = (["not-started", "in-progress", "done", "not-applicable"] as ExportItemState[]).map((v) => ({ value: v, label: ITEM_STATE_LABELS[v] }));

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o || busy) return;
        draft.dismiss();
        onClose();
      }}
      title={title}
      description="Đánh dấu Xong cần đủ bằng chứng (file, số, ngày). Không áp dụng thì ghi lý do."
      icon={ClipboardList}
      size={isInvoice ? "xl" : "lg"}
      hasRequiredFields
      footer={
        <>
          {/* Chứng từ khách yêu cầu (theo HĐ) không xóa được — chỉ đánh Không áp dụng kèm lý do (R5/R6, XK-07). */}
          {canDelete && tgt && !tgt.isNew && item?.step === "document" && !isRequiredDocumentItem(termsOf(data, tgt.contractId), item) && (
            <InlineConfirmDelete
              recordDescription={title}
              title="Bỏ chứng từ thêm tay này khỏi chuyến — hỏi lại trước, có Hoàn tác (file đã đính vẫn giữ trên máy chủ)."
              onConfirm={() => {
                if (!item) return;
                draft.cancel();
                onDeleteItem(item);
              }}
            />
          )}
          <Button
            variant="outline"
            onClick={() => {
              if (busy) return;
              draft.cancel();
              onClose();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={() => void save()} title="Lưu trạng thái và file của mục này.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {busy ? "Đang tải file…" : "Lưu"}
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && item && tgt && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          {isDoc && tgt.isNew && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Combobox
                label="Loại chứng từ"
                hideRequiredMark
                clearable={false}
                value={item.docKind}
                onChange={(v) => set("docKind", (v || "other") as ExportDocumentKind)}
                options={kindPicker.options}
                onCreate={kindPicker.onCreate}
                onEditItem={kindPicker.onEditItem}
                canEdit={kindPicker.canEdit}
                editLabel={kindPicker.editLabel}
              />
              <Field label="Form">
                <Input value={item.docForm} onChange={(e) => set("docForm", e.target.value)} />
              </Field>
              <Field label="Người cấp">
                <Input value={item.docIssuer} onChange={(e) => set("docIssuer", e.target.value)} />
              </Field>
            </div>
          )}
          {candidates.length > 0 && (
            <Combobox
              label="Dùng chung với chuyến khác"
              hint="Cont ghép / cùng lô: trỏ tới mục đã xong của chuyến kia, khỏi nộp lại."
              value={item.sharedFromId}
              onChange={(v) => set("sharedFromId", v)}
              options={candidates.map((c) => ({ value: c.id, label: `${shipLabel(c.shipmentId)}${c.number ? ` · số ${c.number}` : ""}` }))}
            />
          )}
          {item.sharedFromId ? (
            <p className="rounded-lg bg-muted px-4 py-2 text-sm">Mục này dùng chung — trạng thái theo mục của chuyến kia. Bỏ chọn ở trên để ghi riêng.</p>
          ) : (
            <>
              <ChoiceGroup label="Trạng thái" value={item.state} onChange={(v) => set("state", v as ExportItemState)} options={stateOptions} columns={4} />
              {item.state === "not-applicable" && (
                <Field label="Lý do không áp dụng" required>
                  <Input value={item.naReason} onChange={(e) => set("naReason", e.target.value)} aria-required />
                </Field>
              )}
              {(isDoc || item.step === "customs-declaration") && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={item.step === "customs-declaration" ? "Số tờ khai" : "Số chứng từ"}>
                    <Input value={item.number} onChange={(e) => set("number", e.target.value)} />
                  </Field>
                  <DateField label="Ngày" value={item.issuedOn} onChange={(v) => set("issuedOn", v)} />
                </div>
              )}
              {isPackingList && packingRef && (
                <p className="tnum rounded-lg bg-muted px-4 py-2 text-sm">
                  Theo Commercial Invoice{packingRef.ci.number ? ` số ${packingRef.ci.number}` : ""}
                  {packingRef.ci.cartons != null || packingRef.ci.netKg != null
                    ? `: ${packingRef.ci.cartons != null ? `${formatNumber(packingRef.ci.cartons)} kiện` : ""}${packingRef.ci.cartons != null && packingRef.ci.netKg != null ? " · " : ""}${packingRef.ci.netKg != null ? `${formatNumber(packingRef.ci.netKg)} kg tịnh` : ""}`
                    : " (chưa ghi tổng)"}
                  {" · "}
                  {packingRef.grossKg != null ? `gross ${formatNumber(packingRef.grossKg)} kg theo SI` : "chưa có SI — gross lấy theo kg cả bì của Hàng của chuyến"}. Số, ngày lấy theo invoice khi còn trống; file Packing list tải ở mục Commercial Invoice.
                </p>
              )}
              {isInvoice && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField label="Tổng thùng" unit="thùng" value={item.cartons} onChange={(v) => set("cartons", v)} />
                  <NumberField label="Tổng kg tịnh" value={item.netKg} onChange={(v) => set("netKg", v)} />
                  <NumberField label="Tổng tiền" unit="USD" value={item.amount} onChange={(v) => set("amount", v)} hint="Hàng mẫu (invoice M) ghi ở mục riêng — không cộng vào thực xuất." />
                </div>
              )}
              {isBl && <DateField label="Ngày on board" value={item.onBoardDate} onChange={(v) => set("onBoardDate", v)} hint="Ngày giao thực tế — dùng để tính trễ hạn." />}
              <Field label="Ghi chú" hint={item.step === "packaging" ? "VD: bao bì đã có sẵn, đợt in 7/7." : undefined}>
                <Textarea rows={2} value={item.note} onChange={(e) => set("note", e.target.value)} />
              </Field>
              <Field label="File">
                <div className="grid gap-3">
                  {savedFiles.length > 0 && (
                    <FileList files={savedFiles} onPreview={onPreview} caption={title} onRemove={onRemoveFile} />
                  )}
                  {isPackingList && packingRef && hasExportStorage && !files.length && (
                    <div className="grid gap-1">
                      <Button
                        className="h-auto min-h-9 max-w-full justify-self-start whitespace-normal"
                        onClick={() => void makePackingListFile()}
                        disabled={busy}
                        title="Tạo file PDF Packing list từ Hàng của chuyến + Commercial Invoice (gross theo SI) rồi đính vào mục này; chọn Xong rồi Lưu."
                      >
                        <FileText className="mr-2 h-4 w-4" aria-hidden />
                        {busy ? "Đang tạo file…" : "Tạo file Packing list từ invoice"}
                      </Button>
                      <span className="text-sm text-muted-foreground">Hoặc chọn file Packing list đã có ở dưới.</span>
                    </div>
                  )}
                  {hasExportStorage ? (
                    <FilePicker files={files} onChange={setFiles} />
                  ) : (
                    <p className="rounded-lg bg-warning-surface px-4 py-2 text-sm">Đang chạy không nối máy chủ: chưa lưu được file, ghi chú / số chứng từ được tính thay.</p>
                  )}
                </div>
              </Field>
              {isInvoice && invoiceContract && (
                <InvoiceReadPanel
                  pickedFiles={files}
                  savedFiles={savedFiles}
                  item={item}
                  onPatchItem={(patch) => setForm((f) => (f ? { ...f, item: { ...f.item, ...patch } } : f))}
                  state={invoiceRead}
                  onStateChange={setInvoiceRead}
                  contractLines={workingRevision(data, invoiceContract.id)?.lines ?? []}
                  customerId={invoiceContract.customerId}
                  customerNames={invoiceCatalog.customerNames}
                  products={invoiceCatalog.products}
                  setProducts={invoiceCatalog.setProducts}
                  canViewPrice={canViewPrice}
                  currency={termsOf(data, invoiceContract.id)?.currency || "USD"}
                  contractNo={invoiceContract.contractNo}
                  readOnlyPick={!hasExportStorage}
                />
              )}
              {isInvoice && invoiceContract && invoiceComposeEnabled && (
                <InvoiceComposePanel
                  data={data}
                  shipment={tgt.shipment}
                  contract={invoiceContract}
                  customer={customers.find((c) => c.id === invoiceContract.customerId)}
                  item={item}
                  onPatchItem={(patch) => setForm((f) => (f ? { ...f, item: { ...f.item, ...patch } } : f))}
                />
              )}
            </>
          )}
        </div>
      )}
      {kindPicker.dialog}
    </FormDialog>
  );
}

/* ---------- Đính ảnh / sơ đồ đóng cont (NV9 — người đóng hàng, điện thoại) ---------- */


/** Ảnh cont / seal (mig 0103, ba-spec 72 R8) — cùng khuôn với 2 loại ảnh thêm của bước 4. */
const CONTAINER_PHOTO_TEXT = {
  title: "Ảnh cont / seal",
  description: "Chụp số container, seal, cửa cont để đối chiếu số cont / seal. Không bắt buộc; chọn nhiều ảnh một lần được.",
  captionHint: "VD: seal SL001, cửa cont",
};

export interface LoadingUploadTarget {
  shipment: ExportShipment;
  contractId: string;
  /** "booking" = file booking của chuyến (ba-spec 60) — không gắn mục bước, không làm bước nào tự xong. */
  /** "loading-count-photos" · "package-weight-photos" (mig 0097) = ảnh thêm của bước 4 — file của chuyến, không làm bước nào tự xong. */
  step: Extract<ExportStep, "loading-plan" | "loading-photos"> | "booking" | ExportLoadingExtraStep | "container-seal-photos";
  label: string;
  /** Ảnh cont / seal của cont thêm (ba-spec 73 R6) — id cont thêm; trống = cont 1. */
  containerId?: string;
}

interface LoadingForm {
  key: string;
  /** Chuyến + bước — giữ trong form để nháp mở lại sau tải trang vẫn lưu được. */
  tg: LoadingUploadTarget;
  startLayer: number | null;
  caption: string;
  initial: string;
}
const loadSnap = (f: LoadingForm) => JSON.stringify([f.startLayer, f.caption]);

export function LoadingUploadDialog({
  target,
  recordedBy,
  onClose,
  onSave,
}: {
  target: LoadingUploadTarget | null;
  recordedBy: string;
  onClose: () => void;
  onSave: (rows: ExportFile[]) => boolean;
}) {
  const [form, setForm] = useState<LoadingForm | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = useDialogDraft({ form: "export-loading-upload", value: form, setValue: setForm, isEmpty: (f) => loadSnap(f) === f.initial });

  useEffect(() => {
    if (!target) return;
    const f: LoadingForm = { key: `${target.shipment.id}:${target.step}`, tg: target, startLayer: null, caption: "", initial: "" };
    const fresh = { ...f, initial: loadSnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setFiles([]);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  /** Đích của hộp: mở bằng nút thì có `target`; mở lại từ nháp (tải trang) thì lấy trong form. */
  const tgt = target ?? form?.tg ?? null;
  const isPhotos = tgt?.step === "loading-photos";
  const isBooking = tgt?.step === "booking";
  const extra =
    tgt && (tgt.step === "loading-count-photos" || tgt.step === "package-weight-photos")
      ? EXTRA_PHOTO_TEXT[tgt.step]
      : tgt?.step === "container-seal-photos"
        ? CONTAINER_PHOTO_TEXT
        : null;
  const isImage = isPhotos || !!extra;

  const save = async () => {
    if (!form || !tgt || busy) return;
    const errs: FieldError[] = [];
    if (!files.length) errs.push({ field: "File", message: isImage ? "Chọn hoặc chụp ít nhất một ảnh" : isBooking ? "Chọn file booking" : "Chọn file sơ đồ container" });
    if (!hasExportStorage) errs.push({ field: "Máy chủ", message: "Đang chạy không nối máy chủ — chưa tải ảnh lên được" });
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      // File booking chỉ người ghi Xuất khẩu đính ⇒ vùng "shipment" (như file chứng từ), không vùng "loading" của người đóng hàng.
      const up = await uploadAll(files, tgt.contractId, isBooking ? "shipment" : "loading", tgt.step);
      const rows: ExportFile[] = up.map((u, i) => ({
        id: newId(),
        contractId: tgt.contractId,
        shipmentId: tgt.shipment.id,
        stepItemId: "",
        step: tgt.step,
        path: u.path,
        fileName: u.fileName,
        layerNo: isPhotos && form.startLayer != null ? form.startLayer + i : null,
        caption: form.caption.trim(),
        uploadedBy: recordedBy,
        createdAt: new Date().toISOString(),
        ...(tgt.step === "container-seal-photos" && tgt.containerId ? { containerId: tgt.containerId } : {}),
      }));
      if (!onSave(rows)) {
        void removeExportFiles(up.map((u) => u.path));
        return;
      }
      draft.done();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Không tải được file lên máy chủ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o || busy) return;
        draft.dismiss();
        onClose();
      }}
      title={`${extra ? extra.title : isPhotos ? "Ảnh đóng cont" : isBooking ? "File booking" : "Sơ đồ container"} · ${tgt?.label ?? ""}`}
      description={
        extra
          ? extra.description
          : isPhotos
          ? "Chụp từng lớp hàng (có tờ giấy ghi lớp / số thùng), ảnh seal và ảnh số cont. Chọn nhiều ảnh một lần được."
          : isBooking
            ? "Đính bản xác nhận booking của hãng tàu (PDF / ảnh / Word). Booking sửa đổi thì đính thêm — bản mới nhất hiện đầu."
            : "Đính file sơ đồ xếp hàng (Excel / PDF / ảnh)."
      }
      icon={isImage ? Camera : ClipboardList}
      size="md"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              if (busy) return;
              draft.cancel();
              onClose();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={() => void save()} title="Tải các file đã chọn lên chuyến này.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {busy ? `Đang tải ${files.length} file…` : `Lưu ${files.length || ""} file`}
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          <FilePicker files={files} onChange={setFiles} accept={isImage ? "image/*" : undefined} label={isImage ? "Chụp / chọn ảnh" : "Chọn file"} />
          {isPhotos && (
            <NumberField
              label="Đánh số lớp từ"
              unit=""
              value={form.startLayer}
              onChange={(v) => setForm((f) => (f ? { ...f, startLayer: v } : f))}
              hint="Chọn ảnh theo thứ tự lớp 1 → 25 thì ghi 1; ảnh seal / số cont để trống."
            />
          )}
          <Field label="Chú thích" hint={extra ? extra.captionHint : isPhotos ? "VD: ảnh seal, cửa cont" : undefined}>
            <Input value={form.caption} onChange={(e) => setForm((f) => (f ? { ...f, caption: e.target.value } : f))} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Gộp chuyến thành cont thêm (ba-spec 73 NV6, R13) ---------- */

export interface MergeShipmentTarget {
  from: ExportShipment;
  fromLabel: string;
  /** Chuyến nhận (cùng HĐ, gộp được) — nhãn để chọn. */
  candidates: { shipment: ExportShipment; label: string }[];
}

/** Chọn chuyến nhận rồi gộp: chuyến này thành cont thêm cuối của chuyến nhận, hàng đi theo. Không ghi nháp — chỉ một lựa chọn. */
export function MergeShipmentDialog({ target, onClose, onConfirm }: { target: MergeShipmentTarget | null; onClose: () => void; onConfirm: (into: ExportShipment) => void }) {
  const [pick, setPick] = useState("");
  useEffect(() => setPick(target?.candidates[0]?.shipment.id ?? ""), [target]);
  const chosen = target?.candidates.find((c) => c.shipment.id === pick);
  return (
    <FormDialog
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title="Gộp làm cont thêm"
      description={target ? `${target.fromLabel} thành một cont của chuyến khác cùng hợp đồng: loại, số, seal, ngày đóng và hàng của chuyến này chuyển sang; chuyến này không còn. Hoàn tác được ngay sau khi gộp.` : ""}
      icon={Container}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => chosen && onConfirm(chosen.shipment)} title="Gộp chuyến này vào chuyến đã chọn làm cont thêm.">
            <Container className="mr-2 h-4 w-4" aria-hidden />
            Gộp
          </Button>
        </>
      }
    >
      {target && (
        <div className="grid gap-3 py-2">
          <ChoiceGroup
            label="Gộp vào chuyến"
            required
            value={pick}
            onChange={setPick}
            options={target.candidates.map((c) => ({ value: c.shipment.id, label: c.label }))}
            columns={2}
          />
        </div>
      )}
    </FormDialog>
  );
}
