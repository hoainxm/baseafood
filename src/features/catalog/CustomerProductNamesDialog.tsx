// ============================================================
// Tên file: src/features/catalog/CustomerProductNamesDialog.tsx
// Tên tiếng Việt: Hộp "Tên hàng trên chứng từ" của một khách
// Description: Per-customer list of product names used on export contracts / invoices
//              (ba-spec 41 v6 NV14 · R23): list, add, edit, delete with undo. Opened from the
//              customer catalog and from the export contract dossier. Draft-saved (rule 17).
// ============================================================
// Mỗi (khách, mặt hàng) một dòng; tên + size không trùng giữa hai mặt hàng của cùng khách
// (lib/customerProductNames). App còn tự thêm dòng khi lưu hợp đồng đã nối mặt hàng (NV16).
import { useEffect, useState } from "react";
import {
  Button,
  Combobox,
  ErrorSummary,
  Field,
  FormDialog,
  InlineConfirmDelete,
  Input,
  notify,
  type ComboboxOption,
  type FieldError,
} from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useQuickCatalogEdit } from "./QuickCatalogEdit";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import { nameKey, namesOfCustomer, validateCustomerProductName } from "@/lib/customerProductNames";
import type { Customer, CustomerProductName, Product } from "@/types";
import { Languages, Pencil, Plus, Save } from "lucide-react";

const emptyRow = (customerId: string): CustomerProductName => ({
  id: newId(),
  customerId,
  productId: "",
  tradeName: "",
  sizeText: "",
  packing: "",
  hsCode: "",
  note: "",
});

interface NameForm {
  row: CustomerProductName;
  isNew: boolean;
  initial: string;
}
const snap = (r: CustomerProductName) => JSON.stringify([r.productId, r.tradeName, r.sizeText, r.packing, r.hsCode, r.note]);

