// ============================================================
// Tên file: src/features/shared/guides/importPlanningGuide.tsx
// Tên tiếng Việt: Hộp "Hướng dẫn: Nhập khẩu" (nút "?" ở thanh tiêu đề)
// Description: Flow-style guide for /planning-import (ba-spec 43 v5 + 45 R1, R4–R7, R9, v3 R20):
//              your work, 5 steps with who + done condition, receipt / contract states, product
//              mapping, who-does-what. Tour: import-planning/importTour.ts.
// ============================================================
import { CONTRACT_STATE_LABELS, RECEIPT_STATE_LABELS } from "@/lib/importPlanning";
import type { PageGuide } from "../guideContent";
import type { GuideActor, GuideFlowStep, GuideState } from "./flowGuide";
import { GuideActors, GuideFlow, GuideStates, GuideYourWork } from "./FlowGuideBlocks";
import { GuideList, GuideSection } from "./parts";

export const IMPORT_GUIDE_ACTORS: readonly GuideActor[] = [
  { id: "planning", name: "Phòng Kế hoạch", note: "Nhân viên, Trưởng, Phó phòng Kế hoạch.", roles: ["planner", "planning-head", "planning-deputy"] },
  {
    id: "keeper",
    name: "Thủ kho",
    note: "Mở trang chỉ thấy các lô hàng về trong tháng để ghi thực nhập. Không thấy giá, không mở file chứng từ.",
    roles: ["warehouse-keeper"],
  },
  {
    id: "viewers",
    name: "Ban giám đốc, Kế toán",
    note: "Xem hợp đồng, lần nhập, giá và chứng từ.",
    roles: ["director", "vice-director", "chief-accountant", "accountant"],
    viewOnly: true,
  },
];

export const IMPORT_GUIDE_STEPS: readonly GuideFlowStep[] = [
  {
    id: "contract",
    title: "Lập hợp đồng nhập",
    needs: ["import-plans", "create"],
    actors: ["planning"],
    text: "Chọn Lập hợp đồng nhập: đối tác (danh mục NCC nhập khẩu), số hợp đồng, ngày ký, loại hình. Mỗi dòng hàng ghi tên như trên hợp đồng, mặt hàng (danh mục), kg, đơn giá.",
    done: "Lưu xong, không cần ai duyệt",
    result: { label: CONTRACT_STATE_LABELS["no-receipts"], tone: "muted" },
  },
  {
    id: "receipt",
    title: "Ghi lần nhập",
    needs: ["import-plans", "create"],
    actors: ["planning"],
    text: "Hàng sắp về: ở hồ sơ hợp đồng chọn Ghi lần nhập. Ghi ngày về kho (chưa về thì ngày dự kiến), cont lạnh 20 / 40 hoặc hàng lẻ, số cont, số B/L.",
    done: "Lần nhập mới có sẵn 3 chứng từ bắt buộc",
    result: { label: RECEIPT_STATE_LABELS["missing-docs"], tone: "warning" },
  },
  {
    id: "docs",
    title: "Đính bộ chứng từ",
    needs: ["import-plans", "update"],
    actors: ["planning"],
    text: "Chọn Cập nhật ở Commercial Invoice, Packing List, tờ khai nhập khẩu để đính file, ghi số và ngày. C/O, giấy kiểm dịch, B/L có thì chọn Thêm chứng từ.",
    done: "Đủ 3 chứng từ bắt buộc",
    result: { label: RECEIPT_STATE_LABELS["awaiting-quantity"], tone: "pending" },
  },
  {
    id: "quantity",
    title: "Ghi thực nhập",
    needs: ["import-plans.receiving", "create"],
    actors: ["keeper", "planning"],
    text: "Hàng về kho: chọn Ghi thực nhập, ghi số kg từng dòng hàng theo invoice.",
    done: "Đủ chứng từ và đã có thực nhập",
    result: { label: RECEIPT_STATE_LABELS.complete, tone: "done" },
  },
  {
    id: "close",
    title: "Đóng hợp đồng",
    needs: ["import-plans", "update"],
    actors: ["planning"],
    text: "Nhập xong: Thao tác khác → Đóng hợp đồng. Mọi dòng hàng phải đã nối mặt hàng; còn dòng chưa về đủ thì ghi lý do.",
    done: "Không cần ai duyệt",
    result: { label: CONTRACT_STATE_LABELS.closed, tone: "done" },
  },
];

