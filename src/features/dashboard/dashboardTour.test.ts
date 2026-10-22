// Oracle: docs/app-map/43-guided-tour.ba-spec.md — khuôn AC-10 (lời tour phủ đủ nhãn mức / loại việc cần
// đốc, tên khâu, tên các phần của thanh chia phần) và AC-5 (bước Chế độ demo chỉ có với quản trị viên).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getWarningKindLabel, type FlowWarningKind } from "@/lib/dataFlow";
import { groupByTraceStage, type TraceData } from "@/lib/lotTraceability";
import { buildDashboardTour, tourSpec } from "./dashboardTour";

const screenSrc = readFileSync(new URL("./DashboardScreen.tsx", import.meta.url), "utf8");

/** Các giá trị `key: "…"` trong khối hằng số bắt đầu bằng `start`, tới dòng `};` đầu tiên. */
function blockStrings(start: string, key: RegExp): string[] {
  const from = screenSrc.indexOf(start);
  expect(from).toBeGreaterThanOrEqual(0);
  const block = screenSrc.slice(from, screenSrc.indexOf("\n};", from));
  return [...block.matchAll(key)].map((m) => m[1]);
}

/**
 * Mọi loại việc mà Tổng quan hiện (buildChainWarnings). Thiếu một loại ⇒ tsc đỏ.
 * "document-expiring" chỉ hiện ở Việc của tôi, không ở Tổng quan.
 */
const DASHBOARD_WARNING_KINDS: Record<Exclude<FlowWarningKind, "document-expiring">, true> = {
  "imports-unlocked": true,
  "production-unlocked": true,
  "changed-after-lock": true,
  backdated: true,
  oversold: true,
  "lot-unassigned": true,
  "approval-overdue": true,
  "period-unlocked": true,
  "yield-deviation": true,
  "period-yield-deviation": true,
};

const EMPTY: TraceData = {
  shipments: [],
  imports: [],
  wips: [],
  packagings: [],
  lotInputs: [],
  exportItems: [],
  exportOrders: [],
  salesOrders: [],
  products: [],
  customers: [],
};

const fullText = tourSpec
  .build()
  .steps.map((s) => `${s.title}\n${s.body}`)
  .join("\n");

describe("tour Tổng quan — phủ nhãn (khuôn AC-10)", () => {
  it("3 mức của việc cần đốc (LEVEL_LABELS) có nguyên văn", () => {
    const levels = blockStrings("const LEVEL_LABELS", /text: "([^"]+)"/g);
    expect(levels).toHaveLength(3);
    expect(levels.filter((l) => !fullText.includes(l))).toEqual([]);
  });

  it("mọi loại việc cần đốc có nguyên văn", () => {
    const kinds = Object.keys(DASHBOARD_WARNING_KINDS).map((k) => getWarningKindLabel(k as FlowWarningKind));
    expect(kinds.filter((l) => !fullText.includes(l))).toEqual([]);
  });

  it("5 tên khâu có nguyên văn", () => {
    const names = groupByTraceStage(EMPTY, { fromDate: "2026-10-01", toDate: "2026-10-31", workshop: "" }).map((g) => g.name);
    expect(names).toHaveLength(5);
    expect(names.filter((l) => !fullText.includes(l))).toEqual([]);
  });

  it("tên các phần của hai thanh Nguyên liệu đi đâu có nguyên văn", () => {
    const parts = [
      ...blockStrings("const MATERIAL_PARTS", /label: "([^"]+)"/g),
      ...blockStrings("const WAREHOUSE_PARTS", /label: "([^"]+)"/g),
    ];
    expect(parts).toHaveLength(9);
    expect(parts.filter((l) => !fullText.includes(l))).toEqual([]);
  });

  it("chữ trạng thái của ô khâu (PipelineStages) có trong lời", () => {
    expect(["Đang chờ", "việc còn thiếu", "Đủ việc"].filter((l) => !fullText.includes(l))).toEqual([]);
  });
});

describe("tour Tổng quan — bước theo quyền (khuôn AC-5)", () => {
  it("quản trị viên ⇒ có bước Chế độ demo (tùy chọn, chỉ nút trên thanh tiêu đề)", () => {
    const step = buildDashboardTour({ can: { demo: true } }).steps.find((s) => s.id === "demo-mode");
    expect(step?.optional).toBe(true);
    expect(step?.target).toBe("dashboard-demo-mode");
    expect(step?.body).toContain("Số thật của xưởng không bị đụng");
  });

  it("không phải quản trị viên ⇒ không có bước Chế độ demo, lời không nhắc chế độ demo", () => {
    const tour = buildDashboardTour({ can: { demo: false } });
    expect(tour.steps.map((s) => s.id)).not.toContain("demo-mode");
    expect(tour.steps.map((s) => s.body).join("\n")).not.toMatch(/demo/i);
  });
});
