import { describe, expect, test } from "vitest";
import type { BalancingOutputItem, BalancingPeriod, MaterialImportItem } from "@/types";
import {
  KHACH_KHAC,
  ghiTraNo,
  loaiDongKho,
  tachTraNo,
  tenKhachCanDoi,
  dongMauConThieu,
  dungDongMauTP,
  goiYKhachGia,
  gomNhapTheoLoai,
  khoaDongTP,
  kyMauTP,
  kyTrungNgayCungHo,
  ngayTrongKy,
  nhapHangHopLe,
} from "./balancingGrid";

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

const tpRow = (periodId: string, productId: string, customerId: string, unitPrice: number | null, spec = "", channel: BalancingOutputItem["channel"] = "Xuất khẩu"): BalancingOutputItem => ({
  id: `${periodId}-${productId}-${customerId}-${spec}`,
  periodId,
  productId,
  customerId,
  channel,
  quantityKg: 0,
  unitPrice,
  spec,
});

describe("dòng mẫu khối 2", () => {
  const dsKy = [
    ky("K1", "2026-08-20", "2026-08-25"),
    ky("K2", "2026-08-26", "2026-08-31"),
    ky("K3", "2026-09-01", "2026-09-05"),
    ky("K4", "2026-09-10", "2026-09-12"),
    ky("L1", "2026-08-28", "2026-08-30", "Bạch tuộc 1 da"),
  ];
  const tatCaTP = [
    tpRow("K1", "luoc230", "hanwa", 10.4),
    tpRow("K2", "luoc230", "hanwa", 10.43),
    tpRow("K2", "tambot", "jfda", 9.3),
    tpRow("K2", "tambot", "dairei", 9.2),
    tpRow("K2", "tambot", "jfda", null),
    tpRow("L1", "motda", "x", 5),
  ];

  test("kỳ mẫu = kỳ cùng họ gần nhất KẾT THÚC TRƯỚC, có dòng; không lấy kỳ khác loại", () => {
    expect(kyMauTP(dsKy[2], dsKy, tatCaTP)?.id).toBe("K2");
    expect(kyMauTP(dsKy[3], dsKy, tatCaTP)?.id).toBe("K2");
    // kỳ đầu tiên, không có kỳ trước có dòng ⇒ lấy kỳ mới nhất còn lại
    expect(kyMauTP(ky("K0", "2026-08-01", "2026-08-05"), dsKy, tatCaTP)?.id).toBe("K2");
    expect(kyMauTP(ky("M", "2026-09-01", "2026-09-05", "Mực ống"), dsKy, tatCaTP)).toBeNull();
  });

  test("mỗi mặt hàng × khách × GIÁ một dòng mẫu; khác khách hoặc khác giá vẫn tách", () => {
    const mau = dungDongMauTP(tatCaTP.filter((r) => r.periodId === "K2"));
    expect(mau.map((m) => [m.khoa, m.unitPrice])).toEqual([
      [khoaDongTP("luoc230", "", "hanwa"), 10.43],
      [khoaDongTP("tambot", "", "jfda"), 9.3],
      [khoaDongTP("tambot", "", "dairei"), 9.2],
      [khoaDongTP("tambot", "", "jfda"), null],
    ]);
    expect(new Set(mau.map((m) => m.id)).size).toBe(4);
  });

  test("hai dòng mẫu cùng khoá: kỳ đã có 1 dòng ⇒ còn thiếu đúng 1 (không biến mất cả hai)", () => {
    const mau = dungDongMauTP(tatCaTP.filter((r) => r.periodId === "K2"));
    const thieu = dongMauConThieu(mau, [{ productId: "tambot", spec: "", customerId: "jfda" }]);
    expect(thieu.filter((m) => m.customerId === "jfda").map((m) => m.unitPrice)).toEqual([null]);
  });

  test("dòng mẫu còn thiếu: bỏ dòng kỳ đã có (cùng khách, hoặc dòng hút chưa chọn khách)", () => {
    const mau = dungDongMauTP(tatCaTP.filter((r) => r.periodId === "K2"));
    expect(dongMauConThieu(mau, [{ productId: "luoc230", spec: "", customerId: "hanwa" }]).length).toBe(3);
    expect(dongMauConThieu(mau, [{ productId: "tambot", spec: "", customerId: "" }]).map((m) => m.productId)).toEqual(["luoc230"]);
  });

  test("gợi ý khách + giá: ưu tiên dòng mẫu, rồi kỳ gần nhất có giá, không có ⇒ null", () => {
    const mau = dungDongMauTP(tatCaTP.filter((r) => r.periodId === "K2"));
    expect(goiYKhachGia("tambot", "", mau, tatCaTP, dsKy, "K3")).toEqual({ customerId: "jfda", channel: "Xuất khẩu", unitPrice: 9.3 });
    expect(goiYKhachGia("luoc230", "", [], tatCaTP, dsKy, "K3")?.unitPrice).toBe(10.43);
    expect(goiYKhachGia("moi", "", mau, tatCaTP, dsKy, "K3")).toBeNull();
  });
});

describe("dòng kho khối NL — loaiDongKho", () => {
  const base = { groupName: "Xả đông" as const, sourceWarehouse: "Kho mình", isReduction: false };
  test("Xả đông · Kho mình = lấy xả đông; thêm cờ giảm = gửi đông", () => {
    expect(loaiDongKho(base)).toBe("lay-xa-dong");
    expect(loaiDongKho({ ...base, isReduction: true })).toBe("gui-dong");
  });
  test("xả đông mua về / dòng thủy sản / dòng giảm thường KHÔNG phải dòng kho", () => {
    expect(loaiDongKho({ ...base, sourceWarehouse: "Mua về" })).toBeNull();
    expect(loaiDongKho({ ...base, sourceWarehouse: "" })).toBeNull();
    expect(loaiDongKho({ ...base, groupName: "Thủy sản", isReduction: true })).toBeNull();
  });
});

describe("Trả · Nợ — tachTraNo / ghiTraNo", () => {
  test("chuyển kỳ cũ (chưa có debtKg) hiện ở Trả", () => {
    expect(tachTraNo({ carryOverKg: -2000 })).toEqual({ tra: -2000, no: 0 });
  });
  test("ghi một cột giữ cột kia, tổng chuyển kỳ = Trả + Nợ (có dấu)", () => {
    const sau = ghiTraNo({ carryOverKg: -2000 }, { no: 258 });
    expect(sau).toEqual({ carryOverKg: -1742, debtKg: 258 });
    expect(tachTraNo(sau)).toEqual({ tra: -2000, no: 258 });
    expect(ghiTraNo(sau, { tra: 0 })).toEqual({ carryOverKg: 258, debtKg: 258 });
  });
  test("số lẻ không trôi dấu phẩy động", () => {
    expect(tachTraNo(ghiTraNo({ carryOverKg: 0.3 }, { no: 0.1 }))).toEqual({ tra: 0.3, no: 0.1 });
  });
});

describe("khách Khác", () => {
  test("mục cố định ngoài danh mục", () => {
    expect(tenKhachCanDoi(KHACH_KHAC, [])).toBe("Khác");
    expect(tenKhachCanDoi("k1", [{ id: "k1", name: "Hanwa" }])).toBe("Hanwa");
    expect(tenKhachCanDoi("", [])).toBe("—");
  });
});
