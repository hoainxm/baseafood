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
    text: "Chọn Lập hợp đồng, nhập đúng như bản giấy: khách, dòng hàng, giá, điều kiện giao, hạn giao.",
    done: "Lưu xong, không cần ai duyệt",
    result: { label: CONTRACT_STATE_LABELS.attaching, tone: "warning" },
  },
  {
    id: "attach",
    title: "Đính kèm hồ sơ",
    needs: ["export-plans", "update"],
    actors: KH,
    text: "Ở hồ sơ hợp đồng chọn Đính kèm hồ sơ: hợp đồng đã ký, thêm L/C nếu thanh toán L/C.",
    done: "Đủ hồ sơ bắt buộc",
    result: { label: CONTRACT_STATE_LABELS.shipping, tone: "source" },
  },
  {
    id: "ship",
    title: "Ghi chuyến",
    needs: ["export-plans", "create"],
    actors: KH,
    text: "Chọn Ghi chuyến cho từng container, xe tải hoặc lô đóng ghép: số lượng, booking, số cont, ETD.",
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
    text: "Lúc đóng cont: chụp ảnh lớp hàng, seal, số cont; đính sơ đồ container. Đây là mục 4a, 4b của bước Đóng cont.",
    done: "Có file là mục tự Xong",
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
    meaning: "Vừa lập, hoặc còn thiếu hồ sơ bắt buộc (thẻ Thiếu ghi rõ loại). Chưa ghi chuyến lẻ được, nhưng tạo được lịch xuất hàng (chuyến dự kiến) khi chưa có chuyến nào.",
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
        </GuideList>
      </GuideSection>
      <GuideSection title="Trong chuỗi Nhập khẩu → Lệnh sản xuất → Xuất khẩu">
        <GuideList>
          <li>Bước <b>Lệnh sản xuất</b> của chuyến: chọn <b>Lập lệnh sản xuất</b> (mở trang Lệnh sản xuất, chọn sẵn hợp đồng và chuyến) hoặc <b>Gắn lệnh có sẵn</b>. Lệnh nháp chưa tính; phát hành thì bước tự xong.</li>
          <li>Dòng hàng hợp đồng có cột <b>Đã ra lệnh (kg)</b>: còn bao nhiêu kg chưa ra lệnh, vượt dung sai thì báo.</li>
          <li>NL của lệnh lấy từ các lần <b>Nhập khẩu</b> đã ghi thực nhập.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Ai làm gì">
        <GuideActors steps={EXPORT_GUIDE_STEPS} actors={EXPORT_GUIDE_ACTORS} />
      </GuideSection>
      <GuideSection title="Mẹo">
        <GuideList>
          <li>Việc ít dùng nằm ở <b>Thao tác khác</b>: Sửa hợp đồng (khi chưa có chuyến nào đã ghi mã lô, booking, ngày, số cont hay file), Ghi bản sửa, Gia hạn giao hàng, hủy.</li>
          <li>Lập hợp đồng xong, app hỏi <b>Tạo lịch xuất hàng</b>: chia sẵn số chuyến = số cont, kg chia đều, tháng rải từ tháng sau ngày ký tới hạn giao. Sửa tháng / kg từng chuyến rồi Tạo, hoặc chọn Không tạo. Chưa cần đủ hồ sơ; hợp đồng chưa có chuyến thì tạo lại được ở hồ sơ (Thao tác khác). Chuyến của lịch còn trống thì vẫn Sửa hợp đồng, Xóa hợp đồng được (xóa kèm các chuyến đó).</li>
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
