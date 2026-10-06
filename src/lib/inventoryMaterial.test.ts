import { describe, expect, test } from "vitest";
import type {
  BalancingInputItem,
  BalancingPeriod,
  DailyLock,
  DomesticSaleItem,
  MaterialImportItem,
  MaterialOpeningStock,
} from "@/types";
import { conDoTheoNgay, tinhSoTonNL, tinhTonNLTong } from "./inventoryMaterial";

const ky = (id: string, startDate: string, endDate: string): BalancingPeriod =>
  ({ id, materialTypeName: "Bạch tuộc 2 da", startDate, endDate }) as BalancingPeriod;

let n = 0;
const dong = (periodId: string, p: Partial<BalancingInputItem>): BalancingInputItem => ({
  id: `i${++n}`,
  periodId,
  groupName: "Thủy sản",
  name: "Bạch tuộc 2 da",
  quantityKg: 0,
  unitPrice: null,
  ratioPercentage: null,
  sourceWarehouse: "",
  dailyQuantities: {},
  carryOverKg: 0,
  isReduction: false,
  reductionWarehouseId: "",
  autoSource: "",
  ...p,
});
const layXaDong = (periodId: string, daily: Record<string, number>) =>
  dong(periodId, { groupName: "Xả đông", sourceWarehouse: "Kho mình", name: "Lấy xả đông", dailyQuantities: daily });
/** Gửi đông là dòng giảm: lưu ÂM. */
const guiDong = (periodId: string, daily: Record<string, number>) =>
  dong(periodId, {
    groupName: "Xả đông",
    sourceWarehouse: "Kho mình",
    name: "Gửi đông",
    isReduction: true,
    reductionWarehouseId: "kho-dong",
    dailyQuantities: daily,
  });
const chot = (lockDate: string, leftover: Record<string, number>): DailyLock => ({
  id: `l${lockDate}`,
  lockDate,
  workshop: "Đông",
  isLocked: true,
  lockedAt: "",
  totalKgAtLock: 0,
  reopenReason: "",
  note: "",
  leftoverByMaterial: leftover,
});

const K1 = ky("k1", "2026-09-01", "2026-09-03");
const K2 = ky("k2", "2026-09-04", "2026-09-06");

describe("tinhSoTonNL — hai dòng kho ở Cân đối", () => {
  test("Gửi đông CỘNG tồn, Lấy xả đông kỳ sau TRỪ tồn — tồn chạy nối kỳ", () => {
    const inputs = [
      guiDong("k1", { "2026-09-02": -1500, "2026-09-03": -500 }),
      layXaDong("k2", { "2026-09-04": 1200 }),
    ];
    const [r1, r2] = tinhSoTonNL([K1, K2], inputs, [], [], []);
    expect(r1).toMatchObject({ tonDau: 0, dongGui: 2000, xaDong: 0, tonCuoi: 2000, nguonDongGui: "can-doi" });
    expect(r2).toMatchObject({ tonDau: 2000, dongGui: 0, xaDong: 1200, tonCuoi: 800 });
  });

  test("Lấy xả đông vượt tồn ⇒ tồn âm, gắn cảnh báo", () => {
    const [r] = tinhSoTonNL([K1], [layXaDong("k1", { "2026-09-01": 300 })], [], [], []);
    expect(r.tonCuoi).toBe(-300);
    expect(r.canhBaoAm).toBe(true);
  });

  test("Gửi đông ở Cân đối là số chuẩn, còn dở SX vẫn trả ra để đối chiếu (không cộng đôi)", () => {
    const locks = [chot("2026-09-02", { "Bạch tuộc 2 da lớn (80↑)": 700 })];
    const [r] = tinhSoTonNL([K1], [guiDong("k1", { "2026-09-02": -650 })], [], [], locks);
    expect(r.dongGui).toBe(650);
    expect(r.guiDongCanDoi).toBe(650);
    expect(r.conDoSX).toBe(700);
    expect(r.nguonDongGui).toBe("can-doi");
  });

  test("Chưa gõ Gửi đông ⇒ lấy còn dở SX (hướng 1 giữ nguyên)", () => {
    const locks = [chot("2026-09-02", { "Bạch tuộc 2 da": 700 })];
    const [r] = tinhSoTonNL([K1], [], [], [], locks);
    expect(r).toMatchObject({ dongGui: 700, nguonDongGui: "san-xuat", tonCuoi: 700 });
  });

  test("Dữ liệu cũ: chuyển kỳ âm/dương ở dòng thường vẫn đọc như trước", () => {
    const inputs = [
      dong("k1", { dailyQuantities: { "2026-09-01": 5000 }, carryOverKg: -400 }),
      dong("k2", { groupName: "Xả đông", sourceWarehouse: "Kho mình", carryOverKg: 400 }),
    ];
    const [r1, r2] = tinhSoTonNL([K1, K2], inputs, [], [], []);
    expect(r1).toMatchObject({ dongGui: 400, nguonDongGui: "chuyen-ky", tonCuoi: 400 });
    // Dòng nhận chuyển kỳ cũ (Xả đông · Kho mình · chuyển kỳ dương) = lấy xả đông, đếm MỘT lần.
    expect(r2).toMatchObject({ xaDong: 400, tonCuoi: 0 });
  });
});

