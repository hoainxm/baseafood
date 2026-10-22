// ============================================================
// Tên file: src/features/reports/finishedGoodStockTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Tồn kho thành phẩm (/nxt)
// Description: Step-by-step page tour for the finished-goods (BTP reserve) NXT report —
//              period → stat cards → negative-stock warning → table columns → manual opening
//              stock → Excel. Steps only point; nothing is written (ba-spec 43 R1).
//              Content source: lib/inventoryFinished.ts (header) · docs/app-map/34 · 31 §Tồn NL
//              (quy tắc mốc chung).
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface FinishedGoodStockTourContext {
  /** Có quyền xuất Excel (`nxt.export`) — nút Xuất Excel chỉ hiện khi có. */
  canExport: boolean;
  /** Có quyền khai tồn đầu (`nxt.create`) — nút Thêm tồn đầu trong hộp Tồn đầu. */
  canCreateOpening: boolean;
}

export function buildFinishedGoodStockTour(ctx: FinishedGoodStockTourContext): PageTour {
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Tồn kho thành phẩm",
      body:
        "Trang cho biết kho dự trữ (bán thành phẩm cấp đông) còn bao nhiêu kg từng mặt hàng × quy cách trong khoảng ngày đang xem: tồn đầu, nhập, xuất, tồn cuối. Thủ kho, kế toán và quản đốc dùng để đối chiếu tồn trước khi chốt số.\n" +
        "Trang nằm ở khâu kho của chuỗi: sau Sản xuất thành phẩm và Kho dự trữ (duyệt nhập kho), trước Đơn đặt, Bán hàng và Đóng gói. Số tự tổng hợp từ các sổ đó, không gõ lại; chỗ ghi tay duy nhất là Tồn đầu.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "period",
      target: "nxt-period",
      title: "Kỳ báo cáo",
      body:
        "Chọn Kỳ báo cáo: Ngày · Tuần · Tháng · Năm · Khoảng tự chọn. Sau đó chọn Ngày bất kỳ trong kỳ (dòng nhỏ bên dưới ghi rõ Kỳ: từ ngày – đến ngày); Khoảng tự chọn thì chọn Khoảng ngày.\n" +
        "Mọi số trên trang tính trong khoảng đó. Kỳ không có phát sinh thì trang hiện Chưa có số liệu thành phẩm trong khoảng ngày này.",
    },
    {
      id: "stats",
      target: "nxt-stats",
      title: "Bốn chỉ số của kỳ",
      body:
        "• Tồn đầu kho: tồn trước ngày đầu kỳ = tồn đầu khai tay + nhập − xuất từ ngày mốc khai tay tới trước kỳ.\n" +
        "• Nhập kho: bán thành phẩm đã được duyệt nhập kho ở Kho dự trữ, tính theo ngày sản xuất. Lô còn chờ nhập kho chưa tính.\n" +
        "• Xuất (đơn+bán+gói): ba số kg lần lượt là Xuất đơn + Xuất bán + Đóng gói của kỳ.\n" +
        "• Tồn cuối kho = Tồn đầu + Nhập − Xuất.",
    },
    {
      id: "negative-warning",
      target: "nxt-negative-warning",
      optional: true,
      title: "Cảnh báo tồn cuối âm",
      body:
        "Khung đỏ hiện khi có mặt hàng tồn cuối ÂM: xuất nhiều hơn số đang trữ. Dòng đó có thẻ Tồn âm và số tồn cuối màu đỏ.\n" +
        "Thường do: sản lượng, đơn đặt hoặc bán hàng ghi sai số; lô chưa được duyệt nhập kho mà đã xuất; hoặc thiếu khai tồn đầu. Sửa ở sổ gốc, trang này tự tính lại. Không được bỏ qua cảnh báo này.",
    },
    {
      id: "table",
      target: "nxt-table",
      optional: true,
      title: "Bảng nhập – xuất – tồn",
      body:
        "Mỗi dòng là một mặt hàng × quy cách; dòng chữ nhỏ là mã hàng. Hàng cuối bảng là tổng.\n" +
        "• Tồn đầu (kg) · Nhập (kg): như hai chỉ số cùng tên.\n" +
        "• Xuất đơn (kg): lệnh xuất container theo Đơn đặt.\n" +
        "• Xuất bán (kg): phiếu Bán hàng lấy block thô từ kho dự trữ. Phần đã xuất qua đơn không tính hai lần.\n" +
        "• Đóng gói (kg): bán thành phẩm đem đóng gói ra thành phẩm ở màn Đóng gói.\n" +
        "• Tồn cuối (kg) = Tồn đầu + Nhập − Xuất đơn − Xuất bán − Đóng gói.\n" +
        "Thẻ Tồn đầu khai tay: dòng có số khai ở nút Tồn đầu. Xem tới hôm nay, không có khai tay và không bán vượt thì Tồn cuối khớp Tổng tồn ở màn Kho dự trữ.\n" +
        "Ô vuông đầu dòng dùng để chọn dòng rồi tô màu, đánh dấu những dòng đã kiểm.",
    },
    {
      id: "opening",
      target: "nxt-opening",
      title: "Tồn đầu khai tay",
      body:
        "Nút Tồn đầu (số trong ngoặc là số dòng đã khai) mở danh sách số dư bán thành phẩm cấp đông có sẵn TRƯỚC khi dùng app, theo mặt hàng × quy cách, kèm ngày mốc.\n" +
        "Chỉ khai một lần; các kỳ sau tự kế thừa từ lịch sử nhập, xuất. Phát sinh trước ngày mốc coi như đã nằm trong số khai, không cộng lại; ngày mốc sau cuối kỳ đang xem thì chưa áp.\n" +
        (ctx.canCreateOpening
          ? "Trong hộp, chọn Thêm tồn đầu, điền Mặt hàng, Tồn đầu tính từ ngày, Khối lượng tồn rồi chọn Lưu tồn đầu: số vào cột Tồn đầu và dòng có thẻ Tồn đầu khai tay."
          : "Bạn chỉ được xem danh sách này; người có quyền ghi mới khai thêm được."),
    },
  ];
  if (ctx.canExport) {
    steps.push({
      id: "export",
      target: "nxt-export",
      optional: true,
      title: "Xuất Excel",
      body:
        "Chọn Xuất Excel để tải báo cáo của kỳ đang xem ra file theo mẫu 10 cột (Báo cáo xuất nhập tồn thành phẩm, Kho thành phẩm BSF1). Các cột giá trị để 0 vì sổ này chỉ theo kg.\n" +
        "Kỳ không có số thì nút mờ. Xuất file không thay đổi số trong sổ.",
    });
  }
  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để trở về đúng màn hình đang xem trước khi bắt đầu.\n" +
      "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
  });
  return { title: "Tồn kho thành phẩm", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "nxt",
  build: () => buildFinishedGoodStockTour({ canExport: true, canCreateOpening: true }),
};
