import { useMemo, useState } from "react";
import type { MatHang } from "@/types";
import { KEYS, load, save, uid } from "@/lib/db";
import { Button, Card, Input, Label, Badge } from "@/components/ui";
import { Plus, Trash2, Search } from "lucide-react";
import tp141 from "@/data/thanh-pham.json";

const TP141 = tp141 as { ma: string; ten: string }[];

export default function MatHangScreen() {
  const [rows, setRows] = useState<MatHang[]>(() => load(KEYS.matHang));
  const [q, setQ] = useState("");
  const [ma, setMa] = useState("");
  const [ten, setTen] = useState("");
  const [maTP, setMaTP] = useState("");

  const persist = (next: MatHang[]) => {
    setRows(next);
    save(KEYS.matHang, next);
  };

  const view = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(
      (r) =>
        r.ma.toLowerCase().includes(kw) || r.ten.toLowerCase().includes(kw),
    );
  }, [rows, q]);

  const canAdd = ten.trim().length > 0;

  const add = () => {
    if (!canAdd) return;
    persist([
      ...rows,
      { id: uid(), ma: ma.trim(), ten: ten.trim(), maTP: maTP.trim() },
    ]);
    setMa("");
    setTen("");
    setMaTP("");
  };

  const remove = (id: string) => persist(rows.filter((r) => r.id !== id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Danh mục mặt hàng cân đối
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Danh mục mở — thêm mặt hàng mới khi thiếu. Ánh xạ mã thành phẩm 141 nếu có.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <Label>Mã</Label>
            <Input value={ma} onChange={(e) => setMa(e.target.value)} placeholder="Tự đặt (nếu cần)" />
          </div>
          <div className="sm:col-span-2">
            <Label>Tên mặt hàng *</Label>
            <Input value={ten} onChange={(e) => setTen(e.target.value)} placeholder="VD: 2 da cắt luộc 1000-1300" />
          </div>
          <div>
            <Label>Mã TP 141</Label>
            <Input
              list="tp141"
              value={maTP}
              onChange={(e) => setMaTP(e.target.value)}
              placeholder="Ánh xạ (nếu có)"
            />
            <datalist id="tp141">
              {TP141.map((t) => (
                <option key={t.ma} value={t.ma}>
                  {t.ten}
                </option>
              ))}
            </datalist>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={add} disabled={!canAdd}>
            <Plus className="size-4" />
            Thêm mặt hàng
          </Button>
        </div>
      </Card>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mặt hàng…" className="pl-9" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Mã</th>
                <th className="px-4 py-2.5 font-medium">Tên mặt hàng</th>
                <th className="px-4 py-2.5 font-medium">Mã TP 141</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {view.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{r.ma || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-800">{r.ten}</td>
                  <td className="px-4 py-2.5">
                    {r.maTP ? <Badge>{r.maTP}</Badge> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => remove(r.id)} className="text-slate-400 hover:text-red-600" title="Xóa">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {view.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    Chưa có mặt hàng. Thêm ở form trên.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
