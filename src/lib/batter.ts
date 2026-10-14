// ============================================================
// Tên file: src/lib/batter.ts
// Tên tiếng Việt: Bột tẩm — danh mục loại bột, bột đi kèm mặt hàng, lượng bột theo loại
// Description: Pure helpers for batter types (migration 0051) — no React, unit-testable.
// ============================================================
// Mô hình (chốt 2026-10-06): mỗi mặt hàng TẨM BỘT đi kèm một BỘ loại bột riêng
// (VD tẩm bột nước tương = 24V + 18V + 220H; tẩm bột 5-10 = 232 + 20802), khi ghi
// thành phẩm nhập kg cho TỪNG loại. Bột là phụ gia (Khối 1 "Bột phụ gia" ở Cân
// đối) — KHÔNG cộng vào kg thành phẩm.
//   - mặt hàng giữ `batterIds` (id loại bột — đổi tên bột không đứt cấu hình)
//   - dòng sản lượng giữ `batterKg` = { "<tên loại bột>": kg } (sổ lưu TÊN lúc ghi)
import type { BatterType, Product } from "@/types";
import { newId as uid } from "@/lib/store";

/** Loại bột đang thấy trên sổ — id tất định, KHỚP seed của migration 0051. */
export const BATTER_TYPE_SEED: BatterType[] = [
  { id: "bot-24v", code: "24V", name: "Bột 24V", note: "Bột tẩm nước tương" },
  { id: "bot-18v", code: "18V", name: "Bột 18V", note: "Bột tẩm nước tương" },
  { id: "bot-220h", code: "220H", name: "Bột 220H", note: "Bột tẩm nước tương" },
  { id: "bot-232", code: "232", name: "Bột 232", note: "Bột tẩm 5-10" },
  { id: "bot-20802", code: "20802", name: "Bột 20802", note: "Bột tẩm 5-10" },
  { id: "bot-22601", code: "22601", name: "Bột 22601", note: "" },
  { id: "bot-27102", code: "27102", name: "Bột 27102", note: "" },
  { id: "bot-2204", code: "2204", name: "Bột 2204", note: "" },
];

/**
 * Id bột đi kèm của mặt hàng. Nhận cả mảng (từ DB) lẫn chuỗi "id1,id2" (form
 * danh mục CRUD lưu chuỗi). Bỏ trống, bỏ trùng, giữ thứ tự gắn.
 */
export function getProductBatterIds(p: Pick<Product, "batterIds"> | undefined): string[] {
  const v = p?.batterIds;
  const xs = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  return [...new Set(xs.map((x) => String(x).trim()).filter(Boolean))];
}

/** TÊN bột đi kèm theo đúng thứ tự gắn — bỏ id không còn trong danh mục. */
export function getProductBatterNames(
  p: Pick<Product, "batterIds"> | undefined,
  batterTypes: BatterType[]
): string[] {
  const theoId = new Map(batterTypes.map((b) => [b.id, b.name.trim()]));
  return getProductBatterIds(p)
    .map((id) => theoId.get(id) ?? "")
    .filter(Boolean);
}

/**
 * Mặt hàng TẨM BỘT — đã gắn bột đi kèm, HOẶC kiểu chế biến / tên có "bột". Dùng
 * để tự mở khối nhập bột ở màn ghi thành phẩm kể cả khi mã chưa gắn bột đi kèm.
 */
export function isBatteredProduct(
  p: Pick<Product, "batterIds" | "processingType" | "name"> | undefined
): boolean {
  if (!p) return false;
  return (
    getProductBatterIds(p).length > 0 ||
    /bột/i.test(p.processingType ?? "") ||
    /tẩm bột/i.test(p.name ?? "")
  );
}

/**
 * Suy bột đi kèm TỪ TÊN mặt hàng — CHỈ hai nhóm đã chốt với chủ dự án; không rõ
 * thì để trống (gắn tay ở Danh mục hoặc tự nhớ khi ghi lần đầu ở /wip). Khớp luật
 * nạp của migration 0051 (bản đã deploy).
 */
export function inferBattersFromName(ten: string): string[] {
  const t = ten.toLowerCase();
  if (t.includes("tẩm bột nước tương")) return ["bot-24v", "bot-18v", "bot-220h"];
  if (/tẩm bột 5 ?- ?10( |$)/.test(t)) return ["bot-232", "bot-20802"];
  return [];
}

