// ============================================================
// Tên file: src/lib/ocr.ts
// Tên tiếng Việt: Nhận diện chữ trên ảnh phiếu nhập (OCR) — QĐ-1
// Description: Client-side OCR (Tesseract) + parser gợi ý điền form
// ============================================================

/**
 * OCR chụp phiếu tay → GỢI Ý điền ô ở màn Nhập hàng. Chạy THẲNG trong trình duyệt
 * bằng Tesseract (nạp động, không bundle vào gói đầu; không cần key/dịch vụ mới).
 *
 * ⚠️ Chữ VIẾT TAY nhận chưa chuẩn — kết quả là **bản nháp để người soát lại**,
 * không tin tuyệt đối. Chuẩn hơn với phiếu in/đánh máy. Bộ máy nhận diện tách sau
 * hàm `chayTesseract` để sau nâng cấp cloud (Google Vision qua edge function) chỉ
 * thay MỘT chỗ — phần parser (`phanTich`) giữ nguyên.
 */

/** OCR client-side luôn có (Tesseract nạp động). Cờ để màn quyết định hiện nút. */
export const coOcr = true;

/** Một dòng loại hàng đoán được từ phiếu (loại NL + số kg cùng một hàng chữ). */
export interface DongOcr {
  loaiNL: string;
  kg: number;
}

/** Kết quả nhận diện + các ứng viên đã bóc tách để tap-áp vào form. */
export interface KetQuaOcr {
  /** Toàn văn nhận diện (cho người đối chiếu khi máy đoán sai). */
  text: string;
  /** Đại lý khớp danh mục (nếu bắt được). */
  daiLy?: string;
  /** Ngày hàng về yyyy-mm-dd (nếu bắt được). */
  ngay?: string;
  /** Các số nghi là khối lượng (kg) — đã lọc khoảng hợp lý, khử trùng. */
  soKg: number[];
  /** Các loại NL khớp danh mục xuất hiện trong phiếu. */
  loaiNL: string[];
  /** Ghép (loại NL + kg) theo từng hàng chữ khi đoán được. */
  dong: DongOcr[];
}

/** Danh mục để dò khớp tên trên phiếu (tên đại lý, mã đại lý, tên loại NL). */
export interface DanhMucOcr {
  daiLy: { name: string; code?: string }[];
  loaiNL: { name: string }[];
}

