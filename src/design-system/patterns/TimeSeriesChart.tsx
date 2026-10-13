// ============================================================
// Tên tiếng Việt: Biểu đồ theo ngày (đường + cột)
// Description: Time-series chart — lines and grouped bars on one kg axis, SVG + tokens
// ============================================================
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useBeRongKhung } from "./useBeRongKhung";
import type { SacPhanLoai } from "./Nhan";

/**
 * BieuDoTheoNgay — nhiều chuỗi số trên CÙNG một trục (cùng đơn vị, VD kg): chuỗi
 * `cot` vẽ cột đứng xếp cạnh nhau theo ngày, chuỗi `duong` vẽ đường (có vùng mờ dưới
 * nếu `vung`). Rê chuột / chạm một ngày ⇒ vạch dọc + thẻ số của ngày đó.
 *
 * Bề rộng vẽ = khung đo thật (chữ trục không bị co); nhiều ngày quá thì khung cuộn
 * ngang. Nhãn ngày thưa tự động cho khỏi đè nhau. Chỉ vẽ số truyền vào.
 */
/** Màu chuỗi: 4 màu nghĩa + bảng tone theo loại (`SacPhanLoai`) để khớp thẻ số cùng màn. */
export type MauChuoi = "brand" | "success" | "warning" | "trung-tinh" | SacPhanLoai;

export interface ChuoiSo {
  khoa: string;
  ten: string;
  mau: MauChuoi;
  dang: "duong" | "cot";
  /** Tô vùng dưới đường (chỉ với `duong`). */
  vung?: boolean;
  giaTri: number[];
}

const NET: Record<MauChuoi, string> = {
  brand: "stroke-primary",
  success: "stroke-success",
  warning: "stroke-warning",
  "trung-tinh": "stroke-muted-foreground",
  tim: "stroke-tone-tim",
  ngoc: "stroke-tone-ngoc",
  bien: "stroke-tone-bien",
  bang: "stroke-tone-bang",
  cat: "stroke-tone-cat",
  hong: "stroke-tone-hong",
  la: "stroke-tone-la",
  cam: "stroke-tone-cam",
  xam: "stroke-tone-xam",
};
const NEN: Record<MauChuoi, string> = {
  brand: "fill-primary",
  success: "fill-success",
  warning: "fill-warning",
  "trung-tinh": "fill-muted-foreground",
  tim: "fill-tone-tim",
  ngoc: "fill-tone-ngoc",
  bien: "fill-tone-bien",
  bang: "fill-tone-bang",
  cat: "fill-tone-cat",
  hong: "fill-tone-hong",
  la: "fill-tone-la",
  cam: "fill-tone-cam",
  xam: "fill-tone-xam",
};

/** Mốc trục tròn: 1 · 2 · 2,5 · 5 × 10ⁿ. */
function mocTron(max: number, soMoc = 4): number[] {
  if (max <= 0) return [0];
  const tho = max / soMoc;
  const mu = 10 ** Math.floor(Math.log10(tho));
  const buoc = [1, 2, 2.5, 5, 10].map((b) => b * mu).find((b) => b >= tho) ?? tho;
  const ra: number[] = [];
  for (let v = 0; v <= max + buoc * 0.001; v += buoc) ra.push(v);
  if (ra[ra.length - 1] < max) ra.push(ra[ra.length - 1] + buoc);
  return ra;
}

/** Nhãn trục gọn: kg ≥ 1.000 ghi theo tấn; đơn vị khác ghi nghìn / triệu. */
const rutGon = (n: number, donVi: string) => {
  const so = (x: number) => x.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
  if (donVi === "kg") return n >= 1e3 ? `${so(n / 1e3)} tấn` : `${so(n)} kg`;
  return n >= 1e6 ? `${so(n / 1e6)} tr` : n >= 1e3 ? `${so(n / 1e3)} nghìn` : so(n);
};

