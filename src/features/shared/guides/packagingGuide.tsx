// ============================================================
// Tên file: src/features/shared/guides/packagingGuide.tsx
// Tên tiếng Việt: Hộp "Hướng dẫn: Đóng gói" (nút "?" ở thanh tiêu đề)
// Description: Static guide for /packaging — record a slip (BTP consumed → packed finished goods,
//              loss), stock effects, BTP lot link + label. Source:
//              docs/app-map/34-btp-san-xuat-kho.ba-spec.md + docs/spec/qr-truy-xuat-lo.md §6d.
//              ba-spec 43 v4 R14.
// ============================================================
import type { PageGuide } from "../guideContent";
import { GuideList, GuideSection, GuideSteps } from "./parts";

export const packagingGuide: PageGuide = {
  title: "Đóng gói",
  description: "Ghi phiếu đóng gói: trừ bán thành phẩm đem đóng, cộng thành phẩm ra, tính hao hụt.",
  content: (
    <>
      <GuideSection title="Ghi một phiếu đóng gói">
        <GuideSteps>
          <li>Chọn ngày và phân xưởng ở khối lọc, rồi chọn <b>Ghi phiếu đóng gói</b>.</li>
          <li>
            <b>Bán thành phẩm tiêu hao</b>: chọn mặt hàng BTP, quy cách, số kg <b>BTP vào</b> và số block. Trang hiện{" "}
            <b>Tồn BTP khả dụng</b> để soát.
          </li>
          <li>
            <b>Thành phẩm đóng gói ra</b>: chọn mặt hàng TP (có thể khác mã BTP), quy cách đóng gói, số kg <b>TP ra</b>, số
            thùng và <b>Kho chứa TP</b>.
          </li>
          <li>
            Chọn <b>Ghi đóng gói</b>. Thông báo có nút <b>In tem</b> để in tem QR lô thành phẩm.
          </li>
        </GuideSteps>
        <p>
          Đóng hộp ngang thì phiếu gõ dở được giữ làm nháp, mở lại <b>Ghi phiếu đóng gói</b> là số cũ quay về. Chọn{" "}
          <b>Hủy</b> mới bỏ hẳn.
        </p>
      </GuideSection>

      <GuideSection title="Số và cảnh báo">
        <GuideList>
          <li>
            <b>Hao hụt</b> = BTP vào − TP ra. TP ra lớn hơn BTP vào ⇒ hao hụt âm, trang báo màu cảnh báo — kiểm lại số.
          </li>
          <li>
            Đóng vượt <b>Tồn BTP khả dụng</b> thì trang báo để kiểm lại; vẫn ghi được nhưng tồn bán thành phẩm sẽ âm.
          </li>
          <li>
            Mỗi phiếu trừ tồn bán thành phẩm (kho dự trữ) và cộng <b>Tồn thành phẩm đóng gói</b>. Bán hàng chọn nguồn Đóng
            gói thì trừ vào tồn thành phẩm này.
          </li>
          <li>Xóa phiếu: tồn bán thành phẩm và tồn thành phẩm được tính lại, có nút Hoàn tác.</li>
        </GuideList>
      </GuideSection>

      <GuideSection title="Gắn lô BTP và in tem">
        <GuideList>
          <li>
            Ở từng phiếu, chọn <b>Gắn lô BTP</b>: quét tem, gõ mã hoặc chọn lô bán thành phẩm đã dùng. Chỉ nhận lô cùng mặt
            hàng BTP của phiếu. Đã gắn thì nút hiện <b>Lô BTP (n)</b>.
          </li>
          <li>Có lô gắn thì tồn trừ đúng lô đó; chưa gắn thì trừ lô cũ nhất trước.</li>
          <li>
            <b>Tem</b>: in tem QR lô thành phẩm để dán lên thùng. Quét tem là ra nguồn gốc tới bán thành phẩm và nguyên
            liệu.
          </li>
        </GuideList>
      </GuideSection>
    </>
  ),
};
