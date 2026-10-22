// Oracle: docs/app-map/43-guided-tour.ba-spec.md (R1 chỉ đổi đường dẫn · R3 bước theo quyền · R10 phủ
// nhãn · AC-11 văn phong) + docs/app-map/32-danh-muc.md (7 tab, thêm / sửa / xóa, 141 mã chỉ đọc).
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { CATALOG_TAB_LABELS, buildCatalogTour, type CatalogTourTab } from "./catalogTour";

const screenSrc = readFileSync(new URL("./CatalogScreen.tsx", import.meta.url), "utf8");
const textOf = (canWrite: boolean) =>
  buildCatalogTour({ canWrite, setTab: () => {} })
    .steps.map((s) => `${s.title}\n${s.body}`)
    .join("\n");

describe("buildCatalogTour", () => {
  it("tên tab trong tour khớp nhãn tab đang hiện trên màn (đổi nhãn tab mà quên tour ⇒ đỏ)", () => {
    for (const [id, label] of Object.entries(CATALOG_TAB_LABELS)) {
      expect(screenSrc).toContain(`<TabsTrigger value="${id}"`);
      expect(screenSrc).toMatch(new RegExp(`<TabsTrigger value="${id}"[^>]*>${label.replace(/[()]/g, "\\$&")}</TabsTrigger>`));
    }
    // Màn không có tab nào ngoài danh sách của tour.
    const screenTabs = [...screenSrc.matchAll(/<TabsTrigger value="([a-z-]+)"/g)].map((m) => m[1]).sort();
    expect(screenTabs).toEqual(Object.keys(CATALOG_TAB_LABELS).sort());
  });

  it("mọi tab có một bước, bước của tab đổi đúng ?tab= trước khi hiện", () => {
    const setTab = vi.fn();
    const steps = buildCatalogTour({ canWrite: true, setTab }).steps;
    const text = textOf(true);
    for (const [id, label] of Object.entries(CATALOG_TAB_LABELS) as [CatalogTourTab, string][]) {
      expect(text).toContain(label);
      const step = steps.find((s) => s.target === `catalog-${id}`);
      expect(step?.optional).toBe(true);
      setTab.mockClear();
      step?.prepare?.();
      expect(setTab).toHaveBeenCalledWith(id);
    }
  });

  it("phủ nhãn đang hiện: Chỉ xem, Chi tiết, Tên hàng, Chưa ánh xạ, Thêm mới, Hoàn tác, loại kho", () => {
    const text = textOf(true);
    const labels = ["Chỉ xem", "Chi tiết", "Tên hàng (n)", "Tên trên chứng từ", "Trích xuất từ chứng từ", "Chưa ánh xạ", "Thêm mới", "Hoàn tác", "Kho nhà", "Kho thuê ngoài", "Tên tiếng Anh mặc định"];
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
  });

  it("bước Thêm / sửa / xóa chỉ có khi có quyền ghi", () => {
    const ids = (canWrite: boolean) => buildCatalogTour({ canWrite, setTab: () => {} }).steps.map((s) => s.id);
    expect(ids(true)).toContain("write");
    expect(ids(false)).not.toContain("write");
  });

  it("3 ≤ số bước ≤ 22; mở đầu + kết thúc giữa trang; văn phong", () => {
    const steps = [...buildCatalogTour({ canWrite: true, setTab: () => {} }).steps, ...buildCatalogTour({ canWrite: false, setTab: () => {} }).steps];
    const full = buildCatalogTour({ canWrite: true, setTab: () => {} }).steps;
    expect(full.length).toBeLessThanOrEqual(22);
    expect(full[0].target ?? "").toBe("");
    expect(full[full.length - 1].target ?? "").toBe("");
    expect(steps.filter((s) => s.title.trim().endsWith(".")).map((s) => s.id)).toEqual([]);
    expect(steps.filter((s) => !s.body.trim().endsWith(".")).map((s) => s.id)).toEqual([]);
    expect(steps.filter((s) => /(^|[^\p{L}])(bấm|nhấn|click)(?!\p{L})/iu.test(`${s.title} ${s.body}`)).map((s) => s.id)).toEqual([]);
  });
});
