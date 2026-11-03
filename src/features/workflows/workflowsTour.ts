// ============================================================
// Tên file: src/features/workflows/workflowsTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Quy trình — dựng các bước
// Description: Page tour for /workflows (ba-spec 43 + 65 R7): choose an area → read states, steps,
//              handoffs, who does what → the page always matches the software. Read-only page.
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export function buildWorkflowsTour(): PageTour {
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Quy trình",
      body:
        "Trang Quy trình vẽ luật của từng khu trong phần mềm: một việc đi qua những trạng thái nào, mỗi bước xong khi nào, bộ phận nào bàn giao cho bộ phận nào và ai được làm gì. Dùng khi cần kiểm lại một quy định hoặc trả lời câu hỏi kiểu \"vì sao bước này chưa Xong\".\n" +
        "Trang chỉ để đọc. Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "areas",
      target: "workflows-areas",
      title: "Chọn khu",
      body:
        "Mỗi khu một sơ đồ: Xuất khẩu, Nhập hàng, Sản xuất, Kho, Kinh doanh, Báo cáo & Cân đối, Nhập khẩu, Lệnh sản xuất, Việc của tôi · Tổng quan · Tài liệu, Danh mục · Quản trị. Trên điện thoại chọn ở ô Khu.\n" +
        "Từ trang bất kỳ, chọn nút ? rồi Xem sơ đồ quy trình để mở thẳng khu của trang đó.",
    },
    {
      id: "doc",
      target: "workflows-doc",
      title: "Đọc một sơ đồ",
      body:
        "Mỗi sơ đồ có cùng thứ tự: trạng thái của việc chính (sơ đồ + bảng Nghĩa · Sang bước sau khi · Ai làm), các bước và cột Xong khi, chỗ bàn giao giữa bộ phận, bảng Ai được làm gì (lấy từ phân quyền mặc định, vai đã chỉnh ở Vai trò & quyền có thể khác) và chỗ nối sang khu khác.\n" +
        "Bảng rộng thì cuộn ngang trong khung của bảng.",
    },
    {
      id: "sync",
      target: "workflows-doc",
      title: "Sơ đồ luôn khớp phần mềm",
      body:
        "Mỗi lần sửa phần mềm của một khu, sơ đồ của khu đó cùng hướng dẫn thao tác và hộp ? được sửa trong cùng một lần cập nhật; thiếu thì máy không cho đưa bản sửa lên. Vì vậy điều ghi ở đây là luật đang chạy.",
    },
    {
      id: "outro",
      title: "Hoàn tất hướng dẫn",
      body:
        "Chọn Hoàn tất để trở về đúng màn hình đang xem trước khi bắt đầu.\n" +
        "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
    },
  ];
  return { title: "Quy trình", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13). */
export const tourSpec: PageTourSpec = {
  pageId: "workflows",
  build: buildWorkflowsTour,
};
