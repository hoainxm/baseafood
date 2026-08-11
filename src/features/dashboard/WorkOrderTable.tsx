// ============================================================
// Tên file cũ: src/features/dashboard/BangLSX.tsx
// Tên tiếng Việt: Bảng danh sách Lệnh sản xuất tổng quan
// Description: Work Order Overview Summary Table
// ============================================================
// src/features/dashboard/BangLSX.tsx
import { RecordTable, Button, type Cot } from "@/design-system";
import { Clock } from "lucide-react";
import { ThanhTienDo } from "./CommonWidget";
import type { LenhSanXuat } from "./mockDashboardData";

/**
 * BangLSX — bảng lệnh sản xuất đang chạy. Dùng RecordTable của design-system
 * (desktop = bảng, điện thoại = thẻ). Hạn giao trong 2 ngày tô vàng.
 */
export function BangLSX({
  rows,
  onXem,
}: {
  rows: LenhSanXuat[];
  onXem: (lsx: LenhSanXuat) => void;
}) {
  const columns: Cot<LenhSanXuat>[] = [
    {
      key: "ma",
      header: "Mã LSX",
      render: (r) => <span className="font-mono font-semibold">{r.id}</span>,
      sapXep: (r) => r.id,
    },
    { key: "sp", header: "Sản phẩm", chinh: true, render: (r) => r.sp, sapXep: (r) => r.sp },
    { key: "kh", header: "Khách hàng", render: (r) => r.kh, sapXep: (r) => r.kh },
    {
      key: "td",
      header: "Tiến độ",
      render: (r) => (
        <span className="flex min-w-[168px] items-center gap-2.5">
          <ThanhTienDo pct={r.tienDo} mau={r.tienDo >= 90 ? "bg-success" : "bg-primary"} />
          <span className="font-mono text-sm font-semibold tnum">{r.tienDo}%</span>
        </span>
      ),
      sapXep: (r) => r.tienDo,
    },
    {
      key: "han",
      header: "Hạn giao",
      render: (r) =>
        r.gap ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-surface px-2.5 py-1 font-semibold text-warning">
            <Clock className="size-5" aria-hidden />
            {r.han}
          </span>
        ) : (
          r.han
        ),
      sapXep: (r) => r.han,
    },
  ];

  return (
    <RecordTable
      rows={rows}
      getKey={(r) => r.id}
      columns={columns}
      timKiem={(r) => `${r.id} ${r.sp} ${r.kh}`}
      nhanTimKiem="Tìm theo mã lệnh / sản phẩm / khách hàng…"
      actions={(r) => (
        <Button variant="outline" size="sm" onClick={() => onXem(r)}>
          Xem lệnh
        </Button>
      )}
    />
  );
}
