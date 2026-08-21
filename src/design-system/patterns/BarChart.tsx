// ============================================================
// Tên file cũ: src/design-system/patterns/BieuDoCot.tsx
// Tên tiếng Việt: Biểu đồ cột ngang
// Description: Horizontal Bar Chart Component
// ============================================================
import { cn } from "@/lib/utils";

/**
 * BieuDoCot — biểu đồ thanh NGANG cho trang Báo cáo, kèm ĐƯỜNG TRUNG BÌNH.
 *
 * Thanh ngang (không phải cột đứng) vì nhãn là tên đại lý/khách dài, để ngang mới
 * đọc được; và người lớn tuổi so sánh độ dài thanh nhanh hơn đọc trục số. Một màu
 * thương hiệu duy nhất (không cầu vồng), đường trung bình nét đứt để thấy ngay
 * cái nào trên/dưới mức bình quân. Thuần HTML + token màu ⇒ ăn theo cỡ chữ, không
 * vỡ khi phóng 130%.
 *
 * Chỉ vẽ số truyền vào — không đọc/ghi dữ liệu.
 */
export interface CotBieuDo {
  nhan: string;
  giaTri: number;
  /** Dòng phụ nhỏ dưới nhãn (VD kênh, loại). */
  phu?: string;
}

export function BieuDoCot({
  data,
  dinhDang = (n) => n.toLocaleString("vi-VN"),
  donVi,
  duongTrungBinh = true,
  soDongToiDa = 12,
  className,
}: {
  data: CotBieuDo[];
  /** Định dạng số cho nhãn giá trị (mặc định vi-VN). */
  dinhDang?: (n: number) => string;
  donVi?: string;
  duongTrungBinh?: boolean;
  /** Cắt bớt còn N thanh lớn nhất (gọn màn). */
  soDongToiDa?: number;
  className?: string;
}) {
  const sap = [...data].sort((a, b) => b.giaTri - a.giaTri);
  const hienThi = sap.slice(0, soDongToiDa);
  const con = sap.length - hienThi.length;

  const max = Math.max(1, ...hienThi.map((d) => d.giaTri));
  const tb =
    data.length > 0
      ? data.reduce((s, d) => s + d.giaTri, 0) / data.length
      : 0;
  const tbPct = Math.min(100, (tb / max) * 100);

  if (data.length === 0) {
    return (
      <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Chưa có số liệu để vẽ biểu đồ.
      </p>
    );
  }

  const donViChu = donVi ? ` ${donVi}` : "";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-3">
        {/* Cột nhãn */}
        <div className="w-28 shrink-0 space-y-2 sm:w-40">
          {hienThi.map((d) => (
            <div key={d.nhan} className="flex h-10 flex-col justify-center">
              <span className="truncate text-sm font-medium text-foreground">
                {d.nhan}
              </span>
              {d.phu && (
                <span className="truncate text-xs text-muted-foreground">
                  {d.phu}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Cột thanh — đường trung bình phủ toàn cột này */}
        <div className="relative flex-1 space-y-2">
          {hienThi.map((d) => {
            const pct = Math.max(2, (d.giaTri / max) * 100);
            return (
              <div key={d.nhan} className="relative h-10">
                <div className="absolute inset-0 rounded-md bg-muted" />
                <div
                  className="absolute inset-y-0 left-0 rounded-md bg-primary"
                  style={{ width: `${pct}%` }}
                />
                <span className="absolute inset-y-0 right-2 flex items-center text-sm font-semibold tnum text-foreground">
                  {dinhDang(d.giaTri)}
                  {donViChu}
                </span>
              </div>
            );
          })}

          {/* Đường trung bình */}
          {duongTrungBinh && tb > 0 && (
            <div
              className="pointer-events-none absolute inset-y-0 z-10 border-l-2 border-dashed border-warning"
              style={{ left: `${tbPct}%` }}
              aria-hidden
            >
              <span className="absolute -top-0.5 left-1 whitespace-nowrap rounded bg-warning px-1.5 py-0.5 text-xs font-semibold text-warning-foreground">
                TB {dinhDang(Math.round(tb))}
                {donViChu}
              </span>
            </div>
          )}
        </div>
      </div>

      {con > 0 && (
        <p className="text-sm text-muted-foreground">
          … và {con} mục nhỏ hơn không hiển thị (đã gộp vào tổng ở bảng).
        </p>
      )}
    </div>
  );
}
