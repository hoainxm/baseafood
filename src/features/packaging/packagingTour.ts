// ============================================================
// Tên file: src/features/packaging/packagingTour.ts
// Tên tiếng Việt: Hướng dẫn từng bước của trang Đóng gói (/packaging)
// Description: Page tour for the packaging screen (docs/app-map/43-guided-tour.ba-spec.md):
//              pick the day → record a packaging slip (semi-finished goods consumed → packed
//              finished goods, loss) → read totals and packed stock → attach the BTP lot and print
//              the label. Steps only point at places; nothing is written and no dialog opens (R1).
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface PackagingTourContext {
  can: {
    /** Ghi phiếu đóng gói (quyền Thêm ở ít nhất một xưởng). */
    create: boolean;
    /** Gắn lô BTP + in tem cho phiếu (quyền Thêm hoặc Sửa). */
    lot: boolean;
  };
}

/** Dựng các bước theo thứ tự công việc (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildPackagingTour(ctx: PackagingTourContext): PageTour {
  const { can } = ctx;
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Đóng gói",
      body:
        "Trang này ghi phiếu đóng gói: bán thành phẩm (block còn khuôn đá ở kho dự trữ) đem đóng thành thành phẩm sẵn bán (hộp, túi, thùng). Người dùng chính là tổ trưởng và quản đốc xưởng.\n" +
        "Trang nằm sau Sản xuất thành phẩm và Kho dự trữ, trước Bán hàng: mỗi phiếu trừ tồn bán thành phẩm, cộng tồn thành phẩm đóng gói; Bán hàng chọn nguồn Đóng gói thì trừ vào tồn thành phẩm này.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "filter",
      target: "packaging-filter",
      title: "Kỳ xem, phân xưởng và bộ lọc",
      body:
        "Kỳ xem: Ngày · Tuần · Tháng · Năm · Khoảng tự chọn; chọn Ngày (hoặc khoảng ngày) và Phân xưởng (Tất cả, Đông, Cá, Khô).\n" +
        "Các thẻ số và bảng phiếu bên dưới tính theo lựa chọn này. Phiếu mới mở sẵn ngày đang xem (kỳ nhiều ngày thì ngày cuối kỳ) và xưởng đang chọn.\n" +
        "Kho thành phẩm (khi có từ hai kho) và ô Tra mặt hàng, quy cách, kho, ghi chú để thu hẹp bảng. Đang lọc thì thẻ số và tổng tính theo dòng đang hiện (ghi \"theo bộ lọc\"); Bỏ hết bộ lọc để về sổ đầy đủ của kỳ. Lọc ra không dòng nào thì trang báo Không có dòng nào khớp bộ lọc.",
    },
  ];

  if (can.create) {
    steps.push({
      id: "add-packaging",
      target: "packaging-add",
      optional: true,
      title: "Ghi phiếu đóng gói",
      body:
        "Chọn Ghi phiếu đóng gói để mở phiếu. Phiếu gồm:\n" +
        "• Ngày đóng gói và Phân xưởng.\n" +
        "• Bán thành phẩm tiêu hao: Mặt hàng BTP, Quy cách BTP, BTP vào (kg), Số block. Trang hiện Tồn BTP khả dụng của mặt hàng và quy cách đó; đóng vượt tồn thì báo để kiểm lại (vẫn ghi được, tồn báo âm).\n" +
        "• Thành phẩm đóng gói ra: Mặt hàng TP (có thể khác mã BTP), Quy cách đóng gói, TP ra (kg), Số thùng, Kho chứa TP.\n" +
        "Hao hụt = BTP vào − TP ra. TP ra lớn hơn BTP vào thì phiếu báo hao hụt âm — kiểm lại số.\n" +
        "Chọn Ghi đóng gói: phiếu vào sổ, tồn bán thành phẩm trừ ngay, tồn thành phẩm cộng ngay; thông báo có nút In tem. Đóng hộp ngang thì phiếu gõ dở được giữ làm nháp, Hủy mới bỏ hẳn.",
    });
  }

  steps.push(
    {
      id: "stats",
      target: "packaging-stats",
      title: "Năm chỉ số của kỳ",
      body:
        "• Đang xem: kỳ đang lọc.\n" +
        "• Số phiếu: số phiếu đóng gói trong kỳ.\n" +
        "• BTP vào: tổng kg bán thành phẩm đem đóng.\n" +
        "• TP ra: tổng kg thành phẩm đóng gói ra.\n" +
        "• Hao hụt = BTP vào − TP ra. Số âm (TP ra nhiều hơn BTP vào) thì thẻ đổi màu cảnh báo — có phiếu ghi sai, cần kiểm lại.",
    },
    {
      id: "finished-good-stock",
      target: "packaging-fg-stock",
      optional: true,
      title: "Tồn thành phẩm đóng gói",
      body:
        "Thành phẩm đóng gói còn trong kho, theo từng mặt hàng · quy cách; thẻ bên cạnh là tổng kg.\n" +
        "Tồn = TP ra của mọi phiếu đóng gói − phần Bán hàng đã bán với nguồn Đóng gói. Khối này tính trên toàn sổ, không theo kỳ đang xem; chỉ hiện khi còn tồn.",
    },
    {
      id: "packaging-table",
      target: "packaging-table",
      optional: true,
      title: "Sổ phiếu đóng gói",
      body:
        "Mỗi dòng một phiếu: Ngày · Xưởng · BTP tiêu hao (mặt hàng, quy cách, kg, block) · Thành phẩm ra (mặt hàng, quy cách, kg, thùng) · Hao hụt (kg) · Kho TP.\n" +
        "Hao hụt âm tô màu cảnh báo. Xóa phiếu (có quyền Xóa): tồn bán thành phẩm và tồn thành phẩm được tính lại, còn nút Hoàn tác.\n" +
        "Ô vuông đầu dòng dùng để chọn dòng rồi tô màu, đánh dấu những phiếu đã kiểm.",
    },
  );

  if (can.lot) {
    steps.push({
      id: "row-lot",
      target: "packaging-row-actions",
      optional: true,
      title: "Gắn lô BTP và in tem",
      body:
        "• Gắn lô BTP: ghi phiếu đã đóng từ lô bán thành phẩm nào — quét tem, gõ mã hoặc chọn. Chỉ nhận lô cùng mặt hàng BTP tiêu hao của phiếu. Đã gắn thì nút đổi thành \"Lô BTP (n)\".\n" +
        "• Có lô gắn: tồn bán thành phẩm trừ đúng lô đó. Chưa gắn: trừ lô cũ nhất trước. Có lô thì quét tem thành phẩm mới truy ngược được về bán thành phẩm và nguyên liệu.\n" +
        "• Tem: in tem QR lô thành phẩm của phiếu để dán lên thùng.",
    });
  }

  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để kết thúc; trang giữ nguyên như trước khi bắt đầu.\n" +
      "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
  });

  return { title: "Đóng gói", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "packaging",
  build: () => buildPackagingTour({ can: { create: true, lot: true } }),
};
