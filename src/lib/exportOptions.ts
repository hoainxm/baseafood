// ============================================================
// Tên file: src/lib/exportOptions.ts
// Tên tiếng Việt tương đương: Danh sách chọn của Xuất khẩu (cảng xếp · cảng đích · loại container · tiền tệ)
// Description: Pure helpers for the export option lists (mig 0095, ba-spec 62)
// ============================================================
// HĐ / chuyến LƯU CHỮ của tùy chọn (Q5) ⇒ xóa / đổi tên tùy chọn không đụng sổ đã ghi. Giá trị cũ gõ tay
// không khớp mục nào vẫn hiện, đánh dấu "ngoài danh sách" (Q6).
import type { ExportOption, ExportOptionListKind } from "@/types";

export interface ExportOptionListMeta {
  kind: ExportOptionListKind;
  /** Tên danh sách — tab Danh mục, hộp sửa nhanh. */
  title: string;
  /** Tên một mục, viết thường — "Đã thêm cảng đích …". */
  entityName: string;
  description: string;
  example: string;
}

export const EXPORT_OPTION_LISTS: readonly ExportOptionListMeta[] = [
  {
    kind: "loading-port",
    title: "Cảng xếp",
    entityName: "cảng xếp",
    description: "Cảng xếp hàng của hợp đồng xuất. Hợp đồng ghi cả hai cảng thì thêm một mục riêng (VD \"Cát Lái / Cái Mép\").",
    example: "VD: Cái Mép",
  },
  {
    kind: "discharge-port",
    title: "Cảng đích",
    entityName: "cảng đích",
    description: "Cảng đích của hợp đồng và của từng chuyến. Viết theo kiểu \"Thành phố, Quốc gia\" cho thống nhất.",
    example: "VD: Tokyo, Japan",
  },
  {
    kind: "container-type",
    title: "Loại container",
    entityName: "loại container",
    description: "Loại container trên hợp đồng. Có \"HC\" ⇒ chuyến gợi ý 40HC-RF, có \"20\" ⇒ 20RF, còn lại 40RF.",
    example: "VD: 40RF",
  },
  {
    kind: "currency",
    title: "Tiền tệ",
    entityName: "tiền tệ",
    description: "Tiền tệ của hợp đồng (đơn giá, tiền dòng hàng, tiền về). Ghi mã 3 chữ.",
    example: "VD: USD",
  },
];

export const exportOptionListMeta = (kind: ExportOptionListKind): ExportOptionListMeta =>
  EXPORT_OPTION_LISTS.find((l) => l.kind === kind) ?? EXPORT_OPTION_LISTS[0];

const seed = (kind: ExportOptionListKind, slug: string, name: string, sortOrder: number): ExportOption => ({
  id: `${kind}-${slug}`,
  listKind: kind,
  name,
  sortOrder,
  note: "",
});

/** Danh sách khởi tạo — TRÙNG migration 0095 (cùng id). Dùng khi máy chủ chưa chạy 0095 / chưa có mục nào. */
export const EXPORT_OPTION_SEED: readonly ExportOption[] = [
  seed("loading-port", "cai-mep", "Cái Mép", 10),
  seed("loading-port", "cat-lai", "Cát Lái", 20),
  seed("discharge-port", "tokyo", "Tokyo, Japan", 10),
  seed("discharge-port", "hakata", "Hakata, Japan", 20),
  seed("discharge-port", "nagoya", "Nagoya, Japan", 30),
  seed("discharge-port", "xiamen", "Xiamen, China", 40),
  seed("discharge-port", "penang", "Penang, Malaysia", 50),
  seed("discharge-port", "los-angeles", "Los Angeles, USA", 60),
  seed("discharge-port", "baltimore", "Baltimore, USA", 70),
  seed("discharge-port", "charleston", "Charleston, USA", 80),
  seed("discharge-port", "moji", "Moji, Japan", 90),
  seed("discharge-port", "kobe", "Kobe, Japan", 100),
  seed("discharge-port", "osaka", "Osaka, Japan", 110),
  seed("container-type", "20rf", "20RF", 10),
  seed("container-type", "40rf", "40RF", 20),
  seed("container-type", "40hc-rf", "40HC-RF", 30),
  seed("currency", "usd", "USD", 10),
  seed("currency", "jpy", "JPY", 20),
  seed("currency", "eur", "EUR", 30),
];

