// ============================================================
// Tên file: src/features/balancing/gridDialogs.tsx
// Tên tiếng Việt: Hộp thoại phụ của lưới cân đối
// Description: Dialogs used by the balancing grid blocks
// ============================================================
import { useState } from "react";
import type { Customer, MaterialImportItem, Product, SalesChannel } from "@/types";
import {
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Nhan,
  Textarea,
  notify,
} from "@/design-system";
import { num, viDate } from "@/lib/format";

/* ---------- Thêm dòng nguyên liệu / dòng giảm ---------- */

export function HopThemDongNL({
  laGiam,
  tieuDe,
  goiY,
  onThemLoaiNL,
  onClose,
  onLuu,
}: {
  laGiam: boolean;
  tieuDe: string;
  /** Danh mục loại NL + tên các dòng đã có trong kỳ. */
  goiY: { value: string; label: string }[];
  onThemLoaiNL: (ten: string) => string;
  onClose: () => void;
  onLuu: (ten: string) => void;
}) {
  const [ten, setTen] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tieuDe}</DialogTitle>
          <DialogDescription>
            {laGiam
              ? "Chọn đúng loại nguyên liệu đang có trong kỳ. Số nhập vào lưới sẽ được TRỪ khỏi kỳ và nhập về kho xưởng để dùng cho kỳ sau."
              : "Chọn trong danh mục, chưa có thì thêm mới ngay tại đây."}
          </DialogDescription>
        </DialogHeader>
        {/* Luôn là Combobox, kể cả dòng giảm: gõ tự do là cách chắc chắn nhất
            để "Bạch tuộc 2 da lớn" và "BT 2 da lon" thành hai dòng khác nhau. */}
        <Combobox
          label="Loại nguyên liệu"
          value={ten}
          onChange={setTen}
          options={goiY}
          onCreate={onThemLoaiNL}
        />
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            title="Thêm dòng nguyên liệu vừa chọn vào lưới của kỳ."
            size="lg"
            onClick={() => {
              const t = ten.trim();
              if (!t) {
                notify.loi("Chưa chọn loại nguyên liệu");
                return;
              }
              onLuu(t);
            }}
          >
            Thêm dòng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Chọn tay dòng sổ nhập để hút ---------- */

