// ============================================================
// Tên file: src/features/production-orders/OrderPrint.tsx
// Tên tiếng Việt: Bản in lệnh sản xuất — A4 dọc theo mẫu QTI-KH-01-04
// Description: Print view of one production order in the order of the paper form QTI-KH-01-04
//              (ba-spec 48 AC-15, design-spec 49): header, line table with totals, delivery block,
//              packaging and Nafi requirements, notes. No prices.
// ============================================================
import { PrintSheet, PrintTd, PrintTh, formatNumber } from "@/design-system";
import { formatDateVN } from "@/lib/format";
import { expiryDate, lineCartons, linesOfOrder, orderLineKg, orderTotals } from "@/lib/productionOrder";
import type { ProductionOrder, ProductionOrderLine } from "@/types";

const longDate = (iso: string) => (iso ? `Ngày ${Number(iso.slice(8, 10))} Tháng ${Number(iso.slice(5, 7))} Năm ${iso.slice(0, 4)}` : "");
const shortDates = (ds: readonly string[]) => {
  const sorted = [...ds].sort();
  if (!sorted.length) return "";
  const sameMonth = sorted.every((d) => d.slice(0, 7) === sorted[0].slice(0, 7));
  return sameMonth ? `${sorted.map((d) => d.slice(8, 10)).join(", ")}/${sorted[0].slice(5, 7)}/${sorted[0].slice(0, 4)}` : sorted.map(formatDateVN).join(", ");
};

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[13rem_minmax(0,1fr)] gap-2 py-0.5">
      <span>{label}:</span>
      <span className="font-semibold">{children || "—"}</span>
    </div>
  );
}

export function OrderPrint({ order, allLines, onClose }: { order: ProductionOrder; allLines: readonly ProductionOrderLine[]; onClose: () => void }) {
  const lines = linesOfOrder(allLines, order.id);
  const totals = orderTotals(lines);
  const req = order.requirements;
  const expiry = expiryDate(order.productionDates, order.shelfLifeMonths);
  return (
    <PrintSheet title="Lệnh sản xuất" subtitle={`Số: ${order.orderNo}`} onClose={onClose} landscape={false}>
      <div className="grid gap-4 text-sm">
        <p className="text-right italic">{longDate(order.orderDate)}</p>
        <p>
          <b>Kính gởi:</b> BQĐ phân xưởng, Phòng Kỹ thuật, Phòng Kế hoạch
        </p>
        <p>Đề nghị các bộ phận triển khai sản xuất mặt hàng sau:</p>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <PrintTh>STT</PrintTh>
              <PrintTh>Tên hàng</PrintTh>
              <PrintTh>Quy cách</PrintTh>
              <PrintTh right>Số lượng thùng</PrintTh>
              <PrintTh right>Số lượng (kg)</PrintTh>
              <PrintTh>Mã số lô</PrintTh>
              <PrintTh>Ngày SX</PrintTh>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id}>
                <PrintTd right>{i + 1}</PrintTd>
                <PrintTd bold>{l.productName || l.description}</PrintTd>
                <PrintTd>{l.spec}</PrintTd>
                <PrintTd right>{formatNumber(lineCartons(l) ?? 0)}</PrintTd>
                <PrintTd right>{formatNumber(orderLineKg(l))}</PrintTd>
                {i === 0 && <PrintTd rowSpan={lines.length}>{order.lotCode}</PrintTd>}
                {i === 0 && <PrintTd rowSpan={lines.length}>NSX: {shortDates(order.productionDates)}</PrintTd>}
              </tr>
            ))}
            <tr>
              <PrintTd colSpan={3} bold>
                Tổng
              </PrintTd>
              <PrintTd right bold>
                {formatNumber(totals.cartons)}
              </PrintTd>
              <PrintTd right bold>
                {formatNumber(totals.kg)}
              </PrintTd>
              <PrintTd colSpan={2} />
            </tr>
          </tbody>
        </table>
        <div className="grid">
          <Line label="Dự kiến có bao bì">{req.packagingReady === "ready" ? "Đã có sẵn" : req.packagingReady === "pending" ? "Chưa có" : ""}</Line>
          <Line label="Ngày giao hàng">{formatDateVN(order.deliveryDate)}</Line>
          <Line label="Xuất vào thị trường">{[order.market, order.customerName && `(${order.customerName})`].filter(Boolean).join(" ")}</Line>
          <Line label="Ngày hết hạn">{`${order.shelfLifeMonths} tháng${expiry ? ` — ${formatDateVN(expiry)}` : ""}`}</Line>
          <Line label="Quy trình sản xuất">{req.processNote}</Line>
        </div>
        <div className="grid">
          <p className="font-semibold">Các yêu cầu về bao bì:</p>
          <Line label="Thùng carton">{req.cartonLayers}</Line>
          <Line label="Đai dây">{req.strapNote}</Line>
          <Line label="Bao PE">{req.peBagNote}</Line>
          <Line label="Ghi trên thùng carton">{req.cartonMarking}</Line>
          <Line label="Thông tin trên bao PE / rider">{req.bagMarking}</Line>
        </div>
        <div className="grid">
          <p className="font-semibold">Các yêu cầu về kiểm Nafi:</p>
          <Line label="Chỉ tiêu">{req.nafiTests.join(", ")}</Line>
          <Line label="Kiểm thêm / lấy kết quả">{req.nafiNote}</Line>
        </div>
        <Line label="Các lưu ý khác">{order.note}</Line>
        {order.revisionNo > 0 && <Line label={`Sửa lần ${order.revisionNo}`}>{order.revisionReason}</Line>}
        <p className="mt-6 text-right text-sm">QTI-KH-01-04</p>
      </div>
    </PrintSheet>
  );
}
