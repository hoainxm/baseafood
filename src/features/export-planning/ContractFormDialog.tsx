// ============================================================
// Tên file: src/features/export-planning/ContractFormDialog.tsx
// Tên tiếng Việt: Hộp lập hợp đồng / sửa hợp đồng / ghi bản sửa (rvs, phụ kiện, tu chỉnh L/C)
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
  FormSection,
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
import { useDocumentKindPicker, type DocumentKindSource } from "./documentKindPicker";
import { useDialogDraft } from "@/lib/formDraft";
import { newId } from "@/lib/store";
import {
  INCOTERMS,
  PAYMENT_METHODS,
  computedLineKg,
  copyContractLine,
  insertCopiedLine,
  contractTotals,
  customerChangeGate,
  emptyTerms,
  lineAmount,
  lineKg,
  rankProductsForLine,
  suggestProductId,
  suggestProductMatch,
  PRODUCT_MATCH_SOURCE_LABELS,
  type ProductMatch,
  unmappedLines,
  validateContract,
  formSchedule,
  validateScheduleRows,
  type ExportData,
  type ScheduleRow,
} from "@/lib/exportPlanning";
import { formatMoney } from "@/lib/format";
import { checkExportFile, exportFilePath, hasExportStorage, removeExportFiles, uploadExportFile } from "@/lib/exportFileStorage";
import { findCustomerName, lineTextAfterPick } from "@/lib/customerProductNames";
import { applyExportConflicts, fillExportContract, type ExportContractFillValues, type FillConflict, type ReadContract } from "@/lib/contractReader";
import { validityError, validityWarning } from "@/lib/contractValidity";
import type { Customer, CustomerProductName, ExportContract, ExportContractLine, ExportContractRevision, ExportContractTerms, ExportDocumentKind, ExportFile, Product } from "@/types";
import { Copy, Factory, FileSignature, Plus, Save, Trash2 } from "lucide-react";
import { FilePicker } from "./parts";
import { ContractReadPanel, type ContractFillReport } from "./ContractReadPanel";
import { useGoodsTypePicker } from "./goodsTypePicker";
import { useExportOptionPicker } from "./exportOptionPicker";
import { uploadExtraContractFiles } from "./RecordDialogs";
import { ScheduleRowsEditor, scheduleRowsToSave, type ScheduleRowForm } from "./ShipmentDialogs";

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
  /** File ký đang có (sửa hợp đồng) — giữ nếu không chọn file mới. */
  filePath: string;
  fileName: string;
  /**
   * Lịch xuất hàng ngay trong form Lập HĐ (ba-spec 41 R42 + R43) — chỉ chế độ lập mới. `edited` = đã sửa tay ⇒
   * giữ `rows`; chưa sửa ⇒ lịch chia lại theo số cont, hạn giao, tổng kg mỗi lần các ô đó đổi.
   */
  schedule?: { enabled: boolean; edited: boolean; rows: ScheduleRowForm[] };
  initial: string;
}

const snapshot = (f: ContractForm) =>
  JSON.stringify([f.customerId, f.contractNo, f.signedOn, f.orderRef, f.note, f.revisedOn, f.changeSummary, f.terms, f.lines, f.schedule]);

const NEW_SCHEDULE = { enabled: true, edited: false, rows: [] as ScheduleRowForm[] };

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
      schedule: NEW_SCHEDULE,
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
  /** File thứ 2 trở đi chọn ở ô file HĐ (phụ lục…) ⇒ Hồ sơ đính kèm cấp HĐ (2026-10-30). */
  attachments: ExportFile[];
  /** "Lưu & lập lệnh sản xuất": lưu xong mở ngay hộp Lập lệnh sản xuất chọn sẵn HĐ này (ba-spec 48 LS1). */
  thenCreateOrder?: boolean;
  /** Lập HĐ mới: chuyến của lịch xuất hàng ghi CÙNG lần lưu (R42) — `[]` = chọn Không tạo lịch; bỏ trống = không phải lập mới. */
  schedule?: ScheduleRow[];
}

