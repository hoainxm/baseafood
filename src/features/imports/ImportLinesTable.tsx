// ============================================================
// Tên file: src/features/imports/ImportLinesTable.tsx
// Tên tiếng Việt: Bảng loại hàng của một chuyến (nhập nhiều dòng một lượt)
// Tách khỏi MaterialImportScreen.tsx ngày 2026-09-21. 2026-10-14: mọi dòng cùng một bố cục.
// ============================================================
import type { Category } from "@/types";
import { CATEGORIES } from "@/types";
import { Button, Combobox, NumberField, type ComboboxOption } from "@/design-system";
import { Plus, X } from "lucide-react";
import { formatDateVN } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ImportLine } from "./importHelpers";

/* ---------- Bảng loại hàng của một chuyến (nhập nhiều dòng một lượt) ---------- */

/**
 * Bảng nhập ĐƠN GIẢN, TRẢI NGANG: mỗi loại là MỘT HÀNG — các ô nằm ngang trên
 * desktop (Loài · Loại NL · Số lượng · Đơn giá · Bỏ); điện thoại: loài, loại mỗi ô
 * một hàng, Số lượng + Đơn giá đứng CẠNH nhau. Cột kg có Enter/↑/↓ nhảy dọc
 * (`navCol`) — bảng điền sẵn theo đại lý thì chỉ gõ kg rồi Enter. Thêm loại bằng nút
 * ở cuối, dòng mới xuống CUỐI — không tự nhảy, không xô layout.
 *
 * MỌI dòng cùng MỘT bố cục (2026-10-14, người dùng: dòng điền sẵn và dòng thêm mới
 * trông khác nhau dễ hiểu lầm): dòng điền sẵn theo đại lý chỉ khác ở chỗ các ô đã có
 * giá trị + một dòng chú thích giá lượt trước bên dưới. Bỏ kiểu "dòng gọn + bút chì
 * Đổi loại".
 */
export function ImportLinesTable({
  lines: row,
  onUpdateRow: onEdit,
  onRemove: onBo,
  onAddRow: onAdd,
  getMaterialTypeOptions: materialTypeOptionsByCategory,
  onCreateMaterialType,
  onEditMaterialType,
  canEditMaterialType,
  showPrice = true,
  onLastRowEnter: onEnterLast,
}: {
  lines: ImportLine[];
  onUpdateRow: (key: string, patch: Partial<ImportLine>) => void;
  onRemove: (key: string) => void;
  onAddRow: () => void;
  getMaterialTypeOptions: (category: string) => ComboboxOption[];
  /** Không truyền (không có quyền thêm danh mục) ⇒ ô chỉ chọn, không "Tạo mới tại chỗ". */
  onCreateMaterialType?: (name: string, category: string) => string;
  /** Bút chì sửa nhanh loại NL trong danh mục (value = tên). */
  onEditMaterialType?: (name: string) => void;
  /** Loại NL này có sửa nhanh được không (quyền + có trong danh mục). */
  canEditMaterialType?: (name: string) => boolean;
  /** Không có quyền xem giá ⇒ ẩn ô Đơn giá + chú thích giá lượt trước. */
  showPrice?: boolean;
  /** Enter ở ô kg của dòng cuối — màn dùng để đưa con trỏ tới nút lưu. */
  onLastRowEnter?: () => void;
}) {
  const canRemove = row.length > 1;
  return (
    <div
      className="space-y-3"
      data-grid-nav="import-lines"
      // Enter ở ô kg CUỐI (NumberField đã lo nhảy giữa các dòng) ⇒ báo ra ngoài để nhảy tới nút lưu.
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        const o = e.target as HTMLElement;
        if (o.getAttribute("data-navcol") !== "kg") return;
        const items = e.currentTarget.querySelectorAll('[data-navcol="kg"]');
        if (items[items.length - 1] === o) onEnterLast?.();
      }}
    >
      {row.map((d) => {
        // Giá điền sẵn là GIÁ CŨ — nói rõ của lượt nào để người nhập soát, khỏi lưu nhầm.
        const priceNote = !showPrice
          ? null
          : d.priceDate
          ? `Giá theo lượt ${formatDateVN(d.priceDate).slice(0, 5)} — khác thì sửa ô đơn giá`
          : d.isSuggested && d.unitPrice == null
            ? "Chưa có giá lượt trước — để trống nếu chờ hóa đơn"
            : null;
        return (
          <div
            key={d.key}
            className={cn(
              "grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-3",
              showPrice
                ? "lg:grid-cols-[1.1fr_1.6fr_0.9fr_0.9fr_auto]"
                : "lg:grid-cols-[1.1fr_1.6fr_0.9fr_auto]"
            )}
          >
            <Combobox
              label="Loài"
              required
              clearable={false}
              className="col-span-2 lg:col-span-1"
              value={d.category}
              onChange={(v) =>
                onEdit(d.key, { category: v as Category, materialTypeName: "" })
              }
              options={CATEGORIES.map((l) => ({ value: l, label: l }))}
            />
            <Combobox
              label="Loại nguyên liệu"
              required
              className="col-span-2 lg:col-span-1"
              value={d.materialTypeName}
              onChange={(v) => onEdit(d.key, { materialTypeName: v })}
              options={materialTypeOptionsByCategory(d.category)}
              onCreate={
                onCreateMaterialType ? (name) => onCreateMaterialType(name, d.category) : undefined
              }
              onEditItem={onEditMaterialType}
              canEdit={canEditMaterialType}
              editLabel="Sửa thông tin loại nguyên liệu này — lưu thẳng vào Danh mục."
            />
            <NumberField
              label="Số lượng"
              required
              unit="kg"
              navCol="kg"
              className={showPrice ? undefined : "col-span-2 lg:col-span-1"}
              value={d.quantityKg || null}
              onChange={(v) => onEdit(d.key, { quantityKg: v ?? 0 })}
            />
            {showPrice && (
              <NumberField
                label="Đơn giá"
                unit="đ"
                value={d.unitPrice}
                onChange={(v) => onEdit(d.key, { unitPrice: v })}
              />
            )}
            {canRemove ? (
              <Button
                title="Bỏ dòng loại hàng này khỏi chuyến đang gõ (chưa lưu nên không đụng sổ)."
                variant="danger"
                aria-label={`Bỏ dòng ${d.materialTypeName || "loại hàng"}`}
                className="col-span-2 justify-center lg:col-span-1 lg:self-end"
                onClick={() => onBo(d.key)}
              >
                <X />
                <span className="lg:hidden">Bỏ dòng</span>
              </Button>
            ) : (
              <span className="hidden lg:block" aria-hidden />
            )}
            {priceNote && (
              <p className="col-span-2 text-sm text-muted-foreground lg:col-span-full">{priceNote}</p>
            )}
          </div>
        );
      })}

      <Button
        title="Thêm một dòng loại hàng nữa cho chuyến này — một chuyến chở được nhiều loại."
        type="button"
        variant="outline"
        size="lg"
        className="w-full border-dashed"
        onClick={onAdd}
      >
        <Plus />
        Thêm loại hàng
      </Button>
    </div>
  );
}
