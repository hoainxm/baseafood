// ============================================================
// Tên file: src/features/reports/warehouseNxtTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Nhập xuất tồn kho (/nxt-warehouse)
// Description: Step-by-step page tour for the warehouse NXT ledger loaded from the plant's own
//              Excel report — load file → warehouse / period / storage filters → stat cards →
//              invariant check → closing stock by storage location → table + selection bar →
//              edit grid → next period carry-over → Excel / A4. Steps only point; nothing is
//              written (ba-spec 43 R1).
//              Content source: WarehouseNxtScreen.tsx header (sổ sống P5-A) · docs/app-map/04
//              (nxt_snapshots) · 32-danh-muc (Kho lưu trữ) · 38-so-ton-lien-tuc §0.
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";
import { DEFAULT_STORAGE_LOCATION, STORAGE_KIND_LABELS } from "@/types";

export interface WarehouseNxtTourContext {
  /** Có quyền ghi sổ (`nxt-warehouse.import`): nạp file, lưới ghi, thêm mã, gán kho lưu, tạo kỳ. */
  canWrite: boolean;
  /** Có quyền xuất (`nxt-warehouse.export`): Xuất Excel + In A4. */
  canExport: boolean;
}

export function buildWarehouseNxtTour(ctx: WarehouseNxtTourContext): PageTour {
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Nhập xuất tồn kho",
      body:
        "Trang giữ sổ Xuất – Nhập – Tồn theo đúng báo cáo của xí nghiệp: mỗi dòng là một mã hàng kế toán của một kho, trong một kỳ báo cáo. Kế toán và thủ kho dùng để đối chiếu với báo cáo nộp, và để biết hàng đang nằm ở kho lưu nào (kho nhà hay kho lạnh thuê ngoài).\n" +
        "Trang nằm ở khâu kho của chuỗi, phía kế toán. Số lấy từ file Excel báo cáo hoặc gõ tay trên lưới; chưa tự nối với sổ Nhập hàng, Sản xuất, Bán hàng (cần bảng ánh xạ mã). Tồn cuối = tồn đầu + nhập − xuất.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
  ];
  if (ctx.canWrite) {
    steps.push({
      id: "import-file",
      target: "nxt-warehouse-import",
      optional: true,
      title: "Nhập Excel báo cáo",
      body:
        "Đầu kỳ hoặc khi có báo cáo mới, chọn Nhập Excel báo cáo rồi chọn file Xuất – Nhập – Tồn xuất từ hệ thống xí nghiệp (mẫu 10 cột).\n" +
        "App đọc dòng \"Từ ngày … đến ngày …\" để biết kỳ và dòng \"Chi nhánh:\" để biết kho. Nạp lại cùng kho, cùng kỳ thì thay số của kỳ đó, không nhân đôi dòng. Mọi mã nạp về kho lưu " +
        DEFAULT_STORAGE_LOCATION +
        "; mã gửi kho ngoài thì gán lại ở bước Gán kho lưu.",
    });
  }
  steps.push(
    {
      id: "filters",
      target: "nxt-warehouse-filters",
      optional: true,
      title: "Kho, kỳ và kho lưu",
      body:
        "• Kho / chi nhánh: kho theo báo cáo của xí nghiệp (VD KHO TP - KHO 1000).\n" +
        "• Kỳ báo cáo: các kỳ đã nạp hoặc đã tạo của kho đó, kỳ mới nhất đứng đầu.\n" +
        "• Kho lưu: Tất cả kho lưu hoặc chỉ một kho (" +
        Object.values(STORAGE_KIND_LABELS).join(" hoặc ") +
        "). Lọc kho lưu chỉ để xem, không đổi số của kỳ.\n" +
        "Chưa nạp file nào thì ba ô này chưa hiện và trang báo Chưa có số liệu Xuất–Nhập–Tồn.",
    },
    {
      id: "stats",
      target: "nxt-warehouse-stats",
      optional: true,
      title: "Bốn chỉ số của kỳ",
      body:
        "Tồn đầu kỳ · Nhập trong kỳ · Xuất trong kỳ · Tồn cuối kỳ (kg), cộng các mã đang hiện: theo kho, kỳ và kho lưu đang chọn.\n" +
        "Tồn cuối kỳ = Tồn đầu kỳ + Nhập trong kỳ − Xuất trong kỳ.",
    },
    {
      id: "invariant",
      target: "nxt-warehouse-invariant",
      optional: true,
      title: "Kiểm bất biến",
      body:
        "Dòng này tự kiểm tổng: tồn đầu + nhập − xuất phải bằng tồn cuối.\n" +
        "• Khớp bất biến (chữ xanh): ghi rõ phép cộng, số liệu ăn khớp.\n" +
        "• Lệch bất biến (chữ đỏ): số nguồn có chỗ sai, kiểm lại file hoặc số đã gõ trước khi dùng.\n" +
        "Thẻ SL mặt hàng bên phải là số mã đang hiện.",
    },
    {
      id: "by-location",
      target: "nxt-warehouse-by-location",
      optional: true,
      title: "Tồn cuối theo kho lưu",
      body:
        "Mỗi nút là một kho lưu, kèm tồn cuối (kg) và số mã đang nằm ở đó; trả lời câu \"hàng đang ở kho nào\".\n" +
        "Chọn một nút để chỉ xem các mã ở kho đó; chọn lại nút đó hoặc chọn Xem tất cả kho lưu để bỏ lọc.",
    },
    {
      id: "table",
      target: "nxt-warehouse-table",
      optional: true,
      title: "Bảng mã hàng",
      body:
        "Mỗi dòng là một mã hàng: tên hàng, mã hàng (chữ nhỏ), thẻ Kho lưu, Tồn đầu · Nhập · Xuất · Tồn cuối (kg). Tồn cuối luôn tự tính = tồn đầu + nhập − xuất, không gõ.\n" +
        "Tick ô vuông đầu dòng (Shift + tick chọn cả khoảng): thanh \"Đã chọn N mã\" hiện dưới bảng, cộng sẵn tồn đầu · nhập · xuất · tồn cuối của đúng các mã đó, kèm Tô màu, In đậm, Bỏ tô để đánh dấu dòng đã dò" +
        (ctx.canWrite
          ? ". Gán kho lưu ghi các mã đang tick là đang nằm ở một kho khác; kho chưa có thì gõ tên mới, app lưu luôn vào Danh mục → Kho lưu trữ."
          : "."),
    },
  );
  if (ctx.canWrite) {
    steps.push(
      {
        id: "edit-mode",
        target: "nxt-warehouse-edit",
        optional: true,
        title: "Ghi nhập/xuất",
        body:
          "Chọn Ghi nhập/xuất để bật lưới gõ Tồn đầu · Nhập · Xuất từng mã; Tồn cuối tự tính. Gõ xong một ô là ghi vào sổ ngay, dán được cả khối số từ Excel, Enter / Tab để sang ô.\n" +
          "Ở chế độ ghi có thêm Thêm mã (mã mới phát sinh giữa kỳ) và thùng rác cuối dòng để xóa mã (có hỏi lại). Nút đổi thành Xong · xem lại để quay về bảng xem.",
      },
      {
        id: "next-period",
        target: "nxt-warehouse-next-period",
        optional: true,
        title: "Tạo kỳ kế tiếp",
        body:
          "Cuối kỳ, chọn Tạo kỳ kế tiếp, chọn Kỳ mới (mặc định bắt đầu từ ngày sau cuối kỳ đang xem) rồi chọn Tạo kỳ · kế thừa tồn.\n" +
          "Tồn cuối của MỌI mã trong kỳ (mọi kho lưu, không theo lọc) thành tồn đầu kỳ mới, giữ cả kho lưu; nhập, xuất để trống chờ ghi. Kỳ mới đã có mã nào thì chỉ cập nhật tồn đầu mã đó, giữ số đã ghi. Xong, trang chuyển sang kỳ mới ở chế độ ghi.",
      },
    );
  }
  if (ctx.canExport) {
    steps.push({
      id: "export",
      target: "nxt-warehouse-export",
      optional: true,
      title: "Xuất Excel và In A4",
      body:
        "Xuất Excel: tải kỳ đang xem ra file đúng mẫu báo cáo của xí nghiệp (có cả cột giá trị) để gửi kế toán hoặc lưu hồ sơ.\n" +
        "In A4 (nút bên cạnh): xem trước bản in theo kho, kỳ và kho lưu đang lọc, rồi in giấy hoặc lưu PDF. Kỳ chưa có mã nào thì hai nút mờ.",
    });
  }
  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để trở về đúng màn hình đang xem trước khi bắt đầu.\n" +
      "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
  });
  return { title: "Nhập xuất tồn kho", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "nxt-warehouse",
  build: () => buildWarehouseNxtTour({ canWrite: true, canExport: true }),
};
