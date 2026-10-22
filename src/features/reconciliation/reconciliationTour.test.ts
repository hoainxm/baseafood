// Oracle: docs/app-map/43-guided-tour.ba-spec.md — khuôn AC-10 (lời tour phủ đủ nhãn trạng thái đang hiện
// trên trang) và AC-5 (bước GHI biến mất khi không có quyền). Nhãn đọc thẳng từ nguồn: hằng số của lib +
// chữ trong <Tag> / bảng nhãn của hai file màn (đổi nhãn ở màn mà quên sửa lời tour ⇒ đỏ).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SUM_MISMATCH_LABELS } from "@/lib/einvoiceReconciliation";
import { buildReconciliationTour, tourSpec } from "./reconciliationTour";

const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
const screenSrc = read("ReconciliationScreen.tsx");
const modeSrc = read("ReconciliationModeView.tsx");

/** Chữ cố định trong <Tag …>chữ</Tag> (bỏ nhãn có biểu thức {…}). */
function tagLiterals(src: string): string[] {
  return [...src.matchAll(/<Tag\b[^>]*>([^<{]+)<\/Tag>/g)].map((m) => m[1].trim()).filter(Boolean);
}

/** Các giá trị chuỗi `key: "…"` trong khối bắt đầu bằng `start`, tới dòng `};` / `];` đầu tiên. */
function blockStrings(src: string, start: string, key: RegExp): string[] {
  const from = src.indexOf(start);
  expect(from).toBeGreaterThanOrEqual(0);
  const ends = ["\n};", "\n];"].map((e) => src.indexOf(e, from)).filter((i) => i >= 0);
  const block = src.slice(from, ends.length ? Math.min(...ends) : undefined);
  return [...block.matchAll(key)].map((m) => m[1]);
}

const fullText = (() => {
  const t = tourSpec.build();
  return t.steps.map((s) => `${s.title}\n${s.body}`).join("\n");
})();

describe("tour Đối soát — phủ nhãn trạng thái (khuôn AC-10)", () => {
  it("mọi nhãn kết quả trong <Tag> của hai file màn có trong lời tour", () => {
    const labels = [...new Set([...tagLiterals(screenSrc), ...tagLiterals(modeSrc)])];
    expect(labels.length).toBeGreaterThanOrEqual(15); // khỏi xanh vì quét hụt
    expect(labels.filter((l) => !fullText.includes(l))).toEqual([]);
  });

  it("4 kiểu đối soát (MODES) có nguyên văn", () => {
    const modes = blockStrings(modeSrc, "const MODES", /label: "([^"]+)"/g);
    expect(modes).toHaveLength(4);
    expect(modes.filter((l) => !fullText.includes(l))).toEqual([]);
  });

  it("7 nhóm nghi vấn (GROUP_NAMES) có nguyên văn", () => {
    const groups = blockStrings(screenSrc, "const GROUP_NAMES", /\d+: "([^"]+)"/g);
    expect(groups).toHaveLength(7);
    expect(groups.filter((l) => !fullText.includes(l))).toEqual([]);
  });

  it("nguyên nhân lệch cộng cột (SUM_MISMATCH_LABELS) có nguyên văn", () => {
    expect(Object.values(SUM_MISMATCH_LABELS).filter((l) => !fullText.includes(l))).toEqual([]);
  });
});

describe("tour Đối soát — bước theo quyền và theo kết quả (khuôn AC-5)", () => {
  const ids = (ctx: Parameters<typeof buildReconciliationTour>[0]) => buildReconciliationTour(ctx).steps.map((s) => s.id);
  const write = ["save-run", "export"];

  it("đủ quyền, đã có kết quả ⇒ có bước Lưu và Tải Excel", () => {
    expect(ids({ hasResult: true, can: { create: true, save: true, export: true } }).filter((id) => write.includes(id))).toEqual(write);
  });

  it("chỉ xem ⇒ không có bước Lưu, Tải Excel; lời bước tải file nói rõ không có nút Đối soát", () => {
    const tour = buildReconciliationTour({ hasResult: true, can: { create: false, save: false, export: false } });
    expect(tour.steps.filter((s) => write.includes(s.id))).toEqual([]);
    expect(tour.steps.find((s) => s.id === "file")?.body).toContain("chỉ được xem");
  });

  it("chưa có kết quả ⇒ gói phần kết quả thành một lời giữa trang, không bước nào chỉ chỗ kết quả", () => {
    const tour = buildReconciliationTour({ hasResult: false, can: { create: true, save: true, export: true } });
    const overview = tour.steps.filter((s) => s.id === "result-overview");
    expect(overview).toHaveLength(1);
    expect(overview[0].target ?? "").toBe("");
    expect(tour.steps.map((s) => s.id)).toEqual(["intro", "file", "threshold", "saved-runs", "result-overview", "outro"]);
  });

  it("bước chỉ khu vực chỉ có sau khi chạy đều là tùy chọn", () => {
    const resultOnly = ["ledger-cards", "suspects", "sheet-tables", "self-check", "two-version", "column-sum", "same-day", "save-run", "export"];
    const steps = tourSpec.build().steps.filter((s) => resultOnly.includes(s.id));
    expect(steps).toHaveLength(resultOnly.length);
    expect(steps.filter((s) => !s.optional).map((s) => s.id)).toEqual([]);
  });
});
