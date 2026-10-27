import { describe, expect, it } from "vitest";
import * as React from "react";
import { inferSortKind, nodeText, parseSortDate, parseSortNumber, sortRows } from "./tableSort";

describe("parseSortNumber — số kiểu Việt đang hiện trong ô", () => {
  it("đọc phân nghìn, phần lẻ, đơn vị", () => {
    expect(parseSortNumber("1.234,5 kg")).toBe(1234.5);
    expect(parseSortNumber("12.000.000 đ")).toBe(12000000);
    expect(parseSortNumber("12%")).toBe(12);
    expect(parseSortNumber("30")).toBe(30);
  });
  it("số âm: dấu trừ, dấu trừ chữ, ngoặc kế toán", () => {
    expect(parseSortNumber("-12,5")).toBe(-12.5);
    expect(parseSortNumber("−12")).toBe(-12);
    expect(parseSortNumber("(2.000)")).toBe(-2000);
  });
  it("ô trống / gạch ngang ⇒ null", () => {
    expect(parseSortNumber("")).toBeNull();
    expect(parseSortNumber("—")).toBeNull();
    expect(parseSortNumber(" - ")).toBeNull();
  });
});

describe("parseSortDate — ngày nhiều dạng", () => {
  it("ISO, dd/mm/yyyy, có giờ", () => {
    expect(parseSortDate("2026-10-05")).toBeLessThan(parseSortDate("2026-10-06")!);
    expect(parseSortDate("05/10/2026")).toBe(parseSortDate("2026-10-05"));
    expect(parseSortDate("05/10/2026 14:30")).toBeGreaterThan(parseSortDate("05/10/2026 09:00")!);
  });
  it("tháng/năm và ngày/tháng", () => {
    expect(parseSortDate("9/2026")).toBeLessThan(parseSortDate("Tháng 10/2026")!);
    expect(parseSortDate("31/01")).toBeLessThan(parseSortDate("01/02")!);
    expect(parseSortDate("T09-2026")).toBe(parseSortDate("9/2026"));
  });
  it("giờ đứng trước ngày (vi-VN)", () => {
    expect(parseSortDate("14:30:05 5/10/2026")).toBe(parseSortDate("05/10/2026 14:30"));
    expect(parseSortDate("09:00 06/10/2026")).toBeGreaterThan(parseSortDate("23:59 05/10/2026")!);
  });
  it("không phải ngày ⇒ null", () => {
    expect(parseSortDate("Tôm sú")).toBeNull();
    expect(parseSortDate("1.234")).toBeNull();
    expect(parseSortDate("32/13/2026")).toBeNull();
  });
});

describe("inferSortKind — đoán kiểu cột từ chữ", () => {
  it("ngày / số / chữ", () => {
    expect(inferSortKind(["01/10/2026", "", "05/10/2026"])).toBe("date");
    expect(inferSortKind(["1.234 kg", "30 kg", "—"])).toBe("number");
    expect(inferSortKind(["Lô 12 cá ngừ", "30"])).toBe("text");
    expect(inferSortKind([])).toBe("text");
  });
  it("size hải sản dạng a/b KHÔNG bị coi là ngày (thiếu năm)", () => {
    const sizes = ["1/2", "2/4", "4/6", "6/8", "8/12", "10/12", "1/6"];
    expect(inferSortKind(sizes)).toBe("text");
    // Sắp như chữ có số: 1/2 < 1/6 < 2/4 … < 10/12 (trước đây "1/6" bị xếp như ngày 1 tháng 6).
    expect(sortRows(sizes, (r) => r, inferSortKind(sizes), "asc")).toEqual(["1/2", "1/6", "2/4", "4/6", "6/8", "8/12", "10/12"]);
    expect(inferSortKind(["16/20", "21/25", "8/12"])).toBe("text");
  });
  it("ngày có năm vẫn nhận là ngày; tháng/năm và ISO cũng vậy", () => {
    expect(inferSortKind(["05/10/2026", "1/9/2026 14:30"])).toBe("date");
    expect(inferSortKind(["9/2026", "T10/2026", "2026-10-05"])).toBe("date");
    expect(inferSortKind(["05/10", "06/10"])).toBe("text");
  });
});

describe("sortRows — mỗi kiểu một cách so", () => {
  it("chữ theo tiếng Việt, số trong chữ so theo giá trị", () => {
    const rows = ["Lô 10", "Lô 2", "Đông", "Cá", "Khô"];
    expect(sortRows(rows, (r) => r, "text", "asc")).toEqual(["Cá", "Đông", "Khô", "Lô 2", "Lô 10"]);
    expect(sortRows(rows, (r) => r, "text", "desc")).toEqual(["Lô 10", "Lô 2", "Khô", "Đông", "Cá"]);
  });
  it("số bé → lớn theo giá trị, không theo chữ", () => {
    const rows = ["1.200", "30", "(5)", "250,5"];
    expect(sortRows(rows, (r) => r, "number", "asc")).toEqual(["(5)", "30", "250,5", "1.200"]);
  });
  it("ngày cũ → mới qua năm (chữ dd/mm/yyyy so sai nếu so chữ)", () => {
    const rows = ["05/01/2027", "30/12/2026", "01/10/2026"];
    expect(sortRows(rows, (r) => r, "date", "asc")).toEqual(["01/10/2026", "30/12/2026", "05/01/2027"]);
    expect(sortRows(rows, (r) => r, "date", "desc")).toEqual(["05/01/2027", "30/12/2026", "01/10/2026"]);
  });
  it("ô trống luôn xếp cuối ở cả hai chiều", () => {
    const rows: (number | null)[] = [3, null, 1, 2];
    expect(sortRows(rows, (r) => r, "number", "asc")).toEqual([1, 2, 3, null]);
    expect(sortRows(rows, (r) => r, "number", "desc")).toEqual([3, 2, 1, null]);
  });
  it("ổn định: dòng bằng nhau giữ thứ tự gốc", () => {
    const rows = [{ id: "a", kg: 1 }, { id: "b", kg: 1 }, { id: "c", kg: 0 }];
    expect(sortRows(rows, (r) => r.kg, "number", "asc").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
});

describe("nodeText — chữ đang hiện trong ô", () => {
  it("gom chữ lồng trong phần tử", () => {
    const node = React.createElement("span", null, "1.234", React.createElement("small", null, "kg"));
    expect(nodeText(node)).toBe("1.234 kg");
  });
  it("ô nhập lấy value", () => {
    expect(nodeText(React.createElement("input", { value: "30" }))).toBe("30");
  });
  it("rỗng / boolean ⇒ chuỗi rỗng", () => {
    expect(nodeText(null)).toBe("");
    expect(nodeText(false)).toBe("");
  });
});
