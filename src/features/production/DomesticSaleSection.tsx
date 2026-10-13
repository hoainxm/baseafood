// ============================================================
// Tên file: src/features/production/DomesticSaleSection.tsx
// Tên tiếng Việt: Khối "Bán nội địa trong ngày" của phiên ghi thành phẩm (/wip, mig 0054)
// ============================================================
// Nguyên liệu bán THẲNG cho khách trong nước, không qua chế biến (bảng cân đối giấy:
// dòng "Bán nội địa −987" ở khối NL). Ghi cùng phiên với thành phẩm, lưu sang sổ
// riêng `domestic_sales` — KHÔNG cộng vào sản lượng thành phẩm. Cân đối điền dòng
// giảm "Bán nội địa" từ sổ này. Ô chọn loại NL / khách: thêm mới tại chỗ + bút chì.
import { Button, Combobox, NumberField, type ComboboxOption } from "@/design-system";
import { kg, num } from "@/lib/format";
import { Plus, Store, X } from "lucide-react";
import { isDomesticSaleLineComplete, type DomesticSaleLine } from "./wipHelpers";

interface CatalogCell {
  options: ComboboxOption[];
  onCreate: (ten: string) => string;
  onEditItem: (value: string) => void;
  canEdit: (value: string) => boolean;
  editLabel: string;
}

export function DomesticSaleSection({
  dong,
  onUpdateRow: onEdit,
  onBo,
  onAddRow: onAdd,
  loaiNL: materialTypeCell,
  customerField: customers,
}: {
  dong: DomesticSaleLine[];
  onUpdateRow: (key: string, patch: Partial<DomesticSaleLine>) => void;
  onBo: (key: string) => void;
  onAddRow: () => void;
  /** Danh mục loại NL — value = TÊN. */
  loaiNL: CatalogCell;
  /** Danh mục khách hàng — value = TÊN. */
  customerField: CatalogCell;
}) {
  const validItems = dong.filter(isDomesticSaleLineComplete);
  const totalKg = validItems.reduce((s, d) => s + d.quantityKg, 0);
  const totalAmount = validItems.reduce((s, d) => s + d.quantityKg * (d.unitPrice ?? 0), 0);

  return (
    <div className="space-y-3 rounded-xl border-2 border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-base font-semibold">
            <Store className="size-icon shrink-0" aria-hidden />
            Bán nội địa trong ngày
          </p>
          <p className="text-sm text-muted-foreground">
            Nguyên liệu bán thẳng cho khách trong nước, không qua chế biến. Không cộng
            vào sản lượng thành phẩm — Cân đối lấy số này cho dòng “Bán nội địa”.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-10 w-full border-dashed py-2 whitespace-normal sm:w-auto"
          onClick={onAdd}
          title="Thêm một dòng nguyên liệu bán thẳng cho khách trong nước (không chế biến) trong ngày này."
        >
          <Plus />
          Thêm dòng bán nội địa
        </Button>
      </div>

      {dong.map((d, i) => (
        <div
          key={d.key}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/40 p-3"
        >
          <div className="min-w-0 flex-[1_1_13rem]">
            <Combobox
              label={`Loại nguyên liệu (dòng ${i + 1})`}
              required
              value={d.materialTypeName}
              onChange={(v) => onEdit(d.key, { materialTypeName: v })}
              options={materialTypeCell.options}
              onCreate={materialTypeCell.onCreate}
              onEditItem={materialTypeCell.onEditItem}
              canEdit={materialTypeCell.canEdit}
              editLabel={materialTypeCell.editLabel}
              placeholder="— Chọn loại NL —"
              emptyText="Chưa có loại này — gõ tên rồi Thêm mới."
            />
          </div>
          <NumberField
            label="Số lượng"
            required
            unit="kg"
            className="min-w-0 flex-[1_1_8rem] sm:max-w-[11rem]"
            value={d.quantityKg || null}
            onChange={(v) => onEdit(d.key, { quantityKg: v ?? 0 })}
          />
          <NumberField
            label="Đơn giá"
            unit="đ/kg"
            className="min-w-0 flex-[1_1_9rem] sm:max-w-[12rem]"
            value={d.unitPrice}
            onChange={(v) => onEdit(d.key, { unitPrice: v })}
          />
          <div className="min-w-0 flex-[1_1_11rem]">
            <Combobox
              label="Khách hàng"
              value={d.customerName}
              onChange={(v) => onEdit(d.key, { customerName: v })}
              options={customers.options}
              onCreate={customers.onCreate}
              onEditItem={customers.onEditItem}
              canEdit={customers.canEdit}
              editLabel={customers.editLabel}
              placeholder="— Chọn khách (nếu có) —"
              emptyText="Chưa có khách này — gõ tên rồi Thêm mới."
            />
          </div>
          <div className="flex items-end gap-2">
            {d.quantityKg > 0 && d.unitPrice != null && (
              <span className="tnum pb-2.5 text-sm text-muted-foreground" title="Thành tiền = số lượng × đơn giá">
                = {num(d.quantityKg * d.unitPrice)} đ
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Bỏ dòng bán nội địa ${i + 1}`}
              title="Bỏ dòng bán nội địa này khỏi phiên đang gõ (chưa lưu nên không đụng sổ)."
              onClick={() => onBo(d.key)}
            >
              <X />
            </Button>
          </div>
        </div>
      ))}

      {validItems.length > 0 && (
        <p className="text-right text-base text-muted-foreground">
          Bán nội địa phiên này:{" "}
          <span className="tnum font-semibold text-foreground">{kg(totalKg)}</span>
          {totalAmount > 0 && (
            <>
              {" "}· <span className="tnum">{num(totalAmount)}</span> đ
            </>
          )}
        </p>
      )}
    </div>
  );
}
