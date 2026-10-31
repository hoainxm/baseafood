// ============================================================
// Tên file: src/features/orders/ordersTour.ts
// Tên tiếng Việt: Hướng dẫn từng bước của trang Đơn đặt — chọn đơn minh họa + dựng bước
// Description: Sales order page tour (docs/app-map/43-guided-tour.ba-spec.md). Picks a sample
//              order to open (like R4 of the export tour) and walks the planning work order of
//              ba-spec 34 F-N4…F-N6: create order → read statuses → compare needed vs available
//              → confirm full / export order (FIFO) → check lots by scanning. Write steps only
//              exist for users with that permission. Steps only change what is shown (R1).
// ============================================================
import type { OrderItem, SalesOrder, ExportOrder } from "@/types";
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

/**
 * Đơn minh họa: đơn chưa xuất xong có dòng hàng (ưu tiên đơn đã có lệnh xuất, rồi đơn đặt gần
 * nhất) → đơn có dòng hàng bất kỳ → đơn bất kỳ. Không có đơn ⇒ null.
 */
export function pickTourOrder(
  orders: readonly SalesOrder[],
  orderItems: readonly OrderItem[],
  exportOrders: readonly ExportOrder[],
): string | null {
  if (!orders.length) return null;
  const hasItems = (o: SalesOrder) => orderItems.some((d) => d.orderId === o.id);
  const hasExport = (o: SalesOrder) => exportOrders.some((l) => l.orderId === o.id);
  const rank = (o: SalesOrder) => [o.status === "closed" ? 1 : 0, hasItems(o) ? 0 : 1, hasExport(o) ? 0 : 1];
  const sorted = [...orders].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return b.orderDate.localeCompare(a.orderDate);
  });
  return sorted[0].id;
}

export interface OrdersTourContext {
  /** Đơn minh họa (id); null ⇒ chưa có đơn nào. */
  pick: string | null;
  can: {
    /** Tạo đơn, lập lệnh xuất. */
    create: boolean;
    /** Xác nhận đủ, kiểm lô bằng quét. */
    update: boolean;
    /** Bỏ (xóa) đơn. */
    delete: boolean;
  };
  /** Mở chi tiết đơn minh họa (chỉ đổi chỗ xem). */
  openOrder: (orderId: string) => void;
  /** Trả chi tiết đơn về như lúc bắt đầu hướng dẫn (chỉ đổi chỗ xem). */
  restoreView: () => void;
}

