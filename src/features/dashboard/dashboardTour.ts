// ============================================================
// Tên file: src/features/dashboard/dashboardTour.ts
// Tên tiếng Việt: Hướng dẫn từng bước của trang Tổng quan — dòng chảy số liệu
// Description: Dashboard tour (docs/app-map/43-guided-tour.ba-spec.md R1–R12): period / workshop
//              filter → KPI cards → 5-stage pipeline → "where did the kg go" bars → chain alerts →
//              daily series → balancing periods + yield → NXT stock, plus the admin-only demo mode
//              button. Business rules: docs/spec/che-do-demo.md §5b + lib/dataFlow.ts. Read-only.
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface DashboardTourContext {
  can: {
    /** Thấy nút Demo trên thanh tiêu đề (admin — chế độ demo, quy tắc 15). */
    demo: boolean;
  };
}

/** Dựng các bước theo thứ tự đọc của trang (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildDashboardTour(ctx: DashboardTourContext): PageTour {
  const steps: TourStep[] = [
    {
      id: "intro",
      title: "Giới thiệu trang Tổng quan",
      body:
        "Trang Tổng quan cho thấy số chảy qua cả chuỗi nhập hàng → sản xuất → kho → đóng gói → xuất / bán: nguyên liệu vào đi qua 5 khâu ra sao, đang kẹt ở đâu, còn việc gì phải đốc. Dành cho quản đốc, kế toán và Ban Giám đốc.\n" +
        "Mọi số lấy từ sổ đã ghi ở các trang khác; trang này chỉ để xem, không sửa số. Sổ nào chưa có số thì khối đó để trống.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    },
    {
      id: "filters",
      target: "dashboard-filters",
      title: "Kỳ xem và phân xưởng",
      body:
        "Chọn kỳ Ngày · Tuần · Tháng · Năm (mặc định tháng hiện tại), dùng ‹ › để sang kỳ trước hoặc kỳ sau. Tự chọn: hiện ô Khoảng ngày để chọn ngày đầu, ngày cuối.\n" +
        "Chọn Cả 3 xưởng hoặc một xưởng Đông · Cá · Khô.\n" +
        "Thẻ số, năm khâu, hai thanh chia phần, việc cần đốc, biểu đồ theo ngày và định mức theo mặt hàng đều tính theo kỳ và xưởng đang chọn. Thẻ Lãi/lỗ kỳ cân đối gần nhất, bảng kỳ cân đối và bảng tồn theo kho không đổi theo kỳ xem.",
    },
    {
      id: "kpis",
      target: "dashboard-kpis",
      title: "Tám thẻ số của kỳ",
      body:
        "• Nguyên liệu nhập: kg nhập trong kỳ và số chuyến.\n" +
        "• Bán thành phẩm sản xuất: kg sản xuất, và bằng bao nhiêu % kg nguyên liệu nhập.\n" +
        "• Định mức NL/TP bình quân: kg nguyên liệu cho 1 kg thành phẩm, tính từ mẻ đã gắn lô có cân kg; chưa có thì lấy kỳ cân đối gần nhất.\n" +
        "• Tồn BTP kho dự trữ cuối kỳ, kèm thành phẩm đóng gói còn.\n" +
        "• Xuất + bán ra: xuất theo đơn · bán lẻ · bán nội địa.\n" +
        "• Lãi/lỗ kỳ cân đối gần nhất: xanh là lãi, đỏ là lỗ.\n" +
        "• Mẻ đã gắn lô NL: % kg bán thành phẩm đã gắn lô nguyên liệu, gồm mẻ đã ghi lý do chưa gắn.\n" +
        "• Việc cần đốc: số việc phải làm, ghi thêm số chỗ sổ sai cần sửa.\n" +
        "Chọn một thẻ để mở màn liên quan.",
    },
    {
      id: "stages",
      target: "dashboard-stages",
      title: "Năm khâu của chuỗi",
      body:
        "5 ô theo đúng thứ tự: Nhập nguyên liệu → Sản xuất bán thành phẩm → Nhập kho dự trữ → Đóng gói thành phẩm → Xuất theo đơn & bán. Mỗi ô ghi:\n" +
        "• kg đã qua khâu trong kỳ;\n" +
        "• Đang chờ … kg: chỉ ở Nhập kho dự trữ — bán thành phẩm chờ thủ kho duyệt nhập kho;\n" +
        "• n việc còn thiếu (lô / dòng chưa in tem, chưa gắn lô, chờ duyệt, chưa quét kiểm), hoặc Đủ việc.\n" +
        "Phần trăm trên mũi tên so với khâu nguồn: sản xuất so với nguyên liệu nhập, nhập kho so với sản xuất, đóng gói và xuất / bán so với nhập kho. Chọn một ô để mở màn của khâu đó.",
    },
    {
      id: "outflow",
      target: "dashboard-outflow",
      title: "Nguyên liệu đi đâu",
      body:
        "Câu đầu: cứ 100 kg nguyên liệu vào xưởng thì ra bao nhiêu kg bán thành phẩm (đã gồm nguyên liệu lấy từ kho, kỳ trước nếu có).\n" +
        "Thanh thứ nhất chia 100% nguyên liệu vào xưởng: Thành bán thành phẩm · Bán thẳng nội địa · Còn dở, gửi đông (ghi lúc chốt ngày sản xuất) · Phế liệu · Hao hụt / chưa ghi ra (hao hụt chế biến, hoặc nguyên liệu chưa ghi dùng vào đâu).\n" +
        "Thanh thứ hai chia hàng trong kho dự trữ: Đem đóng gói · Xuất theo đơn · Bán block thô · Còn trong kho.\n" +
        "Phần Hao hụt / chưa ghi ra lớn bất thường thường là sổ ghi thiếu. Chọn một phần để mở màn liên quan.",
    },
    {
      id: "warnings",
      target: "dashboard-warnings",
      title: "Việc cần đốc",
      body:
        "Mỗi dòng là một việc, cột Mức xếp theo thứ tự: Sổ sai (số đang sai, sửa trước) → Chưa làm (việc còn treo) → Để biết. Chọn Mở để tới đúng chỗ sửa.\n" +
        "• Sổ sai: Sổ nhập đổi sau khi chốt (tổng nhập khác lúc chốt) · Bán / xuất vượt tồn · Định mức lệch khi tốn nguyên liệu hơn bình quân quá 5%.\n" +
        "• Chưa làm: Ngày nhập chưa chốt · Ngày sản xuất chưa chốt · Chưa gắn lô (mẻ, phiếu đóng gói chưa gắn và chưa ghi lý do) · BTP chờ duyệt nhập kho quá 3 ngày · Kỳ cân đối chưa chốt khi đã hết ngày cuối.\n" +
        "• Để biết: Ghi bù (kèm lý do) · Định mức lệch khi ít nguyên liệu hơn bình quân · Kỳ cân đối định mức lệch so với các kỳ cùng loại nguyên liệu.\n" +
        "Ngày hôm nay chưa tính là việc vì còn đang ghi. Việc tự hết khi sổ đã sửa xong.",
    },
    {
      id: "daily",
      target: "dashboard-daily",
      title: "Nhập, sản xuất và tồn theo ngày",
      body:
        "Nhập và sản xuất theo ngày: cột kg nguyên liệu nhập và kg bán thành phẩm sản xuất mỗi ngày, để thấy ngày nào nhập nhiều mà sản xuất ít.\n" +
        "Tồn kho theo ngày: tồn bán thành phẩm kho dự trữ và thành phẩm đóng gói cuối mỗi ngày. Tồn nguyên liệu chưa vẽ vì sổ nguyên liệu chưa trừ phần đưa vào sản xuất. Đường dừng ở hôm nay.",
    },
    {
      id: "periods",
      target: "dashboard-periods",
      title: "Kỳ cân đối và định mức theo mặt hàng",
      body:
        "Kết quả các kỳ cân đối: mỗi kỳ ghi NL vào, TP ra, Định mức = NL vào ÷ TP ra, Lãi/lỗ = giá trị xuất − giá thành. Kỳ chưa có thành phẩm thì ghi \"chưa có TP\", không tính. Chọn Mở để vào kỳ.\n" +
        "Định mức theo mặt hàng: chỉ tính mẻ đã gắn lô nguyên liệu có cân kg. Vạch là bình quân; mặt hàng lệch quá ±5% so bình quân được ghi \"lệch\".",
    },
    {
      id: "warehouse-stock",
      target: "dashboard-nxt",
      title: "Tồn kho theo kho",
      body:
        "Tồn của kỳ mới nhất ở mỗi kho, lấy từ báo cáo Xuất–Nhập–Tồn nhập từ hệ thống xí nghiệp: Tồn cuối = Tồn đầu + Nhập − Xuất. Dòng cuối cộng mọi kho.\n" +
        "Chọn Mở báo cáo XNT kho để xem chi tiết từng mã hàng. Chưa nạp báo cáo thì khối này để trống.",
    },
  ];

  if (ctx.can.demo) {
    steps.push({
      id: "demo-mode",
      target: "dashboard-demo-mode",
      optional: true,
      title: "Chế độ demo",
      body:
        "Nút Demo trên thanh tiêu đề chỉ quản trị viên thấy. Chế độ demo dùng để trình bày app cho người khác: cả app chuyển sang một bộ số trình diễn riêng, sinh từ số thật (ẩn tên đối tác và đổi giá, hoặc giữ tên thật khi trình bày nội bộ). Số thật của xưởng không bị đụng.\n" +
        "Chọn Tạo bộ mới để sinh bộ số rồi vào demo, hoặc Vào demo (giữ bộ cũ). Khi đang demo, dải \"ĐANG XEM DỮ LIỆU DEMO\" luôn hiện ở đầu trang và nút đổi thành DEMO, trong đó có Làm mới bộ demo và Thoát demo.",
    });
  }

  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để trở về đúng màn hình đang xem trước khi bắt đầu.\n" +
      "Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
  });
  return { title: "Tổng quan", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền. */
export const tourSpec: PageTourSpec = {
  pageId: "dashboard",
  build: () => buildDashboardTour({ can: { demo: true } }),
};
