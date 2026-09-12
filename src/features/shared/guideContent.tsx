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
            Cân gộp cuối ngày, nhập ở hộp <b>Thêm phế liệu</b>. Mỗi loại bấm
            "Thêm loại này", xong bấm "Xong". Chỉ nhập một lần ở đây — màn Cân đối
            sẽ hút sang, không nhập lại.
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
    tieuDe: "Cân đối",
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
    tieuDe: "Báo cáo NXT thành phẩm",
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

  qr: {
    tieuDe: "Quét lô (QR)",
    moTa: "Tạo mã lô, in tem QR dán lên hàng, và quét để tra lô.",
    noiDung: (
      <>
        <Muc tieuDe="Mã lô là gì">
          <Y>
            <li>
              Mỗi <b>chuyến nguyên liệu</b> nhập về có <b>một mã lô riêng</b>, tự
              sinh — vd <b>Đ-260912-01</b> (Đ = xưởng Đông · 260912 = ngày
              12/09/2026 · 01 = chuyến thứ nhất trong ngày).
            </li>
            <li>
              <b>Tem QR</b> in ra mang đúng mã lô đó. Dán tem lên lô hàng; sau này{" "}
              <b>quét</b> hoặc <b>gõ mã</b> là ra đúng lô.
            </li>
          </Y>
        </Muc>
        <Muc tieuDe="Bước 1 — Tạo mã lô (ở màn Nhập hàng)">
          <Buoc>
            <li>
              Mở màn <b>Nhập hàng</b>, tab <b>📝 Ghi nhập</b>.
            </li>
            <li>
              Chọn <b>Ngày về</b> và <b>Phân xưởng</b> → ô <b>Mã lô nội bộ</b> tự
              hiện mã. <b>Không phải gõ.</b>
            </li>
            <li>
              Điền đại lý + bảng loại hàng như thường, rồi bấm <b>Lưu vào sổ</b>.
              (Ô <b>Mã SSCC</b> chưa được cấp thì để trống.)
            </li>
          </Buoc>
        </Muc>
        <Muc tieuDe="Bước 2 — In & dán tem QR">
          <Buoc>
            <li>
              Ở màn Nhập hàng, sang tab <b>📖 Sổ ngày</b>, tìm chuyến vừa lưu (có
              nhãn <b>Lô …</b>).
            </li>
            <li>
              Bấm <b>In tem QR</b> → chọn <b>khổ tem</b> đúng máy in tem của xưởng
              (vd 50×30 mm, có thể tự nhập số).
            </li>
            <li>
              Bấm <b>In tem</b> → chọn <b>máy in tem</b> trong hộp thoại in → In →{" "}
              <b>dán tem lên lô hàng</b>.
            </li>
          </Buoc>
        </Muc>
        <Muc tieuDe="Bước 3 — Quét / tra lô (màn này)">
          <Buoc>
            <li>
              Bấm <b>Quét bằng camera</b> rồi đưa tem QR vào khung; hoặc <b>gõ tay
              mã lô</b> vào ô bên dưới.
            </li>
            <li>
              Màn hiện <b>chuyến nhập</b> của lô + <b>danh sách nguyên liệu</b>
              (loại, kg, giá). Cần in lại tem thì bấm <b>In tem QR</b> ngay đây.
            </li>
          </Buoc>
        </Muc>
        <Muc tieuDe="Lưu ý">
          <Y>
            <li>
              Chuyến <b>nhập trước khi có tính năng này</b> chưa có mã lô (hiện
              nhãn "Dữ liệu cũ") — chưa in tem được.
            </li>
            <li>
              <b>Không có camera</b> hoặc quét không được thì cứ <b>gõ tay mã lô</b>,
              vẫn tra ra đúng lô.
            </li>
          </Y>
        </Muc>
      </>
    ),
  },
};
