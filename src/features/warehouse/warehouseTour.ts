// ============================================================
// Tên file: src/features/warehouse/warehouseTour.ts
// Tên tiếng Việt: Hướng dẫn từng bước của trang Kho dự trữ
// Description: Reserve warehouse page tour (docs/app-map/43-guided-tour.ba-spec.md). Steps follow
//              the storekeeper's work order (ba-spec 34 F-N2/N3): read the counts → approve
//              pending lots → watch age / capacity → filter and read the stock table. Approve
//              steps only exist for users with the approve permission. Nothing is written (R1).
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface WarehouseTourContext {
  can: {
    /** Duyệt lô chờ → đã nhập kho (quét tem, nút Duyệt nhập kho). */
    approve: boolean;
  };
}

/** Dựng các bước theo thứ tự công việc của thủ kho (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildWarehouseTour(ctx: WarehouseTourContext): PageTour {
  const { can } = ctx;
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Kho dự trữ",
      body:
        "Trang Kho dự trữ đông giữ bán thành phẩm đã cấp đông, chờ gom đủ đơn đặt để xuất, bán lẻ hoặc đem đóng gói. Thủ kho dùng trang này để duyệt lô vào kho và theo dõi tồn.\n" +
        "Trong chuỗi nhập hàng → sản xuất → kho → bán / xuất, trang nằm ở khâu kho: mẻ ghi ở trang Sản xuất thành phẩm về đây ở trạng thái chờ nhập kho; hàng ra khỏi kho qua Đơn đặt, Bán hàng và Đóng gói.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "stats",
      target: "warehouse-stats",
      title: "Bốn chỉ số của kho",
      body:
        "• Đang xem: Tồn hiện tại — số tính tới lúc mở trang, không theo kỳ.\n" +
        "• Chờ nhập: số lô sản xuất đã ghi mà chưa duyệt nhập kho. Lô chờ nhập chưa tính vào tồn.\n" +
        "• Số lô hàng: số lô còn hàng trong kho đang lọc.\n" +
        "• Tổng tồn: tổng kg còn lại của các lô đó. Mỗi lô còn = kg thực khi duyệt nhập − kg đã xuất theo lệnh xuất của Đơn đặt − kg bán lẻ block thô − kg đem đóng gói. Dòng đã gắn lô thì trừ đúng lô đó, phần còn lại trừ lô sản xuất sớm trước.",
    },
    {
      id: "oversold",
      target: "warehouse-oversold",
      optional: true,
      title: "Cảnh báo bán vượt",
      body:
        "Dòng \"Bán vượt … so với tồn\" hiện khi bán lẻ hoặc đóng gói ghi nhiều hơn số đang trữ của mặt hàng và quy cách đó. Lô không xuống âm, nên phần vượt không nằm trong Tổng tồn.\n" +
        "Việc tiếp theo: kiểm lại phiếu bán hoặc phiếu đóng gói, hoặc duyệt nhập kho mẻ còn chờ.",
    },
    {
      id: "pending",
      target: "warehouse-pending",
      optional: true,
      title: "Lô chờ nhập kho",
      body:
        "Khối này hiện khi còn lô sản xuất chờ nhập kho. Mỗi dòng ghi mã lô trên tem (BĐ-…), mặt hàng, quy cách, kg đã ghi, ngày sản xuất và xưởng.\n" +
        "Lô có hai trạng thái: chờ nhập kho (đã ghi ở Sản xuất, chưa tính tồn) và đã nhập kho (thủ kho đã duyệt, tính vào tồn). Lô rời danh sách này khi đã duyệt.\n" +
        "Quản đốc chỉ duyệt được lô của xưởng mình; lô xưởng khác không có nút duyệt.",
    },
  ];
  if (can.approve) {
    steps.push(
      {
        id: "scan",
        target: "warehouse-scan",
        optional: true,
        title: "Quét tem để duyệt",
        body:
          "Cầm block nào thì quét tem block đó: chọn Quét tem để duyệt để bật camera, hoặc gõ mã lô trên tem rồi chọn Tìm lô.\n" +
          "Đúng lô đang chờ thì hộp Duyệt nhập kho của lô đó mở ra. Lô đã nhập kho rồi, mã trùng nhiều lô hoặc lô của xưởng khác thì trang báo lại, không mở hộp.",
      },
      {
        id: "approve",
        target: "warehouse-approve",
        optional: true,
        title: "Duyệt nhập kho",
        body:
          "Chọn Duyệt nhập kho ở một dòng để mở hộp duyệt: chọn Kho (phòng đông), nhập Khối lượng thực và Block thực đã cân, ghi lý do nếu lệch so với số đã ghi ở Sản xuất.\n" +
          "Chọn Xác nhận nhập kho: lô chuyển sang đã nhập kho, tồn của kho đã chọn tăng đúng kg thực. Từ lúc này lô mới xuất, bán hoặc đóng gói được.",
      },
    );
  }
  steps.push(
    {
      id: "age",
      target: "warehouse-age",
      optional: true,
      title: "Hàng nằm kho bao lâu",
      body:
        "Thanh chia tồn theo số ngày từ ngày sản xuất tới hôm nay: Dưới 30 ngày · 30–60 ngày · 60–90 ngày · Trên 90 ngày, kèm số lô của từng nhóm.\n" +
        "Phần nằm lâu nên xuất trước. Thanh tính theo kho đang lọc và chỉ hiện khi kho còn tồn.",
    },
    {
      id: "capacity",
      target: "warehouse-capacity",
      title: "Dung tích và tải trọng kho",
      body:
        "Mỗi thẻ là một kho của BSF1: tên kho, thẻ Kho lớn hoặc kho của xưởng, sức chứa (tấn), kg đang chứa và phần trăm đã dùng.\n" +
        "• Thanh xanh: còn chỗ.\n" +
        "• Thanh vàng: đã dùng trên 85%.\n" +
        "• Thẻ và thanh đỏ: vượt sức chứa.\n" +
        "Thẻ viền xanh là kho đang lọc.",
    },
    {
      id: "filter",
      target: "warehouse-filter",
      title: "Lọc theo kho",
      body: "Chọn một kho để chỉ xem tồn của kho đó; bỏ chọn để xem mọi kho. Bộ lọc đổi theo Số lô hàng, Tổng tồn, thanh Hàng nằm kho bao lâu và bảng tồn bên dưới.",
    },
    {
      id: "stock",
      target: "warehouse-stock",
      title: "Bảng tồn theo lô",
      body:
        "Mỗi dòng là một lô còn hàng: Mặt hàng · Kho · Lô (ngày SX) · Còn (kg) · Block · Nhập / xuất (kg nhập khi duyệt / kg đã ra). Lô đã hết hàng không hiện.\n" +
        "Ô tìm lọc theo mặt hàng, quy cách hoặc kho; chọn tên cột để sắp xếp. Ô vuông đầu dòng dùng để chọn dòng rồi tô màu, đánh dấu những dòng đã kiểm. Dòng Tổng tồn ở cuối bảng.\n" +
        "Chưa có lô nào thì trang ghi \"Chưa có tồn trong kho\": duyệt các lô chờ nhập ở trên, hoặc ghi sản lượng ở Sản xuất thành phẩm trước.",
    },
    {
      id: "outro",
      title: "Hoàn tất hướng dẫn",
      body:
        "Hàng trong kho đi ra theo ba đường: lệnh xuất ở Đơn đặt (lấy lô cũ trước), dòng bán nguồn Block thô ở Bán hàng, và phiếu đóng gói ở Đóng gói. Cả ba đều trừ vào tồn của trang này.\n" +
        "Chọn Hoàn tất để trở về trang. Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
    },
  );
  return { title: "Kho dự trữ", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "warehouse",
  build: () => buildWarehouseTour({ can: { approve: true } }),
};
