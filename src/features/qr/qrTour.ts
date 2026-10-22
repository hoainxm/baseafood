// ============================================================
// Tên file: src/features/qr/qrTour.ts
// Tên tiếng Việt: Hướng dẫn từng bước của trang Mã lô QR — chọn lô minh họa + dựng bước
// Description: QR page tour (docs/app-map/43-guided-tour.ba-spec.md R1–R12): picks a sample lot to
//              open its passport (like R4), then walks Tra lô → hộ chiếu (cân bằng kg, truy ngược /
//              xuôi, thu hồi) → Theo giai đoạn → In tem hàng loạt. Steps only change the URL (?lot=,
//              ?tab=); nothing is written. Business rules: docs/spec/qr-truy-xuat-lo.md §4.4, §6c–§6e.
// ============================================================
import type { TraceData } from "@/lib/lotTraceability";
import type { QrTab } from "@/lib/legacyUrls";
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

type TourTraceData = Pick<TraceData, "imports" | "wips" | "packagings" | "lotInputs" | "exportItems" | "lotDispatches">;

/**
 * Lô minh họa cho phần hộ chiếu (giá trị `?lot=`): mẻ BTP có cả nguồn (đã gắn lô NL) lẫn ngả ra
 * (đóng gói / lệnh xuất / bán) → mẻ BTP bất kỳ → lô NL → lô TP, mới nhất trước. Không có lô nào ⇒ null.
 */
export function pickTourLot(data: TourTraceData): string | null {
  const latest = <T>(xs: readonly T[], date: (x: T) => string) => [...xs].sort((a, b) => date(b).localeCompare(date(a)))[0];
  if (data.wips.length) {
    const hasBackward = new Set(data.lotInputs.filter((l) => l.outputKind === "W").map((l) => l.outputId));
    const hasForward = new Set([
      ...data.lotInputs.filter((l) => l.inputKind === "W").map((l) => l.inputId),
      ...data.exportItems.map((x) => x.wipId),
      ...(data.lotDispatches ?? []).filter((d) => d.lotKind === "W").map((d) => d.lotId),
    ]);
    const score = (id: string) => (hasBackward.has(id) ? 2 : 0) + (hasForward.has(id) ? 1 : 0);
    const best = Math.max(...data.wips.map((w) => score(w.id)));
    const w = latest(data.wips.filter((x) => score(x.id) === best), (x) => x.productionDate);
    return `W:${w.id}`;
  }
  if (data.imports.length) return `S:${latest(data.imports, (x) => x.deliveryDate).id}`;
  if (data.packagings.length) return `P:${latest(data.packagings, (x) => x.date).id}`;
  return null;
}

export interface QrTourContext {
  /** Giá trị `?lot=` mở hộ chiếu minh họa; null ⇒ phần hộ chiếu gói thành một lời giữa trang. */
  sampleLot: string | null;
  can: {
    /** In tem / In danh sách / Tải Excel thu hồi / tab In tem hàng loạt (quyền xuất của /qr). */
    print: boolean;
    /** Gắn lô ngay ở tab Theo giai đoạn (thêm / sửa ở /qr). */
    linkLots: boolean;
  };
  /** Đổi chỗ xem (chỉ đổi đường dẫn): tab Tra lô kèm lô, hoặc tab khác. */
  showTab: (tab: QrTab, lot?: string | null) => void;
}

