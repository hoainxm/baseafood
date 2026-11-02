// ============================================================
// Tên file: src/features/shared/guides/OrderFileGuideSection.tsx
// Tên tiếng Việt: Mục "File Lệnh sản xuất Word / PDF" trong hộp "?" của Lệnh sản xuất (ba-spec 54 §9b)
// ============================================================
import { COMPOSED_STATUS_LABELS, fieldSourceLabel } from "@/lib/documentComposer";
import { productionOrderForm } from "@/lib/documentTypes/productionOrderForm";
import { GuideList, GuideSection } from "./parts";

const F = productionOrderForm;
/** Nhãn nguồn ô — đọc thẳng từ hàm của bộ soạn để đổi nhãn mà quên sửa hướng dẫn là test đỏ (ba-spec 54 AC-17). */
const SOURCE_LABELS = (["source", "previous", "default", "manual", "empty"] as const).map((kind) => fieldSourceLabel(F, { kind, ref: "…" }));

/** File Lệnh sản xuất Word / PDF (ba-spec 54 §9b): luồng, trạng thái bản soạn, nguồn ô, cờ, điều kiện xuất, PDF, khuôn. */
export function OrderFileGuideSection() {
  return (
    <GuideSection title="File Lệnh sản xuất Word / PDF">
      <GuideList>
        <li>
          Ở hồ sơ lệnh chọn <b>File Word / PDF</b>. App điền sẵn đủ các ô của mẫu QTI-KH-01-04. Sửa ô sai ngay trên app, bên cạnh có bản xem trước đúng file Word sẽ xuất. Sửa ở đây <b>không đổi lệnh</b> trên app.
        </li>
        <li>
          Mỗi ô ghi lấy từ đâu: <b>{SOURCE_LABELS[0]}</b> (số lệnh, ngày, bảng hàng, mã số lô, ngày SX, ngày giao, thị trường, hạn dùng) · <b>{SOURCE_LABELS[1].replace("…", "<số>")}</b> (yêu cầu bao bì, ghi nhãn, Nafi chép từ file đã xuất của lệnh gần nhất cùng khách và mặt hàng) · <b>{SOURCE_LABELS[2]}</b> (như LSX 19.10) · <b>{SOURCE_LABELS[3]}</b> · <b>{SOURCE_LABELS[4]}</b>.
        </li>
        <li>
          Trạng thái: <b>{COMPOSED_STATUS_LABELS.draft}</b> (chưa xuất lần nào) → <b>{COMPOSED_STATUS_LABELS.exported}</b> (giống lần xuất gần nhất) · <b>{COMPOSED_STATUS_LABELS["edited-after-export"]}</b> (đã sửa sau lần xuất cuối, cần xuất lại nếu gửi xưởng bản mới).
        </li>
        <li>
          Cờ: <b>{F.labels.differs}</b> — ô đã sửa khác số của lệnh, cạnh ô ghi số trên lệnh · <b>{F.labels.stale}</b> — chọn <b>Lấy lại số từ lệnh</b>: ô lấy từ lệnh nhận số mới, ô đã sửa tay giữ nguyên · <b>{F.labels.sourceCancelled}</b> — chỉ xem và tải lại, không sửa, không xuất mới.
        </li>
        <li>Xuất được khi đủ: số lệnh, ngày lệnh, ít nhất một dòng hàng có tên hàng, số thùng, số kg, ngày giao, thị trường. Thiếu thì app kê đủ các ô còn trống.</li>
        <li>
          <b>Xuất Word</b> tải file .docx, mở bằng Word sửa tiếp được. <b>Xuất PDF</b> mở trang in: chọn &quot;Lưu thành PDF&quot;, khổ A4 dọc, lề Không. Mỗi lần xuất được ghi vào <b>Lịch sử xuất file</b>; tải lại một lần xuất ra đúng file lúc đó, không ghi thêm lần xuất.
        </li>
        <li>Quản đốc, thủ kho thấy file của lệnh đã phát hành, chỉ xem và tải lại. Quản trị đổi khuôn Word ở cuối trang soạn (khuôn mới phải đủ thẻ bắt buộc).</li>
      </GuideList>
    </GuideSection>
  );
}

