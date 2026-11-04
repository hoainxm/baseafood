// ============================================================
// Tên file: src/features/shared/guides/exportPlanningGuide.tsx
// Tên tiếng Việt: Hộp "Hướng dẫn: Xuất khẩu" (nút "?" ở thanh tiêu đề)
// Description: Flow-style guide for /planning-export (ba-spec 43 v5 + 41 §0a v9): your work, 7 steps
//              with who + done condition, contract states, shipment progress bar, who-does-what.
//              Tour: export-planning/exportTour.ts.
// ============================================================
import { CONTRACT_STATE_LABELS, ITEM_STATE_LABELS, STEP_TITLES } from "@/lib/exportPlanning";
import type { PageGuide } from "../guideContent";
import type { GuideActor, GuideFlowStep, GuideState } from "./flowGuide";
import { GuideActors, GuideFlow, GuideProgressSample, GuideStates, GuideYourWork } from "./FlowGuideBlocks";
import { GuideList, GuideSection } from "./parts";

export const EXPORT_GUIDE_ACTORS: readonly GuideActor[] = [
  { id: "planner", name: "Nhân viên Kế hoạch", roles: ["planner"] },
  {
    id: "head",
    name: "Trưởng / Phó phòng Kế hoạch",
    note: "Làm được mọi việc của Nhân viên Kế hoạch, thêm duyệt cuối và mở lại hợp đồng.",
    roles: ["planning-head", "planning-deputy"],
  },
  {
    id: "loader",
    name: "Người đóng hàng",
    note: "Thủ kho, Quản đốc, Phó quản đốc. Mở trang chỉ thấy chuyến sắp / vừa đóng cont.",
    roles: ["warehouse-keeper", "frozen-workshop-manager", "fish-workshop-manager", "dried-workshop-manager", "vice-manager"],
  },
  { id: "accounting", name: "Kế toán", note: "Kế toán trưởng, Kế toán. Xem được hợp đồng và giá.", roles: ["chief-accountant", "accountant"] },
  { id: "board", name: "Ban giám đốc", note: "Xem hợp đồng, chuyến và giá.", roles: ["director", "vice-director"], viewOnly: true },
];

const KH = ["planner", "head"] as const;

