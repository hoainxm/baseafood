import { useMemo, useState } from "react";
import data from "@/data/thanh-pham.json";
import type { ThanhPham } from "@/types";
import { Card, Input, Select, Badge } from "@/components/ui";
import { Search } from "lucide-react";

const ITEMS = data as ThanhPham[];

export default function ThanhPhamScreen() {
  const [q, setQ] = useState("");
  const [nhom, setNhom] = useState("");

  const nhomList = useMemo(
    () => Array.from(new Set(ITEMS.map((i) => i.nhom))).sort(),
    [],
  );

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return ITEMS.filter((i) => {
      if (nhom && i.nhom !== nhom) return false;
      if (!kw) return true;
      return (
        i.ma.toLowerCase().includes(kw) || i.ten.toLowerCase().includes(kw)
      );
    });
  }, [q, nhom]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Danh mục thành phẩm
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Nạp từ danh mục kế toán (tài khoản 1551). Tổng {ITEMS.length} mã, đơn vị
          ki-lô-gam.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo mã hoặc tên…"
            className="pl-9"
          />
        </div>
        <Select
          value={nhom}
          onChange={(e) => setNhom(e.target.value)}
          className="sm:w-52"
        >
          <option value="">Tất cả nhóm</option>
          {nhomList.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>

      <div className="text-sm text-slate-500">
        Hiển thị <span className="font-medium text-slate-700">{rows.length}</span>{" "}
        / {ITEMS.length} mã
      </div>

      <Card className="overflow-hidden">
        <div className="max-h-[62vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Mã</th>
                <th className="px-4 py-2.5 font-medium">Tên thành phẩm</th>
                <th className="px-4 py-2.5 font-medium">Nhóm</th>
                <th className="px-4 py-2.5 text-right font-medium">ĐVT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.ma} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                    {r.ma}
                  </td>
                  <td className="px-4 py-2.5 text-slate-800">{r.ten}</td>
                  <td className="px-4 py-2.5">
                    <Badge>{r.nhom}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">
                    {r.dvt}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    Không có mã nào khớp.
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
