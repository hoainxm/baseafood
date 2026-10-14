import { describe, it, expect } from "vitest";
import {
  BATTER_TYPE_SEED,
  getProductBatterIds,
  listVisibleBatters,
  sumBatterByType,
  sanitizeBatterKg,
  isBatteredProduct,
  toShortBatterLabel,
  inferBattersFromName,
  findOrCreateBatter,
  getProductBatterNames,
  sumBatterKg,
  computeBatterRatio,
} from "./batter";

// Luật bột tẩm (chốt 2026-10-06): mỗi mặt hàng tẩm bột đi kèm một bộ loại bột,
// mỗi loại một lượng kg riêng; bột là phụ gia — không cộng vào kg thành phẩm.

describe("getProductBatterIds", () => {
  it("nhận mảng từ DB lẫn chuỗi 'a,b' từ form danh mục — bỏ trống, bỏ trùng, giữ thứ tự", () => {
    expect(getProductBatterIds({ batterIds: ["bot-24v", "bot-18v"] })).toEqual(["bot-24v", "bot-18v"]);
    expect(getProductBatterIds({ batterIds: "bot-24v, bot-18v,,bot-24v" })).toEqual(["bot-24v", "bot-18v"]);
    expect(getProductBatterIds({ batterIds: "" })).toEqual([]);
    expect(getProductBatterIds(undefined)).toEqual([]);
  });
});

describe("getProductBatterNames", () => {
  it("ra TÊN theo thứ tự gắn, bỏ id đã xoá khỏi danh mục", () => {
    expect(
      getProductBatterNames({ batterIds: ["bot-220h", "bot-mat", "bot-24v"] }, BATTER_TYPE_SEED)
    ).toEqual(["Bột 220H", "Bột 24V"]);
  });
});

describe("isBatteredProduct", () => {
  it("đã gắn bột, hoặc kiểu chế biến / tên có 'bột' ⇒ tẩm bột", () => {
    expect(isBatteredProduct({ name: "X", processingType: "", batterIds: ["bot-232"] })).toBe(true);
    expect(isBatteredProduct({ name: "X", processingType: "Tẩm bột", batterIds: [] })).toBe(true);
    expect(isBatteredProduct({ name: "Bạch tuộc tẩm bột Lucky", processingType: "Cắt luộc" })).toBe(true);
    expect(isBatteredProduct({ name: "2 da luộc 2g", processingType: "Luộc", batterIds: "" })).toBe(false);
    expect(isBatteredProduct(undefined)).toBe(false);
  });
});

describe("inferBattersFromName — 2 nhóm đã chốt, khớp migration 0051", () => {
  it("tẩm bột nước tương = 24V + 18V + 220H", () => {
    expect(inferBattersFromName("Bạch tuộc 2 da tẩm bột nước tương")).toEqual([
      "bot-24v",
      "bot-18v",
      "bot-220h",
    ]);
  });
  it("tẩm bột 5-10 = 232 + 20802 (chịu khoảng trắng quanh gạch)", () => {
    expect(inferBattersFromName("Bạch tuộc 2 da tẩm bột 5-10")).toEqual(["bot-232", "bot-20802"]);
    expect(inferBattersFromName("Bạch tuộc tẩm bột 5 - 10")).toEqual(["bot-232", "bot-20802"]);
  });
  it("không rõ thì để trống — không đoán (5-100, 6-10, luộc…)", () => {
    expect(inferBattersFromName("Bạch tuộc 2 da tẩm bột 5-100")).toEqual([]);
    expect(inferBattersFromName("Bạch tuộc 2 da tẩm bột 6-10")).toEqual([]);
    expect(inferBattersFromName("Bạch tuộc 2 da luộc 5-10")).toEqual([]);
  });
  it("mọi id suy ra đều có trong seed loại bột", () => {
    const ids = new Set(BATTER_TYPE_SEED.map((b) => b.id));
    for (const name of ["tẩm bột nước tương", "tẩm bột 5-10"])
      for (const id of inferBattersFromName(name)) expect(ids.has(id)).toBe(true);
  });
});

