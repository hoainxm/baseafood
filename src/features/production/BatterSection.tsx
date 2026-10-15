// ============================================================
// Tên file: src/features/production/BatterSection.tsx
// Tên tiếng Việt: Khối nhập BỘT TẨM theo loại cho một dòng thành phẩm (mig 0051)
// ============================================================
// Dùng chung cho bảng ghi phiên (ProductionLinesTable — dòng con dưới thành phẩm) và hộp
// Sửa dòng ở /wip. Mỗi loại bột đi kèm của mặt hàng một ô kg (VD tẩm bột nước
// tương: 24V · 18V · 220H); thiếu loại nào thì "Thêm loại bột khác" tại chỗ.
// Bột là PHỤ GIA — không cộng vào số lượng thành phẩm; hiện tổng bột + tỷ lệ %.
import { Button, Combobox, NumberField, type ComboboxOption } from "@/design-system";
import { num } from "@/lib/format";
import { listVisibleBatters, sanitizeBatterKg, sumBatterKg, computeBatterRatio } from "@/lib/batter";
import { X } from "lucide-react";

export function BatterSection({
  bundledIds,
  batterKg,
  onChange,
  batterOptions,
  onCreateBatter,
  onEditBatter,
  canEditBatter,
  productKg: finishedGoodKg,
  columnNavigation: hasColumnNav = false,
  compact = false,
}: {
  /** Tên các loại bột đi kèm của mặt hàng (đúng thứ tự gắn ở Danh mục). */
  bundledIds: string[];
  batterKg: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  /** Danh mục loại bột — value = TÊN (sổ lưu theo tên). */
  batterOptions: ComboboxOption[];
  /** Tạo loại bột mới tại chỗ (lưu ngay vào danh mục) — trả về TÊN. */
  onCreateBatter?: (name: string) => string;
  /** Mở hộp sửa nhanh loại bột (value = tên). */
  onEditBatter?: (name: string) => void;
  /** Có hiện bút chì sửa loại bột này không (quyền sửa danh mục bột). */
  canEditBatter?: (name: string) => boolean;
  productKg: number;
  /** Ô số nhảy ↑/↓ theo cột trong bảng ghi (khung `[data-grid-nav]`). */
  columnNavigation?: boolean;
  /**
   * MỘT hàng ngang (bảng ghi phiên, chốt 2026-10-15): "Bột tẩm: 24V [ ] 18V [ ] [+ loại
   * khác] = tổng · %" — nhãn là chữ đứng trước ô, bỏ các câu giải thích (vào `title`).
   * Trả về các phần tử rời để màn gọi đặt trong khung flex của nó.
   */
  compact?: boolean;
}) {
  const visibleBatters = listVisibleBatters(bundledIds, batterKg);
  const total = sumBatterKg(batterKg);
  const ratio = computeBatterRatio(total, finishedGoodKg);
  const batterTypeCount = Object.keys(sanitizeBatterKg(batterKg)).length;

  const remove = (name: string) => {
    const next = { ...batterKg };
    delete next[name];
    onChange(next);
  };

  if (compact)
    return (
      <>
        <span
          className="text-sm font-medium"
          title="Bột là phụ gia — ghi riêng từng loại (kg), KHÔNG cộng vào số lượng thành phẩm."
        >
          Bột tẩm:
        </span>
        {visibleBatters.map((name) => (
          <span key={name} className="flex items-center gap-1.5">
            <span className="text-sm">{name}</span>
            <NumberField
              hideLabel
              hideRequiredMark
              label={`Bột ${name}`}
              unit="kg"
              navCol={hasColumnNav ? `bot:${name}` : undefined}
              className="w-[7.5rem]"
              value={batterKg[name] || null}
              onChange={(v) => onChange({ ...batterKg, [name]: v ?? 0 })}
            />
            {!bundledIds.includes(name) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Bỏ ${name}`}
                title="Bỏ loại bột này khỏi dòng (chỉ dòng đang gõ, không đụng danh mục)."
                onClick={() => remove(name)}
              >
                <X />
              </Button>
            )}
          </span>
        ))}
        <div className="w-[13rem]">
          <Combobox
            hideLabel
            label="Thêm loại bột khác"
            hideRequiredMark
            value=""
            onChange={(name) => name && onChange({ ...batterKg, [name]: batterKg[name] ?? 0 })}
            options={batterOptions.filter((o) => !visibleBatters.includes(o.value))}
            onCreate={onCreateBatter}
            onEditItem={onEditBatter}
            canEdit={canEditBatter}
            editLabel="Sửa thông tin loại bột này — lưu thẳng vào Danh mục."
            placeholder={visibleBatters.length ? "+ Loại bột khác" : "+ Chọn loại bột"}
            emptyText="Chưa có loại bột này — gõ tên rồi Thêm mới."
          />
        </div>
        {batterTypeCount > 0 && (
          <span className="text-sm text-muted-foreground">
            = <span className="tnum font-semibold text-foreground">{num(total)}</span> kg
            {ratio != null && <> · <span className="tnum">{num(Math.round(ratio * 10) / 10)}</span>%</>}
          </span>
        )}
      </>
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Bột tẩm đã dùng cho thành phẩm này, ghi riêng từng loại (kg). Bột là phụ
        gia — <b>không</b> cộng vào số lượng thành phẩm.
      </p>

      {visibleBatters.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Mặt hàng này chưa gắn bột đi kèm. Chọn loại bột bên dưới — lưu xong, lần
          sau chọn mặt hàng này sẽ tự hiện sẵn các loại đã dùng.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        {visibleBatters.map((name) => {
          const isNotBundled = !bundledIds.includes(name);
          return (
            <div key={name} className="flex min-w-0 flex-[1_1_9rem] items-end gap-1 sm:max-w-[13rem]">
              <NumberField
                label={name}
                hideRequiredMark
                unit="kg"
                navCol={hasColumnNav ? `bot:${name}` : undefined}
                className="min-w-0 flex-1"
                value={batterKg[name] || null}
                onChange={(v) => onChange({ ...batterKg, [name]: v ?? 0 })}
              />
              {isNotBundled && (
                <Button
                  type="button"
                  variant="danger"
                  size="icon"
                  aria-label={`Bỏ ${name}`}
                  title="Bỏ loại bột này khỏi dòng (chỉ dòng đang gõ, không đụng danh mục)."
                  onClick={() => remove(name)}
                >
                  <X />
                </Button>
              )}
            </div>
          );
        })}

        <div className="min-w-0 flex-[1_1_12rem] sm:max-w-[16rem]">
          <Combobox
            label="Thêm loại bột khác"
            hideRequiredMark
            value=""
            onChange={(name) => name && onChange({ ...batterKg, [name]: batterKg[name] ?? 0 })}
            options={batterOptions.filter((o) => !visibleBatters.includes(o.value))}
            onCreate={onCreateBatter}
            onEditItem={onEditBatter}
            canEdit={canEditBatter}
            editLabel="Sửa thông tin loại bột này — lưu thẳng vào Danh mục."
            placeholder="— Chọn loại bột —"
            emptyText="Chưa có loại bột này — gõ tên rồi Thêm mới."
          />
        </div>
      </div>

      {batterTypeCount > 0 && (
        <p className="text-base text-muted-foreground">
          Tổng bột ={" "}
          <span className="tnum font-semibold text-foreground">{num(total)}</span> kg
          {ratio != null && (
            <>
              {" "}
              · <span className="tnum">{num(Math.round(ratio * 10) / 10)}</span>% so với
              thành phẩm
            </>
          )}
        </p>
      )}
    </div>
  );
}
