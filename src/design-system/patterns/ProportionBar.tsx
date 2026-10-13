// ============================================================
// Tên tiếng Việt: Thanh chia phần (100%)
// Description: 100% stacked bar + legend rows — "where did X kg go", plain HTML + tokens
// ============================================================
import { cn } from "@/lib/utils";
import type { SacPhanLoai } from "./Nhan";

/**
 * ThanhChiaPhan — MỘT thanh dài = 100% của một tổng, chia khúc theo từng phần; dưới
 * thanh là danh sách phần (chấm màu · tên · kg · %), mỗi dòng bấm được. Kiểu đọc
 * "cứ 100 kg nguyên liệu thì ra 42 kg bán thành phẩm, 6 kg phế liệu…" — người xem
 * hiểu ngay, không cần học cách đọc sơ đồ.
 *
 * Màu theo `sac` (bảng tone dùng chung với `Nhan`), luôn kèm tên + số — màu không
 * bao giờ là tín hiệu duy nhất. Khúc quá hẹp (< 7%) không ghi % trong thanh, số vẫn ở
 * danh sách. Thuần HTML ⇒ ăn theo cỡ chữ, không cuộn ngang.
 */
export interface PhanChia {
  khoa: string;
  nhan: string;
  giaTri: number;
  sac: SacPhanLoai;
  /** Câu phụ dưới tên (VD "chưa ghi ra khâu nào"). */
  moTa?: string;
}

/* Liệt kê TRỌN tên lớp để Tailwind quét thấy. */
const NEN: Record<SacPhanLoai, string> = {
  tim: "bg-tone-tim",
  ngoc: "bg-tone-ngoc",
  bien: "bg-tone-bien",
  bang: "bg-tone-bang",
  cat: "bg-tone-cat",
  hong: "bg-tone-hong",
  la: "bg-tone-la",
  cam: "bg-tone-cam",
  xam: "bg-tone-xam",
};
const CHU: Record<SacPhanLoai, string> = {
  tim: "text-tone-tim",
  ngoc: "text-tone-ngoc",
  bien: "text-tone-bien",
  bang: "text-tone-bang",
  cat: "text-tone-cat",
  hong: "text-tone-hong",
  la: "text-tone-la",
  cam: "text-tone-cam",
  xam: "text-tone-xam",
};

export function ThanhChiaPhan({
  phan,
  dinhDang = (n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 0 }),
  donVi = "kg",
  onChon,
  moTa,
  className,
}: {
  phan: PhanChia[];
  dinhDang?: (n: number) => string;
  donVi?: string;
  /** Bấm một phần ⇒ mở màn liên quan. */
  onChon?: (khoa: string) => void;
  /** Câu cho trình đọc màn hình. */
  moTa?: string;
  className?: string;
}) {
  const ds = phan.filter((p) => p.giaTri > 0);
  const total = ds.reduce((s, p) => s + p.giaTri, 0);
  if (total <= 0) {
    return (
      <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Chưa có số liệu để chia phần.
      </p>
    );
  }
  const pt = (v: number) => `${((v / total) * 100).toLocaleString("vi-VN", { maximumFractionDigits: v / total < 0.1 ? 1 : 0 })}%`;

  return (
    <div className={cn("grid gap-3", className)}>
      <div role="img" aria-label={moTa ?? ds.map((p) => `${p.nhan} ${pt(p.giaTri)}`).join(", ")} className="flex h-11 w-full overflow-hidden rounded-lg border-2 border-border">
        {ds.map((p) => {
          const width = (p.giaTri / total) * 100;
          return (
            <div
              key={p.khoa}
              title={`${p.nhan}: ${dinhDang(p.giaTri)} ${donVi} (${pt(p.giaTri)})`}
              className={cn("flex min-w-0 items-center justify-center border-r-2 border-card last:border-r-0", NEN[p.sac])}
              style={{ width: `${width}%` }}
            >
              {width >= 7 && <span className="tnum truncate px-1 text-sm font-bold text-white">{pt(p.giaTri)}</span>}
            </div>
          );
        })}
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(12rem,100%),1fr))] gap-2">
        {ds.map((p) => {
          const content = (
            <>
              <span aria-hidden className={cn("mt-1 size-3.5 shrink-0 rounded-sm", NEN[p.sac])} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{p.nhan}</span>
                {p.moTa && <span className="block text-sm text-muted-foreground">{p.moTa}</span>}
                <span className="tnum block text-sm text-muted-foreground">
                  {dinhDang(p.giaTri)} {donVi}
                </span>
              </span>
              <span className={cn("tnum shrink-0 text-xl font-bold", CHU[p.sac])}>{pt(p.giaTri)}</span>
            </>
          );
          const cls = "flex w-full items-start gap-2.5 rounded-lg border-2 border-border bg-card p-2.5 text-left";
          return (
            <li key={p.khoa} className="flex min-w-0">
              {onChon ? (
                <button
                  type="button"
                  onClick={() => onChon(p.khoa)}
                  title={`Mở màn liên quan tới "${p.nhan}".`}
                  className={cn(cls, "nhan-an cursor-pointer hover:border-primary hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring")}
                >
                  {content}
                </button>
              ) : (
                <div className={cls}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
