import { describe, expect, it } from "vitest";
import { calendarYearRange, parseTypedDate } from "./dateInput";

const TODAY = "2026-11-05";

describe("gõ ngày ở ô lịch (Phòng KH 2026-11-05: ngày năm sau bấm từng tháng lâu)", () => {
  it.each([
    ["31/12/2027", "2027-12-31"],
    ["31-12-2027", "2027-12-31"],
    ["31.12.27", "2027-12-31"],
    ["31 12 2027", "2027-12-31"],
    ["31122027", "2027-12-31"],
    ["311227", "2027-12-31"],
    ["1/2/27", "2027-02-01"],
    ["15/3", "2026-03-15"],
    ["2027-12-31", "2027-12-31"],
  ])("%s ⇒ %s", (text, iso) => expect(parseTypedDate(text, TODAY)).toBe(iso));

  it.each(["", "31/13/2027", "30/02/2027", "abc", "2027", "32/1"])("không đọc được: %s", (text) => expect(parseTypedDate(text, TODAY)).toBe(""));

  it("ô chọn Năm quanh hôm nay ±15, mở rộng theo ngày đang chọn", () => {
    expect(calendarYearRange(TODAY)).toEqual({ from: 2011, to: 2041 });
    expect(calendarYearRange(TODAY, "1998-01-01", undefined)).toEqual({ from: 1998, to: 2041 });
  });
});
