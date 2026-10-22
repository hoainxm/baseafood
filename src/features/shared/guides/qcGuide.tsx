// ============================================================
// Tên file: src/features/shared/guides/qcGuide.tsx
// Tên tiếng Việt: Hộp "Hướng dẫn: Kiểm tra QC" (nút "?" ở thanh tiêu đề)
// Description: Static guide for the QC checklist page (/qc). Source: họp 2026-09-02 QĐ-8 +
//              QcChecklistScreen.tsx (labels, lock / backdate rules). Tour: quality-check/qcTour.ts.
// ============================================================
import type { PageGuide } from "../guideContent";
import { GuideList, GuideSection, GuideSteps } from "./parts";

export const qcGuide: PageGuide = {
  title: "Kiểm tra QC",
  description: "Chấm nhanh bảng kiểm chất lượng cuối ngày của từng phân xưởng, rồi chốt ngày.",
  content: (
    <>
      <GuideSection title="Chấm QC cuối ngày">
        <GuideSteps>
          <li>
            Chọn <b>Ngày kiểm</b> và <b>Phân xưởng</b> (Đông · Cá · Khô). Mỗi ngày của mỗi xưởng là một bảng kiểm riêng.
          </li>
          <li>
            Với từng chỉ tiêu (vệ sinh nhà xưởng, dụng cụ, thiết bị…), chọn <b>Kết quả</b>: <b>Đạt</b> · <b>Cần khắc phục</b> ·{" "}
            <b>Không đạt</b>. Chỉ tiêu chưa chọn kết quả thì không được lưu.
          </li>
          <li>
            Nếu cần: gõ <b>Điểm (tùy chọn)</b>, <b>Ghi chú</b> việc cần sửa, chọn <b>Chụp / chọn ảnh</b> làm minh chứng.
          </li>
          <li>
            Cần kiểm thêm việc khác thì gõ tên ở ô <b>Thêm chỉ tiêu khác</b> rồi chọn <b>Thêm chỉ tiêu</b>.
          </li>
          <li>
            Chọn <b>Lưu chấm điểm</b> để ghi vào sổ QC của ngày · xưởng đang chọn.
          </li>
          <li>
            Chấm xong cả bảng thì chọn <b>Chốt ngày</b>. Chỉ chốt được khi đã lưu ít nhất một chỉ tiêu.
          </li>
        </GuideSteps>
      </GuideSection>

      <GuideSection title="Trạng thái và kết quả">
        <GuideList>
          <li>
            <b>Chưa chốt</b>: còn chấm, sửa bình thường. <b>Đã chốt</b>: bảng kiểm ngày này đã khóa, không thêm hay bỏ ảnh được.
          </li>
          <li>
            Dòng <b>Đã chấm a/b · Đạt c · Không đạt d</b>: số chỉ tiêu đã chọn kết quả trên tổng số chỉ tiêu, tính theo phiếu đang chấm.
          </li>
          <li>
            Chấm theo thang 10 thì 7–10 đạt, 5–7 tạm, dưới 5 không đạt. Máy không tự đổi điểm ra kết quả — vẫn chọn Kết quả.
          </li>
          <li>
            <b>30 ngày gần đây</b>: số chỉ tiêu Đạt · Tạm (cần khắc phục) · Không đạt mỗi ngày của xưởng, để xem chất lượng có đi xuống
            không.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection title="Ghi bù và mở lại ngày">
        <GuideList>
          <li>
            Chấm cho ngày trước hôm nay, hoặc sửa ngày đã chốt, là <b>ghi bù</b>: phải điền <b>Lý do ghi bù</b>, thiếu thì không lưu được.
          </li>
          <li>
            Người được cấp quyền có nút <b>Mở lại ngày</b> để mở khóa ngày đã chốt. Sửa xong nhớ chốt lại.
          </li>
          <li>
            Quản đốc chỉ chấm, chốt được xưởng mình; xưởng khác chỉ xem.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection title="Mẹo">
        <GuideList>
          <li>
            Phiếu đang chấm tự lưu nháp trên máy: sang trang khác hay tải lại vẫn còn, nhưng chỉ vào sổ khi chọn Lưu chấm điểm.
          </li>
          <li>
            Chọn <b>Bắt đầu hướng dẫn thao tác</b> ở đầu hộp này để được chỉ lần lượt từng khu vực trên trang.
          </li>
        </GuideList>
      </GuideSection>
    </>
  ),
};
