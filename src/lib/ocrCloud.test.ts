import { describe, expect, it } from "vitest";
import { buildCatalogPayload, matchesAbbreviation, mergeCloudResult } from "./ocrCloud";
import { parseOcrText, type OcrCatalog } from "./ocr";

const catalog: OcrCatalog = {
  suppliers: [{ name: "Chị Lan", code: "12", alias: "Hộ kinh doanh Nguyễn Thị Lan" }, { name: "Anh Tư" }],
  materialTypes: [{ name: "Mực ống" }, { name: "Cá thu" }],
  knownPlates: ["72C-166.03"],
  knownDrivers: ["Nguyễn Văn Tèo"],
  workshops: ["Đông", "Cá", "Khô"],
};
const empty = parseOcrText("", catalog);

describe("buildCatalogPayload", () => {
  it("ghép mã · tên (tên hóa đơn), gửi kèm xe / tài xế / xưởng", () => {
    expect(buildCatalogPayload(catalog)).toEqual({
      suppliers: ["12 · Chị Lan (Hộ kinh doanh Nguyễn Thị Lan)", "Anh Tư"],
      materialTypes: ["Mực ống", "Cá thu"],
      knownPlates: ["72C-166.03"],
      knownDrivers: ["Nguyễn Văn Tèo"],
      workshops: ["Đông", "Cá", "Khô"],
      supplierHistory: [],
      scrapTypes: [],
    });
  });

  it("không lặp tên hóa đơn trùng tên tắt", () => {
    expect(buildCatalogPayload({ suppliers: [{ name: "An", alias: "an" }], materialTypes: [] }).suppliers).toEqual(["An"]);
  });
});

describe("mergeCloudResult", () => {
  it("nhận tên đúng danh mục (không phân hoa thường, nhận dạng 'mã · tên')", () => {
    const r = mergeCloudResult(
      { text: "x", date: "2026-10-02", supplier: "12 · chị lan", lines: [{ materialType: "mực ống", kg: 120.5 }] },
      empty,
      catalog,
    );
    expect(r.supplier).toBe("Chị Lan");
    expect(r.date).toBe("2026-10-02");
    expect(r.lines).toEqual([{ materialType: "Mực ống", kg: 120.5, unitPrice: null }]);
    expect(r.materialTypes).toEqual(["Mực ống"]);
    expect(r.kgValues).toEqual([120.5]);
  });

  it("bỏ tên bịa ngoài danh mục, kg ngoài khoảng, ngày không có thật", () => {
    const r = mergeCloudResult(
      {
        text: "x",
        date: "2026-02-30",
        supplier: "Đại lý lạ",
        lines: [
          { materialType: "Tôm hùm", kg: 10 },
          { materialType: "Cá thu", kg: 0 },
          { materialType: "Cá thu", kg: 250000 },
          { materialType: "Cá thu", kg: "12" },
        ],
      },
      empty,
      catalog,
    );
    expect(r.supplier).toBeUndefined();
    expect(r.date).toBeUndefined();
    expect(r.lines).toEqual([]);
  });

  it("ô cloud trống thì lấy của parser chữ", () => {
    const parsed = parseOcrText("Đại lý Anh Tư 02/10/2026\nCá thu 45,5", catalog);
    const r = mergeCloudResult({ text: "x", date: null, supplier: null, lines: [] }, parsed, catalog);
    expect(r.supplier).toBe("Anh Tư");
    expect(r.date).toBe("2026-10-02");
    expect(r.lines).toMatchObject([{ materialType: "Cá thu", kg: 45.5, raw: "Cá thu 45,5" }]);
  });

  it("khử dòng trùng và không vỡ khi lines không phải mảng", () => {
    const dup = mergeCloudResult(
      { text: "x", lines: [{ materialType: "Cá thu", kg: 3 }, { materialType: "cá thu", kg: 3 }] },
      empty,
      catalog,
    );
    expect(dup.lines).toHaveLength(1);
    expect(mergeCloudResult({ text: "x", lines: "rác" }, empty, catalog).lines).toEqual([]);
  });

  it("đọc xe, tài xế, xưởng, giá — khớp cách viết đã có trong sổ", () => {
    const r = mergeCloudResult(
      {
        text: "x",
        supplier: "Hộ kinh doanh Nguyễn Thị Lan",
        licensePlate: "72c 16603",
        driverName: "nguyễn văn tèo",
        workshop: "cá",
        lines: [{ materialType: "Cá thu", kg: 50, unitPrice: 85000.4 }],
      },
      empty,
      catalog,
    );
    expect(r.supplier).toBe("Chị Lan");
    expect(r.licensePlate).toBe("72C-166.03");
    expect(r.driverName).toBe("Nguyễn Văn Tèo");
    expect(r.workshop).toBe("Cá");
    expect(r.lines).toEqual([{ materialType: "Cá thu", kg: 50, unitPrice: 85000 }]);
  });

  it("xe/tài xế mới giữ cách máy đọc; bỏ biển rác, xưởng lạ, giá ngoài khoảng", () => {
    const r = mergeCloudResult(
      {
        text: "x",
        licensePlate: "51d-123.45",
        driverName: "  Bé   Ba ",
        workshop: "Xưởng lạ",
        lines: [
          { materialType: "Cá thu", kg: 10, unitPrice: 85 },
          { materialType: "Mực ống", kg: 5, unitPrice: 9_000_000 },
        ],
      },
      empty,
      catalog,
    );
    expect(r.licensePlate).toBe("51D-123.45");
    expect(r.driverName).toBe("Bé Ba");
    expect(r.workshop).toBeUndefined();
    expect(r.lines.map((l) => l.unitPrice)).toEqual([null, null]);
    expect(mergeCloudResult({ text: "x", licensePlate: "abc", driverName: "1" }, empty, catalog)).toMatchObject({
      licensePlate: undefined,
      driverName: undefined,
    });
  });
});