describe("conDoTheoNgay", () => {
  test("gom còn dở cùng họ theo ngày chốt trong kỳ, bỏ ngày ngoài kỳ và họ khác", () => {
    const locks = [
      chot("2026-09-01", { "Bạch tuộc 2 da lớn (80↑)": 100, "Bạch tuộc 2 da nhỏ (80↓)": 50 }),
      chot("2026-09-03", { "Bạch tuộc 1 da": 999 }),
      chot("2026-09-09", { "Bạch tuộc 2 da": 70 }),
    ];
    expect(conDoTheoNgay(locks, K1)).toEqual({ "2026-09-01": 150 });
  });
});

describe("tinhTonNLTong — bán nội địa là khoản XUẤT, trừ tồn NL", () => {
  const nhap = (deliveryDate: string, kg: number, ten = "Bạch tuộc 2 da lớn (80↑)"): MaterialImportItem =>
    ({
      id: `n${deliveryDate}${kg}`,
      shipmentId: "",
      deliveryDate,
      workshop: "Đông",
      category: "Bạch tuộc",
      supplierName: "",
      materialTypeName: ten,
      quantityKg: kg,
      unitPrice: null,
      driverName: "",
      licensePlate: "",
      note: "",
    }) as MaterialImportItem;
  const ban = (saleDate: string, kg: number, ten = "Bạch tuộc 2 da nhỏ (80↓)"): DomesticSaleItem => ({
    id: `b${saleDate}${kg}`,
    saleDate,
    postingDate: saleDate,
    backdateReason: "",
    workshop: "Đông",
    materialTypeName: ten,
    quantityKg: kg,
    unitPrice: 145000,
    customerName: "",
    note: "",
    operator: "",
  });
  const range = { tuNgay: "2026-10-05", denNgay: "2026-10-07" };

  test("trong kỳ: tồn cuối = tồn đầu + nhập − bán nội địa; cùng HỌ gộp lớn/nhỏ", () => {
    const kq = tinhTonNLTong([], [], [nhap("2026-10-05", 5000)], [], [], range, [ban("2026-10-06", 987)]);
    expect(kq.theoHo).toHaveLength(1);
    const h = kq.theoHo[0];
    expect(h.banNoiDia).toBe(987);
    expect(h.tonCuoi).toBe(5000 - 987);
    expect(kq.tongBanNoiDia).toBe(987);
    expect(kq.tongTonCuoi).toBe(4013);
  });

  test("bán TRƯỚC kỳ trừ vào tồn đầu; bán ngoài kỳ (sau) không tính", () => {
    const kq = tinhTonNLTong(
      [], [], [nhap("2026-10-01", 3000)], [], [], range,
      [ban("2026-10-02", 500), ban("2026-10-09", 70)],
    );
    expect(kq.theoHo[0].tonDau).toBe(2500);
    expect(kq.theoHo[0].banNoiDia).toBe(0);
    expect(kq.tongTonCuoi).toBe(2500);
  });

  test("bán TRƯỚC mốc khai tồn đầu đã nằm trong số khai tay ⇒ không trừ lại", () => {
    const opening: MaterialOpeningStock[] = [
      { id: "o1", workshop: "Đông", materialTypeName: "Bạch tuộc 2 da", asOfDate: "2026-10-03", quantityKg: 1000, note: "" },
    ];
    const kq = tinhTonNLTong([], [], [], opening, [], range, [ban("2026-10-01", 400), ban("2026-10-04", 100)]);
    expect(kq.theoHo[0].tonDau).toBe(900); // chỉ trừ phần bán từ mốc
  });

  test("bảng theo ngày: ngày chỉ có bán nội địa cũng thành dòng, tồn giảm dần", () => {
    const kq = tinhTonNLTong([], [], [nhap("2026-10-05", 2000)], [], [], range, [ban("2026-10-06", 300)]);
    expect(kq.theoNgay.map((d) => [d.date, d.nhap, d.banNoiDia, d.tonCuoi])).toEqual([
      ["2026-10-05", 2000, 0, 2000],
      ["2026-10-06", 0, 300, 1700],
    ]);
  });

  test("không truyền sổ bán nội địa ⇒ kết quả y như trước", () => {
    const kq = tinhTonNLTong([], [], [nhap("2026-10-05", 1234)], [], [], range);
    expect(kq.tongTonCuoi).toBe(1234);
    expect(kq.tongBanNoiDia).toBe(0);
  });
});
