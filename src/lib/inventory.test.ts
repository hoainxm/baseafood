import { describe, it, expect } from "vitest";
import { computeWipStock, computeWipStockDetail, filterRetailSales, getAvailableKg, RETAIL_WAREHOUSE, FG_WAREHOUSE, collectWipDeductions, computeFinishedGoodStock, computeFinishedGoodLotStock, computeFinishedGoodLotStockDetail, collectPackagingDeductions } from "@/lib/inventory";
import type { WipProductionItem, ExportItem, LotDispatch, LotInput, Packaging } from "@/types";

const lo = (
  id: string,
  productionDate: string,
  quantityKg: number,
  blocksCount: number,
  status: "stocked" | "pending" = "stocked",
) =>
  ({
    id,
    productId: "p1",
    spec: "s1",
    warehouse: "kho",
    productionDate,
    quantityKg,
    blocksCount,
    status,
  }) as WipProductionItem;

describe("computeWipStock", () => {
  it("chỉ tính lô đã nhập kho, conLai = nhập − xuất", () => {
    const los = computeWipStock(
      [lo("w1", "2026-09-01", 100, 10), lo("w2", "2026-09-02", 50, 5, "pending")],
      [{ wipId: "w1", quantityKg: 30, blocksCount: 3 } as ExportItem],
    );
    expect(los).toHaveLength(1); // w2 "pending" bị loại
    expect(los[0].wipId).toBe("w1");
    expect(los[0].remainingKg).toBe(70);
    expect(los[0].outKg).toBe(30);
    expect(los[0].remainingBlocks).toBe(7);
  });

  it("bán lẻ trừ tồn FIFO theo ngày SX (lô cũ trước)", () => {
    const los = computeWipStock(
      [lo("wNew", "2026-09-02", 100, 10), lo("wOld", "2026-08-30", 40, 4)],
      [],
      [{ productId: "p1", spec: "s1", quantityKg: 50 }],
    );
    const old = los.find((l) => l.wipId === "wOld")!;
    const neu = los.find((l) => l.wipId === "wNew")!;
    expect(old.remainingKg).toBe(0); // lô cũ hết trước (40), còn 10 sang lô mới
    expect(neu.remainingKg).toBe(90); // 100 − 10
  });
});

describe("filterRetailSales", () => {
  const rows = [
    { productId: "p1", spec: "s1", quantityKg: 10, sourceWarehouse: RETAIL_WAREHOUSE },
    { productId: "p2", spec: "s1", quantityKg: 20, sourceWarehouse: FG_WAREHOUSE },
    { productId: "p3", spec: "s1", quantityKg: 30, sourceWarehouse: "Lưu trữ" },
    { productId: "p4", spec: "s1", quantityKg: 40, sourceWarehouse: "" },
  ];

  it("mặc định lấy dòng bán block thô (RETAIL_WAREHOUSE), bỏ handoff/đơn đặt", () => {
    const r = filterRetailSales(rows);
    expect(r).toHaveLength(1);
    expect(r[0].productId).toBe("p1");
  });

  it("truyền FG_WAREHOUSE lấy dòng bán hàng đóng gói", () => {
    const r = filterRetailSales(rows, FG_WAREHOUSE);
    expect(r).toHaveLength(1);
    expect(r[0].productId).toBe("p2");
  });
});

describe("getAvailableKg", () => {
  it("cộng phần còn lại theo (mặt hàng × quy cách), kẹp âm về 0", () => {
    const stockRows = [
      { productId: "p1", spec: "s1", remainingKg: 70 },
      { productId: "p1", spec: "s1", remainingKg: 30 },
      { productId: "p1", spec: "s1", remainingKg: -5 }, // âm không được cộng vào
      { productId: "p2", spec: "s1", remainingKg: 999 },
    ] as Parameters<typeof getAvailableKg>[0];
    expect(getAvailableKg(stockRows, "p1", "s1")).toBe(100);
    expect(getAvailableKg(stockRows, "pX", "s1")).toBe(0);
  });
});

