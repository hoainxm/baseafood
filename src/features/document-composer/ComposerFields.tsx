// ============================================================
// Tên file: src/features/document-composer/ComposerFields.tsx
// Tên tiếng Việt: Bộ soạn văn bản — các ô của văn bản theo nhóm, kèm nguồn từng ô
// Description: Generic field editor of the document composer (ba-spec 54 R1, R3): renders any document type's
//              fields by group (text / multiline / date / choice / check / table rows), shows each field's source
//              ("Từ lệnh", "Từ file LSX …", "Mặc định mẫu", "Sửa tay") and the "differs from source" flag.
// ============================================================
import { ChoiceGroup, Field, FormSection, Input, NumberField, Tag, Textarea } from "@/design-system";
import { fieldSourceLabel, type DocumentField, type DocumentTypeDef, type FieldDiff } from "@/lib/documentComposer";
import { formatDateVN } from "@/lib/format";
import type { DocumentFieldValue, DocumentRow, FieldSources, DocumentValues } from "@/types";

const YES = "yes";
const NO = "no";

function SourceTags({ type, field, sources, diffs }: { type: DocumentTypeDef<never>; field: DocumentField; sources: FieldSources; diffs: FieldDiff[] }) {
  const src = sources[field.key];
  const mine = diffs.filter((d) => d.key === field.key);
  return (
    <span className="flex flex-wrap gap-1">
      <Tag variant={src?.kind === "manual" ? "pending" : src?.kind === "empty" ? "muted" : "source"}>{fieldSourceLabel(type, src)}</Tag>
      {mine.length > 0 && <Tag variant="warning">{type.labels.differs}</Tag>}
    </span>
  );
}

const shown = (f: DocumentField, v: unknown): string => {
  if (f.kind === "check") return v === true ? "Có" : "Không";
  if (f.kind === "date" && typeof v === "string" && v) return formatDateVN(v);
  return typeof v === "string" ? v : v == null ? "" : String(v);
};

/** Giá trị nguồn để hiện cạnh cờ "Khác …". */
const diffHint = (type: DocumentTypeDef<never>, f: DocumentField, diffs: FieldDiff[]): string | undefined => {
  const d = diffs.find((x) => x.key === f.key && x.row == null);
  return d ? `${type.labels.differs}: giá trị trên nguồn là "${shown(f, d.sourceValue) || "trống"}"` : undefined;
};

function ScalarField({
  type,
  field: f,
  value,
  readOnly,
  missing,
  sources,
  diffs,
  onEdit,
}: {
  type: DocumentTypeDef<never>;
  field: DocumentField;
  value: DocumentFieldValue | undefined;
  readOnly: boolean;
  missing: boolean;
  sources: FieldSources;
  diffs: FieldDiff[];
  onEdit: (key: string, v: DocumentFieldValue) => void;
}) {
  const error = missing ? `Ghi ${f.label.toLowerCase()} trước khi xuất file` : undefined;
  const hint = diffHint(type, f, diffs);
  const tags = <SourceTags type={type} field={f} sources={sources} diffs={diffs} />;
  if (readOnly)
    return (
      <div className="grid min-w-0 gap-1">
        <span className="text-sm text-muted-foreground">{f.label}</span>
        <span className="min-w-0 whitespace-pre-wrap break-words font-medium">{shown(f, value) || "—"}</span>
        {tags}
      </div>
    );
  if (f.kind === "choice" || f.kind === "check") {
    const options = f.kind === "check" ? [{ value: YES, label: "Có" }, { value: NO, label: "Không" }] : (f.options ?? []).map((o) => ({ value: o, label: o }));
    const v = f.kind === "check" ? (value === true ? YES : NO) : typeof value === "string" ? value : "";
    return (
      <div className="grid min-w-0 gap-1">
        <ChoiceGroup label={f.label} value={v} options={options} required={f.required} error={error} hint={hint} columns={options.length > 3 ? 3 : 2} onChange={(x) => onEdit(f.key, f.kind === "check" ? x === YES : x)} />
        {tags}
      </div>
    );
  }
  const text = typeof value === "string" ? value : "";
  return (
    <div className="grid min-w-0 gap-1">
      <Field label={f.label} required={f.required} error={error} hint={hint}>
        {f.kind === "multiline" ? (
          <Textarea value={text} rows={3} onChange={(e) => onEdit(f.key, e.target.value)} />
        ) : (
          <Input type={f.kind === "date" ? "date" : "text"} value={text} onChange={(e) => onEdit(f.key, e.target.value)} />
        )}
      </Field>
      {tags}
    </div>
  );
}