export const IMPORT_GUIDE_RECEIPT_STATES: readonly GuideState[] = [
  {
    label: RECEIPT_STATE_LABELS["missing-docs"],
    tone: "warning",
    meaning: "Chưa đủ Commercial Invoice, Packing List, tờ khai nhập khẩu. Dòng Còn thiếu ghi tên chứng từ.",
    next: "Đính chứng từ · Phòng Kế hoạch.",
  },
  {
    label: RECEIPT_STATE_LABELS["awaiting-quantity"],
    tone: "pending",
    meaning: "Chứng từ đã đủ, chưa ghi số kg thực nhập.",
    next: "Ghi thực nhập · Thủ kho.",
  },
  { label: RECEIPT_STATE_LABELS.complete, tone: "done", meaning: "Đủ 3 chứng từ bắt buộc và đã có thực nhập." },
];
export const IMPORT_GUIDE_RECEIPT_SIDE: readonly GuideState[] = [
  { label: RECEIPT_STATE_LABELS.cancelled, tone: "muted", meaning: "Không tính vào tháng và số đã về. Khôi phục được khi hợp đồng còn mở." },
];

export const IMPORT_GUIDE_CONTRACT_STATES: readonly GuideState[] = [
  { label: CONTRACT_STATE_LABELS["no-receipts"], tone: "muted", meaning: "Vừa lập, chưa có lần hàng về nào.", next: "Ghi lần nhập khi hàng sắp về." },
  { label: CONTRACT_STATE_LABELS.receiving, tone: "source", meaning: "Có ít nhất một lần nhập.", next: "Nhập xong thì Đóng hợp đồng." },
  { label: CONTRACT_STATE_LABELS.closed, tone: "done", meaning: "Không ghi lần nhập mới, không ghi thực nhập.", next: "Cần ghi thêm thì Mở lại hợp đồng." },
];
export const IMPORT_GUIDE_CONTRACT_SIDE: readonly GuideState[] = [
  { label: CONTRACT_STATE_LABELS.cancelled, tone: "muted", meaning: "Hủy hợp đồng thì mọi lần nhập hủy theo." },
];

