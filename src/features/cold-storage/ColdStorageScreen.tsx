// ============================================================
// Tên file cũ: src/features/cold-storage/ManKhoLanh.tsx
// Tên tiếng Việt: Màn hình Giám sát Hệ thống Kho lạnh MES
// Description: Cold Storage System Monitoring Screen
// ============================================================
// src/features/cold-storage/ManKhoLanh.tsx
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  DuLieuMau,
  EmptyState,
  Field,
  FormDialog,
  NutDong,
  Separator,
  Textarea,
  notify,
} from "@/design-system";
import { cn } from "@/lib/utils";
import {
  Check,
  CircleAlert,
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock,
  Snowflake,
  Thermometer,
  TriangleAlert,
} from "lucide-react";

/**
 * ManKhoLanh — quản lý kho lạnh: sơ đồ 6 kho (nhiệt độ · mức sử dụng) · biểu đồ
 * nhiệt 24 giờ vẽ SVG thuần · bảng tồn kho theo FIFO · lịch sử cảnh báo nhiệt độ.
 *
 * Màn TRƯNG BÀY (dữ liệu mẫu). Mọi chấm màu đều kèm nhãn chữ; không thêm thư viện
 * chart (luật repo). Màu đường theo kho là bảng series riêng (không phải token).
 */

interface Kho {
  id: string;
  ten: string;
  loai: string;
  nhiet: number;
  nguong: number;
  dung: number;
  suc: number;
}

interface TonKho {
  kho: string;
  lo: string;
  sp: string;
  kg: number;
  nhap: string;
  het: string;
  fifo: number;
}

type MucCB = "nghiem" | "canh";

interface CanhBaoKho {
  id: string;
  muc: MucCB;
  gio: string;
  kho: string;
  chu: string;
  them: string;
}

const KL_KHO: Kho[] = [
  { id: "C1", ten: "Kho NL C1", loai: "Nguyên liệu", nhiet: -19.4, nguong: -18, dung: 62, suc: 40000 },
  { id: "C2", ten: "Kho NL C2", loai: "Nguyên liệu", nhiet: -18.6, nguong: -18, dung: 78, suc: 40000 },
  { id: "C3", ten: "Kho SP C3", loai: "Thành phẩm", nhiet: -17.0, nguong: -20, dung: 94, suc: 60000 },
  { id: "C4", ten: "Kho SP C4", loai: "Thành phẩm", nhiet: -21.3, nguong: -20, dung: 55, suc: 60000 },
  { id: "C5", ten: "Kho XK C5", loai: "Chờ xuất", nhiet: -24.8, nguong: -25, dung: 71, suc: 30000 },
  { id: "C6", ten: "Kho XK C6", loai: "Chờ xuất", nhiet: -25.6, nguong: -25, dung: 38, suc: 30000 },
];

/** Bảng màu series cho biểu đồ (mỗi kho một màu để phân đường) — không phải token. */
const KL_MAU_KHO: Record<string, string> = {
  C1: "#0ea5e9",
  C2: "#6366f1",
  C3: "#ef4444",
  C4: "#10b981",
  C5: "#f59e0b",
  C6: "#8b5cf6",
};

const KL_GIO = ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"];
const KL_CHUOI: Record<string, number[]> = {
  C1: [-19.6, -19.5, -19.4, -19.2, -19.5, -19.7, -19.4, -19.3, -19.5, -19.6, -19.4, -19.4],
  C2: [-18.8, -18.7, -18.9, -18.5, -18.4, -18.6, -18.8, -18.7, -18.5, -18.6, -18.7, -18.6],
  C3: [-20.4, -20.6, -20.3, -20.5, -20.2, -19.8, -19.1, -17.8, -17.0, -17.2, -17.1, -17.0],
  C4: [-21.5, -21.4, -21.6, -21.2, -21.3, -21.5, -21.4, -21.1, -21.3, -21.4, -21.2, -21.3],
  C5: [-25.1, -25.0, -24.9, -24.7, -24.8, -25.0, -24.9, -24.6, -24.7, -24.8, -24.9, -24.8],
  C6: [-25.8, -25.7, -25.6, -25.5, -25.6, -25.7, -25.8, -25.4, -25.5, -25.6, -25.7, -25.6],
};

