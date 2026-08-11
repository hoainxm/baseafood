// ============================================================
// Tên file cũ: src/design-system/patterns/DuLieuMau.tsx
// Tên tiếng Việt: Dữ liệu mẫu giao diện
// Description: Design System Pattern Mock Data
// ============================================================
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FlaskConical } from "lucide-react";

/**
 * DuLieuMau — dải cảnh báo "màn đang chạy DỮ LIỆU MẪU, chưa nối số liệu thật".
 *
 * Đặt ở ĐẦU mỗi màn trưng bày (dashboard MES, lệnh SX, chất lượng, kho lạnh,
 * truy xuất, báo cáo). Khi đã nối dữ liệu thật + sửa flow + nhập số thật thì
 * XÓA `<DuLieuMau />` khỏi màn đó. Các màn đã có dữ liệu thật (nhập hàng, danh
 * mục, bán hàng, cân đối) KHÔNG gắn dải này.
 */
export function DuLieuMau({
  ghiChu,
  className,
}: {
  /** Ghi chú thêm, VD "OEE/dây chuyền chưa số hóa". */
  ghiChu?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={cn(
        "flex items-center gap-2.5 rounded-lg border-2 border-warning/40 bg-warning-surface px-4 py-2.5 text-base font-medium text-warning",
        className
      )}
    >
      <FlaskConical className="size-5 shrink-0" aria-hidden />
      <span>
        <b>Dữ liệu mẫu</b> — màn trưng bày, chưa nối số liệu thật.
        {ghiChu ? <span className="font-normal"> {ghiChu}</span> : null}
      </span>
    </div>
  );
}