/** Bỏ dấu tiếng Việt + hạ chữ thường để so khớp mềm (OCR hay lệch dấu). */
function boDau(x: string): string {
  return x
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

/**
 * Đổi một token số OCR về number. Chữ số ngăn cách kiểu VN thất thường qua OCR nên
 * đoán bảo thủ: có cả "." và "," → "." là nghìn, "," là thập phân; chỉ "," → thập
 * phân; chỉ "." với đúng 3 số sau → nghìn (bỏ), còn lại coi là thập phân.
 */
function doiSo(tok: string): number | null {
  let t = tok.trim();
  if (!t) return null;
  const coCham = t.includes(".");
  const coPhay = t.includes(",");
  if (coCham && coPhay) t = t.replace(/\./g, "").replace(",", ".");
  else if (coPhay) t = t.replace(",", ".");
  else if (coCham) {
    const sau = t.split(".").pop() ?? "";
    if (sau.length === 3) t = t.replace(/\./g, ""); // 1.234 → nghìn
  }
  const n = Number(t.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Số nghi là khối lượng: > 0 và ≤ 100 tấn (chặn năm/điện thoại/mã lọt vào). */
function laKgHopLy(n: number): boolean {
  return n > 0 && n <= 100000;
}

const RE_SO = /\d[\d.,]*\d|\d/g;

/** Bóc mọi số kg hợp lý trong một đoạn chữ (đã khử trùng, giữ thứ tự xuất hiện). */
function bocKg(doan: string): number[] {
  const ra: number[] = [];
  for (const m of doan.matchAll(RE_SO)) {
    const n = doiSo(m[0]);
    if (n != null && laKgHopLy(n) && !ra.includes(n)) ra.push(n);
  }
  return ra;
}

const RE_NGAY = /(\d{1,2})\s*[/\-.]\s*(\d{1,2})(?:\s*[/\-.]\s*(\d{2,4}))?/;

/** Bắt ngày dd/mm[/yyyy] → yyyy-mm-dd (thiếu năm thì lấy năm hiện tại). */
function bocNgay(text: string): string | undefined {
  const m = text.match(RE_NGAY);
  if (!m) return undefined;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return undefined;
  let y = m[3] ? Number(m[3]) : new Date().getFullYear();
  if (y < 100) y += 2000;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Từ khóa báo hiệu một hàng chữ đang ghi ĐẠI LÝ (để dò mã số an toàn). */
const RE_DL = /\b(dai ly|dl|ma dl|ma dai ly|khach)\b/;

/** Parser thuần: từ toàn văn OCR + danh mục → các ứng viên điền form. */
export function phanTich(text: string, dm: DanhMucOcr): KetQuaOcr {
  const toanVan = boDau(text);
  const dong = text
    .split(/\r?\n/)
    .map((d) => d.trim())
    .filter(Boolean);

  // Đại lý: tên khớp dài nhất trong toàn văn; hoặc mã đại lý = một token số riêng.
  let daiLy: string | undefined;
  let daiLen = 0;
  for (const d of dm.daiLy) {
    const ten = boDau(d.name);
    if (ten.length >= 3 && toanVan.includes(ten) && ten.length > daiLen) {
      daiLy = d.name;
      daiLen = ten.length;
    }
  }
  // Mã số đại lý: CHỈ dò trên hàng chữ có nhắc "đại lý / DL / mã" — tránh trùng
  // với số cân (vd 12,5 kg lẫn thành mã "12").
  if (!daiLy) {
    for (const h of dong) {
      if (!RE_DL.test(boDau(h))) continue;
      const soRieng = new Set(Array.from(h.matchAll(/\b\d{1,6}\b/g), (m) => m[0]));
      const theoMa = dm.daiLy.find((d) => d.code && soRieng.has(String(d.code)));
      if (theoMa) {
        daiLy = theoMa.name;
        break;
      }
    }
  }

  // Loại NL: mọi tên danh mục xuất hiện trong toàn văn.
  const loaiNL: string[] = [];
  for (const l of dm.loaiNL) {
    const ten = boDau(l.name);
    if (ten.length >= 2 && toanVan.includes(ten) && !loaiNL.includes(l.name))
      loaiNL.push(l.name);
  }

  // Ghép dòng: mỗi hàng chữ có tên loại NL + số kg lớn nhất trên hàng đó.
  const dongOcr: DongOcr[] = [];
  for (const hang of dong) {
    const hangKhongDau = boDau(hang);
    const loai = dm.loaiNL.find(
      (l) => boDau(l.name).length >= 2 && hangKhongDau.includes(boDau(l.name))
    );
    if (!loai) continue;
    const kgs = bocKg(hang);
    if (!kgs.length) continue;
    const kg = Math.max(...kgs);
    if (!dongOcr.some((x) => x.loaiNL === loai.name && x.kg === kg))
      dongOcr.push({ loaiNL: loai.name, kg });
  }

  return {
    text,
    daiLy,
    ngay: bocNgay(text),
    // Bỏ cụm ngày khỏi số tham khảo cho đỡ nhiễu (2/9/2026 không phải kg).
    soKg: bocKg(text.replace(RE_NGAY, " ")),
    loaiNL,
    dong: dongOcr,
  };
}

/** Bộ máy nhận diện (chỉ chỗ này phụ thuộc Tesseract — cloud sau thay đúng đây). */
async function chayTesseract(
  file: File | Blob,
  onTienDo?: (phanTram: number) => void
): Promise<string> {
  const { recognize } = await import("tesseract.js");
  const { data } = await recognize(file, "vie", {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === "recognizing text" && typeof m.progress === "number")
        onTienDo?.(Math.round(m.progress * 100));
    },
  });
  return data.text ?? "";
}

/**
 * Nhận diện một ảnh phiếu → ứng viên điền form. `onTienDo` báo % lúc nhận chữ để
 * hiện thanh tiến trình. Lỗi (mất mạng tải model, ảnh hỏng) ném ra để màn báo.
 */
export async function nhanDienPhieu(
  file: File | Blob,
  dm: DanhMucOcr,
  onTienDo?: (phanTram: number) => void
): Promise<KetQuaOcr> {
  const text = await chayTesseract(file, onTienDo);
  return phanTich(text, dm);
}
