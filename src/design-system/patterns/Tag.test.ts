import { describe, expect, test } from "vitest";
import { sacKenh, sacNhomNL, sacTheoTen, sacXuong } from "./Nhan";

describe("sắc nhãn phân loại", () => {
  test("xưởng Đông / Cá / Khô nhận đúng sắc (chữ có dấu)", () => {
    expect(sacXuong("Xưởng Đông")).toBe("bien");
    expect(sacXuong("Đông")).toBe("bien");
    expect(sacXuong("Xưởng Cá")).toBe("ngoc");
    expect(sacXuong("xưởng khô")).toBe("cam");
    expect(sacXuong("Kho lớn")).toBe("xam");
    expect(sacXuong("Cáp")).toBe("xam");
  });
  test("kênh + nhóm NL", () => {
    expect(sacKenh("Xuất khẩu")).toBe("tim");
    expect(sacKenh("Nội địa")).toBe("ngoc");
    expect(sacNhomNL("Thủy sản")).toBe("bien");
    expect(sacNhomNL("Xả đông")).toBe("bang");
    expect(sacNhomNL("Bột phụ gia")).toBe("cat");
    expect(sacNhomNL("Giảm — trừ khỏi kỳ")).toBe("hong");
  });
  test("sacTheoTen ổn định, không phân biệt hoa thường / khoảng trắng", () => {
    expect(sacTheoTen("Kho Hồng Phú")).toBe(sacTheoTen("  kho  hồng phú "));
    expect(sacTheoTen("")).toBe("xam");
  });
});
