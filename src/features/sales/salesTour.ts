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

/** Hai tab của trang (`?tab=`): Sổ bán hàng (mặc định) · Báo cáo. */
export type SalesTabId = "ledger" | "report";

export interface SalesTourContext {
  can: {
    /** Ghi phiếu bán, thêm mặt hàng. */
    create: boolean;
    /** Sửa phiếu, sửa dòng. */
    update: boolean;
    /** Xem đơn giá, thành tiền. */
    viewPrice: boolean;
  };
  /** Đổi tab (chỉ đổi đường dẫn `?tab=`, replace). Không truyền ⇒ bước không đổi chỗ xem (test). */
  showTab?: (tab: SalesTabId) => void;
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
      title: "Kỳ xem sổ, phân xưởng và bộ lọc",
      body:
        "Kỳ xem sổ: Ngày · Tuần · Tháng · Năm · Khoảng tự chọn. Với Tuần, Tháng, Năm, chọn một ngày bất kỳ trong kỳ; ô ngày ghi rõ kỳ đang xem.\n" +
        "Phân xưởng: Đông · Cá · Khô hoặc Tất cả. Sổ lọc theo ngày xuất bán của phiếu.\n" +
        "Khách hàng · Kênh bán · ô Tra khách, mặt hàng, quy cách, ghi chú (không cần dấu) để chỉ xem phiếu cần. Đang lọc thì thẻ số và tổng tính theo dòng đang hiện (ghi \"theo bộ lọc\"); Bỏ hết bộ lọc để về sổ đầy đủ của kỳ. Lọc ra không dòng nào thì trang báo Không có dòng nào khớp bộ lọc.\n" +
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
          ? "\nTiền bán Xuất khẩu (USD) và Tiền bán Nội địa (đ): thành tiền các dòng đang xem, cộng riêng theo kênh của phiếu — hai đơn vị không bao giờ cộng chung, không quy đổi tỉ giá. Kỳ chỉ có một kênh thì chỉ hiện một dòng tiền."
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
  // Bước Sổ bán hàng đổi về tab Sổ; bước Báo cáo đổi sang tab Báo cáo — mỗi tab MỘT hàm prepare chung (R6).
  const toLedger = ctx.showTab ? () => ctx.showTab?.("ledger") : undefined;
  const toReport = ctx.showTab ? () => ctx.showTab?.("report") : undefined;
  const outro = steps.pop() as TourStep;
  const ledgerSteps = steps.slice(1).map((st) => ({ ...st, prepare: toLedger }));
  const tabs: TourStep = {
    id: "tabs",
    target: "sales-tabs",
    title: "Sổ bán hàng và Báo cáo",
    prepare: toLedger,
    body:
      "Trang có hai tab:\n" +
      "• Sổ bán hàng: ghi, sửa và xem từng phiếu bán theo kỳ.\n" +
      "• Báo cáo: tổng bán theo kỳ, gom theo khách × kênh. Chỉ đọc sổ bán, không ghi gì.",
  };
  const reportSteps: TourStep[] = [
    {
      id: "report-filters",
      target: "sales-report-filters",
      title: "Kỳ báo cáo",
      prepare: toReport,
      body: "Ở tab Báo cáo, chọn Kỳ báo cáo (Ngày · Tuần · Tháng · Năm · Khoảng tự chọn) rồi chọn một ngày bất kỳ trong kỳ. Phiếu vào kỳ theo ngày xuất bán, giống sổ bán. Lọc thêm theo Khách hàng và Kênh bán: thẻ số, biểu đồ và bảng tính theo phần đang lọc (ghi \"theo bộ lọc\"); Bỏ hết bộ lọc để về cả kỳ.",
    },
    {
      id: "report-stats",
      target: "sales-report-stats",
      title: "Thẻ số của báo cáo",
      prepare: toReport,
      body:
        "Kỳ báo cáo · Tổng bán (kg của mọi kênh) · Số khách có mua trong kỳ." +
        (can.viewPrice
          ? "\nGiá trị Xuất khẩu (USD) và Giá trị Nội địa (đ): thành tiền cộng riêng theo kênh của phiếu — hai đơn vị không cộng chung, không quy đổi tỉ giá."
          : ""),
    },
    {
      id: "report-table",
      target: "sales-report-table",
      optional: true,
      title: "Bảng theo khách và kênh",
      prepare: toReport,
      body:
        "Mỗi dòng là một khách × một kênh: Số cân (kg)" +
        (can.viewPrice ? " và Giá trị theo đơn vị của kênh (USD hoặc đ)" : "") +
        ". Dòng tổng chỉ cộng kg" +
        (can.viewPrice ? "; giá trị không cộng vì hai kênh khác đơn vị" : "") +
        ". Biểu đồ Sản lượng bán theo khách phía trên tính theo kg.",
    },
  ];
  // Lời giới thiệu cũng về tab Sổ: bắt đầu từ tab Báo cáo thì tab Sổ kịp vẽ trước khi dò chỗ của các bước sau.
  return { title: "Bán hàng", steps: [{ ...steps[0], prepare: toLedger }, tabs, ...ledgerSteps, ...reportSteps, outro] };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "sales",
  build: () => buildSalesTour({ can: { create: true, update: true, viewPrice: true }, showTab: () => {} }),
};
