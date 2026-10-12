import { describe, expect, it } from "vitest";
import { doiSoat, soVN } from "./doiSoatHddt";
import { soHaiBanHddt } from "./doiSoatHaiBan";

// ---------- Dựng workbook giả (đúng hình dạng `docWorkbook` trả về) ----------

type Sheet = Parameters<typeof doiSoat>[0][number];
const sheet = (ten: string, rows: unknown[][]): Sheet => ({
  ten,
  rows,
  r0: 0,
  c0: 0,
  rong: Math.max(...rows.map((r) => r.length)),
});

const HDR_HD = [
  "Ký hiệu hóa đơn", "Số hóa đơn", "Ngày lập", "MST người bán", "Tên người bán",
  "Tổng tiền chưa thuế", "Tổng tiền thuế", "Tổng tiền thanh toán", "Đơn vị tiền tệ", "Tỷ giá",
];
/** Một dòng hóa đơn: [ký hiệu, số, mst, chưa thuế, thuế, tổng, tiền tệ?, tỷ giá?] */
const hd = (kh: string, so: string, mst: unknown, chua: number, thue: number, tong: number, dvt = "VND", tyGia: unknown = 1) =>
  [kh, so, "05/02/2026", mst, "NCC", chua, thue, tong, dvt, tyGia];
const sheetHd = (ten: string, dong: unknown[][]) => sheet(ten, [["DANH SÁCH HÓA ĐƠN"], HDR_HD, ...dong]);

const sheetSo = (dong: unknown[][], hdrMst = "RMST") =>
  sheet("PMEM", [["KY_HIEU", "SO_HD", hdrMst, "TIENHANG", "TIENTHUE", "TONGCONG"], ...dong]);
/** Dòng sổ: [ký hiệu, số, mst, tiền hàng, thuế, tổng] */
const so = (kh: string, soHd: string, mst: unknown, hang: number, thue: number) => [kh, soHd, mst, hang, thue, hang + thue];

const MST = "0301234567";

// ---------- soVN ----------

describe("soVN — số kiểu Việt/US không phụ thuộc locale", () => {
  it.each([
    ["1,234,567", 1234567],
    ["1.234.567", 1234567],
    ["123.456", 123456],
    ["123,456", 123456],
    ["25.420", 25420], // tỷ giá gõ chữ kiểu VN
    ["(1.234)", -1234],
    ["(1,234.50)", -1234.5],
    ["-1.234", -1234],
    ["1.5", 1.5],
    ["0,25", 0.25],
    ["0.250", 0.25],
    ["27.500,75", 27500.75],
    ["1,234.56", 1234.56],
    ["25420.5", 25420.5],
    ["25.42", 25.42],
    ["1.234.567 đ", 1234567],
    ["1 234 567", 1234567],
  ])("%s → %s", (vao, ra) => expect(soVN(vao)).toBe(ra));

  it("số giữ nguyên, rác → null (không mặc định 0)", () => {
    expect(soVN(1234.5)).toBe(1234.5);
    expect(soVN("")).toBeNull();
    expect(soVN("abc")).toBeNull();
    expect(soVN(null)).toBeNull();
    expect(soVN(NaN)).toBeNull();
  });
});

// ---------- 19. Quy ước ngoại tệ áp cả sheet bản tự tải ----------

describe("ngoại tệ — sheet tập con (bản tự tải) theo cùng quy ước", () => {
  it("cổng đã quy sẵn VND: bản tự tải (laPhu) cũng KHÔNG nhân tỷ giá ⇒ so hai bản không lệch oan", () => {
    const usd = hd("C26TAB", "10161", MST, 5_000_000, 500_000, 5_500_000, "USD", 25_000);
    const vnd = hd("C26TCT", "1812", MST, 1_000_000, 100_000, 1_100_000);
    const kq = doiSoat(
      [
        sheetHd("HDDT THUẾ", [usd, vnd]),
        sheetHd("HDDT TẢI", [usd]),
        sheetSo([so("C26TAB", "10161", MST, 5_000_000, 500_000), so("C26TCT", "1812", MST, 1_000_000, 100_000)]),
      ],
      { nguong: 1 }
    );
    const tai = kq.sheetsHoaDon.find((s) => s.ten === "HDDT TẢI")!;
    expect(tai.laPhu).toBe(true);
    expect(tai.dong[0]!.tongTtVnd).toBe(5_500_000);
    const sb = soHaiBanHddt(kq.sheetsHoaDon, kq.nguong)!;
    expect(sb.tong.lechTien).toBe(0);
    expect(sb.tong.chenhTongTien).toBe(1_100_000); // chỉ hóa đơn VND chỉ có ở bản thuế
  });
});

// ---------- 20. Có sổ + hai bản gối nhau một phần ----------

