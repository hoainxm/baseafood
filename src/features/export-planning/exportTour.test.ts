// Oracle: docs/app-map/43-guided-tour.ba-spec.md — AC-3 (chọn hồ sơ minh họa), AC-4 (không có HĐ),
// AC-5 (người chỉ xem), AC-10 (phủ nhãn trạng thái), AC-11 (văn phong), §8 (12 ≤ số bước ≤ 22).
import { describe, expect, it, vi } from "vitest";
import { CONTRACT_STATE_LABELS, EMPTY_EXPORT_DATA, ITEM_STATE_LABELS, STEP_TITLES, type ExportData } from "@/lib/exportPlanning";
import type { ExportContract, ExportShipment } from "@/types";
import { buildExportTour, pickTourContract, type ExportTourContext } from "./exportTour";

const T0 = "2026-10-01T00:00:00.000Z";
const opts = { filesAvailable: true };

function contract(id: string, over: Partial<ExportContract> = {}): ExportContract {
  return { id, customerId: "k1", contractNo: id, signedOn: "2026-09-01", orderRef: "", status: "open", cancelReason: "", closeReason: "", note: "", createdAt: T0, ...over };
}

function shipment(id: string, contractId: string, over: Partial<ExportShipment> = {}): ExportShipment {
  return {
    id,
    contractId,
    planMonth: "2026-10",
    kind: "40RF",
    goodsSummary: "",
    plannedKg: 1000,
    lotCode: "",
    portOfDischarge: "",
    bookingNo: "",
    loadingDate: "",
    etd: "",
    eta: "",
    vesselVoyage: "",
    containerNo: "",
    sealNo: "",
    status: "open",
    cancelReason: "",
    note: "",
    createdAt: T0,
    ...over,
  };
}

const data = (over: Partial<ExportData>): ExportData => ({ ...EMPTY_EXPORT_DATA, ...over });

describe("pickTourContract (R4)", () => {
  it("ưu tiên HĐ đang chạy có chuyến chưa đủ hồ sơ, kèm đúng chuyến đó", () => {
    const d = data({
      contracts: [contract("huy", { status: "cancelled" }), contract("co-chuyen-huy"), contract("dang-chay")],
      shipments: [
        shipment("s-huy", "huy"),
        shipment("s-da-huy", "co-chuyen-huy", { status: "cancelled" }),
        shipment("s-dang", "dang-chay"),
      ],
    });
    expect(pickTourContract(d, opts)).toEqual({ contractId: "dang-chay", shipmentId: "s-dang" });
  });

  it("không HĐ nào có chuyến đang mở ⇒ HĐ còn chạy có chuyến bất kỳ", () => {
    const d = data({ contracts: [contract("a"), contract("b")], shipments: [shipment("s-b", "b", { status: "cancelled" })] });
    expect(pickTourContract(d, opts)).toEqual({ contractId: "b", shipmentId: "s-b" });
  });

  it("chưa có chuyến nào ⇒ HĐ còn chạy, shipmentId rỗng", () => {
    const d = data({ contracts: [contract("huy", { status: "cancelled" }), contract("moi")] });
    expect(pickTourContract(d, opts)).toEqual({ contractId: "moi", shipmentId: "" });
  });

  it("chỉ có HĐ đã hủy ⇒ dùng HĐ đã hủy", () => {
    const d = data({ contracts: [contract("huy", { status: "cancelled" })] });
    expect(pickTourContract(d, opts)).toEqual({ contractId: "huy", shipmentId: "" });
  });

  it("dữ liệu rỗng ⇒ null", () => {
    expect(pickTourContract(EMPTY_EXPORT_DATA, opts)).toBeNull();
  });
});

function ctx(over: Partial<ExportTourContext> = {}): ExportTourContext {
  return {
    pick: { contractId: "c1", shipmentId: "s1" },
    can: { create: true, update: true, payments: true },
    openDossier: vi.fn(),
    backToPlan: vi.fn(),
    ...over,
  };
}

