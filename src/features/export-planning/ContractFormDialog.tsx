// ============================================================
// Tên file: src/features/export-planning/ContractFormDialog.tsx
// Tên tiếng Việt: Hộp lập hợp đồng / sửa bản chờ duyệt / ghi bản sửa (rvs, phụ kiện, tu chỉnh L/C)
// Description: Contract dossier form: header, payment + L/C, tolerance, deadline, required
//              documents, product lines (carton / bundle), signed file. Draft-saved (rule 17).
// ============================================================
// Luật: ba-spec 41 NV3 / NV5, R2 (tổng hai cách đếm), R3 (bản sửa KHÔNG ghi đè — ghi bản mới),
// R9 (số HĐ duy nhất theo khách, hạn giao bắt buộc). Tính toán ở lib/exportPlanning.ts.
import { useEffect, useRef, useState } from "react";
import {
  Button,
  ChoiceGroup,
  Combobox,
  DateField,
  ErrorSummary,
  Field,
  FormDialog,
  Input,
  NumberField,
  Textarea,
  formatNumber,
  notify,
  todayIso,
  type ComboboxOption,
  type FieldError,
} from "@/design-system";
import { DraftRestoredNotice } from "@/features/shared/DraftRestoredNotice";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import {
  DOCUMENT_KINDS,
  INCOTERMS,
  PAYMENT_METHODS,
  computedLineKg,
  contractTotals,
  emptyTerms,
  lineAmount,
  lineKg,
  suggestProductId,
  unmappedLines,
  validateContract,
  type ExportData,
} from "@/lib/exportPlanning";
import { formatMoney } from "@/lib/format";
import { checkExportFile, exportFilePath, hasExportStorage, removeExportFiles, uploadExportFile } from "@/lib/exportFileStorage";
import type { Customer, ExportContract, ExportContractLine, ExportContractRevision, ExportContractTerms, ExportDocumentKind, Product } from "@/types";
import { FileSignature, Plus, Save, Trash2 } from "lucide-react";
import { FilePicker } from "./parts";

export type ContractFormTarget =
  | { mode: "create" }
  | { mode: "edit"; contract: ExportContract; revision: ExportContractRevision }
  | { mode: "revise"; contract: ExportContract; base: ExportContractRevision; revisionNo: number };

interface ContractForm {
  key: string;
  mode: ContractFormTarget["mode"];
  contractId: string;
  revisionId: string;
  revisionNo: number;
  customerId: string;
  contractNo: string;
  signedOn: string;
  orderRef: string;
  note: string;
  revisedOn: string;
  changeSummary: string;
  terms: ExportContractTerms;
  lines: ExportContractLine[];
  /** File ký đang có (sửa bản chờ duyệt) — giữ nếu không chọn file mới. */
  filePath: string;
  fileName: string;
  initial: string;
}

const snapshot = (f: ContractForm) =>
  JSON.stringify([f.customerId, f.contractNo, f.signedOn, f.orderRef, f.note, f.revisedOn, f.changeSummary, f.terms, f.lines]);

const blankLine = (): ExportContractLine => ({
  id: newId(),
  description: "",
  hsCode: "",
  size: "",
  packing: "",
  unitKind: "carton",
  cartonsPerUnit: 1,
  netKgPerCarton: null,
  quantity: null,
  kg: null,
  unitPrice: null,
  microSpec: "",
});

/** Bộ chứng từ hay gặp (HĐ Nhật SCM): Invoice · PL · B/L · H/C tự cấp · C/O form VJ. */
const COMMON_DOCUMENTS: ExportContractTerms["requiredDocuments"] = [
  { kind: "commercial-invoice", form: "", issuer: "" },
  { kind: "packing-list", form: "", issuer: "" },
  { kind: "bill-of-lading", form: "", issuer: "" },
  { kind: "health-certificate", form: "", issuer: "công ty tự cấp" },
  { kind: "certificate-of-origin", form: "VJ", issuer: "" },
];

