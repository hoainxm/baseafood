// ============================================================
// Tên file: src/features/catalog/CustomerProductNamesDialog.tsx
// Tên tiếng Việt: Hộp "Tên hàng trên chứng từ" của một khách
// Description: Per-customer list of product names used on export contracts / invoices
//              (ba-spec 41 v6 NV14 · R23): list, add, edit, delete with undo. Opened from the
//              customer catalog and from the export contract dossier. Draft-saved (rule 17).
// ============================================================
// Mỗi (khách, mặt hàng) một dòng; tên + size không trùng giữa hai mặt hàng của cùng khách
// (lib/customerProductNames). Trích xuất từ chứng từ (NV16): app thêm dòng còn thiếu khi lưu hợp đồng đã
// nối mặt hàng, và nút "Trích xuất từ chứng từ" quét lại mọi hợp đồng của khách.
import { useEffect, useState } from "react";
import {
  Button,
  Combobox,
  ErrorSummary,
  Field,
  FormDialog,
  InlineConfirmDelete,
  Input,
  RecordTable,
  notify,
  type ComboboxOption,
  type FieldError,
  type RecordTableColumn,
} from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useQuickCatalogEdit } from "./QuickCatalogEdit";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import { nameKey, namesOfCustomer, validateCustomerProductName } from "@/lib/customerProductNames";
import { extractCustomerNamesFromContracts, type ExportData } from "@/lib/exportPlanning";
import type { Customer, CustomerProductName, Product } from "@/types";
import { FileSearch, Languages, Pencil, Plus, Save } from "lucide-react";

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
  extractSource,
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
  /** Hợp đồng xuất khẩu để "Trích xuất từ chứng từ" (ba-spec 41 NV16). Không có ⇒ ẩn nút. */
  extractSource?: Pick<ExportData, "contracts" | "revisions" | "approvals">;
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

  const [query, setQuery] = useState("");
  /** Kết quả lần "Trích xuất từ chứng từ" gần nhất (không thêm gì thì chỉ báo tại chỗ, không toast — luật 13). */
  const [extractNote, setExtractNote] = useState("");
  const productName = (id: string) => products.find((p) => p.id === id)?.name || "(mặt hàng đã xóa)";
  const productCode = (id: string) => products.find((p) => p.id === id)?.finishedGoodCode || "";
  // Sắp theo tên rồi size ⇒ hai size cùng tên đứng cạnh nhau (dễ đối chiếu với HĐ).
  const all = customer ? namesOfCustomer(names, customer.id).sort((a, b) => nameKey(a.tradeName).localeCompare(nameKey(b.tradeName), "vi") || nameKey(a.sizeText).localeCompare(nameKey(b.sizeText), "vi")) : [];
  const q = nameKey(query);
  const shown = q ? all.filter((n) => nameKey([n.tradeName, n.sizeText, n.packing, n.hsCode, n.note, productName(n.productId), productCode(n.productId)].join(" ")).includes(q)) : all;
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
  const extract = () => {
    if (!customer || !extractSource) return;
    const prev = names;
    const { created, contractCount } = extractCustomerNamesFromContracts(extractSource, names, customer.id, newId);
    if (!created.length) {
      setExtractNote(contractCount ? `Đã quét ${contractCount} hợp đồng của ${customer.name} — không có tên hàng mới.` : `${customer.name} chưa có hợp đồng xuất khẩu nào để trích xuất.`);
      return;
    }
    if (setNames([...names, ...created]) === false) return;
    setExtractNote("");
    notify.saved(`Đã trích xuất ${created.length} tên hàng từ ${contractCount} hợp đồng của ${customer.name}`, () => void setNames(prev));
  };
  const extractButton = writable && extractSource && customer && (
    <Button
      variant="outline"
      onClick={extract}
      title={`Quét mọi hợp đồng xuất khẩu của ${customer.name}: dòng hàng đã nối mặt hàng mà chưa có trong bảng thì thêm vào (không ghi đè tên đang có).`}
    >
      <FileSearch className="mr-2 h-4 w-4" aria-hidden />
      Trích xuất từ chứng từ
    </Button>
  );

  const remove = (n: CustomerProductName) => {
    const prev = names;
    if (setNames(names.filter((x) => x.id !== n.id)) === false) return;
    notify.deleted(`Đã xóa tên "${n.tradeName}"`, () => void setNames(prev));
  };

  /** Size / quy cách dài: mỗi ý (ngăn bằng "·") một dòng — không nối thành đoạn khó dò. */
  const parts = (v: string) => {
    const xs = v.split(/\s*·\s*/).filter(Boolean);
    if (!xs.length) return <span className="text-muted-foreground">—</span>;
    return (
      <span className="grid gap-0.5">
        {xs.map((x, i) => (
          <span key={i} className={`break-words ${i ? "text-muted-foreground" : ""}`}>
            {x}
          </span>
        ))}
      </span>
    );
  };
  const columns: RecordTableColumn<CustomerProductName>[] = [
    {
      key: "trade-name",
      header: "Tên trên chứng từ",
      primary: true,
      width: "20%",
      render: (n) => <span className="font-semibold break-words">{n.tradeName}</span>,
      getSortValue: (n) => `${nameKey(n.tradeName)}|${nameKey(n.sizeText)}`,
    },
    {
      key: "product",
      header: "Mặt hàng xưởng",
      width: "24%",
      render: (n) => (
        <span className="grid gap-0.5">
          <span className="break-words">{productName(n.productId)}</span>
          {productCode(n.productId) && <span className="text-muted-foreground">{productCode(n.productId)}</span>}
          {n.note && <span className="break-words text-muted-foreground">{n.note}</span>}
        </span>
      ),
      getSortValue: (n) => nameKey(productName(n.productId)),
    },
    { key: "size", header: "Size", width: "26%", render: (n) => parts(n.sizeText), getSortValue: (n) => nameKey(n.sizeText) },
    { key: "packing", header: "Quy cách", width: "18%", render: (n) => parts(n.packing), getSortValue: (n) => nameKey(n.packing) },
    { key: "hs", header: "Mã HS", width: "12%", render: (n) => <span className="tnum">{n.hsCode || "—"}</span>, getSortValue: (n) => n.hsCode },
  ];

  return (
    <FormDialog
      open={!!customer}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={`Tên hàng trên chứng từ · ${customer?.name ?? ""}`}
      description="Đối chiếu mặt hàng của xưởng với tên, size, quy cách và mã HS mà khách dùng trên hợp đồng, invoice. Tên được trích xuất từ các dòng hàng hợp đồng đã nối mặt hàng; chỉnh sửa tại đây không làm thay đổi hợp đồng đã lưu."
      icon={Languages}
      size="xl"
      hasRequiredFields={!!form}
      footer={
        <>
          <span className="tnum mr-auto min-w-0 text-sm text-muted-foreground">{all.length} tên hàng</span>
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
            <h3 className="font-semibold">{form.isNew ? "Thêm tên hàng" : `Sửa tên hàng · ${productName(form.row.productId)}`}</h3>
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

        {all.length ? (
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <div className="flex min-w-0 flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1 basis-56 sm:max-w-sm">
                <Field label="Tra tên hàng">
                  <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} title="Gõ một phần tên trên chứng từ, mặt hàng xưởng, size, mã HS hoặc mã kế toán — lọc ngay bảng dưới." />
                </Field>
              </div>
              <span className="tnum pb-2 text-sm text-muted-foreground">
                {q ? `${shown.length} / ${all.length} tên hàng` : `${all.length} tên hàng`}
              </span>
              <div className="ml-auto">{extractButton}</div>
            </div>
            {extractNote && (
              <p role="status" className="text-sm text-muted-foreground">
                {extractNote}
              </p>
            )}
            <RecordTable
              columns={columns}
              rows={shown}
              getKey={(n) => n.id}
              emptyText="Không tên hàng nào khớp ô tra."
              actions={
                writable
                  ? (n) => (
                      <>
                        <Button size="icon-sm" variant="edit" onClick={() => open(n, false)} title={`Sửa tên "${n.tradeName}" (hợp đồng đã lưu không đổi).`}>
                          <Pencil className="h-4 w-4" aria-hidden />
                          <span className="sr-only">Sửa</span>
                        </Button>
                        {canDelete && <InlineConfirmDelete recordDescription={`${n.tradeName} — ${productName(n.productId)}`} onConfirm={() => remove(n)} />}
                      </>
                    )
                  : undefined
              }
            />
          </div>
        ) : (
          !form && (
            <div className="grid min-w-0 justify-items-start gap-3">
              <p className="text-sm text-muted-foreground">
                Chưa có tên hàng nào cho khách này. Tên được trích xuất khi lưu hợp đồng đã nối mặt hàng
                {extractButton ? '; chọn "Trích xuất từ chứng từ" để lấy ngay từ các hợp đồng đã có' : ""}
                {writable ? ', hoặc "Thêm tên hàng" để khai tay' : ""}.
              </p>
              {extractButton}
              {extractNote && (
                <p role="status" className="text-sm text-muted-foreground">
                  {extractNote}
                </p>
              )}
            </div>
          )
        )}
      </div>
      {productEditor.dialog}
    </FormDialog>
  );
}
