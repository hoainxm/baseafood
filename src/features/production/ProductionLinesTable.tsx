// ============================================================
// Tên file: src/features/production/ProductionLinesTable.tsx
// Tên tiếng Việt: Bảng dòng thành phẩm của phiên ghi SX
// Tách khỏi WipProductionScreen.tsx ngày 2026-09-21. 2026-10-15: bỏ ô "Kiểu chế biến"
// (đã nằm trong mặt hàng), bỏ nhóm theo khách hàng, mỗi dòng nằm NGANG một hàng.
// ============================================================
import { Fragment } from "react";
import type { BatterType, Product } from "@/types";
import { hasSplitComponents, blockSpec } from "@/types";
import { HorizontalScroll, Button, Combobox, NumberField, type ComboboxOption } from "@/design-system";
import { num } from "@/lib/format";
import { isBatteredProduct, getProductBatterNames } from "@/lib/batter";
import { Scissors, X } from "lucide-react";
import {
  isSplitLine,
  getLineTotalKg,
  isKgDerived,
  patchBlocks,
  patchBlockSpec,
  type ProductionLine,
} from "./wipHelpers";
import { BatterSection } from "./BatterSection";
import { duplicateProductNameKeys, normalizeProductName } from "@/lib/productMerge";

/**
 * BẢNG nhập thành phẩm của phiên — mỗi dòng NẰM NGANG một hàng (chốt 2026-10-15):
 * Thành phẩm · Số block × quy cách · Số lượng (kg) · [✂ tách] [✕].
 *
 *  - Không còn nhóm theo khách hàng / kiểu chế biến (kiểu chế biến nằm sẵn trong mặt
 *    hàng; khách sửa ở hộp Sửa dòng của sổ). Dòng trống kế tiếp tự hiện ⇒ không cần nút
 *    "Thêm thành phẩm".
 *  - Block trước kg (xưởng đếm block). Mặt hàng ĐÃ có quy cách ⇒ ô block ghi "× 4 kg"
 *    (sửa quy cách ở bút chì mặt hàng); CHƯA có ⇒ ô quy cách nhỏ ngay cạnh. Kg tự tính
 *    khi đang trống / đang bằng block × quy cách; gõ tay khác thì GIỮ (wipHelpers).
 *  - Chỉ xuống hàng khi THẬT cần, và hàng phụ cũng là MỘT hàng ngang: tách râu + bao tử
 *    (mã đánh dấu tách, hoặc bấm ✂), bột tẩm (mã tẩm bột) — mig 0051, không cộng vào kg.
 */
