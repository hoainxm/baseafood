// ============================================================
// Tên file: src/features/reports/productionReportTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Báo cáo thành phẩm hàng ngày (/production-report)
// Description: Step-by-step page tour for the daily finished-product report — period + workshop →
//              stat cards → per-day chart → product × day grid with workshop subtotals → A4 /
//              Excel. Steps only point; nothing is written (ba-spec 43 R1).
//              Content source: DailyProductionReport.tsx header · docs/app-map/02 (cụm báo cáo
//              khép vòng) · 34-btp-san-xuat-kho.ba-spec.md · PAGE_GUIDES["production-report"].
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface ProductionReportTourContext {
  /** Có quyền xuất (`production-report.export`): In A4 + Xuất Excel. */
  canExport: boolean;
}

export function buildProductionReportTour(ctx: ProductionReportTourContext): PageTour {
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Báo cáo thành phẩm",
      body:
        "Trang tổng hợp sản lượng thành phẩm LÀM RA mỗi ngày, gom theo phân xưởng, để quản đốc, kế toán và Ban Giám đốc theo dõi và đối chiếu.\n" +
        "Trang nằm ở khâu sản xuất của chuỗi: số lấy thẳng từ sổ Sản xuất thành phẩm, tính mọi lô dù còn chờ nhập kho hay đã nhập kho. Đây là sản lượng làm ra, không phải tồn kho (tồn xem ở Tồn kho thành phẩm). Trang chỉ đọc, không ghi số.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "filters",
      target: "production-report-filters",
      title: "Kỳ báo cáo và phân xưởng",
      body:
        "Kỳ báo cáo: Ngày · Tuần · Tháng · Năm · Khoảng tự chọn. Sau đó chọn Ngày bất kỳ trong kỳ (dòng nhỏ bên dưới ghi rõ Kỳ: từ ngày – đến ngày); Khoảng tự chọn thì chọn Khoảng ngày sản xuất.\n" +
        "Phân xưởng: Tất cả xưởng hoặc một xưởng Đông, Cá, Khô.\n" +
        "Kỳ chưa có sản lượng thì trang báo Chưa có thành phẩm sản xuất trong khoảng đó; ghi sản lượng ở màn Sản xuất thành phẩm thì số tự về đây.",
    },
    {
      id: "stats",
      target: "production-report-stats",
      title: "Bốn chỉ số của kỳ",
      body:
        "• Kỳ báo cáo: từ ngày – đến ngày đang xem.\n" +
        "• Tổng sản lượng: tổng kg thành phẩm làm ra trong kỳ, theo xưởng đã chọn.\n" +
        "• Tổng block: tổng số block của các dòng đó.\n" +
        "• Số mặt hàng: số dòng mặt hàng × quy cách (mỗi xưởng tính riêng).",
    },
    {
      id: "chart",
      target: "production-report-chart",
      optional: true,
      title: "Sản lượng làm ra theo ngày",
      body:
        "Mỗi cột là tổng kg làm ra của một ngày có sản xuất (theo xưởng đã chọn). Biểu đồ chỉ hiện khi kỳ có từ hai ngày sản xuất trở lên; dùng để thấy nhanh ngày nào làm nhiều, ngày nào ít.",
    },
    {
      id: "table",
      target: "production-report-table",
      optional: true,
      title: "Lưới mặt hàng × ngày",
      body:
        "Bảng chia theo khối Phân xưởng Đông, Cá, Khô. Mỗi dòng là một mặt hàng × quy cách; mỗi cột giữa là một ngày có sản xuất (ngày/tháng), ô trống là ngày đó không làm mặt hàng này.\n" +
        "• Tổng kg · Block: cộng ngang cả kỳ của dòng.\n" +
        "• Cộng xưởng: cộng dọc từng ngày của một xưởng.\n" +
        "• TỔNG CỘNG (chân bảng): cộng mọi xưởng đang xem.\n" +
        "Ô vuông đầu dòng dùng để chọn dòng rồi tô màu, đánh dấu những dòng đã kiểm; dấu tô giữ riêng cho từng kỳ và xưởng.",
    },
  ];
  if (ctx.canExport) {
    steps.push({
      id: "export",
      target: "production-report-export",
      optional: true,
      title: "In A4 và Xuất Excel",
      body:
        "In A4: xem trước bản in đúng lưới đang xem rồi in giấy hoặc lưu PDF.\n" +
        "Xuất Excel: tải file cho kế toán đối chiếu, giữ đúng lưới ngày, dòng Cộng xưởng và TỔNG CỘNG. Kỳ chưa có số thì hai nút mờ.",
    });
  }
  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để trở về đúng màn hình đang xem trước khi bắt đầu.\n" +
      "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
  });
  return { title: "Báo cáo thành phẩm", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "production-report",
  build: () => buildProductionReportTour({ canExport: true }),
};
