// ============================================================
// Tên file: src/features/my-tasks/myTasksTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Việc của tôi — dựng các bước
// Description: Page tour for /my-tasks (docs/app-map/43-guided-tour.ba-spec.md). Steps follow
//              the work order of the page: read the counters → filter by due date → the three
//              sections → open a task → delegate. Due rules and task kinds come from
//              lib/myTasks.ts + lib/dataFlow.ts (doc docs/app-map/39-my-tasks.md). The tour only
//              points; it never writes (R1).
// ============================================================
import { APPROVAL_WAIT_DAYS, PERIOD_LOCK_GRACE_DAYS, getWarningKindLabel } from "@/lib/dataFlow";
import { DOCUMENT_EXPIRY_NOTICE_DAYS } from "@/lib/documents";
import { formatDateVN } from "@/lib/format";
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";
import { DONE_VISIBLE_DAYS, TASKS_START_DATE } from "@/lib/myTasks";

export interface MyTasksTourContext {
  can: {
    /** Giao việc (nút Giao ở việc theo quyền + nút Giao việc mới). */
    assign: boolean;
    /** Sửa việc đã giao. */
    editAssigned: boolean;
  };
}

/** Dựng các bước theo thứ tự công việc (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildMyTasksTour(ctx: MyTasksTourContext): PageTour {
  const { can } = ctx;
  const kind = getWarningKindLabel;
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Việc của tôi",
      body:
        "Trang Việc của tôi gom mọi việc người đang đăng nhập phải làm, hạn của từng việc và việc đã giao cho người khác. Thủ kho, tổ trưởng, quản đốc và kế toán đều dùng trang này mỗi ngày.\n" +
        "Trang đứng trên cả chuỗi nhập hàng → sản xuất → kho → bán / xuất: nhắc ngày nhập và ngày sản xuất chưa chốt, mẻ chưa gắn lô, BTP chờ duyệt nhập kho, bán vượt tồn, kỳ cân đối chưa chốt và chứng nhận sắp hết hạn. Việc tính từ ngày " +
        formatDateVN(TASKS_START_DATE) +
        " (ngày bắt đầu chạy số thật).\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "stats",
      target: "my-tasks-stats",
      title: "Các thẻ số",
      body:
        "• Quá hạn: việc của tôi (được giao cho tôi và việc theo quyền của tôi) đã qua hạn. Còn việc quá hạn thì thẻ đỏ.\n" +
        "• Hạn hôm nay: việc phải xong trong hôm nay.\n" +
        "• Được giao cho tôi: số việc người khác giao riêng cho bạn đang mở. Số trên chuông ở thanh tiêu đề và số đỏ cạnh mục Việc của tôi ở menu là số này.\n" +
        "• Tôi đã giao: việc bạn giao cho người khác còn đang mở; dòng phụ cho biết bao nhiêu việc người nhận để quá hạn. Thẻ này chỉ hiện khi bạn được giao việc hoặc đã từng giao.\n" +
        "Chọn thẻ Quá hạn hoặc Hạn hôm nay để lọc danh sách; chọn hai thẻ còn lại để tới đúng mục.",
    },
    {
      id: "filter",
      target: "my-tasks-filter",
      title: "Lọc theo hạn",
      body:
        "Bộ lọc áp cho cả ba mục bên dưới:\n" +
        "• Cần làm (mặc định): mọi việc có hạn, bỏ việc Để biết. Ở mục Tôi đã giao vẫn giữ việc còn mở để đốc.\n" +
        "• Quá hạn · Hôm nay · Để biết: chỉ hiện việc đúng mức đó.\n" +
        "• Tất cả: hiện mọi việc, kể cả việc đã xong hoặc đã thu hồi ở mục Tôi đã giao.\n" +
        "Ô Tra việc, người giao, người nhận: gõ một phần tên việc hoặc tên người (không cần dấu); Bỏ hết bộ lọc để xóa ô tra.",
    },
    {
      id: "assigned",
      target: "my-tasks-assigned",
      title: "Được giao cho tôi",
      body:
        "Việc người khác giao riêng cho bạn, làm theo hạn người giao đặt. Dòng phụ ghi Giao bởi ai và ghi chú của người giao.\n" +
        "• Việc máy phát hiện đã giao cho bạn (ngày chưa chốt, chưa gắn lô…): tự hết khi sổ đã sửa xong, không cần chọn gì thêm.\n" +
        "• Việc giao (việc giao tay): làm xong thì chọn Xong ở dòng đó, người giao sẽ thấy.",
    },
    {
      id: "mine",
      target: "my-tasks-mine",
      title: "Việc theo quyền của tôi",
      body:
        "Việc máy tự phát hiện mà bạn có quyền làm, trong phạm vi của bạn (quản đốc: xưởng mình; tổ trưởng: mẻ mình ghi), và chưa giao riêng cho ai. Việc đã giao cho người khác không còn ở đây để khỏi làm trùng.\n" +
        "Loại việc và hạn (hạn = ngày của việc + số ngày):\n" +
        `• ${kind("imports-unlocked")}, ${kind("production-unlocked")}, ${kind("lot-unassigned")}: chốt hoặc gắn lô trong ngày, sang hôm sau là quá hạn.\n` +
        `• ${kind("changed-after-lock")}, ${kind("oversold")}: sửa ngay trong ngày.\n` +
        `• ${kind("approval-overdue")}: trong ${APPROVAL_WAIT_DAYS} ngày kể từ ngày sản xuất.\n` +
        `• ${kind("period-unlocked")}: ${PERIOD_LOCK_GRACE_DAYS} ngày sau ngày cuối kỳ.\n` +
        `• ${kind("document-expiring")}: báo trước ${DOCUMENT_EXPIRY_NOTICE_DAYS} ngày, hạn là ngày hết hạn của chứng nhận.\n` +
        `• ${kind("backdated")}, ${kind("yield-deviation")}, ${kind("period-yield-deviation")}: không có hạn, chỉ để biết.\n` +
        "Hết việc thì mục này hiện \"Không còn việc tồn\".",
    },
    {
      id: "task-row",
      target: "my-tasks-mine",
      title: "Đọc một dòng việc",
      body:
        "• Hạn: Quá hạn n ngày (đỏ, hôm nay đã qua hạn) · Hạn hôm nay · Hạn và ngày (chưa tới hạn) · Để biết (không có hạn). Danh sách xếp việc quá hạn lâu nhất lên đầu.\n" +
        "• Việc: tiêu đề, loại việc và chi tiết. Ngày và Xưởng: ngày, xưởng của sổ cần sửa.\n" +
        "• Mở việc: mở đúng màn, đúng ngày và xưởng cần làm (Nhập hàng mở Sổ chi tiết, Sản xuất mở Sổ ngày & báo cáo, Đóng gói lọc đúng ngày). Làm xong ở màn đó rồi quay lại đây, việc đã tự hết.\n" +
        "Ô vuông đầu dòng dùng để chọn dòng rồi tô màu, đánh dấu việc đã xem.",
    },
  ];
  if (can.assign) {
    steps.push({
      id: "delegate",
      target: "my-tasks-mine",
      optional: true,
      title: "Giao một việc cho người khác",
      body:
        "Chọn Giao ở một dòng để giao việc đó cho đúng một người, kèm hạn và ghi chú. Lưu xong, việc chuyển sang mục Được giao cho tôi của người nhận và rời khỏi danh sách theo quyền của người khác.\n" +
        "Người nhận có vẻ thiếu quyền làm việc đó thì hộp giao báo dưới ô Người nhận, vẫn cho giao.",
    });
  }
  steps.push({
    id: "delegated",
    target: "my-tasks-delegated",
    optional: true,
    title: "Tôi đã giao",
    body:
      "Việc bạn đã giao cho người khác, để đốc. Dòng phụ ghi Giao cho ai.\n" +
      "Cột Hạn: Quá hạn n ngày khi người nhận để quá hạn · Đã xong (người nhận chọn Xong, hoặc sổ đã sửa xong thì việc máy tự đóng) · Đã thu hồi. Việc đã xong hoặc đã thu hồi còn hiện thêm " +
      DONE_VISIBLE_DAYS +
      " ngày.\n" +
      (can.editAssigned ? "Sửa: đổi người nhận, hạn hoặc ghi chú của việc còn mở.\n" : "") +
      "Thu hồi: hỏi trước, có Hoàn tác. Người nhận không còn thấy việc; việc máy phát hiện chưa sửa xong quay về danh sách chung của những người có quyền.",
  });
  if (can.assign) {
    steps.push({
      id: "assign-new",
      target: "my-tasks-assign-new",
      optional: true,
      title: "Giao việc mới",
      body:
        "Dùng khi cần giao một việc tay không do máy phát hiện. Hộp giao gồm: Việc cần làm, Người nhận, Hạn, Màn cần mở (với Nhập hàng, Sản xuất, Đóng gói thì chọn thêm Ngày cần xem và Xưởng), Ghi chú cho người nhận.\n" +
        "Lưu xong người nhận thấy ngay ở mục Được giao cho tôi; việc hiện ở mục Tôi đã giao của bạn. Đang gõ dở mà đóng hộp thì nội dung được giữ làm nháp.",
    });
  }
  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để trở về đúng màn hình đang xem trước khi bắt đầu.\n" +
      "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
  });
  return { title: "Việc của tôi", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "my-tasks",
  build: () => buildMyTasksTour({ can: { assign: true, editAssigned: true } }),
};
