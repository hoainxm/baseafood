// ============================================================
// Tên file: src/features/export-planning/documentKindPicker.tsx
// Tên tiếng Việt: Ô chọn Loại chứng từ có Thêm mới + bút chì sửa nhanh
// Description: Combobox wiring for export document kinds (catalog table, mig 0081) — create in place + quick edit
// ============================================================
import { notify } from "@/design-system";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { documentKindList, documentKindRowsFromList, findOrCreateDocumentKind } from "@/lib/exportPlanning";
import { newId } from "@/lib/store";
import type { ExportDocumentKindRow } from "@/types";

/** Danh mục loại chứng từ CỦA MÀN GỌI (đúng instance `useTable` của `useExportData`). */
export interface DocumentKindSource {
  rows: readonly ExportDocumentKindRow[];
  setRows: (rows: readonly ExportDocumentKindRow[]) => boolean;
  /** Máy chủ đã có bảng 0081 (hoặc chạy không máy chủ). Chưa có ⇒ ô chỉ cho chọn 10 loại gốc. */
  isAvailable: boolean;
}

/**
 * Props cho `Combobox` Loại chứng từ (README § Ô chọn danh mục): danh sách đầy đủ, `onCreate` (trùng tên
 * ⇒ trả loại có sẵn), bút chì sửa nhanh qua `useQuickCatalogEdit("documentKind")`. Render `dialog` MỘT lần.
 */
export function useDocumentKindPicker(source: DocumentKindSource) {
  const list = documentKindList(source.rows);
  const editor = useQuickCatalogEdit("documentKind", list, (next) => void source.setRows(documentKindRowsFromList(next)));
  const canWrite = source.isAvailable;

  const addKind = (text: string): string => {
    const r = findOrCreateDocumentKind(text, source.rows, newId);
    if (r.created && source.setRows(r.rows)) notify.saved(`Đã thêm loại chứng từ "${text.trim()}" vào danh mục`);
    return r.id;
  };

  return {
    options: list.map((k) => ({ value: k.id, label: k.name, subLabel: k.note.trim() || undefined })),
    onCreate: canWrite && editor.canCreate ? addKind : undefined,
    onEditItem: editor.openEdit,
    canEdit: (value: string) => canWrite && editor.canEdit(value),
    editLabel: editor.editLabel,
    dialog: editor.dialog,
  };
}
