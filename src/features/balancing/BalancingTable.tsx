// ============================================================
// Tên file cũ: src/features/balancing/BalancingTable.tsx
// Tên tiếng Việt: Bảng tính cân đối chi tiết và in ấn
// Description: Balancing Period Detail Table and Print Layout
// ============================================================
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type {
  BalancingPeriod,
  BalancingInputItem,
  BalancingOutputItem,
  Product,
  Customer,
} from "@/types";
import type { BalancingResult } from "@/lib/balancingCalc";
import type { DailyQuantities, MaterialImportItem, WipProductionItem } from "@/types";
import { calculateImportAmount } from "@/types";
import {
  BALANCING_STOCK_LINE_NAMES,
  buildMaterialGridRows,
  buildFinishedGoodGridRows,
  formatDayLabel,
  getPeriodDates,
  getBalancingCustomerName,
  groupTripsByType,
  importTypeRowId,
  buildTripGroupRow,
  dailyAverageImportPrices,
  type MaterialGridRow,
} from "@/lib/balancingGrid";
import { depositPriceOn } from "@/lib/balancingStockLines";
import { Button } from "@/design-system";
import { num } from "@/lib/format";
import { useCan } from "@/features/shared/PermissionProvider";
import { ChevronsLeftRight, Coins, Printer, X } from "lucide-react";

