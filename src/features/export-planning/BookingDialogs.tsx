// ============================================================
// Tên file: src/features/export-planning/BookingDialogs.tsx
// Tên tiếng Việt: Hộp Cập nhật booking (đọc file booking) + hộp Ghi thông tin xe vận chuyển
// Description: ba-spec 71 NV2 + NV4 — booking dialog reads a carrier PDF into 10 fields for review
//              before saving; transport dialog enforces 4 required fields. Neither changes progress.
// ============================================================
import { useEffect, useState } from "react";
import { Button, ChoiceGroup, Combobox, DateField, ErrorSummary, Field, FormDialog, FormSection, Input, Tag, notify, type FieldError } from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { isReadableBookingFile, readBookingFile, type BookingReadResult } from "@/lib/bookingReader";
import {
  BOOKING_FIELD_LIST,
  EMPTY_BOOKING_DETAILS,
  EMPTY_TRANSPORT_INFO,
  BOOKING_LABELS,
  TRANSPORT_LABELS,
  TRANSPORT_REQUIRED,
  applyBookingRead,
  bookingFormOf,
  prefillTransport,
  shipmentWithBooking,
  transportMissing,
  type BookingForm,
  type BookingFormField,
} from "@/lib/exportBooking";
import { downloadExportFile, removeExportFiles } from "@/lib/exportFileStorage";
import { matchOptionLoose } from "@/lib/exportOptions";
import { SHIPMENT_KINDS } from "@/lib/exportPlanning";
import { formatDateTimeVN } from "@/lib/format";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import type { ExportFile, ExportShipment, ExportShipmentKind, ExportTransportInfo } from "@/types";
import { FileSearch, Save, Ship, Truck } from "lucide-react";
import { useExportOptionPicker } from "./exportOptionPicker";
import { FilePicker } from "./parts";
import { uploadAll } from "./ShipmentDialogs";

/* ---------- Cập nhật booking (NV2) ---------- */

export interface BookingTarget {
  shipment: ExportShipment;
  /** File booking đã đính (mới nhất đầu) — đọc lại được. Rỗng với người không xem được file. */
  files: readonly ExportFile[];
  label: string;
}

interface BookingDraft {
  key: string;
  form: BookingForm;
  /** Đại lý lấy từ file khi chuyến chưa có (R4) — "" = giữ đại lý của chuyến. */
  forwarderFromFile: string;
  filled: BookingFormField[];
  initial: string;
}

const bookingSnap = (d: BookingDraft) => JSON.stringify([d.form, d.forwarderFromFile]);

/** Ô ngày + giờ của hạn booking ("yyyy-mm-ddThh:mm"). Giờ gõ hh:mm, trống ⇒ 00:00. */
function CutoffField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const [date, time] = value ? [value.slice(0, 10), value.slice(11, 16)] : ["", ""];
  // Đang gõ giờ ⇒ giữ chữ đang gõ; rời ô ⇒ chuẩn hóa "7" / "7h30" / "0730" thành hh:mm (gõ sai ⇒ giữ giờ cũ).
  const [editing, setEditing] = useState<string | null>(null);
  const commitTime = (t: string) => {
    const m = t.trim().match(/^(\d{1,2})[:hH.]?(\d{2})?$/);
    const hm = m && Number(m[1]) < 24 && Number(m[2] ?? 0) < 60 ? `${m[1].padStart(2, "0")}:${m[2] ?? "00"}` : "";
    setEditing(null);
    if (date && hm) onChange(`${date}T${hm}`);
  };
  return (
    <DateField
      label={label}
      hint={hint}
      clearable
      value={date}
      onChange={(d) => onChange(d ? `${d}T${time || "00:00"}` : "")}
      adornEnd={
        <Input
          aria-label={`Giờ ${label}`}
          title={`Giờ ${label} (hh:mm)`}
          className="w-20 tnum"
          inputMode="numeric"
          value={editing ?? time}
          disabled={!date}
          onChange={(e) => setEditing(e.target.value)}
          onBlur={(e) => commitTime(e.target.value)}
        />
      }
    />
  );
}

