// ============================================================
// Tên file: src/features/monthly-stock/monthlyStockTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Sổ kho theo tháng — dựng các bước
// Description: Page tour for /monthly-stock (docs/app-map/43-guided-tour.ba-spec.md). Steps follow
//              the work order of a month (open the book → read → enter → carry forward), content
//              from docs/app-map/36-so-kho-thang.md. Single view: no step changes the URL and
//              nothing is written (R1). Write steps only for users with the right (R3).
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface MonthlyStockTourContext {
  can: {
    /** Thêm dòng · kế thừa tồn đầu · dồn sang tháng sau. */
    create: boolean;
    /** Gõ thẳng trên bảng · thao tác một dòng · đồng bộ danh mục. */
    update: boolean;
    /** Nhập Excel bảng kê. */
    import: boolean;
  };
}

/** Dựng các bước theo thứ tự công việc của một tháng (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildMonthlyStockTour(ctx: MonthlyStockTourContext): PageTour {
  const { can } = ctx;
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Sổ kho theo tháng",
      body:
        "Sổ kho theo tháng là bảng kê kho của kế toán và thủ kho, ghi theo tháng dương lịch cho mọi loại hàng: nguyên liệu, bán thành phẩm, thành phẩm. Mọi số tính theo kg.\n" +
        "Trang nằm ở khâu kho của chuỗi nhập hàng → sản xuất → kho → bán / xuất: hàng mua về, hàng xưởng cấp đông và hai dòng kho của Cân đối kỳ đều ghi vào đây.\n" +
        "Mỗi dòng là một lô (mặt hàng · size · invoice) của một kho. Tồn cuối tháng này thành tồn đầu tháng sau, không phải chép tay.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "filters",
      target: "monthly-stock-filters",
      title: "Tháng, kho và tìm mặt hàng",
      body:
        "• Kỳ (tháng): mặc định là tháng hiện tại. Hai nút mũi tên hai bên để sang tháng trước, tháng sau.\n" +
        "• Kho: Tất cả kho cộng sổ của mọi kho; chọn một kho để xem riêng sổ của kho đó.\n" +
        "• Tìm mặt hàng: lọc theo tên, size, invoice, nhóm, kho hoặc vị trí trong tháng đang xem. Không dòng nào khớp thì trang báo và có Hiện tất cả để bỏ lọc.\n" +
        "Đổi tháng hoặc kho thì các dòng đang tick được bỏ chọn, tránh cộng nhầm dòng của kỳ khác.",
    },
  ];

  if (can.import) {
    steps.push({
      id: "import-excel",
      target: "monthly-stock-import",
      optional: true,
      title: "Nhập Excel bảng kê",
      body:
        "Chọn Nhập Excel bảng kê để đọc file bảng kê kho của kế toán (.xlsx): mỗi sheet là một tháng, nhóm hàng lấy theo mục I, II, III của file.\n" +
        "Hộp xem trước cho chọn Năm và Kho, kèm số dòng từng tháng. Một file là một kho: chọn ĐÚNG kho của file, đừng theo mặc định Kho 1500 tấn. Nạp nhầm kho sẽ tạo bản sao ở kho khác và Tất cả kho bị cộng đôi.\n" +
        "Nạp lại cùng file, cùng năm, cùng kho chỉ cập nhật, không nhân đôi. Hệ thống không chép tồn cuối của file: nạp xong, mở tháng đầu rồi chọn Dồn sang tháng sau lần lượt từng tháng để tồn đầu các tháng sau đúng.",
    });
  }

  steps.push(
    {
      id: "month-open",
      target: "monthly-stock-month-open",
      optional: true,
      title: "Mở sổ tháng mới",
      body:
        "Tháng chưa có dòng nào thì gặp một trong hai trường hợp:\n" +
        "• Tháng trước còn tồn: bảng hiện bản Xem trước tồn đầu, ghi CHƯA LƯU. Số đó là tồn cuối tháng trước, chưa ghi vào sổ. Chọn Kế thừa & lưu vào sổ để ghi; gõ thẳng vào bảng cũng tự kế thừa rồi ghi số vừa gõ (Ctrl+Z lùi cả hai). Trong lúc xem trước, các nút thao tác từng dòng tạm ẩn.\n" +
        "• Tháng trước không còn tồn: trang báo tháng chưa có số liệu, chọn Thêm dòng để nhập tay.\n" +
        "Kế thừa chạy lại chỉ cập nhật, không nhân đôi dòng.",
    },
    {
      id: "stats",
      target: "monthly-stock-stats",
      optional: true,
      title: "Năm thẻ tổng của tháng",
      body:
        "• Tồn đầu kỳ: tồn cuối tháng trước mang sang. Số này được lưu cố định, sửa lại tháng cũ không làm trôi.\n" +
        "• Nhập trong kỳ, Xuất trong kỳ: cộng các dòng của tháng.\n" +
        "• Tồn cuối kỳ = Tồn đầu kỳ + Nhập trong kỳ − Xuất trong kỳ.\n" +
        "• Tiền còn lại = Tồn cuối kỳ (kg) × Đơn giá của từng dòng, cộng lại.\n" +
        "Tồn cuối và tiền còn lại do hệ thống tính, không gõ. Số thẻ tính theo kho và ô tìm đang chọn.",
    },
    {
      id: "invariant",
      target: "monthly-stock-invariant",
      optional: true,
      title: "Kiểm tra cân bằng",
      body:
        "Khớp bất biến (chữ xanh): tồn đầu + nhập − xuất = tồn cuối của các dòng đang hiện, sổ đang cân.\n" +
        "Lệch bất biến (chữ đỏ): tổng không khớp, cần kiểm lại số liệu. Một dòng có tồn cuối âm nghĩa là xuất nhiều hơn đang có, thường do ghi sai.\n" +
        "Nhãn bên phải đếm số mặt hàng và số nhóm của tháng.",
    },
    {
      id: "carry-gap",
      target: "monthly-stock-carry-gap",
      optional: true,
      title: "Lệch dồn kỳ",
      body:
        "Vòng gối đầu đúng thì tồn đầu tháng này bằng tồn cuối tháng trước. Lệch quá 1 kg thì trang hiện khung Lệch dồn kỳ với số lệch tổng và từng nhóm.\n" +
        "Chọn Đối chiếu & sửa lệch để xem từng mặt hàng lệch. Hệ thống so theo kho, nhóm và tên hàng, bỏ size và invoice, vì lô hay tách size hoặc đổi mã giữa các tháng.\n" +
        "Mỗi mặt hàng có Sửa tay: bảng lọc về đúng mặt hàng đó để tự chỉnh tồn đầu, nhập, xuất. Hệ thống chỉ soi, không tự ghi đè số. Khung này không hiện khi đang xem trước tồn đầu.",
    },
    {
      id: "table",
      target: "monthly-stock-table",
      optional: true,
      title: "Bảng theo nhóm hàng",
      body:
        "Mỗi nhóm một bảng, cuối bảng có dòng Cộng của nhóm: Nguyên liệu nhập khẩu · Nguyên liệu mua ngoài · Hàng tạm · Bán thành phẩm · Thành phẩm đóng gói (nhóm khác xếp sau cùng).\n" +
        "Cột: Ngày nhập · Mặt hàng · Size · Invoice · Đơn giá (đ) · Tồn đầu kỳ · Nhập trong kỳ · Xuất trong kỳ · Tồn cuối kỳ (kg) · Tiền còn lại (đ) · Vị trí.\n" +
        "• Vị trí để trống (tên kho chữ mờ): hàng nằm ở chính kho của sổ. Thẻ Gửi: <kho>: hàng gửi ra kho ngoài, ví dụ Kho Ánh Dương. Đổi vị trí không đổi số kg.\n" +
        "• Thẻ Từ SX ở nhóm Hàng tạm: lô hàng đông lạnh do xưởng ghi.\n" +
        "• Trong mỗi bảng, dòng chia theo loài: cá trên, bạch tuộc dưới, rồi các loài khác; mỗi loài có dòng Cộng riêng. Loài lấy theo danh mục, chưa có thì đoán từ tên hàng.\n" +
        "• Xếp dòng (đầu bảng): mỗi dòng có nút lên / xuống trong cùng loài; thứ tự lưu vào sổ, dồn sang tháng sau. Về mặc định xếp lại cá trên, bạch tuộc dưới, tên A → Z.\n" +
        "• Nút Thẻ kho (hình đồng hồ) cuối dòng: lịch sử mặt hàng qua tối đa 24 tháng. Đọc dọc tồn cuối với tồn đầu tháng sau để thấy chỗ đứt vòng.",
    },
    {
      id: "linked-rows",
      title: "Dòng do trang khác ghi",
      body:
        "• Hàng tạm Từ SX: xưởng ghi ở Sản xuất thành phẩm, khối Hàng đông lạnh nhập kho. Sửa số ngay trên bảng như dòng thường; bỏ lô thì làm ở trang Sản xuất khi chưa lấy ra, chưa dồn kỳ.\n" +
        "• Cân đối kỳ ghi hai dòng kho. Lấy xả đông cộng vào cột Xuất của lô được chọn. Gửi đông tạo lô riêng, invoice GĐ kèm ngày gửi (ví dụ GĐ-20261015), đơn giá là giá gửi của ngày đó.\n" +
        "• Ghi chú của lô có dòng vết ⟦CĐ:…⟧ do Cân đối ghi. Đừng sửa tay dòng vết này: Cân đối dùng nó để đặt lại số.\n" +
        "• Nạp lại Excel tháng có lô bị Cân đối lấy thì cột Xuất trở về số trong file, Cân đối sẽ báo Sổ kho tháng lệch.",
    },
  );

  if (can.update) {
    steps.push({
      id: "inline-edit",
      target: "monthly-stock-edit-hint",
      optional: true,
      title: "Gõ thẳng trên bảng",
      body:
        "Ô Ngày nhập, Size, Invoice, Đơn giá, Tồn đầu kỳ, Nhập trong kỳ, Xuất trong kỳ và Vị trí gõ thẳng là ghi ngay vào sổ; Tồn cuối kỳ và Tiền còn lại tự tính lại.\n" +
        "• Enter, ↑, ↓ đi dọc cột (qua cả các nhóm), Tab đi ngang. Dán được khối số từ Excel theo thứ tự Đơn giá · Tồn đầu · Nhập · Xuất; (2.000) hiểu là −2.000.\n" +
        "• Ô trên bảng là TỔNG cả tháng (ghi đè). Muốn cộng thêm từng lần thì dùng nút thao tác cuối dòng.\n" +
        "• Hoàn tác, Làm lại (Ctrl+Z, Ctrl+Y) lùi được mọi lần ghi trong lần mở trang này.\n" +
        "Mọi lần sửa đều lưu vết ở Nhật ký thao tác: ai sửa, lúc nào, số cũ và số mới.",
    });
  }

  if (can.create) {
    steps.push({
      id: "add-row",
      target: "monthly-stock-add-row",
      optional: true,
      title: "Dòng mới",
      body:
        "Cuối mỗi bảng nhóm có ô Dòng mới: gõ hoặc chọn tên hàng là dòng hiện ngay trong nhóm đó, ở tháng đang xem, rồi con trỏ nhảy sang ô Nhập trong kỳ để gõ số. Dòng mới thuộc kho đang lọc; đang xem Tất cả kho thì vào Kho 1500 tấn.\n" +
        "Cần điền nhiều ô một lần (ngày nhập, size, invoice, đơn giá, số kg, vị trí) thì chọn Thêm đủ thông tin… để mở hộp Thêm dòng kho.\n" +
        "Lô mới (khác ngày nhập hoặc invoice) là một dòng mới. Hàng về thêm cho đúng lô đang có thì dùng Nhập thêm ở nút thao tác cuối dòng.",
    });
  }

  if (can.update) {
    steps.push({
      id: "row-actions",
      target: "monthly-stock-row-actions",
      optional: true,
      title: "Thao tác một dòng",
      body:
        "Nút Lấy ra / gửi kho (hình hộp có dấu trừ) mở hộp ba việc, nhập số kg, ngày và ghi chú:\n" +
        "• Lấy ra sử dụng: cộng dồn vào Xuất trong kỳ, không cho vượt tồn cuối.\n" +
        "• Nhập thêm: cộng dồn vào Nhập trong kỳ cho đúng lô này.\n" +
        "• Gửi kho ngoài: không phải nhập hay xuất nên tổng tháng không đổi. Gửi hết tồn thì dòng chỉ đổi Vị trí; gửi một phần thì tách thành dòng mới ở kho nhận.\n" +
        "Mỗi lần lưu ghi thêm một dòng nhật ký vào ghi chú lô (xem ở Thẻ kho) và có Hoàn tác.\n" +
        "Bút chì: sửa tên hàng, nhóm và các ô khác trong một hộp. Thùng rác: xóa dòng, có hỏi lại và Hoàn tác.",
    });
  }

  steps.push({
    id: "select",
    target: "monthly-stock-select",
    optional: true,
    title: "Chọn dòng, cộng tổng và tô màu",
    body:
      "Tick ô vuông đầu dòng (Shift + tick chọn cả khoảng, ô ở đầu bảng chọn cả nhóm) hoặc chọn Chọn tất cả. Thanh Đã chọn N dòng hiện sau các bảng, cộng tồn đầu, nhập, xuất, tồn cuối (kg) và tiền còn lại của đúng mấy dòng đó.\n" +
      "Trên thanh: Tô màu (10 sắc × 5 mức), In đậm, Bỏ tô để đánh dấu dòng đã dò. Dấu tô lưu chung mọi máy, không đổi số và không theo sang tháng sau. Thêm In N dòng; Chuyển bảng, Gửi kho ngoài và Xóa dòng đã chọn khi được cấp quyền.\n" +
      "Chuyển bảng: đưa các dòng đang tick sang bảng (nhóm hàng) hoặc kho khác, số kg giữ nguyên. Tháng sau đã mở thì dòng dồn của các lô này đi theo; tháng trước không đổi.\n" +
      "Ẩn dòng trống (n): giấu các dòng có tồn đầu, nhập, xuất đều bằng 0; chọn lại để hiện. Mặc định hiện đủ.",
  });

  if (can.update) {
    steps.push({
      id: "catalog-sync",
      target: "monthly-stock-sync",
      optional: true,
      title: "Đồng bộ danh mục",
      body:
        "Tên hàng trong sổ (nhất là sổ nạp từ Excel) hay lệch với danh mục. Số trong ngoặc là số tên chưa có trong danh mục.\n" +
        "Chọn Đồng bộ danh mục để đối chiếu với Loại nguyên liệu và Mặt hàng: mỗi tên chọn đích (Mặt hàng, Loại NL hoặc Bỏ qua) và tên chuẩn có sẵn để ánh xạ, hoặc thêm mới. Lưu xong, tên chưa có được thêm vào danh mục và mọi dòng sổ mang tên cũ đổi sang tên chuẩn.\n" +
        "141 mã thành phẩm của kế toán không bị đụng tới.",
    });
  }

  steps.push({
    id: "print",
    target: "monthly-stock-print",
    optional: true,
    title: "In A4",
    body: "Chọn In A4 để xem trước bản in khổ A4 của tháng đang xem, theo kho và ô tìm đang chọn. Có tick dòng thì chỉ in đúng mấy dòng đó, kèm tổng của chúng.",
  });

  if (can.create) {
    steps.push({
      id: "carry-next",
      target: "monthly-stock-carry-next",
      optional: true,
      title: "Dồn sang tháng sau",
      body:
        "Cuối tháng, soát xong thì chọn nút Dồn sang (kèm tên tháng sau): tồn cuối từng dòng của tháng này thành tồn đầu tháng sau, cho MỌI kho, không theo bộ lọc Kho.\n" +
        "• Chỉ dòng còn tồn theo kg được mang sang; nút chỉ hiện khi tháng còn tồn.\n" +
        "• Chạy lại chỉ cập nhật tồn đầu: nhập, xuất, vị trí, ghi chú đã ghi ở tháng sau giữ nguyên. Dòng đã hết tồn hoặc đã xóa thì tồn đầu tháng sau về 0.\n" +
        "• Đã sửa tay tồn đầu một dòng dồn kỳ ở tháng sau thì dồn lại sẽ đặt về đúng tồn cuối. Lô tách size nên ghi bằng dòng riêng.",
    });
  }

  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để trở về trang đang xem.\n" +
      "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
  });

  return { title: "Sổ kho theo tháng", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "monthly-stock",
  build: () => buildMonthlyStockTour({ can: { create: true, update: true, import: true } }),
};