export const EXPORT_GUIDE_STEPS: readonly GuideFlowStep[] = [
  {
    id: "create",
    title: "Lập hợp đồng",
    needs: ["export-plans", "create"],
    actors: KH,
    text: "Chọn Lập hợp đồng, nhập đúng như bản giấy: khách, dòng hàng, giá, điều kiện giao, hạn giao, hạn hợp đồng (ngày hết hiệu lực, không bắt buộc). Có file Word (.docx, .doc) hoặc PDF có chữ thì chọn ở Đọc file hợp đồng: app điền sẵn ô còn trống, ô khác file liệt kê để chọn, không tự lưu, phụ lục đọc được khi Ghi bản sửa; bản scan không đọc, đính làm bằng chứng.",
    done: "Lưu xong, không cần ai duyệt",
    result: { label: CONTRACT_STATE_LABELS.attaching, tone: "warning" },
  },
  {
    id: "attach",
    title: "Đính kèm hồ sơ",
    needs: ["export-plans", "update"],
    actors: KH,
    text: "Ở hồ sơ hợp đồng chọn Đính kèm hồ sơ: hợp đồng đã ký, thêm L/C nếu thanh toán L/C. Chưa có thì chọn Chưa có — bổ sung sau, ghi lý do: làm tiếp được, duyệt cuối vẫn cần đủ file.",
    done: "Không còn loại hồ sơ bắt buộc nào Thiếu (Có file hoặc Bổ sung sau)",
    result: { label: CONTRACT_STATE_LABELS.shipping, tone: "source" },
  },
  {
    id: "ship",
    title: "Ghi chuyến",
    needs: ["export-plans", "create"],
    actors: KH,
    text: "Chọn Ghi chuyến cho từng container, xe tải hoặc lô đóng ghép: số lượng, booking (đính kèm file booking được), số cont, ETD.",
    done: "Mọi dòng hàng đã có chuyến (còn thiếu thì hiện thẻ Còn … chưa ghi chuyến)",
  },
  {
    id: "steps",
    title: "Làm các bước của chuyến",
    needs: ["export-plans", "update"],
    actors: KH,
    text: "Mỗi chuyến làm Lệnh sản xuất, Bao bì, Đóng cont, Bộ chứng từ: đính file, ghi số và ngày. Bước 1 tự xong; bước Lệnh sản xuất tự xong khi có lệnh đã phát hành gắn chuyến.",
    done: "Đủ 5 bước bắt buộc",
    result: { label: "Đủ hồ sơ", tone: "done" },
  },
  {
    id: "loading",
    title: "Ảnh và sơ đồ đóng cont",
    needs: ["export-plans.loading", "create"],
    actors: ["loader", ...KH],
    text: "Lúc đóng cont: chụp ảnh lớp hàng, seal, số cont; đính sơ đồ container (mục 4a, 4b). Đóng xong, bộ phận đóng cont tự Điền số thực đóng theo dòng hàng của hợp đồng (không chờ Kế hoạch), chứng từ lấy số này làm invoice.",
    done: "Có file là mục tự Xong; số thực đóng không chặn bước Đóng cont",
  },
  {
    id: "invoice",
    title: "Hàng của chuyến · invoice",
    needs: ["export-plans", "update"],
    actors: KH,
    text: "Nhập hàng của chuyến từ dòng hàng hợp đồng (số kiện, kg cả bì, hạn dùng). Ở mục Commercial Invoice chọn tài khoản nhận tiền, sửa đơn giá, thêm thông tin riêng của khách rồi tải file Invoice · Packing list.",
    done: "Ô tổng trống tự điền theo invoice lập",
  },
  {
    id: "payments",
    title: "Gửi chứng từ · tiền về",
    needs: ["export-plans.payments", "create"],
    actors: ["accounting", ...KH],
    text: "Bước 6 của chuyến: ghi ngày gửi bộ chứng từ cho khách và từng lần tiền về.",
    done: "Số phải thu = tiền trên Commercial Invoice. Bước này không tính vào đủ hồ sơ",
  },
  {
    id: "final",
    title: "Duyệt cuối",
    needs: ["export-plans", "approve"],
    actors: ["head"],
    text: "Hợp đồng Chờ duyệt cuối thì chọn Duyệt cuối: xem lại hợp đồng (cả các bản sửa) và hồ sơ chuyến. Chưa ổn thì trả về kèm lý do.",
    done: "Đồng ý",
    result: { label: CONTRACT_STATE_LABELS.closed, tone: "done" },
  },
];

export const EXPORT_GUIDE_CONTRACT_STATES: readonly GuideState[] = [
  {
    label: CONTRACT_STATE_LABELS.attaching,
    tone: "warning",
    meaning: "Vừa lập, hoặc còn hồ sơ bắt buộc Thiếu (thẻ Thiếu ghi rõ loại) mà chưa ghi Bổ sung sau. Chưa ghi chuyến lẻ được, nhưng tạo được lịch xuất hàng (chuyến dự kiến) khi chưa có chuyến nào.",
    next: "Đính kèm hồ sơ · Nhân viên Kế hoạch.",
  },
  {
    label: CONTRACT_STATE_LABELS.shipping,
    tone: "source",
    meaning: "Đủ hồ sơ, đang ghi và theo dõi các chuyến.",
    next: "Ghi chuyến, làm các bước tới khi mọi chuyến Đủ hồ sơ và thực xuất trong dung sai cả kg lẫn tiền.",
  },
  {
    label: CONTRACT_STATE_LABELS["final-review"],
    tone: "pending",
    meaning: "Mọi chuyến đủ hồ sơ, đã xuất đủ trong dung sai.",
    next: "Duyệt cuối · Trưởng / Phó phòng Kế hoạch. Nhân viên Kế hoạch không duyệt được.",
  },
  {
    label: CONTRACT_STATE_LABELS.closed,
    tone: "done",
    meaning: "Đã duyệt cuối, hoặc đóng sớm có lý do.",
    next: "Cần sửa thì Trưởng / Phó phòng mở lại.",
  },
];
export const EXPORT_GUIDE_SIDE_STATES: readonly GuideState[] = [
  { label: CONTRACT_STATE_LABELS.cancelled, tone: "muted", meaning: "Hợp đồng đã hủy, có ghi lý do." },
];

