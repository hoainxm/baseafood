// Oracle: docs/app-map/43-guided-tour.ba-spec.md — khuôn AC-3 (chọn lô minh họa), AC-4 (không có lô),
// AC-5 (bước in / gắn lô theo quyền), AC-10 (lời tour phủ nhãn loại lô, tên khâu, nhãn trạng thái đang hiện).
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { TRACE_KIND_LABELS, groupByTraceStage, type TraceData } from "@/lib/lotTraceability";
import type { LotInput, MaterialImportItem, Packaging, WipProductionItem } from "@/types";
import { buildQrTour, pickTourLot, tourSpec } from "./qrTour";

const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

/** Chữ cố định trong <Tag …>chữ</Tag> (bỏ nhãn có biểu thức {…}). */
function tagLiterals(src: string): string[] {
  return [...src.matchAll(/<Tag\b[^>]*>([^<{]+)<\/Tag>/g)].map((m) => m[1].trim()).filter(Boolean);
}

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

describe("tour Mã lô QR — phủ nhãn (khuôn AC-10)", () => {
  it("6 nhãn loại lô / ngả ra (TRACE_KIND_LABELS) có nguyên văn", () => {
    expect(Object.values(TRACE_KIND_LABELS).filter((l) => !fullText.includes(l))).toEqual([]);
  });

  it("5 tên khâu của tab Theo giai đoạn có nguyên văn", () => {
    const names = groupByTraceStage(EMPTY, { fromDate: "2026-10-01", toDate: "2026-10-07", workshop: "" }).map((g) => g.name);
    expect(names).toHaveLength(5);
    expect(names.filter((l) => !fullText.includes(l))).toEqual([]);
  });

  it("mọi nhãn trạng thái cố định trong <Tag> của các file màn có trong lời tour", () => {
    const labels = [
      ...new Set(["QrLookupScreen.tsx", "TraceStagesView.tsx", "BulkLabelPrint.tsx"].flatMap((f) => tagLiterals(read(f)))),
    ];
    expect(labels.length).toBeGreaterThanOrEqual(8); // khỏi xanh vì quét hụt
    expect(labels.filter((l) => !fullText.includes(l))).toEqual([]);
  });
});

const wip = (id: string, productionDate: string): WipProductionItem => ({ id, productionDate }) as WipProductionItem;
const imp = (id: string, deliveryDate: string): MaterialImportItem => ({ id, deliveryDate }) as MaterialImportItem;
const pack = (id: string, date: string): Packaging => ({ id, date }) as Packaging;
const input = (outputKind: "W" | "P", outputId: string, inputKind: "S" | "W", inputId: string): LotInput =>
  ({ id: `${outputId}-${inputId}`, outputKind, outputId, inputKind, inputId }) as LotInput;

describe("pickTourLot — lô minh họa", () => {
  it("ưu tiên mẻ BTP có cả nguồn lẫn ngả ra, rồi mới tới mẻ mới hơn", () => {
    const d = {
      ...EMPTY,
      wips: [wip("moi-nhat", "2026-10-09"), wip("du-hai-chieu", "2026-10-01"), wip("chi-nguon", "2026-10-05")],
      lotInputs: [input("W", "du-hai-chieu", "S", "s1"), input("W", "chi-nguon", "S", "s1"), input("P", "p1", "W", "du-hai-chieu")],
    };
    expect(pickTourLot(d)).toBe("W:du-hai-chieu");
  });

  it("cùng điểm ⇒ mẻ mới nhất", () => {
    expect(pickTourLot({ ...EMPTY, wips: [wip("cu", "2026-09-01"), wip("moi", "2026-10-01")] })).toBe("W:moi");
  });

  it("không có mẻ ⇒ lô NL mới nhất, rồi lô TP; rỗng ⇒ null", () => {
    expect(pickTourLot({ ...EMPTY, imports: [imp("a", "2026-09-01"), imp("b", "2026-10-01")] })).toBe("S:b");
    expect(pickTourLot({ ...EMPTY, packagings: [pack("p", "2026-10-01")] })).toBe("P:p");
    expect(pickTourLot(EMPTY)).toBeNull();
  });
});

describe("tour Mã lô QR — bước theo quyền và theo dữ liệu (khuôn AC-4, AC-5)", () => {
  const passport = ["lot-summary", "mass-balance", "trace-backward", "trace-forward", "recall"];

  it("không có quyền in ⇒ không có bước In tem hàng loạt, lời không nhắc nút in", () => {
    const tour = buildQrTour({ sampleLot: "W:w1", can: { print: false, linkLots: false }, showTab: vi.fn() });
    const ids = tour.steps.map((s) => s.id);
    expect(ids.filter((id) => id.startsWith("print-"))).toEqual([]);
    const text = tour.steps.map((s) => s.body).join("\n");
    expect(text).not.toContain("In tem hàng loạt");
    expect(text).not.toContain("Tải Excel");
    expect(tour.steps.find((s) => s.id === "stage-list")?.body).not.toContain("Duyệt nhập kho");
  });

  it("đủ quyền ⇒ có 2 bước In tem hàng loạt, bước hộ chiếu mở đúng lô minh họa", () => {
    const showTab = vi.fn();
    const tour = buildQrTour({ sampleLot: "W:w1", can: { print: true, linkLots: true }, showTab });
    expect(tour.steps.filter((s) => s.id.startsWith("print-")).map((s) => s.id)).toEqual(["print-filters", "print-list"]);
    tour.steps.find((s) => s.id === "recall")?.prepare?.();
    expect(showTab).toHaveBeenLastCalledWith("lookup", "W:w1");
    tour.steps.find((s) => s.id === "stage-list")?.prepare?.();
    expect(showTab).toHaveBeenLastCalledWith("stages");
  });

  it("chưa có lô nào ⇒ phần hộ chiếu gói thành một lời giữa trang", () => {
    const tour = buildQrTour({ sampleLot: null, can: { print: true, linkLots: true }, showTab: vi.fn() });
    expect(tour.steps.filter((s) => passport.includes(s.id))).toEqual([]);
    const overview = tour.steps.filter((s) => s.id === "passport-overview");
    expect(overview).toHaveLength(1);
    expect(overview[0].target ?? "").toBe("");
  });
});
