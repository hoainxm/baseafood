// ============================================================
// Tên file: src/features/balancing/ChuyenTheoNgay.tsx
// Tên tiếng Việt: Chuyến nhập theo ngày (khối Nguyên liệu vào — Cân đối kỳ)
// Description: Read-only day → supplier → shipment breakdown of material imports
// ============================================================
import { useMemo } from "react";
import type { MaterialImportItem } from "@/types";
import { BangTong, Nhan, type CotTong } from "@/design-system";
import { useImportShipments } from "@/lib/catalogRepo";
import { chuyenTrongNgay, tomTatTheoNgay, type ChuyenNgay, type DongChuyenNgay } from "@/lib/chuyenTrongNgay";
import { num, viDate } from "@/lib/format";

/** Một dòng bảng = một dòng hàng của chuyến, kèm thông tin chuyến để hiện ở dòng đầu. */
type DongBang = DongChuyenNgay & { chuyen: ChuyenNgay; dauChuyen: boolean };

/**
 * Lưới Nguyên liệu vào chỉ cho tổng kg theo loại × ngày. Kế toán cần dò ngược:
 * "ngày 02/09 đại lý nào giao, mấy chuyến, chuyến nào bao nhiêu kg, giá bao
 * nhiêu" — khối này trả lời bằng chính các dòng sổ nhập đã lấy vào kỳ. CHỈ ĐỌC:
 * sửa số vẫn ở lưới (ghi ngược về sổ nhập) hoặc ở màn Nhập hàng.
 */
export function ChuyenTheoNgay({
  ngay,
  nhap,
  ngayXem,
  onChonNgay,
}: {
  /** Các ngày của kỳ (thứ tự lưới). */
  ngay: string[];
  /** Dòng sổ nhập đã lấy vào kỳ (cùng nguồn với lưới). */
  nhap: MaterialImportItem[];
  ngayXem: string | null;
  onChonNgay: (iso: string) => void;
}) {
  const [chuyenSo] = useImportShipments();
  const tomTat = useMemo(() => tomTatTheoNgay(nhap), [nhap]);
  const ngayCoChuyen = ngay.filter((d) => tomTat.has(d));
  // Giữ đúng ngày người dùng bấm (kể cả ngày không có chuyến — báo rõ "không có"),
  // chưa bấm thì mở ngày đầu tiên có chuyến.
  const dangXem = ngayXem && ngay.includes(ngayXem) ? ngayXem : (ngayCoChuyen[0] ?? null);
  const daiLy = useMemo(
    () => (dangXem ? chuyenTrongNgay(nhap, dangXem, chuyenSo) : []),
    [nhap, dangXem, chuyenSo]
  );

  if (ngayCoChuyen.length === 0) return null;

  const cot: CotTong<DongBang>[] = [
    {
      key: "chuyen",
      header: "Chuyến",
      render: (r) =>
        r.dauChuyen ? (
          <span className="font-semibold text-foreground">{r.chuyen.nhan}</span>
        ) : (
          <span className="text-muted-foreground">〃</span>
        ),
    },
    { key: "xuong", header: "Xưởng", render: (r) => (r.dauChuyen ? r.chuyen.xuong : "") },
    { key: "loai", header: "Loại nguyên liệu", render: (r) => r.loai },
    {
      key: "kg",
      header: "Số lượng (kg)",
      so: true,
      render: (r) => num(r.kg),
      tong: (rows) => num(rows.reduce((s, x) => s + x.kg, 0)),
    },
    { key: "gia", header: "Đơn giá (đ)", so: true, render: (r) => (r.donGia != null ? num(r.donGia) : "—") },
    {
      key: "tien",
      header: "Thành tiền (đ)",
      so: true,
      render: (r) => (r.tien ? num(Math.round(r.tien)) : "—"),
      tong: (rows) => num(Math.round(rows.reduce((s, x) => s + x.tien, 0))),
    },
    { key: "xe", header: "Xe · tài xế", render: (r) => (r.dauChuyen ? r.chuyen.xe || "—" : "") },
  ];

  return (
    // scroll-mt-20: cuộn tới đây (bấm tên ngày ở đầu cột lưới) không bị header trang h-16 che.
    <section id="chuyen-theo-ngay" className="mt-6 scroll-mt-20 space-y-3">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Chuyến nhập theo ngày</h3>
        <p className="text-sm text-muted-foreground">
          Chọn một ngày (hoặc bấm tên ngày ở đầu cột lưới) để xem đại lý nào giao, mấy chuyến, mỗi
          chuyến bao nhiêu kg. Chỉ xem — sửa số ở lưới phía trên hoặc ở màn Nhập hàng.
        </p>
      </div>

      {/* Hàng chọn ngày: mỗi nút nói luôn số chuyến + kg của ngày đó. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Chọn ngày xem chuyến nhập">
        {ngay.map((d) => {
          const t = tomTat.get(d);
          const chon = d === dangXem;
          return (
            <button
              key={d}
              type="button"
              disabled={!t}
              aria-pressed={chon}
              onClick={() => onChonNgay(d)}
              title={t ? `Xem ${t.soChuyen} chuyến nhập ngày ${viDate(d)} theo từng đại lý.` : `Ngày ${viDate(d)} không có chuyến nhập trong kỳ.`}
              className={`flex min-h-[var(--h-control,2.25rem)] flex-col items-start rounded-lg border px-3 py-1 text-left text-sm ${
                chon
                  ? "border-primary bg-primary text-primary-foreground"
                  : t
                    ? "border-border bg-card hover:bg-muted"
                    : "cursor-default border-border bg-card opacity-50"
              }`}
            >
              <span className="font-semibold">{viDate(d).slice(0, 5)}</span>
              <span className={`tnum text-sm ${chon ? "text-primary-foreground" : "text-muted-foreground"}`}>
                {t ? `${t.soChuyen} chuyến · ${num(t.kg)} kg` : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {dangXem && daiLy.length === 0 && (
        <p className="rounded-lg border-2 border-dashed border-border p-4 text-sm text-muted-foreground">
          Ngày {viDate(dangXem)} không có chuyến nhập nào trong kỳ này.
        </p>
      )}
      {dangXem && daiLy.length > 0 && (
        <div className="space-y-4">
          {daiLy.map((d) => {
            const rows: DongBang[] = d.chuyen.flatMap((c) =>
              c.dong.map((x, i) => ({ ...x, chuyen: c, dauChuyen: i === 0 }))
            );
            return (
              <div key={d.daiLy} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{d.daiLy}</span>
                  <Nhan loai="phu">{d.chuyen.length} chuyến</Nhan>
                  <Nhan loai="phu">{num(d.kg)} kg</Nhan>
                  {d.tien > 0 && <Nhan loai="phu">{num(Math.round(d.tien))} đ</Nhan>}
                </div>
                <BangTong
                  rows={rows}
                  cot={cot}
                  getKey={(r) => r.id}
                  nhanTong={`Cộng ${d.daiLy}`}
                  toMau="can-doi-chuyen-ngay"
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