function TableField({
  type,
  field: f,
  rows,
  readOnly,
  missing,
  sources,
  diffs,
  onEditCell,
}: {
  type: DocumentTypeDef<never>;
  field: DocumentField;
  rows: DocumentRow[];
  readOnly: boolean;
  missing: boolean;
  sources: FieldSources;
  diffs: FieldDiff[];
  onEditCell: (key: string, row: number, column: string, v: string | number | null) => void;
}) {
  const cellDiff = (i: number, c: string) => diffs.find((d) => d.key === f.key && d.row === i && d.column === c);
  return (
    <div className="grid min-w-0 gap-3 sm:col-span-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{f.label}</span>
        <SourceTags type={type} field={f} sources={sources} diffs={diffs} />
      </div>
      {missing && <p className="text-sm text-destructive">Bảng cần ít nhất 1 dòng, mỗi dòng đủ tên hàng, số thùng, số kg.</p>}
      {rows.map((r, i) => (
        <div key={i} className="grid min-w-0 gap-3 rounded-lg border-2 border-border p-3 sm:grid-cols-2">
          <span className="font-semibold sm:col-span-2">Dòng {i + 1}</span>
          {(f.columns ?? []).map((c) => {
            const d = cellDiff(i, c.key);
            const hint = d ? `${type.labels.differs}: trên nguồn là ${d.sourceValue ?? "trống"}` : undefined;
            const v = r[c.key];
            if (readOnly)
              return (
                <div key={c.key} className="grid min-w-0 gap-1">
                  <span className="text-sm text-muted-foreground">{c.label}</span>
                  <span className="whitespace-pre-wrap break-words font-medium">{v == null || v === "" ? "—" : String(v)}</span>
                </div>
              );
            if (c.kind === "number")
              return (
                <NumberField
                  key={c.key}
                  label={c.label}
                  value={typeof v === "number" ? v : v == null || v === "" ? null : Number(v)}
                  unit={c.key === "kg" ? "kg" : "thùng"}
                  required={c.required}
                  hint={hint}
                  onChange={(x) => onEditCell(f.key, i, c.key, x)}
                />
              );
            return (
              <Field key={c.key} label={c.label} required={c.required} hint={hint} className={c.kind === "multiline" ? "sm:col-span-2" : undefined}>
                {c.kind === "multiline" ? (
                  <Textarea value={typeof v === "string" ? v : ""} rows={3} onChange={(e) => onEditCell(f.key, i, c.key, e.target.value)} />
                ) : (
                  <Input value={typeof v === "string" ? v : ""} onChange={(e) => onEditCell(f.key, i, c.key, e.target.value)} />
                )}
              </Field>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Mọi ô của một loại văn bản, theo nhóm trên mẫu. `missing` = khóa ô bắt buộc còn thiếu (R5) — chỉ hiện sau lần xuất bị chặn. */
export function ComposerFields<T>({
  type,
  values,
  sources,
  diffs,
  readOnly,
  missing,
  onEdit,
  onEditCell,
}: {
  type: DocumentTypeDef<T>;
  values: DocumentValues;
  sources: FieldSources;
  diffs: FieldDiff[];
  readOnly: boolean;
  missing: readonly string[];
  onEdit: (key: string, v: DocumentFieldValue) => void;
  onEditCell: (key: string, row: number, column: string, v: string | number | null) => void;
}) {
  const t = type as unknown as DocumentTypeDef<never>;
  const groups = [...new Set(type.fields.map((f) => f.group))];
  return (
    <div className="grid min-w-0 gap-5">
      {groups.map((g) => (
        <FormSection key={g} title={g}>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {type.fields
              .filter((f) => f.group === g)
              .map((f) =>
                f.kind === "table" ? (
                  <TableField
                    key={f.key}
                    type={t}
                    field={f}
                    rows={(values[f.key] as DocumentRow[] | undefined) ?? []}
                    readOnly={readOnly}
                    missing={missing.includes(f.key)}
                    sources={sources}
                    diffs={diffs}
                    onEditCell={onEditCell}
                  />
                ) : (
                  <ScalarField key={f.key} type={t} field={f} value={values[f.key]} readOnly={readOnly} missing={missing.includes(f.key)} sources={sources} diffs={diffs} onEdit={onEdit} />
                ),
              )}
          </div>
        </FormSection>
      ))}
    </div>
  );
}
