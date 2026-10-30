// ============================================================
// Tên file: src/features/imports/importsTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Nhập hàng — dựng các bước theo thứ tự công việc
// Description: Imports page tour (docs/app-map/43-guided-tour.ba-spec.md R1–R12). Steps follow
//              the daily work order of docs/app-map/30-nhap-hang.md: shipment header → lines →
//              save → day list → scrap → lock day → reports. Steps only switch the view mode
//              (Ghi nhập / Tổng hợp / Sổ chi tiết) — nothing is written (R1).
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

/** Chế độ xem của màn Nhập hàng (state `mode` của MaterialImportScreen). */
export type ImportsView = "entry" | "report" | "ledger" | "invoices";

export interface ImportsTourContext {
  can: {
    /** Ghi chuyến mới (phiếu Ghi nhập hiện). */
    create: boolean;
    /** Sửa chuyến / đổi loại hàng loạt. */
    update: boolean;
    /** Chốt ngày. */
    lock: boolean;
    /** Mở lại ngày đã chốt. */
    unlock: boolean;
    /** Tab Hóa đơn đại lý (imports.invoices Xem) — ba-spec 51. */
    invoices?: boolean;
    /** Nạp / gắn / xử lệch hóa đơn (imports.invoices Thêm hoặc Sửa). */
    invoicesWrite?: boolean;
  };
  /** Máy có bộ đọc ảnh phiếu (nút Đọc ảnh phiếu hiện). */
  hasOcr: boolean;
  /** Chế độ đang xem lúc dựng tour — bước cuối trả trang về đây (R5). */
  startView: ImportsView;
  /** Đổi chế độ xem (chỉ đổi chỗ xem, không ghi). */
  showView: (view: ImportsView) => void;
}

