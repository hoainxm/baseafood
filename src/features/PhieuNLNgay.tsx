import { useState, type ReactNode } from "react";
import type { DongNhapNL, DongPheLieu, PhanXuong } from "@/types";
import {
  Button,
  Combobox,
  DateField,
  DateRangeField,
  ngayTrongKhoang,
} from "@/design-system";
import { num, viDate } from "@/lib/format";
import { KY_OPT, phamViKy, type KyXem } from "@/lib/ky";
import { Printer, X } from "lucide-react";

/** "2026-07-31" → "31 THÁNG 07 NĂM 2026" (đúng giọng phiếu giấy). */
function ngayChu(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "…";
  return `${d} THÁNG ${m} NĂM ${y}`;
}

/** Gom dòng theo đại lý — mỗi đại lý một cụm, giữ thứ tự xuất hiện. */
interface CumDaiLy {
  daiLy: string;
  dong: DongNhapNL[];
  ghiChu: string[];
}

function gomTheoDaiLy(rows: DongNhapNL[]): CumDaiLy[] {
  const map = new Map<string, CumDaiLy>();
  for (const r of rows) {
    const ten = r.daiLy || "(chưa có đại lý)";
    let cum = map.get(ten);
    if (!cum) {
      cum = { daiLy: ten, dong: [], ghiChu: [] };
      map.set(ten, cum);
    }
    cum.dong.push(r);
    const moTaXe = [r.taiXe, r.bienSoXe].filter(Boolean).join(" - ");
    if (moTaXe && !cum.ghiChu.includes(moTaXe)) cum.ghiChu.push(moTaXe);
  }
  return [...map.values()];
}

/**
 * PhieuNLNgay — "Báo cáo tổng hợp nguyên liệu", bản in A4 NGANG, theo KỲ.
 *
 * Linh hoạt theo bộ lọc ngoài màn: một ngày ⇒ đúng tờ giấy của xí nghiệp; nhiều
 * ngày (tuần/tháng/năm/khoảng) ⇒ mỗi ngày một khối (sang trang khi in), cuối có
 * tổng cộng cả kỳ. Đổi khoảng ngay trong phiếu, không cần đóng.
 *
 * Chỉ ĐỌC dữ liệu đã nhập — không tạo/sửa bản ghi nào.
 */
