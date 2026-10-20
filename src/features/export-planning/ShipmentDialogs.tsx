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
  notify,
  type FieldError,
} from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import {
  DOCUMENT_KINDS,
  ITEM_STATE_LABELS,
  MISSING_LABELS,
  SHIPMENT_KINDS,
  SUB_STEP_LABELS,
  canMarkDone,
  filesOfStep,
  isContainerKind,
  isRequiredDocumentItem,
  termsOf,
  requiredDocumentLabel,
  shareCandidates,
  validateShipment,
  type ExportData,
} from "@/lib/exportPlanning";
import { checkExportFile, exportFilePath, hasExportStorage, removeExportFiles, uploadExportFile } from "@/lib/exportFileStorage";
import type { ExportDocumentKind, ExportFile, ExportItemState, ExportShipment, ExportShipmentKind, ExportStep, ExportStepItem } from "@/types";
import { Camera, ClipboardList, Container, Save } from "lucide-react";
import { FileChips, FilePicker, type PreviewTarget } from "./parts";

/** Tải nhiều file lên (theo thứ tự); lỗi giữa chừng ⇒ gỡ các file đã lên rồi báo. */
async function uploadAll(files: File[], contractId: string, area: "shipment" | "loading", prefix: string): Promise<{ path: string; fileName: string }[]> {
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
}

interface ShipmentForm extends Omit<ExportShipment, "createdAt" | "status" | "cancelReason"> {
  key: string;
  contractNo: string;
  /** Chuyến có sẵn (sửa) ⇒ giữ trạng thái + ngày tạo; null = lên chuyến mới. Nằm TRONG form để nháp mở lại sau tải trang vẫn lưu đúng. */
  existingMeta: Pick<ExportShipment, "status" | "cancelReason" | "createdAt"> | null;
  initial: string;
}
const shipSnap = (f: ShipmentForm) =>
  JSON.stringify([f.planMonth, f.kind, f.goodsSummary, f.plannedKg, f.lotCode, f.portOfDischarge, f.bookingNo, f.loadingDate, f.etd, f.eta, f.vesselVoyage, f.containerNo, f.sealNo, f.note]);

