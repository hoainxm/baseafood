// ============================================================
// Tên file: src/features/imports/BulkTypeChange.tsx
// Tên tiếng Việt: Đổi loại nguyên liệu hàng loạt
// Description: Bulk material-type reassignment for import rows
// ============================================================
import { useMemo, useState } from "react";
import type { MaterialImportItem, MaterialType } from "@/types";
import {
  Button,
  Combobox,
  DateRangeField,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  notify,
} from "@/design-system";
import { num, viDate } from "@/lib/format";
import { Layers } from "lucide-react";

/**
 * Đổi loại nguyên liệu cho NHIỀU dòng sổ nhập một lần.
 *
 * Vì sao cần: migration `0019` tách "Bạch tuộc 2 da" thành lớn (80↑) / nhỏ
 * (80↓) và đổi TOÀN BỘ dữ liệu cũ sang size lớn — đó là chốt của người dùng,
 * nhưng thực tế một phần là hàng nhỏ. Sửa từng chuyến trong sổ là hàng trăm lần
 * mở hộp thoại; đây là chỗ tick một lượt.
 *
 * Chỉ đụng cột `materialTypeName` của sổ nhập. KHÔNG đụng kg, giá, ngày, chuyến.
 */
export function HopDoiLoaiHangLoat({
  rows,
  loaiNL,
  onThemLoaiNL,
  onClose,
  onLuu,
}: {
  rows: MaterialImportItem[];
  loaiNL: MaterialType[];
  onThemLoaiNL: (ten: string) => string;
  onClose: () => void;
  onLuu: (ids: string[], loaiDich: string) => void;
}) {
  const [loaiNguon, setLoaiNguon] = useState("");
  const [loaiDich, setLoaiDich] = useState("");
  const [tuNgay, setTuNgay] = useState("");
  const [denNgay, setDenNgay] = useState("");
  const [chon, setChon] = useState<Set<string>>(new Set());

  /** Tên loại NL có THẬT trong sổ + có trong danh mục — lọc theo cả hai nguồn. */
  const optLoai = useMemo(() => {
    const ten = new Set<string>([
      ...rows.map((r) => r.materialTypeName).filter(Boolean),
      ...loaiNL.map((l) => l.name),
    ]);
    return [...ten].sort((a, b) => a.localeCompare(b, "vi")).map((t) => ({ value: t, label: t }));
  }, [rows, loaiNL]);

  const dongKhop = useMemo(() => {
    if (!loaiNguon) return [];
    return rows
      .filter((r) => r.materialTypeName === loaiNguon)
      .filter((r) => !tuNgay || r.deliveryDate >= tuNgay)
      .filter((r) => !denNgay || r.deliveryDate <= denNgay)
      .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  }, [rows, loaiNguon, tuNgay, denNgay]);

  const doi = (id: string) =>
    setChon((cu) => {
      const moi = new Set(cu);
      if (moi.has(id)) moi.delete(id);
      else moi.add(id);
      return moi;
    });

  const tickHet = () => setChon(new Set(dongKhop.map((r) => r.id)));
  const boHet = () => setChon(new Set());

  const tongKg = dongKhop.filter((r) => chon.has(r.id)).reduce((s, r) => s + r.quantityKg, 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Đổi loại nguyên liệu hàng loạt</DialogTitle>
          <DialogDescription>
            Chọn loại đang ghi trong sổ, tick những chuyến thật ra là loại khác, rồi đổi
            sang loại đúng. Chỉ đổi TÊN LOẠI — khối lượng, đơn giá, ngày và chuyến giữ
            nguyên.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Combobox
            label="Đang ghi là loại"
            value={loaiNguon}
            onChange={(v) => {
              setLoaiNguon(v);
              setChon(new Set());
            }}
            options={optLoai}
          />
          <Combobox
            label="Đổi sang loại"
            value={loaiDich}
            onChange={setLoaiDich}
            options={optLoai}
            onCreate={onThemLoaiNL}
          />
        </div>
        <DateRangeField
          label="Giới hạn khoảng ngày"
          anNhanBatBuoc
          startDate={tuNgay}
          endDate={denNgay}
          onChange={(tu, den) => {
            setTuNgay(tu);
            setDenNgay(den);
            setChon(new Set());
          }}
        />

        {loaiNguon && dongKhop.length === 0 && (
          <EmptyState
            icon={Layers}
            tieuDe="Không có chuyến nào khớp"
            moTa="Đổi loại nguồn hoặc nới khoảng ngày."
          />
        )}

        {dongKhop.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={tickHet}>
                Tick hết ({dongKhop.length})
              </Button>
              <Button variant="outline" size="sm" onClick={boHet}>
                Bỏ tick
              </Button>
              <span className="text-base text-muted-foreground">
                Đã chọn {chon.size} chuyến — {num(tongKg)} kg
              </span>
            </div>

            <div className="scroll-nice max-h-80 overflow-y-auto rounded-xl ring-1 ring-foreground/10">
              <table className="w-full border-collapse text-base">
                <thead>
                  <tr>
                    <th className="border-b-2 border-border bg-card px-3 py-2 text-left">Đổi</th>
                    <th className="border-b-2 border-border bg-card px-3 py-2 text-left">Ngày</th>
                    <th className="border-b-2 border-border bg-card px-3 py-2 text-left">
                      Đại lý
                    </th>
                    <th className="border-b-2 border-border bg-card px-3 py-2 text-left">
                      Phân xưởng
                    </th>
                    <th className="border-b-2 border-border bg-card px-3 py-2 text-right">kg</th>
                  </tr>
                </thead>
                <tbody>
                  {dongKhop.map((r) => (
                    <tr key={r.id}>
                      <td className="border-b border-border px-3 py-2">
                        <input
                          type="checkbox"
                          className="size-6"
                          checked={chon.has(r.id)}
                          onChange={() => doi(r.id)}
                          aria-label={`Đổi loại chuyến ${r.supplierName} ngày ${viDate(r.deliveryDate)}`}
                        />
                      </td>
                      <td className="border-b border-border px-3 py-2">
                        {viDate(r.deliveryDate)}
                      </td>
                      <td className="border-b border-border px-3 py-2">{r.supplierName}</td>
                      <td className="border-b border-border px-3 py-2">{r.workshop}</td>
                      <td className="tnum border-b border-border px-3 py-2 text-right">
                        {num(r.quantityKg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            Hủy
          </Button>
          <Button
            size="lg"
            onClick={() => {
              if (!loaiDich.trim()) {
                notify.loi("Chưa chọn loại đích");
                return;
              }
              if (loaiDich === loaiNguon) {
                notify.loi("Loại đích trùng loại nguồn");
                return;
              }
              if (chon.size === 0) {
                notify.loi("Chưa tick chuyến nào");
                return;
              }
              onLuu([...chon], loaiDich.trim());
            }}
          >
            Đổi {chon.size} chuyến
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
