// ============================================================
// Tên file: src/lib/nxtExcel.ts
// Tên tiếng Việt tương đương: Xử lý Import/Export Excel báo cáo Nhập Xuất Tồn
// Description: Parser and generator for 10-column NXT Excel report files
// ============================================================
import * as XLSX from "xlsx";
import type { NxtGoodsCategory } from "@/types";

export interface NxtExcelRow {
  code: string;
  name: string;
  category: NxtGoodsCategory;
  tonDauKg: number;
  giaTriDau: number;
  nhapKg: number;
  giaTriNhap: number;
  xuatKg: number;
  giaTriXuat: number;
  tonCuoiKg: number;
  giaTriCuoi: number;
}

export interface NxtExcelReportData {
  createdDateText: string;
  title: string;
  dateRangeText: string;
  warehouseText: string;
  items: NxtExcelRow[];
  totalItemCount: number;
  totalTonDauKg: number;
  totalGiaTriDau: number;
  totalNhapKg: number;
  totalGiaTriNhap: number;
  totalXuatKg: number;
  totalGiaTriXuat: number;
  totalTonCuoiKg: number;
  totalGiaTriCuoi: number;
}

/** Tự động đoán Phân loại hàng hóa từ mã/tên hàng (NK / Trong nước / Tạm) */
export function inferCategory(code: string, name: string): NxtGoodsCategory {
  const text = `${code} ${name}`.toUpperCase();
  if (text.includes("NK") || text.includes("NHẬP KHẨU") || text.includes("INVOICE")) {
    return "Hàng nhập khẩu";
  }
  if (text.includes("TẠM") || text.includes("GỬI")) {
    return "Hàng tạm";
  }
  return "Hàng trong nước";
}

/** Phân tích file Excel (.xlsx) tải lên theo mẫu chuẩn mau-bao-cao-nhap-xuat-ton.xlsx */
export async function parseNxtExcelFile(file: File): Promise<NxtExcelReportData> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  let createdDateText = "";
  let title = "Báo cáo xuất nhập tồn";
  let dateRangeText = "";
  let warehouseText = "";
  const items: NxtExcelRow[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const cellA = String(row[0] || "").trim();

    if (cellA.startsWith("Ngày lập:")) {
      createdDateText = cellA;
    } else if (cellA.toLowerCase().includes("báo cáo xuất nhập tồn")) {
      title = cellA;
    } else if (cellA.startsWith("Từ ngày")) {
      dateRangeText = cellA;
    } else if (cellA.startsWith("Chi nhánh:") || cellA.startsWith("KHO")) {
      warehouseText = cellA;
    } else if (
      cellA.startsWith("Mã hàng") ||
      cellA.startsWith("SL mặt hàng:") ||
      r < 5
    ) {
      // Tiêu đề hoặc dòng tổng hợp của file gốc -> bỏ qua dòng dữ liệu
      continue;
    } else {
      // Dòng dữ liệu sản phẩm
      const code = String(row[0] || "").trim();
      const name = String(row[1] || "").trim();

      if (!code && !name) continue;

      const tonDauKg = Number(row[2]) || 0;
      const giaTriDau = Number(row[3]) || 0;
      const nhapKg = Number(row[4]) || 0;
      const giaTriNhap = Number(row[5]) || 0;
      const xuatKg = Number(row[6]) || 0;
      const giaTriXuat = Number(row[7]) || 0;
      const tonCuoiKg = row[8] != null ? Number(row[8]) : tonDauKg + nhapKg - xuatKg;
      const giaTriCuoi = row[9] != null ? Number(row[9]) : giaTriDau + giaTriNhap - giaTriXuat;

      items.push({
        code,
        name,
        category: inferCategory(code, name),
        tonDauKg,
        giaTriDau,
        nhapKg,
        giaTriNhap,
        xuatKg,
        giaTriXuat,
        tonCuoiKg,
        giaTriCuoi,
      });
    }
  }

  const totalTonDauKg = items.reduce((sum, item) => sum + item.tonDauKg, 0);
  const totalGiaTriDau = items.reduce((sum, item) => sum + item.giaTriDau, 0);
  const totalNhapKg = items.reduce((sum, item) => sum + item.nhapKg, 0);
  const totalGiaTriNhap = items.reduce((sum, item) => sum + item.giaTriNhap, 0);
  const totalXuatKg = items.reduce((sum, item) => sum + item.xuatKg, 0);
  const totalGiaTriXuat = items.reduce((sum, item) => sum + item.giaTriXuat, 0);
  const totalTonCuoiKg = items.reduce((sum, item) => sum + item.tonCuoiKg, 0);
  const totalGiaTriCuoi = items.reduce((sum, item) => sum + item.giaTriCuoi, 0);

  return {
    createdDateText: createdDateText || `Ngày lập: ${new Date().toLocaleString("vi-VN")}`,
    title,
    dateRangeText,
    warehouseText,
    items,
    totalItemCount: items.length,
    totalTonDauKg,
    totalGiaTriDau,
    totalNhapKg,
    totalGiaTriNhap,
    totalXuatKg,
    totalGiaTriXuat,
    totalTonCuoiKg,
    totalGiaTriCuoi,
  };
}

