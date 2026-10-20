// Bộ demo Xuất khẩu (R14, AC-29 phần chạy được không cần DB): đủ 3 ca để trình diễn, file chỉ là
// đường dẫn giữ chỗ (không chép file thật), id không trùng, chạy lại ra cùng bộ.
import { describe, expect, it } from "vitest";
import { buildExportDemo } from "./exportPlanningDemo";
import { DEMO_PLACEHOLDER_PREFIX, contractCoverage, contractState, isShipmentClosed } from "./exportPlanning";

const CUSTOMERS = [
  { id: "dm-kh-0", code: "1", name: "KH 0", market: "Nhật Bản" },
  { id: "dm-kh-1", code: "2", name: "KH 1", market: "Nhật Bản" },
  { id: "dm-kh-2", code: "3", name: "KH 2", market: "Hàn Quốc" },
];
const TODAY = "2026-10-20";

describe("bộ demo Xuất khẩu", () => {
  const d = buildExportDemo(CUSTOMERS, TODAY);

  it("đủ 3 ca: HĐ khép kín · HĐ đang đóng cont còn thiếu 1 cont · HĐ chờ duyệt", () => {
    expect(d.contracts.map((c) => contractState(d, c.id))).toEqual(["closed", "approved", "pending"]);
    expect(isShipmentClosed(d, d.shipments[0])).toBe(true);
    expect(contractCoverage(d, d.contracts[1].id)).toMatchObject({ missingContainers: 1, covered: false });
  });

  it("file chỉ là đường dẫn giữ chỗ — không trỏ tới file thật", () => {
    const paths = [...d.files.map((f) => f.path), ...d.revisions.map((r) => r.filePath), ...d.approvals.map((a) => a.filePath)].filter(Boolean);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((p) => p.startsWith(DEMO_PLACEHOLDER_PREFIX))).toBe(true);
  });

  it("id không trùng trong từng bảng; tất định", () => {
    for (const rows of Object.values(d)) {
      const ids = (rows as { id: string }[]).map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(buildExportDemo(CUSTOMERS, TODAY)).toEqual(d);
  });

  it("không có khách ⇒ bộ rỗng", () => {
    expect(buildExportDemo([], TODAY).contracts).toEqual([]);
  });
});
