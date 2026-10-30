// ============================================================
// Tên file: src/features/imports/supplierInvoiceParts.tsx
// Tên tiếng Việt: Hộp "Giữ số xưởng" (bắt lý do) + hộp "Tạo chuyến từ HĐ" của tab Hóa đơn
// Description: Dialogs for ba-spec 51 NV4/NV5 (design-spec 52 §2). The reason box keeps a draft
//              (rule 17 — useDialogDraft); the trip box is a single choice (workshop) with a preview.
// ============================================================
import { useState } from "react";
import { Button, Combobox, ErrorSummary, Field, FormDialog, Textarea, type FieldError } from "@/design-system";
import type { Workshop } from "@/types";
import { useDialogDraft } from "@/lib/formDraft";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { formatDateVN, num } from "@/lib/format";
import { WORKSHOPS } from "./importHelpers";

export interface ExplainTarget {
  lineId: string;
  title: string;
}

/** "Giữ số xưởng": liên kết lệch thành "Lệch đã giải trình", lý do bắt buộc (AC-4). */
export function ExplainMismatchDialog({
  target,
  onClose,
  onSave,
}: {
  target: ExplainTarget | null;
  onClose: () => void;
  onSave: (lineId: string, reason: string) => void;
}) {
  const [form, setForm] = useState<{ lineId: string; reason: string } | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const value = form ?? (target ? { lineId: target.lineId, reason: "" } : null);
  const draft = useDialogDraft({ form: "supplier-invoice-explain", value: form, setValue: setForm, isEmpty: (v) => !v.reason.trim() });
  if (!target || !value) return null;
  const close = () => {
    draft.dismiss();
    setErrors([]);
    onClose();
  };
  const save = () => {
    if (!value.reason.trim()) {
      setErrors([{ field: "Lý do giữ số xưởng", message: "Ghi lý do giữ số xưởng (vd: cân xưởng đúng, đại lý xuất thiếu)." }]);
      return;
    }
    onSave(value.lineId, value.reason.trim());
    draft.done();
    setErrors([]);
    onClose();
  };
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && close()}
      title="Giữ số xưởng"
      description={target.title}
      hasRequiredFields
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Hủy
          </Button>
          <Button variant="save" title="Giữ số kg / giá của sổ xưởng, lưu lý do — dòng thành Lệch đã giải trình." onClick={save}>
            Lưu lý do
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      <ErrorSummary errors={errors} />
      <Field label="Lý do giữ số xưởng" required>
        <Textarea id="explain-reason" value={value.reason} onChange={(e) => setForm({ ...value, reason: e.target.value })} rows={3} />
      </Field>
      <p className="text-sm text-muted-foreground">Số chuyến không đổi. Hóa đơn và sổ chuyến vẫn lệch, nhưng đã có lời giải trình.</p>
    </FormDialog>
  );
}

export interface CreateTripTarget {
  invoiceId: string;
  invoiceNo: string;
  supplierName: string;
  /** Mỗi phần tử = một chuyến sẽ tạo. */
  trips: { deliveryDate: string; licensePlate: string; kg: number; lines: number }[];
  suggestedWorkshop: Workshop;
}

/** "Tạo chuyến từ HĐ": chọn phân xưởng, xem trước chuyến ghi bù sẽ tạo (AC-8). */
export function CreateTripDialog({
  target,
  onClose,
  onCreate,
}: {
  target: CreateTripTarget | null;
  onClose: () => void;
  onCreate: (invoiceId: string, workshop: Workshop) => void;
}) {
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  if (!target) return null;
  const ws = workshop ?? target.suggestedWorkshop;
  const close = () => {
    setWorkshop(null);
    onClose();
  };
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && close()}
      title={`Tạo chuyến từ HĐ ${target.invoiceNo}`}
      description={`${target.supplierName} — sổ xưởng chưa có chuyến cho các dòng này. Chuyến tạo ra là ghi bù, lý do điền sẵn "Theo HĐ ${target.invoiceNo}".`}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Hủy
          </Button>
          <Button
            variant="save"
            title="Ghi các chuyến ghi bù vào sổ Nhập hàng theo số của hóa đơn, rồi gắn hóa đơn vào."
            onClick={() => {
              onCreate(target.invoiceId, ws);
              close();
            }}
          >
            Tạo {target.trips.length} chuyến
          </Button>
        </>
      }
    >
      <Combobox label="Phân xưởng nhận hàng" required clearable={false} value={ws} onChange={(v) => v && setWorkshop(v as Workshop)} options={WORKSHOPS.map((p) => ({ value: p, label: p }))} />
      <ul className="space-y-1 text-sm">
        {target.trips.map((t) => (
          <li key={`${t.deliveryDate}|${t.licensePlate}`} className="tnum">
            Hàng về {formatDateVN(t.deliveryDate)}
            {t.licensePlate ? ` · xe ${t.licensePlate}` : ""} · {t.lines} loại · {num(t.kg)} kg
          </li>
        ))}
      </ul>
    </FormDialog>
  );
}
