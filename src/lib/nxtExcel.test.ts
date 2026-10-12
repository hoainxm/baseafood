import { describe, expect, test } from "vitest";
import * as XLSX from "xlsx";
import { nxtSangMang, parseNxtExcelFile, type NxtExcelReportData } from "./nxtExcel";

const fileTu = (aoa: unknown[][]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "S");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buf], "nxt.xlsx");
};

const mau: NxtExcelReportData = {
  createdDateText: "Ngày lập: 01/10/2026",
  title: "Báo cáo xuất nhập tồn",
  dateRangeText: "Từ ngày 01/09/2026 đến ngày 30/09/2026",
  warehouseText: "Chi nhánh: KHO Thành Phẩm - KHO 1000",
  items: [
    { code: "BT01", name: "Bạch tuộc", category: "Hàng trong nước", tonDauKg: 10, giaTriDau: 100, nhapKg: 5, giaTriNhap: 50, xuatKg: 3, giaTriXuat: 30, tonCuoiKg: 12, giaTriCuoi: 120 },
  ],
  totalItemCount: 1,
  totalTonDauKg: 10, totalGiaTriDau: 100, totalNhapKg: 5, totalGiaTriNhap: 50,
  totalXuatKg: 3, totalGiaTriXuat: 30, totalTonCuoiKg: 12, totalGiaTriCuoi: 120,
};

describe("parseNxtExcelFile — dòng kho (#32)", () => {
  test("xuất rồi nhập lại: kho lấy ở đầu trang, chân file không đè, không thành dòng hàng", async () => {
    const d = await parseNxtExcelFile(fileTu(nxtSangMang(mau)));
    expect(d.warehouseText).toBe("Chi nhánh: KHO Thành Phẩm - KHO 1000");
    expect(d.items.map((i) => i.code)).toEqual(["BT01"]);
  });

  test("file không ghi kho ở đầu ⇒ chân file mặc định cũng không thành kho rác", async () => {
    const d = await parseNxtExcelFile(fileTu(nxtSangMang({ ...mau, warehouseText: "" })));
    expect(d.warehouseText).toBe("Chi nhánh: KHO Thành Phẩm - KHO 1000"); // dòng 4 mặc định của file xuất
    expect(d.items).toHaveLength(1);
  });
});
