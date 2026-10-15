// ============================================================
// Tên file: src/features/imports/DailyScrapSection.tsx
// Tên tiếng Việt: Phế liệu cân cuối ngày (nội tạng / dạt) — form nhập thẳng, một nút Lưu
// Description: Inline end-of-day scrap form (controlled draft) shown right above "Chốt ngày".
// 2026-10-14: bỏ hộp thoại "Thêm phế liệu" (hai nút Lưu trùng việc) + bảng riêng ⇒ ô kg
// Nội tạng / Dạt hiện sẵn ngay trên nút Chốt ngày, người dùng khỏi quên cân.
// ============================================================
import type { Workshop } from "@/types";
import {
  Button,
  Combobox,
  ErrorSummary,
  NumberField,
  Tag,
  type ComboboxOption,
  type FieldError,
} from "@/design-system";
import { kg, num, formatDateVN } from "@/lib/format";
import { Plus, Save, Scale } from "lucide-react";
import { SCRAP_SUGGESTIONS, scrapDraftTotalKg, type ScrapDraftRow } from "./importHelpers";

const typeOptions: ComboboxOption[] = SCRAP_SUGGESTIONS.map((t) => ({ value: t, label: t }));

export function DailyScrapSection({
  date,
  workshop,
  draft,
  onDraftChange,
  onSave,
  errors,
  isDirty,
  isLocked,
  showPrice = true,
}: {
  date: string;
  workshop: Workshop;
  /** Bản nháp các ô (màn giữ state — "Chốt ngày" lưu luôn phần đang gõ). */
  draft: ScrapDraftRow[];
  onDraftChange: (rows: ScrapDraftRow[]) => void;
  onSave: () => void;
  errors: FieldError[];
  /** Có số gõ mà chưa lưu. */
  isDirty: boolean;
  isLocked: boolean;
  /** Không có quyền xem giá ⇒ ẩn ô giá bán + tổng tiền phế liệu. */
  showPrice?: boolean;
}) {
  const totalKg = scrapDraftTotalKg(draft);
  const totalAmount = draft.reduce(
    (s, r) => s + (r.quantityKg ?? 0) * (r.sellingPrice ?? 0),
    0
  );
  const hasSaved = draft.some((r) => r.id);

  const patch = (key: string, p: Partial<ScrapDraftRow>) =>
    onDraftChange(draft.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const addOtherType = () =>
    onDraftChange([
      ...draft,
      { key: `new:${Date.now()}`, id: null, name: "", quantityKg: null, sellingPrice: null, periodId: "" },
    ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Scale className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="font-semibold text-foreground">Phế liệu cân cuối ngày</h3>
        {hasSaved ? (
          <Tag variant="done">Đã cân {kg(scrapDraftTotalKg(draft.filter((r) => r.id)))}</Tag>
        ) : (
          <Tag variant="pending">Chưa cân</Tag>
        )}
        {isDirty && <Tag variant="warning">Chưa lưu</Tag>}
      </div>
      <p className="text-sm text-muted-foreground">
        Nội tạng, dạt cân gộp cho xưởng {workshop}, ngày {formatDateVN(date)}. Màn Cân đối lấy
        lại số này. Muốn bỏ một loại thì xóa số kg rồi lưu.
      </p>

      <ErrorSummary errors={errors} />

      {isLocked ? (
        <ul className="space-y-1">
          {draft.filter((r) => r.id).length === 0 ? (
            <li className="text-sm text-muted-foreground">Không ghi phế liệu cho ngày này.</li>
          ) : (
            draft
              .filter((r) => r.id)
              .map((r) => (
                <li key={r.key} className="flex justify-between gap-3">
                  <span>{r.name}</span>
                  <span className="tnum font-semibold">{kg(r.quantityKg ?? 0)}</span>
                </li>
              ))
          )}
        </ul>
      ) : (
        <div className="space-y-3" data-scrap-form>
          {draft.map((r) => (
            <div key={r.key} className="grid gap-3 sm:grid-cols-2">
              {r.id || r.name ? (
                <NumberField
                  label={r.name || "Loại khác"}
                  unit="kg"
                  value={r.quantityKg}
                  onChange={(v) => patch(r.key, { quantityKg: v })}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Combobox
                    label="Loại khác"
                    value={r.name}
                    onChange={(v) => patch(r.key, { name: v })}
                    options={typeOptions}
                    onCreate={(name) => name}
                  />
                  <NumberField
                    label="Số lượng"
                    unit="kg"
                    value={r.quantityKg}
                    onChange={(v) => patch(r.key, { quantityKg: v })}
                  />
                </div>
              )}
              <div className="flex items-end gap-2">
                {showPrice && (
                  <NumberField
                    label={`Giá bán ${r.name ? r.name.toLowerCase() : ""}`.trim()}
                    unit="đ"
                    value={r.sellingPrice}
                    onChange={(v) => patch(r.key, { sellingPrice: v })}
                    className="min-w-0 flex-1"
                  />
                )}
                {r.periodId && (
                  <Tag variant="done" className="mb-2">
                    Đã vào kỳ
                  </Tag>
                )}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              title="Thêm một dòng cho loại phế liệu khác ngoài nội tạng, dạt (gõ tên mới được)."
              type="button"
              variant="outline"
              size="sm"
              onClick={addOtherType}
            >
              <Plus />
              Loại khác
            </Button>
            <p className="text-sm text-muted-foreground">
              Tổng <span className="tnum font-semibold text-foreground">{kg(totalKg)}</span>
              {showPrice && totalAmount > 0 && <> · <span className="tnum">{num(totalAmount)} đ</span></>}
            </p>
          </div>

          <Button
            title="Ghi số phế liệu đang gõ vào sổ của ngày + xưởng này. Bấm Chốt ngày cũng tự lưu phần này."
            type="button"
            variant="save"
            className="w-full"
            onClick={onSave}
          >
            <Save />
            Lưu phế liệu
          </Button>
        </div>
      )}
    </div>
  );
}
