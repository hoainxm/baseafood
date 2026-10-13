// ============================================================
// Tên file: src/design-system/patterns/Tag.tsx
// Tên tiếng Việt: Nhãn theo chức năng (trạng thái · nguồn · cảnh báo · phân loại)
// Description: Semantic label chip — colour chosen by MEANING, not by the screen
// ============================================================
import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chức năng của nhãn — màn hình chọn THEO Ý NGHĨA, không chọn màu:
 * - `xong`      đã xong / đạt / khớp / chính thức        → xanh lá
 * - `cho`       đang chờ / chưa xong / nháp (viền đứt)     → hổ phách
 * - `luu-y`     lưu ý, không phải lỗi (ghi bù, giá cũ…)    → hổ phách đặc
 * - `loi`       cần xử lý / sai (tồn âm, lệch, khác loại)  → đỏ
 * - `nguon`     nguồn dữ liệu (sổ nhập, sổ SX, Excel, tay) → xanh thông tin
 * - `vi-tri`    vị trí / kho ngoài ("Gửi: Kho Hồng Phú")    → xanh thương hiệu nhạt
 * - `phan-loai` phân loại nghiệp vụ (kênh, nhóm NL, xưởng…) → sắc nhạt theo `sac`
 * - `phu`       phụ chú / đếm / DEMO                       → xám
 */
export type TagVariant = "xong" | "cho" | "luu-y" | "loi" | "nguon" | "vi-tri" | "phan-loai" | "phu";

/** Sắc cho nhãn PHÂN LOẠI — không mang nghĩa tốt/xấu, chỉ để phân biệt nhóm. */
export type CategoryTone = "tim" | "ngoc" | "bien" | "bang" | "cat" | "hong" | "la" | "cam" | "xam";

const VARIANT_STYLES: Record<Exclude<TagVariant, "phan-loai">, { base: string; dot: string }> = {
  xong: { base: "border-success-line bg-success-surface text-success", dot: "bg-success" },
  cho: { base: "border-dashed border-warning-line bg-warning-surface text-warning", dot: "border border-warning bg-transparent" },
  "luu-y": { base: "border-warning-line bg-warning-surface text-warning", dot: "bg-warning" },
  loi: { base: "border-destructive-line bg-destructive-surface text-destructive", dot: "bg-destructive" },
  nguon: { base: "border-info-line bg-info-surface text-info", dot: "bg-info" },
  "vi-tri": { base: "border-primary/30 bg-accent text-accent-foreground", dot: "bg-primary" },
  phu: { base: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

/* Liệt kê TRỌN tên lớp (không ghép chuỗi) để Tailwind quét thấy. */
const SAC: Record<CategoryTone, { base: string; dot: string }> = {
  tim: { base: "border-tone-tim-line bg-tone-tim-surface text-tone-tim", dot: "bg-tone-tim" },
  ngoc: { base: "border-tone-ngoc-line bg-tone-ngoc-surface text-tone-ngoc", dot: "bg-tone-ngoc" },
  bien: { base: "border-tone-bien-line bg-tone-bien-surface text-tone-bien", dot: "bg-tone-bien" },
  bang: { base: "border-tone-bang-line bg-tone-bang-surface text-tone-bang", dot: "bg-tone-bang" },
  cat: { base: "border-tone-cat-line bg-tone-cat-surface text-tone-cat", dot: "bg-tone-cat" },
  hong: { base: "border-tone-hong-line bg-tone-hong-surface text-tone-hong", dot: "bg-tone-hong" },
  la: { base: "border-tone-la-line bg-tone-la-surface text-tone-la", dot: "bg-tone-la" },
  cam: { base: "border-tone-cam-line bg-tone-cam-surface text-tone-cam", dot: "bg-tone-cam" },
  xam: { base: "border-tone-xam-line bg-tone-xam-surface text-tone-xam", dot: "bg-tone-xam" },
};

/**
 * Tag — chip nhãn một dòng. Luôn có CHỮ + chấm (hoặc icon): màu không bao giờ là
 * tín hiệu duy nhất. `className` chỉ để căn chỉnh bố cục (margin…), KHÔNG đè màu/cỡ.
 */
export function Tag({
  variant,
  tone: sac = "xam",
  icon: Icon,
  children,
  title,
  className,
}: {
  variant: TagVariant;
  /** Chỉ dùng khi `loai="phan-loai"` — lấy từ `channelTone` / `toneForMaterialGroup` / `toneForWorkshop` / `toneByName`. */
  tone?: CategoryTone;
  /** Icon thay cho chấm (VD Lock cho "Đã chốt"). */
  icon?: LucideIcon;
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  const k = variant === "phan-loai" ? SAC[sac] : VARIANT_STYLES[variant];
  return (
    <span
      data-slot="nhan"
      data-kind={variant}
      title={title}
      className={cn(
        "inline-flex h-6 w-fit max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold",
        k.base,
        className
      )}
    >
      {Icon ? (
        <Icon className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <span className={cn("size-2 shrink-0 rounded-full", k.dot)} aria-hidden />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}

/* ---------- Sắc cố định theo giá trị nghiệp vụ — cùng giá trị luôn cùng màu ---------- */

/** Kênh bán: Xuất khẩu tím · Nội địa ngọc. */
export function channelTone(kenh: string | null | undefined): CategoryTone {
  const k = (kenh ?? "").toLowerCase();
  if (k.includes("xuất") || k === "xk") return "tim";
  if (k.includes("nội") || k === "nđ" || k === "nd") return "ngoc";
  return "xam";
}

/** Nhóm nguyên liệu cân đối: Thủy sản biển · Xả đông băng · Bột phụ gia cát · Giảm hồng. */
export function toneForMaterialGroup(nhom: string | null | undefined): CategoryTone {
  const k = (nhom ?? "").toLowerCase();
  if (k.includes("giảm")) return "hong";
  if (k.includes("xả")) return "bang";
  if (k.includes("bột")) return "cat";
  if (k.includes("thủy") || k.includes("thuỷ")) return "bien";
  return "xam";
}

/** Phân xưởng: Đông biển · Cá ngọc · Khô cam; kho lớn / khác → xám. */
export function toneForWorkshop(workshop: string | null | undefined): CategoryTone {
  /* Tách TỪ theo chữ Unicode — `\b` của regex JS không coi "đ", "á", "ô" là chữ cái
     nên /\bđông\b/ không bao giờ khớp "Xưởng Đông". */
  const tu = (workshop ?? "").toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}]+/u);
  if (tu.includes("đông")) return "bien";
  if (tu.includes("cá")) return "ngoc";
  if (tu.includes("khô")) return "cam";
  return "xam";
}

const SAC_XOAY: CategoryTone[] = ["bien", "tim", "ngoc", "cam", "hong", "la", "bang", "cat"];

/**
 * Sắc ổn định theo TÊN cho phân loại mở (kho, nhóm thành phẩm, vai trò, ca, dây
 * chuyền…): cùng tên ⇒ cùng màu ở mọi màn. Băm tên đã chuẩn hoá (bỏ hoa/thường,
 * khoảng trắng thừa).
 */
export function toneByName(ten: string | null | undefined): CategoryTone {
  const k = (ten ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!k) return "xam";
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return SAC_XOAY[h % SAC_XOAY.length];
}