const KL_TON: TonKho[] = [
  { kho: "C3", lo: "MQ-240729-006", sp: "Mực ống đông IQF 1 kg", kg: 1840, nhap: "29/07/2026", het: "08/08/2026", fifo: 1 },
  { kho: "C3", lo: "MQ-240809-011", sp: "Mực nang làm sạch đông block", kg: 2260, nhap: "09/08/2026", het: "14/08/2026", fifo: 2 },
  { kho: "C1", lo: "NL-240806-002", sp: "Mực ống tươi size 15–20", kg: 3120, nhap: "06/08/2026", het: "16/08/2026", fifo: 3 },
  { kho: "C4", lo: "BT-240805-009", sp: "Bạch tuộc hấp nguyên con", kg: 2980, nhap: "05/08/2026", het: "22/08/2026", fifo: 4 },
  { kho: "C5", lo: "CN-240804-003", sp: "Cá ngừ loin đông −60 °C", kg: 4150, nhap: "04/08/2026", het: "04/09/2026", fifo: 5 },
  { kho: "C2", lo: "NL-240803-014", sp: "Tôm sú vỏ nguyên liệu", kg: 1620, nhap: "03/08/2026", het: "12/09/2026", fifo: 6 },
  { kho: "C6", lo: "GX-240802-007", sp: "Ghẹ xanh hấp cấp đông", kg: 890, nhap: "02/08/2026", het: "02/10/2026", fifo: 7 },
];

const KL_CANH_BAO: CanhBaoKho[] = [
  { id: "w1", muc: "nghiem", gio: "10/08 14:32", kho: "C3", chu: "Nhiệt độ vượt ngưỡng: −17,0 °C (giới hạn −20 °C)", them: "Dàn lạnh số 2 chạy quá tải 40 phút. Lô MQ-240809-011 chờ giao 10/08 đang nằm trong kho — đã báo KCS đánh giá lại." },
  { id: "w2", muc: "canh", gio: "10/08 11:05", kho: "C5", chu: "Nhiệt độ chạm ngưỡng: −24,6 °C (giới hạn −25 °C)", them: "Cửa kho mở 6 phút khi xuất hàng cho container. Nhiệt độ về ngưỡng sau 12 phút." },
  { id: "w3", muc: "nghiem", gio: "09/08 22:14", kho: "C3", chu: "Mất tín hiệu cảm biến 18 phút", them: "Đầu đo T-C3-02 mất kết nối. Kỹ thuật đã thay cáp lúc 22:32, dữ liệu khoảng trống được ghi thủ công." },
  { id: "w4", muc: "canh", gio: "09/08 15:40", kho: "C2", chu: "Mức sử dụng vượt 90% trong 3 giờ", them: "Đã điều 4 pallet mực nguyên liệu sang kho C1 để giảm tải." },
  { id: "w5", muc: "canh", gio: "08/08 07:20", kho: "C4", chu: "Chênh lệch nhiệt giữa hai đầu đo 1,8 °C", them: "Quạt đối lưu góc đông-bắc yếu. Đã vệ sinh lưới gió, chênh lệch còn 0,4 °C." },
];

const KL_MUC: Record<
  MucCB,
  { nhan: string; icon: typeof TriangleAlert; chu: string; vien: string; nen: string }
> = {
  nghiem: { nhan: "Nghiêm trọng", icon: TriangleAlert, chu: "text-destructive", vien: "border-l-destructive", nen: "bg-destructive/10" },
  canh: { nhan: "Cảnh báo", icon: CircleAlert, chu: "text-warning", vien: "border-l-warning", nen: "bg-warning-surface" },
};