function formFor(target: ContractFormTarget, today: string): ContractForm {
  let f: ContractForm;
  if (target.mode === "create") {
    f = {
      key: "create",
      mode: "create",
      contractId: newId(),
      revisionId: newId(),
      revisionNo: 0,
      customerId: "",
      contractNo: "",
      signedOn: today,
      orderRef: "",
      note: "",
      revisedOn: today,
      changeSummary: "",
      terms: emptyTerms(),
      lines: [blankLine()],
      filePath: "",
      fileName: "",
      initial: "",
    };
  } else {
    const c = target.contract;
    const r = target.mode === "edit" ? target.revision : target.base;
    f = {
      key: `${target.mode}:${c.id}:${target.mode === "edit" ? r.id : target.revisionNo}`,
      mode: target.mode,
      contractId: c.id,
      revisionId: target.mode === "edit" ? r.id : newId(),
      revisionNo: target.mode === "edit" ? r.revisionNo : target.revisionNo,
      customerId: c.customerId,
      contractNo: c.contractNo,
      signedOn: c.signedOn,
      orderRef: c.orderRef,
      note: c.note,
      revisedOn: target.mode === "edit" ? r.revisedOn : today,
      changeSummary: target.mode === "edit" ? r.changeSummary : "",
      terms: structuredClone(r.terms),
      lines: r.lines.map((l) => ({ ...l, id: target.mode === "edit" ? l.id : newId() })),
      filePath: target.mode === "edit" ? r.filePath : "",
      fileName: target.mode === "edit" ? r.fileName : "",
      initial: "",
    };
  }
  return { ...f, initial: snapshot(f) };
}

export interface ContractSavePayload {
  mode: ContractFormTarget["mode"];
  contract: ExportContract;
  revision: ExportContractRevision;
}

