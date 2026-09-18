// ============================================================
// HỘ CHIẾU LÔ — màn /qr (nâng cấp NR-6 thành truy xuất trọn chuỗi).
// Quét QR (camera điện thoại quét tem là mở thẳng màn này qua đường link ?lo=…),
// hoặc gõ mã lô → một trang trả lời hai câu của truy xuất:
//   • TRUY NGƯỢC: lô này làm từ lô nào, của đại lý nào, ngày nào (TP → BTP → NL)
//   • TRUY XUÔI : lô này đã đi vào đâu, xuất cho ai — phạm vi khi phải THU HỒI
// kèm CÂN BẰNG KHỐI LƯỢNG theo lô và in lại tem.
// Đọc được cả tem CŨ (QR chỉ chứa mã lô trần). Mã trùng ⇒ liệt kê cho người chọn.
// Thiết kế + căn cứ chuẩn: docs/spec/qr-truy-xuat-lo.md
// ============================================================
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { KhungQuetQr, TemLoQr, useDuLieuTruyXuat } from "@/features/shared";
import { kg, viDate } from "@/lib/format";
import {
  TEN_LOAI,
  canBangLo,
  docMaQr,
  nutLo,
  timLo,
  truyNguoc,
  truyXuoi,
  type LoaiNut,
  type NhanhCay,
  type NutLo,
} from "@/lib/truyXuatLo";
import { Badge, Button, EmptyState, Field, Input, InfoTip, notify } from "@/design-system";
import { ArrowDownRight, ArrowUpLeft, Camera, CameraOff, Printer, Scale, Search } from "lucide-react";

/** Dòng lô gọn: nhãn + mô tả; bấm vào là mở hộ chiếu của lô đó. */
function DongNut({ nut, kgNoi, onMo }: { nut: NutLo; kgNoi?: number | null; onMo: (n: NutLo) => void }) {
  const moDuoc = nut.kind !== "X" && !nut.mat;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge variant="outline">{TEN_LOAI[nut.kind]}</Badge>
      {moDuoc ? (
        <button
          type="button"
          className="font-medium text-primary underline-offset-4 hover:underline"
          title={`Mở hộ chiếu của lô ${nut.nhan}.`}
          onClick={() => onMo(nut)}
        >
          {nut.nhan}
        </button>
      ) : (
        <span className="font-medium">{nut.nhan}</span>
      )}
      <span className="text-muted-foreground">
        {[nut.moTa, nut.ngay && viDate(nut.ngay), nut.chiTiet.find((c) => c.nhan === "Đại lý")?.giaTri]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {kgNoi !== undefined && (
        <span className="tnum text-muted-foreground">{kgNoi == null ? "· chưa ghi kg" : `· ${kg(kgNoi)}`}</span>
      )}
    </div>
  );
}

