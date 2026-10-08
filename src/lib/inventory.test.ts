import { describe, it, expect } from "vitest";
import { tinhTon, locBanLe, khaDung, KHO_BAN_LE, KHO_TP, truTonBTP, tinhTonTPTheoLo, dongGoiTruTon } from "@/lib/inventory";
import type { WipProductionItem, ExportItem, LotDispatch, LotInput, Packaging } from "@/types";

const lo = (
  id: string,
  productionDate: string,
  quantityKg: number,
  blocksCount: number,
  status: "da-nhap" | "cho-nhap" = "da-nhap",
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

describe("tinhTon", () => {
  it("chỉ tính lô đã nhập kho, conLai = nhập − xuất", () => {
    const los = tinhTon(
      [lo("w1", "2026-09-01", 100, 10), lo("w2", "2026-09-02", 50, 5, "cho-nhap")],
      [{ wipId: "w1", quantityKg: 30, blocksCount: 3 } as ExportItem],
    );
    expect(los).toHaveLength(1); // w2 "cho-nhap" bị loại
    expect(los[0].wipId).toBe("w1");
    expect(los[0].conLai).toBe(70);
    expect(los[0].luongXuat).toBe(30);
    expect(los[0].blockConLai).toBe(7);
  });

  it("bán lẻ trừ tồn FIFO theo ngày SX (lô cũ trước)", () => {
    const los = tinhTon(
      [lo("wNew", "2026-09-02", 100, 10), lo("wOld", "2026-08-30", 40, 4)],
      [],
      [{ productId: "p1", spec: "s1", quantityKg: 50 }],
    );
    const old = los.find((l) => l.wipId === "wOld")!;
    const neu = los.find((l) => l.wipId === "wNew")!;
    expect(old.conLai).toBe(0); // lô cũ hết trước (40), còn 10 sang lô mới
    expect(neu.conLai).toBe(90); // 100 − 10
  });
});

describe("locBanLe", () => {
  const rows = [
    { productId: "p1", spec: "s1", quantityKg: 10, sourceWarehouse: KHO_BAN_LE },
    { productId: "p2", spec: "s1", quantityKg: 20, sourceWarehouse: KHO_TP },
    { productId: "p3", spec: "s1", quantityKg: 30, sourceWarehouse: "Lưu trữ" },
    { productId: "p4", spec: "s1", quantityKg: 40, sourceWarehouse: "" },
  ];

  it("mặc định lấy dòng bán block thô (KHO_BAN_LE), bỏ handoff/đơn đặt", () => {
    const r = locBanLe(rows);
    expect(r).toHaveLength(1);
    expect(r[0].productId).toBe("p1");
  });

  it("truyền KHO_TP lấy dòng bán hàng đóng gói", () => {
    const r = locBanLe(rows, KHO_TP);
    expect(r).toHaveLength(1);
    expect(r[0].productId).toBe("p2");
  });
});

describe("khaDung", () => {
  it("cộng phần còn lại theo (mặt hàng × quy cách), kẹp âm về 0", () => {
    const ton = [
      { productId: "p1", spec: "s1", conLai: 70 },
      { productId: "p1", spec: "s1", conLai: 30 },
      { productId: "p1", spec: "s1", conLai: -5 }, // âm không được cộng vào
      { productId: "p2", spec: "s1", conLai: 999 },
    ] as Parameters<typeof khaDung>[0];
    expect(khaDung(ton, "p1", "s1")).toBe(100);
    expect(khaDung(ton, "pX", "s1")).toBe(0);
  });
});

describe("trừ tồn theo lô đã gắn (truy xuất QR)", () => {
  const w0 = lo("w0", "2026-09-29", 100, 10); // lô cũ, không ai gắn
  const w1 = lo("w1", "2026-10-02", 500, 50);
  const conLai = (los: ReturnType<typeof tinhTon>, id: string) => los.find((l) => l.wipId === id)!.conLai;

  it("không gắn lô ⇒ y như FIFO cũ", () => {
    const los = tinhTon([w0, w1], [], [{ productId: "p1", spec: "s1", quantityKg: 200 }]);
    expect(conLai(los, "w0")).toBe(0);
    expect(conLai(los, "w1")).toBe(400);
  });

  it("gắn lô có kg ⇒ trừ đúng lô đó, lô cũ không bị đụng", () => {
    const los = tinhTon([w0, w1], [], [{ productId: "p1", spec: "s1", quantityKg: 200, lo: [{ id: "w1", kg: 200 }] }]);
    expect(conLai(los, "w0")).toBe(100);
    expect(conLai(los, "w1")).toBe(300);
  });

  it("gắn lô chưa cân ⇒ FIFO trong các lô đã gắn", () => {
    const w2 = lo("w2", "2026-10-03", 50, 5);
    const los = tinhTon([w0, w1, w2], [], [{ productId: "p1", spec: "s1", quantityKg: 530, lo: [{ id: "w2", kg: null }, { id: "w1", kg: null }] }]);
    expect(conLai(los, "w0")).toBe(100);
    expect(conLai(los, "w1")).toBe(0); // w1 cũ hơn w2 ⇒ trừ trước
    expect(conLai(los, "w2")).toBe(20);
  });

  it("kg gắn vượt phần lô còn ⇒ phần dư rơi xuống FIFO, không làm lô âm", () => {
    const los = tinhTon([w0, w1], [], [{ productId: "p1", spec: "s1", quantityKg: 550, lo: [{ id: "w1", kg: 550 }] }]);
    expect(conLai(los, "w1")).toBe(0);
    expect(conLai(los, "w0")).toBe(50);
  });

  it("gắn nhầm lô khác mặt hàng ⇒ bỏ qua, trừ FIFO", () => {
    const khac = { ...lo("wx", "2026-09-01", 80, 8), productId: "p9" } as WipProductionItem;
    const los = tinhTon([w0, w1, khac], [], [{ productId: "p1", spec: "s1", quantityKg: 60, lo: [{ id: "wx", kg: 60 }] }]);
    expect(conLai(los, "wx")).toBe(80);
    expect(conLai(los, "w0")).toBe(40);
  });

  it("truTonBTP gom bán lẻ + đóng gói kèm lô gắn từ lot_dispatches / lot_inputs", () => {
    const ban = [{ id: "b1", productId: "p1", spec: "s1", quantityKg: 100, sourceWarehouse: KHO_BAN_LE }];
    const dg = [{ id: "pk1", fromProductId: "p1", fromSpec: "s1", inputKg: 200 } as Packaging];
    const gan: LotDispatch[] = [
      { id: "d1", lotKind: "W", lotId: "w1", lotLabel: "", docKind: "sales_item", docId: "b1", quantityKg: 100, method: "quet", operator: "", recordedAt: "" },
    ];
    const vao: LotInput[] = [
      { id: "l1", outputKind: "P", outputId: "pk1", inputKind: "W", inputId: "w1", inputLabel: "", material: "", quantityKg: 200, method: "quet", operator: "", recordedAt: "" },
    ];
    const los = tinhTon([w0, w1], [], truTonBTP(ban, dg, vao, gan));
    expect(conLai(los, "w0")).toBe(100);
    expect(conLai(los, "w1")).toBe(200);
    // Không truyền lô gắn ⇒ FIFO như cũ (lô cũ hết trước).
    const cu = tinhTon([w0, w1], [], truTonBTP(ban, dg));
    expect(conLai(cu, "w0")).toBe(0); // 300 kg: lô cũ 100 trước
    expect(conLai(cu, "w1")).toBe(300); // rồi 200 từ lô mới
  });

  it("dongGoiTruTon chỉ lấy lô BTP gắn đúng phiếu", () => {
    const vao = [
      { outputKind: "P", outputId: "pk1", inputKind: "W", inputId: "w1", quantityKg: null },
      { outputKind: "W", outputId: "pk1", inputKind: "S", inputId: "s1", quantityKg: 5 },
    ] as LotInput[];
    const [d] = dongGoiTruTon([{ id: "pk1", fromProductId: "p1", fromSpec: "s1", inputKg: 10 } as Packaging], vao);
    expect(d!.lo).toEqual([{ id: "w1", kg: null }]);
  });

  it("locBanLe: bán đóng gói lấy lô TP (P), bán block thô lấy lô BTP (W)", () => {
    const gan = [
      { docKind: "sales_item", docId: "b1", lotKind: "P", lotId: "pk1", quantityKg: 5 },
      { docKind: "sales_item", docId: "b1", lotKind: "W", lotId: "w1", quantityKg: 5 },
    ] as LotDispatch[];
    const rows = [{ id: "b1", productId: "p1", spec: "s1", quantityKg: 5, sourceWarehouse: KHO_TP }];
    expect(locBanLe(rows, KHO_TP, gan)[0]!.lo).toEqual([{ id: "pk1", kg: 5 }]);
  });

  it("tinhTonTPTheoLo: lô TP gắn trừ đúng phiếu, còn lại FIFO phiếu sớm trước", () => {
    const pk = (id: string, date: string, outputKg: number) =>
      ({ id, date, toProductId: "tp", toSpec: "1kg", outputKg, outputUnits: outputKg, warehouse: "" }) as Packaging;
    const los = tinhTonTPTheoLo(
      [pk("pk1", "2026-10-01", 100), pk("pk2", "2026-10-03", 190)],
      [
        { productId: "tp", spec: "1kg", quantityKg: 50, lo: [{ id: "pk2", kg: 50 }] },
        { productId: "tp", spec: "1kg", quantityKg: 30 },
      ]
    );
    expect(los.find((l) => l.wipId === "pk1")!.conLai).toBe(70);
    expect(los.find((l) => l.wipId === "pk2")!.conLai).toBe(140);
  });
});
