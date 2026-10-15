// ============================================================
// Tên file: src/features/production/FrozenStockSection.tsx
// Tên tiếng Việt: Khối "Hàng đông lạnh nhập kho (Hàng tạm)" của phiên ghi ở /wip
// ============================================================
// Hàng sơ chế cấp đông ở dạng NGUYÊN LIỆU (2 DA <80GR, BAO TỬ 2DA, CÁ TRÁO 140UP…) —
// KHÔNG phải thành phẩm. Ghi cùng phiên, Lưu vào sổ ⇒ mỗi dòng là một lô nhập nhóm
// "Hàng tạm" ở Sổ kho tháng (lib/frozenStockLines.ts). Ô tên hàng: danh mục loại NL
// (thêm mới + bút chì) + tên Hàng tạm đã có trong sổ kho. Ô kho: 5 kho hệ thống (danh
// sách cố định — ngoại lệ quy tắc 7).
import { Button, Combobox, NumberField, type ComboboxOption } from "@/design-system";
import { kg } from "@/lib/format";
import { newId } from "@/lib/store";
import { isFrozenEntryComplete, type FrozenStockEntry } from "@/lib/frozenStockLines";
import { Plus, Snowflake, X } from "lucide-react";

export interface FrozenStockDraft extends FrozenStockEntry {
  key: string;
}

export const createEmptyFrozenDraft = (warehouse: string, itemName = ""): FrozenStockDraft => ({
  key: newId(),
  itemName,
  kg: 0,
  warehouse,
});

export const isFrozenDraftEmpty = (d: FrozenStockDraft) => !d.itemName.trim() && !(d.kg > 0);

interface CatalogCell {
  options: ComboboxOption[];
  onCreate?: (name: string) => string;
  onEditItem: (value: string) => void;
  canEdit: (value: string) => boolean;
  editLabel: string;
}

export function FrozenStockSection({
  lines,
  onUpdateRow,
  onRemove,
  onAddRow,
  itemCell,
  warehouseOptions,
}: {
  lines: FrozenStockDraft[];
  onUpdateRow: (key: string, patch: Partial<FrozenStockDraft>) => void;
  onRemove: (key: string) => void;
  onAddRow: () => void;
  /** Tên hàng — value = TÊN (sổ kho lưu theo tên). */
  itemCell: CatalogCell;
  /** Sổ kho (5 kho hệ thống) — value = TÊN kho. */
  warehouseOptions: ComboboxOption[];
}) {
  const totalKg = lines.filter(isFrozenEntryComplete).reduce((s, d) => s + d.kg, 0);

  return (
    <div className="space-y-3 rounded-xl border-2 border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-base font-semibold">
            <Snowflake className="size-icon shrink-0" aria-hidden />
            Hàng đông lạnh nhập kho (Hàng tạm)
          </p>
          <p className="text-sm text-muted-foreground">
            Hàng sơ chế đem cấp đông, chưa phải thành phẩm — VD 2 DA &lt;80GR, BAO TỬ 2DA. Lưu vào sổ
            là thành lô nhập nhóm <b>Hàng tạm</b> ở Sổ kho theo tháng (tháng theo ngày sản xuất).
            Không cộng vào sản lượng thành phẩm.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-10 w-full border-dashed py-2 whitespace-normal sm:w-auto"
          onClick={onAddRow}
          title="Thêm một dòng hàng sơ chế đem cấp đông trong ngày — lưu vào nhóm Hàng tạm của Sổ kho theo tháng."
        >
          <Plus />
          Thêm dòng hàng đông lạnh
        </Button>
      </div>

      {lines.map((d, i) => (
        <div key={d.key} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <div className="min-w-0 flex-[2_1_14rem]">
            <Combobox
              label={`Tên hàng (dòng ${i + 1})`}
              required
              value={d.itemName}
              onChange={(v) => onUpdateRow(d.key, { itemName: v })}
              options={itemCell.options}
              onCreate={itemCell.onCreate}
              onEditItem={itemCell.onEditItem}
              canEdit={itemCell.canEdit}
              editLabel={itemCell.editLabel}
              placeholder="— Chọn hàng (VD 2 DA <80GR) —"
              emptyText="Chưa có tên này — gõ tên rồi Thêm mới."
            />
          </div>
          <NumberField
            label="Số lượng"
            required
            unit="kg"
            className="min-w-0 flex-[1_1_8rem] sm:max-w-[11rem]"
            value={d.kg || null}
            onChange={(v) => onUpdateRow(d.key, { kg: v ?? 0 })}
          />
          <div className="min-w-0 flex-[1_1_10rem] sm:max-w-[14rem]">
            <Combobox
              label="Nhập vào kho"
              required
              clearable={false}
              value={d.warehouse}
              onChange={(v) => onUpdateRow(d.key, { warehouse: v })}
              options={warehouseOptions}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Bỏ dòng hàng đông lạnh ${i + 1}`}
            title="Bỏ dòng này khỏi phiên đang gõ (chưa lưu nên không đụng sổ)."
            onClick={() => onRemove(d.key)}
          >
            <X />
          </Button>
        </div>
      ))}

      {totalKg > 0 && (
        <p className="text-right text-base text-muted-foreground">
          Hàng đông lạnh phiên này: <span className="tnum font-semibold text-foreground">{kg(totalKg)}</span>
        </p>
      )}
    </div>
  );
}
