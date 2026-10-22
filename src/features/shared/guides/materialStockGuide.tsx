// ============================================================
// Tên file: src/features/shared/guides/materialStockGuide.tsx
// Tên tiếng Việt: Hộp "Hướng dẫn: Tồn kho nguyên liệu" (nút "?" ở thanh tiêu đề, trang /nxt-material)
// Description: Static guide for the raw-material stock report. Source: docs/app-map/31-can-doi-ky.md
//              §Tồn kho nguyên liệu (PA-a) · 38-so-ton-lien-tuc.ba-spec.md §0. Wired into PAGE_GUIDES
//              (features/shared/guideContent.tsx) by the main session.
// ============================================================
import type { PageGuide } from "../guideContent";
import { GuideList, GuideSection, GuideSteps } from "./parts";

export const materialStockGuide: PageGuide = {
  title: "Tồn kho nguyên liệu",
  description: "Nguyên liệu còn bao nhiêu kg theo loại và theo ngày, suy thẳng từ sổ Nhập hàng.",
  content: (
    <>
      <GuideSection title="Cách xem">
        <GuideSteps>
          <li>
            Chọn <b>Kỳ báo cáo</b> (ngày / tuần / tháng / năm / khoảng tự chọn), rồi chọn một ngày bất kỳ trong kỳ.
          </li>
          <li>
            Chọn <b>Phân xưởng</b>: tất cả xưởng hoặc Đông, Cá, Khô.
          </li>
          <li>
            Đọc 5 thẻ số, rồi hai bảng <b>Tồn theo ngày</b> và <b>Tồn theo loại nguyên liệu</b>.
          </li>
        </GuideSteps>
      </GuideSection>
      <GuideSection title="Cách tính">
        <GuideList>
          <li>
            <b>Tồn cuối = Tồn đầu + Nhập − Xuất SX − Bán nội địa.</b>
          </li>
          <li>
            <b>Nhập</b>: mọi chuyến ở sổ Nhập hàng có ngày trong kỳ.
          </li>
          <li>
            <b>Xuất SX</b> luôn 0: phần nguyên liệu lấy ra sản xuất chưa được ghi, nên tồn hiện là tồn theo nhập,{" "}
            <b>chưa trừ phần đã chế biến</b>.
          </li>
          <li>
            <b>Bán nội địa</b>: nguyên liệu bán thẳng, ghi ở màn Sản xuất thành phẩm. Có trừ vào tồn.
          </li>
          <li>
            <b>Đông gửi / Xả đông</b>: chỉ là thông tin kho đông (từ Cân đối kỳ), <b>không cộng vào tồn</b> để không đếm hai lần.
          </li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Tồn đầu">
        <p>
          Có nguyên liệu tồn <b>trước khi dùng app</b> thì chọn <b>Tồn đầu</b> và khai <b>một lần</b>. Đặt{" "}
          <b>Tồn đầu tính từ ngày</b> = ngày đầu tiên app tính nhập (VD 01/07 cho tồn cuối 30/06): chuyến nhập trước ngày
          đó coi như đã nằm trong số khai. Gõ tên loại nguyên liệu đúng như ở sổ Nhập hàng để khớp loại.
        </p>
      </GuideSection>
      <GuideSection title="Cảnh báo">
        <GuideList>
          <li>
            <b>Tồn âm</b> (khung đỏ, thẻ đỏ ở dòng): tồn cuối dưới 0. Kiểm lại tồn đầu, chuyến nhập, bán nội địa.
          </li>
          <li>
            <b>Còn dở SX chưa hiện ở đâu</b> (khung vàng): còn dở khi chốt ngày sản xuất rơi vào ngày chưa có kỳ cân đối nào
            phủ. Tạo kỳ cân đối phủ ngày đó ở màn Cân đối kỳ.
          </li>
        </GuideList>
      </GuideSection>
    </>
  ),
};