/** So khớp tên: không phân hoa thường, gộp khoảng trắng. Có dấu và không dấu là HAI tên. */
export const optionKey = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();
const tidy = (v: string) => v.trim().replace(/\s+/g, " ");

/**
 * Bảng mà màn dùng: chưa chạy 0095 hoặc chưa có mục nào ⇒ danh sách khởi tạo (ghi lần đầu sẽ lưu cả
 * danh sách khởi tạo, cùng id với migration nên không nhân đôi).
 */
export function effectiveExportOptions(rows: readonly ExportOption[], isAvailable: boolean): ExportOption[] {
  return !isAvailable || rows.length === 0 ? [...EXPORT_OPTION_SEED] : [...rows];
}

/** Mục của một danh sách, theo `sortOrder` rồi tên. */
export function exportOptionsOf(rows: readonly ExportOption[], kind: ExportOptionListKind): ExportOption[] {
  return rows
    .filter((r) => r.listKind === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi"));
}

/** Giá trị đang ghi không khớp mục nào của danh sách (trống ⇒ không tính). */
export function isOutsideList(value: string, rows: readonly ExportOption[], kind: ExportOptionListKind): boolean {
  if (!value.trim()) return false;
  const k = optionKey(value);
  return !rows.some((r) => r.listKind === kind && optionKey(r.name) === k);
}

/** Thêm ngay trong ô: trùng tên trong CÙNG danh sách ⇒ dùng lại mục có sẵn; mới ⇒ xếp cuối danh sách đó. */
export function findOrCreateExportOption(
  name: string,
  kind: ExportOptionListKind,
  rows: readonly ExportOption[],
  newId: () => string,
): { option: ExportOption; rows: ExportOption[]; created: boolean } {
  const k = optionKey(name);
  const existing = rows.find((r) => r.listKind === kind && optionKey(r.name) === k);
  if (existing) return { option: existing, rows: [...rows], created: false };
  const sortOrder = Math.max(0, ...rows.filter((r) => r.listKind === kind).map((r) => r.sortOrder)) + 10;
  const option: ExportOption = { id: `${kind}-${newId()}`, listKind: kind, name: tidy(name), sortOrder, note: "" };
  return { option, rows: [...rows, option], created: true };
}

/**
 * Ghép lại cả bảng sau khi sửa MỘT danh sách (tab Danh mục / hộp sửa nhanh chỉ thấy mục của danh sách đó).
 * Mục mới chưa có thứ tự ⇒ xếp cuối danh sách.
 */
export function replaceExportOptionList(
  all: readonly ExportOption[],
  kind: ExportOptionListKind,
  next: readonly ExportOption[],
): ExportOption[] {
  let max = Math.max(0, ...next.map((r) => r.sortOrder));
  const fixed = next.map((r) => ({ ...r, listKind: kind, sortOrder: r.sortOrder || (max += 10) }));
  return [...all.filter((r) => r.listKind !== kind), ...fixed];
}

/** Option cho ô chọn: giá trị = CHỮ của mục. Giá trị đang ghi nằm ngoài danh sách ⇒ thêm một mục đầu đánh dấu. */
export function exportOptionChoices(
  rows: readonly ExportOption[],
  kind: ExportOptionListKind,
  currentValue = "",
): { value: string; label: string; subLabel?: string }[] {
  const list = exportOptionsOf(rows, kind).map((r) => ({ value: r.name, label: r.name, subLabel: r.note.trim() || undefined }));
  return isOutsideList(currentValue, rows, kind)
    ? [{ value: currentValue, label: currentValue, subLabel: "Ngoài danh sách — chọn lại mục trong danh sách cho thống nhất" }, ...list]
    : list;
}

/** Tên đã ghi khớp mục danh sách (khác hoa thường) ⇒ trả đúng chữ của mục, để ô chọn hiện là đã chọn. */
export function matchExportOption(value: string, rows: readonly ExportOption[], kind: ExportOptionListKind): string {
  const k = optionKey(value);
  if (!k) return value;
  return rows.find((r) => r.listKind === kind && optionKey(r.name) === k)?.name ?? value;
}
