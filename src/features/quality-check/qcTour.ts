// ============================================================
// Tên file: src/features/quality-check/qcTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Kiểm tra QC — dựng các bước theo thứ tự công việc
// Description: QC checklist page tour (docs/app-map/43-guided-tour.ba-spec.md R1–R12). Order
//              follows the end-of-day QC work (họp 2026-09-02 QĐ-8): pick day + workshop → read
//              status → score each criterion → save → lock day. Single view, nothing is written (R1).
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface QcTourContext {
  can: {
    /** Chấm / sửa bảng kiểm của (ngày × xưởng) đang chọn. */
    write: boolean;
    /** Chốt ngày QC. */
    lock: boolean;
    /** Mở lại ngày QC đã chốt. */
    unlock: boolean;
  };
}

/** Dựng các bước theo thứ tự công việc (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildQcTour(ctx: QcTourContext): PageTour {
  const { can } = ctx;
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Kiểm tra QC",
      body:
        "Trang Kiểm tra QC là bảng kiểm chất lượng cuối ngày của từng phân xưởng: QC / kỹ thuật chấm nhanh từng chỉ tiêu (vệ sinh nhà xưởng, dụng cụ, thiết bị…) thay cho báo cáo viết văn xuôi, rồi chốt ngày. Quản đốc, tổ trưởng và kỹ thuật dùng; ban giám đốc xem kết quả.\n" +
        "QC đi kèm khâu sản xuất trong chuỗi nhập hàng → sản xuất → kho → bán / xuất: kiểm điều kiện nơi nguyên liệu được chế biến mỗi ngày.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "filter",
      target: "qc-filter",
      title: "Ngày kiểm và phân xưởng",
      body:
        "Chọn Ngày kiểm và Phân xưởng (Đông · Cá · Khô). Mỗi ngày của mỗi xưởng là một bảng kiểm riêng; đổi ngày hoặc xưởng thì bảng nạp lại số đã lưu.\n" +
        "Chọn ngày trước hôm nay là ghi bù cho ngày cũ — phải ghi lý do.\n" +
        "Quản đốc chỉ chấm được xưởng mình; xưởng khác hiện dòng “Bạn chỉ ghi được xưởng … — xưởng … chỉ xem.”.",
    },
    {
      id: "status",
      target: "qc-status",
      title: "Trạng thái ngày",
      body:
        "Dòng “‹ngày› · xưởng ‹X›” kèm nhãn trạng thái:\n" +
        "• Chưa chốt: còn chấm, sửa bình thường.\n" +
        "• Đã chốt: bảng kiểm ngày này đã khóa, không thêm hay bỏ ảnh được. Muốn sửa kết quả thì ghi Lý do ghi bù rồi lưu, hoặc mở lại ngày.\n" +
        "“Đã chấm a/b · Đạt c · Không đạt d”: a là số chỉ tiêu đã chọn kết quả trên b chỉ tiêu của bảng, tính theo phiếu đang chấm (kể cả chưa lưu).",
    },
    {
      id: "trend",
      target: "qc-trend",
      optional: true,
      title: "30 ngày gần đây",
      body:
        "Biểu đồ cột số chỉ tiêu Đạt · Tạm (cần khắc phục) · Không đạt mỗi ngày, của xưởng đang chọn, trong 30 ngày tính tới ngày đang xem. Chỉ hiện khi đã có kết quả.\n" +
        "Dùng để xem chất lượng của xưởng có đi xuống không.",
    },
  ];

  if (can.write) {
    steps.push({
      id: "backdate",
      target: "qc-backdate",
      optional: true,
      title: "Lý do ghi bù",
      body:
        "Ô này hiện khi chấm cho ngày trước hôm nay hoặc khi ngày đã chốt, và bắt buộc.\n" +
        "Thiếu lý do thì không lưu được: trang báo “Ghi cho ngày cũ — nhập lý do ghi bù” hoặc “Ngày đã chốt — nhập lý do ghi bù để sửa”.",
    });
  }

  steps.push({
    id: "criteria",
    target: "qc-criteria",
    title: "Chỉ tiêu và kết quả",
    body: can.write
      ? "Bảng có sẵn 10 chỉ tiêu (Vệ sinh nhà xưởng, Vệ sinh dụng cụ sản xuất, Thiết bị / máy móc, Bảo hộ lao động, Nhiệt độ kho lạnh… tới Hồ sơ ghi chép). Mỗi chỉ tiêu:\n" +
        "• Kết quả: Đạt · Cần khắc phục · Không đạt. Chỉ tiêu chưa chọn kết quả thì không được lưu.\n" +
        "• Điểm (tùy chọn): nếu xưởng chấm theo thang 10 thì 7–10 đạt, 5–7 tạm, dưới 5 không đạt. Máy không tự đổi điểm ra kết quả — vẫn chọn Kết quả.\n" +
        "• Ghi chú: mô tả việc cần sửa khi Cần khắc phục hoặc Không đạt.\n" +
        "• Ảnh minh chứng: Chụp / chọn ảnh (khi có kho ảnh trên máy chủ); ngày đã chốt thì không thêm, bỏ ảnh được."
      : "Người chỉ xem thấy danh sách chỉ tiêu đã chấm, mỗi chỉ tiêu một nhãn kết quả Đạt · Cần khắc phục · Không đạt, kèm điểm, ghi chú và ảnh nếu có.\n" +
        "Ngày chưa ai chấm thì hiện “Chưa chấm QC ngày này”.",
  });

  if (can.write) {
    steps.push(
      {
        id: "add-criterion",
        target: "qc-add-criterion",
        optional: true,
        title: "Thêm chỉ tiêu khác",
        body:
          "Cần kiểm thêm việc ngoài bộ có sẵn thì gõ tên vào ô Thêm chỉ tiêu khác rồi chọn Thêm chỉ tiêu (hoặc Enter). Trùng tên thì trang báo chỉ tiêu đã có.\n" +
          "Chỉ tiêu mới nằm trong bảng kiểm của ngày đang chấm; chấm kết quả rồi lưu thì lần sau mở ngày đó vẫn còn.",
      },
      {
        id: "save",
        target: "qc-save",
        optional: true,
        title: "Lưu chấm điểm",
        body:
          "Chọn Lưu chấm điểm để ghi mọi chỉ tiêu đã chọn kết quả vào sổ QC của ngày và xưởng đang chọn. Chưa chấm chỉ tiêu nào thì trang nhắc chọn ít nhất một kết quả.\n" +
          "Phiếu đang chấm tự lưu nháp trên máy: sang trang khác hay tải lại vẫn còn, kèm dải “Đã mở lại phiếu đang gõ dở”. Nháp không tự vào sổ.",
      },
    );
  }

  if (can.lock || can.unlock) {
    const lines: string[] = [];
    if (can.lock)
      lines.push(
        "Chấm và lưu xong thì chọn Chốt ngày để khóa sổ QC của ngày · xưởng. Chỉ chốt được khi đã lưu ít nhất một chỉ tiêu; nhãn chuyển thành Đã chốt.",
      );
    if (can.unlock)
      lines.push("Ngày đã chốt có nút Mở lại ngày để mở khóa, chấm bù hoặc sửa. Sửa xong nhớ chốt lại.");
    steps.push({
      id: "lock-action",
      target: "qc-lock-action",
      optional: true,
      title: "Chốt ngày và mở lại ngày",
      body: lines.join("\n"),
    });
  }

  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body: "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác. Hộp đó cũng có bản tóm tắt các việc trên trang.",
  });

  return { title: "Kiểm tra QC", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "qc",
  build: () => buildQcTour({ can: { write: true, lock: true, unlock: true } }),
};
