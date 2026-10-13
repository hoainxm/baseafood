import { describe, expect, it } from "vitest";
import {
  extractDeclarations,
  extractRoutes,
  extractSqlIdentifiers,
  fileStem,
  isVietnamese,
  splitIdentifier,
} from "./lexicon.mjs";

describe("splitIdentifier", () => {
  it("tách camelCase, PascalCase, snake, kebab", () => {
    expect(splitIdentifier("useNhapNL")).toEqual(["use", "nhap", "nl"]);
    expect(splitIdentifier("BangTong")).toEqual(["bang", "tong"]);
    expect(splitIdentifier("quantity_kg")).toEqual(["quantity", "kg"]);
    expect(splitIdentifier("ton-kho-thang")).toEqual(["ton", "kho", "thang"]);
  });
});

describe("isVietnamese — tên Việt phải bị bắt", () => {
  it.each([
    "tinhTon",
    "BangTong",
    "useKhopMedia",
    "vaDongCu",
    "moTa", // hai âm tiết mơ hồ đi cặp
    "banHang",
    "co_vai_tro",
    "lot_inputs_nguoi_dung",
    "ton-kho-thang",
    "nxt-nl", // nxt được phép, nl phải dịch
    "doiSoatHddt",
    "hien-len",
  ])("%s", (n) => expect(isVietnamese(n)).toBe(true));
});

describe("isVietnamese — tên tiếng Anh không được bắt nhầm", () => {
  it.each([
    "MaterialImportItem",
    "quantityKg",
    "offsetY",
    "setTimeout",
    "lotDispatches",
    "toRow",
    "mapToRow",
    "goBack",
    "canSave",
    "doneDate",
    "nxtSnapshots", // từ viết tắt nghiệp vụ được phép
    "qcLocks",
    "domestic_sales",
    "has_role",
    "SummaryTable",
    "banner",
    "dongle",
  ])("%s", (n) => expect(isVietnamese(n)).toBe(false));
});

describe("extract*", () => {
  it("bắt khai báo hàm, biến, kiểu — bỏ destructuring", () => {
    const src = `export function tinhTon() {}\nconst { nhan } = p;\nlet soDong = 1;\nexport type DongBang = {};\ninterface Row {}`;
    expect(extractDeclarations(src).sort()).toEqual(["DongBang", "Row", "soDong", "tinhTon"]);
  });
  it("bắt route path", () => {
    expect(extractRoutes(`{ path: "/doi-soat", element: <X/> }`)).toEqual(["/doi-soat"]);
  });
  it("bắt định danh SQL do migration tạo", () => {
    const sql = `create table if not exists public.row_marks (\n  id text,\n  ghi_chu text\n);\ncreate policy "row_marks_nguoi_dung" on x;\nalter table a rename column b to c_moi;`;
    expect(extractSqlIdentifiers(sql)).toEqual(
      expect.arrayContaining(["row_marks", "id", "ghi_chu", "row_marks_nguoi_dung", "c_moi"])
    );
  });
  it("fileStem bỏ đuôi, hậu tố test, số migration", () => {
    expect(fileStem("truyXuatLo.e2e.test.ts")).toBe("truyXuatLo");
    expect(fileStem("0051_bot_tam.sql")).toBe("bot_tam");
    expect(fileStem("GanLoDauVao.tsx")).toBe("GanLoDauVao");
  });
});