export function ShipmentFormDialog({
  target,
  onClose,
  onSave,
}: {
  target: ShipmentTarget | null;
  onClose: () => void;
  onSave: (s: ExportShipment, isNew: boolean) => boolean;
}) {
  const [form, setForm] = useState<ShipmentForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
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
      initial: "",
    };
    const fresh = { ...f, initial: shipSnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const set = <K extends keyof ShipmentForm>(k: K, v: ShipmentForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = () => {
    // Không đòi `target`: hộp mở lại từ nháp sau tải trang thì target rỗng, mọi thứ cần đã nằm trong form.
    if (!form) return;
    const errs = validateShipment(form).map((i) => ({ field: i.label, message: i.message }));
    // Nháp cũ (trước khi form mang existingMeta) không biết là sửa hay lên mới ⇒ không đoán, bắt mở lại.
    if (form.existingMeta === undefined) errs.push({ field: "Nháp cũ", message: "Bấm Bỏ bản nháp rồi mở lại chuyến để sửa" });
    setErrors(errs);
    if (errs.length) return;
    const e = form.existingMeta;
    const { key: _key, contractNo: _no, initial: _initial, existingMeta: _meta, ...rest } = form;
    const ok = onSave(
      {
        ...rest,
        goodsSummary: form.goodsSummary.trim(),
        lotCode: form.lotCode.trim(),
        bookingNo: form.bookingNo.trim(),
        containerNo: form.containerNo.trim().toUpperCase(),
        sealNo: form.sealNo.trim().toUpperCase(),
        note: form.note.trim(),
        status: e?.status ?? "open",
        cancelReason: e?.cancelReason ?? "",
        createdAt: e?.createdAt ?? new Date().toISOString(),
      },
      !e,
    );
    if (ok) draft.done();
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
      title={(form ? form.existingMeta : target?.existing) ? `Sửa chuyến · HĐ ${form?.contractNo ?? ""}` : `Lên chuyến · HĐ ${form?.contractNo ?? ""}`}
      description="Một chuyến là một container. Chuyến hiện ở tháng của ngày đóng cont; chưa có thì theo ETD, rồi tới tháng kế hoạch."
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
          <Button variant="save" onClick={save} title="Lưu chuyến này.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            Lưu chuyến
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
            <Field label="Số booking" hint="Trống = chờ booking">
              <Input value={form.bookingNo} onChange={(e) => set("bookingNo", e.target.value)} />
            </Field>
            <Field label="Cảng đến">
              <Input value={form.portOfDischarge} onChange={(e) => set("portOfDischarge", e.target.value)} />
            </Field>
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
              <Field label={isTruck ? "Biển số xe" : "Số container"} hint={isTruck ? undefined : "VD: SZLU9522312"}>
                <Input value={form.containerNo} onChange={(e) => set("containerNo", e.target.value)} />
              </Field>
            )}
            {isContainer && (
              <Field label="Số seal">
                <Input value={form.sealNo} onChange={(e) => set("sealNo", e.target.value)} />
              </Field>
            )}
          </div>
          <Field label="Ghi chú">
            <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
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

export function StepItemDialog({
  target,
  data,
  filesAvailable,
  recordedBy,
  canDelete,
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
  onClose: () => void;
  onSave: (item: ExportStepItem, newFiles: ExportFile[], isNew: boolean) => boolean;
  onRemoveFile: (f: ExportFile) => void;
  onDeleteItem: (item: ExportStepItem) => void;
  onPreview: (f: PreviewTarget) => void;
}) {
  const [form, setForm] = useState<StepItemForm | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = useDialogDraft({ form: "export-step-item", value: form, setValue: setForm, isEmpty: (f) => itemSnap(f.item) === f.initial });

  useEffect(() => {
    if (!target) return;
    const fresh: StepItemForm = { key: target.item.id, item: target.item, tg: target, initial: itemSnap(target.item) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setFiles([]);
    setErrors([]);
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
  const title = item ? (isDoc ? requiredDocumentLabel({ kind: item.docKind, form: item.docForm, issuer: item.docIssuer }) : SUB_STEP_LABELS[item.step]) : "";

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
        if (check.reason === "contract-not-approved") errs.push({ field: "Trạng thái", message: "Hợp đồng chưa có bản BGĐ đồng ý — lệnh sản xuất chỉ xong sau khi duyệt (KH-R8)" });
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
      if (!onSave(clean, rows, tgt.isNew)) {
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
      size="lg"
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
                options={DOCUMENT_KINDS.map((k) => ({ value: k.value, label: k.label }))}
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
                    <div className="grid gap-2">
                      <FileChips files={savedFiles} onPreview={onPreview} caption={title} />
                      <div className="flex flex-wrap gap-2">
                        {savedFiles.map((f) => (
                          <Button key={f.id} size="sm" variant="ghost" onClick={() => onRemoveFile(f)} title={`Gỡ file "${f.fileName}" khỏi mục này (có Hoàn tác).`}>
                            Gỡ {f.fileName}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasExportStorage ? (
                    <FilePicker files={files} onChange={setFiles} />
                  ) : (
                    <p className="rounded-lg bg-warning-surface px-4 py-2 text-sm">Đang chạy không nối máy chủ: chưa lưu được file, ghi chú / số chứng từ được tính thay.</p>
                  )}
                </div>
              </Field>
            </>
          )}
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Đính ảnh / sơ đồ đóng cont (NV9 — người đóng hàng, điện thoại) ---------- */

export interface LoadingUploadTarget {
  shipment: ExportShipment;
  contractId: string;
  step: Extract<ExportStep, "loading-plan" | "loading-photos">;
  label: string;
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

  const save = async () => {
    if (!form || !tgt || busy) return;
    const errs: FieldError[] = [];
    if (!files.length) errs.push({ field: "File", message: isPhotos ? "Chọn hoặc chụp ít nhất một ảnh" : "Chọn file sơ đồ container" });
    if (!hasExportStorage) errs.push({ field: "Máy chủ", message: "Đang chạy không nối máy chủ — chưa tải ảnh lên được" });
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      const up = await uploadAll(files, tgt.contractId, "loading", tgt.step);
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
      title={`${isPhotos ? "Ảnh đóng cont" : "Sơ đồ container"} · ${tgt?.label ?? ""}`}
      description={isPhotos ? "Chụp từng lớp hàng (có tờ giấy ghi lớp / số thùng), ảnh seal và ảnh số cont. Chọn nhiều ảnh một lần được." : "Đính file sơ đồ xếp hàng (Excel / PDF / ảnh)."}
      icon={isPhotos ? Camera : ClipboardList}
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
          <FilePicker files={files} onChange={setFiles} accept={isPhotos ? "image/*" : undefined} label={isPhotos ? "Chụp / chọn ảnh" : "Chọn file"} />
          {isPhotos && (
            <NumberField
              label="Đánh số lớp từ"
              unit=""
              value={form.startLayer}
              onChange={(v) => setForm((f) => (f ? { ...f, startLayer: v } : f))}
              hint="Chọn ảnh theo thứ tự lớp 1 → 25 thì ghi 1; ảnh seal / số cont để trống."
            />
          )}
          <Field label="Chú thích" hint={isPhotos ? "VD: ảnh seal, cửa cont" : undefined}>
            <Input value={form.caption} onChange={(e) => setForm((f) => (f ? { ...f, caption: e.target.value } : f))} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}
