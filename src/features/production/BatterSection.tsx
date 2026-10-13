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
  diKem,
  botKg,
  onDoi,
  optBot,
  onCreateBatter,
  onEditBatter,
  productKg: finishedGoodKg,
  columnNavigation: hasColumnNav = false,
}: {
  /** Tên các loại bột đi kèm của mặt hàng (đúng thứ tự gắn ở Danh mục). */
  diKem: string[];
  botKg: Record<string, number>;
  onDoi: (next: Record<string, number>) => void;
  /** Danh mục loại bột — value = TÊN (sổ lưu theo tên). */
  optBot: ComboboxOption[];
  /** Tạo loại bột mới tại chỗ (lưu ngay vào danh mục) — trả về TÊN. */
  onCreateBatter: (ten: string) => string;
  /** Mở hộp sửa nhanh loại bột (value = tên). */
  onEditBatter?: (ten: string) => void;
  productKg: number;
  /** Ô số nhảy ↑/↓ theo cột trong bảng ghi (khung `[data-grid-nav]`). */
  columnNavigation?: boolean;
}) {
  const visibleBatters = listVisibleBatters(diKem, botKg);
  const total = sumBatterKg(botKg);
  const tyLe = computeBatterRatio(total, finishedGoodKg);
  const batterTypeCount = Object.keys(sanitizeBatterKg(botKg)).length;

  const bo = (ten: string) => {
    const next = { ...botKg };
    delete next[ten];
    onDoi(next);
  };

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
        {visibleBatters.map((ten) => {
          const isNotBundled = !diKem.includes(ten);
          return (
            <div key={ten} className="flex min-w-0 flex-[1_1_9rem] items-end gap-1 sm:max-w-[13rem]">
              <NumberField
                label={ten}
                hideRequiredMark
                unit="kg"
                navCol={hasColumnNav ? `bot:${ten}` : undefined}
                className="min-w-0 flex-1"
                value={botKg[ten] || null}
                onChange={(v) => onDoi({ ...botKg, [ten]: v ?? 0 })}
              />
              {isNotBundled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Bỏ ${ten}`}
                  title="Bỏ loại bột này khỏi dòng (chỉ dòng đang gõ, không đụng danh mục)."
                  onClick={() => bo(ten)}
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
            onChange={(ten) => ten && onDoi({ ...botKg, [ten]: botKg[ten] ?? 0 })}
            options={optBot.filter((o) => !visibleBatters.includes(o.value))}
            onCreate={onCreateBatter}
            onEditItem={onEditBatter}
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
          {tyLe != null && (
            <>
              {" "}
              · <span className="tnum">{num(Math.round(tyLe * 10) / 10)}</span>% so với
              thành phẩm
            </>
          )}
        </p>
      )}
    </div>
  );
}