const HOM_NAY_KL = new Date(2026, 7, 10);
const so = (n: number) => n.toLocaleString("vi-VN");
const doC = (n: number) => `${n.toFixed(1).replace(".", ",")} °C`;

function klNgayConLai(het: string): number {
  const [d, m, y] = het.split("/").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - HOM_NAY_KL.getTime()) / 86400000);
}

function mucDung(p: number): { bg: string; text: string } {
  if (p > 90) return { bg: "bg-destructive", text: "text-destructive" };
  if (p >= 70) return { bg: "bg-warning", text: "text-warning" };
  return { bg: "bg-success", text: "text-success" };
}

function OKho({ k, onClick }: { k: Kho; onClick: () => void }) {
  const loi = k.nhiet > k.nguong;
  const md = mucDung(k.dung);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid min-h-[176px] gap-3 rounded-xl border-2 p-[18px] text-left transition-colors",
        loi ? "border-destructive bg-destructive/5" : "border-border bg-card hover:bg-muted/40"
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-base font-semibold">{k.ten}</span>
          <span className="block text-xs text-muted-foreground">
            {k.loai} · sức chứa {so(k.suc)} kg
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "mt-1.5 size-3.5 shrink-0 rounded-full",
            loi ? "bg-destructive" : "bg-success"
          )}
        />
      </span>
      <span
        className={cn(
          "font-mono text-3xl font-bold leading-none tnum",
          loi ? "text-destructive" : "text-foreground"
        )}
      >
        {doC(k.nhiet)}
      </span>
      <span
        className={cn(
          "flex items-center gap-2 text-xs font-semibold",
          loi ? "text-destructive" : "text-success"
        )}
      >
        {loi ? (
          <TriangleAlert className="size-4" aria-hidden />
        ) : (
          <CircleCheck className="size-4" aria-hidden />
        )}
        {loi ? `Vượt ngưỡng ${k.nguong} °C` : `Bình thường (≤ ${k.nguong} °C)`}
      </span>
      <span className="grid gap-1">
        <span className="flex justify-between text-xs text-muted-foreground">
          <span>Mức sử dụng</span>
          <span className={cn("font-mono font-bold", md.text)}>{k.dung}%</span>
        </span>
        <span className="block h-2.5 overflow-hidden rounded-full bg-secondary">
          <span
            className={cn("block h-full rounded-full", md.bg)}
            style={{ width: `${k.dung}%` }}
          />
        </span>
      </span>
    </button>
  );
}

function BieuDoNhiet({ hien }: { hien: string[] }) {
  const W = 900;
  const H = 320;
  const pad = { t: 16, r: 16, b: 40, l: 62 };
  const yMin = -28;
  const yMax = -14;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (KL_GIO.length - 1);
  const y = (v: number) => pad.t + ((yMax - v) / (yMax - yMin)) * (H - pad.t - pad.b);

  return (
    <div className="scroll-nice w-full max-w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="block min-w-[680px]"
        role="img"
        aria-label="Nhiệt độ 6 kho lạnh trong 24 giờ"
      >
        <rect
          x={pad.l}
          y={y(yMax)}
          width={W - pad.l - pad.r}
          height={y(-18) - y(yMax)}
          fill="color-mix(in srgb, var(--destructive) 9%, transparent)"
        />
        <rect
          x={pad.l}
          y={y(-18)}
          width={W - pad.l - pad.r}
          height={y(-25) - y(-18)}
          fill="color-mix(in srgb, var(--success) 9%, transparent)"
        />
        {[-14, -18, -22, -25, -28].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
            <text x={pad.l - 10} y={y(v) + 5} textAnchor="end" fontFamily="var(--font-mono)" fontSize="13" fill="var(--muted-foreground)">
              {v} °C
            </text>
          </g>
        ))}
        {KL_KHO.filter((k) => hien.includes(k.id)).map((k) => {
          const d = KL_CHUOI[k.id];
          const path = d
            .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
            .join(" ");
          return (
            <g key={k.id}>
              <path d={path} fill="none" stroke={KL_MAU_KHO[k.id]} strokeWidth="3" strokeLinejoin="round" />
              {d.map((v, i) =>
                v > k.nguong ? (
                  <circle key={i} cx={x(i)} cy={y(v)} r="5.5" fill="var(--destructive)" stroke="#fff" strokeWidth="2" />
                ) : null
              )}
            </g>
          );
        })}
        {KL_GIO.map((g, i) => (
          <text key={g} x={x(i)} y={H - 14} textAnchor="middle" fontFamily="var(--font-sans)" fontSize="13" fill="var(--muted-foreground)">
            {g}:00
          </text>
        ))}
      </svg>
    </div>
  );
}

