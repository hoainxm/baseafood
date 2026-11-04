// ============================================================
// Tên file: src/lib/exportBooking.ts
// Tên tiếng Việt: Thông tin booking + Thông tin xe vận chuyển của chuyến xuất — luật thuần
// Description: Pure rules for ba-spec 71 — apply a booking read to the form (R4), transport required
//              fields (R5), transport prefill (R6), cutoff overdue (R8). No I/O.
// ============================================================
import type { BookingField, BookingRead } from "@/lib/bookingReader";
import type { ExportBookingDetails, ExportOptionListKind, ExportShipment, ExportShipmentKind, ExportTransportInfo } from "@/types";

export const EMPTY_BOOKING_DETAILS: ExportBookingDetails = {
  forwarder: "",
  placeOfReceipt: "",
  portOfLoading: "",
  placeOfDelivery: "",
  returnYard: "",
  emptyPickupYard: "",
  docCutoff: "",
  vgmCutoff: "",
  cargoCutoff: "",
};
export const EMPTY_TRANSPORT_INFO: ExportTransportInfo = {
  haulier: "",
  driverName: "",
  driverPhone: "",
  driverIdNo: "",
  truckPlate: "",
  emptyPickupPlace: "",
  stuffingPlace: "",
  returnYard: "",
};
/** Hộp Cập nhật booking: 10 trường đọc từ file + bãi lấy rỗng (ẩn, R6). Số booking / đại lý chỉ để so. */
export interface BookingForm {
  vesselVoyage: string;
  placeOfReceipt: string;
  portOfLoading: string;
  portOfDischarge: string;
  placeOfDelivery: string;
  kind: ExportShipmentKind;
  returnYard: string;
  emptyPickupYard: string;
  docCutoff: string;
  vgmCutoff: string;
  cargoCutoff: string;
}

export type BookingFormField = keyof BookingForm;

/** Danh sách chọn của từng ô địa điểm (R11). */
export const BOOKING_FIELD_LIST: Partial<Record<BookingFormField, ExportOptionListKind>> = {
  placeOfReceipt: "loading-port",
  portOfLoading: "loading-port",
  portOfDischarge: "discharge-port",
  placeOfDelivery: "discharge-port",
  returnYard: "container-yard",
  emptyPickupYard: "container-yard",
};

/** Nhãn khối Booking, đúng thứ tự chủ dự án (R1). */
export const BOOKING_LABELS = {
  bookingNo: "Số booking",
  forwarder: "Đại lý",
  vesselVoyage: "Tàu / chuyến",
  placeOfReceipt: "Nơi nhận hàng",
  portOfLoading: "Cảng đi",
  portOfDischarge: "Cảng đến",
  placeOfDelivery: "Nơi giao hàng",
  kind: "Loại cont",
  returnYard: "Nơi hạ bãi",
  docCutoff: "Doc cut-off",
  vgmCutoff: "VGM cut-off",
  cargoCutoff: "Thời hạn hạ bãi",
} as const;

export const TRANSPORT_LABELS: Record<keyof ExportTransportInfo, string> = {
  haulier: "Tên công ty vận chuyển",
  driverName: "Tên tài xế",
  driverPhone: "Số điện thoại",
  driverIdNo: "Số CCCD",
  truckPlate: "Biển số xe",
  emptyPickupPlace: "Địa điểm lấy container rỗng",
  stuffingPlace: "Địa điểm đóng container",
  returnYard: "Địa điểm hạ bãi",
};

/** Ô bắt buộc của Thông tin xe, đúng thứ tự R5. */
export const TRANSPORT_REQUIRED: readonly (keyof ExportTransportInfo)[] = ["haulier", "emptyPickupPlace", "stuffingPlace", "returnYard"];

export function bookingFormOf(s: ExportShipment, b: ExportBookingDetails): BookingForm {
  return {
    vesselVoyage: s.vesselVoyage,
    placeOfReceipt: b.placeOfReceipt,
    portOfLoading: b.portOfLoading,
    portOfDischarge: s.portOfDischarge,
    placeOfDelivery: b.placeOfDelivery,
    kind: s.kind,
    returnYard: b.returnYard,
    emptyPickupYard: b.emptyPickupYard,
    docCutoff: b.docCutoff,
    vgmCutoff: b.vgmCutoff,
    cargoCutoff: b.cargoCutoff,
  };
}

/** Ghi hộp Cập nhật booking vào chuyến (R2): 3 trường sẵn có + phần booking; đại lý giữ nguyên. */
export function shipmentWithBooking(s: ExportShipment, b: ExportBookingDetails, f: BookingForm): ExportShipment {
  return {
    ...s,
    vesselVoyage: f.vesselVoyage.trim(),
    portOfDischarge: f.portOfDischarge.trim(),
    kind: f.kind,
    booking: {
      ...b,
      placeOfReceipt: f.placeOfReceipt.trim(),
      portOfLoading: f.portOfLoading.trim(),
      placeOfDelivery: f.placeOfDelivery.trim(),
      returnYard: f.returnYard.trim(),
      emptyPickupYard: f.emptyPickupYard.trim(),
      docCutoff: f.docCutoff,
      vgmCutoff: f.vgmCutoff,
      cargoCutoff: f.cargoCutoff,
    },
  };
}

