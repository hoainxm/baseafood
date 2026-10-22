// ============================================================
// Tên file: src/features/export-planning/exportTour.ts
// Tên tiếng Việt: Hướng dẫn từng bước của trang Xuất khẩu — chọn hồ sơ minh họa + dựng bước
// Description: Export page tour (docs/app-map/43-guided-tour.ba-spec.md): picks a sample
//              contract to walk through (R4) and builds the ordered steps following the work
//              order of ba-spec 41 (R2), dropping steps the user cannot use (AC-5). Steps only
//              change what is shown (URL); nothing is written (R1).
// ============================================================
import {
  contractState,
  effectiveDeadline,
  isShipmentClosed,
  openShipmentsOf,
  type ExportData,
} from "@/lib/exportPlanning";
import type { PageTour, PageTourSpec, TourStep } from "@/lib/guidedTour";

export interface TourContractPick {
  contractId: string;
  /** Chuyến minh họa; "" ⇒ HĐ chưa có chuyến. */
  shipmentId: string;
}

/**
 * Hồ sơ minh họa (R4): HĐ đang chạy có chuyến chưa đủ hồ sơ → HĐ có chuyến bất kỳ → HĐ bất kỳ
 * (ưu tiên còn chạy, hạn giao gần nhất). HĐ đã hủy chỉ khi không còn HĐ nào khác. Rỗng ⇒ null.
 */
export function pickTourContract(data: ExportData, opts: { filesAvailable: boolean }): TourContractPick | null {
  if (!data.contracts.length) return null;
  const live = data.contracts.filter((c) => contractState(data, c.id, opts) !== "cancelled");
  const byDeadline = <T extends { id: string }>(xs: readonly T[]) =>
    [...xs].sort((a, b) => (effectiveDeadline(data, a.id) || "9999").localeCompare(effectiveDeadline(data, b.id) || "9999"));

  for (const c of byDeadline(live)) {
    const unfinished = openShipmentsOf(data, c.id).find((s) => !isShipmentClosed(data, s, opts));
    if (unfinished) return { contractId: c.id, shipmentId: unfinished.id };
  }
  for (const c of [...byDeadline(live), ...byDeadline(data.contracts.filter((c) => !live.includes(c)))]) {
    const open = openShipmentsOf(data, c.id);
    const any = open[0] ?? data.shipments.find((s) => s.contractId === c.id);
    if (any) return { contractId: c.id, shipmentId: any.id };
  }
  const first = byDeadline(live)[0] ?? data.contracts[0];
  return { contractId: first.id, shipmentId: "" };
}

export interface ExportTourContext {
  pick: TourContractPick | null;
  can: {
    /** Lập hợp đồng. */
    create: boolean;
    /** Cập nhật mục của bước. */
    update: boolean;
    /** Xem tiền về (bước 6). */
    payments: boolean;
  };
  /** Mở hồ sơ minh họa (chỉ đổi đường dẫn). */
  openDossier: (contractId: string, shipmentId: string) => void;
  /** Về Lịch xuất hàng (chỉ đổi đường dẫn). */
  backToPlan: () => void;
}

