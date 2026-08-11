// ============================================================
// Tên file cũ: src/features/quality/ManChatLuong.tsx
// Tên tiếng Việt: Màn hình Kiểm tra & Quản lý Chất lượng QC
// Description: Quality Assurance & Quality Control Screen
// ============================================================
// src/features/quality/ManChatLuong.tsx
import { useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  BieuDoCot,
  Button,
  Combobox,
  DuLieuMau,
  EmptyState,
  Field,
  FormDialog,
  Input,
  NutDong,
  Textarea,
  notify,
} from "@/design-system";
import { cn } from "@/lib/utils";
import {
  Check,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  ClipboardPen,
  Clock,
  Hourglass,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

/**
 * ManChatLuong — kiểm soát chất lượng (QC + HACCP): KPI QC, bảng điểm kiểm soát
 * tới hạn (CCP), biểu đồ tỷ lệ đạt theo ngày + top lỗi, danh sách lô chờ kiểm,
 * các dialog xử lý vi phạm / ghi khắc phục / xem CCP / bắt đầu kiểm.
 *
 * Màn TRƯNG BÀY (dữ liệu mẫu). Không emoji: kết quả dùng icon + nhãn chữ.
 */

type KetQua = "dat" | "vipham";

interface CCP {
  id: string;
  mo: string;
  han: string;
  do: string;
  ket: KetQua;
  ai: string;
  gio: string;
}

interface LoChoKiem {
  id: string;
  sp: string;
  cd: string;
  cho: number;
}

const QC_CCP: CCP[] = [
  { id: "CCP-01", mo: "Nhiệt độ tiếp nhận nguyên liệu", han: "≤ 4 °C", do: "2,3 °C", ket: "dat", ai: "Trần Thị C", gio: "06:15" },
  { id: "CCP-02", mo: "Nhiệt độ hấp luộc", han: "≥ 85 °C / 3 phút", do: "88 °C / 4 phút", ket: "dat", ai: "Lê Văn D", gio: "08:30" },
  { id: "CCP-03", mo: "Nhiệt độ tâm sản phẩm đông lạnh", han: "≤ −18 °C", do: "−22 °C", ket: "dat", ai: "Phạm Quốc E", gio: "10:45" },
  { id: "CCP-04", mo: "Máy dò kim loại", han: "0 phát hiện", do: "0", ket: "dat", ai: "Máy tự động", gio: "11:00" },
  { id: "CCP-05", mo: "Nhiệt độ kho thành phẩm", han: "≤ −20 °C", do: "−17 °C", ket: "vipham", ai: "Hệ thống", gio: "14:32" },
];

const QC_KET: Record<
  KetQua,
  { nhan: string; icon: LucideIcon; chu: string; nen: string; vien: string }
> = {
  dat: { nhan: "Đạt", icon: CircleCheck, chu: "text-success", nen: "bg-success-surface", vien: "border-success/40" },
  vipham: { nhan: "Vi phạm", icon: CircleX, chu: "text-destructive", nen: "bg-destructive/10", vien: "border-destructive/40" },
};

const QC_NGAY = [
  { nhan: "04/08", giaTri: 97.2 },
  { nhan: "05/08", giaTri: 98.1 },
  { nhan: "06/08", giaTri: 95.4 },
  { nhan: "07/08", giaTri: 96.9 },
  { nhan: "08/08", giaTri: 99.0 },
  { nhan: "09/08", giaTri: 94.6 },
  { nhan: "10/08", giaTri: 96.8 },
];

const QC_LOI = [
  { nhan: "Trọng lượng thiếu", giaTri: 34, phu: "chủ yếu túi 1 kg" },
  { nhan: "Cảm quan không đạt", giaTri: 21, phu: "màu, mùi" },
  { nhan: "Nhiệt độ vượt ngưỡng", giaTri: 14, phu: "kho C3" },
  { nhan: "Bao bì lỗi", giaTri: 9, phu: "hàn mép" },
  { nhan: "Nhãn sai thông tin", giaTri: 5, phu: "ngày SX" },
];

const QC_CHO: LoChoKiem[] = [
  { id: "MQ-240810-001", sp: "Mực ống đông IQF 1 kg", cd: "Đông lạnh", cho: 195 },
  { id: "BT-240810-004", sp: "Bạch tuộc hấp nguyên con", cd: "Hấp luộc", cho: 168 },
  { id: "CN-240810-003", sp: "Cá ngừ loin đông −60 °C", cd: "Cấp đông", cho: 142 },
  { id: "MN-240810-005", sp: "Mực nang fillet 500 g", cd: "Sơ chế", cho: 96 },
  { id: "TS-240810-008", sp: "Tôm sú vỏ đông block", cd: "Đóng gói", cho: 74 },
  { id: "GX-240810-002", sp: "Ghẹ xanh hấp cấp đông", cd: "Đông lạnh", cho: 41 },
  { id: "CT-240810-009", sp: "Cá thu cắt khúc đông lạnh", cd: "Đóng gói", cho: 18 },
];

const qcGio = (p: number) => `${Math.floor(p / 60)} giờ ${p % 60} phút`;

function GaugeQC({
  pct,
  mau,
  size = 76,
}: {
  pct: number;
  mau: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${mau} ${pct}%, var(--secondary) ${pct}% 100%)`,
      }}
    >
      <span className="absolute inset-[9px] rounded-full bg-card" />
      <span className="relative font-mono text-sm font-bold tnum">{pct}%</span>
    </span>
  );
}

function TheQC({
  nhan,
  giaTri,
  phu,
  vienClass,
  icon: Icon,
  chip,
  gauge,
  onClick,
}: {
  nhan: string;
  giaTri?: string;
  phu?: string;
  vienClass: string;
  icon?: LucideIcon;
  chip?: ReactNode;
  gauge?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[128px] items-center gap-4 rounded-xl border-l-4 bg-card p-5 text-left ring-1 ring-foreground/10 transition-shadow hover:ring-2 hover:ring-primary/30",
        vienClass
      )}
    >
      {gauge}
      <span className="grid min-w-0 flex-1 gap-1.5">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">{nhan}</span>
          {Icon && (
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
          )}
        </span>
        {!gauge && (
          <span className="flex items-end gap-2.5">
            <span className="font-mono text-3xl font-bold leading-none tnum">
              {giaTri}
            </span>
            {chip}
          </span>
        )}
        {phu && <span className="text-sm text-muted-foreground">{phu}</span>}
      </span>
    </button>
  );
}

export default function ManChatLuong() {
  const [xuLy, setXuLy] = useState<CCP | null>(null);
  const [khacPhuc, setKhacPhuc] = useState<CCP | null>(null);
  const [ccp, setCcp] = useState<CCP | null>(null);
  const [kiem, setKiem] = useState<LoChoKiem | null>(null);
  const [daXuLy, setDaXuLy] = useState<string[]>([]);
  const [choKiem, setChoKiem] = useState<LoChoKiem[]>(QC_CHO);

  const sap = useMemo(
    () => [...choKiem].sort((a, b) => b.cho - a.cho),
    [choKiem]
  );

  return (
    <div className="grid gap-6">
      <DuLieuMau ghiChu="QC/HACCP chưa số hóa." />

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TheQC
          nhan="Tỷ lệ đạt QC"
          phu="Mục tiêu 95% · vượt 1,8 điểm"
          vienClass="border-l-success"
          gauge={<GaugeQC pct={96.8} mau="var(--success)" />}
          onClick={() =>
            notify.daLuu(
              "Tỷ lệ đạt QC hôm nay 96,8% · trên mục tiêu 95% — 1 lô không đạt / 31 lô"
            )
          }
        />
        <TheQC
          nhan="Lô chờ kiểm"
          giaTri={String(sap.length)}
          phu="Lâu nhất đã chờ 3 giờ 15 phút"
          vienClass="border-l-warning"
          icon={Hourglass}
          chip={
            <Badge className="border-warning/40 bg-warning-surface text-warning">
              Cần xếp lịch
            </Badge>
          }
          onClick={() =>
            notify.daLuu(`${sap.length} lô đang chờ kiểm · xem danh sách cuối trang`)
          }
        />
        <TheQC
          nhan="Lô không đạt hôm nay"
          giaTri="1"
          phu="CCP-05 — kho thành phẩm"
          vienClass="border-l-destructive"
          icon={TriangleAlert}
          chip={<Badge variant="destructive">Chưa đóng</Badge>}
          onClick={() => setXuLy(QC_CCP[4])}
        />
        <TheQC
          nhan="Tuân thủ HACCP"
          giaTri="100%"
          phu="5/5 điểm tới hạn có ghi nhận đúng giờ"
          vienClass="border-l-success"
          icon={ShieldCheck}
          onClick={() =>
            notify.daLuu("Tuân thủ HACCP 100% · mọi CCP đều ghi nhận trong ca")
          }
        />
      </div>

      {/* HACCP */}
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Điểm kiểm soát tới hạn — Ca sáng 10/08/2026
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vi phạm phải có hành động khắc phục ghi lại trước khi đóng ca.
          </p>
        </div>
        <div className="scroll-nice w-full max-w-full overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full min-w-[1120px] border-collapse text-base">
            <thead>
              <tr>
                {["CCP", "Mô tả", "Giới hạn tới hạn", "Giá trị đo", "Trạng thái", "Người kiểm", "Giờ", ""].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={cn(
                        "h-14 whitespace-nowrap border-b border-border bg-muted px-4 font-semibold",
                        i === 7 ? "text-right" : "text-left"
                      )}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {QC_CCP.map((r, i) => {
                const k = QC_KET[r.ket];
                const vp = r.ket === "vipham";
                const xong = daXuLy.includes(r.id);
                const Icon = k.icon;
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      "border-b border-border",
                      vp
                        ? "bg-destructive/10 font-semibold"
                        : i % 2 === 1
                          ? "bg-muted/40"
                          : "bg-background"
                    )}
                  >
                    <td className="h-14 whitespace-nowrap px-4 font-mono font-bold">
                      {r.id}
                    </td>
                    <td className="h-14 px-4">{r.mo}</td>
                    <td className="h-14 whitespace-nowrap px-4 font-mono text-muted-foreground">
                      {r.han}
                    </td>
                    <td
                      className={cn(
                        "h-14 whitespace-nowrap px-4 font-mono font-bold",
                        vp ? "text-destructive" : "text-foreground"
                      )}
                    >
                      {r.do}
                    </td>
                    <td className="h-14 whitespace-nowrap px-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold",
                          k.vien,
                          k.chu,
                          vp ? "bg-background" : k.nen
                        )}
                      >
                        <Icon className="size-5" aria-hidden />
                        {k.nhan}
                      </span>
                    </td>
                    <td className="h-14 whitespace-nowrap px-4">{r.ai}</td>
                    <td className="h-14 whitespace-nowrap px-4 font-mono">
                      {r.gio}
                    </td>
                    <td className="h-14 whitespace-nowrap px-4 text-right">
                      {vp ? (
                        <span className="flex justify-end gap-2">
                          {xong ? (
                            <Badge className="border-success/40 bg-success-surface text-success">
                              Đã khắc phục
                            </Badge>
                          ) : (
                            <>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setXuLy(r)}
                              >
                                Xử lý
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setKhacPhuc(r)}
                              >
                                Ghi hành động khắc phục
                              </Button>
                            </>
                          )}
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCcp(r)}
                        >
                          Xem
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Biểu đồ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="grid min-w-0 content-start gap-4 rounded-xl border-2 border-border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Tỷ lệ đạt QC theo ngày
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              7 ngày gần nhất · đường ngang là mục tiêu 95%
            </p>
          </div>
          <div className="relative flex h-60 items-end gap-3 pt-6">
            <span
              aria-hidden
              className="absolute inset-x-0 border-t-2 border-dashed border-warning"
              style={{ bottom: Math.round(((95 - 90) / 10) * 176) + 24 }}
            />
            {QC_NGAY.map((d) => {
              const h = Math.max(6, Math.round(((d.giaTri - 90) / 10) * 176));
              const dat = d.giaTri >= 95;
              return (
                <span
                  key={d.nhan}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                >
                  <span className="font-mono text-xs font-bold">{d.giaTri}</span>
                  <span
                    className={cn(
                      "w-full max-w-11 shrink-0 rounded-t-md",
                      dat ? "bg-success" : "bg-warning"
                    )}
                    style={{ height: h }}
                  />
                  <span className="text-xs text-muted-foreground">{d.nhan}</span>
                </span>
              );
            })}
          </div>
        </section>

        <section className="grid min-w-0 content-start gap-4 rounded-xl border-2 border-border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Top 5 lỗi thường gặp
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Số lần ghi nhận trong 30 ngày
            </p>
          </div>
          <BieuDoCot data={QC_LOI} donVi="lần" duongTrungBinh={false} />
        </section>
      </div>

      {/* Lô chờ kiểm */}
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Lô chờ kiểm tra
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Xếp theo thời gian chờ · quá 2 giờ được tô vàng
          </p>
        </div>
        {sap.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            tieuDe="Không còn lô nào chờ kiểm"
            moTa="Mọi lô trong ca đã có kết quả QC."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sap.map((l) => {
              const lau = l.cho > 120;
              return (
                <div
                  key={l.id}
                  className={cn(
                    "grid gap-3 rounded-xl border-2 p-4",
                    lau
                      ? "border-warning/45 bg-warning-surface"
                      : "border-border bg-card"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-base font-bold">{l.id}</span>
                    <Badge variant="secondary">{l.cd}</Badge>
                  </div>
                  <p className="text-base font-medium">{l.sp}</p>
                  <p
                    className={cn(
                      "flex items-center gap-2 text-sm font-semibold",
                      lau ? "text-warning" : "text-muted-foreground"
                    )}
                  >
                    <Clock className="size-5" aria-hidden />
                    Đã chờ {qcGio(l.cho)}
                  </p>
                  <Button className="w-full" onClick={() => setKiem(l)}>
                    <ClipboardCheck className="size-5" aria-hidden />
                    Bắt đầu kiểm
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Dialog xử lý vi phạm */}
      {xuLy && (
        <FormDialog
          open
          onOpenChange={() => setXuLy(null)}
          rong="vua"
          icon={TriangleAlert}
          tieuDe={`Xử lý vi phạm ${xuLy.id}`}
          moTa={`${xuLy.mo} · ghi nhận ${xuLy.gio} bởi ${xuLy.ai}`}
          chan={
            <>
              <NutDong>Đóng</NutDong>
              <Button
                variant="destructive"
                size="lg"
                onClick={() => {
                  setKhacPhuc(xuLy);
                  setXuLy(null);
                }}
              >
                Chuyển sang ghi khắc phục
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted px-4 py-3.5">
                <p className="text-sm text-muted-foreground">Giới hạn tới hạn</p>
                <p className="mt-0.5 font-mono text-xl font-bold">{xuLy.han}</p>
              </div>
              <div className="rounded-lg bg-destructive/10 px-4 py-3.5">
                <p className="text-sm text-muted-foreground">Giá trị đo được</p>
                <p className="mt-0.5 font-mono text-xl font-bold text-destructive">
                  {xuLy.do}
                </p>
              </div>
            </div>
            <p className="text-base leading-normal">
              Kho thành phẩm C3 vượt ngưỡng 3 °C trong 40 phút. Hàng trong kho: lô
              MQ-240809-011 (chờ giao 10/08). Theo kế hoạch HACCP, phải cách ly lô,
              đánh giá lại cảm quan và vi sinh trước khi cho xuất.
            </p>
          </div>
        </FormDialog>
      )}

      {/* Dialog hành động khắc phục */}
      {khacPhuc && (
        <FormDialog
          open
          onOpenChange={() => setKhacPhuc(null)}
          rong="vua"
          icon={ClipboardPen}
          tieuDe="Ghi hành động khắc phục"
          moTa={`${khacPhuc.id} · ${khacPhuc.mo}`}
          chan={
            <>
              <NutDong>Đóng</NutDong>
              <Button
                size="lg"
                onClick={() => {
                  const kp = khacPhuc;
                  setDaXuLy((d) => [...d, kp.id]);
                  setKhacPhuc(null);
                  notify.daLuu(
                    `Đã ghi hành động khắc phục · ${kp.id} — chờ KCS duyệt đóng`
                  );
                }}
              >
                <Check className="size-5" aria-hidden />
                Lưu hành động
              </Button>
            </>
          }
        >
          <div className="grid gap-5">
            <Combobox
              label="Loại hành động"
              required
              value=""
              onChange={() => {}}
              options={[
                { value: "cach-ly", label: "Cách ly lô hàng" },
                { value: "sua-thiet-bi", label: "Sửa / hiệu chỉnh thiết bị" },
                { value: "kiem-lai", label: "Kiểm lại toàn bộ lô" },
                { value: "ha-pham", label: "Hạ phẩm cấp" },
                { value: "huy", label: "Hủy lô" },
              ]}
            />
            <Field label="Mô tả hành động" required hint="Ghi rõ ai làm gì, lúc mấy giờ.">
              <Textarea
                rows={3}
                placeholder="VD: 14:40 cách ly lô MQ-240809-011 sang kho C1, gọi kỹ thuật kiểm dàn lạnh C3."
              />
            </Field>
            <Field label="Người chịu trách nhiệm" required>
              <Input placeholder="Tên và chức danh" />
            </Field>
          </div>
        </FormDialog>
      )}

      {/* Dialog xem CCP đạt */}
      {ccp && (
        <FormDialog
          open
          onOpenChange={() => setCcp(null)}
          rong="sm"
          icon={CircleCheck}
          tieuDe={`${ccp.id} — ${ccp.mo}`}
          moTa={`Đạt · ${ccp.gio} · ${ccp.ai}`}
          chan={<NutDong>Đóng</NutDong>}
        >
          <dl className="grid gap-3">
            {(
              [
                ["Giới hạn tới hạn", ccp.han],
                ["Giá trị đo", ccp.do],
                ["Người kiểm", ccp.ai],
                ["Giờ ghi nhận", ccp.gio],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between gap-4 border-b border-border pb-2"
              >
                <dt className="text-base text-muted-foreground">{k}</dt>
                <dd className="font-mono text-base font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </FormDialog>
      )}

      {/* Dialog bắt đầu kiểm */}
      {kiem && (
        <FormDialog
          open
          onOpenChange={() => setKiem(null)}
          rong="vua"
          icon={ClipboardCheck}
          tieuDe="Bắt đầu kiểm lô"
          moTa={`${kiem.id} · ${kiem.sp} · công đoạn ${kiem.cd}`}
          chan={
            <>
              <NutDong>Đóng</NutDong>
              <Button
                size="lg"
                onClick={() => {
                  const l = kiem;
                  setChoKiem((cs) => cs.filter((c) => c.id !== l.id));
                  setKiem(null);
                  notify.daLuu(`Đã nhận lô để kiểm · ${l.id} — chuyển phiếu KCS`);
                }}
              >
                <Check className="size-5" aria-hidden />
                Nhận kiểm
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <p className="text-base">
              Lô đã chờ <strong>{qcGio(kiem.cho)}</strong>. Nhận kiểm sẽ tạo phiếu
              KCS và gỡ lô khỏi hàng chờ.
            </p>
            <Combobox
              label="Người kiểm"
              required
              value=""
              onChange={() => {}}
              options={[
                { value: "hoa", label: "Vũ Thị Hoa — KCS" },
                { value: "c", label: "Trần Thị C — KCS" },
                { value: "d", label: "Lê Văn D — KCS" },
              ]}
            />
          </div>
        </FormDialog>
      )}
    </div>
  );
}