export interface BookingApplyResult {
  form: BookingForm;
  /** Ô vừa lấy từ file — để đánh dấu "từ file" cho người soát. */
  filled: BookingFormField[];
  /** Đại lý lấy từ file (chuyến chưa có) — "" = không đổi. */
  forwarder: string;
  warnings: string[];
}

const READ_TO_FORM: readonly Exclude<BookingFormField, "kind">[] = [
  "vesselVoyage",
  "placeOfReceipt",
  "portOfLoading",
  "portOfDischarge",
  "placeOfDelivery",
  "returnYard",
  "emptyPickupYard",
  "docCutoff",
  "vgmCutoff",
  "cargoCutoff",
];

const same = (a: string, b: string) => a.replace(/\s+/g, "").toUpperCase() === b.replace(/\s+/g, "").toUpperCase();

/**
 * Áp kết quả đọc file vào hộp (R4): ô file có giá trị ⇒ thay; ô file trống ⇒ giữ. Số booking không bao giờ đổi
 * (lệch ⇒ cảnh báo). Đại lý: chuyến chưa có ⇒ lấy từ file; khác ⇒ cảnh báo, giữ. `match` = khớp danh sách chọn (R3).
 */
export function applyBookingRead(
  form: BookingForm,
  current: { bookingNo: string; forwarder: string },
  read: BookingRead,
  found: readonly BookingField[],
  match: (list: ExportOptionListKind, text: string) => string = (_l, t) => t,
): BookingApplyResult {
  const next: BookingForm = { ...form };
  const filled: BookingFormField[] = [];
  const has = (f: BookingField) => found.includes(f) && String(read[f]).trim() !== "";
  for (const f of READ_TO_FORM) {
    if (!has(f)) continue;
    const list = BOOKING_FIELD_LIST[f];
    next[f] = list ? match(list, read[f]) : read[f];
    filled.push(f);
  }
  if (has("kind") && read.kind) {
    next.kind = read.kind;
    filled.push("kind");
  }
  const warnings: string[] = [];
  if (has("bookingNo")) {
    if (!current.bookingNo.trim()) warnings.push(`File ghi số booking ${read.bookingNo} — chuyến chưa có số booking, ghi ở Sửa chuyến.`);
    else if (!same(current.bookingNo, read.bookingNo))
      warnings.push(`File ghi số booking ${read.bookingNo}, chuyến đang là ${current.bookingNo} — kiểm lại có đúng file của chuyến này không.`);
  }
  let forwarder = "";
  if (has("forwarder")) {
    const fw = match("forwarder", read.forwarder);
    if (!current.forwarder.trim()) forwarder = fw;
    else if (!same(current.forwarder, fw)) warnings.push(`File ghi đại lý ${read.forwarder}, chuyến đang là ${current.forwarder} — giữ đại lý của chuyến (sửa ở Sửa chuyến).`);
  }
  if (found.includes("equipment") && !read.kind) warnings.push(`Loại cont trên file "${read.equipment}" không phải cont lạnh — chọn tay.`);
  return { form: next, filled, forwarder, warnings };
}

/** Ô bắt buộc còn thiếu (R5), đúng thứ tự. Rỗng ⇒ lưu được. */
export function transportMissing(t: ExportTransportInfo): (keyof ExportTransportInfo)[] {
  return TRANSPORT_REQUIRED.filter((k) => !t[k].trim());
}

/** Đã ghi thông tin xe = có công ty vận chuyển (bản lưu luôn đủ 4 ô bắt buộc). */
export const hasTransport = (t: ExportTransportInfo | undefined) => !!t?.haulier.trim();

/** Mở Ghi thông tin xe (R6): ô đang trống lấy bãi lấy rỗng / nơi hạ bãi của booking. */
export function prefillTransport(t: ExportTransportInfo, b: ExportBookingDetails | undefined): ExportTransportInfo {
  return {
    ...t,
    emptyPickupPlace: t.emptyPickupPlace || b?.emptyPickupYard || "",
    returnYard: t.returnYard || b?.returnYard || "",
  };
}

/** Hạn booking đã qua (R8): trước giờ hiện tại, chuyến chưa đóng cont, chưa hủy. `now` = giờ địa phương "yyyy-mm-ddThh:mm". */
export function cutoffOverdue(value: string, now: string, s: Pick<ExportShipment, "loadingDate" | "status">): boolean {
  return !!value && s.status !== "cancelled" && !s.loadingDate && value < now;
}

/** Giờ địa phương hiện tại dạng "yyyy-mm-ddThh:mm" (so với hạn booking). */
export function localNowMinute(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
