// ============================================================
// Tên file: src/features/shared/guides/productionOrderGuide.tsx
// Tên tiếng Việt: Hộp "Hướng dẫn: Lệnh sản xuất" (nút "?" ở thanh tiêu đề)
// Description: Flow-style guide for /planning-production (ba-spec 43 v5 + 48 R1–R12): your work, 4 steps
//              with who + done condition, order states, stale-revision flag, who-does-what.
//              Tour: production-orders/productionOrderTour.ts.
// ============================================================
import { ORDER_STATUS_LABELS, STALE_REVISION_LABEL } from "@/lib/productionOrder";
import { COMPOSED_STATUS_LABELS, fieldSourceLabel } from "@/lib/documentComposer";
import { productionOrderForm } from "@/lib/documentTypes/productionOrderForm";
import type { PageGuide } from "../guideContent";
import type { GuideActor, GuideFlowStep, GuideState } from "./flowGuide";
import { GuideActors, GuideFlow, GuideStates, GuideYourWork } from "./FlowGuideBlocks";
import { GuideList, GuideSection } from "./parts";

export const ORDER_GUIDE_ACTORS: readonly GuideActor[] = [
  { id: "planning", name: "Phòng Kế hoạch", note: "Nhân viên, Trưởng, Phó phòng Kế hoạch.", roles: ["planner", "planning-head", "planning-deputy"] },
  {
    id: "recipients",
    name: "Ban quản đốc phân xưởng, Thủ kho",
    note: "Nơi nhận lệnh: đọc lệnh đã phát hành, NL nhập khẩu dự kiến, yêu cầu bao bì. Không thấy lệnh nháp, không có giá.",
    roles: ["frozen-workshop-manager", "fish-workshop-manager", "dried-workshop-manager", "vice-manager", "warehouse-keeper"],
    viewOnly: true,
  },
  {
    id: "board",
    name: "Ban giám đốc, Kế toán",
    note: "Xem lệnh đã phát hành.",
    roles: ["director", "vice-director", "chief-accountant", "accountant"],
    viewOnly: true,
  },
];

export const ORDER_GUIDE_STEPS: readonly GuideFlowStep[] = [
  {
    id: "create",
    title: "Lập lệnh",
    needs: ["production-orders", "create"],
    actors: ["planning"],
    text: "Chọn hợp đồng xuất, chọn dòng hàng và gõ số thùng: kg tự tính. Ghi số lệnh, mã số lô, các ngày sản xuất, ngày giao.",
    done: "Lưu xong, không cần ai duyệt",
    result: { label: ORDER_STATUS_LABELS.draft, tone: "pending" },
  },
  {
    id: "materials",
    title: "Gắn NL nhập khẩu dự kiến",
    needs: ["production-orders", "update"],
    actors: ["planning"],
    text: "Mỗi dòng lệnh chọn lần nhập khẩu đã ghi thực nhập và số kg NL dự kiến. Chỉ dành cho lệnh, không trừ kho.",
    done: "Không bắt buộc, dành vượt thực nhập thì có cảnh báo",
  },
  {
    id: "issue",
    title: "Phát hành, gắn chuyến",
    needs: ["production-orders", "update"],
    actors: ["planning"],
    text: "Chọn Phát hành và tick các chuyến xuất mà lệnh lo; chưa có chuyến thì gắn sau. In lệnh A4 gửi Phòng Kỹ thuật.",
    done: "Quản đốc, thủ kho đọc được lệnh; chuyến đã gắn xong bước Lệnh sản xuất",
    result: { label: ORDER_STATUS_LABELS.issued, tone: "done" },
  },
  {
    id: "revise",
    title: "Sửa sau phát hành",
    needs: ["production-orders", "update"],
    actors: ["planning"],
    text: "Khách đổi số lượng hoặc hợp đồng có phụ lục thì Sửa lệnh và ghi lý do. Không đổi thì chọn Giữ nguyên theo bản cũ.",
    done: "Lệnh có dấu Đã sửa lần n, cờ Theo bản HĐ trước hết",
  },
];

