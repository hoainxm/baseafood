// ============================================================
// Tên file: src/features/shared/guides/warehouseNxtGuide.tsx
// Tên tiếng Việt: Hộp "Hướng dẫn: Nhập xuất tồn kho" (nút "?" ở thanh tiêu đề, trang /nxt-warehouse)
// Description: Static guide for the warehouse NXT ledger loaded from the plant's Excel report.
//              Source: WarehouseNxtScreen.tsx (sổ sống P5-A) · docs/app-map/04 (nxt_snapshots) ·
//              32-danh-muc (Kho lưu trữ). Wired into PAGE_GUIDES (features/shared/guideContent.tsx)
//              by the main session.
// ============================================================
import type { PageGuide } from "../guideContent";
import { GuideList, GuideSection, GuideSteps } from "./parts";

export const warehouseNxtGuide: PageGuide = {
  title: "Nhập xuất tồn kho",
  description: "Sổ Xuất – Nhập – Tồn theo báo cáo thật của xí nghiệp, kèm hàng đang nằm ở kho lưu nào.",
  content: (
    <>
      <GuideSection title="Đầu kỳ: nạp báo cáo">
        <GuideSteps>
          <li>
            Chọn <b>Nhập Excel báo cáo</b>, chọn file Xuất – Nhập – Tồn xuất từ hệ thống xí nghiệp (mẫu 10 cột).
          </li>
          <li>
            App tự đọc kỳ (dòng "Từ ngày … đến ngày …") và kho (dòng "Chi nhánh:"). Nạp lại cùng kho, cùng kỳ chỉ thay số,
            không nhân đôi.
          </li>
          <li>
            Chọn <b>Kho / chi nhánh</b>, <b>Kỳ báo cáo</b> để xem; <b>Kho lưu</b> để chỉ xem hàng ở một kho.
          </li>
        </GuideSteps>
      </GuideSection>
      <GuideSection title="Đọc số">
        <GuideList>
          <li>
            <b>Tồn cuối = tồn đầu + nhập − xuất</b>, tự tính, không gõ.
          </li>
          <li>
            <b>Khớp bất biến</b> (xanh): tổng ăn khớp. <b>Lệch bất biến</b> (đỏ): kiểm lại file hoặc số đã gõ.
          </li>
          <li>
            <b>Tồn cuối theo kho lưu</b>: mỗi nút là một kho (kg · số mã). Chọn để lọc, chọn lại để bỏ lọc.
          </li>
          <li>Tick vài dòng ⇒ thanh "Đã chọn N mã" cộng sẵn tổng của đúng mấy dòng đó, tô màu được.</li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Ghi số và gán kho lưu">
        <GuideList>
          <li>
            <b>Ghi nhập/xuất</b>: bật lưới gõ tồn đầu / nhập / xuất từng mã, gõ là ghi ngay, dán được khối số từ Excel.{" "}
            <b>Thêm mã</b> cho mã mới giữa kỳ. Xong chọn <b>Xong · xem lại</b>.
          </li>
          <li>
            Mọi mã nạp từ file nằm ở kho lưu <b>Kho Baseafood</b>. Hàng gửi kho lạnh thuê ngoài: tick các dòng → <b>Gán kho lưu</b>{" "}
            → chọn kho (chưa có thì gõ tên mới, app lưu vào Danh mục → Kho lưu trữ).
          </li>
        </GuideList>
      </GuideSection>
      <GuideSection title="Cuối kỳ">
        <p>
          Chọn <b>Tạo kỳ kế tiếp</b>, chọn kỳ mới rồi <b>Tạo kỳ · kế thừa tồn</b>: tồn cuối mọi mã (mọi kho lưu) thành tồn đầu
          kỳ mới, nhập / xuất để trống chờ ghi. Kỳ mới đã có mã thì chỉ cập nhật tồn đầu, giữ số đã ghi. Cần gửi kế toán thì
          dùng <b>Xuất Excel</b> hoặc <b>In A4</b>.
        </p>
      </GuideSection>
      <p className="text-muted-foreground">
        Sổ này chưa tự nối với sổ Nhập hàng, Sản xuất, Bán hàng (cần bảng ánh xạ mã kế toán) — số chỉ đổi khi nạp file hoặc
        gõ ở lưới.
      </p>
    </>
  ),
};
