// ============================================================
// Tên file: src/features/production/KhoiBanNoiDia.tsx
// Tên tiếng Việt: Khối "Bán nội địa trong ngày" của phiên ghi thành phẩm (/wip, mig 0054)
// ============================================================
// Nguyên liệu bán THẲNG cho khách trong nước, không qua chế biến (bảng cân đối giấy:
// dòng "Bán nội địa −987" ở khối NL). Ghi cùng phiên với thành phẩm, lưu sang sổ
// riêng `domestic_sales` — KHÔNG cộng vào sản lượng thành phẩm. Cân đối điền dòng
// giảm "Bán nội địa" từ sổ này. Ô chọn loại NL / khách: thêm mới tại chỗ + bút chì.
import { Button, Combobox, NumberField, type MucChon } from "@/design-system";
import { kg, num } from "@/lib/format";
import { Plus, Store, X } from "lucide-react";
import { banNoiDiaDayDu, type DongBanNoiDia } from "./wipHelpers";

interface ODanhMuc {
  options: MucChon[];
  onCreate: (ten: string) => string;
  onSuaMuc: (value: string) => void;
  suaDuoc: (value: string) => boolean;
  nhanSua: string;
}

export function KhoiBanNoiDia({
  dong,
  onSua,
  onBo,
  onThem,
  loaiNL,
  khach,
}: {
  dong: DongBanNoiDia[];
  onSua: (key: string, patch: Partial<DongBanNoiDia>) => void;
  onBo: (key: string) => void;
  onThem: () => void;
  /** Danh mục loại NL — value = TÊN. */
  loaiNL: ODanhMuc;
  /** Danh mục khách hàng — value = TÊN. */
  khach: ODanhMuc;
}) {
  const hopLe = dong.filter(banNoiDiaDayDu);
  const tongKg = hopLe.reduce((s, d) => s + d.quantityKg, 0);
  const tongTien = hopLe.reduce((s, d) => s + d.quantityKg * (d.unitPrice ?? 0), 0);

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
          onClick={onThem}
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
              onChange={(v) => onSua(d.key, { materialTypeName: v })}
              options={loaiNL.options}
              onCreate={loaiNL.onCreate}
              onSuaMuc={loaiNL.onSuaMuc}
              suaDuoc={loaiNL.suaDuoc}
              nhanSua={loaiNL.nhanSua}
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
            onChange={(v) => onSua(d.key, { quantityKg: v ?? 0 })}
          />
          <NumberField
            label="Đơn giá"
            unit="đ/kg"
            className="min-w-0 flex-[1_1_9rem] sm:max-w-[12rem]"
            value={d.unitPrice}
            onChange={(v) => onSua(d.key, { unitPrice: v })}
          />
          <div className="min-w-0 flex-[1_1_11rem]">
            <Combobox
              label="Khách hàng"
              value={d.customerName}
              onChange={(v) => onSua(d.key, { customerName: v })}
              options={khach.options}
              onCreate={khach.onCreate}
              onSuaMuc={khach.onSuaMuc}
              suaDuoc={khach.suaDuoc}
              nhanSua={khach.nhanSua}
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

      {hopLe.length > 0 && (
        <p className="text-right text-base text-muted-foreground">
          Bán nội địa phiên này:{" "}
          <span className="tnum font-semibold text-foreground">{kg(tongKg)}</span>
          {tongTien > 0 && (
            <>
              {" "}· <span className="tnum">{num(tongTien)}</span> đ
            </>
          )}
        </p>
      )}
    </div>
  );
}
