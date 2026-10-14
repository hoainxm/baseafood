import { describe, expect, it } from "vitest";
import { columnIndexToLetter, isDownloadSide, resolveTaxSideSheets } from "./twoVersionReconciliation";

describe("resolveTaxSideSheets — chia bản thuế gửi / bản tự tải", () => {
  it("tên sheet có chữ 'thuế' ⇒ bên thuế", () => {
    const r = resolveTaxSideSheets(["HDDT THUẾ GỬI", "HDDT TỰ TẢI"]);
    expect([...r.taxSide]).toEqual(["HDDT THUẾ GỬI"]);
    expect(r.method).toBe("tax-name");
  });

  it("không sheet nào có 'thuế' nhưng có sheet 'tải' ⇒ phần còn lại là bên thuế (file thật HDDT/MTT vs CTY TẢI)", () => {
    const r = resolveTaxSideSheets(["HDDT", "MTT", "HDDT-CTY TẢI", "MTT-CTY TẢI"]);
    expect([...r.taxSide].sort()).toEqual(["HDDT", "MTT"]);
    expect(r.method).toBe("download-name");
  });

  it("không nhận ra ⇒ tập rỗng", () => {
    const r = resolveTaxSideSheets(["CÓ MÃ", "KHÔNG MÃ"]);
    expect(r.taxSide.size).toBe(0);
    expect(r.method).toBe("unknown");
  });

  it("mọi sheet đều là 'tải' ⇒ không đoán bừa", () => {
    expect(resolveTaxSideSheets(["TẢI 1", "TẢI 2"]).method).toBe("unknown");
  });

  it("người dùng chỉ định thắng tên sheet, bỏ tên không tồn tại", () => {
    const r = resolveTaxSideSheets(["A THUẾ", "B"], ["B", "KHÔNG CÓ"]);
    expect([...r.taxSide]).toEqual(["B"]);
    expect(r.method).toBe("manual");
  });

  it("'tài khoản' không bị nhận là 'tải' khi đứng trong từ khác", () => {
    expect(isDownloadSide("DATAI")).toBe(false);
    expect(isDownloadSide("CTY TẢI")).toBe(true);
  });
});

describe("columnIndexToLetter", () => {
  it("0-based → chữ cột", () => {
    expect(columnIndexToLetter(0)).toBe("A");
    expect(columnIndexToLetter(16)).toBe("Q");
    expect(columnIndexToLetter(25)).toBe("Z");
    expect(columnIndexToLetter(26)).toBe("AA");
    expect(columnIndexToLetter(701)).toBe("ZZ");
  });
});
