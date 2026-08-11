// ============================================================
// Tên file cũ: src/features/dashboard/ManTongQuan.tsx
// Tên tiếng Việt: Màn hình Tổng quan Dashboard chỉ số MES
// Description: Main Operational Dashboard Screen
// ============================================================
// src/features/dashboard/ManTongQuan.tsx
import { useState, type ReactNode } from "react";
import {
  Badge,
  BangTong,
  Button,
  DuLieuMau,
  FormDialog,
  NutDong,
  StatusChip,
  ThongKe,
  notify,
  type CotTong,
  type TheThongTin,
} from "@/design-system";
import {
  BarChart3,
  CalendarDays,
  Check,
  ClipboardList,
  Factory,
  Gauge,
  Package,
  Scale,
  TriangleAlert,
} from "lucide-react";
import { KPICard } from "./KPICard";
import { TrangThaiLine } from "./LineStatusWidget";
import { BangLSX } from "./WorkOrderTable";
import { CanhBao } from "./AlertPanel";
import { BieuDoGio, GaugeOEE, ThanhTienDo } from "./CommonWidget";
import {
  DASH_ALERT,
  DASH_GIO,
  DASH_LINE,
  DASH_LSX,
  DASH_MUC_NHAN,
  type CanhBaoItem,
  type DayChuyen,
  type LenhSanXuat,
} from "./mockDashboardData";

/**
 * ManTongQuan — dashboard tổng quan sản xuất (màn MES đầu tiên). Trưng bày bằng
 * token + component của design-system; số liệu là dữ liệu mẫu (chưa nối bảng
 * OEE/dây chuyền/lệnh sản xuất). Không emoji: trạng thái dùng chấm màu + nhãn chữ.
 */

