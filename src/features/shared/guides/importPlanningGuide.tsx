// ============================================================
// Tên file: src/features/shared/guides/importPlanningGuide.tsx
// Tên tiếng Việt: Hộp "Hướng dẫn: Nhập khẩu" (nút "?" ở thanh tiêu đề)
// Description: Static guide for the import planning page (/planning-import). Source: ba-spec 45
//              (R1, R4–R7) + lib/importPlanning.ts labels. Tour: import-planning/importTour.ts.
// ============================================================
import type { PageGuide } from "../guideContent";
import { GuideList, GuideSection, GuideSteps } from "./parts";

export const importPlanningGuide: PageGuide = {
  title: "Nhập khẩu",
  description: "Hợp đồng nhập với nhà cung cấp nước ngoài, chứng từ từng lần hàng về và số lượng thực nhập. Khác trang Nhập hàng (nguyên liệu trong nước).",
  content: (
    <>
      <GuideSection title="Trình tự công việc">
        <GuideSteps>
          <li>
            <b>Lập hợp đồng nhập</b>: chọn đối tác trong danh mục Nhà cung cấp, ghi số hợp đồng, ngày ký, <b>loại hình</b> (sản xuất xuất khẩu · kinh doanh · gia công) và từng dòng hàng: tên hàng, số lượng (kg), đơn giá. Hàng gia công không ghi giá thì để trống đơn giá.
          </li>
          <li>
            Khi hàng sắp về, ở hồ sơ hợp đồng chọn <b>Ghi lần nhập</b>: ngày về kho (chưa về thì ngày dự kiến), cont lạnh 20 / 40 hoặc hàng lẻ, số cont, số B/L.
          </li>
          <li>
            Đính <b>bộ chứng từ</b> của lần nhập: 3 chứng từ bắt buộc có sẵn, chọn <b>Cập nhật</b> để ghi số, ngày, file. C/O, giấy kiểm dịch, B/L: có thì chọn <b>Thêm chứng từ</b>.
          </li>
          <li>
            Hàng về kho: thủ kho chọn <b>Ghi thực nhập</b>, ghi số kg của từng dòng hàng theo invoice.
          </li>
          <li>
            Nhập xong thì <b>Đóng hợp đồng</b> (Thao tác khác). Còn dòng chưa về đủ vẫn đóng được nhưng phải ghi lý do. Không cần ai duyệt.
          </li>
        </GuideSteps>
      </GuideSection>
      <GuideSection title="Trạng thái của lần nhập">
        <GuideList>
          <li>
            <b>Thiếu chứng từ</b>: chưa đủ Commercial Invoice, Packing List, tờ khai nhập khẩu. Dòng <b>Còn thiếu</b> ghi tên chứng từ còn thiếu. Việc tiếp: đính file.
          </li>
          <li>
            <b>Chờ thực nhập</b>: chứng từ đã đủ, chưa ghi số kg thực nhập. Việc tiếp: thủ kho Ghi thực nhập.
          </li>
          <li>
            <b>Đủ hồ sơ</b>: đủ 3 chứng từ bắt buộc và đã có thực nhập.
          </li>
          <li>
            <b>Đã hủy</b>: không tính vào tháng và số đã về. Khôi phục được khi hợp đồng còn mở.
          </li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Khi nào một chứng từ là xong">
        <GuideList>
          <li>Đã đính ít nhất một file. Tờ khai nhập khẩu cần thêm số tờ khai và loại hình.</li>
          <li>Lô không có chứng từ bắt buộc đó: chọn <b>Không áp dụng</b> và ghi lý do (VD hàng mẫu).</li>
          <li>Chứng từ bắt buộc không xóa được; chứng từ thêm (C/O, kiểm dịch, B/L, khác) xóa được, có Hoàn tác.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Trạng thái của hợp đồng và số còn lại">
        <GuideList>
          <li>
            <b>Chưa có lần nhập</b> → <b>Đang nhập</b> (có ít nhất một lần nhập) → <b>Đã đóng</b>. Hủy hợp đồng thì mọi lần nhập hủy theo.
          </li>
          <li>
            <b>Còn lại</b> của dòng hàng = kg hợp đồng − tổng thực nhập các lần nhập chưa hủy. Về nhiều hơn hợp đồng thì hiện <b>vượt x kg</b>, vẫn lưu được.
          </li>
          <li>Lô được xếp vào tháng theo ngày về kho; chưa về thì theo ngày dự kiến về.</li>
        </GuideList>
      </GuideSection>
    </>
  ),
};