export function HopChonDongNhap({
  dong: dongVao,
  kyDangGiu,
  cungHo,
  tenLoaiKy,
  onClose,
  onLuu,
}: {
  dong: MaterialImportItem[];
  /** Id các dòng đang thuộc kỳ KHÁC — tick là kéo về kỳ đang mở. */
  kyDangGiu: Set<string>;
  /** Dòng có cùng họ nguyên liệu với kỳ không. */
  cungHo: (r: MaterialImportItem) => boolean;
  /** Tên loại NL của kỳ (để nói rõ "khác loại" so với cái gì). */
  tenLoaiKy: string;
  onClose: () => void;
  onLuu: (ids: string[]) => void;
}) {
  /* Dòng CÙNG loại lên trước, dòng khác loại xuống cuối — mắt đọc từ trên xuống. */
  const dong = [...dongVao].sort(
    (a, b) => Number(cungHo(b)) - Number(cungHo(a)) || a.deliveryDate.localeCompare(b.deliveryDate)
  );
  /* Chỉ tick sẵn dòng CÙNG loại mà chưa kỳ nào giữ. Trước đây tick sẵn MỌI dòng chưa
     gắn kỳ — kể cả khác loại — nên kỳ "Bạch tuộc 2 da" tạo trùng ngày bấm vào là kéo
     luôn các chuyến 1 da. Dòng khác loại / đang thuộc kỳ khác: người dùng tự tick. */
  const [chon, setChon] = useState<Set<string>>(
    () => new Set(dong.filter((r) => !kyDangGiu.has(r.id) && cungHo(r)).map((r) => r.id))
  );
  const soKhacLoaiDaTick = dong.filter((r) => chon.has(r.id) && !cungHo(r)).length;
  const doi = (id: string) =>
    setChon((cu) => {
      const moi = new Set(cu);
      if (moi.has(id)) moi.delete(id);
      else moi.add(id);
      return moi;
    });
  const tongKg = dong
    .filter((r) => chon.has(r.id))
    .reduce((s, r) => s + r.quantityKg, 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Chọn dòng nhập hàng đưa vào kỳ</DialogTitle>
          <DialogDescription>
            Các chuyến nhập trong khoảng ngày của kỳ nhưng khác loại nguyên liệu, hoặc
            đang thuộc một kỳ khác. Kỳ này là <strong>{tenLoaiKy}</strong> — dòng khác loại
            chỉ tick khi chắc đó là chuyến ghi nhầm tên. Dòng đang thuộc kỳ khác mà tick
            thì sẽ được KÉO khỏi kỳ đó.
          </DialogDescription>
        </DialogHeader>

        <div className="scroll-nice max-h-96 overflow-y-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr>
                <th className="border-b-2 border-border bg-card px-3 py-2 text-left">Lấy</th>
                <th className="border-b-2 border-border bg-card px-3 py-2 text-left">Ngày</th>
                <th className="border-b-2 border-border bg-card px-3 py-2 text-left">
                  Loại nguyên liệu
                </th>
                <th className="border-b-2 border-border bg-card px-3 py-2 text-left">Đại lý</th>
                <th className="border-b-2 border-border bg-card px-3 py-2 text-right">kg</th>
                <th className="border-b-2 border-border bg-card px-3 py-2 text-left">
                  Tình trạng
                </th>
              </tr>
            </thead>
            <tbody>
              {dong.map((r) => (
                <tr key={r.id}>
                  <td className="border-b border-border px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-6"
                      checked={chon.has(r.id)}
                      onChange={() => doi(r.id)}
                      aria-label={`Lấy dòng ${r.materialTypeName} ngày ${viDate(r.deliveryDate)}`}
                    />
                  </td>
                  <td className="border-b border-border px-3 py-2">{viDate(r.deliveryDate)}</td>
                  <td className="border-b border-border px-3 py-2">{r.materialTypeName}</td>
                  <td className="border-b border-border px-3 py-2">{r.supplierName}</td>
                  <td className="tnum border-b border-border px-3 py-2 text-right">
                    {num(r.quantityKg)}
                  </td>
                  <td className="border-b border-border px-3 py-2">
                    <span className="inline-flex flex-wrap gap-1">
                      {!cungHo(r) && <Nhan loai="loi">Khác loại</Nhan>}
                      {kyDangGiu.has(r.id) ? (
                        <Nhan loai="luu-y">Đang thuộc kỳ khác</Nhan>
                      ) : (
                        <Nhan loai="cho">Chưa gắn kỳ</Nhan>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-base text-muted-foreground">
          Đã chọn {chon.size} dòng — {num(tongKg)} kg
        </p>
        {soKhacLoaiDaTick > 0 && (
          <p className="rounded-lg bg-warning-surface px-4 py-2.5 text-base font-medium text-destructive">
            ⚠ Đang tick {soKhacLoaiDaTick} dòng KHÁC loại {tenLoaiKy} — số của chúng sẽ cộng vào
            nguyên liệu của kỳ này.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            title="Đưa các dòng đang tick từ sổ nhập vào kỳ cân đối này."
            size="lg"
            onClick={() => {
              if (chon.size === 0) {
                notify.loi("Chưa tick dòng nào");
                return;
              }
              onLuu([...chon]);
            }}
          >
            Đưa {chon.size} dòng vào kỳ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Thêm mặt hàng vào lưới bán thành phẩm ---------- */

export function HopThemMatHang({
  matHang,
  khach,
  onThemMatHang,
  onThemKhach,
  onSuaMatHang,
  onSuaKhach,
  onClose,
  onLuu,
}: {
  matHang: Product[];
  khach: Customer[];
  onThemMatHang: (ten: string) => string;
  onThemKhach: (ten: string) => string;
  /** Bút chì sửa nhanh bản ghi danh mục (value = id). */
  onSuaMatHang?: (id: string) => void;
  onSuaKhach?: (id: string) => void;
  onClose: () => void;
  onLuu: (matHangId: string, khachId: string, quyCach: string, kenh: SalesChannel) => void;
}) {
  const [matHangId, setMatHangId] = useState("");
  const [khachId, setKhachId] = useState("");
  const [quyCach, setQuyCach] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm mặt hàng vào lưới</DialogTitle>
          <DialogDescription>
            Một mặt hàng × một quy cách là một dòng. Sản lượng từng ngày gõ thẳng vào lưới.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Combobox
            label="Mặt hàng"
            value={matHangId}
            onChange={setMatHangId}
            options={matHang.map((m) => ({ value: m.id, label: m.name }))}
            onCreate={onThemMatHang}
            onSuaMuc={onSuaMatHang}
            nhanSua="Sửa thông tin mặt hàng này — lưu thẳng vào Danh mục."
          />
          <Field label="Quy cách">
            <Input
              value={quyCach}
              onChange={(e) => setQuyCach(e.target.value)}
              placeholder="230-250"
            />
          </Field>
          <Combobox
            label="Khách hàng"
            value={khachId}
            onChange={setKhachId}
            options={khach.map((k) => ({ value: k.id, label: k.name }))}
            onCreate={onThemKhach}
            onSuaMuc={onSuaKhach}
            nhanSua="Sửa thông tin khách hàng này — lưu thẳng vào Danh mục."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            title="Thêm mặt hàng vừa chọn vào lưới thành phẩm của kỳ."
            size="lg"
            onClick={() => {
              if (!matHangId) {
                notify.loi("Chưa chọn mặt hàng");
                return;
              }
              onLuu(matHangId, khachId, quyCach.trim(), "Xuất khẩu");
            }}
          >
            Thêm vào lưới
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Lý do ghi bù khi sửa ngày đã chốt ---------- */

export function HopLyDoGhiBu({
  ngay,
  onClose,
  onLuu,
}: {
  ngay: string;
  onClose: () => void;
  onLuu: (lyDo: string) => void;
}) {
  const [lyDo, setLyDo] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ngày {viDate(ngay)} đã chốt</DialogTitle>
          <DialogDescription>
            Số của ngày này đã được chốt và có thể đã gửi đi. Sửa vẫn được, nhưng phải ghi
            lý do để sau này giải trình được.
          </DialogDescription>
        </DialogHeader>
        <Field label="Lý do ghi bù">
          <Textarea
            value={lyDo}
            onChange={(e) => setLyDo(e.target.value)}
            placeholder="Cân lại ca chiều, sót một mẻ"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            title="Ghi số vừa sửa kèm lý do. Lý do được lưu vết để đối chiếu về sau."
            size="lg"
            onClick={() => {
              if (!lyDo.trim()) {
                notify.loi("Chưa ghi lý do");
                return;
              }
              onLuu(lyDo.trim());
            }}
          >
            Lưu số mới
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Chốt kỳ / mở lại kỳ ---------- */

export function HopChotKy({
  daChot,
  tenKy,
  tongTP,
  onClose,
  onLuu,
}: {
  daChot: boolean;
  tenKy: string;
  tongTP: string;
  onClose: () => void;
  onLuu: (ghiChu: string) => void;
}) {
  const [ghiChu, setGhiChu] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{daChot ? "Mở lại kỳ đã chốt?" : "Chốt kỳ này?"}</DialogTitle>
          <DialogDescription>
            {daChot
              ? `Kỳ "${tenKy}" đang khoá. Mở lại để sửa số — hệ thống giữ vết ai mở và vì sao, không xoá dấu đã chốt.`
              : `Chốt kỳ "${tenKy}" (${tongTP}). Sau khi chốt, mọi ô trong lưới khoá lại để số đã gửi kế toán không bị đổi âm thầm. Vẫn mở lại được.`}
          </DialogDescription>
        </DialogHeader>
        <Field label={daChot ? "Lý do mở lại" : "Ghi chú khi chốt"}>
          <Textarea
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
            placeholder={daChot ? "Kế toán báo lệch 12 kg mặt hàng luộc 230-250" : "Đã đối chiếu với bảng phụ, gửi kế toán"}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            title="Khóa kỳ lại để chốt số, hoặc mở khóa nếu cần sửa. Mở lại BẮT BUỘC ghi lý do."
            size="lg"
            onClick={() => {
              /* Mở lại BẮT BUỘC có lý do — giống mở lại ngày đã chốt ở sổ nhập.
                 Chốt thì ghi chú không bắt buộc. */
              if (daChot && !ghiChu.trim()) {
                notify.loi("Chưa ghi lý do mở lại");
                return;
              }
              onLuu(ghiChu.trim());
            }}
          >
            {daChot ? "Mở lại kỳ" : "Chốt kỳ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
