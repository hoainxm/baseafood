import { describe, expect, test } from "vitest";
import type { BalancingPeriod, MaterialImportItem } from "@/types";
import { gomNhapTheoLoai, kyTrungNgayCungHo, ngayTrongKy, nhapHangHopLe } from "./balancingGrid";

const ky = (id: string, startDate: string, endDate: string, materialTypeName = "Bạch tuộc 2 da") =>
  ({ id, materialTypeName, startDate, endDate }) as BalancingPeriod;

let n = 0;
const nhap = (deliveryDate: string, materialTypeName: string, quantityKg: number, balancingPeriodId = ""): MaterialImportItem => ({
  id: `m${++n}`,
  shipmentId: "",
  deliveryDate,
  workshop: "Đông" as MaterialImportItem["workshop"],
  category: "" as MaterialImportItem["category"],
  supplierName: "",
  materialTypeName,
  quantityKg,
  unitPrice: null,
  driverName: "",
  licensePlate: "",
  note: "",
  balancingPeriodId,
});

/* Sổ nhập thật 31/08–06/09/2026 (rút gọn): mỗi ngày 2 da lớn + nhỏ, xen 1 da. */
const so: MaterialImportItem[] = [
  nhap("2026-08-31", "Bạch tuộc 2 da lớn (80↑)", 1649),
  nhap("2026-08-31", "Bạch tuộc 1 da", 1525),
  nhap("2026-09-01", "Bạch tuộc 2 da lớn (80↑)", 6762),
  nhap("2026-09-01", "Bạch tuộc 2 da nhỏ (80↓)", 1202),
  nhap("2026-09-01", "Bạch tuộc 1 da", 2160),
  nhap("2026-09-03", "Bạch tuộc 2 da nhỏ (80↓)", 5019),
  nhap("2026-09-03", "Bạch tuộc 1 da", 6137),
  nhap("2026-09-05", "Bạch tuộc 2 da lớn (80↑)", 2491),
  nhap("2026-09-05", "Bạch tuộc 1 da", 5509),
  nhap("2026-09-06", "Bạch tuộc 2 da lớn (80↑)", 3146),
];

describe("hút sổ nhập vào kỳ cân đối", () => {
  test("ngày trong kỳ tính theo UTC, đủ cả hai đầu mút", () => {
    expect(ngayTrongKy(ky("k", "2026-09-01", "2026-09-05"))).toEqual([
      "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05",
    ]);
  });

  test("chỉ lấy ĐÚNG họ 2 da (lớn + nhỏ) trong ngày của kỳ — không 1 da, không ngày ngoài kỳ", () => {
    const lay = nhapHangHopLe(ky("k", "2026-09-01", "2026-09-05"), so);
    expect(lay.every((r) => r.materialTypeName.startsWith("Bạch tuộc 2 da"))).toBe(true);
    expect(lay.map((r) => r.deliveryDate).sort()).toEqual(["2026-09-01", "2026-09-01", "2026-09-03", "2026-09-05"]);
    const gom = gomNhapTheoLoai(lay);
    expect([...gom.keys()]).toEqual(["Bạch tuộc 2 da"]);
    expect(gom.get("Bạch tuộc 2 da")!.theoNgay).toEqual({ "2026-09-01": 7964, "2026-09-03": 5019, "2026-09-05": 2491 });
  });

  test("chuyến đã thuộc kỳ khác không bị hút lại", () => {
    const daGan = so.map((r) => (r.deliveryDate === "2026-09-01" ? { ...r, balancingPeriodId: "kyA" } : r));
    const lay = nhapHangHopLe(ky("kyB", "2026-09-01", "2026-09-05"), daGan);
    expect(lay.some((r) => r.deliveryDate === "2026-09-01")).toBe(false);
  });
});

describe("kyTrungNgayCungHo", () => {
  const dsKy = [
    ky("A", "2026-09-01", "2026-09-05"),
    ky("B", "2026-09-01", "2026-09-05"),
    ky("C", "2026-09-06", "2026-09-10"),
    ky("D", "2026-09-03", "2026-09-04", "Bạch tuộc 1 da"),
    ky("E", "2026-09-05", "2026-09-07", "Bạch tuộc 2 da lớn (80↑)"),
  ];
  test("bắt kỳ cùng họ chồng ngày; bỏ qua chính nó, kỳ liền kề không chồng, kỳ khác loại", () => {
    expect(kyTrungNgayCungHo(dsKy[1], dsKy).map((k) => k.id).sort()).toEqual(["A", "E"]);
    expect(kyTrungNgayCungHo(dsKy[2], dsKy).map((k) => k.id)).toEqual(["E"]);
  });
});