/** Dựng các bước theo thứ tự công việc (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildOrdersTour(ctx: OrdersTourContext): PageTour {
  const { pick, can } = ctx;
  const list = (s: TourStep): TourStep => ({ ...s, prepare: ctx.restoreView });
  const openSample = () => {
    if (pick) ctx.openOrder(pick);
  };
  const detail = (s: TourStep): TourStep => ({ ...s, prepare: openSample });

  const steps: TourStep[] = [
    list({
      id: "intro",
      title: "Giới thiệu trang Đơn đặt",
      body:
        "Đơn đặt là đơn xuất khẩu số lượng lớn của khách: mỗi đơn ghi các mặt hàng, quy cách và số kg khách cần. Phòng Kế hoạch dùng trang này để theo dõi hàng gom đủ chưa và lập lệnh xuất; thủ kho dùng để kiểm lô khi xếp container.\n" +
        "Trong chuỗi nhập hàng → sản xuất → kho → bán / xuất, trang nằm ở khâu xuất: hàng lấy từ tồn Kho dự trữ (lô đã nhập kho), lệnh xuất trừ tồn và tạo phiếu bán kênh Xuất khẩu ở Bán hàng. Phí xuất khẩu không tính ở đây.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    }),
  ];
  if (can.create) {
    steps.push(
      list({
        id: "create",
        target: "orders-create",
        optional: true,
        title: "Tạo đơn",
        body:
          "Khi khách đặt hàng, chọn Tạo đơn: chọn Khách hàng, rồi thêm từng mặt hàng cần — Thành phẩm · Quy cách · Khối lượng cần (kg) · Block cần. Quy cách phải khớp hàng trong kho (VD 18-20), để trống nếu không tách size.\n" +
          "Lưu xong, đơn ở trạng thái Đang gom và chi tiết đơn mở ngay bên dưới danh sách.",
      }),
    );
  }
  steps.push(
    list({
      id: "stats",
      target: "orders-stats",
      title: "Ba chỉ số đơn",
      body:
        "• Tổng số đơn: mọi đơn đã tạo.\n" +
        "• Đang gom hàng: đơn còn thiếu hàng, chưa xuất xong.\n" +
        "• Đã xuất xong: đơn đã xuất đủ kg cần ở mọi dòng.",
    }),
    list({
      id: "table",
      target: "orders-table",
      title: "Danh sách đơn và trạng thái",
      body:
        "Mỗi dòng là một đơn: Khách · Ngày đặt · Số dòng (số mặt hàng cần) · Trạng thái. Trạng thái có ba mức:\n" +
        "• Đang gom: đơn mới tạo, hoặc đã xuất một phần mà còn dòng thiếu.\n" +
        "• Đủ: người phụ trách đã chọn Xác nhận đủ — chỉ đổi trạng thái, chưa trừ tồn, chưa xuất.\n" +
        "• Đã xuất: lệnh xuất đã lấy đủ kg cần cho mọi dòng; đơn đóng, không lập lệnh xuất nữa.\n" +
        "Chọn Xem để mở chi tiết đơn" +
        (can.delete ? "; Bỏ để xóa đơn (có hỏi lại và Hoàn tác)." : ".") +
        " Phía trên bảng: lọc Trạng thái (kèm số đơn), Khách hàng và ô Tra khách, mặt hàng, quy cách, ghi chú; ba thẻ số tính theo phần đang lọc. Ô vuông đầu dòng dùng để chọn dòng rồi tô màu.",
    }),
  );

  if (!pick) {
    steps.push({
      id: "detail-overview",
      title: "Chi tiết đơn",
      body:
        "Khi đã có đơn, chọn Xem để mở chi tiết. Mỗi mặt hàng hiện Cần · Đã xuất · Khả dụng (tồn kho dự trữ cùng mặt hàng và quy cách) và thẻ Đủ hoặc Còn thiếu … kg.\n" +
        "Từ chi tiết đơn lập lệnh xuất: hàng lấy theo lô sản xuất sớm trước, lấy được tới đâu xuất tới đó, rồi kiểm lô bằng quét tem khi xếp container.",
    });
  } else {
    steps.push(
      list({
        id: "open-detail",
        target: "orders-view",
        optional: true,
        title: "Mở chi tiết đơn",
        body: "Chọn Xem ở một dòng để mở chi tiết đơn. Chọn Tiếp theo: hướng dẫn sẽ mở một đơn có sẵn để minh họa.",
      }),
      detail({
        id: "detail-lines",
        target: "orders-detail-lines",
        title: "Cần, đã xuất và khả dụng",
        body:
          "Đầu khung là khách, ngày đặt và trạng thái đơn. Mỗi dòng bên dưới là một mặt hàng cần:\n" +
          "• Cần: số kg khách đặt.\n" +
          "• Đã xuất: tổng kg các lệnh xuất đã lập cho mặt hàng và quy cách đó.\n" +
          "• Khả dụng: tồn kho dự trữ hiện có cùng mặt hàng và quy cách (đã trừ lệnh xuất, bán lẻ, đóng gói). Lô chờ nhập kho chưa tính.\n" +
          "Thẻ Đủ khi đã xuất bằng số cần; thẻ Còn thiếu … kg = Cần − Đã xuất. Khả dụng chưa đủ thì đợi thêm lô được duyệt nhập kho.",
      }),
    );
    if (can.update || can.create) {
      const parts: string[] = [];
      if (can.update)
        parts.push("• Xác nhận đủ: đánh dấu đơn đã gom đủ hàng — trạng thái sang Đủ, chưa trừ tồn, chưa xuất.");
      if (can.create)
        parts.push(
          "• Lệnh xuất (một phần được): hỏi lại trước khi làm. Hàng lấy theo lô sản xuất sớm trước, lấy được tới đâu xuất tới đó. Lệnh trừ tồn kho dự trữ và tạo một phiếu bán kênh Xuất khẩu ở Bán hàng (dòng chưa có giá — ghi giá ở Bán hàng). Không hoàn tác được; sai phải sửa tay ở cả hai sổ.\n" +
            "Xuất xong mà còn dòng thiếu ⇒ đơn về Đang gom; đủ mọi dòng ⇒ Đã xuất. Không còn tồn khả dụng ⇒ trang báo, không lập lệnh.",
        );
      steps.push(
        detail({
          id: "detail-actions",
          target: "orders-detail-actions",
          optional: true,
          title: "Xác nhận đủ và lệnh xuất",
          body: `Hai việc của đơn chưa xuất xong (đơn Đã xuất không còn các nút này):\n${parts.join("\n")}`,
        }),
      );
    }
    steps.push(
      detail({
        id: "export-list",
        target: "orders-export-list",
        optional: true,
        title: "Lệnh xuất đã lập",
        body:
          "Mỗi dòng là một lệnh xuất của đơn: ngày lệnh · tổng kg · số lô bán thành phẩm lệnh lấy." +
          (can.update
            ? "\nChọn Kiểm lô bằng quét khi xếp container: hộp liệt kê các lô của lệnh, mỗi lô Chưa quét hoặc Đã quét. Quét đúng lô ⇒ Đã quét (ghi lại, mở lại hộp vẫn còn); quét đủ ⇒ Đủ lô. Lô khác cùng mặt hàng và quy cách còn đủ tồn ⇒ hỏi Thay lô cho lệnh. Lô khác mặt hàng hoặc hết tồn ⇒ báo đỏ, đừng xếp lên xe."
            : ""),
      }),
    );
  }

  steps.push(
    list({
      id: "outro",
      title: "Hoàn tất hướng dẫn",
      body:
        "Sau lệnh xuất, phiếu bán Xuất khẩu nằm ở trang Bán hàng để ghi giá; tồn Kho dự trữ đã giảm đúng kg của lệnh.\n" +
        "Chọn Hoàn tất để trở về trang như lúc bắt đầu. Để xem lại, chọn nút ? trên thanh tiêu đề rồi chọn Bắt đầu hướng dẫn thao tác.",
    }),
  );
  // Thoát giữa chừng (Esc) cũng đóng đơn minh họa, trả đơn đang mở lúc bắt đầu (R5).
  return { title: "Đơn đặt", steps, onExit: ctx.restoreView };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền, có đơn minh họa. */
export const tourSpec: PageTourSpec = {
  pageId: "orders",
  build: () =>
    buildOrdersTour({
      pick: "o",
      can: { create: true, update: true, delete: true },
      openOrder: () => {},
      restoreView: () => {},
    }),
};
