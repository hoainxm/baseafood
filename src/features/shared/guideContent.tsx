// ============================================================
// Tên file cũ: src/features/shared/huongDan.tsx
// Tên tiếng Việt: Nội dung Hướng dẫn sử dụng từng màn hình
// Description: Screen Guide & Help Documentation Content
// ============================================================
import type { ReactNode } from "react";

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

export interface NoiDungHuongDan {
  tieuDe: string;
  moTa?: string;
  noiDung: ReactNode;
}

function Buoc({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-6">{children}</ol>;
}

function Y({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
}

function Muc({ tieuDe, children }: { tieuDe: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold text-foreground">{tieuDe}</h3>
      {children}
    </section>
  );
}

export const HUONG_DAN: Record<string, NoiDungHuongDan> = {
  imports: {
    tieuDe: "Nhập hàng",
    moTa: "Ghi sổ nguyên liệu về xưởng mỗi ngày.",
    noiDung: (
      <>
        <Muc tieuDe="Ghi một chuyến hàng">
          <Buoc>
            <li>
              Bấm <b>Ghi chuyến</b>. Một chuyến là <b>một đại lý giao một lượt</b>
              . Đại lý giao 2 lần trong ngày thì ghi 2 chuyến riêng.
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
              Một đại lý còn giao lượt nữa: bấm <b>Lưu &amp; thêm chuyến khác</b>.
              Xong hết thì bấm <b>Xong chuyến</b>.
            </li>
          </Buoc>
        </Muc>
        <Muc tieuDe="Hai ô ngày">
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
        </Muc>
        <Muc tieuDe="Phế liệu (nội tạng, hàng dạt)">
          <p>
            Cân gộp cuối ngày, nhập ở hộp <b>Thêm phế liệu</b>. Loại mặc định là
            Nội tạng, cân hàng dạt thì đổi sang Dạt. Bấm <b>Lưu</b> là ghi rồi
            đóng; có cả hai loại thì bấm <b>Lưu, ghi tiếp loại khác</b> cho loại
            đầu. Chỉ nhập một lần ở đây — màn Cân đối sẽ hút sang, không nhập lại.
          </p>
        </Muc>
        <Muc tieuDe="Chốt ngày">
          <p>
            Xem hết số trong ngày rồi kéo xuống cuối màn bấm <b>Chốt ngày</b>
            (theo ngày + phân xưởng). Chốt xong khóa sửa. Cần sửa thêm thì{" "}
            <b>ghi bù</b> hoặc <b>mở lại ngày</b> — cả hai đều bắt ghi lý do.
          </p>
        </Muc>
        <Muc tieuDe="Xem báo cáo">
          <p>
            Bấm <b>Xem báo cáo</b> để in tờ tổng hợp nguyên liệu (A4 ngang), hoặc
            mở tab <b>Báo cáo</b> để xem tổng nhập theo đại lý và loại nguyên liệu.
          </p>
        </Muc>
        <Muc tieuDe="Mã lô & in tem QR">
          <Y>
            <li>
              Khi chọn <b>ngày về</b> và <b>phân xưởng</b>, ô <b>Mã lô nội bộ</b>{" "}
              tự hiện mã (vd <b>Đ-260912-01</b>) — không phải gõ, mỗi chuyến một mã.
            </li>
            <li>
              Lưu chuyến xong, sang tab <b>📖 Sổ ngày</b>, tìm chuyến (có nhãn{" "}
              <b>Lô …</b>) rồi bấm <b>In tem QR</b>.
            </li>
            <li>
              Chọn <b>khổ tem</b> đúng máy in tem → bấm <b>In tem</b> →{" "}
              <b>dán tem lên lô hàng</b>. Sau này quét tem ở màn <b>Quét lô (QR)</b>{" "}
              là ra đúng lô.
            </li>
            <li>
              Ô <b>Mã SSCC</b> chưa được cấp thì để trống, điền sau.
            </li>
          </Y>
        </Muc>
      </>
    ),
  },

  sales: {
    tieuDe: "Bán hàng",
    moTa: "Ghi phiếu bán thành phẩm ra cho khách mỗi ngày.",
    noiDung: (
      <>
        <Muc tieuDe="Ghi một phiếu bán">
          <Buoc>
            <li>
              Bấm <b>Ghi phiếu</b>. Một phiếu là <b>một khách nhận hàng một lượt
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
          </Buoc>
        </Muc>
        <Muc tieuDe="Hai ô ngày & ghi bù">
          <p>
            Giống Nhập hàng: <b>ngày xuất bán</b> dùng cho tổng hợp;{" "}
            <b>ngày ghi sổ</b> muộn hơn là ghi bù, phải ghi lý do.
          </p>
        </Muc>
        <Muc tieuDe="Xem báo cáo">
          <p>
            Mở tab <b>Báo cáo</b> để xem tổng bán theo khách và theo kênh (Xuất
            khẩu / Nội địa) trong kỳ đang xem.
          </p>
        </Muc>
      </>
    ),
  },

  warehouse: {
    tieuDe: "Kho dự trữ",
    moTa: "Duyệt nhập kho và theo dõi tồn hàng cấp đông.",
    noiDung: (
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
    tieuDe: "Đơn đặt",
    moTa: "Gom hàng theo đơn khách đặt và lập lệnh xuất.",
    noiDung: (
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
    tieuDe: "Cân đối kỳ",
    moTa: "Cân đối một lô nguyên liệu ra thành phẩm, tính định mức và lãi/lỗ.",
    noiDung: (
      <>
        <Muc tieuDe="Tạo một kỳ cân đối">
          <Buoc>
            <li>
              Bấm tạo kỳ. Một kỳ = <b>một loại nguyên liệu</b> + các ngày nhận của
              lô đó (ngày có thể rời rạc).
            </li>
            <li>
              Khai thông số kỳ: tổng nguyên liệu nhận, chi phí chế biến trên mỗi kg
              thành phẩm, tỉ giá (mặc định 26.000 đ/USD).
            </li>
          </Buoc>
        </Muc>
        <Muc tieuDe="Ba khối số liệu">
          <Y>
            <li>
              <b>Nguyên liệu vào</b>: hàng đưa vào chế biến. Dòng điều chỉnh giảm
              (VD bán thẳng nội địa) ghi số âm.
            </li>
            <li>
              <b>Phế liệu</b>: bấm hút từ sổ Nhập hàng vào kỳ — không nhập lại.
            </li>
            <li>
              <b>Bán thành phẩm sản xuất</b>: thành phẩm làm ra trong kỳ, theo mặt
              hàng × quy cách × khách × kênh.
            </li>
          </Y>
        </Muc>
        <Muc tieuDe="Kết quả & in">
          <p>
            Có đủ nguyên liệu và thành phẩm, hệ thống tự tính <b>định mức</b>{" "}
            (nguyên liệu ÷ thành phẩm), <b>tỉ lệ thu hồi</b> và <b>lãi/lỗ</b>. Bấm
            xem/in <b>bảng cân đối A4</b> để lưu hồ sơ.
          </p>
        </Muc>
      </>
    ),
  },

  catalog: {
    tieuDe: "Danh mục",
    moTa: "Quản lý mặt hàng, khách, đại lý, loại nguyên liệu.",
    noiDung: (
      <>
        <p>
          Năm tab: <b>Mặt hàng · Khách hàng · Đại lý · Loại nguyên liệu · Thành
          phẩm</b>.
        </p>
        <Y>
          <li>Bốn tab đầu: thêm / sửa / xóa / tìm bình thường.</li>
          <li>
            <b>Đại lý</b> (nơi mua nguyên liệu) tách riêng với <b>khách hàng</b>{" "}
            (nơi bán thành phẩm) — đừng gộp.
          </li>
          <li>
            Đại lý có <b>tên gọi tắt</b> (ghi trên sổ) và <b>tên đầy đủ</b> (ghi
            hóa đơn). Đổi tên đại lý không sửa các dòng sổ đã ghi trước đó.
          </li>
          <li>
            Tab <b>Thành phẩm</b> (141 mã kế toán) chỉ để xem, không sửa trong app.
          </li>
        </Y>
        <p className="text-muted-foreground">
          Ở mọi màn nhập liệu, gõ tên mới trong ô chọn là tạo ngay vào danh mục —
          không để tên lẻ ngoài danh mục.
        </p>
      </>
    ),
  },

  "bc-thanh-pham": {
    tieuDe: "Báo cáo thành phẩm hàng ngày",
    moTa: "Tổng hợp thành phẩm sản xuất theo ngày, gom theo phân xưởng.",
    noiDung: (
      <>
        <Muc tieuDe="Cách xem">
          <Buoc>
            <li>Chọn <b>kỳ</b> (ngày / tuần / tháng / khoảng tự chọn) và <b>phân xưởng</b>.</li>
            <li>
              Bảng hiện <b>mặt hàng × ngày</b>: mỗi cột là một ngày, cột cuối là tổng.
              Có dòng <b>cộng xưởng</b> và <b>tổng cộng</b> ở chân.
            </li>
          </Buoc>
        </Muc>
        <Muc tieuDe="Xuất Excel">
          <p>
            Bấm <b>Xuất Excel</b> để tải file cho kế toán đối chiếu — giữ đúng lưới
            ngày, cộng xưởng và tổng.
          </p>
        </Muc>
        <p className="text-muted-foreground">
          Đây là sản lượng <b>làm ra</b> (mọi trạng thái), không phải tồn kho. Số lấy
          từ màn <b>Sản xuất BTP</b>.
        </p>
      </>
    ),
  },

  "bc-don-xuat": {
    tieuDe: "Báo cáo đơn đặt được xuất hàng",
    moTa: "Những ngày này đơn nào được xuất, xuất bao nhiêu.",
    noiDung: (
      <>
        <Muc tieuDe="Cách xem">
          <Buoc>
            <li>Chọn <b>khoảng ngày xuất</b> và (tùy chọn) <b>khách hàng</b>.</li>
            <li>
              Kết quả gom theo <b>đơn</b>: đầu đơn ghi khách · ngày đặt · trạng thái ·
              kg đã đặt; bên dưới liệt kê từng dòng <b>thực xuất</b> (ngày xuất · mặt
              hàng · quy cách · kg · block).
            </li>
          </Buoc>
        </Muc>
        <p className="text-muted-foreground">
          Số lấy từ <b>lệnh xuất</b> ở màn Đơn đặt. Bấm <b>Xuất Excel</b> để lưu hồ sơ.
        </p>
      </>
    ),
  },

  nxt: {
    tieuDe: "Tồn kho thành phẩm",
    moTa: "Nhập – Xuất – Tồn kho thành phẩm cấp đông.",
    noiDung: (
      <>
        <Muc tieuDe="Đọc bảng">
          <Y>
            <li><b>Nhập</b>: bán thành phẩm đã duyệt vào kho (màn Kho dự trữ).</li>
            <li><b>Xuất đơn</b>: xuất container theo Đơn đặt.</li>
            <li><b>Xuất bán</b>: bán hàng ngày (sổ Bán hàng) — không tính hai lần phần đã xuất qua đơn.</li>
            <li><b>Tồn cuối</b> = Tồn đầu + Nhập − Xuất. Khớp với Tổng tồn ở màn Kho dự trữ.</li>
          </Y>
        </Muc>
        <Muc tieuDe="Tồn đầu">
          <p>
            Có bán thành phẩm cấp đông <b>trước khi dùng app</b> thì bấm <b>Tồn đầu</b>,
            khai một lần theo mặt hàng × quy cách. Các kỳ sau tự kế thừa.
          </p>
        </Muc>
        <Muc tieuDe="Tồn âm">
          <p>
            Dòng báo <b>Tồn âm</b> = xuất nhiều hơn số đang trữ → kiểm lại sản xuất /
            đơn / bán, hoặc thiếu khai tồn đầu. Không được bỏ qua.
          </p>
        </Muc>
      </>
    ),
  },

  "ton-kho-thang": {
    tieuDe: "Sổ kho theo tháng",
    moTa: "Theo dõi tồn đầu · nhập · xuất · tồn cuối (kg) từng lô hàng theo tháng.",
    noiDung: (
      <>
        <Muc tieuDe="Đầu tháng: mở sổ">
          <Buoc>
            <li>Chọn <b>Kỳ (tháng)</b> ở ô trên cùng (hoặc bấm ◀ ▶).</li>
            <li>
              Tháng mới chưa có dòng nào thì màn hiện <b>bản xem trước</b> tồn đầu lấy
              từ tồn cuối tháng trước. Soát lại rồi bấm <b>Kế thừa &amp; lưu vào sổ</b>.
              Chưa bấm thì chưa ghi được gì.
            </li>
          </Buoc>
        </Muc>
        <Muc tieuDe="Lấy hàng ra sử dụng (xuất)">
          <Buoc>
            <li>Tìm dòng hàng (gõ tên / invoice / vị trí vào ô <b>Tìm mặt hàng</b>).</li>
            <li>Bấm nút <b>hộp có dấu trừ</b> ở cuối dòng.</li>
            <li>Chọn <b>Lấy ra sử dụng</b>, gõ <b>số kg</b>, chọn ngày, ghi chú nếu cần.</li>
            <li>Bấm <b>Lưu thao tác</b>. Số kg cộng vào cột <b>Xuất trong kỳ</b>, tồn cuối tự giảm.</li>
          </Buoc>
          <p>Lấy nhiều lần trong tháng thì làm lại từng lần — số tự cộng dồn, không phải cộng tay.</p>
        </Muc>
        <Muc tieuDe="Chuyển kho (đổi chỗ để hàng)">
          <Y>
            <li>
              <b>Một dòng:</b> bấm nút hộp cuối dòng → chọn <b>Chuyển kho</b> → gõ số kg →
              chọn <b>Chuyển tới</b> (VD Kho Ánh Dương) → Lưu.
            </li>
            <li>
              Chuyển <b>hết</b> tồn ⇒ dòng chỉ đổi cột <b>Vị trí</b>. Chuyển <b>một phần</b> ⇒ hệ
              thống tách thành dòng mới ở kho đích. Tổng tồn của tháng <b>không đổi</b> vì chuyển
              kho không phải nhập hay xuất.
            </li>
            <li>
              <b>Nhiều dòng cùng lúc</b> (chuyển cả lô): tick ô đầu các dòng → bấm{" "}
              <b>Gán vị trí</b> → chọn kho → Lưu.
            </li>
            <li>Kho chưa có trong danh sách thì gõ tên mới, hệ thống tự lưu vào danh mục.</li>
          </Y>
        </Muc>
        <Muc tieuDe="Hàng mới về">
          <Y>
            <li>
              <b>Lô mới</b> (ngày nhập / invoice khác): bấm <b>Thêm dòng</b>, điền ngày nhập, tên,
              invoice, đơn giá, số kg ô <b>Nhập trong kỳ</b>, vị trí.
            </li>
            <li>
              <b>Về thêm cho đúng lô đang có</b>: nút hộp cuối dòng → <b>Nhập thêm</b>.
            </li>
          </Y>
        </Muc>
        <Muc tieuDe="Gõ số hàng loạt, sửa, xóa">
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
              bảng, con trỏ nhảy sang ô Nhập để gõ số tiếp. Cần điền nhiều ô một lần thì bấm{" "}
              <b>Thêm đủ thông tin…</b>.
            </li>
            <li>Nút <b>bút chì</b>: đổi tên hàng, nhóm (và mọi ô khác trong một hộp).</li>
            <li>Nút <b>thùng rác</b>: xóa dòng (có hỏi lại, xóa nhầm bấm <b>Hoàn tác</b>).</li>
            <li>Nút <b>đồng hồ</b>: thẻ kho — lịch sử mặt hàng qua các tháng + nhật ký thao tác.</li>
          </Y>
        </Muc>
        <Muc tieuDe="Xem cho gọn">
          <Y>
            <li>
              <b>Ẩn dòng trống</b>: giấu các dòng không có số (tồn đầu, nhập, xuất đều 0). Bấm lại
              để hiện.
            </li>
            <li>Tick vài dòng ⇒ thấy ngay tổng của đúng mấy dòng đó, in riêng được.</li>
          </Y>
        </Muc>
        <Muc tieuDe="Cuối tháng">
          <p>
            Soát xong bấm <b>Dồn sang tháng sau</b>: tồn cuối tháng này thành tồn đầu tháng sau
            (mọi kho). Bấm lại chỉ cập nhật, không nhân đôi.
          </p>
        </Muc>
      </>
    ),
  },

  qr: {
    tieuDe: "Mã lô QR",
    moTa: "In tem QR dán lên hàng, và quét tem để tra lô làm từ đâu, đã đi đâu.",
    noiDung: (
      <>
        <Muc tieuDe="Mã lô là gì">
          <Y>
            <li>
              Có <b>3 loại lô</b>: <b>nguyên liệu</b> (mỗi chuyến nhập, vd{" "}
              <b>Đ-260912-01</b>), <b>bán thành phẩm</b> (mỗi mẻ sản xuất, vd{" "}
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
        </Muc>
        <Muc tieuDe="In tem nhiều lô một lượt (tab In tem hàng loạt)">
          <Buoc>
            <li>
              Ở màn này bấm tab <b>In tem hàng loạt</b>.
            </li>
            <li>
              Chọn <b>khoảng ngày</b>, <b>phân xưởng</b> và <b>loại lô</b> (nguyên
              liệu / bán thành phẩm / thành phẩm). Danh sách lô hiện bên dưới, mặc
              định chọn hết — bỏ tick lô không cần in.
            </li>
            <li>
              Bấm <b>In … tem</b> → chọn <b>khổ tem</b> (vd 50×30 mm) → <b>In</b> →
              chọn <b>máy in tem</b> trong hộp thoại in. Mặc định mỗi <b>block</b> (bán
              thành phẩm) / mỗi <b>thùng</b> (thành phẩm) một tem — sửa ô <b>Số tem</b> dưới
              từng tem nếu cần.
            </li>
          </Buoc>
        </Muc>
        <Muc tieuDe="In tem ngay lúc ghi">
          <Y>
            <li>
              Lưu xong chuyến nhập, mẻ sản xuất hay phiếu đóng gói, thông báo góc
              màn có nút <b>In tem</b> — bấm là in luôn.
            </li>
            <li>
              In lại sau: <b>Nhập hàng</b> → nút <b>Tem</b> ở cột "Đã ghi ngày", hoặc{" "}
              <b>📊 Báo cáo → Sổ chi tiết các chuyến</b> → <b>In tem QR</b>.{" "}
              <b>Sản xuất thành phẩm</b> và <b>Đóng gói</b>: nút <b>Tem</b> ở từng dòng.
            </li>
          </Y>
        </Muc>
        <Muc tieuDe="Quét / tra lô (tab Tra lô)">
          <Buoc>
            <li>
              Bấm <b>Quét bằng camera</b> rồi đưa tem QR vào khung; hoặc <b>gõ tay
              mã lô</b> vào ô bên dưới.
            </li>
            <li>
              Màn hiện lô là gì, <b>cân bằng kg</b>, <b>truy ngược</b> (làm từ lô
              nào, đại lý nào) và <b>truy xuôi</b> (đã vào mẻ nào, xuất / bán cho ai). Tem
              mờ / bong thì bấm <b>In tem</b> ngay đây.
            </li>
            <li>
              Lô nghi có vấn đề: xuống mục <b>Thu hồi</b> — danh sách khách đã nhận hàng
              từ lô này + lô còn trong xưởng. Bấm <b>In danh sách</b> hoặc <b>Tải Excel</b>.
            </li>
          </Buoc>
        </Muc>
        <Muc tieuDe="Kiểm QR từng khâu (tab Theo giai đoạn)">
          <Buoc>
            <li>
              Bấm tab <b>Theo giai đoạn</b>, chọn khoảng ngày + xưởng. Màn xếp 5 khâu theo
              thứ tự: <b>Nhập nguyên liệu → Sản xuất → Nhập kho → Đóng gói → Xuất & bán</b>.
            </li>
            <li>
              Mỗi dòng có nhãn trạng thái: đã in tem chưa, đã gắn lô chưa, chờ duyệt kho,
              đã quét kiểm chưa. Khâu nào còn thiếu thì hiện <b>Còn thiếu N</b>.
            </li>
            <li>
              Bấm nút ngay ở dòng: <b>In tem</b>, <b>Gắn lô NL / BTP</b>, <b>Gắn lô</b> (dòng
              bán), <b>Duyệt nhập kho</b> (mở thẳng hộp duyệt ở Kho dự trữ), <b>Kiểm lô</b>{" "}
              (mở thẳng hộp kiểm ở Đơn đặt). Tick <b>Chỉ hiện mục còn thiếu</b> để lọc.
            </li>
          </Buoc>
        </Muc>
        <Muc tieuDe="Lưu ý">
          <Y>
            <li>
              Muốn truy được trọn chuỗi: lúc ghi sản xuất quét tem các chuyến NL vào khối{" "}
              <b>Lô nguyên liệu dùng cho phiên này</b> (lưu là tự gắn cho mọi mẻ cùng loài);
              đóng gói bấm <b>Gắn lô BTP</b>; bán hàng bấm <b>Gắn lô</b> ở từng dòng bán.
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
        </Muc>
      </>
    ),
  },
};
