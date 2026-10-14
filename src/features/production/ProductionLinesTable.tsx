// ============================================================
// Tên file: src/features/production/ProductionLinesTable.tsx
// Tên tiếng Việt: Bảng dòng thành phẩm theo nhóm (kiểu chế biến × khách) của phiên ghi SX
// Tách khỏi WipProductionScreen.tsx ngày 2026-09-21 — KHÔNG đổi logic.
// ============================================================
import { Fragment } from "react";
import type { BatterType, Product } from "@/types";
import { hasSplitComponents, blockSpec } from "@/types";
import {
  HorizontalScroll, Button, Combobox, NumberField, type ComboboxOption } from "@/design-system";
import { num } from "@/lib/format";
import { isBatteredProduct, getProductBatterNames } from "@/lib/batter";
import { ChevronDown, Pencil, Plus, X } from "lucide-react";
import { isLineEmpty, isSplitLine, getLineTotalKg, type ProductionLine } from "./wipHelpers";
import { BatterSection } from "./BatterSection";

/**
 * BẢNG nhập NHÓM THEO LOÀI: mỗi loài một cụm (Bạch tuộc, Mực, Cá…), dưới là bảng
 * thành phẩm của loài đó (cột ngang kiểu bảng tính, nhãn đi bằng tiêu đề cột).
 * Gom theo LOÀI vì loài có sẵn trên mọi mặt hàng (141 mã seed) và gộp lớn/nhỏ tự
 * nhiên — "Bạch tuộc 2 da lớn/nhỏ" đều là loài Bạch tuộc. Mã có cờ "tách râu/bao
 * tử" (Danh mục) mới hiện mũi tên đầu dòng để mở ô râu + bao tử. Mã có "quy cách
 * block" thì nhập số block tự tính kg gợi ý. Thêm nhóm bằng ô "Thêm loài" ở cuối.
 * Mã TẨM BỘT (đã gắn bột đi kèm / kiểu chế biến có "bột") tự hiện dòng con "Bột
 * tẩm": một ô kg cho từng loại bột đi kèm (mig 0051) — không cộng vào kg thành phẩm.
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
  onEditCustomer,
  customerOptions,
  onCreateCustomer,
  batterTypes,
  batterOptions,
  onCreateBatter,
  onEditBatter,
}: {
  lines: ProductionLine[];
  products: Product[];
  onUpdateRow: (key: string, patch: Partial<ProductionLine>) => void;
  onRemove: (key: string) => void;
  onAddRow: (
    groupId: string,
    processingType: string,
    customerName: string
  ) => void;
  onAddGroup: (processingType?: string, customerName?: string) => void;
  onChangeGroup: (
    groupId: string,
    patch: Partial<Pick<ProductionLine, "processingType" | "customerName">>
  ) => void;
  onCreateProduct: (name: string, processingType: string) => string;
  /** Mở hộp sửa nhanh thành phẩm đang chọn (tên, loài, kiểu chế biến…). */
  onEditProduct: (productId: string) => void;
  /** Mở hộp sửa nhanh khách hàng (value = tên). */
  onEditCustomer: (name: string) => void;
  customerOptions: ComboboxOption[];
  onCreateCustomer: (name: string) => string;
  /** Danh mục loại bột (để ra TÊN bột đi kèm của mặt hàng). */
  batterTypes: BatterType[];
  /** Ô chọn loại bột — value = TÊN. */
  batterOptions: ComboboxOption[];
  onCreateBatter: (name: string) => string;
  onEditBatter: (name: string) => void;
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

  // Gợi ý kiểu chế biến = các giá trị đã có trên mặt hàng (thêm mới tại chỗ được).
  const processingTypeOptions: ComboboxOption[] = [
    ...new Set(
      products.map((m) => (m.processingType || "").trim()).filter(Boolean)
    ),
  ]
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((v) => ({ value: v, label: v }));

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
        const info = { pt: rows[0].processingType, cust: rows[0].customerName };
        const soThat = rows.filter((d) => !isLineEmpty(d)).length;
        return (
          <div
            key={gid}
            className="overflow-hidden rounded-lg border-2 border-border"
          >
            {/* Đầu nhóm SỬA ĐƯỢC tại chỗ: kiểu chế biến × khách — cập nhật mọi dòng
                cùng groupId (nhãn vẫn lưu theo từng dòng khi Lưu vào sổ). */}
            <div className="flex flex-wrap items-end gap-3 bg-muted px-3 py-2.5">
              <div className="min-w-[10rem] flex-1">
                <Combobox
                  label="Kiểu chế biến"
                  value={info.pt}
                  onChange={(v) => onChangeGroup(gid, { processingType: v })}
                  options={processingTypeOptions}
                  onCreate={(name) => name}
                  placeholder="VD: 2 da chần, luộc…"
                  emptyText="Chưa có — gõ tên rồi Thêm mới."
                />
              </div>
              <div className="min-w-[10rem] flex-1">
                <Combobox
                  label="Khách hàng"
                  value={info.cust}
                  onChange={(v) => onChangeGroup(gid, { customerName: v })}
                  options={customerOptions}
                  onCreate={(name) => onCreateCustomer(name)}
                  onEditItem={onEditCustomer}
                  editLabel="Sửa thông tin khách hàng này — lưu thẳng vào Danh mục."
                  placeholder="VD: Peacock…"
                  emptyText="Chưa có — gõ tên rồi Thêm mới."
                />
              </div>
              <span className="pb-2.5 text-sm text-muted-foreground">
                {soThat} thành phẩm
              </span>
            </div>
            {/* Bề rộng tối thiểu do min-w (rem) của từng cột quyết định — co giãn
                theo cỡ chữ; không ép cứng px cho cả bảng. */}
            <HorizontalScroll>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={`${th} w-10`} aria-label="Mở tách" />
                    <th className={`${th} min-w-[13rem]`}>
                      Thành phẩm <span className="text-destructive">*</span>
                    </th>
                    <th className={`${th} min-w-[8.5rem]`}>
                      Số lượng (kg) <span className="text-destructive">*</span>
                    </th>
                    <th className={`${th} min-w-[13rem]`}>
                      Số block × quy cách
                    </th>
                    <th className={`${th} w-12`} aria-label="Bỏ dòng" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    // Mũi tên tách hiện ở MỌI dòng; tách "tính" khi đã nhập
                    // râu/bao tử. Mã đánh dấu "Có tách" chỉ để tự mở sẵn.
                    const isSplit = isSplitLine(d);
                    const p = d.productId
                      ? products.find((m) => m.id === d.productId)
                      : undefined;
                    // Khối bột: mã tẩm bột, nhóm chế biến có "bột", hoặc dòng đã nhập bột.
                    const showBatter =
                      Boolean(d.productId) &&
                      (isBatteredProduct(p) ||
                        /bột/i.test(d.processingType) ||
                        Object.keys(d.batterKg).length > 0);
                    return (
                      <Fragment key={d.key}>
                        <tr>
                          <td className={`${td} text-center`}>
                            <button
                              type="button"
                              onClick={() => onEdit(d.key, { expanded: !d.expanded })}
                              aria-expanded={d.expanded}
                              aria-label="Mở/đóng ô râu + bao tử"
                              title="Tách râu + bao tử (cùng giá)"
                              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                            >
                              <ChevronDown
                                className={`size-5 transition-transform ${d.expanded ? "" : "-rotate-90"}`}
                                aria-hidden
                              />
                            </button>
                          </td>
                          <td className={td}>
                            <div className="flex items-center gap-1.5">
                            <div className="min-w-0 flex-1">
                            <Combobox
                              hideLabel
                              label="Thành phẩm"
                              required
                              value={d.productId}
                              onChange={(v) => {
                                const p = products.find((m) => m.id === v);
                                onEdit(d.key, {
                                  productId: v,
                                  // Mã đánh dấu "Có tách" → tự mở ô tách.
                                  expanded: hasSplitComponents(p) ? true : d.expanded,
                                  // Có quy cách đã gắn ở mặt hàng → tự điền kg/khối.
                                  blockSpecKg: blockSpec(p) ?? d.blockSpecKg,
                                });
                              }}
                              options={allProductOptions}
                              onCreate={(name) => onCreateProduct(name, info.pt)}
                              emptyText="Chưa có mặt hàng — gõ tên rồi Thêm mới."
                              onEditItem={onEditProduct}
                              editLabel="Sửa thông tin mặt hàng này — lưu thẳng vào Danh mục."
                            />
                            </div>
                            {d.productId && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Sửa thành phẩm này"
                                title="Sửa thông tin thành phẩm đang chọn (tên, mã số, loài, kiểu chế biến, quy cách) — lưu thẳng vào Danh mục."
                                onClick={() => onEditProduct(d.productId)}
                              >
                                <Pencil />
                              </Button>
                            )}
                            </div>
                          </td>
                          <td className={td}>
                            {isSplit ? (
                              <div
                                className="tnum flex h-10 items-center rounded-md bg-muted px-3 font-semibold"
                                title="Tổng = râu + bao tử"
                              >
                                {num(getLineTotalKg(d))}
                              </div>
                            ) : (
                              <NumberField
                                hideLabel
                                navCol="sl"
                                label="Số lượng"
                                required
                                unit="kg"
                                value={d.quantityKg || null}
                                onChange={(v) =>
                                  onEdit(d.key, { quantityKg: v ?? 0 })
                                }
                              />
                            )}
                          </td>
                          <td className={td}>
                            <div className="flex items-center gap-1.5">
                              <NumberField
                                hideLabel
                                hideRequiredMark
                                navCol="block"
                                label="Số block"
                                unit="block"
                                className="min-w-[5.5rem] flex-1"
                                value={d.blocksCount || null}
                                onChange={(v) => {
                                  const b = v ?? 0;
                                  const s = d.blockSpecKg || 0;
                                  // Có quy cách & chưa tách → tự tính kg = block × quy cách.
                                  onEdit(
                                    d.key,
                                    s > 0 && !isSplit
                                      ? { blocksCount: b, quantityKg: b * s }
                                      : { blocksCount: b }
                                  );
                                }}
                              />
                              <span className="text-sm text-muted-foreground">
                                ×
                              </span>
                              <NumberField
                                hideLabel
                                hideRequiredMark
                                navCol="quycach"
                                label="Quy cách kg/khối"
                                unit="kg/khối"
                                className="min-w-[6rem] flex-1"
                                value={d.blockSpecKg || null}
                                onChange={(v) => {
                                  const s = v ?? 0;
                                  const b = d.blocksCount || 0;
                                  onEdit(
                                    d.key,
                                    b > 0 && s > 0 && !isSplit
                                      ? { blockSpecKg: s, quantityKg: b * s }
                                      : { blockSpecKg: s }
                                  );
                                }}
                              />
                            </div>
                          </td>
                          <td className={`${td} text-center`}>
                            <Button
                              title="Bỏ dòng thành phẩm này khỏi phiên đang gõ (chưa lưu nên không đụng sổ)."
                              variant="outline"
                              size="icon"
                              aria-label="Bỏ dòng"
                              onClick={() => onRemove(d.key)}
                            >
                              <X />
                            </Button>
                          </td>
                        </tr>

                        {d.expanded && (
                          <tr className="bg-accent/30">
                            <td className="border-b border-border" />
                            <td
                              className="border-b border-border px-2 pb-3"
                              colSpan={4}
                            >
                              <p className="mb-2 text-sm text-muted-foreground">
                                Tách râu + bao tử (cùng giá) — Số lượng = tổng
                                hai ô.
                              </p>
                              <div className="flex flex-wrap items-end gap-4">
                                <NumberField
                                  label="Râu"
                                  unit="kg"
                                  navCol="rau"
                                  className="min-w-[8rem] flex-1"
                                  value={d.tentacleKg || null}
                                  onChange={(v) =>
                                    onEdit(d.key, { tentacleKg: v ?? 0 })
                                  }
                                />
                                <NumberField
                                  label="Bao tử"
                                  unit="kg"
                                  navCol="baotu"
                                  className="min-w-[8rem] flex-1"
                                  value={d.stomachKg || null}
                                  onChange={(v) =>
                                    onEdit(d.key, { stomachKg: v ?? 0 })
                                  }
                                />
                                <div className="pb-2 text-base text-muted-foreground">
                                  Tổng ={" "}
                                  <span className="tnum font-semibold text-foreground">
                                    {num(getLineTotalKg(d))}
                                  </span>{" "}
                                  kg
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {showBatter && (
                          <tr className="bg-accent/30">
                            <td
                              className="border-b border-border px-2 pt-2 pb-3"
                              colSpan={5}
                            >
                              {/* Bảng rộng 840px cuộn ngang trong khung: ghim khối bột ở
                                  mép trái + giới hạn theo bề rộng màn ⇒ trên điện thoại các
                                  ô bột xếp dọc trong vùng nhìn thấy, không phải vuốt ngang. */}
                              <div className="sticky left-2 max-w-[calc(100vw-8.5rem)] sm:pl-10">
                                <BatterSection
                                  bundledIds={getProductBatterNames(p, batterTypes)}
                                  batterKg={d.batterKg}
                                  onChange={(batterKg) => onEdit(d.key, { batterKg })}
                                  batterOptions={batterOptions}
                                  onCreateBatter={onCreateBatter}
                                  onEditBatter={onEditBatter}
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
            <div className="p-2">
              <Button
                title="Thêm một dòng thành phẩm nữa vào nhóm này (cùng kiểu chế biến và khách hàng)."
                type="button"
                variant="outline"
                className="border-dashed"
                onClick={() => onAddRow(gid, info.pt, info.cust)}
              >
                <Plus />
                Thêm thành phẩm
              </Button>
            </div>
          </div>
        );
      })}

      {/* Thêm NHÓM mới — nhãn kiểu chế biến × khách đặt ngay ở đầu nhóm sau khi thêm */}
      <Button
        title="Mở một nhóm mới cho kiểu chế biến / khách hàng khác — mỗi nhóm gõ sản lượng riêng."
        type="button"
        variant="outline"
        className="h-auto min-h-10 w-full border-dashed py-2 whitespace-normal sm:w-auto"
        onClick={() => onAddGroup()}
      >
        <Plus />
        Thêm nhóm (kiểu chế biến × khách)
      </Button>
    </div>
  );
}