describe("trừ tồn theo lô đã gắn (truy xuất QR)", () => {
  const w0 = lo("w0", "2026-09-29", 100, 10); // lô cũ, không ai gắn
  const w1 = lo("w1", "2026-10-02", 500, 50);
  const remainingOf = (los: ReturnType<typeof computeWipStock>, id: string) => los.find((l) => l.wipId === id)!.remainingKg;

  it("không gắn lô ⇒ y như FIFO cũ", () => {
    const los = computeWipStock([w0, w1], [], [{ productId: "p1", spec: "s1", quantityKg: 200 }]);
    expect(remainingOf(los, "w0")).toBe(0);
    expect(remainingOf(los, "w1")).toBe(400);
  });

  it("gắn lô có kg ⇒ trừ đúng lô đó, lô cũ không bị đụng", () => {
    const los = computeWipStock([w0, w1], [], [{ productId: "p1", spec: "s1", quantityKg: 200, lots: [{ id: "w1", kg: 200 }] }]);
    expect(remainingOf(los, "w0")).toBe(100);
    expect(remainingOf(los, "w1")).toBe(300);
  });

  it("gắn lô chưa cân ⇒ FIFO trong các lô đã gắn", () => {
    const w2 = lo("w2", "2026-10-03", 50, 5);
    const los = computeWipStock([w0, w1, w2], [], [{ productId: "p1", spec: "s1", quantityKg: 530, lots: [{ id: "w2", kg: null }, { id: "w1", kg: null }] }]);
    expect(remainingOf(los, "w0")).toBe(100);
    expect(remainingOf(los, "w1")).toBe(0); // w1 cũ hơn w2 ⇒ trừ trước
    expect(remainingOf(los, "w2")).toBe(20);
  });

  it("kg gắn vượt phần lô còn ⇒ phần dư rơi xuống FIFO, không làm lô âm", () => {
    const los = computeWipStock([w0, w1], [], [{ productId: "p1", spec: "s1", quantityKg: 550, lots: [{ id: "w1", kg: 550 }] }]);
    expect(remainingOf(los, "w1")).toBe(0);
    expect(remainingOf(los, "w0")).toBe(50);
  });

  it("gắn nhầm lô khác mặt hàng ⇒ bỏ qua, trừ FIFO", () => {
    const otherLot = { ...lo("wx", "2026-09-01", 80, 8), productId: "p9" } as WipProductionItem;
    const los = computeWipStock([w0, w1, otherLot], [], [{ productId: "p1", spec: "s1", quantityKg: 60, lots: [{ id: "wx", kg: 60 }] }]);
    expect(remainingOf(los, "wx")).toBe(80);
    expect(remainingOf(los, "w0")).toBe(40);
  });

  it("collectWipDeductions gom bán lẻ + đóng gói kèm lô gắn từ lot_dispatches / lot_inputs", () => {
    const ban = [{ id: "b1", productId: "p1", spec: "s1", quantityKg: 100, sourceWarehouse: RETAIL_WAREHOUSE }];
    const dg = [{ id: "pk1", fromProductId: "p1", fromSpec: "s1", inputKg: 200 } as Packaging];
    const dispatches: LotDispatch[] = [
      { id: "d1", lotKind: "W", lotId: "w1", lotLabel: "", docKind: "sales_item", docId: "b1", quantityKg: 100, method: "scan", operator: "", recordedAt: "" },
    ];
    const inputKg: LotInput[] = [
      { id: "l1", outputKind: "P", outputId: "pk1", inputKind: "W", inputId: "w1", inputLabel: "", material: "", quantityKg: 200, method: "scan", operator: "", recordedAt: "" },
    ];
    const los = computeWipStock([w0, w1], [], collectWipDeductions(ban, dg, inputKg, dispatches));
    expect(remainingOf(los, "w0")).toBe(100);
    expect(remainingOf(los, "w1")).toBe(200);
    // Không truyền lô gắn ⇒ FIFO như cũ (lô cũ hết trước).
    const prev = computeWipStock([w0, w1], [], collectWipDeductions(ban, dg));
    expect(remainingOf(prev, "w0")).toBe(0); // 300 kg: lô cũ 100 trước
    expect(remainingOf(prev, "w1")).toBe(300); // rồi 200 từ lô mới
  });

  it("collectPackagingDeductions chỉ lấy lô BTP gắn đúng phiếu", () => {
    const inputKg = [
      { outputKind: "P", outputId: "pk1", inputKind: "W", inputId: "w1", quantityKg: null },
      { outputKind: "W", outputId: "pk1", inputKind: "S", inputId: "s1", quantityKg: 5 },
    ] as LotInput[];
    const [d] = collectPackagingDeductions([{ id: "pk1", fromProductId: "p1", fromSpec: "s1", inputKg: 10 } as Packaging], inputKg);
    expect(d!.lots).toEqual([{ id: "w1", kg: null }]);
  });

  it("filterRetailSales: bán đóng gói lấy lô TP (P), bán block thô lấy lô BTP (W)", () => {
    const dispatches = [
      { docKind: "sales_item", docId: "b1", lotKind: "P", lotId: "pk1", quantityKg: 5 },
      { docKind: "sales_item", docId: "b1", lotKind: "W", lotId: "w1", quantityKg: 5 },
    ] as LotDispatch[];
    const rows = [{ id: "b1", productId: "p1", spec: "s1", quantityKg: 5, sourceWarehouse: FG_WAREHOUSE }];
    expect(filterRetailSales(rows, FG_WAREHOUSE, dispatches)[0]!.lots).toEqual([{ id: "pk1", kg: 5 }]);
  });

  it("computeFinishedGoodLotStock: lô TP gắn trừ đúng phiếu, còn lại FIFO phiếu sớm trước", () => {
    const pk = (id: string, date: string, outputKg: number) =>
      ({ id, date, toProductId: "tp", toSpec: "1kg", outputKg, outputUnits: outputKg, warehouse: "" }) as Packaging;
    const los = computeFinishedGoodLotStock(
      [pk("pk1", "2026-10-01", 100), pk("pk2", "2026-10-03", 190)],
      [
        { productId: "tp", spec: "1kg", quantityKg: 50, lots: [{ id: "pk2", kg: 50 }] },
        { productId: "tp", spec: "1kg", quantityKg: 30 },
      ]
    );
    expect(los.find((l) => l.wipId === "pk1")!.remainingKg).toBe(70);
    expect(los.find((l) => l.wipId === "pk2")!.remainingKg).toBe(140);
  });
});