export const EXPORT_GUIDE_ITEM_STATES: readonly GuideState[] = [
  { label: ITEM_STATE_LABELS["not-started"], tone: "muted", meaning: "Chưa có gì." },
  { label: ITEM_STATE_LABELS["in-progress"], tone: "warning", meaning: "Đã ghi một phần, còn thiếu file, số hoặc ngày." },
  {
    label: ITEM_STATE_LABELS.done,
    tone: "done",
    meaning: "Đủ giấy tờ theo từng loại: file, số chứng từ, ngày. Sơ đồ container và ảnh đóng cont tự Xong khi có file.",
  },
];
export const EXPORT_GUIDE_ITEM_SIDE: readonly GuideState[] = [
  { label: ITEM_STATE_LABELS["not-applicable"], tone: "muted", meaning: "Chuyến không cần mục này. Phải ghi lý do." },
];

export const exportPlanningGuide: PageGuide = {
  title: "Xuất khẩu",
  description: "Hợp đồng xuất khẩu đi từ lập → đính kèm hồ sơ → ghi chuyến → duyệt cuối. Chỉ có một lần duyệt, ở cuối.",
  content: (
    <>
      <GuideYourWork steps={EXPORT_GUIDE_STEPS} />
      <GuideSection title="Quy trình">
        <GuideFlow steps={EXPORT_GUIDE_STEPS} actors={EXPORT_GUIDE_ACTORS} />
      </GuideSection>
      <GuideSection title="Trạng thái hợp đồng">
        <GuideStates states={EXPORT_GUIDE_CONTRACT_STATES} side={EXPORT_GUIDE_SIDE_STATES} />
      </GuideSection>
      <GuideSection title="Một chuyến có 6 bước">
        <GuideProgressSample titles={STEP_TITLES} />
        <GuideStates states={EXPORT_GUIDE_ITEM_STATES} side={EXPORT_GUIDE_ITEM_SIDE} />
        <GuideList>
          <li>Đầu mỗi bước ghi <b>Còn thiếu</b> kèm tên mục chưa xong.</li>
          <li>Thẻ <b>Trễ hạn</b>: chuyến quá hạn giao. Thẻ <b>Chờ booking</b>: chưa có số booking và số container.</li>
          <li>
            <b>File booking</b>: đính ở ô Số booking khi Ghi chuyến hoặc qua <b>Cập nhật booking</b> ở bước Đóng cont; booking sửa đổi thì
            đính thêm, bản mới nhất ở đầu. Người chỉ đóng hàng không thấy file này.
          </li>
          <li>
            Hàng <b>Booking</b> (bước Đóng cont) có 12 trường. Số booking và Đại lý ghi ở Ghi chuyến. <b>Cập nhật booking</b>: chọn file PDF
            của hãng tàu, app đọc ra tàu / chuyến, nơi nhận hàng, cảng đi, cảng đến, nơi giao hàng, loại cont, nơi hạ bãi, Doc cut-off, VGM
            cut-off, thời hạn hạ bãi. Soát lại rồi Lưu. Ô file để trống giữ giá trị cũ. Thẻ <b>Đã qua hạn</b>: hạn đã qua mà chưa có ngày đóng cont.
          </li>
          <li>
            Hàng <b>Thông tin xe vận chuyển</b>: bắt buộc tên công ty vận chuyển, địa điểm lấy container rỗng, địa điểm đóng container, địa
            điểm hạ bãi. Tài xế, số điện thoại, số CCCD, biển số xe không bắt buộc. Người đóng hàng xem được, không sửa.
          </li>
          <li>Hai hàng Booking và Thông tin xe không có trạng thái — không làm bước nào tự xong.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Trong chuỗi Nhập khẩu → Lệnh sản xuất → Xuất khẩu">
        <GuideList>
          <li>Lập lệnh <b>ngay khi lên hợp đồng</b>: ở hộp Lập hợp đồng chọn <b>Lưu &amp; lập lệnh sản xuất</b> (lưu xong mở luôn hộp lập lệnh), hoặc về sau ở hồ sơ hợp đồng chọn <b>Lập lệnh sản xuất</b> (mở trang Lệnh sản xuất, chọn sẵn hợp đồng). Không cần chờ đính kèm hay ghi chuyến; dòng hàng phải nối mặt hàng danh mục.</li>
          <li>Bước <b>Lệnh sản xuất</b> của chuyến: chọn <b>Lập lệnh sản xuất</b> (mở trang Lệnh sản xuất, chọn sẵn hợp đồng và chuyến) hoặc <b>Gắn lệnh có sẵn</b>. Lệnh nháp chưa tính; phát hành thì bước tự xong.</li>
          <li>Dòng hàng hợp đồng có cột <b>Đã ra lệnh (kg)</b>: còn bao nhiêu kg chưa ra lệnh, vượt dung sai thì báo.</li>
          <li>NL của lệnh lấy từ các lần <b>Nhập khẩu</b> đã ghi thực nhập.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Lịch xuất hàng xếp theo ngày">
        <GuideList>
          <li>Chuyến xếp theo ngày xuất: ngày đóng cont, chưa có thì ETD. Chỉ hiện ngày có chuyến, từ sớm tới muộn.</li>
          <li>Mỗi ngày ghi <b>n khách · m chuyến</b>, kg kế hoạch, tên khách; thẻ <b>n trễ</b> (trễ hạn giao) và <b>n còn thiếu</b> (chưa đủ hồ sơ).</li>
          <li>Cột trái là các ngày, cột phải là chuyến của ngày đang chọn, gom theo khách. Ngày có chuyến gần nhất từ hôm nay được chọn sẵn. Điện thoại: chạm ngày để xem chi tiết, Quay lại để về danh sách.</li>
          <li>Chuyến mới có tháng kế hoạch nằm ở mục <b>Chưa có ngày</b> cuối cột trái; ghi ngày đóng cont hoặc ETD thì chuyến tự vào lịch.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Dòng hàng: tên đầy đủ và gợi ý mặt hàng">
        <GuideList>
          <li><b>Tên hàng (như trên HĐ)</b> hiện đủ, ô tự xuống dòng — đối chiếu được với bản giấy. Ô <b>Mặt hàng (danh mục)</b> cũng hiện đủ tên.</li>
          <li>Gõ tên (hoặc size) xong, app gợi ý mặt hàng theo tên hàng của khách → hợp đồng trước → tên thương mại; khớp cả khi khác hoa thường, dấu câu, khoảng trắng, "gr" với "g". Dòng nhắc dưới ô ghi gợi ý theo đâu, có phải tên gần giống không — kiểm lại.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Sửa hợp đồng: sửa được gì, khóa khi nào">
        <GuideList>
          <li><b>Sửa hợp đồng</b> (sửa thẳng bản đang dùng): khi chưa chuyến nào có mã lô, booking, ngày, số cont hay file.</li>
          <li><b>Ghi bản sửa</b> (rvs / phụ kiện / tu chỉnh L/C): khi hợp đồng còn mở — bản mới có hiệu lực ngay, bản cũ giữ để tra.</li>
          <li><b>Số hợp đồng</b> đổi được ở cả hai cách, không trùng số với hợp đồng khác của cùng khách. <b>Khách</b> đổi được tới khi một chuyến xong bước 4 Đóng cont.</li>
          <li>Khóa khi hợp đồng <b>Đã đóng HĐ</b> hoặc <b>Đã hủy</b> — Trưởng / Phó phòng Kế hoạch mở lại. Mỗi lần lưu, nhật ký ghi từng ô đổi: cũ → mới (kể cả số hợp đồng cũ).</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Danh mục: danh sách chọn của Xuất khẩu">
        <GuideList>
          <li>Tab <b>Danh mục</b> giữ 6 danh sách: <b>Cảng xếp</b>, <b>Cảng đích</b>, <b>Loại container</b>, <b>Tiền tệ</b>, <b>Loại chứng từ</b>, <b>Loại hàng</b>. Tài khoản ngân hàng và tên, địa chỉ, logo in trên invoice: <b>Tài liệu công ty → Thông tin công ty</b>. Người chỉ có quyền xem thì xem được, không thêm / sửa / xóa.</li>
          <li>Ô Cảng xếp, Cảng đích, Loại container, Tiền tệ của hợp đồng và ô Cảng đến của chuyến chọn theo danh sách. Chưa có thì gõ tên rồi chọn <b>Thêm mới</b>; bút chì để sửa tên; thùng rác để xóa mục khỏi danh sách (có hỏi xác nhận, có Hoàn tác).</li>
          <li>Hợp đồng và chuyến <b>giữ đúng chữ lúc ghi</b>: đổi tên hay xóa một mục không làm đổi hợp đồng, chuyến đã ghi.</li>
          <li>Hợp đồng cũ gõ tay khác danh sách (VD "Việt Nam", "TOKYO") hiện ở đầu ô với dòng <b>Ngoài danh sách</b>. Khi sửa hợp đồng đó, chọn lại mục trong danh sách cho thống nhất.</li>
          <li>Hợp đồng ghi cả hai cảng xếp thì thêm một mục riêng, VD "Cát Lái / Cái Mép". Loại container có "HC" thì chuyến gợi ý 40HC-RF, có "20" thì 20RF, còn lại 40RF.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Ai làm gì">
        <GuideActors steps={EXPORT_GUIDE_STEPS} actors={EXPORT_GUIDE_ACTORS} />
      </GuideSection>
      <GuideSection title="Mẹo">
        <GuideList>
          <li>Việc ít dùng nằm ở <b>Thao tác khác</b>: Sửa hợp đồng (khi chưa có chuyến nào đã ghi mã lô, booking, ngày, số cont hay file), Ghi bản sửa, Gia hạn giao hàng, hủy.</li>
          <li>Phần <b>6 Lịch xuất hàng</b> ngay trong hộp Lập hợp đồng (mặc định Có): chia sẵn số chuyến = số cont, kg chia đều, tháng rải từ tháng sau ngày ký tới hạn giao; tự chia lại khi đổi số cont / hạn giao / dòng hàng cho tới khi sửa tay. Mỗi chuyến gõ luôn được <b>Số booking</b>, <b>Ngày đóng cont</b>, <b>ETD</b>, <b>ETA</b> nếu đã có. Lưu hợp đồng là ghi luôn các chuyến; chọn Không thì tạo sau. Chưa cần đủ hồ sơ; hợp đồng chưa có chuyến thì tạo lại được ở hồ sơ (Thao tác khác). Chuyến của lịch còn trống thì vẫn Sửa hợp đồng, Xóa hợp đồng được (xóa kèm các chuyến đó).</li>
          <li>Thanh toán <b>Khác</b> thì ghi Hình thức thanh toán; L/C thì ghi Số L/C. Đính <b>Hồ sơ khác</b> thì ghi Tên hồ sơ.</li>
          <li>Dòng hàng chép được (Chép dòng — chỉ đổi size); có ô Loại hàng (danh mục) khi máy chủ đã bật.</li>
          <li>Dòng hàng chỉ khác size: chọn <b>Chép dòng</b>, dòng mới giữ mọi ô và để trống Size.</li>
          <li>Ghi <b>Chiều dài</b>, <b>Tỉ lệ râu / thân / cổ</b>, <b>Số miếng / kg</b>, <b>Ghi chú dòng</b> đúng như cột trên hợp đồng. Lập Lệnh sản xuất từ dòng này thì các ô tự chép sang: ba ô đầu vào Quy cách, ghi chú dòng in dưới tên hàng. Lệnh đã lưu chỉ đổi theo khi mở lệnh ra lưu lại.</li>
          <li>Ô file hợp đồng, thư gia hạn, giấy báo có chọn được <b>nhiều file</b>: file đầu gắn vào bản ghi, các file sau (phụ lục) vào <b>Hồ sơ đính kèm</b>.</li>
          <li>Cuối hồ sơ có <b>Nhật ký thao tác</b>: ai làm gì, lúc nào. Chỉ thêm, không sửa hay xóa được.</li>
          <li>Rê chuột hoặc chạm vào chữ gạch chấm như <b>ETD</b>, <b>L/C</b>, <b>B/L</b> để xem nghĩa.</li>
        </GuideList>
      </GuideSection>
    </>
  ),
};
