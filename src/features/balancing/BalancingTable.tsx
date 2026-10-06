// ============================================================
// Tên file cũ: src/features/balancing/BangCanDoi.tsx
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
import type { MaterialImportItem, WipProductionItem } from "@/types";
import {
  TEN_DONG_KHO,
  dungHangNL,
  dungHangTP,
  nhanNgay,
  ngayTrongKy,
  tenKhachCanDoi,
  type HangLuoiNL,
} from "@/lib/balancingGrid";
import { Button } from "@/design-system";
import { num } from "@/lib/format";
import { ChevronsLeftRight, Coins, Printer, X } from "lucide-react";

export default function BangCanDoi({
  ky,
  nlVao,
  tp,
  matHang,
  khach,
  kq,
  nhapDaGan,
  sanXuatDaGan,
  onClose,
}: {
  ky: BalancingPeriod;
  nlVao: BalancingInputItem[];
  tp: BalancingOutputItem[];
  matHang: Product[];
  khach: Customer[];
  kq: BalancingResult;
  /** So nguon da gan ky — de ban in co cot tung ngay nhu bang giay. */
  nhapDaGan: MaterialImportItem[];
  sanXuatDaGan: WipProductionItem[];
  onClose: () => void;
}) {
  const tenMH = (id: string) => matHang.find((m) => m.id === id)?.name || "—";
  const tenKH = (id: string) => tenKhachCanDoi(id, khach);

  const ngay = ngayTrongKy(ky);
  /* Cùng thứ tự với lưới: Lấy xả đông đầu bảng, Gửi đông cuối bảng. */
  const thuTu = (h: HangLuoiNL) => (h.loaiKho === "lay-xa-dong" ? 0 : h.loaiKho === "gui-dong" ? 2 : 1);
  const hangNL = dungHangNL(nlVao, nhapDaGan).sort((a, b) => thuTu(a) - thuTu(b));
  /* Cột chuyển kỳ đã bỏ ở khối NL — chỉ in khi kỳ cũ lỡ có số. */
  const coChuyenKyCu = hangNL.some((r) => r.chuyenKy !== 0);
  const hangTP = dungHangTP(tp, sanXuatDaGan);
  /* Nhieu cot ngay ⇒ in NGANG, neu khong bang bi cat mat cot cuoi. */
  const inNgang = ngay.length > 3;

  /* Thu/mở cột NGAY TRONG phiếu. Bản trước chỉ có nút này ở lưới ngoài, nên khi
     kỳ dài người dùng phải thoát phiếu, thu cột, mở lại phiếu — ba bước cho một
     việc. Thu ở đây còn quyết định bản in ra giấy gồm cột nào. */
  const [anNgay, setAnNgay] = useState(false);
  const [anTien, setAnTien] = useState(false);
  const cotNgay = anNgay ? [] : ngay;
  /* Khối NL: công tắc ngày riêng — mặc định MỞ như màn (chốt 2026-10-06); thu lại thì
     in đúng bảng giấy (Loại hàng · Số lượng · Đơn giá · T.tiền · tỷ lệ). */
  const [moNgayNL, setMoNgayNL] = useState(true);
  const cotNgayNL = moNgayNL ? cotNgay : [];

  /* Khoá cuộn nền khi phiếu đang mở — xem ghi chú ở src/index.css. */
  useEffect(() => {
    document.documentElement.setAttribute("data-xem-phieu", "");
    return () => document.documentElement.removeAttribute("data-xem-phieu");
  }, []);

  return (
    <div
      className={`print-root fixed inset-0 z-50 overflow-auto bg-white p-8 text-slate-900 sm:p-12 ${
        inNgang ? "print-landscape" : ""
      }`}
    >
      {/* Thanh công cụ */}
      <div
        className={`no-print mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 ${
          inNgang ? "max-w-[100rem]" : "max-w-5xl"
        }`}
      >
        <Button variant="outline" onClick={onClose}>
          <X className="size-4" /> Đóng
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            title="Ẩn / hiện các cột chia theo ngày trên bản in cho vừa khổ giấy." variant="outline" onClick={() => setAnNgay((v) => !v)}>
            <ChevronsLeftRight className="size-4" />
            {anNgay ? "Mở cột ngày" : "Thu cột ngày"}
          </Button>
          <Button
            title="Khối nguyên liệu: in theo tổng như bảng cân đối giấy, hoặc chia thêm cột từng ngày." variant="outline" onClick={() => setMoNgayNL((v) => !v)}>
            <ChevronsLeftRight className="size-4" />
            {moNgayNL ? "NL: thu cột ngày" : "NL: mở cột ngày"}
          </Button>
          <Button
            title="Ẩn / hiện các cột tiền trên bản in." variant="outline" onClick={() => setAnTien((v) => !v)}>
            <Coins className="size-4" />
            {anTien ? "Mở cột tiền" : "Thu cột tiền"}
          </Button>
          <Button
            title="Mở hộp in của trình duyệt cho bảng cân đối này (in giấy hoặc lưu PDF)." onClick={() => window.print()}>
            <Printer className="size-4" /> In / Xuất PDF
          </Button>
        </div>
      </div>

      {/* Rộng hơn + thoáng hơn: bảng cân đối là bảng số dày, chật thì đọc nhầm dòng. */}
      <div className={inNgang ? "mx-auto max-w-[100rem]" : "mx-auto max-w-5xl"}>
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
                <Th>Loại hàng</Th>
                {cotNgayNL.map((iso) => (
                  <Th key={iso} right>
                    {nhanNgay(iso)}
                  </Th>
                ))}
                {moNgayNL && coChuyenKyCu && <Th right>Chuyển kỳ (cũ)</Th>}
                <Th right>Số lượng</Th>
                {!anTien && <Th right>Đơn giá VNĐ</Th>}
                {!anTien && <Th right>T.tiền (đồng)</Th>}
                {!anTien && <Th right>tỷ lệ</Th>}
              </Tr>
            </thead>
            <tbody>
              {hangNL.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    {r.loaiKho ? (
                      <strong>{r.ten === TEN_DONG_KHO[r.loaiKho] ? r.ten : `${TEN_DONG_KHO[r.loaiKho]} · ${r.ten}`}</strong>
                    ) : (
                      <>
                        {r.ten}
                        <span className="ml-1 text-xs text-slate-500">
                          ({r.laGiam ? "Giảm" : r.nhom})
                        </span>
                      </>
                    )}
                  </Td>
                  {cotNgayNL.map((iso) => (
                    <Td key={iso} right>
                      {r.theoNgay[iso] ? num(r.theoNgay[iso]) : ""}
                    </Td>
                  ))}
                  {moNgayNL && coChuyenKyCu && <Td right>{r.chuyenKy ? num(r.chuyenKy) : ""}</Td>}
                  <Td right>{num(r.tong)}</Td>
                  {!anTien && <Td right>{num(r.donGia)}</Td>}
                  {/* Chưa khai đơn giá thì để trống — "-0" (dòng giảm × giá 0)
                      đọc như một con số thật, người xem bảng in sẽ tưởng lỗi. */}
                  {!anTien && <Td right>{r.donGia ? num(r.tong * r.donGia) : ""}</Td>}
                  {!anTien && <Td right>{r.tyLe != null ? `${num(r.tyLe)}%` : ""}</Td>}
                </Tr>
              ))}
              <Tr total>
                <Td>T. CỘNG</Td>
                {cotNgayNL.map((iso) => (
                  <Td key={iso} right>
                    {num(hangNL.reduce((s, r) => s + (r.theoNgay[iso] ?? 0), 0))}
                  </Td>
                ))}
                {moNgayNL && coChuyenKyCu && <Td right>{num(hangNL.reduce((s, r) => s + r.chuyenKy, 0))}</Td>}
                <Td right>{num(kq.totalInputKg)}</Td>
                {!anTien && (
                  <Td right>{kq.totalInputKg ? num(Math.round(kq.materialValue / kq.totalInputKg) || 0) : ""}</Td>
                )}
                {!anTien && <Td right>{num(kq.materialValue)}</Td>}
                {!anTien && <Td right></Td>}
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
                {!anTien && <Th right>Đơn giá</Th>}
                {!anTien && <Th right>T.tiền (usd)</Th>}
                {cotNgay.map((iso) => (
                  <Th key={iso} right>
                    {nhanNgay(iso)}
                  </Th>
                ))}
                {cotNgay.length > 0 && <Th right>Tổng</Th>}
                <Th right>Trả</Th>
                <Th right>Nợ</Th>
              </Tr>
            </thead>
            <tbody>
              {hangTP.map((r) => {
                const xk = r.kenh === "Xuất khẩu";
                const tien = r.tong * (r.donGia ?? 0);
                return (
                  <Tr key={r.id}>
                    <Td>
                      {tenMH(r.matHangId)}
                      {r.quyCach && (
                        <span className="ml-1 text-xs text-slate-500">{r.quyCach}</span>
                      )}
                    </Td>
                    <Td>
                      {tenKH(r.khachId)}
                      {!xk && <span className="ml-1 text-xs text-slate-500">(nội địa)</span>}
                    </Td>
                    <Td right>{num(r.tong)}</Td>
                    {!anTien && (
                      <Td right>
                        {num(r.donGia)}
                        {xk ? " $" : ""}
                      </Td>
                    )}
                    {!anTien && (
                      <Td right>
                        {num(tien)}
                        {xk ? " $" : ""}
                      </Td>
                    )}
                    {cotNgay.map((iso) => (
                      <Td key={iso} right>
                        {r.theoNgay[iso] ? num(r.theoNgay[iso]) : ""}
                      </Td>
                    ))}
                    {cotNgay.length > 0 && <Td right>{num(r.tong)}</Td>}
                    <Td right>{r.tra ? num(r.tra) : ""}</Td>
                    <Td right>{r.no ? num(r.no) : ""}</Td>
                  </Tr>
                );
              })}
              <Tr total>
                <Td>Tổng cộng</Td>
                <Td></Td>
                <Td right>{num(kq.totalOutputKg)}</Td>
                {!anTien && (
                  <Td right>
                    {kq.totalOutputKg
                      ? num(Math.round((hangTP.reduce((s, r) => s + r.tong * (r.donGia ?? 0), 0) / kq.totalOutputKg) * 100) / 100)
                      : ""}
                  </Td>
                )}
                {!anTien && (
                  <Td right>{num(Math.round(hangTP.reduce((s, r) => s + r.tong * (r.donGia ?? 0), 0) * 100) / 100)}</Td>
                )}
                {cotNgay.map((iso) => (
                  <Td key={iso} right>
                    {num(hangTP.reduce((s, r) => s + (r.theoNgay[iso] ?? 0), 0))}
                  </Td>
                ))}
                {cotNgay.length > 0 && <Td right>{num(kq.totalOutputKg)}</Td>}
                <Td right>{num(hangTP.reduce((s, r) => s + r.tra, 0))}</Td>
                <Td right>{num(hangTP.reduce((s, r) => s + r.no, 0))}</Td>
              </Tr>
            </tbody>
          </table>
        </Section>

        {/* Ghi chú / tính toán */}
        {/* Ô GHI CHÚ của bảng giấy — cột trái đúng thứ tự kế toán đọc, cột phải phần phụ. */}
        <Section title="Ghi chú">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div>
              <KV k="Tổng thành phẩm" v={`${num(kq.totalOutputKg)} kg`} />
              <KV k="Định mức chế biến" v={num(kq.norm)} strong />
              <KV k="Chi phí CB /kg TP" v={num(ky.processingCostPerKg)} />
              <KV k="Giá Thành" v={num(kq.costOfGoods)} />
              <KV k="Giá trị xuất" v={num(kq.exportValue)} />
              <KV
                k={kq.profitOrLoss >= 0 ? "Lãi" : "Lỗ"}
                v={num(Math.abs(kq.profitOrLoss))}
                strong
              />
              <KV k="Bình quân /kg nl" v={num(kq.avgProfitPerKgMaterial)} />
              <KV k="tỉ giá" v={num(ky.exchangeRate)} />
            </div>
            <div>
              <KV k="Tổng nguyên liệu vào" v={`${num(kq.totalInputKg)} kg`} />
              <KV k="Giá trị nguyên liệu" v={num(kq.materialValue)} />
              <KV k="Tỉ lệ thu hồi / tổng nhận" v={kq.yieldRate == null ? "—" : num(kq.yieldRate)} />
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
