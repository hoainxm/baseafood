// ============================================================
// Tên file: src/lib/abbreviations.ts
// Tên tiếng Việt: Bảng chú thích từ viết tắt (xuất khẩu, logistics, chứng từ)
// Description: Glossary of abbreviations shown as hover / tap hints next to labels and headers
// ============================================================
// Nút "?" cạnh nhãn (design-system AbbrHint) và chữ gạch chấm (Abbr) đọc bảng này. Chỉ gom từ
// viết tắt NGOẠI THƯƠNG mà người mới không đoán được — "HĐ", "BGĐ" ai cũng biết, gắn "?" khắp
// nơi chỉ làm rối mắt.

export interface Abbreviation {
  /** Đúng chữ viết tắt như trên màn (phân biệt hoa thường). */
  term: string;
  /** Chữ đầy đủ (thường tiếng Anh). */
  full: string;
  /** Giải thích tiếng Việt, một câu. */
  meaning: string;
}

export const ABBREVIATIONS: readonly Abbreviation[] = [
  { term: "ETD", full: "Estimated Time of Departure", meaning: "ngày tàu dự kiến rời cảng xếp hàng." },
  { term: "ETA", full: "Estimated Time of Arrival", meaning: "ngày tàu dự kiến tới cảng đích." },
  { term: "L/C", full: "Letter of Credit", meaning: "thư tín dụng — ngân hàng của khách cam kết trả tiền khi bộ chứng từ đúng điều kiện." },
  { term: "TTR", full: "Telegraphic Transfer Reimbursement", meaning: "khách chuyển khoản trả tiền (điện chuyển tiền)." },
  { term: "B/L", full: "Bill of Lading", meaning: "vận đơn đường biển do hãng tàu cấp; ngày on board trên B/L là ngày giao hàng thực tế." },
  { term: "C/O", full: "Certificate of Origin", meaning: "giấy chứng nhận xuất xứ hàng hóa (VD form VJ, form E)." },
  { term: "H/C", full: "Health Certificate", meaning: "giấy chứng nhận vệ sinh / kiểm dịch (NAFIQAD cấp hoặc công ty tự cấp)." },
  { term: "HS", full: "Harmonized System code", meaning: "mã HS — mã số hàng hóa trên tờ khai hải quan." },
  { term: "MSL", full: "Mã số lô", meaning: "mã lô sản xuất của xưởng ghi trên thùng hàng (VD 216, J012)." },
  { term: "Incoterm", full: "International Commercial Terms", meaning: "điều kiện giao hàng (FOB, CFR, CIF…) — quy định ai trả cước, bảo hiểm và rủi ro chuyển ở đâu." },
  { term: "FOB", full: "Free On Board", meaning: "giao hàng lên tàu tại cảng xếp; khách trả cước tàu và bảo hiểm." },
  { term: "CFR", full: "Cost and Freight", meaning: "xưởng trả cước tàu tới cảng đích; khách tự mua bảo hiểm." },
  { term: "CIF", full: "Cost, Insurance and Freight", meaning: "xưởng trả cước tàu và bảo hiểm tới cảng đích." },
  { term: "RF", full: "Reefer", meaning: "container lạnh (20RF, 40RF)." },
  { term: "HC", full: "High Cube", meaning: "container cao (40HC-RF: container lạnh 40 feet loại cao)." },
  { term: "rvs", full: "Revised", meaning: "bản hợp đồng sửa đổi do hai bên ký lại." },
  { term: "PL", full: "Packing List", meaning: "phiếu đóng gói — số thùng, kg tịnh / kg cả bì từng mặt hàng." },
];

const BY_TERM = new Map(ABBREVIATIONS.map((a) => [a.term, a]));

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
/** Chữ viết tắt đứng riêng (không dính chữ / số liền trước-sau, trừ "40HC" / "20RF" vẫn bắt). */
const TERM_RE = new RegExp(
  `(?<![\\p{L}/])(${[...ABBREVIATIONS].sort((a, b) => b.term.length - a.term.length).map((a) => escapeRe(a.term)).join("|")})(?![\\p{L}/])`,
  "gu",
);

/** Một dòng chú thích: "ETD (Estimated Time of Departure): ngày tàu dự kiến rời cảng xếp hàng." */
export function abbreviationText(a: Abbreviation): string {
  return `${a.term} (${a.full}): ${a.meaning}`;
}

/** Tra một chữ viết tắt. */
export function findAbbreviation(term: string): Abbreviation | undefined {
  return BY_TERM.get(term);
}

/** Mọi chữ viết tắt có trong một câu (không lặp, theo thứ tự xuất hiện). */
export function abbreviationsIn(text: string): Abbreviation[] {
  const out: Abbreviation[] = [];
  for (const m of text.matchAll(TERM_RE)) {
    const a = BY_TERM.get(m[1]);
    if (a && !out.includes(a)) out.push(a);
  }
  return out;
}

/** Câu chú thích cho một nhãn — rỗng khi nhãn không có chữ viết tắt nào trong bảng. */
export function abbreviationHint(text: string): string {
  return abbreviationsIn(text).map(abbreviationText).join("\n");
}
