// ============================================================
// Tên file: src/features/export-planning/goodsTypePicker.tsx
// Tên tiếng Việt: Ô chọn Loại hàng có Thêm mới + bút chì sửa nhanh
// Description: Combobox wiring for the goods-type catalog (mig 0089) — create in place + quick edit
// ============================================================
// Dùng ở dòng hàng phiếu HĐ xuất (ContractFormDialog) và HĐ nhập (ImportDialogs). Mỗi phiếu gọi MỘT lần:
// cùng một instance `useGoodsTypeStore` cho cả chọn, thêm mới và bút chì (README § Ô chọn danh mục).
import { notify } from "@/design-system";
import { useQuickCatalogEdit } from "@/features/catalog/QuickCatalogEdit";
import { useGoodsTypeStore } from "@/lib/catalogRepo";
import { findOrCreateGoodsType, sortGoodsTypes } from "@/lib/goodsTypes";
import { newId } from "@/lib/store";

export function useGoodsTypePicker() {
  const store = useGoodsTypeStore();
  const list = sortGoodsTypes(store.goodsTypes);
  const editor = useQuickCatalogEdit("goodsType", list, (next) => void store.setGoodsTypes(next));

  const addGoodsType = (text: string): string => {
    const r = findOrCreateGoodsType(text, store.goodsTypes, newId);
    if (r.created) {
      store.setGoodsTypes(r.rows);
      notify.saved(`Đã thêm loại hàng "${text.trim()}" vào danh mục`);
    }
    return r.id;
  };

  return {
    /** Máy chủ đã chạy 0089 (hoặc chạy không máy chủ) — chưa ⇒ phiếu ẩn ô Loại hàng. */
    isAvailable: store.isAvailable,
    rows: list,
    options: list.map((g) => ({ value: g.id, label: g.name, subLabel: g.note.trim() || undefined })),
    onCreate: store.isAvailable && editor.canCreate ? addGoodsType : undefined,
    onEditItem: editor.openEdit,
    canEdit: (value: string) => store.isAvailable && editor.canEdit(value),
    editLabel: editor.editLabel,
    dialog: editor.dialog,
  };
}