describe("buildExportTour", () => {
  it("đủ quyền, có hồ sơ minh họa ⇒ 12–22 bước, id không trùng, mở đầu + kết thúc là lời giữa trang", () => {
    const { steps } = buildExportTour(ctx());
    expect(steps.length).toBeGreaterThanOrEqual(12);
    expect(steps.length).toBeLessThanOrEqual(22);
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    expect(steps[0].target ?? "").toBe("");
    expect(steps[steps.length - 1].target ?? "").toBe("");
  });

  it("thứ tự theo công việc: lịch → mở hồ sơ → trạng thái HĐ → việc tiếp → chuyến → trạng thái mục → cập nhật mục (R2)", () => {
    const ids = buildExportTour(ctx()).steps.map((s) => s.id);
    const order = ["create-contract", "shipment-table", "shipment-progress", "open-dossier", "contract-status", "next-action", "shipment-card", "current-step", "item-status", "step-update", "payments"];
    const at = order.map((id) => ids.indexOf(id));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("bước hồ sơ mở đúng hồ sơ minh họa; bước lịch về lịch", () => {
    const c = ctx();
    const steps = buildExportTour(c).steps;
    steps.find((s) => s.id === "contract-status")?.prepare?.();
    expect(c.openDossier).toHaveBeenCalledWith("c1", "s1");
    steps.find((s) => s.id === "stats")?.prepare?.();
    expect(c.backToPlan).toHaveBeenCalledTimes(1);
  });

  it("AC-4: không có HĐ ⇒ không bước nào mở hồ sơ, đúng 1 bước kể luồng hồ sơ không gắn chỗ", () => {
    const c = ctx({ pick: null });
    const steps = buildExportTour(c).steps;
    steps.forEach((s) => s.prepare?.());
    expect(c.openDossier).not.toHaveBeenCalled();
    const overview = steps.filter((s) => s.id === "dossier-overview");
    expect(overview).toHaveLength(1);
    expect(overview[0].target ?? "").toBe("");
  });

  it("AC-10: lời tour phủ đủ nhãn trạng thái đang có trong code (thêm trạng thái mà quên lời ⇒ đỏ)", () => {
    const text = buildExportTour(ctx())
      .steps.map((s) => `${s.title}\n${s.body}`)
      .join("\n");
    const labels = [
      ...Object.values(CONTRACT_STATE_LABELS),
      "Đã chốt HĐ",
      ...Object.values(ITEM_STATE_LABELS),
      ...STEP_TITLES,
      // Thẻ của chuyến (design-spec 42 · ba-spec 43 §9b).
      "Đủ hồ sơ",
      "Trễ hạn",
      "Chờ booking",
      "Dùng chung",
    ];
    expect(labels.filter((l) => !text.includes(l))).toEqual([]);
  });

  it("AC-11: văn phong — tiêu đề không chấm cuối, lời kết thúc dấu chấm, không dùng bấm / nhấn / click", () => {
    const steps = buildExportTour(ctx()).steps.concat(buildExportTour(ctx({ pick: null })).steps);
    expect(steps.filter((s) => s.title.trim().endsWith(".")).map((s) => s.id)).toEqual([]);
    expect(steps.filter((s) => !s.body.trim().endsWith(".")).map((s) => s.id)).toEqual([]);
    expect(steps.filter((s) => /\b(bấm|nhấn|click)/i.test(`${s.title} ${s.body}`)).map((s) => s.id)).toEqual([]);
  });

  it("AC-5: chỉ xem ⇒ 0 bước ghi; đủ quyền ⇒ 3", () => {
    const writeIds = new Set(["create-contract", "step-update", "payments"]);
    const count = (c: ExportTourContext) => buildExportTour(c).steps.filter((s) => writeIds.has(s.id)).length;
    expect(count(ctx({ can: { create: false, update: false, payments: false } }))).toBe(0);
    expect(count(ctx())).toBe(3);
  });
});
