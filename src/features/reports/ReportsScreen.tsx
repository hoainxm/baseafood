// ============================================================
// Tên file cũ: src/features/reports/ManBaoCao.tsx
// Tên tiếng Việt: Màn hình Báo cáo tổng hợp MES
// Description: Executive Reports Overview Screen
// ============================================================
// src/features/reports/ManBaoCao.tsx
import { Fragment, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  Combobox,
  DateField,
  DuLieuMau,
  notify,
} from "@/design-system";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Coins,
  FileSpreadsheet,
  FileText,
  Gauge,
  Scale,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * ManBaoCao — báo cáo & phân tích cho Ban Giám đốc / Quản đốc: KPI tháng, 4 biểu
 * đồ (sản lượng theo ngày · OEE tách yếu tố · nhóm sản phẩm donut · kim ngạch thị
 * trường), bảng chi tiết theo ca mở rộng được theo khung giờ.
 *
 * Màn TRƯNG BÀY (dữ liệu mẫu). Biểu đồ vẽ SVG/HTML thuần, không thêm thư viện.
 */

interface KpiThang {
  nhan: string;
  giaTri: string;
  donVi?: string;
  delta: string;
  tang: boolean;
  tot: boolean;
  icon: LucideIcon;
  vien: string;
}

const BC_KPI: KpiThang[] = [
  { nhan: "Tổng sản lượng", giaTri: "285.000", donVi: "kg", delta: "12%", tang: true, tot: true, icon: Scale, vien: "border-l-primary" },
  { nhan: "OEE trung bình", giaTri: "81,3%", delta: "2,1 điểm", tang: true, tot: true, icon: Gauge, vien: "border-l-status-changeover" },
  { nhan: "Tỷ lệ đạt QC", giaTri: "97,2%", delta: "0,4 điểm", tang: true, tot: true, icon: ShieldCheck, vien: "border-l-success" },
  { nhan: "Kim ngạch xuất khẩu", giaTri: "4,8", donVi: "triệu USD", delta: "8%", tang: true, tot: true, icon: Coins, vien: "border-l-warning" },
];

const BC_NGAY = [8.2, 9.4, 7.8, 10.1, 11.3, 6.4, 5.1, 9.8, 10.6, 11.9, 12.4, 10.2, 6.8, 5.4, 9.1, 10.8, 11.6, 12.1, 11.4, 9.6, 6.2, 5.8, 10.4, 11.2, 12.8, 13.1, 11.8, 9.2, 6.6, 5.9];

const BC_OEE = [
  { line: "Line 1", a: 94, p: 89, q: 98 },
  { line: "Line 2", a: 97, p: 95, q: 99 },
  { line: "Line 3", a: 61, p: 72, q: 96 },
  { line: "Line 4", a: 88, p: 87, q: 99 },
  { line: "Line 5", a: 99, p: 91, q: 97 },
];

const BC_SP = [
  { ten: "Mực", pct: 35, mau: "#17529c" },
  { ten: "Bạch tuộc", pct: 25, mau: "#0ea5e9" },
  { ten: "Cá ngừ", pct: 20, mau: "#10b981" },
  { ten: "Tôm", pct: 15, mau: "#b45309" },
  { ten: "Khác", pct: 5, mau: "#94a3b8" },
];

const BC_TT = [
  { ten: "Nhật Bản", usd: 1.82 },
  { ten: "Hàn Quốc", usd: 1.24 },
  { ten: "EU", usd: 0.86 },
  { ten: "Mỹ", usd: 0.61 },
  { ten: "Trung Đông", usd: 0.19 },
  { ten: "Nội địa", usd: 0.08 },
];

interface DongCa {
  id: string;
  ngay: string;
  ca: string;
  line: string;
  sp: string;
  kh: number;
  tt: number;
  qc: number;
  oee: number;
  ghi: string;
  gio: { g: string; kg: number }[];
}

