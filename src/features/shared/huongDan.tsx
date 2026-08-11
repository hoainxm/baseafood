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
};
