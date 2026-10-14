import { describe, expect, it } from "vitest";
import { buildCatalogPayload, mergeCloudResult } from "./ocrCloud";
import { parseOcrText, type OcrCatalog } from "./ocr";

const catalog: OcrCatalog = {
  suppliers: [{ name: "Chị Lan", code: "12" }, { name: "Anh Tư" }],
  materialTypes: [{ name: "Mực ống" }, { name: "Cá thu" }],
};
const empty = parseOcrText("", catalog);

describe("buildCatalogPayload", () => {
  it("ghép mã · tên cho đại lý có mã", () => {
    expect(buildCatalogPayload(catalog)).toEqual({
      suppliers: ["12 · Chị Lan", "Anh Tư"],
      materialTypes: ["Mực ống", "Cá thu"],
    });
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
    expect(r.lines).toEqual([{ materialType: "Mực ống", kg: 120.5 }]);
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
});
