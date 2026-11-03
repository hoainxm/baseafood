import { describe, expect, it } from "vitest";
import type { ExportContractLine, ExportShipment, ExportShipmentLine } from "@/types";
import { linesFromDraft, loadingCountText, type LineDraft, type ShipmentLinesTarget } from "./shipmentGoodsLogic";

const packed: ExportShipmentLine = {
  id: "l1", shipmentId: "s1", contractId: "c1", sortOrder: 10, contractLineId: "cl1", productId: "", description: "CRAB", size: "",
  packing: "", unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton: 10, grossKgPerUnit: null, plannedUnits: null, loadedUnits: 40,
  loadedBy: "Kho", loadedAt: "2026-11-03T10:00:00Z", expiry: "", note: "",
};
const draftRow = (over: Partial<LineDraft>): LineDraft => ({
  contractLineId: "cl1", lineId: "l1", description: "CRAB", size: "", packing: "", plannedUnits: null, grossKgPerUnit: null, expiry: "", ...over,
});

describe("Hàng của chuyến — dòng đóng cont đã điền không mất (mig 0098)", () => {
  const tg = {
    shipment: { id: "s1", contractId: "c1" } as ExportShipment,
    label: "Lô 1",
    contractLines: [{ id: "cl1" } as ExportContractLine],
    lines: [packed],
    otherShipmentUnits: {},
  } satisfies ShipmentLinesTarget;
  it("Phòng KH lưu mà để trống số kế hoạch ⇒ giữ dòng + số thực đóng", () => {
    const out = linesFromDraft(tg, [draftRow({ grossKgPerUnit: 11 })], () => "x");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "l1", loadedUnits: 40, plannedUnits: null, grossKgPerUnit: 11 });
  });
  it("dòng chưa điền gì và không kế hoạch ⇒ bỏ như cũ", () => {
    expect(linesFromDraft({ ...tg, lines: [] }, [draftRow({ lineId: "" })], () => "x")).toEqual([]);
  });
  it("câu tóm tắt: chưa có hàng ⇒ nói đóng cont điền theo dòng HĐ; có số không kế hoạch ⇒ không so kế hoạch", () => {
    expect(loadingCountText([])).toMatch(/bộ phận đóng cont điền/);
    expect(loadingCountText([packed])).toBe("Đã điền 1/1 dòng · 40 kiện thực đóng. Chứng từ lấy số này làm invoice.");
  });
});
