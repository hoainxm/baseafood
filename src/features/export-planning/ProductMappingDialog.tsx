// ============================================================
// Tên file: src/features/export-planning/ProductMappingDialog.tsx
// Tên tiếng Việt: Nối dòng hàng hợp đồng với danh mục mặt hàng (không tạo bản sửa)
// Description: Map each contract line (English name on the paper contract) to a product of the
//              open `products` catalog. Internal metadata — does NOT change the contract, so no
//              revision / BGĐ re-approval. Draft-saved (rule 17).
// ============================================================
// Luật: ba-spec 41 v4 AC-31/AC-32 — Lệnh SX chỉ xong khi mọi dòng của bản hiệu lực đã nối.
// Combobox có tạo mới tại chỗ + bút chì (luật 7); 141 mã kế toán chỉ ánh xạ qua `products`.
import { useEffect, useState } from "react";
import { Button, Combobox, ErrorSummary, FormDialog, notify, type ComboboxOption, type FieldError } from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import { rankProductsForLine, suggestProductId, type ExportData } from "@/lib/exportPlanning";
import { findCustomerName } from "@/lib/customerProductNames";
import type { CustomerProductName, ExportContractLine, ExportContractRevision, Product } from "@/types";
import { Link2, Save } from "lucide-react";

export interface ProductMappingTarget {
  contractNo: string;
  customerId: string;
  revision: ExportContractRevision;
}

interface MappingForm {
  key: string;
  /** Đích nằm trong form để nháp mở lại sau tải trang vẫn lưu được. */
  tg: ProductMappingTarget;
  /** lineId → productId ("" = chưa nối). */
  map: Record<string, string>;
  initial: string;
}
const mapSnap = (m: Record<string, string>) => JSON.stringify(Object.entries(m).sort());

export function ProductMappingDialog({
  target,
  data,
  products,
  customerNames,
  setProducts,
  onClose,
  onSave,
}: {
  target: ProductMappingTarget | null;
  data: Pick<ExportData, "contracts" | "revisions">;
  products: Product[];
  /** Tên hàng theo khách (mig 0077) — gợi ý theo tên + size của khách (R23 v6). */
  customerNames: readonly CustomerProductName[];
  setProducts: (rows: Product[]) => boolean | void;
  onClose: () => void;
  /** Ghi productId vào dòng hàng của bản; trả false nếu ghi hụt. */
  onSave: (revisionId: string, map: Record<string, string>) => boolean;
}) {
  const [form, setForm] = useState<MappingForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const draft = useDialogDraft({ form: "export-product-mapping", value: form, setValue: setForm, isEmpty: (f) => mapSnap(f.map) === f.initial });
  const productEditor = useQuickCatalogEdit("product", products, (rows) => void setProducts(rows));

  useEffect(() => {
    if (!target) return;
    // Dòng chưa nối ⇒ gợi ý 4 bậc (R23 v6): tên + size của khách → tên của khách → HĐ trước → tên mặc định.
    const initialMap = Object.fromEntries(target.revision.lines.map((l) => [l.id, l.productId ?? ""]));
    const suggest = (l: ExportContractLine) => {
      const pid = suggestProductId(data, l.description, target.customerId, products, { size: l.size, names: customerNames });
      return products.some((p) => p.id === pid) ? pid : "";
    };
    const map = Object.fromEntries(target.revision.lines.map((l) => [l.id, l.productId || suggest(l)]));
    const fresh: MappingForm = { key: target.revision.id, tg: target, map, initial: mapSnap(initialMap) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const tgt = target ?? form?.tg ?? null;
  /** Mục khớp tên của khách / tên mặc định đứng đầu; dòng phụ = mã · tên của khách (chưa có thì tên mặc định). */
  const optionsFor = (l: ExportContractLine): ComboboxOption[] => {
    const customerId = tgt?.customerId ?? "";
    return rankProductsForLine(l.description, products, customerId, { size: l.size, names: customerNames }).map((m) => ({
      value: m.id,
      label: m.code ? `${m.code} · ${m.name}` : m.name,
      subLabel: [m.code, findCustomerName(customerNames, customerId, m.id)?.tradeName || m.tradeName].filter(Boolean).join(" · ") || undefined,
    }));
  };
  const addProduct = (name: string) => {
    const existing = products.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const m: Product = { id: newId(), code: "", name, finishedGoodCode: "" };
    setProducts([...products, m]);
    notify.saved(`Đã thêm mặt hàng "${name}" vào danh mục`);
    return m.id;
  };
  const lines = tgt?.revision.lines.filter((l) => l.description.trim() || l.quantity != null) ?? [];
  const mappedCount = form ? lines.filter((l) => form.map[l.id]).length : 0;

  const save = () => {
    if (!form || !tgt) return;
    const errs: FieldError[] = [];
    if (mapSnap(form.map) === form.initial) errs.push({ field: "Mặt hàng", message: "Chưa đổi dòng nào — chọn mặt hàng cho các dòng còn trống" });
    setErrors(errs);
    if (errs.length) return;
    if (!onSave(tgt.revision.id, form.map)) return;
    draft.done();
  };

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={`Nối mặt hàng · HĐ ${tgt?.contractNo ?? ""}`}
      description="Chọn mặt hàng trong danh mục của xưởng cho từng dòng hàng (tên tiếng Anh giữ đúng như HĐ). Đây là thông tin nội bộ — không tạo bản sửa, không cần BGĐ duyệt lại. Lưu xong, app tự thêm tên còn thiếu vào danh sách Tên hàng của khách."
      icon={Link2}
      size="lg"
      footer={
        <>
          <span className="tnum mr-auto min-w-0 text-sm text-muted-foreground">
            Đã nối {mappedCount} / {lines.length} dòng
          </span>
          <Button
            variant="outline"
            onClick={() => {
              draft.cancel();
              onClose();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={save} title="Lưu mặt hàng đã chọn cho các dòng hàng của hợp đồng.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            Lưu nối mặt hàng
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 py-2">
          <ErrorSummary errors={errors} />
          {lines.map((l, i) => (
            <div key={l.id} className="grid min-w-0 gap-3 border-b border-border py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
              <div className="grid min-w-0 gap-0.5 text-sm">
                <span className="text-muted-foreground">Dòng {i + 1}</span>
                <span className="break-words font-semibold">{l.description || "(chưa ghi tên)"}</span>
                {(l.size || l.packing) && <span className="break-words text-muted-foreground">{[l.size, l.packing].filter(Boolean).join(" · ")}</span>}
              </div>
              <Combobox
                label={`Mặt hàng (danh mục) · dòng ${i + 1}`}
                value={form.map[l.id] ?? ""}
                onChange={(v) => setForm((f) => (f ? { ...f, map: { ...f.map, [l.id]: v } } : f))}
                options={optionsFor(l)}
                onCreate={productEditor.canCreate ? addProduct : undefined}
                emptyText="Chưa có mặt hàng nào trong danh mục."
                onEditItem={productEditor.openEdit}
                canEdit={productEditor.canEdit}
                editLabel={productEditor.editLabel}
              />
            </div>
          ))}
        </div>
      )}
      {productEditor.dialog}
    </FormDialog>
  );
}
