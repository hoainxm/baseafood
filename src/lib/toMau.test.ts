import { describe, expect, it } from "vitest";
import type { RowMark } from "@/types";
import { chuanMau, datDau, dauCuaBang, idDauTo } from "./toMau";

const dau = (p: Partial<RowMark> & Pick<RowMark, "tableKey" | "rowId">): RowMark => ({
  id: idDauTo(p.tableKey, p.rowId, p.columnKey ?? null),
  columnKey: null,
  color: "vang",
  bold: false,
  markedBy: "a",
  markedAt: "2026-10-06T00:00:00.000Z",
  ...p,
});

describe("idDauTo", () => {
  it("tất định theo bảng + dòng, cả dòng là *", () => {
    expect(idDauTo("ton-kho-thang", "msl|1")).toBe("ton-kho-thang::msl|1::*");
    expect(idDauTo("ton-kho-thang", "msl|1", "odKg")).toBe("ton-kho-thang::msl|1::odKg");
  });
});

describe("chuanMau", () => {
  it("mã lạ coi như không màu", () => {
    expect(chuanMau("vang")).toBe("vang");
    expect(chuanMau("tim")).toBe("");
    expect(chuanMau("")).toBe("");
  });
});

describe("dauCuaBang", () => {
  it("chỉ lấy dấu cả dòng của đúng bảng", () => {
    const m = [
      dau({ tableKey: "a", rowId: "1" }),
      dau({ tableKey: "b", rowId: "1", color: "do" }),
      dau({ tableKey: "a", rowId: "2", columnKey: "kg" }),
      dau({ tableKey: "a", rowId: "3", color: "", bold: true }),
      dau({ tableKey: "a", rowId: "4", color: "tim", bold: false }), // màu lạ, không đậm ⇒ bỏ
    ];
    const r = dauCuaBang(m, "a");
    expect([...r.keys()]).toEqual(["1", "3"]);
    expect(r.get("1")).toEqual({ mau: "vang", dam: false });
    expect(r.get("3")).toEqual({ mau: "", dam: true });
  });
});

describe("datDau", () => {
  const luc = "2026-10-06T08:00:00.000Z";

  it("tô nhiều dòng, giữ dấu bảng khác", () => {
    const cu = [dau({ tableKey: "b", rowId: "1" })];
    const moi = datDau(cu, "a", ["1", "2"], { mau: "xanh-la", dam: true }, "truc", luc);
    expect(moi).toHaveLength(3);
    expect(moi[0]).toBe(cu[0]);
    expect(moi.slice(1).map((m) => [m.id, m.color, m.bold, m.markedBy])).toEqual([
      ["a::1::*", "xanh-la", true, "truc"],
      ["a::2::*", "xanh-la", true, "truc"],
    ]);
  });

  it("tô lại cùng dòng chỉ cập nhật, không đẻ dấu trùng", () => {
    const cu = datDau([], "a", ["1"], { mau: "vang", dam: false }, "x", luc);
    const moi = datDau(cu, "a", ["1", "1"], { mau: "do", dam: false }, "y", luc);
    expect(moi).toHaveLength(1);
    expect(moi[0].color).toBe("do");
    expect(moi[0].markedBy).toBe("y");
  });

  it("không đổi gì thì giữ nguyên object cũ (repo khỏi đẩy thừa)", () => {
    const cu = datDau([], "a", ["1"], { mau: "vang", dam: true }, "x", luc);
    const moi = datDau(cu, "a", ["1"], { mau: "vang", dam: true }, "y", "2026-10-07T00:00:00.000Z");
    expect(moi[0]).toBe(cu[0]);
  });

  it("bỏ tô = xoá dấu (null hoặc không màu + không đậm)", () => {
    const cu = datDau([], "a", ["1", "2"], { mau: "vang", dam: true }, "x", luc);
    expect(datDau(cu, "a", ["1"], null, "x").map((m) => m.rowId)).toEqual(["2"]);
    expect(datDau(cu, "a", ["2"], { mau: "", dam: false }, "x").map((m) => m.rowId)).toEqual(["1"]);
  });

  it("chỉ in đậm, không màu vẫn là một dấu", () => {
    const moi = datDau([], "a", ["1"], { mau: "", dam: true }, "x", luc);
    expect(moi).toHaveLength(1);
    expect(dauCuaBang(moi, "a").get("1")).toEqual({ mau: "", dam: true });
  });
});
