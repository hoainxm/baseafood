// ba-spec 71 AC-1…AC-4 — hàng chữ = rowsFromTextItems của file booking ONE SGNGCM332800 (trang 1), bỏ dòng có tên người.
import { describe, expect, it } from "vitest";
import { bookingContainerKind, labelPairs, parseBookingDateTime, parseBookingRows } from "./bookingReader";

const ONE_ROWS: string[][] = [
  ["SGNGCM332800"],
  ["Booking Receipt Notice"],
  ["29", "OCT", "26", "18:19", "Page", ":", "1 / 3"],
  ["We received a booking request by you as follows. Please review following items and advise us of any discrepancy"],
  ["Booking No :", "SGNGCM332800", "Booking Ref. No. :", "SGNGCM332800", "Booking Date :", "01Oct26"],
  ["Booking Staff", ":", "WEB_SAS", "Export Ref.NO", ":"],
  ["Shipper", ":", "VIETNAM CLEAN SEAFOOD CORPORATION"],
  ["Forwarder", ":", "DA PHUONG SHIPPING SERVICES", "Rate Agreement No.", ":", "TSGNN01298A"],
  ["Pre Carrier", ":", "Latest ETA/ETD", ":"],
  ["IMO/Flag/Call Sign", ":", "NRT", ":"],
  ["Trunk Vessel", ":", "BANGKOK BRIDGE 0518E(JTI)", "Latest ETA/ETD", ":", "04Nov26/05Nov26"],
  ["IMO/Flag/Call Sign", ":", "9463279/PANAMA/3FTZ8", "NRT", ":", "24146"],
  ["Place of Receipt", ":", "CAI MEP", "Proforma 1st vessel ETD :", "31Oct26"],
  ["Port of Loading", ":", "CAI MEP", "Terminal", ":", "TCTT (TAN CANG CAIMEP THI VAI TERMINAL)"],
  ["Port of Discharging", ":", "TOKYO, TOKYO", "Terminal", ":", "OHI NO.3-4 TERMINAL (TICT MOL)"],
  ["Place of Delivery", ":", "TOKYO, TOKYO", "Terminal", ":"],
  ["T/S Port", ":", "POD / DEL ETA", ":", "11Nov26", "/", "11Nov26"],
  ["Ocean Route Type", ":", "Direct", "Rcv/Del Term", ":", "CY/CY"],
  ["Equipment Type/Q’ty", ":", "20'REEFER-1"],
  ["Commodity", ":", "FROZEN SEAFOOD, NOS, NOT", "Estimated Weight", ":", "18,000.000 KGS"],
  ["Empty Pick UP CY", ":", "ICD TAY NAM", "Empty Pick Up Date", ":", "29Oct26 00:00"],
  ["Address", ":", "ICD Tay Nam Tanamexco Truong Tho Ward Thu Duc Dist HCMC"],
  ["Full Return CY", ":", "TCTT (TAN CANG CAIMEP THI VAI", "Full Return Date", ":"],
  ["Address", ":", "Tan Cang-Cai Mep Thi Vai Terminal Phuoc Hoa Commune Tan Thanh District Ba Ria - Vung Tau"],
  ["Doc Cut-off", ":", "03Nov26 10:00", "Customs Cut-off", ":"],
  ["VGM Cut-off", ":", "03Nov26 19:00"],
  ["Port Cargo Cut-off", ":", "04Nov26 19:00", "Rail Receiving Date", ":", "~"],
  ["Remarks 1", ":", "RETURN", "FULL", "CONT", "AT", "CAI", "MEP"],
];

describe("parseBookingRows — booking ONE (AC-1)", () => {
  const { read, found } = parseBookingRows(ONE_ROWS);
  it("đọc đủ số booking, đại lý và 10 trường", () => {
    expect(read.bookingNo).toBe("SGNGCM332800");
    expect(read.forwarder).toBe("DA PHUONG SHIPPING SERVICES");
    expect(read.vesselVoyage).toBe("BANGKOK BRIDGE 0518E(JTI)");
    expect(read.placeOfReceipt).toBe("CAI MEP");
    expect(read.portOfLoading).toBe("CAI MEP");
    expect(read.portOfDischarge).toBe("TOKYO, TOKYO");
    expect(read.placeOfDelivery).toBe("TOKYO, TOKYO");
    expect(read.equipment).toBe("20'REEFER-1");
    expect(read.kind).toBe("20RF");
    expect(read.returnYard).toBe("TCTT (TAN CANG CAIMEP THI VAI)");
    expect(read.docCutoff).toBe("2026-11-03T10:00");
    expect(read.vgmCutoff).toBe("2026-11-03T19:00");
    expect(read.cargoCutoff).toBe("2026-11-04T19:00");
    expect(read.emptyPickupYard).toBe("ICD TAY NAM");
    expect(found).toHaveLength(14);
  });
  it("nhãn lặp (Address, Terminal) không đè giá trị", () => {
    expect(read.portOfLoading).not.toContain("TERMINAL");
  });
});

describe("labelPairs", () => {
  it("ô ':' đứng riêng lấy ô trước làm nhãn, kể cả ô đang nằm trong giá trị nhãn trước", () => {
    expect(labelPairs(["Booking Staff", ":", "WEB_SAS", "Export Ref.NO", ":"])).toEqual([
      ["Booking Staff", "WEB_SAS"],
      ["Export Ref.NO", ""],
    ]);
  });
  it("'Nhãn : giá trị' trong một ô", () => {
    expect(labelPairs(["VGM Cut-off : 03Nov26 19:00"])).toEqual([["VGM Cut-off", "03Nov26 19:00"]]);
  });
});

describe("parseBookingDateTime (AC-2)", () => {
  it.each([
    ["03Nov26 10:00", "2026-11-03T10:00"],
    ["03/11/2026 10:00", "2026-11-03T10:00"],
    ["2026-11-03", "2026-11-03T00:00"],
    ["3-Nov-2026 7:30", "2026-11-03T07:30"],
    ["~", ""],
    ["", ""],
  ])("%s ⇒ %s", (text, want) => expect(parseBookingDateTime(text)).toBe(want));
});

describe("bookingContainerKind (AC-3)", () => {
  it.each([
    ["20'REEFER-1", "20RF"],
    ["40'REEFER HC-1", "40HC-RF"],
    ["40'HC REEFER", "40HC-RF"],
    ["40'REEFER", "40RF"],
    ["1 x 40RH", "40HC-RF"],
    ["20'DRY-1", ""],
  ])("%s ⇒ %s", (text, want) => expect(bookingContainerKind(text)).toBe(want));
});

describe("file không phải booking (AC-4)", () => {
  it("không trường nào", () => {
    const r = parseBookingRows([["COMMERCIAL INVOICE"], ["Invoice No", ":", "BSF-001"], ["Description of goods"]]);
    expect(r.found).toHaveLength(0);
  });
});