/**
 * Đọc + làm sạch bản đồ lượng bột `{ tên: kg }` (jsonb từ máy chủ là object, bản
 * sao localStorage có thể là chuỗi JSON). Trim tên, gộp trùng tên, bỏ ô ≤ 0 hoặc
 * không phải số — một ô hỏng không làm tổng thành NaN.
 */
export function sanitizeBatterKg(v: unknown): Record<string, number> {
  let raw: unknown = v;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const ra: Record<string, number> = {};
  for (const [ten0, so] of Object.entries(raw as Record<string, unknown>)) {
    const ten = ten0.trim();
    const kg = Number(so);
    if (!ten || !Number.isFinite(kg) || kg <= 0) continue;
    ra[ten] = (ra[ten] ?? 0) + kg;
  }
  return ra;
}

/** Tổng kg bột của một dòng. */
export function sumBatterKg(m: Record<string, number> | undefined): number {
  return Object.values(sanitizeBatterKg(m)).reduce((s, v) => s + v, 0);
}

/** Tỷ lệ bột trên thành phẩm (%) — null khi chưa có thành phẩm (không chia cho 0). */
export function computeBatterRatio(kgBot: number, finishedGoodKg: number): number | null {
  return finishedGoodKg > 0 && kgBot > 0 ? (kgBot / finishedGoodKg) * 100 : null;
}

/** Cộng dồn bột của nhiều dòng theo loại — kg + số dòng dùng; nhiều kg đứng trước. */
export function sumBatterByType(
  items: (Record<string, number> | undefined)[]
): { name: string; kg: number; rowCount: number }[] {
  const m = new Map<string, { name: string; kg: number; rowCount: number }>();
  for (const d of items)
    for (const [ten, kg] of Object.entries(sanitizeBatterKg(d))) {
      const cur = m.get(ten) ?? { name: ten, kg: 0, rowCount: 0 };
      cur.kg += kg;
      cur.rowCount += 1;
      m.set(ten, cur);
    }
  return [...m.values()].sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name, "vi"));
}

/** Nhãn ngắn trong ô hẹp: bỏ tiền tố "Bột " — "Bột 24V" → "24V". */
export function toShortBatterLabel(ten: string): string {
  return ten.replace(/^bột\s+/i, "").trim() || ten;
}

/**
 * Loại bột HIỆN ô nhập trên một dòng: bột đi kèm của mặt hàng trước (đúng thứ tự
 * gắn), rồi loại đã nhập thêm tại chỗ. Giữ cả loại đang để trống để ô không biến
 * mất khi người dùng xoá số.
 */
export function listVisibleBatters(diKem: string[], botKg: Record<string, number>): string[] {
  const ra = [...diKem];
  for (const ten of Object.keys(botKg)) if (!ra.includes(ten)) ra.push(ten);
  return ra;
}

/**
 * Tạo loại bột mới tại chỗ (ô "Bột đi kèm" / dòng ghi thành phẩm). Gõ trùng TÊN,
 * trùng MÃ, hay trùng tên ngắn ("20802" ≡ "Bột 20802") với loại đã có ⇒ dùng lại
 * loại đó, không đẻ bản trùng. Gõ mã trơn ("25X") ⇒ tạo "Bột 25X", mã "25X" — cho
 * cùng lối đặt tên với danh mục. Trả về bản ghi (mới hoặc có sẵn) + danh sách sau khi thêm.
 */
export function findOrCreateBatter(
  rows: BatterType[],
  ten: string
): { batter: BatterType; rows: BatterType[]; isNew: boolean } {
  const trimmedName = ten.trim();
  const labelKey = toShortBatterLabel(trimmedName).toLowerCase();
  const co = rows.find(
    (b) =>
      toShortBatterLabel(b.name.trim()).toLowerCase() === labelKey ||
      (b.code.trim() !== "" && b.code.trim().toLowerCase() === labelKey)
  );
  if (co) return { batter: co, rows, isNew: false };
  const hasPrefix = /^bột\s/i.test(trimmedName);
  const bot: BatterType = {
    id: uid(),
    code: hasPrefix ? "" : trimmedName,
    name: hasPrefix ? trimmedName : `Bột ${trimmedName}`,
    note: "",
  };
  return { batter: bot, rows: [...rows, bot], isNew: true };
}