export default function PhieuNLNgay({
  ky: kyBanDau,
  ngay: ngayBanDau,
  tuNgay,
  denNgay,
  phanXuong,
  rows,
  pheLieu,
  onClose,
}: {
  /** Kỳ + ngày neo + khoảng tự chọn — khởi tạo theo bộ lọc ngoài màn. */
  ky: KyXem;
  ngay: string;
  tuNgay: string;
  denNgay: string;
  /** Xưởng đang lọc; "Tất cả" ⇒ gộp cả ba xưởng như phiếu giấy. */
  phanXuong: PhanXuong | "Tất cả";
  rows: DongNhapNL[];
  pheLieu: DongPheLieu[];
  onClose: () => void;
}) {
  // Bộ chọn kỳ NGAY trong phiếu — cùng cách với màn Nhập hàng.
  const [ky, setKy] = useState<KyXem>(kyBanDau);
  const [moc, setMoc] = useState(ngayBanDau);
  const [tuTC, setTuTC] = useState(tuNgay);
  const [denTC, setDenTC] = useState(denNgay);
  const [tu, den] = phamViKy(ky, moc, tuTC, denTC);

  const trongXuong = (px: string) =>
    phanXuong === "Tất cả" || px === phanXuong;

  const laMotNgay = tu === den;

  const ngayCoData = ngayTrongKhoang(tu, den).filter(
    (d) =>
      rows.some((r) => r.ngay === d && trongXuong(r.phanXuong)) ||
      pheLieu.some(
        (r) =>
          r.nguon === "Nhập hàng" && r.ngay === d && trongXuong(r.phanXuong)
      )
  );

  const tongCaKy = rows
    .filter((r) => r.ngay >= tu && r.ngay <= den && trongXuong(r.phanXuong))
    .reduce((s, r) => s + (r.soLuongKg || 0), 0);

  return (
    <div className="print-root print-landscape fixed inset-0 z-50 overflow-auto bg-white p-6 text-slate-900 sm:p-10">
      {/* Thanh công cụ — không in */}
      <div className="no-print mx-auto mb-5 flex max-w-6xl flex-wrap items-end gap-4">
        <Button variant="outline" onClick={onClose}>
          <X className="size-4" /> Đóng
        </Button>

        <div className="min-w-[12rem]">
          <Combobox
            label="Kỳ báo cáo"
            anNhanBatBuoc
            choPhepXoa={false}
            value={ky}
            onChange={(v) => setKy(v as KyXem)}
            options={KY_OPT}
          />
        </div>

        <div className="min-w-[16rem] flex-1">
          {ky === "tuy-chon" ? (
            <DateRangeField
              label="Khoảng ngày"
              anNhanBatBuoc
              presets={false}
              tuNgay={tuTC}
              denNgay={denTC}
              onChange={(a, b) => {
                setTuTC(a);
                setDenTC(b);
              }}
            />
          ) : (
            <DateField
              label={
                ky === "ngay"
                  ? "Ngày"
                  : ky === "tuan"
                    ? "Ngày bất kỳ trong tuần"
                    : ky === "thang"
                      ? "Ngày bất kỳ trong tháng"
                      : "Ngày bất kỳ trong năm"
              }
              anNhanBatBuoc
              hint={
                ky === "ngay"
                  ? undefined
                  : `Kỳ: ${viDate(tu)} – ${viDate(den)}`
              }
              value={moc}
              onChange={setMoc}
            />
          )}
        </div>

        <Button onClick={() => window.print()}>
          <Printer className="size-4" /> In / Xuất PDF
        </Button>
      </div>

      <div className="mx-auto max-w-6xl">
        {/* Tiêu đề chung */}
        <div className="text-sm font-semibold uppercase leading-tight">
          <div>Công ty TNHH Basefood I</div>
          <div>PXD</div>
        </div>

        <div className="mt-2 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">
            Báo cáo tổng hợp nguyên liệu{laMotNgay ? " hàng ngày" : ""}
          </h1>
          <p className="text-sm font-semibold uppercase">
            {laMotNgay
              ? `Ngày ${ngayChu(tu)}`
              : `Từ ${ngayChu(tu)} đến ${ngayChu(den)}`}
            {phanXuong !== "Tất cả" ? ` · Phân xưởng ${phanXuong}` : ""}
          </p>
        </div>

        {ngayCoData.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            Không có nguyên liệu nhập trong khoảng này.
          </p>
        ) : (
          ngayCoData.map((d, i) => (
            <KhoiNgay
              key={d}
              ngay={d}
              phanXuong={phanXuong}
              rows={rows}
              pheLieu={pheLieu}
              hienTieuDeNgay={!laMotNgay}
              sangTrang={i > 0}
            />
          ))
        )}

        {!laMotNgay && ngayCoData.length > 0 && (
          <div className="mt-5 flex justify-end border-t-2 border-slate-800 pt-2 text-sm font-bold uppercase">
            <span>
              Tổng cộng cả kỳ:{" "}
              <span className="tnum">{num(tongCaKy)}</span> kg
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Một ngày = một khối như tờ giấy: STT theo đại lý + tổng cộng + phụ phẩm. */
function KhoiNgay({
  ngay,
  phanXuong,
  rows,
  pheLieu,
  hienTieuDeNgay,
  sangTrang,
}: {
  ngay: string;
  phanXuong: PhanXuong | "Tất cả";
  rows: DongNhapNL[];
  pheLieu: DongPheLieu[];
  hienTieuDeNgay: boolean;
  sangTrang: boolean;
}) {
  const trongXuong = (px: string) =>
    phanXuong === "Tất cả" || px === phanXuong;

  const dongNgay = rows.filter(
    (r) => r.ngay === ngay && trongXuong(r.phanXuong)
  );
  const pheNgay = pheLieu.filter(
    (r) =>
      r.nguon === "Nhập hàng" && r.ngay === ngay && trongXuong(r.phanXuong)
  );
  const cum = gomTheoDaiLy(dongNgay);
  const tongKg = dongNgay.reduce((s, r) => s + (r.soLuongKg || 0), 0);

  let stt = 0;

  return (
    <section
      className="mt-5"
      style={sangTrang ? { breakBefore: "page" } : undefined}
    >
      {hienTieuDeNgay && (
        <p className="mb-1 text-sm font-bold uppercase">Ngày {ngayChu(ngay)}</p>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <Th className="w-12 text-center">STT</Th>
            <Th>Tên đại lý</Th>
            <Th>Loại nguyên liệu</Th>
            <Th right className="w-28">
              Số lượng
            </Th>
            <Th right className="w-24">
              Đơn giá
            </Th>
            <Th className="w-64">Ghi chú</Th>
          </tr>
        </thead>
        <tbody>
          {cum.map((c) => {
            stt += 1;
            const n = c.dong.length;
            return c.dong.map((r, i) => (
              <tr key={r.id}>
                {i === 0 && (
                  <Td rowSpan={n} className="text-center align-top tnum">
                    {stt}
                  </Td>
                )}
                {i === 0 && (
                  <Td rowSpan={n} className="align-top font-medium">
                    {c.daiLy}
                  </Td>
                )}
                <Td>{r.loaiNL}</Td>
                <Td right className="tnum">
                  {num(r.soLuongKg)}
                </Td>
                <Td right className="tnum">
                  {r.donGia != null ? num(r.donGia) : ""}
                </Td>
                {i === 0 && (
                  <Td rowSpan={n} className="align-top">
                    {c.ghiChu.join(" · ")}
                  </Td>
                )}
              </tr>
            ));
          })}
          <tr className="border-t-2 border-slate-700 bg-slate-50 font-bold">
            <Td colSpan={3}>Tổng cộng</Td>
            <Td right className="tnum">
              {num(tongKg)}
            </Td>
            <Td />
            <Td />
          </tr>
        </tbody>
      </table>

      {pheNgay.length > 0 && (
        <div className="mt-3 flex justify-end">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100">
                <Th className="w-40">Phụ phẩm</Th>
                <Th right className="w-28">
                  Số lượng
                </Th>
              </tr>
            </thead>
            <tbody>
              {pheNgay.map((r) => (
                <tr key={r.id}>
                  <Td>{r.loai}</Td>
                  <Td right className="tnum">
                    {num(r.soLuongKg)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Th({
  children,
  right,
  className = "",
}: {
  children?: ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`border border-slate-400 px-2 py-1 text-xs font-semibold uppercase ${
        right ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  rowSpan,
  colSpan,
  className = "",
}: {
  children?: ReactNode;
  right?: boolean;
  rowSpan?: number;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`border border-slate-400 px-2 py-1 ${
        right ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}
