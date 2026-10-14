import { describe, expect, it } from "vitest";
import { buildCatalogPayload, mergeCloudResult } from "./ocrCloud";
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
    expect(r.lines).toEqual([{ materialType: "Cá thu", kg: 45.5 }]);
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
