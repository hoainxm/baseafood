// ============================================================
// Tên file: src/features/shared/guides/dashboardGuide.tsx
// Tên tiếng Việt: Hộp "Hướng dẫn: Tổng quan" (nút "?" ở thanh tiêu đề)
// Description: Static guide for /dashboard (data flow overview) — how to read each block, alert
//              levels, demo mode. Source: docs/spec/che-do-demo.md §5b + lib/dataFlow.ts. ba-spec 43 v4 R14.
// ============================================================
import type { PageGuide } from "../guideContent";
import { GuideList, GuideSection, GuideSteps } from "./parts";

export const dashboardGuide: PageGuide = {
  title: "Tổng quan",
  description: "Nguyên liệu vào đi qua 5 khâu ra sao, đang kẹt ở đâu, còn việc gì phải đốc — số lấy từ sổ đã ghi.",
  content: (
    <>
      <GuideSection title="Cách xem">
        <GuideSteps>
          <li>
            Chọn kỳ <b>Ngày · Tuần · Tháng · Năm</b> (mặc định tháng này) hoặc <b>Tự chọn</b> khoảng ngày; dùng <b>‹ ›</b> để
            sang kỳ khác. Chọn <b>Cả 3 xưởng</b> hoặc một xưởng.
          </li>
          <li>
            Đọc <b>8 thẻ số</b> ở đầu trang. Chọn một thẻ để mở màn liên quan.
          </li>
          <li>
            Xem <b>Năm khâu của chuỗi</b> để biết số đang kẹt ở khâu nào, và <b>Nguyên liệu đi đâu</b> để biết 100 kg nguyên
            liệu ra bao nhiêu kg bán thành phẩm.
          </li>
          <li>
            Mở bảng <b>Việc cần đốc</b>: làm từ trên xuống, chọn <b>Mở</b> để tới đúng chỗ sửa.
          </li>
        </GuideSteps>
      </GuideSection>

      <GuideSection title="Năm khâu và hai thanh chia phần">
        <GuideList>
          <li>
            Mỗi khâu ghi kg đã qua trong kỳ, <b>Đang chờ</b> (bán thành phẩm chờ duyệt nhập kho) và số <b>việc còn thiếu</b>{" "}
            (chưa in tem, chưa gắn lô, chờ duyệt, chưa quét kiểm) hoặc <b>Đủ việc</b>.
          </li>
          <li>
            Phần trăm trên mũi tên so với khâu nguồn: sản xuất so với nhập, nhập kho so với sản xuất, đóng gói và xuất / bán so
            với nhập kho.
          </li>
          <li>
            Phần <b>Hao hụt / chưa ghi ra</b> là nguyên liệu vào mà chưa thấy ghi đi đâu. Phần này lớn bất thường thường là sổ
            ghi thiếu.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection title="Mức của việc cần đốc">
        <GuideList>
          <li>
            <b>Sổ sai</b>: số đang sai, sửa trước — sổ nhập đổi sau khi chốt, bán / xuất vượt tồn, định mức tốn nguyên liệu hơn
            bình quân quá 5%.
          </li>
          <li>
            <b>Chưa làm</b>: ngày nhập / sản xuất chưa chốt, mẻ chưa gắn lô, BTP chờ duyệt nhập kho quá 3 ngày, kỳ cân đối hết
            ngày mà chưa chốt.
          </li>
          <li>
            <b>Để biết</b>: ghi bù (kèm lý do), định mức lệch nhẹ.
          </li>
          <li>Ngày hôm nay chưa tính là việc vì còn đang ghi. Sổ sửa xong thì việc tự hết.</li>
        </GuideList>
      </GuideSection>

      <GuideSection title="Cách tính">
        <GuideList>
          <li>
            <b>Định mức</b> = kg nguyên liệu vào ÷ kg thành phẩm ra. <b>Lãi/lỗ</b> = giá trị xuất − giá thành. Kỳ chưa có thành
            phẩm thì chưa tính.
          </li>
          <li>Định mức theo mặt hàng chỉ tính mẻ đã gắn lô nguyên liệu có cân kg; lệch quá ±5% so bình quân thì ghi chú.</li>
          <li>
            Tồn theo kho lấy từ báo cáo Xuất–Nhập–Tồn của xí nghiệp: <b>Tồn cuối = Tồn đầu + Nhập − Xuất</b>.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection title="Chế độ demo (chỉ quản trị viên)">
        <GuideList>
          <li>
            Nút <b>Demo</b> trên thanh tiêu đề chuyển cả app sang bộ số trình diễn riêng, sinh từ số thật. Số thật của xưởng không
            bị đụng.
          </li>
          <li>
            Khi đang demo, dải <b>ĐANG XEM DỮ LIỆU DEMO</b> luôn hiện. Nút <b>DEMO</b> có <b>Làm mới bộ demo</b> và{" "}
            <b>Thoát demo</b>.
          </li>
        </GuideList>
      </GuideSection>
    </>
  ),
};
