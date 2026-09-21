import { describe, it, expect } from "vitest";
import { tinhTon, locBanLe, khaDung, KHO_BAN_LE, KHO_TP } from "@/lib/inventory";
import type { WipProductionItem, ExportItem } from "@/types";

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
