import { describe, expect, it } from "vitest";
import {
  LEGACY_VALUES,
  auditActionAliases,
  normalizeAuditAction,
  normalizeExportOrderStatus,
  normalizeLotMethod,
  normalizeQcResult,
  normalizeSalesOrderStatus,
  normalizeStorageKind,
  normalizeWipStatus,
} from "./legacyValues";

// Dòng lưu trước Đợt 5 (máy chủ chưa chạy 0059, bộ đệm máy, hàng chờ offline) mang
// giá trị tiếng Việt — đọc phải ra đúng giá trị mới, không rơi về mặc định.
describe("normalize* — đọc cả giá trị cũ lẫn mới", () => {
  it("giá trị cũ → mới", () => {
    expect(normalizeWipStatus("da-nhap")).toBe("stocked");
    expect(normalizeWipStatus("cho-nhap")).toBe("pending");
    expect(normalizeQcResult("khong-dat")).toBe("fail");
    expect(normalizeQcResult("tam")).toBe("conditional");
    expect(normalizeSalesOrderStatus("du")).toBe("complete");
    expect(normalizeSalesOrderStatus("dong")).toBe("closed");
    expect(normalizeExportOrderStatus("dong")).toBe("closed");
    expect(normalizeExportOrderStatus("mo")).toBe("open");
    expect(normalizeStorageKind("thue-ngoai")).toBe("external");
    expect(normalizeLotMethod("go")).toBe("typed");
    expect(normalizeLotMethod("quet")).toBe("scan");
    expect(normalizeAuditAction("dang-nhap")).toBe("login");
    expect(normalizeAuditAction("gui")).toBe("submit");
  });
  it("giá trị mới giữ nguyên (đọc lại không đổi)", () => {
    for (const map of Object.values(LEGACY_VALUES))
      for (const next of Object.values(map)) expect(normalizeAuditAction(next) || next).toBe(next);
    expect(normalizeWipStatus("stocked")).toBe("stocked");
    expect(normalizeLotMethod("fifo")).toBe("fifo");
  });
  it("rỗng ⇒ mặc định như trước Đợt 5", () => {
    expect(normalizeWipStatus("")).toBe("pending");
    expect(normalizeQcResult(null)).toBe("pass");
    expect(normalizeSalesOrderStatus(undefined)).toBe("collecting");
    expect(normalizeExportOrderStatus(" ")).toBe("open");
    expect(normalizeStorageKind("")).toBe("internal");
    expect(normalizeLotMethod("")).toBe("picked");
  });
  it("mọi giá trị mới là tiếng Anh, không trùng giữa hai giá trị cũ của cùng họ", () => {
    for (const map of Object.values(LEGACY_VALUES)) {
      const next = Object.values(map);
      expect(new Set(next).size).toBe(next.length);
      for (const v of next) expect(v).toMatch(/^[a-z]+$/);
    }
  });
});

describe("auditActionAliases", () => {
  it("lọc nhật ký theo thao tác gồm cả dòng cũ", () => {
    expect(auditActionAliases("create")).toEqual(["create", "them"]);
    expect(auditActionAliases("login")).toEqual(["login", "dang-nhap"]);
    expect(auditActionAliases("them")).toEqual(["create", "them"]);
  });
});