function Khoi({
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

export default function ManTongQuan() {
  const [kpi, setKpi] = useState<string | null>(null);
  const [line, setLine] = useState<DayChuyen | null>(null);
  const [lsx, setLsx] = useState<LenhSanXuat | null>(null);
  const [alert, setAlert] = useState<CanhBaoItem | null>(null);
  const [daNhan, setDaNhan] = useState<string[]>([]);

  const acknowledge = (a: CanhBaoItem) => {
    setDaNhan((ds) => [...ds, a.id]);
    setAlert(null);
    notify.daLuu(`Đã nhận cảnh báo · ${a.gio} — ${a.chu}`);
  };

  const sanLuong = 12450;
  const mucTieu = 15000;
  const pct = Math.round((sanLuong / mucTieu) * 100);

  return (
    <div className="grid gap-6">
      <DuLieuMau ghiChu="OEE, dây chuyền, lệnh sản xuất chưa số hóa." />

      {/* 1 — KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          nhan="Sản lượng hôm nay"
          giaTri="12.450"
          phu={`Mục tiêu 15.000 kg · đạt ${pct}%`}
          vienClass="border-l-primary"
          icon={Scale}
          soSanh={{ tang: true, tot: true, chu: "6,2%" }}
          onClick={() => setKpi("sanLuong")}
        >
          <span className="pb-1 text-base text-muted-foreground">kg</span>
        </KPICard>
        <KPICard
          nhan="OEE tổng"
          giaTri="78,5%"
          phu="Ca A · 4 dây chuyền đang chạy"
          vienClass="border-l-status-changeover"
          icon={Gauge}
          soSanh={{ tang: false, tot: false, chu: "1,8%" }}
          onClick={() => setKpi("oee")}
        />
        <KPICard
          nhan="Đơn hàng đang xử lý"
          giaTri="23"
          phu="6 lệnh sản xuất đang chạy"
          vienClass="border-l-status-running"
          icon={Package}
          soSanh={{ tang: true, tot: true, chu: "2 đơn" }}
          onClick={() => setKpi("donHang")}
        />
        <KPICard
          nhan="Cảnh báo chất lượng"
          giaTri="2"
          phu="1 nhiệt độ kho · 1 cảm quan"
          vienClass="border-l-destructive"
          icon={TriangleAlert}
          soSanh={{ tang: true, tot: false, chu: "1 việc" }}
          onClick={() => setKpi("chatLuong")}
        >
          <Badge variant="destructive">Cần xử lý</Badge>
        </KPICard>
      </div>

      {/* Tiến độ mục tiêu ngày */}
      <div className="grid gap-2.5 rounded-xl border-2 border-border px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-base font-semibold text-foreground">
            Tiến độ mục tiêu ngày
          </span>
          <span className="font-mono text-base tnum">
            12.450 / 15.000 kg · {pct}%
          </span>
        </div>
        <ThanhTienDo pct={pct} cao="h-3.5" />
      </div>

      {/* 2 — Biểu đồ giờ + trạng thái dây chuyền */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
        <section className="grid min-w-0 content-start gap-4 rounded-xl border-2 border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Sản lượng theo giờ
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Lũy tiến 6:00 – 22:00, đơn vị kg
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-1 w-5 rounded bg-primary" /> Thực tế
              </span>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="w-5 border-t-[3px] border-dashed border-muted-foreground"
                />{" "}
                Kế hoạch
              </span>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-3 w-5 rounded border border-destructive/35 bg-destructive/10"
                />{" "}
                Dưới kế hoạch
              </span>
            </div>
          </div>
          <BieuDoGio data={DASH_GIO} />
        </section>

        <Khoi
          tieuDe="Trạng thái dây chuyền"
          moTa="Chọn một dây chuyền để xem OEE tách yếu tố"
        >
          <TrangThaiLine lines={DASH_LINE} onChon={setLine} />
        </Khoi>
      </div>

      {/* 3 — LSX + cảnh báo */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(300px,2fr)]">
        <section className="grid min-w-0 content-start gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Lệnh sản xuất đang chạy
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Hạn giao trong 2 ngày được tô vàng
            </p>
          </div>
          <BangLSX rows={DASH_LSX} onXem={setLsx} />
        </section>

        <Khoi
          tieuDe="Cảnh báo gần đây"
          moTa="Chọn một cảnh báo để xem chi tiết và xác nhận đã nhận"
        >
          <CanhBao alerts={DASH_ALERT} daNhan={daNhan} onChon={setAlert} />
        </Khoi>
      </div>

      {/* Dialog KPI */}
      {kpi && (
        <FormDialog
          open
          onOpenChange={() => setKpi(null)}
          rong="rong"
          icon={BarChart3}
          tieuDe={
            {
              sanLuong: "Sản lượng hôm nay",
              oee: "OEE tổng ca A",
              donHang: "Đơn hàng đang xử lý",
              chatLuong: "Cảnh báo chất lượng",
            }[kpi] ?? ""
          }
          moTa="Số liệu ca A · 11/08/2026 · Xí nghiệp BSF1"
          chan={<NutDong>Đóng</NutDong>}
        >
          {kpi === "oee" ? (
            <div className="grid gap-5">
              <div className="flex items-center gap-5">
                <GaugeOEE pct={78.5} size={104} mau="var(--status-changeover)" />
                <p className="text-base">
                  OEE = Sẵn sàng × Hiệu suất × Chất lượng. Ca A đang thấp hơn hôm
                  qua 1,8% vì Line 3 dừng chờ nguyên liệu 15 phút.
                </p>
              </div>
              <BangTong
                rows={DASH_LINE.filter((l) => l.metricNhan === "OEE")}
                getKey={(r) => r.id}
                cot={OEE_COT}
              />
            </div>
          ) : kpi === "sanLuong" ? (
            <div className="grid gap-5">
              <ThanhTienDo pct={pct} cao="h-3.5" />
              <p className="text-base">
                Đạt <span className="font-mono font-bold">12.450 kg</span> trên mục
                tiêu 15.000 kg ({pct}%). Còn{" "}
                <span className="font-mono font-bold">2.550 kg</span> trong 4 giờ
                cuối ca.
              </p>
              <BieuDoGio data={DASH_GIO} />
            </div>
          ) : (
            <p className="text-base">
              {kpi === "donHang"
                ? "23 đơn đang xử lý, trong đó 6 đơn đã có lệnh sản xuất chạy trên xưởng. Mở màn Đơn đặt để xem toàn bộ."
                : "2 việc chất lượng chưa đóng: nhiệt độ kho C3 vượt ngưỡng lúc 14:32 và 18 kg mực lỗi cảm quan ở Line 1 lúc 10:47."}
            </p>
          )}
        </FormDialog>
      )}

      {/* Dialog dây chuyền */}
      {line && (
        <FormDialog
          open
          onOpenChange={() => setLine(null)}
          rong="vua"
          icon={Factory}
          tieuDe={line.ten}
          moTa="OEE tách theo ba yếu tố, ca A ngày 11/08/2026"
          chan={
            <>
              <NutDong>Đóng</NutDong>
              <Button size="lg">
                <ClipboardList className="size-5" aria-hidden />
                Mở nhật ký dây chuyền
              </Button>
            </>
          }
        >
          <div className="grid gap-5">
            <div className="flex items-center gap-4">
              <StatusChip trangThai={line.trang} />
              <span className="text-base text-muted-foreground">
                {line.metricNhan}:
              </span>
              <span className="font-mono text-xl font-bold tnum">
                {line.metric}
              </span>
            </div>
            <div className="grid gap-3">
              {(
                [
                  ["Sẵn sàng", line.chiTiet.sanSang],
                  ["Hiệu suất", line.chiTiet.hieuSuat],
                  ["Chất lượng", line.chiTiet.chatLuong],
                ] as const
              ).map(([nhan, v]) => {
                const so = parseFloat(v) || 0;
                return (
                  <div key={nhan} className="grid gap-1.5">
                    <div className="flex justify-between text-base">
                      <span>{nhan}</span>
                      <span className="font-mono font-semibold tnum">{v}</span>
                    </div>
                    <ThanhTienDo
                      pct={so}
                      mau={
                        so >= 90
                          ? "bg-success"
                          : so >= 70
                            ? "bg-primary"
                            : "bg-warning"
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </FormDialog>
      )}

      {/* Dialog lệnh sản xuất */}
      {lsx && (
        <FormDialog
          open
          onOpenChange={() => setLsx(null)}
          rong="rong"
          icon={ClipboardList}
          tieuDe={`Lệnh sản xuất ${lsx.id}`}
          moTa={`${lsx.sp} · khách ${lsx.kh}`}
          chan={
            <>
              <NutDong>Đóng</NutDong>
              <Button
                size="lg"
                onClick={() => {
                  const l = lsx;
                  setLsx(null);
                  notify.daLuu(`Đã ghi nhận tiến độ · ${l.id} — ${l.tienDo}%`);
                }}
              >
                <Check className="size-5" aria-hidden />
                Ghi nhận tiến độ
              </Button>
            </>
          }
        >
          <div className="grid gap-5">
            <ThongKe
              cot={3}
              the={[
                { nhan: "Tiến độ", giaTri: `${lsx.tienDo}%`, so: true, icon: Gauge, mau: "brand" },
                { nhan: "Hạn giao", giaTri: lsx.han, icon: CalendarDays, mau: lsx.gap ? "warning" : "trung-tinh" },
                { nhan: "Dây chuyền", giaTri: "Line 1 · Line 4", icon: Factory, mau: "trung-tinh" },
              ] satisfies TheThongTin[]}
            />
            <ThanhTienDo pct={lsx.tienDo} cao="h-3.5" />
            <p className="text-base">
              {lsx.gap
                ? "Hạn giao trong 2 ngày — ưu tiên tuyến này khi phân công ca sau."
                : "Tiến độ đang theo kế hoạch; không cần điều chỉnh phân công."}
            </p>
          </div>
        </FormDialog>
      )}

      {/* Dialog cảnh báo */}
      {alert && (
        <FormDialog
          open
          onOpenChange={() => setAlert(null)}
          rong="vua"
          icon={TriangleAlert}
          tieuDe={alert.chu}
          moTa={`${DASH_MUC_NHAN[alert.muc]} · ${alert.gio} · ca A 11/08/2026`}
          chan={
            <>
              <NutDong>Đóng</NutDong>
              {daNhan.includes(alert.id) ? (
                <Button size="lg" disabled>
                  Đã nhận
                </Button>
              ) : (
                <Button size="lg" onClick={() => acknowledge(alert)}>
                  <Check className="size-5" aria-hidden />
                  Xác nhận đã nhận
                </Button>
              )}
            </>
          }
        >
          <p className="text-base leading-normal">{alert.them}</p>
        </FormDialog>
      )}
    </div>
  );
}

const OEE_COT: CotTong<DayChuyen>[] = [
  { key: "ten", header: "Dây chuyền", render: (r) => r.ten },
  { key: "ss", header: "Sẵn sàng", so: true, render: (r) => r.chiTiet.sanSang },
  { key: "hs", header: "Hiệu suất", so: true, render: (r) => r.chiTiet.hieuSuat },
  { key: "cl", header: "Chất lượng", so: true, render: (r) => r.chiTiet.chatLuong },
  { key: "oee", header: "OEE", so: true, render: (r) => r.metric },
];
