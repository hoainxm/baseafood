// ============================================================
// Tên file: src/lib/documentComposer.ts
// Tên tiếng Việt: Bộ soạn văn bản từ mẫu — luật chung cho mọi loại văn bản
// Description: Pure rules of the document composer (ba-spec docs/app-map/54-document-composer.ba-spec.md):
//              document type contract (R1), prefill source → previous export → default (R2), field sources and
//              "differs from source" (R3), required-field check (R5), status + stale source (R10), refresh from
//              source, previous-export lookup, template tag check (R13), active template (R13), export record (R9).
//              A new document type only declares fields + mapping + template; nothing here changes (AC-15).
// ============================================================
import type {
  ComposedDocument,
  ComposedDocumentExport,
  DocumentFieldValue,
  DocumentRow,
  DocumentTemplate,
  DocumentValues,
  FieldSource,
  FieldSources,
} from "@/types";

/* ---------- Khai loại văn bản (R1) ---------- */

export type DocumentFieldKind = "text" | "multiline" | "date" | "choice" | "check" | "table";

export interface DocumentColumn {
  key: string;
  label: string;
  kind: "text" | "multiline" | "number";
  required?: boolean;
}

export interface DocumentField {
  key: string;
  /** Đúng chữ trên mẫu giấy. */
  label: string;
  group: string;
  kind: DocumentFieldKind;
  required?: boolean;
  /** kind = "choice": đúng danh sách lựa chọn của mẫu. */
  options?: readonly string[];
  /** kind = "table": các ô con của một dòng. */
  columns?: readonly DocumentColumn[];
  /** Có ánh xạ từ nguồn (giá trị lấy ở `sourceValues`). */
  mapped?: boolean;
  /** R2 bước 2: chép từ lần xuất trước cùng khách + mặt hàng khi nguồn không có. */
  carryOver?: boolean;
  defaultValue?: DocumentFieldValue;
  /** Bắt buộc theo ô khác (VD ô "ghi rõ" chỉ bắt buộc khi chọn "Có" — ba-spec 72 R5). */
  requiredWhen?: (values: DocumentValues) => boolean;
}

export interface DocumentTypeDef<TSource> {
  key: string;
  name: string;
  /** Mã biểu mẫu ("QTI-KH-01-04"). */
  formCode: string;
  sourceType: string;
  /** Tài nguyên quyền (R15). */
  resource: string;
  /** Nhãn nguồn ô / cờ — chữ người dùng đọc, theo loại nguồn ("Từ lệnh", "Khác lệnh"…). */
  labels: { source: string; differs: string; stale: string; sourceCancelled: string; previous: (ref: string) => string };
  fields: readonly DocumentField[];
  /** Thẻ khuôn: bắt buộc (của ô R5) + không bắt buộc. Gồm cả thẻ tính sẵn (tổng, STT). */
  templateTags: { required: readonly string[]; optional: readonly string[] };
  /** Giá trị các ô có ánh xạ — chỉ khóa có `mapped`. */
  sourceValues: (source: TSource) => DocumentValues;
  /** Dữ liệu điền khuôn: chữ đã định dạng theo luật cách ghi của loại văn bản. */
  templateData: (values: DocumentValues) => Record<string, unknown>;
  fileName: (values: DocumentValues) => string;
  /** id khuôn gốc đi kèm app. */
  builtinTemplateId: string;
}

export const builtinTemplateId = (docType: string): string => `builtin:${docType}`;

/* ---------- Giá trị ---------- */

const emptyOf = (f: DocumentField): DocumentFieldValue => (f.kind === "table" ? [] : f.kind === "check" ? false : "");

/** Ô "có giá trị": chữ khác trống · đánh dấu luôn có (true / false đều là một câu trả lời) · bảng ≥ 1 dòng. */
export function hasValue(v: DocumentFieldValue | undefined): boolean {
  if (v == null) return false;
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  return v.trim() !== "";
}

const cloneValue = (v: DocumentFieldValue): DocumentFieldValue => (Array.isArray(v) ? v.map((r) => ({ ...r })) : v);

