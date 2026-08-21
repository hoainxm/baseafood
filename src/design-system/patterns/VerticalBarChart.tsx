// ============================================================
// Tên file cũ: src/design-system/patterns/BieuDoCotDoc.tsx
// Tên tiếng Việt: Biểu đồ cột đứng
// Description: Vertical Bar Chart Component
// ============================================================
import { cn } from "@/lib/utils";

/**
 * BieuDoCotDoc — biểu đồ cột đứng (dọc) hiển thị sản lượng/số liệu theo NGÀY.
 *
 * Cột đứng hiển thị trực quan các ngày từ trái qua phải theo thứ tự thời gian.
 * Có vùng cuộn ngang tự động (scroll-nice) giúp biểu đồ không bị ép chặt khi xem khoảng
 * thời gian dài, từ đó đảm bảo nhãn ngày và số liệu trên đầu cột hiển thị đầy đủ,
 * không bao giờ bị cắt bớt hay hiển thị dấu ba chấm (...).
 * Vẽ đường trung bình nét đứt (warning color) làm mốc so sánh với nhãn ghim cố định ở rìa phải.
 */
export interface CotBieuDoDoc {
  nhan: string;
  giaTri: number;
  phu?: string;
}

export function BieuDoCotDoc({
  data,
  dinhDang = (n) => n.toLocaleString("vi-VN"),
  donVi,
  duongTrungBinh = true,
  className,
}: {
  data: CotBieuDoDoc[];
  /** Định dạng số hiển thị. */
  dinhDang?: (n: number) => string;
  donVi?: string;
  duongTrungBinh?: boolean;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.giaTri));
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
    <div className={cn("space-y-4", className)}>
      <div className="relative border-2 border-border rounded-xl bg-card p-5">
        {/* Vùng cuộn ngang chứa danh sách các ngày */}
        <div className="overflow-x-auto scroll-nice pb-2">
          {/* Lớp định vị chứa các cột và đường trung bình */}
          <div className="relative pt-8 pb-2 min-w-max">
            {/* Lớp cột sản lượng */}
            <div className="flex items-end gap-5 relative z-10">
              {data.map((d, index) => {
                const pct = (d.giaTri / max) * 100;
                return (
                  <div
                    key={index}
                    className="flex flex-col items-center justify-end shrink-0 group"
                    style={{ width: "5rem" }} // Chiều rộng 80px rộng rãi để số liệu không bao giờ bị cắt
                  >
                    {/* Số lượng nhập bên trên cột */}
                    <span className="text-xs font-bold text-foreground mb-2 select-none whitespace-nowrap">
                      {dinhDang(d.giaTri)}
                    </span>

                    {/* Thanh biểu đồ */}
                    <div className="relative w-12 h-48 flex items-end justify-center rounded-t bg-muted/20">
                      <div
                        className="w-8 rounded-t bg-primary group-hover:bg-primary/95 transition-all duration-200"
                        style={{ height: `${Math.max(2, pct)}%` }}
                      />
                    </div>

                    {/* Nhãn ngày/kỳ */}
                    <span className="text-xs font-semibold text-muted-foreground mt-2 select-none whitespace-nowrap">
                      {d.nhan}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Lớp phủ đường trung bình nét đứt (dashed line) */}
            {duongTrungBinh && tb > 0 && (
              <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  bottom: "32px", // đáy trùng khớp với mép dưới thanh cột
                  height: "192px", // chiều cao 192px khớp h-48 của thanh cột
                }}
              >
                <div
                  className="absolute left-0 right-0 border-t-2 border-dashed border-warning"
                  style={{ bottom: `${tbPct}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Lớp ghim nhãn trung bình ở bên phải biểu đồ (không trôi khi cuộn cột) */}
        {duongTrungBinh && tb > 0 && (
          <div className="absolute inset-y-5 right-5 pointer-events-none z-20 w-full">
            <div
              className="absolute right-0"
              style={{
                bottom: "32px",
                height: "192px",
              }}
            >
              <div
                className="absolute right-0 -translate-y-1/2 select-none whitespace-nowrap rounded border border-warning bg-warning px-2.5 py-1 text-sm font-bold text-warning-foreground shadow-md"
                style={{ bottom: `${tbPct}%` }}
              >
                TB: {dinhDang(Math.round(tb))}
                {donViChu}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
