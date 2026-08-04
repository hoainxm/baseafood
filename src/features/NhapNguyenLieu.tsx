import { useMemo, useState } from "react";
import type { DongNhapNL, PhanXuong } from "@/types";
import { loadNhapNL, saveNhapNL, newId } from "@/lib/store";
import { Button, Card, Input, Select, Label, Badge } from "@/components/ui";
import { kg, num, todayISO, viDate } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

const PHAN_XUONG: PhanXuong[] = ["Đông", "Cá", "Khô"];

// Gợi ý loại nguyên liệu (rút từ sổ thực tế) — vẫn cho nhập tự do.
const LOAI_NL_GOI_Y = [
  "1 da nguyên liệu",
  "2 da nguyên liệu",
  "Bạch tuộc 1 da",
  "Bạch tuộc 2 da",
  "Mực ống 7cm",
  "Mực nang",
  "Đầu ống",
  "Bao tử",
  "Ghẹ lột",
  "Cá nục",
  "Cá saba",
  "Cá sòng",
];

interface FormState {
  daiLy: string;
  loaiNL: string;
  soLuongKg: string;
  donGia: string;
  taiXe: string;
  bienSoXe: string;
  ghiChu: string;
}

const EMPTY: FormState = {
  daiLy: "",
  loaiNL: "",
  soLuongKg: "",
  donGia: "",
  taiXe: "",
  bienSoXe: "",
  ghiChu: "",
};

export default function NhapNguyenLieuScreen() {
  const [rows, setRows] = useState<DongNhapNL[]>(() => loadNhapNL());
  const [ngay, setNgay] = useState(todayISO());
  const [phanXuong, setPhanXuong] = useState<PhanXuong>("Đông");
  const [form, setForm] = useState<FormState>(EMPTY);

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const persist = (next: DongNhapNL[]) => {
    setRows(next);
    saveNhapNL(next);
  };

  const view = useMemo(
    () =>
      rows
        .filter((r) => r.ngay === ngay && r.phanXuong === phanXuong)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [rows, ngay, phanXuong],
  );

  const tong = useMemo(
    () => view.reduce((s, r) => s + (r.soLuongKg || 0), 0),
    [view],
  );

  const canAdd =
    form.daiLy.trim() && form.loaiNL.trim() && Number(form.soLuongKg) > 0;

  const add = () => {
    if (!canAdd) return;
    const row: DongNhapNL = {
      id: newId(),
      ngay,
      phanXuong,
      daiLy: form.daiLy.trim(),
      loaiNL: form.loaiNL.trim(),
      soLuongKg: Number(form.soLuongKg),
      donGia: form.donGia ? Number(form.donGia) : null,
      taiXe: form.taiXe.trim(),
      bienSoXe: form.bienSoXe.trim(),
      ghiChu: form.ghiChu.trim(),
    };
    persist([...rows, row]);
    setForm(EMPTY);
  };

  const remove = (id: string) => persist(rows.filter((r) => r.id !== id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Nhập nguyên liệu hàng ngày
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Ghi theo sổ "Báo cáo tổng hợp nguyên liệu hàng ngày" — mỗi dòng một
          chuyến của đại lý.
        </p>
      </div>

      {/* Bộ lọc ngày + phân xưởng */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="sm:w-48">
          <Label>Ngày</Label>
          <Input
            type="date"
            value={ngay}
            onChange={(e) => setNgay(e.target.value)}
          />
        </div>
        <div className="sm:w-48">
          <Label>Phân xưởng</Label>
          <Select
            value={phanXuong}
            onChange={(e) => setPhanXuong(e.target.value as PhanXuong)}
          >
            {PHAN_XUONG.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Form thêm dòng */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Đại lý *</Label>
            <Input
              value={form.daiLy}
              onChange={(e) => set("daiLy", e.target.value)}
              placeholder="VD: H.Phú"
            />
          </div>
          <div>
            <Label>Loại nguyên liệu *</Label>
            <Input
              list="loai-nl"
              value={form.loaiNL}
              onChange={(e) => set("loaiNL", e.target.value)}
              placeholder="VD: 2 da nguyên liệu"
            />
            <datalist id="loai-nl">
              {LOAI_NL_GOI_Y.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>Số lượng (kg) *</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={form.soLuongKg}
              onChange={(e) => set("soLuongKg", e.target.value)}
              placeholder="0"
              className="tnum"
            />
          </div>
          <div>
            <Label>Đơn giá</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={form.donGia}
              onChange={(e) => set("donGia", e.target.value)}
              placeholder="0"
              className="tnum"
            />
          </div>
          <div>
            <Label>Tài xế</Label>
            <Input
              value={form.taiXe}
              onChange={(e) => set("taiXe", e.target.value)}
              placeholder="Tên tài xế"
            />
          </div>
          <div>
            <Label>Biển số xe</Label>
            <Input
              value={form.bienSoXe}
              onChange={(e) => set("bienSoXe", e.target.value)}
              placeholder="VD: 86C 19555"
            />
          </div>
          <div className="lg:col-span-2">
            <Label>Ghi chú</Label>
            <Input
              value={form.ghiChu}
              onChange={(e) => set("ghiChu", e.target.value)}
              placeholder="Ghi chú thêm (nếu có)"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={add} disabled={!canAdd}>
            <Plus className="size-4" />
            Thêm dòng
          </Button>
        </div>
      </Card>

      {/* Danh sách trong ngày */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">
          Ngày {viDate(ngay)} · Phân xưởng {phanXuong}
        </h2>
        <Badge className="bg-cyan-50 text-cyan-700">
          Tổng: <span className="tnum ml-1 font-semibold">{kg(tong)}</span>
        </Badge>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Đại lý</th>
                <th className="px-4 py-2.5 font-medium">Loại nguyên liệu</th>
                <th className="px-4 py-2.5 text-right font-medium">SL (kg)</th>
                <th className="px-4 py-2.5 text-right font-medium">Đơn giá</th>
                <th className="px-4 py-2.5 font-medium">Xe</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {view.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-800">{r.daiLy}</td>
                  <td className="px-4 py-2.5 text-slate-800">{r.loaiNL}</td>
                  <td className="tnum px-4 py-2.5 text-right text-slate-800">
                    {num(r.soLuongKg)}
                  </td>
                  <td className="tnum px-4 py-2.5 text-right text-slate-500">
                    {num(r.donGia)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {[r.taiXe, r.bienSoXe].filter(Boolean).join(" · ")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => remove(r.id)}
                      className="text-slate-400 hover:text-red-600"
                      title="Xóa dòng"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {view.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    Chưa có dòng nhập nào cho ngày này.
                  </td>
                </tr>
              )}
            </tbody>
            {view.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-medium">
                  <td className="px-4 py-2.5" colSpan={2}>
                    Tổng cộng
                  </td>
                  <td className="tnum px-4 py-2.5 text-right text-slate-900">
                    {num(tong)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
