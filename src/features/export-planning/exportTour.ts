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
        "Trang Xuất khẩu theo dõi từng hợp đồng xuất khẩu và từng chuyến hàng (một container, một xe tải hoặc một lô đóng ghép) cho tới khi đóng hợp đồng.\n" +
        "Hợp đồng đi qua 3 chặng rồi đóng: Nhân viên Kế hoạch lập hợp đồng và đính kèm hồ sơ → ghi chuyến → Trưởng / Phó phòng Kế hoạch duyệt cuối rồi đóng hợp đồng. Không có bước duyệt hợp đồng lúc lập.\n" +
        "Mỗi chuyến đi qua 6 bước: 1 Hợp đồng · 2 Lệnh sản xuất · 3 Bao bì · 4 Đóng cont · 5 Bộ chứng từ · 6 Gửi chứng từ · tiền về.\n" +
        "Trong lúc xem hướng dẫn, các nút trên trang tạm khóa và dữ liệu không thay đổi. Chọn Tiếp theo (phím →) để sang bước sau, Quay lại (phím ←) để xem lại, Esc để thoát.",
    }),
    plan({
      id: "tabs",
      target: "export-tabs",
      title: "Lịch xuất hàng, Hợp đồng, Báo cáo và Danh mục",
      body:
        "Lịch xuất hàng: các chuyến trong kỳ đang xem, nhóm theo khách hàng. Dùng hằng ngày để biết chuyến nào còn thiếu việc.\n" +
        "Hợp đồng: toàn bộ hợp đồng ở mọi tháng, lọc theo trạng thái. Dùng khi cần tìm một hợp đồng cụ thể.\n" +
        "Báo cáo: số theo tháng, quý hoặc năm — chuyến, kg thực xuất, giá trị, tiền về, tỉ lệ đúng hạn, hồ sơ còn kẹt ở bước nào và hợp đồng cần chú ý (quá hạn, lệch dung sai, còn tiền chưa về). Chỉ xem, không sửa số.\n" +
        "Danh mục: 6 danh sách chọn của Xuất khẩu (Cảng xếp, Cảng đích, Loại container, Tiền tệ, Loại chứng từ, Loại hàng; tài khoản ngân hàng in trên invoice quản lý ở Tài liệu công ty → Thông tin công ty) — thêm, sửa tên, xóa mục ở đây hoặc ngay trong ô chọn của phiếu. Hợp đồng, chuyến đã ghi giữ đúng chữ lúc ghi: đổi tên hay xóa mục không đổi hợp đồng cũ; hợp đồng cũ gõ khác danh sách hiện dòng Ngoài danh sách ở ô chọn.",
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
          "Khi có hợp đồng giấy mới, chọn Lập hợp đồng và nhập đúng như bản giấy. Phiếu gồm 6 phần: 1 Hợp đồng · 2 Điều khoản và thanh toán · 3 Chứng từ khách yêu cầu · 4 Dòng hàng · 5 File và ghi chú · 6 Lịch xuất hàng.\n" +
          "Có file Word (.docx, .doc) hoặc PDF có chữ của hợp đồng thì chọn ở khối Đọc file hợp đồng đầu phiếu: app điền sẵn ô còn trống (khách, số, ngày ký, điều khoản, dòng hàng), ô đang có giá trị khác file thì liệt kê để chọn Dùng giá trị file. App không tự lưu, không tự thêm khách hay mặt hàng vào danh mục. Phụ lục đọc được khi Ghi bản sửa: dòng nối theo size, dòng không có trên phụ lục vẫn giữ. Bản scan không đọc: đọc bản Word rồi đính bản scan đã ký ở mục File.\n" +
          "Ở phần 4, dòng chỉ khác size thì chọn Chép dòng: dòng mới nằm ngay dưới, giữ mọi ô, để trống Size để gõ size khác. Mỗi dòng có Chiều dài, Tỉ lệ râu / thân / cổ, Số miếng / kg và Ghi chú dòng như cột trên hợp đồng: các ô này tự chép sang Lệnh sản xuất (vào Quy cách và ghi chú của dòng lệnh). Phần 5 chọn được nhiều file: file đầu là hợp đồng, các file sau (phụ lục) vào Hồ sơ đính kèm.\n" +
          "Phần 6 Lịch xuất hàng (mặc định Có): app chia sẵn số chuyến = số cont, kg chia đều, tháng rải từ tháng sau ngày ký tới hạn giao, và chia lại khi bạn đổi số cont, ngày ký, hạn giao hay dòng hàng — cho tới khi bạn sửa tay một chuyến (Chia lại theo hợp đồng để bỏ chỗ đã sửa). Mỗi chuyến gõ được luôn Số booking, Ngày đóng cont, ETD, ETA nếu đã có (không bắt buộc): ngày đóng cont phải trước hoặc bằng ETD, ETA sau hoặc bằng ETD; gõ ngày đóng / ETD thì tháng của chuyến theo ngày đó. Chuyến đã có booking hoặc ngày thì hợp đồng không sửa thẳng / xóa được nữa (dùng Ghi bản sửa / Hủy). Lưu hợp đồng là ghi luôn các chuyến; chọn Không thì về sau tạo ở hồ sơ (khi chưa có chuyến). Lịch tạo được dù chưa đủ hồ sơ.\n" +
          "Cảng xếp, Cảng đích, Loại container, Tiền tệ chọn theo danh sách ở tab Danh mục; chưa có thì gõ tên rồi chọn Thêm mới ngay trong ô.\n" +
          "Hồ sơ hợp đồng mở ra ở trạng thái Chờ đính kèm: việc tiếp là đính kèm hợp đồng đã ký (và L/C nếu thanh toán L/C).\n" +
          "Muốn ra lệnh sản xuất luôn (khi được cấp quyền Lệnh sản xuất): chọn Lưu & lập lệnh sản xuất thay cho Lưu hợp đồng. Hợp đồng được lưu, rồi trang Lệnh sản xuất mở hộp lập lệnh với hợp đồng chọn sẵn. Cần ít nhất một dòng hàng đã chọn Mặt hàng (danh mục). Lịch xuất hàng ở phần 6 vẫn được ghi cùng hợp đồng.",
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
        "• Trễ hạn giao: chuyến có ngày on board (chưa có thì ETD) sau hạn giao của hợp đồng. Dòng phụ cho biết thêm số hợp đồng đã quá hạn mà chưa ghi chuyến.",
    }),
    plan({
      id: "shipment-table",
      target: "shipment-table",
      optional: true,
      title: "Chuyến theo ngày xuất",
      body:
        "Chuyến của kỳ xếp theo ngày xuất: ngày đóng cont, chưa có thì ETD. Chỉ hiện ngày có chuyến, từ sớm tới muộn. Mỗi ngày ghi số khách · số chuyến · kg kế hoạch, tên các khách, và thẻ n trễ (trễ hạn giao) · n còn thiếu (chưa đủ hồ sơ).\n" +
        "Cột trái là các ngày, cột phải là chi tiết ngày đang chọn: chuyến gom theo khách, mỗi dòng là một chuyến (mã lô, loại chuyến, số hợp đồng, ngày đóng cont và ETD, kg kế hoạch và thực xuất). Chọn ngày khác ở cột trái thì cột phải đổi theo. Ngày có chuyến gần nhất từ hôm nay được chọn sẵn; kỳ đã qua thì chọn ngày đầu kỳ.\n" +
        "Trên điện thoại chỉ hiện danh sách ngày; chạm một ngày để xem chi tiết, chọn Quay lại để về danh sách.\n" +
        "Chuyến mới có tháng kế hoạch, chưa có ngày đóng cont hay ETD, nằm ở mục Chưa có ngày cuối cột trái. Ô vuông đầu dòng dùng để chọn dòng rồi tô màu.",
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
      title: "Hợp đồng chưa ghi đủ chuyến",
      body:
        "Danh sách hợp đồng có hạn giao trong kỳ (hoặc đã quá hạn) nhưng chưa xếp đủ chuyến. Cột Còn thiếu ghi số kg hoặc số container chưa ghi chuyến; thẻ Quá hạn cho biết hợp đồng đã quá hạn giao.",
    }),
  );

  if (!pick) {
    steps.push({
      id: "dossier-overview",
      title: "Hồ sơ hợp đồng",
      body:
        "Khi đã có hợp đồng, chọn Mở để vào hồ sơ. Hồ sơ gồm: trạng thái hợp đồng (Chờ đính kèm, Đang ghi chuyến, Chờ duyệt cuối, Đã đóng HĐ, Đã hủy), việc tiếp theo (Đính kèm hồ sơ → Ghi chuyến → Duyệt cuối) và 6 bước của từng chuyến.\n" +
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
          "• Chờ đính kèm: vừa lập, hoặc còn thiếu hồ sơ bắt buộc (thẻ Thiếu ghi rõ loại). Chưa ghi chuyến lẻ được, nhưng tạo được lịch xuất hàng (chuyến dự kiến) khi hợp đồng chưa có chuyến nào.\n" +
          "• Đang ghi chuyến: đủ hồ sơ, đang ghi và theo dõi các chuyến.\n" +
          "• Chờ duyệt cuối: mọi chuyến đủ hồ sơ và số thực xuất nằm trong dung sai cả kg lẫn tiền (hệ thống tự tính), chờ Trưởng / Phó phòng xem lại.\n" +
          "• Đã đóng HĐ: đã duyệt cuối, hoặc đóng sớm kèm lý do.\n" +
          "• Đã hủy: kèm lý do hủy.\n" +
          "Thẻ cảnh báo đi kèm: Quá hạn giao · Còn … chưa ghi chuyến · … dòng hàng chưa nối danh mục · Ngoài dung sai · Duyệt cuối trả về.",
      }),
      dossier({
        id: "contract-flow",
        target: "contract-flow",
        optional: true,
        title: "Thanh chặng của hợp đồng",
        body:
          "Ba chặng theo thứ tự: Đính kèm · Ghi chuyến · Duyệt cuối, cuối cùng là Đóng HĐ. Chặng xong có dấu tích xanh, chặng đang ở tô vàng và ghi ai làm.\n" +
          "Đính kèm, Ghi chuyến: Nhân viên Kế hoạch. Duyệt cuối: Trưởng phòng hoặc Phó phòng Kế hoạch. Rê chuột (hoặc chạm) vào một chặng để xem cần làm gì.",
      }),
      dossier({
        id: "next-action",
        target: "next-action",
        optional: true,
        title: "Việc tiếp theo",
        body:
          "Nút chính là việc cần làm tiếp của hợp đồng, theo chặng và theo vai trò: Đính kèm hồ sơ · Ghi chuyến · Duyệt cuối. Chặng không phải việc của bạn thì hiện thẻ chờ, ví dụ \"Chờ Trưởng / Phó phòng Kế hoạch duyệt cuối để đóng hợp đồng\".\n" +
          "Lập lệnh sản xuất (khi được cấp quyền Lệnh sản xuất): mở trang Lệnh sản xuất với hợp đồng này chọn sẵn — làm được ngay khi vừa lập hợp đồng, không cần chờ đính kèm hay ghi chuyến; dòng hàng phải nối mặt hàng danh mục. Ghi chuyến xong thì gắn lệnh vào chuyến ở bước Lệnh sản xuất.\n" +
          "Thao tác khác gồm các việc ít dùng: sửa hợp đồng (khi chưa chuyến nào có mã lô, booking, ngày, số cont hay file — sửa thẳng bản đang dùng), ghi bản sửa (khi đã có chuyến ghi thông tin — bản mới có hiệu lực ngay, bản cũ giữ để tra), gia hạn, đính kèm thêm, ghi thêm chuyến, ghi tiền cọc, duyệt cuối đóng sớm (kèm lý do), hủy, xóa.\n" +
          "Cả hai cách sửa đều đổi được Số hợp đồng (không trùng số với hợp đồng khác của cùng khách); Khách đổi được tới khi một chuyến xong bước 4 Đóng cont. Hợp đồng Đã đóng hoặc Đã hủy thì khóa, Trưởng / Phó phòng mở lại. Mỗi lần lưu, nhật ký ghi từng ô đổi: cũ → mới.",
      }),
      dossier({
        id: "dossier-summary",
        target: "dossier-summary",
        title: "Tóm tắt hợp đồng",
        body:
          "• Hạn giao: ghi \"đã gia hạn\" nếu hợp đồng được gia hạn.\n" +
          "• Tổng hợp đồng: kg và tiền theo bản đang hiệu lực.\n" +
          "• Dung sai: áp cho cả lượng và tiền.\n" +
          "• Chuyến: số chuyến đã ghi trên số container của hợp đồng.\n" +
          "• Thực xuất và tiền về: cộng từ Commercial Invoice của các chuyến.",
      }),
      dossier({
        id: "contract-attachments",
        target: "contract-attachments",
        optional: true,
        title: "Hồ sơ đính kèm",
        body:
          "Chặng Đính kèm của hợp đồng. Thẻ đầu khối ghi từng loại hồ sơ bắt buộc: Hợp đồng đã ký (luôn có), L/C (khi thanh toán bằng L/C), mỗi loại ở một trong ba tình trạng: Có file · Bổ sung sau · Thiếu.\n" +
          "Chưa có hợp đồng ký hoặc L/C chưa về: chọn Chưa có — bổ sung sau, ghi lý do. Hợp đồng ghi chuyến và làm các bước tiếp được ngay; bước 1 của chuyến ghi chờ HĐ ký / chờ L/C. Duyệt cuối, đóng hợp đồng vẫn cần đủ file. Đính file đúng loại thì dấu tự gỡ; Bỏ ghi bổ sung sau thì loại về Thiếu.\n" +
          "Nhân viên Kế hoạch chọn Đính kèm file, chọn loại hồ sơ rồi chọn một hay nhiều file. Proforma invoice và hồ sơ khác đính được nhưng không bắt buộc; chọn Hồ sơ khác thì phải ghi Tên hồ sơ.\n" +
          "Không còn loại nào Thiếu (đã có file hoặc ghi bổ sung sau) thì hợp đồng chuyển Đang ghi chuyến và nút Ghi chuyến mới hiện. Gỡ file nhầm bằng nút thùng rác, có Hoàn tác.",
      }),
      dossier({
        id: "shipment-card",
        target: "shipment-card",
        optional: true,
        title: "Thông tin và trạng thái chuyến",
        body:
          "Hợp đồng có nhiều chuyến thì chọn chuyến ở danh sách phía trên; mỗi dòng có thanh tiến độ và bước tiếp theo của chuyến.\n" +
          "Thẻ chuyến ghi booking, ngày đóng cont, ETD và ETA, tàu, số container và seal, kg kế hoạch và kg thực xuất.\n" +
          "File booking: đính bản xác nhận booking của hãng tàu ngay ở ô Số booking khi Ghi chuyến, hoặc ở hàng File booking của bước Đóng cont (booking sửa đổi thì đính thêm, bản mới nhất ở đầu). File booking chỉ để xem, không làm bước nào tự xong; người chỉ đóng hàng không thấy file này.\n" +
          "Thẻ trạng thái chuyến: Đang làm · xong k/5 bước bắt buộc (bước 1 đến 5; bước 6 không bắt buộc) · Đủ hồ sơ · Trễ hạn giao n ngày · Đã hủy.\n" +
          "Hàng 6 bước bên dưới: chọn một bước để chuyển nhanh tới phần đó.\n" +
          "Khối Hàng của chuyến (dưới thẻ): chi tiết từng mặt hàng đóng vào chuyến. Nhập hàng của chuyến (Kế hoạch, không bắt buộc): ghi số thùng / bó kế hoạch cho từng dòng hàng của hợp đồng (để trống = không đóng dòng đó), kg cả bì, hạn dùng. Bộ phận đóng cont đóng xong chọn Điền số thực đóng ở hàng Số lượng thực đóng của bước Đóng cont, không cần chờ Kế hoạch: chuyến chưa có hàng thì hộp lấy sẵn các dòng hàng của hợp đồng, dòng không đóng vào chuyến để trống. Chưa làm = chưa điền dòng nào · Đang làm = điền một phần · Xong = mọi dòng có số; hàng này không chặn bước Đóng cont xong. Bộ phận chứng từ lấy số thực đóng làm invoice và packing list, dòng chưa điền dùng số kế hoạch.",
      }),
      dossier({
        id: "current-step",
        target: "current-step",
        optional: true,
        title: "Bước đang làm",
        body:
          "Bước có viền xanh là bước đầu tiên chưa xong. Đầu mỗi bước ghi \"Xong\", hoặc \"Còn thiếu\" kèm tên các mục chưa xong.\n" +
          "Mỗi hàng trong bước là một mục cần làm. Ví dụ bước Đóng cont theo đúng trình tự đóng hàng: file booking, lệnh xuất, số cont và seal (số container 11 ký tự: 4 chữ cái + 7 chữ số), số lượng thực đóng (đính ảnh tờ đếm), hình ảnh bao bì + cân gross, sơ đồ container, hình ảnh đóng cont, tờ khai. Hai mục ảnh thêm có ảnh là Xong và không bắt buộc cho bước Đóng cont.",
      }),
      dossier({
        id: "item-status",
        target: "item-status",
        optional: true,
        title: "Trạng thái mục và file",
        body:
          "Mỗi mục có một thẻ trạng thái: Chưa làm · Đang làm · Xong · Không áp dụng.\n" +
          "Mục chỉ được đánh dấu Xong khi đủ giấy tờ:\n" +
          "• Bước 1 Hợp đồng: tự Xong khi hợp đồng đủ hồ sơ đính kèm bắt buộc.\n" +
          "• Lệnh sản xuất: tự Xong khi có lệnh đã phát hành gắn chuyến — ngay tại bước chọn Lập lệnh sản xuất hoặc Gắn lệnh có sẵn (lệnh nháp chưa tính); không thì có file và mọi dòng hàng của hợp đồng đã nối danh mục.\n" +
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
            "Lập invoice từ app (chuyến đã có hàng của chuyến): trong mục Commercial Invoice chọn Tài khoản nhận tiền, Điều kiện giao, đơn giá từng dòng (mặc định theo hợp đồng), thông tin riêng khách yêu cầu; chọn Tải file Invoice (PDF) để có bản in sẵn theo mẫu, hoặc Tải file Word / Tải file Excel để sửa tiếp; mỗi bản gồm Invoice, Packing list và Expiry date list khi có hạn dùng. Ô tổng còn trống thì tự điền theo invoice lập; phần lập ghi vào sổ khi chọn Lưu.\n" +
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
        title: "Điều khoản, dòng hàng, nhật ký",
        body:
          "Chọn tiêu đề của mỗi phần để mở hoặc gập.\n" +
          "• Điều khoản: Incoterm, cảng, thanh toán, hạn giao, chứng từ khách yêu cầu. Rê chuột vào nút ? hoặc chữ gạch chấm (ETD, L/C, B/L…) để xem nghĩa từ viết tắt.\n" +
          "• Dòng hàng: từng mặt hàng, số lượng, kg, giá. Nối mặt hàng để gắn dòng hàng với danh mục (cần trước khi Lệnh sản xuất xong).\n" +
          "• Các bản hợp đồng · duyệt cuối: lịch sử bản sửa (bản mới nhất đang hiệu lực) và các lần duyệt cuối.\n" +
          "• Nhật ký thao tác: ai làm gì, lúc nào trên hợp đồng — chỉ thêm, không sửa hay xóa được.",
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
