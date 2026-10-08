// ============================================================
// Hộp GẮN LÔ — mối nối của chuỗi truy xuất (docs/spec/qr-truy-xuat-lo.md).
//   • GanLoDauVao: đầu ra (mẻ SX BTP · phiếu đóng gói TP) đã dùng lô nào
//     ⇒ bảng lot_inputs (Transformation Event của EPCIS, mig 0046).
//   • GanLoXuat:   hàng ra (dòng bán lẻ · bán nội địa NL) lấy từ lô nào
//     ⇒ bảng lot_dispatches (mig 0056).
//
// Ba đường nhập NGANG HÀNG — hàng đông hay bong tem, không để việc tắc vì tem hỏng:
//   1. QUÉT tem QR bằng camera
//   2. GÕ mã lô in trên tem
//   3. CHỌN từ danh sách lô gợi ý
// kg là TÙY CHỌN (chưa cân thì để trống, bổ sung sau) — gắn lô quan trọng hơn.
// ============================================================
import { useMemo, useState, type ReactNode } from "react";
import type { LotDispatch, LotDispatchDoc, LotInput, LotKind, Workshop } from "@/types";
import { useAuth } from "@/lib/auth";
import { kg as kgChu, viDate } from "@/lib/format";
import {
  TEN_LOAI,
  canBangLo,
  docMaQr,
  loBtpDeChon,
  loNlDeChon,
  nutLo,
  timLo,
  tonKhoCuaLo,
  type DuLieuTruyXuat,
  type NutLo,
} from "@/lib/truyXuatLo";
import { Button, EmptyState, Field, FormDialog, Input, Nhan, NumberField, NutDong, notify } from "@/design-system";
import { Camera, CameraOff, Link2, Plus, Trash2 } from "lucide-react";
import { KhungQuetQr } from "./KhungQuetQr";
import { useDuLieuTruyXuat } from "./useDuLieuTruyXuat";

const TEN_CACH: Record<LotInput["method"] | LotDispatch["method"], string> = { quet: "quét", go: "gõ", chon: "chọn", fifo: "máy chọn" };

/** Một mối nối đã gắn, hiện trong mục "Đã gắn". */
interface MoiDaGan {
  id: string;
  nhan: string;
  moTa: string;
  kg: number | null;
  cach: LotInput["method"] | LotDispatch["method"];
  nguoi: string;
}

/**
 * Lõi dùng chung: quét / gõ / chọn lô, kg tùy chọn, danh sách đã gắn (bỏ được,
 * có Hoàn tác). Bên gọi quyết định ghi vào bảng nào qua `onThem` / `onBo`.
 */
