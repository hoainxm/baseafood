// src/features/traceability/ManTruyXuat.tsx
import { Fragment, useState } from "react";
import {
  Button,
  DuLieuMau,
  EmptyState,
  FormDialog,
  Input,
  NutDong,
  Separator,
  StatusChip,
  notify,
} from "@/design-system";
import { cn } from "@/lib/utils";
import {
  CircleCheck,
  CircleX,
  Clock,
  Copy,
  FileText,
  GitBranch,
  Loader2,
  Printer,
  QrCode,
  ScanBarcode,
  Search,
  type LucideIcon,
} from "lucide-react";

/**
 * ManTruyXuat — truy xuất nguồn gốc lô hàng: ô tìm/quét mã · thông tin lô ·
 * timeline chuỗi truy xuất (tàu → xuất kho) · bảng nguyên liệu đầu vào · thẻ QC
 * checkpoints · in phiếu / xuất PDF / tạo QR.
 *
 * Màn TRƯNG BÀY (dữ liệu mẫu). Không emoji: trạng thái bằng icon + nhãn chữ.
 */

interface Lo {
  ma: string;
  sp: string;
  kh: string;
  lsx: string;
  thuc: number;
  ke: number;
}

type TrangBuoc = "xong" | "dang" | "cho";

interface Buoc {
  id: string;
  ten: string;
  gio: string;
  ai: string;
  trang: TrangBuoc;
  ghi: string;
}

type KetQC = "dat" | "dang" | "khong";

interface QC {
  id: string;
  ten: string;
  ket: KetQC;
  so: string;
  gio: string;
  ai: string;
  ghi: string;
}

const TX_LO: Lo = {
  ma: "MQ-240810-001",
  sp: "Mực ống đông lạnh IQF 1 kg",
  kh: "Maruha Nichiro — Nhật Bản",
  lsx: "LSX-240810-001",
  thuc: 2500,
  ke: 5000,
};

const TX_BUOC: Buoc[] = [
  { id: "b1", ten: "Thu mua NL", gio: "06/08 05:10", ai: "Trần Văn Hải", trang: "xong", ghi: "Mua tại cảng Cát Lở từ tàu KG-93783-TS. 5.200 kg mực ống tươi, nhiệt độ hầm đá 1,8 °C." },
  { id: "b2", ten: "Tiếp nhận kho", gio: "06/08 08:45", ai: "Nguyễn Văn B", trang: "xong", ghi: "Cân thực nhận 5.180 kg (hao 20 kg do rỉ nước đá). Nhiệt độ tiếp nhận 2,1 °C — đạt ngưỡng ≤ 4 °C." },
  { id: "b3", ten: "Sơ chế", gio: "07/08 06:30", ai: "Tổ sơ chế — Lê Thị Mai", trang: "xong", ghi: "Rửa, phân loại size 15–20 con/kg, bỏ nội tạng. Tỷ lệ thu hồi 78%. Line 1." },
  { id: "b4", ten: "Chế biến", gio: "08/08 06:30", ai: "Nguyễn Văn B", trang: "xong", ghi: "Cắt khoanh, ngâm phụ gia theo công thức MQ-IQF-01, kiểm tra pH sau ngâm." },
  { id: "b5", ten: "Đông lạnh", gio: "09/08 14:20", ai: "Tổ IQF — Phạm Quốc Anh", trang: "dang", ghi: "Băng chuyền IQF −38 °C, thời gian đông 22 phút/mẻ. Đã xong 2.500 kg / 5.000 kg." },
  { id: "b6", ten: "QC", gio: "—", ai: "Phòng KCS", trang: "cho", ghi: "Chạy song song theo mẻ: vi sinh, kim loại nặng, cảm quan, trọng lượng." },
  { id: "b7", ten: "Đóng gói", gio: "—", ai: "Tổ đóng gói XK", trang: "cho", ghi: "Túi 1 kg, thùng 10 kg, in nhãn tiếng Nhật theo mẫu khách duyệt." },
  { id: "b8", ten: "Xuất kho", gio: "—", ai: "Thủ kho — Đỗ Thị Lan", trang: "cho", ghi: "Dự kiến giao 15/08/2026, container lạnh −18 °C, cảng Cát Lái." },
];

