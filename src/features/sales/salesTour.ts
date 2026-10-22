// ============================================================
// Tên file: src/features/sales/salesTour.ts
// Tên tiếng Việt: Hướng dẫn từng bước của trang Bán hàng
// Description: Sales page tour (docs/app-map/43-guided-tour.ba-spec.md). Steps follow the work
//              order of app-map 33: write an invoice (two dates, channel, source) → choose
//              the period → read invoices (channel, "Ghi bù", rows, "Chưa có giá") → link lots →
//              totals → hand-off to Cân đối. Write steps only exist for users with that
//              permission; price wording only for users who may see prices. Nothing is written (R1).
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface SalesTourContext {
  can: {
    /** Ghi phiếu bán, thêm mặt hàng. */
    create: boolean;
    /** Sửa phiếu, sửa dòng. */
    update: boolean;
    /** Xem đơn giá, thành tiền. */
    viewPrice: boolean;
  };
}

/** Dựng các bước theo thứ tự công việc (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildSalesTour(ctx: SalesTourContext): PageTour {
  const { can } = ctx;
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Bán hàng",
      body:
        "Trang Bán hàng ghi phiếu bán thành phẩm RA cho khách mỗi ngày. Một phiếu là một khách nhận hàng một lượt, có thể nhiều mặt hàng. Người bán hàng ghi phiếu; kế toán xem sổ và báo cáo.\n" +
        "Trong chuỗi nhập hàng → sản xuất → kho → bán / xuất, đây là khâu bán: hàng lấy từ Kho dự trữ (block thô) hoặc từ hàng đã đóng gói; sau đó Cân đối kỳ lấy các dòng bán vào khối thành phẩm ra. Lệnh xuất ở Đơn đặt cũng tự tạo phiếu bán kênh Xuất khẩu ở đây.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
  ];
  if (can.create) {
    steps.push(
      {
        id: "create",
        target: "sales-create",
        optional: true,
        title: "Ghi phiếu bán",
        body:
          "Chọn Ghi phiếu bán để mở phiếu. Điền đầu phiếu trước:\n" +
          "• Ngày xuất bán: ngày hàng thực xuất — mọi tổng hợp và Cân đối tính theo ngày này. Ngày ghi sổ: ngày ghi vào hệ thống, không được trước ngày xuất bán. Ngày ghi sổ muộn hơn ngày xuất bán là ghi bù, phải ghi Lý do ghi bù.\n" +
          "• Phân xưởng, Kênh bán (Xuất khẩu: đơn giá USD · Nội địa: đơn giá VND), Khách hàng, Ghi chú phiếu.\n" +
          "Đầu phiếu áp cho mọi dòng của phiếu. Phiếu mới nhớ kênh vừa dùng.",
      },
      {
        id: "add-item",
        title: "Thêm mặt hàng và nguồn bán",
        body:
          "Trong phiếu, khối Thêm mặt hàng có: Mặt hàng · Nguồn bán · Quy cách (size, VD 18-20) · Lượng (kg)" +
          (can.viewPrice ? " · Đơn giá (bỏ trống nếu chưa chốt giá)" : "") +
          ".\n" +
          "• Nguồn bán Block thô (kho dự trữ): trừ tồn bán thành phẩm ở Kho dự trữ.\n" +
          "• Nguồn bán Đóng gói (kho thành phẩm): trừ tồn thành phẩm đã đóng gói.\n" +
          "Khi đã chọn mặt hàng, phiếu hiện Tồn khả dụng của nguồn đó. Lượng lớn hơn tồn ⇒ cảnh báo bán vượt tồn; vẫn ghi được, tồn sẽ báo âm.\n" +
          "Chọn Thêm mặt hàng vào sổ: dòng vào sổ ngay. Xong phiếu để đóng, Lưu & thêm phiếu khác để ghi tiếp cho khách khác cùng ngày.",
      },
    );
  }
  steps.push(
    {
      id: "stats",
      target: "sales-stats",
      title: "Năm chỉ số của kỳ",
      body:
        "• Đang xem: ngày hoặc khoảng ngày đang xem.\n" +
        "• Phân xưởng: xưởng đang lọc.\n" +
        "• Số phiếu và Số dòng: số phiếu bán và số dòng mặt hàng trong kỳ.\n" +
        "• Tổng bán: tổng kg đã bán trong kỳ.",
    },
    {
      id: "filter",
      target: "sales-filter",
      title: "Kỳ xem sổ và phân xưởng",
      body:
        "Kỳ xem sổ: Ngày · Tuần · Tháng · Năm · Khoảng tự chọn. Với Tuần, Tháng, Năm, chọn một ngày bất kỳ trong kỳ; ô ngày ghi rõ kỳ đang xem.\n" +
        "Phân xưởng: Đông · Cá · Khô hoặc Tất cả. Sổ lọc theo ngày xuất bán của phiếu.\n" +
        "Ghi xong một phiếu nằm ngoài kỳ đang xem, sổ tự chuyển về ngày của phiếu đó.",
    },
    {
      id: "invoice",
      target: "sales-invoice",
      optional: true,
      title: "Một phiếu bán",
      body:
        "Đầu mỗi cụm: Phiếu số mấy, khách, ngày xuất bán · xưởng, và tổng kg của phiếu (Phiếu này).\n" +
        "• Thẻ kênh: Xuất khẩu hoặc Nội địa.\n" +
        "• Thẻ Ghi bù kèm ngày ghi sổ: phiếu ghi sau ngày xuất bán; dòng Lý do ghi bù ghi vì sao.\n" +
        "Phiếu do lệnh xuất ở Đơn đặt tạo ra có ghi chú \"Xuất container từ đơn …\"." +
        (can.update ? "\nChọn Sửa phiếu để đổi đầu phiếu (áp cho mọi dòng), thêm, sửa, bỏ dòng hoặc xóa cả phiếu." : ""),
    },
    {
      id: "items",
      target: "sales-items",
      optional: true,
      title: "Dòng mặt hàng",
      body:
        "Mỗi dòng: Mặt hàng · Quy cách · Lượng (kg)" +
        (can.viewPrice
          ? " · Đơn giá · Thành tiền, đơn vị theo kênh của phiếu (USD hoặc đ).\nThẻ Chưa có giá: dòng chưa nhập đơn giá, thành tiền tính 0 — dòng từ lệnh xuất Đơn đặt luôn chưa có giá, cần sửa dòng để ghi giá."
          : ".") +
        "\nÔ vuông đầu dòng dùng để chọn dòng rồi tô màu, đánh dấu những dòng đã dò.",
    },
  );
  if (can.create || can.update) {
    steps.push({
      id: "lot",
      target: "sales-lot",
      optional: true,
      title: "Gắn lô cho dòng bán",
      body:
        "Dòng bán nguồn Block thô gắn lô bán thành phẩm, nguồn Đóng gói gắn lô thành phẩm. Chọn Gắn lô rồi quét tem, gõ mã hoặc chọn lô còn tồn; lô phải cùng mặt hàng với dòng bán. Đã gắn thì nút đổi thành Lô (số lô).\n" +
        "Có lô thì sổ tồn trừ đúng lô đó (phần còn lại trừ lô sản xuất sớm trước), và khi cần thu hồi, hộ chiếu lô truy được tới khách này. Dòng từ lệnh xuất Đơn đặt không có nút này — lô đã nằm trong lệnh xuất.",
    });
  }
  steps.push(
    {
      id: "totals",
      target: "sales-totals",
      optional: true,
      title: "Tổng của kỳ",
      body:
        "Tổng khối lượng: tổng kg mọi dòng trong kỳ và xưởng đang xem." +
        (can.viewPrice
          ? "\nTổng tiền bán: cộng thẳng thành tiền các dòng đang xem, không quy đổi tỉ giá. Kỳ có cả Xuất khẩu (USD) và Nội địa (VND) thì con số này cộng lẫn hai đơn vị — đọc giá trị theo từng phiếu (kênh ghi ở đầu phiếu)."
          : ""),
    },
    {
      id: "outro",
      title: "Hoàn tất hướng dẫn",
      body:
        "Cuối kỳ, ở Cân đối kỳ, nút Lấy … dòng từ sổ bán chép các dòng bán có ngày xuất bán trong kỳ vào khối thành phẩm ra. Sổ bán giữ nguyên; dòng đã lấy vào một kỳ thì không gợi ý lại.\n" +
        "Chọn Hoàn tất để trở về trang. Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
    },
  );
  return { title: "Bán hàng", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "sales",
  build: () => buildSalesTour({ can: { create: true, update: true, viewPrice: true } }),
};
