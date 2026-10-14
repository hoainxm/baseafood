import { describe, expect, it } from "vitest";
import { reconcile, soVN } from "./einvoiceReconciliation";
import { compareTwoInvoiceVersions } from "./twoVersionReconciliation";

// ---------- Dựng workbook giả (đúng hình dạng `readWorkbook` trả về) ----------

type Sheet = Parameters<typeof reconcile>[0][number];
const sheet = (name: string, rows: unknown[][]): Sheet => ({
  name,
  rows,
  r0: 0,
  c0: 0,
  width: Math.max(...rows.map((r) => r.length)),
});

const INVOICE_HEADER = [
  "Ký hiệu hóa đơn", "Số hóa đơn", "Ngày lập", "MST người bán", "Tên người bán",
  "Tổng tiền chưa thuế", "Tổng tiền thuế", "Tổng tiền thanh toán", "Đơn vị tiền tệ", "Tỷ giá",
];
/** Một dòng hóa đơn: [ký hiệu, số, mst, chưa thuế, thuế, tổng, tiền tệ?, tỷ giá?] */
const makeInvoice = (kh: string, num: string, taxCode: unknown, preTax: number, tax: number, total: number, dvt = "VND", exchangeRate: unknown = 1) =>
  [kh, num, "05/02/2026", taxCode, "NCC", preTax, tax, total, dvt, exchangeRate];
const invoiceSheet = (name: string, row: unknown[][]) => sheet(name, [["DANH SÁCH HÓA ĐƠN"], INVOICE_HEADER, ...row]);

const sheetSo = (row: unknown[][], taxCodeHeader = "RMST") =>
  sheet("PMEM", [["KY_HIEU", "SO_HD", taxCodeHeader, "TIENHANG", "TIENTHUE", "TONGCONG"], ...row]);
/** Dòng sổ: [ký hiệu, số, mst, tiền hàng, thuế, tổng] */
const parsedNumber = (kh: string, invoiceNo: string, taxCode: unknown, rows: number, tax: number) => [kh, invoiceNo, taxCode, rows, tax, rows + tax];

const TAX_CODE = "0301234567";

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
  ])("%s → %s", (input, result) => expect(soVN(input)).toBe(result));

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
    const usd = makeInvoice("C26TAB", "10161", TAX_CODE, 5_000_000, 500_000, 5_500_000, "USD", 25_000);
    const vnd = makeInvoice("C26TCT", "1812", TAX_CODE, 1_000_000, 100_000, 1_100_000);
    const result = reconcile(
      [
        invoiceSheet("HDDT THUẾ", [usd, vnd]),
        invoiceSheet("HDDT TẢI", [usd]),
        sheetSo([parsedNumber("C26TAB", "10161", TAX_CODE, 5_000_000, 500_000), parsedNumber("C26TCT", "1812", TAX_CODE, 1_000_000, 100_000)]),
      ],
      { threshold: 1 }
    );
    const downloadedSheet = result.invoiceSheets.find((s) => s.name === "HDDT TẢI")!;
    expect(downloadedSheet.isSubset).toBe(true);
    expect(downloadedSheet.rows[0]!.totalVnd).toBe(5_500_000);
    const sb = compareTwoInvoiceVersions(result.invoiceSheets, result.threshold)!;
    expect(sb.totals.amountMismatchCount).toBe(0);
    expect(sb.totals.totalAmountDiff).toBe(1_100_000); // chỉ hóa đơn VND chỉ có ở bản thuế
  });
});

// ---------- 20. Có sổ + hai bản gối nhau một phần ----------

describe("có sổ + hai bản HĐĐT gối nhau một phần", () => {
  const A = makeInvoice("C26TAA", "1", TAX_CODE, 100, 10, 110);
  const B = makeInvoice("C26TAA", "2", TAX_CODE, 200, 20, 220);
  const C = makeInvoice("C26TAA", "3", TAX_CODE, 300, 30, 330);
  const D = makeInvoice("C26TAA", "4", TAX_CODE, 400, 40, 440);
  const result = reconcile(
    [
      invoiceSheet("HDDT THUẾ", [A, B, C]),
      invoiceSheet("HDDT TẢI", [B, C, D]),
      sheetSo([parsedNumber("C26TAA", "1", TAX_CODE, 100, 10), parsedNumber("C26TAA", "2", TAX_CODE, 200, 20)]),
    ],
    { threshold: 1 }
  );

  it("không đếm hóa đơn hai lần: chỉ đối soát bản thuế gửi", () => {
    expect(result.totals.invoiceCount).toBe(3);
    expect(result.totals.matched).toBe(2);
    expect(result.totals.missing).toBe(1);
    expect(result.invoiceSheets.find((s) => s.name === "HDDT TẢI")!.isSubset).toBe(true);
    expect(result.trialChecks.every((p) => p.passed)).toBe(true);
  });

  it("không còn cảnh báo trùng khóa do hai bản; báo hóa đơn chỉ có ở bản tự tải", () => {
    expect(result.warnings.filter((c) => c.kind === "Trùng khóa HĐĐT")).toHaveLength(0);
    expect(result.warnings.some((c) => c.kind === "Hai bản hóa đơn điện tử" && c.detail.includes("1 hóa đơn"))).toBe(true);
  });

  it("trùng khóa TRONG cùng một bản vẫn báo", () => {
    const kq2 = reconcile(
      [invoiceSheet("HDDT THUẾ", [A, A, B]), invoiceSheet("HDDT TẢI", [A, B]), sheetSo([parsedNumber("C26TAA", "1", TAX_CODE, 100, 10)])],
      { threshold: 1 }
    );
    expect(kq2.warnings.filter((c) => c.kind === "Trùng khóa HĐĐT")).toHaveLength(1);
  });

  it("không sổ (so hai bản): trùng khóa khác bên là đương nhiên — không báo", () => {
    const kq3 = reconcile([invoiceSheet("HDDT THUẾ", [A, B]), invoiceSheet("HDDT TẢI", [A, B])], { threshold: 1 });
    expect(kq3.warnings.filter((c) => c.kind === "Trùng khóa HĐĐT")).toHaveLength(0);
  });
});

