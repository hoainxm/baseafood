// ============================================================
// Tên file: src/features/export-planning/exportOptionPicker.tsx
// Tên tiếng Việt: Ô chọn theo danh sách của Xuất khẩu — cảng xếp, cảng đích, loại container, tiền tệ
// Description: Combobox wiring for export option lists (mig 0095, ba-spec 62) — create, quick edit, delete with undo
// ============================================================
// Mỗi phiếu gọi MỘT lần (cùng instance `useExportOptionStore` cho chọn, thêm, sửa, xóa — README § Ô chọn
// danh mục). Giá trị ô = CHỮ của mục (R2): xóa / đổi tên mục không đụng HĐ / chuyến đã ghi; giá trị cũ
// không khớp mục nào hiện ở đầu danh sách, đánh dấu "ngoài danh sách" (Q6).
import { useState, type ReactNode } from "react";
import { ConfirmDelete, notify } from "@/design-system";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { useCan } from "@/features/shared/PermissionProvider";
import { useExportOptionStore } from "@/lib/catalogRepo";
import {
  exportOptionChoices,
  exportOptionListMeta,
  exportOptionsOf,
  findOrCreateExportOption,
  matchExportOption,
  replaceExportOptionList,
} from "@/lib/exportOptions";
import { newId } from "@/lib/store";
import type { ExportOption, ExportOptionListKind } from "@/types";

export function useExportOptionPicker() {
  const store = useExportOptionStore();
  const allowed = useCan("export-plans");
  const all = store.options;
  const save = (next: ExportOption[]) => {
    if (!store.isAvailable) {
      notify.error("Máy chủ chưa chạy migration 0095 — chưa thêm / sửa / xóa danh sách chọn được. Báo chủ dự án.");
      return false;
    }
    return store.setOptions(next);
  };
  const listEditor = (kind: ExportOptionListKind) => (next: ExportOption[]) => void save(replaceExportOptionList(all, kind, next));
  // Bốn hộp sửa nhanh — số lần gọi hook cố định, mỗi danh sách tra tên trong đúng danh sách của nó.
  const editors: Record<ExportOptionListKind, ReturnType<typeof useQuickCatalogEdit<"exportOption">>> = {
    "loading-port": useQuickCatalogEdit("exportOption", exportOptionsOf(all, "loading-port"), listEditor("loading-port"), { matchBy: "name" }),
    "discharge-port": useQuickCatalogEdit("exportOption", exportOptionsOf(all, "discharge-port"), listEditor("discharge-port"), { matchBy: "name" }),
    "container-type": useQuickCatalogEdit("exportOption", exportOptionsOf(all, "container-type"), listEditor("container-type"), { matchBy: "name" }),
    currency: useQuickCatalogEdit("exportOption", exportOptionsOf(all, "currency"), listEditor("currency"), { matchBy: "name" }),
    "bank-account": useQuickCatalogEdit("exportOption", exportOptionsOf(all, "bank-account"), listEditor("bank-account"), { matchBy: "name" }),
  };
  const [deleting, setDeleting] = useState<ExportOption | null>(null);

  const findIn = (kind: ExportOptionListKind, value: string) => exportOptionsOf(all, kind).find((o) => o.name === value);

  /** Props cho `Combobox` của một danh sách. `value` của màn có thể khác hoa thường ⇒ hiện đúng mục. */
  const fieldProps = (kind: ExportOptionListKind, value: string) => {
    const meta = exportOptionListMeta(kind);
    const editor = editors[kind];
    const canWrite = store.isAvailable;
    return {
      value: matchExportOption(value, all, kind),
      options: exportOptionChoices(all, kind, value),
      onCreate:
        canWrite && editor.canCreate
          ? (text: string): string => {
              const r = findOrCreateExportOption(text, kind, all, newId);
              if (r.created && save(r.rows)) notify.saved(`Đã thêm ${meta.entityName} "${r.option.name}" vào danh sách`);
              return r.option.name;
            }
          : undefined,
      onEditItem: editor.openEdit,
      canEdit: (v: string) => canWrite && editor.canEdit(v),
      editLabel: `Sửa tên / ghi chú ${meta.entityName} này — hợp đồng đã ghi giữ nguyên chữ cũ.`,
      onDeleteItem: (v: string) => {
        const o = findIn(kind, v);
        if (o) setDeleting(o);
      },
      canDelete: (v: string) => canWrite && allowed.delete && !!findIn(kind, v),
      deleteLabel: `Xóa ${meta.entityName} này khỏi danh sách (có hỏi xác nhận). Hợp đồng / chuyến đã ghi giữ nguyên chữ.`,
    };
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const prev = all;
    const meta = exportOptionListMeta(deleting.listKind);
    if (save(all.filter((o) => o.id !== deleting.id))) {
      notify.deleted(`Đã xóa ${meta.entityName} "${deleting.name}" khỏi danh sách`, () => void save(prev));
    }
    setDeleting(null);
  };

  const dialogs: ReactNode = (
    <>
      {editors["loading-port"].dialog}
      {editors["discharge-port"].dialog}
      {editors["container-type"].dialog}
      {editors.currency.dialog}
      {editors["bank-account"].dialog}
      <ConfirmDelete
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Xóa ${exportOptionListMeta(deleting.listKind).entityName} khỏi danh sách?` : "Xóa khỏi danh sách?"}
        confirmLabel="Xóa khỏi danh sách"
        recordDescription={deleting ? `"${deleting.name}" — không hiện ở ô chọn nữa. Hợp đồng / chuyến đã ghi giữ nguyên chữ.` : ""}
        onConfirm={confirmDelete}
      />
    </>
  );

  return { fieldProps, dialogs, isAvailable: store.isAvailable, options: all };
}
