import { describe, expect, test } from "vitest";
import type { ExportItem, LotDispatch, LotInput, WipProductionItem } from "@/types";
import { computeWipStockDetail, type StockDeduction } from "@/lib/inventory";
import { approveWipIntake, checkIntakeReversal, revertWipIntake, type IntakeReversalContext } from "./wipIntakeReversal";

const pending: WipProductionItem = {
  id: "w1",
  productionDate: "2026-11-01",
  postingDate: "2026-11-01",
  backdateReason: "",
  workshop: "Đông",
  productId: "p1",
  spec: "18-20",
  quantityKg: 500,
  blocksCount: 50,
  warehouse: "Kho xưởng Đông",
  status: "pending",
  note: "ghi của xưởng",
};
const form = { warehouse: "Kho 1000T", actualKg: 488.5, actualBlocks: 49, note: "hao khi cấp đông" };
const meta = { approvedBy: "Thủ kho B", approvedAt: "2026-11-02T07:00:00Z" };
const ctx = (over: Partial<IntakeReversalContext> = {}, wips: WipProductionItem[] = []): IntakeReversalContext => ({
  lotStock: computeWipStockDetail(wips, []).los,
  exportItems: [],
  lotDispatches: [],
  lotInputs: [],
  ...over,
});

describe("Duyệt nhập kho giữ số xưởng ghi", () => {
  test("ghi số thực, chụp số gốc", () => {
    const a = approveWipIntake(pending, form, meta);
    expect(a).toMatchObject({ status: "stocked", quantityKg: 488.5, blocksCount: 49, warehouse: "Kho 1000T", note: "hao khi cấp đông" });
    expect(a.preApproval).toEqual({ quantityKg: 500, blocksCount: 50, warehouse: "Kho xưởng Đông", note: "ghi của xưởng", ...meta });
  });

  test("ghi chú trống ⇒ giữ ghi chú cũ", () => {
    expect(approveWipIntake(pending, { ...form, note: "" }, meta).note).toBe("ghi của xưởng");
  });
});

describe("Hủy duyệt", () => {
  test("về Chờ nhập kho đúng số gốc (kg, block, kho, ghi chú); lô rời khỏi tồn", () => {
    const a = approveWipIntake(pending, form, meta);
    expect(checkIntakeReversal(a, ctx({}, [a]))).toEqual({ ok: true, restoredKg: 500, hasSnapshot: true });
    const r = revertWipIntake(a);
    expect(r).toEqual({ ...pending, preApproval: null });
    expect(computeWipStockDetail([r], []).los).toEqual([]);
  });

  test("duyệt lại sau khi hủy ⇒ chụp lại số gốc mới", () => {
    const again = approveWipIntake(revertWipIntake(approveWipIntake(pending, form, meta)), { ...form, actualKg: 495 }, meta);
    expect(again.quantityKg).toBe(495);
    expect(again.preApproval?.quantityKg).toBe(500);
  });

  test("lô duyệt trước bản này (không có số gốc) ⇒ chỉ đổi trạng thái, giữ số đang có", () => {
    const legacy: WipProductionItem = { ...pending, status: "stocked", quantityKg: 488.5 };
    expect(checkIntakeReversal(legacy, ctx({}, [legacy]))).toEqual({ ok: true, restoredKg: 488.5, hasSnapshot: false });
    expect(revertWipIntake(legacy)).toEqual({ ...legacy, status: "pending" });
  });

  test("CHẶN khi lô đang chờ (chưa duyệt)", () => {
    expect(checkIntakeReversal(pending, ctx()).ok).toBe(false);
  });

  test("CHẶN khi lô đã nằm trong lệnh xuất", () => {
    const a = approveWipIntake(pending, form, meta);
    const exportItems: ExportItem[] = [{ id: "xi", exportId: "x", wipId: "w1", productId: "p1", spec: "18-20", quantityKg: 100, blocksCount: 10 }];
    const c = checkIntakeReversal(a, ctx({ exportItems, lotStock: computeWipStockDetail([a], exportItems).los }));
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toContain("Hủy lệnh xuất");
  });

  test("CHẶN khi lô đã làm đầu vào đóng gói", () => {
    const a = approveWipIntake(pending, form, meta);
    const lotInputs: LotInput[] = [
      { id: "li", outputKind: "P", outputId: "pk", inputKind: "W", inputId: "w1", inputLabel: "", material: "", quantityKg: 10, method: "scan", operator: "", recordedAt: "" },
    ];
    expect(checkIntakeReversal(a, ctx({ lotInputs }, [a])).ok).toBe(false);
  });

  test("CHẶN khi lô đã gắn cho dòng bán", () => {
    const a = approveWipIntake(pending, form, meta);
    const lotDispatches: LotDispatch[] = [
      { id: "d", lotKind: "W", lotId: "w1", lotLabel: "", docKind: "sales_item", docId: "s", quantityKg: 10, method: "scan", operator: "", recordedAt: "" },
    ];
    expect(checkIntakeReversal(a, ctx({ lotDispatches }, [a])).ok).toBe(false);
  });

  test("CHẶN khi bán lẻ FIFO đã trừ vào lô", () => {
    const a = approveWipIntake(pending, form, meta);
    const retail: StockDeduction[] = [{ productId: "p1", spec: "18-20", quantityKg: 20 }];
    const c = checkIntakeReversal(a, ctx({ lotStock: computeWipStockDetail([a], [], retail).los }));
    expect(c.ok).toBe(false);
  });

  test("CHẶN khi kỳ Cân đối đã hút mẻ và hủy làm đổi kg; không đổi kg thì cho", () => {
    const a = { ...approveWipIntake(pending, form, meta), balancingPeriodId: "k1" };
    expect(checkIntakeReversal(a, ctx({}, [a])).ok).toBe(false);
    const same = { ...approveWipIntake(pending, { ...form, actualKg: 500 }, meta), balancingPeriodId: "k1" };
    expect(checkIntakeReversal(same, ctx({}, [same])).ok).toBe(true);
  });
});