export function ContractFormDialog({
  target,
  contracts,
  customers,
  setCustomers,
  products,
  setProducts,
  data,
  recordedBy,
  canSeePrice,
  onClose,
  onSave,
}: {
  target: ContractFormTarget | null;
  contracts: readonly ExportContract[];
  customers: Customer[];
  setCustomers: (rows: Customer[]) => boolean | void;
  /** Danh mục mặt hàng (mở) — mỗi dòng hàng nối một mặt hàng; 141 mã kế toán chỉ ánh xạ qua đây. */
  products: Product[];
  setProducts: (rows: Product[]) => boolean | void;
  /** Dữ liệu module — gợi ý mặt hàng theo tên tiếng Anh đã nối ở HĐ trước. */
  data: Pick<ExportData, "contracts" | "revisions">;
  recordedBy: string;
  canSeePrice: boolean;
  onClose: () => void;
  onSave: (p: ContractSavePayload) => boolean;
}) {
  const today = todayIso();
  const [form, setForm] = useState<ContractForm | null>(null);
  const [file, setFile] = useState<File[]>([]);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  /** Dòng đã mở phần "mã HS, vi sinh" (chỉ trình bày, không lưu). */
  const [openLines, setOpenLines] = useState<Set<string>>(new Set());
  const draft = useDialogDraft({ form: "export-contract", value: form, setValue: setForm, isEmpty: (f) => snapshot(f) === f.initial });
  const customerEditor = useQuickCatalogEdit("customer", customers, (rows) => void setCustomers(rows));
  const productEditor = useQuickCatalogEdit("product", products, (rows) => void setProducts(rows));
  /** Dòng vừa được tự gợi ý mặt hàng (chỉ để hiện dòng nhắc "kiểm lại", không lưu). */
  const [suggestedLines, setSuggestedLines] = useState<Set<string>>(new Set());
  const productOptions: ComboboxOption[] = products.map((m) => ({ value: m.id, label: m.code ? `${m.code} · ${m.name}` : m.name, subLabel: m.code || undefined }));
  const addProduct = (name: string) => {
    const existing = products.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const m: Product = { id: newId(), code: "", name, finishedGoodCode: "" };
    setProducts([...products, m]);
    notify.saved(`Đã thêm mặt hàng "${name}" vào danh mục`);
    return m.id;
  };
  /** Rời ô tên tiếng Anh: dòng chưa nối mà tên đã từng nối ở HĐ trước ⇒ điền sẵn mặt hàng đó. */
  const suggestFor = (lineId: string) => {
    setForm((f) => {
      if (!f) return f;
      const l = f.lines.find((x) => x.id === lineId);
      if (!l || l.productId || !l.description.trim()) return f;
      const pid = suggestProductId(data, l.description, f.customerId);
      if (!pid || !products.some((p) => p.id === pid)) return f;
      setSuggestedLines((s) => new Set(s).add(lineId));
      return { ...f, lines: f.lines.map((x) => (x.id === lineId ? { ...x, productId: pid } : x)) };
    });
  };

  useEffect(() => {
    if (!target) return;
    const fresh = formFor(target, today);
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setFile([]);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const set = <K extends keyof ContractForm>(k: K, v: ContractForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setTerm = <K extends keyof ExportContractTerms>(k: K, v: ExportContractTerms[K]) =>
    setForm((f) => (f ? { ...f, terms: { ...f.terms, [k]: v } } : f));
  const setLine = (id: string, patch: Partial<ExportContractLine>) =>
    setForm((f) => (f ? { ...f, lines: f.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) } : f));

  const customerOptions: ComboboxOption[] = customers.map((c) => ({ value: c.id, label: c.code ? `${c.code} · ${c.name}` : c.name }));
  const addCustomer = (name: string) => {
    const existing = customers.find((k) => k.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const k: Customer = { id: newId(), code: "", name, market: "" };
    setCustomers([...customers, k]);
    notify.saved(`Đã thêm khách hàng "${name}" vào danh mục`);
    return k.id;
  };
  /** Chọn khách ⇒ điền sẵn cảng đích + thanh toán từ danh mục (nếu ô còn trống). */
  const pickCustomer = (id: string) => {
    const c = customers.find((x) => x.id === id);
    setForm((f) =>
      f
        ? {
            ...f,
            customerId: id,
            terms: {
              ...f.terms,
              portOfDischarge: f.terms.portOfDischarge || c?.defaultPort || "",
            },
          }
        : f,
    );
  };

  const identityLocked = form?.mode === "revise" || (form?.mode === "edit" && form.revisionNo > 0);

  const save = async () => {
    // Không đòi `target`: tải lại trang thì hộp mở lại từ NHÁP (target rỗng) — Lưu vẫn phải chạy.
    if (!form || isUploading) return;
    const issues = validateContract(
      { id: form.contractId, customerId: form.customerId, contractNo: form.contractNo, signedOn: form.signedOn, terms: form.terms, lines: form.lines },
      contracts,
    );
    const errs: FieldError[] = issues.map((i) => ({ field: i.label, message: i.message }));
    if (form.mode === "revise" && !form.changeSummary.trim()) errs.push({ field: "Nội dung sửa", message: "Ghi bản sửa đổi gì (VD: giảm dòng 1 còn 180 thùng)" });
    const fileErr = file[0] ? checkExportFile(file[0]) : null;
    if (fileErr) errs.push({ field: "File hợp đồng", message: fileErr });
    setErrors(errs);
    if (errs.length) return;

    setIsUploading(true);
    let uploaded = "";
    try {
      let filePath = form.filePath;
      let fileName = form.fileName;
      if (file[0] && hasExportStorage) {
        const r = await uploadExportFile(exportFilePath(form.contractId, "contract", form.revisionId, file[0].name), file[0]);
        if ("error" in r) throw new Error(r.error);
        uploaded = r.path;
        filePath = r.path;
        fileName = r.fileName;
      }
      const lines = form.lines.filter((l) => l.description.trim() || l.quantity != null || l.kg != null);
      const prev = contracts.find((c) => c.id === form.contractId);
      const ok = onSave({
        mode: form.mode,
        contract: {
          id: form.contractId,
          customerId: form.customerId,
          contractNo: form.contractNo.trim(),
          signedOn: form.signedOn,
          orderRef: form.orderRef.trim(),
          status: prev?.status ?? "open",
          cancelReason: prev?.cancelReason ?? "",
          closeReason: prev?.closeReason ?? "",
          note: form.note.trim(),
          createdAt: prev?.createdAt ?? new Date().toISOString(),
        },
        revision: {
          id: form.revisionId,
          contractId: form.contractId,
          revisionNo: form.revisionNo,
          // Bản 0 không có ô "Ngày của bản này" ⇒ lấy ngày ký (trước đây rơi về ngày lập trên app).
          revisedOn: form.mode === "create" ? form.signedOn : form.revisedOn || form.signedOn,
          changeSummary: form.changeSummary.trim(),
          terms: form.terms,
          lines,
          filePath,
          fileName,
          recordedBy,
          createdAt: new Date().toISOString(),
        },
      });
      if (!ok) {
        if (uploaded) void removeExportFiles([uploaded]);
        return;
      }
      draft.done();
    } catch (e) {
      if (uploaded) void removeExportFiles([uploaded]);
      notify.error(e instanceof Error ? e.message : "Không tải được file lên máy chủ");
    } finally {
      setIsUploading(false);
    }
  };

  const totals = form ? contractTotals(form.lines) : null;
  // Lúc hộp đang mờ dần để đóng (form đã về null) vẫn giữ tiêu đề cũ — khỏi nhảy chữ.
  const shown = useRef<ContractForm | null>(null);
  if (form) shown.current = form;
  const head = form ?? shown.current;
  const title =
    head?.mode === "revise"
      ? `Ghi bản sửa ${head.revisionNo} · HĐ ${head.contractNo}`
      : head?.mode === "edit"
        ? `Sửa bản ${head.revisionNo} đang chờ duyệt · HĐ ${head.contractNo}`
        : "Lập hợp đồng xuất khẩu";
  const currency = form?.terms.currency || "USD";
  const setDocs = (docs: ExportContractTerms["requiredDocuments"]) => setTerm("requiredDocuments", docs);

  return (
    <FormDialog
      open={!!form}
      onOpenChange={(o) => {
        if (o || isUploading) return;
        draft.dismiss();
        onClose();
      }}
      title={title}
      description={
        head?.mode === "revise"
          ? "Bản đang hiệu lực giữ nguyên và vẫn tra lại được. Bản sửa có hiệu lực khi ghi kết quả BGĐ đồng ý."
          : "Ghi đúng như hợp đồng giấy. Lưu xong hợp đồng ở trạng thái chờ duyệt — ghi kết quả BGĐ ký ở bước sau."
      }
      icon={FileSignature}
      size="xl"
      hasRequiredFields
      footer={
        <>
          {totals && (
            <span className="tnum mr-auto min-w-0 text-sm text-muted-foreground">
              {form?.lines.filter((l) => l.description.trim() || l.quantity != null).length ?? 0} dòng · {formatNumber(totals.units)} thùng/kiện
              {totals.cartons !== totals.units ? ` (${formatNumber(totals.cartons)} thùng)` : ""} · <b className="text-foreground">{formatNumber(totals.kg)} kg</b>
              {canSeePrice ? (
                <>
                  {" "}
                  · <b className="text-foreground">{formatMoney(totals.amount)} {currency}</b>
                </>
              ) : null}
              {form && unmappedLines(form.lines).length ? ` · ${unmappedLines(form.lines).length} dòng chưa nối danh mục` : ""}
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => {
              if (isUploading) return;
              draft.cancel();
              onClose();
            }}
          >
            Hủy
          </Button>
          <Button variant="save" onClick={() => void save()} title="Tải file (nếu có) và lưu hợp đồng / bản sửa này.">
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {isUploading ? "Đang tải file…" : form?.mode === "revise" ? "Lưu bản sửa" : "Lưu hợp đồng"}
          </Button>
        </>
      }
    >
      <DraftRestoredNotice savedAt={draft.restoredAt} onDiscard={draft.cancel} />
      {form && totals && (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 py-2">
          <ErrorSummary errors={errors} />

          <FormSection no={1} title="Hợp đồng" hint="VD số HĐ: 18.26/BSF-SCM.2026 · số đơn của khách: #B182">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {identityLocked ? (
                <Field label="Khách hàng">
                  <Input value={customers.find((c) => c.id === form.customerId)?.name ?? ""} readOnly />
                </Field>
              ) : (
                <Combobox
                  label="Khách hàng"
                  required
                  value={form.customerId}
                  onChange={pickCustomer}
                  options={customerOptions}
                  onCreate={customerEditor.canCreate ? addCustomer : undefined}
                  emptyText="Chưa có khách hàng nào trong danh mục."
                  onEditItem={customerEditor.openEdit}
                  canEdit={customerEditor.canEdit}
                  editLabel={customerEditor.editLabel}
                />
              )}
              <Field label="Số hợp đồng" required>
                <Input value={form.contractNo} readOnly={identityLocked} onChange={(e) => set("contractNo", e.target.value)} aria-required />
              </Field>
              <DateField label="Ngày ký" required value={form.signedOn} onChange={(v) => set("signedOn", v)} />
              <Field label="Số đơn của khách">
                <Input value={form.orderRef} onChange={(e) => set("orderRef", e.target.value)} />
              </Field>
            </div>
            {form.mode !== "create" && (
              <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                <DateField label="Ngày của bản này" value={form.revisedOn} onChange={(v) => set("revisedOn", v)} />
                <Field label={form.mode === "revise" ? "Nội dung sửa (bản này đổi gì)" : "Nội dung sửa"} required={form.mode === "revise"}>
                  <Input value={form.changeSummary} onChange={(e) => set("changeSummary", e.target.value)} />
                </Field>
              </div>
            )}
          </FormSection>

          <FormSection no={2} title="Điều khoản & thanh toán" hint="Dung sai áp cho cả lượng lẫn tiền — trống là 0%. Loại cont VD: 40RF.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Combobox
                label="Incoterm"
                hideRequiredMark
                value={form.terms.incoterm}
                onChange={(v) => setTerm("incoterm", v)}
                options={INCOTERMS.map((x) => ({ value: x, label: x }))}
              />
              <Field label="Cảng xếp">
                <Input value={form.terms.portOfLoading} onChange={(e) => setTerm("portOfLoading", e.target.value)} />
              </Field>
              <Field label="Cảng đích">
                <Input value={form.terms.portOfDischarge} onChange={(e) => setTerm("portOfDischarge", e.target.value)} />
              </Field>
              <DateField label="Hạn giao muộn nhất" required value={form.terms.latestShipmentDate} onChange={(v) => setTerm("latestShipmentDate", v)} />
              <NumberField label="Dung sai ±" unit="%" value={form.terms.tolerancePct} onChange={(v) => setTerm("tolerancePct", v)} />
              <Field label="Tiền tệ">
                <Input value={form.terms.currency} onChange={(e) => setTerm("currency", e.target.value.toUpperCase())} />
              </Field>
              <NumberField label="Số container" unit="cont" value={form.terms.containerCount} onChange={(v) => setTerm("containerCount", v)} />
              <Field label="Loại container">
                <Input value={form.terms.containerType} onChange={(e) => setTerm("containerType", e.target.value)} />
              </Field>
              <NumberField label="Đặt cọc" unit="%" value={form.terms.depositPct} onChange={(v) => setTerm("depositPct", v)} />
            </div>
            <ChoiceGroup
              label="Thanh toán"
              value={form.terms.paymentMethod}
              onChange={(v) => setTerm("paymentMethod", v as ExportContractTerms["paymentMethod"])}
              options={PAYMENT_METHODS}
              columns={3}
            />
            {form.terms.paymentMethod === "lc" && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Số L/C" required>
                  <Input value={form.terms.lcNo} onChange={(e) => setTerm("lcNo", e.target.value)} aria-required />
                </Field>
                <DateField label="L/C hết hạn" value={form.terms.lcExpiry} onChange={(v) => setTerm("lcExpiry", v)} />
                <DateField label="Hạn giao theo L/C" value={form.terms.lcLatestShipment} onChange={(v) => setTerm("lcLatestShipment", v)} />
              </div>
            )}
          </FormSection>

          <FormSection
            no={3}
            title="Chứng từ khách yêu cầu"
            hint="Mỗi chuyến tự có sẵn các mục này ở bước Bộ chứng từ. Ghi form (VD C/O form VJ) và người cấp (VD H/C công ty tự cấp)."
            action={
              <div className="flex flex-wrap gap-2">
                {!form.terms.requiredDocuments.length && (
                  <Button size="sm" variant="outline" onClick={() => setDocs(COMMON_DOCUMENTS)} title="Điền nhanh bộ hay gặp: Invoice, Packing List, B/L, H/C tự cấp, C/O form VJ — sửa lại nếu khác.">
                    Điền bộ hay gặp
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setDocs([...form.terms.requiredDocuments, { kind: "other", form: "", issuer: "" }])} title="Thêm một chứng từ khách yêu cầu.">
                  <Plus className="mr-1 h-4 w-4" aria-hidden />
                  Thêm chứng từ
                </Button>
              </div>
            }
          >
            {!form.terms.requiredDocuments.length && <p className="text-sm text-muted-foreground">Chưa có. Bấm "Điền bộ hay gặp" hoặc thêm từng chứng từ hợp đồng bắt buộc.</p>}
            {form.terms.requiredDocuments.length > 0 && (
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
                {form.terms.requiredDocuments.map((d, i) => (
                  <div key={i} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <Combobox
                      label={`Chứng từ ${i + 1}`}
                      hideRequiredMark
                      clearable={false}
                      value={d.kind}
                      onChange={(v) => setDocs(form.terms.requiredDocuments.map((x, j) => (j === i ? { ...x, kind: (v || "other") as ExportDocumentKind } : x)))}
                      options={DOCUMENT_KINDS.map((k) => ({ value: k.value, label: k.label }))}
                    />
                    <Field label="Form">
                      <Input value={d.form} onChange={(e) => setDocs(form.terms.requiredDocuments.map((x, j) => (j === i ? { ...x, form: e.target.value } : x)))} />
                    </Field>
                    <Field label="Người cấp">
                      <Input value={d.issuer} onChange={(e) => setDocs(form.terms.requiredDocuments.map((x, j) => (j === i ? { ...x, issuer: e.target.value } : x)))} />
                    </Field>
                    <Button variant="danger" onClick={() => setDocs(form.terms.requiredDocuments.filter((_, j) => j !== i))} title={`Bỏ chứng từ ${i + 1} khỏi danh sách yêu cầu.`}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Bỏ chứng từ</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          <FormSection
            no={4}
            title="Dòng hàng"
            hint="Tên hàng ghi đúng chữ trên HĐ (tiếng Anh); Mặt hàng (danh mục) nối dòng với danh mục của xưởng — lập HĐ chưa bắt buộc, nhưng Lệnh sản xuất chỉ xong khi mọi dòng đã nối. Kg tự tính = số thùng × kg tịnh mỗi thùng (theo kiện thì nhân thêm số thùng mỗi kiện); gõ đè nếu HĐ ghi khác."
          >
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              {form.lines.map((l, i) => {
                const auto = computedLineKg(l);
                const isOpen = openLines.has(l.id) || !!l.hsCode || !!l.microSpec;
                return (
                  <div key={l.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Dòng {i + 1}</span>
                      <span className="tnum min-w-0 flex-1 text-sm text-muted-foreground">
                        {formatNumber(lineKg(l))} kg{canSeePrice ? ` · ${formatMoney(lineAmount(l))} ${currency}` : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setForm((f) => (f ? { ...f, lines: f.lines.filter((x) => x.id !== l.id) } : f))}
                        title={`Bỏ dòng ${i + 1} khỏi hợp đồng.`}
                      >
                        <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                        Bỏ dòng
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.2fr)]">
                      <Field label="Tên hàng (như trên HĐ)" required>
                        <Input value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} onBlur={() => suggestFor(l.id)} aria-required />
                      </Field>
                      <div className="grid min-w-0 gap-1">
                        <Combobox
                          label="Mặt hàng (danh mục)"
                          value={l.productId ?? ""}
                          onChange={(v) => {
                            setLine(l.id, { productId: v || undefined });
                            setSuggestedLines((s) => {
                              const n = new Set(s);
                              n.delete(l.id);
                              return n;
                            });
                          }}
                          options={productOptions}
                          onCreate={productEditor.canCreate ? addProduct : undefined}
                          emptyText="Chưa có mặt hàng nào trong danh mục."
                          onEditItem={productEditor.openEdit}
                          canEdit={productEditor.canEdit}
                          editLabel={productEditor.editLabel}
                        />
                        {suggestedLines.has(l.id) && <span className="text-sm text-muted-foreground">Gợi ý theo HĐ trước cùng tên hàng — kiểm lại.</span>}
                      </div>
                      <Field label="Size">
                        <Input value={l.size} onChange={(e) => setLine(l.id, { size: e.target.value })} />
                      </Field>
                      <Field label="Quy cách đóng gói">
                        <Input value={l.packing} onChange={(e) => setLine(l.id, { packing: e.target.value })} />
                      </Field>
                    </div>
                    <div
                      className={`grid gap-3 sm:grid-cols-3 ${l.unitKind === "bundle" ? "lg:grid-cols-[minmax(11rem,1.3fr)_repeat(5,minmax(0,1fr))]" : "lg:grid-cols-[minmax(11rem,1.3fr)_repeat(4,minmax(0,1fr))]"}`}
                    >
                      <ChoiceGroup
                        label="Đếm theo"
                        hideRequiredMark
                        value={l.unitKind}
                        onChange={(v) => setLine(l.id, { unitKind: v === "bundle" ? "bundle" : "carton", cartonsPerUnit: v === "bundle" ? Math.max(2, l.cartonsPerUnit) : 1 })}
                        options={[
                          { value: "carton", label: "Thùng" },
                          { value: "bundle", label: "Kiện" },
                        ]}
                        columns={2}
                      />
                      {l.unitKind === "bundle" && <NumberField label="Thùng / kiện" unit="thùng" value={l.cartonsPerUnit} onChange={(v) => setLine(l.id, { cartonsPerUnit: v ?? 1 })} />}
                      <NumberField label="Số lượng" unit={l.unitKind === "bundle" ? "kiện" : "thùng"} value={l.quantity} onChange={(v) => setLine(l.id, { quantity: v })} />
                      <NumberField label="Kg tịnh / thùng" value={l.netKgPerCarton} onChange={(v) => setLine(l.id, { netKgPerCarton: v })} />
                      <NumberField
                        label={l.kg != null ? "Kg (gõ tay)" : "Kg (tự tính)"}
                        value={l.kg ?? auto}
                        onChange={(v) => setLine(l.id, { kg: v != null && auto != null && Math.abs(v - auto) < 0.005 ? null : v })}
                      />
                      {canSeePrice && <NumberField label="Đơn giá" unit={`${currency}/kg`} value={l.unitPrice} onChange={(v) => setLine(l.id, { unitPrice: v })} />}
                    </div>
                    {isOpen ? (
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                        <Field label="Mã HS">
                          <Input value={l.hsCode} onChange={(e) => setLine(l.id, { hsCode: e.target.value })} />
                        </Field>
                        <Field label="Yêu cầu vi sinh / kỹ thuật">
                          <Input value={l.microSpec} onChange={(e) => setLine(l.id, { microSpec: e.target.value })} />
                        </Field>
                      </div>
                    ) : (
                      <div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-auto max-w-full whitespace-normal text-left"
                          onClick={() => setOpenLines((s) => new Set(s).add(l.id))}
                          title="Mở ô mã HS và yêu cầu vi sinh / kỹ thuật của dòng này."
                        >
                          <Plus className="mr-1 h-4 w-4 shrink-0" aria-hidden />
                          Mã HS · vi sinh
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div>
                <Button variant="outline" onClick={() => setForm((f) => (f ? { ...f, lines: [...f.lines, blankLine()] } : f))} title="Thêm một dòng hàng vào hợp đồng.">
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  Thêm dòng hàng
                </Button>
              </div>
            </div>
          </FormSection>

          <FormSection no={5} title="File & ghi chú">
            {hasExportStorage ? (
              <Field label="File hợp đồng đã ký">
                <div className="grid gap-2">
                  {form.fileName && <span className="text-sm text-muted-foreground">Đang có: {form.fileName} — chọn file mới để thay</span>}
                  <FilePicker files={file} onChange={setFile} multiple={false} label={form.fileName ? "Chọn file khác" : "Chọn file"} />
                </div>
              </Field>
            ) : (
              <p className="rounded-lg bg-warning-surface px-4 py-2 text-sm">Đang chạy không nối máy chủ: chưa lưu được file.</p>
            )}
            <Field label="Ghi chú">
              <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
            </Field>
          </FormSection>
        </div>
      )}
      {customerEditor.dialog}
      {productEditor.dialog}
    </FormDialog>
  );
}

/** Một khối đánh số của form (design-spec 42): nền nhạt, tiêu đề + câu ví dụ, nút phụ bên phải. */
function FormSection({ no, title, hint, action, children }: { no: number; title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 rounded-xl bg-muted/40 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-foreground" aria-hidden>
          {no}
        </span>
        <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
          <h3 className="font-semibold">{title}</h3>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