const TX_BUOC_TRANG: Record<
  TrangBuoc,
  { nhan: string; icon: LucideIcon; chu: string; nen: string }
> = {
  xong: { nhan: "Hoàn thành", icon: CircleCheck, chu: "text-success", nen: "bg-success-surface" },
  dang: { nhan: "Đang chạy", icon: Loader2, chu: "text-primary", nen: "bg-accent" },
  cho: { nhan: "Chờ", icon: Clock, chu: "text-muted-foreground", nen: "bg-background" },
};

interface DongNL {
  k: string;
  v: string;
  mono?: boolean;
  dat?: string;
}

const TX_NL: DongNL[] = [
  { k: "Tàu khai thác", v: "KG-93783-TS", mono: true },
  { k: "Cảng cập", v: "Cảng Cát Lở, Bà Rịa – Vũng Tàu" },
  { k: "Ngày khai thác", v: "06/08/2026" },
  { k: "Loại nguyên liệu", v: "Mực ống tươi, size 15–20 con/kg" },
  { k: "Chứng nhận", v: "MSC-2024-VN-0892", mono: true },
  { k: "Khối lượng thu mua", v: "5.200 kg", mono: true },
  { k: "Khối lượng thực nhận", v: "5.180 kg", mono: true },
  { k: "Nhiệt độ tiếp nhận", v: "2,1 °C", mono: true, dat: "Đạt (≤ 4 °C)" },
];

const TX_QC: QC[] = [
  { id: "q1", ten: "Vi sinh", ket: "dat", so: "E.coli < 10 CFU/g", gio: "09/08 10:12", ai: "KCS — Vũ Thị Hoa", ghi: "Mẫu lấy 3 điểm trên băng chuyền. Salmonella âm tính, TPC 2,4×10³ CFU/g — trong ngưỡng EU." },
  { id: "q2", ten: "Kim loại nặng", ket: "dat", so: "Hg 0,03 mg/kg", gio: "09/08 11:40", ai: "Lab ngoài — Quatest 3", ghi: "Ngưỡng cho phép Hg ≤ 0,5 mg/kg. Cd và Pb cũng dưới ngưỡng." },
  { id: "q3", ten: "Cảm quan", ket: "dat", so: "Điểm 8,5 / 10", gio: "09/08 13:05", ai: "KCS — Vũ Thị Hoa", ghi: "Màu trắng ngà đồng đều, không mùi lạ, độ đàn hồi tốt. Đạt hạng A xuất khẩu." },
  { id: "q4", ten: "Trọng lượng", ket: "dang", so: "Đang kiểm mẻ 3/8", gio: "10/08 09:30", ai: "Tổ đóng gói", ghi: "Kiểm ngẫu nhiên 20 túi/mẻ. Sai số cho phép ±2% trên 1.000 g." },
];

const TX_QC_KET: Record<
  KetQC,
  { nhan: string; icon: LucideIcon; chu: string; vien: string; nen: string }
> = {
  dat: { nhan: "Đạt", icon: CircleCheck, chu: "text-success", vien: "border-success/35", nen: "bg-success-surface" },
  dang: { nhan: "Đang kiểm", icon: Loader2, chu: "text-primary", vien: "border-primary/35", nen: "bg-accent" },
  khong: { nhan: "Không đạt", icon: CircleX, chu: "text-destructive", vien: "border-destructive/35", nen: "bg-destructive/10" },
};

const so = (n: number) => n.toLocaleString("vi-VN");