export function ProductionLinesTable({
  lines,
  products,
  onUpdateRow: onEdit,
  onRemove,
  onCreateProduct,
  onEditProduct,
  canEditProduct,
  onDeleteProduct,
  canDeleteProduct,
  deleteProductLabel,
  batterTypes,
  batterOptions,
  onCreateBatter,
  onEditBatter,
  canEditBatter,
}: {
  lines: ProductionLine[];
  products: Product[];
  onUpdateRow: (key: string, patch: Partial<ProductionLine>) => void;
  onRemove: (key: string) => void;
  /** Không có quyền thêm vào danh mục ⇒ undefined (ô chỉ chọn). */
  onCreateProduct?: (name: string) => string;
  /** Mở hộp sửa nhanh thành phẩm (tên, loài, kiểu chế biến, quy cách…). */
  onEditProduct: (productId: string) => void;
  /** Có hiện bút chì sửa thành phẩm này không (quyền sửa danh mục). */
  canEditProduct?: (productId: string) => boolean;
  /** Thùng rác trong ô chọn — dọn danh mục (màn kiểm "đã dùng chưa" + hỏi xác nhận). */
  onDeleteProduct?: (productId: string) => void;
  canDeleteProduct?: (productId: string) => boolean;
  deleteProductLabel?: string;
  /** Danh mục loại bột (để ra TÊN bột đi kèm của mặt hàng). */
  batterTypes: BatterType[];
  /** Ô chọn loại bột — value = TÊN. */
  batterOptions: ComboboxOption[];
  onCreateBatter?: (name: string) => string;
  onEditBatter: (name: string) => void;
  canEditBatter?: (name: string) => boolean;
}) {
  const th = "border-b-2 border-border bg-card px-2 py-2 text-left text-sm font-semibold whitespace-nowrap";
  const td = "border-b border-border px-2 py-1.5 align-middle";
  /** Hàng phụ (tách / bột): một hàng ngang, ghim mép trái khi bảng cuộn ngang. */
  const subRow = "sticky left-2 flex max-w-[calc(100vw-6rem)] flex-wrap items-center gap-x-3 gap-y-2";

  // Mọi mặt hàng (gõ tên để tìm) — không giới hạn theo loài.
  // Tên TRÙNG với mục khác ⇒ dòng phụ ghi mã kế toán để phân biệt (VD hai "… cắt luộc 3gr").
  const duplicateNames = duplicateProductNameKeys(products);
  const allProductOptions: ComboboxOption[] = products.map((m) => ({
    value: m.id,
    label: m.code ? `${m.code} · ${m.name}` : m.name,
    subLabel:
      [
        duplicateNames.has(normalizeProductName(m.name)) && m.finishedGoodCode ? `mã ${m.finishedGoodCode}` : "",
        m.code,
        m.processingType,
        m.category,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
  }));

  return (
    // data-grid-nav: khung điều hướng ↑/↓/Enter theo cột cho các ô số (navCol).
    <div data-grid-nav>
      <HorizontalScroll>
        {/* table-fixed: cột số + thao tác cố định, cột tên ăn phần còn lại; bảng TRẢI HẾT bề
            ngang (chặn 64rem làm màn rộng trông như bảng bị cắt đôi — người dùng báo 2026-10-15).
            Dưới 34rem thì cuộn ngang trong khung. */}
        <table className="w-full min-w-[34rem] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>
                Thành phẩm
                <span aria-hidden className="ml-1 font-bold text-destructive">
                  *
                </span>
              </th>
              <th className={`${th} w-[11rem]`}>Số block × kg/khối</th>
              <th className={`${th} w-[8.25rem]`}>
                Số lượng (kg)
                <span aria-hidden className="ml-1 font-bold text-destructive">
                  *
                </span>
              </th>
              <th className={`${th} w-[5.75rem]`} aria-label="Tách · bỏ dòng" />
            </tr>
          </thead>
          <tbody>
            {lines.map((d) => {
              const isSplit = isSplitLine(d);
              const p = d.productId ? products.find((m) => m.id === d.productId) : undefined;
              const productSpec = blockSpec(p) ?? 0;
              // Bột: mã tẩm bột (bột đi kèm / kiểu chế biến có "bột"), hoặc dòng đã nhập bột.
              const showBatter =
                Boolean(d.productId) &&
                (isBatteredProduct(p) || /bột/i.test(p?.processingType ?? "") || Object.keys(d.batterKg).length > 0);
              // Râu + bao tử: mã đánh dấu tách, dòng đã gõ tách, hoặc đã bấm ✂.
              const showSplit = Boolean(d.productId) && (hasSplitComponents(p) || isSplit || Boolean(d.splitOpen));
              const kgMismatch =
                !isSplit && d.blocksCount > 0 && d.blockSpecKg > 0 && d.quantityKg > 0 && !isKgDerived(d);
              return (
                <Fragment key={d.key}>
                  <tr>
                    <td className={td}>
                      <Combobox
                        hideLabel
                        label="Thành phẩm"
                        required
                        // Không nút × bỏ chọn: đã có ✕ bỏ dòng, nhường chỗ cho tên dài.
                        clearable={false}
                        value={d.productId}
                        onChange={(v) => {
                          const next = products.find((m) => m.id === v);
                          onEdit(d.key, {
                            productId: v,
                            // Quy cách đã gắn ở mặt hàng → tự điền (và tính kg nếu đang tự tính).
                            ...patchBlockSpec(d, blockSpec(next) ?? d.blockSpecKg),
                          });
                        }}
                        options={allProductOptions}
                        onCreate={onCreateProduct}
                        emptyText="Chưa có mặt hàng — gõ tên rồi Thêm mới."
                        onEditItem={onEditProduct}
                        canEdit={canEditProduct}
                        editLabel="Sửa thông tin mặt hàng này (cả quy cách kg/khối) — lưu thẳng vào Danh mục."
                        onDeleteItem={onDeleteProduct}
                        canDelete={canDeleteProduct}
                        deleteLabel={deleteProductLabel}
                      />
                    </td>
                    <td className={td}>
                      <div className="flex items-center gap-1">
                        <NumberField
                          hideLabel
                          hideRequiredMark
                          navCol="block"
                          label={d.blockSpecKg > 0 ? `Số block (${num(d.blockSpecKg)} kg/khối)` : "Số block"}
                          // Mặt hàng đã có quy cách ⇒ quy cách nằm ngay trong đơn vị ô. Chưa có ⇒
                          // ô quy cách đứng cạnh, bỏ chữ đơn vị (tiêu đề cột đã ghi) cho số khỏi bị che.
                          unit={productSpec > 0 ? `× ${num(d.blockSpecKg)} kg` : ""}
                          className="min-w-0 flex-1"
                          value={d.blocksCount || null}
                          onChange={(v) => onEdit(d.key, patchBlocks(d, v ?? 0))}
                        />
                        {/* Chưa có quy cách ở mặt hàng ⇒ ô nhỏ gõ tại chỗ (lưu xong mặt hàng tự nhớ). */}
                        {productSpec <= 0 && (
                          <>
                            <span className="text-muted-foreground" aria-hidden>
                              ×
                            </span>
                            <NumberField
                              hideLabel
                              hideRequiredMark
                              navCol="quycach"
                              label="Quy cách kg/khối"
                              unit="kg"
                              className="w-[4.75rem] shrink-0"
                              value={d.blockSpecKg || null}
                              onChange={(v) => onEdit(d.key, patchBlockSpec(d, v ?? 0))}
                            />
                          </>
                        )}
                      </div>
                    </td>
                    <td className={td}>
                      {isSplit ? (
                        <div
                          className="tnum flex h-10 items-center justify-end rounded-md bg-muted px-3 font-semibold"
                          title="Tổng = râu + bao tử (gõ ở hàng tách ngay dưới)"
                        >
                          {num(getLineTotalKg(d))}
                        </div>
                      ) : (
                        <div
                          title={
                            kgMismatch
                              ? `Kg gõ tay khác ${num(d.blocksCount)} block × ${num(d.blockSpecKg)} = ${num(d.blocksCount * d.blockSpecKg)} kg — giữ số đã gõ.`
                              : d.blocksCount > 0 && d.blockSpecKg > 0
                                ? `Tự tính: ${num(d.blocksCount)} block × ${num(d.blockSpecKg)} kg. Gõ đè nếu cân thực tế khác.`
                                : undefined
                          }
                        >
                          <NumberField
                            hideLabel
                            navCol="sl"
                            label="Số lượng"
                            required
                            unit={kgMismatch ? `kg ≠${num(d.blocksCount * d.blockSpecKg)}` : "kg"}
                            value={d.quantityKg || null}
                            onChange={(v) => onEdit(d.key, { quantityKg: v ?? 0 })}
                          />
                        </div>
                      )}
                    </td>
                    <td className={td}>
                      <div className="flex items-center justify-end gap-1">
                        {/* ✂ chỉ cho mã KHÔNG đánh dấu tách (mã có tách thì hàng tách tự hiện). */}
                        {d.productId && !hasSplitComponents(p) && !isSplit && (
                          <Button
                            type="button"
                            variant={d.splitOpen ? "secondary" : "ghost"}
                            size="icon"
                            aria-pressed={Boolean(d.splitOpen)}
                            aria-label="Tách râu + bao tử"
                            title="Tách râu + bao tử (cùng giá) cho dòng này — Số lượng sẽ bằng tổng hai ô."
                            onClick={() => onEdit(d.key, { splitOpen: !d.splitOpen })}
                          >
                            <Scissors />
                          </Button>
                        )}
                        <Button
                          title="Bỏ dòng thành phẩm này khỏi phiên đang gõ (chưa lưu nên không đụng sổ)."
                          variant="ghost"
                          size="icon"
                          aria-label="Bỏ dòng"
                          onClick={() => onRemove(d.key)}
                        >
                          <X />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {showSplit && (
                    <tr className="bg-accent/30">
                      <td className="border-b border-border px-2 py-1.5" colSpan={4}>
                        <div className={subRow}>
                          <span className="text-sm font-medium">Tách:</span>
                          <span className="text-sm">Râu</span>
                          <NumberField
                            hideLabel
                            label="Râu"
                            unit="kg"
                            navCol="rau"
                            className="w-[8rem]"
                            value={d.tentacleKg || null}
                            onChange={(v) => onEdit(d.key, { tentacleKg: v ?? 0 })}
                          />
                          <span className="text-sm">Bao tử</span>
                          <NumberField
                            hideLabel
                            label="Bao tử"
                            unit="kg"
                            navCol="baotu"
                            className="w-[8rem]"
                            value={d.stomachKg || null}
                            onChange={(v) => onEdit(d.key, { stomachKg: v ?? 0 })}
                          />
                          <span className="text-sm text-muted-foreground">
                            = <span className="tnum font-semibold text-foreground">{num(getLineTotalKg(d))}</span> kg
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {showBatter && (
                    <tr className="bg-accent/30">
                      <td className="border-b border-border px-2 py-1.5" colSpan={4}>
                        <div className={subRow}>
                          <BatterSection
                            compact
                            bundledIds={getProductBatterNames(p, batterTypes)}
                            batterKg={d.batterKg}
                            onChange={(batterKg) => onEdit(d.key, { batterKg })}
                            batterOptions={batterOptions}
                            onCreateBatter={onCreateBatter}
                            onEditBatter={onEditBatter}
                            canEditBatter={canEditBatter}
                            productKg={getLineTotalKg(d)}
                            columnNavigation
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </HorizontalScroll>
    </div>
  );
}
