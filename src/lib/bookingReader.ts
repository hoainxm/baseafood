// ============================================================
// Tên file: src/lib/bookingReader.ts
// Tên tiếng Việt: Đọc file booking của hãng tàu ra các trường của chuyến xuất
// Description: Pure parser for carrier booking notices (ba-spec 71 R3) + browser loader (PDF via pdf.js,
//              lazy). Reads label/value pairs ("Port of Loading : CAI MEP") from text rows; never writes.
// ============================================================
// Mẫu đầu tiên: Booking Receipt Notice của ONE. Hãng khác cùng kiểu nhãn tiếng Anh "Nhãn : giá trị" ⇒ đọc
// được phần trùng nhãn; nhãn lạ thì ô để trống, người dùng gõ tay (đọc xong luôn cho soát trước khi lưu).
import type { ExportShipmentKind } from "@/types";

export interface BookingRead {
  bookingNo: string;
  forwarder: string;
  vesselVoyage: string;
  placeOfReceipt: string;
  portOfLoading: string;
  portOfDischarge: string;
  placeOfDelivery: string;
  /** Chữ loại cont in trên booking ("20'REEFER-1"). */
  equipment: string;
  /** Loại chuyến đoán từ `equipment`; "" = không đoán được (VD cont khô). */
  kind: ExportShipmentKind | "";
  returnYard: string;
  emptyPickupYard: string;
  docCutoff: string;
  vgmCutoff: string;
  cargoCutoff: string;
}

export type BookingField = keyof BookingRead;

/** Nhãn (đã chuẩn hóa) ⇒ trường. Thứ tự trong mảng = ưu tiên khi file có nhiều nhãn cùng nghĩa. */
const LABELS: readonly [BookingField, readonly string[]][] = [
  ["bookingNo", ["booking no", "booking number", "bkg no"]],
  ["forwarder", ["forwarder", "freight forwarder"]],
  ["vesselVoyage", ["trunk vessel", "vessel voyage", "vessel voy", "vessel"]],
  ["placeOfReceipt", ["place of receipt"]],
  ["portOfLoading", ["port of loading", "pol"]],
  ["portOfDischarge", ["port of discharging", "port of discharge", "pod"]],
  ["placeOfDelivery", ["place of delivery", "final destination"]],
  ["equipment", ["equipment type q ty", "equipment type qty", "equipment type", "container type"]],
  ["returnYard", ["full return cy", "full return yard", "return cy"]],
  ["emptyPickupYard", ["empty pick up cy", "empty pickup cy", "empty pick up yard"]],
  ["docCutoff", ["doc cut off", "si cut off", "documentation cut off"]],
  ["vgmCutoff", ["vgm cut off"]],
  ["cargoCutoff", ["port cargo cut off", "cy cut off", "cargo cut off"]],
];

const DATE_FIELDS: readonly BookingField[] = ["docCutoff", "vgmCutoff", "cargoCutoff"];

