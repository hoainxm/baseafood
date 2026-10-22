// ============================================================
// Tên file: src/features/production/wipTour.ts
// Tên tiếng Việt: Hướng dẫn từng bước của trang Sản xuất thành phẩm (/wip)
// Description: Page tour for the daily production screen (docs/app-map/43-guided-tour.ba-spec.md):
//              steps follow the work order of ba-spec 34 F-N1 — fill today's sheet (lots, finished
//              goods, domestic sale, frozen goods) → save → read the day ledger → send the daily
//              report → lock the day. Steps only switch between the two on-page modes; nothing is
//              written (R1). Write-button steps are dropped when the user lacks the permission.
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

/** Hai chế độ của trang: phiếu ghi ("📝 Ghi nhập") và sổ ("📖 Sổ ngày & báo cáo"). */
export type WipViewMode = "entry" | "ledger";

export interface WipTourContext {
  can: {
    /** Có phiếu "Ghi nhập" (quyền Thêm ở ít nhất một xưởng) — không có thì trang chỉ có sổ ngày. */
    enter: boolean;
    /** Chốt ngày / Mở lại ngày. */
    lock: boolean;
    /** Gửi báo cáo lên hệ thống (quyền Xuất). */
    report: boolean;
  };
  /** Chế độ lúc bắt đầu hướng dẫn — bước cuối trả trang về chế độ này. */
  startMode: WipViewMode;
  /** Đổi chế độ xem (chỉ đổi chỗ xem, không ghi). */
  setMode: (mode: WipViewMode) => void;
}

