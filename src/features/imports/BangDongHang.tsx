// ============================================================
// Tên file: src/features/imports/BangDongHang.tsx
// Tên tiếng Việt: Bảng loại hàng của một chuyến (nhập nhiều dòng một lượt)
// Tách khỏi MaterialImportScreen.tsx ngày 2026-09-21 — KHÔNG đổi logic.
// ============================================================
import type { Category } from "@/types";
import { CATEGORIES } from "@/types";
import { Button, Combobox, NumberField, type MucChon } from "@/design-system";
import { Plus, X } from "lucide-react";
import type { DongBang } from "./importHelpers";

/* ---------- Bảng loại hàng của một chuyến (nhập nhiều dòng một lượt) ---------- */

/**
 * Bảng nhập ĐƠN GIẢN, TRẢI NGANG: mỗi loại là MỘT HÀNG — các ô nằm ngang trên
 * desktop (Loài · Loại NL · Số lượng · Đơn giá · Bỏ), xuống dòng gọn trên điện
 * thoại. Nhãn luôn hiện để người lớn tuổi đọc rõ. Thêm loại bằng nút ở cuối,
 * dòng mới xuống CUỐI — không tự nhảy, không xô layout.
 */
export function BangDongHang({
  dong,
  onSua,
  onBo,
  onThem,
  optLoaiTheoLoai,
  onTaoLoai,
}: {
  dong: DongBang[];
  onSua: (key: string, patch: Partial<DongBang>) => void;
  onBo: (key: string) => void;
  onThem: () => void;
  optLoaiTheoLoai: (loai: string) => MucChon[];
  onTaoLoai: (ten: string, loai: string) => string;
}) {
  const coTheBo = dong.length > 1;
  return (
    <div className="space-y-3">
      {dong.map((d) => (
        <div
          key={d.key}
          className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.6fr_0.9fr_0.9fr_auto] lg:items-end"
        >
          <Combobox
            label="Loài"
            required
            choPhepXoa={false}
            value={d.category}
            onChange={(v) =>
              onSua(d.key, { category: v as Category, materialTypeName: "" })
            }
            options={CATEGORIES.map((l) => ({ value: l, label: l }))}
          />
          <Combobox
            label="Loại nguyên liệu"
            required
            value={d.materialTypeName}
            onChange={(v) => onSua(d.key, { materialTypeName: v })}
            options={optLoaiTheoLoai(d.category)}
            onCreate={(ten) => onTaoLoai(ten, d.category)}
          />
          <NumberField
            label="Số lượng"
            required
            unit="kg"
            value={d.quantityKg || null}
            onChange={(v) => onSua(d.key, { quantityKg: v ?? 0 })}
          />
          <NumberField
            label="Đơn giá"
            unit="đ"
            value={d.unitPrice}
            onChange={(v) => onSua(d.key, { unitPrice: v })}
          />
          {coTheBo ? (
            <Button
              title="Bỏ dòng loại hàng này khỏi chuyến đang gõ (chưa lưu nên không đụng sổ)."
              variant="outline"
              aria-label="Bỏ dòng"
              className="justify-center sm:col-span-2 lg:col-span-1"
              onClick={() => onBo(d.key)}
            >
              <X />
              <span className="lg:hidden">Bỏ dòng</span>
            </Button>
          ) : (
            <span className="hidden lg:block" aria-hidden />
          )}
        </div>
      ))}

      <Button
        title="Thêm một dòng loại hàng nữa cho chuyến này — một chuyến chở được nhiều loại."
        type="button"
        variant="outline"
        size="lg"
        className="w-full border-dashed"
        onClick={onThem}
      >
        <Plus />
        Thêm loại hàng
      </Button>
    </div>
  );
}
