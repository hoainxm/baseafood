// ============================================================
// Tên file: src/lib/ocr.ts
// Tên tiếng Việt: Nhận diện chữ trên ảnh phiếu nhập (OCR) — QĐ-1
// Description: Client-side OCR (Tesseract) + parser gợi ý điền form
// ============================================================

import { hasCloudOcr, mergeCloudResult, requestCloudOcr } from "./ocrCloud";

/**
 * OCR chụp phiếu tay → GỢI Ý điền ô ở màn Nhập hàng. Chạy THẲNG trong trình duyệt
 * bằng Tesseract (nạp động, không bundle vào gói đầu; không cần key/dịch vụ mới).
 *
 * ⚠️ Chữ VIẾT TAY nhận chưa chuẩn — kết quả là **bản nháp để người soát lại**,
 * không tin tuyệt đối. Chuẩn hơn với phiếu in/đánh máy. Bộ máy nhận diện tách sau
 * hàm `runTesseract`; từ 2026-10-14 có thêm bộ đọc OpenAI qua Edge Function
 * (`lib/ocrCloud.ts`) chạy TRƯỚC, hỏng thì quay về Tesseract — phần parser (`parseOcrText`) giữ nguyên.
 */

/** OCR client-side luôn có (Tesseract nạp động). Cờ để màn quyết định hiện nút. */
export const coOcr = true;

/** Một dòng loại hàng đoán được từ phiếu (loại NL + số kg cùng một hàng chữ). */
export interface DongOcr {
  materialType: string;
  kg: number;
  /** Đơn giá đ/kg nếu phiếu có ghi (chỉ bộ đọc OpenAI bóc được). */
  unitPrice?: number | null;
}

/** Kết quả nhận diện + các ứng viên đã bóc tách để tap-áp vào form. */
export interface KetQuaOcr {
  /** Toàn văn nhận diện (cho người đối chiếu khi máy đoán sai). */
  text: string;
  /** Đại lý khớp danh mục (nếu bắt được). */
  supplier?: string;
  /** Ngày hàng về yyyy-mm-dd (nếu bắt được). */
  date?: string;
  /** Các số nghi là khối lượng (kg) — đã lọc khoảng hợp lý, khử trùng. */
  kgValues: number[];
  /** Các loại NL khớp danh mục xuất hiện trong phiếu. */
  materialTypes: string[];
  /** Ghép (loại NL + kg) theo từng hàng chữ khi đoán được. */
  lines: DongOcr[];
  /** Biển số xe (viết hoa; khớp cách viết đã có trong sổ nếu trùng xe). */
  licensePlate?: string;
  /** Tài xế (khớp tên đã có trong sổ nếu trùng người). */
  driverName?: string;
  /** Xưởng ghi trên phiếu (Đông / Cá / Khô). */
  workshop?: string;
  /** Máy đã đọc: OpenAI (Edge Function) hay Tesseract trong máy. */
  engine?: "openai" | "tesseract";
  /** Có thử OpenAI mà hỏng ⇒ lý do ngắn, màn báo "đang dùng máy đọc dự phòng". */
  cloudError?: string;
}

/** Danh mục để dò khớp tên trên phiếu (tên đại lý, mã đại lý, tên loại NL). */
export interface OcrCatalog {
  /** `alias` = tên xuất hóa đơn — phiếu hay ghi tên đầy đủ thay tên tắt. */
  suppliers: { name: string; code?: string; alias?: string }[];
  materialTypes: { name: string }[];
  /** Biển số / tài xế đã từng ghi trong sổ — để máy khớp chữ tay về đúng cách viết cũ. */
  knownPlates?: string[];
  knownDrivers?: string[];
  /** Xưởng hợp lệ (danh sách cố định). */
  workshops?: string[];
}

