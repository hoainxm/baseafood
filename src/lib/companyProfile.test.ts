import { describe, expect, it } from "vitest";
import { COMPANY_DEFAULTS, companySellerOf, effectiveCompanyProfile, logoErrors } from "./companyProfile";

describe("ba-spec 67 — thông tin công ty", () => {
  it("AC-1: chưa có thông tin ⇒ người bán = giá trị đang in trên invoice 236/26", () => {
    const s = companySellerOf(null);
    expect(s.name).toBe("BASEAFOOD 1 COMPANY LIMITED");
    expect(s.signature).toBe("BASEAFOOD 1 CO.,LTD");
    expect(s.place).toBe("Ba Ria");
    expect(effectiveCompanyProfile([])).toBe(COMPANY_DEFAULTS);
  });

  it("AC-2: đổi địa chỉ EN ⇒ người bán in địa chỉ mới, viết hoa; ô trống lấy mặc định", () => {
    const s = companySellerOf({ ...COMPANY_DEFAULTS, addressEn: "1 New  Street, Ba Ria", shortNameEn: "" });
    expect(s.address).toBe("1 NEW STREET, BA RIA");
    expect(s.signature).toBe("BASEAFOOD 1 CO.,LTD");
  });

  it("AC-4: logo chỉ kiểm ảnh, không bắt trường khác", () => {
    expect(logoErrors({ size: 100 * 1024, type: "image/png" })).toHaveLength(0);
    expect(logoErrors({ size: 6 * 1024 * 1024, type: "image/png" })).toHaveLength(1);
    expect(logoErrors({ size: 10, type: "application/pdf" })).toHaveLength(1);
  });
});