export function BieuDoTheoNgay({
  nhan,
  chuoi,
  dinhDang = (n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 0 }),
  donVi = "kg",
  cao = 280,
  rongToiThieu = 560,
  moTa,
  className,
}: {
  /** Nhãn trục ngang (VD "02/09"), cùng độ dài với mỗi `giaTri`. */
  nhan: string[];
  chuoi: ChuoiSo[];
  dinhDang?: (n: number) => string;
  donVi?: string;
  cao?: number;
  rongToiThieu?: number;
  moTa?: string;
  className?: string;
}) {
  const soCot = chuoi.filter((c) => c.dang === "cot").length;
  const n = nhan.length;
  const { ref, rong } = useBeRongKhung<HTMLDivElement>(Math.max(rongToiThieu, n * Math.max(14, soCot * 10 + 6) + 64));
  const [chon, setChon] = useState<number | null>(null);

  const max = Math.max(0, ...chuoi.flatMap((c) => c.giaTri));
  if (n === 0 || chuoi.length === 0 || max <= 0) {
    return (
      <p className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Chưa có số liệu để vẽ biểu đồ.
      </p>
    );
  }

  const trai = 64;
  const phai = 12;
  const tren = 12;
  const duoi = 28;
  const moc = mocTron(max);
  const dinh = moc[moc.length - 1] || 1;
  const w = rong - trai - phai;
  const h = cao - tren - duoi;
  const bang = w / n;
  const xGiua = (i: number) => trai + bang * (i + 0.5);
  const y = (v: number) => tren + h - (v / dinh) * h;
  // Nhãn ngày: tối thiểu ~44px một nhãn để không đè.
  const buocNhan = Math.max(1, Math.ceil(44 / bang));
  const rongCot = Math.max(3, Math.min(22, (bang * 0.72) / Math.max(1, soCot)));
  let thuCot = 0;

  return (
    <div className={cn("space-y-3", className)}>
      <div ref={ref} className="relative overflow-x-auto scroll-nice-x">
        <svg
          width={rong}
          height={cao}
          viewBox={`0 0 ${rong} ${cao}`}
          role="img"
          aria-label={moTa ?? "Biểu đồ theo ngày"}
          className="block"
          style={{ minWidth: rong }}
          onMouseLeave={() => setChon(null)}
        >
          {/* Lưới + trục dọc */}
          {moc.map((v) => (
            <g key={v}>
              <line x1={trai} x2={rong - phai} y1={y(v)} y2={y(v)} className="stroke-border" strokeDasharray={v === 0 ? undefined : "3 4"} />
              <text x={trai - 6} y={y(v)} dy="0.35em" textAnchor="end" className="fill-muted-foreground text-xs tnum">
                {rutGon(v, donVi)}
              </text>
            </g>
          ))}
          {/* Nhãn ngày */}
          {nhan.map((t, i) =>
            i % buocNhan === 0 ? (
              <text key={i} x={xGiua(i)} y={cao - 8} textAnchor="middle" className="fill-muted-foreground text-xs tnum">
                {t}
              </text>
            ) : null,
          )}
          {/* Vạch ngày đang chọn */}
          {chon != null && <line x1={xGiua(chon)} x2={xGiua(chon)} y1={tren} y2={tren + h} className="stroke-foreground/30" />}
          {/* Cột */}
          {chuoi.map((c) => {
            if (c.dang !== "cot") return null;
            const lech = (thuCot++ - (soCot - 1) / 2) * rongCot;
            return (
              <g key={c.khoa} className={NEN[c.mau]}>
                {c.giaTri.map((v, i) =>
                  v > 0 ? (
                    <rect key={i} x={xGiua(i) + lech - rongCot / 2} y={y(v)} width={rongCot - 1} height={tren + h - y(v)} rx={2} opacity={chon == null || chon === i ? 0.9 : 0.45} />
                  ) : null,
                )}
              </g>
            );
          })}
          {/* Đường */}
          {chuoi.map((c) => {
            if (c.dang !== "duong") return null;
            const d = c.giaTri.map((v, i) => `${i ? "L" : "M"}${xGiua(i)},${y(v)}`).join(" ");
            return (
              <g key={c.khoa}>
                {c.vung && <path d={`${d} L${xGiua(n - 1)},${tren + h} L${xGiua(0)},${tren + h} Z`} className={NEN[c.mau]} opacity={0.12} />}
                <path d={d} fill="none" className={NET[c.mau]} strokeWidth={2.5} strokeLinejoin="round" />
                {chon != null && <circle cx={xGiua(chon)} cy={y(c.giaTri[chon] ?? 0)} r={4} className={cn(NEN[c.mau], "stroke-card")} strokeWidth={2} />}
              </g>
            );
          })}
          {/* Vùng bắt chuột theo ngày */}
          {nhan.map((t, i) => (
            <rect
              key={i}
              x={trai + bang * i}
              y={tren}
              width={bang}
              height={h}
              fill="transparent"
              onMouseEnter={() => setChon(i)}
              onClick={() => setChon(i)}
            >
              <title>{`${t}: ${chuoi.map((c) => `${c.ten} ${dinhDang(c.giaTri[i] ?? 0)} ${donVi}`).join(" · ")}`}</title>
            </rect>
          ))}
        </svg>
        {chon != null && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 rounded-lg border-2 border-border bg-card p-2.5 text-sm shadow-lg"
            style={xGiua(chon) < rong / 2 ? { left: xGiua(chon) + 12 } : { left: xGiua(chon) - 12, transform: "translateX(-100%)" }}
          >
            <p className="font-semibold text-foreground">{nhan[chon]}</p>
            {chuoi.map((c) => (
              <p key={c.khoa} className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
                <svg width="10" height="10" aria-hidden>
                  <rect width="10" height="10" rx="2" className={NEN[c.mau]} />
                </svg>
                {c.ten}: <span className="tnum font-semibold text-foreground">{dinhDang(c.giaTri[chon] ?? 0)} {donVi}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Chú giải">
        {chuoi.map((c) => (
          <li key={c.khoa} className="flex items-center gap-1.5">
            <svg width="16" height="10" aria-hidden>
              {c.dang === "cot" ? <rect width="10" height="10" rx="2" className={NEN[c.mau]} /> : <line x1="0" x2="16" y1="5" y2="5" strokeWidth="3" className={NET[c.mau]} />}
            </svg>
            {c.ten}
          </li>
        ))}
      </ul>
    </div>
  );
}
