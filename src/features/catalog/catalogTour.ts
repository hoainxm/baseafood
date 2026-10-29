// ============================================================
// Tên file: src/features/catalog/catalogTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Danh mục — dựng các bước
// Description: Page tour for /catalog (docs/app-map/43-guided-tour.ba-spec.md). Walks the
//              tabs in the order the chain uses them and explains the common list / add / edit /
//              delete pattern. Tab steps switch `?tab=` through `setTab` (URL only, replace) —
//              nothing is written (R1). Rules from docs/app-map/32-danh-muc.md.
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

/** Id tab (`?tab=`) — khớp TAB_RESOURCE ở CatalogScreen. */
export type CatalogTourTab = "products" | "customers" | "suppliers" | "material-types" | "batters" | "storage-locations" | "document-kinds" | "finished-goods";

/** Tên tab đang hiện trên trang (CatalogScreen TabsTrigger). */
export const CATALOG_TAB_LABELS: Readonly<Record<CatalogTourTab, string>> = {
  products: "Mặt hàng",
  customers: "Khách hàng",
  suppliers: "Đại lý",
  "material-types": "Loại nguyên liệu",
  batters: "Bột tẩm",
  "storage-locations": "Kho lưu trữ",
  "document-kinds": "Loại chứng từ",
  "finished-goods": "Thành phẩm (141 mã)",
};

export interface CatalogTourContext {
  /** Có ít nhất một ô Thêm / Sửa / Xóa ở một tab danh mục. */
  canWrite: boolean;
  /** Đổi tab đang xem (chỉ đổi `?tab=`, replace). */
  setTab: (tab: CatalogTourTab) => void;
}