export const ORDER_GUIDE_STATES: readonly GuideState[] = [
  { label: ORDER_STATUS_LABELS.draft, tone: "pending", meaning: "Đã lưu, chưa gửi ai. Quản đốc, thủ kho chưa thấy.", next: "Phát hành · Phòng Kế hoạch." },
  { label: ORDER_STATUS_LABELS.issued, tone: "done", meaning: "Đã gửi Ban quản đốc phân xưởng, Thủ kho. Chuyến gắn kèm xong bước Lệnh sản xuất.", next: "Gắn chuyến nếu chưa gắn; sửa khi khách đổi." },
];
export const ORDER_GUIDE_SIDE: readonly GuideState[] = [
  { label: ORDER_STATUS_LABELS.cancelled, tone: "muted", meaning: "Có lý do. Không tính vào số đã ra lệnh; chuyến và NL đã dành được nhả." },
];

const F = productionOrderForm;
/** Nhãn nguồn ô — đọc thẳng từ hàm của bộ soạn để đổi nhãn mà quên sửa hướng dẫn là test đỏ (ba-spec 54 AC-17). */
const SOURCE_LABELS = (["source", "previous", "default", "manual", "empty"] as const).map((kind) => fieldSourceLabel(F, { kind, ref: "…" }));

/** File Lệnh sản xuất Word / PDF (ba-spec 54 §9b): luồng, trạng thái bản soạn, nguồn ô, cờ, điều kiện xuất, PDF, khuôn. */
export function OrderFileGuideSection() {
  return (
    <GuideSection title="File Lệnh sản xuất Word / PDF">
      <GuideList>
        <li>
          Ở hồ sơ lệnh chọn <b>File Word / PDF</b>. App điền sẵn đủ các ô của mẫu QTI-KH-01-04. Sửa ô sai ngay trên app, bên cạnh có bản xem trước đúng file Word sẽ xuất. Sửa ở đây <b>không đổi lệnh</b> trên app.
        </li>
        <li>
          Mỗi ô ghi lấy từ đâu: <b>{SOURCE_LABELS[0]}</b> (số lệnh, ngày, bảng hàng, mã số lô, ngày SX, ngày giao, thị trường, hạn dùng) · <b>{SOURCE_LABELS[1].replace("…", "<số>")}</b> (yêu cầu bao bì, ghi nhãn, Nafi chép từ file đã xuất của lệnh gần nhất cùng khách và mặt hàng) · <b>{SOURCE_LABELS[2]}</b> (như LSX 19.10) · <b>{SOURCE_LABELS[3]}</b> · <b>{SOURCE_LABELS[4]}</b>.
        </li>
        <li>
          Trạng thái: <b>{COMPOSED_STATUS_LABELS.draft}</b> (chưa xuất lần nào) → <b>{COMPOSED_STATUS_LABELS.exported}</b> (giống lần xuất gần nhất) · <b>{COMPOSED_STATUS_LABELS["edited-after-export"]}</b> (đã sửa sau lần xuất cuối, cần xuất lại nếu gửi xưởng bản mới).
        </li>
        <li>
          Cờ: <b>{F.labels.differs}</b> — ô đã sửa khác số của lệnh, cạnh ô ghi số trên lệnh · <b>{F.labels.stale}</b> — chọn <b>Lấy lại số từ lệnh</b>: ô lấy từ lệnh nhận số mới, ô đã sửa tay giữ nguyên · <b>{F.labels.sourceCancelled}</b> — chỉ xem và tải lại, không sửa, không xuất mới.
        </li>
        <li>Xuất được khi đủ: số lệnh, ngày lệnh, ít nhất một dòng hàng có tên hàng, số thùng, số kg, ngày giao, thị trường. Thiếu thì app kê đủ các ô còn trống.</li>
        <li>
          <b>Xuất Word</b> tải file .docx, mở bằng Word sửa tiếp được. <b>Xuất PDF</b> mở trang in: chọn &quot;Lưu thành PDF&quot;, khổ A4 dọc, lề Không. Mỗi lần xuất được ghi vào <b>Lịch sử xuất file</b>; tải lại một lần xuất ra đúng file lúc đó, không ghi thêm lần xuất.
        </li>
        <li>Quản đốc, thủ kho thấy file của lệnh đã phát hành, chỉ xem và tải lại. Quản trị đổi khuôn Word ở cuối trang soạn (khuôn mới phải đủ thẻ bắt buộc).</li>
      </GuideList>
    </GuideSection>
  );
}