/** Dựng các bước theo thứ tự công việc (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildQrTour(ctx: QrTourContext): PageTour {
  const { sampleLot, can } = ctx;
  const lookup = (s: TourStep): TourStep => ({ ...s, prepare: () => ctx.showTab("lookup", sampleLot) });
  const stages = (s: TourStep): TourStep => ({ ...s, prepare: () => ctx.showTab("stages") });
  const print = (s: TourStep): TourStep => ({ ...s, prepare: () => ctx.showTab("print") });

  const steps: TourStep[] = [
    lookup({
      id: "intro",
      title: "Giới thiệu trang Mã lô QR",
      body:
        "Trang Mã lô QR trả lời hai câu của truy xuất: lô này làm từ đâu, và đã đi đâu. Dùng khi kiểm tra hàng, khi khách hỏi nguồn gốc, khi phải thu hồi; tổ trưởng, thủ kho, QC và kế toán đều dùng được.\n" +
        "Trang nối cả chuỗi nhập hàng → sản xuất → kho → đóng gói → bán / xuất. Có 3 loại lô: Nguyên liệu (mỗi loại nguyên liệu của một chuyến nhập là một lô), Bán thành phẩm (mỗi mẻ sản xuất), Thành phẩm (mỗi phiếu đóng gói). Mã lô tự có, không phải gõ khi ghi sổ.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    }),
    lookup({
      id: "tabs",
      target: "qr-tabs",
      title: "Ba việc của trang",
      body:
        "• Tra lô: quét hoặc gõ mã lô để xem hộ chiếu của một lô.\n" +
        "• Theo giai đoạn: kiểm QR từng khâu trong một khoảng ngày — lô nào chưa in tem, chưa gắn lô, chờ duyệt, chưa quét kiểm.\n" +
        (can.print ? "• In tem hàng loạt: chọn nhiều lô theo ngày, xưởng, loại rồi in tem một lượt.\n" : "") +
        "Trên điện thoại, các nút ghi gọn là Tra lô · Giai đoạn" +
        (can.print ? " · In tem." : "."),
    }),
    lookup({
      id: "scan",
      target: "qr-scan",
      title: "Quét hoặc gõ mã lô",
      body:
        "Chọn Quét bằng camera rồi đưa tem QR vào khung; quét xong máy tự tra. Camera điện thoại thường quét tem cũng mở thẳng trang này.\n" +
        "Không có camera thì gõ mã in dưới QR vào ô Mã lô rồi chọn Tra. Mã dạng Đ-… là nguyên liệu, BĐ-… là bán thành phẩm, TĐ-… là thành phẩm; chữ Đ là xưởng Đông (xưởng Cá là C, xưởng Khô là K). Chuyến nhập cũ chưa có mã lô mang mã NĐ-…, vẫn tra được.\n" +
        "Gõ mã chuyến nhập thì máy liệt kê các loại nguyên liệu của chuyến để chọn đúng loại. Không thấy mã thì báo Không tìm thấy lô — lô bán thành phẩm, thành phẩm chỉ có khi mẻ hoặc phiếu đóng gói đã ghi vào sổ.",
    }),
  ];

  if (!sampleLot) {
    steps.push({
      id: "passport-overview",
      title: "Hộ chiếu lô",
      body:
        "Tra được một lô thì trang hiện hộ chiếu của lô đó, theo thứ tự:\n" +
        "• Lô này là gì: loại lô, nhãn, chi tiết, đã in tem chưa.\n" +
        "• Cân bằng khối lượng: kg của lô, các ngả đã đi, còn lại bao nhiêu.\n" +
        "• Truy ngược — lô này làm từ đâu, Truy xuôi — lô này đã đi đâu.\n" +
        "• Thu hồi — ai đã nhận hàng từ lô này.\n" +
        "Hiện chưa có lô nào trong sổ để minh họa. Lô có từ khi ghi chuyến ở Nhập hàng, mẻ ở Sản xuất, phiếu ở Đóng gói.",
    });
  } else {
    steps.push(
      lookup({
        id: "lot-summary",
        target: "qr-lot-summary",
        optional: true,
        title: "Lô này là gì",
        body:
          "Hướng dẫn đã mở hộ chiếu của một lô có sẵn để minh họa. Thẻ màu đầu tiên là loại lô: Nguyên liệu · Bán thành phẩm · Thành phẩm; cạnh đó là nhãn lô in trên tem. Bên dưới là chi tiết: mặt hàng hoặc loại nguyên liệu, kg, ngày, xưởng, đại lý, người ghi.\n" +
          "Trạng thái tem:\n" +
          "• Chưa in tem: lô chưa có lần in tem nào được ghi lại.\n" +
          "• Đã in N tem: kèm ngày và người in lần gần nhất.\n" +
          "• Nhãn đã đổi: chữ trên tem đang dán khác nhãn hiện tại (sửa ngày hoặc xưởng sau khi in). Quét tem cũ vẫn ra đúng lô; in lại nếu cần chữ khớp.\n" +
          "Lô nguyên liệu có mục \"Cùng chuyến — mỗi loại nguyên liệu là một lô\": các loại khác của cùng chuyến, chọn tên để sang lô đó; lô đang xem có thẻ Đang xem." +
          (can.print ? "\nIn tem: in lại tem của lô khi tem cũ bong hoặc mờ." : ""),
      }),
      lookup({
        id: "mass-balance",
        target: "qr-mass-balance",
        optional: true,
        title: "Cân bằng khối lượng",
        body:
          "• Cột đầu: kg của lô (Nhận vào với lô nguyên liệu, Sản xuất với lô bán thành phẩm, Đóng gói ra với lô thành phẩm).\n" +
          "• Đã đi: kg theo từng ngả đã gắn lô — đưa vào sản xuất, đóng gói, xuất, bán.\n" +
          "• Còn lại (theo hồ sơ lô) = kg của lô − các ngả đã đi. Số âm (chữ đỏ) là dùng quá số có: nghi gõ sai kg hoặc gắn nhầm lô.\n" +
          "• Tồn trong kho (sổ tồn): số của sổ tồn, trừ thêm cả hàng đã bán hoặc đóng gói mà chưa gắn lô (máy trừ lô cũ trước), nên có thể nhỏ hơn số còn lại.\n" +
          "Thanh màu chia 100% kg của lô theo nơi đã đi. Có lần gắn lô chưa ghi kg thì trang báo, và số còn lại chưa trừ phần đó.",
      }),
      lookup({
        id: "trace-backward",
        target: "qr-trace-backward",
        optional: true,
        title: "Truy ngược — lô này làm từ đâu",
        body:
          "Cây các lô đầu vào, nhiều tầng: thành phẩm → bán thành phẩm → nguyên liệu → đại lý, ngày về, kg đã dùng. Chọn nhãn một lô trong cây để mở hộ chiếu của lô đó.\n" +
          "Cây trống thì trang nói lý do và chỗ sửa: mẻ chưa gắn lô nguyên liệu (gắn ở Sản xuất thành phẩm, nút Gắn lô NL), phiếu đóng gói chưa gắn lô bán thành phẩm (ở Đóng gói, nút Gắn lô BTP). Lô nguyên liệu là đầu chuỗi.",
      }),
      lookup({
        id: "trace-forward",
        target: "qr-trace-forward",
        optional: true,
        title: "Truy xuôi — lô này đã đi đâu",
        body:
          "Cây các ngả ra: nguyên liệu → mẻ sản xuất → đóng gói → hàng rời xưởng. Lá cuối là Xuất theo đơn (dòng lệnh xuất), Bán lẻ (dòng bán) hoặc Bán nội địa (nguyên liệu bán thẳng).\n" +
          "Đây là phạm vi phải xét khi thu hồi. Chỉ tính các mối nối đã gắn lô: hàng bán mà chưa gắn lô thì chưa hiện ở đây.",
      }),
      lookup({
        id: "recall",
        target: "qr-recall",
        optional: true,
        title: "Thu hồi — ai đã nhận hàng từ lô này",
        body:
          "Đi hết cây truy xuôi, kể cả qua mẻ sản xuất và đóng gói trung gian: mỗi dòng là một ngả ra với khách, ngày, chứng từ, mặt hàng, kg, từ lô nào. Dòng tóm tắt ghi số ngả ra · số khách · tổng kg đã ghi.\n" +
          "Lô còn trong xưởng: các lô bán thành phẩm, thành phẩm làm từ lô này còn tồn, cần khoanh lại.\n" +
          "Lô nguyên liệu cùng chuyến có nhiều loại thì có ô Thu hồi cả chuyến, gộp mọi loại của xe hàng đó." +
          (can.print ? "\nIn danh sách: bản in A4 để in hoặc lưu PDF. Tải Excel: file danh sách thu hồi để gửi đoàn kiểm tra." : ""),
      }),
    );
  }

  steps.push(
    stages({
      id: "stage-filters",
      target: "qr-stage-filters",
      title: "Theo giai đoạn: khoảng ngày và phân xưởng",
      body:
        "Tab Theo giai đoạn kiểm QR cả chuỗi ở một chỗ. Chọn Khoảng ngày (mặc định 7 ngày gần nhất; là ngày hàng về, ngày sản xuất, ngày đóng gói hoặc ngày xuất / bán) và Phân xưởng.\n" +
        "Đánh dấu Chỉ hiện mục còn thiếu để chỉ còn lô / dòng chưa in tem, chưa gắn lô, chờ duyệt hoặc chưa quét kiểm.",
    }),
    stages({
      id: "stage-list",
      target: "qr-stage-list",
      title: "Năm khâu và trạng thái từng dòng",
      body:
        "5 khâu đúng thứ tự chuỗi: Nhập nguyên liệu · Sản xuất bán thành phẩm · Nhập kho dự trữ · Đóng gói thành phẩm · Xuất theo đơn & bán. Đầu mỗi khâu: số lô / mẻ / phiếu / dòng, thẻ Còn thiếu N hoặc Đủ.\n" +
        "Thẻ trạng thái ở từng dòng:\n" +
        "• Tem: Đã in N tem · Chưa in tem.\n" +
        "• Nhập nguyên liệu: Đã dùng cho … mẻ / dòng bán · Chưa dùng.\n" +
        "• Gắn lô: Lô NL (n) / Lô BTP (n) / Lô TP (n) là đã gắn; Chưa gắn lô · có lý do (lý do ghi lúc chốt ngày sản xuất, không tính là thiếu); Chưa gắn lô (còn thiếu).\n" +
        "• Nhập kho: Chờ nhập kho (còn thiếu, chờ thủ kho duyệt) · Đã nhập kho kèm tồn.\n" +
        "• Xuất theo đơn: Đã quét kiểm · Chưa quét kiểm (còn thiếu).\n" +
        "Chọn mã lô để mở hộ chiếu. Dòng có việc còn thiếu thì nút làm việc đó nổi màu" +
        (can.linkLots
          ? ": In tem · Gắn lô NL · Gắn lô BTP · Gắn lô (dòng bán) · Duyệt nhập kho · Kiểm lô — mở thẳng hộp làm việc, không phải sang màn khác tìm."
          : "; nút nào hiện tùy quyền của bạn. Mỗi khâu cũng ghi tên màn gốc để sang làm."),
    }),
  );

  if (can.print) {
    steps.push(
      print({
        id: "print-filters",
        target: "qr-print-filters",
        title: "In tem hàng loạt: chọn lô",
        body:
          "Chọn Ngày của lô (ngày hàng về với nguyên liệu, ngày sản xuất với bán thành phẩm, ngày đóng gói với thành phẩm), Phân xưởng và Loại lô (Nguyên liệu · Bán thành phẩm · Thành phẩm, chọn được nhiều loại).\n" +
          "Đánh dấu Chỉ lô chưa in tem để bỏ các lô đã có tem; con số bên cạnh là số lô chưa in trên tổng số lô trong khoảng.",
      }),
      print({
        id: "print-list",
        target: "qr-print-list",
        optional: true,
        title: "Danh sách lô và in tem",
        body:
          "Mỗi dòng là một lô, thẻ Đã in N tem kèm ngày hoặc Chưa in tem. Mặc định chọn hết; bỏ đánh dấu lô không cần in, hoặc dùng Chọn hết / Bỏ chọn hết.\n" +
          "Chọn In … tem để mở bản in: chọn khổ tem, xem trước, rồi in bằng máy in tem. Mặc định bán thành phẩm mỗi block một tem, thành phẩm mỗi thùng một tem, nguyên liệu một tem; sửa ô Số tem dưới từng tem nếu cần. Lần in được ghi lại để trang biết lô nào đã có tem.",
      }),
    );
  }

  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để trở về đúng màn hình đang xem trước khi bắt đầu.\n" +
      "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
  });
  return { title: "Mã lô QR", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền, có lô minh họa. */
export const tourSpec: PageTourSpec = {
  pageId: "qr",
  build: () => buildQrTour({ sampleLot: "W:w1", can: { print: true, linkLots: true }, showTab: () => {} }),
};