const BC_DONG: DongCa[] = [
  { id: "d1", ngay: "10/08", ca: "A", line: "Line 1", sp: "Mực ống đông IQF 1 kg", kh: 5000, tt: 4820, qc: 98.2, oee: 82, ghi: "—", gio: [{ g: "06–10", kg: 1480 }, { g: "10–14", kg: 1720 }, { g: "14–18", kg: 1620 }] },
  { id: "d2", ngay: "10/08", ca: "B", line: "Line 2", sp: "Bạch tuộc hấp nguyên con", kh: 3000, tt: 3040, qc: 99.1, oee: 91, ghi: "Vượt kế hoạch 40 kg", gio: [{ g: "14–18", kg: 1020 }, { g: "18–22", kg: 1180 }, { g: "22–02", kg: 840 }] },
  { id: "d3", ngay: "09/08", ca: "A", line: "Line 3", sp: "Cá ngừ loin đông −60 °C", kh: 4000, tt: 2680, qc: 96.4, oee: 61, ghi: "Dừng 45 phút chờ nguyên liệu", gio: [{ g: "06–10", kg: 940 }, { g: "10–14", kg: 760 }, { g: "14–18", kg: 980 }] },
  { id: "d4", ngay: "09/08", ca: "B", line: "Line 4", sp: "Tôm sú vỏ đông block", kh: 2500, tt: 2460, qc: 97.8, oee: 76, ghi: "—", gio: [{ g: "14–18", kg: 860 }, { g: "18–22", kg: 900 }, { g: "22–02", kg: 700 }] },
  { id: "d5", ngay: "08/08", ca: "A", line: "Line 1", sp: "Mực nang fillet 500 g", kh: 4500, tt: 4510, qc: 98.9, oee: 88, ghi: "—", gio: [{ g: "06–10", kg: 1520 }, { g: "10–14", kg: 1580 }, { g: "14–18", kg: 1410 }] },
];

const so = (n: number) => n.toLocaleString("vi-VN");
const phay = (n: number) => String(n).replace(".", ",");