/** Bỏ dấu tiếng Việt + hạ chữ thường để so khớp mềm (OCR hay lệch dấu). */
function stripAccents(x: string): string {
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
function parseNumber(tok: string): number | null {
  let t = tok.trim();
  if (!t) return null;
  const hasDot = t.includes(".");
  const coPhay = t.includes(",");
  if (hasDot && coPhay) t = t.replace(/\./g, "").replace(",", ".");
  else if (coPhay) t = t.replace(",", ".");
  else if (hasDot) {
    const after = t.split(".").pop() ?? "";
    if (after.length === 3) t = t.replace(/\./g, ""); // 1.234 → nghìn
  }
  const n = Number(t.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Số nghi là khối lượng: > 0 và ≤ 100 tấn (chặn năm/điện thoại/mã lọt vào). */
function isValidKg(n: number): boolean {
  return n > 0 && n <= 100000;
}

const RE_SO = /\d[\d.,]*\d|\d/g;

/** Bóc mọi số kg hợp lý trong một đoạn chữ (đã khử trùng, giữ thứ tự xuất hiện). */
function bocKg(segment: string): number[] {
  const ra: number[] = [];
  for (const m of segment.matchAll(RE_SO)) {
    const n = parseNumber(m[0]);
    if (n != null && isValidKg(n) && !ra.includes(n)) ra.push(n);
  }
  return ra;
}

const RE_DATE = /(\d{1,2})\s*[/\-.]\s*(\d{1,2})(?:\s*[/\-.]\s*(\d{2,4}))?/;

/** Bắt ngày dd/mm[/yyyy] → yyyy-mm-dd (thiếu năm thì lấy năm hiện tại). */
function extractDate(text: string): string | undefined {
  const m = text.match(RE_DATE);
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
export function parseOcrText(text: string, dm: OcrCatalog): KetQuaOcr {
  const toanVan = stripAccents(text);
  const dong = text
    .split(/\r?\n/)
    .map((d) => d.trim())
    .filter(Boolean);

  // Đại lý: tên khớp dài nhất trong toàn văn; hoặc mã đại lý = một token số riêng.
  let supplier: string | undefined;
  let supplierLen = 0;
  for (const d of dm.suppliers) {
    const ten = stripAccents(d.name);
    if (ten.length >= 3 && toanVan.includes(ten) && ten.length > supplierLen) {
      supplier = d.name;
      supplierLen = ten.length;
    }
  }
  // Mã số đại lý: CHỈ dò trên hàng chữ có nhắc "đại lý / DL / mã" — tránh trùng
  // với số cân (vd 12,5 kg lẫn thành mã "12").
  if (!supplier) {
    for (const h of dong) {
      if (!RE_DL.test(stripAccents(h))) continue;
      const soRieng = new Set(Array.from(h.matchAll(/\b\d{1,6}\b/g), (m) => m[0]));
      const theoMa = dm.suppliers.find((d) => d.code && soRieng.has(String(d.code)));
      if (theoMa) {
        supplier = theoMa.name;
        break;
      }
    }
  }

  // Loại NL: mọi tên danh mục xuất hiện trong toàn văn.
  const materialTypes: string[] = [];
  for (const l of dm.materialTypes) {
    const ten = stripAccents(l.name);
    if (ten.length >= 2 && toanVan.includes(ten) && !materialTypes.includes(l.name))
      materialTypes.push(l.name);
  }

  // Ghép dòng: mỗi hàng chữ có tên loại NL + số kg lớn nhất trên hàng đó.
  const dongOcr: DongOcr[] = [];
  for (const hang of dong) {
    const lineNoAccent = stripAccents(hang);
    const materialType = dm.materialTypes.find(
      (l) => stripAccents(l.name).length >= 2 && lineNoAccent.includes(stripAccents(l.name))
    );
    if (!materialType) continue;
    const kgs = bocKg(hang);
    if (!kgs.length) continue;
    const kg = Math.max(...kgs);
    if (!dongOcr.some((x) => x.materialType === materialType.name && x.kg === kg))
      dongOcr.push({ materialType: materialType.name, kg });
  }

  return {
    text,
    supplier,
    date: extractDate(text),
    // Bỏ cụm ngày khỏi số tham khảo cho đỡ nhiễu (2/9/2026 không phải kg).
    kgValues: bocKg(text.replace(RE_DATE, " ")),
    materialTypes,
    lines: dongOcr,
  };
}

/** Bộ máy nhận diện (chỉ chỗ này phụ thuộc Tesseract — cloud sau thay đúng đây). */
async function runTesseract(
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<string> {
  const { recognize } = await import("tesseract.js");
  const { data } = await recognize(file, "vie", {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === "recognizing text" && typeof m.progress === "number")
        onProgress?.(Math.round(m.progress * 100));
    },
  });
  return data.text ?? "";
}

/**
 * Nhận diện một ảnh phiếu → ứng viên điền form. `onTienDo` báo % lúc nhận chữ để
 * hiện thanh tiến trình. Lỗi (mất mạng tải model, ảnh hỏng) ném ra để màn báo.
 */
export async function recognizeImportSlip(
  file: File | Blob,
  dm: OcrCatalog,
  onProgress?: (percent: number) => void
): Promise<KetQuaOcr> {
  // OpenAI qua Edge Function trước (đọc chữ tay tốt hơn); hỏng thì Tesseract trong máy.
  let cloudError: string | undefined;
  if (hasCloudOcr) {
    try {
      const raw = await requestCloudOcr(file, dm);
      return { ...mergeCloudResult(raw, parseOcrText(String(raw.text), dm), dm), engine: "openai" };
    } catch (e) {
      cloudError = e instanceof Error ? e.message : String(e);
    }
  }
  const text = await runTesseract(file, onProgress);
  return { ...parseOcrText(text, dm), engine: "tesseract", cloudError };
}
