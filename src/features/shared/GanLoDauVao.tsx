// ============================================================
// Hộp GẮN LÔ ĐẦU VÀO cho một đầu ra (mẻ SX BTP · phiếu đóng gói TP).
// Đây là mối nối còn thiếu của chuỗi truy xuất: "mẻ này ăn lô nào, bao nhiêu kg"
// (QĐ-6 họp 2026-09-02 · Transformation Event của EPCIS · ghi vào bảng lot_inputs).
//
// Ba đường nhập NGANG HÀNG — hàng đông hay bong tem, không để việc tắc vì tem hỏng:
//   1. QUÉT tem QR bằng camera
//   2. GÕ mã lô in trên tem
//   3. CHỌN từ danh sách lô gần đây cùng xưởng
// kg là TÙY CHỌN (chưa cân thì để trống, bổ sung sau) — gắn lô quan trọng hơn.
// Thiết kế: docs/spec/qr-truy-xuat-lo.md
// ============================================================
import { useMemo, useState } from "react";
import type { LotInput, Workshop } from "@/types";
import { useAuth } from "@/lib/auth";
import { kg as kgChu, viDate } from "@/lib/format";
import {
  TEN_LOAI,
  canBangLo,
  docMaQr,
  loBtpDeChon,
  loNlDeChon,
  timLo,
  type NutLo,
} from "@/lib/truyXuatLo";
import { Badge, Button, EmptyState, Field, FormDialog, Input, NutDong, notify } from "@/design-system";
import { Camera, CameraOff, Link2, Plus, Trash2 } from "lucide-react";
import { KhungQuetQr } from "./KhungQuetQr";
import { useDuLieuTruyXuat } from "./useDuLieuTruyXuat";

const TEN_CACH: Record<LotInput["method"], string> = { quet: "quét", go: "gõ", chon: "chọn" };

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
  /** Đóng gói: ưu tiên lô BTP cùng mặt hàng lên đầu danh sách. */
  matHangId?: string;
  onClose: () => void;
}) {
  const { dl, lotInputs, luuLotInputs } = useDuLieuTruyXuat();
  const { nguoiDung } = useAuth();
  const nguoiGhi = nguoiDung?.fullName || nguoiDung?.username || "";
  const loaiVao: "S" | "W" = outputKind === "W" ? "S" : "W";
  const tenVao = outputKind === "W" ? "lô nguyên liệu" : "lô bán thành phẩm";

  const [dangQuet, setDangQuet] = useState(false);
  const [maGo, setMaGo] = useState("");
  const [kgNhap, setKgNhap] = useState("");
  const [luaChon, setLuaChon] = useState<NutLo[]>([]); // mã trùng ⇒ cho người chọn

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

  const them = (nut: NutLo, cach: LotInput["method"]) => {
    if (nut.kind !== loaiVao) {
      notify.canhBao(`"${nut.nhan}" là ${TEN_LOAI[nut.kind].toLowerCase()}, không phải ${tenVao}.`);
      return;
    }
    if (daGan.some((l) => l.inputId === nut.id)) {
      notify.canhBao(`Lô ${nut.nhan} đã gắn rồi.`);
      return;
    }
    const soKg = kgNhap.trim() === "" ? null : Number(kgNhap.replace(",", "."));
    if (soKg != null && !(soKg > 0)) {
      notify.canhBao("Số kg phải là số dương, hoặc để trống nếu chưa cân.");
      return;
    }
    const moi: LotInput = {
      id: crypto.randomUUID(),
      outputKind,
      outputId,
      inputKind: loaiVao,
      inputId: nut.id,
      inputLabel: nut.nhan,
      material: nut.moTa,
      quantityKg: soKg,
      method: cach,
      operator: nguoiGhi,
      recordedAt: new Date().toISOString(),
    };
    luuLotInputs([...lotInputs, moi]);
    setMaGo("");
    setKgNhap("");
    setLuaChon([]);
    notify.daLuu(`Đã gắn ${tenVao} ${nut.nhan}${soKg != null ? ` · ${kgChu(soKg)}` : ""}.`);
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

  const bo = (l: LotInput) => {
    const truoc = lotInputs;
    luuLotInputs(lotInputs.filter((x) => x.id !== l.id));
    notify.daXoa(`Đã bỏ lô ${l.inputLabel}.`, () => luuLotInputs(truoc));
  };

  const dongLo = (n: NutLo, nut: React.ReactNode) => {
    const cb = canBangLo(n.kind, n.id, dl);
    return (
      <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
        <div className="min-w-0">
          <div className="font-medium">{n.nhan}</div>
          <div className="text-muted-foreground">
            {[n.moTa, n.ngay && viDate(n.ngay), n.chiTiet.find((c) => c.nhan === "Đại lý")?.giaTri, n.kg ? kgChu(n.kg) : ""]
              .filter(Boolean)
              .join(" · ")}
            {cb && cb.ra.length > 0 && ` · còn ${kgChu(cb.con)}`}
          </div>
        </div>
        {nut}
      </li>
    );
  };

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      icon={Link2}
      tieuDe={`Gắn ${tenVao} — ${outputNhan}`}
      moTa={`Ghi ${outputKind === "W" ? "mẻ sản xuất này" : "phiếu đóng gói này"} đã dùng ${tenVao} nào. Quét tem, gõ mã, hoặc chọn trong danh sách. Số kg có thể để trống nếu chưa cân.`}
      rong="rong"
      chan={<NutDong />}
    >
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="font-semibold">Đã gắn ({daGan.length})</h3>
          {daGan.length ? (
            <ul className="space-y-2">
              {daGan.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <span className="font-medium">{l.inputLabel}</span>{" "}
                    <Badge variant="outline">{TEN_CACH[l.method]}</Badge>
                    <div className="text-muted-foreground">
                      {[l.material, l.quantityKg != null ? kgChu(l.quantityKg) : "chưa ghi kg", l.operator].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    title={`Bỏ lô ${l.inputLabel} khỏi ${outputKind === "W" ? "mẻ sản xuất" : "phiếu đóng gói"} này. Còn nút Hoàn tác.`}
                    onClick={() => bo(l)}
                  >
                    <Trash2 aria-hidden /> Bỏ
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState tieuDe={`Chưa gắn ${tenVao} nào`} moTa="Chưa gắn thì hộ chiếu lô không truy được nguồn của mẻ này." />
          )}
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Thêm lô</h3>
          <Field label="Số kg đã dùng" hint="Để trống nếu chưa cân — bổ sung sau cũng được." unit="kg">
            <Input inputMode="decimal" value={kgNhap} onChange={(e) => setKgNhap(e.target.value)} />
          </Field>

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
              <Input
                value={maGo}
                onChange={(e) => setMaGo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && xuLyMa(maGo, "go")}
              />
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
            Hoặc chọn {tenVao} gần đây — xưởng {xuong} ({ungVien.length})
          </h3>
          {ungVien.length ? (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {ungVien.map((n) =>
                dongLo(
                  n,
                  <Button size="sm" variant="outline" title={`Gắn ${tenVao} ${n.nhan} cho ${outputNhan}.`} onClick={() => them(n, "chon")}>
                    Chọn
                  </Button>
                )
              )}
            </ul>
          ) : (
            <EmptyState tieuDe="Không có lô nào gần đây" moTa={`Không thấy ${tenVao} của xưởng ${xuong} trong thời gian gần ngày này.`} />
          )}
        </section>
      </div>
    </FormDialog>
  );
}