export function CustomerProductNamesDialog({
  customer,
  names,
  setNames,
  products,
  setProducts,
  isAvailable,
  canWrite,
  canDelete,
  onClose,
}: {
  /** Khách đang xem — null ⇒ hộp đóng. */
  customer: Pick<Customer, "id" | "name"> | null;
  /** Đúng rows / setRows của màn đang mở (một instance `useCustomerProductNames`). */
  names: CustomerProductName[];
  setNames: (rows: CustomerProductName[]) => boolean | void;
  products: Product[];
  setProducts: (rows: Product[]) => boolean | void;
  /** Máy chủ đã có bảng (mig 0077) — chưa có thì chỉ xem, không ghi (khỏi kẹt hàng chờ). */
  isAvailable: boolean;
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<NameForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const draft = useDialogDraft({ form: "customer-product-name", value: form, setValue: setForm, isEmpty: (f) => snap(f.row) === f.initial });
  const productEditor = useQuickCatalogEdit("product", products, (rows) => void setProducts(rows));
  const writable = isAvailable && canWrite;

  // Đổi khách / đóng hộp ⇒ bỏ khối form của khách cũ (nháp vẫn giữ nếu đóng ngang).
  useEffect(() => {
    if (!customer) return;
    const kept = draft.takeKept();
    setForm(kept && kept.row.customerId === customer.id ? kept : null);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở / đổi khách
  }, [customer?.id]);

  const shown = customer ? namesOfCustomer(names, customer.id).sort((a, b) => nameKey(a.tradeName).localeCompare(nameKey(b.tradeName), "vi") || nameKey(a.sizeText).localeCompare(nameKey(b.sizeText), "vi")) : [];
  const productName = (id: string) => products.find((p) => p.id === id)?.name || "(mặt hàng đã xóa)";
  const productOptions: ComboboxOption[] = products.map((m) => ({ value: m.id, label: m.code ? `${m.code} · ${m.name}` : m.name, subLabel: m.code || undefined }));
  const addProduct = (name: string) => {
    const existing = products.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const m: Product = { id: newId(), code: "", name, finishedGoodCode: "" };
    setProducts([...products, m]);
    notify.saved(`Đã thêm mặt hàng "${name}" vào danh mục`);
    return m.id;
  };

  const open = (row: CustomerProductName, isNew: boolean) => {
    setForm({ row: { ...row }, isNew, initial: snap(row) });
    setErrors([]);
  };
  const set = <K extends keyof CustomerProductName>(k: K, v: CustomerProductName[K]) => setForm((f) => (f ? { ...f, row: { ...f.row, [k]: v } } : f));

  const save = () => {
    if (!form || !customer) return;
    const row = { ...form.row, tradeName: form.row.tradeName.trim(), sizeText: form.row.sizeText.trim(), packing: form.row.packing.trim(), hsCode: form.row.hsCode.trim(), note: form.row.note.trim() };
    const issues = validateCustomerProductName(row, names);
    setErrors(issues);
    if (issues.length) return;
    const prev = names;
    const next = form.isNew ? [...names, row] : names.map((n) => (n.id === row.id ? row : n));
    if (setNames(next) === false) return;
    notify.saved(form.isNew ? `Đã thêm tên "${row.tradeName}" cho ${customer.name}` : "Đã lưu tên hàng", () => void setNames(prev));
    draft.done();
  };
  const remove = (n: CustomerProductName) => {
    const prev = names;
    if (setNames(names.filter((x) => x.id !== n.id)) === false) return;
    notify.deleted(`Đã xóa tên "${n.tradeName}"`, () => void setNames(prev));
  };

  return (
    <FormDialog
      open={!!customer}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={`Tên hàng trên chứng từ · ${customer?.name ?? ""}`}
      description="Tên khách dùng trên hợp đồng / invoice cho từng mặt hàng của xưởng. App tự thêm khi nối mặt hàng ở hợp đồng; sửa ở đây không đổi hợp đồng đã lưu."
      icon={Languages}
      size="lg"
      hasRequiredFields={!!form}
      footer={
        <>
          <span className="tnum mr-auto min-w-0 text-sm text-muted-foreground">{shown.length} tên hàng</span>
          {writable && !form && customer && (
            <Button onClick={() => open(emptyRow(customer.id), true)} title={`Thêm một tên hàng ${customer.name} dùng trên chứng từ cho một mặt hàng của xưởng.`}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Thêm tên hàng
            </Button>
          )}
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 py-2">
        {!isAvailable && (
          <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
            Máy chủ chưa có bảng tên hàng theo khách (migration 0077) — tạm chỉ xem, chưa thêm / sửa được.
          </p>
        )}

        {form && (
          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-xl bg-muted/40 p-4">
            <h3 className="font-semibold">{form.isNew ? "Thêm tên hàng" : "Sửa tên hàng"}</h3>
            <ErrorSummary errors={errors} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Combobox
                label="Mặt hàng (xưởng)"
                required
                value={form.row.productId}
                onChange={(v) => set("productId", v)}
                options={productOptions}
                onCreate={productEditor.canCreate ? addProduct : undefined}
                emptyText="Chưa có mặt hàng nào trong danh mục."
                onEditItem={productEditor.openEdit}
                canEdit={productEditor.canEdit}
                editLabel={productEditor.editLabel}
              />
              <Field label="Tên trên chứng từ" required>
                <Input value={form.row.tradeName} onChange={(e) => set("tradeName", e.target.value)} aria-required title="Ghi đúng chữ khách dùng trên hợp đồng / invoice, VD Frozen iwadako boiled cut." />
              </Field>
              <Field label="Size">
                <Input value={form.row.sizeText} onChange={(e) => set("sizeText", e.target.value)} title="Size như trên chứng từ, VD 5-5.5 gr/pc — dùng để phân biệt hai mặt hàng cùng tên." />
              </Field>
              <Field label="Quy cách đóng gói">
                <Input value={form.row.packing} onChange={(e) => set("packing", e.target.value)} title="VD Net weight IQF 1kg/PE x 10/CTN." />
              </Field>
              <Field label="Mã HS">
                <Input value={form.row.hsCode} onChange={(e) => set("hsCode", e.target.value)} title="VD 16055500." />
              </Field>
              <Field label="Ghi chú">
                <Input value={form.row.note} onChange={(e) => set("note", e.target.value)} title="Ghi chú nội bộ, không in lên chứng từ." />
              </Field>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  draft.cancel();
                  setErrors([]);
                }}
              >
                Hủy
              </Button>
              <Button variant="save" onClick={save} title="Lưu tên hàng này vào danh sách của khách.">
                <Save className="mr-2 h-4 w-4" aria-hidden />
                Lưu tên hàng
              </Button>
            </div>
          </section>
        )}

        {shown.length ? (
          <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] divide-y divide-border rounded-lg border border-border">
            {shown.map((n) => (
              <li key={n.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-3 py-2">
                <div className="grid min-w-0 gap-0.5 text-sm">
                  <span className="font-semibold break-words">{n.tradeName}</span>
                  {(n.sizeText || n.packing || n.hsCode) && (
                    <span className="break-words text-muted-foreground">{[n.sizeText, n.packing, n.hsCode && `HS ${n.hsCode}`].filter(Boolean).join(" · ")}</span>
                  )}
                  <span className="break-words">
                    Mặt hàng xưởng: {productName(n.productId)}
                    {n.note ? <span className="text-muted-foreground"> · {n.note}</span> : null}
                  </span>
                </div>
                {writable && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon-sm" variant="edit" onClick={() => open(n, false)} title={`Sửa tên "${n.tradeName}" (hợp đồng đã lưu không đổi).`}>
                      <Pencil className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Sửa</span>
                    </Button>
                    {canDelete && <InlineConfirmDelete recordDescription={`${n.tradeName} — ${productName(n.productId)}`} onConfirm={() => remove(n)} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          !form && (
            <p className="text-sm text-muted-foreground">
              Chưa có tên nào — lưu một hợp đồng đã nối mặt hàng của khách này là app tự thêm{writable ? ", hoặc Thêm tên hàng" : ""}.
            </p>
          )
        )}
      </div>
      {productEditor.dialog}
    </FormDialog>
  );
}
