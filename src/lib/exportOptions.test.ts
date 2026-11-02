import { describe, expect, it } from "vitest";
import {
  EXPORT_OPTION_SEED,
  effectiveExportOptions,
  exportOptionChoices,
  exportOptionsOf,
  findOrCreateExportOption,
  isOutsideList,
  matchExportOption,
  replaceExportOptionList,
} from "./exportOptions";

const names = (rows: ReturnType<typeof exportOptionsOf>) => rows.map((r) => r.name);
let n = 0;
const newId = () => `x${++n}`;

describe("ba-spec 62 — danh sách chọn Xuất khẩu", () => {
  it("AC-1: danh sách khởi tạo đúng loại, đúng thứ tự", () => {
    const rows = effectiveExportOptions([], true);
    expect(names(exportOptionsOf(rows, "loading-port"))).toEqual(["Cái Mép", "Cát Lái"]);
    expect(exportOptionsOf(rows, "discharge-port")).toHaveLength(11);
    expect(exportOptionsOf(rows, "discharge-port")[0].name).toBe("Tokyo, Japan");
    expect(names(exportOptionsOf(rows, "discharge-port"))).toContain("Charleston, USA");
    expect(names(exportOptionsOf(rows, "container-type"))).toEqual(["20RF", "40RF", "40HC-RF"]);
    expect(names(exportOptionsOf(rows, "currency"))).toEqual(["USD", "JPY", "EUR"]);
    // id duy nhất — trùng migration 0095
    expect(new Set(EXPORT_OPTION_SEED.map((r) => r.id)).size).toBe(EXPORT_OPTION_SEED.length);
  });

  it("AC-1: bảng có mục ⇒ dùng bảng; chưa chạy 0095 ⇒ dùng danh sách khởi tạo", () => {
    const one = [{ id: "a", listKind: "loading-port" as const, name: "Cái Mép", sortOrder: 10, note: "" }];
    expect(effectiveExportOptions(one, true)).toHaveLength(1);
    expect(effectiveExportOptions(one, false)).toHaveLength(EXPORT_OPTION_SEED.length);
  });

  it("AC-2: thêm mới không tạo trùng, không lẫn danh sách", () => {
    const rows = [...EXPORT_OPTION_SEED];
    const same = findOrCreateExportOption("  cát   lái ", "loading-port", rows, newId);
    expect(same.created).toBe(false);
    expect(same.option.name).toBe("Cát Lái");
    expect(findOrCreateExportOption("cat lai", "loading-port", rows, newId).created).toBe(true);
    const busan = findOrCreateExportOption("Busan,  Korea", "discharge-port", rows, newId);
    expect(busan.created).toBe(true);
    expect(busan.option.name).toBe("Busan, Korea");
    expect(exportOptionsOf(busan.rows, "discharge-port")).toHaveLength(12);
    expect(exportOptionsOf(busan.rows, "discharge-port").at(-1)?.name).toBe("Busan, Korea");
    expect(names(exportOptionsOf(busan.rows, "loading-port"))).not.toContain("Busan, Korea");
  });

  it("AC-3 / AC-4: xóa / đổi tên mục chỉ đổi danh sách, các danh sách khác giữ nguyên", () => {
    const rows = [...EXPORT_OPTION_SEED];
    const loading = exportOptionsOf(rows, "loading-port").filter((r) => r.name !== "Cát Lái");
    const afterDelete = replaceExportOptionList(rows, "loading-port", loading);
    expect(exportOptionsOf(afterDelete, "loading-port")).toHaveLength(1);
    expect(exportOptionsOf(afterDelete, "discharge-port")).toHaveLength(11);
    // HĐ đã ghi "CÁT LÁI" không nằm trong bảng ⇒ không bản ghi HĐ nào bị đụng; giờ hiện là ngoài danh sách.
    expect(isOutsideList("CÁT LÁI", afterDelete, "loading-port")).toBe(true);

    const renamed = exportOptionsOf(rows, "discharge-port").map((r) => (r.name === "Tokyo, Japan" ? { ...r, name: "Tokyo Port, Japan" } : r));
    const afterRename = replaceExportOptionList(rows, "discharge-port", renamed);
    expect(names(exportOptionsOf(afterRename, "discharge-port")).filter((x) => x === "Tokyo Port, Japan")).toHaveLength(1);
    expect(isOutsideList("Tokyo, Japan", afterRename, "discharge-port")).toBe(true);
  });

  it("replace: mục mới chưa có thứ tự xếp cuối, nhận đúng danh sách", () => {
    const rows = [...EXPORT_OPTION_SEED];
    const next = [...exportOptionsOf(rows, "currency"), { id: "c-new", listKind: "loading-port" as const, name: "VND", sortOrder: 0, note: "" }];
    const out = exportOptionsOf(replaceExportOptionList(rows, "currency", next), "currency");
    expect(names(out)).toEqual(["USD", "JPY", "EUR", "VND"]);
    expect(out.at(-1)?.sortOrder).toBe(40);
  });

  it("AC-5: nhận ra giá trị ngoài danh sách; ô chọn vẫn hiện giá trị cũ", () => {
    const rows = [...EXPORT_OPTION_SEED];
    expect(isOutsideList("CÁT LÁI/ CÁI MÉP", rows, "loading-port")).toBe(true);
    expect(isOutsideList("cát lái", rows, "loading-port")).toBe(false);
    expect(isOutsideList("", rows, "loading-port")).toBe(false);
    const choices = exportOptionChoices(rows, "loading-port", "Việt Nam");
    expect(choices).toHaveLength(3);
    expect(choices[0]).toMatchObject({ value: "Việt Nam", label: "Việt Nam" });
    expect(choices[0].subLabel).toMatch(/Ngoài danh sách/);
    expect(exportOptionChoices(rows, "loading-port", "Cái Mép")).toHaveLength(2);
    expect(matchExportOption("cát lái", rows, "loading-port")).toBe("Cát Lái");
    expect(matchExportOption("TOKYO", rows, "discharge-port")).toBe("TOKYO");
  });
});
