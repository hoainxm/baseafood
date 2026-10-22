// ============================================================
// Tên file: src/features/shared/guides/wipGuide.tsx
// Tên tiếng Việt: Hộp "Hướng dẫn: Sản xuất thành phẩm" (nút "?" ở thanh tiêu đề)
// Description: Static guide for /wip — daily work order (sheet → save → ledger → report → lock),
//              status labels, lot rules, side ledgers (domestic sale, frozen goods, batter).
//              Source: docs/app-map/34-btp-san-xuat-kho.ba-spec.md + 35-btp-ui.design-spec.md.
//              ba-spec 43 v4 R14.
// ============================================================
import type { PageGuide } from "../guideContent";
import { GuideList, GuideSection, GuideSteps } from "./parts";

export const wipGuide: PageGuide = {
  title: "Sản xuất thành phẩm",
  description: "Ghi sản lượng thành phẩm làm ra mỗi ngày theo xưởng, chốt ngày và gửi báo cáo.",
  content: (
    <>
      <GuideSection title="Ghi sản lượng trong ngày">
        <GuideSteps>
          <li>
            Ở chế độ <b>📝 Ghi nhập</b>, phiếu trống mở sẵn. Soát <b>Ngày ghi sổ</b>, <b>Ngày sản xuất</b> (ngày làm ra
            thật) và <b>Phân xưởng</b>.
          </li>
          <li>
            Khai <b>Lô nguyên liệu dùng cho phiên này</b>: quét tem NL, gõ mã lô hoặc chọn lô. Mỗi loại nguyên liệu của
            một chuyến là một lô. Lưu là tự gắn lô cho thành phẩm đúng loại nguyên liệu.
          </li>
          <li>
            Ở bảng <b>Thành phẩm làm ra trong ngày</b>: chọn thành phẩm, gõ số block hoặc kg — dòng mới tự hiện. Chọn ✂
            để tách râu + bao tử. Mặt hàng tẩm bột thì ghi kg từng loại <b>Bột tẩm</b>.
          </li>
          <li>
            Có nguyên liệu bán thẳng thì thêm dòng ở <b>Bán nội địa trong ngày</b>. Có hàng sơ chế đem cấp đông thì
            thêm dòng ở <b>Hàng đông lạnh nhập kho (Hàng tạm)</b>.
          </li>
          <li>
            Chọn <b>Lưu vào sổ</b>. Thông báo có nút <b>In tem</b> để in tem QR lô cho các mẻ vừa lưu. Phiếu trống mới tự
            mở cho lượt kế.
          </li>
        </GuideSteps>
        <p>
          Phiếu đang gõ được tự lưu nháp: chuyển trang, tải lại vẫn còn. Nháp không tự vào sổ — chỉ vào sổ khi chọn{" "}
          <b>Lưu vào sổ</b>.
        </p>
      </GuideSection>

      <GuideSection title="Ghi bù">
        <GuideList>
          <li>
            <b>Ngày ghi sổ</b> sau <b>Ngày sản xuất</b>, hoặc ngày đó đã chốt ⇒ phải điền <b>Lý do ghi bù</b> mới lưu được.
          </li>
          <li>Ngày ghi sổ không được trước ngày sản xuất.</li>
        </GuideList>
      </GuideSection>

      <GuideSection title="Sổ ngày và trạng thái">
        <GuideList>
          <li>
            Chế độ <b>📖 Sổ ngày &amp; báo cáo</b>: chọn <b>Kỳ xem sổ</b>, ngày và phân xưởng để xem số đã lưu.
          </li>
          <li>
            <b>Chờ nhập kho</b>: mẻ mới ghi, thủ kho chưa duyệt ở <b>Kho dự trữ</b> — chưa tính vào tồn kho.
          </li>
          <li>
            <b>Đã nhập kho · &lt;kho&gt;</b>: thủ kho đã duyệt theo kg thực nhận, tồn kho dự trữ đã cộng.
          </li>
          <li>
            Nút từng dòng: <b>Gắn lô NL</b> (đã gắn thì hiện <b>Lô NL (n)</b>) · <b>Tem</b> · <b>Sửa</b> · <b>Bỏ</b> (có
            hỏi lại và Hoàn tác).
          </li>
          <li>
            <b>Bột tẩm</b> là phụ gia, <b>Bán nội địa</b> và <b>Hàng đông lạnh</b> là sổ riêng — cả ba không cộng vào tổng
            sản lượng thành phẩm.
          </li>
          <li>
            Sổ hàng đông lạnh: <b>Lô nhập Hàng tạm</b> còn bỏ được; <b>Đã lấy ra ở sổ kho</b> thì sửa ở Sổ kho tháng.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection title="Gửi báo cáo cuối ca">
        <p>
          Khối <b>Báo cáo công việc ngày</b> gom sản lượng theo xưởng × người thao tác. Chọn{" "}
          <b>Gửi báo cáo lên hệ thống</b> để báo số và lưu vết — gửi báo cáo <b>không khóa sổ</b>, khác với chốt ngày.
        </p>
      </GuideSection>

      <GuideSection title="Chốt ngày">
        <GuideSteps>
          <li>
            Xem đúng <b>một ngày</b> và <b>một xưởng</b> — dải chốt hiện <b>Chưa chốt</b> hoặc <b>Đã chốt</b>.
          </li>
          <li>
            Chọn <b>Chốt ngày</b>. Mẻ nào còn thẻ <b>Chưa gắn lô</b> thì gắn lô NL, hoặc ghi <b>Lý do chưa gắn lô</b> —
            chưa xử lý thì chưa chốt được.
          </li>
          <li>
            Còn nguyên liệu chưa chế biến hết đem cấp đông thì khai ở <b>Nguyên liệu còn dở đem lưu kho</b>, tách theo
            từng loại. Số này thành đông gửi ở sổ Tồn kho nguyên liệu.
          </li>
          <li>
            Đã chốt mà cần sửa: chọn <b>Mở lại ngày</b>, ghi lý do (được lưu vết), sửa xong chốt lại. Ghi thêm sau chốt
            mà không mở lại là ghi bù — dải chốt hiện <b>Còn ghi bù … kg sau chốt</b>.
          </li>
        </GuideSteps>
      </GuideSection>
    </>
  ),
};
