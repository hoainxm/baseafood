import { describe, expect, it } from "vitest";
import {
  LEGACY_FIELDS,
  LEGACY_VALUES,
  auditActionAliases,
  normalizeAuditAction,
  normalizeExportOrderStatus,
  normalizeLotMethod,
  normalizeQcResult,
  normalizeReconciliationMode,
  normalizeSalesOrderStatus,
  normalizeStorageKind,
  normalizeWipStatus,
  renameLegacyFields,
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
      for (const v of next) expect(v).toMatch(/^[a-z][A-Za-z]*$/); // camelCase tiếng Anh
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

describe("renameLegacyFields — tên trường cũ của dữ liệu đã lưu", () => {
  it("bộ đệm WIP cũ: componentRauKg/componentBaoTuKg → tentacleKg/stomachKg", () => {
    const r = renameLegacyFields({ id: "w1", componentRauKg: 3, componentBaoTuKg: 0 }, LEGACY_FIELDS.wip);
    expect(r).toEqual({ id: "w1", tentacleKg: 3, stomachKg: 0 });
  });
  it("tên mới đã có thì giữ tên mới; không có tên cũ thì trả nguyên object", () => {
    expect(renameLegacyFields({ tentacleKg: 5, componentRauKg: 1 }, LEGACY_FIELDS.wip)).toEqual({ tentacleKg: 5 });
    const x = { tentacleKg: 2 };
    expect(renameLegacyFields(x, LEGACY_FIELDS.wip)).toBe(x);
  });
  it("tổng kết + tùy chọn đối soát lưu trước 2026-10-14", () => {
    expect(renameLegacyFields({ soHoaDon: 10, khop: 7, lech: 1, nguong: 1, savedAt: "t" }, LEGACY_FIELDS.reconciliationSummary)).toEqual({
      invoiceCount: 10, matched: 7, mismatched: 1, threshold: 1, savedAt: "t",
    });
    expect(renameLegacyFields({ soChuanTen: "PMEM", benThue: ["A"], cheDo: "haiBan", edits: {} }, LEGACY_FIELDS.reconciliationOptions)).toEqual({
      ledgerSheetName: "PMEM", taxSideSheets: ["A"], mode: "haiBan", edits: {},
    });
    expect(normalizeReconciliationMode("haiBan")).toBe("twoVersion");
    expect(normalizeReconciliationMode("columnSum")).toBe("columnSum");
  });
});
