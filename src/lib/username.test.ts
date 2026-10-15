import { describe, expect, it } from "vitest";
import { fullNameToUsername, normalizeUsername, usernameToEmail } from "./username";

describe("tên đăng nhập — chỉ chữ thường không dấu + số (bỏ dấu chấm, chốt 2026-10-15)", () => {
  it("chuẩn hoá bỏ dấu chấm / khoảng trắng / dấu tiếng Việt", () => {
    expect(normalizeUsername("nnt.truc")).toBe("nnttruc");
    expect(normalizeUsername(" Ttm.Hạnh ")).toBe("ttmhanh");
    expect(normalizeUsername("đặng-văn_a 2")).toBe("dangvana2");
  });
  it("sinh từ họ tên không bao giờ có dấu chấm", () => {
    expect(fullNameToUsername("Nguyễn Như Thanh Trúc")).toBe("nnttruc");
    expect(fullNameToUsername("Phan Nguyễn Hoài Nam")).toBe("pnhnam");
    expect(fullNameToUsername("Đ.Văn")).toBe("dvan");
  });
  it("đăng nhập gõ có dấu chấm vẫn vào đúng tài khoản không dấu chấm; gõ email thì giữ", () => {
    expect(usernameToEmail("nnt.truc")).toBe("nnttruc@bsf1.vn");
    expect(usernameToEmail("NNTTRUC")).toBe("nnttruc@bsf1.vn");
    expect(usernameToEmail("someone@bsf1.vn")).toBe("someone@bsf1.vn");
  });
});
