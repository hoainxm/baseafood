// ============================================================
// Tên file: src/features/catalog/ChonBotDiKem.tsx
// Tên tiếng Việt: Ô chọn NHIỀU loại bột đi kèm của một mặt hàng (migration 0051)
// ============================================================
// Mỗi mặt hàng tẩm bột đi kèm một BỘ loại bột riêng (VD tẩm bột nước tương =
// 24V + 18V + 220H; tẩm bột 5-10 = 232 + 20802). Chọn từng loại bằng Combobox,
// loại đã chọn hiện thành thẻ có nút bỏ. Giá trị là chuỗi "id1,id2" vì form danh
// mục (DanhMucCrud) lưu chuỗi — repo.ts chuẩn hoá về mảng khi ghi.
import { useId } from "react";
import type { BatterType } from "@/types";
import { botDiKemIds } from "@/lib/botTam";
import { Combobox, Label } from "@/design-system";
import { X } from "lucide-react";

export function ChonBotDiKem({
  value,
  onChange,
  botTam,
  onTaoBot,
}: {
  /** Chuỗi id "id1,id2" (hoặc rỗng). */
  value: string;
  onChange: (v: string) => void;
  botTam: BatterType[];
  /** Có ⇒ cho tạo loại bột mới tại chỗ (lưu ngay vào danh mục), trả về id. */
  onTaoBot?: (ten: string) => string;
}) {
  const hintId = useId();
  const ids = botDiKemIds({ batterIds: value });
  const theoId = new Map(botTam.map((b) => [b.id, b]));
  const datIds = (next: string[]) => onChange(next.join(","));

  const optConLai = botTam
    .filter((b) => !ids.includes(b.id))
    .map((b) => ({ value: b.id, label: b.name, phu: b.note || undefined }));

  return (
    <div className="flex flex-col gap-2">
      <Label>Bột đi kèm</Label>
      <p id={hintId} className="text-sm text-muted-foreground">
        Các loại bột tẩm dùng cho mặt hàng này — màn ghi thành phẩm sẽ hiện sẵn một
        ô kg cho từng loại. Mặt hàng không tẩm bột thì để trống.
      </p>

      {ids.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-describedby={hintId}>
          {ids.map((id) => (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted py-1 pr-1 pl-3 text-sm font-medium"
            >
              {theoId.get(id)?.name ?? (
                <span className="text-muted-foreground">(loại bột đã xoá)</span>
              )}
              <button
                type="button"
                onClick={() => datIds(ids.filter((x) => x !== id))}
                aria-label={`Bỏ ${theoId.get(id)?.name ?? "loại bột này"}`}
                title="Bỏ loại bột này khỏi mặt hàng (không xoá loại bột trong danh mục)."
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Chưa gắn loại bột nào.</p>
      )}

      <Combobox
        label="Thêm loại bột đi kèm"
        anNhanBatBuoc
        value=""
        onChange={(id) => id && datIds([...ids, id])}
        options={optConLai}
        onCreate={onTaoBot}
        placeholder="— Chọn loại bột để thêm —"
        emptyText={
          onTaoBot
            ? "Chưa có loại bột này — gõ tên rồi Thêm mới."
            : "Chưa có loại bột này — thêm ở tab Bột tẩm của Danh mục."
        }
      />
    </div>
  );
}
