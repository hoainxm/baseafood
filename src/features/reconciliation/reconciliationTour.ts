// ============================================================
// Tên file: src/features/reconciliation/reconciliationTour.ts
// Tên tiếng Việt: Hướng dẫn từng bước của trang Đối soát hóa đơn điện tử
// Description: Reconciliation page tour (docs/app-map/43-guided-tour.ba-spec.md R1–R12): steps follow
//              the work order of doc 37 (load file → threshold → saved runs → pick what to check →
//              results → save / export). Result areas only exist after a run, so they are optional;
//              with no result yet a single centred step explains what will appear. Nothing is written.
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface ReconciliationTourContext {
  /** Đã chạy đối soát (có kết quả trên màn). */
  hasResult: boolean;
  can: {
    /** Chọn file + chạy đối soát (`reconciliation.create`). */
    create: boolean;
    /** Lưu bản đối soát (tạo mới = create, cập nhật bản đang mở = update). */
    save: boolean;
    /** Tải Excel kết quả (`reconciliation.export`). */
    export: boolean;
  };
}

/** Dựng các bước theo thứ tự công việc (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildReconciliationTour(ctx: ReconciliationTourContext): PageTour {
  const { hasResult, can } = ctx;
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Đối soát hóa đơn điện tử",
      body:
        "Trang dành cho kế toán: đối chiếu hóa đơn mua vào tải từ cổng thuế với sổ phần mềm kế toán, để bắt hóa đơn chưa vào sổ, lệch tiền, lệch thuế.\n" +
        "Trang thuộc khâu kế toán, đi cạnh chuỗi nhập hàng → sản xuất → kho → bán / xuất: hóa đơn mua nguyên liệu, vật tư, dịch vụ vào sổ đủ và đúng tiền thì số chốt cuối kỳ mới đúng.\n" +
        "Mọi số lấy từ một file Excel bạn tải lên. Trang không đọc và không sửa sổ của xưởng; máy chỉ báo chỗ nghi sai, không tự sửa số.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "file",
      target: "reconciliation-file",
      title: "Tải file và chạy đối soát",
      body:
        "File Excel cần ít nhất một sheet hóa đơn điện tử của cổng thuế (có mã, máy tính tiền, không mã). Có thêm sheet sổ kế toán (PHẦN MỀM) thì đối chiếu được với sổ; có hai bản hóa đơn (bản thuế gửi và bản tự tải) thì so được hai bản.\n" +
        (can.create
          ? "• Chọn file Excel (.xlsx hoặc .xls), rồi chọn Đối soát. Máy chạy một lần rồi cho xem theo việc cần soát. Chọn file khác thì kết quả cũ được xóa khỏi màn.\n"
          : "• Tài khoản của bạn chỉ được xem: không có nút Chọn file Excel và Đối soát. Mở bản đối soát đã lưu ở mục Bản đã lưu bên dưới.\n") +
        "• Tải file mẫu: file đúng định dạng chuẩn để làm theo; file khác vẫn đọc được.\n" +
        "• Máy ghép hóa đơn với sổ theo MST người bán · ký hiệu · số hóa đơn.",
    },
    {
      id: "threshold",
      target: "reconciliation-threshold",
      title: "Ngưỡng khớp",
      body:
        "Chênh giữa hóa đơn và sổ nhỏ hơn hoặc bằng ngưỡng vẫn tính là Khớp, để bỏ qua sai số làm tròn. Mặc định 1 đ; để trống là 0 đ.\n" +
        "Đổi ngưỡng thì kết quả trên màn tính lại ngay. Bản lưu giữ đúng ngưỡng đã dùng, mở lại ra đúng kết quả cũ.",
    },
    {
      id: "saved-runs",
      target: "reconciliation-saved-runs",
      title: "Bản đã lưu",
      body:
        "Danh sách các lần đối soát đã lưu của tài khoản bạn (quản trị viên xem được của mọi người, có thêm cột Người lưu). Bản đang mở có chữ \"(đang mở)\".\n" +
        "• Trạng thái Nháp: còn sửa tiếp được. Chính thức: tóm tắt kết quả lúc lưu được giữ cố định để đối chiếu về sau.\n" +
        "• Cột Kết quả (lúc lưu): số hóa đơn khớp · lệch · chưa vào sổ tại lúc lưu.\n" +
        "• Mở lại: máy chạy lại trên chính file gốc đã lưu, cùng ngưỡng và các chỗ đã sửa. Tải Excel và Xóa chỉ hiện khi bạn có quyền; xóa phải xác nhận và còn Hoàn tác.",
    },
  ];

  if (!hasResult) {
    steps.push({
      id: "result-overview",
      title: "Kết quả đối soát",
      body:
        "Chạy đối soát xong, trang hiện mục \"Bạn cần soát việc gì?\" với 4 kiểu xem trên cùng một lần chạy: Hóa đơn ⇄ sổ kế toán · So hai bản hóa đơn · Kiểm cộng cột bảng kê · Cùng MST cùng ngày.\n" +
        "Ở kiểu Hóa đơn ⇄ sổ kế toán, mỗi hóa đơn mang một kết quả: Khớp · Lệch tiền · Lệch thuế · Chưa vào sổ · Không cần vào sổ (hóa đơn đã bị thay thế hoặc hủy). Mỗi dòng sổ mang Đã có hóa đơn hoặc Chưa có hóa đơn.\n" +
        "Chỗ nghi sai nằm ở mục Chỗ cần soát lại; máy không tự sửa, bạn tự chọn Sửa từng dòng.",
    });
  } else {
    steps.push(
      {
        id: "modes",
        target: "reconciliation-modes",
        title: "Bạn cần soát việc gì",
        body:
          "Máy chạy một lần, rồi cho xem theo một trong 4 việc. Chọn ô của việc cần soát; ô đang xem có chữ \"Đang xem\".\n" +
          "• Hóa đơn ⇄ sổ kế toán: hóa đơn nào chưa vào sổ, lệch tiền, lệch thuế; dòng sổ nào không có hóa đơn.\n" +
          "• So hai bản hóa đơn: bản cơ quan thuế gửi ⇄ bản kế toán tự tải.\n" +
          "• Kiểm cộng cột bảng kê: chưa thuế + thuế có bằng tổng thanh toán không.\n" +
          "• Cùng MST cùng ngày: một người bán xuất nhiều hóa đơn trong một ngày.\n" +
          "Dòng dưới mỗi ô là số cần soát, hoặc lý do chưa dùng được kiểu đó (vd file không có sheet sổ kế toán). Kiểu mặc định theo file: có sổ thì Hóa đơn ⇄ sổ kế toán; có hai bản thì So hai bản hóa đơn; còn lại thì Kiểm cộng cột bảng kê.",
      },
      {
        id: "rules",
        target: "reconciliation-rules",
        title: "Quy tắc máy đang áp dụng",
        body:
          "Chọn dòng này để mở danh sách quy tắc máy dùng để ghép và kết luận. Mấy quy tắc hay gặp:\n" +
          "• So đủ 3 cột: tổng lệch là Lệch tiền; tổng khớp mà thuế lệch là Lệch thuế; chỉ tiền trước thuế lệch vẫn là Khớp (thường do chiết khấu, phí).\n" +
          "• Ngoại tệ: máy tự dò file để tiền ở nguyên tệ (phải nhân tỷ giá) hay đã quy sẵn VND, bằng cách so với hóa đơn đã khớp sổ. Không mặc định nhân; thiếu tỷ giá thì máy báo.\n" +
          "• Làm tròn: lệch ±1 đ là làm tròn, không phải sai.\n" +
          "Phần cuối ghi máy đã kết luận gì về ngoại tệ của chính file này.",
      },
      {
        id: "ledger-cards",
        target: "reconciliation-ledger-cards",
        optional: true,
        title: "Thẻ số của kiểu Hóa đơn ⇄ sổ kế toán",
        body:
          "• Hóa đơn điện tử: số hóa đơn đọc được ở các sheet hóa đơn.\n" +
          "• Khớp: có trong sổ, chênh không quá ngưỡng.\n" +
          "• Lệch tiền / thuế: có trong sổ nhưng tổng hoặc thuế lệch quá ngưỡng; dòng phụ tách số lệch tiền và lệch thuế.\n" +
          "• Chưa vào sổ: không thấy trong sổ; dòng phụ ghi số hóa đơn không cần vào sổ và số gần khớp (sổ có dòng cùng MST, cùng số tiền, nghi gõ sai số hóa đơn).\n" +
          "• Dòng sổ kế toán · Dòng sổ thiếu hóa đơn: chiều ngược lại, dòng sổ không tìm được hóa đơn.\n" +
          "• Tổng tiền lệch: cộng phần chênh ở các hóa đơn lệch tiền. Cần soát lại: số chỗ nghi sai.\n" +
          "Chọn một thẻ để xuống thẳng danh sách đã lọc sẵn. File không có sheet sổ kế toán thì mọi hóa đơn hiện Chưa vào sổ — chọn kiểu khác ở trên.",
      },
      {
        id: "suspects",
        target: "reconciliation-suspects",
        optional: true,
        title: "Chỗ cần soát lại",
        body:
          "Chỗ máy nghi sai trong file, chia theo nhóm: Cộng không khớp · Thiếu ô chưa thuế/thuế · Gần khớp · Thiếu cả cụm · Tổng bị xóa · Cột quy đổi phụ · Sheet trùng lặp. Mỗi dòng ghi vị trí ô, số đang có, số đối chứng và nguồn, sai ở chỗ nào, ảnh hưởng nếu sửa.\n" +
          "Máy KHÔNG tự sửa số. " +
          (can.save
            ? "Chọn Sửa để dùng số đối chứng trong phiên này; giá trị cũ được giữ và ghi vào file xuất. Chọn Hoàn tác để trả về như file gốc. Dòng \"chưa xác định\" là chỗ máy không biết số đúng, bạn mở hóa đơn gốc ra soát."
            : "Dòng \"chưa xác định\" là chỗ máy không biết số đúng, phải mở hóa đơn gốc ra soát."),
      },
      {
        id: "sheet-tables",
        target: "reconciliation-tables",
        optional: true,
        title: "Bảng theo từng sheet",
        body:
          "Mỗi sheet của file là một tab. Sheet hóa đơn: cột Kết quả là Khớp · Lệch tiền · Lệch thuế · Chưa vào sổ · Không cần vào sổ; cột Chênh = hóa đơn − sổ; cột Bằng chứng đối chiếu ghi khớp với phiếu nào, ngày, số tiền. Lọc nhanh bằng các nút Tất cả · Khớp · Lệch tiền / thuế · Chưa vào sổ.\n" +
          "Sheet sổ kế toán: Đã có hóa đơn hoặc Chưa có hóa đơn. Sheet ghi \"(phụ)\" là một phần của sổ chính, không cộng vào tổng để khỏi đếm hai lần. Có nhiều sheet sổ thì chọn bản CHUẨN ở phần tải file.",
      },
      {
        id: "self-check",
        target: "reconciliation-self-check",
        optional: true,
        title: "Máy tự kiểm tra và đối chiếu số liệu",
        body:
          "Máy chạy các phép tính đối chứng để chắc kết quả không sai. Mỗi phép ghi Đáng lẽ (số đúng phải ra) và Thực tế (số máy tính được): bằng nhau là Đạt, khác là Không đạt.\n" +
          "Phần Kiểm tra tổng số tiền chưa vào sổ tính hai cách (tổng hóa đơn trừ phần đã khớp, và cộng thẳng hóa đơn chưa vào sổ); hai cách phải bằng nhau.\n" +
          "Khối này gập sẵn khi mọi phép Đạt (\"✓ đã tự kiểm, khớp\"); có phép Không đạt thì tự mở để bạn xem.",
      },
      {
        id: "two-version",
        target: "reconciliation-two-version",
        optional: true,
        title: "So hai bản hóa đơn",
        body:
          "Đầu khung: từng sheet được xếp vào bên Thuế gửi hoặc Tự tải. Máy tự nhận theo chữ \"thuế\" hoặc chữ \"tải\" trong tên sheet; nhận sai thì chọn lại từng sheet, chọn Để máy tự nhận để bỏ lựa chọn tay.\n" +
          "Kết quả từng hóa đơn: Chỉ bản thuế có (bản tự tải thiếu) · Chỉ bản tự tải có · Lệch tiền (có cả hai, tiền khác nhau) · Không so được tiền (sheet trộn hai bố cục cột) · Khớp.",
      },
      {
        id: "column-sum",
        target: "reconciliation-column-sum",
        optional: true,
        title: "Kiểm cộng cột bảng kê",
        body:
          "Mỗi sheet một khung: tổng thanh toán − (chưa thuế + thuế) = phần lệch, có ghi chữ cột như trong file. Thẻ đầu khung: Cộng khớp · n dòng lệch thật · Lệch bình thường.\n" +
          "Phần lệch được bóc theo nguyên nhân từng dòng: có phí — bình thường · có chiết khấu — bình thường · làm tròn ±1đ — bình thường · LỆCH THẬT — phải soát. Dòng Lệch thật là chỗ phải mở hóa đơn gốc ra sửa; chọn Chỉ lệch thật hoặc Mọi dòng lệch để lọc.\n" +
          "Kế toán có tự đặt ô tính lệch dưới bảng thì máy nhận ra và ghi ô đó gồm những dòng nào.",
      },
      {
        id: "same-day",
        target: "reconciliation-same-day",
        optional: true,
        title: "Cùng MST cùng ngày",
        body:
          "Các nhóm hóa đơn cùng người bán trong cùng một ngày. Nhiều hóa đơn một ngày chưa chắc là sai (xăng dầu, siêu thị, phí ngân hàng…).\n" +
          "Thẻ Nhóm trùng khít số tiền là nhóm có hóa đơn trùng đúng số tiền, dễ bị kê hai lần: soát nhóm này trước.",
      },
    );
    if (can.save) {
      steps.push({
        id: "save-run",
        target: "reconciliation-save",
        optional: true,
        title: "Lưu bản đối soát",
        body:
          "Đặt tên bản rồi chọn Lưu nháp hoặc Lưu chính thức. Bản lưu gồm file gốc, ngưỡng, các chỗ đã Sửa, cách chia hai bản và kiểu đang xem.\n" +
          "Đang mở một bản đã lưu thì Lưu là cập nhật chính bản đó, không tạo bản mới. Chưa đăng nhập máy chủ thì bản lưu chỉ nằm trên máy này.",
      });
    }
    if (can.export) {
      steps.push({
        id: "export",
        target: "reconciliation-export",
        optional: true,
        title: "Tải Excel kết quả",
        body:
          "Trả về chính file bạn đã tải lên, giữ nguyên định dạng và địa chỉ ô. File có sổ thì thêm cột KẾT QUẢ ở đầu, các cột phân tích ở cuối và tô màu từng dòng; file không có sổ thì không chèn cột, chỉ tô dòng có lệch. Sheet KẾT LUẬN CHUNG đứng đầu file, trả lời bằng đúng ô của kế toán.\n" +
          "Mỗi lần tải là một file mới, tên có thêm \"đã đối soát\" kèm ngày giờ, không đè file cũ. Các chỗ đã Sửa đi vào file, kèm giá trị cũ.",
      });
    }
  }

  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để trở về đúng màn hình đang xem trước khi bắt đầu.\n" +
      "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
  });
  return { title: "Đối soát hóa đơn điện tử", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền, đã có kết quả. */
export const tourSpec: PageTourSpec = {
  pageId: "reconciliation",
  build: () => buildReconciliationTour({ hasResult: true, can: { create: true, save: true, export: true } }),
};