/** So hai giá trị ô (bảng so từng ô con, số và chữ số cùng nghĩa thì bằng). */
function sameValue(a: DocumentFieldValue | undefined, b: DocumentFieldValue | undefined): boolean {
  return stableStringify(a ?? null) === stableStringify(b ?? null);
}

export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

/* ---------- Điền sẵn (R2) ---------- */

export interface PreviousExport {
  values: DocumentValues;
  /** Số văn bản lần trước ("18.10"). */
  ref: string;
}

export interface ComposedState {
  values: DocumentValues;
  sources: FieldSources;
}

function prefillField(f: DocumentField, src: DocumentValues, previous: PreviousExport | null): { value: DocumentFieldValue; source: FieldSource } {
  if (f.mapped && hasValue(src[f.key])) return { value: cloneValue(src[f.key]), source: { kind: "source" } };
  if (f.carryOver && previous && hasValue(previous.values[f.key])) return { value: cloneValue(previous.values[f.key]), source: { kind: "previous", ref: previous.ref } };
  if (f.defaultValue !== undefined && hasValue(f.defaultValue)) return { value: cloneValue(f.defaultValue), source: { kind: "default" } };
  return { value: emptyOf(f), source: { kind: "empty" } };
}

/** R2: nguồn → lần xuất trước (chỉ ô `carryOver`) → mặc định → trống. */
export function prefill<T>(type: DocumentTypeDef<T>, source: T, previous: PreviousExport | null): ComposedState {
  const src = type.sourceValues(source);
  const values: DocumentValues = {};
  const sources: FieldSources = {};
  for (const f of type.fields) {
    const r = prefillField(f, src, previous);
    values[f.key] = r.value;
    sources[f.key] = r.source;
  }
  return { values, sources };
}

/** Người soạn đổi một ô ⇒ nguồn "Sửa tay" (R3). Bảng: đổi bất kỳ ô con nào ⇒ cả bảng "Sửa tay". */
export function editField(state: ComposedState, key: string, value: DocumentFieldValue): ComposedState {
  return { values: { ...state.values, [key]: cloneValue(value) }, sources: { ...state.sources, [key]: { kind: "manual" } } };
}

/** Sửa một ô con của bảng. */
export function editCell(state: ComposedState, key: string, row: number, column: string, value: string | number | null): ComposedState {
  const rows = ((state.values[key] as DocumentRow[] | undefined) ?? []).map((r, i) => (i === row ? { ...r, [column]: value } : { ...r }));
  return editField(state, key, rows);
}

/* ---------- Khác nguồn (R3) ---------- */

export interface FieldDiff {
  key: string;
  /** Ô con của bảng: dòng (0-based) + khóa cột. */
  row?: number;
  column?: string;
  sourceValue: string | number | boolean | null;
}

/** Ô có ánh xạ, đã sửa tay và khác giá trị nguồn hiện tại ⇒ cờ "Khác <nguồn>" kèm giá trị nguồn. */
export function fieldDiffs<T>(type: DocumentTypeDef<T>, state: ComposedState, source: T): FieldDiff[] {
  const src = type.sourceValues(source);
  const out: FieldDiff[] = [];
  for (const f of type.fields) {
    if (!f.mapped || state.sources[f.key]?.kind !== "manual") continue;
    const cur = state.values[f.key];
    const s = src[f.key];
    if (f.kind === "table") {
      const a = (cur as DocumentRow[]) ?? [];
      const b = (s as DocumentRow[] | undefined) ?? [];
      for (let i = 0; i < Math.max(a.length, b.length); i++)
        for (const c of f.columns ?? []) {
          const av = a[i]?.[c.key] ?? null;
          const bv = b[i]?.[c.key] ?? null;
          if (String(av ?? "") !== String(bv ?? "")) out.push({ key: f.key, row: i, column: c.key, sourceValue: bv });
        }
    } else if (!sameValue(cur, s ?? emptyOf(f))) out.push({ key: f.key, sourceValue: (s as string | boolean | undefined) ?? null });
  }
  return out;
}

