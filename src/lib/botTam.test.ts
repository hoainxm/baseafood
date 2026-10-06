import { describe, it, expect } from "vitest";
import {
  BOT_TAM_SEED,
  botDiKemIds,
  botHienTrenDong,
  congBotTheoLoai,
  lamSachBot,
  laMatHangTamBot,
  nhanBotNgan,
  suyBotDiKem,
  taoHoacLayBot,
  tenBotDiKem,
  tongBot,
  tyLeBot,
} from "./botTam";

// Luật bột tẩm (chốt 2026-10-06): mỗi mặt hàng tẩm bột đi kèm một bộ loại bột,
// mỗi loại một lượng kg riêng; bột là phụ gia — không cộng vào kg thành phẩm.

describe("botDiKemIds", () => {
  it("nhận mảng từ DB lẫn chuỗi 'a,b' từ form danh mục — bỏ trống, bỏ trùng, giữ thứ tự", () => {
    expect(botDiKemIds({ batterIds: ["bot-24v", "bot-18v"] })).toEqual(["bot-24v", "bot-18v"]);
    expect(botDiKemIds({ batterIds: "bot-24v, bot-18v,,bot-24v" })).toEqual(["bot-24v", "bot-18v"]);
    expect(botDiKemIds({ batterIds: "" })).toEqual([]);
    expect(botDiKemIds(undefined)).toEqual([]);
  });
});

describe("tenBotDiKem", () => {
  it("ra TÊN theo thứ tự gắn, bỏ id đã xoá khỏi danh mục", () => {
    expect(
      tenBotDiKem({ batterIds: ["bot-220h", "bot-mat", "bot-24v"] }, BOT_TAM_SEED)
    ).toEqual(["Bột 220H", "Bột 24V"]);
  });
});

describe("laMatHangTamBot", () => {
  it("đã gắn bột, hoặc kiểu chế biến / tên có 'bột' ⇒ tẩm bột", () => {
    expect(laMatHangTamBot({ name: "X", processingType: "", batterIds: ["bot-232"] })).toBe(true);
    expect(laMatHangTamBot({ name: "X", processingType: "Tẩm bột", batterIds: [] })).toBe(true);
    expect(laMatHangTamBot({ name: "Bạch tuộc tẩm bột Lucky", processingType: "Cắt luộc" })).toBe(true);
    expect(laMatHangTamBot({ name: "2 da luộc 2g", processingType: "Luộc", batterIds: "" })).toBe(false);
    expect(laMatHangTamBot(undefined)).toBe(false);
  });
});

describe("suyBotDiKem — 2 nhóm đã chốt, khớp migration 0051", () => {
  it("tẩm bột nước tương = 24V + 18V + 220H", () => {
    expect(suyBotDiKem("Bạch tuộc 2 da tẩm bột nước tương")).toEqual([
      "bot-24v",
      "bot-18v",
      "bot-220h",
    ]);
  });
  it("tẩm bột 5-10 = 232 + 20802 (chịu khoảng trắng quanh gạch)", () => {
    expect(suyBotDiKem("Bạch tuộc 2 da tẩm bột 5-10")).toEqual(["bot-232", "bot-20802"]);
    expect(suyBotDiKem("Bạch tuộc tẩm bột 5 - 10")).toEqual(["bot-232", "bot-20802"]);
  });
  it("không rõ thì để trống — không đoán (5-100, 6-10, luộc…)", () => {
    expect(suyBotDiKem("Bạch tuộc 2 da tẩm bột 5-100")).toEqual([]);
    expect(suyBotDiKem("Bạch tuộc 2 da tẩm bột 6-10")).toEqual([]);
    expect(suyBotDiKem("Bạch tuộc 2 da luộc 5-10")).toEqual([]);
  });
  it("mọi id suy ra đều có trong seed loại bột", () => {
    const ids = new Set(BOT_TAM_SEED.map((b) => b.id));
    for (const ten of ["tẩm bột nước tương", "tẩm bột 5-10"])
      for (const id of suyBotDiKem(ten)) expect(ids.has(id)).toBe(true);
  });
});

