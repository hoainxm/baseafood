import { describe, expect, test } from "vitest";
import { channelTone, toneForMaterialGroup, toneByName, toneForWorkshop } from "./Tag";

describe("sắc nhãn phân loại", () => {
  test("xưởng Đông / Cá / Khô nhận đúng sắc (chữ có dấu)", () => {
    expect(toneForWorkshop("Xưởng Đông")).toBe("blue");
    expect(toneForWorkshop("Đông")).toBe("blue");
    expect(toneForWorkshop("Xưởng Cá")).toBe("teal");
    expect(toneForWorkshop("xưởng khô")).toBe("orange");
    expect(toneForWorkshop("Kho lớn")).toBe("gray");
    expect(toneForWorkshop("Cáp")).toBe("gray");
  });
  test("kênh + nhóm NL", () => {
    expect(channelTone("Xuất khẩu")).toBe("purple");
    expect(channelTone("Nội địa")).toBe("teal");
    expect(toneForMaterialGroup("Thủy sản")).toBe("blue");
    expect(toneForMaterialGroup("Xả đông")).toBe("cyan");
    expect(toneForMaterialGroup("Bột phụ gia")).toBe("sand");
    expect(toneForMaterialGroup("Giảm — trừ khỏi kỳ")).toBe("pink");
  });
  test("toneByName ổn định, không phân biệt hoa thường / khoảng trắng", () => {
    expect(toneByName("Kho Hồng Phú")).toBe(toneByName("  kho  hồng phú "));
    expect(toneByName("")).toBe("gray");
  });
});
