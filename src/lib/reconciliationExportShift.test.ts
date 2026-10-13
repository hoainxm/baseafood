import { describe, expect, it } from "vitest";
import { shiftFormula, shiftRange } from "./reconciliationExportShift";

const HD = new Set(["HDDT"]);
const KMA = new Set(["T6-KMA"]);

describe("shiftFormula — dịch tham chiếu khi chèn/gỡ cột", () => {
  it("vùng có tên sheet: dịch CẢ HAI đầu vùng", () => {
    expect(shiftFormula("SUM(HDDT!Q3:Q3047)", 1, HD, false)).toBe("SUM(HDDT!R3:R3047)");
    expect(shiftFormula("SUM('T6-KMA'!K7:K144)", 1, KMA, false)).toBe("SUM('T6-KMA'!L7:L144)");
    expect(shiftFormula("SUM(HDDT!$Q$3:$Q$3047)", 1, HD, false)).toBe("SUM(HDDT!$R$3:$R$3047)");
  });

  it("vùng trỏ sheet KHÔNG bị chèn thì giữ nguyên cả hai đầu", () => {
    expect(shiftFormula("SUM(XXXX!A1:A5)", 1, HD, true)).toBe("SUM(XXXX!A1:A5)");
    expect(shiftFormula("SUM('Khác'!A1:B5)+C1", 1, HD, true)).toBe("SUM('Khác'!A1:B5)+D1");
  });

  it("sau vùng có tên sheet, tham chiếu trần lại theo sheet chứa công thức", () => {
    expect(shiftFormula("SUM(HDDT!Q3:Q5)+A1", 1, HD, false)).toBe("SUM(HDDT!R3:R5)+A1");
    expect(shiftFormula("SUM(XXXX!Q3:Q5)+A1", 1, HD, true)).toBe("SUM(XXXX!Q3:Q5)+B1");
  });

  it("chiều ngược (gỡ cột A — dịch −1)", () => {
    expect(shiftFormula("SUM(HDDT!R3:R3047)", -1, HD, false)).toBe("SUM(HDDT!Q3:Q3047)");
    expect(shiftFormula("SUM(R3:R9)-'T6-KMA'!L7", -1, KMA, true)).toBe("SUM(Q3:Q9)-'T6-KMA'!K7");
  });

  it("không đụng chuỗi, tên hàm, cột trần", () => {
    expect(shiftFormula('IF(A1="B2","KHỚP",SUM(C:C))', 1, HD)).toBe('IF(B1="B2","KHỚP",SUM(D:D))');
    expect(shiftFormula("O463-L463", 1, HD)).toBe("P463-M463");
  });

  it("shiftRange", () => {
    expect(shiftRange("B3:T3", 1)).toBe("C3:U3");
    expect(shiftRange("Z1", 1)).toBe("AA1");
  });
});
