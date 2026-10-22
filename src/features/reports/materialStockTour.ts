// ============================================================
// Tên file: src/features/reports/materialStockTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Tồn kho nguyên liệu (/nxt-material)
// Description: Step-by-step page tour for the raw-material stock report — period + workshop →
//              stat cards → scope note (production issue not captured, freeze/thaw info only) →
//              warnings → by-day and by-material tables → manual opening stock. Steps only
//              point; nothing is written (ba-spec 43 R1).
//              Content source: docs/app-map/31-can-doi-ky.md §Tồn kho nguyên liệu (PA-a) ·
//              38-so-ton-lien-tuc.ba-spec.md §0 · lib/inventoryMaterial.ts#computeMaterialTotalStock.
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface MaterialStockTourContext {
  /** Có quyền khai tồn đầu (`nxt-material.create`) — nút Thêm tồn đầu trong hộp Tồn đầu. */
  canCreateOpening: boolean;
}

export function buildMaterialStockTour(ctx: MaterialStockTourContext): PageTour {
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Tồn kho nguyên liệu",
      body:
        "Trang cho biết nguyên liệu còn bao nhiêu kg theo từng loại nguyên liệu và theo từng ngày, cho cả 3 phân xưởng Đông · Cá · Khô. Kế toán, Ban Giám đốc, quản đốc và thủ kho dùng để xem tồn nguyên liệu trước khi chốt số hay quyết mua thêm.\n" +
        "Trang nằm ở đầu chuỗi: sau Nhập hàng, trước Sản xuất. Số suy thẳng từ sổ Nhập hàng, không gõ lại: Tồn cuối = Tồn đầu + Nhập − Xuất SX − Bán nội địa. Chỗ ghi tay duy nhất là Tồn đầu.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "filters",
      target: "nxt-material-filters",
      title: "Kỳ báo cáo và phân xưởng",
      body:
        "Kỳ báo cáo: Ngày · Tuần · Tháng · Năm · Khoảng tự chọn. Sau đó chọn Ngày bất kỳ trong kỳ (dòng nhỏ bên dưới ghi rõ Kỳ: từ ngày – đến ngày); Khoảng tự chọn thì chọn Khoảng ngày.\n" +
        "Phân xưởng: Tất cả xưởng hoặc một xưởng Đông, Cá, Khô. Mọi số và cả danh sách Tồn đầu đều theo xưởng đã chọn.\n" +
        "Kỳ không có nhập hàng thì trang hiện Chưa có nhập hàng nào trong khoảng ngày này.",
    },
    {
      id: "stats",
      target: "nxt-material-stats",
      title: "Năm chỉ số của kỳ",
      body:
        "• Tồn đầu kỳ: tồn đầu khai tay + nhập − bán nội địa từ ngày mốc khai tay tới trước kỳ. Chưa khai tồn đầu thì cộng mọi chuyến nhập trước kỳ.\n" +
        "• Nhập trong kỳ: mọi chuyến ở sổ Nhập hàng có ngày trong kỳ.\n" +
        "• Xuất SX (chờ): luôn 0 kg, vì phần nguyên liệu lấy ra sản xuất chưa được ghi.\n" +
        "• Bán nội địa: nguyên liệu bán thẳng, không chế biến, ghi ở màn Sản xuất thành phẩm. Đây là khoản xuất thật, có trừ vào tồn.\n" +
        "• Tồn cuối (chưa trừ SX) = Tồn đầu + Nhập − Bán nội địa.",
    },
    {
      id: "scope-note",
      target: "nxt-material-scope-note",
      title: "Phạm vi của số tồn",
      body:
        "Khung vàng này luôn hiện để người đọc không hiểu nhầm:\n" +
        "• Xuất SX chưa được ghi nên tồn hiện là tồn theo nhập, CHƯA trừ phần đã đem chế biến. Khi màn Sản xuất ghi được nguyên liệu lấy ra, cột này sẽ có số và tồn thành tồn thật.\n" +
        "• Đông gửi / Xả đông chỉ là thông tin kho đông dự trữ (vòng gối đầu ở Cân đối kỳ), KHÔNG cộng vào tồn: phần còn dở đem cấp đông vốn đã nằm trong nhập hàng, cộng nữa là đếm hai lần.",
    },
    {
      id: "leftover-warning",
      target: "nxt-material-leftover-warning",
      optional: true,
      title: "Còn dở sản xuất chưa hiện",
      body:
        "Khung này hiện khi có kg còn dở lúc chốt ngày sản xuất, ghi ở ngày CHƯA có kỳ cân đối nào (cùng loại nguyên liệu) phủ. Số kg đó chưa vào cột Đông gửi ở đâu cả.\n" +
        "Việc cần làm: tạo kỳ cân đối phủ ngày đó ở màn Cân đối kỳ; khung tự mất khi phần còn dở đã vào cột Đông gửi.",
    },
    {
      id: "negative-warning",
      target: "nxt-material-negative-warning",
      optional: true,
      title: "Cảnh báo tồn cuối âm",
      body:
        "Khung đỏ hiện khi có loại nguyên liệu tồn cuối ÂM. Dòng đó có thẻ Tồn âm và số tồn cuối màu đỏ.\n" +
        "Thường do tồn đầu khai thiếu, chuyến nhập ghi sai kg hoặc bán nội địa ghi vượt. Kiểm lại ở sổ gốc; trang tự tính lại.",
    },
    {
      id: "by-day",
      target: "nxt-material-by-day",
      optional: true,
      title: "Tồn theo ngày",
      body:
        "Mỗi dòng là một ngày có nhập hoặc có bán nội địa, mọi loại nguyên liệu gộp lại.\n" +
        "• Nhập (kg): tổng các chuyến của ngày.\n" +
        "• Xuất SX (kg): hiện dấu — vì chưa ghi.\n" +
        "• Bán nội địa (kg): nguyên liệu bán thẳng trong ngày.\n" +
        "• Tồn cuối ngày (kg): bắt đầu từ tổng tồn đầu kỳ, cộng nhập và trừ bán nội địa lần lượt từng ngày.",
    },
    {
      id: "by-material",
      target: "nxt-material-by-material",
      optional: true,
      title: "Tồn theo loại nguyên liệu",
      body:
        "Mỗi dòng là một loại nguyên liệu (các size cùng loại gộp chung, VD 2 da lớn và 2 da nhỏ thành một dòng Bạch tuộc 2 da). Cột Tồn đầu · Nhập · Xuất SX · Bán nội địa · Tồn cuối (kg) tính như năm chỉ số ở trên; hàng cuối bảng là tổng.\n" +
        "Hai cột cuối là thông tin kho đông, không vào Tồn cuối:\n" +
        "• Đông gửi (kho đông): lấy dòng Gửi đông ở Cân đối kỳ; chưa có thì lấy còn dở khi chốt ngày sản xuất; chưa có nữa thì lấy chuyển kỳ âm cũ.\n" +
        "• Xả đông (kho đông): dòng Lấy xả đông ở Cân đối kỳ cộng chuyển kỳ dương cũ.\n" +
        "Thẻ Tồn đầu khai tay: loại có số khai ở nút Tồn đầu. Thẻ Tồn âm: tồn cuối dưới 0.\n" +
        "Ô vuông đầu dòng ở cả hai bảng dùng để chọn dòng rồi tô màu, đánh dấu những dòng đã kiểm.",
    },
    {
      id: "opening",
      target: "nxt-material-opening",
      title: "Tồn đầu khai tay",
      body:
        "Nút Tồn đầu (số trong ngoặc là số dòng đã khai của xưởng đang xem) mở danh sách số dư nguyên liệu có sẵn TRƯỚC khi dùng app. Chỉ khai MỘT lần.\n" +
        "Tồn đầu tính từ ngày = ngày ĐẦU TIÊN app bắt đầu tính nhập (VD 01/07 cho tồn cuối 30/06). Chuyến nhập trước ngày đó coi như đã nằm trong số khai, không cộng lại; nhập từ ngày đó trở đi cộng thêm. Ngày mốc sau cuối kỳ đang xem thì chưa áp.\n" +
        (ctx.canCreateOpening
          ? "Trong hộp, chọn Thêm tồn đầu, điền Phân xưởng, Loại nguyên liệu (đúng tên như ở sổ Nhập hàng để khớp loại), Tồn đầu tính từ ngày, Khối lượng tồn rồi chọn Lưu tồn đầu: số vào cột Tồn đầu và dòng có thẻ Tồn đầu khai tay."
          : "Bạn chỉ được xem danh sách này; người có quyền ghi mới khai thêm được."),
    },
    {
      id: "outro",
      title: "Hoàn tất hướng dẫn",
      body:
        "Chọn Hoàn tất để trở về đúng màn hình đang xem trước khi bắt đầu.\n" +
        "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
    },
  ];
  return { title: "Tồn kho nguyên liệu", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "nxt-material",
  build: () => buildMaterialStockTour({ canCreateOpening: true }),
};