/** Cây gia phả lô, lồng nhiều tầng. */
function Cay({ nhanh, onMo }: { nhanh: NhanhCay[]; onMo: (n: NutLo) => void }) {
  return (
    <ul className="space-y-2">
      {nhanh.map((n, i) => (
        <li key={`${n.nut.kind}:${n.nut.id}:${i}`} className="space-y-2">
          <DongNut nut={n.nut} kgNoi={n.kg} onMo={onMo} />
          {n.con.length > 0 && (
            <div className="ml-3 border-l-2 border-border pl-4">
              <Cay nhanh={n.con} onMo={onMo} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function QrTraCuuScreen() {
  const { dl } = useDuLieuTruyXuat();
  const [params, setParams] = useSearchParams();
  const [dangQuet, setDangQuet] = useState(false);
  const [maGo, setMaGo] = useState("");
  const [inTem, setInTem] = useState(false);

  // Mã đang tra nằm trên đường link (?lo=…) ⇒ camera điện thoại quét tem mở thẳng
  // màn này, và copy link gửi người khác là họ thấy đúng lô đó.
  const lo = params.get("lo") ?? "";
  const ketQua = useMemo(() => {
    const ma = docMaQr(lo);
    return ma ? timLo(ma, dl) : [];
  }, [lo, dl]);
  const dangXem = ketQua.length === 1 ? ketQua[0]! : null;

  const tra = (text: string) => {
    const ma = docMaQr(text);
    if (!ma) return;
    setParams("kind" in ma ? { lo: `${ma.kind}:${ma.id}` } : { lo: ma.ma });
  };
  const moLo = (n: NutLo) => {
    if (n.kind === "X") return;
    setParams({ lo: `${n.kind}:${n.id}` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const nguoc = useMemo(() => (dangXem ? truyNguoc(dangXem.kind, dangXem.id, dl) : []), [dangXem, dl]);
  const xuoi = useMemo(() => (dangXem ? truyXuoi(dangXem.kind, dangXem.id, dl) : []), [dangXem, dl]);
  const canBang = useMemo(() => (dangXem ? canBangLo(dangXem.kind, dangXem.id, dl) : null), [dangXem, dl]);

  const loiNguoc: Partial<Record<LoaiNut, string>> = {
    S: "Lô nguyên liệu là đầu chuỗi — nguồn gốc là đại lý / chuyến nhập ghi ở trên.",
    W: "Mẻ này CHƯA gắn lô nguyên liệu nào. Vào Sản xuất BTP, bấm \"Gắn lô NL\" ở dòng của mẻ.",
    P: "Phiếu đóng gói này CHƯA gắn lô bán thành phẩm nào. Vào Đóng gói, bấm \"Gắn lô BTP\".",
  };
  const loiXuoi: Partial<Record<LoaiNut, string>> = {
    S: "Lô này chưa được gắn vào mẻ sản xuất nào.",
    W: "Mẻ này chưa được gắn vào phiếu đóng gói hay lệnh xuất nào.",
    P: "Chưa ghi nhận thành phẩm này xuất đi đâu (bán lẻ gắn lô là đợt sau).",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Hộ chiếu lô — truy xuất bằng QR</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quét tem QR (camera điện thoại quét cũng mở thẳng trang này) hoặc gõ mã lô, để xem lô đó làm từ đâu và đã đi đâu.
        </p>
      </div>

      {/* Quét + gõ */}
      <div className="space-y-4 rounded-xl border-2 border-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            title={dangQuet ? "Tắt camera, quay về gõ mã lô bằng tay." : "Bật camera quét mã QR trên tem lô."}
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => setDangQuet((v) => !v)}
          >
            {dangQuet ? <CameraOff aria-hidden /> : <Camera aria-hidden />}
            {dangQuet ? "Tắt camera" : "Quét bằng camera"}
          </Button>
          <span className="text-sm text-muted-foreground">Không có camera? Gõ mã lô in trên tem.</span>
        </div>
        {dangQuet && (
          <KhungQuetQr
            onQuet={(t) => {
              setDangQuet(false);
              notify.daLuu("Đã quét tem.");
              tra(t);
            }}
          />
        )}
        {/* Điện thoại: ô và nút xếp dọc, nút full-width — đặt cạnh nhau là bóp ô thành một cột hẹp. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field
            label="Mã lô"
            hint="Mã in dưới QR trên tem. Đ-… nguyên liệu · BĐ-… bán thành phẩm · TĐ-… thành phẩm."
            className="min-w-0 flex-1"
          >
            <Input value={maGo} onChange={(e) => setMaGo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tra(maGo)} />
          </Field>
          <Button title="Tra lô theo mã vừa gõ." size="lg" className="w-full sm:w-auto" onClick={() => tra(maGo)}>
            <Search aria-hidden /> Tra
          </Button>
        </div>
      </div>

      {/* Kết quả */}
      {!lo ? (
        <EmptyState tieuDe="Chưa có mã lô" moTa="Quét tem QR hoặc gõ mã lô để xem hộ chiếu của lô." />
      ) : ketQua.length === 0 ? (
        <EmptyState
          tieuDe={`Không tìm thấy lô "${lo}"`}
          moTa="Kiểm tra lại mã. Lô bán thành phẩm / thành phẩm chỉ có từ khi mẻ hoặc phiếu đóng gói được ghi vào sổ."
        />
      ) : ketQua.length > 1 ? (
        <div className="space-y-3 rounded-xl border-2 border-border p-4">
          <p className="font-medium">
            Mã "{lo}" trùng {ketQua.length} lô (tem in trước đợt nâng cấp không đảm bảo mã duy nhất). Chọn đúng lô:
          </p>
          <ul className="space-y-2">
            {ketQua.map((n) => (
              <li key={`${n.kind}:${n.id}`}>
                <DongNut nut={n} onMo={moLo} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        dangXem && (
          <div className="space-y-4">
            {/* 1. Lô này là gì */}
            <section className="space-y-3 rounded-xl border-2 border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{TEN_LOAI[dangXem.kind]}</Badge>
                  <span className="text-xl font-semibold tnum">{dangXem.nhan}</span>
                </div>
                <Button title="In lại tem QR của lô này (tem cũ bong / mờ thì in cái mới)." variant="outline" onClick={() => setInTem(true)}>
                  <Printer aria-hidden /> In tem
                </Button>
              </div>
              <p className="text-muted-foreground">
                {[dangXem.moTa, dangXem.xuong && `xưởng ${dangXem.xuong}`].filter(Boolean).join(" · ")}
              </p>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {dangXem.chiTiet.map((c, i) => (
                  <div key={i} className="flex justify-between gap-3 border-b border-border pb-1">
                    <dt className="text-muted-foreground">{c.nhan}</dt>
                    <dd className="tnum text-right font-medium">{c.giaTri}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* 2. Cân bằng khối lượng */}
            {canBang && (
              <section className="space-y-2 rounded-xl border-2 border-border p-4">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Scale aria-hidden /> Cân bằng khối lượng
                  <InfoTip label="cân bằng khối lượng">
                    Số kg của lô trừ đi các ngả đã đi (đưa vào sản xuất, đóng gói, xuất). Còn lại âm nghĩa là dùng quá số có — nghi gõ sai kg hoặc gắn nhầm lô.
                  </InfoTip>
                </h2>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <div className="text-muted-foreground">{dangXem.kind === "S" ? "Nhận vào" : "Sản xuất"}</div>
                    <div className="tnum text-lg font-semibold">{kg(canBang.vao)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Đã đi</div>
                    {canBang.ra.length ? (
                      canBang.ra.map((r) => (
                        <div key={r.nhan} className="tnum">
                          {r.nhan}: <span className="font-semibold">{kg(r.kg)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted-foreground">chưa có</div>
                    )}
                  </div>
                  <div>
                    <div className="text-muted-foreground">Còn lại</div>
                    <div className={`tnum text-lg font-semibold ${canBang.con < 0 ? "text-destructive" : ""}`}>{kg(canBang.con)}</div>
                  </div>
                </div>
                {canBang.chuaCan > 0 && (
                  <p className="text-muted-foreground">
                    Có {canBang.chuaCan} lần gắn lô chưa ghi kg — số "còn lại" chưa trừ phần đó.
                  </p>
                )}
                {canBang.con < 0 && (
                  <p className="font-medium text-destructive">Dùng / xuất quá số kg của lô — kiểm tra lại số kg hoặc lô đã gắn.</p>
                )}
              </section>
            )}

            {/* 3. Truy ngược */}
            <section className="space-y-2 rounded-xl border-2 border-border p-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <ArrowUpLeft aria-hidden /> Truy ngược — lô này làm từ đâu
              </h2>
              {nguoc.length ? <Cay nhanh={nguoc} onMo={moLo} /> : <p className="text-muted-foreground">{loiNguoc[dangXem.kind]}</p>}
            </section>

            {/* 4. Truy xuôi */}
            <section className="space-y-2 rounded-xl border-2 border-border p-4">
              <h2 className="flex items-center gap-2 font-semibold">
                <ArrowDownRight aria-hidden /> Truy xuôi — lô này đã đi đâu
                <InfoTip label="truy xuôi">Đây là danh sách cần khi phải thu hồi: mọi mẻ, thành phẩm và lệnh xuất có dùng lô này.</InfoTip>
              </h2>
              {xuoi.length ? <Cay nhanh={xuoi} onMo={moLo} /> : <p className="text-muted-foreground">{loiXuoi[dangXem.kind]}</p>}
            </section>
          </div>
        )
      )}

      {inTem && dangXem && dangXem.kind !== "X" && (
        <TemLoQr nut={nutLo(dangXem.kind, dangXem.id, dl)} onClose={() => setInTem(false)} />
      )}
    </div>
  );
}
