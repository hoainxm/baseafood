// ============================================================
// Tên file: src/features/document-composer/TemplatePanel.tsx
// Tên tiếng Việt: Khuôn Word của loại văn bản — khu quản trị trong bộ soạn
// Description: Admin-only template management (ba-spec 54 DC4, R13): download the built-in / active template, upload a
//              new .docx (tags checked: missing required ⇒ rejected, missing optional / unknown ⇒ warned), choose the
//              active version or go back to the built-in one. Templates are never deleted (R17).
// ============================================================
import { useRef, useState } from "react";
import { FileUp, LayoutTemplate } from "lucide-react";
import { Button, Tag, notify } from "@/design-system";
import { activateTemplate, checkTemplateTags, nextTemplateVersion, type DocumentTypeDef, type TemplateCheck } from "@/lib/documentComposer";
import { readTemplateTags } from "@/lib/docxTemplate";
import { checkTemplateFile, documentTemplatePath, uploadTemplateFile } from "@/lib/documentTemplateStorage";
import { BUILTIN_TEMPLATES } from "@/lib/documentTypes";
import { downloadDocx } from "@/lib/docxTemplate";
import { newId } from "@/lib/store";
import type { DocumentTemplate } from "@/types";

export function TemplatePanel<T>({
  type,
  templates,
  activeId,
  by,
  onSaveTemplates,
  onDownloadActive,
}: {
  type: DocumentTypeDef<T>;
  templates: readonly DocumentTemplate[];
  activeId: string;
  by: string;
  onSaveTemplates: (rows: DocumentTemplate[]) => boolean;
  onDownloadActive: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ fileName: string; check: TemplateCheck } | null>(null);
  const mine = templates.filter((t) => t.docType === type.key).sort((a, b) => b.versionNo - a.versionNo);
  const builtin = BUILTIN_TEMPLATES[type.key];

  async function upload(file: File) {
    const bad = checkTemplateFile(file);
    if (bad) return notify.error(bad);
    setBusy(true);
    try {
      let tags: string[];
      try {
        tags = readTemplateTags(new Uint8Array(await file.arrayBuffer()));
      } catch (e) {
        return notify.error(`Khuôn "${file.name}" lỗi thẻ (thẻ mở không đóng, gõ sai dấu ngoặc…): ${e instanceof Error ? e.message : String(e)}`);
      }
      const check = checkTemplateTags(type, tags);
      setResult({ fileName: file.name, check });
      if (!check.ok) return;
      const id = newId();
      const up = await uploadTemplateFile(documentTemplatePath(type.key, id, file.name), file);
      if ("error" in up) return notify.error(up.error);
      const row: DocumentTemplate = {
        id,
        docType: type.key,
        versionNo: nextTemplateVersion(templates, type.key),
        fileName: file.name,
        filePath: up.path,
        tags,
        status: "active",
        uploadedBy: by,
        uploadedAt: new Date().toISOString(),
      };
      const prev = [...templates];
      if (onSaveTemplates(activateTemplate([...templates, row], id)))
        notify.saved(`Đã dùng khuôn mới "${file.name}" (bản ${row.versionNo}) — lần xuất sau theo khuôn này`, () => onSaveTemplates(prev));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const choose = (id: string | null) => {
    const prev = [...templates];
    const next = id ? activateTemplate(templates, id) : templates.map((t) => (t.docType === type.key ? { ...t, status: "retired" as const } : t));
    if (onSaveTemplates(next)) notify.saved(id ? "Đã đổi khuôn đang dùng" : "Đã về khuôn gốc", () => onSaveTemplates(prev));
  };

  return (
    <section data-tour="compose-templates" className="grid min-w-0 gap-3 rounded-xl border-2 border-border p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <LayoutTemplate className="h-4 w-4" aria-hidden />
        Khuôn Word (quản trị)
      </h3>
      <p className="max-w-3xl text-muted-foreground">
        Tải khuôn về, sửa trong Word (giữ nguyên các thẻ trong ngoặc nhọn như {"{orderNo}"}, bảng hàng giữ {"{#lines}"} … {"{/lines}"}), lưu dạng .docx rồi tải lên. App kiểm thẻ trước khi
        nhận. Lần xuất cũ vẫn giữ khuôn lúc xuất.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => downloadDocx(builtin.build(), builtin.fileName)} title="Tải khuôn gốc đi kèm app (dựng theo LSX 19.10) để sửa trong Word.">
          Tải khuôn gốc
        </Button>
        <Button variant="outline" onClick={onDownloadActive} title="Tải khuôn đang dùng để sửa tiếp trong Word.">
          Tải khuôn đang dùng
        </Button>
        <input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <Button onClick={() => inputRef.current?.click()} title="Tải khuôn Word mới (.docx) lên — đủ thẻ bắt buộc thì thành khuôn đang dùng.">
          <FileUp className="mr-2 h-4 w-4" aria-hidden />
          {busy ? "Đang kiểm khuôn…" : "Tải khuôn mới lên"}
        </Button>
      </div>
      {result && (
        <div role="status" className={`grid gap-1 rounded-lg px-4 py-2 text-sm ${result.check.ok ? "bg-muted" : "bg-warning-surface"}`}>
          <b>{result.check.ok ? `Đã nhận khuôn "${result.fileName}".` : `Không nhận khuôn "${result.fileName}": thiếu thẻ bắt buộc.`}</b>
          {result.check.missingRequired.length > 0 && <span>Thẻ bắt buộc còn thiếu: {result.check.missingRequired.map((t) => `{${t}}`).join(", ")}</span>}
          {result.check.missingOptional.length > 0 && <span>Các ô sẽ không có trên file: {result.check.missingOptional.map((t) => `{${t}}`).join(", ")}</span>}
          {result.check.unknownTags.length > 0 && <span>Thẻ lạ sẽ để trống: {result.check.unknownTags.map((t) => `{${t}}`).join(", ")}</span>}
        </div>
      )}
      <ul className="grid gap-2">
        <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-border px-3 py-2">
          <span>Khuôn gốc (đi kèm app)</span>
          {activeId === `builtin:${type.key}` ? (
            <Tag variant="done">Đang dùng</Tag>
          ) : (
            <Button size="sm" variant="outline" onClick={() => choose(null)} title="Thôi dùng khuôn đã tải lên, về khuôn gốc của app.">
              Dùng khuôn này
            </Button>
          )}
        </li>
        {mine.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-border px-3 py-2">
            <span className="min-w-0 break-words">
              Bản {t.versionNo} · {t.fileName} · {t.uploadedBy || "—"}
            </span>
            {t.id === activeId ? (
              <Tag variant="done">Đang dùng</Tag>
            ) : (
              <Button size="sm" variant="outline" onClick={() => choose(t.id)} title="Dùng khuôn này cho các lần xuất sau.">
                Dùng khuôn này
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