describe("có sổ + hai bản HĐĐT gối nhau một phần", () => {
  const A = hd("C26TAA", "1", MST, 100, 10, 110);
  const B = hd("C26TAA", "2", MST, 200, 20, 220);
  const C = hd("C26TAA", "3", MST, 300, 30, 330);
  const D = hd("C26TAA", "4", MST, 400, 40, 440);
  const kq = doiSoat(
    [
      sheetHd("HDDT THUẾ", [A, B, C]),
      sheetHd("HDDT TẢI", [B, C, D]),
      sheetSo([so("C26TAA", "1", MST, 100, 10), so("C26TAA", "2", MST, 200, 20)]),
    ],
    { nguong: 1 }
  );

  it("không đếm hóa đơn hai lần: chỉ đối soát bản thuế gửi", () => {
    expect(kq.tong.soHoaDon).toBe(3);
    expect(kq.tong.khop).toBe(2);
    expect(kq.tong.thieu).toBe(1);
    expect(kq.sheetsHoaDon.find((s) => s.ten === "HDDT TẢI")!.laPhu).toBe(true);
    expect(kq.phepThu.every((p) => p.dat)).toBe(true);
  });

  it("không còn cảnh báo trùng khóa do hai bản; báo hóa đơn chỉ có ở bản tự tải", () => {
    expect(kq.canhBao.filter((c) => c.loai === "Trùng khóa HĐĐT")).toHaveLength(0);
    expect(kq.canhBao.some((c) => c.loai === "Hai bản hóa đơn điện tử" && c.chiTiet.includes("1 hóa đơn"))).toBe(true);
  });

  it("trùng khóa TRONG cùng một bản vẫn báo", () => {
    const kq2 = doiSoat(
      [sheetHd("HDDT THUẾ", [A, A, B]), sheetHd("HDDT TẢI", [A, B]), sheetSo([so("C26TAA", "1", MST, 100, 10)])],
      { nguong: 1 }
    );
    expect(kq2.canhBao.filter((c) => c.loai === "Trùng khóa HĐĐT")).toHaveLength(1);
  });

  it("không sổ (so hai bản): trùng khóa khác bên là đương nhiên — không báo", () => {
    const kq3 = doiSoat([sheetHd("HDDT THUẾ", [A, B]), sheetHd("HDDT TẢI", [A, B])], { nguong: 1 });
    expect(kq3.canhBao.filter((c) => c.loai === "Trùng khóa HĐĐT")).toHaveLength(0);
  });
});

// ---------- 21. Chuẩn hóa MST ----------

describe("MST chuẩn hóa — chỉ giữ số, bù số 0 đầu bị mất", () => {
  it("0301234567-001 ⇄ 0301234567001 · số 301234567 ⇄ 0301234567", () => {
    const kq = doiSoat(
      [
        sheetHd("CÓ MÃ", [hd("C26TAA", "1", "0301234567-001", 100, 10, 110), hd("C26TAA", "2", 301234567, 200, 20, 220)]),
        sheetSo([so("C26TAA", "1", "0301234567001", 100, 10), so("C26TAA", "2", "0301234567", 200, 20)]),
      ],
      { nguong: 1 }
    );
    expect(kq.tong.khop).toBe(2);
  });

  it.each(["MST", "Mã số thuế", "MST người bán"])("nhận tiêu đề cột MST của sổ: %s", (tieuDe) => {
    const kq = doiSoat(
      [sheetHd("CÓ MÃ", [hd("C26TAA", "1", MST, 100, 10, 110)]), sheetSo([so("C26TAA", "1", MST, 100, 10)], tieuDe)],
      { nguong: 1 }
    );
    expect(kq.tong.khop).toBe(1);
  });

  it("sổ không có cột MST ⇒ cảnh báo, không im lặng", () => {
    const kq = doiSoat(
      [sheetHd("CÓ MÃ", [hd("C26TAA", "1", MST, 100, 10, 110)]), sheetSo([so("C26TAA", "1", MST, 100, 10)], "GHI CHÚ")],
      { nguong: 1 }
    );
    expect(kq.canhBao.some((c) => c.loai === "Sổ không có cột MST")).toBe(true);
  });
});

// ---------- 23. Ngoại tệ thiếu tỷ giá · dung sai theo VND ----------

describe("ngoại tệ — thiếu tỷ giá, dung sai làm tròn", () => {
  it("tiền tệ khác VND mà không có tỷ giá ⇒ cảnh báo + phép kiểm quy đổi không đạt", () => {
    const kq = doiSoat(
      [sheetHd("KHÔNG MÃ", [hd("C26TAB", "9", MST, 100, 10, 110, "USD", null)]), sheetSo([so("C26TAB", "9", MST, 100, 10)])],
      { nguong: 1 }
    );
    expect(kq.canhBao.some((c) => c.loai === "Ngoại tệ thiếu tỷ giá")).toBe(true);
    expect(kq.phepThu.find((p) => p.ten.startsWith("Cột quy đổi"))!.dat).toBe(false);
  });

  it("để nguyên tệ: lệch 1 USD là LỆCH THẬT, không phải làm tròn", () => {
    // 100 + 10 ≠ 111 (lệch 1 USD ≈ 25.000 đ); sổ khớp số ×tỷ giá ⇒ file để nguyên tệ.
    const kq = doiSoat(
      [
        sheetHd("KHÔNG MÃ", [hd("C26TAB", "9", MST, 100, 10, 111, "USD", 25_000)]),
        sheetSo([so("C26TAB", "9", MST, 2_500_000, 275_000)]),
      ],
      { nguong: 1 }
    );
    const d = kq.sheetsHoaDon[0]!.dong[0]!;
    expect(d.tyGia).toBe(25_000);
    expect(d.lechCong?.loai).toBe("that");
    expect(kq.nghiVan.some((n) => n.nhom === 1)).toBe(true);
    expect(kq.phepThu.find((p) => p.ten.startsWith("Cột quy đổi"))!.dat).toBe(true);
  });

  it("đã quy sẵn VND: lệch 1 đ vẫn là làm tròn", () => {
    const kq = doiSoat(
      [
        sheetHd("KHÔNG MÃ", [hd("C26TAB", "9", MST, 2_500_000, 250_000, 2_750_001, "USD", 25_000)]),
        sheetSo([so("C26TAB", "9", MST, 2_500_000, 250_001)]),
      ],
      { nguong: 1 }
    );
    const d = kq.sheetsHoaDon[0]!.dong[0]!;
    expect(d.tyGia).toBe(1);
    expect(d.lechCong?.loai).toBe("lamTron");
  });
});