const normLabel = (v: string) =>
  v
    .toLowerCase()
    .replace(/[’'.]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const LABEL_TO_FIELD = new Map<string, BookingField>();
for (const [field, names] of LABELS) for (const n of names) if (!LABEL_TO_FIELD.has(n)) LABEL_TO_FIELD.set(n, field);

/**
 * Một hàng chữ (đã tách ô) ⇒ các cặp nhãn / giá trị. Ô ":" đứng riêng ⇒ ô ngay trước là nhãn (lấy ra khỏi giá
 * trị của nhãn trước); ô kết thúc bằng ":" là nhãn; "Nhãn : giá trị" trong một ô cũng tách được.
 */
export function labelPairs(cells: readonly string[]): [string, string][] {
  const pairs: { label: string; value: string[] }[] = [];
  let loose: string[] = [];
  const open = (label: string) => pairs.push({ label, value: [] });
  for (const raw of cells) {
    const c = raw.trim();
    if (!c) continue;
    const cur = pairs[pairs.length - 1];
    if (c === ":") {
      const label = cur?.value.length ? cur.value.pop()! : loose.pop();
      loose = [];
      if (label) open(label);
      continue;
    }
    const m = c.match(/^(.*?[A-Za-z).])\s*:\s*(.*)$/);
    if (m && !/^\d/.test(c)) {
      open(m[1]);
      if (m[2]) pairs[pairs.length - 1].value.push(m[2]);
      continue;
    }
    if (cur) cur.value.push(c);
    else loose.push(c);
  }
  return pairs.map((p) => [p.label.trim(), p.value.join(" ").replace(/\s+/g, " ").trim()]);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/** "03Nov26 10:00" · "03/11/2026 10:00" · "2026-11-03 10:00" ⇒ "2026-11-03T10:00"; chỉ có ngày ⇒ giờ 00:00; không đọc được ⇒ "". */
export function parseBookingDateTime(text: string): string {
  const t = text.trim();
  const time = t.match(/\b(\d{1,2}):(\d{2})\b/);
  const hm = time && Number(time[1]) < 24 ? `${pad(Number(time[1]))}:${time[2]}` : "00:00";
  let m = t.match(/\b(\d{1,2})[\s-]?([A-Za-z]{3})[a-z]*[\s-]?(\d{4}|\d{2})\b/);
  if (m) {
    const mon = MONTHS.indexOf(m[2].toLowerCase());
    if (mon >= 0) return `${year(m[3])}-${pad(mon + 1)}-${pad(Number(m[1]))}T${hm}`;
  }
  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${hm}`;
  m = t.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4}|\d{2})\b/);
  if (m && Number(m[2]) <= 12) return `${year(m[3])}-${pad(Number(m[2]))}-${pad(Number(m[1]))}T${hm}`;
  return "";
}

/** Loại cont của booking ⇒ loại chuyến (R3): chỉ cont lạnh; cont khô / lạ ⇒ "". */
export function bookingContainerKind(text: string): ExportShipmentKind | "" {
  const t = text.toUpperCase();
  if (!/REEFER|\bRF\b|\dRF|\dRH|\bRH\b|\bRQ\b/.test(t)) return "";
  if (/\b40|40'|40RH|40RQ|40HR/.test(t)) return /HC|HQ|HIGH\s*CUBE|RH\b|RQ\b|HR\b/.test(t.replace(/REEFER/g, "")) ? "40HC-RF" : "40RF";
  if (/\b20|20'/.test(t)) return "20RF";
  return "";
}

export const EMPTY_BOOKING_READ: BookingRead = {
  bookingNo: "",
  forwarder: "",
  vesselVoyage: "",
  placeOfReceipt: "",
  portOfLoading: "",
  portOfDischarge: "",
  placeOfDelivery: "",
  equipment: "",
  kind: "",
  returnYard: "",
  emptyPickupYard: "",
  docCutoff: "",
  vgmCutoff: "",
  cargoCutoff: "",
};

/** Ô của booking in cắt chữ ("TCTT (TAN CANG CAIMEP THI VAI") ⇒ đóng ngoặc cho gọn. */
const closeParen = (v: string) => v + ")".repeat(Math.max(0, (v.match(/\(/g) ?? []).length - (v.match(/\)/g) ?? []).length));

/** Hàng chữ của file booking ⇒ các trường. Nhãn lặp (Address, Terminal…) hoặc trùng nghĩa ⇒ giữ lần đầu. */
export function parseBookingRows(rows: readonly (readonly string[])[]): { read: BookingRead; found: BookingField[] } {
  const read: BookingRead = { ...EMPTY_BOOKING_READ };
  const found = new Set<BookingField>();
  for (const row of rows) {
    for (const [label, value] of labelPairs(row)) {
      const field = LABEL_TO_FIELD.get(normLabel(label));
      if (!field || found.has(field) || field === "kind") continue;
      const v = DATE_FIELDS.includes(field) ? parseBookingDateTime(value) : closeParen(value.replace(/\s*-\s*$/, "").trim());
      if (!v) continue;
      read[field] = v as never;
      found.add(field);
    }
  }
  if (read.equipment) {
    read.kind = bookingContainerKind(read.equipment);
    if (read.kind) found.add("kind");
  }
  return { read, found: [...found] };
}

export type BookingReadResult =
  | { ok: true; read: BookingRead; found: BookingField[] }
  | { ok: false; message: string };

export const isReadableBookingFile = (name: string) => /\.pdf$/i.test(name);

/** Đọc một file booking (vừa chọn hoặc tải về từ kho file). Chỉ PDF có chữ; không ghi gì. */
export async function readBookingFile(file: Blob, fileName: string): Promise<BookingReadResult> {
  if (!isReadableBookingFile(fileName)) return { ok: false, message: "Chỉ đọc được file PDF của hãng tàu — file này gõ tay các ô." };
  try {
    const [{ pdfTextItems }, { rowsFromTextItems }] = await Promise.all([import("./invoiceFileReader"), import("./invoiceReader")]);
    const items = await pdfTextItems(await file.arrayBuffer(), 2);
    if (items === "scan") return { ok: false, message: "PDF là bản scan (ảnh), không có chữ để đọc — gõ tay các ô." };
    const r = parseBookingRows(rowsFromTextItems(items));
    if (r.found.length === 0) return { ok: false, message: "Không thấy nhãn booking nào (Booking No, Port of Loading, Doc Cut-off…) — gõ tay các ô." };
    return { ok: true, ...r };
  } catch {
    return { ok: false, message: "Không mở được file PDF này — gõ tay các ô." };
  }
}
