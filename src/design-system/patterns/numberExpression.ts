// ============================================================
// Tên file: src/design-system/patterns/numberExpression.ts
// Tên tiếng Việt: Đọc số + tính biểu thức kiểu Excel cho MỌI ô nhập số
// Hàm THUẦN (không React) — test ở numberExpression.test.ts.
// ============================================================

/**
 * "1.234,5" | "1234.5" | "1 234,5" → 1234.5 ; rỗng/không hợp lệ → null.
 * Hiểu cả số chép từ chứng từ tiếng Anh (HĐ / invoice xuất khẩu):
 *  - có CẢ "." lẫn "," ⇒ dấu đứng sau cùng là phần lẻ ("194,557.60" → 194557,6 · "1.234,5" → 1234,5);
 *  - chỉ có "." ⇒ đúng nhóm nghìn kiểu Việt ("1.234", "1.234.567") thì là phân nghìn, còn lại
 *    ("10.50", "4.05", "1234.5") là phần lẻ — trước đây "10.50" bị đọc thành 1.050;
 *  - chỉ có "," ⇒ phần lẻ kiểu Việt như cũ ("2,5" → 2,5).
 */
export function parseVnNumber(raw: string): number | null {
  const t = raw.replace(/\s/g, "");
  if (!t) return null;
  const hasDot = t.includes(".");
  const hasComma = t.includes(",");
  let s: string;
  if (hasDot && hasComma) s = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else if (hasDot) s = /^[-+]?\d{1,3}(\.\d{3})+$/.test(t) || t.split(".").length > 2 ? t.replace(/\./g, "") : t;
  else s = t.replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 1234.5 → "1.234,5" (vi-VN) */
export function formatNumber(n: number | null): string {
  if (n == null) return "";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

/**
 * Chuẩn hoá chuỗi người gõ về dạng máy tính được:
 *  - bỏ dấu "=" đầu (thói quen Excel: "=250+300")
 *  - "x" "X" "×" → "*" ; "÷" ":" → "/" (gõ trên điện thoại / theo thói quen giấy)
 *  - số vi-VN: "." phân nghìn (bỏ), "," thập phân (→ ".")
 */
function normalize(raw: string): string {
  return raw
    .replace(/\s/g, "")
    .replace(/^=/, "")
    .replace(/[xX×]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/\./g, "")
    .replace(/,/g, ".");
}

/**
 * Người dùng đang gõ BIỂU THỨC (không phải số thường)? Có "=" đầu, hoặc có toán
 * tử ngoài dấu đầu ("-5" vẫn là số thường). Dùng để quyết định có hiện ô xem
 * trước kết quả hay không — kể cả khi biểu thức còn dở ("250+").
 */
export function isExpression(raw: string): boolean {
  const t = raw.trim();
  if (t.startsWith("=")) return true;
  return /[+\-*/xX×÷:%()]/.test(t.replace(/\s/g, "").slice(1));
}

/**
 * Tính biểu thức trên chuỗi ĐÃ chuẩn hoá (chỉ còn số + toán tử + - * / %, ngoặc).
 * Đệ quy giảm dần, tôn trọng ưu tiên nhân/chia và ngoặc. "%" hậu tố = chia 100
 * ("1000*5%" = 50). KHÔNG dùng `eval`/`Function` — tự tách token nên an toàn với
 * chuỗi bất kỳ. Trả null khi không hợp lệ (thừa ký tự, chia 0, ngoặc lệch).
 */
function evaluate(s: string): number | null {
  let i = 0;
  const peek = () => s[i];

  function expression(): number | null {
    let v = term();
    if (v == null) return null;
    while (peek() === "+" || peek() === "-") {
      const op = s[i++];
      const r = term();
      if (r == null) return null;
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function term(): number | null {
    let v = factor();
    if (v == null) return null;
    while (peek() === "*" || peek() === "/") {
      const op = s[i++];
      const r = factor();
      if (r == null) return null;
      if (op === "/" && r === 0) return null; // chia 0
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function factor(): number | null {
    let v = parsePrimary();
    if (v == null) return null;
    while (peek() === "%") {
      i++;
      v = v / 100;
    }
    return v;
  }
  function parsePrimary(): number | null {
    if (peek() === "+") {
      i++;
      return parsePrimary();
    }
    if (peek() === "-") {
      i++;
      const v = parsePrimary();
      return v == null ? null : -v;
    }
    if (peek() === "(") {
      i++;
      const v = expression();
      if (peek() !== ")") return null;
      i++;
      return v;
    }
    let j = i;
    while (j < s.length && /[0-9.]/.test(s[j])) j++;
    if (j === i) return null;
    const num = Number(s.slice(i, j));
    i = j;
    return Number.isFinite(num) ? num : null;
  }

  const result = expression();
  return i === s.length && result != null && Number.isFinite(result) ? result : null;
}

/**
 * "1+2" → 3 · "=1.000+250" → 1250 · "250,5*2" → 501 · "(3+4)x2" → 14 · "1000*5%" → 50.
 * Trả null nếu KHÔNG phải biểu thức hợp lệ ⇒ nơi gọi rơi về `parseVnNumber`.
 */
export function evaluateExpression(raw: string): number | null {
  if (!isExpression(raw)) return null;
  const s = normalize(raw);
  if (!s) return null;
  if (!/^[-+*/%().\d]+$/.test(s)) return null; // lẫn ký tự lạ ⇒ không tính
  const result = evaluate(s);
  // Làm tròn nhiễu dấu phẩy động (0,1+0,2 = 0,30000000000000004) về 6 chữ số lẻ.
  return result == null ? null : Math.round(result * 1e6) / 1e6;
}

/**
 * Ô số hiểu cả biểu thức: gõ "250+300" (hay "=250+300") ra 550. Là biểu thức thì
 * tính; còn lại rơi về `parseVnNumber` (số thường). Biểu thức dở/sai ⇒ null.
 */
export function parseNumberOrExpression(raw: string): number | null {
  if (isExpression(raw)) return evaluateExpression(raw);
  return parseVnNumber(raw);
}
