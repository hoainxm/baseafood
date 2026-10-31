// ============================================================
// Tên file cũ: src/features/shared/huongDan.tsx
// Tên tiếng Việt: Nội dung Hướng dẫn sử dụng từng màn hình
// Description: Screen Guide & Help Documentation Content
// ============================================================
import type { ReactNode } from "react";
import { dashboardGuide } from "./guides/dashboardGuide";
import { exportPlanningGuide } from "./guides/exportPlanningGuide";
import { importPlanningGuide } from "./guides/importPlanningGuide";
import { productionOrderGuide } from "./guides/productionOrderGuide";
import { materialStockGuide } from "./guides/materialStockGuide";
import { packagingGuide } from "./guides/packagingGuide";
import { qcGuide } from "./guides/qcGuide";
import { reconciliationGuide } from "./guides/reconciliationGuide";
import { warehouseNxtGuide } from "./guides/warehouseNxtGuide";
import { wipGuide } from "./guides/wipGuide";

/**
 * Nội dung "Hướng dẫn sử dụng" cho từng trang, mở từ nút "?" trên header.
 *
 * Giọng viết cho tổ trưởng / thủ kho 45–60 tuổi: nói VIỆC CẦN LÀM theo thứ tự,
 * không nói thuật ngữ kỹ thuật. Khóa theo id màn (khớp `screen` trong AppLayout).
 * Trang không có trong map (đăng nhập, quản lý người dùng) ⇒ không hiện nút.
 *
 * Nguồn nghiệp vụ: docs/app-map/30-nhap-hang · 33-ban-hang · 31-can-doi-ky ·
 * 32-danh-muc. Cập nhật hướng dẫn ở đây khi luồng màn đổi.
 */

export interface PageGuide {
  title: string;
  description?: string;
  content: ReactNode;
}

