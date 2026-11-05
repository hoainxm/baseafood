// HĐ DAIREI BD-007/26 (PDF xuất từ Word, 2026-11-05 "đính kèm mà không đọc được"): bảng tiêu đề 3 tầng, tên hàng + size
// trải 7 dòng, số lượng tính BÓ (Bundles / Kgs), số HĐ ở "Reference Number", hạn giao "ETA from … to September/2027".
// Chữ + toạ độ trích từ file (chỉ phần bảng và vài dòng đầu).
import { describe, expect, it } from "vitest";
import { bundleCartons, fillExportContract, parseContractRows, rowsFromPdfItems, splitNameNote } from "./contractReader";

const RAW: [string, number, number, number, number][] = [
  ["SALES CONTRACT", 251.6, 674, 120.4, 13.2],
  ["Reference Number: BD – 007/26", 393.8, 661.6, 137.2, 10.4],
  ["THE BUYER: DAIREI CO.,LTD.", 68.6, 599, 144.3, 9.9],
  ["I.", 68.6, 542.4, 6.3, 9.9],
  ["COMMODITY, QUANTITY, PRICE:", 88.7, 542.4, 162.8, 9.9],
  ["Above quantity will be shipped out with ETA from October/2026 to September/2027", 68.6, 344, 336.2, 9.9],
  ["No.", 69.2, 507.8, 12.5, 8.4],
  [" ", 81.8, 507.8, 40.1, 0],
  ["Name of Goods", 111.8, 507.8, 55.5, 8.4],
  [" ", 167.3, 507.8, 63.5, 0],
  ["Packing", 215, 507.8, 29.1, 8.4],
  [" ", 244, 507.8, 76.4, 0],
  ["Size", 301.4, 507.8, 14.6, 8.4],
  ["Prices Usd/ Kg", 358.6, 522.6, 53.5, 8.4],
  ["(CFR Tokyo port,", 352.7, 512.9, 65.2, 8.4],
  ["Japan)", 373, 503.3, 25, 8.4],
  ["Quantity", 442.4, 512.9, 32.5, 8.4],
  [" ", 475, 512.9, 35.2, 0],
  ["Amount (USD)", 501.4, 507.8, 54.4, 8.4],
  ["CO VJ", 372.8, 493.1, 25.1, 8.4],
  [" ", 397.9, 493.1, 34.8, 0],
  ["Bundles", 424, 493.1, 29.3, 8.4],
  [" ", 453.3, 493.1, 24.1, 0],
  ["Kgs", 471.4, 493.1, 14.1, 8.4],
  ["1", 73.3, 445.3, 4.2, 8.4],
  ["FROZEN OCTOPUS", 100.4, 476, 78.1, 8.4],
  ["KARAAGE IQF", 109.3, 464.9, 60.3, 8.4],
  ["(DAIREI BRAND-3192)", 95.4, 453.7, 88.2, 8.4],
  ["New powder from Nisshin", 94.6, 442.6, 90, 8.4],
  ["- 22-04WV", 120.1, 432.7, 38.9, 8.4],
  ["- GUM-24V", 118.4, 423, 42.1, 8.4],
  ["- TSU-18V", 120.4, 413.3, 38.3, 8.4],
  ["1kg/bag x 5 Bags/", 198.7, 449.5, 61.4, 8.4],
  ["Ctn x 2/B’DL", 205.9, 439.8, 47.1, 8.4],
  ["- Tentacle 6-14 gr,", 277.2, 478.8, 62.9, 8.4],
  ["length 4-7 cm: 45%", 275.3, 469.1, 67, 8.4],
  ["- 1 leg, 2 leg 6-11 gr,", 273, 459.2, 71.5, 8.4],
  ["length 4-9 cm : 20%", 274.2, 449.5, 69, 8.4],
  ["- Body + neck 6-11 gr,", 270, 439.8, 77.2, 8.4],
  ["length 4-9 cm : 35%", 274.2, 430.1, 69, 8.4],
  ["(size of semi product", 273.1, 420.4, 71.1, 8.4],
  ["before powdering)", 277.3, 410.6, 62.8, 8.4],
  ["9.65", 378, 444.7, 14.8, 8.4],
  [" ", 392.8, 444.7, 48.3, 0],
  ["5,000", 429, 444.7, 19.1, 8.4],
  [" ", 448.1, 444.7, 25.2, 0],
  ["50,000", 467, 444.7, 23.2, 8.4],
  [" ", 490.2, 444.7, 25.6, 0],
  ["482,500.00", 509.4, 444.7, 38.2, 8.4],
  ["TOTAL", 227.2, 396.2, 29.5, 8.4],
  [" ", 256.6, 396.2, 230, 0],
  ["5,000", 429.1, 396.2, 19.1, 8.4],
  [" ", 448.2, 396.2, 25.1, 0],
  ["50,000", 467, 396.2, 23.1, 8.4],
  [" ", 490.2, 396.2, 25.6, 0],
  ["482,500.00", 509.4, 396.1, 38.2, 8.4],
];
const items = RAW.map(([str, x, y, width, height]) => ({ str, x, y, width, height, page: 1 }));

describe("đọc HĐ PDF DAIREI BD-007 (bó, tiêu đề 3 tầng)", () => {
  const r = parseContractRows(rowsFromPdfItems(items), "export");
  it("số HĐ, hạn giao, một dòng hàng tính bó đủ số", () => {
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contract.contractNo).toBe("BD-007/26");
    expect(r.contract.latestShipmentDate).toBe("2027-09-30");
    expect(r.contract.lines).toHaveLength(1);
    const l = r.contract.lines[0];
    expect(l.description).toBe("FROZEN OCTOPUS KARAAGE IQF (DAIREI BRAND-3192)");
    expect(l.note).toContain("New powder from Nisshin");
    expect([l.cartons, l.cartonsPerUnit, l.netKgPerCarton, l.kg, l.unitPrice, l.amount]).toEqual([5000, 2, 5, 50000, 9.65, 482500]);
    expect(r.contract.lineIssues).toHaveLength(0);
  });
  it("điền vào form: dòng tính bó, 5.000 bó × 2 thùng × 5 kg", () => {
    if (!r.ok) return;
    const fill = fillExportContract(
      { customerId: "", contractNo: "", signedOn: "", orderRef: "", terms: {} as never, lines: [] } as never,
      r.contract,
      { mode: "create", customers: [], options: [], canSeePrice: true, newLineId: () => "x", baseline: {} } as never,
    );
    const line = fill.values.lines[0];
    expect([line.unitKind, line.cartonsPerUnit, line.netKgPerCarton, line.quantity]).toEqual(["bundle", 2, 5, 5000]);
  });
  it("hàm phụ", () => {
    expect(bundleCartons("1kg/bag x 5 Bags/Ctn x 2/B’DL")).toBe(2);
    expect(bundleCartons("10kg/ctn")).toBe(1);
    expect(splitNameNote("FROZEN OCTOPUS Size 2-3").note).toBe("");
    expect(splitNameNote("Frozen iidako raw cut").note).toBe("");
  });
});
