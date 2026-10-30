// ============================================================
// Tên file: src/features/import-planning/ImportDialogs.tsx
// Tên tiếng Việt: Hộp ghi của Nhập khẩu — hợp đồng, lần nhập, chứng từ, thực nhập, đóng hợp đồng
// Description: Write dialogs of the import planning module (ba-spec 45 NI2–NI8, design-spec 46).
// ============================================================
// Mọi hộp ghi tự lưu NHÁP (luật 17), nút Lưu không `disabled` (thiếu ⇒ ErrorSummary). Luật ở
// lib/importPlanning.ts — hộp chỉ gọi, không tự tính lại.
import { useEffect, useRef, useState } from "react";
import {
  Button,
  ChoiceGroup,
  Combobox,
  DateField,
  ErrorSummary,
  Field,
  FormDialog,
  FormSection,
  Input,
  NumberField,
  Textarea,
  formatNumber,
  notify,
  type ComboboxOption,
  type FieldError,
} from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { FilePicker } from "@/features/export-planning/parts";
import { LineProductLabel } from "./parts";
import { useDialogDraft } from "@/lib/formDraft";
import { useGoodsTypePicker } from "@/features/export-planning/goodsTypePicker";
import { insertCopiedLine } from "@/lib/exportPlanning";
import { newId } from "@/lib/store";
import { formatMoney } from "@/lib/format";
import {
  IMPORT_DOCUMENT_KINDS,
  IMPORT_TRANSPORTS,
  IMPORT_TYPES,
  contractTotals,
  documentLabel,
  isRequiredKind,
  lineAmount,
  quantityWarnings,
  emptyImportSupplier,
  productNameAfterPick,
  receivedKg,
  suggestImportProductId,
  selectableImportSuppliers,
  validateContract,
  validateReceipt,
  type ImportData,
} from "@/lib/importPlanning";
import { IMPORT_FILE_ACCEPT, checkImportFile, hasImportStorage, removeImportFiles } from "@/lib/importFileStorage";
import { uploadAll } from "./importUpload";
import type {
  ImportContract,
  ImportContractLine,
  ImportDocument,
  ImportDocumentKind,
  ImportFile,
  ImportReceipt,
  ImportReceiptLine,
  ImportSupplier,
  ImportTransport,
  ImportType,
  Product,
} from "@/types";
import { Copy, FileCheck2, FileSignature, Lock, PackageCheck, Plus, Save, Ship, Trash2 } from "lucide-react";

/** Tên ô của từng mã lỗi (lib/importPlanning) — ErrorSummary chỉ đúng ô cần sửa. */
const ISSUE_FIELD: Record<string, string> = {
  supplier: "Đối tác",
  "contract-no": "Số hợp đồng",
  "duplicate-no": "Số hợp đồng",
  "signed-date": "Ngày ký",
  "import-type": "Loại hình nhập",
  "no-lines": "Dòng hàng",
  "line-name": "Dòng hàng",
  "line-kg": "Dòng hàng",
  "line-has-receipts": "Dòng hàng",
  "no-date": "Ngày về kho",
  contract: "Hợp đồng",
  "contract-closed": "Hợp đồng",
};
const issuesToErrors = (issues: { code: string; message: string }[], field: string): FieldError[] =>
  issues.map((i) => ({ field: ISSUE_FIELD[i.code] ?? field, message: i.message }));

/** Tải các file đã chọn; lỗi giữa chừng ⇒ gỡ file đã lên rồi báo. */
export function DialogFooter({ busy, onCancel, onSave, label, title, icon = Save }: { busy: boolean; onCancel: () => void; onSave: () => void; label: string; title: string; icon?: typeof Save }) {
  const Icon = icon;
  return (
    <>
      <Button variant="outline" onClick={onCancel}>
        Hủy
      </Button>
      <Button variant="save" onClick={onSave} title={title}>
        <Icon className="mr-2 h-4 w-4" aria-hidden />
        {busy ? "Đang tải file…" : label}
      </Button>
    </>
  );
}

/* ---------- Hợp đồng nhập (NI2, NI3) ---------- */

export type ContractFormTarget = { mode: "create" } | { mode: "edit"; contract: ImportContract };

interface LineForm {
  id: string;
  productName: string;
  /** Mặt hàng danh mục (R20); "" = chưa nối. */
  productId: string;
  /** Loại hàng (mig 0089); "" = chưa chọn. */
  goodsTypeId: string;
  kg: number | null;
  unitPrice: number | null;
}
interface ContractForm {
  key: string;
  mode: "create" | "edit";
  id: string;
  supplierId: string;
  contractNo: string;
  signedDate: string;
  importType: ImportType | "";
  currency: string;
  note: string;
  lines: LineForm[];
  initial: string;
}
const contractSnap = (f: ContractForm) => JSON.stringify([f.supplierId, f.contractNo, f.signedDate, f.importType, f.currency, f.note, f.lines]);
const blankLine = (): LineForm => ({ id: newId(), productName: "", productId: "", goodsTypeId: "", kg: null, unitPrice: null });

