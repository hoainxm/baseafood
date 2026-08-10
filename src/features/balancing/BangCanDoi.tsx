import type { ReactNode } from "react";
import type {
  BalancingPeriod,
  BalancingInputItem,
  ScrapItem,
  BalancingOutputItem,
  Product,
  Customer,
} from "@/types";
import type { BalancingResult } from "@/lib/canDoi";
import { Button } from "@/design-system";
import { num } from "@/lib/format";
import { Printer, X } from "lucide-react";

export default function BangCanDoi({
  ky,
  nlVao,
  pheLieu,
  tp,
  matHang,
  khach,
  kq,
  onClose,
}: {
  ky: BalancingPeriod;
  nlVao: BalancingInputItem[];
  pheLieu: ScrapItem[];
  tp: BalancingOutputItem[];
  matHang: Product[];
  khach: Customer[];
  kq: BalancingResult;
  onClose: () => void;
}) {
  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";
  const tenKH = (id: string) => khach.find((k) => k.id === id)?.name || "—";

  return (
    <div className="print-root fixed inset-0 z-50 overflow-auto bg-white p-6 text-slate-900 sm:p-10">
      {/* Thanh công cụ */}
      <div className="no-print mx-auto mb-5 flex max-w-4xl items-center justify-between">
        <Button variant="outline" onClick={onClose}>
          <X className="size-4" /> Đóng
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> In / Xuất PDF
        </Button>
      </div>

      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">
            Bảng cân đối {ky.materialTypeName}
          </h1>
          <p className="text-sm">Ngày {ky.dateRangeDescription || "…"}</p>
        </div>

        {/* Nguyên liệu vào */}
        <Section title="Nguyên liệu vào">
          <table className="w-full border-collapse text-sm">
            <thead>
              <Tr head>
                <Th>Loại</Th>
                <Th right>SL (kg)</Th>
                <Th right>Đơn giá</Th>
                <Th right>Thành tiền</Th>
                <Th right>Tỉ lệ</Th>
              </Tr>
            </thead>
            <tbody>
              {nlVao.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    {r.name}
                    <span className="ml-1 text-xs text-slate-500">({r.groupName})</span>
                  </Td>
                  <Td right>{num(r.quantityKg)}</Td>
                  <Td right>{num(r.unitPrice)}</Td>
                  <Td right>{num(r.quantityKg * (r.unitPrice ?? 0))}</Td>
                  <Td right>{r.ratioPercentage != null ? `${num(r.ratioPercentage)}%` : ""}</Td>
                </Tr>
              ))}
              <Tr total>
                <Td>Tổng nguyên liệu</Td>
                <Td right>{num(kq.totalInputKg)}</Td>
                <Td right></Td>
                <Td right>{num(kq.materialValue)}</Td>
                <Td right></Td>
              </Tr>
            </tbody>
          </table>
        </Section>

        {/* Phế liệu */}
        {pheLieu.length > 0 && (
          <Section title="Phế liệu (bán giá riêng)">
            <table className="w-full border-collapse text-sm">
              <thead>
                <Tr head>
                  <Th>Loại</Th>
                  <Th right>SL (kg)</Th>
                  <Th right>Đơn giá bán</Th>
                  <Th right>Thành tiền</Th>
                </Tr>
              </thead>
              <tbody>
                {pheLieu.map((r) => (
                  <Tr key={r.id}>
                    <Td>{r.name}</Td>
                    <Td right>{num(r.quantityKg)}</Td>
                    <Td right>{num(r.sellingPrice)}</Td>
                    <Td right>{num(r.quantityKg * (r.sellingPrice ?? 0))}</Td>
                  </Tr>
                ))}
                <Tr total>
                  <Td>Tổng phế liệu</Td>
                  <Td right></Td>
                  <Td right></Td>
                  <Td right>{num(kq.scrapValue)}</Td>
                </Tr>
              </tbody>
            </table>
          </Section>
        )}

        {/* Thành phẩm */}
        <Section title="Bán thành phẩm sản xuất (xuất khẩu / nội địa)">
          <table className="w-full border-collapse text-sm">
            <thead>
              <Tr head>
                <Th>Mặt hàng</Th>
                <Th>Khách</Th>
                <Th>Kênh</Th>
                <Th right>Lượng (kg)</Th>
                <Th right>Đơn giá</Th>
                <Th right>Thành tiền</Th>
              </Tr>
            </thead>
            <tbody>
              {tp.map((r) => {
                const xk = r.channel === "Xuất khẩu";
                const tien = r.quantityKg * (r.unitPrice ?? 0);
                return (
                  <Tr key={r.id}>
                    <Td>{tenMH(r.productId)}</Td>
                    <Td>{tenKH(r.customerId)}</Td>
                    <Td>{xk ? "XK" : "Nội địa"}</Td>
                    <Td right>{num(r.quantityKg)}</Td>
                    <Td right>
                      {num(r.unitPrice)}
                      {xk ? " $" : ""}
                    </Td>
                    <Td right>
                      {num(tien)}
                      {xk ? " $" : ""}
                    </Td>
                  </Tr>
                );
              })}
              <Tr total>
                <Td>Tổng bán thành phẩm</Td>
                <Td></Td>
                <Td></Td>
                <Td right>{num(kq.totalOutputKg)}</Td>
                <Td right></Td>
                <Td right></Td>
              </Tr>
            </tbody>
          </table>
        </Section>

        {/* Ghi chú / tính toán */}
        <Section title="Cân đối">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <KV k="Tổng bán thành phẩm" v={`${num(kq.totalOutputKg)} kg`} />
            <KV k="Tỉ giá (VND/USD)" v={num(ky.exchangeRate)} />
            <KV k="Định mức chế biến" v={num(kq.norm)} strong />
            <KV k="Chi phí chế biến / kg TP" v={num(ky.processingCostPerKg)} />
            <KV k="Tỉ lệ thu hồi / tổng nhận" v={kq.yieldRate == null ? "—" : num(kq.yieldRate)} />
            <KV k="Giá trị nguyên liệu" v={num(kq.materialValue)} />
            <KV k="Giá thành" v={num(kq.costOfGoods)} />
            <KV k="Giá trị xuất (VND)" v={num(kq.exportValue)} />
            <KV k="Bình quân / kg NL" v={num(kq.avgProfitPerKgMaterial)} />
            <KV
              k={kq.profitOrLoss >= 0 ? "LÃI" : "LỖ"}
              v={`${num(Math.abs(kq.profitOrLoss))} VND`}
              strong
            />
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
