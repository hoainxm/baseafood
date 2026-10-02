// ============================================================
// Tên file: src/design-system/patterns/bieuThucSo.ts
// Tên tiếng Việt: Đọc số + tính biểu thức kiểu Excel cho MỌI ô nhập số
// Hàm THUẦN (không React) — test ở bieuThucSo.test.ts.
// ============================================================

/** "1.234,5" | "1234.5" | "1 234,5" → 1234.5 ; rỗng/không hợp lệ → null */
export function parseSo(raw: string): number | null {
  const s = raw.replace(/[\s.]/g, "").replace(",", ".").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 1234.5 → "1.234,5" (vi-VN) */
export function dinhDangSo(n: number | null): string {
  if (n == null) return "";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

/**
 * Chuẩn hoá chuỗi người gõ về dạng máy tính được:
 *  - bỏ dấu "=" đầu (thói quen Excel: "=250+300")
 *  - "x" "X" "×" → "*" ; "÷" ":" → "/" (gõ trên điện thoại / theo thói quen giấy)
 *  - số vi-VN: "." phân nghìn (bỏ), "," thập phân (→ ".")
 */
function chuanHoa(raw: string): string {
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
export function laBieuThuc(raw: string): boolean {
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
function danhGia(s: string): number | null {
  let i = 0;
  const xem = () => s[i];

  function bieuThuc(): number | null {
    let v = hang();
    if (v == null) return null;
    while (xem() === "+" || xem() === "-") {
      const op = s[i++];
      const r = hang();
      if (r == null) return null;
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function hang(): number | null {
    let v = thua();
    if (v == null) return null;
    while (xem() === "*" || xem() === "/") {
      const op = s[i++];
      const r = thua();
      if (r == null) return null;
      if (op === "/" && r === 0) return null; // chia 0
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function thua(): number | null {
    let v = coSo();
    if (v == null) return null;
    while (xem() === "%") {
      i++;
      v = v / 100;
    }
    return v;
  }
  function coSo(): number | null {
    if (xem() === "+") {
      i++;
      return coSo();
    }
    if (xem() === "-") {
      i++;
      const v = coSo();
      return v == null ? null : -v;
    }
    if (xem() === "(") {
      i++;
      const v = bieuThuc();
      if (xem() !== ")") return null;
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

  const kq = bieuThuc();
  return i === s.length && kq != null && Number.isFinite(kq) ? kq : null;
}

/**
 * "1+2" → 3 · "=1.000+250" → 1250 · "250,5*2" → 501 · "(3+4)x2" → 14 · "1000*5%" → 50.
 * Trả null nếu KHÔNG phải biểu thức hợp lệ ⇒ nơi gọi rơi về `parseSo`.
 */
export function tinhBieuThuc(raw: string): number | null {
  if (!laBieuThuc(raw)) return null;
  const s = chuanHoa(raw);
  if (!s) return null;
  if (!/^[-+*/%().\d]+$/.test(s)) return null; // lẫn ký tự lạ ⇒ không tính
  const kq = danhGia(s);
  // Làm tròn nhiễu dấu phẩy động (0,1+0,2 = 0,30000000000000004) về 6 chữ số lẻ.
  return kq == null ? null : Math.round(kq * 1e6) / 1e6;
}

/**
 * Ô số hiểu cả biểu thức: gõ "250+300" (hay "=250+300") ra 550. Là biểu thức thì
 * tính; còn lại rơi về `parseSo` (số thường). Biểu thức dở/sai ⇒ null.
 */
export function parseSoHoacBieuThuc(raw: string): number | null {
  if (laBieuThuc(raw)) return tinhBieuThuc(raw);
  return parseSo(raw);
}