export const productionOrderGuide: PageGuide = {
  title: "Lệnh sản xuất",
  description: "Lệnh sản xuất ra từ dòng hàng hợp đồng xuất, theo mẫu QTI-KH-01-04. Nối nguyên liệu nhập khẩu với chuyến xuất.",
  content: (
    <>
      <GuideYourWork steps={ORDER_GUIDE_STEPS} />
      <GuideSection title="Quy trình">
        <GuideFlow steps={ORDER_GUIDE_STEPS} actors={ORDER_GUIDE_ACTORS} />
      </GuideSection>
      <GuideSection title="Trạng thái lệnh">
        <GuideStates states={ORDER_GUIDE_STATES} side={ORDER_GUIDE_SIDE} />
      </GuideSection>
      <GuideSection title="Cờ cảnh báo">
        <GuideList>
          <li>
            <b>{STALE_REVISION_LABEL}</b>: hợp đồng có bản mới (phụ lục) sau khi lệnh phát hành. Dòng lệnh không tự đổi. Sửa lệnh theo bản mới, hoặc Giữ nguyên theo bản cũ và ghi lý do.
          </li>
          <li>
            <b>Lệch MSL</b>: chuyến gắn kèm đã có mã số lô khác mã của lệnh. Chuyến chưa có mã thì nhận mã của lệnh.
          </li>
          <li>Dòng hàng đã ra lệnh vượt số kg hợp đồng quá dung sai: có cảnh báo, vẫn lưu được.</li>
        </GuideList>
      </GuideSection>
      <OrderFileGuideSection />
      <GuideSection title="Trong chuỗi Nhập khẩu → Lệnh sản xuất → Xuất khẩu">
        <GuideList>
          <li>NL lấy từ trang <b>Nhập khẩu</b>: chỉ lần nhập đã ghi thực nhập mới chọn được.</li>
          <li>Lệnh phát hành và gắn chuyến thì bước <b>Lệnh sản xuất</b> của chuyến ở trang <b>Xuất khẩu</b> tự xong. Hồ sơ lệnh có lối mở hồ sơ hợp đồng xuất.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Ai làm gì">
        <GuideActors steps={ORDER_GUIDE_STEPS} actors={ORDER_GUIDE_ACTORS} />
      </GuideSection>
      <GuideSection title="Báo cáo">
        <GuideList>
          <li>Tab <b>Báo cáo</b>: chọn Tháng / Quý / Năm và khách. Lệnh xếp vào kỳ theo ngày sản xuất đầu; lệnh đã hủy chỉ đếm, không cộng thùng / kg.</li>
          <li>NL nhập khẩu đã dành: kg dự kiến của lệnh trong kỳ theo từng lần nhập; có cột vượt khi tổng đã dành lớn hơn thực nhập.</li>
          <li>Lệnh cần chú ý: nháp đã tới ngày sản xuất, theo bản HĐ trước, đã phát hành mà chưa gắn chuyến.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Mẹo">
        <GuideList>
          <li>Hợp đồng phải có bản hiệu lực, dòng hàng phải đã nối mặt hàng danh mục thì mới lập lệnh được.</li>
          <li>Quy cách dòng lệnh lấy từ dòng hàng hợp đồng theo thứ tự: Size · Dài · Số miếng / kg · Tỉ lệ râu / thân / cổ · packing. Ghi chú dòng của hợp đồng in dưới tên hàng. Muốn đổi thì sửa ở hợp đồng xuất rồi mở lệnh ra lưu lại.</li>
          <li>Hạn sử dụng = tháng của ngày sản xuất đầu + số tháng, về ngày 01. VD sản xuất 02/11/2026, 24 tháng: 01/11/2028.</li>
          <li>Lệnh xếp vào tháng theo ngày sản xuất đầu. Ô tra tìm số lệnh, mã số lô, số hợp đồng, tên hàng ở mọi tháng.</li>
          <li>Lập lệnh mới chép được yêu cầu bao bì, Nafi, lưu ý từ lệnh gần nhất cùng khách và mặt hàng (nút Chép từ lệnh …). Chọn Nafi <b>Khác</b> thì phải ghi Chỉ tiêu Khác.</li>
          <li>Không lưu được khi: số lệnh trùng, ngày giao trước ngày sản xuất cuối, hợp đồng đã đóng / hủy. Trùng MSL với lệnh đang phát hành chỉ cảnh báo.</li>
          <li>Tab Lệnh: lọc theo khách; lệnh đã hủy ẩn sẵn, chọn <b>Xem n lệnh đã hủy</b> để hiện. Ô tra luôn tìm cả lệnh đã hủy.</li>
          <li>Tab Báo cáo xuất Excel được.</li>
        </GuideList>
      </GuideSection>
    </>
  ),
};
