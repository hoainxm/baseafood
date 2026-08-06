import { useMemo, useState } from "react";
import type { ThanhPham } from "@/types";
import { useThanhPham } from "@/lib/danhMuc";
import {
  Badge,
  Button,
  Combobox,
  EmptyState,
  RecordTable,
  type Cot,
} from "@/design-system";
import { Search, X } from "lucide-react";

/**
 * Danh mục thành phẩm 141 mã (tài khoản 1551) — CHỈ ĐỌC.
 *
 * Danh mục do kế toán phát hành, sửa ở đây sẽ lệch sổ kế toán nên màn này
 * không có Thêm/Sửa/Xóa. Việc dùng thực tế là TRA CỨU và ÁNH XẠ sang mặt hàng
 * cân đối — nên màn tối ưu cho tìm kiếm và sắp xếp, không phải nhập liệu.
 */
export default function ThanhPhamScreen() {
  const [nhom, setNhom] = useState("");
  const [items] = useThanhPham();

  const nhomList = useMemo(
    () => Array.from(new Set(items.map((i) => i.nhom))).sort(),
    [items]
  );

  const rows = useMemo(
    () => (nhom ? items.filter((i) => i.nhom === nhom) : items),
    [nhom, items]
  );

  const cols: Cot<ThanhPham>[] = [
    {
      key: "ten",
      header: "Tên thành phẩm",
      chinh: true,
      render: (r) => r.ten,
      sapXep: (r) => r.ten,
    },
    {
      key: "ma",
      header: "Mã",
      render: (r) => <span className="tnum font-medium">{r.ma}</span>,
      sapXep: (r) => r.ma,
    },
    {
      key: "nhom",
      header: "Nhóm",
      render: (r) => <Badge>{r.nhom}</Badge>,
      sapXep: (r) => r.nhom,
    },
    {
      key: "dvt",
      header: "Đơn vị",
      render: (r) => r.dvt,
      anTrenDienThoai: true,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Thành phẩm theo danh mục kế toán
        </h2>
        <p className="mt-1 text-base text-muted-foreground">
          {items.length} mã, tài khoản 1551, đơn vị ki-lô-gam. Danh mục chỉ để
          tra cứu — muốn đổi phải sửa ở sổ kế toán.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-64 flex-1">
          <Combobox
            label="Nhóm hàng"
            value={nhom}
            onChange={setNhom}
            options={nhomList.map((n) => ({ value: n, label: n }))}
            placeholder="Tất cả nhóm"
          />
        </div>
        <p className="pb-3 text-base text-muted-foreground">
          Đang hiện{" "}
          <span className="tnum font-semibold text-foreground">
            {rows.length}
          </span>{" "}
          / {items.length} mã
        </p>
        {nhom && (
          <Button variant="outline" className="mb-1" onClick={() => setNhom("")}>
            <X />
            Bỏ lọc nhóm
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Search}
          tieuDe="Không có mã nào trong nhóm này"
          moTa="Bỏ lọc nhóm để xem lại toàn bộ danh mục."
          action={
            <Button size="lg" onClick={() => setNhom("")}>
              Bỏ lọc nhóm
            </Button>
          }
        />
      ) : (
        <RecordTable
          columns={cols}
          rows={rows}
          getKey={(r) => r.ma}
          timKiem={(r) => `${r.ma} ${r.ten} ${r.nhom}`}
          nhanTimKiem="Tìm theo tên hoặc mã thành phẩm…"
        />
      )}
    </div>
  );
}
