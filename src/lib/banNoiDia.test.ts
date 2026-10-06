import { describe, it, expect } from "vitest";
import type { DomesticSaleItem } from "@/types";
import {
  TEN_DONG_BAN_NOI_DIA,
  amTheoNgay,
  banNoiDiaTheoKy,
  doiChieuBanNoiDia,
  laDongBanNoiDia,
} from "./banNoiDia";

// Bán nội địa = NL bán thẳng cho khách trong nước (VND), không chế biến. Sổ /wip
// ghi kg dương; Cân đối khối 1 là dòng giảm "Bán nội địa" (lưu âm, như bảng giấy −987).

const d = (p: Partial<DomesticSaleItem>): DomesticSaleItem => ({
  id: Math.random().toString(36),
  saleDate: "2026-07-21",
  postingDate: "2026-07-21",
  backdateReason: "",
  workshop: "Đông",
  materialTypeName: "Bạch tuộc 2 da lớn (80↑)",
  quantityKg: 0,
  unitPrice: null,
  customerName: "",
  note: "",
  operator: "",
  ...p,
});

const ky = { startDate: "2026-07-21", endDate: "2026-07-25", materialTypeName: "Bạch tuộc 2 da" };

describe("laDongBanNoiDia", () => {
  it("nhận theo TÊN (không phân hoa thường), kể cả dòng cũ không phải dòng giảm — tránh trừ đôi", () => {
    expect(laDongBanNoiDia({ name: TEN_DONG_BAN_NOI_DIA })).toBe(true);
    expect(laDongBanNoiDia({ name: " bán nội địa " })).toBe(true);
    expect(laDongBanNoiDia({ name: "Hao hụt" })).toBe(false);
  });
});

describe("banNoiDiaTheoKy", () => {
  it("lọc ngày trong kỳ + cùng HỌ NL, cộng theo ngày, giá bình quân gia quyền", () => {
    const kq = banNoiDiaTheoKy(
      [
        d({ quantityKg: 600, unitPrice: 145000 }),
        d({ quantityKg: 387, unitPrice: 150000, materialTypeName: "Bạch tuộc 2 da nhỏ (80↓)" }),
        d({ quantityKg: 100, saleDate: "2026-07-23" }), // không giá — vẫn tính kg
        d({ quantityKg: 50, saleDate: "2026-07-30" }), // ngoài kỳ
        d({ quantityKg: 70, materialTypeName: "Bạch tuộc 1 da" }), // khác họ
        d({ quantityKg: 0, unitPrice: 999 }), // ≤ 0 bỏ
      ],
      ky
    );
    expect(kq.theoNgay).toEqual({ "2026-07-21": 987, "2026-07-23": 100 });
    expect(kq.tongKg).toBe(1087);
    expect(kq.soDong).toBe(3);
    // (600×145.000 + 387×150.000) / 987 = 146.960,49… ⇒ làm tròn
    expect(kq.giaBinhQuan).toBe(146960);
  });
  it("không dòng nào có giá ⇒ giá null; kỳ thiếu ngày ⇒ rỗng", () => {
    expect(banNoiDiaTheoKy([d({ quantityKg: 5 })], ky).giaBinhQuan).toBeNull();
    expect(banNoiDiaTheoKy([d({ quantityKg: 5 })], { materialTypeName: "Bạch tuộc 2 da" }).tongKg).toBe(0);
  });
});

describe("doiChieuBanNoiDia / amTheoNgay", () => {
  it("Cân đối (âm) so sổ SX (dương) theo từng ngày", () => {
    const sx = { "2026-07-21": 987 };
    expect(doiChieuBanNoiDia({}, sx)).toBe("trong");
    expect(doiChieuBanNoiDia(undefined, sx)).toBe("trong");
    expect(doiChieuBanNoiDia({ "2026-07-21": -987 }, sx)).toBe("khop");
    expect(doiChieuBanNoiDia({ "2026-07-21": -900 }, sx)).toBe("lech");
    expect(doiChieuBanNoiDia({ "2026-07-21": -987, "2026-07-22": -5 }, sx)).toBe("lech");
  });
  it("đổi dấu sang âm, bỏ ngày 0", () => {
    expect(amTheoNgay({ a: 5, b: 0, c: -3 })).toEqual({ a: -5, c: -3 });
  });
});
