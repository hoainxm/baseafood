// ============================================================
// Tên file: src/features/production/KhoiLoPhien.tsx
// Tên tiếng Việt: Khối "Lô nguyên liệu dùng cho phiên" (/wip — truy xuất QR đợt 2b)
// ============================================================
// Tổ trưởng khai MỘT lần các lô NL đem ra chế biến trong phiên (quét tem / gõ mã /
// chọn), thay vì gắn từng mẻ sau khi lưu. Lưu phiên ⇒ `ganLoChoPhien` (lib/truyXuatLo)
// gắn lô cho mọi thành phẩm CÙNG LOÀI và dòng bán nội địa cùng loại NL, kg để trống.
// Mẻ nào cần sửa riêng vẫn mở "Gắn lô NL" ở sổ. Lô ở đây chỉ là danh sách chọn
// (không phải danh mục) ⇒ không có thêm mới / bút chì (CLAUDE.md quy tắc 7 ngoại lệ).
import { useMemo, useState } from "react";
import type { LotInput, Workshop } from "@/types";
import { TEN_LOAI, docMaQr, loNlDeChon, nutLo, timLo, type DuLieuTruyXuat, type NutLo } from "@/lib/truyXuatLo";
import { Button, Combobox, Field, Input, Nhan, notify } from "@/design-system";
import { KhungQuetQr } from "@/features/shared";
import { Camera, CameraOff, Link2, Plus, X } from "lucide-react";
import { viDate } from "@/lib/format";

export interface LoPhien {
  nut: NutLo;
  cach: LotInput["method"];
}

export function KhoiLoPhien({
  dl,
  xuong,
  ngay,
  loPhien,
  onDoi,
}: {
  dl: DuLieuTruyXuat;
  xuong: Workshop;
  /** Ngày sản xuất của phiên — mốc lọc lô gần đây. */
  ngay: string;
  loPhien: LoPhien[];
  onDoi: (ds: LoPhien[]) => void;
}) {
  const [dangQuet, setDangQuet] = useState(false);
  const [maGo, setMaGo] = useState("");
  const [luaChon, setLuaChon] = useState<NutLo[]>([]);

  const ungVien = useMemo(
    () => loNlDeChon(dl, xuong, ngay).filter((n) => !loPhien.some((l) => l.nut.id === n.id)),
    [dl, xuong, ngay, loPhien]
  );
  const moTaLo = (n: NutLo) =>
    [n.moTa, n.ngay && viDate(n.ngay), n.chiTiet.find((c) => c.nhan === "Đại lý")?.giaTri].filter(Boolean).join(" · ");

  const them = (n: NutLo, cach: LotInput["method"]) => {
    if (n.kind !== "S") {
      notify.canhBao(`"${n.nhan}" là ${TEN_LOAI[n.kind].toLowerCase()}, không phải lô nguyên liệu.`);
      return;
    }
    if (loPhien.some((l) => l.nut.id === n.id)) {
      notify.canhBao(`Lô ${n.nhan} đã có trong phiên.`);
      return;
    }
    // Khai lô cho phiên = nháp chưa lưu ⇒ không toast (luật 13); lưu phiên mới ghi.
    onDoi([...loPhien, { nut: n, cach }]);
    setMaGo("");
    setLuaChon([]);
  };

  const xuLyMa = (text: string, cach: "quet" | "go") => {
    const ma = docMaQr(text);
    if (!ma) return;
    if ("kind" in ma && ma.kind !== "S") {
      notify.canhBao(`Tem này là ${TEN_LOAI[ma.kind].toLowerCase()}, không phải lô nguyên liệu.`);
      return;
    }
    const kq = timLo(ma, dl).filter((n) => n.kind === "S");
    if (!kq.length) {
      notify.canhBao(`Không tìm thấy lô nguyên liệu "${text}". Kiểm tra lại mã, hoặc chọn trong danh sách.`);
      return;
    }
    if (kq.length === 1) them(kq[0]!, cach);
    else {
      setLuaChon(kq);
      notify.canhBao(`Mã "${text}" trùng ${kq.length} lô — chọn đúng lô bên dưới.`);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border-2 border-border p-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-base font-semibold">
          <Link2 className="size-icon shrink-0" aria-hidden />
          Lô nguyên liệu dùng cho phiên này
        </p>
        <p className="text-sm text-muted-foreground">
          Quét tem các chuyến nguyên liệu đem ra chế biến. Lưu vào sổ là tự gắn lô cho mọi thành phẩm cùng loài
          và dòng bán nội địa cùng loại NL — khỏi gắn từng mẻ.
        </p>
      </div>

      {loPhien.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {loPhien.map((l) => (
            <li key={l.nut.id} className="flex max-w-full items-center gap-2 rounded-md border-2 border-primary/40 bg-accent/40 py-1 pl-3 pr-1">
              <span className="min-w-0">
                <span className="tnum font-semibold">{l.nut.nhan}</span>{" "}
                <span className="text-muted-foreground">{moTaLo(l.nut)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                title={`Bỏ lô ${l.nut.nhan} khỏi phiên (chưa lưu nên chưa gắn vào đâu).`}
                aria-label={`Bỏ lô ${l.nut.nhan}`}
                onClick={() => onDoi(loPhien.filter((x) => x.nut.id !== l.nut.id))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <Button
          type="button"
          className="w-full sm:w-auto"
          variant={dangQuet ? "outline" : "default"}
          title={dangQuet ? "Tắt camera." : "Mở camera quét tem QR trên sọt / thùng nguyên liệu."}
          onClick={() => setDangQuet((v) => !v)}
        >
          {dangQuet ? <CameraOff aria-hidden /> : <Camera aria-hidden />} {dangQuet ? "Tắt camera" : "Quét tem NL"}
        </Button>
        <Field label="Hoặc gõ mã lô" className="min-w-0 flex-1 sm:min-w-48">
          <Input value={maGo} onChange={(e) => setMaGo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && xuLyMa(maGo, "go")} />
        </Field>
        <Button type="button" variant="outline" className="w-full sm:w-auto" title="Tìm lô theo mã vừa gõ rồi thêm vào phiên." onClick={() => xuLyMa(maGo, "go")}>
          <Plus aria-hidden /> Thêm
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

      {luaChon.length > 0 && (
        <ul className="space-y-1">
          {luaChon.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
              <span className="min-w-0">
                <span className="font-medium">{n.nhan}</span> <span className="text-muted-foreground">{moTaLo(n)}</span>
              </span>
              <Button type="button" size="sm" title={`Thêm đúng lô ${n.nhan} này vào phiên.`} onClick={() => them(n, "go")}>
                Chọn lô này
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Combobox
        label="Hoặc chọn lô nguyên liệu"
        hint={`Lô về gần đây của xưởng ${xuong} (mới trước), sau đó lô cũ còn dở — NL cấp đông đem xả.`}
        value=""
        onChange={(id) => {
          const n = ungVien.find((u) => u.id === id) ?? (id ? nutLo("S", id, dl) : undefined);
          if (n) them(n, "chon");
        }}
        options={ungVien.map((n) => ({ value: n.id, label: n.nhan, phu: moTaLo(n) || undefined }))}
        placeholder={ungVien.length ? "— Chọn lô —" : "Không có lô gợi ý"}
        emptyText="Không thấy lô này — quét tem hoặc gõ mã lô ở trên."
      />

      {loPhien.length === 0 && (
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <Nhan loai="cho">Chưa khai lô</Nhan>
          Lưu mà chưa khai thì mẻ chưa có lô — chốt ngày sẽ hỏi gắn lô hoặc lý do.
        </p>
      )}
    </div>
  );
}
