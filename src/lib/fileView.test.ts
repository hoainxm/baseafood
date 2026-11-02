import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { fileViewHref, parseFileViewParams } from "./fileViewLink";
import { readSheetPreview } from "./sheetPreview";

describe("readSheetPreview (ba-spec 61 R5)", () => {
  it("AC-4: 2 sheet, sheet 1 có 1.205 dòng ⇒ hiện 1.000, total 1.205", async () => {
    const wb = XLSX.utils.book_new();
    const big = Array.from({ length: 1205 }, (_, i) => [`Dòng ${i + 1}`, i + 1]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(big), "Kế hoạch");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Mã", "Tên"], ["M1", "Mực"]]), "Danh mục");
    const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
    const sheets = await readSheetPreview(bytes, 1000);
    expect(sheets.length).toBe(2);
    expect(sheets[0].name).toBe("Kế hoạch");
    expect(sheets[0].rows.length).toBe(1000);
    expect(sheets[0].total).toBe(1205);
    expect(sheets[1].rows).toEqual([["Mã", "Tên"], ["M1", "Mực"]]);
  });
});

describe("link trang xem file (ba-spec 61 AC-5, AC-6)", () => {
  it("dựng rồi đọc lại đúng nguồn, đường dẫn, tên (cả dấu tiếng Việt)", () => {
    const href = fileViewHref("export", "c1/Hợp đồng.doc", "Hợp đồng.doc");
    expect(href.startsWith("#/file-view?")).toBe(true);
    expect(href).toContain("src=export");
    const parsed = parseFileViewParams(new URLSearchParams(href.split("?")[1]));
    expect(parsed).toEqual({ source: "export", path: "c1/Hợp đồng.doc", name: "Hợp đồng.doc" });
  });

  it("nguồn lạ hoặc thiếu đường dẫn ⇒ null", () => {
    expect(parseFileViewParams(new URLSearchParams("src=other&path=a.doc"))).toBeNull();
    expect(parseFileViewParams(new URLSearchParams("src=documents"))).toBeNull();
  });
});