describe("lamSachBot / tongBot", () => {
  it("bỏ ô ≤ 0 / không phải số, trim + gộp trùng tên", () => {
    expect(lamSachBot({ "Bột 24V": 12, " Bột 24V ": 3, "Bột 18V": 0, x: "abc", "": 5 })).toEqual({
      "Bột 24V": 15,
    });
  });
  it("đọc được chuỗi JSON (bản sao localStorage); hỏng/không phải object ⇒ rỗng", () => {
    expect(lamSachBot('{"Bột 232": 4.5}')).toEqual({ "Bột 232": 4.5 });
    expect(lamSachBot("không phải json")).toEqual({});
    expect(lamSachBot([1, 2])).toEqual({});
    expect(lamSachBot(null)).toEqual({});
  });
  it("tổng bột = cộng các loại hợp lệ", () => {
    expect(tongBot({ "Bột 24V": 12, "Bột 18V": 30, "Bột 220H": 5 })).toBe(47);
    expect(tongBot(undefined)).toBe(0);
  });
});

describe("tyLeBot", () => {
  it("% bột trên thành phẩm; chưa có TP hoặc chưa có bột ⇒ null", () => {
    expect(tyLeBot(47, 470)).toBeCloseTo(10);
    expect(tyLeBot(47, 0)).toBeNull();
    expect(tyLeBot(0, 100)).toBeNull();
  });
});

describe("congBotTheoLoai", () => {
  it("cộng dồn kg + đếm số dòng mỗi loại, nhiều kg đứng trước", () => {
    expect(
      congBotTheoLoai([
        { "Bột 24V": 10, "Bột 18V": 30 },
        { "Bột 24V": 5, "Bột 18V": 0 },
        undefined,
      ])
    ).toEqual([
      { ten: "Bột 18V", kg: 30, soDong: 1 },
      { ten: "Bột 24V", kg: 15, soDong: 2 },
    ]);
  });
});

describe("nhanBotNgan / botHienTrenDong", () => {
  it("bỏ tiền tố 'Bột '", () => {
    expect(nhanBotNgan("Bột 24V")).toBe("24V");
    expect(nhanBotNgan("bột 232")).toBe("232");
    expect(nhanBotNgan("Chiên xù")).toBe("Chiên xù");
  });
  it("bột đi kèm trước, loại nhập thêm sau — giữ cả ô đang trống", () => {
    expect(botHienTrenDong(["Bột 24V", "Bột 18V"], { "Bột 2204": 0, "Bột 24V": 3 })).toEqual([
      "Bột 24V",
      "Bột 18V",
      "Bột 2204",
    ]);
  });
});

describe("taoHoacLayBot — tạo loại bột tại chỗ, không đẻ bản trùng", () => {
  it("gõ trùng tên / mã / tên ngắn ⇒ dùng lại loại có sẵn", () => {
    for (const go of ["Bột 20802", "bột 20802", "20802", " 20802 "]) {
      const kq = taoHoacLayBot(BOT_TAM_SEED, go);
      expect(kq.moi).toBe(false);
      expect(kq.bot.id).toBe("bot-20802");
      expect(kq.rows).toBe(BOT_TAM_SEED);
    }
  });
  it("gõ mã trơn mới ⇒ tạo 'Bột <mã>' kèm mã; gõ có tiền tố ⇒ giữ nguyên tên", () => {
    const a = taoHoacLayBot(BOT_TAM_SEED, "25X");
    expect(a.moi).toBe(true);
    expect(a.bot.name).toBe("Bột 25X");
    expect(a.bot.code).toBe("25X");
    expect(a.rows).toHaveLength(BOT_TAM_SEED.length + 1);
    const b = taoHoacLayBot(BOT_TAM_SEED, "Bột chiên xù");
    expect(b.bot.name).toBe("Bột chiên xù");
    expect(b.bot.code).toBe("");
  });
});
