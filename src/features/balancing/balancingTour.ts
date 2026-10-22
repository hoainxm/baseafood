// ============================================================
// Tên file: src/features/balancing/balancingTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Cân đối kỳ — chọn kỳ minh họa + dựng bước
// Description: Page tour for /balancing (docs/app-map/43-guided-tour.ba-spec.md). Picks a sample
//              period to open (like the export tour's sample dossier, R4) and builds the steps in
//              the work order of docs/app-map/31-can-doi-ky.md: list → create period → open period
//              → material block → stock lines → finished-good block → result note → lock → print.
//              Steps only change the URL (list ⇄ one period); nothing is written (R1).
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";
import type { BalancingPeriod } from "@/types";

/**
 * Kỳ minh họa: kỳ đang mở trên màn (bắt đầu tour từ trong một kỳ) → kỳ chưa chốt mới nhất →
 * kỳ bất kỳ mới nhất (theo ngày bắt đầu). Không có kỳ nào ⇒ null.
 */
export function pickTourPeriod(
  periods: readonly Pick<BalancingPeriod, "id" | "startDate" | "isLocked">[],
  currentId: string | null,
): string | null {
  if (!periods.length) return null;
  if (currentId && periods.some((p) => p.id === currentId)) return currentId;
  const newestFirst = [...periods].sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  return (newestFirst.find((p) => !p.isLocked) ?? newestFirst[0]).id;
}

export interface BalancingTourContext {
  /** Id kỳ minh họa (`pickTourPeriod`); null ⇒ phần một kỳ gói thành một lời giữa trang. */
  pick: string | null;
  can: {
    /** Tạo kỳ cân đối. */
    create: boolean;
    /** Ghi số trong lưới, thêm dòng, nhận chuyển kỳ. */
    update: boolean;
    /** Chốt kỳ / mở lại kỳ. */
    lock: boolean;
  };
  /** Về danh sách kỳ (chỉ đổi đường dẫn). */
  toList: () => void;
  /** Mở một kỳ (chỉ đổi đường dẫn). */
  openPeriod: (periodId: string) => void;
}

