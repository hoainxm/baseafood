// ============================================================
// Tên file: src/features/documents/documentsTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Tài liệu công ty — dựng các bước
// Description: Page tour for /documents (docs/app-map/43-guided-tour.ba-spec.md). Steps follow
//              the work order: who sees what → counters → filters → list, status, file → detail
//              → issue a new revision / add a document (only for users who may write). Rules come
//              from lib/documents.ts (doc docs/app-map/40-documents.md, spec quan-ly-tai-lieu).
//              The tour never opens the detail dialog or writes anything (R1).
// ============================================================
import { DOCUMENT_EXPIRY_NOTICE_DAYS, DOCUMENT_KINDS, DOCUMENT_STATE_LABELS } from "@/lib/documents";
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface DocumentsTourContext {
  can: {
    /** Thêm tài liệu (nút Thêm tài liệu, Thêm biểu mẫu con). */
    create: boolean;
    /** Thêm hoặc sửa: ghi lần ban hành, đính file, sửa thông tin, thu hồi / mở lại. */
    write: boolean;
    /** Xóa tài liệu chưa từng ban hành. */
    delete: boolean;
  };
}

const kinds = DOCUMENT_KINDS.map((k) => k.label).join(", ");
const S = DOCUMENT_STATE_LABELS;

/** Dựng các bước theo thứ tự công việc (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildDocumentsTour(ctx: DocumentsTourContext): PageTour {
  const { can } = ctx;
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Tài liệu công ty",
      body:
        `Trang Tài liệu công ty là thư viện quy trình, hướng dẫn, biểu mẫu, chứng nhận và hồ sơ năng lực của công ty. Mọi phòng dùng để mở đúng bản đang hiệu lực khi làm việc ở từng khâu của chuỗi nhập hàng → sản xuất → kho → bán / xuất; Phòng Kế hoạch và QC dùng chứng nhận, hồ sơ năng lực khi lập hồ sơ xuất khẩu.\n` +
        "Mỗi tài liệu có mã cố định và nhiều lần ban hành: lần mới không ghi đè lần cũ, bản cũ hết hiệu lực nhưng vẫn mở lại được.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "visibility",
      title: "Bạn thấy tài liệu nào",
      body:
        "Danh sách chỉ có tài liệu bạn được xem:\n" +
        "• Tài liệu của phòng bạn (phòng sở hữu). Phòng của bạn suy từ vai trò; quản trị viên đặt ở Vai trò & quyền.\n" +
        "• Tài liệu mở cho Cả công ty.\n" +
        "• Tài liệu phòng khác chọn cho phòng bạn xem (Chỉ phòng được chọn).\n" +
        "Ban giám đốc và quản trị viên thấy mọi tài liệu. Máy chủ cũng chặn đúng như vậy, cả khi mở file.",
    },
    {
      id: "stats",
      target: "documents-stats",
      title: "Bốn thẻ số",
      body:
        "• Tài liệu bạn xem được: tài liệu chưa thu hồi mà bạn được xem.\n" +
        `• ${S.active}: tài liệu đang có một lần ban hành hiệu lực.\n` +
        `• Chứng nhận sắp hết hạn: chứng nhận, hồ sơ năng lực còn ≤ ${DOCUMENT_EXPIRY_NOTICE_DAYS} ngày hoặc đã hết hạn.\n` +
        "• Thiếu file PDF: tài liệu đang hiệu lực mà lần hiện tại chưa đính bản PDF đã ký. Chọn thẻ này để lọc ra các tài liệu đó; dải \"Đang lọc\" hiện trên bảng, chọn Bỏ lọc để hiện lại tất cả.",
    },
    {
      id: "filters",
      target: "documents-filters",
      title: "Bộ lọc",
      body:
        `• Loại: ${kinds}. Mặc định Mọi loại.\n` +
        "• Phòng: tài liệu phòng đó sở hữu hoặc được mở cho phòng đó xem. Mặc định Mọi phòng.\n" +
        `• Trạng thái: Đang dùng (mặc định, tài liệu chưa thu hồi) · ${S.withdrawn} (tài liệu đã thu hồi) · Tất cả.\n` +
        "Ô tìm phía trên bảng tìm theo mã, tên hoặc ghi chú của tài liệu.",
    },
    {
      id: "table",
      target: "documents-table",
      optional: true,
      title: "Danh sách tài liệu",
      body:
        "Mỗi dòng là một tài liệu: Mã, Tên tài liệu, Loại, Phòng sở hữu, Lần BH · hiệu lực (số lần ban hành đang hiệu lực như in trên giấy, 01, 02…, và ngày bắt đầu hiệu lực), Trạng thái, File, Thuộc (biểu mẫu thuộc quy trình nào).\n" +
        "Chọn tên cột để sắp xếp. Ô vuông đầu dòng dùng để chọn dòng rồi tô màu, đánh dấu tài liệu đã rà.",
    },
    {
      id: "status",
      target: "documents-table",
      optional: true,
      title: "Trạng thái và hạn",
      body:
        "Cột Trạng thái:\n" +
        `• ${S.active}: có một lần ban hành đang hiệu lực, dùng bản này.\n` +
        `• ${S.draft}: đã có lần ban hành nhưng chưa lần nào hiệu lực.\n` +
        `• ${S["not-issued"]}: mới tạo thông tin, chưa ghi lần ban hành nào.\n` +
        `• ${S.withdrawn}: cả tài liệu đã thu hồi, không còn dùng; các lần ban hành và file vẫn giữ.\n` +
        `Chứng nhận, hồ sơ năng lực có ngày hết hạn thì có thêm thẻ: Còn n ngày (còn ≤ ${DOCUMENT_EXPIRY_NOTICE_DAYS} ngày) · Hết hạn hôm nay · Hết hạn và ngày (đã quá hạn). Từ lúc còn ${DOCUMENT_EXPIRY_NOTICE_DAYS} ngày, người có quyền sửa tài liệu thấy việc Tài liệu sắp hết hạn ở Việc của tôi, hạn là ngày hết hạn.`,
    },
    {
      id: "file",
      target: "documents-table",
      optional: true,
      title: "Cột File",
      body:
        "• Xem PDF: xem bản PDF đã ký của lần đang hiệu lực ngay trong app. Link mở file chỉ dùng được ít phút, không gửi ra ngoài được.\n" +
        "• Chưa có PDF: lần đang hiệu lực chưa đính bản đã ký (vd tài liệu nạp từ bản giấy). Người có quyền ghi đính trong hộp chi tiết.\n" +
        "• Dấu —: tài liệu chưa có lần ban hành nào hiệu lực.\n" +
        "Đang chạy không nối máy chủ thì trang báo trên cùng: xem và ghi được thông tin, chưa mở / tải được file.",
    },
    {
      id: "detail",
      target: "documents-table",
      optional: true,
      title: "Xem chi tiết tài liệu",
      body:
        "Chọn Xem ở một dòng để mở hộp chi tiết:\n" +
        "• Bản đang hiệu lực: Lần 0x từ ngày nào, người soạn, người xem xét, người phê duyệt, nội dung sửa đổi; các nút Xem PDF, Tải PDF, Tải file gốc (Word / Excel tải về máy).\n" +
        "• Thông tin chung: Loại, Phòng sở hữu, Ai được xem, Thời hạn lưu bản cũ, Hết hạn (thẻ Đã hết hạn hoặc Còn n ngày), Thuộc tài liệu nào, Ghi chú.\n" +
        `• Các lần ban hành trước: mỗi lần một thẻ, nhãn ${S.withdrawn} kèm ngày; thẻ Quá hạn lưu khi bản cũ đã quá thời hạn lưu (app chỉ đánh dấu, không tự xóa).\n` +
        "• Biểu mẫu thuộc tài liệu này: chọn Xem để mở biểu mẫu con.",
    },
  ];
  if (can.write || can.create || can.delete) {
    const lines = [
      can.write
        ? "• Ghi lần ban hành mới: Lần ban hành, Ngày hiệu lực, Nội dung sửa đổi, Người soạn, Người xem xét, Người phê duyệt, PDF đã ký (bắt buộc), File gốc. Lưu xong lần mới có hiệu lực ngay; lần đang hiệu lực trước đó chuyển Hết hiệu lực từ ngày hiệu lực của lần mới. Lần đã ban hành không sửa, muốn sửa thì ghi lần mới."
        : "",
      can.write
        ? "• Đính PDF đã ký, Đính file gốc: cho lần ban hành còn thiếu file. Chỉ điền ô đang trống, không thay file đã có."
        : "",
      can.write ? "• Sửa thông tin: mã, tên, phòng sở hữu, ai được xem, thời hạn lưu, ngày hết hạn." : "",
      can.create ? "• Thêm biểu mẫu con: biểu mẫu thuộc quy trình này, mặc định cùng phòng và cùng phạm vi xem." : "",
      can.write ? `• Thu hồi: chuyển cả tài liệu sang ${S.withdrawn}, hỏi trước, có Hoàn tác; Mở lại tài liệu đưa về Đang dùng.` : "",
      can.delete ? "• Xóa: chỉ tài liệu chưa từng ban hành (ghi nhầm) và không còn biểu mẫu con; hỏi trước, có Hoàn tác." : "",
    ].filter(Boolean);
    steps.push({
      id: "detail-actions",
      target: "documents-table",
      optional: true,
      title: "Việc ghi trong hộp chi tiết",
      body: "Hàng nút đầu hộp chi tiết (chỉ hiện với người có quyền ghi):\n" + lines.join("\n"),
    });
  }
  if (can.create) {
    steps.push({
      id: "add-document",
      target: "documents-add",
      optional: true,
      title: "Thêm tài liệu",
      body:
        "Chọn Thêm tài liệu khi có tài liệu mới. Phiếu gồm: Mã tài liệu (theo mã công ty, không trùng với tài liệu khác, không phân hoa thường), Tên tài liệu, Loại, Thuộc tài liệu, Phòng sở hữu, Ai được xem (Chỉ phòng được chọn hoặc Cả công ty), Thời hạn lưu bản cũ, Ngày hết hạn (với chứng nhận, hồ sơ năng lực), Ghi chú.\n" +
        `Lưu xong hộp chi tiết mở ra, tài liệu ở trạng thái ${S["not-issued"]}; ghi lần ban hành đầu tiên để tài liệu có hiệu lực.`,
    });
  }
  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để trở về đúng màn hình đang xem trước khi bắt đầu.\n" +
      "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
  });
  return { title: "Tài liệu công ty", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "documents",
  build: () => buildDocumentsTour({ can: { create: true, write: true, delete: true } }),
};