export interface ContractSavePayload {
  contract: ImportContract;
  lines: ImportContractLine[];
  files: ImportFile[];
  isNew: boolean;
}

export function ContractFormDialog({
  target,
  data,
  suppliers,
  setSuppliers,
  products,
  setProducts,
  recordedBy,
  onClose,
  onSave,
}: {
  target: ContractFormTarget | null;
  data: ImportData;
  /** Danh mục Mặt hàng — dòng hàng nối vào đây (ba-spec 45 v3 R20). */
  products: Product[];
  setProducts: (rows: Product[]) => boolean | void;
  /** Danh mục NCC nhập khẩu (R15 v2 — KHÔNG phải Đại lý). */
  suppliers: readonly ImportSupplier[];
  setSuppliers: (rows: ImportSupplier[]) => void;
  recordedBy: string;
  onClose: () => void;
  onSave: (p: ContractSavePayload) => boolean;
}) {
  const [form, setForm] = useState<ContractForm | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = useDialogDraft({ form: "import-contract", value: form, setValue: setForm, isEmpty: (f) => contractSnap(f) === f.initial });
  const supplierEditor = useQuickCatalogEdit("importSupplier", [...suppliers], (rows) => setSuppliers(rows));
  const productEditor = useQuickCatalogEdit("product", products, (rows) => void setProducts(rows));
  // Loại hàng (mig 0089) — chưa chạy ⇒ ẩn ô.
  const goodsPicker = useGoodsTypePicker();
  const [suggestedLines, setSuggestedLines] = useState<Set<string>>(new Set());
  // R22: máy chủ chưa chạy 0084 ⇒ không nối (không gửi product_id, khỏi kẹt hàng chờ).
  const canLink = data.productLinkAvailable !== false;

  useEffect(() => {
    if (!target) return;
    let f: ContractForm;
    if (target.mode === "create") {
      f = { key: "new", mode: "create", id: newId(), supplierId: "", contractNo: "", signedDate: "", importType: "", currency: "USD", note: "", lines: [blankLine()], initial: "" };
    } else {
      const c = target.contract;
      const lines = data.lines
        .filter((l) => l.contractId === c.id)
        .sort((a, b) => a.lineNo - b.lineNo)
        .map((l) => ({ id: l.id, productName: l.productName, productId: l.productId ?? "", goodsTypeId: l.goodsTypeId ?? "", kg: l.kg, unitPrice: c.linePrices[l.id] ?? null }));
      f = { key: c.id, mode: "edit", id: c.id, supplierId: c.supplierId, contractNo: c.contractNo, signedDate: c.signedDate, importType: c.importType, currency: c.currency, note: c.note, lines, initial: "" };
    }
    const fresh = { ...f, initial: contractSnap(f) };
    const kept = draft.takeKept();
    // Nháp lưu trước v3 không có mặt hàng của dòng ⇒ coi là chưa nối.
    setForm(kept && kept.key === fresh.key ? { ...kept, lines: kept.lines.map((l) => ({ ...l, productId: l.productId ?? "", goodsTypeId: l.goodsTypeId ?? "" })) } : fresh);
    setFiles([]);
    setErrors([]);
    setSuggestedLines(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const set = <K extends keyof ContractForm>(k: K, v: ContractForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setLine = (id: string, patch: Partial<LineForm>) => setForm((f) => (f ? { ...f, lines: f.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) } : f));

  const supplierOptions: ComboboxOption[] = selectableImportSuppliers(suppliers, form?.supplierId).map((s) => ({
    value: s.id,
    label: s.code ? `${s.code} · ${s.shortName}` : s.shortName,
    subLabel: [s.country, s.fullName].filter(Boolean).join(" · ") || undefined,
  }));
  const addSupplier = (name: string) => {
    const existing = suppliers.find((s) => s.shortName.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const s: ImportSupplier = { ...emptyImportSupplier(newId()), shortName: name.trim() };
    setSuppliers([...suppliers, s]);
    notify.saved(`Đã thêm "${s.shortName}" vào danh mục NCC nhập khẩu`);
    return s.id;
  };

  const productOptions: ComboboxOption[] = [...products]
    .sort((a, b) => a.name.localeCompare(b.name, "vi"))
    .map((p) => ({ value: p.id, label: p.name, subLabel: [p.tradeName, p.code].filter(Boolean).join(" · ") || undefined }));
  // Mặt hàng vừa thêm trong ô chưa kịp vào `products` lúc ô gọi onChange ⇒ giữ tạm để điền tên (R21).
  const createdProduct = useRef<Product | null>(null);
  const addProduct = (name: string) => {
    const existing = products.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const m: Product = { id: newId(), code: "", name: name.trim(), finishedGoodCode: "" };
    createdProduct.current = m;
    setProducts([...products, m]);
    notify.saved(`Đã thêm mặt hàng "${m.name}" vào danh mục`);
    return m.id;
  };
  /** R21 — rời ô tên hàng: dòng chưa nối mà tên ra đúng một mặt hàng ⇒ điền sẵn, ghi là gợi ý. */
  const suggestFor = (lineId: string) => {
    if (!canLink) return;
    setForm((f) => {
      if (!f) return f;
      const l = f.lines.find((x) => x.id === lineId);
      if (!l || l.productId || !l.productName.trim()) return f;
      const pid = suggestImportProductId(data, l.productName, f.supplierId, products, f.id);
      if (!pid) return f;
      setSuggestedLines((s) => new Set(s).add(lineId));
      return { ...f, lines: f.lines.map((x) => (x.id === lineId ? { ...x, productId: pid } : x)) };
    });
  };

  const save = async () => {
    if (!form || busy) return;
    const prices: Record<string, number | null> = {};
    for (const l of form.lines) prices[l.id] = l.unitPrice;
    const lines: ImportContractLine[] = form.lines.map((l, i) => ({
      id: l.id,
      contractId: form.id,
      lineNo: i + 1,
      productName: l.productName.trim(),
      ...(canLink ? { productId: l.productId } : {}),
      // Loại hàng: bảng 0089 có ⇒ cột dòng HĐ nhập cũng có (cùng migration).
      ...(goodsPicker.isAvailable ? { goodsTypeId: l.goodsTypeId } : {}),
      kg: l.kg,
      note: "",
    }));
    const head = { id: form.id, supplierId: form.supplierId, contractNo: form.contractNo.trim(), signedDate: form.signedDate, importType: form.importType };
    const errs = issuesToErrors(validateContract(head, lines, data.contracts, data), "Hợp đồng");
    for (const f of files) {
      const fe = checkImportFile(f);
      if (fe) errs.push({ field: "File hợp đồng", message: fe });
    }
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      const up = await uploadAll(files, form.id, { contractId: form.id, receiptId: "", documentId: "", uploadedBy: recordedBy });
      if ("error" in up) throw new Error(up.error);
      const old = data.contracts.find((c) => c.id === form.id);
      const supplier = suppliers.find((s) => s.id === form.supplierId);
      const contract: ImportContract = {
        id: form.id,
        supplierId: form.supplierId,
        supplierName: supplier?.shortName ?? old?.supplierName ?? "",
        contractNo: head.contractNo,
        signedDate: form.signedDate,
        importType: form.importType,
        currency: form.currency.trim() || "USD",
        linePrices: prices,
        status: old?.status ?? "open",
        closeReason: old?.closeReason ?? "",
        cancelReason: old?.cancelReason ?? "",
        note: form.note.trim(),
        createdAt: old?.createdAt ?? new Date().toISOString(),
      };
      if (!onSave({ contract, lines, files: up, isNew: form.mode === "create" })) {
        if (up.length) void removeImportFiles(up.map((x) => x.path));
        return;
      }
      draft.done();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Không tải được file lên máy chủ");
    } finally {
      setBusy(false);
    }
  };

  const totals = form ? contractTotals(form.lines, Object.fromEntries(form.lines.map((l) => [l.id, l.unitPrice]))) : null;

  return (
    <>
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o || busy) return;
        draft.dismiss();
        onClose();
      }}
      title={form?.mode === "edit" ? `Sửa hợp đồng nhập ${form.contractNo}` : "Lập hợp đồng nhập"}
      description="Ghi đúng hợp đồng đã ký với nhà cung cấp nước ngoài: số HĐ, loại hình và từng dòng hàng."
      icon={FileSignature}
      size="lg"
      hasRequiredFields
      footer={
        <DialogFooter
          busy={busy}
          onCancel={() => {
            if (busy) return;
            draft.cancel();
            onClose();
          }}
          onSave={() => void save()}
          label="Lưu hợp đồng"
          title="Ghi hợp đồng nhập. Lưu xong ghi lần nhập khi hàng sắp về."
        />
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="grid gap-5 py-2">
          <ErrorSummary errors={errors} />
          <FormSection no={1} title="Hợp đồng">
            <div className="grid gap-4 sm:grid-cols-2">
              <Combobox
                label="Đối tác (NCC nhập khẩu)"
                required
                value={form.supplierId}
                onChange={(v) => set("supplierId", v)}
                options={supplierOptions}
                onCreate={supplierEditor.canCreate ? addSupplier : undefined}
                emptyText="Chưa có NCC nhập khẩu nào — gõ tên để thêm mới."
                onEditItem={supplierEditor.openEdit}
                canEdit={supplierEditor.canEdit}
                editLabel={supplierEditor.editLabel}
              />
              <Field label="Số hợp đồng" required>
                <Input value={form.contractNo} onChange={(e) => set("contractNo", e.target.value)} aria-required />
              </Field>
              <DateField label="Ngày ký" required value={form.signedDate} onChange={(v) => set("signedDate", v)} />
              <Field label="Tiền tệ">
                <Input value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
              </Field>
            </div>
            <ChoiceGroup
              label="Loại hình nhập"
              required
              value={form.importType}
              onChange={(v) => set("importType", v as ImportType)}
              options={IMPORT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              columns={3}
            />
            <Field label="Ghi chú">
              <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
            </Field>
          </FormSection>
          <FormSection
            no={2}
            title="Dòng hàng"
            hint="Số lượng tính bằng kg. Hàng gia công không ghi giá thì để trống đơn giá. Mỗi dòng nối một mặt hàng trong danh mục; chưa nối vẫn lưu được nhưng phải nối đủ trước khi đóng hợp đồng."
          >
            {form.lines.map((l, i) => {
              const amount = lineAmount({ id: l.id, kg: l.kg }, { [l.id]: l.unitPrice });
              const locked = receivedKg(data, l.id) > 0;
              return (
                <div key={l.id} className="grid gap-3 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 font-medium">Dòng {i + 1}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      data-tour={i === 0 ? "import-line-copy" : undefined}
                      onClick={() => set("lines", insertCopiedLine(form.lines, l.id, { ...l, id: newId() }))}
                      title={`Chép dòng ${i + 1} thành dòng mới ngay dưới (giữ tên hàng, mặt hàng, số lượng, đơn giá) — chỉ sửa ô khác.`}
                    >
                      <Copy className="mr-1 h-4 w-4" aria-hidden />
                      Chép dòng
                    </Button>
                    {form.lines.length > 1 && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => set("lines", form.lines.filter((x) => x.id !== l.id))}
                        title={locked ? "Dòng này đã có thực nhập — bỏ dòng sẽ bị chặn khi lưu." : `Bỏ dòng ${i + 1} khỏi hợp đồng.`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Bỏ dòng {i + 1}</span>
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Bọc div: Field đẩy ô xuống đáy ô lưới (mt-auto) — dòng gợi ý dưới ô Mặt hàng sẽ làm lệch hai ô. */}
                    <div className="min-w-0 self-start">
                      <Field label="Tên hàng (như trên hợp đồng)" required>
                        <Input value={l.productName} onChange={(e) => setLine(l.id, { productName: e.target.value })} onBlur={() => suggestFor(l.id)} aria-required />
                      </Field>
                    </div>
                    {canLink ? (
                      <div className="grid min-w-0 gap-1">
                        <Combobox
                          label="Mặt hàng (danh mục)"
                          value={l.productId}
                          onChange={(v) => {
                            // R21: ô tên hàng còn trống ⇒ điền tên tiếng Anh mặc định (không có thì tên mặt hàng).
                            const picked = products.find((p) => p.id === v) ?? (createdProduct.current?.id === v ? createdProduct.current : undefined);
                            setLine(l.id, { productId: v, productName: productNameAfterPick(l.productName, picked) });
                            setSuggestedLines((s) => {
                              const n = new Set(s);
                              n.delete(l.id);
                              return n;
                            });
                          }}
                          options={productOptions}
                          onCreate={productEditor.canCreate ? addProduct : undefined}
                          emptyText="Chưa có mặt hàng nào trong danh mục — gõ tên để thêm mới."
                          onEditItem={productEditor.openEdit}
                          canEdit={productEditor.canEdit}
                          editLabel={productEditor.editLabel}
                        />
                        {suggestedLines.has(l.id) && <span className="text-sm text-muted-foreground">Gợi ý theo hợp đồng nhập trước / tên tiếng Anh — kiểm lại.</span>}
                      </div>
                    ) : (
                      <Field label="Mặt hàng (danh mục)">
                        <p className="text-sm text-muted-foreground">Máy chủ chưa chạy migration 0084 — chưa nối mặt hàng được. Báo chủ dự án.</p>
                      </Field>
                    )}
                  </div>
                  <div className={`grid gap-3 ${goodsPicker.isAvailable ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
                    {goodsPicker.isAvailable && (
                      <div data-tour={i === 0 ? "import-line-goods-type" : undefined} className="min-w-0">
                        <Combobox
                          label="Loại hàng"
                          value={l.goodsTypeId}
                          onChange={(v) => setLine(l.id, { goodsTypeId: v })}
                          options={goodsPicker.options}
                          onCreate={goodsPicker.onCreate}
                          emptyText="Chưa có loại hàng nào — gõ tên để thêm mới."
                          onEditItem={goodsPicker.onEditItem}
                          canEdit={goodsPicker.canEdit}
                          editLabel={goodsPicker.editLabel}
                        />
                      </div>
                    )}
                    <NumberField label="Số lượng" unit="kg" required value={l.kg} onChange={(v) => setLine(l.id, { kg: v })} />
                    <NumberField label="Đơn giá" unit={`${form.currency || "USD"}/kg`} value={l.unitPrice} onChange={(v) => setLine(l.id, { unitPrice: v })} />
                    <Field label="Thành tiền">
                      <Input readOnly value={amount === null ? "—" : `${formatMoney(amount)} ${form.currency || "USD"}`} className="tnum" />
                    </Field>
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" onClick={() => set("lines", [...form.lines, blankLine()])} title="Thêm một dòng hàng vào hợp đồng.">
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Thêm dòng
              </Button>
              {totals && (
                <span className="tnum text-sm text-muted-foreground">
                  {form.lines.length} dòng · {formatNumber(totals.totalKg)} kg
                  {totals.totalAmount !== null && ` · ${formatMoney(totals.totalAmount)} ${form.currency || "USD"}`}
                </span>
              )}
            </div>
          </FormSection>
          {hasImportStorage && (
            <Field label="File hợp đồng đã ký">
              <FilePicker files={files} onChange={setFiles} accept={IMPORT_FILE_ACCEPT} />
            </Field>
          )}
        </div>
      )}
    </FormDialog>
      {/* Hộp sửa nhanh của các ô danh mục (bút chì) — trước 2026-10-30 quên render ⇒ bút chì NCC / mặt hàng không mở. */}
      {supplierEditor.dialog}
      {productEditor.dialog}
      {goodsPicker.dialog}
    </>
  );
}

/* ---------- Lần nhập (NI4) ---------- */

export interface ReceiptFormTarget {
  contract: ImportContract;
  existing?: ImportReceipt;
}
interface ReceiptForm {
  key: string;
  id: string;
  contractId: string;
  contractNo: string;
  supplierName: string;
  isNew: boolean;
  arrivalDate: string;
  expectedDate: string;
  transport: ImportTransport;
  containerNo: string;
  blNo: string;
  note: string;
  initial: string;
}
const receiptSnap = (f: ReceiptForm) => JSON.stringify([f.arrivalDate, f.expectedDate, f.transport, f.containerNo, f.blNo, f.note]);

export function ReceiptFormDialog({
  target,
  contracts,
  onClose,
  onSave,
}: {
  target: ReceiptFormTarget | null;
  contracts: readonly ImportContract[];
  onClose: () => void;
  onSave: (r: ImportReceipt, isNew: boolean) => boolean;
}) {
  const [form, setForm] = useState<ReceiptForm | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const draft = useDialogDraft({ form: "import-receipt", value: form, setValue: setForm, isEmpty: (f) => receiptSnap(f) === f.initial });

  useEffect(() => {
    if (!target) return;
    const e = target.existing;
    const c = target.contract;
    const f: ReceiptForm = {
      key: e?.id ?? `new:${c.id}`,
      id: e?.id ?? newId(),
      contractId: c.id,
      contractNo: c.contractNo,
      supplierName: c.supplierName,
      isNew: !e,
      arrivalDate: e?.arrivalDate ?? "",
      expectedDate: e?.expectedDate ?? "",
      transport: e?.transport ?? "40RF",
      containerNo: e?.containerNo ?? "",
      blNo: e?.blNo ?? "",
      note: e?.note ?? "",
      initial: "",
    };
    const fresh = { ...f, initial: receiptSnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const set = <K extends keyof ReceiptForm>(k: K, v: ReceiptForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = () => {
    if (!form) return;
    const contract = contracts.find((c) => c.id === form.contractId);
    const errs = issuesToErrors(validateReceipt(form, contract, form.isNew), "Lần nhập");
    setErrors(errs);
    if (errs.length) return;
    const old = target?.existing;
    const r: ImportReceipt = {
      id: form.id,
      contractId: form.contractId,
      contractNo: contract?.contractNo ?? form.contractNo,
      supplierName: contract?.supplierName ?? form.supplierName,
      arrivalDate: form.arrivalDate,
      expectedDate: form.expectedDate,
      transport: form.transport,
      containerNo: form.containerNo.trim(),
      blNo: form.blNo.trim(),
      status: old?.status ?? "open",
      cancelReason: old?.cancelReason ?? "",
      note: form.note.trim(),
      createdAt: old?.createdAt ?? new Date().toISOString(),
    };
    if (onSave(r, form.isNew)) draft.done();
  };

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={form?.isNew ? `Ghi lần nhập · HĐ ${form.contractNo}` : `Sửa lần nhập · HĐ ${form?.contractNo ?? ""}`}
      description="Một lần hàng về (một cont hoặc một lô hàng lẻ). Chưa về thì ghi ngày dự kiến; về rồi ghi ngày về kho."
      icon={Ship}
      size="md"
      hasRequiredFields
      footer={
        <DialogFooter
          busy={false}
          onCancel={() => {
            draft.cancel();
            onClose();
          }}
          onSave={save}
          label="Lưu lần nhập"
          title="Ghi lần nhập. Lần nhập mới có sẵn 3 chứng từ bắt buộc để đính."
        />
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          <p className="text-sm text-muted-foreground">Cần ít nhất một ngày: ngày về kho, hoặc ngày dự kiến về khi hàng chưa tới.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label="Ngày về kho" value={form.arrivalDate} onChange={(v) => set("arrivalDate", v)} />
            <DateField label="Ngày dự kiến về" value={form.expectedDate} onChange={(v) => set("expectedDate", v)} />
          </div>
          <ChoiceGroup label="Vận chuyển" required value={form.transport} onChange={(v) => set("transport", v as ImportTransport)} options={IMPORT_TRANSPORTS} columns={3} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Số cont">
              <Input value={form.containerNo} onChange={(e) => set("containerNo", e.target.value.toUpperCase())} />
            </Field>
            <Field label="Số B/L">
              <Input value={form.blNo} onChange={(e) => set("blNo", e.target.value)} />
            </Field>
          </div>
          <Field label="Ghi chú">
            <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Chứng từ (NI5) ---------- */

export interface DocumentTarget {
  receipt: ImportReceipt;
  contract: ImportContract;
  /** Mục đang có (cập nhật) — bỏ trống ⇒ thêm chứng từ "nếu có". */
  existing?: ImportDocument;
}
interface DocumentForm {
  key: string;
  id: string;
  receiptId: string;
  contractId: string;
  isNew: boolean;
  kind: ImportDocumentKind;
  customName: string;
  docNo: string;
  docDate: string;
  importType: ImportType | "";
  notApplicable: boolean;
  naReason: string;
  note: string;
  initial: string;
}
const docSnap = (f: DocumentForm) => JSON.stringify([f.kind, f.customName, f.docNo, f.docDate, f.importType, f.notApplicable, f.naReason, f.note]);
const OPTIONAL_KINDS = IMPORT_DOCUMENT_KINDS.filter((k) => !isRequiredKind(k.value));

export function DocumentDialog({
  target,
  existingFileCount,
  recordedBy,
  onClose,
  onSave,
}: {
  target: DocumentTarget | null;
  /** Số file đang có của mục (mục cũ) — để báo "Đã có" không cần file mới. */
  existingFileCount: number;
  recordedBy: string;
  onClose: () => void;
  onSave: (doc: ImportDocument, files: ImportFile[]) => boolean;
}) {
  const [form, setForm] = useState<DocumentForm | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const draft = useDialogDraft({ form: "import-document", value: form, setValue: setForm, isEmpty: (f) => docSnap(f) === f.initial });

  useEffect(() => {
    if (!target) return;
    const e = target.existing;
    const f: DocumentForm = {
      key: e?.id ?? `new:${target.receipt.id}`,
      id: e?.id ?? newId(),
      receiptId: target.receipt.id,
      contractId: target.contract.id,
      isNew: !e,
      kind: e?.kind ?? "certificate-of-origin",
      customName: e?.customName ?? "",
      docNo: e?.docNo ?? "",
      docDate: e?.docDate ?? "",
      importType: e?.importType ?? (e?.kind === "import-declaration" ? target.contract.importType : ""),
      notApplicable: e?.notApplicable ?? false,
      naReason: e?.naReason ?? "",
      note: e?.note ?? "",
      initial: "",
    };
    const fresh = { ...f, initial: docSnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setFiles([]);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const set = <K extends keyof DocumentForm>(k: K, v: DocumentForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const required = form ? isRequiredKind(form.kind) : false;
  const isDeclaration = form?.kind === "import-declaration";

  const save = async () => {
    if (!form || busy) return;
    const errs: FieldError[] = [];
    if (form.kind === "other" && !form.customName.trim()) errs.push({ field: "Tên chứng từ", message: "Ghi tên chứng từ (VD L/C, giấy ATTP)" });
    if (form.notApplicable && !form.naReason.trim()) errs.push({ field: "Lý do không áp dụng", message: "Ghi lý do lô này không có chứng từ này" });
    for (const f of files) {
      const fe = checkImportFile(f);
      if (fe) errs.push({ field: "File", message: fe });
    }
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    try {
      const up = form.notApplicable ? [] : await uploadAll(files, form.contractId, { contractId: form.contractId, receiptId: form.receiptId, documentId: form.id, uploadedBy: recordedBy });
      if ("error" in up) throw new Error(up.error);
      const doc: ImportDocument = {
        id: form.id,
        receiptId: form.receiptId,
        kind: form.kind,
        customName: form.kind === "other" ? form.customName.trim() : "",
        docNo: form.docNo.trim(),
        docDate: form.docDate,
        importType: isDeclaration ? form.importType : "",
        notApplicable: required && form.notApplicable,
        naReason: required && form.notApplicable ? form.naReason.trim() : "",
        note: form.note.trim(),
        createdAt: target?.existing?.createdAt ?? new Date().toISOString(),
      };
      if (!onSave(doc, up)) {
        if (up.length) void removeImportFiles(up.map((x) => x.path));
        return;
      }
      draft.done();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Không tải được file lên máy chủ");
    } finally {
      setBusy(false);
    }
  };

  const title = form ? (form.isNew ? "Thêm chứng từ" : documentLabel(form)) : "";
  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o || busy) return;
        draft.dismiss();
        onClose();
      }}
      title={`${title} · lần nhập HĐ ${target?.contract.contractNo ?? ""}`}
      description={
        required
          ? "Chứng từ bắt buộc: xong khi có file (tờ khai cần thêm số tờ khai và loại hình). Lô không có chứng từ này thì chọn Không áp dụng và ghi lý do."
          : "Chứng từ có thì đính (C/O, giấy kiểm dịch, B/L hoặc chứng từ khác). Không bắt buộc để lô đủ hồ sơ."
      }
      icon={FileCheck2}
      size="md"
      hasRequiredFields
      footer={
        <DialogFooter
          busy={busy}
          onCancel={() => {
            if (busy) return;
            draft.cancel();
            onClose();
          }}
          onSave={() => void save()}
          label="Lưu chứng từ"
          title="Ghi số, ngày và file của chứng từ."
        />
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="grid gap-4 py-2">
          <ErrorSummary errors={errors} />
          {form.isNew && (
            <ChoiceGroup label="Loại chứng từ" required value={form.kind} onChange={(v) => set("kind", v as ImportDocumentKind)} options={OPTIONAL_KINDS} columns={2} />
          )}
          {form.kind === "other" && (
            <Field label="Tên chứng từ" required>
              <Input value={form.customName} onChange={(e) => set("customName", e.target.value)} aria-required />
            </Field>
          )}
          {required && (
            <ChoiceGroup
              label="Lô này có chứng từ này không?"
              required
              value={form.notApplicable ? "na" : "has"}
              onChange={(v) => set("notApplicable", v === "na")}
              options={[
                { value: "has", label: "Có" },
                { value: "na", label: "Không áp dụng" },
              ]}
            />
          )}
          {form.notApplicable ? (
            <Field label="Lý do không áp dụng" required>
              <Textarea rows={2} value={form.naReason} onChange={(e) => set("naReason", e.target.value)} aria-required />
            </Field>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={isDeclaration ? "Số tờ khai" : "Số chứng từ"} required={isDeclaration}>
                  <Input value={form.docNo} onChange={(e) => set("docNo", e.target.value)} />
                </Field>
                <DateField label="Ngày" value={form.docDate} onChange={(v) => set("docDate", v)} />
              </div>
              {isDeclaration && (
                <ChoiceGroup
                  label="Loại hình"
                  required
                  value={form.importType}
                  onChange={(v) => set("importType", v as ImportType)}
                  options={IMPORT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                  columns={3}
                />
              )}
              {hasImportStorage ? (
                <Field label={existingFileCount ? `Thêm file (đang có ${existingFileCount} file)` : "File chứng từ"} required={required && !existingFileCount}>
                  <FilePicker files={files} onChange={setFiles} accept={IMPORT_FILE_ACCEPT} />
                </Field>
              ) : (
                <p role="status" className="rounded-lg bg-warning-surface px-4 py-2 text-sm">
                  Đang chạy không nối máy chủ: chưa đính được file. Số chứng từ (hoặc ghi chú) được tính thay file.
                </p>
              )}
            </>
          )}
          <Field label="Ghi chú">
            <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Số lượng thực nhập (NI6) ---------- */

export interface QuantityTarget {
  receipt: ImportReceipt;
}
interface QuantityForm {
  key: string;
  receiptId: string;
  label: string;
  kg: Record<string, number | null>;
  initial: string;
}
const qtySnap = (f: QuantityForm) => JSON.stringify(f.kg);

export function QuantityDialog({
  target,
  data,
  recordedBy,
  onClose,
  onSave,
}: {
  target: QuantityTarget | null;
  data: ImportData;
  recordedBy: string;
  onClose: () => void;
  onSave: (receiptId: string, rows: ImportReceiptLine[]) => boolean;
}) {
  const [form, setForm] = useState<QuantityForm | null>(null);
  const draft = useDialogDraft({ form: "import-quantity", value: form, setValue: setForm, isEmpty: (f) => qtySnap(f) === f.initial });

  useEffect(() => {
    if (!target) return;
    const r = target.receipt;
    const kg: Record<string, number | null> = {};
    for (const l of data.lines.filter((x) => x.contractId === r.contractId)) kg[l.id] = data.receiptLines.find((x) => x.receiptId === r.id && x.contractLineId === l.id)?.kg ?? null;
    const f: QuantityForm = { key: r.id, receiptId: r.id, label: `HĐ ${r.contractNo} · ${r.supplierName}`, kg, initial: "" };
    const fresh = { ...f, initial: qtySnap(f) };
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const receipt = form ? data.receipts.find((r) => r.id === form.receiptId) : undefined;
  const lines = receipt ? data.lines.filter((l) => l.contractId === receipt.contractId).sort((a, b) => a.lineNo - b.lineNo) : [];
  const rows = (f: QuantityForm): ImportReceiptLine[] =>
    lines
      .filter((l) => f.kg[l.id] != null)
      .map((l) => {
        const old = data.receiptLines.find((x) => x.receiptId === f.receiptId && x.contractLineId === l.id);
        return { id: old?.id ?? newId(), receiptId: f.receiptId, contractLineId: l.id, kg: f.kg[l.id] ?? null, recordedBy, updatedAt: new Date().toISOString() };
      });
  const preview = form ? { ...data, receiptLines: [...data.receiptLines.filter((x) => x.receiptId !== form.receiptId), ...rows(form)] } : data;
  const warnings = form ? quantityWarnings(preview, form.receiptId) : [];

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o) return;
        draft.dismiss();
        onClose();
      }}
      title={`Ghi thực nhập · ${form?.label ?? ""}`}
      description="Số kg thực nhập của từng dòng hàng trong lô này, lấy theo invoice. Dòng không có trong lô thì để trống."
      icon={PackageCheck}
      size="md"
      footer={
        <DialogFooter
          busy={false}
          onCancel={() => {
            draft.cancel();
            onClose();
          }}
          onSave={() => {
            if (form && onSave(form.receiptId, rows(form))) draft.done();
          }}
          label="Lưu thực nhập"
          title="Ghi số lượng thực nhập của lô. Vượt hợp đồng vẫn lưu, chỉ cảnh báo."
        />
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && (
        <div className="grid gap-4 py-2">
          {lines.length === 0 && <p className="rounded-lg bg-muted px-4 py-3">Hợp đồng chưa có dòng hàng.</p>}
          {lines.map((l) => {
            const other = Math.round((receivedKg(data, l.id) - (data.receiptLines.find((x) => x.receiptId === form.receiptId && x.contractLineId === l.id)?.kg ?? 0)) * 100) / 100;
            const w = warnings.find((x) => x.contractLineId === l.id);
            return (
              <div key={l.id} className="grid gap-2 rounded-lg border border-border p-3">
                <div className="grid gap-0.5">
                  <span className="font-medium break-words">{l.productName}</span>
                  <LineProductLabel data={data} line={l} />
                  <span className="tnum text-sm text-muted-foreground">
                    HĐ {formatNumber(l.kg ?? 0)} kg · đã về ở lô khác {formatNumber(other)} kg
                  </span>
                </div>
                <NumberField label="Thực nhập lô này" unit="kg" value={form.kg[l.id] ?? null} onChange={(v) => setForm((f) => (f ? { ...f, kg: { ...f.kg, [l.id]: v } } : f))} />
                {w && (
                  <p role="status" className="rounded-lg bg-warning-surface px-3 py-2 text-sm">
                    Vượt hợp đồng {formatNumber(w.overKg)} kg — vẫn lưu được.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </FormDialog>
  );
}

/* ---------- Đóng hợp đồng (NI8) ---------- */

export interface CloseTarget {
  contract: ImportContract;
  needsReason: boolean;
  /** "Frozen skate wing còn 500 kg" … */
  shortLines: string[];
  onConfirm: (reason: string) => void;
}

export function CloseContractDialog({ target, onClose }: { target: CloseTarget | null; onClose: () => void }) {
  const [forTarget, setForTarget] = useState(target);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (forTarget !== target) {
    setForTarget(target);
    setReason("");
    setError("");
  }
  return (
    <FormDialog
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={`Đóng hợp đồng nhập ${target?.contract.contractNo ?? ""}`}
      description="Đóng rồi thì không ghi lần nhập mới. Mở lại được khi cần."
      icon={Lock}
      size="sm"
      hasRequiredFields={target?.needsReason}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="lock"
            title="Đóng hợp đồng nhập."
            onClick={() => {
              if (target?.needsReason && !reason.trim()) {
                setError("Hợp đồng còn hàng chưa về đủ — ghi lý do đóng");
                return;
              }
              target?.onConfirm(reason.trim());
              onClose();
            }}
          >
            <Lock className="mr-2 h-4 w-4" aria-hidden />
            Đóng hợp đồng
          </Button>
        </>
      }
    >
      {target && (
        <div className="grid gap-3 py-2">
          {target.shortLines.length > 0 ? (
            <div className="rounded-lg bg-warning-surface px-4 py-3">
              <p className="font-medium">Còn thiếu so với hợp đồng:</p>
              <ul className="list-disc pl-5">
                {target.shortLines.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-lg bg-muted px-4 py-3">Mọi dòng hàng đã về đủ.</p>
          )}
          <Field label="Lý do" required={target.needsReason} error={error}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}
