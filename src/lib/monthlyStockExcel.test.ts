import { describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import { parseBangKeKhoFile, khoTuTieuDe, timKhoTheoGhi, tenKhoMoi } from "./monthlyStockExcel";

/** Dựng sheet theo bố cục bảng kê thật: A tên mục/ngày, B tên hàng, J/L/N kg, R ghi chú kho. */
function dongHang(ten: string, ton: number, ghi = ""): unknown[] {
  const r: unknown[] = Array(18).fill(null);
  r[1] = ten;
  r[9] = ton;
  if (ghi) r[17] = ghi;
  return r;
}

async function docFile(): Promise<ReturnType<typeof parseBangKeKhoFile>> {
  const aoa: unknown[][] = [
    ["BẢNG KÊ NGUYÊN LIỆU KHO 1500 THÁNG 08 / 2026"], // dòng 1
    ["I", "HÀNG NHẬP KHẨU"], // 2
    dongHang("SABA", 100, "GỬI KHO Á D"), // 3
    dongHang("CÁ SÒNG", 50, "gừi kho HP"), // 4
    dongHang("2 DA RÂU NGẮN", 30, "GỬI KHO HP"), // 5 ← đầu khối 2 DA
    [], // 6 trống
    dongHang("4 DA RÂU NGẮN", 20), // 7
    ["TỔNG 2 DA"], // 8 — công thức SUM(J5:J7)
    ["TỔNG HÀNG NHẬP KHẨU"], // 9
    ["II", "HÀNG MUA NGOÀI"], // 10
    dongHang(" B.TUỘC  2 DA", 10, "xuất trả lại 4240"), // 11
    dongHang("BẠCH TUỘC <80gr", 5, "gửi kho phước cơ"), // 12
    ["TỔNG HÀNG NỘI ĐỊA"], // 13
    ["III", "HÀNG  TẠM"], // 14
    dongHang("CÁ TRÍCH DẠT", 573), // 15
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["J8"] = { t: "n", v: 50, f: "SUM(J7:J7)" }; // cột kg khoanh hẹp…
  ws["P8"] = { t: "n", v: 50, f: "SUM(P5:P7)" }; // …cột tồn cuối khoanh rộng ⇒ lấy dòng nhỏ nhất
  // Lô 2 DA: ngày nhập (serial 46193 = 20/06/2026) + invoice gộp dọc A5:A7 / E5:E7 (có dòng trống 6 giữa).
  ws["A5"] = { t: "n", v: 46193 };
  ws["E5"] = { t: "s", v: "IFE/07/2026" };
  ws["!merges"] = [XLSX.utils.decode_range("A5:A7"), XLSX.utils.decode_range("E5:E7")];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "8");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return parseBangKeKhoFile(new File([buf], "kho.xlsx"));
}

describe("parseBangKeKhoFile", () => {
  test("tách nhóm theo mục + khối con TỔNG 2 DA + Hàng tạm", async () => {
    const [sh] = await docFile();
    const nhom = Object.fromEntries(sh.rows.map((r) => [r.itemName, r.category]));
    expect(nhom["SABA"]).toBe("Nguyên liệu nhập khẩu");
    expect(nhom["CÁ SÒNG"]).toBe("Nguyên liệu nhập khẩu");
    expect(nhom["2 DA RÂU NGẮN"]).toBe("Nguyên liệu nhập khẩu – 2 DA");
    expect(nhom["4 DA RÂU NGẮN"]).toBe("Nguyên liệu nhập khẩu – 2 DA");
    expect(nhom["B.TUỘC  2 DA"]).toBe("Nguyên liệu mua ngoài");
    expect(nhom["CÁ TRÍCH DẠT"]).toBe("Hàng tạm");
    expect(khoTuTieuDe(sh.tieuDe)).toBe("1500");
  });

  test("ô gộp ngày nhập/invoice chép xuống cả lô, ngày không lùi 1 ngày, dòng trống giữ nguyên", async () => {
    const [sh] = await docFile();
    const by = Object.fromEntries(sh.rows.map((r) => [r.itemName, r]));
    expect(by["2 DA RÂU NGẮN"]).toMatchObject({ importDate: "2026-06-20", origin: "IFE/07/2026" });
    expect(by["4 DA RÂU NGẮN"]).toMatchObject({ importDate: "2026-06-20", origin: "IFE/07/2026" });
    expect(by["SABA"].importDate).toBe("");
    // dòng trống (dòng 6) không bị biến thành dòng dữ liệu ⇒ rowIndex không xê dịch
    expect(by["4 DA RÂU NGẮN"].rowIndex).toBe(5);
  });

  test("cột R: kho gửi vs ghi chú thường", async () => {
    const [sh] = await docFile();
    const by = Object.fromEntries(sh.rows.map((r) => [r.itemName, r]));
    expect(by["SABA"].khoGhi).toBe("Á D");
    expect(by["CÁ SÒNG"].khoGhi).toBe("HP");
    expect(by["BẠCH TUỘC <80gr"].khoGhi).toBe("phước cơ");
    expect(by["B.TUỘC  2 DA"]).toMatchObject({ khoGhi: "", ghiChu: "xuất trả lại 4240" });
    expect(by["CÁ TRÍCH DẠT"]).toMatchObject({ khoGhi: "", ghiChu: "" });
  });
});

describe("timKhoTheoGhi", () => {
  const dm = [
    { code: "KHP", name: "Kho Hồng Phú" },
    { code: "KAD", name: "Kho Ánh Dương" },
  ];
  test("khớp mã có/không tiền tố K, bỏ dấu + khoảng trắng", () => {
    expect(timKhoTheoGhi("HP", dm)).toBe("Kho Hồng Phú");
    expect(timKhoTheoGhi("Á D", dm)).toBe("Kho Ánh Dương");
    expect(timKhoTheoGhi("ánh dương", dm)).toBe("Kho Ánh Dương");
  });
  test("viết tắt lạ ⇒ null + tên kho mới", () => {
    expect(timKhoTheoGhi("phước cơ", dm)).toBeNull();
    expect(tenKhoMoi("phước cơ")).toBe("Kho Phước Cơ");
  });
});