function Step({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-6">{children}</ol>;
}

function Y({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

const BASE_PAGE_GUIDES: Record<string, PageGuide> = {
  // Trang viết hộp riêng ở ./guides (quy tắc 18 — ba-spec 43 v4 R14).
  wip: wipGuide,
  packaging: packagingGuide,
  qc: qcGuide,
  "planning-import": importPlanningGuide,
  "planning-production": productionOrderGuide,
  "planning-export": exportPlanningGuide,
  "nxt-material": materialStockGuide,
  "nxt-warehouse": warehouseNxtGuide,
  reconciliation: reconciliationGuide,
  dashboard: dashboardGuide,
  "my-tasks": {
    title: "Việc của tôi",
    description: "Việc bạn cần làm, hạn của từng việc, và việc bạn đã giao.",
    content: (
      <>
        <Section title="Ba mục trên màn">
          <Y>
            <li>
              <b>Được giao cho tôi</b>: việc người khác giao riêng cho bạn, có hạn. Việc giao tay thì làm xong chọn <b>Xong</b>.
            </li>
            <li>
              <b>Việc theo quyền của tôi</b>: việc máy tự phát hiện thuộc phần việc của bạn: ngày nhập / sản xuất chưa chốt, BTP chờ
              duyệt nhập kho, mẻ chưa gắn lô, kỳ cân đối chưa chốt. Quản đốc chỉ thấy việc của xưởng mình.
            </li>
            <li>
              <b>Tôi đã giao</b>: việc bạn giao cho người khác, để đốc. Người nhận để quá hạn thì hiện đỏ.
            </li>
          </Y>
        </Section>
        <Section title="Làm một việc">
          <Step>
            <li>
              Chọn <b>Mở việc</b>: app mở đúng màn, đúng ngày và xưởng cần sửa.
            </li>
            <li>Làm xong ở màn đó (chốt ngày, duyệt kho, gắn lô…). Quay lại đây là việc đã tự hết, không cần làm gì.</li>
          </Step>
        </Section>
        <Section title="Hạn">
          <Y>
            <li>Chốt ngày nhập / sản xuất và gắn lô: trong ngày, sang hôm sau là quá hạn.</li>
            <li>Duyệt BTP vào kho: trong 3 ngày. Chốt kỳ cân đối: 2 ngày sau ngày cuối kỳ.</li>
            <li>Việc được giao: theo hạn người giao đặt.</li>
          </Y>
        </Section>
        <Section title="Giao việc (quản đốc, kế toán)">
          <Y>
            <li>
              Chọn <b>Giao</b> ở một việc để giao cho đúng một người. Người khác không thấy việc đó nữa, khỏi làm trùng.
            </li>
            <li>
              <b>Giao việc mới</b>: giao việc tay (tiêu đề, hạn, màn cần mở). <b>Thu hồi</b> thì việc quay về danh sách chung.
            </li>
          </Y>
        </Section>
      </>
    ),
  },
  documents: {
    title: "Tài liệu công ty",
    description: "Quy trình, biểu mẫu, chứng nhận và hồ sơ năng lực: bản đang hiệu lực, các lần ban hành, file gốc.",
    content: (
      <>
        <Section title="Bạn thấy tài liệu nào">
          <Y>
            <li>Tài liệu của <b>phòng mình</b>, tài liệu mở cho <b>cả công ty</b>, và tài liệu phòng khác chọn cho phòng mình xem.</li>
            <li>Ban giám đốc và quản trị viên thấy tất cả. Phòng của bạn suy từ vai trò (quản trị đặt ở Vai trò &amp; quyền).</li>
          </Y>
        </Section>
        <Section title="Xem và tải file">
          <Step>
            <li>Tìm theo mã hoặc tên, lọc theo loại / phòng / trạng thái.</li>
            <li>
              Chọn <b>Xem</b> ở một dòng: thấy lần đang hiệu lực, các lần cũ (vẫn mở được, có nhãn Hết hiệu lực) và biểu mẫu con.
            </li>
            <li>
              Chọn <b>Xem PDF</b> (trong hộp chi tiết còn <b>Tải PDF</b> / <b>Tải file gốc</b>). Link mở file chỉ dùng được ít phút, không gửi ra ngoài được.
            </li>
          </Step>
        </Section>
        <Section title="Ban hành lần mới (người có quyền)">
          <Step>
            <li>
              Trong chi tiết tài liệu chọn <b>Ghi lần ban hành</b>: điền ngày hiệu lực, nội dung sửa, người soạn / xem xét / phê duyệt,
              đính <b>PDF đã ký</b> (bắt buộc) và file Word gốc nếu có.
            </li>
            <li>Lưu xong lần mới có hiệu lực ngay, lần cũ tự chuyển Hết hiệu lực. Không sửa lần đã ban hành, muốn sửa thì ghi lần mới.</li>
            <li>
              Lần ban hành <b>chưa có file</b> (vd QTI-KH-01 nạp từ bản giấy): mở hộp chi tiết rồi chọn <b>Đính PDF đã ký</b> / <b>Đính file gốc</b> để đính
              bản đã có. Chỉ đính được vào ô còn trống, không thay file đã có.
            </li>
          </Step>
        </Section>
        <Section title="Chứng nhận có hạn">
          <Y>
            <li>
              Chứng nhận / hồ sơ năng lực có ngày hết hạn: còn 60 ngày thì hiện việc <b>Gia hạn</b> ở Việc của tôi của người có quyền
              sửa tài liệu.
            </li>
          </Y>
        </Section>
      </>
    ),
  },
  imports: {
    title: "Nhập hàng",
    description: "Ghi sổ nguyên liệu về xưởng mỗi ngày.",
    content: (
      <>
        <Section title="Ghi một chuyến hàng">
          <Step>
            <li>
              Ở chế độ <b>Ghi nhập</b>, phiếu chuyến mở sẵn. Một chuyến là <b>một đại lý giao một lượt</b>.
              Đại lý giao 2 lần trong ngày thì ghi 2 chuyến riêng.
            </li>
            <li>
              Điền đầu chuyến: ngày, phân xưởng, đại lý, tài xế, biển số. Đại lý
              chưa có trong danh sách thì gõ tên mới, hệ thống tự lưu vào danh mục.
            </li>
            <li>
              Thêm từng mặt hàng của chuyến: chọn <b>loài trước</b>, rồi loại
              nguyên liệu, số cân (kg), đơn giá.
            </li>
            <li>
              Chưa có hóa đơn thì <b>để trống đơn giá</b> — dòng hiện nhãn "Chưa
              có giá", điền sau.
            </li>
            <li>
              Chọn <b>Lưu chuyến vào sổ</b>. Phiếu trống hiện ra cho chuyến kế, giữ
              ngày và phân xưởng, đại lý để trống để chọn lại. Đang gõ dở thì phiếu tự lưu nháp, nhưng chỉ vào
              sổ khi chọn Lưu.
            </li>
          </Step>
        </Section>
        <Section title="Hai ô ngày">
          <Y>
            <li>
              <b>Ngày hàng về xưởng</b>: ngày hàng thật về — dùng cho mọi con số
              tổng hợp.
            </li>
            <li>
              <b>Ngày ghi sổ</b>: ngày bạn nhập vào máy. Nhập muộn hơn ngày hàng
              về là <b>ghi bù</b> — phải ghi lý do.
            </li>
          </Y>
        </Section>
        <Section title="Phế liệu (nội tạng, hàng dạt)">
          <p>
            Cân gộp cuối ngày, gõ số kg vào ô <b>Nội tạng</b> và <b>Dạt</b> ở khối{" "}
            <b>Cuối ngày</b>, ngay trên nút Chốt ngày, rồi chọn <b>Lưu phế liệu</b>.
            Chọn <b>Chốt ngày</b> cũng tự lưu số đang gõ. Loại khác thì chọn{" "}
            <b>Loại khác</b>. Chỉ nhập một lần ở đây — màn Cân đối sẽ hút sang.
          </p>
        </Section>
        <Section title="Chốt ngày">
          <p>
            Xem hết số trong ngày rồi kéo xuống cuối màn chọn <b>Chốt ngày</b>
            (theo ngày + phân xưởng). Chốt xong khóa sửa. Cần sửa thêm thì{" "}
            <b>ghi bù</b> hoặc <b>mở lại ngày</b> — cả hai đều bắt ghi lý do.
          </p>
        </Section>
        <Section title="Hóa đơn đại lý (kế toán)">
          <p>
            Tab <b>Hóa đơn</b> gắn hóa đơn GTGT của đại lý vào đúng chuyến đã ghi. Chọn một lượt file Excel{" "}
            <b>sổ chi tiết NL</b> (xuất từ phần mềm kế toán) và các <b>PDF hóa đơn</b>; máy ghép theo đại lý + ngày
            hàng về (cột "Ngày HĐ") + loại + số kg, xem trước rồi chọn <b>Gắn hóa đơn vào chuyến</b>. Mã kế toán lạ
            chọn đại lý / loại một lần. Máy <b>không tự đổi số chuyến</b>.
          </p>
          <Y>
            <li><b>Khớp</b> · <b>Đã cập nhật theo HĐ</b>: xong.</li>
            <li>
              <b>Lệch giá / Lệch kg</b>: chọn <b>Cập nhật theo HĐ</b> (ghi vết "[Sửa theo HĐ …]", có Hoàn tác) hoặc{" "}
              <b>Giữ số xưởng</b> kèm lý do ⇒ <b>Lệch đã giải trình</b>.
            </li>
            <li>
              <b>Không có chuyến</b>: <b>Tạo chuyến từ HĐ</b> (ghi bù, lý do điền sẵn) hoặc <b>Không thuộc chuyến</b>{" "}
              (hàng đông gửi kho lạnh).
            </li>
            <li><b>Chưa ánh xạ</b>: chọn đại lý / loại cho mã kế toán rồi nạp lại.</li>
            <li>
              Lọc: <b>Đại lý</b> · <b>Phân xưởng</b> · <b>Trạng thái dòng</b> · ô tra số HĐ, ký hiệu, số phiếu nhập, mã đại lý / vật tư,
              biển số. Bốn thẻ đếm theo bộ lọc; <b>Bỏ hết bộ lọc</b> để về cả khoảng ngày.
            </li>
          </Y>
          <p>
            Một khoảng ngày xong chứng từ khi bốn thẻ <b>Chuyến chờ HĐ · HĐ chưa có file · Lệch chưa xử · HĐ không có
            chuyến</b> đều về 0. Trên Sổ chi tiết, mỗi chuyến có nhãn "Chờ HĐ" hoặc "HĐ 936".
          </p>
        </Section>
        <Section title="Xem báo cáo">
          <p>
            Chế độ <b>Báo cáo</b> có <b>Tổng hợp theo kỳ</b> (tổng nhập theo đại lý và loại nguyên liệu, kg chờ giá) và{" "}
            <b>Sổ chi tiết các chuyến</b> (lọc, in báo cáo A4 ngang, in phiếu trống).
          </p>
        </Section>
        <Section title="Mã lô & in tem QR">
          <Y>
            <li>
              Khi chọn <b>ngày về</b> và <b>phân xưởng</b>, ô <b>Mã lô nội bộ</b>{" "}
              tự hiện mã (vd <b>Đ-260912-01</b>) — không phải gõ. Mỗi loại nguyên liệu của chuyến là một lô, in một tem.
            </li>
            <li>
              Lưu chuyến xong, chọn <b>In tem</b> ở thông báo vừa lưu, hoặc <b>In tem QR</b> ở chuyến trong{" "}
              <b>Sổ chi tiết các chuyến</b> (chuyến có nhãn <b>Lô …</b>).
            </li>
            <li>
              Chọn <b>khổ tem</b> đúng máy in tem → chọn <b>In tem</b> →{" "}
              <b>dán tem lên lô hàng</b>. Sau này quét tem ở màn <b>Quét lô (QR)</b>{" "}
              là ra đúng lô.
            </li>
            <li>
              Ô <b>Mã SSCC</b> chưa được cấp thì để trống, điền sau.
            </li>
          </Y>
        </Section>
      </>
    ),
  },

  sales: {
    title: "Bán hàng",
    description: "Ghi phiếu bán thành phẩm ra cho khách mỗi ngày.",
    content: (
      <>
        <Section title="Ghi một phiếu bán">
          <Step>
            <li>
              Chọn <b>Ghi phiếu</b>. Một phiếu là <b>một khách nhận hàng một lượt
              </b>, có thể nhiều mặt hàng.
            </li>
            <li>
              Điền đầu phiếu: ngày, khách, <b>kênh bán</b> (Xuất khẩu tính bằng
              USD, Nội địa bằng VND), ghi chú.
            </li>
            <li>
              Thêm từng dòng: mặt hàng, <b>quy cách/size</b> (VD "18-20"), số cân,
              đơn giá theo kênh đã chọn.
            </li>
          </Step>
        </Section>
        <Section title="Hai ô ngày & ghi bù">
          <p>
            Giống Nhập hàng: <b>ngày xuất bán</b> dùng cho tổng hợp;{" "}
            <b>ngày ghi sổ</b> muộn hơn là ghi bù, phải ghi lý do.
          </p>
        </Section>
        <Section title="Tổng của kỳ">
          <p>
            Cuối sổ có tổng khối lượng (kg mọi kênh) và tiền bán <b>tách theo kênh</b>: <b>Tiền bán Xuất khẩu</b> (USD) và{" "}
            <b>Tiền bán Nội địa</b> (đ). Hai đơn vị không cộng chung, không quy đổi tỉ giá.
          </p>
        </Section>
        <Section title="Tab Báo cáo">
          <p>
            Chọn tab <b>Báo cáo</b> để xem tổng bán theo <b>khách × kênh</b> trong kỳ: số cân (kg), giá trị theo đơn vị của
            kênh, thẻ <b>Giá trị Xuất khẩu</b> (USD) và <b>Giá trị Nội địa</b> (đ) riêng, biểu đồ sản lượng theo khách. Báo cáo
            chỉ đọc sổ bán, không ghi gì.
          </p>
        </Section>
      </>
    ),
  },

  warehouse: {
    title: "Kho dự trữ",
    description: "Duyệt nhập kho và theo dõi tồn hàng cấp đông.",
    content: (
      <>
        <p>
          Trang theo dõi hàng bán thành phẩm đã cấp đông cất trong kho dự trữ, chờ
          gom đủ đơn đặt để xuất.
        </p>
        <Y>
          <li>Duyệt các đợt nhập kho.</li>
          <li>Theo dõi lượng tồn đông còn lại theo mặt hàng.</li>
        </Y>
      </>
    ),
  },

  orders: {
    title: "Đơn đặt",
    description: "Gom hàng theo đơn khách đặt và lập lệnh xuất.",
    content: (
      <>
        <p>
          Đơn đặt là đơn xuất khẩu số lượng lớn. Trang giúp gom đủ hàng từ kho dự
          trữ theo từng đơn rồi lập lệnh xuất container (nhiều block, nhiều quy
          cách).
        </p>
        <p className="text-muted-foreground">
          Phí xuất khẩu do phòng kế hoạch tính riêng, không tính ở đây.
        </p>
      </>
    ),
  },

  balancing: {
    title: "Cân đối kỳ",
    description: "Cân đối một lô nguyên liệu ra thành phẩm, tính định mức và lãi/lỗ.",
    content: (
      <>
        <Section title="Tạo một kỳ cân đối">
          <Step>
            <li>
              Chọn tạo kỳ. Một kỳ = <b>một loại nguyên liệu</b> + các ngày nhận của
              lô đó (ngày có thể rời rạc).
            </li>
            <li>
              Khai thông số kỳ: tổng nguyên liệu nhận, chi phí chế biến trên mỗi kg
              thành phẩm, tỉ giá (mặc định 26.000 đ/USD).
            </li>
          </Step>
        </Section>
        <Section title="Hai khối số liệu">
          <Y>
            <li>
              <b>Nguyên liệu vào</b>: tự lấy từ sổ Nhập hàng theo loại nguyên liệu và ngày hàng về (tiền = kg × giá từng chuyến).
              Dòng giảm (VD bán nội địa — chọn <b>Lấy bán nội địa từ SX</b>) gõ số dương, lưu thành số âm. <b>Lấy xả đông</b> /{" "}
              <b>Gửi đông</b> ghi thẳng vào Sổ kho tháng.
            </li>
            <li>
              <b>Bán thành phẩm sản xuất</b>: thành phẩm làm ra trong kỳ, theo mặt
              hàng × quy cách × khách × kênh — chọn <b>Lấy … dòng từ sổ</b> để lấy từ sổ sản xuất / sổ bán.
            </li>
            <li>
              Kỳ xong thì chọn <b>Chốt kỳ</b>: mọi ô khóa; muốn sửa phải <b>Mở lại kỳ</b> (ghi lý do).
            </li>
          </Y>
        </Section>
        <Section title="Kết quả & in">
          <p>
            Có đủ nguyên liệu và thành phẩm, hệ thống tự tính <b>định mức</b>{" "}
            (nguyên liệu ÷ thành phẩm), <b>tỉ lệ thu hồi</b> và <b>lãi/lỗ</b>. Chọn
            xem/in <b>bảng cân đối A4</b> để lưu hồ sơ.
          </p>
        </Section>
      </>
    ),
  },

  catalog: {
    title: "Danh mục",
    description: "Mặt hàng, khách hàng, đại lý, loại nguyên liệu, bột tẩm, kho lưu trữ và 141 mã thành phẩm — chọn từ danh mục thay gõ tay để tổng cuối kỳ đúng.",
    content: (
      <>
        <p>
          Bảy tab: <b>Mặt hàng · Khách hàng · Đại lý · Loại nguyên liệu · Bột tẩm · Kho lưu trữ · Thành phẩm</b>. Tab nào
          tài khoản không được xem thì ẩn; tab chỉ xem có nhãn <b>Chỉ xem</b>.
        </p>
        <Y>
          <li>Sáu tab đầu: tìm, xem chi tiết, thêm / sửa / xóa (xóa hỏi lại trước, có <b>Hoàn tác</b>). Trùng mã số hoặc trùng tên thì app báo.</li>
          <li>Đổi tên ở danh mục không sửa các dòng sổ đã ghi trước đó.</li>
          <li>
            <b>Đại lý</b> (nơi mua nguyên liệu) tách riêng với <b>khách hàng</b> (nơi bán thành phẩm) — đừng gộp. Đại lý có{" "}
            <b>tên gọi tắt</b> (ghi trên sổ) và <b>tên đầy đủ</b> (ghi hóa đơn).
          </li>
          <li>
            <b>Mặt hàng</b> có <b>tên tiếng Anh mặc định</b> (dùng trên hợp đồng / invoice khi khách chưa có tên riêng) và{" "}
            <b>bột đi kèm</b> cho hàng tẩm bột.
          </li>
          <li>
            Tab <b>Khách hàng</b>: nút <b>Tên hàng</b> ở mỗi khách mở bảng <b>Tên hàng trên chứng từ</b> — tên, size, quy cách,
            mã HS khách dùng; <b>Trích xuất từ chứng từ</b> lấy thêm tên còn thiếu từ hợp đồng và invoice (không ghi đè).
          </li>
          <li><b>Bột tẩm</b> là phụ gia, không cộng vào kg thành phẩm. <b>Kho lưu trữ</b> gồm kho nhà và kho thuê ngoài.</li>
          <li>
            Tab <b>Thành phẩm</b> (141 mã kế toán) chỉ để tra, không sửa trong app.
          </li>
        </Y>
        <p className="text-muted-foreground">
          Ở mọi màn nhập liệu, gõ tên mới trong ô chọn là tạo ngay vào danh mục (trùng tên thì dùng lại mục cũ); bút chì cạnh ô
          mở sửa nhanh mục đang chọn.
        </p>
      </>
    ),
  },

  "production-report": {
    title: "Báo cáo thành phẩm hàng ngày",
    description: "Tổng hợp thành phẩm sản xuất theo ngày, gom theo phân xưởng.",
    content: (
      <>
        <Section title="Cách xem">
          <Step>
            <li>Chọn <b>kỳ</b> (ngày / tuần / tháng / khoảng tự chọn) và <b>phân xưởng</b>.</li>
            <li>
              Bảng hiện <b>mặt hàng × ngày</b>: mỗi cột là một ngày, cột cuối là tổng.
              Có dòng <b>cộng xưởng</b> và <b>tổng cộng</b> ở chân.
            </li>
          </Step>
        </Section>
        <Section title="Xuất Excel">
          <p>
            Chọn <b>Xuất Excel</b> để tải file cho kế toán đối chiếu — giữ đúng lưới
            ngày, cộng xưởng và tổng.
          </p>
        </Section>
        <p className="text-muted-foreground">
          Đây là sản lượng <b>làm ra</b> (mọi trạng thái), không phải tồn kho. Số lấy
          từ màn <b>Sản xuất BTP</b>.
        </p>
      </>
    ),
  },

  "export-report": {
    title: "Báo cáo đơn đặt được xuất hàng",
    description: "Những ngày này đơn nào được xuất, xuất bao nhiêu.",
    content: (
      <>
        <Section title="Cách xem">
          <Step>
            <li>Chọn <b>khoảng ngày xuất</b> và (tùy chọn) <b>khách hàng</b>.</li>
            <li>
              Kết quả gom theo <b>đơn</b>: đầu đơn ghi khách · ngày đặt · trạng thái ·
              kg đã đặt; bên dưới liệt kê từng dòng <b>thực xuất</b> (ngày xuất · mặt
              hàng · quy cách · kg · block).
            </li>
          </Step>
        </Section>
        <p className="text-muted-foreground">
          Số lấy từ <b>lệnh xuất</b> ở màn Đơn đặt. Chọn <b>Xuất Excel</b> để lưu hồ sơ.
        </p>
      </>
    ),
  },

  nxt: {
    title: "Tồn kho thành phẩm",
    description: "Nhập – Xuất – Tồn kho thành phẩm cấp đông.",
    content: (
      <>
        <Section title="Đọc bảng">
          <Y>
            <li><b>Nhập</b>: bán thành phẩm đã duyệt vào kho (màn Kho dự trữ).</li>
            <li><b>Xuất đơn</b>: xuất container theo Đơn đặt.</li>
            <li><b>Xuất bán</b>: bán hàng ngày (sổ Bán hàng) — không tính hai lần phần đã xuất qua đơn.</li>
            <li><b>Tồn cuối</b> = Tồn đầu + Nhập − Xuất. Khớp với Tổng tồn ở màn Kho dự trữ.</li>
          </Y>
        </Section>
        <Section title="Tồn đầu">
          <p>
            Có bán thành phẩm cấp đông <b>trước khi dùng app</b> thì chọn <b>Tồn đầu</b>,
            khai một lần theo mặt hàng × quy cách. Các kỳ sau tự kế thừa.
          </p>
        </Section>
        <Section title="Tồn âm">
          <p>
            Dòng báo <b>Tồn âm</b> = xuất nhiều hơn số đang trữ → kiểm lại sản xuất /
            đơn / bán, hoặc thiếu khai tồn đầu. Không được bỏ qua.
          </p>
        </Section>
      </>
    ),
  },

  "monthly-stock": {
    title: "Sổ kho theo tháng",
    description: "Theo dõi tồn đầu · nhập · xuất · tồn cuối (kg) từng lô hàng theo tháng.",
    content: (
      <>
        <Section title="Đầu tháng: mở sổ">
          <Step>
            <li>Chọn <b>Kỳ (tháng)</b> ở ô trên cùng (hoặc chọn ◀ ▶).</li>
            <li>
              Tháng mới chưa có dòng nào thì màn hiện <b>bản xem trước</b> tồn đầu lấy
              từ tồn cuối tháng trước. Soát lại rồi chọn <b>Kế thừa &amp; lưu vào sổ</b>.
              Chưa chọn thì chưa ghi được gì.
            </li>
          </Step>
        </Section>
        <Section title="Lấy hàng ra sử dụng (xuất)">
          <Step>
            <li>Tìm dòng hàng (gõ tên / invoice / vị trí vào ô <b>Tìm mặt hàng</b>).</li>
            <li>Chọn nút <b>hộp có dấu trừ</b> ở cuối dòng.</li>
            <li>Chọn <b>Lấy ra sử dụng</b>, gõ <b>số kg</b>, chọn ngày, ghi chú nếu cần.</li>
            <li>Chọn <b>Lưu thao tác</b>. Số kg cộng vào cột <b>Xuất trong kỳ</b>, tồn cuối tự giảm.</li>
          </Step>
          <p>Lấy nhiều lần trong tháng thì làm lại từng lần — số tự cộng dồn, không phải cộng tay.</p>
        </Section>
        <Section title="Gửi kho ngoài (đổi chỗ để hàng)">
          <Y>
            <li>
              <b>Một dòng:</b> chọn nút hộp cuối dòng → chọn <b>Gửi kho ngoài</b> → gõ số kg →
              chọn <b>Chuyển tới</b> (VD Kho Ánh Dương) → Lưu.
            </li>
            <li>
              Gửi <b>hết</b> tồn ⇒ dòng chỉ đổi cột <b>Vị trí</b>. Gửi <b>một phần</b> ⇒ hệ
              thống tách thành dòng mới ở kho đích. Tổng tồn của tháng <b>không đổi</b> vì gửi
              kho ngoài không phải nhập hay xuất.
            </li>
            <li>
              <b>Nhiều dòng cùng lúc</b> (gửi cả lô): tick ô đầu các dòng → chọn{" "}
              <b>Gửi kho ngoài</b> trên thanh "Đã chọn" → chọn kho → Lưu.
            </li>
            <li>Kho chưa có trong danh sách thì gõ tên mới, hệ thống tự lưu vào danh mục.</li>
          </Y>
        </Section>
        <Section title="Chuyển dòng sang bảng hoặc kho khác">
          <Y>
            <li>
              Tick ô đầu các dòng → chọn <b>Chuyển bảng</b> trên thanh "Đã chọn" → chọn{" "}
              <b>Bảng nhận</b> (nhóm hàng) và/hoặc <b>Kho nhận</b> → chọn <b>Chuyển N dòng</b>.
            </li>
            <li>
              Ô nào để trống thì từng dòng giữ bảng / kho của mình. Số kg, vị trí, ghi chú{" "}
              <b>không đổi</b>, nên tổng tháng không đổi — chỉ đổi dòng nằm ở bảng nào.
            </li>
            <li>
              Tháng sau <b>đã mở</b> thì dòng dồn của các lô này cũng chuyển theo. Tháng trước không
              đổi. Tháng sau đã có dòng bị dời đi chỗ khác thì giữ nguyên chỗ đó.
            </li>
            <li>Một dòng: chọn ✎ ở cuối dòng, đổi ô Nhóm hàng hoặc Kho rồi Lưu — tháng sau cũng đi theo.</li>
            <li>Chuyển nhầm thì chọn Hoàn tác trên thông báo, hoặc nút Hoàn tác (Ctrl+Z) của sổ.</li>
          </Y>
        </Section>
        <Section title="Thứ tự dòng: theo loài, xếp tay">
          <Y>
            <li>
              Mỗi bảng chia theo <b>loài</b>: <b>cá trên, bạch tuộc dưới</b>, rồi mực, tôm, ghẹ, bào ngư, khác.
              Mỗi loài có dòng <b>Cộng</b> riêng; dòng Cộng của bảng vẫn cộng cả bảng.
            </li>
            <li>
              Loài lấy theo Danh mục (loại nguyên liệu, mặt hàng). Tên chưa có trong danh mục thì hệ thống đoán từ
              tên hàng. Xếp sai loài thì sửa loài của tên đó ở Danh mục.
            </li>
            <li>
              Muốn tự xếp: chọn <b>Xếp dòng</b> ở đầu bảng → chọn mũi tên <b>lên / xuống</b> trên từng dòng (chỉ đổi
              chỗ trong cùng loài) → chọn <b>Xong</b>. Thứ tự lưu vào sổ và theo sang tháng sau khi dồn kỳ.
            </li>
            <li>
              <b>Về mặc định</b> xếp lại cá trên, bạch tuộc dưới, trong mỗi loài theo tên A → Z. Lỡ tay thì Ctrl+Z.
            </li>
          </Y>
        </Section>
        <Section title="Hàng mới về">
          <Y>
            <li>
              <b>Lô mới</b> (ngày nhập / invoice khác): chọn <b>Thêm dòng</b>, điền ngày nhập, tên,
              invoice, đơn giá, số kg ô <b>Nhập trong kỳ</b>, vị trí.
            </li>
            <li>
              <b>Về thêm cho đúng lô đang có</b>: nút hộp cuối dòng → <b>Nhập thêm</b>.
            </li>
          </Y>
        </Section>
        <Section title="Gõ số hàng loạt, sửa, xóa">
          <Y>
            <li>
              <b>Gõ thẳng trên bảng</b>: ngày nhập, size, invoice, đơn giá, tồn đầu / nhập / xuất
              (kg), vị trí — gõ là ghi ngay, tồn cuối + tiền còn lại tự tính. Enter / ↑ / ↓ đi dọc
              cột, dán được khối số từ Excel, <b>Ctrl+Z</b> hoàn tác, <b>Ctrl+Y</b> làm lại. Lưu ý: ô
              trên bảng là <b>tổng cả tháng</b> (ghi đè), còn nút hộp cuối dòng là <b>cộng thêm</b>
              từng lần.
            </li>
            <li>
              <b>Dòng mới</b> (cuối mỗi bảng nhóm): gõ hoặc chọn tên hàng là dòng hiện luôn trong
              bảng, con trỏ nhảy sang ô Nhập để gõ số tiếp. Cần điền nhiều ô một lần thì chọn{" "}
              <b>Thêm đủ thông tin…</b>.
            </li>
            <li>Nút <b>bút chì</b>: đổi tên hàng, nhóm (và mọi ô khác trong một hộp).</li>
            <li>Nút <b>thùng rác</b>: xóa dòng (có hỏi lại, xóa nhầm chọn <b>Hoàn tác</b>).</li>
            <li>Nút <b>đồng hồ</b>: thẻ kho — lịch sử mặt hàng qua các tháng + nhật ký thao tác.</li>
          </Y>
        </Section>
        <Section title="Xem cho gọn">
          <Y>
            <li>
              <b>Ẩn dòng trống</b>: giấu các dòng không có số (tồn đầu, nhập, xuất đều 0). Chọn lại
              để hiện.
            </li>
            <li>Tick vài dòng ⇒ thấy ngay tổng của đúng mấy dòng đó, in riêng được.</li>
          </Y>
        </Section>
        <Section title="Cuối tháng">
          <p>
            Soát xong chọn <b>Dồn sang tháng sau</b>: tồn cuối tháng này thành tồn đầu tháng sau
            (mọi kho). Chọn lại chỉ cập nhật, không nhân đôi.
          </p>
        </Section>
      </>
    ),
  },

  qr: {
    title: "Mã lô QR",
    description: "In tem QR dán lên hàng, và quét tem để tra lô làm từ đâu, đã đi đâu.",
    content: (
      <>
        <Section title="Mã lô là gì">
          <Y>
            <li>
              Có <b>3 loại lô</b>: <b>nguyên liệu</b> (mỗi <b>loại nguyên liệu</b> của một
              chuyến là một lô — chuyến 3 loại thì 3 lô, 3 tem cùng mã chuyến vd{" "}
              <b>Đ-260912-01</b>, mỗi tem ghi đúng loại + kg), <b>bán thành phẩm</b> (mỗi mẻ sản xuất, vd{" "}
              <b>BĐ-260912-7F3A</b>), <b>thành phẩm</b> (mỗi phiếu đóng gói, vd{" "}
              <b>TĐ-260912-C21B</b>). Mã tự có, <b>không phải gõ</b>.
            </li>
            <li>
              Chuyến nhập cũ chưa có mã lô thì app tự đặt mã dạng <b>NĐ-…</b> — vẫn in
              tem và tra được bình thường.
            </li>
            <li>
              <b>Tem QR</b> dán lên hàng; sau này <b>quét</b> (camera điện thoại nào
              cũng được) hoặc <b>gõ mã</b> là ra đúng lô.
            </li>
          </Y>
        </Section>
        <Section title="In tem nhiều lô một lượt (tab In tem hàng loạt)">
          <Step>
            <li>
              Ở màn này chọn tab <b>In tem hàng loạt</b>.
            </li>
            <li>
              Chọn <b>khoảng ngày</b>, <b>phân xưởng</b> và <b>loại lô</b> (nguyên
              liệu / bán thành phẩm / thành phẩm). Danh sách lô hiện bên dưới, mặc
              định chọn hết — bỏ tick lô không cần in.
            </li>
            <li>
              Chọn <b>In … tem</b> → chọn <b>khổ tem</b> (vd 50×30 mm) → <b>In</b> →
              chọn <b>máy in tem</b> trong hộp thoại in. Mặc định mỗi <b>block</b> (bán
              thành phẩm) / mỗi <b>thùng</b> (thành phẩm) một tem — sửa ô <b>Số tem</b> dưới
              từng tem nếu cần.
            </li>
          </Step>
        </Section>
        <Section title="In tem ngay lúc ghi">
          <Y>
            <li>
              Lưu xong chuyến nhập, mẻ sản xuất hay phiếu đóng gói, thông báo thả
              xuống ở đầu màn có nút <b>In tem</b> — chọn là in luôn.
            </li>
            <li>
              In lại sau: <b>Nhập hàng</b> → nút <b>Tem</b> ở cột "Đã ghi ngày", hoặc{" "}
              <b>📊 Báo cáo → Sổ chi tiết các chuyến</b> → <b>In tem QR</b>.{" "}
              <b>Sản xuất thành phẩm</b> và <b>Đóng gói</b>: nút <b>Tem</b> ở từng dòng.
            </li>
          </Y>
        </Section>
        <Section title="Quét / tra lô (tab Tra lô)">
          <Step>
            <li>
              Chọn <b>Quét bằng camera</b> rồi đưa tem QR vào khung; hoặc <b>gõ tay
              mã lô</b> vào ô bên dưới.
            </li>
            <li>
              Màn hiện lô là gì, <b>cân bằng kg</b>, <b>truy ngược</b> (làm từ lô
              nào, đại lý nào) và <b>truy xuôi</b> (đã vào mẻ nào, xuất / bán cho ai). Tem
              mờ / bong thì chọn <b>In tem</b> ngay đây.
            </li>
            <li>
              Lô nghi có vấn đề: xuống mục <b>Thu hồi</b> — danh sách khách đã nhận hàng
              từ lô này + lô còn trong xưởng. Chọn <b>In danh sách</b> hoặc <b>Tải Excel</b>.
            </li>
          </Step>
        </Section>
        <Section title="Kiểm QR từng khâu (tab Theo giai đoạn)">
          <Step>
            <li>
              Chọn tab <b>Theo giai đoạn</b>, chọn khoảng ngày + xưởng. Màn xếp 5 khâu theo
              thứ tự: <b>Nhập nguyên liệu → Sản xuất → Nhập kho → Đóng gói → Xuất & bán</b>.
            </li>
            <li>
              Mỗi dòng có nhãn trạng thái: đã in tem chưa, đã gắn lô chưa, chờ duyệt kho,
              đã quét kiểm chưa. Khâu nào còn thiếu thì hiện <b>Còn thiếu N</b>.
            </li>
            <li>
              Chọn nút ngay ở dòng: <b>In tem</b>, <b>Gắn lô NL / BTP</b>, <b>Gắn lô</b> (dòng
              bán), <b>Duyệt nhập kho</b> (mở thẳng hộp duyệt ở Kho dự trữ), <b>Kiểm lô</b>{" "}
              (mở thẳng hộp kiểm ở Đơn đặt). Tick <b>Chỉ hiện mục còn thiếu</b> để lọc.
            </li>
          </Step>
        </Section>
        <Section title="Lưu ý">
          <Y>
            <li>
              Muốn truy được trọn chuỗi: lúc ghi sản xuất quét tem các chuyến NL vào khối{" "}
              <b>Lô nguyên liệu dùng cho phiên này</b> (lưu là tự gắn cho mọi mẻ cùng loài);
              đóng gói chọn <b>Gắn lô BTP</b>; bán hàng chọn <b>Gắn lô</b> ở từng dòng bán.
              Chốt ngày sản xuất phải gắn lô cho mọi mẻ, hoặc ghi lý do chưa gắn.
            </li>
            <li>
              Chuyến hiện nhãn <b>"Dữ liệu cũ"</b> (thiếu đầu chuyến) thì chưa in tem
              được.
            </li>
            <li>
              <b>Không có camera</b> hoặc quét không được thì cứ <b>gõ tay mã lô</b>.
            </li>
          </Y>
        </Section>
      </>
    ),
  },
};

/**
 * Bộ lọc của từng trang (ba-spec 53 R12) — mỗi hộp "?" nói lọc được theo gì, tổng tính theo bộ lọc,
 * cách bỏ lọc. Ghép vào cuối nội dung hộp để không phải sửa từng hộp viết tay.
 */
const FILTER_NOTES: Record<string, string> = {
  sales: "Sổ bán: Khách hàng · Kênh bán · ô Tra khách, mặt hàng, quy cách, ghi chú. Báo cáo: Khách hàng · Kênh bán.",
  orders: "Trạng thái (Đang gom · Đủ · Đã xuất, kèm số đơn) · Khách hàng · ô Tra khách, mặt hàng, quy cách, ghi chú.",
  wip: "Sổ: Nhập kho (Chờ nhập kho · Đã nhập kho — chọn thẻ Chờ nhập kho cũng lọc được) · Khách hàng · ô Tra thành phẩm, khách, quy cách, người ghi. Báo cáo ngày gửi lên và bột tẩm vẫn tính cả kỳ.",
  packaging: "Kho thành phẩm (khi có từ hai kho) · ô Tra mặt hàng, quy cách, kho, ghi chú.",
  nxt: "Ô Tra mã, tên hàng, quy cách. Xuất Excel vẫn xuất đủ mọi mặt hàng của kỳ.",
  "nxt-warehouse": "Kho lưu · ô Tra mã, tên hàng · Dòng (Tất cả mã · Có phát sinh / còn tồn).",
  imports: "Sổ chi tiết: ô Tra biển số, tài xế, đại lý, loại NL, mã lô + Bộ lọc thêm (Đại lý · Loại NL · Trạng thái giá). Tổng hợp kỳ: Đại lý · Loại NL (phế liệu vẫn theo cả kỳ). Hóa đơn: Đại lý · Phân xưởng · Trạng thái dòng · ô Tra số HĐ, ký hiệu, số phiếu nhập, mã đại lý / vật tư, biển số.",
  "planning-import": "Lô nhập: Đối tác · Trạng thái lần nhập (kèm số lô) · ô Tra số chứng từ ở mọi tháng.",
  "planning-export": "Hợp đồng: Trạng thái · Khách hàng · ô Tra hợp đồng (số HĐ · số PO · tên khách).",
  "export-report": "Khách hàng · Trạng thái đơn (kèm số đơn) · ô Tra mặt hàng, quy cách, khách. Xuất Excel theo phần đang lọc.",
  "my-tasks": "Lọc theo hạn · ô Tra việc, người giao, người nhận.",
  "monthly-stock": "Kho · Nhóm hàng · ô Tra tên, size, invoice, kho, vị trí.",
  catalog: "Mặt hàng: Nhóm loài · Kiểu chế biến. Khách hàng: Thị trường. Loại nguyên liệu: Nhóm. NCC nhập khẩu: Trạng thái · Nước. Ô lọc chỉ hiện khi danh mục có từ hai nhóm.",
};

function FilterNote({ text }: { text: string }) {
  return (
    <Section title="Bộ lọc">
      <Y>
        <li>{text}</li>
        <li>
          Đang lọc thì thẻ số và tổng tính theo dòng đang hiện (ghi <b>theo bộ lọc</b>). Ô tra không cần gõ dấu.
        </li>
        <li>
          <b>Bỏ hết bộ lọc</b> để về sổ đầy đủ của kỳ; lọc ra không dòng nào thì trang báo <b>Không có dòng nào khớp bộ lọc</b>. Bộ lọc không lưu, rời trang là về mặc định.
        </li>
      </Y>
    </Section>
  );
}

export const PAGE_GUIDES: Record<string, PageGuide> = Object.fromEntries(
  Object.entries(BASE_PAGE_GUIDES).map(([key, g]) => [
    key,
    FILTER_NOTES[key]
      ? {
          ...g,
          content: (
            <>
              {g.content}
              <FilterNote text={FILTER_NOTES[key]} />
            </>
          ),
        }
      : g,
  ]),
);