/**
 * R10 "Lấy lại số từ <nguồn>": ô chưa sửa tay có ánh xạ nhận giá trị nguồn mới; nguồn trống mà ô trước đó lấy
 * từ nguồn ⇒ về mặc định / trống. Ô sửa tay, ô chép lần trước, ô không ánh xạ giữ nguyên.
 */
export function refreshFromSource<T>(type: DocumentTypeDef<T>, state: ComposedState, source: T): ComposedState {
  const src = type.sourceValues(source);
  const values = { ...state.values };
  const sources = { ...state.sources };
  for (const f of type.fields) {
    if (!f.mapped || sources[f.key]?.kind === "manual") continue;
    if (hasValue(src[f.key])) {
      values[f.key] = cloneValue(src[f.key]);
      sources[f.key] = { kind: "source" };
    } else if (sources[f.key]?.kind === "source") {
      const r = prefillField({ ...f, mapped: false, carryOver: false }, src, null);
      values[f.key] = r.value;
      sources[f.key] = r.source;
    }
  }
  return { values, sources };
}

/* ---------- Ô bắt buộc (R5) ---------- */

/** Khóa các ô bắt buộc còn thiếu, theo thứ tự trên mẫu. Bảng: 0 dòng hoặc một dòng thiếu ô con bắt buộc. */
export function validateComposed<T>(type: DocumentTypeDef<T>, values: DocumentValues): string[] {
  return type.fields
    .filter((f) => {
      const v = values[f.key];
      if (f.kind === "table") {
        const rows = (v as DocumentRow[] | undefined) ?? [];
        const req = (f.columns ?? []).filter((c) => c.required);
        return (f.required && rows.length === 0) || rows.some((r) => req.some((c) => String(r[c.key] ?? "").trim() === ""));
      }
      return (!!f.required || !!f.requiredWhen?.(values)) && !hasValue(v);
    })
    .map((f) => f.key);
}

/** Cộng một cột số của bảng (dòng Tổng — R6). */
export const sumColumn = (rows: readonly DocumentRow[], column: string): number =>
  rows.reduce((s, r) => s + (typeof r[column] === "number" ? (r[column] as number) : Number(r[column]) || 0), 0);

/* ---------- Trạng thái (R10) ---------- */

export type ComposedStatus = "draft" | "exported" | "edited-after-export";

export const COMPOSED_STATUS_LABELS: Record<ComposedStatus, string> = {
  draft: "Nháp",
  exported: "Đã xuất",
  "edited-after-export": "Sửa sau lần xuất",
};

/** Nhãn nguồn ô (R3) — chữ trên app, hộp "?" phải nhắc đủ (AC-17). */
export function fieldSourceLabel<T>(type: DocumentTypeDef<T>, s: FieldSource | undefined): string {
  switch (s?.kind) {
    case "source":
      return type.labels.source;
    case "previous":
      return type.labels.previous(s.ref ?? "");
    case "default":
      return "Mặc định mẫu";
    case "manual":
      return "Sửa tay";
    default:
      return "Trống";
  }
}

/** Lần xuất gần nhất của một bản soạn. */
export function latestExport(exports: readonly ComposedDocumentExport[], documentId: string): ComposedDocumentExport | null {
  return (
    exports
      .filter((e) => e.documentId === documentId)
      .sort((a, b) => a.exportedAt.localeCompare(b.exportedAt))
      .at(-1) ?? null
  );
}

export function composedStatus(values: DocumentValues, last: Pick<ComposedDocumentExport, "snapshot"> | null): ComposedStatus {
  if (!last) return "draft";
  return stableStringify(values) === stableStringify(last.snapshot) ? "exported" : "edited-after-export";
}

/** R10: nguồn đã sửa sau lần điền / lấy lại gần nhất. */
export const isSourceStale = (composedRevisionNo: number, sourceRevisionNo: number): boolean => sourceRevisionNo > composedRevisionNo;

