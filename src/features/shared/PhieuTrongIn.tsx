// ============================================================
// Tên file: src/features/shared/PhieuTrongIn.tsx
// Tên tiếng Việt: Biểu mẫu giấy IN TRỐNG (để xưởng ghi tay)
// Description: Blank A4 print forms — daily material import & daily WIP report
// ============================================================
import { PhieuIn, ThIn, TdIn } from "@/design-system";

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
const SO_DONG = 14;

/** Một cột của biểu mẫu trống: nhãn + canh phải (cột số) + class rộng gợi ý. */
interface CotTrong {
  nhan: string;
  phai?: boolean;
  rong?: string;
}

/** Bảng trống dùng chung: tiêu đề cột + N dòng trống + dòng TỔNG CỘNG.
 *  `tongSpan` = số cột đầu mà nhãn "TỔNG CỘNG" trải qua (các cột số để trống). */
function BangTrong({
  cot,
  tongSpan,
  soDong = SO_DONG,
}: {
  cot: CotTrong[];
  tongSpan: number;
  soDong?: number;
}) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {cot.map((c) => (
            <ThIn key={c.nhan} right={c.phai} className={c.rong}>
              {c.nhan}
            </ThIn>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: soDong }, (_, i) => (
          <tr key={i}>
            {cot.map((c) => (
              <TdIn key={c.nhan} className="h-9" />
            ))}
          </tr>
        ))}
        <tr>
          <TdIn dam colSpan={tongSpan}>
            Tổng cộng
          </TdIn>
          {cot.slice(tongSpan).map((c) => (
            <TdIn key={c.nhan} dam className="h-9" />
          ))}
        </tr>
      </tbody>
    </table>
  );
}

/** Ô ký tên cuối phiếu — người lập ghi tay rồi ký. */
function ChanKy({ vaiTro = "Người lập biểu" }: { vaiTro?: string }) {
  return (
    <div className="mt-6 flex justify-end">
      <div className="w-56 text-center text-sm">
        <p className="font-semibold uppercase">{vaiTro}</p>
        <p className="text-xs italic text-slate-500">(Ký, ghi rõ họ tên)</p>
        <div className="h-16" />
      </div>
    </div>
  );
}

/** Dòng "NGÀY … THÁNG … NĂM …" bỏ trống cho người ghi điền tay. */
const NGAY_TRONG = "Ngày ……… tháng ……… năm 20………";

/**
 * Phiếu TRỐNG — Báo cáo tổng hợp nguyên liệu hằng ngày (bám màn /imports).
 * Cột đúng tờ chị Trúc: STT · Tên đại lý · Loại nguyên liệu · Số lượng · Đơn giá · Ghi chú.
 */
export function PhieuTrongNhapNL({ onClose }: { onClose: () => void }) {
  return (
    <PhieuIn
      tieuDe="Báo cáo tổng hợp nguyên liệu hàng ngày"
      phuDe={NGAY_TRONG}
      onClose={onClose}
    >
      <BangTrong
        tongSpan={3}
        cot={[
          { nhan: "STT", rong: "w-12" },
          { nhan: "Tên đại lý", rong: "w-48" },
          { nhan: "Loại nguyên liệu" },
          { nhan: "Số lượng", phai: true, rong: "w-28" },
          { nhan: "Đơn giá", phai: true, rong: "w-24" },
          { nhan: "Ghi chú", rong: "w-64" },
        ]}
      />
      <ChanKy />
    </PhieuIn>
  );
}

/**
 * Phiếu TRỐNG — Báo cáo bán thành phẩm hằng ngày (bám màn /wip).
 * Cột đúng tờ mẫu: STT · Tên bán thành phẩm / Quy cách · Số lượng · Đơn giá · Thành tiền · Ghi chú.
 */
export function PhieuTrongTPNgay({ onClose }: { onClose: () => void }) {
  return (
    <PhieuIn
      tieuDe="Báo cáo bán thành phẩm hàng ngày"
      phuDe={NGAY_TRONG}
      onClose={onClose}
    >
      <BangTrong
        tongSpan={2}
        cot={[
          { nhan: "STT", rong: "w-12" },
          { nhan: "Tên bán thành phẩm / Quy cách" },
          { nhan: "Số lượng", phai: true, rong: "w-28" },
          { nhan: "Đơn giá", phai: true, rong: "w-24" },
          { nhan: "Thành tiền", phai: true, rong: "w-32" },
          { nhan: "Ghi chú", rong: "w-56" },
        ]}
      />
      <ChanKy />
    </PhieuIn>
  );
}