function BcKpi({ k }: { k: KpiThang }) {
  const Icon = k.icon;
  return (
    <div
      className={cn(
        "grid min-h-[148px] gap-2.5 rounded-xl border-l-4 bg-card p-5 ring-1 ring-foreground/10",
        k.vien
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{k.nhan}</span>
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      </span>
      <span className="flex items-end gap-2">
        <span className="font-mono text-3xl font-bold leading-none tnum">
          {k.giaTri}
        </span>
        {k.donVi && (
          <span className="pb-1 text-base text-muted-foreground">{k.donVi}</span>
        )}
      </span>
      <span
        className={cn(
          "flex items-center gap-1.5 text-sm font-semibold",
          k.tot ? "text-success" : "text-destructive"
        )}
      >
        <span aria-hidden>{k.tang ? "↑" : "↓"}</span>
        {k.delta}
        <span className="font-normal text-muted-foreground">so tháng trước</span>
      </span>
    </div>
  );
}

function KhoiBieuDo({
  tieuDe,
  moTa,
  children,
}: {
  tieuDe: string;
  moTa?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 content-start gap-4 rounded-xl border-2 border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{tieuDe}</h2>
        {moTa && <p className="mt-1 text-sm text-muted-foreground">{moTa}</p>}
      </div>
      {children}
    </section>
  );
}

const OEE_YEUTO: [string, "a" | "p" | "q", string][] = [
  ["Sẵn sàng", "a", "bg-primary"],
  ["Hiệu suất", "p", "bg-status-changeover-ink"],
  ["Chất lượng", "q", "bg-success"],
];

export default function ManBaoCao() {
  const [tu, setTu] = useState("2026-08-01");
  const [den, setDen] = useState("2026-08-10");
  const [xn, setXn] = useState("bsf1");
  const [line, setLine] = useState("tat-ca");
  const [mo, setMo] = useState<string[]>([]);

  const toggle = (id: string) =>
    setMo((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const maxNgay = Math.max(...BC_NGAY);
  const tongKH = BC_DONG.reduce((s, r) => s + r.kh, 0);
  const tongTT = BC_DONG.reduce((s, r) => s + r.tt, 0);
  const tbQC = phay(
    Number((BC_DONG.reduce((s, r) => s + r.qc, 0) / BC_DONG.length).toFixed(1))
  );
  const tbOEE = Math.round(BC_DONG.reduce((s, r) => s + r.oee, 0) / BC_DONG.length);
  const maxUsd = Math.max(...BC_TT.map((t) => t.usd));

  // Donut bằng conic-gradient — không cần thư viện.
  let acc = 0;
  const donut = BC_SP.map((s) => {
    const a = acc;
    acc += s.pct;
    return `${s.mau} ${a}% ${acc}%`;
  }).join(", ");

  return (
    <div className="grid gap-6">
      <DuLieuMau ghiChu="Tổng hợp từ dữ liệu mẫu." />

      {/* Bộ lọc */}
      <section className="grid gap-4 rounded-xl border-2 border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DateField label="Từ ngày" anNhanBatBuoc value={tu} onChange={setTu} />
          <DateField label="Đến ngày" anNhanBatBuoc value={den} onChange={setDen} />
          <Combobox
            label="Xí nghiệp"
            anNhanBatBuoc
            choPhepXoa={false}
            value={xn}
            onChange={setXn}
            options={[
              { value: "bsf1", label: "Baseafood 1 — Bà Rịa" },
              { value: "xn3", label: "XN3 Lộc An" },
              { value: "xn4", label: "XN4 Lộc An" },
            ]}
          />
          <Combobox
            label="Dây chuyền"
            anNhanBatBuoc
            choPhepXoa={false}
            value={line}
            onChange={setLine}
            options={[
              { value: "tat-ca", label: "Tất cả dây chuyền" },
              ...["Line 1", "Line 2", "Line 3", "Line 4", "Line 5"].map((l) => ({
                value: l,
                label: l,
              })),
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            size="lg"
            onClick={() =>
              notify.daLuu("Đã tạo lại báo cáo · Kỳ 01/08 – 10/08/2026 · Baseafood 1 Bà Rịa")
            }
          >
            <BarChart3 className="size-5" aria-hidden />
            Tạo báo cáo
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              notify.daLuu("Đang xuất PDF · Báo cáo tháng 08/2026 — 4 biểu đồ + bảng chi tiết")
            }
          >
            <FileText className="size-5" aria-hidden />
            Xuất PDF
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              notify.daLuu("Đang xuất Excel · gồm cả breakdown theo giờ của từng ca")
            }
          >
            <FileSpreadsheet className="size-5" aria-hidden />
            Xuất Excel
          </Button>
        </div>
      </section>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {BC_KPI.map((k) => (
          <BcKpi key={k.nhan} k={k} />
        ))}
      </div>

      {/* Biểu đồ 2×2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <KhoiBieuDo tieuDe="Sản lượng theo ngày" moTa="30 ngày gần nhất · đơn vị tấn">
          <div className="scroll-nice w-full overflow-x-auto">
            <div className="flex h-52 min-w-[560px] items-end gap-1.5">
              {BC_NGAY.map((v, i) => (
                <span
                  key={i}
                  title={`Ngày ${i + 1}: ${phay(v)} tấn`}
                  className="flex h-full min-w-3 flex-1 flex-col items-center justify-end gap-1"
                >
                  <span
                    className={cn(
                      "w-full shrink-0 rounded-t",
                      v < 7 ? "bg-primary/40" : "bg-primary"
                    )}
                    style={{ height: Math.max(4, Math.round((v / maxNgay) * 160)) }}
                  />
                  {(i + 1) % 5 === 0 && (
                    <span className="text-xs text-muted-foreground">{i + 1}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </KhoiBieuDo>

        <KhoiBieuDo
          tieuDe="OEE tách yếu tố"
          moTa="Sẵn sàng · Hiệu suất · Chất lượng theo dây chuyền"
        >
          <div className="grid gap-3.5">
            {BC_OEE.map((o) => {
              const oee = Math.round((o.a * o.p * o.q) / 10000);
              return (
                <div key={o.line} className="grid gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{o.line}</span>
                    <span className="font-mono font-bold">OEE {oee}%</span>
                  </div>
                  <div className="flex h-6 gap-1">
                    {OEE_YEUTO.map(([n, key, bg]) => (
                      <span
                        key={n}
                        title={`${n}: ${o[key]}%`}
                        className={cn(
                          "flex items-center justify-center rounded font-mono text-sm font-bold text-white",
                          bg
                        )}
                        style={{ flex: o[key] }}
                      >
                        {o[key]}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-3.5 text-sm text-muted-foreground">
              {OEE_YEUTO.map(([n, , bg]) => (
                <span key={n} className="flex items-center gap-1.5">
                  <span aria-hidden className={cn("size-3.5 rounded-sm", bg)} />
                  {n}
                </span>
              ))}
            </div>
          </div>
        </KhoiBieuDo>

        <KhoiBieuDo
          tieuDe="Sản lượng theo nhóm sản phẩm"
          moTa="Tỷ trọng trên tổng 285.000 kg"
        >
          <div className="flex flex-wrap items-center gap-6">
            <span
              aria-hidden
              className="relative inline-flex size-44 shrink-0 rounded-full"
              style={{ background: `conic-gradient(${donut})` }}
            >
              <span className="absolute inset-11 flex flex-col items-center justify-center rounded-full bg-card">
                <span className="font-mono text-lg font-bold">285k</span>
                <span className="text-xs text-muted-foreground">kg</span>
              </span>
            </span>
            <ul className="grid min-w-40 flex-1 list-none gap-2.5 p-0">
              {BC_SP.map((s) => (
                <li key={s.ten} className="flex items-center gap-2.5 text-base">
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded"
                    style={{ background: s.mau }}
                  />
                  <span className="flex-1">{s.ten}</span>
                  <span className="font-mono font-bold">{s.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        </KhoiBieuDo>

        <KhoiBieuDo
          tieuDe="Kim ngạch theo thị trường"
          moTa="Triệu USD, kỳ 01/08 – 10/08"
        >
          <div className="grid gap-2.5">
            {BC_TT.map((t) => {
              const pct = (t.usd / maxUsd) * 100;
              const chuTren = pct > 82;
              return (
                <div key={t.ten} className="flex items-center gap-3">
                  <span className="w-[108px] shrink-0 text-sm font-medium">
                    {t.ten}
                  </span>
                  <span className="relative h-8 flex-1 rounded-lg bg-muted">
                    <span
                      className="absolute inset-y-0 left-0 rounded-lg bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                    <span
                      className={cn(
                        "absolute inset-y-0 right-2 flex items-center font-mono text-sm font-bold",
                        chuTren ? "text-primary-foreground" : "text-foreground"
                      )}
                    >
                      {t.usd.toFixed(2).replace(".", ",")}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </KhoiBieuDo>
      </div>

      {/* Bảng chi tiết */}
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Chi tiết theo ca</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bấm mũi tên đầu dòng để xem sản lượng theo khung giờ.
          </p>
        </div>
        <div className="scroll-nice w-full max-w-full overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[1180px] border-collapse text-base">
            <thead>
              <tr>
                <th className="h-14 w-14 border-b border-border bg-muted" />
                {["Ngày", "Ca", "Dây chuyền", "Sản phẩm"].map((h) => (
                  <BcTh key={h}>{h}</BcTh>
                ))}
                {["SL kế hoạch", "SL thực tế", "Đạt QC", "OEE"].map((h) => (
                  <BcTh key={h} right>
                    {h}
                  </BcTh>
                ))}
                <BcTh>Ghi chú</BcTh>
              </tr>
            </thead>
            <tbody>
              {BC_DONG.map((r, i) => {
                const open = mo.includes(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr
                      className={cn(
                        "border-b border-border",
                        open ? "bg-accent" : i % 2 === 1 ? "bg-muted/40" : "bg-background"
                      )}
                    >
                      <td className="h-14 px-4 text-center">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={`${open ? "Thu" : "Mở"} chi tiết ca ${r.ca} ngày ${r.ngay}`}
                          onClick={() => toggle(r.id)}
                          className="inline-flex size-11 items-center justify-center rounded-lg border-2 border-border bg-background transition-colors hover:bg-muted"
                        >
                          {open ? (
                            <ChevronDown className="size-5" aria-hidden />
                          ) : (
                            <ChevronRight className="size-5" aria-hidden />
                          )}
                        </button>
                      </td>
                      <td className="h-14 whitespace-nowrap px-4 font-mono">{r.ngay}</td>
                      <td className="h-14 whitespace-nowrap px-4">
                        <Badge variant="secondary">Ca {r.ca}</Badge>
                      </td>
                      <td className="h-14 whitespace-nowrap px-4">{r.line}</td>
                      <td className="h-14 whitespace-nowrap px-4 font-medium">{r.sp}</td>
                      <td className="h-14 whitespace-nowrap px-4 text-right font-mono tnum">
                        {so(r.kh)}
                      </td>
                      <td
                        className={cn(
                          "h-14 whitespace-nowrap px-4 text-right font-mono font-bold tnum",
                          r.tt >= r.kh
                            ? "text-success"
                            : r.tt / r.kh < 0.8
                              ? "text-destructive"
                              : "text-foreground"
                        )}
                      >
                        {so(r.tt)}
                      </td>
                      <td className="h-14 whitespace-nowrap px-4 text-right font-mono tnum">
                        {phay(r.qc)}%
                      </td>
                      <td
                        className={cn(
                          "h-14 whitespace-nowrap px-4 text-right font-mono tnum",
                          r.oee < 70 ? "text-destructive" : "text-foreground"
                        )}
                      >
                        {r.oee}%
                      </td>
                      <td
                        className={cn(
                          "h-14 px-4",
                          r.ghi === "—" ? "text-muted-foreground" : "text-foreground"
                        )}
                      >
                        {r.ghi}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-border bg-accent/45">
                        <td />
                        <td colSpan={9} className="px-4 pb-5 pt-4">
                          <p className="mb-2.5 text-base font-semibold">
                            Sản lượng theo khung giờ
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {r.gio.map((g) => (
                              <div
                                key={g.g}
                                className="min-w-[148px] rounded-lg border-2 border-border bg-background px-4 py-3"
                              >
                                <p className="text-sm text-muted-foreground">
                                  {g.g} giờ
                                </p>
                                <p className="mt-0.5 font-mono text-xl font-bold">
                                  {so(g.kg)} kg
                                </p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/60 font-bold">
                <td className="h-14 px-4" />
                <td className="h-14 px-4" colSpan={4}>
                  Tổng cộng · {BC_DONG.length} ca
                </td>
                <td className="h-14 px-4 text-right font-mono tnum">{so(tongKH)}</td>
                <td className="h-14 px-4 text-right font-mono tnum">{so(tongTT)}</td>
                <td className="h-14 px-4 text-right font-mono tnum">{tbQC}%</td>
                <td className="h-14 px-4 text-right font-mono tnum">{tbOEE}%</td>
                <td className="h-14 px-4" />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function BcTh({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "h-14 whitespace-nowrap border-b border-border bg-muted px-4 font-semibold",
        right ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  );
}
