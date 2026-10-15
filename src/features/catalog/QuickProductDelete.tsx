// ============================================================
// Tên file: src/features/catalog/QuickProductDelete.tsx
// Tên tiếng Việt: Xóa nhanh mặt hàng ngay trong ô chọn (dọn danh mục thành phẩm)
// Description: Combobox trash-can flow for products — usage check, confirm, undo
// ============================================================
// Chốt 2026-10-15: danh mục mặt hàng có 263 mục, nhiều mục là quy cách nguyên liệu
// (VD "2 DA <80GR") lọt vào từ "Đồng bộ danh mục" của Sổ kho tháng. Người dùng dọn
// NGAY lúc chọn ở /wip, sẽ khóa lại sau. Thùng rác chỉ hiện khi có quyền Xóa tab Mặt
// hàng và mục không gắn 141 mã kế toán. Bấm ⇒ kiểm mục đã nằm trong sổ nào chưa
// (lib/productUsage.ts): đã dùng ⇒ chặn + nêu sổ; chưa ⇒ `ConfirmDelete` + toast Hoàn tác.
//
// ⚠️ Ghi qua `rows` / `onChange` CỦA MÀN GỌI (như QuickCatalogEdit) — instance khác
// không thấy thay đổi và lần ghi sau sẽ đè lại.
import { useState } from "react";
import type { Product, WipProductionItem } from "@/types";
import {
  useBalancingOutputs,
  useExportItems,
  useFinishedGoodsOpeningStock,
  useOrderItems,
  usePackagings,
  useSalesItems,
} from "@/lib/catalogRepo";
import { findProductUsage, productDeleteBlocker } from "@/lib/productUsage";
import { ConfirmDelete, notify } from "@/design-system";
import { useCan } from "@/features/shared/PermissionProvider";

export function useQuickProductDelete(
  products: Product[],
  setProducts: (next: Product[]) => void,
  opts: {
    /** Sổ sản xuất màn gọi đang giữ (đỡ nạp lại). */
    wips: Pick<WipProductionItem, "productId">[];
    /** Gọi sau khi xóa — VD bỏ mặt hàng khỏi các dòng đang gõ dở. */
    onDeleted?: (productId: string) => void;
  }
) {
  const allowed = useCan("catalog.products");
  const [packagings] = usePackagings();
  const [salesItems] = useSalesItems();
  const [orderItems] = useOrderItems();
  const [exportItems] = useExportItems();
  const [balancingOutputs] = useBalancingOutputs();
  const [finishedOpeningStock] = useFinishedGoodsOpeningStock();
  const [target, setTarget] = useState<Product | null>(null);

  /** Có thùng rác không: có quyền xóa + không gắn mã kế toán (mục đang dùng vẫn hiện — bấm mới báo vì sao). */
  const canDelete = (id: string) => {
    if (!allowed.delete) return false;
    const p = products.find((x) => x.id === id);
    return Boolean(p) && !p!.finishedGoodCode?.trim();
  };

  const requestDelete = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const usages = findProductUsage(id, {
      wips: opts.wips,
      packagings,
      salesItems,
      orderItems,
      exportItems,
      balancingOutputs,
      finishedOpeningStock,
    });
    const blocker = productDeleteBlocker(p, usages);
    if (blocker) {
      notify.warning(blocker);
      return;
    }
    setTarget(p);
  };

  const confirmDelete = () => {
    if (!target) return;
    const prevRows = products;
    setProducts(products.filter((x) => x.id !== target.id));
    opts.onDeleted?.(target.id);
    notify.deleted(`Đã xóa "${target.name}" khỏi danh mục mặt hàng`, () => setProducts(prevRows));
    setTarget(null);
  };

  const dialog = (
    <ConfirmDelete
      open={target !== null}
      onOpenChange={(open) => !open && setTarget(null)}
      title="Xóa mặt hàng khỏi danh mục?"
      confirmLabel="Xóa mặt hàng"
      recordDescription={
        target
          ? `${target.name}${target.category ? ` · ${target.category}` : ""} — chưa có trong sổ nào, xóa khỏi danh mục mặt hàng.`
          : ""
      }
      onConfirm={confirmDelete}
    />
  );

  return {
    canDelete,
    requestDelete,
    dialog,
    deleteLabel: "Xóa mặt hàng này khỏi danh mục — chỉ xóa được khi chưa nằm trong sổ nào (có hỏi xác nhận, còn nút Hoàn tác).",
  };
}
