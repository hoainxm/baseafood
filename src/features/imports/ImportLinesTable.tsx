// ============================================================
// Tên file: src/features/imports/ImportLinesTable.tsx
// Tên tiếng Việt: Bảng loại hàng của một chuyến (nhập nhiều dòng một lượt)
// Tách khỏi MaterialImportScreen.tsx ngày 2026-09-21 — KHÔNG đổi logic.
// ============================================================
import type { Category } from "@/types";
import { CATEGORIES } from "@/types";
import { Button, Combobox, NumberField, type ComboboxOption } from "@/design-system";
import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { formatDateVN } from "@/lib/format";
import type { ImportLine } from "./importHelpers";

/* ---------- Bảng loại hàng của một chuyến (nhập nhiều dòng một lượt) ---------- */

/**
 * Bảng nhập ĐƠN GIẢN, TRẢI NGANG: mỗi loại là MỘT HÀNG — các ô nằm ngang trên
 * desktop (Loài · Loại NL · Số lượng · Đơn giá · Bỏ); điện thoại: loài, loại mỗi ô
 * một hàng, Số lượng + Đơn giá đứng CẠNH nhau. Cột kg có Enter/↑/↓ nhảy dọc
 * (`navCol`) — bảng điền sẵn theo đại lý thì chỉ gõ kg rồi Enter. Nhãn luôn hiện để người lớn tuổi đọc rõ. Thêm loại bằng nút ở cuối,
 * dòng mới xuống CUỐI — không tự nhảy, không xô layout.
 */
export function ImportLinesTable({
  lines: row,
  onUpdateRow: onEdit,
  onRemove: onBo,
  onAddRow: onAdd,
  getMaterialTypeOptions: materialTypeOptionsByCategory,
  onCreateMaterialType,
  onEditMaterialType,
  onLastRowEnter: onEnterLast,
}: {
  lines: ImportLine[];
  onUpdateRow: (key: string, patch: Partial<ImportLine>) => void;
  onRemove: (key: string) => void;
  onAddRow: () => void;
  getMaterialTypeOptions: (category: string) => ComboboxOption[];
  onCreateMaterialType: (name: string, category: string) => string;
  /** Bút chì sửa nhanh loại NL trong danh mục (value = tên). */
  onEditMaterialType?: (name: string) => void;
  /** Enter ở ô kg của dòng cuối — màn dùng để đưa con trỏ tới nút lưu. */
  onLastRowEnter?: () => void;
}) {
  const canRemove = row.length > 1;
  // Dòng ĐIỀN SẴN theo đại lý hiện GỌN (tên loại là chữ, chỉ còn ô kg + giá) —
  // bấm "Đổi loại" mới bung đủ ô chọn. Chỉ là trạng thái hiển thị, không đụng dữ liệu.
  const [bung, setBung] = useState<Set<string>>(new Set());
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
      {row.map((d) =>
        d.isSuggested && !bung.has(d.key) ? (
          <div
            key={d.key}
            className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-border bg-card p-3 lg:grid-cols-[1.6fr_0.9fr_0.9fr_auto] lg:items-end"
          >
            <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 lg:col-span-1 lg:min-h-11">
              <div className="min-w-0">
                <p className="font-semibold">
                  {d.materialTypeName}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {d.category}
                  </span>
                </p>
                {/* Giá điền sẵn là GIÁ CŨ — nói rõ của lượt nào để người nhập soát, khỏi lưu nhầm. */}
                <p className="text-sm text-muted-foreground">
                  {d.priceDate
                    ? `Giá theo lượt ${formatDateVN(d.priceDate).slice(0, 5)} — khác thì sửa ô đơn giá`
                    : d.unitPrice == null
                      ? "Chưa có giá lượt trước — để trống nếu chờ hóa đơn"
                      : "Giá tự nhập"}
                </p>
              </div>
              <span className="flex shrink-0 gap-1 lg:hidden">
                <CompactCloseButton
                  d={d}
                  canRemove={canRemove}
                  onRemove={onBo}
                  onBung={() => setBung((b) => new Set(b).add(d.key))}
                />
              </span>
            </div>
            <NumberField
              label="Số lượng"
              required
              hideRequiredMark
              unit="kg"
              navCol="kg"
              value={d.quantityKg || null}
              onChange={(v) => onEdit(d.key, { quantityKg: v ?? 0 })}
            />
            <NumberField
              label="Đơn giá"
              hideRequiredMark
              unit="đ"
              value={d.unitPrice}
              onChange={(v) => onEdit(d.key, { unitPrice: v })}
            />
            <span className="hidden gap-1 lg:flex">
              <CompactCloseButton
                d={d}
                canRemove={canRemove}
                onRemove={onBo}
                onBung={() => setBung((b) => new Set(b).add(d.key))}
              />
            </span>
          </div>
        ) : (
          <div
            key={d.key}
            className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-3 lg:grid-cols-[1.1fr_1.6fr_0.9fr_0.9fr_auto] lg:items-end"
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
              onCreate={(name) => onCreateMaterialType(name, d.category)}
              onEditItem={onEditMaterialType}
              editLabel="Sửa thông tin loại nguyên liệu này — lưu thẳng vào Danh mục."
            />
            <NumberField
              label="Số lượng"
              required
              unit="kg"
              navCol="kg"
              value={d.quantityKg || null}
              onChange={(v) => onEdit(d.key, { quantityKg: v ?? 0 })}
            />
            <NumberField
              label="Đơn giá"
              unit="đ"
              value={d.unitPrice}
              onChange={(v) => onEdit(d.key, { unitPrice: v })}
            />
            {canRemove ? (
              <Button
                title="Bỏ dòng loại hàng này khỏi chuyến đang gõ (chưa lưu nên không đụng sổ)."
                variant="danger"
                aria-label="Bỏ dòng"
                className="col-span-2 justify-center lg:col-span-1"
                onClick={() => onBo(d.key)}
              >
                <X />
                <span className="lg:hidden">Bỏ dòng</span>
              </Button>
            ) : (
              <span className="hidden lg:block" aria-hidden />
            )}
          </div>
        ),
      )}

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

/** Hai nút nhỏ của dòng gọn: đổi loại (bung đủ ô chọn) · bỏ dòng. */
function CompactCloseButton({
  d,
  canRemove,
  onRemove: onBo,
  onBung,
}: {
  d: ImportLine;
  canRemove: boolean;
  onRemove: (key: string) => void;
  onBung: () => void;
}) {
  return (
    <>
      <Button
        title="Đổi loài / loại nguyên liệu của dòng điền sẵn này — bung đủ các ô chọn."
        type="button"
        variant="edit"
        size="icon"
        aria-label={`Đổi loại của dòng ${d.materialTypeName}`}
        onClick={onBung}
      >
        <Pencil />
      </Button>
      {canRemove && (
        <Button
          title="Bỏ dòng loại hàng này khỏi chuyến đang gõ (chưa lưu nên không đụng sổ)."
          type="button"
          variant="danger"
          size="icon"
          aria-label={`Bỏ dòng ${d.materialTypeName}`}
          onClick={() => onBo(d.key)}
        >
          <X />
        </Button>
      )}
    </>
  );
}
