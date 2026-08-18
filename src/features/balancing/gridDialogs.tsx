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
  dong,
  onClose,
  onLuu,
}: {
  dong: MaterialImportItem[];
  onClose: () => void;
  onLuu: (ids: string[]) => void;
}) {
  const [chon, setChon] = useState<Set<string>>(() => new Set(dong.map((r) => r.id)));
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
            Đây là các chuyến nhập trong khoảng ngày của kỳ nhưng tên loại nguyên liệu
            không khớp tên kỳ. Sổ nhập ghi tên tự do nên chuyện lệch tên là bình thường —
            tick dòng nào thuộc kỳ này.
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-base text-muted-foreground">
          Đã chọn {chon.size} dòng — {num(tongKg)} kg
        </p>

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
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
  onClose,
  onLuu,
}: {
  matHang: Product[];
  khach: Customer[];
  onThemMatHang: (ten: string) => string;
  onThemKhach: (ten: string) => string;
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
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
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
