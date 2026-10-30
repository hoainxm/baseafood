import { describe, expect, it } from "vitest";
import { findOrCreateGoodsType, goodsTypeName, sortGoodsTypes } from "./goodsTypes";

const rows = [
  { id: "mada", name: "Mada", sortOrder: 30, note: "" },
  { id: "one-skin", name: "1 da", sortOrder: 10, note: "" },
  { id: "two-skin", name: "2 da", sortOrder: 20, note: "" },
];

describe("danh mục Loại hàng (mig 0089)", () => {
  it("xếp theo thứ tự rồi tên", () => {
    expect(sortGoodsTypes(rows).map((r) => r.id)).toEqual(["one-skin", "two-skin", "mada"]);
  });
  it("tên theo id; chưa chọn / đã xóa ⇒ rỗng", () => {
    expect(goodsTypeName(rows, "mada")).toBe("Mada");
    expect(goodsTypeName(rows, "")).toBe("");
    expect(goodsTypeName(rows, "gone")).toBe("");
  });
  it("thêm trong ô chọn: trùng tên dùng lại, mới thì xếp cuối", () => {
    const again = findOrCreateGoodsType("  MADA ", rows, () => "x");
    expect(again).toMatchObject({ id: "mada", created: false });
    expect(again.rows).toHaveLength(3);
    const fresh = findOrCreateGoodsType("Cá  khô", rows, () => "dried");
    expect(fresh.created).toBe(true);
    expect(fresh.rows.at(-1)).toEqual({ id: "dried", name: "Cá khô", sortOrder: 40, note: "" });
  });
});
