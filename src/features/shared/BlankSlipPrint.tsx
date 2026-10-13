// ============================================================
// Tên file: src/features/shared/BlankSlipPrint.tsx
// Tên tiếng Việt: Biểu mẫu giấy IN TRỐNG (để xưởng ghi tay)
// Description: Blank A4 print forms — daily material import & daily WIP report
// ============================================================
import { PrintSheet, PrintTh, PrintTd } from "@/design-system";

/**
 * Biểu mẫu giấy TRỐNG in A4 để tổ xưởng ghi tay hằng ngày (QĐ-1/NR-1).
 *
 * Bối cảnh: xưởng chủ yếu ghi tay rồi mới nhập/chụp ở phòng. Hai mẫu dưới bám
 * ĐÚNG "tờ của chị Trúc" (file Excel mẫu — tab Tổng hợp nguyên liệu & tab Bán
 * thành phẩm), cùng cột với bản in có số liệu (DailyImportInvoice /
 * DailyProductionReport) để ghi tay xong khớp lại app 1:1. KHÔNG đụng dữ liệu —
 * đây chỉ là khung giấy trống, chữ điền bằng tay.
 */

/** Đủ dòng kín một trang A4 ngang mà vẫn cao thoáng để viết tay. */
const ROW_COUNT = 14;

/** Một cột của biểu mẫu trống: nhãn + canh phải (cột số) + class rộng gợi ý. */
interface BlankColumn {
  label: string;
  right?: boolean;
  widthClass?: string;
}

/** Bảng trống dùng chung: tiêu đề cột + N dòng trống + dòng TỔNG CỘNG.
 *  `tongSpan` = số cột đầu mà nhãn "TỔNG CỘNG" trải qua (các cột số để trống). */
function BlankTable({
  columns,
  totalSpan: totalLabelSpan,
  rowCount = ROW_COUNT,
}: {
  columns: BlankColumn[];
  totalSpan: number;
  rowCount?: number;
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {columns.map((c) => (
            <PrintTh key={c.label} right={c.right} className={c.widthClass}>
              {c.label}
            </PrintTh>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rowCount }, (_, i) => (
          <tr key={i}>
            {columns.map((c) => (
              <PrintTd key={c.label} className="h-9" />
            ))}
          </tr>
        ))}
        <tr>
          <PrintTd bold colSpan={totalLabelSpan}>
            Tổng cộng
          </PrintTd>
          {columns.slice(totalLabelSpan).map((c) => (
            <PrintTd key={c.label} bold className="h-9" />
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** Ô ký tên cuối phiếu — người lập ghi tay rồi ký. */
function SignatureFooter({ signerTitle: role = "Người lập biểu" }: { signerTitle?: string }) {
  return (
    <div className="mt-6 flex justify-end">
      <div className="w-56 text-center text-sm">
        <p className="font-semibold uppercase">{role}</p>
        <p className="text-xs italic text-slate-500">(Ký, ghi rõ họ tên)</p>
        <div className="h-16" />
      </div>
    </div>
  );
}

/** Dòng "NGÀY … THÁNG … NĂM …" bỏ trống cho người ghi điền tay. */
const BLANK_DATE = "Ngày ……… tháng ……… năm 20………";

/**
 * Phiếu TRỐNG — Báo cáo tổng hợp nguyên liệu hằng ngày (bám màn /imports).
 * Cột đúng tờ chị Trúc: STT · Tên đại lý · Loại nguyên liệu · Số lượng · Đơn giá · Ghi chú.
 */
export function BlankDailyImportSlip({ onClose }: { onClose: () => void }) {
  return (
    <PrintSheet
      title="Báo cáo tổng hợp nguyên liệu hàng ngày"
      subtitle={BLANK_DATE}
      onClose={onClose}
    >
      <BlankTable
        totalSpan={3}
        columns={[
          { label: "STT", widthClass: "w-12" },
          { label: "Tên đại lý", widthClass: "w-48" },
          { label: "Loại nguyên liệu" },
          { label: "Số lượng", right: true, widthClass: "w-28" },
          { label: "Đơn giá", right: true, widthClass: "w-24" },
          { label: "Ghi chú", widthClass: "w-64" },
        ]}
      />
      <SignatureFooter />
    </PrintSheet>
  );
}

/**
 * Phiếu TRỐNG — Báo cáo bán thành phẩm hằng ngày (bám màn /wip).
 * Cột đúng tờ mẫu: STT · Tên bán thành phẩm / Quy cách · Số lượng · Đơn giá · Thành tiền · Ghi chú.
 */
export function BlankDailyWipSlip({ onClose }: { onClose: () => void }) {
  return (
    <PrintSheet
      title="Báo cáo bán thành phẩm hàng ngày"
      subtitle={BLANK_DATE}
      onClose={onClose}
    >
      <BlankTable
        totalSpan={2}
        columns={[
          { label: "STT", widthClass: "w-12" },
          { label: "Tên bán thành phẩm / Quy cách" },
          { label: "Số lượng", right: true, widthClass: "w-28" },
          { label: "Đơn giá", right: true, widthClass: "w-24" },
          { label: "Thành tiền", right: true, widthClass: "w-32" },
          { label: "Ghi chú", widthClass: "w-56" },
        ]}
      />
      <SignatureFooter />
    </PrintSheet>
  );
}