/** Dựng các bước theo thứ tự công việc (R2). Tab không được xem ⇒ mốc không có ⇒ bước tự bỏ (R3). */
export function buildCatalogTour(ctx: CatalogTourContext): PageTour {
  const T = CATALOG_TAB_LABELS;
  const at = (tab: CatalogTourTab, s: Omit<TourStep, "target" | "prepare" | "optional">): TourStep => ({
    ...s,
    target: `catalog-${tab}`,
    optional: true,
    prepare: () => ctx.setTab(tab),
  });

  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Danh mục",
      body:
        "Trang Danh mục giữ các danh sách dùng chung cho cả chuỗi nhập hàng → sản xuất → kho → bán / xuất: đại lý và loại nguyên liệu khi nhập hàng, mặt hàng và bột tẩm khi sản xuất, đóng gói, khách hàng khi bán và xuất khẩu, kho lưu trữ khi xem tồn kho, 141 mã thành phẩm của kế toán.\n" +
        "Kế toán, thủ kho và quản đốc chọn từ danh mục thay vì gõ tay, để cùng một thứ luôn mang một tên và tổng cuối kỳ cộng đúng.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "tabs",
      target: "catalog-tabs",
      title: "Các tab danh mục",
      body:
        `Mỗi tab là một danh mục: ${Object.values(T).join(" · ")}. Chọn tên tab để đổi danh mục; rê chuột lên tab để xem danh mục đó dùng ở đâu.\n` +
        "Mỗi tab có quyền riêng: tab bạn không được xem thì không hiện; tab chỉ được xem thì có nhãn Chỉ xem thay cho nút Thêm.",
    },
    at("products", {
      id: "list",
      title: "Cách dùng một danh mục",
      body:
        "Sáu tab đầu dùng chung một cách làm:\n" +
        "• Đầu tab: tên danh mục và câu nói danh mục dùng ở đâu.\n" +
        "• Ô Tìm: gõ một phần tên hoặc mã số để lọc ngay bảng.\n" +
        "• Bảng: chọn tên cột để sắp xếp; cột phụ xem ở nút Chi tiết cuối dòng. Ô vuông đầu dòng dùng để chọn dòng rồi tô màu, đánh dấu dòng đã rà.",
    }),
  ];
  if (ctx.canWrite) {
    steps.push(
      at("products", {
        id: "write",
        title: "Thêm, sửa, xóa",
        body:
          "• Thêm (vd Thêm mặt hàng): mở hộp điền thông tin. Lưu xong mục mới dùng được ngay ở mọi ô chọn của các màn khác.\n" +
          "• Sửa: cùng hộp với Thêm. Sổ đã ghi trước đó giữ nguyên tên cũ, không hồi tố.\n" +
          "• Xóa: hỏi lại trước khi xóa, sau đó có Hoàn tác. Các dòng sổ đã ghi không đổi.\n" +
          "Hộp báo lỗi ngay khi Mã số trùng với một mục khác của cùng danh mục (để trống thì không kiểm), hoặc khi tên mặt hàng, tên loại bột, tên kho trùng với mục đã có (không phân hoa thường).",
      }),
    );
  }
  steps.push(
    at("products", {
      id: "products",
      title: "Mặt hàng",
      body:
        "Mặt hàng thực tế của xưởng, dùng khi ghi sản xuất, đóng gói, bán hàng, cân đối và nối dòng hàng hợp đồng xuất khẩu. Tên mặt hàng đã gồm quy cách / size.\n" +
        "• Tên tiếng Anh mặc định: dùng trên chứng từ xuất khẩu khi khách chưa có tên riêng.\n" +
        "• Loài, Loại nguyên liệu, Kiểu chế biến: để lọc và gom khi ghi sổ.\n" +
        "• Bột đi kèm: các loại bột của mặt hàng tẩm bột; màn sản xuất hiện ô kg cho từng loại.\n" +
        "• Mã số: số gọi nhanh, gõ số ở ô chọn là ra tên.\n" +
        "• Mã thành phẩm (danh mục kế toán): nối tới một trong 141 mã; để trống thì bảng ghi Chưa ánh xạ.",
    }),
    at("customers", {
      id: "customers",
      title: "Khách hàng",
      body:
        "Khách mua thành phẩm (đầu ra), khác với đại lý cung cấp nguyên liệu. Mỗi khách có Tên khách hàng, Mã số gọi nhanh, Thị trường; nhóm Xuất khẩu (Quốc gia, Cảng đích mặc định, Điều kiện thanh toán, Địa chỉ, Người liên hệ, Email liên hệ) xem ở Chi tiết, Phòng Kế hoạch dùng khi lập hợp đồng.",
    }),
    at("customers", {
      id: "customer-names",
      title: "Tên hàng trên chứng từ",
      body:
        "Nút Tên hàng (n) ở mỗi dòng khách mở danh sách tên khách dùng trên hợp đồng, invoice xuất khẩu; n là số tên đã có.\n" +
        "• Mỗi mặt hàng của xưởng có một dòng cho khách đó: Tên trên chứng từ, Size, Quy cách đóng gói, Mã HS, Ghi chú.\n" +
        "• Hai mặt hàng của cùng khách không được trùng cả tên lẫn size; ghi size để phân biệt.\n" +
        "• Trích xuất từ chứng từ: lấy tên từ các hợp đồng và Commercial Invoice đã có của khách, chỉ thêm tên còn thiếu, không ghi đè tên đang có. Khi lưu hợp đồng đã nối mặt hàng ở Xuất khẩu, app cũng tự thêm tên còn thiếu.\n" +
        "Khách chưa có tên riêng cho một mặt hàng thì chứng từ dùng Tên tiếng Anh mặc định của mặt hàng.",
    }),
    at("suppliers", {
      id: "suppliers",
      title: "Đại lý",
      body:
        "Nơi giao nguyên liệu về xưởng, dùng khi ghi chuyến nhập hàng hằng ngày.\n" +
        "• Tên đại lý (gọi tắt): tên ghi trên sổ nhập, vd Hồng Phú.\n" +
        "• Ghi hóa đơn: Tên ghi phiếu (đầy đủ), MST / CCCD, ngày cấp, nơi cấp, địa chỉ.\n" +
        "• Chuyển khoản: Số tài khoản, Ngân hàng, Chi nhánh.\n" +
        "Sổ nhập lưu theo tên gọi tắt: đổi tên đại lý không sửa các dòng đã ghi.",
    }),
    at("material-types", {
      id: "material-types",
      title: "Loại nguyên liệu",
      body:
        "Quy cách / size nguyên liệu (vd 2 da nguyên liệu, Mực ống 7cm), mỗi loại gắn một Loài. Dùng khi ghi dòng hàng nhập, còn dở sản xuất và cân đối kỳ. Sổ lưu theo tên loại nên đổi tên không hồi tố.",
    }),
    at("batters", {
      id: "batters",
      title: "Bột tẩm",
      body:
        "Các loại bột tẩm (vd 24V, 18V, 220H, 232, 20802), mỗi loại có tên và mã số. Gắn bột cho từng mặt hàng ở ô Bột đi kèm của tab Mặt hàng. Bột là phụ gia: kg bột ghi riêng ở sản xuất, không cộng vào kg thành phẩm.",
    }),
    at("storage-locations", {
      id: "storage-locations",
      title: "Kho lưu trữ",
      body:
        "Nơi hàng đang nằm: Kho nhà hoặc Kho thuê ngoài (kho lạnh thuê). Dùng ở cột Kho lưu của báo cáo Xuất – Nhập – Tồn và ô vị trí ở Sổ kho tháng. Tên kho là chỗ nối dữ liệu nên không được trùng.\n" +
        "Danh mục này khác với các kho hệ thống của sổ kho tháng (K1000T, K1500T…), không sửa ở đây.",
    }),
    at("document-kinds", {
      id: "document-kinds",
      title: "Loại chứng từ",
      body:
        "Loại chứng từ xuất khẩu khách yêu cầu, dùng ở phần Chứng từ khách yêu cầu của hợp đồng và Bộ chứng từ của chuyến. 10 loại gốc có luật riêng (Commercial Invoice bắt kg, số thùng, tiền; B/L bắt ngày on board; Bảo hiểm khi CIF / CIP): đổi tên được, xóa thì về tên gốc.\n" +
        "Loại thêm mới tính như Chứng từ khác: cần số, ngày và file mới Xong. Thêm nhanh được ngay trong ô chọn Loại chứng từ.",
    }),
    at("finished-goods", {
      id: "finished-goods",
      title: "Thành phẩm (141 mã)",
      body:
        "141 mã thành phẩm của kế toán (tài khoản 1551, đơn vị kg), chỉ để tra cứu, không thêm / sửa / xóa trong app; muốn đổi phải sửa ở sổ kế toán. Lọc theo Nhóm hàng hoặc tìm theo tên, mã. Mặt hàng nối tới mã ở đây qua ô Mã thành phẩm.",
    }),
    {
      id: "quick-edit",
      title: "Thêm và sửa ngay ở màn khác",
      body:
        "Không cần mở trang này mỗi lần: ở mọi ô chọn danh mục trên các màn nhập liệu (nhập hàng, sản xuất, đóng gói, bán hàng, cân đối…), gõ tên mới rồi chọn Thêm mới để lưu ngay vào danh mục; tên trùng (không phân hoa thường) thì dùng lại mục đã có.\n" +
        "Nút bút chì cạnh ô chọn mở hộp sửa nhanh mục đang chọn (cần quyền sửa). Danh mục nối với sổ theo tên (đại lý, loại nguyên liệu, khách hàng, kho lưu) thì ô tên trong hộp sửa nhanh chỉ đọc.",
    },
    {
      id: "outro",
      title: "Hoàn tất hướng dẫn",
      body:
        "Chọn Hoàn tất để trở về đúng tab đang xem trước khi bắt đầu.\n" +
        "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
    },
  );
  return { title: "Danh mục", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "catalog",
  build: () => buildCatalogTour({ canWrite: true, setTab: () => {} }),
};
