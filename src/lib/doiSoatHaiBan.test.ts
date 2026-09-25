import { describe, expect, it } from "vitest";
import { chuCotExcel, laBenTai, phanBenThue } from "./doiSoatHaiBan";

describe("phanBenThue — chia bản thuế gửi / bản tự tải", () => {
  it("tên sheet có chữ 'thuế' ⇒ bên thuế", () => {
    const r = phanBenThue(["HDDT THUẾ GỬI", "HDDT TỰ TẢI"]);
    expect([...r.benThue]).toEqual(["HDDT THUẾ GỬI"]);
    expect(r.cach).toBe("ten-thue");
  });

  it("không sheet nào có 'thuế' nhưng có sheet 'tải' ⇒ phần còn lại là bên thuế (file thật HDDT/MTT vs CTY TẢI)", () => {
    const r = phanBenThue(["HDDT", "MTT", "HDDT-CTY TẢI", "MTT-CTY TẢI"]);
    expect([...r.benThue].sort()).toEqual(["HDDT", "MTT"]);
    expect(r.cach).toBe("ten-tai");
  });

  it("không nhận ra ⇒ tập rỗng", () => {
    const r = phanBenThue(["CÓ MÃ", "KHÔNG MÃ"]);
    expect(r.benThue.size).toBe(0);
    expect(r.cach).toBe("khong-ro");
  });

  it("mọi sheet đều là 'tải' ⇒ không đoán bừa", () => {
    expect(phanBenThue(["TẢI 1", "TẢI 2"]).cach).toBe("khong-ro");
  });

  it("người dùng chỉ định thắng tên sheet, bỏ tên không tồn tại", () => {
    const r = phanBenThue(["A THUẾ", "B"], ["B", "KHÔNG CÓ"]);
    expect([...r.benThue]).toEqual(["B"]);
    expect(r.cach).toBe("chi-dinh");
  });

  it("'tài khoản' không bị nhận là 'tải' khi đứng trong từ khác", () => {
    expect(laBenTai("DATAI")).toBe(false);
    expect(laBenTai("CTY TẢI")).toBe(true);
  });
});

describe("chuCotExcel", () => {
  it("0-based → chữ cột", () => {
    expect(chuCotExcel(0)).toBe("A");
    expect(chuCotExcel(16)).toBe("Q");
    expect(chuCotExcel(25)).toBe("Z");
    expect(chuCotExcel(26)).toBe("AA");
    expect(chuCotExcel(701)).toBe("ZZ");
  });
});