describe("sanitizeBatterKg / sumBatterKg", () => {
  it("bỏ ô ≤ 0 / không phải số, trim + gộp trùng tên", () => {
    expect(sanitizeBatterKg({ "Bột 24V": 12, " Bột 24V ": 3, "Bột 18V": 0, x: "abc", "": 5 })).toEqual({
      "Bột 24V": 15,
    });
  });
  it("đọc được chuỗi JSON (bản sao localStorage); hỏng/không phải object ⇒ rỗng", () => {
    expect(sanitizeBatterKg('{"Bột 232": 4.5}')).toEqual({ "Bột 232": 4.5 });
    expect(sanitizeBatterKg("không phải json")).toEqual({});
    expect(sanitizeBatterKg([1, 2])).toEqual({});
    expect(sanitizeBatterKg(null)).toEqual({});
  });
  it("tổng bột = cộng các loại hợp lệ", () => {
    expect(sumBatterKg({ "Bột 24V": 12, "Bột 18V": 30, "Bột 220H": 5 })).toBe(47);
    expect(sumBatterKg(undefined)).toBe(0);
  });
});

describe("computeBatterRatio", () => {
  it("% bột trên thành phẩm; chưa có TP hoặc chưa có bột ⇒ null", () => {
    expect(computeBatterRatio(47, 470)).toBeCloseTo(10);
    expect(computeBatterRatio(47, 0)).toBeNull();
    expect(computeBatterRatio(0, 100)).toBeNull();
  });
});

describe("sumBatterByType", () => {
  it("cộng dồn kg + đếm số dòng mỗi loại, nhiều kg đứng trước", () => {
    expect(
      sumBatterByType([
        { "Bột 24V": 10, "Bột 18V": 30 },
        { "Bột 24V": 5, "Bột 18V": 0 },
        undefined,
      ])
    ).toEqual([
      { name: "Bột 18V", kg: 30, rowCount: 1 },
      { name: "Bột 24V", kg: 15, rowCount: 2 },
    ]);
  });
});

describe("toShortBatterLabel / listVisibleBatters", () => {
  it("bỏ tiền tố 'Bột '", () => {
    expect(toShortBatterLabel("Bột 24V")).toBe("24V");
    expect(toShortBatterLabel("bột 232")).toBe("232");
    expect(toShortBatterLabel("Chiên xù")).toBe("Chiên xù");
  });
  it("bột đi kèm trước, loại nhập thêm sau — giữ cả ô đang trống", () => {
    expect(listVisibleBatters(["Bột 24V", "Bột 18V"], { "Bột 2204": 0, "Bột 24V": 3 })).toEqual([
      "Bột 24V",
      "Bột 18V",
      "Bột 2204",
    ]);
  });
});

describe("findOrCreateBatter — tạo loại bột tại chỗ, không đẻ bản trùng", () => {
  it("gõ trùng tên / mã / tên ngắn ⇒ dùng lại loại có sẵn", () => {
    for (const typed of ["Bột 20802", "bột 20802", "20802", " 20802 "]) {
      const result = findOrCreateBatter(BATTER_TYPE_SEED, typed);
      expect(result.isNew).toBe(false);
      expect(result.batter.id).toBe("bot-20802");
      expect(result.rows).toBe(BATTER_TYPE_SEED);
    }
  });
  it("gõ mã trơn mới ⇒ tạo 'Bột <mã>' kèm mã; gõ có tiền tố ⇒ giữ nguyên tên", () => {
    const a = findOrCreateBatter(BATTER_TYPE_SEED, "25X");
    expect(a.isNew).toBe(true);
    expect(a.batter.name).toBe("Bột 25X");
    expect(a.batter.code).toBe("25X");
    expect(a.rows).toHaveLength(BATTER_TYPE_SEED.length + 1);
    const b = findOrCreateBatter(BATTER_TYPE_SEED, "Bột chiên xù");
    expect(b.batter.name).toBe("Bột chiên xù");
    expect(b.batter.code).toBe("");
  });
});
