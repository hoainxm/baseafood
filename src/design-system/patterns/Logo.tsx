import { cn } from "@/lib/utils";

/**
 * Logo Baseafood — ảnh lấy từ trang chính thức baseafood.vn, kèm chữ.
 *
 * Chữ là bắt buộc chứ không phải trang trí: ảnh logo bé, chữ trong ảnh nhỏ,
 * người đeo kính lão nhìn ở khoảng cách tay không đọc ra. Chữ đặt cạnh mới
 * nhận diện được ngay.
 *
 * Màu thương hiệu #17529c trong tokens.css rút từ chính ảnh này, nên logo và
 * giao diện là một khối màu.
 */
export function Logo({
  className,
  cao = "h-11",
  hienChu = true,
  phuDe,
}: {
  className?: string;
  /** Class chiều cao Tailwind của ảnh, vd "h-11" */
  cao?: string;
  hienChu?: boolean;
  /** Dòng nhỏ dưới chữ Baseafood. Bỏ trống thì không hiện. */
  phuDe?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <img
        src="/baseafood-logo.png"
        alt=""
        aria-hidden={hienChu}
        className={cn("w-auto shrink-0 object-contain", cao)}
      />
      {hienChu && (
        <span className="min-w-0 shrink-0">
          <span className="block text-lg lg:text-xl leading-tight font-bold tracking-tight text-primary whitespace-nowrap">
            BASEAFOOD
          </span>
          {phuDe && (
            <span className="block text-sm text-muted-foreground whitespace-nowrap">
              {phuDe}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