export function ContractFormDialog({
  target,
  contracts,
  customers,
  setCustomers,
  products,
  setProducts,
  customerNames,
  data,
  documentKindSource,
  recordedBy,
  canSeePrice,
  canCreateOrder = false,
  onClose,
  onSave,
}: {
  target: ContractFormTarget | null;
  contracts: readonly ExportContract[];
  customers: Customer[];
  setCustomers: (rows: Customer[]) => boolean | void;
  /** Danh mục mặt hàng (mở) — mỗi dòng hàng nối một mặt hàng; 141 mã kế toán chỉ ánh xạ qua đây. */
  products: Product[];
  /** Tên hàng theo khách (mig 0077) — điền dòng + gợi ý nối theo khách của HĐ. */
  customerNames: readonly CustomerProductName[];
  setProducts: (rows: Product[]) => boolean | void;
  /** Dữ liệu module — gợi ý mặt hàng theo tên tiếng Anh đã nối ở HĐ trước. */
  /** Cả khối Xuất khẩu: số HĐ trùng, gợi ý mặt hàng, và luật khóa đổi khách (R44 — cần chuyến, mục, file). */
  data: ExportData;
  /** Danh mục loại chứng từ (mig 0081) — ô Chứng từ khách yêu cầu thêm / sửa loại tại chỗ (luật 7). */
  documentKindSource: DocumentKindSource;
  recordedBy: string;
  canSeePrice: boolean;
  /** Có quyền lập Lệnh sản xuất ⇒ hộp Lập HĐ có thêm "Lưu & lập lệnh sản xuất". */
  canCreateOrder?: boolean;
  onClose: () => void;
  onSave: (p: ContractSavePayload) => boolean;
}) {
  const today = todayIso();
  const [form, setForm] = useState<ContractForm | null>(null);
  const [file, setFile] = useState<File[]>([]);
  /** File vừa đọc ở khối "Đọc file hợp đồng" mà U1 chọn đính vào HĐ (ba-spec 66 R13) — đứng đầu khi Lưu. */
  const [readFile, setReadFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  /** Dòng đã mở phần "mã HS, vi sinh" (chỉ trình bày, không lưu). */
  const [openLines, setOpenLines] = useState<Set<string>>(new Set());
  const draft = useDialogDraft({ form: "export-contract", value: form, setValue: setForm, isEmpty: (f) => snapshot(f) === f.initial });
  const customerEditor = useQuickCatalogEdit("customer", customers, (rows) => void setCustomers(rows));
  const productEditor = useQuickCatalogEdit("product", products, (rows) => void setProducts(rows));
  // Loại hàng (mig 0089) — chưa chạy ⇒ ẩn ô.
  const goodsPicker = useGoodsTypePicker();
  // Cảng xếp · cảng đích · loại cont · tiền tệ chọn theo danh sách (ba-spec 62).
  const optionPicker = useExportOptionPicker();
  const kindPicker = useDocumentKindPicker(documentKindSource);
  /** Dòng vừa được tự gợi ý mặt hàng (chỉ để hiện dòng nhắc "kiểm lại", không lưu). */
  // Dòng app tự gợi ý mặt hàng (+ nguồn, gần giống hay không) — người dùng chọn tay thì bỏ khỏi đây.
  const [suggestedLines, setSuggestedLines] = useState<Map<string, ProductMatch>>(new Map());
  /**
   * Ô chọn mặt hàng của một dòng (R23 v6): mục khớp tên của khách / tên mặc định đứng đầu; dòng phụ =
   * mã · tên của khách (chưa có thì tên mặc định) ⇒ gõ tên tiếng Anh tìm được.
   */
  const productOptionsFor = (l: Pick<ExportContractLine, "description" | "size">, customerId: string): ComboboxOption[] =>
    rankProductsForLine(l.description, products, customerId, { size: l.size, names: customerNames }).map((m) => ({
      value: m.id,
      label: m.code ? `${m.code} · ${m.name}` : m.name,
      subLabel: [m.code, findCustomerName(customerNames, customerId, m.id)?.tradeName || m.tradeName].filter(Boolean).join(" · ") || undefined,
    }));
  const addProduct = (name: string) => {
    const existing = products.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return existing.id;
    const m: Product = { id: newId(), code: "", name, finishedGoodCode: "" };
    setProducts([...products, m]);
    notify.saved(`Đã thêm mặt hàng "${name}" vào danh mục`);
    return m.id;
  };
  /** Rời ô tên tiếng Anh: dòng chưa nối mà tên đã từng nối ở HĐ trước ⇒ điền sẵn mặt hàng đó. */
  /** Gợi ý mặt hàng khi rời ô Tên hàng / Size: dòng chưa nối, hoặc nối do app gợi ý (gõ size sau ⇒ gợi ý lại cho đúng size). */
  const suggestFor = (lineId: string) => {
    setForm((f) => {
      if (!f) return f;
      const l = f.lines.find((x) => x.id === lineId);
      if (!l || !l.description.trim()) return f;
      const auto = suggestedLines.has(lineId);
      if (l.productId && !auto) return f;
      const m = suggestProductMatch(data, l.description, f.customerId, products, { size: l.size, names: customerNames });
      const pid = m && products.some((p) => p.id === m.productId) ? m.productId : "";
      setSuggestedLines((s) => {
        const n = new Map(s);
        if (pid && m) n.set(lineId, m);
        else n.delete(lineId);
        return n;
      });
      if (!pid && !auto) return f;
      return { ...f, lines: f.lines.map((x) => (x.id === lineId ? { ...x, productId: pid || undefined } : x)) };
    });
  };

  useEffect(() => {
    if (!target) return;
    const fresh = formFor(target, today);
    const kept = draft.takeKept();
    setForm(kept && kept.key === fresh.key ? kept : fresh);
    setFile([]);
    setReadFile(null);
    setErrors([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở hộp
  }, [target]);

  const set = <K extends keyof ContractForm>(k: K, v: ContractForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  /* Lịch xuất hàng (R42): bản nháp cũ chưa có `schedule` ⇒ coi như mặc định Có. */
  const scheduleState = form?.mode === "create" ? (form.schedule ?? NEW_SCHEDULE) : null;
  const scheduleRows: ScheduleRowForm[] =
    form && scheduleState
      ? scheduleState.edited
        ? scheduleState.rows
        : formSchedule(scheduleState, {
            signedOn: form.signedOn,
            latestShipmentDate: form.terms.latestShipmentDate,
            containerCount: form.terms.containerCount,
            totalKg: contractTotals(form.lines).kg,
            today,
          }).map((r, i) => ({ ...r, id: `auto-${i}` }))
      : [];
  const setSchedule = (patch: Partial<NonNullable<ContractForm["schedule"]>>) =>
    setForm((f) => (f ? { ...f, schedule: { ...(f.schedule ?? NEW_SCHEDULE), ...patch } } : f));
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

  // Số HĐ sửa được ở MỌI lần Sửa / Ghi bản sửa khi HĐ còn mở (ba-spec 68 R1 — trước khóa ở bản sửa ⇒ gõ nhầm số không
  // còn đường sửa). Đổi số ⇒ nhật ký ghi số cũ → mới (bản sửa không lưu riêng số); chứng từ đã tải giữ số cũ.
  const numberChanged = !!form && form.mode !== "create" && form.contractNo.trim() !== (contracts.find((c) => c.id === form.contractId)?.contractNo ?? "").trim();
  // Khách: đổi được (cả ở bản sửa) tới khi một chuyến của HĐ xong bước 4 Đóng cont (R44, 2026-11-03).
  const customerGate = form && form.mode !== "create" ? customerChangeGate(data, form.contractId) : ({ ok: true } as const);
  const customerLocked = !customerGate.ok;

  /* Đọc file hợp đồng (ba-spec 66): chỉ điền ô trống, ô khác file trả về để U1 chọn; không tự lưu. */
  const formRef = useRef(form);
  formRef.current = form;
  const fillValues = (f: ContractForm): ExportContractFillValues => ({
    customerId: f.customerId,
    contractNo: f.contractNo,
    signedOn: f.signedOn,
    orderRef: f.orderRef,
    revisedOn: f.revisedOn,
    changeSummary: f.changeSummary,
    terms: f.terms,
    lines: f.lines,
  });
  const fillFromRead = (read: ReadContract, force: boolean): ContractFillReport | null => {
    const f = formRef.current;
    if (!f) return null;
    const { values, ...report } = fillExportContract(fillValues(f), read, {
      mode: f.mode,
      baseline: { signedOn: today, revisedOn: today, paymentMethod: "ttr", currency: "USD" },
      customers,
      options: optionPicker.options,
      canSeePrice,
      customerLocked,
      force,
      newLineId: newId,
      suggestProduct: (description, size, customerId) =>
        description.trim() ? suggestProductId(data, description, customerId, products, { size, names: customerNames }) : "",
    });
    if (!report.blocked) setForm((cur) => (cur ? { ...cur, ...values } : cur));
    return report;
  };
  const applyFromRead = (picks: FillConflict[]) => setForm((cur) => (cur ? { ...cur, ...applyExportConflicts(fillValues(cur), picks) } : cur));

  const save = async (thenCreateOrder = false) => {
    // Không đòi `target`: tải lại trang thì hộp mở lại từ NHÁP (target rỗng) — Lưu vẫn phải chạy.
    if (!form || isUploading) return;
    const files = readFile ? [readFile, ...file] : file;
    const issues = validateContract(
      { id: form.contractId, customerId: form.customerId, contractNo: form.contractNo, signedOn: form.signedOn, terms: form.terms, lines: form.lines },
      contracts,
    );
    const errs: FieldError[] = issues.map((i) => ({ field: i.label, message: i.message }));
    if (form.mode === "revise" && !form.changeSummary.trim()) errs.push({ field: "Nội dung sửa", message: "Ghi bản sửa đổi gì (VD: giảm dòng 1 còn 180 thùng)" });
    // Hạn hợp đồng (ba-spec 69 R2): không bắt buộc, có thì không trước ngày ký.
    const validity = validityError(form.signedOn, form.terms.contractValidUntil);
    if (validity) errs.push({ field: "Hạn hợp đồng", message: validity });
    if (scheduleState?.enabled) errs.push(...validateScheduleRows(scheduleRows).map((i) => ({ field: i.label, message: i.message })));
    // Lệnh sản xuất chỉ chọn được dòng đã nối mặt hàng (ba-spec 48 R1) — chặn sớm, khỏi lưu HĐ rồi mở hộp lệnh trống.
    if (thenCreateOrder && !form.lines.some((l) => l.description.trim() && l.productId))
      errs.push({
        field: "Mặt hàng (danh mục)",
        message: "Lập lệnh sản xuất cần ít nhất một dòng hàng đã chọn Mặt hàng (danh mục). Chọn ở dòng hàng, hoặc bấm Lưu hợp đồng để nối sau.",
      });
    for (const f of files) {
      const fileErr = checkExportFile(f);
      if (fileErr) errs.push({ field: f.name, message: fileErr });
    }
    setErrors(errs);
    if (errs.length) return;

    setIsUploading(true);
    const done: string[] = [];
    try {
      let filePath = form.filePath;
      let fileName = form.fileName;
      if (files[0] && hasExportStorage) {
        const r = await uploadExportFile(exportFilePath(form.contractId, "contract", form.revisionId, files[0].name), files[0]);
        if ("error" in r) throw new Error(r.error);
        done.push(r.path);
        filePath = r.path;
        fileName = r.fileName;
      }
      const attachments = await uploadExtraContractFiles(
        files.slice(1),
        form.contractId,
        `Phụ lục / file kèm HĐ ${form.contractNo.trim()}${form.revisionNo ? ` bản sửa ${form.revisionNo}` : ""}`,
        recordedBy,
        done,
      );
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
        attachments,
        thenCreateOrder,
        schedule: scheduleState ? (scheduleState.enabled ? scheduleRowsToSave(scheduleRows) : []) : undefined,
      });
      if (!ok) {
        void removeExportFiles(done);
        return;
      }
      draft.done();
    } catch (e) {
      void removeExportFiles(done);
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
        ? `Sửa hợp đồng · bản ${head.revisionNo} · HĐ ${head.contractNo}`
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
          ? "Bản sửa có hiệu lực ngay khi lưu; bản cũ giữ lại để tra. Trưởng / Phó phòng Kế hoạch xem lại mọi bản sửa ở bước duyệt cuối."
          : "Ghi đúng như hợp đồng giấy. Lưu xong hợp đồng ở trạng thái Chờ đính kèm — đính kèm hợp đồng đã ký (và L/C nếu thanh toán L/C) rồi mới ghi chuyến."
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
          {canCreateOrder && form?.mode === "create" && (
            <Button
              variant="save"
              onClick={() => void save(true)}
              title="Lưu hợp đồng này rồi mở ngay hộp Lập lệnh sản xuất với hợp đồng chọn sẵn — không cần chờ đính kèm hay ghi chuyến. Cần ít nhất một dòng hàng đã chọn Mặt hàng (danh mục)."
            >
              <Factory className="mr-2 h-4 w-4" aria-hidden />
              Lưu &amp; lập lệnh sản xuất
            </Button>
          )}
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

          <ContractReadPanel
            key={form.key}
            role="export"
            canAttach={hasExportStorage}
            canSeePrice={canSeePrice}
            attach={!!readFile}
            onAttachChange={setReadFile}
            onFill={fillFromRead}
            onApply={applyFromRead}
            tourId="export-contract-read"
          />

          <FormSection no={1} title="Hợp đồng" hint="VD số HĐ: 18.26/BSF-SCM.2026 · số PO của khách (dòng Order trên HĐ): #B182">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {customerLocked ? (
                <Field
                  label="Khách hàng"
                  hint={
                    !customerGate.ok
                      ? `Chuyến ${[customerGate.shipment.lotCode && `lô ${customerGate.shipment.lotCode}`, customerGate.shipment.containerNo].filter(Boolean).join(" · ") || "đầu tiên"} đã xong bước Đóng cont — không đổi khách được nữa.`
                      : undefined
                  }
                >
                  <Input value={customers.find((c) => c.id === form.customerId)?.name ?? ""} readOnly />
                </Field>
              ) : (
                <Combobox
                  label="Khách hàng"
                  hint={form.mode !== "create" ? "Đổi được tới khi một chuyến của hợp đồng xong bước Đóng cont." : undefined}
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
              <Field
                label="Số hợp đồng"
                required
                hint={numberChanged ? "Đổi số hợp đồng: nhật ký ghi số cũ → mới; chứng từ đã tải giữ số cũ." : undefined}
              >
                <Input value={form.contractNo} onChange={(e) => set("contractNo", e.target.value)} aria-required />
              </Field>
              <DateField label="Ngày ký" required value={form.signedOn} onChange={(v) => set("signedOn", v)} />
              <Field label="Số PO của khách">
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
              <Combobox
                label="Cảng xếp"
                hideRequiredMark
                {...optionPicker.fieldProps("loading-port", form.terms.portOfLoading)}
                onChange={(v) => setTerm("portOfLoading", v)}
              />
              <Combobox
                label="Cảng đích"
                hideRequiredMark
                {...optionPicker.fieldProps("discharge-port", form.terms.portOfDischarge)}
                onChange={(v) => setTerm("portOfDischarge", v)}
              />
              <DateField label="Hạn giao muộn nhất" required value={form.terms.latestShipmentDate} onChange={(v) => setTerm("latestShipmentDate", v)} />
              <DateField
                label="Hạn hợp đồng"
                hint={validityWarning(form.terms.latestShipmentDate, form.terms.contractValidUntil) || "Ngày hợp đồng hết hiệu lực (\"binding … to …\"), khác hạn giao. Không bắt buộc."}
                value={form.terms.contractValidUntil ?? ""}
                onChange={(v) => setTerm("contractValidUntil", v)}
              />
              <NumberField label="Dung sai ±" unit="%" value={form.terms.tolerancePct} onChange={(v) => setTerm("tolerancePct", v)} />
              <Combobox
                label="Tiền tệ"
                hideRequiredMark
                {...optionPicker.fieldProps("currency", form.terms.currency)}
                onChange={(v) => setTerm("currency", v.toUpperCase())}
              />
              <NumberField label="Số container" unit="cont" value={form.terms.containerCount} onChange={(v) => setTerm("containerCount", v)} />
              <Combobox
                label="Loại container"
                hideRequiredMark
                {...optionPicker.fieldProps("container-type", form.terms.containerType)}
                onChange={(v) => setTerm("containerType", v)}
              />
              <NumberField label="Đặt cọc" unit="%" value={form.terms.depositPct} onChange={(v) => setTerm("depositPct", v)} />
            </div>
            <ChoiceGroup
              label="Thanh toán"
              value={form.terms.paymentMethod}
              onChange={(v) => setTerm("paymentMethod", v as ExportContractTerms["paymentMethod"])}
              options={PAYMENT_METHODS}
              columns={3}
            />
            {form.terms.paymentMethod === "other" && (
              <Field label="Hình thức thanh toán" required hint="VD D/P, nhờ thu, tiền mặt, trả sau 30 ngày.">
                <Input value={form.terms.paymentOther ?? ""} onChange={(e) => setTerm("paymentOther", e.target.value)} aria-required />
              </Field>
            )}
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
                      options={kindPicker.options}
                      onCreate={kindPicker.onCreate}
                      onEditItem={kindPicker.onEditItem}
                      canEdit={kindPicker.canEdit}
                      editLabel={kindPicker.editLabel}
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
            hint="Tên hàng ghi đúng chữ trên HĐ (tiếng Anh); Mặt hàng (danh mục) nối dòng với danh mục của xưởng — lập HĐ chưa bắt buộc, nhưng Lệnh sản xuất chỉ xong khi mọi dòng đã nối. Kg tự tính = số thùng × kg tịnh mỗi thùng (theo kiện thì nhân thêm số thùng mỗi kiện); gõ đè nếu HĐ ghi khác. Chiều dài, tỉ lệ râu / thân / cổ, số miếng / kg và ghi chú dòng tự chép sang Lệnh sản xuất khi lập lệnh."
          >
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
              {form.lines.map((l, i) => {
                const auto = computedLineKg(l);
                const isOpen = openLines.has(l.id) || !!l.hsCode || !!l.microSpec;
                return (
                  <div key={l.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Dòng {i + 1}</span>
                      <span className="tnum min-w-0 flex-1 basis-40 text-sm text-muted-foreground">
                        {formatNumber(lineKg(l))} kg{canSeePrice ? ` · ${formatMoney(lineAmount(l))} ${currency}` : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        data-tour={i === 0 ? "export-line-copy" : undefined}
                        onClick={() => {
                          const copy = copyContractLine(l, newId());
                          setForm((f) => (f ? { ...f, lines: insertCopiedLine(f.lines, l.id, copy) } : f));
                          if (openLines.has(l.id)) setOpenLines((s) => new Set(s).add(copy.id));
                        }}
                        title={`Chép dòng ${i + 1} thành dòng mới ngay dưới: giữ mọi thông tin, để trống Size để gõ size khác.`}
                      >
                        <Copy className="mr-1 h-4 w-4" aria-hidden />
                        Chép dòng
                      </Button>
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
                    {/* Tên hàng một hàng riêng, ô tự giãn theo chữ — đọc HẾT tên như trên HĐ để đối chiếu (2026-11-03). */}
                    <Field label="Tên hàng (như trên HĐ)" required>
                      <Textarea
                        rows={1}
                        className="min-h-10"
                        value={l.description}
                        onChange={(e) => setLine(l.id, { description: e.target.value.replace(/\n+/g, " ") })}
                        onBlur={() => suggestFor(l.id)}
                        aria-required
                      />
                    </Field>
                    <div
                      className={`grid gap-3 sm:grid-cols-2 ${goodsPicker.isAvailable ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)]" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.6fr)]"}`}
                    >
                      <div className="grid min-w-0 gap-1">
                        <Combobox
                          label="Mặt hàng (danh mục)"
                          wrapValue
                          value={l.productId ?? ""}
                          onChange={(v) => {
                            // R23: tên hàng còn trống ⇒ điền tên thương mại của mặt hàng vừa chọn.
                            // R23 v6: ô tên · size · quy cách · mã HS đang trống ⇒ theo tên của khách (chưa có ⇒ tên mặc định).
                            setLine(l.id, {
                              productId: v || undefined,
                              ...(v ? lineTextAfterPick(l, products.find((p) => p.id === v), findCustomerName(customerNames, form.customerId, v)) : {}),
                            });
                            setSuggestedLines((s) => {
                              const n = new Map(s);
                              n.delete(l.id);
                              return n;
                            });
                          }}
                          options={productOptionsFor(l, form.customerId)}
                          onCreate={productEditor.canCreate ? addProduct : undefined}
                          emptyText="Chưa có mặt hàng nào trong danh mục."
                          onEditItem={productEditor.openEdit}
                          canEdit={productEditor.canEdit}
                          editLabel={productEditor.editLabel}
                        />
                        {suggestedLines.has(l.id) && (
                          <span className="text-sm text-muted-foreground">
                            Gợi ý theo {PRODUCT_MATCH_SOURCE_LABELS[(suggestedLines.get(l.id) as ProductMatch).source]}
                            {(suggestedLines.get(l.id) as ProductMatch).loose ? " (tên gần giống, không trùng nguyên văn)" : ""} — kiểm lại.
                          </span>
                        )}
                      </div>
                      <Field label="Size">
                        <Input value={l.size} onChange={(e) => setLine(l.id, { size: e.target.value })} onBlur={() => suggestFor(l.id)} />
                      </Field>
                      {goodsPicker.isAvailable && (
                        <div data-tour={i === 0 ? "export-line-goods-type" : undefined} className="min-w-0">
                          <Combobox
                            label="Loại hàng"
                            value={l.goodsTypeId ?? ""}
                            onChange={(v) => setLine(l.id, { goodsTypeId: v || undefined })}
                            options={goodsPicker.options}
                            onCreate={goodsPicker.onCreate}
                            emptyText="Chưa có loại hàng nào — gõ tên để thêm mới."
                            onEditItem={goodsPicker.onEditItem}
                            canEdit={goodsPicker.canEdit}
                            editLabel={goodsPicker.editLabel}
                          />
                        </div>
                      )}
                      <Field label="Quy cách đóng gói">
                        <Textarea rows={1} className="min-h-10" value={l.packing} onChange={(e) => setLine(l.id, { packing: e.target.value.replace(/\n+/g, " ") })} />
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
                    {/* R38: yêu cầu NL như cột trên HĐ — tự chép sang dòng Lệnh sản xuất (Quy cách + ghi chú). */}
                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)]">
                      <Field label="Chiều dài">
                        <Input value={l.pieceLength ?? ""} onChange={(e) => setLine(l.id, { pieceLength: e.target.value || undefined })} />
                      </Field>
                      <Field label="Tỉ lệ râu / thân / cổ">
                        <Input value={l.partRatio ?? ""} onChange={(e) => setLine(l.id, { partRatio: e.target.value || undefined })} />
                      </Field>
                      <Field label="Số miếng / kg">
                        <Input value={l.piecesPerKg ?? ""} onChange={(e) => setLine(l.id, { piecesPerKg: e.target.value || undefined })} />
                      </Field>
                      <Field label="Ghi chú dòng" className="sm:col-span-3 lg:col-span-1">
                        <Textarea rows={1} className="min-h-10" value={l.note ?? ""} onChange={(e) => setLine(l.id, { note: e.target.value || undefined })} />
                      </Field>
                    </div>
                    {isOpen ? (
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                        <Field label="Mã HS">
                          <Input value={l.hsCode} onChange={(e) => setLine(l.id, { hsCode: e.target.value })} />
                        </Field>
                        <Field label="Yêu cầu vi sinh / kỹ thuật">
                          <Textarea rows={1} className="min-h-10" value={l.microSpec} onChange={(e) => setLine(l.id, { microSpec: e.target.value })} />
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
              <Field
                label="File hợp đồng đã ký + phụ lục"
                hint="Chọn được nhiều file: file ĐẦU là hợp đồng của bản này (thay file đang có); các file sau (phụ lục, file kèm) lưu vào Hồ sơ đính kèm của hợp đồng."
              >
                <div className="grid gap-2" data-tour="export-contract-files">
                  {form.fileName && <span className="text-sm text-muted-foreground">Đang có: {form.fileName}</span>}
                  <FilePicker files={file} onChange={setFile} label={form.fileName ? "Chọn file khác / thêm phụ lục" : "Chọn file"} />
                </div>
              </Field>
            ) : (
              <p className="rounded-lg bg-warning-surface px-4 py-2 text-sm">Đang chạy không nối máy chủ: chưa lưu được file.</p>
            )}
            <Field label="Ghi chú">
              <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} />
            </Field>
          </FormSection>
          {scheduleState && (
            <FormSection
              no={6}
              title="Lịch xuất hàng"
              hint="Chia sẵn các chuyến theo số cont, hạn giao, tổng kg — sửa được. Số booking, ngày đóng cont, ETD, ETA gõ luôn nếu đã có (không bắt buộc)."
            >
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
                <ChoiceGroup
                  label="Tạo lịch xuất hàng khi lưu"
                  hideRequiredMark
                  value={scheduleState.enabled ? "yes" : "no"}
                  onChange={(v) => setSchedule({ enabled: v === "yes" })}
                  options={[
                    { value: "yes", label: "Có", description: "Lưu hợp đồng là ghi luôn các chuyến dưới đây lên lịch" },
                    { value: "no", label: "Không", description: "Tạo sau ở hồ sơ hợp đồng khi cần" },
                  ]}
                  columns={2}
                />
                {scheduleState.enabled && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                        {scheduleState.edited
                          ? "Đang dùng lịch đã sửa tay — đổi số cont, hạn giao, dòng hàng không chia lại nữa."
                          : "Tự chia theo hợp đồng: đổi số cont, ngày ký, hạn giao hay dòng hàng thì lịch chia lại."}
                      </p>
                      {scheduleState.edited && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSchedule({ edited: false, rows: [] })}
                          title="Bỏ các chỗ đã sửa tay, chia lại lịch theo số cont, hạn giao, tổng kg hiện tại."
                        >
                          Chia lại theo hợp đồng
                        </Button>
                      )}
                    </div>
                    <ScheduleRowsEditor
                      rows={scheduleRows}
                      onChange={(rows) => setSchedule({ edited: true, rows })}
                      totalKg={totals.kg}
                      deadline={form.terms.latestShipmentDate || today}
                    />
                  </>
                )}
              </div>
            </FormSection>
          )}
        </div>
      )}
      {customerEditor.dialog}
      {productEditor.dialog}
      {goodsPicker.dialog}
      {kindPicker.dialog}
      {optionPicker.dialogs}
    </FormDialog>
  );
}
