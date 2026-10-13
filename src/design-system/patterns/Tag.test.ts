import { describe, expect, test } from "vitest";
import { channelTone, toneForMaterialGroup, toneByName, toneForWorkshop } from "./Tag";

describe("sắc nhãn phân loại", () => {
  test("xưởng Đông / Cá / Khô nhận đúng sắc (chữ có dấu)", () => {
    expect(toneForWorkshop("Xưởng Đông")).toBe("bien");
    expect(toneForWorkshop("Đông")).toBe("bien");
    expect(toneForWorkshop("Xưởng Cá")).toBe("ngoc");
    expect(toneForWorkshop("xưởng khô")).toBe("cam");
    expect(toneForWorkshop("Kho lớn")).toBe("xam");
    expect(toneForWorkshop("Cáp")).toBe("xam");
  });
  test("kênh + nhóm NL", () => {
    expect(channelTone("Xuất khẩu")).toBe("tim");
    expect(channelTone("Nội địa")).toBe("ngoc");
    expect(toneForMaterialGroup("Thủy sản")).toBe("bien");
    expect(toneForMaterialGroup("Xả đông")).toBe("bang");
    expect(toneForMaterialGroup("Bột phụ gia")).toBe("cat");
    expect(toneForMaterialGroup("Giảm — trừ khỏi kỳ")).toBe("hong");
  });
  test("toneByName ổn định, không phân biệt hoa thường / khoảng trắng", () => {
    expect(toneByName("Kho Hồng Phú")).toBe(toneByName("  kho  hồng phú "));
    expect(toneByName("")).toBe("xam");
  });
});
