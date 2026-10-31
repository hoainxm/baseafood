// ============================================================
// Tên file: src/features/reports/exportReportTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Báo cáo đơn đặt được xuất hàng (/export-report)
// Description: Step-by-step page tour for the "orders shipped" report — period + customer →
//              stat cards → per-order groups (header, export lines, subtotal) → order status
//              tags → A4 / Excel. Steps only point; nothing is written (ba-spec 43 R1).
//              Content source: OrderExportReport.tsx header · docs/app-map/34-btp-san-xuat-kho
//              (F-N5 gom → lệnh xuất, F-N6 xuất kho) · SalesOrderScreen (luật đổi trạng thái đơn).
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface ExportReportTourContext {
  /** Có quyền xuất (`export-report.export`): In A4 + Xuất Excel. */
  canExport: boolean;
}

export function buildExportReportTour(ctx: ExportReportTourContext): PageTour {
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Báo cáo đơn xuất",
      body:
        "Trang cho biết trong kỳ đang xem, đơn đặt nào đã được xuất hàng và xuất bao nhiêu: các lệnh xuất container có ngày xuất trong kỳ được gom theo đơn, kèm khách, mặt hàng và kg thực xuất. Phòng Kế hoạch, kế toán và Ban Giám đốc dùng để theo dõi mức hoàn thành đơn.\n" +
        "Trang nằm ở cuối chuỗi (kho → xuất): số lấy từ lệnh xuất ở màn Đơn đặt. Trang chỉ đọc, không ghi số.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "filters",
      target: "export-report-filters",
      title: "Kỳ báo cáo và khách hàng",
      body:
        "Kỳ báo cáo: Ngày · Tuần · Tháng · Năm · Khoảng tự chọn. Kỳ Ngày thì chọn Ngày xuất; kỳ khác chọn Ngày bất kỳ trong kỳ (dòng nhỏ bên dưới ghi rõ Kỳ: từ ngày – đến ngày); Khoảng tự chọn thì chọn Khoảng ngày xuất.\n" +
        "Khách hàng: Tất cả khách hoặc một khách. Trạng thái đơn (Đang gom · Đủ · Đã xuất, kèm số đơn) và ô Tra mặt hàng, quy cách, khách thu hẹp thêm; tổng và Xuất Excel theo phần đang lọc. Bỏ hết bộ lọc để về cả kỳ.\n" +
        "Đơn được tính vào kỳ theo NGÀY XUẤT của lệnh xuất, không theo ngày đặt. Kỳ chưa có lệnh xuất thì trang báo Chưa có đơn nào được xuất; tạo lệnh xuất ở màn Đơn đặt thì số tự về đây.",
    },
    {
      id: "stats",
      target: "export-report-stats",
      title: "Bốn chỉ số của kỳ",
      body:
        "• Kỳ báo cáo: từ ngày – đến ngày đang xem.\n" +
        "• Tổng xuất: tổng kg thực xuất của mọi lệnh xuất trong kỳ.\n" +
        "• Tổng block: tổng số block đã xuất.\n" +
        "• Số đơn được xuất: số đơn đặt có ít nhất một lệnh xuất trong kỳ.",
    },
    {
      id: "table",
      target: "export-report-table",
      optional: true,
      title: "Bảng theo đơn",
      body:
        "Mỗi đơn là một khối, xếp theo tên khách rồi ngày đặt.\n" +
        "• Dòng đầu đơn: tên khách · đặt (ngày đặt) · thẻ trạng thái · đã đặt (tổng kg của các dòng đơn).\n" +
        "• Các dòng bên dưới: từng dòng thực xuất — Ngày xuất · Mặt hàng · Quy cách · Kg xuất · Block.\n" +
        "• Cộng đơn: tổng kg và block đã xuất của đơn TRONG KỲ đang xem. So với số đã đặt để biết đơn còn thiếu bao nhiêu (đơn xuất nhiều đợt thì đợt ngoài kỳ không cộng vào đây).\n" +
        "• TỔNG CỘNG (chân bảng): cộng mọi đơn đang hiện.\n" +
        "Ô vuông đầu dòng dùng để chọn dòng rồi tô màu, đánh dấu những dòng đã kiểm.",
    },
    {
      id: "order-status",
      target: "export-report-table",
      optional: true,
      title: "Trạng thái đơn",
      body:
        "Thẻ ở dòng đầu đơn là trạng thái HIỆN TẠI của đơn (không phải lúc xuất):\n" +
        "• Đang gom: đơn còn thiếu hàng so với số đã đặt; lệnh xuất mới lấy được một phần, phần thiếu chờ gom thêm ở màn Đơn đặt.\n" +
        "• Đủ: Phòng Kế hoạch đã xác nhận đơn đủ hàng ở màn Đơn đặt, chờ lệnh xuất tiếp theo.\n" +
        "• Đã xuất: lệnh xuất đã lấy đủ số kg đặt của mọi dòng đơn, đơn đóng.\n" +
        "Tên khách hiện (đơn đã xóa) nghĩa là lệnh xuất còn nhưng đơn gốc đã bị xóa ở màn Đơn đặt.",
    },
  ];
  if (ctx.canExport) {
    steps.push({
      id: "export",
      target: "export-report-export",
      optional: true,
      title: "In A4 và Xuất Excel",
      body:
        "In A4: xem trước bản in theo kỳ và khách đang xem rồi in giấy hoặc lưu PDF.\n" +
        "Xuất Excel: tải file lưu hồ sơ, mỗi dòng thực xuất một dòng, kèm dòng Cộng đơn có cột Đã đặt (kg) và dòng TỔNG CỘNG. Kỳ chưa có lệnh xuất thì hai nút mờ.",
    });
  }
  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để trở về đúng màn hình đang xem trước khi bắt đầu.\n" +
      "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
  });
  return { title: "Báo cáo đơn xuất", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "export-report",
  build: () => buildExportReportTour({ canExport: true }),
};