describe("matchesAbbreviation — tên viết tắt chữ đầu trên phiếu tay", () => {
  it.each([
    ["H Phú", "Hồng Phú", true],
    ["Phạm H Khánh", "Phạm Hoàng Khánh", true],
    ["Phạm H. Khánh", "Phạm Hoàng Khánh", true],
    ["H Phú", "Hồng Phúc", false],
    ["H P", "Hồng Phú", false],
    ["Phạm Khánh", "Phạm Hoàng Khánh", false],
  ])("%s ↔ %s ⇒ %s", (a, b, ok) => expect(matchesAbbreviation(a, b)).toBe(ok));
});

// Đáp án = sổ thật ngày 22/8/2026 (phiếu "BÁO CÁO TỔNG HỢP NGUYÊN LIỆU HẰNG NGÀY" PXĐ).
describe("đối chiếu phiếu 22/8/2026 (Hồng Phú, PXĐ)", () => {
  const slipCatalog: OcrCatalog = {
    suppliers: [{ name: "Hồng Phú", code: "7" }, { name: "Hồng Phúc" }, { name: "Phú Quý" }],
    materialTypes: [
      { name: "Bạch tuộc 1 da" },
      { name: "Bạch tuộc 2 da lớn (80↑)" },
      { name: "Bạch tuộc 2 da nhỏ (80↓)" },
    ],
    knownPlates: ["51M-05772", "72C-166.03"],
    knownDrivers: ["Phạm Hoàng Khánh", "Phạm Văn Khánh Linh"],
    workshops: ["Đông", "Cá", "Khô"],
    scrapTypes: ["Nội tạng", "Dạt"],
  };
  const slipLines = [
    { materialType: "Bạch tuộc 1 da", kg: 2014, unitPrice: 158000 },
    { materialType: "Bạch tuộc 2 da lớn (80↑)", kg: 11017, unitPrice: 142000 },
    { materialType: "Bạch tuộc 2 da nhỏ (80↓)", kg: 1379, unitPrice: 134000 },
  ];

  it("chữ tắt trên phiếu khớp về đúng sổ, phế liệu tách riêng, tổng khớp", () => {
    const r = mergeCloudResult(
      {
        text: "...",
        date: "2026-08-22",
        supplier: "H Phú",
        licensePlate: "51M 05772",
        driverName: "Phạm H Khánh",
        workshop: "Đông",
        lines: slipLines,
        scraps: [{ name: "nội tạng", kg: 1000 }],
        totalKg: 14410,
        warnings: [],
        raw: { date: "22/8/26", supplier: "H Phú", workshop: "PXĐ", licensePlate: "51M 05772", driverName: "Phạm H Khánh" },
      },
      parseOcrText("", slipCatalog),
      slipCatalog,
    );
    expect(r).toMatchObject({
      date: "2026-08-22",
      supplier: "Hồng Phú",
      licensePlate: "51M-05772",
      driverName: "Phạm Hoàng Khánh",
      workshop: "Đông",
      lines: slipLines,
      scraps: [{ name: "Nội tạng", kg: 1000 }],
      totalKg: 14410,
      warnings: [],
      rawHeader: { date: "22/8/26", supplier: "H Phú", workshop: "PXĐ", licensePlate: "51M 05772", driverName: "Phạm H Khánh" },
    });
  });

  it("chép y chữ từng dòng (để đối chiếu), cắt gọn, bỏ giá trị không phải chuỗi", () => {
    const r = mergeCloudResult(
      { text: "x", lines: [{ ...slipLines[1], raw: "  2Da NL   80↑ · 11,017 · 142 " }], raw: { supplier: 7 } },
      parseOcrText("", slipCatalog),
      slipCatalog,
    );
    expect(r.lines[0].raw).toBe("2Da NL 80↑ · 11,017 · 142");
    expect(r.rawHeader?.supplier).toBeUndefined();
  });

  it("đọc nhầm dấu nghìn (11,017 ⇒ 11,017 kg) ⇒ cảnh báo tổng lệch", () => {
    const r = mergeCloudResult(
      { text: "...", lines: [slipLines[0], { ...slipLines[1], kg: 11.017 }, slipLines[2]], totalKg: 14410 },
      parseOcrText("", slipCatalog),
      slipCatalog,
    );
    expect(r.warnings?.[0]).toMatch(/khác tổng ghi trên phiếu/);
  });

  it("parser chữ (máy dự phòng) đọc '11,017' là 11017 kg, '12,5' vẫn là 12,5", () => {
    const r = parseOcrText("Bạch tuộc 2 da lớn (80↑) 11,017\nBạch tuộc 1 da 12,5", slipCatalog);
    expect(r.lines).toMatchObject([
      { materialType: "Bạch tuộc 2 da lớn (80↑)", kg: 11017 },
      { materialType: "Bạch tuộc 1 da", kg: 12.5 },
    ]);
  });
});