/** Dựng các bước theo thứ tự công việc (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildImportsTour(ctx: ImportsTourContext): PageTour {
  const { can } = ctx;
  // Mỗi chỗ xem MỘT hàm prepare (GuidedTour so hàm để dò trước bước tùy chọn cùng chỗ xem).
  const toEntry = () => ctx.showView("entry");
  const toReport = () => ctx.showView("report");
  const toLedger = () => ctx.showView("ledger");
  const toInvoices = () => ctx.showView("invoices");
  const restore = () => ctx.showView(ctx.startView);
  const entry = (s: TourStep): TourStep => ({ ...s, prepare: toEntry });
  const report = (s: TourStep): TourStep => ({ ...s, prepare: toReport });
  const ledger = (s: TourStep): TourStep => ({ ...s, prepare: toLedger });
  const invoices = (s: TourStep): TourStep => ({ ...s, prepare: toInvoices });

  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Nhập hàng",
      body:
        "Trang Nhập hàng là sổ nguyên liệu mua về xưởng mỗi ngày, thay tờ giấy “Báo cáo tổng hợp nguyên liệu hàng ngày”. Thủ kho hoặc tổ trưởng ghi từng chuyến hàng; kế toán xem báo cáo và chốt số.\n" +
        "Đây là khâu đầu của chuỗi nhập hàng → sản xuất → kho → bán / xuất: số kg ở đây được màn Cân đối và sổ tồn nguyên liệu lấy sang, nên phải ghi đúng ngày hàng về và chốt ngày khi xong.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    entry({
      id: "mode-tabs",
      target: "imports-mode-tabs",
      title: "Ghi nhập và Báo cáo",
      body:
        "Ghi nhập: phiếu ghi chuyến hàng đang về, bên cạnh là các chuyến đã ghi trong ngày, phế liệu và chốt ngày. Dùng hằng ngày.\n" +
        "Báo cáo: chỉ để xem, gồm hai phần — Tổng hợp theo kỳ (tổng nhập gom theo đại lý × loại nguyên liệu) và Sổ chi tiết các chuyến (tra từng chuyến theo ngày, đại lý, loại, chưa có giá).",
    }),
    entry({
      id: "daily-reminder",
      target: "imports-daily-reminder",
      optional: true,
      title: "Việc hôm nay",
      body:
        "Dải này nhắc việc của hôm nay theo xưởng đang ghi:\n" +
        "• “Việc hôm nay: …” — sổ nhập hôm nay của xưởng chưa chốt. Ghi đủ các chuyến rồi chốt ngày ở khối Cuối ngày.\n" +
        "• “Hôm nay đã chốt — …” — sổ hôm nay đã khóa; hàng về thêm thì ghi bù kèm lý do.\n" +
        "Ngày nhập chưa chốt cũng hiện ở trang Việc của tôi, tính quá hạn từ hôm sau.",
    }),
  ];

  if (can.create) {
    steps.push(
      entry({
        id: "shipment-header",
        target: "imports-shipment-header",
        optional: true,
        title: "Đầu chuyến",
        body:
          "Một chuyến là một đại lý giao một lượt. Đại lý giao hai lượt trong ngày thì ghi hai chuyến riêng.\n" +
          "• Ngày hàng về, Phân xưởng (mặc định Đông) và Đại lý giao hàng là bắt buộc. Đại lý chưa có thì gõ tên mới để thêm vào danh mục; bút chì cạnh tên để sửa nhanh.\n" +
          "• Hay giao: các đại lý giao nhiều gần đây. Chọn một tên là bảng loại hàng tự điền loại và đơn giá theo lượt giao gần nhất, chỉ còn gõ số kg.\n" +
          "• Tài xế, Biển số xe, Ghi chú không bắt buộc. Hàng “Tài xế đã giao:” và “Xe đã chở:” điền nhanh từng ô riêng (một người lái được nhiều xe).\n" +
          "Đầu chuyến áp cho mọi dòng của chuyến: đổi ngày, đại lý hay xe ở đây là đổi cả chuyến.",
      }),
    );
    if (ctx.hasOcr) {
      steps.push(
        entry({
          id: "ocr",
          target: "imports-ocr",
          optional: true,
          title: "Đọc ảnh phiếu",
          body:
            "Có phiếu viết tay thì chọn Đọc ảnh phiếu rồi chụp hoặc chọn ảnh. Máy đọc ra ngày, đại lý, xưởng, xe và các dòng loại nguyên liệu kèm kg.\n" +
            "• Hộp kết quả để ảnh phiếu cạnh bảng đối chiếu: cột Trên phiếu là chữ máy chép y, cột Điền vào sổ là giá trị sẽ điền, kèm nhãn Khớp danh mục · Đã có trong sổ · Mới, kiểm kỹ · Chưa khớp, chọn tay.\n" +
            "• Dòng tổng so với tổng chân phiếu: Khớp hoặc Lệch.\n" +
            "• Bỏ tick ô đọc sai rồi chọn “Điền … ô đã chọn vào phiếu”. Số chỉ điền vào phiếu như bản nháp — soát lại rồi mới lưu. Riêng phế liệu đọc được thì nút Ghi phế liệu ghi thẳng vào sổ phế liệu của ngày.",
        }),
      );
    }
    steps.push(
      entry({
        id: "backdate",
        target: "imports-backdate",
        optional: true,
        title: "Ghi bù và lý do",
        body:
          "Hàng về hôm trước mà hôm nay mới ghi (thường do chờ hóa đơn) thì chọn “Ghi bù (hàng về ngày khác ngày ghi sổ)”. Phiếu tách hai ô: Ngày ghi sổ (ngày ghi vào máy) và Ngày hàng về xưởng (ngày xe đổ hàng thật).\n" +
          "• Mọi tổng ngày, kỳ cân đối và báo cáo tính theo Ngày hàng về xưởng.\n" +
          "• Ngày ghi sổ sau ngày hàng về là ghi bù; ngày ghi sổ không được trước ngày hàng về.\n" +
          "• Ghi bù, hoặc ghi vào ngày đã chốt, bắt buộc điền Lý do ghi bù. Chuyến đó mang nhãn Ghi bù trong sổ.\n" +
          "Hàng về đúng ngày ghi sổ thì chọn Gộp lại một ngày.",
      }),
      entry({
        id: "lines",
        target: "imports-lines",
        optional: true,
        title: "Loại hàng và số kg",
        body:
          "Mỗi loại hàng của chuyến một dòng: Loài → Loại nguyên liệu → Số lượng (kg) → Đơn giá. Chọn loài trước, ô loại nguyên liệu chỉ hiện loại của loài đó.\n" +
          "• Dòng điền sẵn ghi “Giá theo lượt dd/mm — khác thì sửa ô đơn giá”: đó là giá cũ của lượt trước, giá hôm nay khác thì sửa.\n" +
          "• Chưa có hóa đơn thì để trống Đơn giá: dòng mang nhãn Chưa có giá, điền sau.\n" +
          "• Dòng không gõ kg tự bỏ qua khi lưu. Enter ở ô kg nhảy xuống dòng dưới; Enter ở dòng cuối sang nút lưu.\n" +
          "• Thêm loại hàng: thêm một dòng ở cuối bảng.",
      }),
      entry({
        id: "lot",
        target: "imports-lot",
        optional: true,
        title: "Mã lô và SSCC",
        body:
          "Dòng “Mã lô … · SSCC” thu gọn sẵn, chọn để mở. Mã lô nội bộ tự sinh theo xưởng và ngày (VD Đ-260902-01), không phải gõ, dùng để truy xuất.\n" +
          "Mỗi loại nguyên liệu của chuyến là một lô: lưu chuyến xong, nút Tem in mỗi loại một tem QR (loại + kg) để dán đúng sọt; quét tem là ra hộ chiếu lô.\n" +
          "Mã SSCC (nhà nước) chưa được cấp thì để trống, điền sau.",
      }),
      entry({
        id: "save-bar",
        target: "imports-save-bar",
        optional: true,
        title: "Thanh lưu chuyến",
        body:
          "Dòng đầu nói đang lưu gì: “Chuyến mới · ‹đại lý›” hoặc “Sửa chuyến đã ghi · ‹đại lý›”; nhãn Chưa lưu khi đã có số mà chưa ghi vào sổ. Dòng sau là tổng kg · số loại (· tiền nếu được xem giá).\n" +
          "• “Chưa lưu được — còn thiếu: …” liệt kê việc còn thiếu: chọn đại lý, gõ số kg cho ít nhất một loại hàng, ghi lý do ghi bù. Lúc này nút lưu chỉ có viền; chọn vẫn được và trang chỉ ra chỗ thiếu.\n" +
          "• Đủ thông tin thì nút Lưu chuyến vào sổ chuyển xanh lá. Lưu xong, chuyến hiện ở khung “Đã ghi ngày” và phiếu trống mở ra cho chuyến kế (giữ ngày và xưởng, đại lý để trống).\n" +
          "• Đang sửa chuyến cũ thì nút là Lưu thay đổi chuyến, kèm Hủy sửa (và Xóa chuyến khi được cấp quyền).\n" +
          "Phiếu đang gõ tự lưu nháp trên máy: sang trang khác hay tải lại vẫn còn, kèm dải “Đã mở lại phiếu đang gõ dở”. Nháp không tự vào sổ.",
      }),
    );
  }

  steps.push(
    entry({
      id: "day-list",
      target: "imports-day-list",
      title: "Đã ghi trong ngày",
      body:
        "Khung “Đã ghi ngày ‹ngày› · xưởng ‹X›” bám theo ngày và xưởng của phiếu đang gõ: số chuyến và tổng kg của ngày, tính cả chuyến đang gõ.\n" +
        "• Mỗi chuyến: đại lý, kg, xe (hoặc Không ghi xe), số loại; nhãn Ghi bù khi ghi sau ngày hàng về.\n" +
        "• Sửa: mở lại chuyến lên phiếu để sửa — không có khi ngày đã chốt. Tem: in tem QR mỗi loại một tem.\n" +
        "• Báo cáo ngày: xem và in tờ báo cáo tổng hợp nguyên liệu A4 ngang của ngày. Phiếu trống: in tờ trống để ghi tay ngoài xưởng, sau nhập lại vào máy.",
    }),
    entry({
      id: "scrap",
      target: "imports-scrap",
      title: "Phế liệu cân cuối ngày",
      body:
        "Nội tạng, dạt cân gộp một lần cuối ngày cho cả xưởng và ghi ở khối Cuối ngày, ngay trên nút Chốt ngày.\n" +
        "• Chưa cân: ngày này chưa ghi phế liệu. Đã cân … kg: đã lưu vào sổ. Chưa lưu: có số đang gõ chưa ghi vào sổ.\n" +
        "• Gõ kg (và giá bán) vào ô Nội tạng, Dạt; loại khác thì chọn Loại khác. Chọn Lưu phế liệu để ghi; xóa số kg của dòng cũ rồi lưu là bỏ dòng đó. Chốt ngày cũng tự lưu số đang gõ.\n" +
        "• Chỉ ghi một lần ở đây — màn Cân đối lấy sang, không nhập lại. Ngày đã chốt hoặc người chỉ xem thì khối chỉ liệt kê số đã cân.",
    }),
    entry({
      id: "day-lock",
      target: "imports-day-lock",
      title: "Trạng thái chốt ngày",
      body:
        "Dòng này cho biết sổ nhập của ngày và xưởng đang ghi đã khóa chưa:\n" +
        "• Chưa chốt: còn ghi, sửa, xóa chuyến bình thường.\n" +
        "• Đã chốt: chuyến và phế liệu của ngày · xưởng đã khóa; “lúc chốt … kg” là tổng tại lúc chốt — con số đã gửi đi không bị đổi.\n" +
        "• “Còn ghi bù +… kg sau chốt”: sau khi chốt có chuyến ghi bù làm tổng đổi. Số này = tổng hiện tại − tổng lúc chốt; kế toán đối chiếu lại số đã gửi.\n" +
        "Tổng ngày luôn tính cả ngày của xưởng, không theo bộ lọc đang xem.",
    }),
  );

  if (can.lock || can.unlock) {
    const lines: string[] = [];
    if (can.lock) {
      lines.push(
        "Xem hết số trong ngày rồi mới chọn Chốt ngày. Hộp “Chốt số liệu ngày này?” hiện tổng và phế liệu sẽ lưu cùng lúc; chưa cân phế liệu thì cảnh báo, chọn “Quay lại cân phế liệu” hoặc “Chốt — không có phế liệu”. Có ô Ghi chú khi chốt.",
        "• Phiếu còn dòng chưa lưu thì hộp “Còn dòng nhập chưa lưu vào sổ” hỏi trước: “Lưu vào sổ rồi chốt”, “Vẫn chốt (bỏ dòng đang gõ)” hoặc “Quay lại nhập tiếp”.",
      );
    }
    lines.push(
      can.unlock
        ? "• Chốt xong muốn sửa chỉ có hai đường: ghi bù (bắt lý do) hoặc Mở lại ngày (bắt Lý do mở lại, giữ vết ai mở, vì sao). Sửa xong nhớ chốt lại."
        : "• Chốt xong muốn sửa thì ghi bù (bắt lý do), hoặc nhờ người được cấp quyền Mở lại ngày.",
    );
    steps.push(
      entry({
        id: "lock-action",
        target: "imports-lock-action",
        optional: true,
        title: "Chốt ngày và mở lại ngày",
        body: lines.join("\n"),
      }),
    );
  }

  steps.push(
    report({
      id: "report-period",
      target: "imports-report-filters",
      title: "Tổng hợp theo kỳ",
      body:
        "Báo cáo → Tổng hợp theo kỳ: chọn Kỳ báo cáo (Ngày, Tuần, Tháng, Năm, Khoảng tự chọn) và Phân xưởng (hoặc Tất cả xưởng).\n" +
        "Báo cáo chỉ để xem, không sửa số. Xuất Excel (khi được cấp quyền) tải đúng bảng đang xem, gồm hàng mua và phế liệu.",
    }),
    report({
      id: "report-summary",
      target: "imports-report-summary",
      title: "Số tổng của kỳ",
      body:
        "• Nhập mua: tổng kg nguyên liệu mua trong kỳ. Giá trị mua: tổng tiền (khi được xem giá).\n" +
        "• Chờ hóa đơn: kg của các dòng chưa có đơn giá — còn số này là còn hóa đơn phải đòi; cột Chờ giá (kg) ở bảng chỉ ra đại lý nào.\n" +
        "• Bên dưới: biểu đồ Nguyên liệu mua theo ngày và bảng gom Đại lý × Loại nguyên liệu.\n" +
        "• Phế liệu cân trong kỳ tách bảng riêng, không cộng vào giá trị nhập mua.",
    }),
    ledger({
      id: "ledger-filters",
      target: "imports-ledger-filters",
      title: "Sổ chi tiết — kỳ xem và bộ lọc",
      body:
        "Báo cáo → Sổ chi tiết các chuyến để tra từng chuyến đã ghi. Năm thẻ phía trên tính theo bộ lọc: Đang xem · Phân xưởng · Số chuyến · Số dòng · Tổng nhập.\n" +
        "• Kỳ xem sổ: Ngày, Tuần, Tháng, Năm hoặc Khoảng tự chọn; ngày lấy theo Ngày hàng về xưởng. Phân xưởng chọn Tất cả để xem cả ba xưởng.\n" +
        "• Bộ lọc thêm: Đại lý, Loại nguyên liệu, Trạng thái giá (Tất cả · Chưa có giá — khi được xem giá). Số trong ngoặc là số bộ lọc đang đặt; Bỏ hết bộ lọc để về đủ sổ.\n" +
        "Chọn Chưa có giá để gom các dòng còn chờ hóa đơn mà đòi giá.",
    }),
    ledger({
      id: "ledger-tools",
      target: "imports-ledger-tools",
      title: "In báo cáo và phiếu trống",
      body:
        "• Xem báo cáo (khi được cấp quyền): tờ báo cáo tổng hợp nguyên liệu in A4 ngang theo kỳ đang xem — mỗi ngày một khối, cuối có tổng cả kỳ; chỉ đọc, đổi được khoảng ngày ngay trong tờ.\n" +
        "• In phiếu trống: tờ trống cùng cột để ghi tay ngoài xưởng, sau nhập lại khớp từng dòng.",
    }),
  );
  if (can.update) {
    steps.push(
      ledger({
        id: "bulk-type-change",
        target: "imports-bulk-type-change",
        optional: true,
        title: "Đổi loại hàng loạt",
        body:
          "Đổi loại nguyên liệu cho nhiều chuyến một lượt (gõ nhầm loại cho cả loạt, tách size): chọn loại đang ghi, giới hạn khoảng ngày nếu cần, tick chuyến, chọn loại đích rồi đổi.\n" +
          "Chỉ đổi tên loại — không đổi kg, đơn giá, ngày hay chuyến; có Hoàn tác.",
      }),
    );
  }
  steps.push(
    ledger({
      id: "ledger-shipments",
      target: "imports-ledger-shipments",
      optional: true,
      title: "Từng chuyến trong sổ",
      body:
        "Mỗi chuyến một khối: Chuyến n · đại lý · ngày · xưởng, kèm các nhãn:\n" +
        "• Ghi bù dd/mm: ghi sổ ngày đó, sau ngày hàng về; dòng Lý do ghi bù ở dưới.\n" +
        "• Đã chốt: ngày của chuyến đã khóa, không có nút Sửa chuyến.\n" +
        "• Dữ liệu cũ: dòng ghi từ trước khi có chuyến, máy gom theo ngày + xưởng + đại lý + xe; không in tem được.\n" +
        "• Lô …, SSCC …: mã lô của chuyến và mã SSCC nếu có. Dòng Người ghi cho biết ai ghi chuyến.\n" +
        "Bảng dòng hàng chỉ đọc; đơn giá trống hiện Chưa có giá. Sửa chuyến đưa chuyến về Ghi nhập để sửa; In tem QR in mỗi loại một tem. Cuối sổ là Tổng khối lượng (và Tổng tiền hàng) theo bộ lọc. Tick ô đầu dòng để tô màu các dòng đã dò.",
    }),
  );
  if (can.invoices) {
    steps.push(
      invoices({
        id: "invoice-cards",
        target: "imports-invoice-cards",
        title: "Hóa đơn đại lý — việc còn lại",
        body:
          "Tab Hóa đơn (dành cho kế toán) gắn hóa đơn GTGT của đại lý vào đúng chuyến xưởng đã ghi. Hóa đơn có thể xuất cùng ngày hoặc vài ngày sau, một hóa đơn có thể gộp 2–3 chuyến. Máy ghép theo đại lý + ngày hàng về (cột “Ngày HĐ” của sổ chi tiết, không phải cột NGAY) + loại + số kg, và KHÔNG tự đổi số chuyến.\n" +
          "Chọn khoảng Ngày hàng về. Bốn thẻ đếm việc còn lại; chọn một thẻ để lọc bảng dưới, chọn lại để bỏ lọc:\n" +
          "• Chuyến chờ HĐ: chuyến đã ghi mà chưa gắn hóa đơn (hoặc mới gắn một phần loại).\n" +
          "• HĐ chưa có file: có số trong sổ kế toán, chưa nạp PDF.\n" +
          "• Lệch chưa xử: kg hoặc đơn giá trên hóa đơn khác sổ xưởng, chưa chọn cách xử.\n" +
          "• HĐ không có chuyến: sổ xưởng không có chuyến nào khớp.\n" +
          "Một khoảng ngày xong chứng từ khi cả bốn thẻ về 0.",
      }),
    );
    steps.push(
      invoices({
        id: "invoice-saved",
        target: "imports-invoice-saved",
        title: "Nạp file, kết quả từng dòng, cách xử",
        body:
          (can.invoicesWrite
            ? "Nạp ở khối Nạp sổ chi tiết NL + hóa đơn: chọn một lượt file Excel sổ chi tiết (xuất từ phần mềm kế toán) và các PDF hóa đơn; PDF nạp sau cũng được. Mã kế toán chưa biết (vd HONG-PHU, BT-1DANL) chọn đại lý / loại một lần. Xem trước rồi chọn Gắn hóa đơn vào chuyến; nạp lại không nhân đôi. Cảnh báo PDF: MST danh mục khác hóa đơn · PDF lệch sổ kế toán · PDF chưa có trong sổ kế toán. File đọc ngay trên máy này.\n"
            : "") +
          "Mỗi dòng là một loại hàng của một chuyến trên một hóa đơn. Cột Kết quả:\n" +
          "• Khớp — kg và giá bằng sổ xưởng. Đã cập nhật theo HĐ — đã đổi sổ xưởng theo hóa đơn.\n" +
          "• Lệch giá / Lệch kg — chọn Cập nhật theo HĐ (đổi số chuyến, Ghi chú dòng ghi vết “[Sửa theo HĐ …]”, ngày đã chốt ghi thêm “SAU KHI CHỐT NGÀY”, có Hoàn tác) hoặc Giữ số xưởng (bắt ghi lý do ⇒ Lệch đã giải trình).\n" +
          "• Không có chuyến — chọn Tạo chuyến từ HĐ (chuyến ghi bù, lý do điền sẵn “Theo HĐ …”) hoặc Không thuộc chuyến (hàng đông gửi kho lạnh, không đi qua Nhập hàng; Bỏ xếp để ghép lại).\n" +
          "• Chưa ánh xạ — mã kế toán chưa chọn đại lý / loại, nạp lại sau khi chọn.\n" +
          "Nhãn Không còn trong file: lần nạp sau không còn dòng đó, liên kết vẫn giữ. Mở file để xem PDF hóa đơn.",
      }),
    );
  }
  steps.push(
    {
      id: "outro",
      prepare: restore,
      title: "Hoàn tất hướng dẫn",
      body:
        "Chọn Hoàn tất để kết thúc; trang đã trở về đúng phần đang xem lúc bắt đầu.\n" +
        "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác. Hộp đó cũng có bản tóm tắt các việc trên trang.",
    },
  );

  // Thoát giữa chừng (Esc) cũng trả về chế độ xem lúc bắt đầu — chế độ là state, đường dẫn không giữ (R5).
  return { title: "Nhập hàng", steps, onExit: restore };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền, có bộ đọc ảnh phiếu. */
export const tourSpec: PageTourSpec = {
  pageId: "imports",
  build: () =>
    buildImportsTour({
      can: { create: true, update: true, lock: true, unlock: true, invoices: true, invoicesWrite: true },
      hasOcr: true,
      startView: "entry",
      showView: () => {},
    }),
};
