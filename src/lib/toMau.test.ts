import { describe, expect, it } from "vitest";
import type { RowMark } from "@/types";
import { chuanMau, datDau, dauCuaBang, idDauTo, khoaO } from "./toMau";

const dau = (p: Partial<RowMark> & Pick<RowMark, "tableKey" | "rowId">): RowMark => ({
  id: idDauTo(p.tableKey, p.rowId, p.columnKey ?? null),
  columnKey: null,
  color: "vang-2",
  bold: false,
  markedBy: "a",
  markedAt: "2026-10-06T00:00:00.000Z",
  ...p,
});

describe("idDauTo", () => {
  it("tất định theo bảng + dòng (+ cột), cả dòng là *", () => {
    expect(idDauTo("ton-kho-thang", "msl|1")).toBe("ton-kho-thang::msl|1::*");
    expect(idDauTo("ton-kho-thang", "msl|1", "odKg")).toBe("ton-kho-thang::msl|1::odKg");
  });
});

describe("chuanMau", () => {
  it("nhận mã sắc-mức 1..5", () => {
    expect(chuanMau("vang-5")).toBe("vang-5");
    expect(chuanMau("tim-1")).toBe("tim-1");
  });
  it("mã cũ 4 màu đọc ra mức 2", () => {
    expect(chuanMau("vang")).toBe("vang-2");
    expect(chuanMau("xanh-la")).toBe("la-2");
    expect(chuanMau("xanh-duong")).toBe("duong-2");
    expect(chuanMau("do")).toBe("do-2");
  });
  it("mã lạ / mức ngoài 1..5 coi như không màu", () => {
    expect(chuanMau("nau-2")).toBe("");
    expect(chuanMau("vang-6")).toBe("");
    expect(chuanMau("")).toBe("");
  });
});

describe("dauCuaBang", () => {
  it("tách dấu dòng và dấu ô của đúng bảng", () => {
    const m = [
      dau({ tableKey: "a", rowId: "1" }),
      dau({ tableKey: "b", rowId: "1", color: "do-3" }),
      dau({ tableKey: "a", rowId: "2", columnKey: "kg", color: "la-4" }),
      dau({ tableKey: "a", rowId: "3", color: "", bold: true }),
      dau({ tableKey: "a", rowId: "4", color: "nau-2", bold: false }), // màu lạ, không đậm ⇒ bỏ
    ];
    const r = dauCuaBang(m, "a");
    expect([...r.dong.keys()]).toEqual(["1", "3"]);
    expect(r.dong.get("1")).toEqual({ mau: "vang-2", dam: false });
    expect(r.dong.get("3")).toEqual({ mau: "", dam: true });
    expect(r.o.get(khoaO("2", "kg"))).toEqual({ mau: "la-4", dam: false });
    expect(r.o.size).toBe(1);
  });
});

describe("datDau", () => {
  const luc = "2026-10-06T08:00:00.000Z";

  it("tô nhiều dòng, giữ dấu bảng khác", () => {
    const cu = [dau({ tableKey: "b", rowId: "1" })];
    const moi = datDau(cu, "a", ["1", "2"], { mau: "la-3", dam: true }, "truc", luc);
    expect(moi).toHaveLength(3);
    expect(moi[0]).toBe(cu[0]);
    expect(moi.slice(1).map((m) => [m.id, m.color, m.bold, m.markedBy])).toEqual([
      ["a::1::*", "la-3", true, "truc"],
      ["a::2::*", "la-3", true, "truc"],
    ]);
  });

  it("tô nhiều Ô một lượt — dấu ô tách khỏi dấu dòng", () => {
    const cu = datDau([], "a", ["1"], { mau: "vang-5", dam: false }, "x", luc);
    const moi = datDau(
      cu,
      "a",
      [
        { dong: "1", cot: "kg" },
        { dong: "2", cot: "kg" },
      ],
      { mau: "do-2", dam: false },
      "x",
      luc
    );
    expect(moi.map((m) => [m.id, m.columnKey, m.color])).toEqual([
      ["a::1::*", null, "vang-5"],
      ["a::1::kg", "kg", "do-2"],
      ["a::2::kg", "kg", "do-2"],
    ]);
    const r = dauCuaBang(moi, "a");
    expect(r.dong.get("1")?.mau).toBe("vang-5");
    expect(r.o.get(khoaO("2", "kg"))?.mau).toBe("do-2");
  });

  it("tô lại cùng chỗ chỉ cập nhật, không đẻ dấu trùng", () => {
    const cu = datDau([], "a", ["1"], { mau: "vang-2", dam: false }, "x", luc);
    const moi = datDau(cu, "a", ["1", "1"], { mau: "do-4", dam: false }, "y", luc);
    expect(moi).toHaveLength(1);
    expect(moi[0].color).toBe("do-4");
    expect(moi[0].markedBy).toBe("y");
  });

  it("không đổi gì thì giữ nguyên object cũ (repo khỏi đẩy thừa)", () => {
    const cu = datDau([], "a", ["1"], { mau: "vang-2", dam: true }, "x", luc);
    const moi = datDau(cu, "a", ["1"], { mau: "vang-2", dam: true }, "y", "2026-10-07T00:00:00.000Z");
    expect(moi[0]).toBe(cu[0]);
  });

  it("bỏ tô = xoá dấu (null hoặc không màu + không đậm)", () => {
    const cu = datDau([], "a", ["1", "2", { dong: "3", cot: "kg" }], { mau: "vang-2", dam: true }, "x", luc);
    expect(datDau(cu, "a", ["1"], null, "x").map((m) => m.id)).toEqual(["a::2::*", "a::3::kg"]);
    expect(datDau(cu, "a", [{ dong: "3", cot: "kg" }], { mau: "", dam: false }, "x").map((m) => m.id)).toEqual([
      "a::1::*",
      "a::2::*",
    ]);
  });

  it("chỉ in đậm, không màu vẫn là một dấu", () => {
    const moi = datDau([], "a", ["1"], { mau: "", dam: true }, "x", luc);
    expect(moi).toHaveLength(1);
    expect(dauCuaBang(moi, "a").dong.get("1")).toEqual({ mau: "", dam: true });
  });
});
