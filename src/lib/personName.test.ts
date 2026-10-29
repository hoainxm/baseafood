import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scopeContextFor, rowInScope } from "./permissions";
import { callName, checkDisplayName, isDisplayNameAvailable, personLabel, personSearchText, recordName } from "./personName";

const truc = { fullName: "Nguyễn Như Thanh Trúc", displayName: "Alley", username: "nnttruc" };
const mai = { fullName: "Trần Thị Mai", username: "ttmai" };
const bin = { fullName: "Lê Văn Bình", displayName: "Bin", username: "lvbinh" };

describe("ba-spec 47 — tên ghi sổ / tên gọi / nhãn chọn người", () => {
  it("AC-3: tên ghi sổ không bao giờ là tên gọi", () => {
    expect(recordName(truc)).toBe("Nguyễn Như Thanh Trúc");
    expect(recordName({ ...truc, fullName: "" })).toBe("nnttruc");
    expect(callName(truc)).toBe("Alley");
    expect(callName({ ...truc, fullName: "" })).toBe("Alley");
    expect(recordName(null, "Máy này")).toBe("Máy này");
  });

  it("AC-9: người chưa có tên gọi — mọi tên y như họ tên", () => {
    expect(callName(mai)).toBe("Trần Thị Mai");
    expect(recordName(mai)).toBe("Trần Thị Mai");
    expect(personLabel(mai)).toBe("Trần Thị Mai");
    expect(callName({ ...mai, displayName: "" })).toBe("Trần Thị Mai");
  });

  it("AC-6: nhãn người khác thấy có cả tên gọi lẫn họ tên; tìm được bằng 3 tên", () => {
    expect(personLabel(truc)).toContain("Alley");
    expect(personLabel(truc)).toContain("Nguyễn Như Thanh Trúc");
    expect(personLabel(mai)).not.toContain("·");
    const people = [truc, mai, bin];
    for (const q of ["alley", "trúc", "nnttruc"]) {
      const hits = people.filter((p) => personSearchText(p).toLowerCase().includes(q));
      expect(hits).toHaveLength(1);
      expect(hits[0]).toBe(truc);
    }
  });

  it("AC-7: kiểm tên gọi (R5)", () => {
    const others = [mai, bin];
    expect(checkDisplayName("  Alley  ", truc, others)).toEqual({ value: "Alley" });
    expect(checkDisplayName("x".repeat(31), truc, others).error).toMatch(/30 ký tự/);
    expect(checkDisplayName("tran thi mai", truc, others).error).toMatch(/Trùng/);
    expect(checkDisplayName("BIN", truc, others).error).toMatch(/Trùng/);
    expect(checkDisplayName("nguyen nhu thanh truc", truc, others)).toEqual({ value: "" });
    expect(checkDisplayName("", truc, others)).toEqual({ value: "" });
  });

  it("AC-4: phạm vi `own` không xét tên gọi", () => {
    const ctx = scopeContextFor(["ke-toan"], recordName(truc), truc.username);
    expect(ctx.identities).toHaveLength(2);
    expect(ctx.identities).not.toContain("Alley");
    expect(rowInScope("own", ctx, { operator: "Nguyễn Như Thanh Trúc" })).toBe(true);
    // Người khác lỡ có tên gọi = họ tên Trúc vẫn không sửa được dòng của Trúc.
    const imposter = { fullName: "Phạm Văn An", displayName: "Nguyễn Như Thanh Trúc", username: "pvan" };
    const ctx2 = scopeContextFor([], recordName(imposter), imposter.username);
    expect(rowInScope("own", ctx2, { operator: "Nguyễn Như Thanh Trúc" })).toBe(false);
  });

  it("dò cột 0086: hồ sơ đọc về có trường ⇒ có; localStorage ⇒ luôn có", () => {
    expect(isDisplayNameAvailable([{}, {}], true)).toBe(false);
    expect(isDisplayNameAvailable([{}, { displayName: "" }], true)).toBe(true);
    expect(isDisplayNameAvailable([], false)).toBe(true);
  });
});

// AC-3 (quét mã): màn hình KHÔNG đọc thẳng `displayName` — mọi tên đi qua lib/personName.ts, để
// tên gọi không bao giờ lọt vào người ghi / người lập / người nhận việc. Ngoại lệ: chỗ NHẬP tên gọi.
const DISPLAY_NAME_EDITORS = new Set(["users/UserManagementScreen.tsx", "shared/AccountMenu.tsx"]);

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("AC-3 quét mã — màn hình không đọc thẳng tên gọi", () => {
  it("chỉ chỗ nhập tên gọi mới đụng `displayName`", () => {
    const root = join(__dirname, "..", "features");
    const offenders = listFiles(root)
      .map((p) => p.slice(root.length + 1).replace(/\\/g, "/"))
      .filter((rel) => !DISPLAY_NAME_EDITORS.has(rel))
      // Chỉ bắt TRUY CẬP trường hồ sơ (`x.displayName`, `x?.displayName`); prop chuỗi tên
      // `displayName` của AppShell / SetOwnPasswordScreen (đã là tên gọi do App tính sẵn) không tính.
      .filter((rel) => /\??\.displayName\b/.test(readFileSync(join(root, rel), "utf8")));
    expect(offenders).toEqual([]);
  });
});
