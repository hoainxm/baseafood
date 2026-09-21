// ============================================================
// Tên file: src/features/imports/BangDongHang.tsx
// Tên tiếng Việt: Bảng loại hàng của một chuyến (nhập nhiều dòng một lượt)
// Tách khỏi MaterialImportScreen.tsx ngày 2026-09-21 — KHÔNG đổi logic.
// ============================================================
import type { Category } from "@/types";
import { CATEGORIES } from "@/types";
import { Button, Combobox, NumberField, type MucChon } from "@/design-system";
import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import type { DongBang } from "./importHelpers";

/* ---------- Bảng loại hàng của một chuyến (nhập nhiều dòng một lượt) ---------- */

/**
 * Bảng nhập ĐƠN GIẢN, TRẢI NGANG: mỗi loại là MỘT HÀNG — các ô nằm ngang trên
 * desktop (Loài · Loại NL · Số lượng · Đơn giá · Bỏ); điện thoại: loài, loại mỗi ô
 * một hàng, Số lượng + Đơn giá đứng CẠNH nhau. Cột kg có Enter/↑/↓ nhảy dọc
 * (`navCol`) — bảng điền sẵn theo đại lý thì chỉ gõ kg rồi Enter. Nhãn luôn hiện để người lớn tuổi đọc rõ. Thêm loại bằng nút ở cuối,
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
  // Dòng ĐIỀN SẴN theo đại lý hiện GỌN (tên loại là chữ, chỉ còn ô kg + giá) —
  // bấm "Đổi loại" mới bung đủ ô chọn. Chỉ là trạng thái hiển thị, không đụng dữ liệu.
  const [bung, setBung] = useState<Set<string>>(new Set());
  return (
    <div className="space-y-3" data-luoi-phim="dong-hang">
      {dong.map((d) =>
        d.goiY && !bung.has(d.key) ? (
          <div
            key={d.key}
            className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-border bg-card p-3 lg:grid-cols-[1.6fr_0.9fr_0.9fr_auto] lg:items-end"
          >
            <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 lg:col-span-1 lg:min-h-11">
              <p className="min-w-0 font-semibold">
                {d.materialTypeName}
                <span className="ml-2 font-normal text-muted-foreground">
                  {d.category}
                </span>
              </p>
              <span className="flex shrink-0 gap-1 lg:hidden">
                <NutDongGon
                  d={d}
                  coTheBo={coTheBo}
                  onBo={onBo}
                  onBung={() => setBung((b) => new Set(b).add(d.key))}
                />
              </span>
            </div>
            <NumberField
              label="Số lượng"
              required
              anNhanBatBuoc
              unit="kg"
              navCol="kg"
              value={d.quantityKg || null}
              onChange={(v) => onSua(d.key, { quantityKg: v ?? 0 })}
            />
            <NumberField
              label="Đơn giá"
              anNhanBatBuoc
              unit="đ"
              value={d.unitPrice}
              onChange={(v) => onSua(d.key, { unitPrice: v })}
            />
            <span className="hidden gap-1 lg:flex">
              <NutDongGon
                d={d}
                coTheBo={coTheBo}
                onBo={onBo}
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
              choPhepXoa={false}
              className="col-span-2 lg:col-span-1"
              value={d.category}
              onChange={(v) =>
                onSua(d.key, { category: v as Category, materialTypeName: "" })
              }
              options={CATEGORIES.map((l) => ({ value: l, label: l }))}
            />
            <Combobox
              label="Loại nguyên liệu"
              required
              className="col-span-2 lg:col-span-1"
              value={d.materialTypeName}
              onChange={(v) => onSua(d.key, { materialTypeName: v })}
              options={optLoaiTheoLoai(d.category)}
              onCreate={(ten) => onTaoLoai(ten, d.category)}
            />
            <NumberField
              label="Số lượng"
              required
              unit="kg"
              navCol="kg"
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
        onClick={onThem}
      >
        <Plus />
        Thêm loại hàng
      </Button>
    </div>
  );
}

/** Hai nút nhỏ của dòng gọn: đổi loại (bung đủ ô chọn) · bỏ dòng. */
function NutDongGon({
  d,
  coTheBo,
  onBo,
  onBung,
}: {
  d: DongBang;
  coTheBo: boolean;
  onBo: (key: string) => void;
  onBung: () => void;
}) {
  return (
    <>
      <Button
        title="Đổi loài / loại nguyên liệu của dòng điền sẵn này — bung đủ các ô chọn."
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Đổi loại của dòng ${d.materialTypeName}`}
        onClick={onBung}
      >
        <Pencil />
      </Button>
      {coTheBo && (
        <Button
          title="Bỏ dòng loại hàng này khỏi chuyến đang gõ (chưa lưu nên không đụng sổ)."
          type="button"
          variant="outline"
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
