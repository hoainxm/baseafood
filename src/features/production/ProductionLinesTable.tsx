// ============================================================
// Tên file: src/features/production/ProductionLinesTable.tsx
// Tên tiếng Việt: Bảng dòng thành phẩm theo nhóm khách hàng của phiên ghi SX
// Tách khỏi WipProductionScreen.tsx ngày 2026-09-21. 2026-10-15: bỏ ô "Kiểu chế biến"
// (đã nằm trong mặt hàng) + gọn dòng: chính = Thành phẩm · kg · block; phụ (quy cách
// kg/khối, râu + bao tử) vào phần "Chi tiết" mở bằng nút cuối dòng.
// ============================================================
import { Fragment } from "react";
import type { BatterType, Product } from "@/types";
import { hasSplitComponents, blockSpec } from "@/types";
import {
  HorizontalScroll, Button, Combobox, NumberField, type ComboboxOption } from "@/design-system";
import { num } from "@/lib/format";
import { isBatteredProduct, getProductBatterNames } from "@/lib/batter";
import { ChevronDown, Plus, X } from "lucide-react";
import {
  isLineEmpty,
  isSplitLine,
  getLineTotalKg,
  isKgDerived,
  patchBlocks,
  patchBlockSpec,
  type ProductionLine,
} from "./wipHelpers";
import { BatterSection } from "./BatterSection";

/**
 * BẢNG nhập theo NHÓM KHÁCH HÀNG: mỗi nhóm một khách (đặt ở đầu nhóm), dưới là các
 * dòng thành phẩm. Kiểu chế biến KHÔNG còn ô riêng — nó nằm sẵn trong mặt hàng
 * (Danh mục), khi lưu dòng tự mang theo kiểu chế biến của mặt hàng.
 *
 * Một dòng chỉ còn 3 ô chính: Thành phẩm · Số block · Số lượng (kg). Block đứng trước
 * vì xưởng đếm block; có quy cách thì đơn vị ô block ghi "× 4 kg" và kg TỰ TÍNH — kg
 * gõ tay khác block × quy cách thì GIỮ (wipHelpers.patchBlocks), không đè. Ô phụ — quy
 * cách kg/khối, tách râu + bao tử — trong nút "Chi tiết" (chỉ có khi đã chọn thành
 * phẩm); ô râu/bao tử chỉ hiện với mã đánh dấu tách hoặc khi bấm "Tách râu + bao tử".
 * Mã TẨM BỘT tự hiện dòng con "Bột tẩm" (mig 0051) — không cộng vào kg thành phẩm.
 */