/** Xuất báo cáo Nhập Xuất Tồn ra file .xlsx khớp 100% mẫu mau-bao-cao-nhap-xuat-ton.xlsx */
export function exportNxtToExcel(data: NxtExcelReportData, fileName = "Bao-Cao-Nhap-Xuat-Ton.xlsx") {
  const wsData: any[][] = [];

  // Row 1: Ngày lập
  wsData.push([data.createdDateText || `Ngày lập: ${new Date().toLocaleString("vi-VN")}`]);
  // Row 2: Tiêu đề
  wsData.push([data.title || "Báo cáo xuất nhập tồn"]);
  // Row 3: Từ ngày... đến ngày...
  wsData.push([data.dateRangeText || "Từ ngày... đến ngày..."]);
  // Row 4: Chi nhánh / Kho
  wsData.push([data.warehouseText || "Chi nhánh: KHO Thành Phẩm - KHO 1000"]);
  // Row 5: Dòng trống
  wsData.push([]);
  // Row 6: Header 10 cột chuẩn
  wsData.push([
    "Mã hàng",
    "Tên hàng",
    "Tồn đầu kỳ",
    "Giá trị đầu kỳ",
    "SL Nhập",
    "Giá trị nhập",
    "SL Xuất",
    "Giá trị xuất",
    "Tồn cuối kỳ",
    "Giá trị cuối",
  ]);
  // Row 7: Dòng Tổng cộng
  wsData.push([
    `SL mặt hàng: ${data.items.length}`,
    null,
    data.totalTonDauKg,
    data.totalGiaTriDau,
    data.totalNhapKg,
    data.totalGiaTriNhap,
    data.totalXuatKg,
    data.totalGiaTriXuat,
    data.totalTonCuoiKg,
    data.totalGiaTriCuoi,
  ]);

  // Rows 8+: Các dòng chi tiết
  for (const item of data.items) {
    wsData.push([
      item.code,
      item.name,
      item.tonDauKg,
      item.giaTriDau,
      item.nhapKg,
      item.giaTriNhap,
      item.xuatKg,
      item.giaTriXuat,
      item.tonCuoiKg,
      item.giaTriCuoi,
    ]);
  }

  // Footer: Địa chỉ kho
  wsData.push([]);
  wsData.push([
    data.warehouseText
      ? `${data.warehouseText}: Bà Rịa - Phường Phước Trung - Thành phố Bà Rịa - Vũng Tàu`
      : "KHO Thành Phẩm - KHO 1000: Bà Rịa - Phường Phước Trung - Thành phố Bà Rịa - Vũng Tàu",
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Đặt độ rộng cột phù hợp
  worksheet["!cols"] = [
    { wch: 24 }, // Mã hàng
    { wch: 45 }, // Tên hàng
    { wch: 14 }, // Tồn đầu kỳ
    { wch: 15 }, // Giá trị đầu
    { wch: 14 }, // SL Nhập
    { wch: 15 }, // Giá trị nhập
    { wch: 14 }, // SL Xuất
    { wch: 15 }, // Giá trị xuất
    { wch: 14 }, // Tồn cuối kỳ
    { wch: 15 }, // Giá trị cuối
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Báo Cáo Xuất Nhập Tồn");

  XLSX.writeFile(workbook, fileName);
}
