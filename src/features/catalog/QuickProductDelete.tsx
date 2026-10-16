// ============================================================
// Tên file: src/features/catalog/QuickProductDelete.tsx
// Tên tiếng Việt: Xóa nhanh mặt hàng ngay trong ô chọn (dọn danh mục thành phẩm) + gộp mục trùng tên
// Description: Combobox trash-can flow for products — usage check, confirm, undo; merge same-name duplicates
// ============================================================
// Chốt 2026-10-15: danh mục mặt hàng có 263 mục, nhiều mục là quy cách nguyên liệu
// (VD "2 DA <80GR") lọt vào từ "Đồng bộ danh mục" của Sổ kho tháng. Người dùng dọn
// NGAY lúc chọn ở /wip. Thùng rác chỉ hiện khi có quyền Xóa tab Mặt hàng. Bấm ⇒ kiểm
// mục đã nằm trong sổ nào chưa (lib/productUsage.ts): chưa ⇒ `ConfirmDelete` + Hoàn tác.
//
// Bổ sung 2026-10-16 — GỘP MỤC TRÙNG TÊN: danh mục có cặp cùng tên (VD hai "Bạch tuộc 2 da
// cắt luộc 3gr", mã BT-CAT3G và BT-CAT3GNĐ) đã có dòng sổ ⇒ trước đây không xoá được. Mọi
// thành phẩm đều về kho thành phẩm ⇒ cho GỘP: chuyển mọi dòng sổ sang mục giữ lại rồi xoá
// mục trùng. Có máy chủ ⇒ hàm `merge_products` (migration 0069, một giao dịch, Hoàn tác
// được); localStorage ⇒ gộp qua các hook bằng lib/productMerge. Mục trùng tên có thùng rác
// kể cả khi gắn mã kế toán — mã (141 mã) vẫn còn nguyên, chỉ dòng mặt hàng bị xoá.
//
// ⚠️ Ghi qua `rows` / `onChange` CỦA MÀN GỌI (như QuickCatalogEdit) — instance khác
// không thấy thay đổi và lần ghi sau sẽ đè lại.
import { useMemo, useState } from "react";
import type { Product, WipProductionItem } from "@/types";
import {
  isServerConnected,
  mergeProductsOnServer,
  undoProductMergeOnServer,
  useBalancingOutputs,
  useBalancingPeriods,
  useExportItems,
  useFinishedGoodsOpeningStock,
  useOrderItems,
  usePackagings,
  useSalesItems,
  useWipProductions,
} from "@/lib/catalogRepo";
import { describeProductUsage, findProductUsage, productDeleteBlocker, type ProductUsage } from "@/lib/productUsage";
import { fillBlankProductFields, findSameNameProducts, remapProductReferences } from "@/lib/productMerge";
import { Button, ChoiceGroup, ConfirmDelete, FormDialog, notify } from "@/design-system";
import { useCan } from "@/features/shared/PermissionProvider";

interface MergeTarget {
  drop: Product;
  candidates: Product[];
  usages: ProductUsage[];
  /** Dòng cân đối của mục bỏ thuộc kỳ ĐÃ CHỐT — vẫn gộp (cùng tên, kg không đổi), báo rõ. */
  lockedBalancingRows: number;
}

const productLabel = (p: Product) => `${p.name}${p.finishedGoodCode ? ` · mã ${p.finishedGoodCode}` : ""}`;

