// ba-spec 71 AC-5…AC-8 — luật thuần của khối Booking + Thông tin xe vận chuyển.
import { describe, expect, it } from "vitest";
import { EMPTY_BOOKING_READ, type BookingRead } from "./bookingReader";
import { EMPTY_BOOKING_DETAILS, EMPTY_TRANSPORT_INFO, applyBookingRead, bookingFormOf, cutoffOverdue, prefillTransport, shipmentWithBooking, transportMissing } from "./exportBooking";
import { EMPTY_EXPORT_DATA, isShipmentClosed, stepState } from "./exportPlanning";
import { matchOptionLoose } from "./exportOptions";
import type { ExportOption, ExportShipment } from "@/types";

const ship = (over: Partial<ExportShipment> = {}): ExportShipment => ({
  id: "s1",
  contractId: "c1",
  planMonth: "2026-11",
  kind: "40RF",
  goodsSummary: "",
  plannedKg: null,
  lotCode: "",
  portOfDischarge: "Tokyo, Japan",
  bookingNo: "A1",
  loadingDate: "",
  etd: "",
  eta: "",
  vesselVoyage: "",
  containerNo: "",
  sealNo: "",
  status: "open",
  cancelReason: "",
  note: "",
  createdAt: "2026-11-01T00:00:00Z",
  ...over,
});

const opt = (listKind: ExportOption["listKind"], name: string): ExportOption => ({ id: `${listKind}-${name}`, listKind, name, sortOrder: 0, note: "" });

describe("matchOptionLoose (AC-5)", () => {
  const rows = [opt("loading-port", "Cái Mép"), opt("loading-port", "Cát Lái"), opt("discharge-port", "Tokyo, Japan")];
  it("không dấu, không phân hoa thường", () => expect(matchOptionLoose("CAI MEP", rows, "loading-port")).toBe("Cái Mép"));
  it("khớp phần đầu tên khi chỉ một mục", () => expect(matchOptionLoose("TOKYO, TOKYO", rows, "discharge-port")).toBe("Tokyo, Japan"));
  it("không có trong danh sách ⇒ giữ chữ file", () => expect(matchOptionLoose("VUNG TAU", rows, "loading-port")).toBe("VUNG TAU"));
});

describe("applyBookingRead (AC-6)", () => {
  const s = ship();
  const b = { ...EMPTY_BOOKING_DETAILS, forwarder: "X", returnYard: "B" };
  const read: BookingRead = { ...EMPTY_BOOKING_READ, bookingNo: "A2", forwarder: "Y", portOfDischarge: "", returnYard: "C", equipment: "20'REEFER-1", kind: "20RF" };
  const r = applyBookingRead(bookingFormOf(s, b), { bookingNo: s.bookingNo, forwarder: b.forwarder }, read, ["bookingNo", "forwarder", "portOfDischarge", "returnYard", "equipment", "kind"]);
  it("ô file trống giữ giá trị cũ, ô có giá trị thay", () => {
    expect(r.form.portOfDischarge).toBe("Tokyo, Japan");
    expect(r.form.returnYard).toBe("C");
    expect(r.form.kind).toBe("20RF");
    expect(r.filled).toEqual(["returnYard", "kind"]);
  });
  it("số booking + đại lý không đổi, có 2 cảnh báo", () => {
    expect(r.forwarder).toBe("");
    expect(r.warnings).toHaveLength(2);
    const saved = shipmentWithBooking(s, b, r.form);
    expect(saved.bookingNo).toBe("A1");
    expect(saved.booking?.forwarder).toBe("X");
    expect(saved.kind).toBe("20RF");
  });
  it("chuyến chưa có đại lý ⇒ lấy từ file", () => {
    const r2 = applyBookingRead(bookingFormOf(s, EMPTY_BOOKING_DETAILS), { bookingNo: "A2", forwarder: "" }, read, ["bookingNo", "forwarder"]);
    expect(r2.forwarder).toBe("Y");
    expect(r2.warnings).toHaveLength(0);
  });
});

describe("Thông tin xe (AC-7)", () => {
  it("chỉ có tài xế ⇒ thiếu 4 ô, đúng thứ tự", () => {
    expect(transportMissing({ ...EMPTY_TRANSPORT_INFO, driverName: "Anh A" })).toEqual(["haulier", "emptyPickupPlace", "stuffingPlace", "returnYard"]);
  });
  it("đủ 4 ô, tài xế trống ⇒ lưu được", () => {
    expect(transportMissing({ ...EMPTY_TRANSPORT_INFO, haulier: "VT", emptyPickupPlace: "ICD", stuffingPlace: "BSF1", returnYard: "TCTT" })).toHaveLength(0);
  });
  it("điền sẵn bãi lấy rỗng / hạ bãi từ booking, không đè ô đã có (R6)", () => {
    const b = { ...EMPTY_BOOKING_DETAILS, emptyPickupYard: "ICD Tây Nam", returnYard: "TCTT" };
    expect(prefillTransport(EMPTY_TRANSPORT_INFO, b)).toMatchObject({ emptyPickupPlace: "ICD Tây Nam", returnYard: "TCTT" });
    expect(prefillTransport({ ...EMPTY_TRANSPORT_INFO, returnYard: "Cát Lái" }, b).returnYard).toBe("Cát Lái");
  });
});

describe("không đổi tiến độ (AC-8)", () => {
  it("bước 4 và đóng chuyến như khi không có hai khối", () => {
    const plain = ship();
    const full = ship({
      booking: { ...EMPTY_BOOKING_DETAILS, forwarder: "X", docCutoff: "2026-11-03T10:00" },
      transport: { ...EMPTY_TRANSPORT_INFO, haulier: "VT", emptyPickupPlace: "ICD", stuffingPlace: "BSF1", returnYard: "TCTT" },
    });
    const d = (s: ExportShipment) => ({ ...EMPTY_EXPORT_DATA, shipments: [s] });
    expect(stepState(d(full), full, 4)).toBe(stepState(d(plain), plain, 4));
    expect(isShipmentClosed(d(full), full)).toBe(false);
  });
});

describe("cutoffOverdue (R8)", () => {
  it("qua hạn khi chưa đóng cont", () => {
    expect(cutoffOverdue("2026-11-03T10:00", "2026-11-03T10:01", ship())).toBe(true);
    expect(cutoffOverdue("2026-11-03T10:00", "2026-11-03T10:01", ship({ loadingDate: "2026-11-02" }))).toBe(false);
    expect(cutoffOverdue("", "2026-11-03T10:01", ship())).toBe(false);
  });
});
