// ba-spec 66 AC-16 — hộp "?" và tour của Xuất khẩu, Nhập khẩu nói đủ luật đọc file hợp đồng.
import { describe, expect, it } from "vitest";
import { EXPORT_GUIDE_STEPS } from "./exportPlanningGuide";
import { IMPORT_GUIDE_STEPS } from "./importPlanningGuide";

const MUST = [".docx", "bản scan", "ô còn trống", "không tự lưu"];

describe("ba-spec 66 AC-16 — hướng dẫn đọc file hợp đồng", () => {
  it.each([
    ["Xuất khẩu", EXPORT_GUIDE_STEPS.find((s) => s.id === "create")?.text ?? ""],
    ["Nhập khẩu", IMPORT_GUIDE_STEPS.find((s) => s.id === "contract")?.text ?? ""],
  ])("%s: bước Lập hợp đồng nói đủ 4 ý", (_, text) => {
    expect(MUST.filter((m) => !text.toLowerCase().includes(m))).toEqual([]);
  });
});
