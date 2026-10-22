// ============================================================
// Tên file: src/features/shared/guides/reconciliationGuide.tsx
// Tên tiếng Việt: Hộp "Hướng dẫn: Đối soát hóa đơn điện tử" (nút "?" ở thanh tiêu đề)
// Description: Static guide for /reconciliation — work order, result labels, what the machine
//              does and does not do. Source: docs/app-map/37-doi-soat-hddt.md. ba-spec 43 v4 R14.
// ============================================================
import type { PageGuide } from "../guideContent";
import { GuideList, GuideSection, GuideSteps } from "./parts";

export const reconciliationGuide: PageGuide = {
  title: "Đối soát hóa đơn điện tử",
  description: "Đối chiếu hóa đơn mua vào tải từ cổng thuế với sổ phần mềm kế toán, bắt hóa đơn thiếu hoặc lệch tiền.",
  content: (
    <>
      <GuideSection title="Các bước làm">
        <GuideSteps>
          <li>
            Chuẩn bị <b>một file Excel</b>: các sheet hóa đơn điện tử của cổng thuế (có mã, máy tính tiền, không mã), kèm sheet sổ
            kế toán (<b>PHẦN MỀM</b>) nếu cần đối chiếu sổ. Chưa rõ định dạng thì chọn <b>Tải file mẫu</b>.
          </li>
          <li>
            Chọn <b>Chọn file Excel</b>, đặt <b>Ngưỡng khớp</b> (mặc định 1 đ), rồi chọn <b>Đối soát</b>.
          </li>
          <li>
            Ở mục <b>Bạn cần soát việc gì?</b>, chọn đúng việc: <b>Hóa đơn ⇄ sổ kế toán</b> · <b>So hai bản hóa đơn</b> ·{" "}
            <b>Kiểm cộng cột bảng kê</b> · <b>Cùng MST cùng ngày</b>. Máy chạy một lần, đổi kiểu xem không phải chạy lại.
          </li>
          <li>
            Xem thẻ số, chọn một thẻ để xuống thẳng danh sách đã lọc. Soát mục <b>Chỗ cần soát lại</b>; chỗ có số đối chứng thì
            chọn <b>Sửa</b> (giữ giá trị cũ, có <b>Hoàn tác</b>).
          </li>
          <li>
            Chọn <b>Tải Excel kết quả</b> để gửi kế toán, và <b>Lưu nháp</b> hoặc <b>Lưu chính thức</b> để mở lại về sau.
          </li>
        </GuideSteps>
      </GuideSection>

      <GuideSection title="Kết quả từng hóa đơn">
        <GuideList>
          <li>
            <b>Khớp</b>: có trong sổ, chênh không quá ngưỡng khớp.
          </li>
          <li>
            <b>Lệch tiền</b>: có trong sổ nhưng tổng thanh toán lệch quá ngưỡng. <b>Lệch thuế</b>: tổng khớp mà tiền thuế lệch.
            Chỉ tiền trước thuế lệch vẫn là Khớp (thường do chiết khấu, phí).
          </li>
          <li>
            <b>Chưa vào sổ</b>: không thấy trong sổ. <b>Không cần vào sổ</b>: hóa đơn đã bị thay thế, xóa bỏ hoặc hủy — không có
            trong sổ là đúng. Hóa đơn bị điều chỉnh vẫn phải kê.
          </li>
          <li>
            Dòng sổ: <b>Đã có hóa đơn</b> hoặc <b>Chưa có hóa đơn</b>. Sheet sổ ghi <b>(phụ)</b> không cộng vào tổng.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection title="Máy làm gì, không làm gì">
        <GuideList>
          <li>
            Ghép hóa đơn với sổ theo <b>MST người bán · ký hiệu · số hóa đơn</b>; một hóa đơn tách nhiều dòng sổ thì cộng lại rồi
            mới so.
          </li>
          <li>
            <b>Không tự sửa số</b>: chỉ báo chỗ nghi sai. Số chỉ đổi khi bạn chọn Sửa từng dòng.
          </li>
          <li>
            <b>Ngoại tệ</b>: máy tự dò file để tiền ở nguyên tệ hay đã quy sẵn VND, bằng cách so với hóa đơn đã khớp sổ — không
            mặc định nhân tỷ giá. Không dò được thì máy cảnh báo để soát tay.
          </li>
          <li>
            Khối <b>Máy tự kiểm tra &amp; đối chiếu số liệu</b>: mỗi phép phải <b>Đạt</b> (Đáng lẽ = Thực tế). Có phép{" "}
            <b>Không đạt</b> thì khối tự mở, xem trước khi dùng số.
          </li>
          <li>
            File tải về là <b>chính file gốc</b>, giữ nguyên định dạng và địa chỉ ô; thêm cột kết quả, tô màu dòng và sheet{" "}
            <b>KẾT LUẬN CHUNG</b> ở đầu. Mỗi lần tải là một file mới có ngày giờ trong tên.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection title="Bản đã lưu">
        <GuideList>
          <li>
            <b>Nháp</b> còn sửa tiếp được; <b>Chính thức</b> giữ cố định tóm tắt kết quả lúc lưu để đối chiếu về sau.
          </li>
          <li>
            <b>Mở lại</b> chạy lại trên chính file gốc đã lưu. Đang mở một bản thì Lưu là cập nhật bản đó.
          </li>
          <li>Mỗi tài khoản thấy bản của mình; chưa đăng nhập máy chủ thì bản lưu chỉ nằm trên máy này.</li>
        </GuideList>
      </GuideSection>
    </>
  ),
};
