import { describe, it, expect } from "vitest";
import type { Product } from "@/types";
import { describeProductUsage, findProductUsage, productDeleteBlocker, type ProductUsageSources } from "./productUsage";

// Dọn danh mục ngay trong ô chọn: chỉ xóa được mặt hàng CHƯA nằm trong sổ nào và
// không gắn 141 mã kế toán.

const empty: ProductUsageSources = {
  wips: [],
  packagings: [],
  salesItems: [],
  orderItems: [],
  exportItems: [],
  balancingOutputs: [],
  finishedOpeningStock: [],
};
const product = (p: Partial<Product>): Product => ({ id: "p1", code: "", name: "2 DA  <80GR", finishedGoodCode: "", ...p });

describe("findProductUsage", () => {
  it("không sổ nào dùng ⇒ rỗng", () => {
    expect(findProductUsage("p1", empty)).toEqual([]);
  });

  it("đếm theo từng sổ, bỏ sổ không có dòng", () => {
    const usages = findProductUsage("p1", {
      ...empty,
      wips: [{ productId: "p1" }, { productId: "p1" }, { productId: "p2" }],
      salesItems: [{ productId: "p1" }],
    });
    expect(usages).toEqual([
      { ledger: "sản xuất (/wip)", count: 2 },
      { ledger: "bán hàng", count: 1 },
    ]);
    expect(describeProductUsage(usages)).toBe("2 dòng sản xuất (/wip) · 1 dòng bán hàng");
  });

  it("đóng gói tính cả mặt hàng tiêu hao lẫn mặt hàng ra", () => {
    const usages = findProductUsage("p1", {
      ...empty,
      packagings: [
        { fromProductId: "p1", toProductId: "p9" },
        { fromProductId: "p8", toProductId: "p1" },
        { fromProductId: "p8", toProductId: "p9" },
      ],
    });
    expect(usages).toEqual([{ ledger: "đóng gói", count: 2 }]);
  });

  it("cân đối, đơn đặt, lệnh xuất, tồn đầu TP đều chặn", () => {
    const usages = findProductUsage("p1", {
      ...empty,
      orderItems: [{ productId: "p1" }],
      exportItems: [{ productId: "p1" }],
      balancingOutputs: [{ productId: "p1" }],
      finishedOpeningStock: [{ productId: "p1" }],
    });
    expect(usages.map((u) => u.ledger)).toEqual(["đơn đặt", "lệnh xuất", "cân đối", "tồn đầu thành phẩm"]);
  });
});

describe("productDeleteBlocker", () => {
  it("chưa dùng, không mã kế toán ⇒ xóa được", () => {
    expect(productDeleteBlocker(product({}), [])).toBe("");
  });

  it("gắn mã kế toán 141 ⇒ chặn dù chưa dùng", () => {
    expect(productDeleteBlocker(product({ finishedGoodCode: "BT-TIP" }), [])).toMatch(/mã kế toán BT-TIP/);
  });

  it("đã có trong sổ ⇒ chặn, nêu đúng sổ", () => {
    const msg = productDeleteBlocker(product({}), [{ ledger: "sản xuất (/wip)", count: 3 }]);
    expect(msg).toMatch(/3 dòng sản xuất/);
  });
});