describe("bán vượt tồn — phần trừ không phân được vào lô nào", () => {
  const w0 = lo("w0", "2026-09-29", 100, 10);
  it("BTP: bán 120 trên lô 100 ⇒ lô về 0, bán vượt 20 (không nuốt mất)", () => {
    const result = computeWipStockDetail([w0], [], [{ productId: "p1", spec: "s1", quantityKg: 120 }]);
    expect(result.los[0]!.remainingKg).toBe(0);
    expect(result.oversales).toEqual([{ productId: "p1", spec: "s1", kg: 20 }]);
    expect(result.totalOversoldKg).toBe(20);
    // computeWipStock giữ nguyên API cũ: chỉ trả danh sách lô.
    expect(computeWipStock([w0], [], [{ productId: "p1", spec: "s1", quantityKg: 120 }])[0]!.remainingKg).toBe(0);
  });

  it("BTP: bán mặt hàng không có lô nào trong kho ⇒ cả dòng là bán vượt", () => {
    const result = computeWipStockDetail([w0], [], [{ productId: "p2", spec: "s1", quantityKg: 30 }]);
    expect(result.los[0]!.remainingKg).toBe(100);
    expect(result.totalOversoldKg).toBe(30);
  });

  it("BTP: lô gắn có kg vượt phần lô còn, FIFO cũng hết ⇒ phần dư thành bán vượt", () => {
    const result = computeWipStockDetail([w0], [], [{ productId: "p1", spec: "s1", quantityKg: 150, lots: [{ id: "w0", kg: 150 }] }]);
    expect(result.los[0]!.remainingKg).toBe(0);
    expect(result.totalOversoldKg).toBe(50);
  });

  it("không bán vượt ⇒ danh sách rỗng, tổng 0", () => {
    const result = computeWipStockDetail([w0], [], [{ productId: "p1", spec: "s1", quantityKg: 60 }]);
    expect(result.oversales).toEqual([]);
    expect(result.totalOversoldKg).toBe(0);
  });

  it("TP: đóng gói 100, bán 120 ⇒ computeFinishedGoodStock −20 = Σ tồn theo lô (0) − bán vượt (20)", () => {
    const pk = { id: "pk1", date: "2026-10-01", toProductId: "tp", toSpec: "1kg", outputKg: 100, outputUnits: 100, warehouse: "" } as Packaging;
    const ban = [{ productId: "tp", spec: "1kg", quantityKg: 120 }];
    const total = computeFinishedGoodStock([pk], ban)[0]!.remainingKg;
    const theoLo = computeFinishedGoodLotStockDetail([pk], ban);
    expect(total).toBe(-20);
    expect(theoLo.los[0]!.remainingKg).toBe(0);
    expect(theoLo.totalOversoldKg).toBe(20);
    expect(theoLo.los.reduce((s, l) => s + l.remainingKg, 0) - theoLo.totalOversoldKg).toBe(total);
    expect(computeFinishedGoodLotStock([pk], ban)[0]!.remainingKg).toBe(0);
  });
});
