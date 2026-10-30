// ============================================================
// Tên file: src/features/production-orders/productionOrderTour.ts
// Tên tiếng Việt: Hướng dẫn thao tác trang Lệnh sản xuất
// Description: Guided tour of /planning-production (ba-spec 43 + 48): order of work, order states,
//              stale-revision flag, imported material, shipment link. Tour never writes data.
// ============================================================
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";
import type { ProductionOrder } from "@/types";

/** Lệnh minh họa: ưu tiên lệnh đã phát hành, không có thì nháp. */
export function pickTourOrder(orders: readonly ProductionOrder[]): string | null {
  return (orders.find((o) => o.status === "issued") ?? orders.find((o) => o.status === "draft"))?.id ?? null;
}

export interface ProductionOrderTourContext {
  orderId: string | null;
  can: { write: boolean };
  openOrder: (orderId: string) => void;
  backToList: () => void;
}

export function buildProductionOrderTour(ctx: ProductionOrderTourContext): PageTour {
  const list = (s: TourStep): TourStep => ({ ...s, prepare: ctx.backToList });
  const dossier = (s: TourStep): TourStep => ({ ...s, optional: true, prepare: () => ctx.orderId && ctx.openOrder(ctx.orderId) });
  const steps: TourStep[] = [
    list({
      id: "intro",
      title: "Giới thiệu trang Lệnh sản xuất",
      body: ctx.can.write
        ? "Phòng Kế hoạch ra lệnh sản xuất từ dòng hàng hợp đồng xuất, theo mẫu QTI-KH-01-04.\n" +
          "Trình tự: lập lệnh (Nháp) → gắn NL nhập khẩu dự kiến → phát hành và gắn chuyến xuất → in lệnh cho Phòng Kỹ thuật. Không có bước duyệt.\n" +
          "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Esc để thoát."
        : "Trang này hiện các lệnh sản xuất Phòng Kế hoạch đã phát hành: làm mặt hàng gì, bao nhiêu thùng, ngày sản xuất, mã số lô, yêu cầu bao bì.\n" +
          "Lệnh nháp chưa hiện ở đây. Lệnh đã sửa có dấu Đã sửa lần n.\n" +
          "Trong lúc xem hướng dẫn, dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Esc để thoát.",
    }),
  ];
  if (ctx.can.write)
    steps.push(
      list({
        id: "create",
        target: "create-production-order",
        optional: true,
        title: "Lập lệnh sản xuất",
        body:
          "Chọn hợp đồng xuất (phải có bản hiệu lực), rồi chọn dòng hàng và gõ số thùng: tên, quy cách lấy sẵn từ hợp đồng, kg tự tính.\n" +
          "Ghi số lệnh, mã số lô, các ngày sản xuất, ngày giao. Hạn sử dụng tự tính từ tháng sản xuất đầu. Lưu xong lệnh ở trạng thái Nháp.",
      }),
    );
  steps.push(
    list({
      id: "tabs",
      target: "order-tabs",
      title: "Lệnh và Báo cáo",
      body:
        "Lệnh: danh sách lệnh của tháng đang xem.\n" +
        "Báo cáo: số theo tháng, quý hoặc năm — số lệnh, thùng, kg, theo khách và mặt hàng, NL nhập khẩu đã dành, lệnh cần chú ý. Lệnh đã hủy chỉ đếm, không cộng kg. Xuất Excel được.",
    }),
    list({
      id: "stats",
      target: "order-stats",
      optional: true,
      title: "Lệnh của tháng",
      body:
        "Lệnh xếp vào tháng theo ngày sản xuất đầu tiên. Đã phát hành: lệnh đã gửi phân xưởng, thủ kho.\n" +
        "Cần xử lý gồm lệnh còn nháp, lệnh theo bản hợp đồng trước (hợp đồng có phụ lục sau khi lệnh phát hành) và lệnh chưa gắn chuyến.",
    }),
    list({
      id: "search",
      target: "order-search",
      title: "Tra số lệnh",
      body: "Gõ số lệnh, mã số lô, số hợp đồng hoặc tên hàng để tìm ở mọi tháng.",
    }),
    list({
      id: "table",
      target: "order-table",
      optional: true,
      title: "Danh sách lệnh",
      body:
        "Mỗi dòng là một lệnh: khách, mặt hàng, thùng, kg, mã số lô, ngày sản xuất, ngày giao và trạng thái.\n" +
        "Trạng thái: Nháp (chưa gửi ai) → Đã phát hành (quản đốc, thủ kho đọc được). Đã hủy: có lý do, không tính vào số đã ra lệnh, ẩn sẵn — tháng có lệnh hủy thì chọn Xem n lệnh đã hủy để hiện; ô tra luôn tìm cả lệnh đã hủy. Chọn Mở để xem hồ sơ lệnh.",
    }),
    dossier({
      id: "status",
      target: "order-status",
      title: "Trạng thái lệnh",
      body:
        "Đã sửa lần n: lệnh đã phát hành rồi được sửa, có ghi lý do.\n" +
        "Theo bản HĐ trước: hợp đồng có bản mới sau khi lệnh phát hành. Sửa lệnh theo bản mới, hoặc chọn Giữ nguyên theo bản cũ và ghi lý do thì cờ hết.",
    }),
  );
  if (ctx.can.write)
    steps.push(
      dossier({
        id: "next",
        target: "order-next-step",
        title: "Việc tiếp",
        body: "Nút này nói việc tiếp của lệnh: Phát hành khi còn nháp, Sửa theo bản mới khi có cờ Theo bản HĐ trước, Gắn chuyến khi đã phát hành mà chưa gắn chuyến nào.",
      }),
    );
  steps.push(
    dossier({
      id: "summary",
      target: "order-summary",
      title: "Thông tin lệnh",
      body: "Khách, thị trường, mã số lô, các ngày sản xuất, ngày giao, hạn sử dụng, người và ngày phát hành. In lệnh ra A4 đúng mẫu QTI-KH-01-04, không có giá.",
    }),
    dossier({
      id: "lines",
      target: "order-lines",
      title: "Dòng hàng",
      body: "Tên hàng tiếng Việt kèm tên trên hợp đồng, quy cách, số thùng, kg và dòng Tổng. Đã ra lệnh vượt số kg hợp đồng quá dung sai thì có cảnh báo, vẫn lưu được.",
    }),
    dossier({
      id: "materials",
      target: "order-materials",
      title: "NL nhập khẩu dự kiến",
      body:
        "Mỗi dòng lệnh chọn lần nhập khẩu (trang Nhập khẩu, chỉ lần đã ghi thực nhập) và số kg NL dự kiến dùng. App hiện đã dành bao nhiêu so với thực nhập của lần nhập đó.\n" +
        "Đây chỉ là dành cho lệnh: không trừ kho, không ghi vào Nhập khẩu hay sổ kho.",
    }),
    dossier({
      id: "shipments",
      target: "order-shipments",
      title: "Chuyến xuất",
      body:
        "Lệnh gắn một hoặc nhiều chuyến của cùng hợp đồng. Lệnh đã phát hành thì bước Lệnh sản xuất của các chuyến đã gắn tự xong ở trang Xuất khẩu; phát hành chưa tick chuyến thì gắn sau.\n" +
        "Chuyến chưa có mã số lô nhận mã của lệnh; chuyến có mã khác thì hiện Lệch MSL. Hủy lệnh thì chuyến được nhả.",
    }),
  );
  return { title: "Lệnh sản xuất", steps, onExit: ctx.backToList };
}

export const tourSpec: PageTourSpec = {
  pageId: "planning-production",
  build: () => buildProductionOrderTour({ orderId: "o", can: { write: true }, openOrder: () => {}, backToList: () => {} }),
};
