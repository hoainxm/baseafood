// ============================================================
// Tên tiếng Việt: Băng chuyền các khâu
// Description: Stage pipeline — kg through each stage, waiting kg, missing tasks
// ============================================================
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { SacPhanLoai } from "./Nhan";

/**
 * BangChuyen — chuỗi khâu nối tiếp (nhập → SX → kho → đóng gói → xuất/bán), mỗi ô:
 * kg đã qua · kg đang chờ · số việc còn thiếu; giữa hai ô ghi % chuyển tiếp. Bản gọn
 * của sơ đồ dòng chảy, đọc được trên điện thoại.
 *
 * Xếp theo BỀ RỘNG VÙNG CHỨA (`@container`), không theo màn hình: vùng ≥ 48rem xếp
 * ngang, hẹp hơn xếp dọc với mũi tên xuống — laptop có thanh bên hay chữ 130% vẫn đúng.
 */
export interface KhauBangChuyen {
  khoa: string;
  ten: string;
  kg: number;
  kgCho?: number;
  viecThieu?: number;
  /** kg khâu này ÷ khâu trước; null = không ghi. */
  tiLeChuyen?: number | null;
  /** Sắc của khâu (viền trái + số) — khớp màu thẻ số cùng loại trên màn. */
  sac?: SacPhanLoai;
}

/* Liệt kê TRỌN tên lớp để Tailwind quét thấy. */
const SAC_KHAU: Record<SacPhanLoai, { vien: string; so: string }> = {
  tim: { vien: "border-l-tone-tim", so: "text-tone-tim" },
  ngoc: { vien: "border-l-tone-ngoc", so: "text-tone-ngoc" },
  bien: { vien: "border-l-tone-bien", so: "text-tone-bien" },
  bang: { vien: "border-l-tone-bang", so: "text-tone-bang" },
  cat: { vien: "border-l-tone-cat", so: "text-tone-cat" },
  hong: { vien: "border-l-tone-hong", so: "text-tone-hong" },
  la: { vien: "border-l-tone-la", so: "text-tone-la" },
  cam: { vien: "border-l-tone-cam", so: "text-tone-cam" },
  xam: { vien: "border-l-tone-xam", so: "text-tone-xam" },
};

export function BangChuyen({
  khau,
  dinhDang = (n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 0 }),
  donVi = "kg",
  onChon,
  className,
}: {
  khau: KhauBangChuyen[];
  dinhDang?: (n: number) => string;
  donVi?: string;
  /** Bấm một khâu ⇒ mở màn của khâu đó. */
  onChon?: (khoa: string) => void;
  className?: string;
}) {
  const pt = (x: number) => `${(x * 100).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}%`;
  return (
    <div className={cn("@container", className)}>
      <ol className="flex flex-col gap-1 @3xl:flex-row @3xl:items-stretch">
        {khau.map((k, i) => {
          const thieu = k.viecThieu ?? 0;
          const noiDung = (
            <>
              <span className="text-sm font-medium text-muted-foreground">
                {i + 1}. {k.ten}
              </span>
              <span className={cn("tnum text-xl font-bold leading-tight", k.sac ? SAC_KHAU[k.sac].so : "text-foreground")}>
                {dinhDang(k.kg)} <span className="text-sm font-semibold text-muted-foreground">{donVi}</span>
              </span>
              {(k.kgCho ?? 0) > 0 && (
                <span className="tnum text-sm text-warning">Đang chờ {dinhDang(k.kgCho ?? 0)} {donVi}</span>
              )}
              <span className={cn("text-sm", thieu > 0 ? "font-semibold text-warning" : "text-success")}>
                {thieu > 0 ? `${thieu} việc còn thiếu` : "Đủ việc"}
              </span>
            </>
          );
          const cls = cn(
            "flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border-2 bg-card p-3 text-left",
            thieu > 0 ? "border-warning/40" : "border-border",
            k.sac && cn("border-l-4", SAC_KHAU[k.sac].vien),
          );
          return (
            <Fragment key={k.khoa}>
              {i > 0 && (
                <li aria-hidden className="flex shrink-0 items-center justify-center gap-1 text-muted-foreground @3xl:w-12 @3xl:flex-col">
                  <ChevronDown className="size-4 @3xl:hidden" />
                  <ChevronRight className="hidden size-5 @3xl:block" />
                  {k.tiLeChuyen != null && <span className="tnum text-xs font-semibold">{pt(k.tiLeChuyen)}</span>}
                </li>
              )}
              <li className="flex min-w-0 flex-1">
                {onChon ? (
                  <button
                    type="button"
                    onClick={() => onChon(k.khoa)}
                    title={`Mở màn ${k.ten.toLowerCase()} để xem chi tiết và làm việc còn thiếu.`}
                    className={cn(cls, "nhan-an cursor-pointer hover:border-primary hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}
                  >
                    {noiDung}
                  </button>
                ) : (
                  <div className={cls}>{noiDung}</div>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </div>
  );
}
