// ============================================================
// THU HỒI THEO LÔ — mục cuối của hộ chiếu lô (/qr, đợt 2b).
// Lô nghi có vấn đề ⇒ trả lời ngay: những ai đã nhận hàng (khách · ngày · chứng
// từ · kg) và lô BTP/TP nào còn trong xưởng cần khoanh lại. In A4 + tải Excel để
// gửi đoàn kiểm tra (FSMA 204 đòi hồ sơ trong 24 giờ).
// Số lấy từ buildRecallList (lib/lotTraceability, hàm thuần có test).
// ============================================================
import { useMemo, useState } from "react";
import { kg, formatDateVN } from "@/lib/format";
import { TRACE_KIND_LABELS, buildLotStockIndex, buildRecallList, buildRecallListForLots, getLotStockKg, type TraceData, type LotNode } from "@/lib/lotTraceability";
import { Button, InfoTip, HorizontalScroll, PrintSheet, PrintTd, PrintTh } from "@/design-system";
import { FileSpreadsheet, Printer, ShieldAlert } from "lucide-react";

const kgOrBlank = (v: number | null) => (v == null ? "chưa ghi kg" : kg(v));

export function LotRecall({ node, dl, sameShipmentLots = [] }: { node: LotNode; dl: TraceData; sameShipmentLots?: LotNode[] }) {
  const [isPrinting, setIsPrinting] = useState(false);
  /** Lô NL có nhiều loại cùng chuyến ⇒ cho thu hồi GỘP cả chuyến (nghi cả xe hàng của đại lý). */
  const [wholeShipment, setWholeShipment] = useState(false);
  const isMergedShipment = wholeShipment && sameShipmentLots.length > 1;
  const { hangRa: outboundItems, loTrongXuong: lotsInPlant } = useMemo(
    () => (isMergedShipment ? buildRecallListForLots(sameShipmentLots, dl) : buildRecallList(node.kind, node.id, dl)),
    [isMergedShipment, sameShipmentLots, node, dl]
  );
  const scope = isMergedShipment ? `chuyến ${node.nhan} (${sameShipmentLots.length} loại NL)` : `lô ${node.nhan}${node.kind === "S" ? ` · ${node.moTa}` : ""}`;
  const lotStockNow = useMemo(
    () => {
      const bang = buildLotStockIndex(dl); // một lượt cho mọi lô cần khoanh
      return lotsInPlant.map((n) => ({ n, ton: getLotStockKg(n.kind, n.id, dl, bang) }));
    },
    [lotsInPlant, dl]
  );
  const customerCount = new Set(outboundItems.map((r) => r.khach || "khách ?")).size;
  const totalKg = outboundItems.reduce((s, r) => s + (r.kg ?? 0), 0);

  const downloadExcel = async () => {
    const { exportAoaToXlsx } = await import("@/lib/reportXlsx"); // nạp động — xlsx không vào chunk chính
    exportAoaToXlsx({
      sheetName: "Thu hồi",
      fileName: `thu-hoi-${node.nhan}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.xlsx`,
      colWidths: [14, 28, 12, 26, 32, 12, 22],
      aoa: [
        [`Danh sách thu hồi — ${scope} (${TRACE_KIND_LABELS[node.kind]})`],
        [],
        ["Ngả ra", "Khách", "Ngày", "Chứng từ", "Mặt hàng", "Kg", "Từ lô"],
        ...outboundItems.map((r) => [TRACE_KIND_LABELS[r.loai], r.khach, r.ngay, r.chungTu, r.matHang, r.kg, r.tuLo]),
        [],
        ["Lô còn trong xưởng", "Mặt hàng", "Ngày", "Tồn trong kho (kg)"],
        ...lotStockNow.map(({ n, ton: stockKg }) => [`${TRACE_KIND_LABELS[n.kind]} ${n.nhan}`, n.moTa, n.ngay, stockKg]),
      ],
    });
  };

  return (
    <section className="space-y-3 rounded-xl border-2 border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldAlert aria-hidden /> Thu hồi — ai đã nhận hàng từ lô này
          <InfoTip label="thu hồi">
            Đi hết cây truy xuôi: mọi lệnh xuất, dòng bán lẻ, bán nội địa có dùng lô này, kể cả qua mẻ sản xuất / đóng gói trung gian. Chỉ tính các mối nối ĐÃ GẮN LÔ — hàng bán mà chưa gắn lô thì không hiện ở đây (xem tab Theo giai đoạn).
          </InfoTip>
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" title="Mở bản in A4 danh sách thu hồi để in hoặc lưu PDF." onClick={() => setIsPrinting(true)}>
            <Printer aria-hidden /> In danh sách
          </Button>
          <Button variant="outline" title="Tải danh sách thu hồi ra file Excel." onClick={downloadExcel}>
            <FileSpreadsheet aria-hidden /> Tải Excel
          </Button>
        </div>
      </div>

      {sameShipmentLots.length > 1 && (
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" className="size-5 shrink-0" checked={wholeShipment} onChange={(e) => setWholeShipment(e.target.checked)} />
          <span>
            Thu hồi <b>cả chuyến</b> ({sameShipmentLots.length} loại nguyên liệu cùng xe, cùng đại lý)
          </span>
        </label>
      )}

      <p className="tnum">
        {outboundItems.length
          ? `${outboundItems.length} ngả ra · ${customerCount} khách · ${kg(totalKg)} đã ghi kg`
          : "Chưa ghi nhận hàng nào từ lô này ra khỏi xưởng."}
        {lotsInPlant.length > 0 && ` · ${lotsInPlant.length} lô còn trong xưởng cần khoanh lại`}
      </p>

      {outboundItems.length > 0 && (
        <HorizontalScroll>
          <table className="w-full min-w-[40rem] border-collapse">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-1 pr-3 font-medium">Khách</th>
                <th className="py-1 pr-3 font-medium">Ngày</th>
                <th className="py-1 pr-3 font-medium">Chứng từ</th>
                <th className="py-1 pr-3 font-medium">Mặt hàng</th>
                <th className="py-1 pr-3 text-right font-medium">Kg</th>
                <th className="py-1 font-medium">Từ lô</th>
              </tr>
            </thead>
            <tbody>
              {outboundItems.map((r, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="py-1 pr-3 font-medium">{r.khach || "khách ?"}</td>
                  <td className="tnum py-1 pr-3">{r.ngay ? formatDateVN(r.ngay) : "—"}</td>
                  <td className="py-1 pr-3">{r.chungTu}</td>
                  <td className="py-1 pr-3">{r.matHang}</td>
                  <td className="tnum py-1 pr-3 text-right">{kgOrBlank(r.kg)}</td>
                  <td className="tnum py-1">{r.tuLo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </HorizontalScroll>
      )}

      {lotStockNow.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium">Lô còn trong xưởng</p>
          <ul className="space-y-1">
            {lotStockNow.map(({ n, ton: stockKg }) => (
              <li key={`${n.kind}:${n.id}`} className="tnum text-muted-foreground">
                {TRACE_KIND_LABELS[n.kind]} <span className="font-medium text-foreground">{n.nhan}</span> · {n.moTa}
                {stockKg != null ? ` · tồn trong kho ${kg(stockKg)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isPrinting && (
        <PrintSheet
          title="Danh sách thu hồi theo lô"
          subtitle={`${isMergedShipment ? `Chuyến ${node.nhan} · ${sameShipmentLots.length} loại NL` : `Lô ${node.nhan} · ${TRACE_KIND_LABELS[node.kind]} · ${node.moTa}`}${node.ngay ? ` · ${formatDateVN(node.ngay)}` : ""}`}
          onClose={() => setIsPrinting(false)}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <PrintTh>Ngả ra</PrintTh>
                <PrintTh>Khách</PrintTh>
                <PrintTh>Ngày</PrintTh>
                <PrintTh>Chứng từ</PrintTh>
                <PrintTh>Mặt hàng</PrintTh>
                <PrintTh right>Kg</PrintTh>
                <PrintTh>Từ lô</PrintTh>
              </tr>
            </thead>
            <tbody>
              {outboundItems.length ? (
                outboundItems.map((r, i) => (
                  <tr key={i}>
                    <PrintTd>{TRACE_KIND_LABELS[r.loai]}</PrintTd>
                    <PrintTd>{r.khach || "khách ?"}</PrintTd>
                    <PrintTd>{r.ngay ? formatDateVN(r.ngay) : "—"}</PrintTd>
                    <PrintTd>{r.chungTu}</PrintTd>
                    <PrintTd>{r.matHang}</PrintTd>
                    <PrintTd right>{kgOrBlank(r.kg)}</PrintTd>
                    <PrintTd>{r.tuLo}</PrintTd>
                  </tr>
                ))
              ) : (
                <tr>
                  <PrintTd colSpan={7}>Chưa ghi nhận hàng nào từ lô này ra khỏi xưởng.</PrintTd>
                </tr>
              )}
            </tbody>
          </table>
          {lotStockNow.length > 0 && (
            <table className="mt-4 w-full border-collapse">
              <thead>
                <tr>
                  <PrintTh>Lô còn trong xưởng</PrintTh>
                  <PrintTh>Mặt hàng</PrintTh>
                  <PrintTh>Ngày</PrintTh>
                  <PrintTh right>Tồn trong kho</PrintTh>
                </tr>
              </thead>
              <tbody>
                {lotStockNow.map(({ n, ton: stockKg }) => (
                  <tr key={`${n.kind}:${n.id}`}>
                    <PrintTd>{`${TRACE_KIND_LABELS[n.kind]} ${n.nhan}`}</PrintTd>
                    <PrintTd>{n.moTa}</PrintTd>
                    <PrintTd>{n.ngay ? formatDateVN(n.ngay) : "—"}</PrintTd>
                    <PrintTd right>{stockKg != null ? kg(stockKg) : "—"}</PrintTd>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PrintSheet>
      )}
    </section>
  );
}