export default function BalancingTable({
  period,
  inputs: materialInRows,
  outputs: finishedGoods,
  products,
  customers,
  result,
  assignedImports,
  assignedWips,
  describeStockLine,
  onClose,
}: {
  period: BalancingPeriod;
  inputs: BalancingInputItem[];
  outputs: BalancingOutputItem[];
  products: Product[];
  customers: Customer[];
  result: BalancingResult;
  /** So nguon da gan ky — de ban in co cot tung ngay nhu bang giay. */
  assignedImports: MaterialImportItem[];
  assignedWips: WipProductionItem[];
  /** Lô / kho của dòng Lấy xả đông · Gửi đông (từ Sổ kho tháng). */
  describeStockLine?: (r: BalancingInputItem) => string;
  onClose: () => void;
}) {
  const productNameOf = (id: string) => products.find((m) => m.id === id)?.name || "—";
  const tenKH = (id: string) => getBalancingCustomerName(id, customers);

  const dates = getPeriodDates(period);
  /* Cùng thứ tự với lưới: Lấy xả đông đầu bảng, Gửi đông cuối bảng. */
  const sortRank = (h: MaterialGridRow) => (h.stockLineKind === "thaw-out" ? 0 : h.stockLineKind === "freeze-deposit" ? 2 : 1);
  const materialRows = buildMaterialGridRows(materialInRows, assignedImports).sort((a, b) => sortRank(a) - sortRank(b));
  /* Cột chuyển kỳ đã bỏ ở khối NL — chỉ in khi kỳ cũ lỡ có số. */
  const hasLegacyCarryOver = materialRows.some((r) => r.carryOverKg !== 0);
  const materialById = new Map(materialInRows.map((r) => [r.id, r]));
  const stockRowName = (r: MaterialGridRow) => {
    const original = materialById.get(r.id);
    const mt = original && describeStockLine ? describeStockLine(original) : "";
    const name = r.stockLineKind && r.name !== BALANCING_STOCK_LINE_NAMES[r.stockLineKind] ? `${BALANCING_STOCK_LINE_NAMES[r.stockLineKind]} · ${r.name}` : r.name;
    return mt ? `${name} — ${mt}` : name;
  };
  /* GIỐNG BẢNG NGOÀI MÀN (người dùng 2026-10-20: "xem / in bảng giao diện cũng phải giống ở
     ngoài để bấm xem rồi chụp màn hình gửi đi, người xem dễ hiểu"):
     - dòng kỳ sổ nhập gộp ≥ 2 loại ⇒ KHÔNG in dòng gộp, in riêng từng LOẠI (2 da lớn · 2 da
       nhỏ): kg · giá BÌNH QUÂN · tiền = Σ kg × giá từng chuyến (như MaterialGrid);
     - có cột ngày + được xem giá ⇒ dưới dòng sổ nhập / dòng loại có hàng "Giá (đ/kg)" từng ngày,
       dưới Gửi đông có hàng "Giá gửi (đ/kg)" từng ngày;
     - khối thành phẩm bỏ dòng chưa có số (màn mặc định "Ẩn dòng trống"). */
  const importById = new Map(assignedImports.map((i) => [i.id, i]));
  type PrintMaterialLine =
    | { kind: "row"; key: string; row: MaterialGridRow; amount: number | null }
    | { kind: "price"; key: string; label: string; prices: DailyQuantities };
  const materialLines: PrintMaterialLine[] = materialRows.flatMap((r): PrintMaterialLine[] => {
    const trips = r.fromImports ? r.sourceIds.flatMap((id) => importById.get(id) ?? []).filter((i) => i.quantityKg !== 0) : [];
    const types = groupTripsByType(trips);
    const amountOf = (rows: MaterialImportItem[]) => rows.reduce((sum, i) => sum + calculateImportAmount(i), 0);
    const priceLine = (key: string, rows: MaterialImportItem[]): PrintMaterialLine[] =>
      rows.length > 0 ? [{ kind: "price", key: `${key}::day-price`, label: "Giá (đ/kg)", prices: dailyAverageImportPrices(rows) }] : [];
    if (types.length > 1)
      return types.flatMap(([typeName, rows]) => {
        const id = importTypeRowId(r.id, typeName);
        return [{ kind: "row" as const, key: id, row: buildTripGroupRow(r, id, typeName, rows), amount: amountOf(rows) }, ...priceLine(id, rows)];
      });
    const line: PrintMaterialLine = { kind: "row", key: r.id, row: r, amount: r.fromImports ? amountOf(trips) : r.unitPrice ? r.total * r.unitPrice : null };
    if (r.fromImports) return [line, ...priceLine(r.id, trips)];
    const original = materialById.get(r.id);
    if (r.stockLineKind === "freeze-deposit" && original) {
      const prices: DailyQuantities = {};
      for (const [iso, kg] of Object.entries(original.dailyQuantities ?? {})) {
        const price = kg ? depositPriceOn(original, iso) : null;
        if (price != null) prices[iso] = price;
      }
      return [line, { kind: "price", key: `${r.id}::deposit-price`, label: "Giá gửi (đ/kg)", prices }];
    }
    return [line];
  });
  const finishedGoodRows = buildFinishedGoodGridRows(finishedGoods, assignedWips).filter(
    (r) => r.total !== 0 || r.repaidKg !== 0 || r.debtKg !== 0
  );
  const hasNoFinishedGood = result.totalOutputKg <= 0;
  /* Nhieu cot ngay ⇒ in NGANG, neu khong bang bi cat mat cot cuoi. */
  const isLandscape = dates.length > 3;

  /* Thu/mở cột NGAY TRONG phiếu. Bản trước chỉ có nút này ở lưới ngoài, nên khi
     kỳ dài người dùng phải thoát phiếu, thu cột, mở lại phiếu — ba bước cho một
     việc. Thu ở đây còn quyết định bản in ra giấy gồm cột nào. */
  const [hideDays, setHideDays] = useState(false);
  const [hideAmountsToggle, setHideAmounts] = useState(false);
  /* Không có quyền xem giá ⇒ cột tiền + dòng tiền ở Ghi chú luôn ẩn, không có nút mở lại. */
  const canViewPrice = useCan("balancing")["view-price"];
  const hideAmounts = hideAmountsToggle || !canViewPrice;
  const dateColumns = hideDays ? [] : dates;
  /* Khối NL: công tắc ngày riêng — mặc định MỞ như màn (chốt 2026-10-06); thu lại thì
     in đúng bảng giấy (Loại hàng · Số lượng · Đơn giá · T.tiền · tỷ lệ). */
  const [isMaterialDaysOpen, setIsMaterialDaysOpen] = useState(true);
  const materialDateColumns = isMaterialDaysOpen ? dateColumns : [];

  /* Khoá cuộn nền khi phiếu đang mở — xem ghi chú ở src/index.css. */
  useEffect(() => {
    document.documentElement.setAttribute("data-print-preview", "");
    return () => document.documentElement.removeAttribute("data-print-preview");
  }, []);

  return (
    <div
      className={`print-root fixed inset-0 z-50 overflow-auto bg-white p-8 text-slate-900 sm:p-12 ${
        isLandscape ? "print-landscape" : ""
      }`}
    >
      {/* Thanh công cụ */}
      <div
        className={`no-print mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 ${
          isLandscape ? "max-w-[100rem]" : "max-w-5xl"
        }`}
      >
        <Button variant="outline" onClick={onClose}>
          <X className="size-4" /> Đóng
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            title="Ẩn / hiện các cột chia theo ngày trên bản in cho vừa khổ giấy." variant="outline" onClick={() => setHideDays((v) => !v)}>
            <ChevronsLeftRight className="size-4" />
            {hideDays ? "Mở cột ngày" : "Thu cột ngày"}
          </Button>
          <Button
            title="Khối nguyên liệu: in theo tổng như bảng cân đối giấy, hoặc chia thêm cột từng ngày." variant="outline" onClick={() => setIsMaterialDaysOpen((v) => !v)}>
            <ChevronsLeftRight className="size-4" />
            {isMaterialDaysOpen ? "NL: thu cột ngày" : "NL: mở cột ngày"}
          </Button>
          {canViewPrice && (
            <Button
              title="Ẩn / hiện các cột tiền trên bản in." variant="outline" onClick={() => setHideAmounts((v) => !v)}>
              <Coins className="size-4" />
              {hideAmounts ? "Mở cột tiền" : "Thu cột tiền"}
            </Button>
          )}
          <Button
            title="Mở hộp in của trình duyệt cho bảng cân đối này (in giấy hoặc lưu PDF)." onClick={() => window.print()}>
            <Printer className="size-4" /> In / Xuất PDF
          </Button>
        </div>
      </div>

      {/* Rộng hơn + thoáng hơn: bảng cân đối là bảng số dày, chật thì đọc nhầm dòng. */}
      <div className={isLandscape ? "mx-auto max-w-[100rem]" : "mx-auto max-w-5xl"}>
        <div className="text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">
            Bảng cân đối {period.materialTypeName}
          </h1>
          <p className="text-sm">Ngày {period.dateRangeDescription || "…"}</p>
        </div>

        {/* Nguyên liệu vào */}
        <Section title="Nguyên liệu vào">
          <table className="w-full border-collapse text-sm">
            <thead>
              <Tr head>
                {/* Như file cân đối (cột A–E): số chính sát tên, chia ngày (nếu mở) ra sau. */}
                <Th>Loại hàng</Th>
                <Th right>Số lượng</Th>
                {!hideAmounts && <Th right>Đơn giá VNĐ</Th>}
                {!hideAmounts && <Th right>T.tiền (đồng)</Th>}
                {!hideAmounts && <Th right>tỷ lệ</Th>}
                {materialDateColumns.map((iso) => (
                  <Th key={iso} right>
                    {formatDayLabel(iso)}
                  </Th>
                ))}
                {isMaterialDaysOpen && hasLegacyCarryOver && <Th right>Chuyển kỳ (cũ)</Th>}
              </Tr>
            </thead>
            <tbody>
              {materialLines.map((line) => {
                /* Hàng giá theo ngày: chỉ in khi có cột ngày và được xem giá. */
                if (line.kind === "price") {
                  if (hideAmounts || materialDateColumns.length === 0) return null;
                  return (
                    <Tr key={line.key}>
                      <Td>
                        <span className="pl-4 text-xs italic text-slate-600">{line.label}</span>
                      </Td>
                      <Td right></Td>
                      <Td right></Td>
                      <Td right></Td>
                      <Td right></Td>
                      {materialDateColumns.map((iso) => (
                        <Td key={iso} right>
                          <span className="text-xs text-slate-600">{line.prices[iso] != null ? num(line.prices[iso]) : ""}</span>
                        </Td>
                      ))}
                      {isMaterialDaysOpen && hasLegacyCarryOver && <Td right></Td>}
                    </Tr>
                  );
                }
                const r = line.row;
                return (
                  <Tr key={line.key}>
                    <Td>
                      {r.stockLineKind ? (
                        <strong>{stockRowName(r)}</strong>
                      ) : (
                        <>
                          {r.name}
                          {r.isDecrease && <span className="ml-1 text-xs text-slate-500">(Giảm)</span>}
                        </>
                      )}
                    </Td>
                    <Td right>{num(r.total)}</Td>
                    {/* Dòng sổ nhập / dòng loại: giá BÌNH QUÂN theo kg (như màn); tiền = Σ kg × giá từng chuyến. */}
                    {!hideAmounts && <Td right>{r.unitPrice != null ? num(Math.round(r.unitPrice)) : ""}</Td>}
                    {/* Chưa khai đơn giá thì để trống — "-0" (dòng giảm × giá 0)
                        đọc như một con số thật, người xem bảng in sẽ tưởng lỗi. */}
                    {!hideAmounts && <Td right>{line.amount ? num(Math.round(line.amount)) : ""}</Td>}
                    {!hideAmounts && <Td right>{r.ratio != null ? `${num(r.ratio)}%` : ""}</Td>}
                    {materialDateColumns.map((iso) => (
                      <Td key={iso} right>
                        {r.dailyQuantities[iso] ? num(r.dailyQuantities[iso]) : ""}
                      </Td>
                    ))}
                    {isMaterialDaysOpen && hasLegacyCarryOver && <Td right>{r.carryOverKg ? num(r.carryOverKg) : ""}</Td>}
                  </Tr>
                );
              })}
              <Tr total>
                <Td>T. CỘNG</Td>
                <Td right>{num(result.totalInputKg)}</Td>
                {!hideAmounts && (
                  <Td right>{result.totalInputKg ? num(Math.round(result.materialValue / result.totalInputKg) || 0) : ""}</Td>
                )}
                {!hideAmounts && <Td right>{num(result.materialValue)}</Td>}
                {!hideAmounts && <Td right></Td>}
                {materialDateColumns.map((iso) => (
                  <Td key={iso} right>
                    {num(materialRows.reduce((s, r) => s + (r.dailyQuantities[iso] ?? 0), 0))}
                  </Td>
                ))}
                {isMaterialDaysOpen && hasLegacyCarryOver && <Td right>{num(materialRows.reduce((s, r) => s + r.carryOverKg, 0))}</Td>}
              </Tr>
            </tbody>
          </table>
        </Section>

        {/* Thành phẩm */}
        <Section title="Bán thành phẩm sản xuất (xuất khẩu / nội địa)">
          <table className="w-full border-collapse text-sm">
            <thead>
              <Tr head>
                {/* Thứ tự như lưới: Mặt hàng · Khách · XUẤT KHẨU (Lượng · Đơn giá · T.tiền) ·
                    từng ngày · Tổng · Trả · Nợ. Hàng nội địa: giá VND, không "$". */}
                <Th>Mặt hàng</Th>
                <Th>Khách</Th>
                <Th right>Lượng</Th>
                {!hideAmounts && <Th right>Đơn giá</Th>}
                {!hideAmounts && <Th right>T.tiền (usd)</Th>}
                {dateColumns.map((iso) => (
                  <Th key={iso} right>
                    {formatDayLabel(iso)}
                  </Th>
                ))}
                {dateColumns.length > 0 && <Th right>Tổng</Th>}
                <Th right>Trả</Th>
                <Th right>Nợ</Th>
              </Tr>
            </thead>
            <tbody>
              {finishedGoodRows.map((r) => {
                const xk = r.channel === "Xuất khẩu";
                const amount = r.total * (r.unitPrice ?? 0);
                return (
                  <Tr key={r.id}>
                    <Td>
                      {productNameOf(r.productId)}
                      {r.spec && (
                        <span className="ml-1 text-xs text-slate-500">{r.spec}</span>
                      )}
                    </Td>
                    <Td>
                      {tenKH(r.customerId)}
                      {!xk && <span className="ml-1 text-xs text-slate-500">(nội địa)</span>}
                    </Td>
                    <Td right>{num(r.total)}</Td>
                    {!hideAmounts && (
                      <Td right>
                        {num(r.unitPrice)}
                        {xk ? " $" : ""}
                      </Td>
                    )}
                    {!hideAmounts && (
                      <Td right>
                        {num(amount)}
                        {xk ? " $" : ""}
                      </Td>
                    )}
                    {dateColumns.map((iso) => (
                      <Td key={iso} right>
                        {r.dailyQuantities[iso] ? num(r.dailyQuantities[iso]) : ""}
                      </Td>
                    ))}
                    {dateColumns.length > 0 && <Td right>{num(r.total)}</Td>}
                    <Td right>{r.repaidKg ? num(r.repaidKg) : ""}</Td>
                    <Td right>{r.debtKg ? num(r.debtKg) : ""}</Td>
                  </Tr>
                );
              })}
              <Tr total>
                <Td>Tổng cộng</Td>
                <Td></Td>
                <Td right>{num(result.totalOutputKg)}</Td>
                {!hideAmounts && (
                  <Td right>
                    {result.totalOutputKg
                      ? num(Math.round((finishedGoodRows.reduce((s, r) => s + r.total * (r.unitPrice ?? 0), 0) / result.totalOutputKg) * 100) / 100)
                      : ""}
                  </Td>
                )}
                {!hideAmounts && (
                  <Td right>{num(Math.round(finishedGoodRows.reduce((s, r) => s + r.total * (r.unitPrice ?? 0), 0) * 100) / 100)}</Td>
                )}
                {dateColumns.map((iso) => (
                  <Td key={iso} right>
                    {num(finishedGoodRows.reduce((s, r) => s + (r.dailyQuantities[iso] ?? 0), 0))}
                  </Td>
                ))}
                {dateColumns.length > 0 && <Td right>{num(result.totalOutputKg)}</Td>}
                <Td right>{num(finishedGoodRows.reduce((s, r) => s + r.repaidKg, 0))}</Td>
                <Td right>{num(finishedGoodRows.reduce((s, r) => s + r.debtKg, 0))}</Td>
              </Tr>
            </tbody>
          </table>
        </Section>

        {/* Ghi chú / tính toán */}
        {/* Ô GHI CHÚ của bảng giấy — cột trái đúng thứ tự kế toán đọc, cột phải phần phụ. */}
        <Section title="Ghi chú">
          {/* Nhãn · đơn vị · thứ tự như khối Ghi chú ngoài màn. */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div>
              <KV k="Tổng thành phẩm" v={`${num(result.totalOutputKg)} kg`} />
              <KV k="Định mức chế biến" v={hasNoFinishedGood ? "—" : num(result.norm)} strong />
              {canViewPrice && (
                <>
                  <KV k="Chi phí CB / kg TP" v={period.processingCostPerKg != null ? `${num(period.processingCostPerKg)} đ` : "—"} />
                  <KV k="Giá thành" v={`${num(result.costOfGoods)} đ`} />
                  <KV k="Giá trị xuất" v={`${num(result.exportValue)} đ`} />
                  <KV
                    k={hasNoFinishedGood ? "Lãi / Lỗ" : result.profitOrLoss >= 0 ? "Lãi" : "Lỗ"}
                    v={hasNoFinishedGood ? "—" : `${num(Math.abs(result.profitOrLoss))} đ`}
                    strong
                  />
                  <KV k="Bình quân / kg NL" v={hasNoFinishedGood ? "—" : `${num(result.avgProfitPerKgMaterial)} đ`} />
                  <KV k="Tỉ giá" v={period.exchangeRate != null ? `${num(period.exchangeRate)} đ/USD` : "—"} />
                </>
              )}
            </div>
            <div>
              <KV k="Tổng NL vào" v={`${num(result.totalInputKg)} kg`} />
              {canViewPrice && <KV k="Giá trị NL" v={`${num(result.materialValue)} đ`} />}
              <KV k="Tổng NL nhận cả kỳ" v={period.totalInputKg != null ? `${num(period.totalInputKg)} kg` : "—"} />
              <KV k="Tỉ lệ thu hồi" v={result.yieldRate == null ? "—" : num(result.yieldRate)} />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-1 border-b-2 border-slate-800 pb-0.5 text-sm font-bold uppercase">
        {title}
      </div>
      {children}
    </div>
  );
}

function Tr({
  children,
  head,
  total,
}: {
  children: ReactNode;
  head?: boolean;
  total?: boolean;
}) {
  return (
    <tr className={total ? "border-t-2 border-slate-700 font-semibold" : head ? "bg-slate-100" : ""}>
      {children}
    </tr>
  );
}
function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return (
    <th className={`border border-slate-300 px-2 py-1 text-xs font-semibold ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, right }: { children?: ReactNode; right?: boolean }) {
  return (
    <td className={`tnum border border-slate-300 px-2 py-1 ${right ? "text-right" : "text-left"}`}>
      {children}
    </td>
  );
}
function KV({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-dashed border-slate-200 py-0.5">
      <span className="text-slate-600">{k}</span>
      <span className={`tnum ${strong ? "font-bold" : ""}`}>{v}</span>
    </div>
  );
}