function NodeBuoc({ b, onClick }: { b: Buoc; onClick: () => void }) {
  const t = TX_BUOC_TRANG[b.trang];
  const Icon = t.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-44 shrink-0 justify-items-center gap-2 border-0 bg-transparent p-0 text-center"
    >
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-full border-[3px]",
          t.nen,
          t.chu
        )}
        style={{ borderColor: "currentColor" }}
      >
        <Icon
          className={cn("size-7", b.trang === "dang" && "animate-spin")}
          aria-hidden
        />
      </span>
      <span className="text-base font-semibold leading-tight">{b.ten}</span>
      <span className="font-mono text-xs text-muted-foreground">{b.gio}</span>
      <span className="text-xs leading-snug text-muted-foreground">{b.ai}</span>
      <span
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold",
          b.trang === "cho"
            ? "border-border bg-muted text-muted-foreground"
            : cn(t.nen, t.chu, "border-current")
        )}
      >
        {t.nhan}
      </span>
    </button>
  );
}

export default function ManTruyXuat() {
  const [q, setQ] = useState("");
  const [ketQua, setKetQua] = useState<Lo | null>(null);
  const [buoc, setBuoc] = useState<Buoc | null>(null);
  const [qc, setQc] = useState<QC | null>(null);
  const [qr, setQr] = useState(false);

  const truyXuat = () => {
    if (!q.trim()) {
      notify.loi("Chưa nhập mã · nhập mã lô, mã sản phẩm hoặc quét mã vạch.");
      return;
    }
    setKetQua(TX_LO);
  };

  const sao = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(TX_LO.ma).catch(() => {});
    notify.daLuu(`Đã sao chép mã lô · ${TX_LO.ma}`);
  };

  const pct = Math.round((TX_LO.thuc / TX_LO.ke) * 100);

  return (
    <div className="grid gap-6">
      <DuLieuMau ghiChu="Truy xuất chưa nối dữ liệu thật." />

      {/* Ô truy xuất */}
      <section className="grid justify-items-center gap-4 rounded-xl border-2 border-border bg-card p-7">
        <div className="max-w-[620px] text-center">
          <h2 className="text-2xl font-semibold text-foreground">
            Truy xuất nguồn gốc lô hàng
          </h2>
          <p className="mt-1.5 text-base text-muted-foreground">
            Nhập mã lô in trên thùng, mã sản phẩm, hoặc quét mã vạch bằng máy quét
            cầm tay.
          </p>
        </div>
        <div className="flex w-full max-w-[760px] flex-wrap gap-3">
          <div className="relative min-w-[280px] flex-1 basis-[340px]">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") truyXuat();
              }}
              aria-label="Mã lô, mã sản phẩm hoặc mã vạch"
              placeholder="Nhập mã lô, mã sản phẩm, hoặc quét barcode…"
              className="h-14 pr-16 text-lg"
            />
            <button
              type="button"
              aria-label="Quét mã vạch"
              title="Quét mã vạch"
              onClick={() => {
                setQ(TX_LO.ma);
                setKetQua(TX_LO);
                notify.daLuu(`Đã quét mã vạch · ${TX_LO.ma}`);
              }}
              className="absolute right-1.5 top-1.5 inline-flex size-11 items-center justify-center rounded-lg border-2 border-border bg-background transition-colors hover:bg-muted"
            >
              <ScanBarcode className="size-6" aria-hidden />
            </button>
          </div>
          <Button size="lg" onClick={truyXuat}>
            <Search className="size-6" aria-hidden />
            Truy xuất
          </Button>
        </div>
        {!ketQua && (
          <p className="text-sm text-muted-foreground">
            Thử mã mẫu:{" "}
            <button
              type="button"
              onClick={() => {
                setQ(TX_LO.ma);
                setKetQua(TX_LO);
              }}
              className="border-0 bg-none p-0 font-mono text-sm font-semibold text-primary underline underline-offset-4"
            >
              {TX_LO.ma}
            </button>
          </p>
        )}
      </section>

      {!ketQua ? (
        <EmptyState
          icon={GitBranch}
          tieuDe="Chưa truy xuất lô nào"
          moTa="Nhập mã lô rồi bấm Truy xuất để xem toàn bộ chuỗi từ tàu khai thác đến khi xuất kho."
        />
      ) : (
        <>
          {/* Thông tin lô */}
          <section className="grid gap-5 rounded-xl border-2 border-primary bg-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Mã lô</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-3xl font-bold">{ketQua.ma}</span>
                  <Button variant="outline" size="sm" onClick={sao}>
                    <Copy className="size-5" aria-hidden />
                    Sao chép
                  </Button>
                </div>
              </div>
              <StatusChip trangThai="running" nhan="Đang sản xuất" />
            </div>
            <Separator />
            <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["Sản phẩm", ketQua.sp, false],
                  ["Khách hàng", ketQua.kh, false],
                  ["Lệnh sản xuất", ketQua.lsx, true],
                  ["Sản lượng", `${so(ketQua.thuc)} / ${so(ketQua.ke)} kg · ${pct}%`, true],
                ] as const
              ).map(([k, v, mono]) => (
                <div key={k}>
                  <dt className="text-sm text-muted-foreground">{k}</dt>
                  <dd
                    className={cn(
                      "mt-0.5 text-lg font-semibold",
                      mono && "font-mono tnum"
                    )}
                  >
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <span className="block h-3 overflow-hidden rounded-full bg-secondary">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </span>
          </section>

          {/* Chuỗi truy xuất */}
          <section className="grid gap-4 rounded-xl border-2 border-border bg-card p-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Chuỗi truy xuất
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Chọn một công đoạn để xem ai làm, lúc nào, ghi nhận gì.
              </p>
            </div>
            <div className="scroll-nice w-full max-w-full overflow-x-auto pb-2">
              <div className="flex min-w-max items-start">
                {TX_BUOC.map((b, i) => (
                  <Fragment key={b.id}>
                    <NodeBuoc b={b} onClick={() => setBuoc(b)} />
                    {i < TX_BUOC.length - 1 && (
                      <span
                        aria-hidden
                        className={cn(
                          "mt-[26px] h-1 w-11 shrink-0 rounded",
                          b.trang === "xong"
                            ? "bg-success"
                            : b.trang === "dang"
                              ? "bg-primary/45"
                              : "bg-border"
                        )}
                      />
                    )}
                  </Fragment>
                ))}
              </div>
            </div>
          </section>

          {/* Nguyên liệu */}
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              Chi tiết nguyên liệu đầu vào
            </h2>
            <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
              <table className="w-full border-collapse text-base">
                <tbody>
                  {TX_NL.map((r, i) => (
                    <tr
                      key={r.k}
                      className={cn(
                        "border-b border-border",
                        i % 2 === 1 ? "bg-muted/40" : "bg-background"
                      )}
                    >
                      <th
                        scope="row"
                        className="w-[38%] px-4 py-3.5 text-left font-medium text-muted-foreground"
                      >
                        {r.k}
                      </th>
                      <td
                        className={cn(
                          "px-4 py-3.5 font-semibold",
                          r.mono && "font-mono tnum"
                        )}
                      >
                        {r.v}
                        {r.dat && (
                          <span className="ml-3 inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success-surface px-2.5 py-0.5 font-sans text-xs font-semibold text-success">
                            <CircleCheck className="size-4" aria-hidden />
                            {r.dat}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* QC */}
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              Kiểm tra chất lượng
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {TX_QC.map((c, i) => {
                const k = TX_QC_KET[c.ket];
                const Icon = k.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setQc(c)}
                    className={cn(
                      "grid gap-2.5 rounded-xl border-2 bg-card p-5 text-left",
                      k.vien
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">
                        Checkpoint {i + 1}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold",
                          k.nen,
                          k.chu,
                          "border-current"
                        )}
                      >
                        <Icon
                          className={cn("size-5", c.ket === "dang" && "animate-spin")}
                          aria-hidden
                        />
                        {k.nhan}
                      </span>
                    </span>
                    <span className="text-xl font-semibold">{c.ten}</span>
                    <span className="font-mono text-base font-semibold tnum">
                      {c.so}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {c.gio} · {c.ai}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Footer hành động */}
          <div className="flex flex-wrap justify-end gap-3 border-t-2 border-border pt-5">
            <Button
              variant="outline"
              size="lg"
              onClick={() => notify.daLuu(`Đã gửi lệnh in · Phiếu truy xuất ${ketQua.ma}`)}
            >
              <Printer className="size-5" aria-hidden />
              In phiếu truy xuất
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => notify.daLuu(`Đang xuất PDF · ${ketQua.ma} — gồm cả 4 checkpoint QC`)}
            >
              <FileText className="size-5" aria-hidden />
              Xuất PDF
            </Button>
            <Button size="lg" onClick={() => setQr(true)}>
              <QrCode className="size-5" aria-hidden />
              Tạo QR Code
            </Button>
          </div>
        </>
      )}

      {/* Dialog công đoạn */}
      {buoc && (
        <FormDialog
          open
          onOpenChange={() => setBuoc(null)}
          rong="vua"
          icon={TX_BUOC_TRANG[buoc.trang].icon}
          tieuDe={buoc.ten}
          moTa={`${TX_BUOC_TRANG[buoc.trang].nhan} · ${buoc.gio} · ${buoc.ai}`}
          chan={<NutDong>Đóng</NutDong>}
        >
          <p className="text-base leading-normal">{buoc.ghi}</p>
        </FormDialog>
      )}

      {/* Dialog QC */}
      {qc && (
        <FormDialog
          open
          onOpenChange={() => setQc(null)}
          rong="vua"
          icon={TX_QC_KET[qc.ket].icon}
          tieuDe={`Checkpoint — ${qc.ten}`}
          moTa={`${TX_QC_KET[qc.ket].nhan} · ${qc.gio} · ${qc.ai}`}
          chan={
            <>
              <NutDong>Đóng</NutDong>
              <Button
                size="lg"
                onClick={() => {
                  const c = qc;
                  setQc(null);
                  notify.daLuu(`Đang mở phiếu kiểm · ${c.ten} — lô ${TX_LO.ma}`);
                }}
              >
                <FileText className="size-5" aria-hidden />
                Mở phiếu kiểm
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <p
              className={cn(
                "rounded-lg px-4 py-3.5 font-mono text-lg font-bold",
                TX_QC_KET[qc.ket].nen
              )}
            >
              {qc.so}
            </p>
            <p className="text-base leading-normal">{qc.ghi}</p>
          </div>
        </FormDialog>
      )}

      {/* Dialog QR */}
      {qr && (
        <FormDialog
          open
          onOpenChange={setQr}
          rong="sm"
          icon={QrCode}
          tieuDe="Mã QR truy xuất"
          moTa="Dán lên thùng hàng; khách quét là ra đúng trang này."
          chan={
            <>
              <NutDong>Đóng</NutDong>
              <Button
                size="lg"
                onClick={() => {
                  setQr(false);
                  notify.daLuu(`Đã gửi lệnh in tem QR · ${TX_LO.ma} — 40 tem`);
                }}
              >
                <Printer className="size-5" aria-hidden />
                In tem QR
              </Button>
            </>
          }
        >
          <div className="grid justify-items-center gap-4 text-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                "BASEAFOOD/TRACE/" + TX_LO.ma
              )}`}
              alt={`Mã QR truy xuất lô ${TX_LO.ma}`}
              width={220}
              height={220}
              className="rounded-lg border-2 border-border bg-white"
            />
            <p className="font-mono text-base font-semibold">{TX_LO.ma}</p>
          </div>
        </FormDialog>
      )}
    </div>
  );
}