export function ProductionLinesTable({
  lines,
  products,
  onUpdateRow: onEdit,
  onRemove,
  onAddRow,
  onAddGroup,
  onChangeGroup,
  onCreateProduct,
  onEditProduct,
  canEditProduct,
  onDeleteProduct,
  canDeleteProduct,
  deleteProductLabel,
  onEditCustomer,
  canEditCustomer,
  customerOptions,
  onCreateCustomer,
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
  onAddRow: (groupId: string, customerName: string) => void;
  onAddGroup: () => void;
  onChangeGroup: (groupId: string, patch: Partial<Pick<ProductionLine, "customerName">>) => void;
  /** Không có quyền thêm vào danh mục ⇒ undefined (ô chỉ chọn). */
  onCreateProduct?: (name: string) => string;
  /** Mở hộp sửa nhanh thành phẩm đang chọn (tên, loài, kiểu chế biến…). */
  onEditProduct: (productId: string) => void;
  /** Có hiện bút chì sửa thành phẩm này không (quyền sửa danh mục). */
  canEditProduct?: (productId: string) => boolean;
  /** Thùng rác trong ô chọn — dọn danh mục (màn kiểm "đã dùng chưa" + hỏi xác nhận). */
  onDeleteProduct?: (productId: string) => void;
  canDeleteProduct?: (productId: string) => boolean;
  deleteProductLabel?: string;
  /** Mở hộp sửa nhanh khách hàng (value = tên). */
  onEditCustomer: (name: string) => void;
  canEditCustomer?: (name: string) => boolean;
  customerOptions: ComboboxOption[];
  onCreateCustomer?: (name: string) => string;
  /** Danh mục loại bột (để ra TÊN bột đi kèm của mặt hàng). */
  batterTypes: BatterType[];
  /** Ô chọn loại bột — value = TÊN. */
  batterOptions: ComboboxOption[];
  onCreateBatter?: (name: string) => string;
  onEditBatter: (name: string) => void;
  canEditBatter?: (name: string) => boolean;
}) {
  const th =
    "border-b-2 border-border bg-card px-2 py-2 text-left text-sm font-semibold whitespace-nowrap";
  const td = "border-b border-border px-2 py-2 align-middle";

  // Nhóm theo groupId ỔN ĐỊNH (giữ thứ tự xuất hiện) — sửa nhãn không remount.
  const groupKeys: string[] = [];
  const groupRows = new Map<string, ProductionLine[]>();
  for (const d of lines) {
    if (!groupRows.has(d.groupId)) {
      groupRows.set(d.groupId, []);
      groupKeys.push(d.groupId);
    }
    groupRows.get(d.groupId)!.push(d);
  }

  // Mọi mặt hàng (gõ tên để tìm) — không giới hạn theo loài.
  const allProductOptions: ComboboxOption[] = products.map((m) => ({
    value: m.id,
    label: m.code ? `${m.code} · ${m.name}` : m.name,
    subLabel: [m.code, m.processingType, m.category].filter(Boolean).join(" · ") || undefined,
  }));

  return (
    // data-grid-nav: khung điều hướng ↑/↓/Enter theo cột cho các ô số (navCol).
    <div className="space-y-4" data-grid-nav>
      {groupKeys.map((gid) => {
        const rows = groupRows.get(gid)!;
        const cust = rows[0].customerName;
        const soThat = rows.filter((d) => !isLineEmpty(d)).length;
        return (
          <div
            key={gid}
            className="overflow-hidden rounded-lg border-2 border-border"
          >
            {/* Đầu nhóm SỬA ĐƯỢC tại chỗ: khách hàng — cập nhật mọi dòng cùng groupId
                (nhãn vẫn lưu theo từng dòng khi Lưu vào sổ). */}
            <div className="flex flex-wrap items-end gap-3 bg-muted px-3 py-2.5">
              <div className="min-w-[12rem] flex-1 sm:max-w-md">
                <Combobox
                  label="Khách hàng"
                  value={cust}
                  onChange={(v) => onChangeGroup(gid, { customerName: v })}
                  options={customerOptions}
                  onCreate={onCreateCustomer}
                  onEditItem={onEditCustomer}
                  canEdit={canEditCustomer}
                  editLabel="Sửa thông tin khách hàng này — lưu thẳng vào Danh mục."
                  placeholder="VD: Peacock… (bỏ trống nếu chưa rõ)"
                  emptyText="Chưa có — gõ tên rồi Thêm mới."
                />
              </div>
              <span className="pb-2.5 text-sm text-muted-foreground">
                {soThat} thành phẩm
              </span>
            </div>
            {/* Bề rộng tối thiểu do min-w (rem) của từng cột quyết định — co giãn
                theo cỡ chữ; không ép cứng px cho cả bảng. */}
            {/* @container: nút "Chi tiết" thu về icon khi vùng bảng hẹp (tablet có thanh bên ~570px). */}
            <div className="@container">
            <HorizontalScroll>
              {/* table-fixed: cột số + thao tác cố định, cột tên ăn phần còn lại (không nở theo
                  độ dài chữ gợi ý). Chặn 64rem ⇒ màn rộng tên và số nằm gần nhau. */}
              <table className="w-full max-w-[64rem] min-w-[30rem] table-fixed border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={th}>
                      Thành phẩm <span className="text-destructive">*</span>
                    </th>
                    {/* Block TRƯỚC kg: xưởng đếm block, kg tự tính từ quy cách. */}
                    <th className={`${th} w-[8.75rem]`}>Số block</th>
                    <th className={`${th} w-[9rem]`}>
                      Số lượng (kg) <span className="text-destructive">*</span>
                    </th>
                    <th className={`${th} w-[6.25rem] @min-[40rem]:w-[10.75rem]`} aria-label="Chi tiết · bỏ dòng" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    // Tách "tính" khi đã nhập râu/bao tử. Mã đánh dấu "Có tách" chỉ để tự mở sẵn.
                    const isSplit = isSplitLine(d);
                    const p = d.productId
                      ? products.find((m) => m.id === d.productId)
                      : undefined;
                    // Khối bột: mã tẩm bột (bột đi kèm / kiểu chế biến có "bột"), hoặc dòng đã nhập bột.
                    const showBatter =
                      Boolean(d.productId) &&
                      (isBatteredProduct(p) ||
                        /bột/i.test(p?.processingType ?? "") ||
                        Object.keys(d.batterKg).length > 0);
                    // Ô râu + bao tử chỉ hiện với mã đánh dấu tách, dòng đã gõ tách, hoặc đã bấm "Tách".
                    const showSplit = hasSplitComponents(p) || isSplit || Boolean(d.splitOpen);
                    // kg người dùng gõ tay khác block × quy cách ⇒ nhắc (không tự đè).
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
                              // Không nút × bỏ chọn: trong lưới đã có ✕ bỏ dòng, nhường chỗ cho tên dài.
                              clearable={false}
                              value={d.productId}
                              onChange={(v) => {
                                const p = products.find((m) => m.id === v);
                                const spec = blockSpec(p) ?? d.blockSpecKg;
                                onEdit(d.key, {
                                  productId: v,
                                  // Mã đánh dấu "Có tách" → tự mở chi tiết (ô râu + bao tử).
                                  expanded: hasSplitComponents(p) ? true : d.expanded,
                                  // Có quy cách đã gắn ở mặt hàng → tự điền kg/khối (và kg nếu đang tự tính).
                                  ...patchBlockSpec(d, spec),
                                });
                              }}
                              options={allProductOptions}
                              onCreate={onCreateProduct}
                              emptyText="Chưa có mặt hàng — gõ tên rồi Thêm mới."
                              onEditItem={onEditProduct}
                              canEdit={canEditProduct}
                              editLabel="Sửa thông tin mặt hàng này — lưu thẳng vào Danh mục."
                              onDeleteItem={onDeleteProduct}
                              canDelete={canDeleteProduct}
                              deleteLabel={deleteProductLabel}
                            />
                          </td>
                          <td className={td}>
                            <NumberField
                              hideLabel
                              hideRequiredMark
                              navCol="block"
                              label={d.blockSpecKg > 0 ? `Số block (${num(d.blockSpecKg)} kg/khối)` : "Số block"}
                              // Quy cách nằm ngay trong đơn vị ô — không thêm dòng chữ dưới ô (lệch hàng).
                              unit={d.blockSpecKg > 0 ? `× ${num(d.blockSpecKg)} kg` : "block"}
                              value={d.blocksCount || null}
                              onChange={(v) => onEdit(d.key, patchBlocks(d, v ?? 0))}
                            />
                          </td>
                          <td className={td}>
                            {isSplit ? (
                              <div
                                className="tnum flex h-10 items-center justify-end rounded-md bg-muted px-3 font-semibold"
                                title="Tổng = râu + bao tử (sửa ở phần Chi tiết)"
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
                          <td className={`${td} whitespace-nowrap`}>
                            <div className="flex items-center justify-end gap-1">
                              {/* Chỉ có chi tiết khi đã chọn thành phẩm (quy cách nhớ về mặt hàng). */}
                              {d.productId && (
                                <Button
                                  type="button"
                                  variant={isSplit || d.expanded ? "secondary" : "outline"}
                                  size="sm"
                                  onClick={() => onEdit(d.key, { expanded: !d.expanded })}
                                  aria-expanded={d.expanded}
                                  aria-label="Chi tiết dòng"
                                  title="Mở/đóng phần chi tiết của dòng: quy cách kg/khối, tách râu + bao tử."
                                >
                                  <span className="hidden @min-[40rem]:inline">Chi tiết</span>
                                  <ChevronDown
                                    className={`transition-transform ${d.expanded ? "rotate-180" : ""}`}
                                    aria-hidden
                                  />
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

                        {d.expanded && d.productId && (
                          <tr className="bg-accent/30">
                            <td className="border-b border-border px-2 pt-2 pb-3" colSpan={4}>
                              <div className="sticky left-2 flex max-w-[calc(100vw-8.5rem)] flex-wrap items-end gap-4">
                                <NumberField
                                  label="Quy cách"
                                  unit="kg/khối"
                                  navCol="quycach"
                                  className="min-w-[8rem] flex-1 sm:max-w-[12rem]"
                                  value={d.blockSpecKg || null}
                                  onChange={(v) => onEdit(d.key, patchBlockSpec(d, v ?? 0))}
                                />
                                {showSplit ? (
                                  <>
                                    <NumberField
                                      label="Râu"
                                      unit="kg"
                                      navCol="rau"
                                      className="min-w-[8rem] flex-1 sm:max-w-[12rem]"
                                      value={d.tentacleKg || null}
                                      onChange={(v) => onEdit(d.key, { tentacleKg: v ?? 0 })}
                                    />
                                    <NumberField
                                      label="Bao tử"
                                      unit="kg"
                                      navCol="baotu"
                                      className="min-w-[8rem] flex-1 sm:max-w-[12rem]"
                                      value={d.stomachKg || null}
                                      onChange={(v) => onEdit(d.key, { stomachKg: v ?? 0 })}
                                    />
                                  </>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="border-dashed"
                                    title="Mặt hàng này bán tách râu + bao tử (cùng giá)? Mở hai ô kg — Số lượng sẽ bằng tổng hai ô."
                                    onClick={() => onEdit(d.key, { splitOpen: true })}
                                  >
                                    <Plus />
                                    Tách râu + bao tử
                                  </Button>
                                )}
                                <p className="basis-full text-sm text-muted-foreground">
                                  Quy cách = kg mỗi block, lưu xong mặt hàng tự nhớ.
                                  {showSplit && " Có tách thì Số lượng = râu + bao tử."}
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}

                        {showBatter && (
                          <tr className="bg-accent/30">
                            <td
                              className="border-b border-border px-2 pt-2 pb-3"
                              colSpan={4}
                            >
                              {/* Bảng cuộn ngang trong khung: ghim khối bột ở mép trái + giới
                                  hạn theo bề rộng màn ⇒ trên điện thoại các ô bột xếp dọc
                                  trong vùng nhìn thấy, không phải vuốt ngang. */}
                              <div className="sticky left-2 max-w-[calc(100vw-8.5rem)]">
                                <BatterSection
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
            <div className="p-2">
              <Button
                title="Thêm một dòng thành phẩm nữa vào nhóm này (cùng khách hàng)."
                type="button"
                variant="outline"
                className="border-dashed"
                onClick={() => onAddRow(gid, cust)}
              >
                <Plus />
                Thêm thành phẩm
              </Button>
            </div>
          </div>
        );
      })}

      {/* Thêm NHÓM mới — khách hàng đặt ngay ở đầu nhóm sau khi thêm */}
      <Button
        title="Mở một nhóm mới cho khách hàng khác — mỗi nhóm gõ sản lượng riêng."
        type="button"
        variant="outline"
        className="h-auto min-h-10 w-full border-dashed py-2 whitespace-normal sm:w-auto"
        onClick={() => onAddGroup()}
      >
        <Plus />
        Thêm nhóm khách hàng khác
      </Button>
    </div>
  );
}
