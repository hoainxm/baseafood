// ============================================================
// Tên file: src/features/import-planning/importTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Nhập khẩu
// Description: Guided tour of /planning-import (ba-spec 43 + 45): order of work, receipt states,
//              done conditions, next steps. Tour never writes data.
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";
import { contractState, receiptsOf, type ImportData } from "@/lib/importPlanning";

export interface ImportTourPick {
  contractId: string;
  receiptId: string;
}

/** Hồ sơ minh họa: HĐ đang nhập có lần nhập (ưu tiên lô còn thiếu) — không có ⇒ null. */
export function pickTourContract(d: ImportData): ImportTourPick | null {
  const live = d.contracts.filter((c) => contractState(d, c) === "receiving");
  for (const c of live) {
    const r = receiptsOf(d, c.id)[0];
    if (r) return { contractId: c.id, receiptId: r.id };
  }
  return null;
}

export interface ImportTourContext {
  pick: ImportTourPick | null;
  can: { create: boolean; update: boolean; receiving: boolean };
  openDossier: (contractId: string, receiptId: string) => void;
  backToList: () => void;
}

export function buildImportTour(ctx: ImportTourContext): PageTour {
  const { pick, can } = ctx;
  const list = (s: TourStep): TourStep => ({ ...s, prepare: ctx.backToList });
  const dossier = (s: TourStep): TourStep => ({ ...s, prepare: () => pick && ctx.openDossier(pick.contractId, pick.receiptId) });

  const steps: TourStep[] = [
    list({
      id: "intro",
      title: "Giới thiệu trang Nhập khẩu",
      body:
        "Trang Nhập khẩu theo dõi hợp đồng nhập với nhà cung cấp nước ngoài và từng lần hàng về. Khác trang Nhập hàng (mua nguyên liệu trong nước).\n" +
        "Trình tự: lập hợp đồng (tên hàng, số lượng kg, đơn giá) → ghi lần nhập khi hàng sắp về → đính bộ chứng từ của lần nhập → thủ kho ghi số lượng thực nhập → đóng hợp đồng khi nhập xong.\n" +
        "Không có bước thanh toán và không có bước duyệt.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Esc để thoát.",
    }),
    list({
      id: "tabs",
      target: "import-tabs",
      title: "Lô nhập và Hợp đồng",
      body:
        "Lô nhập: các lần hàng về trong tháng đang xem, gom theo đối tác. Dùng hằng ngày để biết lô nào còn thiếu giấy.\n" +
        "Hợp đồng: mọi hợp đồng nhập, lọc theo Đang mở, Đã đóng, Đã hủy. Mỗi hợp đồng hiện số kg đã về so với hợp đồng.",
    }),
  ];
  if (can.create)
    steps.push(
      list({
        id: "create",
        target: "create-import-contract",
        optional: true,
        title: "Lập hợp đồng nhập",
        body:
          "Chọn Lập hợp đồng nhập, chọn đối tác trong danh mục NCC nhập khẩu (khác Đại lý của Nhập hàng; thêm mới ngay trong ô được), ghi số hợp đồng, ngày ký, loại hình (sản xuất xuất khẩu, kinh doanh hoặc gia công) và từng dòng hàng.\n" +
          "Mỗi dòng hàng chọn Mặt hàng (danh mục) để mọi khu cùng gọi một tên. Gõ tên hàng xong app tự gợi ý khi tên đã nối ở hợp đồng trước. Chưa nối vẫn lưu được.\n" +
          "Hàng gia công không ghi giá thì để trống đơn giá. Lưu xong hợp đồng ở trạng thái Chưa có lần nhập.",
      }),
    );
  steps.push(
    list({
      id: "month",
      target: "import-month",
      title: "Tháng đang xem",
      body: "Dùng ‹ › để sang tháng trước hoặc tháng sau, Nay để về tháng hiện tại. Lô được xếp vào tháng theo ngày về kho; chưa về thì theo ngày dự kiến về.",
    }),
    list({
      id: "stats",
      target: "import-stats",
      optional: true,
      title: "Ba con số của tháng",
      body:
        "Lô nhập của tháng: số lần hàng về (không tính lô đã hủy).\n" +
        "Đủ hồ sơ: lô có đủ 3 chứng từ bắt buộc (Invoice, Packing List, tờ khai nhập) và đã ghi thực nhập.\n" +
        "Còn thiếu: lô Thiếu chứng từ hoặc Chờ thực nhập — đây là việc cần làm tiếp.",
    }),
    list({
      id: "search",
      target: "import-search",
      title: "Tra số chứng từ",
      body: "Gõ số hợp đồng, số invoice, số tờ khai, số cont hoặc số B/L để tìm lô ở mọi tháng. Chọn Mở để vào hồ sơ hợp đồng, tới đúng lần nhập.",
    }),
    list({
      id: "receipts",
      target: "import-receipts",
      optional: true,
      title: "Trạng thái từng lô",
      body:
        "Thiếu chứng từ: lô chưa đủ 3 chứng từ bắt buộc; dòng Còn thiếu ghi tên chứng từ còn thiếu.\n" +
        "Chờ thực nhập: chứng từ đã đủ, thủ kho chưa ghi số kg thực nhập.\n" +
        "Đủ hồ sơ: đủ chứng từ và đã có thực nhập.",
    }),
  );
  if (pick) {
    steps.push(
      dossier({
        id: "dossier-head",
        target: "import-contract-head",
        title: "Hồ sơ hợp đồng",
        body:
          "Đầu hồ sơ có trạng thái hợp đồng: Chưa có lần nhập → Đang nhập → Đã đóng (hoặc Đã hủy).\n" +
          "Nút chính là việc tiếp: Ghi lần nhập khi hợp đồng đang mở, Mở lại hợp đồng khi đã đóng. Thao tác khác có Sửa, Đóng, Hủy, Xóa hợp đồng.",
      }),
      dossier({
        id: "lines",
        target: "import-lines",
        title: "Dòng hàng và số còn lại",
        body:
          "Mỗi dòng hàng có mặt hàng đã nối, kg theo hợp đồng, số đã về (cộng các lần nhập chưa hủy) và số còn lại. Về nhiều hơn hợp đồng thì hiện vượt bao nhiêu kg, vẫn lưu được.\n" +
          "Dòng hiện Chưa nối thì vào Thao tác khác → Sửa hợp đồng để chọn mặt hàng. Còn dòng chưa nối thì chưa đóng được hợp đồng.",
      }),
      dossier({
        id: "docs",
        target: "import-receipt-docs",
        optional: true,
        title: "Chứng từ của lần nhập",
        body:
          "Mỗi lần nhập có sẵn 3 chứng từ bắt buộc: Commercial Invoice, Packing List, tờ khai nhập khẩu. Một chứng từ xong khi đã đính file; tờ khai cần thêm số tờ khai và loại hình.\n" +
          "Lô không có một chứng từ bắt buộc thì chọn Không áp dụng và ghi lý do.\n" +
          "C/O, giấy kiểm dịch, B/L và chứng từ khác: có thì chọn Thêm chứng từ, không bắt buộc.",
      }),
      dossier({
        id: "quantity",
        target: "import-receipt-quantity",
        optional: true,
        title: "Thực nhập",
        body:
          "Hàng về kho thì thủ kho (hoặc nhân viên Kế hoạch) chọn Ghi thực nhập và ghi số kg của từng dòng hàng theo invoice.\n" +
          "Ghi xong và chứng từ đủ thì lô thành Đủ hồ sơ. Mọi dòng về đủ và đã nối mặt hàng thì đóng hợp đồng; còn thiếu kg vẫn đóng được nhưng phải ghi lý do.",
      }),
    );
  }
  return { title: "Nhập khẩu", steps, onExit: ctx.backToList };
}

export const tourSpec: PageTourSpec = {
  pageId: "planning-import",
  build: () =>
    buildImportTour({
      pick: { contractId: "c", receiptId: "r" },
      can: { create: true, update: true, receiving: true },
      openDossier: () => {},
      backToList: () => {},
    }),
};
