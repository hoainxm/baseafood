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
export type TagVariant = "done" | "pending" | "warning" | "error" | "source" | "location" | "category" | "muted";

/** Sắc cho nhãn PHÂN LOẠI — không mang nghĩa tốt/xấu, chỉ để phân biệt nhóm. */
export type CategoryTone = "purple" | "teal" | "blue" | "cyan" | "sand" | "pink" | "green" | "orange" | "gray";

const VARIANT_STYLES: Record<Exclude<TagVariant, "category">, { base: string; dot: string }> = {
  done: { base: "border-success-line bg-success-surface text-success", dot: "bg-success" },
  pending: { base: "border-dashed border-warning-line bg-warning-surface text-warning", dot: "border border-warning bg-transparent" },
  warning: { base: "border-warning-line bg-warning-surface text-warning", dot: "bg-warning" },
  error: { base: "border-destructive-line bg-destructive-surface text-destructive", dot: "bg-destructive" },
  source: { base: "border-info-line bg-info-surface text-info", dot: "bg-info" },
  location: { base: "border-primary/30 bg-accent text-accent-foreground", dot: "bg-primary" },
  muted: { base: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

/* Liệt kê TRỌN tên lớp (không ghép chuỗi) để Tailwind quét thấy. */
const SAC: Record<CategoryTone, { base: string; dot: string }> = {
  purple: { base: "border-tone-purple-line bg-tone-purple-surface text-tone-purple", dot: "bg-tone-purple" },
  teal: { base: "border-tone-teal-line bg-tone-teal-surface text-tone-teal", dot: "bg-tone-teal" },
  blue: { base: "border-tone-blue-line bg-tone-blue-surface text-tone-blue", dot: "bg-tone-blue" },
  cyan: { base: "border-tone-cyan-line bg-tone-cyan-surface text-tone-cyan", dot: "bg-tone-cyan" },
  sand: { base: "border-tone-sand-line bg-tone-sand-surface text-tone-sand", dot: "bg-tone-sand" },
  pink: { base: "border-tone-pink-line bg-tone-pink-surface text-tone-pink", dot: "bg-tone-pink" },
  green: { base: "border-tone-green-line bg-tone-green-surface text-tone-green", dot: "bg-tone-green" },
  orange: { base: "border-tone-orange-line bg-tone-orange-surface text-tone-orange", dot: "bg-tone-orange" },
  gray: { base: "border-tone-gray-line bg-tone-gray-surface text-tone-gray", dot: "bg-tone-gray" },
};

/**
 * Tag — chip nhãn một dòng. Luôn có CHỮ + chấm (hoặc icon): màu không bao giờ là
 * tín hiệu duy nhất. `className` chỉ để căn chỉnh bố cục (margin…), KHÔNG đè màu/cỡ.
 */
export function Tag({
  variant,
  tone: sac = "gray",
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
  const k = variant === "category" ? SAC[sac] : VARIANT_STYLES[variant];
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
export function channelTone(channel: string | null | undefined): CategoryTone {
  const k = (channel ?? "").toLowerCase();
  if (k.includes("xuất") || k === "xk") return "purple";
  if (k.includes("nội") || k === "nđ" || k === "nd") return "teal";
  return "gray";
}

/** Nhóm nguyên liệu cân đối: Thủy sản biển · Xả đông băng · Bột phụ gia cát · Giảm hồng. */
export function toneForMaterialGroup(group: string | null | undefined): CategoryTone {
  const k = (group ?? "").toLowerCase();
  if (k.includes("giảm")) return "pink";
  if (k.includes("xả")) return "cyan";
  if (k.includes("bột")) return "sand";
  if (k.includes("thủy") || k.includes("thuỷ")) return "blue";
  return "gray";
}

/** Phân xưởng: Đông biển · Cá ngọc · Khô cam; kho lớn / khác → xám. */
export function toneForWorkshop(workshop: string | null | undefined): CategoryTone {
  /* Tách TỪ theo chữ Unicode — `\b` của regex JS không coi "đ", "á", "ô" là chữ cái
     nên /\bđông\b/ không bao giờ khớp "Xưởng Đông". */
  const fromDate = (workshop ?? "").toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}]+/u);
  if (fromDate.includes("đông")) return "blue";
  if (fromDate.includes("cá")) return "teal";
  if (fromDate.includes("khô")) return "orange";
  return "gray";
}

const SAC_XOAY: CategoryTone[] = ["blue", "purple", "teal", "orange", "pink", "green", "cyan", "sand"];

/**
 * Sắc ổn định theo TÊN cho phân loại mở (kho, nhóm thành phẩm, vai trò, ca, dây
 * chuyền…): cùng tên ⇒ cùng màu ở mọi màn. Băm tên đã chuẩn hoá (bỏ hoa/thường,
 * khoảng trắng thừa).
 */
export function toneByName(name: string | null | undefined): CategoryTone {
  const k = (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!k) return "gray";
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return SAC_XOAY[h % SAC_XOAY.length];
}