function HopGanLo({
  tieuDe,
  moTa,
  loaiVao,
  tenVao,
  dl,
  daGan,
  ungVien,
  tieuDeUngVien,
  kiemNut,
  onThem,
  onBo,
  onClose,
}: {
  tieuDe: string;
  moTa: string;
  loaiVao: LotKind;
  tenVao: string;
  dl: DuLieuTruyXuat;
  daGan: MoiDaGan[];
  ungVien: NutLo[];
  tieuDeUngVien: string;
  /** Kiểm thêm (VD đúng mặt hàng). Trả câu cảnh báo để chặn, hoặc null. */
  kiemNut?: (n: NutLo) => string | null;
  onThem: (nut: NutLo, cach: LotInput["method"], kg: number | null) => void;
  onBo: (id: string) => void;
  onClose: () => void;
}) {
  const [dangQuet, setDangQuet] = useState(false);
  const [maGo, setMaGo] = useState("");
  const [kgNhap, setKgNhap] = useState<number | null>(null);
  const [luaChon, setLuaChon] = useState<NutLo[]>([]); // mã trùng ⇒ cho người chọn

  const them = (nut: NutLo, cach: LotInput["method"]) => {
    if (nut.kind !== loaiVao) {
      notify.canhBao(`"${nut.nhan}" là ${TEN_LOAI[nut.kind].toLowerCase()}, không phải ${tenVao}.`);
      return;
    }
    const chan = kiemNut?.(nut); // gồm cả "đã gắn rồi" — bên gọi biết id lô của mối nối
    if (chan) {
      notify.canhBao(chan);
      return;
    }
    if (kgNhap != null && !(kgNhap > 0)) {
      notify.canhBao("Số kg phải là số dương, hoặc để trống nếu chưa cân.");
      return;
    }
    onThem(nut, cach, kgNhap);
    setMaGo("");
    setKgNhap(null);
    setLuaChon([]);
  };

  /** Mã quét/gõ → lô. Trùng nhiều lô (tem cũ) ⇒ hiện danh sách cho chọn, KHÔNG tự chọn. */
  const xuLyMa = (text: string, cach: "quet" | "go") => {
    const ma = docMaQr(text);
    if (!ma) return;
    const kq = timLo(ma, dl);
    if (!kq.length) {
      notify.canhBao(`Không tìm thấy lô "${text}". Kiểm tra lại mã, hoặc chọn trong danh sách bên dưới.`);
      return;
    }
    if (kq.length === 1) them(kq[0]!, cach);
    else {
      setLuaChon(kq);
      notify.canhBao(`Mã "${text}" trùng ${kq.length} lô — chọn đúng lô bên dưới.`);
    }
  };

  const dongLo = (n: NutLo, nut: ReactNode) => {
    const cb = canBangLo(n.kind, n.id, dl);
    const ton = tonKhoCuaLo(n.kind, n.id, dl);
    return (
      <li key={`${n.kind}:${n.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
        <div className="min-w-0">
          <div className="font-medium">{n.nhan}</div>
          <div className="text-muted-foreground">
            {[n.moTa, n.ngay && viDate(n.ngay), n.chiTiet.find((c) => c.nhan === "Đại lý")?.giaTri, n.kg ? kgChu(n.kg) : ""]
              .filter(Boolean)
              .join(" · ")}
            {ton != null ? ` · tồn kho ${kgChu(ton)}` : cb && cb.ra.length > 0 ? ` · còn ${kgChu(cb.con)}` : ""}
          </div>
        </div>
        {nut}
      </li>
    );
  };

  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} icon={Link2} tieuDe={tieuDe} moTa={moTa} rong="rong" chan={<NutDong />}>
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="font-semibold">Đã gắn ({daGan.length})</h3>
          {daGan.length ? (
            <ul className="space-y-2">
              {daGan.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <span className="font-medium">{g.nhan}</span> <Nhan loai="nguon">{TEN_CACH[g.cach]}</Nhan>
                    <div className="text-muted-foreground">
                      {[g.moTa, g.kg != null ? kgChu(g.kg) : "chưa ghi kg", g.nguoi].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" title={`Bỏ lô ${g.nhan}. Còn nút Hoàn tác.`} onClick={() => onBo(g.id)}>
                    <Trash2 aria-hidden /> Bỏ
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState tieuDe={`Chưa gắn ${tenVao} nào`} moTa="Chưa gắn thì hộ chiếu lô không truy được đoạn này." />
          )}
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Thêm lô</h3>
          <NumberField label="Số kg" hint="Để trống nếu chưa cân — bổ sung sau cũng được." unit="kg" value={kgNhap} onChange={setKgNhap} />

          <div className="flex flex-wrap gap-2">
            <Button
              className="w-full sm:w-auto"
              variant={dangQuet ? "outline" : "default"}
              title={dangQuet ? "Tắt camera." : "Mở camera để quét tem QR trên thùng hàng. Quét xong là tự gắn lô."}
              onClick={() => setDangQuet((v) => !v)}
            >
              {dangQuet ? <CameraOff aria-hidden /> : <Camera aria-hidden />} {dangQuet ? "Tắt camera" : "Quét tem QR"}
            </Button>
          </div>
          {dangQuet && (
            <KhungQuetQr
              onQuet={(t) => {
                setDangQuet(false);
                xuLyMa(t, "quet");
              }}
            />
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Hoặc gõ mã lô in trên tem" className="min-w-0 flex-1">
              <Input value={maGo} onChange={(e) => setMaGo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && xuLyMa(maGo, "go")} />
            </Field>
            <Button variant="outline" className="w-full sm:w-auto" title="Tìm lô theo mã vừa gõ rồi gắn vào." onClick={() => xuLyMa(maGo, "go")}>
              <Plus aria-hidden /> Gắn
            </Button>
          </div>

          {luaChon.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium">Mã trùng nhiều lô — chọn đúng lô:</p>
              <ul className="space-y-2">
                {luaChon.map((n) =>
                  dongLo(
                    n,
                    <Button size="sm" title={`Gắn đúng lô ${n.nhan} này.`} onClick={() => them(n, "go")}>
                      Chọn lô này
                    </Button>
                  )
                )}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">
            {tieuDeUngVien} ({ungVien.length})
          </h3>
          {ungVien.length ? (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {ungVien.map((n) =>
                dongLo(
                  n,
                  <Button size="sm" variant="outline" title={`Gắn ${tenVao} ${n.nhan}.`} onClick={() => them(n, "chon")}>
                    Chọn
                  </Button>
                )
              )}
            </ul>
          ) : (
            <EmptyState tieuDe="Không có lô gợi ý" moTa="Quét tem hoặc gõ mã lô ở trên." />
          )}
        </section>
      </div>
    </FormDialog>
  );
}

/** Họ tên người đang đăng nhập — ghi vào mối nối (KDE "Ai"). */
function useNguoiGhi() {
  const { nguoiDung } = useAuth();
  return nguoiDung?.fullName || nguoiDung?.username || "";
}

export function GanLoDauVao({
  outputKind,
  outputId,
  outputNhan,
  xuong,
  ngay,
  matHangId,
  onClose,
}: {
  /** W = mẻ SX BTP (ăn lô NL) · P = phiếu đóng gói (ăn lô BTP) */
  outputKind: "W" | "P";
  outputId: string;
  outputNhan: string;
  xuong: Workshop;
  /** Ngày của đầu ra (yyyy-mm-dd) — mốc lọc danh sách lô gần đây. */
  ngay: string;
  /** Đóng gói: lô BTP phải cùng mặt hàng BTP tiêu hao (để sổ tồn trừ đúng lô). */
  matHangId?: string;
  onClose: () => void;
}) {
  const { dl, lotInputs, luuLotInputs } = useDuLieuTruyXuat();
  const nguoiGhi = useNguoiGhi();
  const loaiVao: "S" | "W" = outputKind === "W" ? "S" : "W";
  const tenVao = outputKind === "W" ? "lô nguyên liệu" : "lô bán thành phẩm";

  const daGan = useMemo(
    () => lotInputs.filter((l) => l.outputKind === outputKind && l.outputId === outputId),
    [lotInputs, outputKind, outputId]
  );
  const ungVien = useMemo(
    () =>
      (outputKind === "W" ? loNlDeChon(dl, xuong, ngay) : loBtpDeChon(dl, xuong, ngay, 120, matHangId)).filter(
        (n) => !daGan.some((l) => l.inputId === n.id)
      ),
    [dl, outputKind, xuong, ngay, matHangId, daGan]
  );

  return (
    <HopGanLo
      tieuDe={`Gắn ${tenVao} — ${outputNhan}`}
      moTa={`Ghi ${outputKind === "W" ? "mẻ sản xuất này" : "phiếu đóng gói này"} đã dùng ${tenVao} nào. Quét tem, gõ mã, hoặc chọn trong danh sách. Số kg có thể để trống nếu chưa cân.`}
      loaiVao={loaiVao}
      tenVao={tenVao}
      dl={dl}
      daGan={daGan.map((l) => ({ id: l.id, nhan: l.inputLabel, moTa: l.material, kg: l.quantityKg, cach: l.method, nguoi: l.operator }))}
      ungVien={ungVien}
      tieuDeUngVien={`Hoặc chọn ${tenVao} — xưởng ${xuong}`}
      kiemNut={(n) => {
        if (daGan.some((l) => l.inputId === n.id)) return `Lô ${n.nhan} đã gắn rồi.`;
        if (outputKind === "P" && matHangId) {
          const w = dl.wips.find((x) => x.id === n.id);
          if (w && w.productId !== matHangId)
            return `Lô ${n.nhan} là "${n.moTa}", khác mặt hàng BTP của phiếu. Đổi mặt hàng BTP tiêu hao của phiếu trước, hoặc chọn đúng lô.`;
        }
        return null;
      }}
      onThem={(nut, cach, kg) => {
        const moi: LotInput = {
          id: crypto.randomUUID(),
          outputKind,
          outputId,
          inputKind: loaiVao,
          inputId: nut.id,
          inputLabel: nut.nhan,
          material: nut.moTa,
          quantityKg: kg,
          method: cach,
          operator: nguoiGhi,
          recordedAt: new Date().toISOString(),
        };
        luuLotInputs([...lotInputs, moi]);
        notify.daLuu(`Đã gắn ${tenVao} ${nut.nhan}${kg != null ? ` · ${kgChu(kg)}` : ""}.`);
      }}
      onBo={(id) => {
        const truoc = lotInputs;
        const l = lotInputs.find((x) => x.id === id);
        luuLotInputs(lotInputs.filter((x) => x.id !== id));
        notify.daXoa(`Đã bỏ lô ${l?.inputLabel ?? ""}.`, () => luuLotInputs(truoc));
      }}
      onClose={onClose}
    />
  );
}

/**
 * Gắn lô cho HÀNG RA: dòng bán lẻ (block thô ⇒ lô BTP `W` · đóng gói ⇒ lô TP `P`)
 * hoặc dòng bán nội địa NL (⇒ lô NL `S`). Ghi `lot_dispatches` (mig 0056). Lô
 * phải cùng mặt hàng với dòng bán để sổ tồn trừ đúng lô.
 */
export function GanLoXuat({
  docKind,
  docId,
  docNhan,
  loaiLo,
  xuong,
  ngay,
  matHangId,
  onClose,
}: {
  docKind: Exclude<LotDispatchDoc, "export_item">;
  docId: string;
  docNhan: string;
  loaiLo: LotKind;
  xuong: Workshop;
  ngay: string;
  /** Mặt hàng của dòng bán (bán lẻ) — lô phải cùng mặt hàng. */
  matHangId?: string;
  onClose: () => void;
}) {
  const { dl, lotDispatches, luuLotDispatches } = useDuLieuTruyXuat();
  const nguoiGhi = useNguoiGhi();
  const tenVao = loaiLo === "S" ? "lô nguyên liệu" : loaiLo === "W" ? "lô bán thành phẩm" : "lô thành phẩm";

  const daGan = useMemo(
    () => lotDispatches.filter((d) => d.docKind === docKind && d.docId === docId),
    [lotDispatches, docKind, docId]
  );
  const matHangCua = (n: NutLo) =>
    n.kind === "W" ? dl.wips.find((w) => w.id === n.id)?.productId : n.kind === "P" ? dl.packagings.find((p) => p.id === n.id)?.toProductId : undefined;

  /** Gợi ý: lô cùng mặt hàng còn tồn, lô cũ trước (FIFO). NL: như khi gắn cho mẻ SX. */
  const ungVien = useMemo(() => {
    const chuaGan = (n: NutLo) => !daGan.some((d) => d.lotId === n.id);
    if (loaiLo === "S") return loNlDeChon(dl, xuong, ngay).filter(chuaGan);
    const ds =
      loaiLo === "W"
        ? dl.wips.filter((w) => w.status === "da-nhap" && (!matHangId || w.productId === matHangId)).map((w) => nutLo("W", w.id, dl))
        : dl.packagings.filter((p) => !matHangId || p.toProductId === matHangId).map((p) => nutLo("P", p.id, dl));
    return ds
      .filter((n) => chuaGan(n) && (tonKhoCuaLo(n.kind, n.id, dl) ?? 0) > 0)
      .sort((a, b) => a.ngay.localeCompare(b.ngay));
  }, [dl, loaiLo, xuong, ngay, matHangId, daGan]);

  return (
    <HopGanLo
      tieuDe={`Gắn ${tenVao} — ${docNhan}`}
      moTa="Ghi hàng này lấy từ lô nào để truy xuất tới được khách. Quét tem trên thùng, gõ mã, hoặc chọn lô còn tồn. Số kg có thể để trống nếu chưa cân."
      loaiVao={loaiLo}
      tenVao={tenVao}
      dl={dl}
      daGan={daGan.map((d) => ({ id: d.id, nhan: d.lotLabel, moTa: "", kg: d.quantityKg, cach: d.method, nguoi: d.operator }))}
      ungVien={ungVien}
      tieuDeUngVien={loaiLo === "S" ? `Hoặc chọn lô NL — xưởng ${xuong}` : "Hoặc chọn lô còn tồn — cũ trước"}
      kiemNut={(n) => {
        if (daGan.some((d) => d.lotId === n.id)) return `Lô ${n.nhan} đã gắn rồi.`;
        const mh = matHangCua(n);
        if (matHangId && mh && mh !== matHangId) return `Lô ${n.nhan} là "${n.moTa}", khác mặt hàng của dòng bán.`;
        return null;
      }}
      onThem={(nut, cach, kg) => {
        const moi: LotDispatch = {
          id: crypto.randomUUID(),
          lotKind: loaiLo,
          lotId: nut.id,
          lotLabel: nut.nhan,
          docKind,
          docId,
          quantityKg: kg,
          method: cach,
          operator: nguoiGhi,
          recordedAt: new Date().toISOString(),
        };
        luuLotDispatches([...lotDispatches, moi]);
        notify.daLuu(`Đã gắn ${tenVao} ${nut.nhan}${kg != null ? ` · ${kgChu(kg)}` : ""}.`);
      }}
      onBo={(id) => {
        const truoc = lotDispatches;
        const d = lotDispatches.find((x) => x.id === id);
        luuLotDispatches(lotDispatches.filter((x) => x.id !== id));
        notify.daXoa(`Đã bỏ lô ${d?.lotLabel ?? ""}.`, () => luuLotDispatches(truoc));
      }}
      onClose={onClose}
    />
  );
}
