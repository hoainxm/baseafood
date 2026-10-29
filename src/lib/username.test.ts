import { describe, expect, it } from "vitest";
import { fullNameToUsername, loginUsernameError, normalizeUsername, usernameToEmail } from "./username";

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
  it("đăng nhập KHÔNG tự bỏ dấu chấm (chốt 2026-10-29); chữ hoa vẫn vào; gõ email thì giữ", () => {
    expect(usernameToEmail("nnt.truc")).toBe("nnt.truc@bsf1.vn");
    expect(usernameToEmail(" NNTTRUC ")).toBe("nnttruc@bsf1.vn");
    expect(usernameToEmail("someone@bsf1.vn")).toBe("someone@bsf1.vn");
  });
});

describe("kiểm tên gõ ở màn đăng nhập", () => {
  it("tên có dấu chấm / dấu tiếng Việt / khoảng trắng giữa / gạch ⇒ báo sai tên đăng nhập", () => {
    for (const bad of ["nnt.truc", "ttm.hanh", "trúc", "nnt truc", "nnt-truc", "nnt_truc"]) {
      expect(loginUsernameError(bad)).toMatch(/^Sai tên đăng nhập/);
    }
  });
  it("tên chuẩn (kể cả chữ hoa, khoảng trắng hai đầu) và email ⇒ hợp lệ", () => {
    for (const ok of ["nnttruc", " NNTTRUC ", "pnhnam2", "someone@bsf1.vn"]) {
      expect(loginUsernameError(ok)).toBeNull();
    }
  });
});