/** Dựng các bước theo thứ tự công việc (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildWipTour(ctx: WipTourContext): PageTour {
  const { can } = ctx;
  const entry = (s: TourStep): TourStep => ({ ...s, prepare: () => ctx.setMode("entry") });
  const ledger = (s: TourStep): TourStep => (can.enter ? { ...s, prepare: () => ctx.setMode("ledger") } : s);

  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Sản xuất thành phẩm",
      body:
        "Trang này ghi lượng thành phẩm (bán thành phẩm) làm ra mỗi ngày theo ngày sản xuất và phân xưởng Đông, Cá, Khô. Người dùng chính là tổ trưởng và quản đốc xưởng; kế toán xem sổ để đối chiếu.\n" +
        "Trang nằm ở khâu sản xuất của chuỗi: nhập hàng → sản xuất → kho dự trữ → đóng gói → bán hoặc xuất khẩu. Số ghi ở đây là gốc cho Kho dự trữ (duyệt nhập kho) và cho Cân đối kỳ.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "daily-reminder",
      target: "wip-daily-reminder",
      title: "Việc hôm nay",
      body:
        "Dải nhắc cho biết hôm nay xưởng đang chọn đã chốt sản xuất chưa:\n" +
        "• \"Việc hôm nay: …\": hôm nay chưa chốt ngày — ghi xong sản lượng thì chốt ngày.\n" +
        "• \"Hôm nay đã chốt — …\": ngày hôm nay của xưởng đã chốt, ghi thêm là ghi bù.",
    },
  ];

  if (can.enter) {
    steps.push(
      {
        id: "mode-switch",
        target: "wip-mode-switch",
        optional: true,
        title: "Hai chế độ của trang",
        body:
          "📝 Ghi nhập: phiếu ghi sản lượng của một ngày, một xưởng — mở sẵn khi vào trang, gõ như tờ giấy.\n" +
          "📖 Sổ ngày & báo cáo: xem số đã lưu theo ngày, tuần, tháng; gửi báo cáo và chốt ngày.\n" +
          "Hướng dẫn sẽ tự chuyển giữa hai chế độ để chỉ từng chỗ.",
      },
      entry({
        id: "session-header",
        target: "wip-session-header",
        optional: true,
        title: "Ngày và phân xưởng của phiếu",
        body:
          "• Ngày ghi sổ: ngày nhập vào máy. Đổi ngày này thì Ngày sản xuất tự đổi theo, tới khi bạn sửa tay Ngày sản xuất.\n" +
          "• Ngày sản xuất: ngày làm ra thật — mọi tổng hợp tính theo ngày này.\n" +
          "• Phân xưởng: chỉ có các xưởng bạn được ghi.\n" +
          "Ghi bù: Ngày ghi sổ sau Ngày sản xuất, hoặc ngày đó đã chốt (dòng báo \"đã chốt — ghi thêm là ghi bù\") ⇒ phải điền Lý do ghi bù mới lưu được. Ngày ghi sổ không được trước Ngày sản xuất.\n" +
          "Phiếu đang gõ được tự lưu nháp: chuyển trang hay tải lại vẫn còn nguyên, chỉ vào sổ khi chọn Lưu vào sổ.",
      }),
      entry({
        id: "session-lots",
        target: "wip-session-lots",
        optional: true,
        title: "Lô nguyên liệu dùng cho phiên",
        body:
          "Khai một lần các lô nguyên liệu đem ra chế biến trong phiên, theo một trong ba cách: nút Quét tem NL · ô Hoặc gõ mã lô · ô Hoặc chọn lô nguyên liệu. Mỗi loại nguyên liệu của một chuyến nhập là một lô.\n" +
          "• Thẻ \"Chưa khai lô — chốt ngày sẽ hỏi\": phiên chưa có lô nào. Lưu vẫn được, nhưng khi chốt ngày phải gắn lô từng mẻ hoặc ghi lý do.\n" +
          "• Thẻ \"n lô\": đã khai n lô. Lưu vào sổ là tự gắn lô cho thành phẩm đúng loại nguyên liệu (mặt hàng chưa gắn loại thì theo loài) và cho dòng bán nội địa cùng loại.\n" +
          "Dòng không cùng loài với lô đã khai thì chưa được gắn — trang báo để gắn riêng ở sổ (Gắn lô NL). Lô đã khai giữ cho các phiên sau cùng ngày, cùng xưởng.",
      }),
      entry({
        id: "production-lines",
        target: "wip-production-lines",
        optional: true,
        title: "Thành phẩm làm ra trong ngày",
        body:
          "Mỗi hàng một thành phẩm: Thành phẩm · Số block × kg/khối · Số lượng (kg). Gõ xong một dòng thì dòng trống mới tự hiện.\n" +
          "• Số lượng tự tính = số block × kg/khối khi ô kg đang trống. Gõ tay số cân thực tế khác thì giữ số đã gõ, ô kg ghi \"≠\" kèm số tính được để bạn soát. Kg/khối vừa nhập được nhớ vào mặt hàng cho lần sau.\n" +
          "• Chọn ✂ để tách râu + bao tử (cùng giá): Số lượng bằng tổng hai ô. Mặt hàng đã đánh dấu tách thì hàng tách tự hiện.\n" +
          "• Mặt hàng tẩm bột có thêm hàng Bột tẩm: một ô kg cho từng loại bột. Bột là phụ gia — không cộng vào Số lượng và tổng sản lượng.\n" +
          "Dưới bảng: số thành phẩm của phiên, tổng bột tẩm và tổng kg đang gõ.",
      }),
      entry({
        id: "domestic-sale",
        target: "wip-domestic-sale",
        optional: true,
        title: "Bán nội địa trong ngày",
        body:
          "Nguyên liệu bán thẳng cho khách trong nước, không qua chế biến. Chọn Thêm dòng bán nội địa, điền Loại nguyên liệu · Số lượng · Đơn giá · Khách hàng; thành tiền = số lượng × đơn giá.\n" +
          "Lưu cùng phiên nhưng vào sổ riêng: không cộng vào sản lượng thành phẩm, không vào kho dự trữ. Cân đối lấy số này cho dòng \"Bán nội địa\"; sổ Tồn kho nguyên liệu trừ phần đã bán.",
      }),
      entry({
        id: "frozen-stock",
        target: "wip-frozen-stock",
        optional: true,
        title: "Hàng đông lạnh nhập kho (Hàng tạm)",
        body:
          "Hàng sơ chế đem cấp đông, chưa phải thành phẩm (VD 2 DA <80GR, BAO TỬ 2DA). Chọn Thêm dòng hàng đông lạnh, điền Tên hàng · Số lượng · Nhập vào kho (mặc định Kho 1500 tấn).\n" +
          "Lưu vào sổ thì mỗi dòng thành một lô nhập nhóm Hàng tạm ở Sổ kho theo tháng (tháng theo ngày sản xuất). Không cộng vào sản lượng thành phẩm.\n" +
          "Lưu ý: cùng một lô đừng ghi cả ở đây lẫn \"Gửi đông\" của Cân đối — ghi hai nơi là cộng đôi.",
      }),
      entry({
        id: "save-session",
        target: "wip-save-session",
        optional: true,
        title: "Tổng ngày và Lưu vào sổ",
        body:
          "Tổng ngày = số đã lưu của ngày và xưởng này + số đang gõ trong phiếu.\n" +
          "Chọn Lưu vào sổ để ghi một lượt cả thành phẩm, bán nội địa và hàng đông lạnh. Thành phẩm vào sổ với trạng thái Chờ nhập kho; thông báo có nút In tem để in tem QR lô cho các mẻ vừa lưu. Phiếu trống mới tự mở cho lượt kế.\n" +
          "Thiếu thông tin thì khung lỗi ở đầu phiếu ghi rõ dòng nào thiếu (chưa chọn thành phẩm, số lượng phải lớn hơn 0 kg, thiếu lý do ghi bù).",
      }),
      entry({
        id: "day-rows",
        target: "wip-day-rows",
        optional: true,
        title: "Đã ghi trong ngày",
        body:
          "Các dòng đã lưu của đúng ngày và xưởng đang ghi, kèm số dòng và tổng kg. Sửa hoặc bỏ từng dòng ngay tại đây; ngày đã chốt thì phải Mở lại ngày trước rồi mới sửa được.\n" +
          "Nút từng dòng giống ở sổ ngày: Gắn lô NL · Tem · Sửa · Bỏ.",
      }),
    );
  }

  steps.push(
    ledger({
      id: "ledger-filter",
      target: "wip-ledger-filter",
      title: "Kỳ xem sổ và phân xưởng",
      body:
        "Kỳ xem sổ: Ngày · Tuần · Tháng · Năm · Khoảng tự chọn; chọn Ngày sản xuất (hoặc khoảng ngày) và Phân xưởng (Đông, Cá, Khô hoặc Tất cả).\n" +
        "Bảng, tổng, báo cáo và phần chốt ngày bên dưới đều tính theo lựa chọn này. Phần chốt ngày chỉ hiện khi xem MỘT ngày và MỘT xưởng.\n" +
        "In phiếu trống (khi được cấp quyền): in tờ trống để ghi tay ngoài xưởng, sau đó nhập lại vào máy.",
    }),
    ledger({
      id: "ledger-stats",
      target: "wip-ledger-stats",
      title: "Năm chỉ số của sổ",
      body:
        "• Đang xem và Phân xưởng: kỳ và xưởng đang lọc.\n" +
        "• Số dòng: số dòng thành phẩm trong kỳ.\n" +
        "• Chờ nhập kho: số dòng chưa được thủ kho duyệt ở Kho dự trữ — hàng này chưa tính vào tồn kho.\n" +
        "• Tổng sản lượng: tổng kg thành phẩm (không gồm bột tẩm, bán nội địa, hàng đông lạnh).",
    }),
    ledger({
      id: "ledger-table",
      target: "wip-ledger-table",
      optional: true,
      title: "Sổ thành phẩm và trạng thái",
      body:
        "Mỗi dòng một mẻ: thành phẩm, số lượng (có tách râu · bao tử nếu đã tách), block, bột tẩm, chế biến, khách hàng, trạng thái, người ghi. Dưới bảng là Tổng block và Tổng sản lượng.\n" +
        "Cột Trạng thái:\n" +
        "• Chờ nhập kho: mới ghi, chưa duyệt. Thủ kho duyệt ở trang Kho dự trữ theo kg thực nhận.\n" +
        "• Đã nhập kho · <kho>: đã duyệt vào kho đó, tồn kho dự trữ đã cộng.\n" +
        "Nút từng dòng: Gắn lô NL (đổi thành \"Lô NL (n)\" khi đã có n lô) để truy được nguồn nguyên liệu của mẻ · Tem in tem QR lô bán thành phẩm · Sửa · Bỏ (có hỏi lại và Hoàn tác).",
    }),
    ledger({
      id: "batter-summary",
      target: "wip-batter-summary",
      optional: true,
      title: "Bột tẩm đã dùng",
      body:
        "Cộng kg theo từng loại bột cho kỳ và xưởng đang xem. Bột là phụ gia — không nằm trong tổng sản lượng. Kế toán dùng số này cho nhóm \"Bột phụ gia\" ở Cân đối.",
    }),
    ledger({
      id: "ledger-domestic",
      target: "wip-ledger-domestic",
      optional: true,
      title: "Sổ bán nội địa",
      body:
        "Các dòng nguyên liệu bán thẳng trong kỳ: ngày, loại nguyên liệu, số lượng, đơn giá, thành tiền, khách, người ghi; dưới là Tổng bán nội địa.\n" +
        "Gắn lô NL ở từng dòng ghi nguyên liệu bán lấy từ lô nào — để khi thu hồi lô truy tới được khách.",
    }),
    ledger({
      id: "ledger-frozen",
      target: "wip-ledger-frozen",
      optional: true,
      title: "Sổ hàng đông lạnh (Hàng tạm)",
      body:
        "Các lô hàng sơ chế cấp đông đã ghi từ trang này. Cột Ở Sổ kho tháng:\n" +
        "• Lô nhập Hàng tạm: lô đang nằm ở nhóm Hàng tạm, còn Bỏ được nếu ghi sai.\n" +
        "• Đã lấy ra ở sổ kho: lô đã lấy ra, hoặc tháng sau đã có nhập, xuất, ghi chú trên lô — không Bỏ ở đây nữa, sửa ở Sổ kho tháng.\n" +
        "Mở Sổ kho tháng để xem các lô này trong nhóm Hàng tạm.",
    }),
    ledger({
      id: "daily-report",
      target: "wip-daily-report",
      optional: true,
      title: "Báo cáo công việc ngày",
      body:
        "Gom sản lượng của kỳ đang xem theo Xưởng × Người thao tác (người thao tác là tài khoản đã lưu dòng): số dòng và tổng kg, dòng cuối là Tổng cộng.\n" +
        "Gửi báo cáo khác Chốt ngày: gửi chỉ báo số lên hệ thống và lưu vết, không khóa sổ.",
    }),
  );

  if (can.report) {
    steps.push(
      ledger({
        id: "send-report",
        target: "wip-send-report",
        optional: true,
        title: "Gửi báo cáo lên hệ thống",
        body:
          "Cuối ca, chọn Gửi báo cáo lên hệ thống: báo cáo gồm tổng thành phẩm, phần theo người thao tác, bột tẩm và bán nội địa được ghi vào nhật ký thao tác.\n" +
          "Gửi xong, dưới nút hiện \"Đã gửi lúc …\" (chỉ nhớ trên máy này).",
      }),
    );
  }

  steps.push(
    ledger({
      id: "day-lock",
      target: "wip-day-lock",
      optional: true,
      title: "Trạng thái chốt ngày",
      body:
        "Khi xem một ngày, một xưởng, dải này cho biết:\n" +
        "• Chưa chốt: sổ ngày còn sửa được bình thường. Ghi xong sản lượng trong ngày thì chốt.\n" +
        "• Đã chốt: sổ ngày của xưởng đã khóa. Ghi thêm sau chốt là ghi bù — phải có lý do.\n" +
        "• Thẻ \"Còn ghi bù … kg sau chốt\": tổng hiện tại khác tổng lúc chốt đúng số kg đó.\n" +
        "Điều kiện chốt được: mọi mẻ của ngày đã gắn lô nguyên liệu, hoặc ghi Lý do chưa gắn lô cho các mẻ còn thẻ Chưa gắn lô.",
    }),
  );

  if (can.lock) {
    steps.push(
      ledger({
        id: "lock-action",
        target: "wip-lock-action",
        optional: true,
        title: "Chốt ngày và Mở lại ngày",
        body:
          "Chốt ngày mở hộp chốt gồm:\n" +
          "• Ghi chú chốt (nếu có).\n" +
          "• Danh sách mẻ chưa gắn lô: Gắn lô NL từng mẻ, hoặc điền Lý do chưa gắn lô (lưu cho từng mẻ còn thiếu).\n" +
          "• Nguyên liệu còn dở đem lưu kho: khai theo từng loại nguyên liệu (Thêm loại còn dở). Số này thành đông gửi ở sổ Tồn kho nguyên liệu; không còn dở thì bỏ trống.\n" +
          "Ngày đã chốt thì nút đổi thành Mở lại ngày: phải ghi Lý do mở lại, việc mở được lưu vết; sửa xong nhớ chốt lại.",
      }),
    );
  }

  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để trở về chế độ đang xem trước khi bắt đầu.\n" +
      "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
    prepare: can.enter ? () => ctx.setMode(ctx.startMode) : undefined,
  });

  // Thoát giữa chừng (Esc) cũng trả về chế độ lúc bắt đầu — chế độ là state, đường dẫn không giữ (R5).
  return { title: "Sản xuất thành phẩm", steps, onExit: can.enter ? () => ctx.setMode(ctx.startMode) : undefined };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "wip",
  build: () =>
    buildWipTour({
      can: { enter: true, lock: true, report: true },
      startMode: "entry",
      setMode: () => {},
    }),
};