/* ---------- Lần trước cùng khách + mặt hàng (R2) ---------- */

/**
 * Lần xuất gần nhất của một bản soạn KHÁC cùng loại văn bản, cùng khách, có mặt hàng `productId`, nguồn còn sống.
 * Bản soạn chưa xuất lần nào không tính.
 */
export function previousExportFor(
  docs: readonly ComposedDocument[],
  exports: readonly ComposedDocumentExport[],
  q: { docType: string; customerKey: string; productId: string; excludeSourceId: string; isSourceLive: (sourceId: string) => boolean },
): PreviousExport | null {
  const byId = new Map(
    docs
      .filter(
        (d) =>
          d.docType === q.docType &&
          d.sourceId !== q.excludeSourceId &&
          d.customerKey === q.customerKey &&
          !!q.productId &&
          d.productIds.includes(q.productId) &&
          q.isSourceLive(d.sourceId),
      )
      .map((d) => [d.id, d]),
  );
  const last = exports
    .filter((e) => byId.has(e.documentId))
    .sort((a, b) => a.exportedAt.localeCompare(b.exportedAt))
    .at(-1);
  return last ? { values: last.snapshot, ref: byId.get(last.documentId)!.sourceRef } : null;
}

/* ---------- Khuôn (R13) ---------- */

export interface TemplateCheck {
  ok: boolean;
  missingRequired: string[];
  missingOptional: string[];
  unknownTags: string[];
}

export function checkTemplateTags<T>(type: DocumentTypeDef<T>, tags: readonly string[]): TemplateCheck {
  const have = new Set(tags);
  const known = new Set([...type.templateTags.required, ...type.templateTags.optional]);
  const missingRequired = type.templateTags.required.filter((t) => !have.has(t));
  return {
    ok: missingRequired.length === 0,
    missingRequired,
    missingOptional: type.templateTags.optional.filter((t) => !have.has(t)),
    unknownTags: [...have].filter((t) => !known.has(t)).sort(),
  };
}

/** Khuôn đang dùng của loại văn bản; chưa tải khuôn nào ⇒ khuôn gốc. */
export function activeTemplateId(templates: readonly DocumentTemplate[], docType: string): string {
  const active = templates.filter((t) => t.docType === docType && t.status === "active").sort((a, b) => a.versionNo - b.versionNo);
  return active.at(-1)?.id ?? builtinTemplateId(docType);
}

/** Đặt một khuôn làm đang dùng: các khuôn khác cùng loại văn bản ⇒ ngưng (đúng 1 khuôn đang dùng). */
export function activateTemplate(templates: readonly DocumentTemplate[], id: string): DocumentTemplate[] {
  const target = templates.find((t) => t.id === id);
  if (!target) return [...templates];
  return templates.map((t) => (t.docType !== target.docType ? t : { ...t, status: t.id === id ? "active" : "retired" }));
}

export const nextTemplateVersion = (templates: readonly DocumentTemplate[], docType: string): number =>
  Math.max(0, ...templates.filter((t) => t.docType === docType).map((t) => t.versionNo)) + 1;

/* ---------- Xuất (R9, R11, R14) ---------- */

/** R11: nguồn đã hủy ⇒ không soạn mới, không sửa, không xuất mới; tải lại vẫn được. */
export const canEditComposed = (sourceLive: boolean): boolean => sourceLive;

export function makeExport(
  doc: Pick<ComposedDocument, "id" | "values">,
  format: ComposedDocumentExport["format"],
  templateId: string,
  by: string,
  at: string,
  id: string,
): ComposedDocumentExport {
  return { id, documentId: doc.id, format, templateId, snapshot: JSON.parse(JSON.stringify(doc.values)) as DocumentValues, exportedBy: by, exportedAt: at };
}

/** R14: tải lại một lần xuất dùng đúng ảnh chụp + khuôn của lần đó (không phải khuôn đang dùng). */
export const replayExport = (e: ComposedDocumentExport): { values: DocumentValues; templateId: string } => ({
  values: e.snapshot,
  templateId: e.templateId,
});