export function BookingDialog({
  target,
  onClose,
  onSave,
  recordedBy,
  filesEnabled,
}: {
  target: BookingTarget | null;
  onClose: () => void;
  /** `files`: file booking vừa tải lên — lưu hỏng thì màn tự gỡ file đã tải. */
  onSave: (s: ExportShipment, files: ExportFile[], readFrom: string) => boolean;
  recordedBy: string;
  /** Máy chủ đã chạy 0094 + có kho file ⇒ đính / đọc file booking được. */
  filesEnabled: boolean;
}) {
  const [draftValue, setDraftValue] = useState<BookingDraft | null>(null);
  const picker = useExportOptionPicker();
  const [files, setFiles] = useState<File[]>([]);
  const [reading, setReading] = useState("");
  const [result, setResult] = useState<{ fileName: string; r: BookingReadResult; warnings: string[] } | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = useDialogDraft({ form: "export-booking", value: draftValue, setValue: setDraftValue, isEmpty: (d) => bookingSnap(d) === d.initial });

  useEffect(() => {
    if (!target) return;
    const s = target.shipment;
    const fresh: BookingDraft = { key: s.id, form: bookingFormOf(s, s.booking ?? EMPTY_BOOKING_DETAILS), forwarderFromFile: "", filled: [], initial: "" };
    fresh.initial = bookingSnap(fresh);
    const kept = draft.takeKept();
    setDraftValue(kept && kept.key === fresh.key ? kept : fresh);
    setFiles([]);
    setResult(null);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const shipment = target?.shipment;
  const booking = shipment?.booking ?? EMPTY_BOOKING_DETAILS;
  const set = <K extends keyof BookingForm>(k: K, v: BookingForm[K]) => setDraftValue((d) => (d ? { ...d, form: { ...d.form, [k]: v } } : d));

  const runRead = async (fileName: string, load: () => Promise<Blob | null>) => {
    if (!shipment || !draftValue) return;
    setReading(fileName);
    const blob = await load();
    const r: BookingReadResult = blob ? await readBookingFile(blob, fileName) : { ok: false, message: "Không tải được file từ máy chủ." };
    setReading("");
    if (!r.ok) {
      setResult({ fileName, r, warnings: [] });
      return;
    }
    const a = applyBookingRead(
      draftValue.form,
      { bookingNo: shipment.bookingNo, forwarder: booking.forwarder },
      r.read,
      r.found,
      (list, text) => matchOptionLoose(text, picker.options, list),
    );
    setDraftValue((d) => (d ? { ...d, form: a.form, filled: a.filled, forwarderFromFile: a.forwarder } : d));
    setResult({ fileName, r, warnings: a.warnings });
  };

  const pickFiles = (next: File[]) => {
    setFiles(next);
    const pdf = next.find((f) => isReadableBookingFile(f.name));
    if (pdf) void runRead(pdf.name, async () => pdf);
  };

  const save = async () => {
    if (busy || !draftValue || !shipment) return;
    const errs: FieldError[] = [];
    for (const k of ["docCutoff", "vgmCutoff", "cargoCutoff"] as const) {
      const v = draftValue.form[k];
      if (v && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) errs.push({ field: BOOKING_LABELS[k], message: "Giờ ghi dạng hh:mm, VD 10:00" });
    }
    setErrors(errs);
    if (errs.length) return;
    let uploaded: { path: string; fileName: string }[] = [];
    if (files.length && filesEnabled) {
      setBusy(true);
      try {
        uploaded = await uploadAll(files, shipment.contractId, "shipment", "booking");
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Không tải được file booking lên máy chủ");
        setBusy(false);
        return;
      }
    }
    const now = new Date().toISOString();
    const rows: ExportFile[] = uploaded.map((u) => ({
      id: newId(),
      contractId: shipment.contractId,
      shipmentId: shipment.id,
      stepItemId: "",
      step: "booking",
      path: u.path,
      fileName: u.fileName,
      layerNo: null,
      caption: "",
      uploadedBy: recordedBy,
      createdAt: now,
    }));
    const b = draftValue.forwarderFromFile && !booking.forwarder ? { ...booking, forwarder: draftValue.forwarderFromFile } : booking;
    const ok = onSave(shipmentWithBooking(shipment, b, draftValue.form), rows, result?.r.ok ? result.fileName : "");
    setBusy(false);
    if (!ok) {
      void removeExportFiles(uploaded.map((u) => u.path));
      return;
    }
    draft.done();
  };

  const filled = new Set(draftValue?.filled ?? []);
  const fromFile = (k: BookingFormField) => (filled.has(k) ? "Lấy từ file booking — soát lại" : undefined);
  const place = (k: Exclude<keyof typeof BOOKING_FIELD_LIST, "emptyPickupYard">) => {
    const list = BOOKING_FIELD_LIST[k]!;
    return (
      <Combobox
        label={BOOKING_LABELS[k]}
        hideRequiredMark
        hint={fromFile(k)}
        {...picker.fieldProps(list, draftValue?.form[k] ?? "")}
        onChange={(v) => set(k, v)}
      />
    );
  };

  return (
    <FormDialog
      open={!!draftValue}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={`Cập nhật booking${target ? ` · ${target.label}` : ""}`}
      description="Chọn file booking của hãng tàu — app đọc ra các ô bên dưới. Soát lại rồi Lưu; ô file để trống giữ giá trị cũ."
      icon={Ship}
      size="lg"
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
          <Button variant="save" onClick={() => void save()} title="Lưu thông tin booking (kèm file booking đã chọn).">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {busy ? `Đang tải ${files.length} file…` : "Lưu booking"}
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {draftValue && shipment && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          <FormSection title="File booking" hint="PDF của hãng tàu (có chữ, không phải bản scan). Booking sửa đổi thì chọn file mới — bản cũ vẫn giữ.">
            <div data-tour="booking-read" className="grid gap-3">
              <FilePicker files={files} onChange={pickFiles} label="Chọn file booking" />
              {!filesEnabled && files.length > 0 && <p className="text-sm text-muted-foreground">Chưa có kho file: file chỉ để đọc, không lưu kèm chuyến.</p>}
              {target.files.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Đọc lại file đã đính:</span>
                  {target.files.slice(0, 3).map((f) => (
                    <Button
                      key={f.id}
                      size="sm"
                      variant="outline"
                      disabled={!!reading || !isReadableBookingFile(f.fileName)}
                      onClick={() => void runRead(f.fileName, () => downloadExportFile(f.path))}
                      title={`Đọc lại ${f.fileName} (đính ${formatDateTimeVN(f.createdAt)}) vào các ô bên dưới.`}
                    >
                      <FileSearch className="mr-1 h-4 w-4" aria-hidden />
                      {f.fileName}
                    </Button>
                  ))}
                </div>
              )}
              {reading && <p className="text-sm text-muted-foreground">Đang đọc {reading}…</p>}
              {result && (
                <div className="grid gap-1 text-sm" role="status">
                  {result.r.ok ? (
                    <p className="flex flex-wrap items-center gap-2">
                      <Tag variant="done">Đã đọc</Tag>
                      {result.fileName} — điền {draftValue.filled.filter((f) => f !== "emptyPickupYard").length} ô{draftValue.forwarderFromFile ? ` + đại lý ${draftValue.forwarderFromFile}` : ""}. Ô ghi "Lấy từ file booking" là ô vừa điền.
                    </p>
                  ) : (
                    <p className="flex flex-wrap items-center gap-2">
                      <Tag variant="warning">Không đọc được</Tag>
                      {result.fileName}: {result.r.message}
                    </p>
                  )}
                  {result.warnings.map((w) => (
                    <p key={w} className="text-warning">
                      ⚠ {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </FormSection>
          <FormSection title="Thông tin booking" hint="Số booking và đại lý sửa ở Sửa chuyến.">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">{BOOKING_LABELS.bookingNo}</dt>
                <dd className="font-medium">{shipment.bookingNo || "—"}</dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">{BOOKING_LABELS.forwarder}</dt>
                <dd className="font-medium">{booking.forwarder || draftValue.forwarderFromFile || "—"}</dd>
              </div>
            </dl>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={BOOKING_LABELS.vesselVoyage} hint={fromFile("vesselVoyage")}>
                <Input value={draftValue.form.vesselVoyage} onChange={(e) => set("vesselVoyage", e.target.value)} />
              </Field>
              {place("placeOfReceipt")}
              {place("portOfLoading")}
              {place("portOfDischarge")}
              {place("placeOfDelivery")}
              {place("returnYard")}
            </div>
            <ChoiceGroup
              label={BOOKING_LABELS.kind}
              hint={fromFile("kind")}
              value={draftValue.form.kind}
              onChange={(v) => set("kind", v as ExportShipmentKind)}
              options={SHIPMENT_KINDS}
              columns={3}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <CutoffField label={BOOKING_LABELS.docCutoff} hint={fromFile("docCutoff")} value={draftValue.form.docCutoff} onChange={(v) => set("docCutoff", v)} />
              <CutoffField label={BOOKING_LABELS.vgmCutoff} hint={fromFile("vgmCutoff")} value={draftValue.form.vgmCutoff} onChange={(v) => set("vgmCutoff", v)} />
              <CutoffField label={BOOKING_LABELS.cargoCutoff} hint={fromFile("cargoCutoff") ?? "Port Cargo Cut-off"} value={draftValue.form.cargoCutoff} onChange={(v) => set("cargoCutoff", v)} />
            </div>
          </FormSection>
        </div>
      )}
      {picker.dialogs}
    </FormDialog>
  );
}

/* ---------- Thông tin xe vận chuyển (NV4) ---------- */

export interface TransportTarget {
  shipment: ExportShipment;
  label: string;
}

interface TransportDraft {
  key: string;
  info: ExportTransportInfo;
  initial: string;
}

export function TransportDialog({ target, onClose, onSave }: { target: TransportTarget | null; onClose: () => void; onSave: (s: ExportShipment) => boolean }) {
  const [value, setValue] = useState<TransportDraft | null>(null);
  const picker = useExportOptionPicker();
  const [errors, setErrors] = useState<FieldError[]>([]);
  const draft = useDialogDraft({ form: "export-transport", value, setValue, isEmpty: (d) => JSON.stringify(d.info) === d.initial });

  useEffect(() => {
    if (!target) return;
    const s = target.shipment;
    const info = prefillTransport(s.transport ?? EMPTY_TRANSPORT_INFO, s.booking);
    const fresh: TransportDraft = { key: s.id, info, initial: JSON.stringify(info) };
    const kept = draft.takeKept();
    setValue(kept && kept.key === fresh.key ? kept : fresh);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const set = (k: keyof ExportTransportInfo, v: string) => setValue((d) => (d ? { ...d, info: { ...d.info, [k]: v } } : d));
  const missing = new Set(errors.length && value ? transportMissing(value.info) : []);
  const err = (k: keyof ExportTransportInfo) => (missing.has(k) ? "Bắt buộc" : undefined);

  const save = () => {
    if (!value || !target) return;
    const info = Object.fromEntries(Object.entries(value.info).map(([k, v]) => [k, v.trim()])) as unknown as ExportTransportInfo;
    const miss = transportMissing(info);
    setErrors(miss.map((k) => ({ field: TRANSPORT_LABELS[k], message: "Bắt buộc" })));
    if (miss.length) return;
    const s = target.shipment;
    if (!onSave({ ...s, booking: s.booking ?? EMPTY_BOOKING_DETAILS, transport: info })) return;
    draft.done();
  };

  const place = (k: "haulier" | "emptyPickupPlace" | "stuffingPlace" | "returnYard", list: "haulier" | "container-yard" | "stuffing-place", hint?: string) => (
    <Combobox
      label={TRANSPORT_LABELS[k]}
      required={TRANSPORT_REQUIRED.includes(k)}
      hint={hint}
      error={err(k)}
      {...picker.fieldProps(list, value?.info[k] ?? "")}
      onChange={(v) => set(k, v)}
    />
  );

  return (
    <FormDialog
      open={!!value}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={`Thông tin xe vận chuyển${target ? ` · ${target.label}` : ""}`}
      description="Xe kéo container của chuyến. Bốn ô bắt buộc; cụm tài xế ghi khi biết. Không làm bước Đóng cont tự xong."
      icon={Truck}
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
          <Button variant="save" onClick={save} title="Lưu thông tin xe vận chuyển của chuyến.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            Lưu thông tin xe
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {value && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          {place("haulier", "haulier")}
          <FormSection title="Tài xế" hint="Không bắt buộc.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={TRANSPORT_LABELS.driverName}>
                <Input value={value.info.driverName} onChange={(e) => set("driverName", e.target.value)} />
              </Field>
              <Field label={TRANSPORT_LABELS.driverPhone}>
                <Input inputMode="tel" value={value.info.driverPhone} onChange={(e) => set("driverPhone", e.target.value)} />
              </Field>
              <Field label={TRANSPORT_LABELS.driverIdNo} hint="Căn cước công dân, 12 số">
                <Input inputMode="numeric" value={value.info.driverIdNo} onChange={(e) => set("driverIdNo", e.target.value)} />
              </Field>
              <Field label={TRANSPORT_LABELS.truckPlate} hint="VD 72C-123.45">
                <Input value={value.info.truckPlate} onChange={(e) => set("truckPlate", e.target.value.toUpperCase())} />
              </Field>
            </div>
          </FormSection>
          <div className="grid gap-4 sm:grid-cols-3">
            {place("emptyPickupPlace", "container-yard", target?.shipment.booking?.emptyPickupYard ? "Mặc định theo bãi lấy rỗng của booking" : undefined)}
            {place("stuffingPlace", "stuffing-place")}
            {place("returnYard", "container-yard", target?.shipment.booking?.returnYard ? "Mặc định theo Nơi hạ bãi của booking" : undefined)}
          </div>
        </div>
      )}
      {picker.dialogs}
    </FormDialog>
  );
}
