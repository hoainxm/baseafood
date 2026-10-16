import { describe, expect, test } from "vitest";
import type { Product } from "@/types";
import {
  duplicateProductNameKeys,
  fillBlankProductFields,
  findSameNameProducts,
  normalizeProductName,
  remapProductReferences,
} from "./productMerge";

const product = (id: string, name: string, p: Partial<Product> = {}): Product => ({ id, code: "", name, finishedGoodCode: "", ...p });

describe("gộp mặt hàng trùng tên", () => {
  /* Cặp thật trên DB 2026-10-16: cùng tên, hai mã kế toán khác nhau. */
  const products = [
    product("a", "Bạch tuộc 2 da cắt luộc 3gr", { finishedGoodCode: "BT-CAT3GNĐ" }),
    product("b", "Bạch tuộc 2 da  cắt luộc 3GR ", { finishedGoodCode: "BT-CAT3G", category: "Bạch tuộc" }),
    product("c", "Bạch tuộc cắt chần 3gr"),
  ];

  test("so tên không phân hoa thường / khoảng trắng thừa", () => {
    expect(normalizeProductName("  Bạch tuộc 2 da  cắt luộc 3GR ")).toBe("bạch tuộc 2 da cắt luộc 3gr");
    expect(findSameNameProducts(products, "a").map((p) => p.id)).toEqual(["b"]);
    expect(findSameNameProducts(products, "c")).toEqual([]);
    expect([...duplicateProductNameKeys(products)]).toEqual(["bạch tuộc 2 da cắt luộc 3gr"]);
  });

  test("đổi tham chiếu đúng trường, dòng khác giữ nguyên đối tượng", () => {
    const rows = [
      { id: "1", fromProductId: "a", toProductId: "x" },
      { id: "2", fromProductId: "y", toProductId: "a" },
      { id: "3", fromProductId: "y", toProductId: "z" },
    ];
    const r = remapProductReferences(rows, ["fromProductId", "toProductId"], "a", "b");
    expect(r.changed).toBe(2);
    expect(r.rows.map((x) => [x.fromProductId, x.toProductId])).toEqual([["b", "x"], ["y", "b"], ["y", "z"]]);
    expect(r.rows[2]).toBe(rows[2]);
  });

  test("mục giữ chỉ nhận ô ĐANG TRỐNG từ mục bỏ, không đè ô đã có", () => {
    const keep = product("b", "X", { category: "Bạch tuộc", batterIds: [] });
    const drop = product("a", "X", { category: "Mực", processingType: "Cắt luộc", batterIds: ["bot-24v"], code: "12", blockSpecKg: 10 });
    expect(fillBlankProductFields(keep, drop)).toMatchObject({
      category: "Bạch tuộc",
      processingType: "Cắt luộc",
      batterIds: ["bot-24v"],
      code: "12",
      blockSpecKg: 10,
      finishedGoodCode: "",
    });
  });
});