/** Dựng các bước theo thứ tự công việc (R2). Bước tùy chọn tự bỏ khi chỗ không có (R3). */
export function buildExportTour(ctx: ExportTourContext): PageTour {
  const { pick, can } = ctx;
  const plan = (s: TourStep): TourStep => ({ ...s, prepare: ctx.backToPlan });
  const dossier = (s: TourStep): TourStep => ({ ...s, prepare: () => pick && ctx.openDossier(pick.contractId, pick.shipmentId) });

  const steps: TourStep[] = [
    plan({
      id: "intro",
      title: "Giới thiệu trang Xuất khẩu",
      body:
        "Trang Xuất khẩu theo dõi từng hợp đồng xuất khẩu và từng chuyến hàng (một container, một xe tải hoặc một lô đóng ghép) cho tới khi hợp đồng xuất đủ.\n" +
        "Mỗi chuyến đi qua 6 bước: 1 Hợp đồng · 2 Lệnh sản xuất · 3 Bao bì · 4 Đóng cont · 5 Bộ chứng từ · 6 Gửi chứng từ · tiền về.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    }),
    plan({
      id: "tabs",
      target: "export-tabs",
      title: "Lịch xuất hàng, Hợp đồng và Báo cáo",
      body:
        "Lịch xuất hàng: các chuyến trong kỳ đang xem, nhóm theo khách hàng. Dùng hằng ngày để biết chuyến nào còn thiếu việc.\n" +
        "Hợp đồng: toàn bộ hợp đồng ở mọi tháng, lọc theo trạng thái. Dùng khi cần tìm một hợp đồng cụ thể.\n" +
        "Báo cáo: số theo tháng, quý hoặc năm — chuyến, kg thực xuất, giá trị, tiền về, tỉ lệ đúng hạn, hồ sơ còn kẹt ở bước nào và hợp đồng cần chú ý (quá hạn, lệch dung sai, còn tiền chưa về). Chỉ xem, không sửa số.",
    }),
  ];
  if (can.create) {
    steps.push(
      plan({
        id: "create-contract",
        target: "create-contract",
        optional: true,
        title: "Lập hợp đồng",
        body:
          "Khi có hợp đồng giấy mới, chọn Lập hợp đồng và nhập đúng như bản giấy. Phiếu gồm 5 phần: 1 Hợp đồng · 2 Điều khoản và thanh toán · 3 Chứng từ khách yêu cầu · 4 Dòng hàng · 5 File và ghi chú.\n" +
          "Sau khi lưu, hồ sơ hợp đồng mở ra ở trạng thái Chờ duyệt.",
      }),
    );
  }
  steps.push(
    plan({
      id: "period",
      target: "period-filter",
      title: "Kỳ xem",
      body:
        "Chọn xem theo Tháng, Tuần hoặc Ngày (một khoảng ngày). Dùng ‹ › để sang kỳ trước hoặc kỳ sau, Nay để về kỳ hiện tại.\n" +
        "Chuyến được xếp vào kỳ theo ngày đóng cont; chưa có ngày đóng thì theo ETD, chưa có ETD thì theo tháng kế hoạch.",
    }),
    plan({
      id: "search",
      target: "customer-search",
      title: "Khách hàng và tra cứu",
      body:
        "Khách hàng: chỉ hiện chuyến của một khách; bốn chỉ số bên dưới cũng tính theo khách đã chọn.\n" +
        "Tra cứu: nhập mã lô, số booking, số container, số invoice, số B/L, số hợp đồng hoặc số PO của khách. Kết quả tìm trong mọi kỳ, không chỉ kỳ đang xem.\n" +
        "Xuất Excel (khi được cấp quyền): tải danh sách chuyến của kỳ theo mẫu sổ Kế hoạch xuất hàng.",
    }),
    plan({
      id: "stats",
      target: "plan-stats",
      title: "Bốn chỉ số của kỳ",
      body:
        "• Chuyến trong kỳ: số chuyến và tổng kg kế hoạch.\n" +
        "• Chuyến đủ hồ sơ: chuyến đã xong bước 1 đến 5.\n" +
        "• Chuyến còn thiếu: chuyến chưa xong ít nhất một bước trong bước 1 đến 5.\n" +
        "• Trễ hạn giao: chuyến có ngày on board (chưa có thì ETD) sau hạn giao của hợp đồng. Dòng phụ cho biết thêm số hợp đồng đã quá hạn mà chưa lên chuyến.",
    }),
    plan({
      id: "shipment-table",
      target: "shipment-table",
      optional: true,
      title: "Bảng chuyến theo khách",
      body:
        "Mỗi khách hàng có một bảng; mỗi dòng là một chuyến: mã lô và loại chuyến, số hợp đồng, ngày đóng cont và ETD, kg kế hoạch và kg thực xuất (theo Commercial Invoice).\n" +
        "Chọn tên cột để sắp xếp. Ô vuông đầu dòng dùng để chọn dòng rồi tô màu, đánh dấu những dòng đã kiểm.",
    }),
    plan({
      id: "shipment-progress",
      target: "shipment-progress",
      optional: true,
      title: "Đọc cột Tiến độ",
      body:
        "Thanh 6 khúc ứng với 6 bước của chuyến: xanh lá là Xong, cam là Đang làm, xám là Chưa làm, xám nhạt là Không áp dụng.\n" +
        "Dòng \"Bước tiếp\" ghi bước cần làm và các mục còn thiếu của bước đó. Khi xong bước 1 đến 5, dòng này đổi thành \"Đủ hồ sơ\".\n" +
        "Thẻ Trễ hạn giao n ngày: ngày on board (chưa có thì ETD) sau hạn giao n ngày. Thẻ Chờ booking: chuyến chưa có số booking và số container.",
    }),
    plan({
      id: "pending-contracts",
      target: "pending-contracts",
      optional: true,
      title: "Hợp đồng chưa lên đủ chuyến",
      body:
        "Danh sách hợp đồng có hạn giao trong kỳ (hoặc đã quá hạn) nhưng chưa xếp đủ chuyến. Cột Còn thiếu ghi số kg hoặc số container chưa lên chuyến; thẻ Quá hạn cho biết hợp đồng đã quá hạn giao.",
    }),
  );

  if (!pick) {
    steps.push({
      id: "dossier-overview",
      title: "Hồ sơ hợp đồng",
      body:
        "Khi đã có hợp đồng, chọn Mở để vào hồ sơ. Hồ sơ gồm: trạng thái hợp đồng (Chờ duyệt, Đã duyệt, Đã xuất đủ, Đã chốt HĐ, Đã hủy), việc tiếp theo (Ghi kết quả duyệt, rồi Lên chuyến) và 6 bước của từng chuyến.\n" +
        "Mỗi mục trong bước có trạng thái Chưa làm, Đang làm, Xong hoặc Không áp dụng. Mục chỉ được đánh dấu Xong khi đủ file và số chứng từ.",
    });
  } else {
    steps.push(
      plan({
        id: "open-dossier",
        target: "open-dossier",
        optional: true,
        title: "Mở hồ sơ hợp đồng",
        body: "Chọn Mở ở một dòng để vào hồ sơ hợp đồng, nơi cập nhật từng bước của chuyến. Chọn Tiếp theo: hướng dẫn sẽ mở một hồ sơ có sẵn để minh họa.",
      }),
      dossier({
        id: "contract-status",
        target: "contract-status",
        title: "Trạng thái hợp đồng",
        body:
          "Thẻ đầu tiên dưới số hợp đồng là trạng thái:\n" +
          "• Chờ duyệt: đã lập, chưa ghi kết quả Ban Giám đốc ký duyệt.\n" +
          "• Đã duyệt: có bản hợp đồng được duyệt, đang thực hiện.\n" +
          "• Đã xuất đủ: mọi chuyến đủ hồ sơ và số thực xuất nằm trong dung sai cả kg lẫn tiền (hệ thống tự tính).\n" +
          "• Đã chốt HĐ: đóng thủ công, kèm lý do chốt.\n" +
          "• Đã hủy: kèm lý do hủy.\n" +
          "Thẻ cảnh báo đi kèm: Quá hạn giao · Còn … chưa lên chuyến · … dòng hàng chưa nối danh mục · Bản sửa chờ duyệt · Ngoài dung sai.",
      }),
      dossier({
        id: "next-action",
        target: "next-action",
        optional: true,
        title: "Việc tiếp theo",
        body:
          "Nút chính là việc cần làm tiếp của hợp đồng: Ghi kết quả duyệt khi hợp đồng đang chờ duyệt, Lên chuyến khi đã duyệt mà chưa đủ chuyến. Không còn việc thì nút chính không hiện.\n" +
          "Thao tác khác gồm các việc ít dùng: ghi bản sửa, gia hạn, lên chuyến, ghi tiền cọc, chốt hợp đồng, hủy, xóa.",
      }),
      dossier({
        id: "dossier-summary",
        target: "dossier-summary",
        title: "Tóm tắt hợp đồng",
        body:
          "• Hạn giao: ghi \"đã gia hạn\" nếu hợp đồng được gia hạn.\n" +
          "• Tổng hợp đồng: kg và tiền theo bản đang hiệu lực.\n" +
          "• Dung sai: áp cho cả lượng và tiền.\n" +
          "• Chuyến: số chuyến đã lên trên số container của hợp đồng.\n" +
          "• Thực xuất và tiền về: cộng từ Commercial Invoice của các chuyến.",
      }),
      dossier({
        id: "shipment-list",
        target: "shipment-list",
        optional: true,
        title: "Danh sách chuyến",
        body: "Hợp đồng có nhiều chuyến thì chọn chuyến cần xem ở đây. Mỗi dòng có thanh tiến độ và bước tiếp theo của chuyến đó.",
      }),
      dossier({
        id: "shipment-card",
        target: "shipment-card",
        optional: true,
        title: "Thông tin và trạng thái chuyến",
        body:
          "Thẻ chuyến ghi booking, ngày đóng cont, ETD và ETA, tàu, số container và seal, kg kế hoạch và kg thực xuất.\n" +
          "Thẻ trạng thái chuyến: Đang làm · xong k/5 bước bắt buộc (bước 1 đến 5; bước 6 không bắt buộc) · Đủ hồ sơ · Trễ hạn giao n ngày · Đã hủy.\n" +
          "Hàng 6 bước bên dưới: chọn một bước để chuyển nhanh tới phần đó.",
      }),
      dossier({
        id: "current-step",
        target: "current-step",
        optional: true,
        title: "Bước đang làm",
        body:
          "Bước có viền xanh là bước đầu tiên chưa xong. Đầu mỗi bước ghi \"Xong\", hoặc \"Còn thiếu\" kèm tên các mục chưa xong.\n" +
          "Mỗi hàng trong bước là một mục cần làm. Ví dụ bước Đóng cont gồm: số cont và seal, sơ đồ container, hình ảnh đóng cont, tờ khai, lệnh xuất.",
      }),
      dossier({
        id: "item-status",
        target: "item-status",
        optional: true,
        title: "Trạng thái mục và file",
        body:
          "Mỗi mục có một thẻ trạng thái: Chưa làm · Đang làm · Xong · Không áp dụng.\n" +
          "Mục chỉ được đánh dấu Xong khi đủ giấy tờ:\n" +
          "• Lệnh sản xuất: có file, hợp đồng đã duyệt và mọi dòng hàng đã nối danh mục.\n" +
          "• Bao bì: có file hoặc ghi chú.\n" +
          "• Sơ đồ container, Hình ảnh đóng cont: tự Xong khi có file.\n" +
          "• Tờ khai: có số tờ khai và file. Lệnh xuất: có file đã có chữ ký Ban Giám đốc.\n" +
          "• Chứng từ bước 5: có số, ngày và file (chứng từ công ty tự cấp không bắt số).\n" +
          "Không áp dụng phải ghi lý do. Thẻ Dùng chung: mục lấy từ chuyến khác cùng hợp đồng hoặc cùng booking.",
      }),
    );
    if (can.update) {
      steps.push(
        dossier({
          id: "step-update",
          target: "step-update",
          optional: true,
          title: "Cập nhật mục",
          body:
            "Chọn Cập nhật ở hàng của mục để ghi trạng thái, số, ngày, ghi chú và đính file. Ở bước Đóng cont: Sửa số cont để điền số container và seal; Đính sơ đồ, Đính ảnh để tải file lên.\n" +
            "Commercial Invoice: đính file Excel gốc hoặc PDF xuất từ Excel thì hệ thống tự đọc — điền số, ngày, tổng thùng, kg, tiền còn trống; ô đã có số khác thì báo để chọn, không tự ghi đè; nối từng dòng với mặt hàng để trích xuất tên hàng của khách khi Lưu. Bản scan (ảnh) không đọc, vẫn đính làm bằng chứng.\n" +
            "Khi mọi mục của bước là Xong hoặc Không áp dụng, bước chuyển xanh và thanh tiến độ thêm một khúc.",
        }),
      );
    }
    if (can.payments) {
      steps.push(
        dossier({
          id: "payments",
          target: "payments",
          optional: true,
          title: "Bước 6: gửi chứng từ và tiền về",
          body:
            "Ghi gửi chứng từ: ngày gửi bộ chứng từ cho khách.\n" +
            "Ghi tiền về: mỗi lần khách thanh toán (ngày, số tiền, kênh).\n" +
            "Dòng \"Tiền về\" so số đã về với số tiền trên Commercial Invoice của chuyến. Bước 6 không tính vào Đủ hồ sơ của chuyến.",
        }),
      );
    }
    steps.push(
      dossier({
        id: "contract-details",
        target: "contract-details",
        optional: true,
        title: "Điều khoản, dòng hàng, các bản hợp đồng",
        body:
          "Chọn tiêu đề của mỗi phần để mở hoặc gập.\n" +
          "• Điều khoản: Incoterm, cảng, thanh toán, hạn giao, chứng từ khách yêu cầu.\n" +
          "• Dòng hàng: từng mặt hàng, số lượng, kg, giá. Nối mặt hàng để gắn dòng hàng với danh mục (cần trước khi Lệnh sản xuất xong).\n" +
          "• Các bản hợp đồng và kết quả duyệt: lịch sử bản sửa và các lần Ban Giám đốc duyệt.",
      }),
    );
  }

  steps.push({
    id: "outro",
    title: "Hoàn tất hướng dẫn",
    body:
      "Chọn Hoàn tất để trở về đúng màn hình đang xem trước khi bắt đầu.\n" +
      "Để xem lại, chọn Hướng dẫn thao tác ở đầu trang hoặc nút ? trên thanh tiêu đề.",
  });
  return { title: "Xuất khẩu", steps };
}

/** Bản khai cho test quét chung (ba-spec 43 v4 R13): đủ quyền, có hồ sơ minh họa. */
export const tourSpec: PageTourSpec = {
  pageId: "planning-export",
  build: () =>
    buildExportTour({
      pick: { contractId: "c", shipmentId: "s" },
      can: { create: true, update: true, payments: true },
      openDossier: () => {},
      backToPlan: () => {},
    }),
};
