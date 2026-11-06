// ============================================================
// Tên file: src/features/imports/supplierInvoiceParts.tsx
// Tên tiếng Việt: Hộp "Giữ số xưởng" (bắt lý do) + hộp "Tạo chuyến từ HĐ" + hộp "Chi tiết hóa đơn" (Gỡ hóa đơn) của tab Hóa đơn
// Description: Dialogs for ba-spec 51 NV4/NV5 (design-spec 52 §2). The reason box keeps a draft
//              (rule 17 — useDialogDraft); the trip box is a single choice (workshop) with a preview;
//              the detail box shows one invoice and holds "Gỡ hóa đơn" (confirm + Hoàn tác in the panel).
// ============================================================
import { useState } from "react";
import { Button, Combobox, ConfirmDelete, ErrorSummary, Field, FormDialog, Tag, Textarea, type FieldError } from "@/design-system";
import { Trash2 } from "lucide-react";
import type { Workshop } from "@/types";
import type { InvoiceRemovalPlan } from "@/lib/supplierInvoice";
import { useDialogDraft } from "@/lib/formDraft";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { formatDateVN, kg, num } from "@/lib/format";
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

export interface InvoiceDetailTarget {
  plan: InvoiceRemovalPlan;
  /** Tên đại lý hiển thị (chưa ánh xạ ⇒ mã kế toán). */
  supplierLabel: string;
  canViewPrice: boolean;
  /** Quyền Xóa `imports.invoices` — không có thì không hiện khối gỡ. */
  canRemove: boolean;
}

/**
 * "Chi tiết hóa đơn": thông tin HĐ + Gỡ hóa đơn gắn nhầm (nút xóa nằm TRONG hộp chi tiết như mọi màn,
 * không đặt trên dòng bảng). HĐ đã sinh chuyến ghi bù ⇒ bấm Gỡ chỉ báo phải xóa chuyến trước.
 */
export function InvoiceDetailDialog({
  target,
  onClose,
  onRemove,
  onOpenFile,
}: {
  target: InvoiceDetailTarget | null;
  onClose: () => void;
  onRemove: (invoiceId: string) => void;
  onOpenFile: () => void;
}) {
  const [errors, setErrors] = useState<FieldError[]>([]);
  if (!target) return null;
  const { plan } = target;
  const inv = plan.invoice;
  const close = () => {
    setErrors([]);
    onClose();
  };
  const totalKg = plan.lines.reduce((s, l) => s + l.quantityKg, 0);
  const amount = plan.lines.reduce((s, l) => s + l.amount, 0);
  const blocked = plan.blockingShipments.length > 0;
  const rows: [string, string][] = [
    ["Đại lý", target.supplierLabel],
    ["Số hóa đơn", `${inv.invoiceNo}${inv.invoiceSymbol ? ` · ký hiệu ${inv.invoiceSymbol}` : ""}`],
    ["Ngày hạch toán", inv.postingDate ? formatDateVN(inv.postingDate) : "—"],
    ["Số phiếu kế toán", inv.voucherNo || "—"],
    ["MST người bán", inv.sellerTaxId || "—"],
    ["Dòng sổ chi tiết", `${num(plan.lines.length)} dòng · ${kg(totalKg)}${target.canViewPrice ? ` · ${num(amount)} đ` : ""}`],
    ["Dòng chuyến đang gắn", num(plan.linkedTripLineIds.length)],
    ["File PDF", inv.fileName || "Chưa có file"],
  ];
  const removeText = `HĐ ${inv.invoiceNo} — ${target.supplierLabel} — ${plan.lines.length} dòng sổ chi tiết — ${kg(totalKg)}${inv.fileName ? ` — file ${inv.fileName}` : ""}`;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && close()}
      title={`Hóa đơn ${inv.invoiceNo}`}
      description={inv.classification === "not-trip" ? "Đã xếp Không thuộc chuyến." : undefined}
      footer={
        <>
          {target.canRemove &&
            (blocked ? (
              <Button
                variant="danger"
                title="Gỡ hóa đơn gắn nhầm khỏi tab Hóa đơn. Hóa đơn này đã tạo chuyến ghi bù — phải xóa chuyến đó trước."
                onClick={() =>
                  setErrors([
                    {
                      field: "Gỡ hóa đơn",
                      message: `Hóa đơn này đã tạo ${plan.blockingShipments.length} chuyến ghi bù (${plan.blockingShipments
                        .map((s) => `${formatDateVN(s.deliveryDate)} · xưởng ${s.workshop}${s.lotCode ? ` · lô ${s.lotCode}` : ""}`)
                        .join("; ")}). Xóa chuyến đó ở sổ Nhập hàng trước (mở chuyến → Xóa chuyến), rồi gỡ hóa đơn.`,
                    },
                  ])
                }
              >
                <Trash2 />
                Gỡ hóa đơn
              </Button>
            ) : (
              <ConfirmDelete
                title="Gỡ hóa đơn gắn nhầm?"
                confirmLabel="Gỡ hóa đơn"
                recordDescription={removeText}
                onConfirm={() => {
                  onRemove(inv.id);
                  close();
                }}
                trigger={
                  <Button variant="danger" title="Bỏ hóa đơn và các dòng sổ chi tiết của nó khỏi tab Hóa đơn. Sổ Nhập hàng không đổi; có hỏi xác nhận và có Hoàn tác.">
                    <Trash2 />
                    Gỡ hóa đơn
                  </Button>
                }
              />
            ))}
          {inv.filePath && (
            <Button variant="outline" title={`Mở file ${inv.fileName}`} onClick={onOpenFile}>
              Mở file
            </Button>
          )}
          <Button variant="outline" onClick={close}>
            Đóng
          </Button>
        </>
      }
    >
      <ErrorSummary errors={errors} />
      <dl className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="mt-1 text-muted-foreground sm:mt-0">{k}</dt>
            <dd className="tnum min-w-0 break-words text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      {target.canRemove && (
        <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
          <p className="font-semibold text-foreground">Gỡ hóa đơn gắn nhầm</p>
          <p className="text-muted-foreground">
            Bỏ hóa đơn, {num(plan.lines.length)} dòng sổ chi tiết và thông tin file PDF khỏi tab Hóa đơn. Sổ Nhập hàng không đổi
            {plan.linkedTripLineIds.length ? <> — {num(plan.linkedTripLineIds.length)} dòng chuyến về <b>Chờ HĐ</b> như trước khi ghép</> : null}. Gỡ xong
            vẫn Hoàn tác được; nạp lại đúng file thì gắn lại.
          </p>
          {plan.updatedTripLineIds.length > 0 && (
            <p className="flex flex-wrap items-center gap-1 text-foreground">
              <Tag variant="warning">Lưu ý</Tag>
              {num(plan.updatedTripLineIds.length)} dòng chuyến đã Cập nhật theo HĐ này. Gỡ hóa đơn không trả lại số cũ — Ghi chú dòng chuyến còn vết
              “[Sửa theo HĐ …]” ghi số cũ, sửa tay ở chuyến nếu cần.
            </p>
          )}
          {blocked && (
            <p className="flex flex-wrap items-center gap-1 text-foreground">
              <Tag variant="error">Chưa gỡ được</Tag>
              Hóa đơn đã tạo {num(plan.blockingShipments.length)} chuyến ghi bù — xóa chuyến đó ở sổ Nhập hàng trước.
            </p>
          )}
        </div>
      )}
    </FormDialog>
  );
}