const CB_LOC: [string, string][] = [
  ["tat-ca", "Tất cả"],
  ["nghiem", "Nghiêm trọng"],
  ["canh", "Cảnh báo"],
  ["da-xu-ly", "Đã xử lý"],
];

export default function ManKhoLanh() {
  const [hien, setHien] = useState<string[]>(KL_KHO.map((k) => k.id));
  const [kho, setKho] = useState<Kho | null>(null);
  const [canhBao, setCanhBao] = useState<CanhBaoKho | null>(null);
  const [locCB, setLocCB] = useState("tat-ca");
  const [daXuLy, setDaXuLy] = useState<string[]>(["w2", "w3", "w4", "w5"]);

  const ton = useMemo(
    () => [...KL_TON].sort((a, b) => klNgayConLai(a.het) - klNgayConLai(b.het)),
    []
  );
  const cb = KL_CANH_BAO.filter((w) => {
    if (locCB === "tat-ca") return true;
    if (locCB === "da-xu-ly") return daXuLy.includes(w.id);
    return w.muc === locCB && !daXuLy.includes(w.id);
  });
  const soLoi = KL_KHO.filter((k) => k.nhiet > k.nguong).length;

  return (
    <div className="grid gap-6">
      <DuLieuMau ghiChu="Cảm biến nhiệt / tồn kho chưa nối." />

      {soLoi > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-destructive bg-destructive/5 px-5 py-3.5">
          <span className="flex items-center gap-3 text-base font-semibold text-destructive">
            <TriangleAlert className="size-6" aria-hidden />
            {soLoi} kho đang vượt ngưỡng nhiệt — cần xử lý trong ca
          </span>
          <Button variant="destructive" onClick={() => setCanhBao(KL_CANH_BAO[0])}>
            Xem cảnh báo
          </Button>
        </div>
      )}

      {/* Sơ đồ kho */}
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Sơ đồ kho lạnh</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Chọn một kho để xem tồn và lịch sử nhiệt độ của kho đó.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {KL_KHO.map((k) => (
            <OKho key={k.id} k={k} onClick={() => setKho(k)} />
          ))}
        </div>
      </section>

      {/* Biểu đồ nhiệt */}
      <section className="grid gap-4 rounded-xl border-2 border-border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Nhiệt độ 24 giờ</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dải xanh là vùng an toàn, dải đỏ là vùng nguy hiểm; chấm đỏ là điểm vượt
            ngưỡng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {KL_KHO.map((k) => {
            const on = hien.includes(k.id);
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setHien((hs) =>
                    on ? hs.filter((x) => x !== k.id) : [...hs, k.id]
                  )
                }
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-lg border-2 px-3.5 text-sm font-semibold transition-colors",
                  on ? "bg-background" : "bg-muted opacity-60"
                )}
                style={{ borderColor: on ? KL_MAU_KHO[k.id] : "var(--border)" }}
              >
                <span
                  aria-hidden
                  className="h-1 w-[18px] rounded"
                  style={{ background: KL_MAU_KHO[k.id] }}
                />
                {k.ten}
              </button>
            );
          })}
        </div>
        <BieuDoNhiet hien={hien} />
      </section>

      {/* Tồn kho */}
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Tồn kho theo lô</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Xếp theo hạn dùng gần nhất · cột FIFO là thứ tự phải xuất
          </p>
        </div>
        <div className="scroll-nice w-full max-w-full overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[1060px] border-collapse text-base">
            <thead>
              <tr>
                {["Kho", "Mã lô", "Sản phẩm", "SL (kg)", "Ngày nhập", "Hạn dùng", "FIFO"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={cn(
                        "h-14 whitespace-nowrap border-b border-border bg-muted px-4 font-semibold",
                        i === 3 || i === 6 ? "text-right" : "text-left"
                      )}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {ton.map((r, i) => {
                const con = klNgayConLai(r.het);
                const qua = con < 0;
                const sap = con >= 0 && con <= 7;
                const nen = qua
                  ? "bg-destructive/10 font-semibold"
                  : sap
                    ? "bg-warning-surface"
                    : i % 2 === 1
                      ? "bg-muted/40"
                      : "bg-background";
                return (
                  <tr key={r.lo} className={cn("border-b border-border", nen)}>
                    <td className="h-14 whitespace-nowrap px-4">
                      <Badge variant="secondary">{r.kho}</Badge>
                    </td>
                    <td className="h-14 whitespace-nowrap px-4 font-mono font-semibold">
                      {r.lo}
                    </td>
                    <td className="h-14 whitespace-nowrap px-4">{r.sp}</td>
                    <td className="h-14 whitespace-nowrap px-4 text-right font-mono tnum">
                      {so(r.kg)}
                    </td>
                    <td className="h-14 whitespace-nowrap px-4 font-mono text-muted-foreground">
                      {r.nhap}
                    </td>
                    <td className="h-14 whitespace-nowrap px-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 font-mono",
                          qua
                            ? "font-bold text-destructive"
                            : sap
                              ? "font-bold text-warning"
                              : "text-foreground"
                        )}
                      >
                        {(qua || sap) &&
                          (qua ? (
                            <CircleX className="size-5" aria-hidden />
                          ) : (
                            <Clock className="size-5" aria-hidden />
                          ))}
                        {r.het}
                        <span className="font-sans text-sm font-semibold">
                          {qua ? `· quá ${-con} ngày` : sap ? `· còn ${con} ngày` : ""}
                        </span>
                      </span>
                    </td>
                    <td className="h-14 whitespace-nowrap px-4 text-right">
                      <span
                        className={cn(
                          "inline-flex size-9 items-center justify-center rounded-full font-mono text-sm font-bold",
                          r.fifo === 1
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        )}
                      >
                        {r.fifo}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Lịch sử cảnh báo */}
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Lịch sử cảnh báo nhiệt độ
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Chọn một dòng để xem chi tiết và đánh dấu đã xử lý.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CB_LOC.map(([v, l]) => {
            const on = locCB === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => setLocCB(v)}
                className={cn(
                  "min-h-11 rounded-lg border-2 px-4 text-base font-semibold transition-colors",
                  on
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted"
                )}
              >
                {l}
              </button>
            );
          })}
        </div>
        {cb.length === 0 ? (
          <EmptyState
            icon={Thermometer}
            tieuDe="Không có cảnh báo nào trong nhóm này"
            moTa="Đổi bộ lọc phía trên để xem các cảnh báo khác."
          />
        ) : (
          <ul className="grid list-none gap-2.5 p-0">
            {cb.map((w) => {
              const m = KL_MUC[w.muc];
              const Icon = m.icon;
              const xong = daXuLy.includes(w.id);
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => setCanhBao(w)}
                    className={cn(
                      "flex min-h-[68px] w-full items-start gap-3.5 rounded-xl border-2 border-l-4 border-border p-4 text-left transition-colors hover:bg-muted",
                      m.vien,
                      xong ? "bg-muted" : m.nen
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full bg-background",
                        m.chu
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono font-semibold">{w.gio}</span>
                        <span>
                          · Kho {w.kho} · {m.nhan}
                        </span>
                        {xong && (
                          <span className="font-semibold text-success">
                            · đã xử lý
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-base font-medium leading-snug">
                        {w.chu}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Dialog kho */}
      {kho && (
        <FormDialog
          open
          onOpenChange={() => setKho(null)}
          rong="rong"
          icon={Snowflake}
          tieuDe={kho.ten}
          moTa={`${kho.loai} · ngưỡng ≤ ${kho.nguong} °C · sức chứa ${so(kho.suc)} kg`}
          chan={
            <>
              <NutDong>Đóng</NutDong>
              <Button
                size="lg"
                onClick={() => {
                  const k = kho;
                  setKho(null);
                  notify.daLuu(`Đang mở nhật ký kho · ${k.ten} — 24 giờ gần nhất`);
                }}
              >
                <ClipboardList className="size-5" aria-hidden />
                Mở nhật ký kho
              </Button>
            </>
          }
        >
          <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["Nhiệt độ hiện tại", doC(kho.nhiet), kho.nhiet > kho.nguong],
                  ["Mức sử dụng", `${kho.dung}%`, kho.dung > 90],
                  ["Tồn ước tính", `${so(Math.round((kho.suc * kho.dung) / 100))} kg`, false],
                ] as const
              ).map(([k, v, xau]) => (
                <div
                  key={k}
                  className={cn(
                    "rounded-lg px-4 py-3.5",
                    xau ? "bg-destructive/10" : "bg-muted"
                  )}
                >
                  <p className="text-sm text-muted-foreground">{k}</p>
                  <p
                    className={cn(
                      "mt-0.5 font-mono text-xl font-bold",
                      xau ? "text-destructive" : "text-foreground"
                    )}
                  >
                    {v}
                  </p>
                </div>
              ))}
            </div>
            <Separator />
            <div>
              <p className="mb-2.5 text-base font-semibold">Lô đang nằm trong kho</p>
              <ul className="grid list-none gap-2 p-0">
                {KL_TON.filter((t) => t.kho === kho.id).map((t) => (
                  <li
                    key={t.lo}
                    className="flex flex-wrap justify-between gap-3 border-b border-border pb-2 text-base"
                  >
                    <span>
                      <span className="font-mono font-semibold">{t.lo}</span> — {t.sp}
                    </span>
                    <span className="font-mono font-semibold">
                      {so(t.kg)} kg · HD {t.het}
                    </span>
                  </li>
                ))}
                {KL_TON.filter((t) => t.kho === kho.id).length === 0 && (
                  <li className="text-base text-muted-foreground">Kho đang trống.</li>
                )}
              </ul>
            </div>
          </div>
        </FormDialog>
      )}

      {/* Dialog cảnh báo */}
      {canhBao && (
        <FormDialog
          open
          onOpenChange={() => setCanhBao(null)}
          rong="vua"
          icon={KL_MUC[canhBao.muc].icon}
          tieuDe={canhBao.chu}
          moTa={`${KL_MUC[canhBao.muc].nhan} · ${canhBao.gio} · Kho ${canhBao.kho}`}
          chan={
            <>
              <NutDong>Đóng</NutDong>
              {daXuLy.includes(canhBao.id) ? (
                <Button size="lg" disabled>
                  Đã xử lý
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => {
                    const w = canhBao;
                    setDaXuLy((d) => [...d, w.id]);
                    setCanhBao(null);
                    notify.daLuu(`Đã đánh dấu xử lý · ${w.gio} — kho ${w.kho}`);
                  }}
                >
                  <Check className="size-5" aria-hidden />
                  Đánh dấu đã xử lý
                </Button>
              )}
            </>
          }
        >
          <div className="grid gap-4">
            <p className="text-base leading-normal">{canhBao.them}</p>
            <Field label="Ghi chú xử lý" hint="Ghi ai làm gì, lúc mấy giờ.">
              <Textarea
                rows={2}
                placeholder="VD: 14:40 gọi kỹ thuật kiểm dàn lạnh số 2, chuyển lô sang kho C1."
              />
            </Field>
          </div>
        </FormDialog>
      )}
    </div>
  );
}