export const importPlanningGuide: PageGuide = {
  title: "Nhập khẩu",
  description: "Hợp đồng nhập với nhà cung cấp nước ngoài, chứng từ từng lần hàng về và số thực nhập. Khác trang Nhập hàng (nguyên liệu trong nước).",
  content: (
    <>
      <GuideYourWork steps={IMPORT_GUIDE_STEPS} />
      <GuideSection title="Quy trình">
        <GuideFlow steps={IMPORT_GUIDE_STEPS} actors={IMPORT_GUIDE_ACTORS} />
      </GuideSection>
      <GuideSection title="Trạng thái lần nhập">
        <GuideStates states={IMPORT_GUIDE_RECEIPT_STATES} side={IMPORT_GUIDE_RECEIPT_SIDE} />
      </GuideSection>
      <GuideSection title="Trạng thái hợp đồng">
        <GuideStates states={IMPORT_GUIDE_CONTRACT_STATES} side={IMPORT_GUIDE_CONTRACT_SIDE} />
      </GuideSection>
      <GuideSection title="Khi nào một chứng từ là xong">
        <GuideList>
          <li>Đã đính ít nhất một file. Tờ khai nhập khẩu cần thêm số tờ khai và loại hình.</li>
          <li>Lô không có chứng từ bắt buộc đó: chọn <b>Không áp dụng</b> và ghi lý do (VD hàng mẫu).</li>
          <li>Chứng từ bắt buộc không xóa được. Chứng từ thêm xóa được, có Hoàn tác.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Nối dòng hàng với mặt hàng">
        <GuideList>
          <li>
            Mỗi dòng hàng nối <b>một mặt hàng</b> ở Danh mục → Mặt hàng, để Nhập khẩu, sản xuất, kho và Xuất khẩu gọi cùng một tên. Tên như trên hợp đồng giữ nguyên.
          </li>
          <li>App tự gợi ý khi tên đó đã nối ở hợp đồng nhập trước, hoặc trùng tên tiếng Anh của đúng một mặt hàng. Gợi ý thì kiểm lại. Chưa có thì gõ tên để thêm mới ngay trong ô.</li>
          <li>
            Dòng chưa nối hiện <b>Chưa nối</b>: vẫn ghi lần nhập được, nhưng <b>chưa đóng được</b> hợp đồng. Nối ở Thao tác khác → Sửa hợp đồng, kể cả hợp đồng đã đóng.
          </li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Chép dòng hàng">
        <GuideList>
          <li>
            Dòng gần giống dòng trước thì chọn <b>Chép dòng</b>: dòng mới nằm ngay dưới, giữ tên hàng, mặt hàng, số lượng, đơn giá. Chỉ sửa ô khác.
          </li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Kiểm mẫu của kho">
        <GuideList>
          <li>
            Kho gửi báo cáo kiểm mẫu thì vào lần nhập, chọn <b>Nạp báo cáo kiểm mẫu</b>. File Excel được đọc tự động: app chọn sẵn các cột của invoice này theo nhà xuất khẩu và ngày về kho, gợi ý dòng hàng theo size.
          </li>
          <li>Ảnh chụp báo cáo chỉ đính kèm, số gõ tay. Ô không đọc được để trống và tô vàng để soát.</li>
          <li>
            Số không khớp nhau thì app báo để hỏi lại kho: tổng 1 da + 2 da + Mada hoặc tổng size khác 100%, thiếu net lệch so với packing và NW, ĐM NL–TP lệch tích 5 định mức quá 0,02. Vẫn lưu được.
          </li>
          <li>App chỉ lưu số như báo cáo, không tính lại, không đổi trạng thái lô. Kho gửi bản sửa thì nạp lại và chọn <b>Thay bằng mẫu mới</b>.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Ai làm gì">
        <GuideActors steps={IMPORT_GUIDE_STEPS} actors={IMPORT_GUIDE_ACTORS} />
      </GuideSection>
      <GuideSection title="Báo cáo">
        <GuideList>
          <li>Tab <b>Báo cáo</b>: chọn Tháng / Quý / Năm và đối tác. Số gồm lần nhập (cont, hàng lẻ), kg thực nhập, trị giá (chỉ người được xem giá), theo đối tác, mặt hàng, loại hình.</li>
          <li>Trị giá = kg thực nhập × đơn giá dòng HĐ, tách theo tiền tệ; dòng gia công không giá không cộng. Lần nhập đã hủy không tính.</li>
          <li>HĐ còn chưa về = kg các hợp đồng đang mở còn chưa nhập, không theo kỳ. Lần nhập cần chú ý: thiếu chứng từ, hoặc đã về kho mà chưa ghi thực nhập.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Mẹo">
        <GuideList>
          <li><b>Còn lại</b> của dòng hàng = kg hợp đồng − tổng thực nhập các lần nhập chưa hủy. Về nhiều hơn thì hiện <b>vượt x kg</b>, vẫn lưu được.</li>
          <li>Lô xếp vào tháng theo ngày về kho; chưa về thì theo ngày dự kiến.</li>
          <li>Ô tra số tìm theo số hợp đồng, invoice, tờ khai, cont, B/L, tên hàng và tên mặt hàng, ở mọi tháng.</li>
        </GuideList>
      </GuideSection>
    </>
  ),
};