/** Dựng các bước theo thứ tự công việc (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildBalancingTour(ctx: BalancingTourContext): PageTour {
  const { pick, can } = ctx;
  /* Bước cùng chỗ xem dùng CHUNG một hàm prepare (khung dò trước để đếm "Bước k/n"). */
  const toList = ctx.toList;
  const inPeriod = () => {
    if (pick) ctx.openPeriod(pick);
  };
  const list = (s: TourStep): TourStep => ({ ...s, prepare: toList });
  const period = (s: TourStep): TourStep => ({ ...s, prepare: inPeriod });

  const steps: TourStep[] = [
    list({
      id: "intro",
      title: "Giới thiệu trang Cân đối kỳ",
      body:
        "Cân đối kỳ trả lời: một lô nguyên liệu ra bao nhiêu bán thành phẩm, định mức bao nhiêu, lãi hay lỗ. Kế toán dùng trang này để lập bảng cân đối gửi Ban Giám đốc.\n" +
        "Trang nằm sau khâu nhập hàng và sản xuất của chuỗi nhập hàng → sản xuất → kho → bán / xuất: kỳ tự lấy số từ sổ Nhập hàng và sổ Sản xuất, còn hai dòng kho Lấy xả đông, Gửi đông ghi thẳng vào Sổ kho theo tháng.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    }),
  ];

  if (can.create) {
    steps.push(
      list({
        id: "create-period",
        target: "balancing-create-period",
        optional: true,
        title: "Tạo kỳ cân đối",
        body:
          "Một kỳ = một loại nguyên liệu + các ngày tiếp nhận của lô đó (xưởng Đông thường 5 ngày). Chọn Tạo kỳ cân đối rồi khai:\n" +
          "• Loại nguyên liệu: tên họ, lớn và nhỏ (80↑ / 80↓) gộp chung, ví dụ Bạch tuộc 2 da.\n" +
          "• Ngày tiếp nhận: khoảng ngày hàng về xưởng của lô.\n" +
          "• Tổng NL nhận cả kỳ (lấy từ bảng phụ, để tính tỉ lệ thu hồi), Chi phí chế biến / kg TP, Tỉ giá (mặc định 26.000 đ/USD). Chi phí và tỉ giá tự điền theo kỳ trước cùng loại, sửa được.\n" +
          "Chọn Tạo kỳ thì kỳ hiện trong danh sách.",
      }),
    );
  }

  steps.push(
    list({
      id: "period-list",
      target: "balancing-period-list",
      optional: true,
      title: "Danh sách kỳ",
      body:
        "Mỗi dòng là một kỳ: Loại nguyên liệu · Ngày tiếp nhận · Tổng NL nhận (kg). Ô tìm lọc theo loại nguyên liệu; ô vuông đầu dòng để chọn rồi tô màu những kỳ đã dò.\n" +
        "Cuối dòng: Mở kỳ để vào bảng cân đối; Sửa, Xóa khi được cấp quyền. Xóa kỳ chỉ xóa số của kỳ, số ở sổ Nhập hàng và sổ Sản xuất vẫn còn, có Hoàn tác.",
    }),
  );

  if (!pick) {
    steps.push({
      id: "period-overview",
      title: "Bảng cân đối một kỳ",
      body:
        "Khi đã có kỳ, chọn Mở kỳ để vào bảng cân đối. Bảng gồm ba khối như file cân đối giấy:\n" +
        "• Nguyên liệu vào: dòng Lấy xả đông, nguyên liệu tự lấy từ sổ Nhập hàng, xả đông mua về, bột phụ gia, dòng giảm (ví dụ Bán nội địa), dòng Gửi đông.\n" +
        "• Bán thành phẩm sản xuất: bán thành phẩm làm ra trong kỳ, lấy từ sổ Sản xuất.\n" +
        "• Ghi chú: Định mức chế biến = Tổng NL vào ÷ Tổng thành phẩm; Lãi / Lỗ = Giá trị xuất − Giá thành.\n" +
        "Đối chiếu xong thì Chốt kỳ (Kỳ đang mở → Kỳ đã chốt): mọi ô khóa lại, mở lại phải ghi lý do.",
    });
  } else {
    steps.push(
      list({
        id: "open-period",
        target: "balancing-open-period",
        optional: true,
        title: "Mở kỳ",
        body: "Chọn Mở kỳ ở một dòng để vào bảng cân đối của kỳ đó. Chọn Tiếp theo: hướng dẫn sẽ mở một kỳ có sẵn để minh họa.",
      }),
      period({
        id: "period-header",
        target: "balancing-period-header",
        title: "Đầu bảng cân đối",
        body:
          "Tiêu đề ghi loại nguyên liệu và ngày tiếp nhận; kỳ đã chốt có thêm chữ \"đã chốt\".\n" +
          "• Lấy n dòng từ sổ: còn dòng sổ Sản xuất trong khoảng ngày chưa vào kỳ (nguyên liệu sổ nhập tự vào, không cần lấy).\n" +
          "• Hoàn tác, Làm lại (Ctrl+Z, Ctrl+Y): lùi mọi lần ghi của kỳ đang mở, kể cả số ghi ngược về sổ nhập, sổ sản xuất, sổ kho. Rời kỳ là hết lịch sử.\n" +
          "• Xếp ngang / Xếp dọc: đặt phần ghi từng ngày bên phải hay bên dưới bảng chính. Chỉ đổi cách nhìn, máy nhớ lựa chọn.",
      }),
      period({
        id: "material",
        target: "balancing-material",
        title: "Khối Nguyên liệu vào",
        body:
          "Thứ tự dòng như bảng giấy: Lấy xả đông (đầu) → nguyên liệu Thủy sản → Xả đông mua về → Bột phụ gia → dòng giảm → Gửi đông (cuối) → T. CỘNG.\n" +
          "• Nguyên liệu Thủy sản tự lấy từ sổ Nhập hàng: cùng họ nguyên liệu, ngày hàng về xưởng nằm trong kỳ. Họ có hai loại thì mỗi loại một dòng (ví dụ 2 da lớn, 2 da nhỏ); n người bán mở các đại lý của loại đó.\n" +
          "• Đơn giá VNĐ của dòng sổ nhập là giá bình quân theo kg; tiền = Σ kg × giá từng chuyến. Số liệu dòng này khóa, sửa bằng nút bút chì Sửa chuyến nhập (xem lại, xác nhận rồi mới ghi vào sổ Nhập hàng).\n" +
          "• Dòng giảm (Bán nội địa, hao hụt, trả lại): gõ số dương, hệ thống lưu số âm và trừ khỏi nguyên liệu vào.\n" +
          "Kỳ trùng ngày với kỳ khác cùng loại thì hai kỳ cùng tính chuyến nhập của ngày trùng.",
      }),
      period({
        id: "material-checks",
        target: "balancing-material-checks",
        title: "Nút và cảnh báo của khối nguyên liệu",
        body:
          "• Lấy bán nội địa từ SX (n kg): tạo dòng giảm Bán nội địa đúng từng ngày theo số tổ trưởng ghi ở Sản xuất. Sau đó dòng có thẻ khớp sổ SX, hoặc SX ghi … · lệch … kèm Lấy lại từ SX.\n" +
          "• Chọn dòng nhập (n): tự chọn chuyến khác tên loại hoặc đang thuộc kỳ khác để kéo vào kỳ này. Dòng chữ \"Sổ nhập trong khoảng ngày còn …\" đếm số chuyến đó.\n" +
          "• Gộp cùng loại (n): gộp các dòng nhập tay cùng họ thành một dòng, giá bình quân giữ nguyên giá trị nguyên liệu.\n" +
          "• ⚠ Chưa có đơn giá: giá thành và lãi / lỗ đang tính thiếu; Điền giá gợi ý để điền giá bình quân, sửa lại được.\n" +
          "• ⚠ Sổ kho tháng lệch n chỗ: Sổ kho theo tháng bị sửa hoặc nạp lại Excel đè. Chọn Ghi lại vào sổ kho chỉ khi file Excel chưa tính phần lấy xả đông của kỳ, kẻo cộng đôi.\n" +
          "• Sổ nhập không có chuyến nào ngày …: kiểm lại ngày của kỳ (theo ngày hàng về xưởng, không phải ngày ghi sổ).",
      }),
      period({
        id: "stock-lines",
        target: "balancing-stock-lines",
        optional: true,
        title: "Lấy xả đông và Gửi đông",
        body:
          "Hai dòng kho ghi thẳng vào Sổ kho theo tháng (nơi duy nhất giữ số kho):\n" +
          "• Lấy xả đông (cộng vào nguyên liệu, trừ kho đông): chọn lô của Sổ kho tháng (kho · tên · invoice, còn bao nhiêu kg). Số kg ghi vào cột Xuất của lô theo tháng của ngày lấy; vượt tồn lô thì bị chặn. Đơn giá lấy theo giá lô; sửa giá dòng thì hiện đã sửa · giá lô kèm Dùng giá lô.\n" +
          "• Gửi đông (trừ khỏi nguyên liệu, cộng kho đông): chọn kho và nguyên liệu gửi → bảng của sổ kho (mặc định Nguyên liệu mua ngoài). Mỗi ngày gửi thành một lô riêng, đơn giá là Giá gửi gõ theo ngày ở hàng ngay dưới.\n" +
          "• Đối chiếu với số còn dở tổ trưởng khai khi chốt ngày Sản xuất: Lấy … kg còn dở SX để điền, thẻ khớp còn dở SX, hoặc SX còn dở … · lệch ….\n" +
          "Lấy thêm lô, Gửi thêm: thêm một dòng kho nữa ngay dưới.",
      }),
    );
    if (can.update) {
      steps.push(
        period({
          id: "material-add",
          target: "balancing-material-add",
          optional: true,
          title: "Thêm dòng nguyên liệu",
          body:
            "• Xả đông mua về: hàng cấp đông ở kho khác bán về. Xả đông hàng kho mình thì gõ ở dòng Lấy xả đông.\n" +
            "• Bột phụ gia: bột tẩm dùng trong kỳ, có cột Tỷ lệ. Số bột lấy ở khối Bột tẩm đã dùng của trang Sản xuất.\n" +
            "• Dòng giảm: giảm trừ nguyên liệu (bán nội địa, hao hụt, trả lại).\n" +
            "Lưu xong dòng hiện trong khối Nguyên liệu vào, tổng và kết quả tính lại ngay. Kỳ đã chốt thì các nút này ẩn.",
        }),
      );
    }
    steps.push(
      period({
        id: "finished-goods",
        target: "balancing-finished-goods",
        title: "Khối Bán thành phẩm sản xuất",
        body:
          "Bán thành phẩm LÀM RA trong kỳ (cấp đông, cất kho, chưa bán), gộp theo công đoạn + grade như bảng gửi sếp.\n" +
          "• Lấy n dòng từ sổ sản xuất: kéo sản lượng trong khoảng ngày của kỳ vào lưới. Lấy n dòng từ sổ bán chỉ dùng khi tính theo hàng đã bán.\n" +
          "• Khách bắt buộc; chưa rõ khách thì chọn Khác. Lượng (kg) = tổng các ngày + Trả + Nợ.\n" +
          "• Đơn giá là USD với Xuất khẩu, đồng với Nội địa; T.tiền (USD) không cộng tiền nội địa (ghi riêng dòng \"đ nội địa\").\n" +
          "• Trả, Nợ: gõ số có dấu, ví dụ (2.000) là −2.000.\n" +
          "Chưa có bán thành phẩm thì định mức và lãi / lỗ hiện \"—\". Ẩn dòng trống để xem gọn như bản in; Thêm mặt hàng khi được cấp quyền.",
      }),
      period({
        id: "days",
        target: "balancing-days",
        optional: true,
        title: "Phần ghi từng ngày",
        body:
          "Hai bảng Nguyên liệu theo ngày và Thành phẩm theo ngày cùng số với bảng chính, chia theo từng ngày của kỳ. Ẩn theo ngày / Hiện theo ngày ở mỗi khối để thu gọn.\n" +
          "• Ô ngày gõ thẳng, ghi ngay theo từng phím; Enter, Tab, mũi tên để đi ô; dán được khối số từ Excel.\n" +
          "• Ô ngày của bán thành phẩm ghi ngược về sổ Sản xuất. Ngày đã chốt sản xuất thì phải ghi lý do ghi bù; dán khối bỏ qua ô rơi vào ngày đã chốt và báo số ô bị bỏ.\n" +
          "• Hàng Giá (đ/kg) dưới dòng sổ nhập: giá từng ngày, chỉ xem. Hàng Giá gửi (đ/kg) dưới Gửi đông: gõ giá gửi của ngày đã gửi.",
      }),
      period({
        id: "result",
        target: "balancing-result",
        title: "Ghi chú: kết quả cân đối",
        body:
          "Đọc một mạch từ trên xuống như cột Ghi chú của bảng giấy:\n" +
          "• Định mức chế biến = Tổng NL vào ÷ Tổng thành phẩm.\n" +
          "• Giá thành = Tổng thành phẩm × Chi phí CB / kg TP + Giá trị NL.\n" +
          "• Giá trị xuất = Σ kg × đơn giá, dòng Xuất khẩu nhân Tỉ giá.\n" +
          "• Lãi / Lỗ = Giá trị xuất − Giá thành (hiện chữ Lãi hoặc Lỗ). Bình quân / kg NL = Lãi / Lỗ ÷ Tổng NL vào.\n" +
          "• Tỉ lệ thu hồi = Tổng thành phẩm ÷ Tổng NL nhận cả kỳ. Dưới ô NL nhận: ✓ khớp NL vào, hoặc ⚠ lệch NL vào … kg.\n" +
          "Chi phí CB / kg TP, Tỉ giá, Tổng NL nhận cả kỳ sửa ngay tại chỗ; khác kỳ trước cùng loại thì ghi \"kỳ trước …\". Dòng tiền chỉ hiện với người được xem giá.",
      }),
    );
    if (can.update) {
      steps.push(
        period({
          id: "carry-over",
          target: "balancing-carry-over",
          optional: true,
          title: "Nhận chuyển kỳ",
          body:
            "Khung này hiện khi kỳ trước cùng loại nguyên liệu có dòng đẩy sang chưa ai nhận. Chọn Nhận n dòng chuyển kỳ: dòng hiện ở kỳ này làm số đầu kỳ (nhóm Xả đông, kho mình) và kỳ trước đánh dấu đã nhận, không lấy được hai lần.",
        }),
      );
    }
    steps.push(
      period({
        id: "lock-status",
        target: "balancing-lock",
        title: "Trạng thái kỳ",
        body:
          "• Kỳ đang mở: còn gõ và lấy số được; sửa ở sổ Nhập hàng, sổ Sản xuất tự vào kỳ.\n" +
          "• Kỳ đã chốt: mọi ô trong lưới khóa; dòng phụ ghi Khoá lúc … và ghi chú khi chốt. Sổ gốc sửa sau khi chốt thì màn vẫn tính theo sổ, nhưng số đã lưu của kỳ không đổi; muốn nhận số mới thì mở lại kỳ.\n" +
          "• Lần mở lại gần nhất: lý do của lần mở lại. Mở lại không xóa dấu đã chốt.",
      }),
    );
    if (can.lock) {
      steps.push(
        period({
          id: "lock-action",
          target: "balancing-lock-action",
          optional: true,
          title: "Chốt kỳ, mở lại kỳ",
          body:
            "Đối chiếu xong và gửi kế toán thì chọn Chốt kỳ, ghi chú rồi lưu: kỳ chuyển sang Kỳ đã chốt.\n" +
            "Kỳ đã chốt thì nút đổi thành Mở lại kỳ, bắt buộc ghi lý do.",
        }),
      );
    }
    steps.push(
      period({
        id: "print",
        target: "balancing-print",
        optional: true,
        title: "Xem / in bảng",
        body:
          "Chọn Xem / in bảng để xem bảng cân đối đúng khổ A4 rồi in giấy hoặc lưu PDF. Kỳ dài hơn 3 ngày tự in ngang.\n" +
          "Trong phiếu in có Thu cột ngày, Thu cột tiền riêng để bản in gọn. Bản in không tô màu dòng.",
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
  return { title: "Cân đối kỳ", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 R13): đủ quyền, có kỳ minh họa. */
export const tourSpec: PageTourSpec = {
  pageId: "balancing",
  build: () =>
    buildBalancingTour({
      pick: "p",
      can: { create: true, update: true, lock: true },
      toList: () => {},
      openPeriod: () => {},
    }),
};
