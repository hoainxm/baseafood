import type { ReactNode } from "react";
import type {
  KyCanDoi,
  DongNLVao,
  DongPheLieu,
  DongTP,
  MatHang,
  KhachHang,
} from "@/types";
import type { KetQuaCanDoi } from "@/lib/canDoi";
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
  ky: KyCanDoi;
  nlVao: DongNLVao[];
  pheLieu: DongPheLieu[];
  tp: DongTP[];
  matHang: MatHang[];
  khach: KhachHang[];
  kq: KetQuaCanDoi;
  onClose: () => void;
}) {
  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.ten || "—";
  const tenKH = (id: string) => khach.find((k) => k.id === id)?.ten || "—";

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
            Bảng cân đối {ky.loaiNL}
          </h1>
          <p className="text-sm">Ngày {ky.ngayList || "…"}</p>
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
                <Th right>Tỷ lệ</Th>
              </Tr>
            </thead>
            <tbody>
              {nlVao.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    {r.ten}
                    <span className="ml-1 text-xs text-slate-500">({r.nhom})</span>
                  </Td>
                  <Td right>{num(r.soLuongKg)}</Td>
                  <Td right>{num(r.donGia)}</Td>
                  <Td right>{num(r.soLuongKg * (r.donGia ?? 0))}</Td>
                  <Td right>{r.tyLe != null ? `${num(r.tyLe)}%` : ""}</Td>
                </Tr>
              ))}
              <Tr total>
                <Td>Tổng nguyên liệu</Td>
                <Td right>{num(kq.tongNLVao)}</Td>
                <Td right></Td>
                <Td right>{num(kq.giaTriNL)}</Td>
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
                    <Td>{r.loai}</Td>
                    <Td right>{num(r.soLuongKg)}</Td>
                    <Td right>{num(r.donGiaBan)}</Td>
                    <Td right>{num(r.soLuongKg * (r.donGiaBan ?? 0))}</Td>
                  </Tr>
                ))}
                <Tr total>
                  <Td>Tổng phế liệu</Td>
                  <Td right></Td>
                  <Td right></Td>
                  <Td right>{num(kq.giaTriPheLieu)}</Td>
                </Tr>
              </tbody>
            </table>
          </Section>
        )}

        {/* Thành phẩm */}
        <Section title="Thành phẩm ra (xuất khẩu / nội địa)">
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
                const xk = r.kenh === "Xuất khẩu";
                const tien = r.luongKg * (r.donGia ?? 0);
                return (
                  <Tr key={r.id}>
                    <Td>{tenMH(r.matHangId)}</Td>
                    <Td>{tenKH(r.khachId)}</Td>
                    <Td>{xk ? "XK" : "Nội địa"}</Td>
                    <Td right>{num(r.luongKg)}</Td>
                    <Td right>
                      {num(r.donGia)}
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
                <Td>Tổng thành phẩm</Td>
                <Td></Td>
                <Td></Td>
                <Td right>{num(kq.tongTP)}</Td>
                <Td right></Td>
                <Td right></Td>
              </Tr>
            </tbody>
          </table>
        </Section>

        {/* Ghi chú / tính toán */}
        <Section title="Cân đối">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <KV k="Tổng thành phẩm" v={`${num(kq.tongTP)} kg`} />
            <KV k="Tỉ giá (VND/USD)" v={num(ky.tiGia)} />
            <KV k="Định mức chế biến" v={num(kq.dinhMuc)} strong />
            <KV k="Chi phí CB / kg TP" v={num(ky.chiPhiCB)} />
            <KV k="Tỉ lệ thu hồi / tổng nhận" v={kq.tyLeThuHoi == null ? "—" : num(kq.tyLeThuHoi)} />
            <KV k="Giá trị nguyên liệu" v={num(kq.giaTriNL)} />
            <KV k="Giá thành" v={num(kq.giaThanh)} />
            <KV k="Giá trị xuất (VND)" v={num(kq.giaTriXuat)} />
            <KV k="Bình quân / kg NL" v={num(kq.binhQuanKgNL)} />
            <KV
              k={kq.laiLo >= 0 ? "LÃI" : "LỖ"}
              v={`${num(Math.abs(kq.laiLo))} VND`}
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