// ---------- 21. Chuẩn hóa MST ----------

describe("MST chuẩn hóa — chỉ giữ số, bù số 0 đầu bị mất", () => {
  it("0301234567-001 ⇄ 0301234567001 · số 301234567 ⇄ 0301234567", () => {
    const result = reconcile(
      [
        invoiceSheet("CÓ MÃ", [makeInvoice("C26TAA", "1", "0301234567-001", 100, 10, 110), makeInvoice("C26TAA", "2", 301234567, 200, 20, 220)]),
        sheetSo([parsedNumber("C26TAA", "1", "0301234567001", 100, 10), parsedNumber("C26TAA", "2", "0301234567", 200, 20)]),
      ],
      { threshold: 1 }
    );
    expect(result.totals.matched).toBe(2);
  });

  it.each(["MST", "Mã số thuế", "MST người bán"])("nhận tiêu đề cột MST của sổ: %s", (title) => {
    const result = reconcile(
      [invoiceSheet("CÓ MÃ", [makeInvoice("C26TAA", "1", TAX_CODE, 100, 10, 110)]), sheetSo([parsedNumber("C26TAA", "1", TAX_CODE, 100, 10)], title)],
      { threshold: 1 }
    );
    expect(result.totals.matched).toBe(1);
  });

  it("sổ không có cột MST ⇒ cảnh báo, không im lặng", () => {
    const result = reconcile(
      [invoiceSheet("CÓ MÃ", [makeInvoice("C26TAA", "1", TAX_CODE, 100, 10, 110)]), sheetSo([parsedNumber("C26TAA", "1", TAX_CODE, 100, 10)], "GHI CHÚ")],
      { threshold: 1 }
    );
    expect(result.warnings.some((c) => c.kind === "Sổ không có cột MST")).toBe(true);
  });
});

// ---------- 23. Ngoại tệ thiếu tỷ giá · dung sai theo VND ----------

describe("ngoại tệ — thiếu tỷ giá, dung sai làm tròn", () => {
  it("tiền tệ khác VND mà không có tỷ giá ⇒ cảnh báo + phép kiểm quy đổi không đạt", () => {
    const result = reconcile(
      [invoiceSheet("KHÔNG MÃ", [makeInvoice("C26TAB", "9", TAX_CODE, 100, 10, 110, "USD", null)]), sheetSo([parsedNumber("C26TAB", "9", TAX_CODE, 100, 10)])],
      { threshold: 1 }
    );
    expect(result.warnings.some((c) => c.kind === "Ngoại tệ thiếu tỷ giá")).toBe(true);
    expect(result.trialChecks.find((p) => p.name.startsWith("Cột quy đổi"))!.passed).toBe(false);
  });

  it("để nguyên tệ: lệch 1 USD là LỆCH THẬT, không phải làm tròn", () => {
    // 100 + 10 ≠ 111 (lệch 1 USD ≈ 25.000 đ); sổ khớp số ×tỷ giá ⇒ file để nguyên tệ.
    const result = reconcile(
      [
        invoiceSheet("KHÔNG MÃ", [makeInvoice("C26TAB", "9", TAX_CODE, 100, 10, 111, "USD", 25_000)]),
        sheetSo([parsedNumber("C26TAB", "9", TAX_CODE, 2_500_000, 275_000)]),
      ],
      { threshold: 1 }
    );
    const d = result.invoiceSheets[0]!.rows[0]!;
    expect(d.exchangeRate).toBe(25_000);
    expect(d.sumMismatch?.kind).toBe("real");
    expect(result.suspects.some((n) => n.group === 1)).toBe(true);
    expect(result.trialChecks.find((p) => p.name.startsWith("Cột quy đổi"))!.passed).toBe(true);
  });

  it("đã quy sẵn VND: lệch 1 đ vẫn là làm tròn", () => {
    const result = reconcile(
      [
        invoiceSheet("KHÔNG MÃ", [makeInvoice("C26TAB", "9", TAX_CODE, 2_500_000, 250_000, 2_750_001, "USD", 25_000)]),
        sheetSo([parsedNumber("C26TAB", "9", TAX_CODE, 2_500_000, 250_001)]),
      ],
      { threshold: 1 }
    );
    const d = result.invoiceSheets[0]!.rows[0]!;
    expect(d.exchangeRate).toBe(1);
    expect(d.sumMismatch?.kind).toBe("rounding");
  });
});
