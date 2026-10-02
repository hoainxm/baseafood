// ============================================================
// IN TEM HÀNG LOẠT — tab của màn /qr.
// Một chỗ duy nhất để in tem cho mọi lô (NL · BTP · TP) theo ngày / xưởng / loại,
// in nhiều tem một lượt thay vì đi từng màn bấm từng nút "Tem".
// Danh sách lô lấy qua dsLoDeIn (lib/truyXuatLo, hàm thuần có test).
// Thiết kế: docs/spec/qr-truy-xuat-lo.md §8
// ============================================================
import { useMemo, useState } from "react";
import type { LotKind, Workshop } from "@/types";
import { TemLoQr, useDuLieuTruyXuat } from "@/features/shared";
import { kg, viDate } from "@/lib/format";
import { TEN_LOAI, dsLoDeIn, type NutLo } from "@/lib/truyXuatLo";
import { Button, ChoiceGroup, DateRangeField, EmptyState, Nhan, congNgay, homNay, notify, sacTheoTen } from "@/design-system";
import { Printer } from "lucide-react";

const LOAI: { kind: LotKind; moTa: string }[] = [
  { kind: "S", moTa: "chuyến nhập" },
  { kind: "W", moTa: "mẻ sản xuất" },
  { kind: "P", moTa: "phiếu đóng gói" },
];
const khoaNut = (n: NutLo) => `${n.kind}:${n.id}`;

export function InTemHangLoat() {
  const { dl } = useDuLieuTruyXuat();
  const [tu, setTu] = useState(() => congNgay(homNay(), -6));
  const [den, setDen] = useState(homNay);
  const [xuong, setXuong] = useState<Workshop | "">("");
  const [loai, setLoai] = useState<LotKind[]>(["S", "W", "P"]);
  // Lưu những lô người dùng BỎ chọn (mặc định chọn hết) — đổi bộ lọc thì lô mới vào vẫn được chọn.
  const [boChon, setBoChon] = useState<Set<string>>(new Set());
  const [dangIn, setDangIn] = useState<NutLo[] | null>(null);

  const ds = useMemo(() => dsLoDeIn(dl, { tu, den, xuong, loai }), [dl, tu, den, xuong, loai]);
  const daChon = ds.filter((n) => !boChon.has(khoaNut(n)));

  const doiLoai = (k: LotKind) =>
    setLoai((cu) => (cu.includes(k) ? cu.filter((x) => x !== k) : [...cu, k]));
  const doiChon = (n: NutLo) =>
    setBoChon((cu) => {
      const moi = new Set(cu);
      const k = khoaNut(n);
      if (moi.has(k)) moi.delete(k);
      else moi.add(k);
      return moi;
    });
  const chonHet = (chon: boolean) =>
    setBoChon(chon ? new Set() : new Set(ds.map(khoaNut)));

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl border-2 border-border p-4">
        <div className="grid gap-4">
          <DateRangeField
            label="Ngày của lô"
            hint="Ngày hàng về (nguyên liệu) · ngày sản xuất (bán thành phẩm) · ngày đóng gói (thành phẩm)."
            startDate={tu}
            endDate={den}
            onChange={(a, b) => {
              setTu(a);
              setDen(b);
            }}
            anNhanBatBuoc
          />
          <ChoiceGroup
            label="Phân xưởng"
            value={xuong}
            onChange={(v) => setXuong(v as Workshop | "")}
            options={[{ value: "", label: "Tất cả" }, ...(["Đông", "Cá", "Khô"] as const).map((x) => ({ value: x, label: x }))]}
            cot={4}
            anNhanBatBuoc
          />
        </div>
        <div className="space-y-2">
          <p className="font-medium">Loại lô</p>
          <div className="flex flex-wrap gap-2">
            {LOAI.map(({ kind, moTa }) => (
              <Button
                key={kind}
                type="button"
                variant={loai.includes(kind) ? "default" : "outline"}
                title={`${loai.includes(kind) ? "Bỏ" : "Thêm"} tem ${TEN_LOAI[kind].toLowerCase()} (${moTa}) khỏi danh sách in.`}
                aria-pressed={loai.includes(kind)}
                onClick={() => doiLoai(kind)}
              >
                {TEN_LOAI[kind]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {ds.length === 0 ? (
        <EmptyState
          tieuDe="Không có lô nào trong khoảng này"
          moTa="Nới khoảng ngày, chọn thêm loại lô hoặc đổi phân xưởng."
        />
      ) : (
        <div className="space-y-3 rounded-xl border-2 border-border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Đã chọn <span className="tnum font-semibold text-foreground">{daChon.length}</span> / {ds.length} lô
            </p>
            <div className="flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
              <Button
                type="button"
                variant="outline"
                title={daChon.length === ds.length ? "Bỏ chọn mọi lô trong danh sách." : "Chọn mọi lô trong danh sách để in."}
                onClick={() => chonHet(daChon.length !== ds.length)}
              >
                {daChon.length === ds.length ? "Bỏ chọn hết" : "Chọn hết"}
              </Button>
              <Button
                type="button"
                title="Mở bản in cho các lô đang chọn, mỗi tem một nhãn đúng khổ tem."
                onClick={() => (daChon.length ? setDangIn(daChon) : notify.canhBao("Chưa chọn lô nào để in."))}
              >
                <Printer aria-hidden /> In {daChon.length} tem
              </Button>
            </div>
          </div>

          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {ds.map((n) => {
              const k = khoaNut(n);
              const chon = !boChon.has(k);
              const daiLy = n.chiTiet.find((c) => c.nhan === "Đại lý")?.giaTri;
              return (
                <li key={k}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted">
                    <input
                      type="checkbox"
                      className="mt-1 size-5 shrink-0"
                      checked={chon}
                      onChange={() => doiChon(n)}
                      aria-label={`In tem lô ${n.nhan}`}
                    />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <Nhan loai="phan-loai" sac={sacTheoTen(TEN_LOAI[n.kind])}>{TEN_LOAI[n.kind]}</Nhan>
                        <span className="tnum font-semibold">{n.nhan}</span>
                      </span>
                      <span className="block text-muted-foreground">
                        {[n.moTa, viDate(n.ngay), n.xuong && `xưởng ${n.xuong}`, daiLy, n.kg ? kg(n.kg) : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {dangIn && <TemLoQr nuts={dangIn} onClose={() => setDangIn(null)} />}
    </div>
  );
}