export function useQuickProductDelete(
  products: Product[],
  setProducts: (next: Product[]) => void,
  opts: {
    /** Sổ sản xuất màn gọi đang giữ (đỡ nạp lại). */
    wips: Pick<WipProductionItem, "productId">[];
    /** Gọi sau khi xóa — VD bỏ mặt hàng khỏi các dòng đang gõ dở. Gộp ⇒ có `replacedBy` (mục giữ). */
    onDeleted?: (productId: string, replacedBy?: string) => void;
  }
) {
  const allowed = useCan("catalog.products");
  const [packagings, setPackagings] = usePackagings();
  const [salesItems, setSalesItems] = useSalesItems();
  const [orderItems, setOrderItems] = useOrderItems();
  const [exportItems, setExportItems] = useExportItems();
  const [balancingOutputs, setBalancingOutputs] = useBalancingOutputs();
  const [finishedOpeningStock, setFinishedOpeningStock] = useFinishedGoodsOpeningStock();
  const [allWips, setAllWips] = useWipProductions();
  const [periods] = useBalancingPeriods();
  const [target, setTarget] = useState<Product | null>(null);
  const [mergeTarget, setMergeTarget] = useState<MergeTarget | null>(null);
  const [keepId, setKeepId] = useState("");
  const [isMerging, setIsMerging] = useState(false);

  const lockedPeriodIds = useMemo(() => new Set(periods.filter((k) => k.isLocked).map((k) => k.id)), [periods]);

  /**
   * Có thùng rác không: có quyền xóa VÀ (không gắn mã kế toán HOẶC có mục cùng tên để gộp).
   * Mục đang dùng vẫn hiện — bấm mới báo vì sao / mở hộp gộp.
   */
  const canDelete = (id: string) => {
    if (!allowed.delete) return false;
    const p = products.find((x) => x.id === id);
    if (!p) return false;
    return !p.finishedGoodCode?.trim() || findSameNameProducts(products, id).length > 0;
  };

  const usageOf = (id: string) =>
    findProductUsage(id, {
      wips: opts.wips,
      packagings,
      salesItems,
      orderItems,
      exportItems,
      balancingOutputs,
      finishedOpeningStock,
    });

  const requestDelete = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const usages = usageOf(id);
    const sameName = findSameNameProducts(products, id);
    // Không dùng ở sổ nào, không gắn mã ⇒ xoá thường như trước.
    if (!productDeleteBlocker(p, usages)) {
      setTarget(p);
      return;
    }
    // Đang dùng / gắn mã nhưng có mục cùng tên ⇒ gộp vào mục đó.
    if (sameName.length > 0) {
      // Mục giữ mặc định: mục có nhiều dòng sổ hơn (ít dòng phải chuyển nhất).
      const ranked = [...sameName].sort(
        (a, b) =>
          usageOf(b.id).reduce((n, u) => n + u.count, 0) - usageOf(a.id).reduce((n, u) => n + u.count, 0)
      );
      setKeepId(ranked[0].id);
      setMergeTarget({
        drop: p,
        candidates: ranked,
        usages,
        lockedBalancingRows: balancingOutputs.filter((o) => o.productId === id && lockedPeriodIds.has(o.periodId)).length,
      });
      return;
    }
    notify.warning(productDeleteBlocker(p, usages));
  };

  const confirmDelete = () => {
    if (!target) return;
    const prevRows = products;
    setProducts(products.filter((x) => x.id !== target.id));
    opts.onDeleted?.(target.id);
    notify.deleted(`Đã xóa "${target.name}" khỏi danh mục mặt hàng`, () => setProducts(prevRows));
    setTarget(null);
  };

  /** localStorage: gộp qua các hook (cùng luật với hàm máy chủ 0069). Trả hàm hoàn tác. */
  const mergeLocally = (drop: Product, keep: Product): { moved: number; undo: () => void } => {
    const snapshot = {
      products,
      allWips,
      balancingOutputs,
      salesItems,
      orderItems,
      exportItems,
      finishedOpeningStock,
      packagings,
    };
    const w = remapProductReferences(allWips, ["productId"], drop.id, keep.id);
    const b = remapProductReferences(balancingOutputs, ["productId"], drop.id, keep.id);
    const s = remapProductReferences(salesItems, ["productId"], drop.id, keep.id);
    const o = remapProductReferences(orderItems, ["productId"], drop.id, keep.id);
    const e = remapProductReferences(exportItems, ["productId"], drop.id, keep.id);
    const f = remapProductReferences(finishedOpeningStock, ["productId"], drop.id, keep.id);
    const g = remapProductReferences(packagings, ["fromProductId", "toProductId"], drop.id, keep.id);
    if (w.changed) setAllWips(w.rows);
    if (b.changed) setBalancingOutputs(b.rows);
    if (s.changed) setSalesItems(s.rows);
    if (o.changed) setOrderItems(o.rows);
    if (e.changed) setExportItems(e.rows);
    if (f.changed) setFinishedOpeningStock(f.rows);
    if (g.changed) setPackagings(g.rows);
    const merged = fillBlankProductFields(keep, drop);
    setProducts(products.filter((x) => x.id !== drop.id).map((x) => (x.id === keep.id ? merged : x)));
    return {
      moved: w.changed + b.changed + s.changed + o.changed + e.changed + f.changed + g.changed,
      undo: () => {
        setAllWips(snapshot.allWips);
        setBalancingOutputs(snapshot.balancingOutputs);
        setSalesItems(snapshot.salesItems);
        setOrderItems(snapshot.orderItems);
        setExportItems(snapshot.exportItems);
        setFinishedOpeningStock(snapshot.finishedOpeningStock);
        setPackagings(snapshot.packagings);
        setProducts(snapshot.products);
      },
    };
  };

  const confirmMerge = async () => {
    if (!mergeTarget || isMerging) return;
    const keep = mergeTarget.candidates.find((c) => c.id === keepId);
    if (!keep) return;
    const { drop } = mergeTarget;
    setIsMerging(true);
    try {
      const message = (moved: number) =>
        `Đã gộp "${productLabel(drop)}" vào "${productLabel(keep)}" — chuyển ${moved} dòng sổ`;
      if (isServerConnected) {
        const result = await mergeProductsOnServer(keep.id, drop.id);
        if (!result.ok) {
          notify.error(`Chưa gộp được: ${result.error}`);
          return;
        }
        opts.onDeleted?.(drop.id, keep.id);
        notify.deleted(message(result.movedCount), () => {
          void undoProductMergeOnServer(result.payload).then((u) => {
            if (!u.ok) notify.error(`Chưa hoàn tác được: ${u.error ?? ""}`);
          });
        });
      } else {
        const { moved, undo } = mergeLocally(drop, keep);
        opts.onDeleted?.(drop.id, keep.id);
        notify.deleted(message(moved), undo);
      }
      setMergeTarget(null);
    } finally {
      setIsMerging(false);
    }
  };

  const dialog = (
    <>
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
      {mergeTarget && (
        <FormDialog
          open
          onOpenChange={(open) => !open && setMergeTarget(null)}
          size="md"
          title="Gộp mặt hàng trùng tên?"
          description={`"${productLabel(mergeTarget.drop)}" trùng tên với mục khác. Gộp sẽ chuyển mọi dòng sổ của nó sang mục giữ lại rồi xoá nó khỏi danh mục.`}
          footer={
            <>
              <Button variant="outline" onClick={() => setMergeTarget(null)}>
                Không gộp
              </Button>
              <Button
                variant="destructive"
                onClick={() => void confirmMerge()}
                title="Chuyển mọi dòng sổ sang mục giữ lại rồi xoá mục trùng — còn nút Hoàn tác vài giây."
              >
                {isMerging ? "Đang gộp…" : "Gộp và xoá mục trùng"}
              </Button>
            </>
          }
        >
          <div className="grid gap-3 text-sm">
            {mergeTarget.candidates.length > 1 ? (
              <ChoiceGroup
                label="Giữ lại mục"
                value={keepId}
                onChange={setKeepId}
                options={mergeTarget.candidates.map((c) => ({
                  value: c.id,
                  label: productLabel(c),
                  description: describeProductUsage(usageOf(c.id)) || "chưa có trong sổ nào",
                }))}
              />
            ) : (
              <p>
                Giữ lại: <strong>{productLabel(mergeTarget.candidates[0])}</strong>
              </p>
            )}
            <p className="rounded-md bg-muted px-3 py-2">
              Sẽ chuyển: {describeProductUsage(mergeTarget.usages) || "không có dòng sổ nào"}.
            </p>
            {mergeTarget.drop.finishedGoodCode && (
              <p>
                Mục bị gộp đang gắn mã kế toán <strong>{mergeTarget.drop.finishedGoodCode}</strong> — từ nay số liệu của nó
                tính vào mã của mục giữ lại. Mã {mergeTarget.drop.finishedGoodCode} vẫn còn trong danh sách 141 mã.
              </p>
            )}
            {mergeTarget.lockedBalancingRows > 0 && (
              <p className="text-warning">
                {mergeTarget.lockedBalancingRows} dòng thuộc kỳ cân đối ĐÃ CHỐT — chỉ đổi sang mục cùng tên, số kg không đổi
                nên kết quả kỳ không lệch.
              </p>
            )}
          </div>
        </FormDialog>
      )}
    </>
  );

  return {
    canDelete,
    requestDelete,
    dialog,
    deleteLabel:
      "Xóa mặt hàng này khỏi danh mục — chưa nằm trong sổ nào thì xoá thẳng; trùng tên với mục khác thì gộp vào mục đó (có hỏi xác nhận, còn nút Hoàn tác).",
  };
}
